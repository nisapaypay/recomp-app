"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayIn, type IsoDate } from "@/lib/program/calendar";
import { METRICS, validateMeasurement, type MeasurementErrors, type MetricKey } from "@/lib/measurements/measurements";
import {
  PHOTO_WEEKS,
  PROGRESS_PHOTOS_BUCKET,
  buildPhotoPath,
  isOwnPhotoPath,
  isPhotoType,
  validatePhotoFile,
  validateTakenOn,
  weekFolder,
} from "@/lib/storage/progress-photos";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";

/**
 * Measurement and progress-photo mutations. Every action uses the signed-in
 * user's session (RLS + Storage policies apply), re-validates input with the
 * shared rules, and filters by user_id. No secret key is used.
 */

const UUID = /^[0-9a-f-]{36}$/i;

function revalidateProgress() {
  revalidatePath("/progress", "layout");
  revalidatePath("/dashboard");
}

async function latestProgramStart(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string) {
  const { data } = await supabase
    .from("user_programs")
    .select("start_date")
    .eq("user_id", userId)
    .in("status", ["active", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.start_date as IsoDate | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// Measurements
// ---------------------------------------------------------------------------

export type MeasurementFormState = { errors?: MeasurementErrors; error?: string };

/** Create (no id) or edit (id) a measurement. Editing updates the row in place. */
export async function saveMeasurement(_prev: MeasurementFormState, formData: FormData): Promise<MeasurementFormState> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "");
  if (id && !UUID.test(id)) return { error: "Invalid measurement." };

  const [programStart, taken] = await Promise.all([
    latestProgramStart(supabase, user.id),
    supabase.from("body_measurements").select("id,week_number").eq("user_id", user.id),
  ]);
  if (taken.error) return { error: "Could not load your measurements. Try again." };
  const editing = id ? taken.data.find((r) => r.id === id) : undefined;
  if (id && !editing) return { error: "This measurement no longer exists." };

  const field = (k: string) => String(formData.get(k) ?? "");
  const result = validateMeasurement(
    {
      ...(Object.fromEntries(METRICS.map((m) => [m.key, field(m.key)])) as Record<MetricKey, string>),
      recordedOn: field("recordedOn"),
      weekNumber: field("weekNumber"),
      notes: field("notes"),
    },
    {
      today: todayIn(),
      programStart,
      takenWeeks: new Set(taken.data.filter((r) => r.id !== id).map((r) => r.week_number as number)),
      editingWeek: (editing?.week_number as number | undefined) ?? null,
    },
  );
  if (!result.ok) return { errors: result.errors };

  const v = result.value;
  const row = {
    week_number: v.weekNumber,
    recorded_on: v.recordedOn,
    notes: v.notes,
    ...Object.fromEntries(METRICS.map((m) => [m.column, v[m.key]])),
  };
  const { data, error } = id
    ? await supabase.from("body_measurements").update(row).eq("id", id).eq("user_id", user.id).select("id").maybeSingle()
    : await supabase.from("body_measurements").insert({ ...row, user_id: user.id }).select("id").single();
  if (error) {
    if (error.code === "23505") return { errors: { weekNumber: `Week ${v.weekNumber} already has a measurement — edit that one instead.` } };
    if (error.message.includes("measurement_in_future")) return { errors: { recordedOn: "The date can't be in the future." } };
    if (error.code === "23514") return { error: "A value is outside the allowed range. Check the numbers and try again." };
    return { error: "Could not save the measurement. Try again." };
  }
  if (!data) return { error: "This measurement no longer exists." };
  revalidateProgress();
  redirect(id ? `/progress/measurements/${id}?saved=1` : `/progress/measurements?saved=${data.id as string}`);
}

export async function deleteMeasurement(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!UUID.test(id)) return { ok: false, error: "Invalid measurement." };
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase.from("body_measurements").delete({ count: "exact" }).eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not delete the measurement. Try again." };
  if (count === 0) return { ok: false, error: "This measurement no longer exists." };
  revalidateProgress();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Photos: prepare → (browser uploads to a signed upload URL) → finalize
// ---------------------------------------------------------------------------

export type PreparedUpload = { ok: true; path: string; signedUrl: string } | { ok: false; error: string };

/** Validate the photo and return a one-time signed upload URL inside the user's own folder. */
export async function preparePhotoUpload(input: {
  weekNumber: number;
  photoType: string;
  mimeType: string;
  size: number;
}): Promise<PreparedUpload> {
  const user = await requireUser();
  if (!(PHOTO_WEEKS as readonly number[]).includes(input.weekNumber)) return { ok: false, error: "Choose check-in week 1, 4, 8 or 12." };
  if (!isPhotoType(input.photoType)) return { ok: false, error: "Choose front, side or back." };
  const file = validatePhotoFile({ type: input.mimeType, size: input.size });
  if (!file.ok) return { ok: false, error: file.error };

  const path = buildPhotoPath(user.id, input.weekNumber, input.photoType, file.mimeType);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(PROGRESS_PHOTOS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Could not start the upload. Try again." };
  return { ok: true, path, signedUrl: data.signedUrl };
}

/**
 * Record an uploaded photo. Replaces the previous photo of the same week and
 * type (its file is removed after the row points to the new one) and removes
 * leftover files of that week that no row references (e.g. abandoned uploads).
 */
export async function finalizePhotoUpload(input: {
  path: string;
  weekNumber: number;
  photoType: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  takenOn: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const bucket = supabase.storage.from(PROGRESS_PHOTOS_BUCKET);
  const removeUploaded = () => bucket.remove([input.path]).catch(() => null);

  if (!isOwnPhotoPath(user.id, input.path) || !input.path.startsWith(`${weekFolder(user.id, input.weekNumber)}/${input.photoType}-`)) {
    return { ok: false, error: "Invalid upload." };
  }
  const file = validatePhotoFile({ type: input.mimeType, size: input.size });
  const date = validateTakenOn(input.takenOn, todayIn());
  if (!file.ok || !isPhotoType(input.photoType) || !date.ok) {
    await removeUploaded();
    return { ok: false, error: !file.ok ? file.error : !date.ok ? date.error : "Invalid photo." };
  }

  // The object must really exist (uploaded by this user).
  const folder = weekFolder(user.id, input.weekNumber);
  const name = input.path.slice(folder.length + 1);
  const listed = await bucket.list(folder, { search: name, limit: 10 });
  if (listed.error || !listed.data?.some((o) => o.name === name)) return { ok: false, error: "The upload didn't finish. Try again." };

  const existing = await supabase
    .from("progress_photos")
    .select("id,storage_path")
    .eq("user_id", user.id)
    .eq("week_number", input.weekNumber)
    .eq("photo_type", input.photoType)
    .maybeSingle();
  if (existing.error) {
    await removeUploaded();
    return { ok: false, error: "Could not save the photo. Try again." };
  }

  const row = {
    storage_path: input.path,
    content_type: input.mimeType,
    size_bytes: input.size,
    width_px: input.width,
    height_px: input.height,
    taken_on: input.takenOn,
    uploaded_at: new Date().toISOString(),
  };
  const saved = existing.data
    ? await supabase.from("progress_photos").update(row).eq("id", existing.data.id).eq("user_id", user.id)
    : await supabase.from("progress_photos").insert({ ...row, user_id: user.id, week_number: input.weekNumber, photo_type: input.photoType });
  if (saved.error) {
    await removeUploaded(); // never leave an unreferenced file behind
    return { ok: false, error: saved.error.message.includes("photo_in_future") ? "The photo date can't be in the future." : "Could not save the photo. Try again." };
  }

  // Clean up: old file of a replaced photo + any unreferenced files in this week folder.
  const refs = await supabase.from("progress_photos").select("storage_path").eq("user_id", user.id).eq("week_number", input.weekNumber);
  const all = await bucket.list(folder, { limit: 100 });
  if (!refs.error && !all.error) {
    const keep = new Set((refs.data ?? []).map((r) => r.storage_path as string));
    const stale = (all.data ?? []).map((o) => `${folder}/${o.name}`).filter((p) => !keep.has(p));
    if (stale.length > 0) await bucket.remove(stale).catch(() => null);
  }

  revalidateProgress();
  return { ok: true };
}

/** Delete a photo: the file first, then its row (so a failure never leaves an orphaned file). */
export async function deletePhoto(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!UUID.test(id)) return { ok: false, error: "Invalid photo." };
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: photo, error } = await supabase.from("progress_photos").select("id,storage_path").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) return { ok: false, error: "Could not delete the photo. Try again." };
  if (!photo) return { ok: false, error: "This photo no longer exists." };
  const path = photo.storage_path as string;
  if (!isOwnPhotoPath(user.id, path)) return { ok: false, error: "Invalid photo." };

  const removed = await supabase.storage.from(PROGRESS_PHOTOS_BUCKET).remove([path]);
  if (removed.error) return { ok: false, error: "Could not delete the photo file. Nothing was changed — try again." };
  const del = await supabase.from("progress_photos").delete().eq("id", id).eq("user_id", user.id);
  if (del.error) return { ok: false, error: "The file was removed but the record couldn't be. Try deleting again." };
  revalidateProgress();
  return { ok: true };
}
