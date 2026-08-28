const content = document.getElementById('content');
const FADE_MS = 200;

// Links on HOME page
function bindPageLinks() {
  document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      if (location.hash.slice(1) !== page) {
        loadPage(page);
      }
    });
  });
}

// Explicit toggle handling for <details class="toggle-test">. Native
// <details>/<summary> disclosure should work with zero JS, but embedded
// WebViews (e.g. Fully Kiosk on the Redmi tablet) aren't reliable about
// firing it once <summary> has non-default display styling — so we drive
// it ourselves instead of depending on that native behavior.
function bindToggles() {
  content.querySelectorAll('.toggle-test > summary').forEach(summary => {
    summary.addEventListener('click', (e) => {
      e.preventDefault(); // stop native toggle so it never double-fires where it does work
      summary.parentElement.open = !summary.parentElement.open;
    });
  });
}

// Explicit tab handling for the floor-plan section (.floor-tabs / .floor-tab
// / .floor-plane). Same reasoning as bindToggles(): content is injected via
// innerHTML, so this has to be driven from router.js rather than an inline
// <script> in guide.html, which would never execute.
function bindFloorTabs() {
  content.querySelectorAll('.floor-tabs').forEach(tabs => {
    const planes = content.querySelectorAll('.floor-plane');
    tabs.querySelectorAll('.floor-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const floor = tab.dataset.floor;
        tabs.querySelectorAll('.floor-tab').forEach(t => t.classList.toggle('active', t === tab));
        planes.forEach(p => p.classList.toggle('active', p.dataset.floor === floor));
      });
    });
  });
}

// Closes every open dot tooltip on the currently loaded page. Shared by
// bindPlanDots, bindPlanLinks, and the document-level "tap outside" handler
// below, so there's one definition of "what closing a tooltip means".
function closeAllPlanTips() {
  content.querySelectorAll('.plan-dot.tip-visible').forEach(d => d.classList.remove('tip-visible'));
}

// Explicit click handling for .plan-dot buttons on the floor plan. Each dot
// carries its position as inline left/top percentages (set directly in
// guide.html) and its text in data-label — nothing here needs editing when
// a dot is added, moved, or relabeled; only guide.html does.
//
// Tapping a dot opens a small tooltip anchored right next to it (built from
// data-label, see the .dot-tip element appended below) and closes any other
// tooltip that was already open. Tapping the same dot again, tapping
// anywhere else on the page, or switching floor tabs all close it.
//
// Dismissal is deliberately tap-based rather than hover-based: the app runs
// on a touch tablet with no mouse, so a tooltip that only closed on
// mouseleave would never close there. mouseleave is still wired up too, as
// a convenience when testing in a desktop browser — both paths lead to the
// same closeAllPlanTips() call.
function bindPlanDots() {
  content.querySelectorAll('.plan-dot').forEach(dot => {
    if (!dot.querySelector('.dot-tip')) {
      const tip = document.createElement('span');
      tip.className = 'dot-tip';
      tip.textContent = dot.dataset.label || '';
      dot.appendChild(tip);
    }

    dot.addEventListener('click', (e) => {
      e.stopPropagation(); // don't let this same click immediately trigger the "tap outside" listener below
      const wasOpen = dot.classList.contains('tip-visible');
      closeAllPlanTips();
      if (!wasOpen) dot.classList.add('tip-visible');
    });

    dot.addEventListener('mouseleave', () => dot.classList.remove('tip-visible'));
  });
}

