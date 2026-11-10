-- =============================================================================
-- RECOMP · Walking tracker test (Phase 6)
-- -----------------------------------------------------------------------------
-- Run AFTER all migrations (1–11), in Supabase → SQL Editor. Everything (test
-- users, data, a temporarily fixed "today") is ROLLED BACK at the end.
-- Success = a row "ALL WALKING TESTS PASSED (changes rolled back)".
--
-- Program starts Monday 9 Nov 2026 → walks Tue 10, Sat 14, Tue 17, Sat 21 …
-- "Today" is frozen at Thursday 19 Nov (week 2).
-- =============================================================================

begin;

create or replace function public.recomp_today() returns date
language sql stable set search_path = '' as $$ select date '2026-11-19' $$;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000c1', 'walking-test-a@example.invalid'),
  ('00000000-0000-4000-8000-0000000000c2', 'walking-test-b@example.invalid');

insert into public.user_programs (id, user_id, start_date) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000c1', date '2026-11-09'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000c2', date '2026-11-09');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);

do $$
declare
  a constant uuid := '00000000-0000-4000-8000-0000000000c1';
  tue uuid; extra uuid; n int; created timestamptz;
begin
  -- Tuesday 17 Nov walk logged on Thursday 19 (catch-up): counts for Tuesday.
  insert into public.walking_activities (user_id, activity_date, scheduled_date, duration_minutes, distance_km, steps)
  values (a, date '2026-11-19', date '2026-11-17', 30, 2.5, 3600)
  returning id, created_at into tue, created;

  -- The same scheduled walk can't be logged twice …
  begin
    insert into public.walking_activities (user_id, activity_date, scheduled_date, duration_minutes, distance_km)
    values (a, date '2026-11-19', date '2026-11-17', 20, 1.5);
    raise exception 'WALKING TEST FAILED: scheduled walk counted twice';
  exception when unique_violation then null;
  end;
  -- … but additional walks are unlimited and never scheduled.
  insert into public.walking_activities (user_id, activity_date, duration_minutes, distance_km)
  values (a, date '2026-11-19', 40, 3.1)
  returning id into extra;
  insert into public.walking_activities (user_id, activity_date, duration_minutes, distance_km)
  values (a, date '2026-11-18', 15, 1.0);

  -- Future dates are refused.
  begin
    insert into public.walking_activities (user_id, activity_date, duration_minutes, distance_km)
    values (a, date '2026-11-20', 30, 2);
    raise exception 'WALKING TEST FAILED: future walk accepted';
  exception when check_violation then
    if sqlerrm <> 'walk_in_future' then raise; end if;
  end;

  -- Only Tuesdays/Saturdays can be scheduled walks …
  begin
    insert into public.walking_activities (user_id, activity_date, scheduled_date, duration_minutes, distance_km)
    values (a, date '2026-11-19', date '2026-11-18', 30, 2);
    raise exception 'WALKING TEST FAILED: Wednesday accepted as a program walk';
  exception when check_violation then null;
  end;
  -- … inside the user's program …
  begin
    insert into public.walking_activities (user_id, activity_date, scheduled_date, duration_minutes, distance_km)
    values (a, date '2026-11-19', date '2026-11-03', 30, 2);
    raise exception 'WALKING TEST FAILED: walk before the program accepted';
  exception when check_violation then
    if sqlerrm <> 'not_a_program_walk' then raise; end if;
  end;
  -- … and never logged before that program week starts.
  begin
    insert into public.walking_activities (user_id, activity_date, scheduled_date, duration_minutes, distance_km)
    values (a, date '2026-11-13', date '2026-11-17', 30, 2);
    raise exception 'WALKING TEST FAILED: walk logged before its week';
  exception when check_violation then null;
  end;
  -- Saturday 21 (same week, still ahead) may be done early on Thursday.
  insert into public.walking_activities (user_id, activity_date, scheduled_date, duration_minutes, distance_km)
  values (a, date '2026-11-19', date '2026-11-21', 31, 2.6);

  -- Distance is required; steps must be positive.
  begin
    insert into public.walking_activities (user_id, activity_date, duration_minutes) values (a, date '2026-11-19', 30);
    raise exception 'WALKING TEST FAILED: walk without distance accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.walking_activities (user_id, activity_date, duration_minutes, distance_km, steps)
    values (a, date '2026-11-19', 30, 2, 0);
    raise exception 'WALKING TEST FAILED: zero steps accepted';
  exception when check_violation then null;
  end;

  -- Editing updates the same row (history kept: same id, created_at; updated_at moves).
  update public.walking_activities set duration_minutes = 32, notes = 'evening' where id = tue;
  if not exists (select 1 from public.walking_activities where id = tue and duration_minutes = 32 and created_at = created
                 and scheduled_date = date '2026-11-17') then
    raise exception 'WALKING TEST FAILED: edit did not keep the walk';
  end if;
  -- Moving an additional walk onto an already-logged scheduled walk is refused.
  begin
    update public.walking_activities set scheduled_date = date '2026-11-17' where id = extra;
    raise exception 'WALKING TEST FAILED: edit created a duplicate scheduled walk';
  exception when unique_violation then null;
  end;
  -- An edit can't move a walk into the future.
  begin
    update public.walking_activities set activity_date = date '2026-11-25' where id = extra;
    raise exception 'WALKING TEST FAILED: edit moved a walk into the future';
  exception when check_violation then null;
  end;

  -- Deleting frees the scheduled walk again.
  delete from public.walking_activities where id = tue;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'WALKING TEST FAILED: could not delete own walk'; end if;
  insert into public.walking_activities (user_id, activity_date, scheduled_date, duration_minutes, distance_km)
  values (a, date '2026-11-19', date '2026-11-17', 25, 2.0);

  select count(*) into n from public.walking_activities;
  if n <> 4 then raise exception 'WALKING TEST FAILED: expected 4 walks, found %', n; end if;
end;
$$;

-- ----------------------------------------------------------------------------- B
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);

do $$
declare
  b constant uuid := '00000000-0000-4000-8000-0000000000c2';
  n int;
begin
  if (select count(*) from public.walking_activities) <> 0 then
    raise exception 'WALKING TEST FAILED: B can see A''s walks';
  end if;
  update public.walking_activities set notes = 'hacked';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'WALKING TEST FAILED: B changed A''s walk'; end if;
  delete from public.walking_activities;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'WALKING TEST FAILED: B deleted A''s walk'; end if;
  -- B logs the same scheduled date independently (uniqueness is per user).
  insert into public.walking_activities (user_id, activity_date, scheduled_date, duration_minutes, distance_km)
  values (b, date '2026-11-17', date '2026-11-17', 20, 1.6);
  -- B can't log a walk for A.
  begin
    insert into public.walking_activities (user_id, activity_date, duration_minutes, distance_km)
    values ('00000000-0000-4000-8000-0000000000c1', date '2026-11-19', 10, 1);
    raise exception 'WALKING TEST FAILED: B logged a walk for A';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;

select 'ALL WALKING TESTS PASSED (changes rolled back)' as result;

rollback;
