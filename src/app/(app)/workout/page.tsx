import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { PageContainer, PageHeader, PageSection } from "@/components/layout/page";
import { ProgramSummary } from "@/components/program/program-summary";
import { StartProgram } from "@/components/program/start-program";
import { WeeklySchedule } from "@/components/program/weekly-schedule";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { phaseForWeek } from "@/lib/program/calendar";
import { PROGRAM_WEEKS, TRAINING_PHASES } from "@/lib/program/schedule";
import { cn } from "@/lib/utils/cn";
import { getCurrentProgram } from "@/server/program/queries";
import { ActiveWorkoutBanner } from "@/components/workout/active-workout-banner";
import { Alert } from "@/components/ui/alert";
import { getProgramOverview, getWeekView, weekCompletion } from "@/server/program/view";

export const metadata: Metadata = { title: "Workout" };

export default function WorkoutPage({ searchParams }: PageProps<"/workout">) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="12-week program"
        title="Workout"
        description="Your fixed weekly plan. Guided sessions are best on a laptop or external monitor."
        actions={
          <ButtonLink href="/workout/exercises" variant="secondary">
            <BookOpen aria-hidden className="size-4.5" />
            Exercise library
          </ButtonLink>
        }
      />
      <Suspense fallback={<WorkoutSkeleton />}>
        <WorkoutContent searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function WorkoutContent({ searchParams }: { searchParams: PageProps<"/workout">["searchParams"] }) {
  const program = await getCurrentProgram();
  if (!program || program.status !== "active") {
    return (
      <Card padding="lg">
        <StartProgram previousCompleted={program?.status === "completed"} />
      </Card>
    );
  }

  const overview = await getProgramOverview(program);
  const params = await searchParams;
  const requested = Number(params.week);
  const ended = typeof params.ended === "string" ? params.ended : null;
  const week =
    Number.isInteger(requested) && requested >= 1 && requested <= PROGRAM_WEEKS ? requested : overview.currentWeek;
  const days = await getWeekView(overview, week);
  const { completed, planned } = weekCompletion(days);
  const phase = phaseForWeek(week);

  return (
    <div className="space-y-8">
      <ActiveWorkoutBanner />
      {ended ? (
        <Alert tone="info">
          Your previous workout was ended and kept in your history as abandoned.
          {ended !== "1" ? " A new workout can't be started today (no strength workout scheduled or already done)." : ""}
        </Alert>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Card padding="lg">
          <CardHeader eyebrow="Overview" title="Program" />
          <ProgramSummary overview={overview} />
        </Card>

        <Card padding="lg" className="lg:col-span-2">
          <CardHeader
            eyebrow={`${phase.name} · ${completed} of ${planned} done`}
            title={week === overview.currentWeek && overview.timing.state === "in_progress" ? `This week · Week ${week}` : `Week ${week}`}
            action={<WeekNav week={week} />}
          />
          <WeeklySchedule days={days} />
        </Card>
      </div>

      <PageSection title="Training phases">
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TRAINING_PHASES.map((p, index) => {
            const active = overview.timing.state === "in_progress" && overview.timing.phase.id === p.id;
            return (
              <li key={p.id}>
                <Card className={cn("h-full", active && "border-accent-300 bg-accent-50")}>
                  <p className="text-overline uppercase text-ink-muted">
                    Phase {index + 1} · {p.firstWeek === p.lastWeek ? `Week ${p.firstWeek}` : `Weeks ${p.firstWeek}–${p.lastWeek}`}
                  </p>
                  <p className="mt-1 text-heading">{p.name}</p>
                  {active ? <Badge tone="accent" className="mt-2">Current</Badge> : null}
                </Card>
              </li>
            );
          })}
        </ol>
      </PageSection>
    </div>
  );
}

function WeekNav({ week }: { week: number }) {
  const link = "grid size-11 place-items-center rounded-full border border-line bg-surface text-ink-soft hover:bg-surface-muted";
  const disabled = "pointer-events-none opacity-40";
  return (
    <nav aria-label="Change week" className="flex gap-2">
      <Link
        href={`/workout?week=${week - 1}`}
        aria-label="Previous week"
        aria-disabled={week <= 1}
        className={cn(link, week <= 1 && disabled)}
        scroll={false}
      >
        <ChevronLeft aria-hidden className="size-5" />
      </Link>
      <Link
        href={`/workout?week=${week + 1}`}
        aria-label="Next week"
        aria-disabled={week >= PROGRAM_WEEKS}
        className={cn(link, week >= PROGRAM_WEEKS && disabled)}
        scroll={false}
      >
        <ChevronRight aria-hidden className="size-5" />
      </Link>
    </nav>
  );
}

function WorkoutSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6" aria-hidden>
      <Skeleton className="h-80 rounded-card" />
      <Skeleton className="h-80 rounded-card lg:col-span-2" />
    </div>
  );
}