// Click handling for ".plan-link" buttons (e.g. inside a toggle body) that
// jump to the floor plan and open every dot sharing a given data-point:
// switch to the right floor tab, open all matching dots' tooltips, and
// scroll to the first one. Matching on data-point (not data-label's display
// text) means several dots can share the same point on purpose — e.g. two
// fire extinguishers both tagged data-point="extincteur" — and one link
// opens both at once, exactly as many dots as share that value.
function bindPlanLinks() {
  content.querySelectorAll('.plan-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.stopPropagation(); // otherwise the tooltip we're about to open gets immediately closed by the document listener below
      const floor = link.dataset.floor;
      const point = link.dataset.point;
      if (!floor || !point) return;

      // switch floor by clicking the real tab button, so bindFloorTabs'
      // own logic handles showing/hiding the panes — no duplicated logic
      const tab = content.querySelector(`.floor-tab[data-floor="${floor}"]`);
      if (tab && !tab.classList.contains('active')) tab.click();

      const pane = content.querySelector(`.floor-plane[data-floor="${floor}"]`);
      const dots = pane ? pane.querySelectorAll(`.plan-dot[data-point="${point}"]`) : [];
      if (!dots.length) return;

      closeAllPlanTips();
      dots.forEach(dot => {
        dot.classList.remove('pulse');
        dot.classList.add('tip-visible');
        // retrigger the pulse animation even if it already ran on this dot
        requestAnimationFrame(() => dot.classList.add('pulse'));
      });

      // scroll to the first match — with two dots close together on the
      // same plan this is enough to bring both into view at once; if they
      // end up far apart, scrolling can only center on one of them
      dots[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
}

// Bound once, here at top level — not inside bindPlanDots/bindPlanLinks,
// since those re-run on every page load while `document` itself persists
// across navigations. Re-adding this inside them would stack duplicate
// listeners over time (same reasoning gallery-engine.js documents for its
// own keydown handler).
document.addEventListener('click', closeAllPlanTips);

async function loadPage(page, push = true, { reveal = true } = {}) {
  content.classList.add('fading');

  let html;
  try {
    const res = await fetch(`./${page}.html`);
    if (!res.ok) throw new Error(`Page not found: ${page}`);
    html = await res.text();
  } catch (err) {
    html = `<h1>Page not found</h1><p>${err.message}</p>`;
  }

  if (push) {
    history.pushState({ page }, '', `#${page}`);
  }

  // Wrapped in a promise so callers (notably the initial startup splash
  // handling below) can await "content is actually in the DOM" instead of
  // guessing with their own timer. `reveal: false` leaves #content hidden
  // (still in .fading) even once the DOM is populated — used only for the
  // very first load, so the app can show the background alone for a beat
  // before deliberately revealing the menu (see revealContent() below).
  return new Promise((resolve) => {
    setTimeout(() => {
      content.innerHTML = html;
      if (reveal) content.classList.remove('fading');
      document.body.dataset.page = page;
      bindPageLinks();  // re-bind, since #content's links are new DOM nodes
      bindToggles();    // re-bind for whichever page just loaded; safe no-op on pages with no .toggle-test markup
      bindFloorTabs();  // re-bind for whichever page just loaded; safe no-op on pages with no .floor-tabs markup
      bindPlanDots();   // re-bind for whichever page just loaded; safe no-op on pages with no .plan-dot markup
      bindPlanLinks();  // re-bind for whichever page just loaded; safe no-op on pages with no .plan-link markup

      // re-run gallery init for whichever page just loaded; safe no-op on
      // pages with no .carousel markup
      window.GalleryEngine?.init();
      resolve();
    }, FADE_MS);
  });
}

// Reveals #content when it was loaded with { reveal: false }. Reuses the
// same .fading/opacity transition already defined in styles.css, so this
// fade-in looks identical to a normal page transition.
function revealContent() {
  content.classList.remove('fading');
}

// Handle nav clicks
document.querySelectorAll('[data-page]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    if (location.hash.slice(1) !== page) {
      loadPage(page);
    }
  });
});

// Handle browser back/forward
window.addEventListener('popstate', (e) => {
  const page = e.state?.page || location.hash.slice(1) || 'home';
  loadPage(page, false);
});

// Initial load on first visit / refresh
bindPageLinks();
const initialPage = location.hash.slice(1) || 'home';
history.replaceState({ page: initialPage }, '', `#${initialPage}`);

// Startup splash: index.html shows a full-screen #app-splash overlay (same
// background/logo as the native OS splash) so this handoff reads as one
// continuous launch instead of native-splash -> blank/unstyled flash ->
// menu popping in. The home page loads hidden (reveal:false) so it's
// ready in the DOM but not shown yet — once fonts are loaded and a
// minimum splash time has passed, the splash fades out revealing the
// background alone, and only after a further short pause does the menu
// itself fade in on top. That staged reveal (background settles first,
// then UI) is what makes the launch read as deliberate rather than an
// abrupt pop-in.
const MIN_SPLASH_MS = 600;
const BG_SETTLE_MS = 1000; // 700 before, how long the background shows alone before the menu fades in
const splashStart = performance.now();

Promise.all([
  loadPage(initialPage, false, { reveal: false }),
  (document.fonts && document.fonts.ready) || Promise.resolve()
]).then(() => {
  const elapsed = performance.now() - splashStart;
  const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
  setTimeout(() => {
    hideSplash();
    setTimeout(revealContent, BG_SETTLE_MS);
  }, remaining);
});

function hideSplash() {
  const splash = document.getElementById('app-splash');
  if (!splash) return;
  splash.classList.add('splash-hidden');
  splash.addEventListener('transitionend', () => splash.remove(), { once: true });
}
