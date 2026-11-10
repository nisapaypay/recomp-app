import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Bed, ChartLine, Dumbbell, Footprints, Play, Ruler } from "lucide-react";
import { ProgressBar } from "@/components/ui/progress-bar";
import { STATUS_LABEL, nextActivity, primaryWorkoutAction, weeklyActivity, type WeeklyActivity } from "@/lib/program/dashboard";
import { getActiveSession } from "@/server/workout/queries";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { ProgramSummary } from "@/components/program/program-summary";
import { StartProgram } from "@/components/program/start-program";
import { ACTIVITY_ICON, WeeklySchedule } from "@/components/program/weekly-schedule";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/program/format";
import { estimateLabel } from "@/lib/program/labels";
import { RECOVERY_CONFIGURED, isStrengthDay } from "@/lib/program/schedule";
import { getCurrentProgram } from "@/server/program/queries";
import { ActiveWorkoutBanner } from "@/components/workout/active-workout-banner";
import {
  formatDuration,
  formatKm,
  formatPace,
  formatTarget,
  paceSecondsPerKm,
  walkingTotals,
  weeklyWalkingCompletion,
} from "@/lib/walking/walking";
import { getWalkingContext, getWalks } from "@/server/walking/queries";
import { METRICS, formatDelta, formatValue, nextCheckIn, seriesFor } from "@/lib/measurements/measurements";
import { getProgressContext } from "@/server/progress/queries";
import {
  getProgramOverview,
  getWeekView,
  weekCompletion,
  type DayView,
  type ProgramOverview,
} from "@/server/program/view";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PageContainer>
      <PageHeader eyebrow="12-week recomposition" title="Dashboard" />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </PageContainer>
  );
}

