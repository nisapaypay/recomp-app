import type { Metadata } from "next";
import { Footprints } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Walking" };

export default function WalkingPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Tuesday & Saturday"
        title="Walking"
        description="Log walks from your Apple Watch: date, duration, distance and optional steps and notes. Pace is calculated for you."
      />
      <EmptyState
        icon={Footprints}
        title="No walks logged"
        description="Walk logging becomes available once your account is connected."
        action={<Badge tone="accent">In development</Badge>}
      />
    </PageContainer>
  );
}
