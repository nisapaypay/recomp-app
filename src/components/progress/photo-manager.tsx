"use client";

import { Camera, ImageOff, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { inputClasses } from "@/components/ui/field";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { IsoDate } from "@/lib/program/calendar";
import { formatDate } from "@/lib/program/format";
import {
  MAX_PHOTO_BYTES,
  PHOTO_TYPES,
  PHOTO_WEEKS,
  fitWithin,
  validatePhotoFile,
  validateTakenOn,
  type PhotoType,
} from "@/lib/storage/progress-photos";
import { finalizePhotoUpload, preparePhotoUpload } from "@/server/actions/progress";
import type { Photo } from "@/server/progress/queries";
import { DeletePhotoButton } from "./delete-buttons";

const TYPE_LABEL: Record<PhotoType, string> = { front: "Front", side: "Side", back: "Back" };

type Slot = { week: number; type: PhotoType };
type UploadState = { slot: Slot; phase: "processing" | "uploading" | "saving"; percent: number } | null;

/**
 * Resize to ≤ 2000 px and re-encode as JPEG in the browser. Re-encoding also
 * drops EXIF metadata (e.g. GPS location). Falls back to the original file if
 * the browser can't decode it.
 */
async function prepareImage(file: File): Promise<{ blob: Blob; type: string; width: number | null; height: number | null }> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, 2000);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    for (const quality of [0.86, 0.75, 0.6]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_PHOTO_BYTES) return { blob, type: "image/jpeg", width, height };
    }
    throw new Error("too large");
  } catch {
    return { blob: file, type: file.type, width: null, height: null };
  }
}

/** PUT to the one-time signed upload URL with progress events (no secret key involved). */
function uploadWithProgress(url: string, blob: Blob, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", blob);
    xhr.send(body);
  });
}

export function PhotoManager({ photos, today, suggestedWeek }: { photos: Photo[]; today: IsoDate; suggestedWeek: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<Slot | null>(null);
  const [takenOn, setTakenOn] = useState<string>(today);
  const [upload, setUpload] = useState<UploadState>(null);
  const [error, setError] = useState<string | null>(null);
  const [week, setWeek] = useState<number>(suggestedWeek);

  function pick(slot: Slot) {
    setError(null);
    setTarget(slot);
    input.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !target) return;
    const date = validateTakenOn(takenOn, today);
    if (!date.ok) return setError(date.error);
    const original = validatePhotoFile(file);
    // HEIC etc. may still be decodable by the browser and re-encoded to JPEG below.
    const slot = target;
    try {
      setUpload({ slot, phase: "processing", percent: 0 });
      const img = await prepareImage(file);
      const checked = validatePhotoFile({ type: img.type, size: img.blob.size });
      if (!checked.ok) throw new Error(original.ok ? checked.error : original.error);

      const prepared = await preparePhotoUpload({ weekNumber: slot.week, photoType: slot.type, mimeType: img.type, size: img.blob.size });
      if (!prepared.ok) throw new Error(prepared.error);
      setUpload({ slot, phase: "uploading", percent: 0 });
      await uploadWithProgress(prepared.signedUrl, img.blob, (percent) => setUpload({ slot, phase: "uploading", percent }));

      setUpload({ slot, phase: "saving", percent: 100 });
      const saved = await finalizePhotoUpload({
        path: prepared.path,
        weekNumber: slot.week,
        photoType: slot.type,
        mimeType: img.type,
        size: img.blob.size,
        width: img.width,
        height: img.height,
        takenOn,
      });
      if (!saved.ok) throw new Error(saved.error ?? "Could not save the photo.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setUpload(null);
    }
  }

  const byKey = new Map(photos.map((p) => [`${p.weekNumber}-${p.photoType}`, p]));

  return (
    <div className="space-y-4">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={onFile} tabIndex={-1} aria-hidden />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-ink-soft" id="week-label">Check-in</span>
          <div className="flex gap-1.5" role="group" aria-labelledby="week-label">
            {PHOTO_WEEKS.map((w) => (
              <button key={w} type="button" onClick={() => setWeek(w)} aria-pressed={week === w}
                className={week === w
                  ? "h-11 rounded-chip bg-accent-600 px-4 text-sm font-semibold text-white"
                  : "h-11 rounded-chip border border-line bg-surface px-4 text-sm font-medium text-ink-soft hover:bg-surface-muted"}>
                Week {w}
              </button>
            ))}
          </div>
        </div>
        <label className="space-y-1.5">
          <span className="block text-sm font-medium text-ink-soft">Photo taken on</span>
          <input type="date" max={today} value={takenOn} onChange={(e) => setTakenOn(e.target.value)} className={`${inputClasses} w-44`} />
        </label>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <ul className="grid grid-cols-3 gap-3">
        {PHOTO_TYPES.map((type) => {
          const photo = byKey.get(`${week}-${type}`);
          const busy = upload && upload.slot.week === week && upload.slot.type === type ? upload : null;
          return (
            <li key={type} className="space-y-1.5">
              <div className="relative aspect-[3/4] overflow-hidden rounded-card border border-line bg-surface-muted">
                {photo?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
                  <img src={photo.url} alt={`Week ${week} ${type} photo, taken ${formatDate(photo.takenOn, "long")}`} className="size-full object-cover" />
                ) : photo ? (
                  <div className="grid size-full place-items-center p-3 text-center text-caption text-ink-muted">
                    <span><ImageOff aria-hidden className="mx-auto mb-1 size-5" />Couldn&apos;t load — refresh the page</span>
                  </div>
                ) : (
                  <button type="button" onClick={() => pick({ week, type })} disabled={upload !== null}
                    className="grid size-full place-items-center text-center text-sm text-ink-muted hover:bg-accent-50 hover:text-accent-700 disabled:opacity-60">
                    <span>
                      <Camera aria-hidden className="mx-auto mb-1.5 size-6" />
                      Add {TYPE_LABEL[type].toLowerCase()}
                    </span>
                  </button>
                )}
                {busy ? (
                  <div className="absolute inset-0 grid place-items-center bg-surface/85 p-3" role="status">
                    <div className="w-full space-y-2 text-center text-caption text-ink-soft">
                      <p>{busy.phase === "processing" ? "Preparing…" : busy.phase === "uploading" ? `Uploading ${busy.percent}%` : "Saving…"}</p>
                      <ProgressBar label="Upload progress" value={busy.percent} max={100} />
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex min-h-11 items-center justify-between gap-1">
                <p className="text-caption text-ink-muted">
                  <span className="font-medium text-ink">{TYPE_LABEL[type]}</span>
                  {photo ? <><br />{formatDate(photo.takenOn, "medium")}</> : null}
                </p>
                {photo ? (
                  <span className="flex items-center">
                    <button type="button" onClick={() => pick({ week, type })} disabled={upload !== null}
                      className="grid size-11 place-items-center rounded-control text-ink-muted hover:bg-surface-muted" aria-label={`Replace week ${week} ${type} photo`}>
                      <Upload aria-hidden className="size-4" />
                    </button>
                    <DeletePhotoButton id={photo.id} label={`the week ${week} ${type} photo`} />
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-caption text-ink-muted">
        JPEG, PNG or WebP, up to 5 MB. Photos are resized and saved privately — only you can see them, through
        links that expire after a few minutes. Same light, distance and pose each time makes comparisons fair.
      </p>
    </div>
  );
}
