"use client";

import { Play } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { startWorkout, type StartState } from "@/server/actions/workout";

/**
 * Creates (or reopens) the session for a scheduled workout. For a past day
 * the user first confirms the catch-up; it is recorded for its original
 * date and the schedule doesn't shift. The database guarantees a single
 * active session and a single completion per scheduled day.
 */
export function StartWorkoutButton({
  programId,
  scheduledDate,
  catchUp,
  scheduledLabel,
}: {
  programId: string;
  scheduledDate: string;
  catchUp: boolean;
  /** e.g. "Monday, 9 November" — shown in the confirmation. */
  scheduledLabel: string;
}) {
  const [state, action, pending] = useActionState<StartState, FormData>(startWorkout, {});
  const [confirming, setConfirming] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={action} className="flex flex-col items-stretch gap-2 md:items-end">
      <input type="hidden" name="programId" value={programId} />
      <input type="hidden" name="scheduledDate" value={scheduledDate} />
      <Button
        type={catchUp ? "button" : "submit"}
        size="lg"
        disabled={pending}
        onClick={catchUp ? () => setConfirming(true) : undefined}
      >
        <Play aria-hidden className="size-5" />
        {pending ? "Starting…" : catchUp ? "Start catch-up workout" : "Start Workout"}
      </Button>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <ConfirmDialog
        open={confirming}
        title="Start a catch-up workout?"
        confirmLabel="Start catch-up"
        busy={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          form.current?.requestSubmit();
        }}
      >
        This workout was scheduled for <strong>{scheduledLabel}</strong>. It will be recorded for that day, with
        today as the date you performed it. Your program schedule won&apos;t shift.
      </ConfirmDialog>
    </form>
  );
}
