"use client";

import { Download } from "lucide-react";
import { useState } from "react";

/** Download the report as an A4 PDF; photos only when the user opts in. */
export function PdfExport({ hasPhotos }: { hasPhotos: boolean }) {
  const [photos, setPhotos] = useState(false);
  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <a
        href={`/api/report/pdf?photos=${photos ? 1 : 0}`}
        download
        className="inline-flex min-h-11 items-center gap-2 rounded-control bg-accent-600 px-4 text-sm font-semibold text-white shadow-card hover:bg-accent-700"
      >
        <Download aria-hidden className="size-4.5" />
        Download PDF
      </a>
      {hasPhotos ? (
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} className="size-5 accent-accent-600" />
          Include progress photos
        </label>
      ) : null}
      <p className="text-caption text-ink-muted">Photos are embedded in the file — it contains no links to your storage.</p>
    </div>
  );
}
