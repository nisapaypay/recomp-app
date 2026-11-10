"use client";

import { ArrowDownRight, ArrowUpRight, Lock, Minus } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describeChange, PAIN_NOTE } from "@/lib/progression/adaptive";
import { formatDate } from "@/lib/program/format";
import { submitFeedback, type FeedbackState } from "@/server/actions/workout";
import type { AdjustmentView } from "@/server/progression/queries";
import { cn } from "@/lib/utils/cn";

const OPTIONS = [
  { value: "too_easy", label: "Too Easy", hint: "I could have done more" },
  { value: "just_right", label: "Just Right", hint: "Challenging with good form" },
  { value: "too_hard", label: "Too Hard", hint: "Form broke down or I couldn't finish" },
] as const;

const LABEL: Record<string, string> = { too_easy: "Too Easy", just_right: "Just Right", too_hard: "Too Hard" };

/**
 * Post-workout difficulty feedback. Saving may change ONE target of the next
 * workout of this type (see src/lib/progression/adaptive.ts); the result is
 * shown right here.
 */
export function FeedbackForm({
  sessionId,
  activityLabel,
  initial,
  adjustment,
  locked,
}: {
  sessionId: string;
  activityLabel: string;
  initial: { difficulty: string; painReported: boolean; notes: string | null } | null;
  adjustment: AdjustmentView | null;
  locked: boolean;
}) {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(submitFeedback, {});
  const [choice, setChoice] = useState<string | null>(initial?.difficulty ?? null);

  const outcome = initial ? <Outcome adjustment={adjustment} activityLabel={activityLabel} difficulty={initial.difficulty} pain={initial.painReported} /> : null;

  if (locked && initial) {
    return (
      <div className="space-y-4">
        <h2 className="text-heading">How did this workout feel?</h2>
        <p className="text-[0.9375rem] text-ink-soft">
          You said <strong>{LABEL[initial.difficulty]}</strong>
          {initial.painReported ? " and reported pain or unusual symptoms" : ""}.
        </p>
        {outcome}
        <p className="flex items-center gap-2 text-caption text-ink-muted">
          <Lock aria-hidden className="size-3.5" />
          Locked: your next {activityLabel} workout has already started.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="sessionId" value={sessionId} />
      <fieldset>
        <legend className="text-heading">How did this workout feel?</legend>
        <p className="mb-3 mt-1 text-[0.9375rem] text-ink-muted">
          Your answer is used to adjust the targets of your next {activityLabel} workout — at most one exercise, in a
          small step. Every answer is useful; there is no wrong one.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {OPTIONS.map((o) => (
            <label
              key={o.value}
              className={cn(
                "flex min-h-20 cursor-pointer flex-col justify-center rounded-card border px-4 py-3 transition-colors",
                choice === o.value ? "border-accent-600 bg-accent-50" : "border-line bg-surface hover:bg-surface-muted",
              )}
            >
              <input
                type="radio"
                name="difficulty"
                value={o.value}
                checked={choice === o.value}
                onChange={() => setChoice(o.value)}
                className="sr-only"
              />
              <span className="font-semibold text-ink">{o.label}</span>
              <span className="text-caption text-ink-muted">{o.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-11 items-center gap-3 text-[0.9375rem] text-ink-soft">
        <input
          type="checkbox"
          name="painReported"
          defaultChecked={initial?.painReported ?? false}
          className="size-5 accent-accent-600"
        />
        I felt pain or unusual symptoms (nothing will be increased)
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink-soft">Notes (optional)</span>
        <textarea
          name="notes"
          maxLength={1000}
          rows={2}
          defaultValue={initial?.notes ?? ""}
          className="block w-full rounded-control border border-line-strong bg-surface px-4 py-3 text-base focus:border-accent-500 focus:outline-none"
        />
      </label>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.saved ? <Alert tone="success">Feedback saved.</Alert> : null}
      {outcome}
      <Button type="submit" size="lg" disabled={pending || !choice}>
        {pending ? "Saving…" : initial ? "Update feedback" : "Save feedback"}
      </Button>
      {initial ? (
        <p className="text-caption text-ink-muted">
          Picked the wrong one? You can change it until you start your next {activityLabel} workout — the earlier
          adjustment is replaced, never added on top.
        </p>
      ) : null}
    </form>
  );
}

function Outcome({
  adjustment,
  activityLabel,
  difficulty,
  pain,
}: {
  adjustment: AdjustmentView | null;
  activityLabel: string;
  difficulty: string;
  pain: boolean;
}) {
  if (!adjustment) {
    return (
      <div className="flex gap-3 rounded-card border border-line bg-surface-muted p-4">
        <Minus aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-muted" />
        <div className="text-[0.9375rem]">
          <p className="font-semibold text-ink">No change to your targets</p>
          <p className="mt-0.5 text-ink-soft">
            {difficulty === "just_right"
              ? "This level suits you right now, so everything stays the same."
              : difficulty === "too_easy" && pain
                ? "Nothing is increased after a workout with pain."
                : "No exercise could be changed safely this time, so everything stays the same."}
          </p>
          {pain ? <p className="mt-1 text-ink-soft">{PAIN_NOTE}</p> : null}
        </div>
      </div>
    );
  }
  const up = adjustment.changeType.startsWith("increase");
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="flex gap-3 rounded-card border border-accent-200 bg-accent-50 p-4" role="status">
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-700" />
      <div className="text-[0.9375rem]">
        <p className="font-semibold text-ink">
          Next {activityLabel} workout: {adjustment.exerciseName} {describeChange(adjustment)}
        </p>
        <p className="mt-1 text-ink-soft">{adjustment.reason}</p>
        {pain ? <p className="mt-1 text-ink-soft">{PAIN_NOTE}</p> : null}
        <p className="mt-1 text-caption text-ink-muted">
          Applies to workouts started from {formatDate(adjustment.effectiveFrom, "long")}. Finished workouts never
          change.
        </p>
      </div>
    </div>
  );
}
