# Changelog

All meaningful implementation changes to RECOMP. Newest first.

## 2026-11-18 — Tempo-synchronized exercise animation
- Workout player stage: an animated SVG figure behind the countdown / rep number for all 26
  exercises (start + peak pose each; planted feet/hands use two-bone IK). The figure is a pure
  function of the engine state (`src/lib/animation/movement.ts` → `movementAt`), so one animation
  cycle = one auto-counted rep; no second timer. rAF only redraws between engine ticks.
- Pause freezes, resume continues, sleep gaps hold at the last tick, checkpoint recovery restarts
  the rep from the start position; unilateral mirrors per side; plank breathes over the hold
  duration; reduced motion → one position per tempo phase.
- Rest / preparation now PREVIEW the coming exercise at its tempo (anchored on the engine's
  `phaseStartedAt`; nothing counted). Figure redrawn as a clothed flat illustration (hair bun,
  face, long-sleeve top, long trousers, trainers; working limbs glow) and placed below the number
  so neither covers the other.
- Focus muscles (exercise_library.target_muscles) painted red on the figure (working side only
  for unilateral exercises) + "Focus" legend.
- Animated covers in the Exercise library (card cover) and on the day page (shared ~30 fps demo
  clock, only while on screen); interactive demo on the exercise detail page (play/pause, ½×/1×,
  drag through one rep, jump to a tempo phase, Left/Right). Player figure larger + full-screen
  "Enlarge" view (still driven by the engine).
- Full-screen workout view: big rep count / countdown, tempo-phase countdown ring, and the same
  controls as the stage (shared `StageControls`: Pause/Resume, Count rep now, Undo rep, Finish
  set early, Skip exercise, Add 15 s / Skip rest, Skip countdown); fits an iPhone screen.
- Files: `src/lib/animation/{movement,figure,exercises,demo-clock}.ts`, `src/components/exercise/*`,, `src/components/workout/exercise-animation.tsx`,
  `tests/unit/exercise-animation.test.mjs`. Workout engine unchanged.

## 2026-11-18 — Phase 9: 12-week report, PDF export, QA (deployment pending)
- **Recovery "Not configured"** until the routine is approved: new status `not_configured`, excluded
  from planned/completed (60 planned activities), no Late/Missed, no reminder.
- **Report** `/progress/report`: program summary, body composition, training (from snapshots),
  walking, private photo comparison, weekly timeline; interim vs final label.
  `src/lib/report/report.ts`, `src/server/report/queries.ts`.
- **PDF export** `/api/report/pdf` (`@react-pdf/renderer`): A4, optional embedded photos, no URLs.
- **Integration**: sidebar "12-Week Report", shortcuts on Dashboard / Progress / History.
- **Icons**: favicon.ico + root apple-touch icons (removes iOS 404s).
- **Docs**: `docs/DEPLOYMENT.md`.
- Tests: `tests/unit/report.test.mjs`; completion/calendar/dashboard tests updated.

## 2026-11-17 — Phase 8: dashboard, reminders & PWA
- **Migration 13** `20261117090000_reminder_preferences.sql`: measurement reminder time, reminder
  weekdays, defaults 08:00 / Asia/Jakarta on `reminder_settings`.
- **Dashboard**: completion %, Today status label, quick actions (state-aware workout button, log
  walk, record measurement, view progress), late walks in the catch-up card, Weekly activity card,
  Next activity (any type), body progress vs previous check-in incl. skeletal muscle; removed the
  duplicate Activity summary card. `src/lib/program/dashboard.ts`.
- **Reminders**: `src/lib/reminders/reminders.ts` + `notify.ts`, `ReminderAgent` (in-app banner +
  best-effort notification, no duplicates), `/api/reminders`, Settings → Reminders (toggles,
  times, days, timezone, preview, permission on request, test notification).
- **PWA**: manifest, generated icons (`scripts/generate-icons.mjs`), privacy-first `public/sw.js`,
  `public/offline.html`, update prompt, offline bar, install card (prompt / iOS steps).
