# RECOMP — Database, RLS & Storage

Source of truth: the SQL files in `supabase/migrations/`. This document explains them.

## 1. Running the migrations (Supabase Dashboard → SQL Editor)

Run each file **once, in this order**. Open the file in the repo, copy its whole content, paste
into a new SQL Editor query, click **Run**, and wait for "Success" before the next one.

| # | File | What it does |
|---|---|---|
| 1 | `20261110120000_initial_schema.sql` | Tables, constraints, indexes, `updated_at` triggers, auth-user trigger, RLS enabled |
| 2 | `20261110120100_rls_policies.sql` | Table privileges + 47 explicit RLS policies |
| 3 | `20261110120200_storage_progress_photos.sql` | Private `progress-photos` bucket + 4 Storage policies |
| 4 | `20261110120300_seed_exercise_library.sql` | 26 exercises (reference data) |
| 5 | `20261110120400_seed_program.sql` | 84 program days + 203 prescriptions (reference data); self-checks counts |
| 6 | `20261111090000_exercise_instructions.sql` | Instruction text for the 26 exercises (description, starting position, steps, breathing, common mistakes). Re-runnable; fails if any exercise is left without instructions. |
| 7 | `20261111150000_exercise_instructions_plain_language.sql` | Plain-language revision of 11 exercises (no jargon). **Run after 6.** If you ever re-run 6, re-run 7 afterwards. |
| 8 | `20261112090000_workout_engine.sql` | Phase 4: one *active* session per user (`in_progress` **or** `interrupted`), checkpoint columns `paused_ms_total` / `paused_at`, `recomp_today()` (Asia/Jakarta), atomic `start_workout_session(program_id)`. Not re-runnable. |
| — | *(Phase 9: no schema change. Recovery logging needs an approved routine first; it will be migration 14.)* | |
| 13 | `20261117090000_reminder_preferences.sql` | Phase 8: `reminder_settings.measurement_reminder_time` (default 08:00), `reminder_days smallint[]` (ISO weekdays, default all, 1–7 values only), workout reminder default 08:00, timezone default Asia/Jakarta; rows the user never saved get the new defaults. RLS unchanged (select / update own; row created by the auth trigger). Not re-runnable. |
| 12 | `20261116090000_measurements_photos.sql` | Phase 7: `body_measurements` — weight + body fat required for new/edited rows (`NOT VALID` check), trigger refuses a future `recorded_on` (Asia/Jakarta); `progress_photos.taken_on` (date taken, backfilled from `uploaded_at`, default today) with a no-future trigger. Tables, bucket and storage policies otherwise unchanged. Not re-runnable. |
| 11 | `20261115090000_walking_tracker.sql` | Phase 6: `walking_activities.scheduled_date` (program Tue/Sat walk a log counts for; NULL = additional walk; `activity_date` = performed date), one log per scheduled walk (unique index), checks (Tue/Sat only, not before the walk's program week; distance required and steps > 0 for new/edited rows), validation trigger (no future date in Asia/Jakarta, scheduled walk must be a walking day of the user's program), backfill of existing logs on programmed walking days. Not re-runnable. |
| 10 | `20261114090000_adaptive_progression.sql` | Phase 5: `exercise_library` progression metadata (`movement_type`, `progression_step`, `progression_headroom`, `regression_room`, `max_extra_sets`), one adjustment per feedback / per source session (unique indexes), immutable prescription snapshots (trigger), atomic `save_workout_feedback(...)`, and `start_workout_session` now applies the user's adjustments when snapshotting. Not re-runnable. |
| 9 | `20261113090000_scheduled_vs_performed.sql` | Catch-up workouts: `workout_date` → `scheduled_date` (rename, data kept), new `performed_at`, one **completed** session per user + scheduled date + activity, `start_workout_session(program_id, scheduled_date)` (past/today allowed, future refused; replaces the today-only version). Not re-runnable. |

Then verify:

