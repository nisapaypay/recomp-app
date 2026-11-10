import { cn } from "@/lib/utils/cn";

/** Accessible progress bar. `value` and `max` are real counts, never invented. */
export function ProgressBar({
  value,
  max,
  label,
  tone = "accent",
  className,
}: {
  value: number;
  max: number;
  label: string;
  tone?: "accent" | "inverse";
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn(
        "h-2 w-full overflow-hidden rounded-chip",
        tone === "accent" ? "bg-accent-100" : "bg-white/20",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-chip transition-[width]", tone === "accent" ? "bg-accent-600" : "bg-white")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