- Tests: `reminders.test.mjs`, `dashboard.test.mjs`, `pwa.test.mjs`.

## 2026-11-16 — Phase 7: body measurements & progress tracking
- **Migration 12** `20261116090000_measurements_photos.sql`: weight + body fat required for new
  measurements, no future measurement date (trigger), `progress_photos.taken_on` with a no-future
  trigger. Existing tables, bucket and storage policies reused.
- **Dependency**: `recharts@^3.10.1` (was planned, not installed).
- **Lib**: `src/lib/measurements/measurements.ts` (metrics, validation, check-in schedule,
  series, changes); photo helpers added to `src/lib/storage/progress-photos.ts` (comparison,
  resize, photo date, week folder).
- **Server**: `src/server/progress/queries.ts`, `src/server/actions/progress.ts`
  (save/delete measurement; prepare → signed upload → finalize photo; delete photo file then row;
  orphan cleanup).
- **UI**: `/progress` overview, `/progress/measurements`, `/progress/measurements/[id]`,
  `/progress/photos`; components in `src/components/progress/`; Dashboard progress card uses real
  data.
- Tests: `tests/unit/measurements.test.mjs`, `supabase/tests/progress_test.sql`; RLS test data
  updated for the new required fields.

## 2026-11-15 — Phase 6: walking tracker
- **Migration 11** `20261115090000_walking_tracker.sql`: `walking_activities.scheduled_date`
  (program walk a log counts for; NULL = additional), unique log per scheduled walk, Tue/Sat and
  week checks, distance required / steps > 0 for new rows, validation trigger (no future date,
  must be a program walking day), backfill of existing logs on walking days.
- **Lib** `src/lib/walking/walking.ts`: duration / distance / steps / date validation, pace and
  speed, program walks with targets, catch-up rules, defaults, weekly completion, totals.
