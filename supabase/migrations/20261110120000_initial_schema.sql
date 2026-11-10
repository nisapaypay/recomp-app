-- =============================================================================
-- RECOMP · Migration 1/5 · Initial schema
-- -----------------------------------------------------------------------------
-- Creates all tables, constraints, indexes and triggers.
-- RLS is enabled here (deny-by-default) and policies are added in migration 2.
-- Safe to run once on an empty project. Run migrations in filename order.
--
-- Conventions
--   * Every personal row carries user_id → auth.users(id) ON DELETE CASCADE.
--   * Child tables also carry user_id and reference their parent with a
--     COMPOSITE foreign key (parent_id, user_id). Together with the RLS
--     "user_id = auth.uid()" check this makes it impossible to attach a row
--     to another user's parent, even though FK checks bypass RLS.
--   * Derived values (BMI, pace, program end date, current week) are computed,
--     not stored, except end_date which is a generated column.
--   * Enumerations use text + CHECK so they can be extended with a simple
--     ALTER instead of enum surgery.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is 'Trigger: keeps updated_at current on UPDATE.';

-- =============================================================================
-- REFERENCE DATA (shared, read-only to users; seeded by migrations 4 and 5)
-- =============================================================================

-- Exercise library ------------------------------------------------------------
create table public.exercise_library (
  id                    text primary key
                        check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),          -- stable slug
  name                  text not null unique check (length(name) between 2 and 80),
  category              text not null
                        check (category in ('lower_body', 'upper_body', 'core', 'full_body', 'mobility')),
  target_muscles        text[] not null default '{}',
  equipment             text not null check (equipment in ('bodyweight', 'dumbbells')),
  measure_type          text not null default 'reps' check (measure_type in ('reps', 'seconds')),
  side_mode             text not null default 'none'
                        check (side_mode in ('none', 'per_side', 'per_direction')),
  -- Default tempo in seconds per phase (lowering · hold · lifting). NULL for timed holds.
  tempo_eccentric_s     smallint check (tempo_eccentric_s between 0 and 10),
  tempo_pause_s         smallint check (tempo_pause_s between 0 and 10),
  tempo_concentric_s    smallint check (tempo_concentric_s between 0 and 10),
  default_rest_seconds  smallint not null default 60 check (default_rest_seconds between 15 and 300),
  difficulty            text not null default 'beginner'
                        check (difficulty in ('beginner', 'intermediate')),
  -- Instructional content (authored in Phase 3).
  description           text,
  starting_position     text,
  execution_steps       text[] not null default '{}',
  breathing             text,
  common_mistakes       text[] not null default '{}',
  safe_modifications    text[] not null default '{}',
  illustration_path     text,                                   -- e.g. /illustrations/exercises/<id>.svg
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint exercise_tempo_all_or_none check (
    (tempo_eccentric_s is null and tempo_pause_s is null and tempo_concentric_s is null)
    or (tempo_eccentric_s is not null and tempo_pause_s is not null and tempo_concentric_s is not null)
  ),
  constraint exercise_timed_has_no_tempo check (
    measure_type = 'reps' or tempo_eccentric_s is null
  )
);

comment on table public.exercise_library is 'Shared exercise catalogue. Read-only for app users.';

-- Program days: the fixed weekly schedule for each of the 12 weeks -----------
create table public.program_days (
  week_number                 smallint not null check (week_number between 1 and 12),
  day_of_week                 smallint not null check (day_of_week between 1 and 7), -- ISO 1=Mon … 7=Sun
  activity_type               text not null check (activity_type in (
                                'lower_body', 'walking', 'upper_body_core',
                                'recovery', 'full_body_core', 'rest')),
  walking_target_min_minutes  smallint check (walking_target_min_minutes between 1 and 180),
  walking_target_max_minutes  smallint check (walking_target_max_minutes between 1 and 180),
  primary key (week_number, day_of_week),
  constraint program_days_walking_targets check (
    (activity_type = 'walking'
      and walking_target_min_minutes is not null
      and walking_target_max_minutes >= walking_target_min_minutes)
    or (activity_type <> 'walking'
      and walking_target_min_minutes is null
      and walking_target_max_minutes is null)
  )
);

