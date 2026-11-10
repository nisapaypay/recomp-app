import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft, Clock, Footprints, Leaf, Play, Timer } from "lucide-react";
import { PageContainer } from "@/components/layout/page";
import { ExerciseCover } from "@/components/exercise/exercise-cover";
import { ACTIVITY_ICON } from "@/components/program/weekly-schedule";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isIsoDate, phaseForWeek, programWeekFor } from "@/lib/program/calendar";
import { formatDate, formatDateTime, formatPrescription, formatSeconds, formatTempo } from "@/lib/program/format";
import { isCatchUp, workoutStartAvailability, type StartAvailability } from "@/lib/program/start-rules";
import { estimateLabel } from "@/lib/program/labels";
import { estimateExerciseSeconds } from "@/lib/program/estimate";
import { isStrengthDay } from "@/lib/program/schedule";
import { describeChange } from "@/lib/progression/adaptive";
import { mondayOf, type IsoDate } from "@/lib/program/calendar";
import { formatDuration, formatKm, formatPace, paceSecondsPerKm, targetStatus } from "@/lib/walking/walking";
import { getWalks, type Walk } from "@/server/walking/queries";
import { getAdjustmentHistory, type AdjustmentView } from "@/server/progression/queries";
import { getCurrentProgram } from "@/server/program/queries";
import { StartWorkoutButton } from "@/components/workout/start-workout-button";
import { getActiveSession, getFinishedSessionForDate, type SessionInfo } from "@/server/workout/queries";
import { getProgramOverview, getWeekView, toEstimateInput, type DayView } from "@/server/program/view";

export const metadata: Metadata = { title: "Workout day" };

export default function WorkoutDayPage({ params }: PageProps<"/workout/day/[date]">) {
  return (
    <PageContainer>
      <Link
        href="/workout"
        className="mb-4 inline-flex h-11 items-center gap-1 rounded-control pr-2 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <ChevronLeft aria-hidden className="size-4.5" />
        Workout
      </Link>
      <Suspense fallback={<DaySkeleton />}>
        <DayContent params={params} />
      </Suspense>
    </PageContainer>
  );
}

async function DayContent({ params }: { params: PageProps<"/workout/day/[date]">["params"] }) {
  const { date } = await params;
  if (!isIsoDate(date)) notFound();

  const program = await getCurrentProgram();
  if (!program || program.status !== "active") {
    return (
      <EmptyState
        icon={Timer}
        title="No active program"
        description="Start your 12-week program to see daily workouts."
        action={<ButtonLink href="/workout">Go to Workout</ButtonLink>}
      />
    );
  }

  const week = programWeekFor(program.startDate, date);
  if (week < 1 || week > 12) {
    return (
      <EmptyState
        icon={Timer}
        title="Outside your program"
        description={`${formatDate(date)} is not within your program (${formatDate(program.startDate, "medium")} – ${formatDate(program.endDate, "medium")}).`}
        action={<ButtonLink href="/workout">Go to Workout</ButtonLink>}
      />
    );
  }

  const overview = await getProgramOverview(program);
  const day = (await getWeekView(overview, week)).find((d) => d.date === date);
  if (!day) notFound();

  const [active, finished, adjustments] = await Promise.all([
    getActiveSession(),
    getFinishedSessionForDate(date),
    isStrengthDay(day.activity) && day.status !== "completed" ? getAdjustmentHistory() : Promise.resolve([]),
  ]);
  const walk = day.activity === "walking" ? ((await getWalks()).find((w) => w.scheduledDate === date) ?? null) : null;
  // Latest adjustment per exercise of THIS workout type that appears today.
  const ids = new Set(day.prescriptions.map((p) => p.exercise.id));
  const adjusted = new Map<string, AdjustmentView>();
  for (const a of adjustments) {
    if (a.activityType === day.activity && ids.has(a.exerciseId) && !adjusted.has(a.exerciseId)) adjusted.set(a.exerciseId, a);
  }
  const availability = workoutStartAvailability({
    date,
    today: overview.today,
    activity: day.activity,
    completed: day.status === "completed",
    activeElsewhere: active !== null && active.scheduledDate !== date,
    programStart: program.startDate,
    programEnd: program.endDate,
  });
  return (
    <DayDetail
      day={day}
      week={week}
      programId={program.id}
      active={active}
      finished={finished}
      availability={availability}
      adjusted={[...adjusted.values()]}
      walk={walk}
      today={overview.today}
    />
  );
}