async function DashboardContent() {
  const program = await getCurrentProgram();

  if (!program || program.status !== "active") {
    const completed = program?.status === "completed" ? await getProgramOverview(program) : null;
    return (
      <div className="grid gap-4 lg:gap-6">
        {completed ? (
          <Card padding="lg">
            <CardHeader eyebrow="12 weeks complete" title="Program completed" />
            <ProgramSummary overview={completed} />
          </Card>
        ) : null}
        <Card padding="lg">
          <StartProgram previousCompleted={Boolean(completed)} />
        </Card>
        <Card padding="lg">
          <CardHeader eyebrow="Fixed weekly plan" title="Every week" />
          <WeeklySchedule />
        </Card>
      </div>
    );
  }

  const overview = await getProgramOverview(program);
  const days = await getWeekView(overview, overview.currentWeek);
  const following = overview.currentWeek < 12 ? await getWeekView(overview, overview.currentWeek + 1) : [];
  const [active, walks] = await Promise.all([getActiveSession(), getWalks()]);
  const today = days.find((d) => d.isToday) ?? null;
  const { completed, planned } = weekCompletion(days);
  // Late (this week, not done) strength workouts and walks — still doable, counted for their own day.
  const catchUps = days.filter((d) => d.status === "late" && (isStrengthDay(d.activity) || d.activity === "walking"));
  const next = nextActivity([...days, ...following], overview.today);
  const weekly = weeklyActivity(days, walks);
  const workoutAction = primaryWorkoutAction({ activeSessionId: active?.id ?? null, today, week: days });
  const walkHref = today?.activity === "walking" && today.status !== "completed" ? `/walking?walk=${today.date}#log` : "/walking#log";

  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
      <div className="empty:hidden lg:col-span-3">
        <ActiveWorkoutBanner />
      </div>
      <TodayCard overview={overview} today={today} firstDay={days[0]} />

      <Card padding="lg">
        <CardHeader eyebrow="Overview" title="Program" />
        <ProgramSummary overview={overview} />
        <ButtonLink href="/progress/report" variant="ghost" size="sm" className="mt-3 -ml-3">
          View 12-Week Report
          <ArrowRight aria-hidden className="size-4" />
        </ButtonLink>
      </Card>

      <nav aria-label="Quick actions" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:col-span-3 lg:gap-3">
        <QuickAction href={workoutAction.href} icon={workoutAction.kind === "continue" || workoutAction.kind === "start" ? Play : Dumbbell} label={workoutAction.label} primary={workoutAction.kind !== "plan"} />
        <QuickAction href={walkHref} icon={Footprints} label="Log walking" />
        <QuickAction href="/progress/measurements#log" icon={Ruler} label="Record measurement" />
        <QuickAction href="/progress" icon={ChartLine} label="View progress" />
      </nav>

      {catchUps.length > 0 ? (
        <Card padding="lg" className="border-warning/25 lg:col-span-3">
          <CardHeader eyebrow="Late this week" title="Catch-up available" />
          <p className="-mt-2 mb-4 text-sm text-ink-muted">
            Not done yet, but you can still do {catchUps.length === 1 ? "it" : "them"}. A catch-up counts for its
            scheduled day — the schedule doesn&apos;t shift.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {catchUps.map((d) => (
              <li key={d.date}>
                <Link
                  href={d.activity === "walking" ? `/walking?walk=${d.date}#log` : `/workout/day/${d.date}`}
                  className="flex items-center justify-between gap-3 rounded-control border border-line bg-surface px-4 py-3 hover:bg-surface-muted"
                >
                  <span>
                    <span className="block font-medium text-ink">{d.activityLabel}</span>
                    <span className="block text-caption text-ink-muted">Scheduled {formatDate(d.date, "full")} · {STATUS_LABEL.late}</span>
                  </span>
                  <span className="text-sm font-semibold text-accent-700">{d.activity === "walking" ? "Log walk" : "Catch up"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card padding="lg" className="lg:col-span-3">
        <CardHeader
          eyebrow={`Week ${overview.currentWeek} · ${completed} of ${planned} done`}
          title={overview.timing.state === "not_started" ? "Your first week" : "This week"}
          action={
            <ButtonLink href="/workout" variant="ghost" size="sm">
              Full plan
              <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          }
        />
        <WeeklySchedule days={days} />
      </Card>

      <Card padding="lg">
        <CardHeader eyebrow={`Week ${overview.currentWeek}`} title="Weekly activity" />
        <WeeklyActivityView weekly={weekly} />
      </Card>

      <Card padding="lg">
        <CardHeader eyebrow="Coming up" title="Next activity" />
        {next ? (
          <div className="space-y-3">
            <p className="text-heading">{next.activityLabel}</p>
            <p className="text-sm text-ink-muted">
              {formatDate(next.date, "full")}
              {isStrengthDay(next.activity) ? (
                <>
                  <br />
                  {next.prescriptions.length} exercises · {estimateLabel(next.estimatedSeconds)}
                </>
              ) : next.walkingTargetMinutes ? (
                <>
                  <br />
                  Target {next.walkingTargetMinutes.min === next.walkingTargetMinutes.max ? next.walkingTargetMinutes.min : `${next.walkingTargetMinutes.min}–${next.walkingTargetMinutes.max}`} min
                </>
              ) : null}
            </p>
            <ButtonLink href={`/workout/day/${next.date}`} variant="secondary" size="sm">
              View details
            </ButtonLink>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Nothing else scheduled in this program.</p>
        )}
      </Card>

      <Suspense fallback={<Skeleton className="h-48 rounded-card" />}>
        <WalkingCard week={overview.currentWeek} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-48 rounded-card" />}>
        <ProgressCard />
      </Suspense>

    </div>
  );
}

function TodayCard({
  overview,
  today,
  firstDay,
}: {
  overview: ProgramOverview;
  today: DayView | null;
  firstDay: DayView;
}) {
  const shell = "lg:col-span-2";

  if (overview.timing.state === "not_started") {
    return (
      <Card tone="accent" padding="lg" className={shell}>
        <p className="text-overline uppercase text-accent-200">Program starts</p>
        <h2 className="mt-1 text-title text-white">{formatDate(firstDay.date, "full")}</h2>
        <p className="mt-2 max-w-md text-[0.9375rem] text-accent-100">
          Week 1 begins with {firstDay.activityLabel.toLowerCase()} — {firstDay.prescriptions.length} bodyweight
          exercises, {estimateLabel(firstDay.estimatedSeconds)}.
        </p>
        <ButtonLink href={`/workout/day/${firstDay.date}`} variant="secondary" className="mt-5">
          Preview the first workout
        </ButtonLink>
      </Card>
    );
  }

  if (!today) return null;
  const Icon = today.activity === "rest" ? Bed : ACTIVITY_ICON[today.activity];
  const strength = isStrengthDay(today.activity);

  let detail: string;
  if (strength) {
    detail = `${today.prescriptions.length} exercises · ${estimateLabel(today.estimatedSeconds)}`;
  } else if (today.walkingTargetMinutes) {
    const { min, max } = today.walkingTargetMinutes;
    detail = `Walk ${min === max ? min : `${min}–${max}`} minutes, then log it from your Apple Watch.`;
  } else if (today.activity === "recovery") {
    detail = RECOVERY_CONFIGURED
      ? "Recovery and gentle stretching. Keep it light."
      : "Recovery day — the routine isn't configured yet, so nothing is tracked. Keep it light.";
  } else {
    detail = "Full rest. Recovery is part of the program.";
  }

  return (
    <Card tone="accent" padding="lg" className={shell}>
      <p className="text-overline uppercase text-accent-200">
        Today · {formatDate(today.date, "full")}
      </p>
      <h2 className="mt-1 flex items-center gap-3 text-title text-white">
        <Icon aria-hidden className="size-7" />
        {today.activityLabel}
      </h2>
      <p className="mt-2 max-w-md text-[0.9375rem] text-accent-100">{detail}</p>
      {today.activity !== "rest" ? (
        <p className="mt-3 inline-flex rounded-chip bg-white/15 px-3 py-1 text-caption font-semibold text-white">{STATUS_LABEL[today.status]}</p>
      ) : null}
      {today.status === "completed" ? (
        <p className="mt-5 text-sm font-semibold text-white">Completed ✓</p>
      ) : today.activity !== "rest" ? (
        <ButtonLink href={`/workout/day/${today.date}`} variant="secondary" className="mt-5">
          {strength ? (
            <>
              <Play aria-hidden className="size-4.5" />
              Start Workout
            </>
          ) : (
            "View details"
          )}
        </ButtonLink>
      ) : null}
      {today.activity === "walking" && today.status !== "completed" ? (
        <ButtonLink href={`/walking?walk=${today.date}#log`} variant="secondary" className="ml-2 mt-5">
          <Footprints aria-hidden className="size-4.5" />
          Log walk
        </ButtonLink>
      ) : null}
    </Card>
  );
}

function QuickAction({ href, icon: Icon, label, primary = false }: { href: string; icon: typeof Play; label: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "flex min-h-14 items-center gap-2.5 rounded-card bg-accent-600 px-4 py-3 text-sm font-semibold text-white shadow-card hover:bg-accent-700"
          : "flex min-h-14 items-center gap-2.5 rounded-card border border-line/70 bg-surface px-4 py-3 text-sm font-semibold text-ink shadow-card hover:bg-surface-muted"
      }
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      <span className="min-w-0 leading-tight">{label}</span>
    </Link>
  );
}

function WeeklyActivityView({ weekly }: { weekly: WeeklyActivity }) {
  const rows = [
    { label: "Strength", done: weekly.strength.done, planned: weekly.strength.planned, note: null as string | null },
    {
      label: "Walking",
      done: weekly.walking.done,
      planned: weekly.walking.planned,
      note:
        weekly.walking.minutes > 0
          ? `${formatDuration(weekly.walking.minutes)} · ${formatKm(weekly.walking.km)}${weekly.walking.extraWalks ? ` · incl. ${weekly.walking.extraWalks} extra` : ""}`
          : "No walks this week yet",
    },
  ];
  if (RECOVERY_CONFIGURED) rows.push({ label: "Recovery", done: weekly.recovery.done, planned: weekly.recovery.planned, note: null });
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="text-ink-soft">{r.label}</span>
            <span className="font-medium tabular-nums text-ink">{r.done} of {r.planned}</span>
          </div>
          <ProgressBar label={`${r.label} this week`} value={r.done} max={Math.max(r.planned, 1)} />
          {r.note ? <p className="mt-1 text-caption text-ink-muted">{r.note}</p> : null}
        </li>
      ))}
      {!RECOVERY_CONFIGURED ? (
        <li className="flex items-baseline justify-between text-sm">
          <span className="text-ink-soft">Recovery</span>
          <span className="text-caption text-ink-muted">Not configured — not counted</span>
        </li>
      ) : null}
    </ul>
  );
}

