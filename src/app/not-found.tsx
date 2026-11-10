import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="This page doesn't exist."
        action={<ButtonLink href="/dashboard">Back to dashboard</ButtonLink>}
        className="w-full max-w-md bg-surface"
      />
    </div>
  );
}
