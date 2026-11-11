"use client";

import { Download, Share, SquarePlus } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { getServerSnapshot, getSnapshot, promptInstall, subscribe } from "@/lib/pwa/pwa-store";

/** Install RECOMP: native prompt where supported, manual steps on iOS Safari, nothing when already installed. */
export function InstallCard() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [result, setResult] = useState<string | null>(null);

  if (s.standalone) {
    return <p className="text-sm text-ink-muted">Recomp Nisa is installed and running as an app on this device.</p>;
  }
  if (s.canInstall) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-ink-muted">Open Recomp Nisa from your dock or home screen, in its own window.</p>
        <Button
          onClick={async () => {
            const outcome = await promptInstall();
            setResult(outcome === "accepted" ? "Installing…" : outcome === "dismissed" ? "Install cancelled." : null);
          }}
        >
          <Download aria-hidden className="size-4.5" />
          Install app
        </Button>
        {result ? <p className="text-caption text-ink-muted">{result}</p> : null}
      </div>
    );
  }
  if (s.ios) {
    return (
      <ol className="space-y-2 text-sm text-ink-soft">
        <li className="flex items-center gap-2">
          <Share aria-hidden className="size-4.5 shrink-0 text-accent-600" />
          In Safari, tap <strong>Share</strong>.
        </li>
        <li className="flex items-center gap-2">
          <SquarePlus aria-hidden className="size-4.5 shrink-0 text-accent-600" />
          Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
        </li>
        <li className="text-caption text-ink-muted">Then open Recomp Nisa from the Home Screen icon (needed for notifications on iPhone).</li>
      </ol>
    );
  }
  return (
    <p className="text-sm text-ink-muted">
      Your browser hasn&apos;t offered installation yet. In Chrome or Edge use the install icon in the address bar (or
      menu → Install Recomp Nisa); in Safari on Mac use File → Add to Dock.
    </p>
  );
}
