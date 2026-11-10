-- =============================================================================
-- RECOMP · Measurements & progress photos test (Phase 7)
-- -----------------------------------------------------------------------------
-- Run AFTER all migrations (1–12), in Supabase → SQL Editor. Everything (test
-- users, rows, storage objects, a temporarily fixed "today") is ROLLED BACK.
-- Success = a row "ALL PROGRESS TESTS PASSED (changes rolled back)".
-- (Storage objects are inserted directly as rows to test the policies; the
-- real upload / signed URL flow can only be verified in the app.)
-- =============================================================================

begin;

create or replace function public.recomp_today() returns date
language sql stable set search_path = '' as $$ select date '2026-12-10' $$;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'progress-test-a@example.invalid'),
  ('00000000-0000-4000-8000-0000000000e2', 'progress-test-b@example.invalid');

-- B owns a photo object + row (written as owner) so cross-user checks are meaningful.
insert into storage.objects (bucket_id, name)
values ('progress-photos', '00000000-0000-4000-8000-0000000000e2/week-1/front-1.jpg');
insert into public.progress_photos (id, user_id, week_number, photo_type, storage_path, content_type, size_bytes, taken_on)
values ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000e2', 1, 'front',
        '00000000-0000-4000-8000-0000000000e2/week-1/front-1.jpg', 'image/jpeg', 120000, date '2026-11-10');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);

do $$
declare
  a constant uuid := '00000000-0000-4000-8000-0000000000e1';
  w1 uuid; w4 uuid; created timestamptz; n int;
