"use client";

import type { Reminder } from "./reminders";

/**
 * Browser-notification helpers (best effort). Permission is requested only
 * from an explicit user action. Delivered/dismissed ids are remembered in
 * localStorage — UI state only, never program data.
 */

export type NotificationSupport = "unsupported" | "default" | "granted" | "denied";

export function notificationSupport(): NotificationSupport {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationSupport> {
  if (notificationSupport() === "unsupported") return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return notificationSupport();
  }
}

const NOTIFIED = "recomp:reminders:notified";
const DISMISSED = "recomp:reminders:dismissed";

function readSet(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function writeSet(key: string, set: Set<string>) {
  try {
    // Keep the most recent 60 ids (ids are per day, so this is ~a month).
    window.localStorage.setItem(key, JSON.stringify([...set].slice(-60)));
  } catch {
    // Storage full / private mode: worst case a banner reappears.
  }
}

export const notifiedIds = () => readSet(NOTIFIED);
export const dismissedIds = () => readSet(DISMISSED);
export function markNotified(id: string) {
  const s = readSet(NOTIFIED);
  s.add(id);
  writeSet(NOTIFIED, s);
}
export function markDismissed(id: string) {
  const s = readSet(DISMISSED);
  s.add(id);
  writeSet(DISMISSED, s);
}

/** Show via the service worker when available (works in installed iOS/Android apps), else the page API. */
export async function showReminderNotification(r: Reminder): Promise<boolean> {
  if (notificationSupport() !== "granted") return false;
  const options: NotificationOptions = { body: r.body, tag: r.id, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { href: r.href } };
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) {
      await reg.showNotification(r.title, options);
      return true;
    }
    const n = new Notification(r.title, options);
    n.onclick = () => {
      window.focus();
      window.location.assign(r.href);
    };
    return true;
  } catch {
    return false;
  }
}
