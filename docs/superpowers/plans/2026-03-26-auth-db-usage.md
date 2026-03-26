# Auth, Database & Usage Limits Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase auth (Google + email/password), persistent article storage, per-plan usage limits, and automatic LemonSqueezy payment activation to ContentPilot.

**Architecture:** Supabase handles auth and PostgreSQL database. A Next.js 16 `proxy.js` protects `/app`. The generate API checks usage limits before streaming and saves articles after. The LemonSqueezy webhook automatically updates plan on payment.

**Tech Stack:** Next.js 16.2.1, @supabase/ssr, @supabase/supabase-js, Supabase Auth (Google OAuth + email/password), Supabase PostgreSQL, Netlify

**Spec:** `docs/superpowers/specs/2026-03-26-auth-db-design.md`

---

## Chunk 1: Foundation — Packages, Lib Files, Database Schema

### Task 1: Install Supabase packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Verify install**

```bash
cat package.json | grep supabase
```
Expected: both `@supabase/supabase-js` and `@supabase/ssr` appear in dependencies.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add supabase packages"
```

---

### Task 2: Create plan limits helper

**Files:**
- Create: `lib/plans.js`

- [ ] **Step 1: Create the file**

```js
// lib/plans.js
export const PLAN_LIMITS = {
  free: 3,
  starter: 20,
  pro: 30,
  business: 100,
};

export function getPlanLimit(plan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}
```

- [ ] **Step 2: Verify manually**

Open `lib/plans.js` and confirm the limits match the spec.

- [ ] **Step 3: Commit**

```bash
git add lib/plans.js
git commit -m "feat: add plan limits helper"
```

---

### Task 3: Create Supabase browser client

**Files:**
- Create: `lib/supabase.js`

- [ ] **Step 1: Create the file**

```js
// lib/supabase.js
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase.js
git commit -m "feat: add supabase browser client"
```

---

### Task 4: Create Supabase server client

**Files:**
- Create: `lib/supabase-server.js`

- [ ] **Step 1: Create the file**

```js
// lib/supabase-server.js
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

export async function createServiceClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase-server.js
git commit -m "feat: add supabase server client"
```

---

### Task 5: Set up Supabase project and database schema

**Where:** Supabase dashboard → SQL Editor

- [ ] **Step 1: Create a Supabase project**

Go to supabase.com → New project. Note the project URL and keys.

- [ ] **Step 2: Add environment variables to `.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 3: Run SQL — create tables**

In Supabase dashboard → SQL Editor, run:

```sql
-- profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  articles_used_this_month integer NOT NULL DEFAULT 0,
  reset_date timestamptz NOT NULL DEFAULT now() + interval '1 month',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- articles table
CREATE TABLE articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  keyword text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT '',
  tone text NOT NULL DEFAULT '',
  word_count integer NOT NULL DEFAULT 0,
  seo_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 4: Run SQL — enable RLS and add policies**

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- articles policies
CREATE POLICY "Users can view own articles"
  ON articles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own articles"
  ON articles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own articles"
  ON articles FOR DELETE
  USING (auth.uid() = user_id);
```

