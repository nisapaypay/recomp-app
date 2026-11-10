-- =============================================================================
-- RECOMP · RLS & cross-user isolation test
-- -----------------------------------------------------------------------------
-- Run AFTER migrations 1–5, in Supabase Dashboard → SQL Editor.
-- Everything runs inside one transaction and is ROLLED BACK at the end:
-- the two test users and their rows are never saved.
--
-- Result:
--   * No error  → every check passed (the last query prints a PASS row).
--   * Error "RLS TEST FAILED: …" → the message says which rule was broken.
-- =============================================================================

begin;

-- Fixed ids for two throwaway users (A = "me", B = "someone else").
-- 00000000-0000-4000-8000-00000000000a / …0b

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'rls-test-a@example.invalid'),
  ('00000000-0000-4000-8000-00000000000b', 'rls-test-b@example.invalid');

-- Data owned by B, written as the database owner (bypasses RLS on purpose).
insert into public.user_programs (id, user_id, start_date)
values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000000b', date '2026-11-09');

insert into public.workout_sessions (id, user_id, program_id, scheduled_date, week_number, day_of_week, activity_type)
values ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-00000000000b',
        '00000000-0000-4000-8000-0000000000b1', date '2026-11-09', 1, 1, 'lower_body');

insert into public.walking_activities (id, user_id, activity_date, duration_minutes, distance_km)
values ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-00000000000b', date '2026-11-10', 20, 1.5);

insert into public.body_measurements (user_id, week_number, weight_kg, body_fat_pct, waist_cm)
values ('00000000-0000-4000-8000-00000000000b', 1, 60, 30, 80);

-- -----------------------------------------------------------------------------
-- 0. Structure: RLS enabled on every public table; auth trigger made 1:1 rows.
-- -----------------------------------------------------------------------------
do $$
declare
  missing text;
