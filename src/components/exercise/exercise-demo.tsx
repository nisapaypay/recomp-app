"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { ExerciseIllustration } from "@/components/program/exercise-illustration";
import { Button } from "@/components/ui/button";
import { figureFor } from "@/lib/animation/exercises";
import { getDemoClock, getDemoClockServer, noSubscribe, subscribeDemoClock } from "@/lib/animation/demo-clock";
import { demoCycleMs, demoMovement } from "@/lib/animation/movement";
import { tempoStartFor } from "@/lib/engine/tempo-start";
import { firstSide, secondSide, tempoSequence, type Side, type SideMode, type TempoPhaseName } from "@/lib/engine/workout-engine";
import { cn } from "@/lib/utils/cn";
import { FigureSvg, MuscleLegend } from "./figure-svg";
import { useReducedMotion } from "./use-reduced-motion";

const PHASE: Record<TempoPhaseName, { title: string; hint: string }> = {
  eccentric: { title: "Eccentric", hint: "Lengthen slowly with control" },
  hold: { title: "Hold", hint: "Pause and stay steady" },
  concentric: { title: "Concentric", hint: "Push or pull with control" },
};
const SIDE_LABEL: Record<Side, string> = { left: "Left", right: "Right", forward: "Forward", backward: "Backward" };
const SPEEDS = [0.5, 1] as const;
/** Same time base as the shared demo clock; only called from event handlers. */
const now = () => performance.now();

/**
 * Interactive exercise demo (exercise detail page): play / pause, slow
 * motion, drag through one rep, jump to a tempo phase, switch side. The
 * timing is a demo clock — this is not a workout and nothing is recorded.
 */
