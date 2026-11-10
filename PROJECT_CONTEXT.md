# RECOMP — Project Context

> Read this file (and `CHANGELOG.md`) before continuing any interrupted session.
> Do not contradict the confirmed requirements below without explaining why and getting user approval.

Last updated: 2026-11-13 — Phase 4 + catch-up rule change implemented. Migrations 6–8 confirmed on the
hosted DB; **migration 9 must be run** (the app now requires it). Signed-in flow not yet verified in a
browser. Waiting for approval before Phase 5.

---

## 1. Product overview

RECOMP is a personal, single-user 12-week body recomposition web app. It guides a fixed weekly
workout program with an interactive timed workout engine, logs walking (from Apple Watch, entered
manually), tracks body measurements and private progress photos, adapts exercise prescriptions from
post-workout feedback, and produces a final 12-week report with PDF export.

Success is judged on body fat %, skeletal muscle, waist and other measurements, strength
progression and consistency — **not body weight alone**. No extreme calorie deficits or aggressive
weight-loss targets.

### Initial profile (baseline, editable later)

| Metric | Value |
|---|---:|
| Height | 152 cm |
| Weight | 53.9 kg |
| BMI | 23.3 |
| Body fat | 32.4 % |
| Skeletal muscle | 20 kg |
| Visceral fat | 4.5 |

Equipment: two 3 kg dumbbells + bodyweight. No gym, no mat. Home/boarding room. Beginner, mostly
sedentary. Focus: abdomen, arms, thighs, glutes, overall strength.

---

## 2. Confirmed product requirements (summary of the master prompt)

### Devices
- **Desktop (MacBook / Mac Mini + external monitor)** — Strength Workout Mode: huge timer, readable
  from a distance, illustration, name, instructions, set x/y, rep x/y, phase, rest countdown,
  session progress, Pause/Resume/Skip/Stop. Distraction-free.
- **Mobile (iPhone)** — Walking & Progress Mode: one-handed, bottom nav, large touch targets;
  walking entry/history, measurements, photo upload, charts, calendar, dashboard.
- Dedicated layouts per device class (not shrunken desktop). Every feature reachable on both.
- Same account/data across all devices.

### Navigation
Dashboard · Workout · Walking · Progress · History · Settings. Desktop: sidebar/compact top nav.
Mobile: bottom nav. Workout mode: full-screen, no nav.

### Design
Nike Training Club / Apple Fitness inspired. Off-white/neutral background, charcoal text, deep
purple/lavender accent, rounded cards, subtle shadows, strong hierarchy, large timer type.
Feminine without being decorative. Avoid heavy gradients, colourful/crowded dashboards, tiny timer
text. Consistent design tokens.

### Fixed weekly schedule (never shifts)
| Day | Activity |
|---|---|
| Mon | Lower Body |
| Tue | Walking |
| Wed | Upper Body & Core |
| Thu | Recovery / Stretching |
| Fri | Full Body & Core |
| Sat | Walking |
| Sun | Rest |

Missed days are marked **Missed**; nothing is shifted. Statuses: Upcoming, Today, Completed,
Missed, Rest.

### 12-week program

**Week 1 — Foundation (bodyweight)**
- Mon: Bodyweight Squat 2×12 (3-1-1) · Glute Bridge 2×15 (2-1-2) · Reverse Lunge 2×10/leg (2-1-2) ·
  Donkey Kick 2×12/leg (2-1-2) · Calf Raise 2×15 (1-1-2)
- Wed: Wall Push Up 2×12 · Arm Circles 2×15 each direction · Bird Dog 2×10/side · Dead Bug 2×10/side ·
  Prone W Raise 2×12
- Fri: Sumo Squat 2×12 · Side-Lying Leg Raise 2×12/leg · Wall Push Up 2×12 · Glute Bridge 2×15 ·
  Standing Knee Raise 2×15/leg · Plank 2×15–20 s
- Walking Tue 20 min, Sat 20 min · Thu recovery/gentle stretching · Sun rest

**Weeks 2–4 — Beginner Strength (introduce 2×3 kg dumbbells)**
- Mon: Goblet Squat 2×12 · DB Glute Bridge 2×15 · DB Reverse Lunge 2×10/leg · Donkey Kick 2×15/leg ·
  DB Calf Raise 2×15
- Wed: Shoulder Press 2×10 · One-Arm DB Row 2×12/side · Bicep Curl 2×12 · Lateral Raise 2×10 ·
  Overhead Triceps Extension 2×12 · Dead Bug 2×10/side
- Fri: Sumo Squat 2×12 · DB Romanian Deadlift 2×12 · Bent-Over Row 2×12 · Side-Lying Leg Raise
  2×15/leg · DB Glute Bridge 2×15 · Plank 2×20 s
- Walking Tue/Sat 20–25 min · Thu recovery · Sun rest

**Weeks 5–8 — Progressive Overload**
- Mon: Goblet Squat 3×12–15 · DB Glute Bridge 3×15 · DB Reverse Lunge 3×10/leg · Donkey Kick
  2×15/leg · DB Calf Raise 3×15
- Wed: Shoulder Press 3×10–12 · One-Arm DB Row 3×12/side · Bicep Curl 2×12 · Lateral Raise 2×12 ·
  Overhead Triceps Extension 2×12 · Dead Bug 3×10/side
- Fri: DB Sumo Squat 3×12–15 · DB Romanian Deadlift 3×12 · Bent-Over Row 3×12 · Side-Lying Leg
  Raise 2×15/leg · DB Glute Bridge 3×15 · Plank 3×20–30 s
- Walking Tue 25 min, Sat 30 min · Thu recovery · Sun rest

**Weeks 9–12 — Strengthening**
- Mon: Goblet Squat 3×15 · DB Glute Bridge 3×15 · DB Reverse Lunge 3×12/leg · Donkey Kick 3×15/leg ·
  DB Calf Raise 3×15
- Wed: Shoulder Press 3×10–12 · One-Arm DB Row 3×12/side · Bicep Curl 3×12 · Lateral Raise 2×12 ·
  Overhead Triceps Extension 3×12 · Dead Bug 3×12/side
- Fri: DB Sumo Squat 3×15 · DB Romanian Deadlift 3×15 · Bent-Over Row 3×12 · Side-Lying Leg Raise
  3×15/leg · DB Glute Bridge 3×15 · Plank 3×30 s
- Walking Tue/Sat 30 min · Thu recovery · Sun rest

Rules: prescriptions are starting points, not mandatory targets. Allow safe modifications; never
force progression through pain/unusual symptoms. Lateral raise may be done with no weight.

### Exercise library
Structured data per exercise (id, name, category, target muscles, equipment, description, starting
position, execution steps, breathing, common mistakes, tempo, default sets/reps, rest, illustration,
difficulty). **Original, consistent illustrations** showing start + end position, movement
direction and correct posture. Illustrations stored as separate replaceable assets.

