-- =============================================================================
-- RECOMP · Migration 3/5 · Private Storage bucket for progress photos
-- -----------------------------------------------------------------------------
-- * Bucket `progress-photos` is PRIVATE (no public URLs). Files are served
--   only through short-lived signed URLs created for the signed-in owner.
-- * Bucket-level limits: 5 MB per file, JPEG / PNG / WebP only.
--   (The app also compresses and validates before upload.)
-- * Object path convention: <auth.uid()>/week-<n>/<front|side|back>-<timestamp>.<ext>
--   The first folder MUST equal the uploader's user id; policies enforce this.
-- =============================================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'progress-photos',
  'progress-photos',
  false,
  5242880,                                            -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Owner-only access, scoped to this bucket and the user's own top-level folder.
create policy "progress-photos: select own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "progress-photos: insert own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "progress-photos: update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "progress-photos: delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
