import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Ruler,
  Timer,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageContainer, PageHeader, PageSection } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buildStartDateOptions } from "@/components/program/start-program";
import { StartDateForm } from "@/components/program/start-date-form";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/program/format";
import { changeProgramStartDate } from "@/server/actions/program";
import { getCurrentUser } from "@/server/auth";
import { countProgramSessions, getCurrentProgram } from "@/server/program/queries";
import { getSoundPreferences } from "@/server/workout/queries";
import { SoundControls } from "@/components/workout/sound-controls";
import { InstallCard } from "@/components/pwa/install-card";
import { ReminderSettingsForm } from "@/components/reminders/reminder-settings-form";
import { getReminderSettings } from "@/server/reminders/queries";

export const metadata: Metadata = { title: "Settings" };

const GROUPS: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: UserRound, title: "Profile", description: "Name, height and baseline measurements" },
  { icon: Timer, title: "Workout defaults", description: "Default rest duration" },
  { icon: Ruler, title: "Units", description: "Preferred units" },
];

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader title="Settings" />

      <PageSection title="Account">
        <Card>
          <Suspense fallback={<AccountSkeleton />}>
            <AccountDetails />
          </Suspense>
        </Card>
      </PageSection>

      <PageSection title="Program">
        <Card>
          <Suspense fallback={<AccountSkeleton />}>
            <ProgramSettings />
          </Suspense>
        </Card>
      </PageSection>

      <PageSection title="Sound" description="Short beeps during workouts (countdown, tempo, rep, rest finished, next exercise, workout complete). Saved to your account, so it applies on every device.">
        <Card>
          <Suspense fallback={<AccountSkeleton />}>
            <SoundSettings />
          </Suspense>
        </Card>
      </PageSection>

      <PageSection
        title="Reminders"
        description="Shown inside RECOMP when they're due; browser notifications are optional extras."
      >
        <Card>
          <Suspense fallback={<AccountSkeleton />}>
            <Reminders />
          </Suspense>
        </Card>
      </PageSection>

      <PageSection title="Install app" description="Use RECOMP like an app on iPhone, Mac or PC.">
        <Card>
          <InstallCard />
        </Card>
      </PageSection>

      <PageSection title="Preferences">
        <Card padding="none">
          <ul className="divide-y divide-line">
            {GROUPS.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex min-h-16 items-center gap-4 px-5 py-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted text-ink-soft">
                  <Icon aria-hidden className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{title}</p>
                    <p className="text-sm text-ink-muted">{description}</p>
                  </div>
                  <Badge className="shrink-0">Not available yet</Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </PageSection>
    </PageContainer>
  );
}

/** Reads the session (request-time) — kept behind Suspense. */
async function AccountDetails() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm text-ink-muted">Signed in as</p>
        <p className="truncate font-medium text-ink">{user?.email ?? "Unknown account"}</p>
        <p className="mt-1 text-caption text-ink-muted">
          To change your password, log out and use &ldquo;Forgot password?&rdquo;.
        </p>
      </div>
      <SignOutButton variant="button" />
    </div>
  );
}

async function Reminders() {
  const settings = await getReminderSettings();
  return <ReminderSettingsForm initial={settings} />;
}

async function SoundSettings() {
  const sound = await getSoundPreferences();
  return <SoundControls initialEnabled={sound.enabled} initialVolume={sound.volume} />;
}

/** Start date of the active program; editable until a workout is recorded. */
async function ProgramSettings() {
  const program = await getCurrentProgram();
  if (!program || program.status !== "active") {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[0.9375rem] text-ink-soft">
          {program?.status === "completed" ? "Your last program is complete." : "No active program."}
        </p>
        <ButtonLink href="/dashboard" variant="secondary">
          Start a program
        </ButtonLink>
      </div>
    );
  }

  const sessions = await countProgramSessions(program.id);
  const summary = (
    <div>
      <p className="text-sm text-ink-muted">Current program</p>
      <p className="font-medium text-ink">
        {formatDate(program.startDate, "medium")} – {formatDate(program.endDate, "medium")}
      </p>
    </div>
  );

  if (sessions > 0) {
    return (
      <div className="space-y-2">
        {summary}
        <p className="text-caption text-ink-muted">
          The start date is locked because workouts have been recorded for this program.
        </p>
      </div>
    );
  }

  const options = await buildStartDateOptions();
  if (!options.some((o) => o.value === program.startDate)) {
    options.unshift({ value: program.startDate, label: `${formatDate(program.startDate, "long")} — current` });
  }
  return (
    <div className="space-y-4">
      {summary}
      <StartDateForm
        action={changeProgramStartDate}
        options={options}
        defaultValue={program.startDate}
        submitLabel="Change start date"
        pendingLabel="Saving…"
        hint="Can be changed until your first workout is recorded."
      />
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-5 w-56" />
    </div>
  );
}
