"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ExerciseIllustration } from "@/components/program/exercise-illustration";
import { figureFor } from "@/lib/animation/exercises";
import { demoMovement } from "@/lib/animation/movement";
import { getDemoClock, getDemoClockServer, noSubscribe, subscribeDemoClock } from "@/lib/animation/demo-clock";
import { tempoStartFor } from "@/lib/engine/tempo-start";
import { firstSide, type SideMode } from "@/lib/engine/workout-engine";
import { cn } from "@/lib/utils/cn";
import { FigureSvg } from "./figure-svg";
import { useReducedMotion } from "./use-reduced-motion";

/**
 * Looping animated cover of an exercise (library and day lists): the figure
 * repeats one rep at the exercise's tempo, focus muscles in red. Animates
 * only while on screen; reduced motion shows the peak position, still.
 */
export function ExerciseCover({
  exerciseId,
  name,
  measureType,
  sideMode,
  tempo,
  muscles,
  illustrationPath,
  className,
}: {
  exerciseId: string;
  name: string;
  measureType: "reps" | "seconds";
  sideMode: SideMode;
  tempo: { eccentric: number; pause: number; concentric: number } | null;
  muscles: readonly string[];
  illustrationPath: string | null;
  className?: string;
}) {
  const config = figureFor(exerciseId);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "80px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const animate = visible && !reduced && config !== null;
  const clock = useSyncExternalStore(animate ? subscribeDemoClock : noSubscribe, getDemoClock, getDemoClockServer);

  if (!config) return <ExerciseIllustration name={name} path={illustrationPath} size="sm" className={className} />;

  const ex = { measureType, tempo, tempoStart: tempoStartFor(exerciseId) };
  const movement = reduced
    ? { amount: 1, cycle: 0.5, side: firstSide(sideMode) }
    : demoMovement(ex, clock, firstSide(sideMode));
  return (
    <div
      ref={ref}
      role="img"
      aria-label={`Animated demo of ${name}`}
      className={cn("shrink-0 overflow-hidden rounded-control bg-gradient-to-b from-accent-50 to-surface-muted", className)}
    >
      <FigureSvg config={config} movement={movement} muscles={muscles} />
    </div>
  );
}
