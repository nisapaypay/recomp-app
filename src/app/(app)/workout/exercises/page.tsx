import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { PageContainer, PageHeader, PageSection } from "@/components/layout/page";
import { ExerciseCover } from "@/components/exercise/exercise-cover";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABEL, EQUIPMENT_LABEL, humanize } from "@/lib/program/format";
import type { Exercise, ExerciseCategory } from "@/lib/program/types";
import { getExerciseLibrary } from "@/server/program/queries";

export const metadata: Metadata = { title: "Exercise library" };

const CATEGORY_ORDER: ExerciseCategory[] = ["lower_body", "upper_body", "core", "full_body", "mobility"];

export default function ExerciseLibraryPage() {
  return (
    <PageContainer>
      <Link
        href="/workout"
        className="mb-4 inline-flex h-11 items-center gap-1 rounded-control pr-2 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <ChevronLeft aria-hidden className="size-4.5" />
        Workout
      </Link>
      <PageHeader
        eyebrow="Reference"
        title="Exercise library"
        description="Every exercise in your 12-week program, with instructions, tempo and safe modifications."
      />
      <Suspense fallback={<LibrarySkeleton />}>
        <Library />
      </Suspense>
    </PageContainer>
  );
}

async function Library() {
  const exercises = await getExerciseLibrary();
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: exercises.filter((e) => e.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      {groups.map((group) => (
        <PageSection key={group.category} title={`${CATEGORY_LABEL[group.category]} (${group.items.length})`}>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((exercise) => (
              <li key={exercise.id}>
                <ExerciseCard exercise={exercise} />
              </li>
            ))}
          </ul>
        </PageSection>
      ))}
    </div>
  );
}

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  return (
    <Card padding="none" className="h-full overflow-hidden">
      <Link
        href={`/workout/exercises/${exercise.id}`}
        className="flex h-full flex-col transition-colors hover:bg-surface-muted/60"
      >
        <ExerciseCover
          exerciseId={exercise.id}
          name={exercise.name}
          measureType={exercise.measureType}
          sideMode={exercise.sideMode}
          tempo={exercise.defaultTempo}
          muscles={exercise.targetMuscles}
          illustrationPath={exercise.illustrationPath}
          className="aspect-[5/4] w-full rounded-none"
        />
        <div className="min-w-0 p-4">
          <p className="font-semibold text-ink">{exercise.name}</p>
          <p className="truncate text-caption text-ink-muted">
            {exercise.targetMuscles.map(humanize).join(", ")}
          </p>
          <Badge className="mt-1.5">{EQUIPMENT_LABEL[exercise.equipment]}</Badge>
        </div>
      </Link>
    </Card>
  );
}

function LibrarySkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-80 rounded-card" />
      ))}
    </div>
  );
}
