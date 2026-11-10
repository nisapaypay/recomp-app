import { History } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/program/format";
import { getActiveSession } from "@/server/workout/queries";

/** Shown wherever a workout can be started while another one is still open. */
export async function ActiveWorkoutBanner() {
  const active = await getActiveSession();
  if (!active) return null;
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-card border border-accent-200 bg-accent-50 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-start gap-3 text-[0.9375rem] text-accent-800">
        <History aria-hidden className="mt-0.5 size-5 shrink-0" />
        You have an unfinished workout (scheduled {formatDate(active.scheduledDate, "full")}).
      </p>
      <ButtonLink href={`/workout/session/${active.id}`} size="sm">
        Open workout
      </ButtonLink>
    </div>
  );
}
