/* Increment this version whenever the offline shell or bundled icons change. */
const CACHE_PREFIX = "physics-tutor-";
const CACHE_NAME = `${CACHE_PREFIX}static-v2`;
const OFFLINE_URL = "/offline.html";
const PUBLIC_FILES = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-maskable-512.png",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PUBLIC_FILES)));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

// An update becomes active only after the user chooses to reload the app.
self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // Never cache HTML, authenticated pages or dynamic educational data.
    event.respondWith(fetch(request).catch(async () => {
      const fallback = await caches.match(OFFLINE_URL, { cacheName: CACHE_NAME });
      return fallback || Response.error();
    }));
    return;
  }

  const staticResource = url.pathname.startsWith("/_next/static/") && ["script", "style", "font"].includes(request.destination);
  if (!PUBLIC_FILES.includes(url.pathname) && !staticResource) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const saved = await cache.match(request);
    if (saved) return saved;
    const response = await fetch(request);
    const policy = response.headers.get("cache-control") || "";
    if (response.ok && response.type === "basic" && !/private|no-store/i.test(policy)) {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
