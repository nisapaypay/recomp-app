import "server-only";

import {
  PROGRESS_PHOTOS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  isOwnPhotoPath,
} from "@/lib/storage/progress-photos";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";

/**
 * Creates short-lived signed URLs for the signed-in user's own photos.
 * Uses the user's session (not a secret key), so Storage RLS still applies;
 * paths outside the user's folder are rejected before calling Storage.
 * Public URLs are never used for progress photos.
 */
export async function createSignedPhotoUrls(
  paths: string[],
  expiresInSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<Record<string, string | null>> {
  const user = await requireUser();
  const ownPaths = paths.filter((path) => isOwnPhotoPath(user.id, path));
  const result: Record<string, string | null> = Object.fromEntries(paths.map((p) => [p, null]));
  if (ownPaths.length === 0) return result;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(PROGRESS_PHOTOS_BUCKET)
    .createSignedUrls(ownPaths, expiresInSeconds);
  if (error) throw new Error(`Could not create signed photo URLs: ${error.message}`);

  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) result[item.path] = item.signedUrl;
  }
  return result;
}
