# RECOMP — Production deployment (Vercel Hobby + existing Supabase)

Single-owner personal app. Nothing here needs a Supabase secret key: the app uses the
publishable key with the signed-in user's session, and Row Level Security protects every row.

## 1. Before deploying

| Check | How |
|---|---|
| All local checks pass | `pnpm typecheck && pnpm lint && pnpm build && pnpm test` |
| No secrets in the repo | `.env.local` is git-ignored (`.env*` with `!.env.example`); `git ls-files \| grep .env` shows only `.env.example` |
| Supabase migrations 1–13 applied | SQL Editor, in order (see `docs/DATABASE.md` §1). `pnpm check:env` detects 9 and 10 |
| SQL tests pass on Supabase | `supabase/tests/*.sql` in SQL Editor — each ends with `ALL … PASSED (changes rolled back)` |

## 2. Code on GitHub

The repo is `github.com/nisapaypay/recomp-app`. Commit the work on a branch and push it, then merge
to `main` (Vercel deploys `main` to production).

## 3. Vercel project (one-time, in the browser)

1. vercel.com → **Add New… → Project** → import `nisapaypay/recomp-app` (authorize GitHub if asked).
2. Framework preset: **Next.js** (auto). Build command `pnpm build`, install `pnpm install` (auto from
   `packageManager`). Node.js version: 20 or newer.
3. **Environment Variables** (Production + Preview):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` (Supabase → Project Settings → API Keys) |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-project>.vercel.app` (set after the first deploy, then redeploy) |

   Do **not** add `SUPABASE_SECRET_KEY` — the app doesn't use it.
4. **Deploy**. Note the production URL (`https://<your-project>.vercel.app`).

## 4. Supabase Auth URLs (Dashboard → Authentication → URL Configuration)

- **Site URL**: `https://<your-project>.vercel.app`
- **Redirect URLs**: keep `http://localhost:3000/**` and add `https://<your-project>.vercel.app/**`

Password-reset emails link back to `NEXT_PUBLIC_SITE_URL` → `/auth/callback`.

## 5. Verify production

1. `https://<app>.vercel.app/login` loads; protected pages redirect to login when signed out.
2. Sign in → Dashboard shows your data. Sign out → back to login.
3. Workout: start / continue a session, finish a set, summary + feedback.
4. Walking: log, edit, delete. Measurements: save one. Photos: upload, view, delete.
5. Progress → View 12-Week Report → Download PDF (with and without photos).
6. Settings → Reminders save; Install app (Chrome) or Share → Add to Home Screen (iPhone Safari).
7. `curl -I https://<app>.vercel.app/sw.js` → `Cache-Control: no-cache, no-store, must-revalidate`.

## 6. Notes & limits

- Vercel Hobby: personal, non-commercial use. Serverless functions have execution-time limits; the
  PDF renders in a few seconds (photos add download time).
- Supabase Free projects pause after ~7 days without activity — restore from the dashboard.
- Reminders are shown by the open app (no push server); see PROJECT_CONTEXT.md → Phase 8.
