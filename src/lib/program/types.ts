import type { IsoDate } from "./calendar.ts";
import type { Tempo } from "./estimate.ts";
import type { ActivityType, DayOfWeek } from "./schedule.ts";

export type ProgramStatus = "active" | "completed" | "abandoned";

export type UserProgram = {
  id: string;
  startDate: IsoDate;
  endDate: IsoDate;
  status: ProgramStatus;
};

export type ExerciseCategory = "lower_body" | "upper_body" | "core" | "full_body" | "mobility";
export type MeasureType = "reps" | "seconds";
export type SideMode = "none" | "per_side" | "per_direction";

export type Exercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  targetMuscles: string[];
  equipment: "bodyweight" | "dumbbells";
  measureType: MeasureType;
  sideMode: SideMode;
  defaultTempo: Tempo | null;
  defaultRestSeconds: number;
  difficulty: "beginner" | "intermediate";
  description: string | null;
  startingPosition: string | null;
  executionSteps: string[];
  breathing: string | null;
  commonMistakes: string[];
  safeModifications: string[];
  illustrationPath: string | null;
};

/** Base prescription from program_exercises with library defaults applied. */
export type Prescription = {
  id: string;
  weekNumber: number;
  dayOfWeek: DayOfWeek;
  orderIndex: number;
  sets: number;
  targetMin: number;
  targetMax: number;
  tempo: Tempo | null;
  restSeconds: number;
  notes: string | null;
  exercise: Exercise;
};

export type ProgramDay = {
  weekNumber: number;
  dayOfWeek: DayOfWeek;
  activity: ActivityType;
  walkingTargetMinutes: { min: number; max: number } | null;
};