- **Pages**: `/walking` (log form with live summary, this week's walks, totals, filtered history),
  `/walking/[id]` (detail, edit, delete with confirmation). Server actions `saveWalk`, `deleteWalk`.
- **Integration**: walking-day completion uses the scheduled date; Dashboard Walking card and
  "Log walk" button; day detail shows the logged walk or "Log this walk"; activity summary splits
  program vs extra walks.
- Tests: `tests/unit/walking.test.mjs` (17), `supabase/tests/walking_test.sql` (in `pnpm test:db`).

## 2026-11-14 — Phase 5: audio & adaptive progression
- **Migration 10** `20261114090000_adaptive_progression.sql`: exercise progression metadata
  (movement type, step, headroom, regression room, max extra sets) for all 26 exercises; unique
  adjustment per feedback and per source workout; immutable prescription snapshots (trigger);
  atomic `save_workout_feedback(...)` with server-side safety validation and an edit window;
  `start_workout_session` applies adjustments (clamped to each exercise's safe range).
- **Adaptive engine** `src/lib/progression/adaptive.ts`: one exercise, one variable per feedback;
  Too Easy → +step up to the ceiling, then +1 set; Too Hard → remove added set, −step to the
  floor, then −1 set; Just Right → nothing; no increase with pain or on unfinished exercises;
  exercise-specific steps (compound, isolation, core, unilateral per side, plank in seconds).
- **Feedback UI**: explanation, transparent result (what / why / from when), "no change" state,
  change-your-answer until the next workout of that type, locked state; no failure language.
- **History**: Progress → Training adjustments; Exercise detail → Your adjustments; day detail
  notes adjusted exercises.
- **Audio**: new original cues `rep.wav` and `transition.wav`; one cue per engine step by priority;
  sound-off pauses a playing cue; synchronous play errors swallowed. Settings text updated.
- `pnpm check:env` probes migration 10. Day-detail duration caption updated to the Phase 4 flow.
- Tests: `tests/unit/adaptive.test.mjs` (15), `tests/unit/audio.test.mjs` (6),
  `supabase/tests/adaptive_test.sql` (added to `pnpm test:db`).

## 2026-11-10 — Phase 4 revision: workout flow & rest intervals
- **Flow**: the player begins immediately (intro screen removed): exercise-1 preview + the single
  10 s preparation countdown → set → rest → set …; after an exercise's last set a 60 s transition
  rest previews the next exercise, then its set 1 starts directly; no rest after the final set.
  No countdown between sets, sides or exercises. Unilateral sides switch with no rest
  ("Switch to Right" cue); rest starts after both sides. 3-2-1 beeps before a rest ends.
- **Reps**: counted automatically — each completed tempo cycle adds one rep, the set finishes at
  the target (owner decision, overrides the prompt's "confirm with Rep Done"). "Count rep now" /
  Space adds a rep early; Undo rep / Finish set early correct it; no counting while paused.
- **Rest rules**: recipe rest → library `default_rest_seconds` (unchanged data: compound lower body
  90 s, others 60 s); transition 60 s. No migration needed — a transition is phase `rest` with the
  engine on the next exercise, so checkpoints/recovery work unchanged.
- **UI**: phase-aware panel heading (First exercise / Now / Current exercise / Up next) with the
  prescription line; rest screen shows next set or next exercise; "Add 15 s" / "Skip rest".
- **Estimate**: one 10 s countdown per workout + 60 s transitions (was 10 s per set and side).
- Tests: engine tests rewritten for the new flow (pause in every phase, transition recovery,
  rest from prescription, single countdown, no rest after the last set); estimate tests updated.

## 2026-11-13 — Phase 4 change: catch-up workouts (scheduled vs performed)
- **Rule change**: a strength workout can be started on its day **or later** (catch-up) as long
  as it isn't completed; future workouts can be opened but not started. The program calendar
  never shifts — a catch-up is recorded for its original scheduled day.
- **Migration 9** `20261113090000_scheduled_vs_performed.sql`: `workout_sessions.workout_date` →
  `scheduled_date` (rename), new `performed_at` (set on Begin), unique completed session per
  user + scheduled date + activity, `start_workout_session(program_id, scheduled_date)`.
- **Statuses**: new **Late** (past, not done, same program week — catch-up available); **Missed**
  only after that week ends (strength catch-up still possible). Completion still counts only
  recorded workouts, for their scheduled day.
- **UI**: day detail uses `workoutStartAvailability` (today → Start; past → "Start catch-up
  workout" with a confirmation dialog; future → "Scheduled for …"; other active session → open
  it first); Dashboard "Catch-up available" card; schedule tiles show "Done <date> (catch-up)";
  summary shows Scheduled vs Performed; **History** page lists every attempt with scheduled
  date, performed date/time, status and Catch-up badge. Continue Previous Workout is no longer
  limited to the same day; Start Over restarts the same scheduled workout.
- Workout duration now counts from Begin (`performed_at`), not from session creation.
- No early-start "testing" override: the database can't distinguish a test, so it would let any
  client mark future workouts completed. Catch-up makes real testing possible on any day after
  the program's first strength day.
- Tests: `src/lib/program/start-rules.ts` + 6 unit tests, Late/Missed calendar tests,
  `workout_test.sql` rewritten for catch-up/future/duplicate/one-active/stopped-retry/
  scheduled-week-prescription scenarios; `pnpm check:env` detects a missing migration 9.

## 2026-11-12 — Phase 4: Workout engine
- **Engine** (`src/lib/engine/workout-engine.ts`): pure, timestamp-based state machine — 10 s
  preparation before every set/side (skippable), tempo guide per exercise (eccentric / hold /
  concentric, correct starting phase per exercise, zero-length phases skipped), reps counted only
  on user confirmation (Rep done / Space, undo, finish early), timed holds counted down, rest from
  the snapshot (60 s / 90 s compounds) with +15 s and Skip, no rest after an exercise's last set,
  unilateral left→right and per-direction forward→backward before a set counts, pause/resume with
  exact remaining time, skip exercise, catch-up of throttled ticks, auto-pause on device sleep
  (gap > 90 s) so sleep is never counted as exercise, per-session tempo adjustment.
- **Controller** (`src/components/workout/workout-controller.ts`): single interval, one source of
  truth, sequential persistence queue with retry (idempotent writes), debounced + 15 s periodic
  checkpoints, keepalive save on hide/close, revision conflict detection (another device).
- **Database**: migration 8 (active = in_progress|interrupted unique index, checkpoint pause
  columns, `recomp_today()`, atomic `start_workout_session`). `supabase/tests/workout_test.sql`.
- **Screens**: full-screen workout (`/workout/session/[id]`, no navigation) with large timer,
  set/side indicators, tempo bar, progress, Pause/Resume/Skip/Stop, keyboard shortcuts, wake lock;
  recovery dialog ("Your previous workout was interrupted…" → Continue Previous Workout / Start
  Over); summary (`/workout/session/[id]/summary`) from recorded data only; feedback form (Too
  Easy / Just Right / Too Hard + pain + notes, stored only).
- **Start Workout** on today's strength day (server action → DB function); "Open workout" when
  one is active; unfinished-workout banner on Dashboard and Workout; Phase 3 placeholder removed.
- **Audio**: 5 original tone cues generated by `scripts/generate-audio.mjs` (WAV in
  `public/audio/`), played with HTML `<audio>`; sound on/off + volume on the workout screen and in
  Settings (saved to `profiles`).
- Duration estimate no longer adds rest between exercises (matches the engine).
- `/api/*` routes are not redirected to the login page by the proxy (they answer 401 themselves).
- Scripts: `pnpm test` (unit + DB), `pnpm audio:generate`. 26 new engine/checkpoint/results tests.

## 2026-11-11 — Phase 3 review fixes
- **Completion counting** moved to a pure, tested module (`src/lib/program/completion.ts`):
  72 planned = 36 strength + 24 walking + 12 recovery; a record counts only on its scheduled day
  with the matching activity; weekday mapping now uses the date's real weekday, not the offset
  from the start date.
- **Bug fixed:** Dashboard "Workouts completed" counted every completed session, so a recovery
  session would have shown as a workout. Now shows Strength workouts / Walks logged / Recovery
  days separately; the program summary shows the per-category breakdown.
- **Instructions:** migration 7 rewrites 11 exercises in plain language (no "hinge", "brace",
  "momentum", "stacked", "soft bend"; "glutes" explained) and removes a modification that was
  listed as a Lateral Raise step. `pnpm test:db` now fails on missing position/breathing/mistakes
  or on that jargon (negative-tested).
- **Illustration placeholder** shows visible "No image" / "No illustration yet" text at every
  size and no figure, so it can't be mistaken for a real exercise picture; real SVGs will be
  served unoptimised.
- 5 new unit tests (completion totals, recovery ≠ strength, scheduled-day matching, fixed
  weekday schedule for every selectable start date).

## 2026-11-11 — Fix: `Date.now()` during prerender (signed-in pages)
- In `pnpm dev`, signed-in pages (e.g. `/dashboard`, `/workout/day/[date]`) logged "Next.js
  encountered the unstable value `Date.now()` while prerendering". Cause: Supabase auth reads the
  clock (token-expiry check) inside `getClaims()`, and Next 16's runtime-prefetch validation
  renders with real cookies but forbids the current time.
- Fix: `getCurrentUser()` (`src/server/auth.ts`) now awaits `connection()` before creating the
  Supabase client, marking all auth-dependent rendering as request-time. No-op in Server Actions.

## 2026-11-11 — Phase 3: Program & exercise library
- Program management: start the 12-week program on a chosen Monday (this week's Monday up to 8
  weeks ahead, Monday-only picker + server validation), one active program per user (DB index;
  duplicate submits are harmless), change start date in Settings until a workout is recorded,
  automatic `completed` status after week 12.
- Calendar logic in Asia/Jakarta (`src/lib/program/calendar.ts`): week/day/phase from the start
  date, fixed schedule that never shifts, statuses Completed / Today / Upcoming / Missed / Rest
  from real records only.
- Workout page: program overview (week, phase, start/end, time progress, activities completed),
  week-by-week schedule with dates and statuses, training phases.
- Workout day detail (`/workout/day/[date]`): exercises with sets × target, tempo, rest, notes,
  estimated duration; walking target; recovery note; Start Workout only on today's strength day,
  leading to a Phase 4 placeholder that records nothing.
- Exercise library (`/workout/exercises`, `/workout/exercises/[id]`): category, muscles,
  equipment, default tempo/rest, instructions, breathing, mistakes, safe modifications,
  prescriptions across the 12 weeks, illustration placeholder.
- Dashboard: today's activity, program overview, this week with statuses, next workout, real
  activity counts; onboarding when no program; completed-program state.
- Migration 6 `20261111090000_exercise_instructions.sql` (instruction text; data only).
- `pnpm test:db` now verifies the seeded program against an independent transcription of the
  master prompt; RLS test covers the program lifecycle. 14 new unit tests (calendar, estimate).
- Nav components render inside `<Suspense>` (required for dynamic routes with Cache Components);
  `(app)/error.tsx` error state; `ProgressBar` primitive; `allowImportingTsExtensions` for
  Node-tested modules.

## 2026-11-10 — Fix: RLS test bucket assertion
- `supabase/tests/rls_test.sql` checked `storage.buckets` while running as `authenticated`. On
  Supabase that table has RLS with no user policies, so the (existing, private) bucket was
  invisible and the test falsely reported "missing or public". The bucket check now runs as the
  database owner and verifies `public = false`, the 5 MB limit and the exact MIME list separately.
- Storage policy checks still run as the test user; B now owns a real object so "A can't see
  B's photos" is a meaningful check; added an "upload outside any user folder" check.
- `scripts/test-db.mjs`: the stand-in `storage.buckets` now has RLS enabled like hosted Supabase,
  so this class of mistake is caught locally. No migration or bucket setting changed.

## 2026-11-10 — Phase 2: Database & authentication
- Added SQL migrations (`supabase/migrations/`, run manually in SQL Editor):
  1. initial schema — 15 tables (14 from the spec + `program_days`), composite owner FKs,
     CHECK constraints, partial unique indexes (one active program, one in-progress session),
     `updated_at` triggers, auth-user trigger creating empty profile + reminder settings, RLS on;
  2. privileges + 47 explicit owner-only / read-only RLS policies;
  3. private `progress-photos` bucket (5 MB, JPEG/PNG/WebP) + 4 folder-scoped Storage policies;
  4. seed: 26-exercise library (attributes, default tempo/rest, safe modifications);
  5. seed: 12-week program — 84 days with walking targets, 203 prescriptions (self-checking).
- Added `supabase/tests/rls_test.sql` (cross-user attack test, rolls back) and optional
  `supabase/manual/set_baseline_profile.sql`.
- Added Supabase SSR auth: `src/proxy.ts` session refresh + route protection, expired-session
  detection, `getCurrentUser`/`requireUser` DAL, Server Actions for sign in/out and password reset,
  `/auth/callback`, pages `/login`, `/forgot-password`, `/update-password`, logout in sidebar and
  Settings → Account (shows signed-in email), `SessionWatcher`.
- Added UI primitives `Field`, `Alert`, `PasswordField`.
- Added progress-photo helpers (validation, owner paths, server-side signed URLs).
- Added `pnpm test:db` (PGlite runs real migrations + RLS test), `pnpm test:unit`,
  `pnpm check:env`; devDependency `@electric-sql/pglite`.
- Added `docs/DATABASE.md` (schema, relations, RLS, run order).

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
