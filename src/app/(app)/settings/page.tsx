import type { Metadata } from "next";
import {
  Bell,
  CalendarDays,
  Ruler,
  Timer,
  UserRound,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Settings" };

const GROUPS: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: UserRound, title: "Profile & account", description: "Name, height, email, password, log out" },
  { icon: CalendarDays, title: "Program", description: "Program start date" },
  { icon: Volume2, title: "Sound", description: "Sound on/off and volume" },
  { icon: Timer, title: "Workout defaults", description: "Default rest duration" },
  { icon: Bell, title: "Reminders", description: "Workout reminder time and measurement reminders" },
  { icon: Ruler, title: "Units", description: "Preferred units" },
];

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader title="Settings" />
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
    </PageContainer>
  );
}
