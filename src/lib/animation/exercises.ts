/**
 * Start and peak poses for every exercise in the library (keyed by
 * exercise_library.id). "Peak" is where the first tempo phase ends: the bottom
 * of a squat, the top of a curl, the raised hips of a bridge.
 *
 * Side-view figures face right; for unilateral exercises the near limbs (A)
 * are the working ones on the left side, and the figure is mirrored for the
 * right side. Exercises without a figure fall back to the static
 * illustration, never to a generic animation.
 */
import type { FigureConfig, Pose } from "./figure.ts";

const GROUND = 146; // ankle height when the foot is flat on the floor

/** Standing, side view. */
const stand = (over: Partial<Pose> = {}): Pose => ({
  hip: [98, 82],
  torso: 180,
  armA: { angles: [6, 10] },
  armB: { angles: [2, 6] },
  legA: { reach: [101, GROUND], bend: 1 },
  legB: { reach: [97, GROUND], bend: 1 },
  ...over,
});

/** Standing, front view (A = screen left). */
const standFront = (over: Partial<Pose> = {}): Pose => ({
  hip: [100, 82],
  torso: 180,
  armA: { angles: [8, 6] },
  armB: { angles: [8, 6] },
  legA: { reach: [89, GROUND], bend: -1 },
  legB: { reach: [111, GROUND], bend: 1 },
  ...over,
});

/** Hands and knees, side view (bird dog, donkey kick). */
const quadruped = (over: Partial<Pose> = {}): Pose => ({
  hip: [74, 109],
  torso: 100,
  armA: { angles: [1, 1] },
  armB: { angles: [-1, -1] },
  legA: { angles: [0, -90] },
  legB: { angles: [2, -90] },
  footA: -90,
  footB: -90,
  ...over,
});

/** Lying on the back, knees bent, feet flat (glute bridge). */
const bridgeStart = (over: Partial<Pose> = {}): Pose => ({
  hip: [112, 141],
  torso: -90,
  armA: { angles: [84, 90] },
  armB: { angles: [86, 90] },
  legA: { reach: [148, GROUND], bend: 1 },
  legB: { reach: [145, GROUND], bend: 1 },
  ...over,
});
const bridgePeak = (over: Partial<Pose> = {}): Pose => ({
  ...bridgeStart(),
  hip: [113, 117],
  torso: -60,
  ...over,
});

const squat: FigureConfig = {
  view: "side",
  start: stand({ armA: { angles: [10, 14] }, armB: { angles: [6, 10] } }),
  peak: stand({ hip: [80, 112], torso: 142, armA: { angles: [86, 90] }, armB: { angles: [82, 88] } }),
  active: ["legA", "legB"],
};

const gobletArms = { armA: { angles: [22, 160] as const }, armB: { angles: [18, 158] as const } };
const goblet: FigureConfig = {
  view: "side",
  start: stand(gobletArms),
  peak: stand({ hip: [80, 112], torso: 146, armA: { angles: [48, 170] }, armB: { angles: [44, 168] } }),
  active: ["legA", "legB"],
  dumbbells: "together",
};

const sumo = (withDumbbell: boolean): FigureConfig => {
  const arms = withDumbbell
    ? { armA: { angles: [-10, -14] as const }, armB: { angles: [-10, -14] as const } }
    : { armA: { angles: [24, -128] as const }, armB: { angles: [24, -128] as const } };
  const legs = { legA: { reach: [74, GROUND] as const, bend: -1 as const }, legB: { reach: [126, GROUND] as const, bend: 1 as const } };
  return {
    view: "front",
    start: standFront({ ...arms, ...legs, hip: [100, 84] }),
    peak: standFront({ ...arms, ...legs, hip: [100, 108] }),
    active: ["legA", "legB"],
    dumbbells: withDumbbell ? "together" : undefined,
  };
};

const bridge = (withDumbbell: boolean): FigureConfig => {
  const startArms = withDumbbell ? { armA: { angles: [86, 94] as const }, armB: { angles: [88, 96] as const } } : {};
  const peakArms = withDumbbell ? { armA: { angles: [112, 128] as const }, armB: { angles: [114, 130] as const } } : {};
  return {
    view: "side",
    start: bridgeStart(startArms),
    peak: bridgePeak(peakArms),
    active: ["legA", "legB"],
    dumbbells: withDumbbell ? "together" : undefined,
    props: [{ kind: "mat", x1: 30, x2: 170 }],
  };
};

