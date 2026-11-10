import Link from "next/link";
import { Bed, ChevronRight, Dumbbell, Footprints, Leaf, type LucideIcon } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/program/format";
import { estimateLabel } from "@/lib/program/labels";
import { isCatchUp, performedDate } from "@/lib/program/start-rules";
import { WEEKLY_SCHEDULE, type ActivityType } from "@/lib/program/schedule";
import { cn } from "@/lib/utils/cn";
import type { DayView } from "@/server/program/view";

export const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  lower_body: Dumbbell,
  upper_body_core: Dumbbell,
  full_body_core: Dumbbell,
  walking: Footprints,
  recovery: Leaf,
  rest: Bed,
};

/**
 * Mon–Sun schedule. With `days` (real program data) each day shows its date,
 * status and a link to the day detail. Without it, only the fixed plan is
 * shown — never invented completion.
 */
export function WeeklySchedule({ days }: { days?: DayView[] }) {
  if (!days) {
    return (
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-7 xl:gap-3">
        {WEEKLY_SCHEDULE.map((day) => (
          <DayTile key={day.day} shortLabel={day.shortLabel} activity={day.activity} activityLabel={day.activityLabel} />
        ))}
      </ol>
    );
  }

  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-7 xl:gap-3">
      {days.map((day) => (
        <DayTile
          key={day.date}
          shortLabel={day.shortLabel}
          activity={day.activity}
          activityLabel={day.activityLabel}
          date={day.date}
          status={day.status}
          isToday={day.isToday}
          meta={dayMeta(day)}
          href={day.activity === "rest" ? undefined : `/workout/day/${day.date}`}
        />
      ))}
    </ol>
  );
}

function dayMeta(day: DayView): string | null {
  if (day.status === "completed" && day.performedAt && isCatchUp(day.date, day.performedAt)) {
    return `Done ${formatDate(performedDate(day.performedAt), "short")} (catch-up)`;
  }
  if (day.prescriptions.length > 0) {
    return `${day.prescriptions.length} exercises · ${estimateLabel(day.estimatedSeconds)}`;
  }
  if (day.walkingTargetMinutes) {
    const { min, max } = day.walkingTargetMinutes;
    return min === max ? `${min} min walk` : `${min}–${max} min walk`;
  }
  return null;
}

function DayTile({
  shortLabel,
  activity,
  activityLabel,
  date,
  status,
  isToday,
  meta,
  href,
}: {
  shortLabel: string;
  activity: ActivityType;
  activityLabel: string;
  date?: string;
  status?: DayView["status"];
  isToday?: boolean;
  meta?: string | null;
  href?: string;
}) {
  const Icon = ACTIVITY_ICON[activity];
  const body = (
    <>
      <span className="flex w-12 shrink-0 flex-col xl:w-auto">
        <span className="text-caption font-semibold uppercase text-ink-muted">{shortLabel}</span>
        {date ? <span className="text-caption text-ink-muted">{formatDate(date, "short")}</span> : null}
      </span>
      <Icon
        aria-hidden
        className={cn("size-5 shrink-0", activity === "rest" ? "text-ink-faint" : "text-accent-600")}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug text-ink">{activityLabel}</span>
        {meta ? <span className="block text-caption text-ink-muted">{meta}</span> : null}
      </span>
      {status ? <StatusBadge status={status} /> : null}
      {href ? <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-faint xl:hidden" /> : null}
    </>
  );

  const className = cn(
    "flex h-full items-center gap-3 rounded-control border px-3.5 py-3",
    "xl:flex-col xl:items-start xl:gap-2 xl:px-3 xl:py-3.5",
    isToday ? "border-accent-300 bg-accent-50" : "border-line bg-surface",
    href && "transition-colors hover:border-accent-200 hover:bg-accent-50/60",
  );

  return (
    <li aria-current={isToday ? "date" : undefined}>
      {href ? (
        <Link href={href} className={className}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}