- [ ] **Step 5: Run SQL — create auto-profile trigger**

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, plan, articles_used_this_month, reset_date)
  VALUES (
    NEW.id,
    NEW.email,
    'free',
    0,
    now() + interval '1 month'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

- [ ] **Step 6: Enable Google OAuth in Supabase**

Supabase dashboard → Authentication → Providers → Google → Enable.
Add Google Client ID and Secret (from Google Cloud Console).
Add `https://your-project.supabase.co/auth/v1/callback` as authorized redirect URI in Google Cloud Console.

- [ ] **Step 7: Add Site URL in Supabase**

Supabase dashboard → Authentication → URL Configuration:
- Site URL: your Netlify URL (e.g. `https://contentpilot.netlify.app`)
- Redirect URLs: add `https://contentpilot.netlify.app/**` and `http://localhost:3000/**`

- [ ] **Step 6b: Run SQL — create atomic increment RPC function**

```sql
CREATE OR REPLACE FUNCTION increment_article_count(user_id uuid)
RETURNS void AS $$
  UPDATE profiles
  SET articles_used_this_month = articles_used_this_month + 1
  WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;
```

- [ ] **Step 8: Verify tables exist**

In Supabase dashboard → Table Editor, confirm `profiles` and `articles` tables appear with correct columns.

---

## Chunk 2: Auth — Login Page and Route Protection

### Task 6: Create login page

**Files:**
- Create: `app/login/page.jsx`

- [ ] **Step 1: Create the login page**

```jsx
// app/login/page.jsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleGoogle() {
    setError("");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/app` },
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      router.push("/app");
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      setMessage("Check your email for a confirmation link.");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#06060f",
      color: "#eef2ff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
    }}>
      <div style={{
        width: 380,
        background: "#0a0a1a",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 40,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40,
            background: "linear-gradient(135deg, #6366f1, #22d3ee)",
            borderRadius: 10, display: "inline-flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 800, transform: "rotate(-5deg)",
            marginBottom: 12,
          }}>*</div>
          <div style={{ fontWeight: 800, fontSize: "1.2rem" }}>ContentPilot</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            {mode === "signin" ? "Sign in to your account" : "Create your account"}
          </div>
        </div>

        {/* Google button */}
        <button
          onClick={handleGoogle}
          style={{
            width: "100%", padding: "11px 16px", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            color: "#e2e8f0", fontSize: 14, fontWeight: 600,
            cursor: "pointer", marginBottom: 20, display: "flex",
            alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
          </svg>
          Continue with Google
        </button>

        <div style={{ textAlign: "center", color: "#475569", fontSize: 12, marginBottom: 20 }}>or</div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit}>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" required
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 8, marginBottom: 10,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#fff", fontSize: 14, outline: "none",
            }}
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" required
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 8, marginBottom: 16,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#fff", fontSize: 14, outline: "none",
            }}
          />

          {error && (
            <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</div>
          )}
          {message && (
            <div style={{ color: "#34d399", fontSize: 13, marginBottom: 12 }}>{message}</div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: "100%", padding: "12px", borderRadius: 10, border: "none",
              background: loading ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #7c3aed)",
              color: "#fff", fontSize: 15, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {/* Toggle mode */}
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#64748b" }}>
          {mode === "signin" ? (
            <>No account?{" "}
              <button onClick={() => setMode("signup")} style={{ background: "none", border: "none", color: "#818cf8", cursor: "pointer", fontSize: 13 }}>
                Sign up free
              </button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button onClick={() => setMode("signin")} style={{ background: "none", border: "none", color: "#818cf8", cursor: "pointer", fontSize: 13 }}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test locally**

```bash
npm run dev
```
Go to `http://localhost:3000/login` — login page should render with Google button and email/password form.

- [ ] **Step 3: Commit**

```bash
git add app/login/page.jsx
git commit -m "feat: add login page"
```

---

### Task 7: Create proxy.js to protect /app route

**Files:**
- Create: `proxy.js` (project root)

- [ ] **Step 1: Create the file**

```js
// proxy.js
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function proxy(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith("/app")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/app/:path*"],
};
```

- [ ] **Step 2: Update root page to redirect to login**

Replace `app/page.jsx` content:

```jsx
// app/page.jsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/login");
}
```

- [ ] **Step 3: Test route protection locally**

```bash
npm run dev
```
Go to `http://localhost:3000/app` without being logged in → should redirect to `/login`.
Log in → should be redirected to `/app`.

- [ ] **Step 4: Commit**

```bash
git add proxy.js app/page.jsx
git commit -m "feat: add route protection via proxy.js"
```

---

## Chunk 3: Generate API — Auth Check, Usage Limits, Article Saving

### Task 8: Update generate route

**Files:**
- Modify: `app/api/generate/route.js`

- [ ] **Step 1: Replace the generate route**

```js
// app/api/generate/route.js
import { createClient } from "@/lib/supabase-server";
import { getPlanLimit } from "@/lib/plans";

function buildPrompt({ keyword, language, tone, wordCount }) {
  return `You are ContentPilot, an expert SEO content writer. Generate a comprehensive, well-structured article optimized for the keyword provided.

RULES:
- Write in ${language} language
- Use a ${tone.toLowerCase()} tone
- Target approximately ${wordCount} words
- Use markdown formatting with ## for H2 and ### for H3 headings
- Include the target keyword naturally throughout (1-2% density)
- Start with a compelling introduction
- Use 4-6 H2 sections with descriptive headings
- Include H3 subheadings within sections
- Use bold for key terms
- End with a strong conclusion
- Write unique, original, human-sounding content
- Optimize for both Google SEO and AI search engines
FIRST LINE: Output ONLY the article title on the first line, prefixed with "# "
Then write the full article.`;
}

export async function POST(request) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { keyword, language, tone, wordCount } = await request.json();

    console.log("[Generate] Request received", { keyword, language, tone, wordCount, userId: user.id });

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "ANTHROPIC_API_KEY is missing on the server." }, { status: 500 });
    }

    if (!keyword?.trim()) {
      return Response.json({ error: "Keyword is required." }, { status: 400 });
    }

    // Fetch profile and check usage limit
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("plan, articles_used_this_month, reset_date")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ error: "User profile not found." }, { status: 500 });
    }

    // Monthly reset check
    if (new Date() > new Date(profile.reset_date)) {
      await supabase
        .from("profiles")
        .update({
          articles_used_this_month: 0,
          reset_date: (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString(); })(),
        })
        .eq("id", user.id);
      profile.articles_used_this_month = 0;
    }

    const limit = getPlanLimit(profile.plan);
    if (profile.articles_used_this_month >= limit) {
      return Response.json(
        { error: `You've used all ${limit} articles for this month. Upgrade your plan to continue.`, limitReached: true },
        { status: 403 }
      );
    }

    // Call Anthropic with streaming
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    let anthropicResponse;
    try {
      anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          stream: true,
          system: buildPrompt({ keyword, language, tone, wordCount }),
          messages: [{ role: "user", content: `Write a comprehensive SEO article targeting the keyword: "${keyword}"` }],
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error?.name === "AbortError") {
        return Response.json({ error: "Request timed out. Please try again." }, { status: 504 });
      }
      return Response.json({ error: error?.message || "Anthropic request failed." }, { status: 502 });
    }

    clearTimeout(timeoutId);

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      let errData = {};
      try { errData = JSON.parse(errText); } catch {}
      return Response.json({ error: errData.error?.message || "Anthropic API error" }, { status: anthropicResponse.status });
    }

    // Stream and accumulate
    const encoder = new TextEncoder();
    let fullText = "";

    const stream = new ReadableStream({
      async start(controller) {
        const reader = anthropicResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                  const chunk = parsed.delta.text;
                  fullText += chunk;
                  controller.enqueue(encoder.encode(chunk));
                }
              } catch {}
            }
          }
        } catch (err) {
          console.error("[Generate] Stream error", err);
        } finally {
          // Save article and increment counter after streaming
          if (fullText.trim()) {
            const lines = fullText.split("\n");
            const title = lines[0]?.startsWith("# ") ? lines[0].replace(/^#\s+/, "") : keyword;
            const body = lines[0]?.startsWith("# ") ? lines.slice(1).join("\n").trim() : fullText;
            const wordCountActual = body.trim().split(/\s+/).length;

            await supabase.from("articles").insert({
              user_id: user.id,
              title,
              content: body,
              keyword,
              language,
              tone,
              word_count: wordCountActual,
              seo_score: 0,
            });

            // Atomic increment — avoids race condition from concurrent tabs
            await supabase.rpc("increment_article_count", { user_id: user.id });

            console.log("[Generate] Article saved", { title, wordCount: wordCountActual });
          }

          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[Generate] Route failed", error);
    return Response.json({ error: error?.message || "Unexpected server error." }, { status: 500 });
  }
}
```

- [ ] **Step 2: Test locally — unauthenticated request blocked**

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"keyword":"test","language":"English","tone":"Professional","wordCount":800}'
```
Expected: `{"error":"Unauthorized."}` with status 401.

