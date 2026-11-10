"use client";

/**
 * Browser-side PWA state shared by the agent and the settings page:
 * online status, service-worker update availability, and the deferred
 * `beforeinstallprompt` event (captured once, as early as possible).
 * Exposed via useSyncExternalStore.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type PwaSnapshot = {
  online: boolean;
  updateReady: boolean;
  canInstall: boolean;
  standalone: boolean;
  ios: boolean;
};

const SERVER: PwaSnapshot = { online: true, updateReady: false, canInstall: false, standalone: false, ios: false };

let snapshot: PwaSnapshot = SERVER;
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let waiting: ServiceWorker | null = null;
let started = false;
const listeners = new Set<() => void>();

function set(patch: Partial<PwaSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  for (const l of listeners) l();
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function trackRegistration(reg: ServiceWorkerRegistration) {
  const markWaiting = (sw: ServiceWorker | null) => {
    if (sw && navigator.serviceWorker.controller) {
      waiting = sw;
      set({ updateReady: true });
    }
  };
  markWaiting(reg.waiting);
  reg.addEventListener("updatefound", () => {
    const installing = reg.installing;
    installing?.addEventListener("statechange", () => {
      if (installing.state === "installed") markWaiting(reg.waiting ?? installing);
    });
  });
}

/** Idempotent: wires listeners and registers /sw.js (production only, to keep dev HMR clean). */
export function startPwa() {
  if (started || typeof window === "undefined") return;
  started = true;
  snapshot = { online: navigator.onLine, updateReady: false, canInstall: false, standalone: isStandaloneDisplay(), ios: isIOS() };

  window.addEventListener("online", () => set({ online: true }));
  window.addEventListener("offline", () => set({ online: false }));
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // show our own Install button instead of the mini-infobar
    deferredPrompt = e as BeforeInstallPromptEvent;
    set({ canInstall: !isStandaloneDisplay() });
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    set({ canInstall: false, standalone: true });
  });

  if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        trackRegistration(reg);
        // Look for a new version when the app comes back to the foreground.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update().catch(() => {});
        });
      })
      .catch(() => {
        // No service worker (unsupported / blocked): the app works normally online.
      });
  }
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const getSnapshot = () => snapshot;
export const getServerSnapshot = () => SERVER;

/** Activate the waiting service worker; the page reloads on controllerchange. */
export function applyUpdate() {
  waiting?.postMessage({ type: "SKIP_WAITING" });
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  const e = deferredPrompt;
  deferredPrompt = null;
  set({ canInstall: false });
  await e.prompt();
  return (await e.userChoice).outcome;
}