begin
  select string_agg(c.relname, ', ') into missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if missing is not null then
    raise exception 'RLS TEST FAILED: RLS disabled on: %', missing;
  end if;

  if (select count(*) from public.profiles
      where user_id in ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b')) <> 2 then
    raise exception 'RLS TEST FAILED: auth trigger did not create profiles';
  end if;
  if (select count(*) from public.reminder_settings
      where user_id in ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b')) <> 2 then
    raise exception 'RLS TEST FAILED: auth trigger did not create reminder_settings';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Anonymous visitors can read nothing.
-- -----------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'walking_activities', 'workout_sessions',
                           'body_measurements', 'exercise_library', 'program_exercises'] loop
    begin
      execute format('select count(*) from public.%I', t);
      raise exception 'RLS TEST FAILED: anon could read %', t;
    exception when insufficient_privilege then
      null; -- expected
    end;
  end loop;
end;
$$;

reset role;

-- -----------------------------------------------------------------------------
-- 2. Signed in as A.
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

do $$
declare
  a constant uuid := '00000000-0000-4000-8000-00000000000a';
  b constant uuid := '00000000-0000-4000-8000-00000000000b';
  n int;
begin
  -- 2.1 Reference data is readable.
  if (select count(*) from public.exercise_library) = 0 then
    raise exception 'RLS TEST FAILED: authenticated cannot read exercise_library (or it is not seeded)';
  end if;
  if (select count(*) from public.program_exercises) <> 203 then
    raise exception 'RLS TEST FAILED: program_exercises not fully readable/seeded';
  end if;

  -- 2.2 Reference data is not writable.
  begin
    insert into public.exercise_library (id, name, category, equipment)
    values ('hack', 'Hack', 'core', 'bodyweight');
    raise exception 'RLS TEST FAILED: authenticated could insert into exercise_library';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.program_exercises set sets = 6;
    raise exception 'RLS TEST FAILED: authenticated could update program_exercises';
  exception when insufficient_privilege then null;
  end;

  -- 2.3 A sees only A's own rows.
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'RLS TEST FAILED: A sees % profiles (expected 1)', (select count(*) from public.profiles);
  end if;
  if exists (select 1 from public.profiles where user_id <> a) then
    raise exception 'RLS TEST FAILED: A can see another profile';
  end if;
  if (select count(*) from public.walking_activities) <> 0
     or (select count(*) from public.user_programs) <> 0
     or (select count(*) from public.workout_sessions) <> 0
     or (select count(*) from public.body_measurements) <> 0
     or (select count(*) from public.reminder_settings where user_id = b) <> 0 then
    raise exception 'RLS TEST FAILED: A can read B''s data';
  end if;

  -- 2.4 A cannot create rows for B.
  begin
    insert into public.walking_activities (user_id, activity_date, duration_minutes)
    values (b, current_date, 10);
    raise exception 'RLS TEST FAILED: A inserted a walk for B';
  exception when insufficient_privilege then null;
  end;

  -- 2.5 A cannot change or delete B's rows (they are invisible → 0 rows).
  update public.walking_activities set notes = 'hacked' where user_id = b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS TEST FAILED: A updated B''s walk'; end if;

  delete from public.body_measurements where user_id = b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS TEST FAILED: A deleted B''s measurement'; end if;

  update public.profiles set display_name = 'hacked' where user_id = b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS TEST FAILED: A updated B''s profile'; end if;

  -- 2.6 A can create, update and delete A's own rows.
  insert into public.user_programs (id, user_id, start_date)
  values ('00000000-0000-4000-8000-0000000000a1', a, date '2026-11-09');

  insert into public.walking_activities (id, user_id, activity_date, duration_minutes, distance_km)
  values ('00000000-0000-4000-8000-0000000000a3', a, current_date, 25, 2.1);

  update public.walking_activities set notes = 'evening walk'
  where id = '00000000-0000-4000-8000-0000000000a3';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'RLS TEST FAILED: A could not update own walk'; end if;

  update public.profiles set display_name = 'Test A' where user_id = a;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'RLS TEST FAILED: A could not update own profile'; end if;

  -- 2.7 A cannot hand an own row over to B.
  begin
    update public.walking_activities set user_id = b
    where id = '00000000-0000-4000-8000-0000000000a3';
    raise exception 'RLS TEST FAILED: A re-assigned a walk to B';
  exception when insufficient_privilege then null;
  end;

  -- 2.8 Composite FKs: A cannot attach rows to B's parents.
  begin
    insert into public.workout_sessions (user_id, program_id, scheduled_date, week_number, day_of_week, activity_type)
    values (a, '00000000-0000-4000-8000-0000000000b1', current_date, 1, 1, 'lower_body');
    raise exception 'RLS TEST FAILED: A created a session under B''s program';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.workout_feedback (user_id, session_id, difficulty)
    values (a, '00000000-0000-4000-8000-0000000000b2', 'too_easy');
    raise exception 'RLS TEST FAILED: A left feedback on B''s session';
  exception when foreign_key_violation then null;
  end;

  -- 2.9 Profiles cannot be inserted or deleted directly (trigger-managed).
  begin
    delete from public.profiles where user_id = a;
    raise exception 'RLS TEST FAILED: A could delete own profile row';
  exception when insufficient_privilege then null;
  end;

  -- 2.10 Data integrity rules.
  begin
    insert into public.user_programs (user_id, start_date, status)
    values (a, date '2026-11-10', 'abandoned');                      -- a Tuesday
    raise exception 'RLS TEST FAILED: program start_date accepted a non-Monday';
  exception when check_violation then null;
  end;

  begin
    insert into public.user_programs (user_id, start_date) values (a, date '2026-11-16');
    raise exception 'RLS TEST FAILED: two active programs allowed';
  exception when unique_violation then null;
  end;

  if (select end_date from public.user_programs where id = '00000000-0000-4000-8000-0000000000a1')
     <> date '2027-01-31' then
    raise exception 'RLS TEST FAILED: end_date is not start + 83 days';
  end if;

  -- 2.10b Program lifecycle: A can mark own program completed (done by the app
  --       after week 12), then start a new active one; B's program is untouched.
  update public.user_programs set status = 'completed'
  where id = '00000000-0000-4000-8000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'RLS TEST FAILED: A could not complete own program'; end if;

  insert into public.user_programs (user_id, start_date) values (a, date '2027-02-01');

  update public.user_programs set status = 'completed'
  where id = '00000000-0000-4000-8000-0000000000b1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS TEST FAILED: A changed B''s program status'; end if;

  -- 2.11 Own delete works.
  delete from public.walking_activities where id = '00000000-0000-4000-8000-0000000000a3';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'RLS TEST FAILED: A could not delete own walk'; end if;
end;
$$;

reset role;

-- -----------------------------------------------------------------------------
-- 3a. Storage bucket configuration — checked as the DATABASE OWNER.
--     On Supabase, storage.buckets has RLS enabled and no policies for
--     `authenticated`, so bucket rows are intentionally invisible to users.
--     Checking it as `authenticated` would always report "missing".
-- -----------------------------------------------------------------------------
do $$
declare
  bkt record;
begin
  select public, file_size_limit, allowed_mime_types into bkt
  from storage.buckets where id = 'progress-photos';

  if not found then
    raise exception 'RLS TEST FAILED: progress-photos bucket does not exist';
  end if;
  if bkt.public is distinct from false then
    raise exception 'RLS TEST FAILED: progress-photos bucket is public';
  end if;
  if bkt.file_size_limit is distinct from 5242880 then
    raise exception 'RLS TEST FAILED: progress-photos file_size_limit is % (expected 5242880)', bkt.file_size_limit;
  end if;
  if bkt.allowed_mime_types is null
     or not (bkt.allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']
             and bkt.allowed_mime_types <@ array['image/jpeg', 'image/png', 'image/webp']) then
    raise exception 'RLS TEST FAILED: progress-photos allowed_mime_types is % (expected jpeg/png/webp)',
      bkt.allowed_mime_types;
  end if;
end;
$$;

-- B already owns a photo object (written as owner), so the visibility check
-- below is meaningful. Rolled back with everything else.
insert into storage.objects (bucket_id, name)
values ('progress-photos', '00000000-0000-4000-8000-00000000000b/week-1/front-owner-b.webp');

-- -----------------------------------------------------------------------------
-- 3b. Storage policies — as A: own folder only.
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

do $$
begin
  -- A can write into A's own folder.
  insert into storage.objects (bucket_id, name)
  values ('progress-photos', '00000000-0000-4000-8000-00000000000a/week-1/front-test.webp');

  -- A cannot write into B's folder.
  begin
    insert into storage.objects (bucket_id, name)
    values ('progress-photos', '00000000-0000-4000-8000-00000000000b/week-1/front-test.webp');
    raise exception 'RLS TEST FAILED: A uploaded into B''s photo folder';
  exception when insufficient_privilege then null;
  end;

  -- A cannot write outside any user folder.
  begin
    insert into storage.objects (bucket_id, name)
    values ('progress-photos', 'loose-file.webp');
    raise exception 'RLS TEST FAILED: A uploaded outside a user folder';
  exception when insufficient_privilege then null;
  end;

  -- A sees A's object but not B's.
  if not exists (select 1 from storage.objects
                 where bucket_id = 'progress-photos'
                   and name = '00000000-0000-4000-8000-00000000000a/week-1/front-test.webp') then
    raise exception 'RLS TEST FAILED: A cannot read own photo object';
  end if;
  if exists (select 1 from storage.objects
             where bucket_id = 'progress-photos'
               and name like '00000000-0000-4000-8000-00000000000b/%') then
    raise exception 'RLS TEST FAILED: A can see B''s photos';
  end if;
end;
$$;

reset role;

select 'ALL RLS TESTS PASSED (changes rolled back)' as result;

rollback;
