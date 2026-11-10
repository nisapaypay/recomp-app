"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteWalk } from "@/server/actions/walking";

export function DeleteWalkButton({ id, scheduledLabel }: { id: string; scheduledLabel: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} className="text-danger hover:bg-danger-soft">
        <Trash2 aria-hidden className="size-4.5" />
        Delete walk
      </Button>
      {error ? <Alert tone="danger" className="mt-2">{error}</Alert> : null}
      <ConfirmDialog
        open={open}
        title="Delete this walk?"
        confirmLabel={pending ? "Deleting…" : "Delete"}
        tone="danger"
        busy={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteWalk(id);
            if (!result.ok) {
              setError(result.error ?? "Could not delete the walk.");
              setOpen(false);
              return;
            }
            router.replace("/walking");
          })
        }
      >
        This can&apos;t be undone.
        {scheduledLabel ? ` ${scheduledLabel} will show as not logged again.` : ""}
      </ConfirmDialog>
    </>
  );
}
