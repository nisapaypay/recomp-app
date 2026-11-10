/**
 * One shared requestAnimationFrame clock for exercise DEMOS (library covers,
 * the interactive demo). It runs only while something subscribes, and the
 * snapshot is quantised to ~30 fps so many small covers stay cheap.
 * The workout player does NOT use this — it is driven by the workout engine.
 */
const FRAME_MS = 33;
const listeners = new Set<() => void>();
let now = 0;
let raf = 0;

function loop() {
  const t = Math.floor(performance.now() / FRAME_MS) * FRAME_MS;
  if (t !== now) {
    now = t;
    for (const l of listeners) l();
  }
  raf = requestAnimationFrame(loop);
}

export function subscribeDemoClock(cb: () => void): () => void {
  listeners.add(cb);
  if (listeners.size === 1) raf = requestAnimationFrame(loop);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) cancelAnimationFrame(raf);
  };
}

export const getDemoClock = () => now;
export const getDemoClockServer = () => 0;
export const noSubscribe = () => () => {};
