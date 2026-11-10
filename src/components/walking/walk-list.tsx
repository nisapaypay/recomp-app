import Link from "next/link";
import { ChevronRight, Footprints } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/program/format";
import {
  formatDuration,
  formatKm,
  formatPace,
  formatSpeed,
  paceSecondsPerKm,
  speedKmh,
  targetStatus,
  type ScheduledWalk,
} from "@/lib/walking/walking";
import type { Walk } from "@/server/walking/queries";

/** Readable walk history rows (newest first, as given). */
export function WalkList({ walks, scheduled }: { walks: Walk[]; scheduled: ScheduledWalk[] }) {
  const byDate = new Map(scheduled.map((w) => [w.date, w]));
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line/70 bg-surface shadow-card">
      {walks.map((w) => {
        const plan = w.scheduledDate ? byDate.get(w.scheduledDate) : undefined;
        const pace = formatPace(paceSecondsPerKm(w.durationMinutes, w.distanceKm));
        const speed = formatSpeed(speedKmh(w.durationMinutes, w.distanceKm));
        const late = w.scheduledDate !== null && w.activityDate > w.scheduledDate;
        return (
          <li key={w.id}>
            <Link href={`/walking/${w.id}`} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-muted/60 sm:px-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-50 text-accent-600">
                <Footprints aria-hidden className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-ink">
                  {formatDate(w.activityDate, "medium")}
                  {w.scheduledDate ? (
                    <Badge tone="accent">{plan?.label ?? "Program walk"}</Badge>
                  ) : (
                    <Badge>Additional</Badge>
                  )}
                  {plan && targetStatus(w.durationMinutes, plan.targetMin) === "met" ? (
                    <Badge tone="success">Target met</Badge>
                  ) : null}
                </p>
                <p className="mt-0.5 text-sm tabular-nums text-ink-soft">
                  {formatDuration(w.durationMinutes)}
                  {w.distanceKm !== null ? ` · ${formatKm(w.distanceKm)}` : ""}
                  {pace ? ` · ${pace}` : ""}
                  {speed ? ` · ${speed}` : ""}
                  {w.steps !== null ? ` · ${w.steps.toLocaleString("en-US")} steps` : ""}
                </p>
                {w.scheduledDate && late ? (
                  <p className="text-caption text-ink-muted">Scheduled {formatDate(w.scheduledDate, "medium")} · catch-up</p>
                ) : null}
              </div>
              <ChevronRight aria-hidden className="size-4.5 shrink-0 text-ink-faint" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
