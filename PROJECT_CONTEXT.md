# RECOMP — Project Context

> Read this file (and `CHANGELOG.md`) before continuing any interrupted session.
> Do not contradict the confirmed requirements below without explaining why and getting user approval.

Last updated: 2026-11-10 — Phase 1 (Project Foundation) complete. Waiting for Phase 2 instruction.

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
Flow: intro → instructions + illustration → **10 s preparation countdown** (pausable/cancellable)
→ reps at exercise-specific tempo (e.g. 3-1-1 = 3 s lower, 1 s hold, 1 s up = 5 s/rep, no pause
between reps) → set done → rest countdown → next set auto-prepares → after last set show next
exercise → transition rest → auto-start next exercise → completion screen.
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
- **Next.js 16 conventions**: Middleware is now `proxy.ts` (will live at `src/proxy.ts` in Phase 2).
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

### Proposed for later phases

1. **Folder layout**
   ```
   src/app/(auth)/login, reset-password, update-password      # Phase 2
   src/app/(app)/dashboard, workout, walking, progress, history, settings   # ✅ Phase 1
   src/app/(app)/report                                       # Phase 8
   src/app/(focus)/workout/session/[id]     # full-screen workout, no nav (FocusShell ✅)
   src/components/ui/                        # design-system primitives ✅
   src/components/layout/                    # AppShell, nav, page scaffolding ✅
   src/components/<feature>/
   src/lib/supabase/{server,client,middleware}.ts
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

## 5. Database schema overview (planned)

Tables from the master prompt, all with `user_id uuid references auth.users` where user-owned,
RLS `user_id = auth.uid()`, `created_at/updated_at` timestamps, FK + indexes:

`profiles`, `user_programs`, `exercise_library` (shared, read-only to authenticated),
`program_exercises` (shared, read-only; adds `side_mode`, `rep_type` [reps|seconds],
`reps_min/reps_max`, `tempo_down/hold/up`), `workout_sessions` (status: in_progress | completed |
interrupted | abandoned | stopped), `workout_exercises` (status: pending | completed | partial |
skipped), `workout_sets` (adds `side`), `workout_feedback`, `adaptive_adjustments` (adds
`program_exercise_id`, `feedback_id`, `applies_from_week`), `walking_activities`,
`body_measurements` (unique `user_id, week_number`), `progress_photos` (unique
`user_id, week_number, photo_type`), `reminder_settings`, `user_settings` (sound, volume, default
rest, units), `workout_session_state` (one row per session).

Storage: private bucket `progress-photos`.

---

## 6. Completed phases

| Phase | Status |
|---|---|
| 0 — Repository analysis & plan | ✅ Done (2026-11-10) |
| 1 — Foundation | ✅ Done (2026-11-10) |
| 2 — Auth & DB | ⏳ Waiting for user instruction |
| 3 — Program & exercise library | Not started |
| 4 — Workout engine | Not started |
| 5 — Adaptive training | Not started |
| 6 — Walking & measurements & photos | Not started |
| 7 — Dashboard & analytics | Not started |
| 8 — Reminders & final report | Not started |
| 9 — QA | Not started |

## 7. Current status, known issues & open decisions

### Phase 1 deliverables (done, verified 2026-11-10)
- Next.js 16.4.5 App Router + TS (strict) + Tailwind 4.3 + ESLint 9, `src/` dir, `@/*` alias, pnpm.
- Git repo initialised on `main` (**no commits yet**). `.env*` ignored except `.env.example`.
- Design tokens (`globals.css`): canvas/surface/ink/line neutrals, accent 50–900 (deep purple
  `#5d3fbb` primary), status colours, type scale incl. `text-timer` (clamp 6–15rem) and
  `text-metric`, radii, shadows, layout sizes (`w-sidebar`, `w-rail`, `h-tabbar`, `max-w-content`).
  Safe-area utilities `pb-safe` / `pt-safe`; reduced-motion respected; visible focus rings.
- UI primitives: `Button`/`ButtonLink` (primary, secondary, ghost, danger; sm–xl sizes, xl for
  workout controls), `Card`/`CardHeader`, `Badge`/`StatusBadge` (text label, never colour only),
  `EmptyState`, `Skeleton`.
- Layout: `AppShell`, `SidebarNav`, `MobileHeader`, `BottomNav`, `Brand`, `PageContainer`,
  `PageHeader`, `PageSection`, `FocusShell` (for workout mode), skip-to-content link.
- Routes: `/` → `/dashboard`; `/dashboard`, `/workout`, `/walking`, `/progress`, `/history`,
  `/settings`; `loading.tsx` skeleton; `not-found.tsx`; `icon.svg`.
- Static program constants: `src/lib/program/schedule.ts` (fixed weekly schedule, 4 phases,
  measurement weeks 1/4/8/12, status type). Dashboard shows the fixed weekly plan **without
  statuses** (no fake completion).
- All pages show honest empty / "In development" states — no fake data or fake interactions.
- Supabase prep: `@supabase/ssr` + `@supabase/supabase-js` installed; `src/lib/env.ts`,
  `src/lib/supabase/client.ts` (browser), `src/lib/supabase/server.ts` (server-only). Not yet
  called by any screen; untested against a real project.
- `.env.example`, `.claude/launch.json` (dev server preview config), `pnpm typecheck` script.

Verification: `pnpm typecheck` ✅, `pnpm lint` ✅, `pnpm build` ✅ (all routes static).
Browser checks at 1440×900, 1280×800, 900×1000 (icon rail) and 375×812 (iPhone): navigation,
active states, tab-bar clearance, 404, root redirect — no console errors.

### Known issues
- None blocking. `instruction.md` (0 bytes, user-created) left untouched.
- PWA manifest / apple-touch-icon PNGs not yet added (Phase 8).

Known constraints / risks:
- **No Docker / Supabase CLI** → local Supabase cannot run. DB, RLS and storage can only be tested
  once a cloud Supabase project and env vars exist. Until then cloud persistence is *untested*.
- **Audio assets**: none exist. Plan: generate original simple tone files offline with a small
  Node script (WAV) and convert with `afconvert` to AAC/M4A for Safari. This is build-time asset
  creation; the app itself only uses `<audio>`.
- **Illustrations**: ~30 original SVG illustrations (start + end pose, motion arrows) must be
  drawn in a consistent figure style — sizable effort; quality to be reviewed by the user.
- **Recovery/Stretching day**: the brief gives no exercise list → a gentle timed stretching
  routine must be authored (proposed: ~8 holds of 30 s, no mat needed).
- **Missing tempos**: many exercises have no tempo in the brief → defaults to be assigned
  (2-1-2 for most; holds for plank; flagged as editable).
- **Ranges** (e.g. 12–15, 15–20 s): start at the low end; adaptive logic may move within range only.
- **Push notifications**: closed-browser reminders on iPhone need an installed PWA (iOS 16.4+) **and**
  a server sending Web Push. Vercel Hobby cron runs at most once per day with imprecise timing, so
  exact-time push isn't achievable free without an external scheduler. v1 = in-app + open-tab
  notifications; optional daily push via Vercel Cron if the user wants it.
- **Password reset emails**: Supabase's built-in SMTP is heavily rate-limited and only delivers to
  project team members' addresses — fine for a single owner account.
- **Supabase Free pausing**: projects pause after ~7 days without activity; must be restored from
  the dashboard. Free quotas: 500 MB DB, 1 GB storage, 5 GB egress.

Open decisions for the user (defaults will be used if not answered):
1. Program start date rule — default: Week 1 begins the Monday of the chosen start date.
2. Timezone — default: detected from the browser and stored in settings.
3. Package manager — default: pnpm.

## 8. Outstanding tasks
Phases 2–9. Next: Phase 2 (Supabase project, migrations, RLS, login, `src/proxy.ts`, route
protection, private storage bucket).

## 9. Environment setup requirements
- Supabase project (Free) → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (publishable key), and for migrations either the Supabase CLI + DB password or pasting SQL into
  the SQL editor. `SUPABASE_SERVICE_ROLE_KEY` only if a server-only admin task needs it (avoid).
- Auth user created in Supabase dashboard; email sign-ups disabled.
- Auth URL config: Site URL + redirect URL for password reset (`/auth/callback`, Vercel domain).
- GitHub repo; Vercel project linked to it with the same env vars.

## 10. Deployment readiness
Builds cleanly for Vercel, but not deployed and has no auth/data yet — not ready for real use.
