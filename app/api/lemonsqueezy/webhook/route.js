import crypto from "node:crypto";
import { NextResponse } from "next/server";

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

function pickCustomerEmail(attributes) {
  return (
    attributes.user_email ||
    attributes.customer_email ||
    attributes.email ||
    null
  );
}

function pickCustomerName(attributes) {
  return (
    attributes.user_name ||
    attributes.customer_name ||
    attributes.name ||
    null
  );
}

function pickProductName(attributes) {
  return (
    attributes.product_name ||
    attributes.variant_name ||
    attributes.first_order_item?.product_name ||
    attributes.first_order_item?.variant_name ||
    null
  );
}

export async function POST(request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "Missing webhook secret" },
      { status: 500 }
    );
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
  const name = pickCustomerName(attributes);
  const productName = pickProductName(attributes);
  const status = attributes.status || null;
  const orderId = attributes.order_id || payload?.data?.id || null;
  const customerId = attributes.customer_id || null;

  console.log("[LemonSqueezy] Manual activation needed");
  console.log(
    JSON.stringify(
      {
        eventName,
        email,
        name,
        productName,
        status,
        orderId,
        customerId,
      },
      null,
      2
    )
  );

  return NextResponse.json({
    received: true,
    eventName,
    email,
    productName,
  });
}