comment on table public.program_days is 'Fixed 12-week schedule (Mon Lower, Tue Walk, Wed Upper/Core, Thu Recovery, Fri Full/Core, Sat Walk, Sun Rest).';

-- Program exercises: base prescriptions per training day ---------------------
create table public.program_exercises (
  id                  uuid primary key default gen_random_uuid(),
  week_number         smallint not null,
  day_of_week         smallint not null,
  order_index         smallint not null check (order_index between 1 and 20),
  exercise_id         text not null references public.exercise_library (id) on update cascade,
  sets                smallint not null check (sets between 1 and 6),
  -- Target per set (per side for side_mode <> 'none'): reps, or seconds for timed holds.
  -- A range (e.g. 12–15) starts at target_min; adaptive changes stay within it.
  target_min          smallint not null check (target_min between 1 and 300),
  target_max          smallint not null,
  -- Optional overrides; NULL = use exercise_library defaults.
  tempo_eccentric_s   smallint check (tempo_eccentric_s between 0 and 10),
  tempo_pause_s       smallint check (tempo_pause_s between 0 and 10),
  tempo_concentric_s  smallint check (tempo_concentric_s between 0 and 10),
  rest_seconds        smallint check (rest_seconds between 15 and 300),
  notes               text,
  created_at          timestamptz not null default now(),
  foreign key (week_number, day_of_week)
    references public.program_days (week_number, day_of_week) on delete cascade,
  constraint program_exercises_target_range check (target_max >= target_min),
  constraint program_exercises_tempo_all_or_none check (
    (tempo_eccentric_s is null and tempo_pause_s is null and tempo_concentric_s is null)
    or (tempo_eccentric_s is not null and tempo_pause_s is not null and tempo_concentric_s is not null)
  ),
  unique (week_number, day_of_week, order_index),
  unique (week_number, day_of_week, exercise_id)
);

create index program_exercises_exercise_idx on public.program_exercises (exercise_id);

comment on table public.program_exercises is 'Base (original) prescriptions. Never mutated per user; see adaptive_adjustments.';

-- =============================================================================
-- PERSONAL DATA
-- =============================================================================

-- Profile + app preferences (1:1 with auth user) -----------------------------
create table public.profiles (
  user_id                     uuid primary key references auth.users (id) on delete cascade,
  display_name                text check (length(display_name) <= 80),
  height_cm                   numeric(4,1) check (height_cm between 100 and 250),
  -- Baseline values (before Week 1). BMI is derived from height + weight.
  initial_weight_kg           numeric(5,2) check (initial_weight_kg between 20 and 300),
  initial_body_fat_pct        numeric(4,1) check (initial_body_fat_pct between 2 and 75),
  initial_skeletal_muscle_kg  numeric(4,1) check (initial_skeletal_muscle_kg between 5 and 80),
  initial_visceral_fat        numeric(4,1) check (initial_visceral_fat between 0 and 60),
  -- Preferences
  preferred_units             text not null default 'metric' check (preferred_units in ('metric')),
  sound_enabled               boolean not null default true,
  sound_volume                numeric(3,2) not null default 0.80 check (sound_volume between 0 and 1),
  default_rest_seconds        smallint not null default 60 check (default_rest_seconds between 15 and 300),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- Program enrolment ------------------------------------------------------------
create table public.user_programs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Week 1 always starts on a Monday; the app normalises the chosen date.
  start_date  date not null check (extract(isodow from start_date) = 1),
  end_date    date generated always as (start_date + 83) stored,   -- Sunday of Week 12
  status      text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)                                               -- composite FK target
);

-- At most one active program per user.
create unique index user_programs_one_active_idx
  on public.user_programs (user_id) where status = 'active';
create index user_programs_user_idx on public.user_programs (user_id);

comment on column public.user_programs.end_date is 'Generated: start_date + 83 days. Current week is computed from dates, never stored.';