const lunge = (withDumbbells: boolean): FigureConfig => {
  const arms = withDumbbells
    ? { armA: { angles: [2, 2] as const }, armB: { angles: [-2, -2] as const } }
    : { armA: { angles: [-28, 70] as const }, armB: { angles: [-32, 66] as const } };
  return {
    view: "side",
    start: stand({ ...arms, hip: [100, 82], legA: { reach: [103, GROUND], bend: 1 }, legB: { reach: [99, GROUND], bend: 1 } }),
    peak: stand({
      ...arms,
      hip: [96, 106],
      legA: { reach: [120, GROUND], bend: 1 },
      legB: { reach: [60, 141], bend: 1 },
      footB: 40,
    }),
    active: ["legA"],
    arc: { limb: "legB", height: 10 },
    dumbbells: withDumbbells ? "both" : undefined,
  };
};

const calf = (withDumbbells: boolean): FigureConfig => ({
  view: "side",
  start: stand(),
  peak: stand({ hip: [98, 74], legA: { reach: [101, 138], bend: 1 }, legB: { reach: [97, 138], bend: 1 }, footA: 30, footB: 30 }),
  active: ["legA", "legB"],
  dumbbells: withDumbbells ? "both" : undefined,
});

const row = (oneArm: boolean): FigureConfig => {
  if (oneArm) {
    const base = (armA: Pose["armA"]): Pose => ({
      hip: [76, 92],
      torso: 104,
      armA,
      armB: { reach: [140, 113], bend: -1 },
      legA: { reach: [94, GROUND], bend: 1 },
      legB: { reach: [64, GROUND], bend: 1 },
    });
    return {
      view: "side",
      start: base({ angles: [0, 0] }),
      peak: base({ angles: [-112, 2] }),
      active: ["armA"],
      dumbbells: "armA",
      props: [{ kind: "box", x: 128, y: 113, w: 42, h: 37 }],
    };
  }
  const base = (a: readonly [number, number], b: readonly [number, number]): Pose => ({
    hip: [84, 90],
    torso: 120,
    armA: { angles: a },
    armB: { angles: b },
    legA: { reach: [100, GROUND], bend: 1 },
    legB: { reach: [96, GROUND], bend: 1 },
  });
  return {
    view: "side",
    start: base([0, 0], [-2, -2]),
    peak: base([-114, 2], [-118, 0]),
    active: ["armA", "armB"],
    dumbbells: "both",
  };
};

