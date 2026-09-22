// Minimal service worker: exists mainly so Android/Chrome treats this as an
// installable app. Network-first for our own static files (never for the
// Apps Script API or Google Sign-In, which are cross-origin) — cache is
// only a fallback when offline, so it never masks a fresh deploy the way a
// cache-first strategy would.
const CACHE_NAME = "ibunda-booking-v1";
const SHELL_FILES = [
  "index.html",
  "bookings.html",
  "admin.html",
  "style.css",
  "shared.js",
  "app.js",
  "bookings.js",
  "admin.js",
  "config.js",
  "assets/logo.jpg",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