begin
  -- Creation: required fields only; optional fields stay NULL.
  insert into public.body_measurements (user_id, week_number, recorded_on, weight_kg, body_fat_pct)
  values (a, 1, date '2026-11-10', 53.9, 32.4) returning id, created_at into w1, created;
  if exists (select 1 from public.body_measurements where id = w1
             and (skeletal_muscle_kg is not null or waist_cm is not null or visceral_fat is not null)) then
    raise exception 'PROGRESS TEST FAILED: optional fields got default values';
  end if;

  -- Late week-4 check-in (recorded in week 5) keeps its week; the real date is separate.
  insert into public.body_measurements (user_id, week_number, recorded_on, weight_kg, body_fat_pct, waist_cm)
  values (a, 4, date '2026-12-09', 54.2, 31.6, 78.5) returning id into w4;

  -- Validation in the database.
  begin
    insert into public.body_measurements (user_id, week_number, recorded_on, body_fat_pct) values (a, 8, date '2026-12-09', 30);
    raise exception 'PROGRESS TEST FAILED: measurement without weight accepted';
  exception when check_violation then null; end;
  begin
    insert into public.body_measurements (user_id, week_number, recorded_on, weight_kg, body_fat_pct) values (a, 8, date '2026-12-11', 54, 30);
    raise exception 'PROGRESS TEST FAILED: future measurement accepted';
  exception when check_violation then if sqlerrm <> 'measurement_in_future' then raise; end if; end;
  begin
    insert into public.body_measurements (user_id, week_number, recorded_on, weight_kg, body_fat_pct) values (a, 8, date '2026-12-09', 54, 101);
    raise exception 'PROGRESS TEST FAILED: body fat 101%% accepted';
  exception when check_violation then null; end;
  begin
    insert into public.body_measurements (user_id, week_number, recorded_on, weight_kg, body_fat_pct, waist_cm) values (a, 8, date '2026-12-09', 54, 30, -5);
    raise exception 'PROGRESS TEST FAILED: negative waist accepted';
  exception when check_violation then null; end;
  begin
    insert into public.body_measurements (user_id, week_number, recorded_on, weight_kg, body_fat_pct) values (a, 4, date '2026-12-09', 54, 30);
    raise exception 'PROGRESS TEST FAILED: second measurement for week 4 accepted';
  exception when unique_violation then null; end;

  -- Editing updates in place (same id and created_at).
  update public.body_measurements set waist_cm = 78.0, notes = 'same tape' where id = w4;
  if not exists (select 1 from public.body_measurements where id = w4 and waist_cm = 78.0 and week_number = 4) then
    raise exception 'PROGRESS TEST FAILED: edit not saved';
  end if;
  update public.body_measurements set notes = 'edited' where id = w1;
  if (select created_at from public.body_measurements where id = w1) <> created then
    raise exception 'PROGRESS TEST FAILED: edit replaced the row';
  end if;

  -- Deleting.
  delete from public.body_measurements where id = w4;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROGRESS TEST FAILED: could not delete own measurement'; end if;

  -- Photos: metadata must point into the owner's folder, one per week + type, no future date.
  insert into storage.objects (bucket_id, name) values ('progress-photos', '00000000-0000-4000-8000-0000000000e1/week-1/front-10.jpg');
  insert into public.progress_photos (user_id, week_number, photo_type, storage_path, content_type, size_bytes, taken_on)
  values (a, 1, 'front', '00000000-0000-4000-8000-0000000000e1/week-1/front-10.jpg', 'image/jpeg', 250000, date '2026-11-10');
  begin
    insert into public.progress_photos (user_id, week_number, photo_type, storage_path, content_type, size_bytes)
    values (a, 1, 'front', '00000000-0000-4000-8000-0000000000e1/week-1/front-11.jpg', 'image/jpeg', 250000);
    raise exception 'PROGRESS TEST FAILED: two week-1 front photos';
  exception when unique_violation then null; end;
  begin
    insert into public.progress_photos (user_id, week_number, photo_type, storage_path, content_type, size_bytes)
    values (a, 4, 'front', '00000000-0000-4000-8000-0000000000e2/week-4/front-12.jpg', 'image/jpeg', 250000);
    raise exception 'PROGRESS TEST FAILED: photo row pointing into another user''s folder';
  exception when check_violation then null; end;
  begin
    insert into public.progress_photos (user_id, week_number, photo_type, storage_path, content_type, size_bytes)
    values (a, 4, 'side', '00000000-0000-4000-8000-0000000000e1/week-4/side-13.gif', 'image/gif', 250000);
    raise exception 'PROGRESS TEST FAILED: GIF accepted';
  exception when check_violation then null; end;
  begin
    insert into public.progress_photos (user_id, week_number, photo_type, storage_path, content_type, size_bytes)
    values (a, 4, 'side', '00000000-0000-4000-8000-0000000000e1/week-4/side-14.jpg', 'image/jpeg', 6000000);
    raise exception 'PROGRESS TEST FAILED: photo over 5 MB accepted';
  exception when check_violation then null; end;
  begin
    insert into public.progress_photos (user_id, week_number, photo_type, storage_path, content_type, size_bytes, taken_on)
    values (a, 4, 'side', '00000000-0000-4000-8000-0000000000e1/week-4/side-15.jpg', 'image/jpeg', 250000, date '2026-12-11');
    raise exception 'PROGRESS TEST FAILED: future photo date accepted';
  exception when check_violation then if sqlerrm <> 'photo_in_future' then raise; end if; end;

  -- Cross-user: A sees neither B's photo rows nor B's files, and can't delete them.
  if exists (select 1 from public.progress_photos where user_id <> a)
     or exists (select 1 from storage.objects where name like '00000000-0000-4000-8000-0000000000e2/%') then
    raise exception 'PROGRESS TEST FAILED: A can see B''s photos';
  end if;
  -- Hosted Supabase blocks every direct SQL delete on storage.objects
  -- (storage.protect_delete → 42501, "Use the Storage API"); elsewhere the
  -- delete policy hides B's file (0 rows). Either way B's file survives —
  -- verified again at the end of this script.
  begin
    delete from storage.objects where name = '00000000-0000-4000-8000-0000000000e2/week-1/front-1.jpg';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'PROGRESS TEST FAILED: A deleted B''s photo file'; end if;
  exception when insufficient_privilege then null;
  end;
  delete from public.progress_photos where id = '00000000-0000-4000-8000-0000000000f2';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'PROGRESS TEST FAILED: A deleted B''s photo row'; end if;

  -- Photo deletion (file first, then row) works for the owner. On hosted
  -- Supabase file deletion is only possible through the Storage API (the app
  -- uses storage.remove()), so the SQL file delete is skipped there.
  begin
    delete from storage.objects where name = '00000000-0000-4000-8000-0000000000e1/week-1/front-10.jpg';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'PROGRESS TEST FAILED: A could not delete own photo file'; end if;
  exception when insufficient_privilege then
    if sqlerrm not like 'Direct deletion from storage tables is not allowed%' then raise; end if;
  end;
  delete from public.progress_photos where user_id = a and week_number = 1 and photo_type = 'front';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'PROGRESS TEST FAILED: A could not delete own photo row'; end if;

  -- A can't read B's measurements or create one for B.
  begin
    insert into public.body_measurements (user_id, week_number, recorded_on, weight_kg, body_fat_pct)
    values ('00000000-0000-4000-8000-0000000000e2', 1, date '2026-11-10', 60, 30);
    raise exception 'PROGRESS TEST FAILED: A created a measurement for B';
  exception when insufficient_privilege then null; end;
end;
$$;

reset role;

-- B's file and row are untouched.
do $$
begin
  if not exists (select 1 from storage.objects where name = '00000000-0000-4000-8000-0000000000e2/week-1/front-1.jpg')
     or not exists (select 1 from public.progress_photos where id = '00000000-0000-4000-8000-0000000000f2') then
    raise exception 'PROGRESS TEST FAILED: B''s photo was changed by A';
  end if;
end;
$$;

select 'ALL PROGRESS TESTS PASSED (changes rolled back)' as result;

rollback;