| File | How |
|---|---|
| `supabase/tests/workout_test.sql` | Run after migration 8. Start / duplicate prevention / interrupted still active / idempotent sets / Start Over keeps the abandoned attempt / no restart after completion / walking day refused / other user's program refused / cross-user isolation of sessions, exercises, sets, checkpoints, feedback. Temporarily fixes "today" inside the transaction and rolls everything back. Success = `ALL WORKOUT TESTS PASSED (changes rolled back)`. |
| `supabase/tests/progress_test.sql` | Run after migration 12. Measurement creation without defaults, late check-in keeps its week, weight required, future date / body fat > 75 / negative waist / second row for a week refused, edit in place, delete; photo rows only in the owner's folder, one per week + type, JPEG/PNG/WebP ≤ 5 MB, no future date; cross-user: B's photo rows/files invisible and undeletable, no measurement for another user; owner deletes file then row. Success = `ALL PROGRESS TESTS PASSED (changes rolled back)`. |
| `supabase/tests/walking_test.sql` | Run after migration 11. Catch-up log counts for its scheduled day, no double logging of a scheduled walk, unlimited additional walks, future date refused, non-Tue/Sat / outside-program / before-its-week refused, early Saturday within the same week allowed, distance required, steps > 0, edit keeps the row (id, created_at), edit can't create a duplicate or a future date, delete frees the walk, cross-user isolation. Success = `ALL WALKING TESTS PASSED (changes rolled back)`. |
| `supabase/tests/adaptive_test.sql` | Run after migration 10. Metadata, feedback only for completed workouts, every invalid adjustment refused (step too big, above ceiling, wrong previous values, two variables, wrong direction, pain, skipped exercise, Just Right with a change), replace-not-duplicate on resubmit, unique adjustment per feedback, correction to Just Right removes the adjustment, immutable history, next workout applies the change while the old one stays, feedback locked after the next workout started, stopped workout refused, cross-user isolation (read, snapshot, FK). Success = `ALL ADAPTIVE TESTS PASSED (changes rolled back)`. |
| `supabase/tests/rls_test.sql` | Run in SQL Editor. Creates two throwaway users, tries every cross-user attack, **rolls everything back**. Success = a row reading `ALL RLS TESTS PASSED (changes rolled back)`. Any failure stops with `RLS TEST FAILED: …`. |
| `pnpm check:env` (local) | Confirms the tables now exist and anonymous REST requests are denied. |

Optional: `supabase/manual/set_baseline_profile.sql` writes the baseline from the master spec
(152 cm, 53.9 kg, 32.4 % BF, 20 kg SMM, visceral 4.5) into your profile. Edit the email first.

Notes
- Files 1–3 are **not** re-runnable (they create objects). If one fails, read the error, fix the
  cause, and re-run only that file (each file is a single transaction, so a failure leaves
  nothing half-created).
