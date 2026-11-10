/**
 * Exercise figures: a simple human figure (rounded limbs, no face) drawn in
 * SVG, with a start pose and a peak pose per exercise. The pose in between is
 * interpolated from `Movement.amount`, so the figure follows the workout
 * engine's tempo exactly.
 *
 * Joints are computed here (pure geometry, unit-tested); the React component
 * only draws the returned primitives. Feet and hands that must stay planted
 * (floor, wall) use two-bone inverse kinematics towards a fixed point, so
 * they don't slide while the body moves.
 *
 * Angles: degrees, 0 = straight down, 90 = forward (the way the figure
 * faces; outward in the front view), 180 = up, −90 = backward.
 * ViewBox 0 0 200 160, floor at y = 150.
 */
import type { Movement } from "./movement.ts";

export const VIEWBOX = { width: 200, height: 160 } as const;
export const FLOOR_Y = 150;

const LEN = { torso: 44, neck: 5, head: 9, upperArm: 24, forearm: 22, thigh: 33, shin: 32, foot: 9 } as const;
const FRONT = { hip: 8, shoulder: 15 } as const;

export type Vec = readonly [number, number];
type Angles = { angles: readonly [number, number] };
type Reach = { reach: Vec; bend: 1 | -1 };
type Limb = Angles | Reach;
export type LimbName = "armA" | "armB" | "legA" | "legB";

export type Pose = {
  hip: Vec;
  torso: number;
  armA: Limb;
  armB: Limb;
  legA: Limb;
  legB: Limb;
  /** Absolute foot angles (side view; default 90 = flat, pointing forward). */
  footA?: number;
  footB?: number;
};

export type Prop =
  | { kind: "wall"; x: number }
  | { kind: "box"; x: number; y: number; w: number; h: number }
  | { kind: "mat"; x1: number; x2: number };

export type FigureConfig = {
  view: "side" | "front";
  start: Pose;
  peak: Pose;
  /** Limbs that do the work: for unilateral exercises only these get the red focus muscles. */
  active: LimbName[];
  dumbbells?: "both" | "together" | "armA";
  props?: Prop[];
  /** Arm circles: hands circle around the arm line, once per rep. */
  orbit?: { radius: number };
  /** A stepping foot lifts on the way (reverse lunge) instead of sliding. */
  arc?: { limb: LimbName; height: number };
  /** Top of the view box (negative for overhead movements). Default 0. */
  top?: number;
};

/** Flat illustration colours: long-sleeve top, long trousers, trainers. */
export const PALETTE = {
  skin: "#eebf9c",
  hair: "#3b2a26",
  eye: "#2a2230",
  top: "#7556d4",
  topFar: "#5d3fbb",
  pants: "#3f3b4d",
  pantsFar: "#2d2a38",
  shoe: "#f7f5fb",
  shoeFar: "#e4dff0",
  sole: "#b8a6ee",
  weight: "#5b5764",
  plate: "#26232c",
  muscle: "#e5484d", // focus muscles
  floor: "#e6e3ea",
  mat: "#ebe5fb",
  prop: "#dcd8e3",
} as const;

/**
 * Drawing primitives. A capsule is a limb segment with rounded ends whose
 * radius tapers from `r1` (at `from`) to `r2` (at `to`).
 */
export type Primitive =
  | { type: "capsule"; from: Vec; to: Vec; r1: number; r2: number; fill: string; opacity?: number }
  | { type: "circle"; at: Vec; r: number; fill: string; opacity?: number }
  | { type: "ellipse"; at: Vec; rx: number; ry: number; fill: string }
  | { type: "rect"; x: number; y: number; w: number; h: number; rx: number; fill: string };

// ---------------------------------------------------------------------------
// Vector helpers
// ---------------------------------------------------------------------------

const rad = (deg: number) => (deg * Math.PI) / 180;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpVec = (a: Vec, b: Vec, t: number): Vec => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];

/** Unit vector for an angle. `dir` = +1 forward/outward to the right of the screen, −1 to the left. */
function unit(deg: number, dir: 1 | -1 = 1): Vec {
  return [dir * Math.sin(rad(deg)), Math.cos(rad(deg))];
}

