import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft, ShieldCheck, Wind } from "lucide-react";
import { PageContainer, PageSection } from "@/components/layout/page";
import { ExerciseDemo } from "@/components/exercise/exercise-demo";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CATEGORY_LABEL,
  EQUIPMENT_LABEL,
  formatPrescription,
  formatSeconds,
  formatTempo,
  humanize,
} from "@/lib/program/format";
import { WEEKLY_SCHEDULE } from "@/lib/program/schedule";
import type { Prescription } from "@/lib/program/types";
import { AdjustmentHistory } from "@/components/progression/adjustment-history";
import { getExerciseWithPrescriptions } from "@/server/program/queries";
import { getAdjustmentHistory } from "@/server/progression/queries";

export const metadata: Metadata = { title: "Exercise" };

export default function ExercisePage({ params }: PageProps<"/workout/exercises/[id]">) {
  return (
    <PageContainer>
      <Link
        href="/workout/exercises"
        className="mb-4 inline-flex h-11 items-center gap-1 rounded-control pr-2 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <ChevronLeft aria-hidden className="size-4.5" />
        Exercise library
      </Link>
      <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
        <ExerciseContent params={params} />
      </Suspense>
    </PageContainer>
  );
}

async function ExerciseContent({ params }: { params: PageProps<"/workout/exercises/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(id)) notFound();
  const result = await getExerciseWithPrescriptions(id);
  if (!result) notFound();
  const { exercise, prescriptions } = result;
  const adjustments = await getAdjustmentHistory(exercise.id, 20);

  const sideNote =
    exercise.sideMode === "per_side"
      ? "Done one side at a time: all reps on the left, then all reps on the right = 1 set."
      : exercise.sideMode === "per_direction"
        ? "Done in both directions: all reps forward, then all reps backward = 1 set."
        : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-10">
      <div className="space-y-4">
        <ExerciseDemo
          exerciseId={exercise.id}
          name={exercise.name}
          measureType={exercise.measureType}
          sideMode={exercise.sideMode}
          tempo={exercise.defaultTempo}
          muscles={exercise.targetMuscles}
          illustrationPath={exercise.illustrationPath}
        />
        <Card>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Info label="Category" value={CATEGORY_LABEL[exercise.category]} />
            <Info label="Equipment" value={EQUIPMENT_LABEL[exercise.equipment]} />
            <Info label="Default tempo" value={formatTempo(exercise.defaultTempo) ?? "Timed hold"} />
            <Info label="Default rest" value={formatSeconds(exercise.defaultRestSeconds)} />
            <div className="col-span-2">
              <dt className="text-ink-muted">Target muscles</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {exercise.targetMuscles.map((m) => (
                  <Badge key={m} tone="accent">
                    {humanize(m)}
                  </Badge>
                ))}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div>
        <p className="mb-1 text-overline uppercase text-accent-600">{CATEGORY_LABEL[exercise.category]}</p>
        <h1 className="text-title md:text-display">{exercise.name}</h1>
        {exercise.description ? <p className="mt-2 text-[0.9375rem] text-ink-soft">{exercise.description}</p> : null}
        {sideNote ? <p className="mt-2 text-sm font-medium text-accent-700">{sideNote}</p> : null}

        {exercise.startingPosition ? (
          <PageSection title="Starting position">
            <p className="text-[0.9375rem] text-ink-soft">{exercise.startingPosition}</p>
          </PageSection>
        ) : null}

        {exercise.executionSteps.length > 0 ? (
          <PageSection title="How to do it">
            <ol className="space-y-2.5">
              {exercise.executionSteps.map((step, i) => (
                <li key={i} className="flex gap-3 text-[0.9375rem] text-ink-soft">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-100 text-caption font-semibold text-accent-700">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </PageSection>
        ) : null}

        {exercise.breathing ? (
          <PageSection title="Breathing">
            <p className="flex gap-2 text-[0.9375rem] text-ink-soft">
              <Wind aria-hidden className="mt-0.5 size-4.5 shrink-0 text-accent-600" />
              {exercise.breathing}
            </p>
          </PageSection>
        ) : null}

        {exercise.commonMistakes.length > 0 ? (
          <PageSection title="Common mistakes">
            <ul className="list-disc space-y-1 pl-5 text-[0.9375rem] text-ink-soft marker:text-ink-faint">
              {exercise.commonMistakes.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </PageSection>
        ) : null}

        {exercise.safeModifications.length > 0 ? (
          <PageSection title="Safe modifications">
            <ul className="space-y-1.5 text-[0.9375rem] text-ink-soft">
              {exercise.safeModifications.map((m) => (
                <li key={m} className="flex gap-2">
                  <ShieldCheck aria-hidden className="mt-0.5 size-4.5 shrink-0 text-success" />
                  {m}
                </li>
              ))}
            </ul>
          </PageSection>
        ) : null}

        <Alert tone="info" className="mt-8">
          General guidance for beginners. Stop if you feel pain or unusual symptoms, and use a modification
          when you can&apos;t keep good form.
        </Alert>

        {prescriptions.length > 0 ? (
          <PageSection title="In your program">
            <PrescriptionTable prescriptions={prescriptions} />
          </PageSection>
        ) : null}

        <PageSection
          title="Your adjustments"
          description="Changes from your workout feedback. The program table above shows the original targets; these changes apply on top of them."
        >
          <AdjustmentHistory items={adjustments} showExercise={false} />
        </PageSection>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

/** Groups identical prescriptions over consecutive weeks: "Weeks 2–4 · Mon · 2 × 12". */
function PrescriptionTable({ prescriptions }: { prescriptions: Prescription[] }) {
  type Group = { first: number; last: number; day: number; text: string; tempo: string | null; rest: number };
  const groups: Group[] = [];
  for (const p of prescriptions) {
    const text = formatPrescription({ ...p, measureType: p.exercise.measureType, sideMode: p.exercise.sideMode });
    const tempo = formatTempo(p.tempo);
    const prev = groups.find(
      (g) => g.day === p.dayOfWeek && g.text === text && g.tempo === tempo && g.rest === p.restSeconds && g.last === p.weekNumber - 1,
    );
    if (prev) prev.last = p.weekNumber;
    else groups.push({ first: p.weekNumber, last: p.weekNumber, day: p.dayOfWeek, text, tempo, rest: p.restSeconds });
  }
  groups.sort((a, b) => a.first - b.first || a.day - b.day);

  return (
    <Card padding="none">
      <table className="w-full text-left text-sm">
        <thead className="text-caption text-ink-muted">
          <tr className="border-b border-line">
            <th scope="col" className="px-4 py-2.5 font-medium">Weeks</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Day</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Sets × target</th>
            <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">Tempo · rest</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {groups.map((g) => (
            <tr key={`${g.first}-${g.day}`}>
              <td className="px-4 py-2.5 tabular-nums">{g.first === g.last ? g.first : `${g.first}–${g.last}`}</td>
              <td className="px-4 py-2.5">{WEEKLY_SCHEDULE[g.day - 1].shortLabel}</td>
              <td className="px-4 py-2.5 font-medium text-ink">{g.text}</td>
              <td className="hidden px-4 py-2.5 text-ink-muted sm:table-cell">
                {g.tempo ?? "Hold"} · {formatSeconds(g.rest)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
