import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import manifest from "../../src/app/manifest.ts";

const root = path.resolve(import.meta.dirname, "..", "..");
const ORIGIN = "https://recomp.example";

/** Run public/sw.js in a fake ServiceWorkerGlobalScope and record what it caches. */
async function loadWorker() {
  const source = await readFile(path.join(root, "public", "sw.js"), "utf8");
  const handlers = {};
  const puts = [];
  const store = new Map();
  const cacheApi = {
    async open() {
      return {
        match: async (req) => store.get(typeof req === "string" ? req : req.url),
        put: async (req, res) => {
          puts.push(typeof req === "string" ? req : req.url);
          store.set(typeof req === "string" ? req : req.url, res);
        },
        addAll: async (urls) => urls.forEach((u) => store.set(u, { ok: true, url: u })),
      };
    },
    keys: async () => [],
    delete: async () => true,
    match: async (u) => store.get(u),
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => (handlers[type] = fn),
    skipWaiting: () => (self.skipped = true),
    clients: { claim: async () => {} },
  };
  const fakeFetch = async (req) => ({ ok: true, url: req.url ?? req, clone() { return this; } });
  vm.runInNewContext(source, { self, caches: cacheApi, fetch: fakeFetch, URL, Promise });

  async function request(url, { method = "GET", mode = "cors" } = {}) {
    let responded = null;
    const event = { request: { url: new URL(url, ORIGIN).href, method, mode }, respondWith: (p) => (responded = p) };
    handlers.fetch(event);
    if (responded) await responded;
    await new Promise((r) => setTimeout(r, 0));
    return responded !== null;
  }
  return { handlers, puts, request, self };
}

test("service worker never caches personal data", async () => {
  const w = await loadWorker();
  // Page HTML: network only (offline fallback), never stored.
  assert.equal(await w.request("/dashboard", { mode: "navigate" }), true);
  // RSC payloads, API, auth, POST, Supabase (incl. signed photo URLs): not touched at all.
  assert.equal(await w.request("/dashboard?_rsc=abc"), false);
  assert.equal(await w.request("/api/reminders"), false);
  assert.equal(await w.request("/api/workout/checkpoint", { method: "POST" }), false);
  assert.equal(await w.request("/auth/callback?code=x"), false);
  assert.equal(await w.request("https://abc.supabase.co/rest/v1/body_measurements?select=*"), false);
  assert.equal(await w.request("https://abc.supabase.co/storage/v1/object/sign/progress-photos/u/week-1/front.jpg?token=t"), false);
  assert.deepEqual(w.puts, []);
});

test("service worker caches only public static files", async () => {
  const w = await loadWorker();
  assert.equal(await w.request("/_next/static/chunks/app-123.js"), true);
  assert.equal(await w.request("/icons/icon-192.png"), true);
  assert.equal(await w.request("/audio/go.wav"), true);
  assert.deepEqual(w.puts.map((u) => new URL(u).pathname).sort(), ["/_next/static/chunks/app-123.js", "/audio/go.wav", "/icons/icon-192.png"]);
});

test("service worker update waits for the user (SKIP_WAITING message)", async () => {
  const w = await loadWorker();
  assert.equal(w.self.skipped, undefined);
  w.handlers.message({ data: { type: "SKIP_WAITING" } });
  assert.equal(w.self.skipped, true);
});

function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test("manifest: installable fields and existing icons of the right size", async () => {
  const m = manifest();
  assert.equal(m.name, "RECOMP");
  assert.equal(m.short_name, "RECOMP");
  assert.equal(m.start_url, "/");
  assert.equal(m.display, "standalone");
  assert.match(m.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(m.background_color, /^#[0-9a-f]{6}$/i);
  for (const icon of m.icons) {
    const buf = await readFile(path.join(root, "public", icon.src));
    const [w, h] = icon.sizes.split("x").map(Number);
    assert.deepEqual(pngSize(buf), { width: w, height: h }, icon.src);
  }
  assert.ok(m.icons.some((i) => i.sizes === "192x192"));
  assert.ok(m.icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable"));
  const offline = await readFile(path.join(root, "public", "offline.html"), "utf8");
  assert.match(offline, /Nothing has been saved/);
});
