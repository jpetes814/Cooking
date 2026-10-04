// Service worker: keeps Recipe Box opening with no signal.
//
// Strategy:
// - Built assets (/_next/static/*) never change for a given build, so they come
//   from the cache first.
// - Page loads try the network and fall back to the cached "/" app shell.
// - /api/* is never cached. Recipe data offline is Firestore's job, not ours.
// - Recipe photos (Firebase Storage downloads) are kept in their own cache,
//   cache-first, so they show with no signal. Each photo's address never
//   changes, and that cache survives new deploys.
// - The cache is named after the build id (passed as ?v=), and activating a new
//   worker deletes every other cache.

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `recipe-box-${VERSION}`;
const PHOTOS = "recipe-box-photos";
const MAX_PHOTOS_CACHED = 300;
const CORE = ["/", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Best-effort: one failed fetch shouldn't abort the whole precache.
      Promise.all(CORE.map((url) => cache.add(url).catch(() => {})))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== PHOTOS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (isPhoto(url)) {
    event.respondWith(photo(req));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
      )
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req, { ignoreSearch: req.mode === "navigate" });
        if (cached) return cached;
        if (req.mode === "navigate") return (await caches.match("/")) || Response.error();
        return Response.error();
      })
  );
});

// A Firebase Storage download (or the local test server's version of one).
function isPhoto(url) {
  return url.pathname.startsWith("/v0/b/") && url.searchParams.get("alt") === "media";
}

async function photo(req) {
  const cache = await caches.open(PHOTOS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  // <img> requests come back opaque (status 0); those are fine to keep.
  if (res.ok || res.type === "opaque") {
    await cache.put(req, res.clone()).catch(() => {});
    trim(cache).catch(() => {});
  }
  return res;
}

// Keeps the photo cache from growing forever: oldest out first.
async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_PHOTOS_CACHED))) await cache.delete(key);
}