- [ ] **Step 3: Test authenticated — generate an article while logged in**

Open `http://localhost:3000/app`, log in, generate an article. Check Supabase → Table Editor → `articles` — row should appear. Check `profiles` — `articles_used_this_month` should be 1.

- [ ] **Step 4: Commit**

```bash
git add app/api/generate/route.js
git commit -m "feat: add auth, usage limits, and article saving to generate route"
```

---

## Chunk 4: Webhook — Automatic Plan Activation

### Task 9: Update LemonSqueezy webhook

**Files:**
- Modify: `app/api/lemonsqueezy/webhook/route.js`

- [ ] **Step 1: Add LemonSqueezy variant ID env vars to `.env.local`**

```
LEMONSQUEEZY_STARTER_VARIANT_ID=your-starter-variant-id
LEMONSQUEEZY_PRO_VARIANT_ID=your-pro-variant-id
LEMONSQUEEZY_BUSINESS_VARIANT_ID=your-business-variant-id
LEMONSQUEEZY_LAUNCH_VARIANT_ID=your-launch-deal-variant-id
```

Find variant IDs in LemonSqueezy dashboard → Products → click product → Variants → copy the numeric ID.

- [ ] **Step 2: Replace webhook route**

```js
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
```

- [ ] **Step 3: Verify — test with a fake webhook call locally**

