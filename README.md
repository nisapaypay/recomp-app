# RECOMP

Personal 12-week body recomposition and workout app (Next.js + Supabase).

> Status: **Phase 1 — foundation only.** Layout, navigation and design system are in place.
> Authentication, database, workouts and tracking are not implemented yet.
> See `PROJECT_CONTEXT.md` for requirements and progress, `CHANGELOG.md` for history.

## Requirements

- Node.js 20+ (developed on 24)
- pnpm 11 (`corepack enable` or `npm i -g pnpm`)

## Local development

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase values (needed from Phase 2)
pnpm dev                     # http://localhost:3000
```

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm typecheck` | Generate route types and run `tsc --noEmit` |
| `pnpm lint` | ESLint |

## Project structure

```
src/app/(app)/          Navigable sections (dashboard, workout, walking, progress, history, settings)
src/app/globals.css     Design tokens (Tailwind v4 @theme)
src/components/ui/      Design-system primitives
src/components/layout/  App shell, navigation, page scaffolding, focus (workout) shell
src/lib/program/        Fixed schedule & program data
src/lib/supabase/       Supabase client factories (browser / server)
src/lib/{engine,audio,adaptive,calc}/   Reserved for later phases
src/server/actions/     Server Actions (later phases)
supabase/migrations/    SQL migrations (Phase 2)
public/illustrations/   Exercise illustrations (Phase 3)
public/audio/           Local audio cues (Phase 4)
```

Supabase, GitHub and Vercel setup instructions will be added in Phase 2 and before deployment.
