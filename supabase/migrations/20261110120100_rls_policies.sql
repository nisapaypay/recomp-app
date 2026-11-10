-- =============================================================================
-- RECOMP · Migration 2/5 · Privileges and Row Level Security policies
-- -----------------------------------------------------------------------------
-- Model
--   * anon (not signed in): no access to any table.
--   * authenticated: full CRUD on rows where user_id = auth.uid(), nothing else.
--   * Reference tables (exercise_library, program_days, program_exercises):
--     SELECT only for authenticated. No write policies exist, so they can only
--     be changed by migrations run as the database owner (SQL Editor).
--   * Cross-user linking is blocked by composite FKs (parent_id, user_id)
--     created in migration 1, combined with the WITH CHECK clauses below.
--
-- Policies are written one-per-command so they are easy to audit.
-- `(select auth.uid())` is used so Postgres evaluates it once per statement.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Table privileges (explicit; do not rely on project defaults)
-- -----------------------------------------------------------------------------
revoke all on table
  public.exercise_library, public.program_days, public.program_exercises,
  public.profiles, public.user_programs, public.workout_sessions,
  public.workout_exercises, public.workout_sets, public.workout_session_state,
  public.workout_feedback, public.adaptive_adjustments, public.walking_activities,
  public.body_measurements, public.progress_photos, public.reminder_settings
from anon, authenticated;

grant select on table
  public.exercise_library, public.program_days, public.program_exercises
to authenticated;

grant select, insert, update, delete on table
  public.user_programs, public.workout_sessions, public.workout_exercises,
  public.workout_sets, public.workout_session_state, public.workout_feedback,
  public.adaptive_adjustments, public.walking_activities, public.body_measurements,
  public.progress_photos
to authenticated;

-- 1:1 rows are created by the auth trigger; users may read and update them only.
grant select, update on table public.profiles, public.reminder_settings to authenticated;

-- -----------------------------------------------------------------------------
-- Reference tables: read-only for signed-in users
-- -----------------------------------------------------------------------------
create policy "exercise_library: authenticated can read"
  on public.exercise_library for select to authenticated using (true);

create policy "program_days: authenticated can read"
  on public.program_days for select to authenticated using (true);

create policy "program_exercises: authenticated can read"
  on public.program_exercises for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- profiles (select / update own)
-- -----------------------------------------------------------------------------
create policy "profiles: select own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- reminder_settings (select / update own)
-- -----------------------------------------------------------------------------
create policy "reminder_settings: select own"
  on public.reminder_settings for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "reminder_settings: update own"
  on public.reminder_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- Owner-only CRUD for every other personal table.
-- Generated with an explicit list so each policy is visible in pg_policies
-- as "<table>: select own", "<table>: insert own", etc.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  owner_tables text[] := array[
    'user_programs',
    'workout_sessions',
    'workout_exercises',
    'workout_sets',
    'workout_session_state',
    'workout_feedback',
    'adaptive_adjustments',
    'walking_activities',
    'body_measurements',
    'progress_photos'
  ];
begin
  foreach t in array owner_tables loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using ((select auth.uid()) = user_id)',
      t || ': select own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check ((select auth.uid()) = user_id)',
      t || ': insert own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)',
      t || ': update own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using ((select auth.uid()) = user_id)',
      t || ': delete own', t);
  end loop;
end;
$$;

commit;

-- Audit query (read-only): list every policy created above.
-- select tablename, policyname, cmd, roles, qual, with_check
--   from pg_policies where schemaname = 'public' order by tablename, cmd;
