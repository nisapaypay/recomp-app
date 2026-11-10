import Link from "next/link";
import { Check, Circle, Clock } from "lucide-react";
import type { IsoDate } from "@/lib/program/calendar";
import { formatDate } from "@/lib/program/format";
import { formatDuration, formatTarget, targetStatus, type ScheduledWalk } from "@/lib/walking/walking";
import type { Walk } from "@/server/walking/queries";
import { cn } from "@/lib/utils/cn";

/** The program walks of one week: target vs actual, or what's still open. */
export function WeekWalks({ walks, logs, today }: { walks: ScheduledWalk[]; logs: Walk[]; today: IsoDate }) {
  const byScheduled = new Map(logs.filter((l) => l.scheduledDate).map((l) => [l.scheduledDate as IsoDate, l]));
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {walks.map((w) => {
        const log = byScheduled.get(w.date);
        const reached = w.date <= today;
        const met = log ? targetStatus(log.durationMinutes, w.targetMin) === "met" : false;
        return (
          <li key={w.date}>
            <Link
              href={log ? `/walking/${log.id}` : `/walking?walk=${w.date}#log`}
              className={cn(
                "flex items-start gap-3 rounded-control border px-4 py-3 transition-colors hover:bg-surface-muted",
                log ? "border-success/25 bg-success-soft/40" : "border-line bg-surface",
              )}
            >
              <span className={cn("mt-0.5", log ? "text-success" : reached ? "text-warning" : "text-ink-faint")}>
                {log ? <Check aria-hidden className="size-4.5" /> : reached ? <Clock aria-hidden className="size-4.5" /> : <Circle aria-hidden className="size-4.5" />}
              </span>
              <span className="min-w-0 text-sm">
                <span className="block font-medium text-ink">
                  {w.label} · {formatDate(w.date, "medium")}
                </span>
                <span className="block text-ink-muted">
                  Target {formatTarget(w.targetMin, w.targetMax)}
                  {log
                    ? ` · walked ${formatDuration(log.durationMinutes)}${met ? " ✓" : ""}`
                    : reached
                      ? " · not logged yet — tap to log"
                      : " · coming up"}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
