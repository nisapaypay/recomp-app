/**
 * Exercise results from recorded set rows (pure; used by server actions and
 * the summary). A set counts only when every required side is recorded.
 */
export type SetRow = {
  set_number: number;
  side: string | null;
  achieved: number;
  status: "completed" | "partial" | "skipped";
};

export type ExerciseStatus = "pending" | "in_progress" | "completed" | "partial" | "skipped";

export function sidesFor(sideMode: string): (string | null)[] {
  if (sideMode === "per_side") return ["left", "right"];
  if (sideMode === "per_direction") return ["forward", "backward"];
  return [null];
}

export function exerciseResult(
  prescribedSets: number,
  sideMode: string,
  rows: SetRow[],
  final: boolean,
): { completedSets: number; status: ExerciseStatus } {
  const sides = sidesFor(sideMode);
  const find = (set: number, side: string | null) =>
    rows.find((r) => r.set_number === set && (r.side ?? null) === side);

  let doneSets = 0;
  let fullSets = 0;
  let skippedSets = 0;
  for (let set = 1; set <= prescribedSets; set++) {
    const sideRows = sides.map((side) => find(set, side));
    if (sideRows.some((r) => !r)) continue;
    if (sideRows.every((r) => r!.status === "skipped")) skippedSets += 1;
    else if (sideRows.every((r) => r!.status !== "skipped")) {
      doneSets += 1;
      if (sideRows.every((r) => r!.status === "completed")) fullSets += 1;
    }
  }

  const anyWork = rows.some((r) => r.status !== "skipped");
  let status: ExerciseStatus;
  if (fullSets === prescribedSets) status = "completed";
  else if (!anyWork && skippedSets === prescribedSets) status = "skipped";
  else if (!final) status = rows.length > 0 ? "in_progress" : "pending";
  else if (anyWork) status = "partial";
  else status = rows.length > 0 ? "skipped" : "pending";

  return { completedSets: doneSets, status };
}