### Workout session engine (most important feature)
Flow (revised in Phase 4, see "Confirmed in Phase 4"): exercise-1 preview + **one 10 s preparation
countdown** at the start → reps at exercise-specific tempo (e.g. 3-1-1 = 3 s lower, 1 s hold, 1 s
up = 5 s/rep) → set done → rest countdown → next set starts directly → after the last set a 60 s
transition rest previewing the next exercise → next exercise starts directly → summary.
- Unilateral: left side all reps, then right side all reps, then the set counts. Clear side-switch cue.
- Rest default 60 s between sets and exercises; heavy compounds may use 90 s; configurable.
- Controls: Pause, Resume, Skip exercise, Skip rest, Stop (with confirmation), Adjust tempo,
  Adjust rest. Skipped exercises recorded as skipped, never completed.
- Timer built on timestamps/elapsed time — no per-render decrementing, no duplicate intervals.
  Must survive refresh, tab suspension, laptop sleep, delayed rendering, pause/resume.
- Persist session state + completed sets. On reopening an interrupted session ask:
  *"Your previous workout was interrupted. What would you like to do?"* →
  **Continue Previous Workout** / **Start Over**. Start Over keeps the old attempt as
  interrupted/abandoned (never deleted). Never silently resume or restart.

### Audio
Local audio files only via standard HTML `<audio>` playback. **No Web Audio API, no
SpeechSynthesis, no TTS, no external voice services, no copyrighted music.** Cues: workout start,
rest start, countdown, exercise transition, workout completion. Sound on/off + volume.

### Feedback & adaptive progression
After each completed workout: Too Easy / Just Right / Too Hard (stored).
- Too Easy → small rep increase first, one variable at a time, within prescribed max range.
- Just Right → no change.
- Too Hard → reduce reps or sets next comparable workout.
- Never change multiple variables at once; no increase after a single unusual session; never
  progress through pain; don't rewrite the whole plan.
- Store original prescription, adjusted prescription, feedback, reason, date. Show history and
  explain why a workout was adjusted.

### Walking tracker
Manual entry only (no GPS, no Apple Health in v1): date, duration (min), distance (km), steps
(optional), notes (optional). Auto pace. Weekly duration/distance/session totals, history,
summary, edit/delete. Stored in Supabase.

### Body measurements
Official sessions Week 1, 4, 8, 12. Fields: weight (kg), body fat (%), skeletal muscle (kg), waist,
lower abdomen, arm, thigh (cm), visceral fat (optional). Manual entry, incomplete records
updatable, no fake data, compare initial/W4/W8/W12, charts. Don't over-interpret fluctuations.

### Progress photos
Front / Side / Back per week. Private Supabase Storage bucket, owner-only, signed URLs, type/size
validation, replace/delete, organised by week, Week 1 vs Week 12 side-by-side. Compress to save quota.

### Dashboard
Overview (current week, phase, start/end date, overall + weekly completion) · Today (workout,
exercise count, est. duration, Start Workout) · Mon–Sun schedule with statuses · Progress (current
weight, body fat, waist, last measurement date, change from baseline) · Activity (completed
workouts, walks, total walking duration/distance, workout streak). Prioritise next action; not crowded.

### Progress & analytics page
Charts for weight, body fat, skeletal muscle, waist, lower abdomen, arm, thigh. Baseline, latest,
absolute and % change. Workout analytics: completion rate, completed, missed, walking totals,
exercise progression. Clearly distinguish recorded vs estimated vs missing data.

### Reminders
Workout reminders (follow schedule, custom time, on/off) and measurement reminders (W1/4/8/12).
Browser/PWA notifications where possible + in-app fallback. Explain permissions and limits honestly.
No external notification service unless genuinely necessary.

### Final 12-week report (+ PDF export)
Personal overview, body composition comparison, measurements, photo comparisons (front/side/back),
workout performance, strength progression (initial vs adjusted prescriptions, feedback history),
factual summary. Never invent improvements or claim changes when data is missing.

### Settings
Profile, program start date, sound on/off, volume, default rest, reminder time, measurement
reminders, preferred units, account, logout. Manual tempo adjustment during workouts.

### Auth & security
Single user, email + password, login, logout, password reset, protected routes. No public sign-up
or social login — account created in the Supabase dashboard. All records keyed by `auth.uid()`;
RLS on every user table; service role key never reaches the browser; sensitive ops validated
server-side; private photos via signed URLs.

### Persistence & sync
PostgreSQL is the source of truth (LocalStorage never primary). Persist each completed set.
Checkpoint timer state at meaningful transitions only (not every second). Offline: clear indicator,
never claim synced, queue pending changes where practical, retry on reconnect, idempotent writes
(no duplicate records).

### Hard rules (section 27)
No prototype-only UI · no skipped DB integration · no fake progress · no LocalStorage DB · no GPS ·
no Apple Health v1 · no Web Audio/SpeechSynthesis · no auto-shifting missed workouts · no silent
resume · no skipped-as-completed · no invented measurements · no exposed photos · no
overcomplicated UI · no "complete" claims before testing · no paid infra without approval.

---

## 3. Technology stack (confirmed)

| Layer | Choice | Version checked 2026-11-10 |
|---|---|---|
| Framework | Next.js App Router + TypeScript (installed: next 16.4.5, react 19.3.0, TS 5.9) | next 16.4.x, react 19.3 |
| Styling | Tailwind CSS | 4.3.x |
| Auth / DB / Storage | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) | ssr 0.12, js 2.119 |
| Charts | Recharts | 3.10 |
| Icons | lucide-react | 1.70 |
| PDF | `@react-pdf/renderer` (proposed, client-side; not installed yet) | 4.9 |
| Lint | ESLint 9 + eslint-config-next (core-web-vitals, typescript) | — |
| Package manager | pnpm 11 (`pnpm-lock.yaml`) | — |
| Hosting | Vercel Hobby, default `*.vercel.app` domain | — |
| VCS | GitHub Free | — |

Local environment: macOS 26.4, Node 24.18, npm 11.16, pnpm 11.9, git 2.50, gh 2.102, `afconvert`
available. **Not installed:** Docker, Supabase CLI, Vercel CLI, ffmpeg.

---

## 4. Architecture decisions

### Confirmed in Phase 1
- **Next.js 16 conventions**: Middleware is now `proxy.ts` (`src/proxy.ts`, Node.js runtime).
  Bundled docs at `node_modules/next/dist/docs/` are authoritative for this version (see `AGENTS.md`).
- **Cache Components ON (framework default, kept)** with Partial Prefetching. The app shell
  (sidebar, tab bar, page chrome) contains no request data and is prerendered, so navigation is
  instant. Anything that reads the Supabase session (cookies) must render inside `<Suspense>` (or
  a `loading.tsx` boundary) — never `await` the session at the top of a layout. Escape hatch per
  route: `export const instant = false`.
- **Navigation**: desktop ≥1024px full sidebar; 768–1023px icon rail; <768px sticky header +
  5-tab bottom bar (Home, Workout, Walking, Progress, History). **Settings is the gear icon in the
  mobile header** (iOS tab bars hold 5 items comfortably); it's in the sidebar on desktop.
- **Light theme only** for v1 (`color-scheme: light`).
- **Design tokens** live in `src/app/globals.css` `@theme` (Tailwind v4, no tailwind.config).
- **Dependency-free helpers** (`cn` instead of clsx; no UI kit).
- **Env var naming**: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase's new publishable key; the
  legacy anon key also works in this slot). No service/secret key is used by the app.
- `devIndicators: false` in `next.config.ts` (the floating dev badge covered the mobile tab bar).