/**
 * Two-bone IK: joint and end point for a limb from `root` towards `target`.
 * `bend` +1 puts the middle joint on the +x side of the root→target line when
 * it points down (knees forward, for a figure facing right).
 */
export function solveTwoBone(root: Vec, target: Vec, l1: number, l2: number, bend: 1 | -1): { joint: Vec; end: Vec } {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const dist = Math.hypot(dx, dy) || 1e-6;
  const d = Math.min(l1 + l2 - 1e-6, Math.max(Math.abs(l1 - l2) + 1e-6, dist));
  const ux = dx / dist;
  const uy = dy / dist;
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const a = Math.acos(Math.min(1, Math.max(-1, cosA))) * -bend;
  const jx = ux * Math.cos(a) - uy * Math.sin(a);
  const jy = ux * Math.sin(a) + uy * Math.cos(a);
  const joint: Vec = [root[0] + jx * l1, root[1] + jy * l1];
  return { joint, end: [root[0] + ux * d, root[1] + uy * d] };
}

function lerpLimb(a: Limb, b: Limb, t: number): Limb {
  if ("angles" in a && "angles" in b) return { angles: [lerp(a.angles[0], b.angles[0], t), lerp(a.angles[1], b.angles[1], t)] };
  if ("reach" in a && "reach" in b) return { reach: lerpVec(a.reach, b.reach, t), bend: a.bend };
  throw new Error("A limb must use the same kind (angles or reach) in both poses");
}

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    hip: lerpVec(a.hip, b.hip, t),
    torso: lerp(a.torso, b.torso, t),
    armA: lerpLimb(a.armA, b.armA, t),
    armB: lerpLimb(a.armB, b.armB, t),
    legA: lerpLimb(a.legA, b.legA, t),
    legB: lerpLimb(a.legB, b.legB, t),
    footA: lerp(a.footA ?? 90, b.footA ?? 90, t),
    footB: lerp(a.footB ?? 90, b.footB ?? 90, t),
  };
}

function chain(root: Vec, limb: Limb, l1: number, l2: number, dir: 1 | -1): { joint: Vec; end: Vec } {
  if ("reach" in limb) return solveTwoBone(root, limb.reach, l1, l2, limb.bend);
  const joint = add(root, scale(unit(limb.angles[0], dir), l1));
  return { joint, end: add(joint, scale(unit(limb.angles[1], dir), l2)) };
}

// ---------------------------------------------------------------------------
// Skeleton → primitives
// ---------------------------------------------------------------------------

export type Skeleton = Record<"hipA" | "hipB" | "shoulderA" | "shoulderB" | "head", Vec> &
  Record<"elbowA" | "elbowB" | "handA" | "handB" | "kneeA" | "kneeB" | "ankleA" | "ankleB" | "toeA" | "toeB", Vec>;

export function skeletonAt(config: FigureConfig, movement: Pick<Movement, "amount" | "cycle" | "side">): Skeleton {
  const t = Math.min(1, Math.max(0, movement.amount));
  const pose = lerpPose(config.start, config.peak, t);
  if (config.arc) {
    const limb = pose[config.arc.limb];
    if ("reach" in limb) pose[config.arc.limb] = { ...limb, reach: [limb.reach[0], limb.reach[1] - config.arc.height * Math.sin(Math.PI * t)] };
  }
  const front = config.view === "front";
  const torsoDir = unit(pose.torso);
  const shoulder = add(pose.hip, scale(torsoDir, LEN.torso));
  const head = add(shoulder, scale(torsoDir, LEN.neck + LEN.head));
  const hipA: Vec = front ? [pose.hip[0] - FRONT.hip, pose.hip[1]] : pose.hip;
  const hipB: Vec = front ? [pose.hip[0] + FRONT.hip, pose.hip[1]] : pose.hip;
  const shoulderA: Vec = front ? [shoulder[0] - FRONT.shoulder, shoulder[1]] : shoulder;
  const shoulderB: Vec = front ? [shoulder[0] + FRONT.shoulder, shoulder[1]] : shoulder;

  let armA = pose.armA;
  let armB = pose.armB;
  if (config.orbit) {
    // Circle the hands around their straight-arm position; the direction
    // follows the engine's side (forward / backward).
    const sign = movement.side === "backward" ? -1 : 1;
    const theta = 2 * Math.PI * movement.cycle * sign;
    const r = config.orbit.radius;
    armA = orbitLimb(armA, shoulderA, -1, theta, r);
    armB = orbitLimb(armB, shoulderB, 1, theta, r);
  }

  // Front view: limb A is drawn on the screen's left, B mirrored on the right.
  const a = chain(shoulderA, armA, LEN.upperArm, LEN.forearm, front ? -1 : 1);
  const b = chain(shoulderB, armB, LEN.upperArm, LEN.forearm, 1);
  const la = chain(hipA, pose.legA, LEN.thigh, LEN.shin, front ? -1 : 1);
  const lb = chain(hipB, pose.legB, LEN.thigh, LEN.shin, 1);
  const toeA = add(la.end, front ? [-LEN.foot * 0.6, 0] : scale(unit(pose.footA ?? 90), LEN.foot));
  const toeB = add(lb.end, front ? [LEN.foot * 0.6, 0] : scale(unit(pose.footB ?? 90), LEN.foot));
  return {
    hipA, hipB, shoulderA, shoulderB, head,
    elbowA: a.joint, handA: a.end, elbowB: b.joint, handB: b.end,
    kneeA: la.joint, ankleA: la.end, kneeB: lb.joint, ankleB: lb.end, toeA, toeB,
  };
}

