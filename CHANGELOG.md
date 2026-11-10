# Changelog

All meaningful implementation changes to RECOMP. Newest first.

## 2026-11-10 — Phase 1: Project foundation
- Scaffolded Next.js 16.4 (App Router, TypeScript strict, Tailwind CSS 4, ESLint 9, pnpm, `src/`).
- Kept Cache Components + Partial Prefetching (Next 16 default); app shell is fully static.
- Added RECOMP design tokens (off-white canvas, charcoal ink, deep-purple/lavender accent, status
  colours, type scale incl. large workout timer, radii, shadows, layout sizes, safe-area utilities).
- Added UI primitives: Button/ButtonLink, Card/CardHeader, Badge/StatusBadge, EmptyState, Skeleton.
- Added responsive app shell: desktop sidebar (≥1024px), icon rail (768–1023px), mobile header with
  Settings + 5-tab bottom bar (<768px); skip link; FocusShell for the future workout mode.
- Added pages: Dashboard, Workout, Walking, Progress, History, Settings (honest empty states, no
  fake data), loading skeleton, 404, root redirect, app icon.
- Added fixed weekly schedule, training phases and measurement weeks as typed constants.
- Prepared Supabase integration (packages, env reader, browser/server client factories — unused).
- Added `.env.example`, `pnpm typecheck` script, README, folder skeleton for later modules.
- Disabled the Next.js dev indicator (it covered the mobile tab bar).

## 2026-11-10 — Phase 0: analysis
- Inspected the empty project folder and local toolchain.
- Added `PROJECT_CONTEXT.md` with the confirmed requirements, proposed architecture, schema plan,
  risks and open decisions.