export function ExerciseDemo({
  exerciseId,
  name,
  measureType,
  sideMode,
  tempo,
  holdSeconds,
  muscles,
  illustrationPath,
}: {
  exerciseId: string;
  name: string;
  measureType: "reps" | "seconds";
  sideMode: SideMode;
  tempo: { eccentric: number; pause: number; concentric: number } | null;
  holdSeconds?: number;
  muscles: readonly string[];
  illustrationPath: string | null;
}) {
  const config = figureFor(exerciseId);
  const reduced = useReducedMotion();
  // Demo time = base + (clock − startedAt) × speed while playing.
  const [play, setPlay] = useState<{ base: number; startedAt: number | null }>({ base: 0, startedAt: null });
  const [autoplayed, setAutoplayed] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [side, setSide] = useState<Side | null>(firstSide(sideMode));
  const playing = play.startedAt !== null;
  const clock = useSyncExternalStore(playing ? subscribeDemoClock : noSubscribe, getDemoClock, getDemoClockServer);

  // Start playing once on the client (not with reduced motion: the user presses Play).
  if (!autoplayed && !reduced && config) {
    setAutoplayed(true);
    setPlay({ base: 0, startedAt: 0 }); // the demo loops, so any origin on the shared clock works
  }

  if (!config) return <ExerciseIllustration name={name} path={illustrationPath} size="lg" />;

  const ex = { measureType, tempo, tempoStart: tempoStartFor(exerciseId) };
  const cycleMs = demoCycleMs(ex);
  const elapsed = play.startedAt !== null ? play.base + Math.max(0, clock - play.startedAt) * speed : play.base;
  const m = demoMovement(ex, elapsed, side);
  const steps = tempo && measureType === "reps" ? tempoSequence(tempo, ex.tempoStart) : [];
  const inCycle = elapsed % cycleMs;

  const current = () => (play.startedAt === null ? play.base : play.base + Math.max(0, now() - play.startedAt) * speed);
  const pause = () => setPlay({ base: current(), startedAt: null });
  const resume = () => setPlay({ base: play.base, startedAt: now() });
  const seek = (ms: number) => setPlay({ base: Math.floor(current() / cycleMs) * cycleMs + ms, startedAt: null });
  const changeSpeed = (s: (typeof SPEEDS)[number]) => {
    setPlay(play.startedAt === null ? play : { base: current(), startedAt: now() });
    setSpeed(s);
  };

  const phaseTitle = m.tempoPhase ? PHASE[m.tempoPhase].title : measureType === "seconds" ? "Hold" : "Movement";
  const phaseHint = m.tempoPhase ? PHASE[m.tempoPhase].hint : measureType === "seconds" ? "Keep the position and breathe steadily" : "";

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div aria-live="polite">
          <p className="text-overline uppercase text-ink-muted">
            {measureType === "seconds" ? `Timed hold${holdSeconds ? ` · ${holdSeconds} s` : ""}` : `Demo rep ${m.rep}`}
            {side ? ` · ${SIDE_LABEL[side]}` : ""}
          </p>
          <p className="text-lg font-semibold text-ink">{phaseTitle}</p>
          {phaseHint ? <p className="text-caption text-ink-muted">{phaseHint}</p> : null}
        </div>
        {sideMode !== "none" ? (
          <div className="flex gap-1.5" role="group" aria-label="Side">
            {[firstSide(sideMode), secondSide(firstSide(sideMode))].map((s) =>
              s ? (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  aria-pressed={side === s}
                  className={cn(
                    "h-11 rounded-chip border px-3.5 text-sm font-semibold",
                    side === s ? "border-accent-600 bg-accent-600 text-white" : "border-line bg-surface text-ink-muted hover:text-ink",
                  )}
                >
                  {SIDE_LABEL[s]}
                </button>
              ) : null,
            )}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => (playing ? pause() : resume())}
        className="block aspect-[5/4] w-full bg-gradient-to-b from-accent-50 to-surface"
        aria-label={playing ? `Pause the ${name} demo` : `Play the ${name} demo`}
      >
        <FigureSvg config={config} movement={m} muscles={muscles} />
      </button>

      <div className="space-y-3 border-t border-line p-4">
        {steps.length > 0 ? (
          <>
            <input
              type="range"
              min={0}
              max={cycleMs}
              step={50}
              value={Math.round(inCycle)}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Position in the rep"
              className="h-11 w-full accent-accent-600"
            />
            <div className="flex gap-1.5">
              {steps.map((s, i) => {
                const start = steps.slice(0, i).reduce((n, x) => n + x.ms, 0);
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => seek(start + s.ms / 2)}
                    style={{ flexGrow: s.ms }}
                    className={cn(
                      "min-h-11 basis-0 rounded-control border px-2 py-1.5 text-center text-caption font-semibold",
                      m.stepIndex === i ? "border-accent-600 bg-accent-50 text-accent-700" : "border-line text-ink-muted hover:text-ink",
                    )}
                  >
                    {PHASE[s.name].title}
                    <span className="block font-normal">{s.ms / 1000} s</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant={playing ? "secondary" : "primary"} onClick={() => (playing ? pause() : resume())}>
            {playing ? <Pause aria-hidden className="size-4.5" /> : <Play aria-hidden className="size-4.5" />}
            {playing ? "Pause" : "Play"}
          </Button>
          <Button variant="ghost" onClick={() => setPlay({ base: 0, startedAt: playing ? now() : null })}>
            <RotateCcw aria-hidden className="size-4.5" />
            Restart
          </Button>
          <div className="ml-auto flex gap-1" role="group" aria-label="Speed">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeSpeed(s)}
                aria-pressed={speed === s}
                className={cn(
                  "h-11 min-w-11 rounded-control px-3 text-sm font-semibold",
                  speed === s ? "bg-accent-100 text-accent-700" : "text-ink-muted hover:text-ink",
                )}
              >
                {s === 1 ? "1×" : "½×"}
              </button>
            ))}
          </div>
        </div>
        <MuscleLegend muscles={muscles} />
        <p className="text-caption text-ink-muted">Tap the figure to pause. Drag the slider to see each position.</p>
      </div>
    </div>
  );
}
