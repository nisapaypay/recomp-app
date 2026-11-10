"use client";

import { useEffect, useState } from "react";
import { FigureSvg } from "@/components/exercise/figure-svg";
import { useReducedMotion } from "@/components/exercise/use-reduced-motion";
import { figureFor } from "@/lib/animation/exercises";
import { movementAt } from "@/lib/animation/movement";
import type { EngineState } from "@/lib/engine/workout-engine";

/**
 * Figure of the current exercise, driven only by the workout engine's state:
 * `movementAt(state, time)` turns the engine's tempo anchor / hold end into a
 * pose. requestAnimationFrame only redraws that pure function at display rate
 * between engine ticks (it never counts reps, dispatches or stores timing).
 * During rest / preparation the figure previews the coming exercise. rAF stops
 * while paused, when the workout is complete, in background tabs and with
 * reduced motion (then the pose follows the engine's ticks, one position per
 * tempo phase). Focus muscles are drawn in red.
 */
export function ExerciseAnimation({
  exerciseId,
  state,
  now,
  muscles,
}: {
  exerciseId: string;
  state: EngineState;
  now: number;
  muscles?: readonly string[];
}) {
  const config = figureFor(exerciseId);
  const reduced = useReducedMotion();
  const running = !reduced && !state.paused && (state.phase === "work" || state.phase === "rest" || state.phase === "prepare");
  const [frameAt, setFrameAt] = useState(0);

  useEffect(() => {
    if (!running) return;
    let id = requestAnimationFrame(function frame() {
      setFrameAt(Date.now()); // same clock as the engine
      id = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(id);
  }, [running]);

  if (!config) return null;
  const at = running ? Math.max(now, frameAt) : now;
  const movement = movementAt(state, at, { reducedMotion: reduced });
  if (!movement) return null;
  return <FigureSvg config={config} movement={movement} muscles={muscles} />;
}

export function hasExerciseAnimation(exerciseId: string | undefined): boolean {
  return exerciseId !== undefined && figureFor(exerciseId) !== null;
}
