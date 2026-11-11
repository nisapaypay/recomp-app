"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { applyUpdate, getServerSnapshot, getSnapshot, startPwa, subscribe } from "@/lib/pwa/pwa-store";

/**
 * Mounted once in the root layout: registers the service worker, captures the
 * install prompt, and shows two honest status bars:
 *  - offline: nothing is saved until the connection returns (no fake success);
 *  - update ready: the user decides when to reload (never mid-workout by itself).
 */
export function PwaAgent() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => startPwa(), []);

  return (
    <>
      {!s.online ? (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-ink px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] text-center text-sm text-white"
        >
          <CloudOff aria-hidden className="size-4 shrink-0" />
          You&apos;re offline. Changes aren&apos;t saved until you&apos;re back online — Recomp Nisa retries automatically.
        </div>
      ) : null}
      {s.updateReady ? (
        <div
          role="status"
          className="fixed inset-x-3 bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+0.75rem)] z-50 mx-auto flex max-w-md items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-raised md:bottom-6"
        >
          <RefreshCw aria-hidden className="size-5 shrink-0 text-accent-600" />
          <p className="flex-1 text-sm text-ink">A new version of Recomp Nisa is ready.</p>
          <button
            type="button"
            onClick={applyUpdate}
            className="min-h-11 rounded-control bg-accent-600 px-4 text-sm font-semibold text-white hover:bg-accent-700"
          >
            Reload
          </button>
        </div>
      ) : null}
    </>
  );
}
