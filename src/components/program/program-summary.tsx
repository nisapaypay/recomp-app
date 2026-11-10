import { ProgressBar } from "@/components/ui/progress-bar";
import { PROGRAM_WEEKS } from "@/lib/program/schedule";
import { formatDate } from "@/lib/program/format";
import type { ProgramOverview } from "@/server/program/view";

/** Week, phase, dates and completion — all from real program data. */
export function ProgramSummary({ overview }: { overview: ProgramOverview }) {
  const { timing, completion, program } = overview;

  const headline =
    timing.state === "in_progress"
      ? `Week ${timing.week} of ${PROGRAM_WEEKS}`
      : timing.state === "not_started"
        ? `Starts in ${timing.daysUntilStart} ${timing.daysUntilStart === 1 ? "day" : "days"}`
        : "Program finished";
  const phase =
    timing.state === "in_progress"
      ? `${timing.phase.name} phase`
      : timing.state === "not_started"
        ? "Foundation phase first"
        : "All 12 weeks done";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-metric">{headline}</p>
        <p className="mt-0.5 text-sm text-ink-muted">{phase}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-ink-muted">Start</dt>
          <dd className="font-medium text-ink">{formatDate(program.startDate, "medium")}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">End</dt>
          <dd className="font-medium text-ink">{formatDate(program.endDate, "medium")}</dd>
        </div>
      </dl>

      <div className="space-y-3">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="text-ink-soft">Program time</span>
            <span className="font-medium tabular-nums text-ink">
              {timing.state === "in_progress"
                ? `Day ${timing.dayNumber} of 84`
                : timing.state === "finished"
                  ? "84 of 84 days"
                  : "Not started"}
            </span>
          </div>
          <ProgressBar
            label="Program days elapsed"
            value={timing.state === "in_progress" ? timing.dayNumber : timing.state === "finished" ? 84 : 0}
            max={84}
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="text-ink-soft">Activities completed</span>
            <span className="font-medium tabular-nums text-ink">
              {completion.total.completed} of {completion.total.planned} ·{" "}
              {completion.total.planned > 0 ? Math.round((completion.total.completed / completion.total.planned) * 100) : 0}%
            </span>
          </div>
          <ProgressBar
            label="Activities completed"
            value={completion.total.completed}
            max={completion.total.planned}
          />
          <p className="mt-1.5 text-caption text-ink-muted">
            Strength {completion.strength.completed}/{completion.strength.planned} · Walking{" "}
            {completion.walking.completed}/{completion.walking.planned} · Recovery{" "}
            {completion.recoveryConfigured
              ? `${completion.recovery.completed}/${completion.recovery.planned}`
              : "not configured (not counted)"}
            {completion.total.plannedToDate > 0 ? ` · ${completion.total.plannedToDate} scheduled so far` : ""}.
            Days count once logged on their scheduled day.
          </p>
        </div>
      </div>
    </div>
  );
}
