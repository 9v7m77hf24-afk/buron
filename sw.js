const CACHE_NAME = "guide-du-buron-v2";

const FILES_TO_CACHE = [
  "./index.html",
  "./home.html",
  "./leburon.html",
  "./guide-tech.html",
  "./faune-fleur.html",
  "./gastronomie.html",
  "./activites.html",
  "./contact.html",
  "./css/styles.css",
  "./js/main.js",
  "./js/router.js",
  "./js/header_nav.js",
  "./js/footer_nav.js",
  "./manifest.json",
  "./img/view1.jpg",
  "./img/logo.png",
  "./img/logo-192.png",
  "./img/logo-512.png",
  "./img/house.png",
  "./img/icon1.png",
  "./img/icon2.png",
  "./img/icon3.png",
  "./img/icon4.png",
  "./img/icon5.png",
  "./img/icon6.jpg"
];

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
