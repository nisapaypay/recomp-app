-- =============================================================================
-- RECOMP · OPTIONAL manual script · Reset workout data (for re-testing)
-- -----------------------------------------------------------------------------
-- NOT a migration. Run in Supabase → SQL Editor.
--
-- Deletes, for ONE account only:
--   * every workout session (in progress, completed, stopped, abandoned …)
--     → with it: exercises, sets, checkpoints and feedback (cascade)
--   * every adaptive adjustment (otherwise old adjustments would still shape
--     the next workouts)
-- Keeps: the program and its start date, profile, sound settings, walking,
-- measurements, photos, reference data.
--
-- THIS CANNOT BE UNDONE.
--
-- 1. Replace EVERY YOUR_EMAIL_HERE (6×, use Find & Replace) with your login email.
-- 2. Run STEP 1 alone and check the numbers.
-- 3. Run STEP 2. The final row shows what is left (all zeros).
-- =============================================================================

-- STEP 1 · Preview (changes nothing) -----------------------------------------
select
  (select count(*) from public.workout_sessions s join auth.users u on u.id = s.user_id
     where u.email = 'YOUR_EMAIL_HERE')                                         as sessions,
  (select count(*) from public.workout_feedback f join auth.users u on u.id = f.user_id
     where u.email = 'YOUR_EMAIL_HERE')                                         as feedback,
  (select count(*) from public.adaptive_adjustments a join auth.users u on u.id = a.user_id
     where u.email = 'YOUR_EMAIL_HERE')                                         as adjustments;

-- STEP 2 · Delete (one transaction) --------------------------------------------
begin;

do $$
declare
  v_uid uuid := (select id from auth.users where email = 'YOUR_EMAIL_HERE');
begin
  if v_uid is null then
    raise exception 'No account with that email — nothing deleted.';
  end if;
  delete from public.adaptive_adjustments where user_id = v_uid;
  delete from public.workout_sessions     where user_id = v_uid;  -- cascades to exercises, sets, state, feedback
end;
$$;

select
  (select count(*) from public.workout_sessions s join auth.users u on u.id = s.user_id
     where u.email = 'YOUR_EMAIL_HERE')                                         as sessions_left,
  (select count(*) from public.adaptive_adjustments a join auth.users u on u.id = a.user_id
     where u.email = 'YOUR_EMAIL_HERE')                                         as adjustments_left;

commit;
