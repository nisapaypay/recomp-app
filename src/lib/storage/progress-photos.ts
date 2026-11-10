/**
 * Progress-photo rules shared by client (pre-upload checks) and server.
 * Mirrors the bucket limits set in migration 20261110120200 and the
 * progress_photos table constraints. Keep these in sync.
 *
 * No path-alias imports here so the module can be unit-tested with plain Node.
 */

export const PROGRESS_PHOTOS_BUCKET = "progress-photos";

export const PHOTO_TYPES = ["front", "side", "back"] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

export const ALLOWED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoMimeType = (typeof ALLOWED_PHOTO_MIME_TYPES)[number];

/** Hard limit enforced by the bucket and the DB (after client-side compression). */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Signed URLs are short-lived; regenerate on each view. */
export const SIGNED_URL_TTL_SECONDS = 60 * 5;

const EXTENSION: Record<PhotoMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type PhotoValidation =
  | { ok: true; mimeType: PhotoMimeType }
  | { ok: false; error: string };

export function isPhotoType(value: unknown): value is PhotoType {
  return typeof value === "string" && (PHOTO_TYPES as readonly string[]).includes(value);
}

export function validatePhotoFile(file: { type: string; size: number }): PhotoValidation {
  if (!(ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG or WebP image." };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, error: "The file is empty." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "The photo is larger than 5 MB." };
  }
  return { ok: true, mimeType: file.type as PhotoMimeType };
}

/**
 * Object path inside the bucket: "<userId>/week-<n>/<type>-<timestamp>.<ext>".
 * The first folder must be the owner's id — Storage RLS policies rely on it.
 * A timestamp makes replacements new objects (no stale CDN cache).
 */
export function buildPhotoPath(
  userId: string,
  weekNumber: number,
  photoType: PhotoType,
  mimeType: PhotoMimeType,
  now: Date = new Date(),
): string {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Invalid user id");
  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 12) {
    throw new Error("Week must be between 1 and 12");
  }
  if (!isPhotoType(photoType)) throw new Error("Invalid photo type");
  return `${userId}/week-${weekNumber}/${photoType}-${now.getTime()}.${EXTENSION[mimeType]}`;
}

/** True when a storage path belongs to the given user. */
export function isOwnPhotoPath(userId: string, path: string): boolean {
  return path.startsWith(`${userId}/`) && !path.includes("..");
}

// ---------------------------------------------------------------------------
// Phase 7: check-in weeks, comparison, resizing, dates
// ---------------------------------------------------------------------------

/** Photos are taken at the official check-ins. */
export const PHOTO_WEEKS = [1, 4, 8, 12] as const;

/** Allowed comparisons: always against the Week 1 baseline. */
export const COMPARISONS = [
  [1, 4],
  [1, 8],
  [1, 12],
] as const;

export type PhotoMeta = { id: string; weekNumber: number; photoType: PhotoType; takenOn: string; storagePath: string };

/** Both photos of a comparison, or null where one is missing — never a stand-in. */
export function comparisonPair<T extends PhotoMeta>(
  photos: T[],
  photoType: PhotoType,
  laterWeek: number,
): { before: T | null; after: T | null } {
  const find = (week: number) => photos.find((p) => p.weekNumber === week && p.photoType === photoType) ?? null;
  return { before: find(1), after: find(laterWeek) };
}

/** Scale (width, height) down to fit within `max` px on the long side, keeping the aspect ratio. */
export function fitWithin(width: number, height: number, max = 2000): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) throw new Error("Invalid image size");
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Photo date: valid ISO date, not in the future (`today` in Asia/Jakarta). */
export function validateTakenOn(date: string, today: string): { ok: true } | { ok: false; error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return { ok: false, error: "Choose a valid date." };
  }
  if (date > today) return { ok: false, error: "The photo date can't be in the future." };
  return { ok: true };
}

/** Week folder prefix used to find leftover files: "<userId>/week-<n>". */
export function weekFolder(userId: string, weekNumber: number): string {
  return `${userId}/week-${weekNumber}`;
}
