// app/api/lemonsqueezy/webhook/route.js
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

function verifySignature(rawBody, signature, secret) {
  if (!signature || !secret || !rawBody) return false;
  const digest = Buffer.from(
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex"),
    "hex"
  );
  const sig = Buffer.from(signature, "hex");
  if (digest.length !== sig.length) return false;
  return crypto.timingSafeEqual(digest, sig);
}

function getVariantIdToPlan() {
  const map = {};
  const entries = [
    [process.env.LEMONSQUEEZY_STARTER_VARIANT_ID, "starter"],
    [process.env.LEMONSQUEEZY_PRO_VARIANT_ID, "pro"],
    [process.env.LEMONSQUEEZY_BUSINESS_VARIANT_ID, "business"],
    [process.env.LEMONSQUEEZY_LAUNCH_VARIANT_ID, "business"],
  ];
  for (const [id, plan] of entries) {
    if (id) map[id] = plan;
  }
  return map;
}

function pickCustomerEmail(attributes) {
  return attributes.user_email || attributes.customer_email || attributes.email || null;
}

function pickVariantId(attributes) {
  return (
    attributes.variant_id ||
    attributes.first_order_item?.variant_id ||
    null
  );
}

export async function POST(request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("X-Signature");
  const eventName = request.headers.get("X-Event-Name") || "unknown";

  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const attributes = payload?.data?.attributes || {};
  const email = pickCustomerEmail(attributes);
  const variantId = String(pickVariantId(attributes) || "");
  const variantMap = getVariantIdToPlan();
  const plan = variantMap[variantId] || null;

  console.log("[LemonSqueezy] Event received", { eventName, email, variantId, plan });

  const activationEvents = ["order_created", "subscription_created", "subscription_updated"];
  const cancellationEvents = ["subscription_cancelled"];

  if (activationEvents.includes(eventName) && email && plan) {
    const supabase = await createServiceClient();
    const { error } = await supabase
      .from("profiles")
      .update({ plan })
      .eq("email", email);

    if (error) {
      console.error("[LemonSqueezy] Failed to update plan", error);
      return NextResponse.json({ error: "DB update failed" }, { status: 500 });
    }

    console.log("[LemonSqueezy] Plan updated", { email, plan });
  } else if (cancellationEvents.includes(eventName) && email) {
    console.log("[LemonSqueezy] Cancellation — manual review needed", { email });
  } else {
    console.log("[LemonSqueezy] No action taken", { eventName, email, variantId });
  }

  return NextResponse.json({ received: true, eventName });
}
