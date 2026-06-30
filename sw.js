const CACHE_NAME = "guide-du-buron-v1";

const FILES_TO_CACHE = [
  "./index.html",
  "./home.html",
  "./about.html",
  "./css/styles.css",
  "./js/main.js",
  "./js/router.js",
  "./manifest.json",
  "./img/logo.png",
  "./img/logo-192.png",
  "./img/view1.jpg",
  "./img/house.png"
];
ss
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request);
    })
  );
});
