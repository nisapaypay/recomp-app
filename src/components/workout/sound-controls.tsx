"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { saveSoundSettings } from "@/server/actions/workout";
import { cn } from "@/lib/utils/cn";

/**
 * Sound on/off + volume. Changes apply immediately (via `onChange`) and are
 * saved to the profile shortly after the user stops adjusting.
 */
export function SoundControls({
  initialEnabled,
  initialVolume,
  onChange,
  compact = false,
}: {
  initialEnabled: boolean;
  initialVolume: number;
  onChange?: (enabled: boolean, volume: number) => void;
  compact?: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [volume, setVolume] = useState(initialVolume);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onChange?.(enabled, volume);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const result = await saveSoundSettings(enabled, volume).catch(() => ({ ok: false as const, error: "" }));
      setStatus(result.ok ? "saved" : "error");
    }, 500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, volume, onChange]);

  return (
    <div className={cn("flex items-center gap-3", compact ? "" : "flex-wrap")}>
      <button
        type="button"
        onClick={() => setEnabled((v) => !v)}
        aria-pressed={enabled}
        aria-label={enabled ? "Sound on — turn off" : "Sound off — turn on"}
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full border transition-colors",
          enabled ? "border-accent-200 bg-accent-50 text-accent-700" : "border-line bg-surface text-ink-muted",
        )}
      >
        {enabled ? <Volume2 aria-hidden className="size-5" /> : <VolumeX aria-hidden className="size-5" />}
      </button>
      <label className={cn("flex items-center gap-2 text-sm text-ink-soft", compact && "sr-only")}>
        <span className={compact ? "sr-only" : ""}>Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          disabled={!enabled}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="h-11 w-32 accent-accent-600 disabled:opacity-40"
          aria-valuetext={`${Math.round(volume * 100)}%`}
        />
      </label>
      {!compact && status !== "idle" ? (
        <span role="status" className={cn("text-caption", status === "saved" ? "text-ink-muted" : "text-danger")}>
          {status === "saved" ? "Saved" : "Couldn't save"}
        </span>
      ) : null}
    </div>
  );
}