export const EXERCISE_FIGURES: Record<string, FigureConfig> = {
  "bodyweight-squat": squat,
  "goblet-squat": goblet,
  "sumo-squat": sumo(false),
  "dumbbell-sumo-squat": sumo(true),
  "glute-bridge": bridge(false),
  "dumbbell-glute-bridge": bridge(true),
  "reverse-lunge": lunge(false),
  "dumbbell-reverse-lunge": lunge(true),
  "calf-raise": calf(false),
  "dumbbell-calf-raise": calf(true),
  "donkey-kick": {
    view: "side",
    start: quadruped(),
    peak: quadruped({ legA: { angles: [-96, -182] }, footA: -92 }), // −182 = up, reached by swinging back
    active: ["legA"],
    props: [{ kind: "mat", x1: 30, x2: 160 }],
  },
  "bird-dog": {
    view: "side",
    start: quadruped(),
    peak: quadruped({ armA: { angles: [96, 96] }, legB: { angles: [-93, -93] }, footB: -180 }),
    active: ["armA", "legB"],
    props: [{ kind: "mat", x1: 20, x2: 175 }],
  },
  "dead-bug": {
    view: "side",
    start: {
      hip: [112, 141],
      torso: -90,
      armA: { angles: [180, 180] },
      armB: { angles: [178, 178] },
      legA: { angles: [180, 90] },
      legB: { angles: [178, 88] },
      footA: 180,
      footB: 180,
    },
    peak: {
      hip: [112, 141],
      torso: -90,
      armA: { angles: [258, 260] }, // overhead, swinging back over the head (not through the floor)
      armB: { angles: [178, 178] },
      legA: { angles: [180, 90] },
      legB: { angles: [96, 94] },
      footA: 180,
      footB: 175,
    },
    active: ["armA", "legB"],
    props: [{ kind: "mat", x1: 30, x2: 185 }],
  },
  "prone-w-raise": {
    view: "side",
    start: {
      hip: [86, 141],
      torso: 90,
      armA: { angles: [-92, 88] },
      armB: { angles: [-90, 86] },
      legA: { angles: [-90, -90] },
      legB: { angles: [-91, -91] },
      footA: 0,
      footB: 0,
    },
    peak: {
      hip: [86, 141],
      torso: 99,
      armA: { angles: [-124, 140] },
      armB: { angles: [-122, 138] },
      legA: { angles: [-90, -90] },
      legB: { angles: [-91, -91] },
      footA: 0,
      footB: 0,
    },
    active: ["armA", "armB"],
    props: [{ kind: "mat", x1: 15, x2: 165 }],
  },
  "side-lying-leg-raise": {
    view: "side",
    start: {
      hip: [102, 141],
      torso: -90,
      armA: { angles: [60, 110] },
      armB: { angles: [-150, -60] },
      legA: { angles: [91, 91] },
      legB: { angles: [90, 90] },
      footA: 180,
      footB: 180,
    },
    peak: {
      hip: [102, 141],
      torso: -90,
      armA: { angles: [60, 110] },
      armB: { angles: [-150, -60] },
      legA: { angles: [128, 128] },
      legB: { angles: [90, 90] },
      footA: 216,
      footB: 180,
    },
    active: ["legA"],
    props: [{ kind: "mat", x1: 25, x2: 180 }],
  },
  "standing-knee-raise": {
    view: "side",
    start: stand({ legA: { angles: [0, 0] }, armA: { angles: [-26, 70] }, armB: { angles: [-30, 66] } }),
    peak: stand({ legA: { angles: [92, 0] }, armA: { angles: [-26, 70] }, armB: { angles: [-30, 66] } }),
    active: ["legA"],
  },
  "wall-push-up": {
    view: "side",
    start: {
      hip: [100, 85],
      torso: 160,
      armA: { reach: [160, 50], bend: -1 },
      armB: { reach: [160, 52], bend: -1 },
      legA: { reach: [78, GROUND], bend: 1 },
      legB: { reach: [75, GROUND], bend: 1 },
      footA: 105,
      footB: 105,
    },
    peak: {
      hip: [115, 93],
      torso: 145,
      armA: { reach: [160, 50], bend: -1 },
      armB: { reach: [160, 52], bend: -1 },
      legA: { reach: [78, GROUND], bend: 1 },
      legB: { reach: [75, GROUND], bend: 1 },
      footA: 125,
      footB: 125,
    },
    active: ["armA", "armB"],
    props: [{ kind: "wall", x: 161 }],
  },
  "arm-circles": {
    view: "front",
    start: standFront({ armA: { angles: [90, 90] }, armB: { angles: [90, 90] } }),
    peak: standFront({ armA: { angles: [90, 90] }, armB: { angles: [90, 90] } }),
    active: ["armA", "armB"],
    orbit: { radius: 8 },
    top: -6,
  },
  plank: {
    view: "side",
    start: {
      hip: [96, 124],
      torso: 95,
      armA: { angles: [0, 90] },
      armB: { angles: [-2, 90] },
      legA: { reach: [33, 141], bend: 1 },
      legB: { reach: [36, 141], bend: 1 },
      footA: 4,
      footB: 4,
    },
    // Breathing: the ribcage rises a little.
    peak: {
      hip: [96, 123],
      torso: 96.5,
      armA: { angles: [0, 90] },
      armB: { angles: [-2, 90] },
      legA: { reach: [33, 141], bend: 1 },
      legB: { reach: [36, 141], bend: 1 },
      footA: 4,
      footB: 4,
    },
    active: [],
    props: [{ kind: "mat", x1: 20, x2: 180 }],
  },
  "shoulder-press": {
    view: "front",
    start: standFront({ armA: { angles: [96, 178] }, armB: { angles: [96, 178] } }),
    peak: standFront({ armA: { angles: [160, 172] }, armB: { angles: [160, 172] } }),
    active: ["armA", "armB"],
    dumbbells: "both",
    top: -16,
  },
  "lateral-raise": {
    view: "front",
    start: standFront({ armA: { angles: [10, 8] }, armB: { angles: [10, 8] } }),
    peak: standFront({ armA: { angles: [86, 90] }, armB: { angles: [86, 90] } }),
    active: ["armA", "armB"],
    dumbbells: "both",
  },
  "bicep-curl": {
    view: "side",
    start: stand({ armA: { angles: [4, 4] }, armB: { angles: [0, 0] } }),
    peak: stand({ armA: { angles: [6, 152] }, armB: { angles: [2, 148] } }),
    active: ["armA", "armB"],
    dumbbells: "both",
  },
  "overhead-triceps-extension": {
    view: "side",
    start: stand({ armA: { angles: [170, 176] }, armB: { angles: [166, 174] } }),
    peak: stand({ armA: { angles: [168, 336] }, armB: { angles: [164, 334] } }), // forearm lowers behind the head
    active: ["armA", "armB"],
    dumbbells: "together",
    top: -16,
  },
  "dumbbell-romanian-deadlift": {
    view: "side",
    start: stand({ armA: { angles: [2, 2] }, armB: { angles: [-2, -2] } }),
    peak: stand({ hip: [82, 86], torso: 112, armA: { angles: [0, 0] }, armB: { angles: [-2, -2] } }),
    active: ["legA", "legB"],
    dumbbells: "both",
  },
  "bent-over-row": row(false),
  "one-arm-dumbbell-row": row(true),
};

export function figureFor(exerciseId: string): FigureConfig | null {
  return EXERCISE_FIGURES[exerciseId] ?? null;
}
