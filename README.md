# PWA single-shell page-swap pattern

This fixes the background flash/glitch by never reloading the page between
"pages." Instead, `index.html` is a persistent shell that holds the
background, and `js/router.js` swaps in page content fetched from
`pages/*.html` fragments.

## Files

- `index.html` — the shell: background div, nav, and #content container
- `pages/home.html`, `pages/about.html` — content-only fragments (no
  <html>/<head>/<body> tags — just the inner markup)
- `css/styles.css` — shared styles, including the persistent `.background`
  element and the fade transition on `#content`
- `js/router.js` — fetches fragments and swaps them into #content, handles
  back/forward via the History API + hash
- `manifest.json` — minimal PWA manifest (fill in icons, etc. as needed)

## How to add more pages

1. Create `pages/yourpage.html` with just the inner content.
2. Add a nav link: `<a href="#" data-page="yourpage" class="nav-link">Your Page</a>`

That's it — the router picks it up automatically.

## If you already have a service worker

Make sure your cache list includes the page fragments, e.g.:

```js
const CACHE_NAME = 'app-v1';
const ASSETS = [
  '/index.html',
  '/css/styles.css',
  '/js/router.js',
  '/pages/home.html',
  '/pages/about.html',
  '/manifest.json'
];
```

## Notes

- `start_url` in the manifest should point to `index.html` (or `/`) —
  this is unaffected by the change.
- Direct links to `index.html#about` will load the About page on first
  load, since `router.js` reads the hash on startup.
- If you need server-rendered/indexable URLs instead of hash-based ones,
  swap the hash routing for the History API (`pushState`) and add a
  server rewrite so every path falls back to `index.html`.