function orbitLimb(limb: Limb, shoulder: Vec, dir: 1 | -1, theta: number, r: number): Limb {
  const straight = "angles" in limb ? limb.angles[0] : 90;
  const hand = add(shoulder, scale(unit(straight, dir), LEN.upperArm + LEN.forearm - r * 0.4));
  return { reach: [hand[0] + dir * r * Math.sin(theta) * 0.35, hand[1] - r * Math.cos(theta)], bend: dir === 1 ? -1 : 1 };
}

/** SVG path for a tapered capsule. */
export function capsulePath(from: Vec, to: Vec, r1: number, r2: number): string {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  const f = (n: number) => Math.round(n * 100) / 100;
  if (len < 1e-6) {
    const r = Math.max(r1, r2);
    return `M${f(from[0] - r)} ${f(from[1])}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
  }
  const nx = -dy / len;
  const ny = dx / len;
  const a1 = [from[0] + nx * r1, from[1] + ny * r1];
  const b1 = [to[0] + nx * r2, to[1] + ny * r2];
  const b2 = [to[0] - nx * r2, to[1] - ny * r2];
  const a2 = [from[0] - nx * r1, from[1] - ny * r1];
  return (
    `M${f(a1[0])} ${f(a1[1])}L${f(b1[0])} ${f(b1[1])}` +
    `A${f(r2)} ${f(r2)} 0 0 0 ${f(b2[0])} ${f(b2[1])}` +
    `L${f(a2[0])} ${f(a2[1])}` +
    `A${f(r1)} ${f(r1)} 0 0 0 ${f(a1[0])} ${f(a1[1])}Z`
  );
}

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const norm = (a: Vec): Vec => {
  const n = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / n, a[1] / n];
};
/** Point `d` units from `a` towards `b`. */
const towards = (a: Vec, b: Vec, d: number): Vec => add(a, scale(norm(sub(b, a)), d));

/** exercise_library.target_muscles values the figure can show in red. */
export const SHOWN_MUSCLES = [
  "quadriceps", "hamstrings", "glutes", "glute_medius", "hip_abductors", "hip_flexors", "adductors", "calves",
  "biceps", "triceps", "forearms", "shoulders", "rear_shoulders", "chest", "core", "upper_back", "lats", "lower_back",
] as const;

/**
 * Primitives in draw order (far side first, near side on top). The focus
 * muscles (exercise_library.target_muscles) are painted red on top of the
 * clothes; for unilateral exercises only on the working limbs. Mirroring for
 * the right side is done by the renderer (a horizontal flip of the figure).
 */
export function figurePrimitives(
  config: FigureConfig,
  movement: Pick<Movement, "amount" | "cycle" | "side">,
  opts: { muscles?: readonly string[] } = {},
): Primitive[] {
  const s = skeletonAt(config, movement);
  const front = config.view === "front";
  const out: Primitive[] = [];
  const P = PALETTE;

  // Scene
  for (const p of config.props ?? []) {
    if (p.kind === "wall") out.push({ type: "rect", x: p.x, y: 14, w: 8, h: FLOOR_Y - 14, rx: 2, fill: P.prop });
    else if (p.kind === "box") out.push({ type: "rect", x: p.x, y: p.y, w: p.w, h: p.h, rx: 3, fill: P.prop });
    else out.push({ type: "rect", x: p.x1, y: FLOOR_Y - 2, w: p.x2 - p.x1, h: 4, rx: 2, fill: P.mat });
  }
  out.push({ type: "rect", x: 10, y: FLOOR_Y + 1.5, w: 180, h: 2.5, rx: 1.25, fill: P.floor });

  const hipMid = lerpVec(s.hipA, s.hipB, 0.5);
  const shoulderMid = lerpVec(s.shoulderA, s.shoulderB, 0.5);
  const up = norm(sub(shoulderMid, hipMid)); // along the spine, towards the head
  const face: Vec = [-up[1], up[0]]; // the way the figure looks (side view)
  // --- Focus muscles ------------------------------------------------------
  const muscles = new Set(opts.muscles ?? []);
  const has = (m: string) => muscles.has(m);
  const working = (name: LimbName) => {
    const same = config.active.filter((l) => l.slice(0, 3) === name.slice(0, 3));
    return same.length === 0 || same.includes(name);
  };
  /** Red patch along a→b between t0 and t1; side +1 = front of the body, −1 = back, 0 = centre. */
  const patch = (a: Vec, b: Vec, t0: number, t1: number, r1: number, r2: number, side: -1 | 0 | 1, off: number) => {
    let shift: Vec = [0, 0];
    if (!front && side !== 0) {
      const d = norm(sub(b, a));
      let n: Vec = [-d[1], d[0]];
      if (n[0] * face[0] + n[1] * face[1] < 0) n = [-n[0], -n[1]];
      shift = scale(n, side * off);
    }
    out.push({ type: "capsule", from: add(lerpVec(a, b, t0), shift), to: add(lerpVec(a, b, t1), shift), r1, r2, fill: P.muscle, opacity: 0.88 });
  };
  const spot = (at: Vec, r: number) => out.push({ type: "circle", at, r, fill: P.muscle, opacity: 0.88 });

  const legMuscles = (name: LimbName, hip: Vec, knee: Vec, ankle: Vec) => {
    if (!working(name)) return;
    if (has("quadriceps")) patch(hip, knee, 0.18, 0.82, 4.2, 3.4, 1, 2.3);
    if (has("hamstrings")) patch(hip, knee, 0.2, 0.8, 4, 3.2, -1, 2.3);
    if (has("hip_flexors")) patch(hip, knee, 0.02, 0.32, 3.4, 3, 1, 2.6);
    if (has("adductors")) {
      if (front) {
        const inward = hipMid[0] > hip[0] ? 2.4 : -2.4;
        out.push({ type: "capsule", from: add(lerpVec(hip, knee, 0.12), [inward, 0]), to: add(lerpVec(hip, knee, 0.7), [inward, 0]), r1: 3.4, r2: 2.6, fill: P.muscle, opacity: 0.88 });
      } else patch(hip, knee, 0.15, 0.65, 3.4, 2.6, 0, 0);
    }
    if (has("calves")) patch(knee, ankle, 0.12, 0.6, 3.8, 3, -1, 1.5);
  };
  const armMuscles = (name: LimbName, shoulder: Vec, elbow: Vec, wrist: Vec) => {
    if (!working(name)) return;
    if (has("biceps")) patch(shoulder, elbow, 0.22, 0.85, 3.2, 2.7, 1, 1.5);
    if (has("triceps")) patch(shoulder, elbow, 0.22, 0.85, 3.2, 2.7, -1, 1.5);
    if (has("forearms")) patch(elbow, wrist, 0.1, 0.8, 2.8, 2.4, 0, 0);
    if (has("shoulders")) spot(shoulder, 4.5);
    if (has("rear_shoulders")) spot(front ? shoulder : add(shoulder, scale(face, -1.8)), 4.2);
  };
  const torsoMuscles = () => {
    if (front) {
      if (has("core")) patch(hipMid, shoulderMid, 0.24, 0.55, 6, 6.5, 0, 0);
      if (has("chest")) {
        const c = lerpVec(shoulderMid, hipMid, 0.22);
        spot(add(c, [-5, 0]), 5);
        spot(add(c, [5, 0]), 5);
      }
      if (has("glutes") || has("glute_medius") || has("hip_abductors")) {
        spot(add(s.hipA, [-3, -2]), 4);
        spot(add(s.hipB, [3, -2]), 4);
      }
      return;
    }
    if (has("core")) patch(hipMid, shoulderMid, 0.22, 0.55, 4, 4.4, 1, 3.6);
    if (has("chest")) patch(hipMid, shoulderMid, 0.62, 0.86, 4.4, 4.8, 1, 3.8);
    if (has("upper_back")) patch(hipMid, shoulderMid, 0.58, 0.92, 4.4, 4.8, -1, 3.8);
    if (has("lats")) patch(hipMid, shoulderMid, 0.38, 0.75, 4, 4.4, -1, 4);
    if (has("lower_back")) patch(hipMid, shoulderMid, 0.12, 0.4, 3.6, 3.8, -1, 4);
  };
  /** Side view: drawn after the near leg, which would otherwise cover the hip. */
  const hipMuscles = () => {
    if (has("glutes")) spot(add(add(hipMid, scale(face, -4.2)), scale(up, 1.5)), 5.4);
    if (has("glute_medius") || has("hip_abductors")) spot(add(hipMid, scale(up, 4.5)), 4.6);
  };

  const leg = (name: "legA" | "legB", hip: Vec, knee: Vec, ankle: Vec, toe: Vec, far: boolean) => {
    const pants = far ? P.pantsFar : P.pants;
    out.push(
      { type: "capsule", from: hip, to: knee, r1: 6.8, r2: 5, fill: pants },
      { type: "capsule", from: knee, to: ankle, r1: 5, r2: 4, fill: pants },
    );
    legMuscles(name, hip, knee, ankle);
    // Trainer: heel a little behind the ankle, sole outline underneath.
    const heel = front ? ankle : towards(ankle, toe, -2.5);
    const tip = front ? toe : towards(ankle, toe, LEN.foot + 1);
    out.push(
      { type: "capsule", from: heel, to: tip, r1: 4.6, r2: 3.9, fill: P.sole },
      { type: "capsule", from: heel, to: tip, r1: 3.7, r2: 3, fill: far ? P.shoeFar : P.shoe },
    );
  };

  const arm = (name: "armA" | "armB", shoulder: Vec, elbow: Vec, hand: Vec, far: boolean) => {
    const sleeve = far ? P.topFar : P.top;
    const wrist = towards(hand, elbow, 2.5);
    out.push(
      { type: "capsule", from: shoulder, to: elbow, r1: 4.8, r2: 3.9, fill: sleeve },
      { type: "capsule", from: elbow, to: wrist, r1: 3.9, r2: 3.2, fill: sleeve },
    );
    armMuscles(name, shoulder, elbow, wrist);
    out.push({ type: "circle", at: hand, r: 3.4, fill: P.skin });
  };

  const dumbbell = (hand: Vec, elbow: Vec) => {
    const along = norm(sub(hand, elbow));
    const across: Vec = [-along[1], along[0]];
    const a = add(hand, scale(across, 7));
    const b = add(hand, scale(across, -7));
    out.push(
      { type: "capsule", from: a, to: b, r1: 1.6, r2: 1.6, fill: P.weight },
      { type: "capsule", from: a, to: add(a, scale(across, -2.5)), r1: 3.8, r2: 3.8, fill: P.plate },
      { type: "capsule", from: b, to: add(b, scale(across, 2.5)), r1: 3.8, r2: 3.8, fill: P.plate },
    );
  };

  const head = () => {
    const neckBase = add(shoulderMid, scale(up, front ? 0 : 1));
    out.push({ type: "capsule", from: neckBase, to: add(s.head, scale(up, -5)), r1: 3.8, r2: 3.4, fill: P.skin });
    if (front) {
      out.push(
        { type: "circle", at: add(s.head, scale(up, 9.5)), r: 4.6, fill: P.hair }, // bun
        { type: "circle", at: s.head, r: LEN.head + 0.8, fill: P.hair },
        { type: "ellipse", at: add(s.head, scale(up, -1.8)), rx: 7.6, ry: 7.8, fill: P.skin },
        { type: "circle", at: add(add(s.head, scale(face, 3)), scale(up, -1)), r: 1, fill: P.eye },
        { type: "circle", at: add(add(s.head, scale(face, -3)), scale(up, -1)), r: 1, fill: P.eye },
      );
    } else {
      out.push(
        { type: "circle", at: add(add(s.head, scale(up, 6)), scale(face, -6.5)), r: 4.4, fill: P.hair }, // bun
        { type: "circle", at: s.head, r: LEN.head + 0.6, fill: P.hair },
        { type: "circle", at: add(add(s.head, scale(face, 1.8)), scale(up, -1.4)), r: LEN.head - 1, fill: P.skin },
        { type: "circle", at: add(add(s.head, scale(face, 5.3)), scale(up, 0.4)), r: 1.05, fill: P.eye },
      );
    }
  };

  const torso = () => {
    if (front) {
      out.push(
        { type: "capsule", from: s.hipA, to: s.hipB, r1: 7, r2: 7, fill: P.pants },
        { type: "capsule", from: hipMid, to: add(hipMid, scale(up, 10)), r1: 9.5, r2: 10, fill: P.pants },
        { type: "capsule", from: add(hipMid, scale(up, 9)), to: add(shoulderMid, scale(up, -3)), r1: 10.5, r2: 12.5, fill: P.top },
        { type: "capsule", from: s.shoulderA, to: s.shoulderB, r1: 5.5, r2: 5.5, fill: P.top },
      );
    } else {
      out.push(
        { type: "capsule", from: hipMid, to: add(hipMid, scale(up, 12)), r1: 8.4, r2: 7.6, fill: P.pants },
        { type: "capsule", from: add(hipMid, scale(up, 9)), to: shoulderMid, r1: 7.6, r2: 8.6, fill: P.top },
      );
    }
    torsoMuscles();
  };

  if (front) {
    leg("legA", s.hipA, s.kneeA, s.ankleA, s.toeA, false);
    leg("legB", s.hipB, s.kneeB, s.ankleB, s.toeB, false);
    torso();
    head();
    arm("armA", s.shoulderA, s.elbowA, s.handA, false);
    arm("armB", s.shoulderB, s.elbowB, s.handB, false);
    if (config.dumbbells === "both") {
      dumbbell(s.handA, s.elbowA);
      dumbbell(s.handB, s.elbowB);
    }
  } else {
    leg("legB", s.hipB, s.kneeB, s.ankleB, s.toeB, true);
    arm("armB", s.shoulderB, s.elbowB, s.handB, true);
    if (config.dumbbells === "both") dumbbell(s.handB, s.elbowB);
    torso();
    head();
    leg("legA", s.hipA, s.kneeA, s.ankleA, s.toeA, false);
    hipMuscles();
    arm("armA", s.shoulderA, s.elbowA, s.handA, false);
    if (config.dumbbells === "both" || config.dumbbells === "armA") dumbbell(s.handA, s.elbowA);
  }
  if (config.dumbbells === "together") {
    // One dumbbell held vertically in both hands (goblet, overhead extension).
    const mid = lerpVec(s.handA, s.handB, 0.5);
    const a = add(mid, scale(up, 7));
    const b = add(mid, scale(up, -7));
    out.push(
      { type: "capsule", from: a, to: b, r1: 1.8, r2: 1.8, fill: P.weight },
      { type: "capsule", from: a, to: add(a, scale(up, -2.5)), r1: 4.2, r2: 4.2, fill: P.plate },
      { type: "capsule", from: b, to: add(b, scale(up, 2.5)), r1: 4.2, r2: 4.2, fill: P.plate },
      { type: "circle", at: mid, r: 3.4, fill: P.skin },
    );
  }
  return out;
}

export function viewBoxFor(config: FigureConfig): string {
  const top = config.top ?? 0;
  return `0 ${top} ${VIEWBOX.width} ${VIEWBOX.height - top}`;
}

export function isMirrored(movement: Pick<Movement, "side">): boolean {
  return movement.side === "right";
}