### Confirmed in Phase 2
- **No secret key, no DB password, no Supabase CLI.** The app uses only the publishable key; all
  data access goes through the user's session + RLS. Migrations are plain `.sql` files run by the
  user in the SQL Editor.
- **Auth = Supabase SSR cookies.** `src/proxy.ts` refreshes the session on every request and
  verifies it with `auth.getClaims()` (project uses asymmetric ES256 keys → local JWT
  verification). Proxy is an optimistic gate only; `src/server/auth.ts` (`getCurrentUser`,
  `requireUser`) re-checks in server code, and RLS enforces it in the DB.
- **Composite FKs `(parent_id, user_id)`** on every child table, so cross-user linking is
  impossible even though FK checks bypass RLS (see `docs/DATABASE.md`).
- **Text + CHECK instead of Postgres enums** (easier, auditable evolution).
- **Exercise ids are readable slugs** (`goblet-squat`), not UUIDs (stable reference data).
- **Preferences live in `profiles`** (sound, volume, default rest, units) instead of a separate
  `user_settings` table; reminders + timezone live in `reminder_settings`.
- **Program reference data seeded by SQL migration** (`program_days`, `program_exercises`) — new
  table `program_days` holds the fixed schedule and walking targets per week.
- `profiles` / `reminder_settings` rows are created by a trigger on `auth.users`; baseline values
  stay NULL until the user enters them (optional `supabase/manual/set_baseline_profile.sql`).
- **Password reset**: `/forgot-password` → Supabase email → `/auth/callback` (PKCE `code` or
  `token_hash`) → `/update-password` → global sign-out → `/login?reason=password_updated`.
- **DB tests without Docker**: PGlite (devDependency) runs the real migrations + RLS test.

### Confirmed in Phase 3
- **Program timezone = Asia/Jakarta** (`PROGRAM_TIMEZONE`). "Today" is computed server-side in
  WIB; all schedule maths uses whole ISO dates, so time of day / DST can't shift a workout.
- **Start date rule**: Monday only, from this week's Monday up to 8 weeks ahead (UI offers only
  Mondays; server + DB re-check). Changeable in Settings until the first workout is recorded.
- **Completion is lazy**: `getCurrentProgram()` marks an active program `completed` once today is
  past `end_date` (works from any device; no cron needed).
- **Statuses come only from records**: a day is Completed only with a completed
  `workout_sessions` row (matching activity) or, for walking days, a `walking_activities` row.
  Past days without records are Missed; Sunday is Rest. Thursday counts as an activity.
- **Program completion shown two ways, both real**: calendar time (day N of 84) and activities
  completed / 72 planned (6 non-rest days × 12 weeks = 36 strength + 24 walking + 12 recovery),
  with a per-category breakdown. Logic in `src/lib/program/completion.ts` (pure, tested); the
  activity of a date comes from its real weekday. Recovery is never counted as a strength workout.
- **Duration estimate** (planning aid, labelled "≈"): per side per set 10 s prep + reps × tempo
  (or hold seconds), rest between sets, one rest between exercises.
- **Effective prescription** = program row overrides → exercise defaults. Adaptive adjustments
  (Phase 5) will be applied on top.
- **Start Workout** only on today's strength day; earlier days can't be "caught up" (no shifting).
- **Exercise instructions** are general beginner cues (migration 6, plain-language revision in
  migration 7), flagged for user review; pages show a "stop on pain / use modifications" note.
  `pnpm test:db` enforces complete fields and blocks known jargon.
- **Illustrations: placeholder** until original assets exist — no figure, visible "No image" /
  "No illustration yet" text at every size.
- **Recovery (Thursday) routine is NOT defined** — the master prompt lists none; the app shows a
  neutral note instead of inventing a routine. Needs a user decision.
- **`getCurrentUser()` awaits `connection()`** before touching Supabase auth (which calls
  `Date.now()`); otherwise Cache Components' runtime-prefetch validation errors on signed-in pages.
  Any new server code that calls Supabase auth must go through `getCurrentUser`/`requireUser`.
- **Nav + `usePathname()`** render inside `<Suspense>` with a static fallback (required for
  dynamic routes under Cache Components).
- Pure modules imported by Node tests use `.ts` import extensions (`allowImportingTsExtensions`).

### Confirmed in Phase 4
- **Reps are counted automatically from the tempo** (owner decision 2026-11-10, confirmed twice;
  OVERRIDES the "confirm with Rep Done" wording in the Phase 4 and Phase 4-revision prompts — do not
  revert without asking): every completed tempo cycle = 1 rep (3-1-1 → every 5 s); the set finishes
  at the target. "Count rep now" / Space adds a rep and restarts the cycle; Undo rep and Finish set
  early correct it. Nothing counts while paused or asleep. Exercises without a tempo count only on
  confirmation. Timed holds (plank) are counted down and complete automatically.
