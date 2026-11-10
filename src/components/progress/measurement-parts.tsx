import Link from "next/link";
import { CalendarCheck, CalendarClock, CalendarX, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/program/format";
import { METRICS, formatValue, type CheckIn } from "@/lib/measurements/measurements";
import type { Measurement } from "@/server/progress/queries";
import { cn } from "@/lib/utils/cn";

const STATUS = {
  done: { icon: CalendarCheck, label: "Saved", tone: "success" as const },
  due: { icon: CalendarClock, label: "Due this week", tone: "accent" as const },
  late: { icon: CalendarX, label: "Late — you can still record it", tone: "warning" as const },
  upcoming: { icon: Circle, label: "Upcoming", tone: "neutral" as const },
};

/** Weeks 1 / 4 / 8 / 12 with status and the actual date when saved. */
export function CheckInSchedule({ schedule, measurementIds }: { schedule: CheckIn[]; measurementIds: Map<number, string> }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {schedule.map((c) => {
        const s = STATUS[c.status];
        const id = measurementIds.get(c.week);
        const body = (
          <>
            <p className="flex items-center justify-between gap-2">
              <span className="font-semibold text-ink">Week {c.week}</span>
              <s.icon aria-hidden className={cn("size-4.5", c.status === "done" ? "text-success" : c.status === "late" ? "text-warning" : "text-ink-muted")} />
            </p>
            <p className="text-caption text-ink-muted">
              {formatDate(c.windowStart, "medium")} – {formatDate(c.windowEnd, "medium")}
            </p>
            <Badge tone={s.tone} className="mt-2">
              {c.recordedOn ? `Measured ${formatDate(c.recordedOn, "medium")}` : s.label}
            </Badge>
          </>
        );
        return (
          <li key={c.week}>
            {id ? (
              <Link href={`/progress/measurements/${id}`} className="block rounded-control border border-line bg-surface p-3.5 hover:bg-surface-muted">
                {body}
              </Link>
            ) : (
              <div className="rounded-control border border-line bg-surface p-3.5">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** History, newest first — also the table view of the charts. */
export function MeasurementTable({ items }: { items: Measurement[] }) {
  const cols = METRICS.filter((m) => m.key !== "visceralFat");
  return (
    <div className="overflow-x-auto rounded-card border border-line/70 bg-surface shadow-card">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <caption className="sr-only">Measurement history, newest first</caption>
        <thead className="text-caption text-ink-muted">
          <tr className="border-b border-line">
            <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Week</th>
            {cols.map((m) => (
              <th key={m.key} scope="col" className="px-3 py-2.5 text-right font-medium">{m.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((r) => (
            <tr key={r.id} className="hover:bg-surface-muted/60">
              <td className="px-4 py-2.5">
                <Link href={`/progress/measurements/${r.id}`} className="font-medium text-accent-700 hover:underline">
                  {formatDate(r.recordedOn, "medium")}
                </Link>
              </td>
              <td className="px-3 py-2.5 tabular-nums">{r.weekNumber}</td>
              {cols.map((m) => (
                <td key={m.key} className="px-3 py-2.5 text-right tabular-nums">
                  {r[m.key] !== null ? formatValue(r[m.key] as number, m) : <span className="text-ink-faint">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
