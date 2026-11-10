"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/program/format";
import { COMPARISONS, PHOTO_TYPES, comparisonPair, type PhotoType } from "@/lib/storage/progress-photos";
import type { Photo } from "@/server/progress/queries";
import { cn } from "@/lib/utils/cn";

const TYPE_LABEL: Record<PhotoType, string> = { front: "Front", side: "Side", back: "Back" };

/** Week 1 vs Week 4 / 8 / 12, same type, same frame size. Missing photos show an empty state. */
export function PhotoCompare({ photos }: { photos: Photo[] }) {
  const [type, setType] = useState<PhotoType>("front");
  const [later, setLater] = useState<number>(4);
  const { before, after } = comparisonPair(photos, type, later);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <Segmented label="View" options={PHOTO_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))} value={type} onChange={(v) => setType(v as PhotoType)} />
        <Segmented label="Compare" options={COMPARISONS.map(([, w]) => ({ value: String(w), label: `Week 1 vs ${w}` }))} value={String(later)} onChange={(v) => setLater(Number(v))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Frame photo={before} week={1} type={type} />
        <Frame photo={after} week={later} type={type} />
      </div>
      {!before || !after ? (
        <p className="text-caption text-ink-muted">A comparison appears when both photos exist — nothing is substituted.</p>
      ) : null}
    </div>
  );
}

function Frame({ photo, week, type }: { photo: Photo | null; week: number; type: PhotoType }) {
  return (
    <figure className="space-y-1.5">
      <div className="aspect-[3/4] overflow-hidden rounded-card border border-line bg-surface-muted">
        {photo?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
          <img src={photo.url} alt={`Week ${week} ${type}, taken ${formatDate(photo.takenOn, "long")}`} className="size-full object-cover object-top" />
        ) : (
          <div className="grid size-full place-items-center p-4 text-center text-sm text-ink-muted">
            <span>
              <ImageOff aria-hidden className="mx-auto mb-1.5 size-5 text-ink-faint" />
              {photo ? "Couldn't load — refresh the page" : `No week ${week} ${type} photo yet`}
            </span>
          </div>
        )}
      </div>
      <figcaption className="text-caption text-ink-muted">
        <span className="font-semibold text-ink">Week {week}</span>
        {photo ? ` · ${formatDate(photo.takenOn, "medium")}` : ""}
      </figcaption>
    </figure>
  );
}

function Segmented({ label, options, value, onChange }: {
  label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-chip bg-surface-muted p-1">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
          className={cn("h-9 rounded-chip px-3 text-sm font-medium",
            value === o.value ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