```bash
# Generate a fake HMAC signature
node -e "
const crypto = require('crypto');
const body = JSON.stringify({data:{attributes:{user_email:'test@test.com',variant_id:123}}});
const sig = crypto.createHmac('sha256','your-secret').update(body).digest('hex');
console.log('Signature:', sig);
console.log('Body:', body);
"
```

Then call the endpoint with that body and signature — confirm it logs "No action taken" (since variant 123 won't match).

- [ ] **Step 4: Commit**

```bash
git add app/api/lemonsqueezy/webhook/route.js
git commit -m "feat: automatic plan activation via lemonsqueezy webhook"
```

---

## Chunk 5: UI — Top Bar, Article History, Limit Enforcement

### Task 10: Update app page with user context, history, and limit UI

**Files:**
- Modify: `app/app/page.jsx`

- [ ] **Step 1: Add Supabase imports and new state at the top of the component**

After the existing imports line, add:
```js
import { useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { getPlanLimit } from "@/lib/plans";
```

Inside `ContentPilotApp()`, after the existing state declarations, add:
```js
const [user, setUser] = useState(null);
const [profile, setProfile] = useState(null);
const [articles, setArticles] = useState([]);
// useMemo ensures a stable client instance across renders
const supabase = useMemo(() => createClient(), []);
```

- [ ] **Step 2: Add useEffect to load user, profile, and article history**

After the existing `useEffect` (line ~146), add:

```js
useEffect(() => {
  async function loadUserData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUser(user);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("plan, articles_used_this_month, reset_date")
      .eq("id", user.id)
      .single();
    if (profileData) setProfile(profileData);

    const { data: articleData } = await supabase
      .from("articles")
      .select("id, title, keyword, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (articleData) setArticles(articleData);
  }
  loadUserData();
}, []);
```

- [ ] **Step 3: Add function to load article into editor**

```js
async function loadArticle(articleId) {
  const { data } = await supabase
    .from("articles")
    .select("title, content, keyword, seo_score")
    .eq("id", articleId)
    .single();
  if (!data) return;
  setGeneratedTitle(data.title);
  setGeneratedContent(data.content);
  setStreamText("");
  setKeyword(data.keyword);
  setSeoScore(data.seo_score ? { total: data.seo_score, breakdown: {}, stats: {} } : null);
  setActiveTab("editor");
}
```

- [ ] **Step 4: Add logout function**

```js
async function handleLogout() {
  await supabase.auth.signOut();
  window.location.href = "/login";
}
```

- [ ] **Step 5: Update generateArticle to check limit and refresh profile after**

First, add `user` and `profile` to the `useCallback` dependency array (find the line `}, [keyword, langLabel, tone, wordCount]);` and update it):
```js
}, [keyword, langLabel, tone, wordCount, user, profile, supabase]);
```

At the top of `generateArticle`, before the `setError("")` call, add:
```js
if (profile && profile.articles_used_this_month >= getPlanLimit(profile.plan)) {
  setError(`You've used all ${getPlanLimit(profile.plan)} articles this month. Upgrade your plan.`);
  return;
}
```

Inside the `try` block, after `setGeneratedContent(body)` and before `setIsGenerating(false)`, add:
```js
// Refresh profile counter and article list from DB
const { data: updatedProfile } = await supabase
  .from("profiles")
  .select("plan, articles_used_this_month, reset_date")
  .eq("id", user.id)
  .single();