- Files 4–7 are re-runnable and replace reference data. Do not re-run file 5 after workouts exist
  (it deletes and recreates prescriptions; a session's FK to `program_days` will block it).
- Never paste a secret key or database password anywhere in the app or the repo.

## 2. Tables and relations

```
auth.users ─┬─1:1─ profiles                 (baseline + preferences)
            ├─1:1─ reminder_settings
            ├─1:n─ user_programs ──1:n── workout_sessions ─┬─1:1─ workout_session_state
            │                                              ├─1:1─ workout_feedback ──0:n── adaptive_adjustments
            │                                              └─1:n─ workout_exercises ──1:n── workout_sets
            ├─1:n─ adaptive_adjustments ─────────────────────────(0:n)── workout_exercises.adjustment_id
            ├─1:n─ walking_activities
            ├─1:n─ body_measurements                  (≤1 per week)
            └─1:n─ progress_photos                    (≤1 per week × front/side/back) → Storage object

Reference (shared, read-only):
exercise_library ──1:n── program_exercises ──n:1── program_days (week 1–12 × day 1–7)
```

### Reference tables
| Table | Key | Notes |
|---|---|---|
| `exercise_library` | `id` text slug (e.g. `goblet-squat`) | category, target muscles, equipment, `measure_type` (reps/seconds), `side_mode` (none/per_side/per_direction), default tempo (3 columns, NULL for timed holds), default rest, difficulty, safe modifications. Instruction text + illustration path filled in Phase 3. A readable slug is used instead of a UUID so seeds and snapshots are self-explanatory and stable. |
| `program_days` | (`week_number`, `day_of_week`) | Fixed schedule × 12 weeks. Walking days carry min/max target minutes (CHECK enforces targets only on walking days). |
| `program_exercises` | uuid | Base prescription per training day: sets, `target_min`/`target_max` (range, per side), optional tempo/rest overrides (NULL = library default), notes. Never changed per user. |

### Personal tables (all have `user_id → auth.users ON DELETE CASCADE`)
| Table | Highlights |
|---|---|
| `profiles` | PK = `user_id`. Height, baseline weight/BF/SMM/visceral (nullable, never invented), units, sound on/off, volume, default rest. BMI derived, not stored. |
| `reminder_settings` | PK = `user_id`. Workout reminders on/off + time, measurement reminders, timezone. |
| `user_programs` | `start_date` must be a Monday; `end_date` generated (+83 days); status; **one active program per user** (partial unique index). Current week is computed from dates. |
| `workout_sessions` | One row per attempt. Status `in_progress / completed / stopped / interrupted / abandoned` (Start Over keeps the old attempt as `abandoned`). **One in-progress session per user** (partial unique index → no duplicates from retries or two devices). Client may supply the UUID for idempotent retries. |
| `workout_exercises` | Snapshot of the effective prescription at session start (name, sets, target, tempo, rest, measure/side mode) so history stays accurate. Status `pending / in_progress / completed / partial / skipped`; CHECK: `completed` requires all sets done → skipped can never look completed. |
| `workout_sets` | One row per set (per side/direction for unilateral work); unique `(exercise, set, side)` NULLS NOT DISTINCT for idempotent writes. |
| `workout_session_state` | Timer checkpoint per session: indices, phase, `phase_started_at`, `phase_duration_ms`, `remaining_ms` (paused), overrides, `revision` for cross-device concurrency. |
| `workout_feedback` | One per session: too_easy / just_right / too_hard, `pain_reported`, notes. |
| `adaptive_adjustments` | Previous vs new sets/target, `change_type`, reason, `effective_from`, link to feedback/session. CHECK: exactly **one** variable changes per adjustment. |
| `walking_activities` | Date, duration (required), distance (optional), steps, notes. Pace computed. |
| `body_measurements` | Week 1–12, all metrics nullable (incomplete records allowed), unique per week. Realistic range CHECKs. |
| `progress_photos` | Metadata only (path, type, size, dimensions). Unique per week × type. CHECK: `storage_path` must start with `<user_id>/`. |

### Cross-user safety by construction
Child tables carry `user_id` and reference their parent with a **composite FK**
`(parent_id, user_id) → parent(id, user_id)`. FK checks bypass RLS, so a plain `parent_id` FK
would let a user attach rows to someone else's session if they knew its id. With the composite
FK, the parent must have the *same* `user_id`, and RLS forces that `user_id` to be `auth.uid()`.
The `user_id` column on child tables is therefore deliberate (also keeps policies simple and
fast), not accidental duplication.

### Workout session lifecycle (Phase 4)
```
start_workout_session(program, scheduled_date) ─► in_progress ──(all exercises done, ≥1 set)──► completed
                              │   ▲  └──(Stop, confirmed / nothing done)──► stopped
   page reopened / refresh ──►│   │
                              ▼   │ Continue Previous Workout (same day only)
                          interrupted ──(Start Over)──► abandoned  (+ new in_progress)
```
* Active = `in_progress` or `interrupted`; a partial unique index allows only one per user.
* `start_workout_session(program_id, scheduled_date)` (security invoker → RLS applies) validates:
  own active program, scheduled date inside the program and **not after today** (Asia/Jakarta),
  a strength day, not already completed; snapshots that scheduled week/day's prescription into
  `workout_exercises`; creates the checkpoint row; returns the existing active session instead
  of a duplicate (also on a concurrent-insert race).
* **Scheduled vs performed** (migration 9): `scheduled_date` is the program day (fixed calendar);
  `performed_at` is when Begin was pressed. A catch-up = performed on a later Jakarta date.
  Completion always counts for `scheduled_date`. Unique index: one `completed` row per
  user + scheduled_date + activity_type (abandoned / stopped attempts remain as history).
* `workout_sets`: one row per set, or per side for unilateral work (`side` left/right,
  forward/backward). Skipped sets are stored with status `skipped`.
* `workout_session_state`: checkpoint written by `/api/workout/checkpoint` with optimistic
  concurrency on `revision` (a second device that continued the workout makes older screens stop).

### Adaptive progression (Phase 5, migration 10)
```
completed workout ─► save_workout_feedback(session, difficulty, pain, notes, adjustment|null)
                       │ locks the session row (concurrent submits run one at a time)
                       │ refuses: not completed · next workout of this type already started (locked)
                       │ deletes this workout's previous adjustment (replace, never add)
                       │ upserts workout_feedback (unique session_id)
                       └ validates + inserts ≤ 1 adaptive_adjustments row
next start_workout_session ─► prescription = base + Σ(adjustment deltas), clamped to the safe range
```
* **Who decides what**: the app computes which exercise/variable changes
  (`src/lib/progression/adaptive.ts`, unit-tested); the function re-checks every rule:
  exercise is in this workout and was performed (not skipped), previous values equal the
  workout's snapshot, one variable only (table constraint), direction matches the feedback,
  Too Easy needs the exercise fully completed and no pain, |Δtarget| ≤ `progression_step`,
  Δsets = ±1, new values inside the safe range, reason present.
* **Safe range** (same formula in the function, the snapshot, and `bounds()` in TS):
  floor = `min(target_min, max(target_min − regression_room, 4 reps | 10 s))`,
  ceiling = `max(target_max, target_min + progression_headroom)`,
  sets 1 … `min(base sets + max_extra_sets, 4)`.
* **Applying**: adjustments are keyed by user + exercise + workout type (`activity_type`) and stored
  as previous → new values; the snapshot adds their summed deltas to the scheduled week's base
  prescription and records the latest one in `workout_exercises.adjustment_id`.
* **History never changes**: trigger `workout_exercises_prescription_immutable` blocks changes to
  a snapshot's exercise, sets, target, tempo or rest after it was written (status / completed
  sets still update during the workout).
