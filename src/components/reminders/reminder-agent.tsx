"use client";

import { Bell, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dismissedIds, markDismissed, markNotified, notifiedIds, showReminderNotification } from "@/lib/reminders/notify";
import { dueReminders, toNotify, type ReminderInputs, type ReminderSettings } from "@/lib/reminders/reminders";

type Data = { settings: ReminderSettings; inputs: ReminderInputs };

const REFRESH_MS = 5 * 60_000; // re-read status from Supabase
const TICK_MS = 60_000; // re-evaluate times

/**
 * Evaluates reminders while the app is open (load, tab visible, every
 * minute). Always shows due reminders in-app; additionally sends ONE browser
 * notification per reminder when permission is granted. Completed activities
 * / saved check-ins drop out as soon as the status is re-read.
 */
async function fetchReminders(): Promise<Data | null> {
  try {
    const res = await fetch("/api/reminders", { cache: "no-store" });
    return res.ok ? ((await res.json()) as Data) : null; // signed out / offline / unavailable: keep quiet
  } catch {
    return null;
  }
}

export function ReminderAgent() {
  const [data, setData] = useState<Data | null>(null);
  const [now, setNow] = useState(0); // set from callbacks only (no clock read during render)
  const [hidden, setHidden] = useState<Set<string>>(() => (typeof window === "undefined" ? new Set() : dismissedIds()));
  const lastFetch = useRef(0);

  const refresh = useCallback(() => {
    lastFetch.current = Date.now();
    void fetchReminders().then((d) => {
      if (!d) return;
      setData(d);
      setNow(Date.now());
    });
  }, []);

  // Read status on load, when the tab becomes visible, when back online, and every 5 min; re-evaluate times each minute.
  useEffect(() => {
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
        setNow(Date.now());
      }
    };
    const tick = window.setInterval(() => {
      if (Date.now() - lastFetch.current > REFRESH_MS) refresh();
      setNow(Date.now());
    }, TICK_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);

  const due = useMemo(() => (data && now > 0 ? dueReminders(new Date(now), data.settings, data.inputs) : []), [data, now]);

  // Side effect only: one browser notification per reminder id.
  useEffect(() => {
    for (const r of toNotify(due, notifiedIds())) {
      markNotified(r.id); // mark first: a second tab / re-render never notifies again
      void showReminderNotification(r);
    }
  }, [due]);

  const visible = due.filter((r) => !hidden.has(r.id));
  if (visible.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-2 px-4 pt-4 sm:px-6 md:px-8 lg:px-10">
      {visible.map((r) => (
        <div key={r.id} role="status" className="flex items-start gap-3 rounded-card border border-accent-200 bg-accent-50 px-4 py-3">
          <Bell aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-700" />
          <Link href={r.href} className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">{r.title}</span>
            <span className="block text-sm text-ink-soft">{r.body}</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              markDismissed(r.id);
              setHidden(dismissedIds());
            }}
            className="grid size-11 shrink-0 place-items-center rounded-control text-ink-muted hover:bg-accent-100"
            aria-label={`Dismiss reminder: ${r.title}`}
          >
            <X aria-hidden className="size-4.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
