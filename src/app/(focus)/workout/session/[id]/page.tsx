import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkoutSession } from "@/components/workout/workout-session";
import { getToday } from "@/server/program/queries";
import { getSessionBundle, getSoundPreferences, toEngineExercises } from "@/server/workout/queries";

export const metadata: Metadata = { title: "Workout" };

export default function WorkoutSessionPage({ params }: PageProps<"/workout/session/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="m-auto w-full max-w-3xl space-y-4" aria-hidden>
          <Skeleton className="h-6 w-60" />
          <Skeleton className="h-96 rounded-card" />
        </div>
      }
    >
      <SessionContent params={params} />
    </Suspense>
  );
}

async function SessionContent({ params }: { params: PageProps<"/workout/session/[id]">["params"] }) {
  const { id } = await params;
  const bundle = await getSessionBundle(id);
  if (!bundle) notFound();

  const { session } = bundle;
  if (session.status === "completed" || session.status === "stopped") redirect(`/workout/session/${id}/summary`);
  if (session.status === "abandoned") redirect("/workout");

  const [sound, today] = await Promise.all([getSoundPreferences(), getToday()]);

  return (
    <WorkoutSession
      sessionId={session.id}
      performedAt={session.performedAt}
      status={session.status}
      scheduledDate={session.scheduledDate}
      today={today}
      exercises={bundle.exercises}
      engineExercises={toEngineExercises(bundle.exercises)}
      checkpoint={bundle.checkpoint}
      sound={sound}
    />
  );
}