-- Workout sessions (one row per attempt) -----------------------------------
create table public.workout_sessions (
  id                uuid primary key default gen_random_uuid(),   -- may be client-generated (idempotent retries)
  user_id           uuid not null references auth.users (id) on delete cascade,
  program_id        uuid not null,
  workout_date      date not null,
  week_number       smallint not null check (week_number between 1 and 12),
  day_of_week       smallint not null check (day_of_week between 1 and 7),
  activity_type     text not null check (activity_type in ('lower_body', 'upper_body_core', 'full_body_core', 'recovery')),
  -- in_progress → completed | stopped (user ended early) | interrupted (left mid-way)
  -- interrupted → in_progress (continued) | abandoned (user chose Start Over)
  status            text not null default 'in_progress'
                    check (status in ('in_progress', 'completed', 'stopped', 'interrupted', 'abandoned')),
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  duration_seconds  integer check (duration_seconds >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (program_id, user_id) references public.user_programs (id, user_id) on delete cascade,
  foreign key (week_number, day_of_week) references public.program_days (week_number, day_of_week),
  constraint workout_sessions_completed_has_time check (status <> 'completed' or completed_at is not null),
  unique (id, user_id)
);

-- Only one live session per user (prevents duplicates from retries / two devices).
create unique index workout_sessions_one_in_progress_idx
  on public.workout_sessions (user_id) where status = 'in_progress';
create index workout_sessions_user_date_idx on public.workout_sessions (user_id, workout_date desc);
create index workout_sessions_program_idx on public.workout_sessions (program_id);

-- Exercises within a session (prescription snapshot) ------------------------
create table public.workout_exercises (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null,
  user_id               uuid not null references auth.users (id) on delete cascade,
  program_exercise_id   uuid references public.program_exercises (id) on delete set null,
  exercise_id           text not null references public.exercise_library (id) on update cascade,
  adjustment_id         uuid,                                      -- adjustment that shaped this prescription, if any
  order_index           smallint not null check (order_index between 1 and 20),
  -- Snapshot of the effective prescription at session start (history stays accurate
  -- even if the library or adjustments change later).
  exercise_name_snapshot text not null,
  measure_type          text not null check (measure_type in ('reps', 'seconds')),
  side_mode             text not null check (side_mode in ('none', 'per_side', 'per_direction')),
  prescribed_sets       smallint not null check (prescribed_sets between 1 and 6),
  prescribed_target     smallint not null check (prescribed_target between 1 and 300),
  tempo_eccentric_s     smallint check (tempo_eccentric_s between 0 and 10),
  tempo_pause_s         smallint check (tempo_pause_s between 0 and 10),
  tempo_concentric_s    smallint check (tempo_concentric_s between 0 and 10),
  rest_seconds          smallint not null check (rest_seconds between 0 and 600),
  completed_sets        smallint not null default 0 check (completed_sets >= 0),
  status                text not null default 'pending'
                        check (status in ('pending', 'in_progress', 'completed', 'partial', 'skipped')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  foreign key (session_id, user_id) references public.workout_sessions (id, user_id) on delete cascade,
  constraint workout_exercises_completed_le_prescribed check (completed_sets <= prescribed_sets),
  -- Skipped exercises can never be shown as completed.
  constraint workout_exercises_completed_means_all_sets check (
    status <> 'completed' or completed_sets = prescribed_sets
  ),
  unique (session_id, order_index),
  unique (id, user_id)
);

create index workout_exercises_user_exercise_idx on public.workout_exercises (user_id, exercise_id);
create index workout_exercises_program_exercise_idx on public.workout_exercises (program_exercise_id);

-- Sets (one row per set, or per side/direction for unilateral work) ---------
create table public.workout_sets (
  id                    uuid primary key default gen_random_uuid(),
  workout_exercise_id   uuid not null,
  user_id               uuid not null references auth.users (id) on delete cascade,
  set_number            smallint not null check (set_number between 1 and 6),
  side                  text check (side in ('left', 'right', 'forward', 'backward')),
  target                smallint not null check (target between 1 and 300),
  achieved              smallint not null default 0 check (achieved between 0 and 300), -- reps or seconds
  duration_seconds      integer check (duration_seconds >= 0),
  status                text not null check (status in ('completed', 'partial', 'skipped')),
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  foreign key (workout_exercise_id, user_id)
    references public.workout_exercises (id, user_id) on delete cascade,
  -- Idempotent retries: one row per set/side.
  constraint workout_sets_unique_set unique nulls not distinct (workout_exercise_id, set_number, side)
);

create index workout_sets_user_idx on public.workout_sets (user_id, created_at desc);

-- Session state checkpoint (timer recovery, cross-device) -------------------
create table public.workout_session_state (
  session_id              uuid primary key,
  user_id                 uuid not null references auth.users (id) on delete cascade,
  current_exercise_index  smallint not null default 0 check (current_exercise_index >= 0),
  current_set             smallint not null default 1 check (current_set >= 1),
  current_side            text check (current_side in ('left', 'right', 'forward', 'backward')),
  current_rep             smallint not null default 0 check (current_rep >= 0),
  current_phase           text not null default 'intro',   -- engine phase name (validated in app, Phase 4)
  phase_started_at        timestamptz,                     -- wall-clock start of the current phase
  phase_duration_ms       integer check (phase_duration_ms >= 0),
  remaining_ms            integer check (remaining_ms >= 0), -- set while paused
  paused                  boolean not null default false,
  tempo_override          jsonb,                           -- user tempo tweak for this session, if any
  rest_override_seconds   smallint check (rest_override_seconds between 0 and 600),
  revision                integer not null default 0,      -- optimistic concurrency between devices
  updated_at              timestamptz not null default now(),
  foreign key (session_id, user_id) references public.workout_sessions (id, user_id) on delete cascade
);

create index workout_session_state_user_idx on public.workout_session_state (user_id);

-- Post-workout feedback -------------------------------------------------------
create table public.workout_feedback (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  session_id      uuid not null,
  difficulty      text not null check (difficulty in ('too_easy', 'just_right', 'too_hard')),
  pain_reported   boolean not null default false,  -- never progress through pain
  notes           text check (length(notes) <= 1000),
  created_at      timestamptz not null default now(),
  foreign key (session_id, user_id) references public.workout_sessions (id, user_id) on delete cascade,
  unique (session_id),
  unique (id, user_id)
);

create index workout_feedback_user_idx on public.workout_feedback (user_id, created_at desc);

-- Adaptive progression history -------------------------------------------------
create table public.adaptive_adjustments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  exercise_id         text not null references public.exercise_library (id) on update cascade,
  activity_type       text not null check (activity_type in ('lower_body', 'upper_body_core', 'full_body_core')),
  feedback_id         uuid,
  source_session_id   uuid,
  previous_sets       smallint not null check (previous_sets between 1 and 6),
  previous_target     smallint not null check (previous_target between 1 and 300),
  new_sets            smallint not null check (new_sets between 1 and 6),
  new_target          smallint not null check (new_target between 1 and 300),
  change_type         text not null check (change_type in (
                        'increase_target', 'decrease_target', 'increase_sets', 'decrease_sets')),
  reason              text not null check (length(reason) between 1 and 500),
  effective_from      date not null,
  created_at          timestamptz not null default now(),
  foreign key (feedback_id, user_id) references public.workout_feedback (id, user_id) on delete set null (feedback_id),
  foreign key (source_session_id, user_id) references public.workout_sessions (id, user_id) on delete set null (source_session_id),
  -- Exactly one variable changes per adjustment.
  constraint adaptive_one_variable check (
    (change_type in ('increase_target', 'decrease_target') and new_sets = previous_sets and new_target <> previous_target)
    or (change_type in ('increase_sets', 'decrease_sets') and new_target = previous_target and new_sets <> previous_sets)
  ),
  unique (id, user_id)
);

create index adaptive_adjustments_lookup_idx
  on public.adaptive_adjustments (user_id, exercise_id, activity_type, effective_from desc);

-- Link snapshot → adjustment (declared after both tables exist).
alter table public.workout_exercises
  add constraint workout_exercises_adjustment_fk
  foreign key (adjustment_id, user_id) references public.adaptive_adjustments (id, user_id)
  on delete set null (adjustment_id);

-- Walking (manual entry from Apple Watch) -------------------------------------
create table public.walking_activities (
  id                uuid primary key default gen_random_uuid(),   -- may be client-generated
  user_id           uuid not null references auth.users (id) on delete cascade,
  activity_date     date not null,
  duration_minutes  numeric(5,1) not null check (duration_minutes > 0 and duration_minutes <= 600),
  distance_km       numeric(5,2) check (distance_km > 0 and distance_km <= 100),  -- pace computed when present
  steps             integer check (steps between 0 and 200000),
  notes             text check (length(notes) <= 1000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index walking_activities_user_date_idx on public.walking_activities (user_id, activity_date desc);

-- Body measurements (official weeks 1/4/8/12; any field may be left empty) ---
create table public.body_measurements (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  week_number         smallint not null check (week_number between 1 and 12),
  recorded_on         date not null default current_date,
  weight_kg           numeric(5,2) check (weight_kg between 20 and 300),
  body_fat_pct        numeric(4,1) check (body_fat_pct between 2 and 75),
  skeletal_muscle_kg  numeric(4,1) check (skeletal_muscle_kg between 5 and 80),
  waist_cm            numeric(5,1) check (waist_cm between 30 and 250),
  lower_abdomen_cm    numeric(5,1) check (lower_abdomen_cm between 30 and 250),
  arm_cm              numeric(4,1) check (arm_cm between 10 and 80),
  thigh_cm            numeric(4,1) check (thigh_cm between 20 and 120),
  visceral_fat        numeric(4,1) check (visceral_fat between 0 and 60),
  notes               text check (length(notes) <= 1000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, week_number)
);

-- Progress photos (files live in the private Storage bucket, not the DB) ------
create table public.progress_photos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  week_number   smallint not null check (week_number between 1 and 12),
  photo_type    text not null check (photo_type in ('front', 'side', 'back')),
  storage_path  text not null unique,
  content_type  text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes    integer not null check (size_bytes between 1 and 5242880),
  width_px      integer check (width_px between 1 and 8000),
  height_px     integer check (height_px between 1 and 8000),
  uploaded_at   timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Path must sit inside the owner's folder: <user_id>/...
  constraint progress_photos_path_in_owner_folder check (storage_path like (user_id::text || '/%')),
  unique (user_id, week_number, photo_type)
);

-- Reminder settings (1:1 with auth user) -------------------------------------
create table public.reminder_settings (
  user_id                         uuid primary key references auth.users (id) on delete cascade,
  workout_reminders_enabled       boolean not null default false,
  workout_reminder_time           time not null default '07:00',
  measurement_reminders_enabled   boolean not null default true,
  timezone                        text not null default 'UTC' check (length(timezone) between 1 and 64),
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.exercise_library      for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profiles              for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_programs         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.workout_sessions      for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.workout_exercises     for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.workout_session_state for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.walking_activities    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.body_measurements     for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.progress_photos       for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.reminder_settings     for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- New auth user → empty profile + default reminder settings.
-- No personal values are invented; baseline fields stay NULL until entered.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  insert into public.reminder_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill users that existed before this migration (e.g. created in the dashboard).
insert into public.profiles (user_id) select id from auth.users on conflict do nothing;
insert into public.reminder_settings (user_id) select id from auth.users on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere (deny-by-default until policies exist).
-- -----------------------------------------------------------------------------
alter table public.exercise_library      enable row level security;
alter table public.program_days          enable row level security;
alter table public.program_exercises     enable row level security;
alter table public.profiles              enable row level security;
alter table public.user_programs         enable row level security;
alter table public.workout_sessions      enable row level security;
alter table public.workout_exercises     enable row level security;
alter table public.workout_sets          enable row level security;
alter table public.workout_session_state enable row level security;
alter table public.workout_feedback      enable row level security;
alter table public.adaptive_adjustments  enable row level security;
alter table public.walking_activities    enable row level security;
alter table public.body_measurements     enable row level security;
alter table public.progress_photos       enable row level security;
alter table public.reminder_settings     enable row level security;

commit;
