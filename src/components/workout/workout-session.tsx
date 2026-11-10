"use client";

import { History, Play, RotateCcw } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { restoreFromCheckpoint, type CheckpointRow } from "@/lib/engine/checkpoint";
import { createInitialState, type EngineExercise, type EngineState } from "@/lib/engine/workout-engine";
import { formatDate } from "@/lib/program/format";
import { continueWorkout, markInterrupted, startOver } from "@/server/actions/workout";
import type { SessionExercise } from "@/server/workout/queries";
import { WorkoutPlayer } from "./workout-player";

/**
 * Entry point of the workout screen. A session that was already running
 * (refresh, closed tab, sleep, another device) is never resumed or restarted
 * silently: the user chooses Continue Previous Workout or Start Over.
 */
export function WorkoutSession({
  sessionId,
  performedAt,
  status,
  scheduledDate,
  today,
  exercises,
  engineExercises,
  checkpoint,
  sound,
}: {
  sessionId: string;
  performedAt: string | null;
  status: "in_progress" | "interrupted";
  scheduledDate: string;
  today: string;
  exercises: SessionExercise[];
  engineExercises: EngineExercise[];
  checkpoint: CheckpointRow | null;
  sound: { enabled: boolean; volume: number };
}) {
  const fresh = status === "in_progress" && (!checkpoint || checkpoint.current_phase === "intro");
  const [player, setPlayer] = useState<{ state: EngineState; revision: number } | null>(() =>
    fresh ? { state: createInitialState(engineExercises), revision: checkpoint?.revision ?? 0 } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Record that this attempt was interrupted (it is still the one active session).
  useEffect(() => {
    if (!fresh && status === "in_progress") markInterrupted(sessionId).catch(() => {});
  }, [fresh, status, sessionId]);

  if (player) {
    return (
      <WorkoutPlayer
        sessionId={sessionId}
        performedAt={performedAt ? Date.parse(performedAt) : null}
        exercises={exercises}
        initialState={player.state}
        revision={player.revision}
        sound={sound}
      />
    );
  }

  const catchUp = scheduledDate < today;
  const done = exercises.reduce((n, e) => n + e.sets_rows.filter((r) => r.status !== "skipped").length, 0);

  return (
    <div className="m-auto w-full max-w-lg">
      <div className="rounded-card border border-line/70 bg-surface p-6 shadow-raised sm:p-8">
        <span className="grid size-12 place-items-center rounded-full bg-accent-50 text-accent-600">
          <History aria-hidden className="size-6" />
        </span>
        <h1 className="mt-4 text-title">Your previous workout was interrupted. What would you like to do?</h1>
        <p className="mt-2 text-[0.9375rem] text-ink-muted">
          Scheduled for {formatDate(scheduledDate, "full")} · {done} {done === 1 ? "set" : "sets"} saved so far.
        </p>

        {error ? (
          <Alert tone="danger" className="mt-4">
            {error}
          </Alert>
        ) : null}
        {catchUp ? (
          <Alert tone="info" className="mt-4">
            This is a catch-up: it stays recorded for {formatDate(scheduledDate, "long")}. Your schedule doesn&apos;t shift.
          </Alert>
        ) : null}

        <div className="mt-6 grid gap-3">
          <Button
            size="lg"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await continueWorkout(sessionId);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setPlayer({
                  state: restoreFromCheckpoint(engineExercises, result.checkpoint),
                  revision: result.checkpoint.revision,
                });
              })
            }
          >
            <Play aria-hidden className="size-5" />
            Continue Previous Workout
          </Button>
          <Button
            size="lg"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await startOver(sessionId);
                if (result && !result.ok) setError(result.error);
              })
            }
          >
            <RotateCcw aria-hidden className="size-5" />
            Start Over
          </Button>
        </div>
        <p className="mt-4 text-caption text-ink-muted">
          Start Over keeps this attempt in your history as abandoned and starts a new one. Nothing is deleted.
        </p>
      </div>
    </div>
  );
}
