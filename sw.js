const CACHE_NAME = "guide-du-buron-v18";

// App shell: the pages, styles, and scripts needed to run the app offline.
// Keep this list in sync with actual filenames on disk. Even if a name is
// wrong or a file is missing, it no longer breaks the whole install (see
// the resilient caching below) — it just skips that one file.
const APP_SHELL = [
  "./",
  "./index.html",
  "./home.html",
  "./leburon.html",
  "./flore.html",
  "./gastronomie.html",
  "./activities.html",
  "./contacts.html",
  "./guide.html",
  "./manifest.json",

  "./css/styles.css",
  "./css/leburon.css",
  "./css/flore.css",
  "./css/gastro.css",
  "./css/guide.css",

  "./js/main.js",
  "./js/router.js",

  "./img/logo.png",
  "./img/logo-192.png", // Remove old version later, keep v2
  "./img/logo-512.png",
  "./img/logo-192-v2.png",
  "./img/logo-512-v2.png",
  "./img/logo-1024-v2.png",
  "./img/view1.jpg",
  "./img/icon1.png",
  "./img/icon2.png",
  "./img/icon3.png",
  "./img/icon4.png",
  "./img/icon5.png",
  "./img/icon6.png",
  "./img/wifi.svg",
  "./img/music.svg",
  "./img/eau.svg",
  "./img/gaz.svg",
  "./img/electricite.svg",
  "./img/prise.svg",
  "./img/interrupteur.svg",
  "./img/flame.svg",
  "./img/secours.svg",
  "./img/plancha.svg",

  "./fonts/newsreader/newsreader-400.woff2",
  "./fonts/newsreader/newsreader-400-italic.woff2",
  "./fonts/newsreader/newsreader-500.woff2",
  "./fonts/newsreader/newsreader-500-italic.woff2",
  "./fonts/newsreader/newsreader-600.woff2",
  "./fonts/newsreader/newsreader-600-italic.woff2",
  "./fonts/newsreader/newsreader-700.woff2",
  "./fonts/work-sans/work-sans-400.woff2",
  "./fonts/work-sans/work-sans-400-italic.woff2",
  "./fonts/work-sans/work-sans-500.woff2",
  "./fonts/work-sans/work-sans-600.woff2",
  "./fonts/work-sans/work-sans-700.woff2",
];

// Cache every file individually and don't let one failure block the rest.
// (cache.addAll() aborts the ENTIRE install if a single URL 404s, which is
// what was silently breaking offline support before — one renamed/missing
// file meant the app never got cached at all.)
async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const results = await Promise.allSettled(
    APP_SHELL.map((url) => cache.add(url))
  );
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.warn("[sw] failed to precache:", APP_SHELL[i], result.reason);
    }
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Photos: cache-first, and cache automatically on first successful fetch.
  // Any photo added later — including for brand new gallery pages — gets
  // cached on the tablet the first time it's viewed, with no need to ever
  // touch this file again. Photos never change once shot, so staleness
  // isn't a concern here the way it is for html/css/js below.
  if (url.pathname.includes("/photo/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch (err) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // App shell content (pages, styles, scripts): network-first. These are
  // the files being actively edited during development, so always try the
  // network first and only fall back to the cache when offline — the
  // opposite of the old cache-first behavior, which kept serving a stale
  // guide-tech.html (missing the Gaz section) indefinitely after the first
  // cache write, even across live-reload edits.
  if (
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".json") ||
    url.pathname === "/" ||
    url.pathname.endsWith("/")
  ) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Everything else (icons, misc assets): cache-first, falling back to the
  // network, and topping up the cache with whatever the network gives us
  // so newly-added assets get cached too, not just the ones listed in
  // APP_SHELL above.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cachedResponse);
    })
  );
});
