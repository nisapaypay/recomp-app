import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { PageContainer, PageHeader, PageSection } from "@/components/layout/page";
import { PhotoCompare } from "@/components/progress/photo-compare";
import { PhotoManager } from "@/components/progress/photo-manager";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { nextCheckIn } from "@/lib/measurements/measurements";
import { getPhotos, getProgressContext } from "@/server/progress/queries";

export const metadata: Metadata = { title: "Progress photos" };

export default function PhotosPage() {
  return (
    <PageContainer>
      <Link href="/progress" className="mb-4 inline-flex h-11 items-center gap-1 rounded-control pr-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ChevronLeft aria-hidden className="size-4.5" />
        Progress
      </Link>
      <PageHeader eyebrow="Private" title="Progress photos" description="Front, side and back at weeks 1, 4, 8 and 12. Only you can see them." />
      <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
        <Content />
      </Suspense>
    </PageContainer>
  );
}

async function Content() {
  const [photos, ctx] = await Promise.all([getPhotos(), getProgressContext()]);
  const suggested = nextCheckIn(ctx.schedule)?.week ?? 1;
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
      <PageSection title="Upload" className="mt-0">
        <Card padding="lg">
          <PhotoManager photos={photos} today={ctx.today} suggestedWeek={suggested} />
        </Card>
      </PageSection>
      <PageSection title="Compare" className="mt-0">
        <Card padding="lg">
          <PhotoCompare photos={photos} />
        </Card>
      </PageSection>
    </div>
  );
}