if (updatedProfile) setProfile(updatedProfile);

const { data: updatedArticles } = await supabase
  .from("articles")
  .select("id, title, keyword, created_at")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false })
  .limit(50);
if (updatedArticles) setArticles(updatedArticles);
```

- [ ] **Step 6: Update top navigation bar JSX**

Replace the right side of the nav bar (the tabs div) with:

```jsx
<div style={{ display: "flex", alignItems: "center", gap: 16 }}>
  {/* Tabs */}
  <div style={{ display: "flex", gap: 8 }}>
    {["editor", "score", "export"].map((tab) => (
      <button
        key={tab}
        onClick={() => setActiveTab(tab)}
        style={{
          padding: "6px 16px", borderRadius: 8, border: "1px solid",
          borderColor: activeTab === tab ? "#6366f1" : "rgba(255,255,255,0.08)",
          background: activeTab === tab ? "rgba(99,102,241,0.15)" : "transparent",
          color: activeTab === tab ? "#a5b4fc" : "#64748b",
          fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
        }}
      >
        {tab === "editor" ? "Editor" : tab === "score" ? "SEO Score" : "Export"}
      </button>
    ))}
  </div>

  {/* User info */}
  {user && profile && (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 12, color: "#64748b" }}>
        {user.email}
      </span>
      <span style={{
        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
        background: profile.plan === "free" ? "rgba(100,116,139,0.2)" :
                    profile.plan === "starter" ? "rgba(59,130,246,0.2)" :
                    profile.plan === "pro" ? "rgba(99,102,241,0.2)" : "rgba(245,158,11,0.2)",
        color: profile.plan === "free" ? "#94a3b8" :
               profile.plan === "starter" ? "#60a5fa" :
               profile.plan === "pro" ? "#a5b4fc" : "#fbbf24",
        textTransform: "uppercase", letterSpacing: 1,
      }}>
        {profile.plan}
      </span>
      <span style={{ fontSize: 12, color: "#64748b" }}>
        {profile.articles_used_this_month}/{getPlanLimit(profile.plan)}
      </span>
      <button
        onClick={handleLogout}
        style={{
          padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
          background: "transparent", color: "#64748b", fontSize: 12, cursor: "pointer",
        }}
      >
        Logout
      </button>
    </div>
  )}
