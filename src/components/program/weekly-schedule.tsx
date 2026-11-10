import { Bed, Dumbbell, Footprints, Leaf, type LucideIcon } from "lucide-react";
import {
  WEEKLY_SCHEDULE,
  type ActivityType,
  type ScheduleDay,
  type ScheduleStatus,
} from "@/lib/program/schedule";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

const activityIcon: Record<ActivityType, LucideIcon> = {
  lower_body: Dumbbell,
  upper_body_core: Dumbbell,
  full_body_core: Dumbbell,
  walking: Footprints,
  recovery: Leaf,
  rest: Bed,
};

/**
 * Mon–Sun fixed schedule. `statuses` is optional: statuses are only shown
 * when they come from real program data (Phase 3+). Without them, only the
 * fixed plan is displayed — never invented completion.
 */
export function WeeklySchedule({
  statuses,
}: {
  statuses?: Partial<Record<ScheduleDay["day"], ScheduleStatus>>;
}) {
  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-7 xl:gap-3">
      {WEEKLY_SCHEDULE.map((day) => {
        const Icon = activityIcon[day.activity];
        const status = statuses?.[day.day];
        const isToday = status === "today";
        return (
          <li
            key={day.day}
            className={cn(
              "flex items-center gap-3 rounded-control border px-3.5 py-3",
              "xl:flex-col xl:items-start xl:gap-2 xl:px-3 xl:py-3.5",
              isToday ? "border-accent-300 bg-accent-50" : "border-line bg-surface",
            )}
          >
            <span className="w-9 shrink-0 text-caption font-semibold uppercase text-ink-muted xl:w-auto">
              {day.shortLabel}
            </span>
            <Icon
              aria-hidden
              className={cn(
                "size-5 shrink-0",
                day.activity === "rest" ? "text-ink-faint" : "text-accent-600",
              )}
            />
            <span className="flex-1 text-sm font-medium leading-snug text-ink">
              {day.activityLabel}
            </span>
            {status ? <StatusBadge status={status} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
