/*
 * RECOMP service worker — privacy-first, deliberately small.
 *
 * Caches ONLY public, non-personal files:
 *   - /_next/static/*  (content-hashed build assets)      cache-first
 *   - /icons/*, /audio/*, /illustrations/*                  stale-while-revalidate
 *   - /offline.html                                          precached fallback
 * Never cached: page HTML / RSC payloads (they contain personal data), /api/*,
 * /auth/*, any non-GET request, and every cross-origin request (Supabase API,
 * Auth, Storage and signed photo URLs). Sessions are untouched: requests that
 * aren't handled here go straight to the network.
 *
 * Bump VERSION when this file's caching rules change.
 */
const VERSION = "recomp-sw-v1";
const STATIC_CACHE = `${VERSION}-static`;
const ASSET_CACHE = `${VERSION}-assets`;
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(ASSET_CACHE).then((cache) => cache.addAll(PRECACHE)));
  // No skipWaiting here: a new version waits until the user chooses "Reload".
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isPublicAsset(url) {
  return url.pathname.startsWith("/icons/") || url.pathname.startsWith("/audio/") || url.pathname.startsWith("/illustrations/");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase & signed URLs: never touched
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Pages: always from the network (personal data is never stored). Offline → fallback page.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  // Immutable build assets.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Public static files.
  if (isPublicAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => hit);
        return hit || network;
      }),
    );
  }
  // Everything else (RSC payloads, _next/image, manifest, …): network only.
});

// Reminder notifications shown by the open app → focus / open the app on click.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.href) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
