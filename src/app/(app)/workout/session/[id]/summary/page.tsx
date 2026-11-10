import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2, ChevronLeft, CircleSlash } from "lucide-react";
import { PageContainer, PageSection } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FeedbackForm } from "@/components/workout/feedback-form";
import { formatDate, formatDateTime, formatSeconds } from "@/lib/program/format";
import { isCatchUp } from "@/lib/program/start-rules";
import { WEEKLY_SCHEDULE } from "@/lib/program/schedule";
import { getFeedbackOutcome } from "@/server/progression/queries";
import { getSessionBundle, type SessionExercise } from "@/server/workout/queries";

export const metadata: Metadata = { title: "Workout summary" };

export default function SummaryPage({ params }: PageProps<"/workout/session/[id]/summary">) {
  return (
    <PageContainer className="max-w-4xl">
      <Link
        href="/workout"
        className="mb-4 inline-flex h-11 items-center gap-1 rounded-control pr-2 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <ChevronLeft aria-hidden className="size-4.5" />
        Workout
      </Link>
      <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
        <Summary params={params} />
      </Suspense>
    </PageContainer>
  );
}

const STATUS_BADGE: Record<SessionExercise["status"], { tone: "success" | "warning" | "neutral" | "danger"; label: string }> = {
  completed: { tone: "success", label: "Completed" },
  partial: { tone: "warning", label: "Partly done" },
  skipped: { tone: "neutral", label: "Skipped" },
  pending: { tone: "neutral", label: "Not started" },
  in_progress: { tone: "warning", label: "Partly done" },
};

async function Summary({ params }: { params: PageProps<"/workout/session/[id]/summary">["params"] }) {
  const { id } = await params;
  const bundle = await getSessionBundle(id);
  if (!bundle) notFound();
  const { session, exercises, feedback } = bundle;
  if (session.status === "in_progress" || session.status === "interrupted") redirect(`/workout/session/${id}`);
  if (session.status === "abandoned") redirect("/workout");

  // Only recorded data — nothing estimated.
  const done = (e: SessionExercise) => e.sets_rows.filter((r) => r.status !== "skipped");
  const totalSets = exercises.reduce((n, e) => n + e.completedSets, 0);
  const totalReps = exercises
    .filter((e) => e.measureType === "reps")
    .reduce((n, e) => n + done(e).reduce((m, r) => m + r.achieved, 0), 0);
  const totalHold = exercises
    .filter((e) => e.measureType === "seconds")
    .reduce((n, e) => n + done(e).reduce((m, r) => m + r.achieved, 0), 0);
  const completedCount = exercises.filter((e) => e.status === "completed").length;
  const skippedCount = exercises.filter((e) => e.status === "skipped").length;
  const completed = session.status === "completed";
  const outcome = completed ? await getFeedbackOutcome(session) : null;
  const activityLabel = WEEKLY_SCHEDULE.find((d) => d.activity === session.activityType)?.activityLabel ?? "workout";

  return (
    <div className="space-y-8">
      <header>
        <p className="text-overline uppercase text-accent-600">Week {session.weekNumber}</p>
        <h1 className="mt-1 flex items-center gap-3 text-title md:text-display">
          {completed ? (
            <CheckCircle2 aria-hidden className="size-8 text-success" />
          ) : (
            <CircleSlash aria-hidden className="size-8 text-ink-muted" />
          )}
          {completed ? "Workout completed" : "Workout stopped"}
        </h1>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[0.9375rem]">
          <div className="flex gap-1.5">
            <dt className="text-ink-muted">Scheduled</dt>
            <dd className="font-medium text-ink">{formatDate(session.scheduledDate, "full")}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-ink-muted">Performed</dt>
            <dd className="font-medium text-ink">
              {session.performedAt ? formatDateTime(session.performedAt) : "—"}
              {isCatchUp(session.scheduledDate, session.performedAt) ? (
                <Badge tone="warning" className="ml-2">Catch-up</Badge>
              ) : null}
            </dd>
          </div>
        </dl>
        {!completed ? (
          <p className="mt-2 text-ink-muted">This workout was ended early and is not counted as completed.</p>
        ) : null}
      </header>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="Duration" value={session.durationSeconds !== null ? formatSeconds(session.durationSeconds) : "—"} />
        <Metric label="Exercises completed" value={`${completedCount} / ${exercises.length}`} />
        <Metric label="Sets completed" value={String(totalSets)} />
        <Metric label="Total reps" value={String(totalReps)} />
        <Metric label="Exercises skipped" value={String(skippedCount)} />
      </dl>
      {totalHold > 0 ? <p className="-mt-4 text-sm text-ink-muted">Plus {totalHold} s of timed holds.</p> : null}

      {completed ? (
        <Card padding="lg">
          <FeedbackForm
            sessionId={session.id}
            activityLabel={activityLabel}
            initial={feedback}
            adjustment={outcome?.adjustment ?? null}
            locked={outcome?.locked ?? false}
          />
        </Card>
      ) : null}

      <PageSection title="Exercises">
        <ul className="space-y-3">
          {exercises.map((e) => {
            const badge = STATUS_BADGE[e.status];
            const rows = [...e.sets_rows].sort((a, b) => a.set_number - b.set_number || String(a.side).localeCompare(String(b.side)));
            return (
              <li key={e.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{e.name}</p>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {e.completedSets} of {e.sets} sets · target {e.target}
                    {e.measureType === "seconds" ? " s" : " reps"}
                    {e.sideMode === "per_side" ? " per side" : e.sideMode === "per_direction" ? " each direction" : ""}
                  </p>
                  {rows.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {rows.map((r) => (
                        <li
                          key={`${r.set_number}-${r.side}`}
                          className="rounded-control bg-surface-muted px-3 py-1.5 text-caption text-ink-soft"
                        >
                          Set {r.set_number}
                          {r.side ? ` ${r.side}` : ""}:{" "}
                          {r.status === "skipped"
                            ? "skipped"
                            : `${r.achieved}${e.measureType === "seconds" ? " s" : ""}/${r.target}`}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      </PageSection>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line/70 bg-surface p-4 shadow-card">
      <dt className="text-caption text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-heading tabular-nums">{value}</dd>
    </div>
  );
}
