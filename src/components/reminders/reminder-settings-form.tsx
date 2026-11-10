"use client";

import { BellRing } from "lucide-react";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import {
  notificationSupport,
  requestNotificationPermission,
  showReminderNotification,
  type NotificationSupport,
} from "@/lib/reminders/notify";
import { describeDays, type ReminderSettings } from "@/lib/reminders/reminders";
import { cn } from "@/lib/utils/cn";
import { saveReminderSettings } from "@/server/actions/reminders";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const noopSubscribe = () => () => {};

export function ReminderSettingsForm({ initial }: { initial: ReminderSettings }) {
  const [s, setS] = useState<ReminderSettings>(initial);
  // Browser-only values (read without prompting); server render uses neutral defaults.
  const currentPermission = useSyncExternalStore(noopSubscribe, notificationSupport, () => "default" as NotificationSupport);
  const browserTz = useSyncExternalStore(noopSubscribe, () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? null, () => null);
  const [requested, setRequested] = useState<NotificationSupport | null>(null);
  const permission = requested ?? currentPermission;
  const [status, setStatus] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (patch: Partial<ReminderSettings>) => {
    setStatus(null);
    setS((x) => ({ ...x, ...patch }));
  };
  const toggleDay = (d: number) =>
    update({ days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d].sort((a, b) => a - b) });

  function save() {
    const settings = { ...s, timezone: browserTz ?? s.timezone };
    startTransition(async () => {
      const r = await saveReminderSettings(settings);
      if (r.ok) setS(settings);
      setStatus(r.ok ? { tone: "success", text: "Reminder settings saved to your account." } : { tone: "danger", text: r.error ?? "Could not save." });
    });
  }

  async function enableNotifications() {
    setRequested(await requestNotificationPermission());
  }

  async function test() {
    const ok = await showReminderNotification({ id: `test:${Date.now()}`, kind: "workout", title: "RECOMP reminder", body: "Notifications work on this device.", href: "/dashboard" });
    setStatus(ok ? { tone: "success", text: "Test notification sent." } : { tone: "danger", text: "This browser didn't show the notification." });
  }

  const tz = browserTz ?? s.timezone;
  const days = describeDays(s.days);

  return (
    <div className="space-y-5">
      <Row
        label="Workout reminder"
        hint="Today's strength, walking or recovery day — not sent once it's done."
        enabled={s.workoutEnabled}
        onToggle={(v) => update({ workoutEnabled: v })}
        time={s.workoutTime}
        onTime={(v) => update({ workoutTime: v })}
      />
      <Row
        label="Measurement reminder"
        hint="Weeks 1, 4, 8 and 12 until the check-in is saved (also when it's late)."
        enabled={s.measurementEnabled}
        onToggle={(v) => update({ measurementEnabled: v })}
        time={s.measurementTime}
        onTime={(v) => update({ measurementTime: v })}
      />

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-soft">Days</legend>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d, i) => (
            <button key={d} type="button" aria-pressed={s.days.includes(i + 1)} onClick={() => toggleDay(i + 1)}
              className={cn("h-11 min-w-11 rounded-chip px-3 text-sm font-medium",
                s.days.includes(i + 1) ? "bg-accent-600 text-white" : "border border-line bg-surface text-ink-soft hover:bg-surface-muted")}>
              {d}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="rounded-control bg-surface-muted p-4 text-sm text-ink-soft" aria-live="polite">
        <p className="font-medium text-ink">Preview</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>{s.workoutEnabled ? `Workout: ${days} at ${s.workoutTime}` : "Workout reminder off"}</li>
          <li>{s.measurementEnabled ? `Measurement: ${days} at ${s.measurementTime}, in check-in weeks` : "Measurement reminder off"}</li>
        </ul>
        <p className="mt-2 text-caption text-ink-muted">Times use your timezone: {tz}.</p>
      </div>

      {status ? <Alert tone={status.tone}>{status.text}</Alert> : null}
      <Button onClick={save} disabled={pending || s.days.length === 0}>
        {pending ? "Saving…" : "Save reminders"}
      </Button>

      <div className="border-t border-line pt-4">
        <p className="flex items-center gap-2 font-medium text-ink">
          <BellRing aria-hidden className="size-4.5 text-accent-600" />
          Browser notifications
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Reminders always appear inside RECOMP. Notifications are extra and only arrive while RECOMP is open or
          running in the background — without a push server they can&apos;t fire when the app is fully closed.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {permission === "default" ? (
            <Button variant="secondary" onClick={enableNotifications}>Enable notifications</Button>
          ) : permission === "granted" ? (
            <>
              <span className="text-sm font-medium text-success">Allowed on this device</span>
              <Button variant="ghost" size="sm" onClick={test}>Send a test</Button>
            </>
          ) : permission === "denied" ? (
            <span className="text-sm text-ink-muted">Blocked in this browser&apos;s settings — in-app reminders still work.</span>
          ) : (
            <span className="text-sm text-ink-muted">
              Not supported here — in-app reminders still work. On iPhone, notifications need RECOMP installed to the Home Screen (iOS 16.4+).
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, hint, enabled, onToggle, time, onTime }: {
  label: string; hint: string; enabled: boolean; onToggle: (v: boolean) => void; time: string; onTime: (v: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <label htmlFor={`${id}-toggle`} className="font-medium text-ink">{label}</label>
        <p className="text-sm text-ink-muted">{hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <input type="time" aria-label={`${label} time`} value={time} onChange={(e) => onTime(e.target.value)} disabled={!enabled}
          className={cn(inputClasses, "h-11 w-32 tabular-nums")} />
        <button id={`${id}-toggle`} type="button" role="switch" aria-checked={enabled} onClick={() => onToggle(!enabled)}
          className={cn("relative h-8 w-14 shrink-0 rounded-full transition-colors", enabled ? "bg-accent-600" : "bg-line-strong")}>
          <span className={cn("absolute top-1 size-6 rounded-full bg-white shadow transition-[left]", enabled ? "left-7" : "left-1")} />
          <span className="sr-only">{enabled ? "On" : "Off"}</span>
        </button>
      </div>
    </div>
  );
}