</div>
```

- [ ] **Step 7: Add article history section to left sidebar**

In the left sidebar, after the Generate button and error display, add:

```jsx
{articles.length > 0 && (
  <div style={{ marginTop: 24 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
      History
    </div>
    <div style={{ maxHeight: 280, overflowY: "auto" }}>
      {articles.map((article) => {
        const date = new Date(article.created_at);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        const dateLabel = diffDays === 0 ? "Today" : diffDays === 1 ? "Yesterday" : `${diffDays}d ago`;
        return (
          <button
            key={article.id}
            onClick={() => loadArticle(article.id)}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "8px 10px", borderRadius: 8, border: "none",
              background: "rgba(255,255,255,0.02)", cursor: "pointer",
              marginBottom: 4, color: "#94a3b8",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {article.title || article.keyword}
            </div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{dateLabel}</div>
          </button>
        );
      })}
    </div>
  </div>
)}
```

- [ ] **Step 8: Update Generate button to show limit warning**

Replace the Generate button section:

```jsx
{profile && profile.articles_used_this_month >= getPlanLimit(profile.plan) ? (
  <div style={{
    padding: "12px 14px", borderRadius: 12,
    background: "rgba(248,113,113,0.08)",
    border: "1px solid rgba(248,113,113,0.2)",
    fontSize: 13, color: "#f87171", textAlign: "center",
  }}>
    You've used all {getPlanLimit(profile.plan)} articles this month.{" "}
    <a href="/#pricing" style={{ color: "#818cf8", textDecoration: "underline" }}>
      Upgrade →
    </a>
  </div>
) : (
  <button
    onClick={generateArticle}
    disabled={isGenerating}
    style={{
      width: "100%", padding: "14px 20px", borderRadius: 12, border: "none",
      background: isGenerating ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #7c3aed)",
      color: "#fff", fontSize: 15, fontWeight: 700,
      cursor: isGenerating ? "not-allowed" : "pointer",
      boxShadow: isGenerating ? "none" : "0 4px 20px rgba(99,102,241,0.3)",
      letterSpacing: 0.3,
    }}
  >
    {isGenerating ? "Generating..." : "Generate Article"}
  </button>
)}
```

- [ ] **Step 9: Test the full flow locally**

1. Go to `http://localhost:3000` → should redirect to `/login`
2. Sign up with email → check Supabase `profiles` table — row created with `plan = 'free'`
3. Generate an article → check `articles` table — row appears; `articles_used_this_month` is 1
4. Generate 2 more articles → counter reaches 3
5. Try generating again → "limit reached" message shown, button replaced
6. Click an article in History → loads into editor

- [ ] **Step 10: Commit**

```bash
git add app/app/page.jsx
git commit -m "feat: add user profile, article history, and usage limit UI"
```

---

## Chunk 6: Deploy

### Task 11: Add environment variables to Netlify and deploy

- [ ] **Step 1: Add all env vars to Netlify**

Netlify dashboard → Site configuration → Environment variables → Add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LEMONSQUEEZY_STARTER_VARIANT_ID`
- `LEMONSQUEEZY_PRO_VARIANT_ID`
- `LEMONSQUEEZY_BUSINESS_VARIANT_ID`
- `LEMONSQUEEZY_LAUNCH_VARIANT_ID`
- `LEMONSQUEEZY_WEBHOOK_SECRET` (already set)
- `ANTHROPIC_API_KEY` (already set)

- [ ] **Step 2: Push to trigger deploy**

```bash
git push
```

- [ ] **Step 3: Update Supabase redirect URLs for production**

Supabase → Authentication → URL Configuration → add your Netlify production URL.

- [ ] **Step 4: Smoke test production**

1. Visit live site → redirects to login ✓
2. Sign up with Google → lands on `/app` ✓
3. Generate article → saved to DB ✓
4. Reload page → article appears in History ✓
5. Make a test payment (or manually update `plan` in Supabase) → usage limit changes ✓
