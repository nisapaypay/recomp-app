import type { Metadata } from "next";
import { Timer } from "lucide-react";
import { PageContainer, PageHeader, PageSection } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TRAINING_PHASES } from "@/lib/program/schedule";

export const metadata: Metadata = { title: "Workout" };

function weekRange(first: number, last: number) {
  return first === last ? `Week ${first}` : `Weeks ${first}–${last}`;
}

export default function WorkoutPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Strength"
        title="Workout"
        description="Guided sessions with a large timer, tempo-paced reps and rest countdowns. Best on a laptop or external monitor."
      />

      <EmptyState
        icon={Timer}
        title="Guided workouts aren't available yet"
        description="The workout session engine is built in a later phase. Nothing is recorded from this page yet."
        action={<Badge tone="accent">In development</Badge>}
      />

      <PageSection title="Training phases" description="Your 12-week program is split into four phases.">
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TRAINING_PHASES.map((phase, index) => (
            <li key={phase.id}>
              <Card className="h-full">
                <p className="text-overline uppercase text-ink-muted">
                  Phase {index + 1} · {weekRange(phase.firstWeek, phase.lastWeek)}
                </p>
                <p className="mt-1 text-heading">{phase.name}</p>
              </Card>
            </li>
          ))}
        </ol>
      </PageSection>
    </PageContainer>
  );
}
