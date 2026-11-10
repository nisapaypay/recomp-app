# RECOMP

Personal 12-week body recomposition and workout app (Next.js + Supabase).

> Status: **Phase 2 — database & authentication.** Layout, navigation, design system, Supabase
> login and the database schema/RLS are in place. Workouts and tracking are not implemented yet.
> See `PROJECT_CONTEXT.md` for requirements and progress, `CHANGELOG.md` for history.

## Requirements

- Node.js 20+ (developed on 24)
- pnpm 11 (`corepack enable` or `npm i -g pnpm`)

## Local development

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase URL + publishable key
pnpm check:env               # validate config and reach Supabase
pnpm dev                     # http://localhost:3000
```

## Supabase setup (Free plan)

1. Create a project at supabase.com. Copy the **Project URL** and **Publishable key**
   (Project Settings → API Keys) into `.env.local`. The secret key is **not** needed — never put
   it in this app.
2. Authentication → Sign In / Providers: keep Email enabled, **disable "Allow new users to sign up"**.
3. Authentication → Users → **Add user** (email + password, auto-confirm). This is your login.
4. Authentication → URL Configuration: Site URL `http://localhost:3000`; Redirect URLs
   `http://localhost:3000/**`. Add your Vercel URL (`https://<app>.vercel.app/**`) when deployed.
5. SQL Editor: run every file in `supabase/migrations/` **in filename order**, then
   `supabase/tests/rls_test.sql` and `supabase/tests/workout_test.sql` (both roll themselves back). Details: [`docs/DATABASE.md`](docs/DATABASE.md).
6. Optional: `supabase/manual/set_baseline_profile.sql` (edit the email first).
7. `pnpm check:env` should now list every table as "denied" for anonymous access.

Free-plan notes: projects pause after ~7 days of inactivity (restore from the dashboard); 500 MB
database, 1 GB storage; the built-in email sender is rate-limited (a few emails per hour).

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm typecheck` | Generate route types and run `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test:unit` | Unit tests (Node test runner) |
| `pnpm test:db` | Run all migrations + RLS test in an in-memory Postgres (PGlite) |
| `pnpm check:env` | Validate env vars and probe the Supabase project (publishable key only) |
| `pnpm test` | Unit tests + database tests |
| `pnpm audio:generate` | Regenerate the original tone cues in `public/audio/` |

## Project structure

```
src/app/(app)/          Navigable sections (dashboard, workout, walking, progress, history, settings)
src/app/(auth)/         Login, forgot-password, update-password
src/app/auth/callback/  Email link handler (password reset)
src/proxy.ts            Session refresh + route protection
src/app/globals.css     Design tokens (Tailwind v4 @theme)
src/components/ui/      Design-system primitives
src/components/layout/  App shell, navigation, page scaffolding, focus (workout) shell
src/lib/program/        Fixed schedule & program data
src/lib/supabase/       Supabase client factories (browser / server)
src/lib/engine/         Workout engine (pure timer state machine, checkpoint mapping)
src/lib/audio/          HTML <audio> cue player
src/lib/{adaptive,calc}/   Reserved for later phases
src/server/             Server-only: auth DAL, Server Actions, storage helpers
supabase/migrations/    SQL migrations (run manually in SQL Editor)
supabase/tests/         SQL tests (RLS)
scripts/                test-db, check-env
docs/DATABASE.md        Schema, relations, RLS, run order
public/illustrations/   Exercise illustrations (Phase 3)
public/audio/           Local audio cues (generated tones, WAV)
```

GitHub/Vercel deployment instructions will be added before deployment.
