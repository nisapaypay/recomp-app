"use client";

import { Minus, Plus, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { Tempo } from "@/lib/program/estimate";
import { Button } from "@/components/ui/button";

const PARTS: { key: keyof Tempo; label: string }[] = [
  { key: "eccentric", label: "Eccentric" },
  { key: "pause", label: "Hold" },
  { key: "concentric", label: "Concentric" },
];

/** Manual tempo adjustment for the current exercise (this session only). */
export function TempoAdjust({ tempo, onApply }: { tempo: Tempo; onApply: (tempo: Tempo) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Tempo>(tempo);

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setDraft(tempo);
          setOpen(true);
        }}
      >
        <SlidersHorizontal aria-hidden className="size-4" />
        Adjust tempo
      </Button>
    );
  }

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="mb-3 text-sm font-medium text-ink">Tempo for this exercise (seconds)</p>
      <div className="grid grid-cols-3 gap-2">
        {PARTS.map(({ key, label }) => (
          <div key={key} className="flex flex-col items-center gap-1">
            <span className="text-caption text-ink-muted">{label}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={`Decrease ${label}`}
                onClick={() => setDraft((d) => ({ ...d, [key]: Math.max(0, d[key] - 1) }))}
                className="grid size-9 place-items-center rounded-full border border-line hover:bg-surface-muted"
              >
                <Minus aria-hidden className="size-4" />
              </button>
              <span className="w-6 text-center text-heading tabular-nums">{draft[key]}</span>
              <button
                type="button"
                aria-label={`Increase ${label}`}
                onClick={() => setDraft((d) => ({ ...d, [key]: Math.min(10, d[key] + 1) }))}
                className="grid size-9 place-items-center rounded-full border border-line hover:bg-surface-muted"
              >
                <Plus aria-hidden className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={draft.eccentric + draft.pause + draft.concentric === 0}
          onClick={() => {
            onApply(draft);
            setOpen(false);
          }}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}