/** Latest check-in and the next one — real measurements only. */
async function ProgressCard() {
  const ctx = await getProgressContext();
  const latest = ctx.measurements[0] ?? null;
  const next = nextCheckIn(ctx.schedule);
  const shown = METRICS.filter((m) => ["weightKg", "bodyFatPct", "skeletalMuscleKg"].includes(m.key));
  return (
    <Card padding="lg">
      <CardHeader
        eyebrow={next ? `Next check-in: week ${next.week}${next.status === "late" ? " (late)" : next.status === "due" ? " (this week)" : ""}` : "Body composition"}
        title="Progress overview"
        action={
          <ButtonLink href="/progress" variant="ghost" size="sm">
            Open
            <ArrowRight aria-hidden className="size-4" />
          </ButtonLink>
        }
      />
      {latest ? (
        <dl className="grid grid-cols-3 gap-3 text-sm">
          {shown.map((def) => {
            const points = seriesFor(ctx.measurements, def.key);
            const last = points[points.length - 1];
            const prev = points[points.length - 2];
            const factor = 10 ** def.decimals;
            const delta = last && prev ? Math.round((last.value - prev.value) * factor) / factor : null;
            return (
              <div key={def.key}>
                <dt className="text-caption text-ink-muted">{def.label}</dt>
                <dd className="font-semibold tabular-nums">{last ? formatValue(last.value, def) : "—"}</dd>
                <dd className="text-caption text-ink-muted">{delta !== null ? `${formatDelta(delta, def)} vs previous` : last ? "first value" : "not recorded"}</dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <EmptyState
          icon={Ruler}
          title="No measurements recorded"
          description="Weight, body fat and the change since your first check-in appear after your first measurement."
          className="py-6"
          action={<ButtonLink href="/progress/measurements#log" size="sm">Log a measurement</ButtonLink>}
        />
      )}
      {latest ? <p className="mt-3 text-caption text-ink-muted">Latest: {formatDate(latest.recordedOn, "medium")} · week {latest.weekNumber}</p> : null}
    </Card>
  );
}

/** Walking at a glance — real logs only. */
async function WalkingCard({ week }: { week: number }) {
  const [ctx, walks] = await Promise.all([getWalkingContext(), getWalks()]);
  const logged = new Set(ctx.loggedDates);
  const weekWalks = ctx.walks.filter((w) => w.week === week);
  const done = weeklyWalkingCompletion(weekWalks, walks);
  const next = ctx.walks.find((w) => w.date >= ctx.today && !logged.has(w.date)) ?? null;
  const last = walks[0] ?? null;
  const totals = walkingTotals(walks);
  const lastPace = last ? formatPace(paceSecondsPerKm(last.durationMinutes, last.distanceKm)) : null;

  return (
    <Card padding="lg">
      <CardHeader
        eyebrow={`Week ${week} · ${done.completed} of ${done.planned} program walks`}
        title="Walking"
        action={
          <ButtonLink href="/walking#log" variant="ghost" size="sm">
            Log
            <ArrowRight aria-hidden className="size-4" />
          </ButtonLink>
        }
      />
      <div className="space-y-3 text-sm">
        <p>
          <span className="text-ink-muted">Next target: </span>
          {next ? (
            <Link href={`/walking?walk=${next.date}#log`} className="font-medium text-ink hover:underline">
              {next.label.replace(" Walking", "")} {formatDate(next.date, "medium")} · {formatTarget(next.targetMin, next.targetMax)}
            </Link>
          ) : (
            <span className="text-ink-muted">no more program walks</span>
          )}
        </p>
        {last ? (
          <p>
            <span className="text-ink-muted">Last walk: </span>
            <Link href={`/walking/${last.id}`} className="font-medium text-ink hover:underline">
              {formatDate(last.activityDate, "medium")} · {formatDuration(last.durationMinutes)}
              {last.distanceKm !== null ? ` · ${formatKm(last.distanceKm)}` : ""}
              {lastPace ? ` · ${lastPace}` : ""}
            </Link>
            {last.scheduledDate ? null : <span className="text-ink-muted"> (additional)</span>}
          </p>
        ) : (
          <p className="text-ink-muted">No walks logged yet.</p>
        )}
        {totals.count > 0 ? (
          <dl className="grid grid-cols-3 gap-3 border-t border-line pt-3">
            <div>
              <dt className="text-caption text-ink-muted">Walks</dt>
              <dd className="font-semibold tabular-nums">{totals.count}</dd>
              <dd className="text-caption text-ink-muted">
                {totals.scheduled} program · {totals.additional} extra
              </dd>
            </div>
            <div>
              <dt className="text-caption text-ink-muted">Time</dt>
              <dd className="font-semibold tabular-nums">{formatDuration(totals.minutes)}</dd>
            </div>
            <div>
              <dt className="text-caption text-ink-muted">Distance</dt>
              <dd className="font-semibold tabular-nums">{formatKm(totals.km)}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6" aria-hidden>
      <Skeleton className="h-52 rounded-card lg:col-span-2" />
      <Skeleton className="h-52 rounded-card" />
      <Skeleton className="h-48 rounded-card lg:col-span-3" />
    </div>
  );
}