function DayDetail({
  day,
  week,
  programId,
  active,
  finished,
  availability,
  adjusted,
  walk,
  today,
}: {
  day: DayView;
  week: number;
  programId: string;
  active: SessionInfo | null;
  finished: SessionInfo | null;
  availability: StartAvailability;
  adjusted: AdjustmentView[];
  walk: Walk | null;
  today: IsoDate;
}) {
  const Icon = ACTIVITY_ICON[day.activity];
  const strength = isStrengthDay(day.activity);
  const activeHere = active !== null && active.scheduledDate === day.date;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 flex items-center gap-2 text-overline uppercase text-accent-600">
            Week {week} · {phaseForWeek(week).name}
          </p>
          <h1 className="flex items-center gap-3 text-title md:text-display">
            <Icon aria-hidden className="size-7 text-accent-600 md:size-8" />
            {day.activityLabel}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[0.9375rem] text-ink-muted">
            Scheduled {formatDate(day.date, "full")}
            <StatusBadge status={day.status} />
          </p>
          {day.status === "completed" && day.performedAt ? (
            <p className="mt-1 text-sm text-ink-muted">
              Performed {formatDateTime(day.performedAt)}
              {isCatchUp(day.date, day.performedAt) ? " · catch-up" : ""}
            </p>
          ) : null}
        </div>
        {strength ? (
          <div className="flex max-w-sm flex-col items-stretch gap-2 md:items-end md:text-right">
            {activeHere ? (
              <ButtonLink href={`/workout/session/${active!.id}`} size="lg">
                <Play aria-hidden className="size-5" />
                Open workout
              </ButtonLink>
            ) : null}
            {finished && !activeHere ? (
              <ButtonLink href={`/workout/session/${finished.id}/summary`} size="lg" variant="secondary">
                {finished.status === "completed" ? "View summary" : "View stopped attempt"}
              </ButtonLink>
            ) : null}
            {!activeHere && availability.kind === "available" ? (
              <StartWorkoutButton
                programId={programId}
                scheduledDate={day.date}
                catchUp={availability.catchUp}
                scheduledLabel={formatDate(day.date, "full")}
              />
            ) : null}
            <StartNote availability={availability} active={activeHere ? null : active} />
          </div>
        ) : null}
      </header>

      {strength && adjusted.length > 0 ? (
        <Alert tone="info">
          <p className="font-medium">Your feedback has adjusted this workout</p>
          <ul className="mt-1 space-y-0.5">
            {adjusted.map((a) => (
              <li key={a.id}>
                {a.exerciseName}: latest change {describeChange(a)}
              </li>
            ))}
          </ul>
          <p className="mt-1">
            The list below shows the original program; the workout itself uses your adjusted targets (within safe
            limits). See Progress → Training adjustments for the reasons.
          </p>
        </Alert>
      ) : null}

      {strength ? <StrengthDay day={day} /> : null}

      {day.activity === "walking" && day.walkingTargetMinutes ? (
        <Card padding="lg">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-50 text-accent-600">
              <Footprints aria-hidden className="size-6" />
            </span>
            <div>
              <p className="text-heading">
                Target:{" "}
                {day.walkingTargetMinutes.min === day.walkingTargetMinutes.max
                  ? `${day.walkingTargetMinutes.min} minutes`
                  : `${day.walkingTargetMinutes.min}–${day.walkingTargetMinutes.max} minutes`}
              </p>
              {walk ? (
                <p className="mt-1 text-sm text-ink-muted">
                  Logged: {formatDuration(walk.durationMinutes)}
                  {walk.distanceKm !== null ? ` · ${formatKm(walk.distanceKm)}` : ""}
                  {formatPace(paceSecondsPerKm(walk.durationMinutes, walk.distanceKm))
                    ? ` · ${formatPace(paceSecondsPerKm(walk.durationMinutes, walk.distanceKm))}`
                    : ""}
                  {walk.activityDate !== day.date ? ` · walked ${formatDate(walk.activityDate, "medium")} (catch-up)` : ""}
                  {" · "}
                  {targetStatus(walk.durationMinutes, day.walkingTargetMinutes.min) === "met" ? "target met ✓" : "below target"}
                </p>
              ) : (
                <p className="mt-1 text-sm text-ink-muted">
                  Track the walk on your Apple Watch (or any device), then log duration and distance here. It counts
                  for this day even if you log it later.
                </p>
              )}
              <div className="mt-3">
                {walk ? (
                  <ButtonLink href={`/walking/${walk.id}`} variant="secondary" size="sm">
                    View walk
                  </ButtonLink>
                ) : mondayOf(day.date) <= today ? (
                  <ButtonLink href={`/walking?walk=${day.date}#log`} size="sm">
                    Log this walk
                  </ButtonLink>
                ) : (
                  <p className="text-caption text-ink-muted">You can log it once its program week starts.</p>
                )}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {day.activity === "recovery" ? (
        <Card padding="lg">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-50 text-accent-600">
              <Leaf aria-hidden className="size-6" />
            </span>
            <div>
              <p className="text-heading">Recovery and gentle stretching</p>
              <p className="mt-1 text-sm text-ink-muted">
                A guided stretching routine hasn&apos;t been defined yet. Until then, keep today light: gentle
                movement and stretches that feel comfortable, never painful.
              </p>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function StartNote({ availability, active }: { availability: StartAvailability; active: SessionInfo | null }) {
  let text: string | null = null;
  if (availability.kind === "not_yet") {
    text = `Scheduled for ${formatDate(availability.availableOn, "long")}. You can preview it now and start it on that day.`;
  } else if (availability.kind === "available" && availability.catchUp) {
    text = `${availability.daysLate} ${availability.daysLate === 1 ? "day" : "days"} late. You can still do it — it counts for its scheduled day.`;
  } else if (availability.kind === "active_elsewhere" && active) {
    text = `Finish or end your unfinished workout (scheduled ${formatDate(active.scheduledDate, "long")}) first.`;
  } else if (availability.kind === "outside_program") {
    text = "Outside your program dates.";
  }
  if (!text) return null;
  return (
    <>
      <p className="text-sm text-ink-muted">{text}</p>
      {availability.kind === "active_elsewhere" && active ? (
        <ButtonLink href={`/workout/session/${active.id}`} variant="secondary" size="sm">
          Open unfinished workout
        </ButtonLink>
      ) : null}
    </>
  );
}

function StrengthDay({ day }: { day: DayView }) {
  const totalSets = day.prescriptions.reduce((n, p) => n + p.sets, 0);
  return (
    <>
      <dl className="grid grid-cols-3 gap-3">
        <Stat label="Exercises" value={String(day.prescriptions.length)} />
        <Stat label="Sets" value={String(totalSets)} />
        <Stat label="Duration" value={estimateLabel(day.estimatedSeconds)} />
      </dl>

      <Alert tone="info">
        Prescriptions are starting points. Keep good form, use the safe modifications when needed, and stop if
        you feel pain or unusual symptoms.
      </Alert>

      <ol className="space-y-3">
        {day.prescriptions.map((p, index) => (
          <li key={p.id}>
            <Card padding="none" className="overflow-hidden">
              <Link
                href={`/workout/exercises/${p.exercise.id}`}
                className="flex items-center gap-4 p-4 transition-colors hover:bg-surface-muted/60 sm:p-5"
              >
                <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-ink-muted">
                  {index + 1}
                </span>
                <ExerciseCover
                  exerciseId={p.exercise.id}
                  name={p.exercise.name}
                  measureType={p.exercise.measureType}
                  sideMode={p.exercise.sideMode}
                  tempo={p.tempo}
                  muscles={p.exercise.targetMuscles}
                  illustrationPath={p.exercise.illustrationPath}
                  className="size-24 sm:size-28"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{p.exercise.name}</p>
                  <p className="text-sm font-medium text-accent-700">
                    {formatPrescription({ ...p, measureType: p.exercise.measureType, sideMode: p.exercise.sideMode })}
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-caption text-ink-muted">
                    {formatTempo(p.tempo) ? <span>Tempo {formatTempo(p.tempo)}</span> : null}
                    <span>Rest {formatSeconds(p.restSeconds)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock aria-hidden className="size-3" />
                      {estimateLabel(estimateExerciseSeconds(toEstimateInput(p)))}
                    </span>
                  </p>
                  {p.notes && p.notes !== "Seconds" ? (
                    <p className="mt-1 text-caption text-ink-soft">{p.notes}</p>
                  ) : null}
                </div>
              </Link>
            </Card>
          </li>
        ))}
      </ol>
      <p className="text-caption text-ink-muted">
        Tempo = seconds lowering · holding · lifting. Duration is an estimate (one 10 s countdown at the start,
        prescribed tempo, rest between sets, 60 s between exercises).
      </p>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line/70 bg-surface p-4 shadow-card">
      <dt className="text-caption text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-heading tabular-nums">{value}</dd>
    </div>
  );
}

function DaySkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="h-20 rounded-card" />
      </div>
      <Skeleton className="h-24 rounded-card" />
      <Skeleton className="h-24 rounded-card" />
    </div>
  );
}
