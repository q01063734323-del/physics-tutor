/* Increment this version whenever the offline shell or bundled icons change. */
const CACHE_PREFIX = "physics-tutor-";
const CACHE_NAME = `${CACHE_PREFIX}static-v3`;
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


// Account binding is stored independently of page lifetime. Private homework is never cached.
function pushDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("physics-push-v1", 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("state"); request.result.createObjectStore("seen"); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function pushBinding() {
  const db = await pushDatabase();
  try { return await new Promise((resolve, reject) => { const request = db.transaction("state").objectStore("state").get("binding"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
  finally { db.close(); }
}
async function reservePush(key) {
  const db = await pushDatabase();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction("seen", "readwrite"), store = tx.objectStore("seen"); let fresh = false;
    const lookup = store.get(key);
    lookup.onsuccess = () => { if (!lookup.result) { fresh = true; store.put({ at: Date.now() }, key); } };
    // Keep only a bounded recent deduplication window; notification tags provide another layer.
    const cursor = store.openCursor();
    cursor.onsuccess = () => { const row = cursor.result; if (row) { if (row.value.at < Date.now() - 30 * 86400000) row.delete(); row.continue(); } };
    tx.oncomplete = () => resolve(fresh); tx.onerror = () => reject(tx.error);
  }); } finally { db.close(); }
}
function pushDestination(value) {
  if (typeof value !== "string" || !/^\/student\?(assignment=[A-Za-z0-9_-]{1,128}|notifications=1)$/.test(value)) return null;
  return new URL(value, self.location.origin).href;
}
self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let payload; try { payload = event.data?.json(); } catch { return; }
    if (!payload || typeof payload.eventId !== "string" || !/^[a-f0-9]{64}$/.test(payload.eventId) || typeof payload.binding !== "string") return;
    const state = await pushBinding().catch(() => null);
    if (!state?.enabled || state.binding !== payload.binding) return;
    const url = pushDestination(payload.url); if (!url) return;
    const allowed = ["Назначена домашняя работа", "До срока домашней работы остались сутки", "Домашняя работа проверена", "Уведомления на этом устройстве работают"];
    if (!allowed.includes(payload.body) || !await reservePush(`${state.binding}:${payload.eventId}`)) return;
    await self.registration.showNotification("Физика с Егором", { body: payload.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: payload.eventId, renotify: false, data: { url, binding: state.binding } });
  })());
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const state = await pushBinding().catch(() => null);
    if (!state?.enabled || state.binding !== event.notification.data?.binding) return;
    const target = new URL(event.notification.data.url);
    if (target.origin !== self.location.origin || !pushDestination(target.pathname + target.search)) return;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) { if (new URL(client.url).origin === self.location.origin && "navigate" in client) { await client.navigate(target.href); await client.focus(); return; } }
    await self.clients.openWindow(target.href);
  })());
});
self.addEventListener("pushsubscriptionchange", event => {
  // Renewal requires a signed-in student. Never persist Firebase tokens in a worker.
  event.waitUntil((async () => { const db = await pushDatabase(); await new Promise((resolve, reject) => { const tx = db.transaction("state", "readwrite"); tx.objectStore("state").put({ enabled: false }, "binding"); tx.oncomplete = resolve; tx.onerror = reject; }); db.close(); })());
});
