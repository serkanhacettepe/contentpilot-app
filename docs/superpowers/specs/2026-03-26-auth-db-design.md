# ContentPilot — Auth, Database & Usage Limits Design

**Date:** 2026-03-26
**Status:** Approved
**Stack:** Next.js 16 + Supabase (Auth + PostgreSQL) + Netlify

---

## Overview

Add user authentication, persistent article storage, per-plan usage limits, and automatic payment activation to ContentPilot.

---

## 1. Auth & Routing

**Provider:** Supabase Auth
**Methods:** Google OAuth + Email/Password
**Package:** `@supabase/ssr` (NOT the deprecated `@supabase/auth-helpers-nextjs`)

**Flow:**
- Landing page `/` has "Get Started - It's Free" CTA → redirects to `/login`
- `/login` page renders Supabase Auth UI with Google button + email/password form
- After successful auth → redirect to `/app`
- Next.js 16 `proxy.js` (NOT `middleware.js` — renamed in v16) protects `/app` — unauthenticated users are redirected to `/login`
- On first login, a `profiles` row is created via a Postgres trigger on `auth.users` (SECURITY DEFINER) — this avoids RLS complications and runs server-side

**proxy.js note:** In Next.js 16, Proxy runs on the Node.js runtime by default. Do NOT set `export const runtime` in `proxy.js` — this throws a build error. Node.js-compatible imports are permitted, including `lib/supabase-server.js` (provided it uses `@supabase/ssr` with a cookie adapter).

---

## 2. Database Schema

### `profiles` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PRIMARY KEY, REFERENCES auth.users(id) ON DELETE CASCADE |
| `email` | text | User email |
| `plan` | text | `'free'` \| `'starter'` \| `'pro'` \| `'business'`, default `'free'` |
| `articles_used_this_month` | integer | Usage counter, default 0 |
| `reset_date` | timestamptz | Set to `now() + interval '1 month'` at row creation |
| `created_at` | timestamptz | Auto |

### `articles` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → `profiles.id` ON DELETE CASCADE |
| `title` | text | Parsed from first `# ` line |
| `content` | text | Full article body (without title line) |
| `keyword` | text | Target keyword used |
| `language` | text | Language label (e.g. "English") |
| `tone` | text | Tone used |
| `word_count` | integer | Approximate word count |
| `seo_score` | integer | SEO score at time of generation |
| `created_at` | timestamptz | Auto |

### Row Level Security

**profiles:**
- SELECT: `auth.uid() = id`
- UPDATE: `auth.uid() = id`
- INSERT: handled by Postgres trigger only (no direct client insert)

**articles:**
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`

### First-login profile creation (Postgres trigger)
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

### Plan limits
| Plan | Monthly article limit |
|------|-----------------------|
| free | 3 |
| starter | 20 |
| pro | 30 |
| business | 100 |

---

## 3. Usage Limits & Payment Activation

### Generate API flow
1. Authenticate request via Supabase session cookie (server client)
2. Fetch user's `profiles` row
3. Check if `reset_date` has passed → if yes, reset counter and advance `reset_date` by 1 month in a single UPDATE
4. Compare `articles_used_this_month` against plan limit
5. If limit reached → return 403 with upgrade message
6. Stream article from Anthropic
7. On stream completion:
   - Insert row into `articles`
   - Atomically increment counter: `UPDATE profiles SET articles_used_this_month = articles_used_this_month + 1 WHERE id = $userId`
   - Both writes are independent; partial failure is acceptable (article exists but counter may lag by 1 — acceptable tradeoff, no transaction needed)

### LemonSqueezy webhook (automatic activation)
- Updated `/api/lemonsqueezy/webhook` route
- Match plan by **product/variant ID** (stored as env vars), NOT by product name string
- Env vars: `LEMONSQUEEZY_STARTER_VARIANT_ID`, `LEMONSQUEEZY_PRO_VARIANT_ID`, `LEMONSQUEEZY_BUSINESS_VARIANT_ID`, `LEMONSQUEEZY_LAUNCH_VARIANT_ID`
- Product name used only as fallback for logging

**Events handled:**
| Event | Action |
|-------|--------|
| `order_created` | Upgrade plan (one-time purchases e.g. Launch Deal) |
| `subscription_created` | Upgrade plan (new subscription) |
| `subscription_updated` | Re-evaluate plan by variant ID (handles mid-cycle upgrades/downgrades) |
| `subscription_cancelled` | Downgrade to `free` (log only for now, manual review) |
| Other events | Log and return 200, no action |

### Monthly reset (no cron needed)
- `reset_date` is checked on every generate request
- If `now() > reset_date`: `UPDATE profiles SET articles_used_this_month = 0, reset_date = now() + interval '1 month' WHERE id = $userId`
- No background jobs required

---

## 4. App UI Changes

### Top navigation bar
- Right side: `{email} • {Plan badge} • {used}/{limit} articles` + Logout button
- Plan badge colors: free=gray, starter=blue, pro=purple, business=gold

### Article history sidebar
- Added below the generate controls in the left sidebar
- Query: last 50 articles ordered by `created_at DESC` (no pagination)
- Shows title (truncated) + relative date
- Clicking an article loads it into the editor (title + content restored)

### Limit enforcement UI
- When `articles_used_this_month >= limit`: Generate button is disabled
- Warning message: "You've used all X articles this month. Upgrade your plan →"
- Link goes to landing page pricing section (`/#pricing`)

### New files/routes
| File | Purpose |
|------|---------|
| `app/login/page.jsx` | Supabase Auth UI login page |
| `proxy.js` | Protects `/app`, redirects to `/login` (Node.js runtime, do not set `export const runtime`) |
| `lib/supabase.js` | Supabase browser client (`@supabase/ssr`) |
| `lib/supabase-server.js` | Supabase server client for API routes (`@supabase/ssr` + cookies) |
| `lib/plans.js` | Plan limit constants |

---

## 5. Environment Variables

Add to Netlify environment variables:

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, never exposed to client |
| `LEMONSQUEEZY_STARTER_VARIANT_ID` | LemonSqueezy variant ID for Starter plan |
| `LEMONSQUEEZY_PRO_VARIANT_ID` | LemonSqueezy variant ID for Pro plan |
| `LEMONSQUEEZY_BUSINESS_VARIANT_ID` | LemonSqueezy variant ID for Business plan |
| `LEMONSQUEEZY_LAUNCH_VARIANT_ID` | LemonSqueezy variant ID for Launch Deal |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Webhook signing secret from LemonSqueezy dashboard (already in use) |

---

## Out of Scope

- Email verification flow (Supabase handles automatically)
- Password reset flow (Supabase handles automatically)
- Subscription cancellation auto-downgrade (manual review for now)
- Team/workspace features
- API key management
- Anonymous article generation (signup required)
