# ContentPilot — Auth, Database & Usage Limits Design

**Date:** 2026-03-26
**Status:** Approved
**Stack:** Next.js + Supabase (Auth + PostgreSQL) + Netlify

---

## Overview

Add user authentication, persistent article storage, per-plan usage limits, and automatic payment activation to ContentPilot.

---

## 1. Auth & Routing

**Provider:** Supabase Auth
**Methods:** Google OAuth + Email/Password

**Flow:**
- Landing page `/` has "Get Started - It's Free" CTA → redirects to `/login`
- `/login` page renders Supabase Auth UI with Google button + email/password form
- After successful auth → redirect to `/app`
- Next.js middleware protects `/app` — unauthenticated users are redirected to `/login`
- On first login, a `profiles` row is created automatically with `plan = 'free'`

---

## 2. Database Schema

### `profiles` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Matches Supabase `auth.users.id` |
| `email` | text | User email |
| `plan` | text | `'free'` \| `'starter'` \| `'pro'` \| `'business'` |
| `articles_used_this_month` | integer | Usage counter, default 0 |
| `reset_date` | timestamptz | Next monthly reset date |
| `created_at` | timestamptz | Auto |

### `articles` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → `profiles.id` |
| `title` | text | Parsed from first `# ` line |
| `content` | text | Full article body (without title line) |
| `keyword` | text | Target keyword used |
| `language` | text | Language label (e.g. "English") |
| `tone` | text | Tone used |
| `word_count` | integer | Approximate word count |
| `seo_score` | integer | SEO score at time of generation |
| `created_at` | timestamptz | Auto |

**Row Level Security:** All queries scoped to `auth.uid() = user_id`.

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
1. Authenticate request via Supabase session cookie
2. Fetch user's `profiles` row
3. Check if `reset_date` has passed → if yes, reset `articles_used_this_month = 0` and advance `reset_date` by 1 month
4. Compare `articles_used_this_month` against plan limit
5. If limit reached → return 403 with upgrade message
6. Stream article from Anthropic
7. On stream completion → insert row into `articles` + increment `articles_used_this_month`

### LemonSqueezy webhook (automatic activation)
- Existing `/api/lemonsqueezy/webhook` route updated
- On `order_created` event: look up user by email in `profiles`, update `plan` column
- Plan mapping by product name:
  - "Starter" → `starter`
  - "Pro" → `pro`
  - "Business" → `business`
  - "Launch Deal" → `business`

### Monthly reset (no cron needed)
- `reset_date` is checked on every generate request
- If current time > `reset_date`: reset counter, set new `reset_date = now() + 1 month`
- No background jobs required

---

## 4. App UI Changes

### Top navigation bar
- Right side: `{email} • {Plan badge} • {used}/{limit} articles` + Logout button
- Plan badge colors: free=gray, starter=blue, pro=purple, business=gold

### Article history sidebar
- Added below the generate controls in the left sidebar
- Lists articles ordered by `created_at DESC`
- Shows title + relative date
- Clicking an article loads it into the editor (title + content restored)
- No pagination for now (all articles shown)

### Limit enforcement UI
- When `articles_used_this_month >= limit`: Generate button is disabled
- Warning message shown: "You've used all X articles this month. Upgrade your plan →"
- Link goes to landing page pricing section

### New files/routes
- `app/login/page.jsx` — Supabase Auth UI login page
- `middleware.js` — protects `/app`, redirects to `/login`
- `lib/supabase.js` — Supabase client (browser)
- `lib/supabase-server.js` — Supabase client (server/API routes)
- `lib/plans.js` — plan limit constants

---

## Out of Scope

- Email verification flow (Supabase handles this automatically)
- Password reset flow (Supabase handles this automatically)
- Team/workspace features
- API key management
- Anonymous article generation (signup required from the start)