* **No double processing**: unique `adaptive_adjustments(feedback_id)` and `(source_session_id)`.

### Walking (Phase 6, migration 11)
* `activity_date` = when the walk was done; `scheduled_date` = the program walk it counts for
  (Tuesday/Saturday) or NULL for an additional walk. The program calendar never shifts.
* Completion: a program walk is completed when a log has `scheduled_date` = that day (logged
  that day or later). Additional walks appear in history and totals only.
* Targets come from `program_days.walking_target_min/max_minutes`; a walk meets its target when
  its duration ≥ the minimum. Targets are never changed by logged walks.
* Pace and speed are calculated in the app (`src/lib/walking/walking.ts`), never stored.

### Measurements & photos (Phase 7, migration 12)
* `body_measurements.week_number` = the check-in it counts for (official 1/4/8/12; other weeks =
  extra measurements), unique per user + week; `recorded_on` = the real date (late is fine).
  Ranges come from migration 1 (e.g. weight 20–300 kg, body fat 2–75 %, waist 30–250 cm).
* Photos: file in the private bucket at `<user_id>/week-<n>/<type>-<timestamp>.jpg`, metadata in
  `progress_photos` (unique user + week + type). Upload = server action creates a one-time signed
  upload URL (user session, Storage RLS applies) → browser PUTs the file (progress shown) → server
  action verifies the object exists and writes the row. Replacing a photo updates the row first,
  then removes the old file; leftover unreferenced files in that week folder are removed.
  Deleting removes the file first, then the row (a failure never leaves an orphaned file).
  Viewing uses 5-minute signed URLs; public URLs are never used.
* Hosted Supabase blocks direct SQL `DELETE` on `storage.objects` (trigger `storage.protect_delete`,
  "Use the Storage API instead"). The app deletes files with `storage.remove()`; the SQL tests
  accept that refusal and check that the other user's file still exists.

## 3. RLS policies

| Role | Access |
|---|---|
| `anon` (not signed in) | Nothing. All privileges revoked on every table. |
| `authenticated` — reference tables | `SELECT` only (`using (true)`). No write privilege or policy → only migrations (database owner) can change them. |
| `authenticated` — `profiles`, `reminder_settings` | `SELECT`, `UPDATE` where `user_id = auth.uid()`. Rows are created by the `on_auth_user_created` trigger; insert/delete not granted. |
| `authenticated` — 10 other personal tables | `SELECT / INSERT / UPDATE / DELETE` own rows: `USING ((select auth.uid()) = user_id)` and `WITH CHECK ((select auth.uid()) = user_id)` (so a row can't be re-assigned to another user). |
| Storage buckets table | `storage.buckets` has RLS with no user policies (Supabase default): users can't list buckets via SQL. The Storage API reads bucket config itself. Verify bucket settings as the database owner (SQL Editor). |
| Storage `progress-photos` | `SELECT / INSERT / UPDATE / DELETE` only when `bucket_id = 'progress-photos'` and the first folder of the object name equals `auth.uid()`. Bucket is private; 5 MB limit; JPEG/PNG/WebP only. |

Audit query:
```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname in ('public', 'storage') order by 1, 2;
```

## 4. Automated checks in the repo

| Command | What it proves | Limits |
|---|---|---|
| `pnpm test:db` | Runs all migrations (+ seeds twice), compares the program with an independent transcription of the master prompt (`tests/fixtures/master-program.mjs`), and runs `rls_test.sql`, `workout_test.sql`, `adaptive_test.sql`, `walking_test.sql` and `progress_test.sql` in PGlite (real Postgres, in memory) with a minimal stand-in for Supabase's `auth`/`storage` schemas. | Not the hosted project; Supabase's real Storage service and Auth are stubbed. |
| `pnpm check:env` | Env vars valid, no secret in `NEXT_PUBLIC_*`, Auth reachable, sign-up disabled, tables present, anon REST access denied. | Uses only the publishable key. |
| `rls_test.sql` in SQL Editor | Same RLS test against the **real** database. | Requires migrations 1–5. |
