// public/sw.js — service worker for offline support
// Caches all navigation and static assets on first load.

const CACHE_NAME = "panal-v1";
const STATIC_ASSETS = [
  "/",
  "/today",
  "/dashboard",
  "/calendar",
  "/connectors",
  "/settings",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Partial failure is OK during dev; all routes may not be pre-built
      });
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle GET requests; skip cross-origin API calls
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached ?? new Response("Offline", { status: 503 }));

      // Cache-first for static assets, network-first for HTML navigation
      if (event.request.mode === "navigate") return networkFetch;
      return cached ?? networkFetch;
    }),
  );
});
