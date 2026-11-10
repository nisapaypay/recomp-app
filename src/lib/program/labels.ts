import { toMinutes } from "./estimate.ts";

/** "≈ 23 min" — the estimate is a planning aid, so it's always marked approximate. */
export function estimateLabel(seconds: number): string {
  return `≈ ${toMinutes(seconds)} min`;
}
