import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { describeChange } from "@/lib/progression/adaptive";
import { formatDate, formatDateTime } from "@/lib/program/format";
import { WEEKLY_SCHEDULE } from "@/lib/program/schedule";
import type { AdjustmentView } from "@/server/progression/queries";

const activityLabel = (a: AdjustmentView["activityType"]) =>
  WEEKLY_SCHEDULE.find((d) => d.activity === a)?.activityLabel ?? a;

/** Readable list of adaptive adjustments: what changed, why, and from when. */
export function AdjustmentHistory({ items, showExercise = true }: { items: AdjustmentView[]; showExercise?: boolean }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={SlidersHorizontal}
        title="No adjustments yet"
        description="After a completed workout, your Too Easy / Too Hard feedback can change one target of the next workout of that type. Each change appears here with its reason."
      />
    );
  }
  return (
    <ol className="space-y-3">
      {items.map((a) => {
        const up = a.changeType.startsWith("increase");
        const Icon = up ? ArrowUpRight : ArrowDownRight;
        return (
          <li key={a.id} className="flex gap-3 rounded-card border border-line/70 bg-surface p-4 shadow-card">
            <span
              className={
                up
                  ? "grid size-9 shrink-0 place-items-center rounded-full bg-accent-50 text-accent-700"
                  : "grid size-9 shrink-0 place-items-center rounded-full bg-surface-muted text-ink-soft"
              }
            >
              <Icon aria-hidden className="size-4.5" />
              <span className="sr-only">{up ? "Increased" : "Eased"}</span>
            </span>
            <div className="min-w-0 text-[0.9375rem]">
              <p className="font-semibold text-ink">
                {showExercise ? (
                  <Link href={`/workout/exercises/${a.exerciseId}`} className="hover:underline">
                    {a.exerciseName}
                  </Link>
                ) : null}
                {showExercise ? " · " : ""}
                {describeChange(a)}
              </p>
              <p className="mt-0.5 text-ink-soft">{a.reason}</p>
              <p className="mt-1 text-caption text-ink-muted">
                {activityLabel(a.activityType)} workouts · from {formatDate(a.effectiveFrom, "long")} · decided{" "}
                {formatDateTime(a.createdAt)}
                {a.sourceSessionId ? (
                  <>
                    {" · "}
                    <Link href={`/workout/session/${a.sourceSessionId}/summary`} className="underline-offset-2 hover:underline">
                      source workout
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