- **Workout flow (Phase 4 revision)**: the player starts the workout as soon as it opens (no intro
  screen): exercise-1 preview + the **only** 10 s preparation countdown → set 1 → rest → set 2 …
  → after an exercise's last set a **60 s transition rest** that previews the next exercise →
  next exercise set 1 directly. No countdown between sets, sides or exercises; no rest after the
  final set (straight to the summary). Unilateral: left → right immediately (no rest, "Switch to
  Right" cue), rest only after both sides. A transition is stored as phase `rest` with the engine
  already on the next exercise / set 1 (`restKind()` derives between-sets vs transition), so the
  checkpoint schema is unchanged and refresh restores it. 3-2-1 beeps also play before a rest ends.
- **Rest rules**: rest = recipe `program_exercises.rest_seconds` if set, else the exercise
  library `default_rest_seconds` (already resolved into `workout_exercises.rest_seconds` by
  `start_workout_session`). Library defaults: compound lower body (goblet squat, DB reverse lunge,
  DB Romanian deadlift, DB sumo squat) 90 s; everything else 60 s (incl. bodyweight squat, shoulder
  press, rows, curls, lateral raise, dead bug, plank). Transition between exercises: 60 s
  (`TRANSITION_REST_MS`). No 30 s defaults. Add 15 s / Skip rest / Pause always available.
- **Timer architecture**: pure reducer `reduce(state, action, now)` in `src/lib/engine/`; all time
  derived from stored timestamps (`phaseEndsAt`); one `setInterval` (250 ms) in
  `WorkoutController` only *triggers* ticks; throttled/missed ticks are caught up from
  timestamps; ticks are idempotent. React reads the controller via `useSyncExternalStore`.
- **Sleep handling**: a gap > 90 s between ticks (longer than browser background throttling)
  = device slept → the workout pauses at the last tick ("paused because your device went to
  sleep"). Sleep time is never counted as exercise/rest and holds are never auto-completed.
- *(Superseded by the Phase 4 revision below: 60 s transition rest between exercises, no
  countdown between sets/sides.)* Rest between sets = snapshot `rest_seconds` (60 s, 90 s for
  goblet squat, DB reverse lunge, DB Romanian deadlift, DB sumo squat).
- **Unilateral**: left → right = one set (no rest between); per-direction: forward → backward.
  Each side is its own `workout_sets` row; a set counts only when both sides are recorded.
- **Tempo start phase** per exercise (`src/lib/engine/tempo-start.ts`): pulling/pressing/lifting
  movements start concentric (rows, curls, presses, raises, bridges, kicks, calf raises…).
- **Session statuses**: in_progress, interrupted, completed, stopped, abandoned. *Active* =
  in_progress or interrupted (one per user, DB index). Stop (confirmed) → `stopped`, never
  completed; all exercises done with ≥ 1 set → `completed`; everything skipped → `stopped`.
- **Catch-up rule (user decision, 2026-11-13)**: strength workouts can be started on their
  scheduled day or any later day while the program is active, unless already completed; future
  ones can be viewed, not started (no testing override — see CHANGELOG). Stored as
  `scheduled_date` (fixed program day) + `performed_at` (Begin pressed). Completion counts for the
  scheduled day; one completed session per user + scheduled date + activity (DB index).
  Statuses: **Late** = past & not done within the same program week; **Missed** = after that week
  (strength still startable as a catch-up). Starting a past workout asks for confirmation.
  Rules in `src/lib/program/start-rules.ts` (UI) mirrored by `start_workout_session` (enforcement).
- **Recovery**: opening a session that already ran (refresh, closed tab, other device) marks it
  `interrupted` and asks "Your previous workout was interrupted. What would you like to do?" →
  Continue Previous Workout (any day while the program runs — it stays recorded for its
  scheduled date; resumes *paused* at the checkpoint with the remaining time saved there;
  preparation restarts at 10 s; away time counted as paused) or Start Over (old attempt kept as
  `abandoned`, the same scheduled workout starts fresh).
- **Checkpoints**: `/api/workout/checkpoint` route handler (works with `fetch keepalive` on tab
  close), on every transition (debounced 0.6 s), every 15 s while running, on pause/resume and when
  the tab is hidden. Optimistic concurrency on `revision`; a stale device stops writing.
- **Writes**: Server Actions; set rows upserted with `ignoreDuplicates` (idempotent retries); set
  status derived server-side from achieved vs target; exercise status recomputed from rows.
- **Duration** = active time from Begin (excludes pauses and interruptions), clamped server-side
  to wall time since `performed_at`.
- **Audio**: original sine-tone WAVs generated by `scripts/generate-audio.mjs` (no samples, music
  or speech); played with HTML `<audio>`; unlocked on "Begin workout" (iPhone); silent fallback.
- **Feedback** stored in `workout_feedback` (+ `pain_reported`, notes); no program changes yet.
- Wake Lock API keeps the screen on during an active workout where supported.

### Proposed for later phases

1. **Folder layout**
   ```
   src/app/(auth)/login, forgot-password, update-password     # ✅ Phase 2
   src/app/(app)/dashboard, workout, walking, progress, history, settings   # ✅ Phase 1
   src/app/(app)/report                                       # Phase 8
   src/app/(focus)/workout/session/[id]     # full-screen workout, no nav (FocusShell ✅)
   src/components/ui/                        # design-system primitives ✅
   src/components/layout/                    # AppShell, nav, page scaffolding ✅
   src/components/<feature>/
   src/lib/supabase/{server,client,proxy}.ts               # ✅ Phase 2
   src/lib/program/                          # 12-week program + exercise library (typed data)
   src/lib/engine/                           # pure timer/state-machine (no React)
   src/lib/audio/                            # HTML <audio> manager
   src/lib/adaptive/                         # progression rules (pure functions)
   src/lib/calc/                             # pace, streaks, completion, deltas
   src/server/actions/                       # Server Actions (all DB writes)
   supabase/migrations/                      # SQL migrations
   public/illustrations/exercises/*.svg
   public/audio/*.m4a|wav
   ```
2. **Program data**: canonical program and exercise library authored as typed TS data, and seeded
   into `exercise_library` / `program_exercises` by a migration generated from that source, so the
   DB is the source of truth and the TS types stay in sync.
3. **Per-user prescriptions**: `adaptive_adjustments` stores overrides; effective prescription =
   base program row + latest applicable adjustment. The base program is never mutated.
4. **Workout engine**: pure, deterministic state machine. Each phase stores
   `phase_started_at` + `phase_duration_ms`; displayed time = `duration − (now − started)`,
   recomputed on `requestAnimationFrame`/one interval owned by a single hook. Pause stores
   remaining ms. On visibility/wake, the engine fast-forwards through elapsed phases. Checkpoints
   written to `workout_session_state` at phase transitions, set completion, pause/resume.
   Wake Lock API used on desktop to keep the screen on during a session (feature-detected).
5. **Rep cueing**: tempo is shown visually per phase (lower / hold / lift). Audio is a short local
   tick per phase change and per countdown second — no speech.
6. **Writes**: Server Actions with Zod-free lightweight validation (hand-written guards) to avoid
   extra deps — revisit if validation becomes complex. Client-generated UUIDs for
   sessions/sets/walks make retries idempotent (`insert … on conflict do nothing`).
7. **Offline**: small pending-mutation queue in IndexedDB/localStorage used *only* as an outbox,
   flushed on `online`; UI shows "Not synced" until server confirms.
8. **Photos**: client-side resize/compress via `<canvas>` to ≤1600 px WebP/JPEG (~200–400 KB),
   uploaded to private bucket `progress-photos/{user_id}/week-{n}/{type}.webp`; storage RLS by
   folder = `auth.uid()`; displayed via short-lived signed URLs.
9. **PDF**: generated client-side with `@react-pdf/renderer` (avoids Vercel function time/memory
   limits; photos embedded via signed URLs). Fallback: print stylesheet.
10. **Notifications**: PWA manifest + service worker. Local `Notification` while app/tab is open,
    plus in-app reminder banners (always). True closed-browser push is deferred (see §7).
11. **Program calendar**: Week 1 starts on the Monday of the chosen start date's week (proposed);
    `week = floor((date − startMonday)/7) + 1`, clamped 1–12. Timezone stored in settings.

---

## 5. Database schema overview

Full details, relation diagram, RLS table and run order: **`docs/DATABASE.md`**.

Reference (shared, read-only): `exercise_library` (26 exercises), `program_days` (84 rows),
`program_exercises` (203 base prescriptions).

Personal (`user_id → auth.users`, RLS owner-only): `profiles`, `reminder_settings`,
`user_programs`, `workout_sessions`, `workout_exercises`, `workout_sets`,
`workout_session_state`, `workout_feedback`, `adaptive_adjustments`, `walking_activities`,
`body_measurements`, `progress_photos`.

Storage: private bucket `progress-photos`, path `<user_id>/week-<n>/<type>-<ts>.<ext>`, 5 MB,
JPEG/PNG/WebP, owner-only policies, signed URLs (5 min) via `src/server/storage/progress-photos.ts`.

Migrations (`supabase/migrations/`, run in order in SQL Editor):
1. `20261110120000_initial_schema.sql` 2. `20261110120100_rls_policies.sql`
3. `20261110120200_storage_progress_photos.sql` 4. `20261110120300_seed_exercise_library.sql`
5. `20261110120400_seed_program.sql` · Test: `supabase/tests/rls_test.sql` (rolls back).

---

## 6. Completed phases

| Phase | Status |
|---|---|
| 0 — Repository analysis & plan | ✅ Done (2026-11-10) |
| 1 — Foundation | ✅ Done (2026-11-10), commit `70bb8d6` |
| 2 — Auth & DB | ✅ Done (2026-11-10) — migrations 1–5 run on hosted DB, anon access denied (verified) |
| 3 — Program & exercise library | ✅ Implemented (2026-11-11) — migrations 6–7 + logged-in check pending user |
| 4 — Workout engine | ✅ Implemented (2026-11-12) — migration 8 + signed-in browser check pending user |
| 5 — Audio & adaptive progression | ✅ Implemented (2026-11-14) — migration 10 + browser check pending user |
| 6 — Walking tracker | ✅ Implemented (2026-11-15) — migration 11 + browser check pending user |
| 7 — Body measurements & progress | ✅ Implemented (2026-11-16) — migration 12 + browser/Storage check pending user |
| 8 — Dashboard, reminders & PWA | ✅ Implemented (2026-11-17) — migration 13 + signed-in / iPhone check pending user |
| 9 — Report, PDF, QA & deployment | 🟡 Report + PDF + QA done (2026-11-18); recovery awaiting routine approval; deployment awaiting owner actions |

## 7. Current status, known issues & open decisions

### Phase 4 verification (2026-11-12)
| Check | Result |
|---|---|
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | ✅ pass |
| `pnpm test` → unit: 54 tests incl. 26 engine/checkpoint/results tests (prep countdown, skip countdown, tempo sequences 3-1-1 / 2-1-2 / concentric-first / zero hold, reps only on confirm, target → set done, finish early = partial, rest 90 s / +15 s / skip / end → prep, no rest after last set, unilateral L+R, per-direction, plank countdown + early end, pause/resume exact, throttled-tab catch-up, sleep gap → pause, idempotent ticks, actions keep device "awake", skip exercise, completion, progress, tempo adjust, checkpoint round trip + recovery time validation, results completed/partial/skipped) | ✅ pass |
| `pnpm test` → DB: migrations 1–8 + `workout_test.sql` (start, duplicate prevention, interrupted still active, idempotent sets, Start Over keeps abandoned, no restart after completion, walking day refused, other user's program refused, cross-user isolation) + RLS test | ✅ pass |
| Signed-out: session pages → login; checkpoint API → 401 JSON; invalid payload → 400; audio files served | ✅ pass |
| Full signed-in workout in the browser (start → sets → rest → summary → feedback, refresh recovery, stop) | ⛔ BLOCKED — needs migrations 6–8 on Supabase and the owner signed in |
| Real laptop sleep / real second device | ⛔ Not tested — only simulated in unit tests (sleep gap, revision conflict logic) |
| Audio on iPhone Safari / desktop Safari | ⛔ Not verified by ear |

### Phase 3 deliverables (2026-11-11)
- Lib (pure, unit-tested): `src/lib/program/calendar.ts`, `estimate.ts`, `format.ts`, `labels.ts`,
  `types.ts`.
- Server: `src/server/program/queries.ts` (program, week data, library, exercise, activity
  records — all via the user's session, personal tables filtered by `user_id`),
  `src/server/program/view.ts` (overview, week view, next workout, completion),
  `src/server/actions/program.ts` (`startProgram`, `changeProgramStartDate`).
- Pages: `/workout` (overview + `?week=N`), `/workout/day/[date]`, `/workout/day/[date]/start`
  (Phase 4 placeholder), `/workout/exercises`, `/workout/exercises/[id]`; Dashboard and
  Settings → Program integrated; `(app)/error.tsx`.
- Components: `StartProgram`, `StartDateForm`, `ProgramSummary`, `WeeklySchedule` (real dates,
  statuses, links), `ExerciseIllustration` (placeholder), `ProgressBar`.
- Migration 6: exercise instructions. Test fixture `tests/fixtures/master-program.mjs`.

### Phase 3 verification
| Check | Result |
|---|---|
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | ✅ pass (program pages partially prerendered) |
| `pnpm test:unit` — 28 tests (incl. completion: 72 = 36/24/12, recovery ≠ strength, scheduled-day matching, fixed weekdays for every selectable start date) (calendar: Jakarta "today", Monday validation, week maths, 84-day span, phases, missed/never-shift statuses, completion boundary; duration estimate) | ✅ pass |
| `pnpm test:db` — migrations 1–6, seeds/instructions re-run, **program == master prompt** (schedule, walking, 203 prescriptions, spec tempos, sides, timed holds), RLS incl. program lifecycle | ✅ pass |
| New routes redirect to login when signed out; no server errors | ✅ pass |
| Logged-in pages (start program, dashboard, day detail, library) in the browser | ⛔ BLOCKED — needs the owner to sign in (the assistant does not enter the real password) |
| Migration 6 on hosted DB | ⛔ BLOCKED — user runs it in SQL Editor (until then exercise pages show no instruction text) |

### Phase 2 deliverables (2026-11-10)
- 5 SQL migrations (schema, RLS, storage, 2 seeds), RLS test script, optional baseline script.
- Auth: `src/proxy.ts`, `src/lib/supabase/proxy.ts`, `src/server/auth.ts` (DAL),
  `src/server/actions/auth.ts` (signIn, signOut, requestPasswordReset, updatePassword),
  `src/app/auth/callback/route.ts`, pages `/login`, `/forgot-password`, `/update-password`
  (`(auth)` layout), `SessionWatcher`, `SignOutButton` (sidebar + Settings → Account).
- UI primitives added: `Field`, `Alert`, `PasswordField`.
- Storage helpers: `src/lib/storage/progress-photos.ts` (validation, path, ownership),
  `src/server/storage/progress-photos.ts` (signed URLs). Upload UI is Phase 6.
- Scripts: `pnpm test:db`, `pnpm test:unit`, `pnpm check:env`.

### Phase 2 verification
| Check | Result |
|---|---|
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | ✅ pass |
| `pnpm test:unit` (9 tests: redirect safety, photo validation/paths) | ✅ pass |
| `pnpm test:db` — migrations + seeds ×2 + RLS test on PGlite (Postgres 18) | ✅ pass; mutation-tested (leaky policy, weakened FK, anon grant, foreign storage folder all detected) |
| `pnpm check:env` — env, Auth reachable, email provider on, sign-up disabled | ✅ pass |
| Route protection (curl + browser): protected → `/login?next=…`; stale cookie → `reason=expired`; bad reset link → `reason=link_invalid`; public pages 200 | ✅ pass |
| Login UI: validation errors; wrong credentials → "Incorrect email or password." from real Supabase | ✅ pass (desktop + iPhone) |
| Successful login / logout / password reset with the real account | ⛔ BLOCKED — needs the owner's credentials (not entered by the assistant) |
| Migrations + `rls_test.sql` on the hosted project; anon REST denial | ⛔ BLOCKED — migrations not run yet |
| Signed URL creation against real Storage | ⛔ BLOCKED — needs migrations + a real upload (Phase 6) |

### Manual actions for the user
0. ✅ Migrations 6–8 run (verified 2026-11-10 via `recomp_today()` / anon RPC probe).
   **Run migration 9** `20261113090000_scheduled_vs_performed.sql`, then
   `supabase/tests/rls_test.sql` and `supabase/tests/workout_test.sql`; `pnpm check:env` must pass.
   Sign in, start the program, and try a workout (a catch-up of an earlier strength day works on
   any day).
1. ✅ Done: migrations 1–5 + `rls_test.sql`.
2. Ensure an auth user exists (Authentication → Users → Add user, auto-confirm).
3. Authentication → URL Configuration: Site URL `http://localhost:3000` (change to the Vercel URL
   when deployed); Redirect URLs: `http://localhost:3000/**` (+ `https://<app>.vercel.app/**` later).
4. Optional: run `supabase/manual/set_baseline_profile.sql` with your email.
5. Rotate the Supabase secret key that was pasted in chat (Project Settings → API Keys); the app
   does not use it.
6. Then: `pnpm check:env`, and sign in / out at `http://localhost:3000` to confirm.

### Known issues
- None blocking. Generated DB types (`supabase gen types`) are not set up (would need CLI + access
  token); queries are untyped until a hand-written or generated type file is added.
- `SessionWatcher` reacts to `SIGNED_OUT` in the current tab; sign-out on another device is caught
  on the next navigation/refresh by the proxy.
- Recovery days can't be logged yet (no routine defined; `start_workout_session` accepts strength
  days only), so recovery completion stays 0 — shown honestly on the dashboard.
- `instruction.md` (0 bytes, user-created) left untouched.

Known constraints / risks:
- **Audio assets**: none exist. Plan: generate original simple tone files offline with a small
  Node script (WAV) and convert with `afconvert` to AAC/M4A for Safari. This is build-time asset
  creation; the app itself only uses `<audio>`.
- **Illustrations**: 26 original SVG illustrations (start + end pose, motion arrows) must be
  drawn in a consistent figure style — sizable effort; quality to be reviewed by the user.
- **Recovery/Stretching day**: the brief gives no exercise list → currently a neutral note only.
  Needs a user decision (e.g. approve a short list of gentle stretches) before a guided routine.
- **Tempos**: spec tempos used where given; other exercises got beginner defaults in the seed
  (2-1-2 bodyweight/core, 2-1-1 dumbbell upper body, 3-1-1 squats/RDL, arm circles 1-0-1); user
  can adjust during workouts.
- **Ranges** (e.g. 12–15, 15–20 s): start at the low end. *Phase 5 decision*: because almost every
  prescription is a single value (12–12), the adaptive ceiling is `max(target_max, target_min +
  progression_headroom)` per exercise (e.g. +4 reps compound, +2 per side unilateral, +15 s plank)
  rather than the prescribed max alone; otherwise only sets could ever change.
- **Push notifications**: closed-browser reminders on iPhone need an installed PWA (iOS 16.4+) **and**
  a server sending Web Push. Vercel Hobby cron runs at most once per day with imprecise timing, so
  exact-time push isn't achievable free without an external scheduler. v1 = in-app + open-tab
  notifications; optional daily push via Vercel Cron if the user wants it.
- **Password reset emails**: Supabase's built-in SMTP is heavily rate-limited (a few per hour) and
  only delivers to project team members' addresses — fine for a single owner account.
- **Supabase Free pausing**: projects pause after ~7 days without activity; must be restored from
  the dashboard. Free quotas: 500 MB DB, 1 GB storage, 5 GB egress.

Open decisions (defaults in use):
1. Program start date rule — Monday only, this week's Monday to +8 weeks (enforced in UI/server/DB).
2. Timezone — schedule uses Asia/Jakarta (user decision, Phase 3). `reminder_settings.timezone`
   is still 'UTC' by default; Phase 8 reminders should use Asia/Jakarta.
3. Thursday recovery routine content — not defined yet.
4. Exercise instruction text (migration 6) — awaiting user review.

### Confirmed in Phase 5 (2026-11-14)
- **Audio**: HTML `<audio>` only (no Web Audio, no speech), original sine-tone WAVs generated by
  `scripts/generate-audio.mjs`: countdown, go, tempo, **rep** (new), rest-complete, **transition**
  (new, when the 60 s rest before the next exercise starts), workout-complete. The engine emits
  cues as effects; `pickCue()` plays **one cue per engine step** by priority (workout complete >
  transition > rest complete > go > countdown > rep > tempo) so nothing piles up; ticks are
  idempotent so re-renders never replay. Turning sound off pauses a playing cue; volume 0 is
  silent; blocked/missing/throwing playback is swallowed. Preference in `profiles`
  (`sound_enabled`, `sound_volume`) → same on every device (player + Settings).
- **Feedback**: only for `completed` workouts (stopped / interrupted / abandoned never count).
  One row per session. Saved with `save_workout_feedback` (atomic). Can be changed until the next
  workout of the same type is started; a change *replaces* the earlier adjustment. Pain checkbox
  blocks any increase.
- **Adaptive rules** (`src/lib/progression/adaptive.ts`, exercise metadata from migration 10):
  at most ONE exercise and ONE variable per feedback; never weight.
  - Too Easy: among exercises fully completed in that workout, least recently adjusted first:
    target + step up to the ceiling; at the ceiling + 1 set (max base + 1, ≤ 4). Not with pain.
  - Just Right: nothing.
  - Too Hard: performed exercise with the lowest completion (compound first on ties): remove an
    added set first; else target − step down to the floor; at the floor − 1 set (≥ 1). Skipped
    exercises are never touched. Pain adds a safety note.
  - Steps: compound bilateral ±2 (+4/−4), unilateral compound ±1/side (+2/−3), isolation ±2
    (+5 or +4/−4), unilateral isolation ±1 (+3/−4), core unilateral ±1 (+2/−3, knee raise +3),
    plank ±5 s (+15/−10 s, never sets), arm circles never (warm-up). Floors ≥ 4 reps / 10 s.
  - Changes apply to workouts started from the feedback date (`effective_from`), keyed by
    exercise + workout type; finished workouts never change (DB trigger).
  - Deviation from the master prompt to confirm: an increase can follow a single Too Easy (the
    Phase 5 prompt asks for gradual increases; the step is small and capped).
- **UI**: summary shows the feedback form with a one-line explanation, then the result
  ("Next Lower Body workout: Goblet Squat 12 reps → 14 reps (2 sets)" + reason + when it applies),
  or "No change". Locked state after the next workout of that type starts. History: Progress →
  Training adjustments, Exercise detail → Your adjustments, and a note on the day detail page
  when an adjustment affects that workout.

### Phase 5 verification (2026-11-14)
| Check | Result |
|---|---|
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | ✅ pass |
| `pnpm test:unit` — adaptive (15: Just Right, Too Easy compound/isolation/unilateral/core/plank, ceiling → +1 set, never past ceiling, completed-only, pain, mobility, rotation, Too Hard lowest completion, compound first, extra set first → floor → −1 set, skipped never touched, floors, completion ratio) + audio (6: HTML audio + volume, toggle, volume 0/clamp, fallback reject/throw/no Audio, one cue per step, engine cues + no replay) | ✅ pass |
| `pnpm test:db` — migrations 1–10 + `adaptive_test.sql` (see docs/DATABASE.md) + existing RLS / workout tests | ✅ pass |
| Migration 10 on hosted Supabase | ⛔ BLOCKED — user runs it (`pnpm check:env` reports it missing until then) |
| Signed-in browser flow (feedback → adjustment → next workout uses it; history pages) | ⛔ Not verified — needs migration 10 and the owner signed in |
| Audio by ear (Chrome/Safari desktop, iPhone Safari) | ⛔ Not verified by ear; Safari not tested |

### Confirmed in Phase 6 (2026-11-15)
- **Manual walk logs** (Apple Watch or any device; no GPS / Apple Health): date (default today,
  Asia/Jakarta, never future), duration as hours + minutes (1 min–10 h), distance km (decimal, dot
  or comma, required), optional steps (whole, > 0, thousands separators accepted), optional notes.
  Same validation in the form and the server action (`src/lib/walking/walking.ts`), plus DB checks.
- **Calculations**: pace = minutes / km → "12:00 min/km"; speed = km / hours → "5.0 km/h". Shown
  live only when duration and distance are valid; steps are never invented (totals show "—").
- **Which walk?**: each log is a program walk (Tuesday / Saturday Walking of a given week) or an
  *Additional walk*. Program walks can be logged from the Monday of their week onwards (catch-up
  later is fine; Saturday's walk may be done earlier in the same week). One log per program walk
  (DB unique). The form defaults to this week's most recent open walk; links from the dashboard /
  day page preselect a walk. Additional walks never count toward the program target or completion.
- **Targets** from `program_days` (spec table). Target met = duration ≥ minimum target. Targets
  never change automatically.
- **Completion** of walking days now uses `scheduled_date` (before: the date walked), so a
  Tuesday walk logged on Thursday completes Tuesday. Program completion (72 activities) unchanged.
- **Pages**: `/walking` (log form with live pace/speed/target, this week's program walks, totals,
  history with All / This week / Last 30 days), `/walking/[id]` (detail, target vs actual, edit in
  place, delete with confirmation). Dashboard: Walking card (next target, last walk, totals with
  program vs extra, weekly program-walk completion) + "Log walk" on walking days. Day detail
  (Tue/Sat): logged walk or "Log this walk".

### Phase 6 verification (2026-11-15)
| Check | Result |
|---|---|
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | ✅ pass |
| `pnpm test:unit` — walking (17: pace, speed, no calc from invalid, duration, distance, steps, date, 24 program walks + targets, catch-up / week rule / logged excluded / default, scheduled vs additional validation, duplicate refused + edit allowed, field errors, target status, weekly completion ignores extra walks, totals) | ✅ pass |
| `pnpm test:db` — migrations 1–11 + `walking_test.sql` + RLS / workout / adaptive tests | ✅ pass |
| Migration 11 on hosted Supabase | ⛔ BLOCKED — user runs it |
| Signed-in browser check (log, edit, delete, dashboard, iPhone form) | ⛔ Not verified — needs migration 11 and the owner signed in |

### Confirmed in Phase 7 (2026-11-16)
- **Recharts** was planned but not installed; added `recharts@^3.10.1` in Phase 7.
- **Measurements**: date (not future), check-in week (1/4/8/12 or an extra week), weight + body
  fat required, skeletal muscle, visceral fat, waist, lower abdomen, arm, thigh, notes optional and
  never pre-filled. Ranges follow the DB (body fat 2–75 % — stricter than "0–100"). Shared
  validation `src/lib/measurements/measurements.ts` (form + server) + DB constraints/trigger.
- **Schedule**: check-in = Monday–Sunday of weeks 1/4/8/12; status saved / due / late (week over,
  still recordable, counts for its week) / upcoming. Program never shifts.
- **Changes** = latest − first real value per metric, neutral wording ("+0.3 kg", "−1.5 pts");
  each metric carries context (weight may stay flat or rise in a recomposition; arm/thigh can grow
  with muscle). No interpolation, no predictions; one value → "trend after the next check-in".
- **Charts** (`MetricCard` small multiples, Recharts): one series each in accent-600 (validated
  with the dataviz palette validator), 2 px linear line, 10 px markers with a white ring, solid
  hairline grid, time-scaled x axis with the real check-in dates, crosshair tooltip (date + week +
  value), empty state per metric. The history table is the table view.
- **Photos**: front / side / back per check-in week; JPEG/PNG/WebP ≤ 5 MB (HEIC decoded by the
  browser is re-encoded); resized in the browser to ≤ 2000 px JPEG (also strips EXIF/GPS);
  upload via one-time signed upload URL with a progress bar; `taken_on` date; replace and delete
  (confirmation) with orphan-safe ordering; 5-minute signed URLs for viewing.
- **Comparison**: Week 1 vs 4 / 8 / 12 per type, same 3:4 frame; a missing side shows an empty
  state — nothing is substituted.
- **Pages**: `/progress` (program week, latest check-in + changes, schedule, charts, photo
  comparison, walking stats, training adjustments), `/progress/measurements` (form, check-ins,
  history), `/progress/measurements/[id]` (detail, edit, delete), `/progress/photos` (upload grid,
  comparison). Dashboard "Progress overview" now shows real data (was a static empty state).

### Phase 7 verification (2026-11-16)
| Check | Result |
|---|---|
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | ✅ pass |
| `pnpm test:unit` — measurements & photos (10: parsing, creation without defaults, validation, editing, schedule statuses, series without interpolation, first/latest/change incl. increases + single value + empty, file validation + photo date, resize, comparison with missing sides) + existing photo-path tests | ✅ pass |
| `pnpm test:db` — migrations 1–12 + `progress_test.sql` + all earlier SQL tests | ✅ pass |
| Migration 12 on hosted Supabase | ⛔ BLOCKED — user runs it |
| Real upload to Storage, signed upload URL, signed view URLs, file deletion | ⛔ NOT verified — Storage is stubbed in PGlite; needs a signed-in test in the app |
| Charts / forms in the browser and on iPhone | ⛔ Not verified — needs the owner signed in |

### Confirmed in Phase 8 (2026-11-17)
- **Dashboard** (real data only): program overview (week, day X/84, activities X/72 + %, strength /
  walking / recovery counts), Today card with status (Upcoming / Due today / Completed / Late ·
  catch-up / Missed — `STATUS_LABEL`), quick actions (Continue / Start / Catch up / View plan
  following Phase 4 rules; Log walking; Record measurement; View progress), late strength workouts
  and walks of this week, This week calendar, Weekly activity (strength x/3, walking x/2 + time and
  distance of every walk this week counted once, extra walks noted, recovery x/1), next activity
  (any type), body progress (latest weight / body fat / skeletal muscle, change vs the PREVIOUS
  check-in), walking card. The redundant "Activity summary" card was removed (same numbers are in
  the Program card). Pure logic in `src/lib/program/dashboard.ts`.
- **Reminders**: preferences in `reminder_settings` (migration 13): workout + measurement on/off,
  separate times (default 08:00), weekdays, timezone (saved from the browser). Evaluated by the
  OPEN app (`ReminderAgent` in the app shell: on load, tab visible, back online, every minute;
  status re-read from `/api/reminders` every 5 min) with `src/lib/reminders/reminders.ts`:
  only on chosen weekdays at/after the chosen time in the user's timezone; workout reminder only
  while today's strength / walking / recovery day isn't completed; measurement reminder only while
  the week 1/4/8/12 check-in is due or late. Always shown as an in-app banner (dismissible);
  additionally ONE browser notification per reminder id (via the service worker when available)
  if permission is granted. Permission is requested only from Settings → "Enable notifications".
  Notified/dismissed ids live in localStorage (UI state only).
- **Browser limits (documented in the UI)**: no push server → nothing fires while RECOMP is fully
  closed; notifications arrive only while it's open or in the background. iPhone needs the app
  installed to the Home Screen (iOS 16.4+) for notifications. The program calendar uses
  Asia/Jakarta; reminder times use the saved timezone.
- **PWA**: `src/app/manifest.ts` (RECOMP, standalone, start `/`, theme/background #f7f6f3,
  orientation any), icons rendered from the existing mark by `scripts/generate-icons.mjs` (192,
  512, maskable 512, apple-touch 180). `public/sw.js` (no-store headers in next.config): caches
  only `/_next/static/*`, `/icons`, `/audio`, `/illustrations` and `/offline.html`; never page
  HTML, RSC, `/api`, `/auth`, non-GET or cross-origin (Supabase, signed photo URLs). Offline
  navigation → `/offline.html` ("nothing has been saved"). Updates wait for the user ("A new
  version is ready · Reload"). Registered in production only. Offline bar in every page; the
  workout save queue / checkpoints are unchanged. Install: native prompt button (Settings →
  Install app), iOS Share → Add to Home Screen steps, hidden when already standalone.
- **Not used on purpose**: Next's `experimental.useOffline` (would keep Server Actions pending and
  auto-submit later, changing the Phase 4 save queue and "no silent writes").

### Phase 8 verification (2026-11-17)
| Check | Result |
|---|---|
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | ✅ pass |
| `pnpm test:unit` — reminders (10: timezone, time, weekdays, completed, walking/recovery/rest, enable/disable, measurement due/late/saved, no duplicates, invalid tz, day labels), dashboard (5: statuses, weekly activity without double counting, empty week, next activity, workout action), PWA (4: SW never caches personal data, caches only static files, update waits for the user, manifest + icon sizes + offline page) | ✅ pass (134 total) |
| `pnpm test:db` — migrations 1–13 + all SQL tests | ✅ pass |
| Production server (curl): manifest, icons, `/sw.js` no-store + CSP, `/offline.html`, `/api/reminders` 401 JSON no-store, protected pages → login | ✅ pass |
| Headless Chrome (playwright-core + installed Chrome): SW active + controlling, Chrome installability (no errors, persistent profile), manifest parsed, cache contains only static assets, offline bar, offline navigation → offline page, iPhone 13 viewport: no horizontal overflow, touch targets ≥ 44 px | ✅ pass (signed-out pages only) |
| Signed-in dashboard / reminder settings / real notifications / iPhone standalone install | ⛔ Not verified — needs the owner signed in and a real iPhone |

### Confirmed in Phase 9 (2026-11-18)
- **Recovery = "Not configured"** (`RECOVERY_CONFIGURED = false` in `src/lib/program/schedule.ts`)
  until the owner approves a routine: Thursday shows status `not_configured`, is never Late /
  Missed, isn't counted as planned or completed, gets no reminder. Totals are now **60 planned
  activities** (36 strength + 24 walking) instead of 72; the 12 recovery days are tracked apart.
  Proposed routine + implementation plan are in the Phase 9 report (needs approval → migration 14).
- **12-week report** `/progress/report` (+ `src/lib/report/report.ts`, `src/server/report/queries.ts`):
  program summary (calendar progress separate from activity completion), body composition first vs
  latest (never-measured metrics omitted, one value → "needs a 2nd value", recomposition context,
  charts), training from workout snapshots (sessions, completion rate vs due, exercises performed,
  weekly consistency, top exercises, recorded progression, feedback counts, adaptive changes),
  walking (every walk once, weighted average pace = total time ÷ total km, speed, weekly program
  walks), private photo comparison, 12-week timeline. "Interim" until the 12 calendar weeks end,
  "Final" after.
- **PDF** `GET /api/report/pdf?photos=0|1` — `@react-pdf/renderer` (server-only, externalized in
  next.config), A4, same data object as the page; photos optional, downloaded with the user's
  session and embedded as bytes (JPEG/PNG; WebP skipped) — the PDF contains no URLs; read-only;
  `Cache-Control: private, no-store`; 401 when signed out. Built-in Helvetica (WinAnsi), so `→ − ✓`
  are sanitized.
- **Navigation**: "12-Week Report" in the sidebar (Progress no longer highlighted at the same time),
  shortcuts on Dashboard, Progress and History.
- **Root icons**: `/favicon.ico`, `/apple-touch-icon(-precomposed).png` (browsers request them).
- **Deployment guide**: `docs/DEPLOYMENT.md`.

### Phase 9 verification (2026-11-18)
| Check | Result |
|---|---|
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | ✅ pass |
| `pnpm test:unit` (140) incl. report (6) and updated completion/calendar/dashboard tests for "not configured" | ✅ pass |
| `pnpm test:db` — migrations 1–13 + RLS / workout / adaptive / walking / progress SQL tests | ✅ pass |
| PDF render (fixture data via a temporary dev route, since removed): A4, 3 pages, values/dates, charts, timeline, embedded photos, **0 URLs in the file** | ✅ pass (visually inspected) |
| Security (production build): every protected page → login; `/api/reminders`, `/api/report/pdf`, `/api/workout/checkpoint` → 401 signed out; forged cookie → login; no secret in client bundles; SW caches only static assets | ✅ pass |
| Responsive (signed-out pages, headless Chrome): iPhone 13, iPad, MacBook 1440, external 2560 — no overflow, no tiny targets, no console errors | ✅ pass |
| Signed-in report / PDF with real data, iPhone install, production deployment | ⛔ Not verified — needs the owner (sign-in, Vercel, Supabase URL settings) |

### Tempo-synchronized exercise animation (2026-11-18)
- `movementAt(state, now)` (pure) derives pose from the engine's `tempoAnchorAt` / tempo sequence
  (reps) or `phaseEndsAt` / `remainingMs` (holds); time = `pausedAt` when paused, `lastTickAt` after
  a sleep gap. Figures in `src/lib/animation/exercises.ts` (keyed by exercise_library.id); an
  exercise without a figure falls back to the static illustration. Engine/reducer untouched.

## 8. Outstanding tasks
1. Approve (or change) the recovery routine → migration 14 + `RECOVERY_CONFIGURED = true`.
2. Deployment steps in `docs/DEPLOYMENT.md` (commit/push, Vercel project + env vars, Supabase URLs).
3. Verify production with the owner's account. Still open: original exercise illustrations (placeholders), recovery routine content
(Thursday sessions can't be started yet — `start_workout_session` only allows strength days).

## 9. Environment setup requirements
| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, Vercel | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`, Vercel | `sb_publishable_…` (legacy anon key also works) |
| `NEXT_PUBLIC_SITE_URL` | `.env.local`, Vercel | Base URL for password-reset links |

No secret/service key is used. `pnpm check:env` validates the configuration.
Supabase dashboard: public sign-up disabled (done), auth user created in Authentication → Users,
URL Configuration as in §7.

## 10. Deployment readiness
Builds cleanly for Vercel (proxy + partial prerendering). Not deployed. Not ready for real use
until migrations are run and login is confirmed by the user; feature UIs come in later phases.
