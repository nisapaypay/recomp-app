import type { IsoDate } from "./calendar.ts";
import type { Tempo } from "./estimate.ts";
import type { ExerciseCategory, MeasureType, SideMode } from "./types.ts";

function utcDate(date: IsoDate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const FORMATS = {
  /** Mon, 9 Nov 2026 */
  long: { weekday: "short", day: "numeric", month: "short", year: "numeric" },
  /** Monday, 9 November */
  full: { weekday: "long", day: "numeric", month: "long" },
  /** 9 Nov */
  short: { day: "numeric", month: "short" },
  /** 9 Nov 2026 */
  medium: { day: "numeric", month: "short", year: "numeric" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export function formatDate(date: IsoDate, style: keyof typeof FORMATS = "long"): string {
  return new Intl.DateTimeFormat("en-GB", { ...FORMATS[style], timeZone: "UTC" }).format(utcDate(date));
}

/** "Tue 10 Nov, 08:12" in the program timezone (WIB). */
export function formatDateTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(isoTimestamp));
}

export function formatTempo(tempo: Tempo | null): string | null {
  return tempo ? `${tempo.eccentric}-${tempo.pause}-${tempo.concentric}` : null;
}

export function formatRange(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

const SIDE_SUFFIX: Record<SideMode, string> = {
  none: "",
  per_side: " per side",
  per_direction: " each direction",
};

/** "2 × 12", "3 × 12–15", "2 × 10 per side", "3 × 20–30 s". */
export function formatPrescription(p: {
  sets: number;
  targetMin: number;
  targetMax: number;
  measureType: MeasureType;
  sideMode: SideMode;
}): string {
  const unit = p.measureType === "seconds" ? " s" : "";
  return `${p.sets} × ${formatRange(p.targetMin, p.targetMax)}${unit}${SIDE_SUFFIX[p.sideMode]}`;
}

export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

export const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  lower_body: "Lower body",
  upper_body: "Upper body",
  core: "Core",
  full_body: "Full body",
  mobility: "Mobility",
};

export const EQUIPMENT_LABEL = { bodyweight: "Bodyweight", dumbbells: "2 × 3 kg dumbbells" } as const;

/** "glute_medius" → "Glute medius" */
export function humanize(token: string): string {
  const text = token.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
