// GalleryEngine — shared carousel + fullscreen-viewer behavior for any page
// that follows the markup contract below. Currently used by leburon.html
// (one visible carousel) and flore.html (42 hidden per-species carousels,
// one shared .viewer). Drop the same markup into any future page and
// GalleryEngine.init() (already called after every route change by
// router.js) picks it up automatically — no page-specific JS required.
//
// Markup contract, all class-based (no IDs are read by this file, except
// for the optional id-based direct-open lookup described below):
//
//   <div class="carousel">
//     <div class="carousel-track">
//       <div class="slide active" data-index="0">
//         <img src="..." alt="Shown as the viewer caption">
//       </div>
//       <div class="slide" data-index="1">...</div>
//     </div>
//     <button class="car-btn prev"></button>   <!-- omit both car-btn's -->
//     <button class="car-btn next"></button>   <!-- for a single-photo gallery -->
//   </div>
//   <div class="dots"></div>                   <!-- must directly follow -->
//                                               <!-- .carousel; omit for a -->
//                                               <!-- single-photo gallery -->
//
// A page gets the click/keyboard/swipe-driven fullscreen lightbox for free
// by also including exactly one shared, page-level viewer (multiple
// carousels may all open the same one, as on flore.html):
//
//   <dialog class="viewer">
//     <button class="close">&times;</button>
//     <button class="prev">&#8249;</button>
//     <img src="" alt="">
//     <button class="next">&#8250;</button>
//     <div class="caption"></div>
//   </dialog>
//
// The .viewer is optional — a page with only .carousel markup and no
// .viewer still gets a working prev/next/dots carousel, just no
// click-to-expand lightbox.
//
// --- Direct-open carousels (flore.html's species galleries) ---
//
// A carousel doesn't have to be visible on the page to be usable — it can
// exist purely as a data source that's opened straight into the fullscreen
// .viewer, skipping the inline prev/next/dots UI entirely. Give it an id
// and hide it with CSS (see .gallery-hidden in flore.css):
//
//   <div class="carousel gallery-hidden" id="g1">
//     <div class="carousel-track">
//       <div class="slide active" data-index="0">
//         <img src="..." alt="Per-photo caption shown in the viewer">
//       </div>
//     </div>
//   </div>
//
// Then trigger it from anywhere (typically a thumbnail's onclick) with:
//
//   GalleryEngine.open('g1')        // opens at the first photo
//   GalleryEngine.open('g1', 2)     // opens at a specific photo index
//
// car-btn/dots markup is pointless on a hidden carousel (nothing ever
// renders it) and can be omitted — prev/next/swipe/keyboard navigation
// once inside the fullscreen viewer all come from the .viewer itself.
//
// Horizontal card strips (flore.html's .card-grid galleries) get
// click-to-scroll buttons independently of the carousel/viewer markup above:
//
//   <div class="gallery">
//     <div class="card-grid">...</div>
//     <button class="grid-prev"></button>
//     <button class="grid-next"></button>
//   </div>
//
// .card-grid strips also loop infinitely: GalleryEngine clones the card
// set once on each side (real cards stay untouched, clones are marked
// aria-hidden + inert to tab order) so both button clicks and touch swipes
// can travel past either end and land back at the seam without a visible
// jump. See makeGridInfinite() below.

window.GalleryEngine = (function () {
  let keydownHandler = null; // tracks the listener so a re-init doesn't stack duplicates on document
  let instancesById = {};    // populated fresh by init() each route load; keys are carousel element ids

  function buildCarousel(carouselEl, viewerApi) {
    const slides = Array.from(carouselEl.querySelectorAll('.slide'));
    if (slides.length === 0) return null;

    const track = carouselEl.querySelector('.carousel-track');
    const prevBtn = carouselEl.querySelector('.car-btn.prev');
    const nextBtn = carouselEl.querySelector('.car-btn.next');
    const dotsContainer = carouselEl.nextElementSibling?.classList.contains('dots')
      ? carouselEl.nextElementSibling
      : null;

    let current = 0;

    if (dotsContainer) {
      dotsContainer.innerHTML = '';
      slides.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.classList.add('dot');
        if (i === 0) dot.classList.add('active');
        dot.addEventListener('click', () => goTo(i));
        dotsContainer.appendChild(dot);
      });
    }
    const dots = dotsContainer ? Array.from(dotsContainer.children) : [];

    function goTo(index) {
      slides[current].classList.remove('active');
      dots[current]?.classList.remove('active');
      current = (index + slides.length) % slides.length;
      slides[current].classList.add('active');
      dots[current]?.classList.add('active');
    }

    // prev/next already wrap via the modulo above, so a single species'
    // photo carousel is inherently a closed loop: next from the last photo
    // lands back on the first, and vice versa.
    prevBtn?.addEventListener('click', () => goTo(current - 1));
    nextBtn?.addEventListener('click', () => goTo(current + 1));

    // swipe support
    let startX = 0;
    let startY = 0;
    let dragging = false;

    track?.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dragging = true;
    }, { passive: true });

    track?.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      // once the drag is clearly horizontal, stop the page/viewer from also
      // scrolling during the swipe — this is what lets the gesture actually
      // reach touchend instead of being taken over by the browser/WebView
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        e.preventDefault();
      }
    }, { passive: false }); // must be non-passive for preventDefault to have any effect

    track?.addEventListener('touchend', (e) => {
      if (!dragging) return;
      dragging = false;
      const diff = e.changedTouches[0].clientX - startX;
      if (diff > 50) goTo(current - 1);
      if (diff < -50) goTo(current + 1);
    });

    const instance = {
      carouselEl,
      get current() { return current; },
      goTo,
      openInViewer(index) {
        viewerApi?.open(slides[index].querySelector('img'), instance);
      },
    };

    carouselEl.querySelectorAll('.expand-btn, .slide img').forEach(el => {
      el.addEventListener('click', () => instance.openInViewer(current));
    });

    return instance;
  }

  // Wires up one shared fullscreen viewer. Returns null (and does nothing)
  // if the page has no .viewer, so callers can treat it as fully optional.
  function buildViewer(viewerEl) {
    if (!viewerEl) return null;

    const img = viewerEl.querySelector('img');
    const caption = viewerEl.querySelector('.caption');
    let owner = null; // the carousel instance currently driving the viewer

    function close() {
      if (viewerEl.open) viewerEl.close();
    }

    function open(sourceImg, ownerInstance) {
      img.src = sourceImg.src;
      img.alt = sourceImg.alt;
      if (caption) caption.textContent = sourceImg.alt;
      if (!viewerEl.open) viewerEl.showModal();
      owner = ownerInstance;
    }

    // native <dialog> already closes the viewer on Escape/backdrop-cancel on
    // its own (that's the point of using a <dialog>); just clear our
    // bookkeeping when that happens instead of also closing it ourselves, or
    // a single Escape press would close the viewer AND whatever dialog is
    // underneath it (our own close() call would race the browser's default
    // Escape action, which re-targets whatever dialog is topmost *after*
    // ours runs).
    viewerEl.addEventListener('close', () => { owner = null; });

    viewerEl.querySelector('.close')?.addEventListener('click', close);
    viewerEl.querySelector('.next')?.addEventListener('click', () => {
      if (!owner) return;
      owner.goTo(owner.current + 1);
      owner.openInViewer(owner.current);
    });
    viewerEl.querySelector('.prev')?.addEventListener('click', () => {
      if (!owner) return;
      owner.goTo(owner.current - 1);
      owner.openInViewer(owner.current);
    });

    viewerEl.addEventListener('click', (e) => {
      if (e.target === viewerEl) close();
    });

    // swipe support inside the fullscreen viewer itself — needed because a
    // direct-open carousel (see GalleryEngine.open) is hidden and has no
    // visible .carousel-track of its own to swipe on; the viewer is the
    // only surface the user ever actually touches for those galleries.
    // Same touchstart/touchmove/touchend shape as buildCarousel()'s track
    // swipe below, just driving `owner` instead of a local goTo().
    let startX = 0;
    let startY = 0;
    let dragging = false;

    viewerEl.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dragging = true;
    }, { passive: true });

    viewerEl.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        e.preventDefault(); // stop the browser treating this as a page/dialog scroll
      }
    }, { passive: false });

    viewerEl.addEventListener('touchend', (e) => {
      if (!dragging) return;
      dragging = false;
      if (!owner) return;
      const diff = e.changedTouches[0].clientX - startX;
      if (diff > 50) { owner.goTo(owner.current - 1); owner.openInViewer(owner.current); }
      if (diff < -50) { owner.goTo(owner.current + 1); owner.openInViewer(owner.current); }
    });

    return {
      get isOpen() { return viewerEl.open; },
      get owner() { return owner; },
      open,
      close,
    };
  }

  // Makes one .card-grid strip loop infinitely in both directions.
  //
  // Technique: clone the real cards once and append the clone set after
  // the originals, and clone them again and prepend that set before the
  // originals, giving [clone][real][clone]. Scrolling starts on the first
  // real card. Because each clone set is pixel-identical to the real set,
  // once the strip settles after a scroll/swipe/button-click, we can jump
  // scrollLeft by exactly one set's width (realWidth) with no animation —
  // the visible content doesn't change, so the jump is invisible — which
  // puts the strip back in the middle (real) set, ready to travel just as
  // far in that direction again. That's what makes it feel infinite instead
  // of stopping dead at either end.
  //
  // Only the settle point is checked (via the 'scrollend' event, with a
  // debounced fallback for browsers that don't fire it yet) rather than
  // every scroll tick, so a smooth scrollBy() from the nav buttons is never
  // interrupted mid-animation.
  function makeGridInfinite(grid) {
    if (grid.dataset.infiniteReady === 'true') return; // guard against double init on the same DOM

    const originals = Array.from(grid.children);
    if (originals.length < 2) return; // nothing meaningful to loop

    const cloneSet = () => originals.map(card => {
      const clone = card.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('button, a, [tabindex]').forEach(el => el.setAttribute('tabindex', '-1'));
      return clone;
    });

    const prependClones = cloneSet();
    const appendClones = cloneSet();

    const prependFrag = document.createDocumentFragment();
    prependClones.forEach(c => prependFrag.appendChild(c));
    grid.insertBefore(prependFrag, grid.firstChild);

    const appendFrag = document.createDocumentFragment();
    appendClones.forEach(c => appendFrag.appendChild(c));
    grid.appendChild(appendFrag);

    grid.dataset.infiniteReady = 'true';

    const firstReal = originals[0];
    const firstPrependClone = prependClones[0];
    let realWidth = 0;

    function measure() {
      realWidth = firstReal.offsetLeft - firstPrependClone.offsetLeft;
    }

    function resetToStart() {
      measure();
      if (realWidth > 0) grid.scrollLeft = firstReal.offsetLeft - grid.clientLeft;
    }

    resetToStart();
    // card width can shift once webfonts finish loading (same reasoning as
    // Cronologia's canvas measureText column sizing); re-measure and
    // re-anchor when that happens, and on resize/orientation change.
    document.fonts?.ready?.then(resetToStart);
    window.addEventListener('resize', measure);

    function settle() {
      if (realWidth <= 0) return;
      if (grid.scrollLeft < realWidth - 1) {
        grid.scrollLeft += realWidth;
      } else if (grid.scrollLeft > realWidth * 2 - 1) {
        grid.scrollLeft -= realWidth;
      }
    }

    let settleTimer = null;
    grid.addEventListener('scroll', () => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, 120);
    });
    // Where supported, 'scrollend' fires exactly once the strip stops
    // moving — more precise than the debounce above, so use it too.
    grid.addEventListener('scrollend', settle);
  }

  // Wires each .grid-prev/.grid-next button to scroll its sibling
  // .card-grid one card-width left/right, as a click alternative to
  // finger-swiping. Also makes each .card-grid loop infinitely (see
  // makeGridInfinite above) before measuring the step, so the step size is
  // still read from a real card even though clones now sit on either side
  // of it.
  function buildGridScrollers() {
    document.querySelectorAll('.gallery').forEach(wrap => {
      const grid = wrap.querySelector('.card-grid');
      const card = grid?.querySelector(':scope > div');
      if (!grid || !card) return;

      makeGridInfinite(grid);

      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
      const step = card.getBoundingClientRect().width + gap;

      const prevBtn = wrap.querySelector('.grid-prev');
      const nextBtn = wrap.querySelector('.grid-next');

      // guard against stacking duplicate click listeners if init() re-runs
      // on the same DOM (e.g. a route change that doesn't re-render this
      // markup)
      if (wrap.dataset.scrollersReady === 'true') return;
      wrap.dataset.scrollersReady = 'true';

      prevBtn?.addEventListener('click', () => {
        grid.scrollBy({ left: -step, behavior: 'smooth' });
      });
      nextBtn?.addEventListener('click', () => {
        grid.scrollBy({ left: step, behavior: 'smooth' });
      });
    });
  }

  // Wires every .modal-close button to close its nearest <dialog> directly,
  // instead of relying on the surrounding <form method="dialog"> submit.
  // That native submit-closes-dialog behavior silently stops firing in
  // Safari when the form has `display: contents` (needed here so the
  // absolutely-positioned close button doesn't take up flex space) — a
  // known WebKit bug. Handling the click ourselves sidesteps it entirely,
  // the same way the shared .viewer's own close button already works.
  function buildModalCloseButtons() {
    document.querySelectorAll('.modal-close').forEach(btn => {
      if (btn.dataset.closeReady === 'true') return; // guard against double-binding on re-init
      btn.dataset.closeReady = 'true';
      btn.addEventListener('click', (e) => {
        e.preventDefault(); // don't let the native form submit also fire
        btn.closest('dialog')?.close();
      });
    });
  }

  function init() {
    buildGridScrollers();
    buildModalCloseButtons();

    const carouselEls = Array.from(document.querySelectorAll('.carousel'));
    if (carouselEls.length === 0) return; // this page has no gallery, nothing to do

    const viewerApi = buildViewer(document.querySelector('.viewer'));
    const instances = carouselEls.map(el => buildCarousel(el, viewerApi)).filter(Boolean);
    if (instances.length === 0) return;

    // rebuild the id lookup fresh each init() — old ids would otherwise
    // point at detached elements from the previous route's DOM
    instancesById = {};
    instances.forEach(inst => {
      if (inst.carouselEl.id) instancesById[inst.carouselEl.id] = inst;
    });

    // the carousel currently visible on screen (e.g. the open <dialog>'s
    // carousel, or the only carousel on a single-gallery page like leburon.html)
    function getVisibleInstance() {
      return instances.find(inst => inst.carouselEl.offsetParent !== null) || instances[0];
    }

    // remove the previous handler first, so re-running init() doesn't stack
    // listeners on document (which persists across route changes, unlike
    // the gallery markup itself)
    if (keydownHandler) document.removeEventListener('keydown', keydownHandler);

    keydownHandler = (e) => {
      if (viewerApi?.isOpen) {
        const inst = viewerApi.owner || getVisibleInstance();
        // Escape is left to the native <dialog> cancel behavior (see the
        // viewer's own 'close' listener) — handling it here too would race it.
        if (e.key === 'ArrowRight') { inst.goTo(inst.current + 1); inst.openInViewer(inst.current); }
        if (e.key === 'ArrowLeft') { inst.goTo(inst.current - 1); inst.openInViewer(inst.current); }
      } else {
        const inst = getVisibleInstance();
        if (e.key === 'ArrowRight') inst.goTo(inst.current + 1);
        if (e.key === 'ArrowLeft') inst.goTo(inst.current - 1);
      }
    };
    document.addEventListener('keydown', keydownHandler);
  }

  // Opens a carousel (visible or hidden) straight into the fullscreen
  // viewer at the given photo index, without needing that carousel's own
  // prev/next/dots to have been visible or interacted with first. Silently
  // does nothing if the id isn't found or the page has no .viewer — the
  // markup contract above explains why both are always expected to exist
  // for a direct-open gallery.
  function open(id, index = 0) {
    instancesById[id]?.openInViewer(index);
  }

  return { init, open };
})();

// Run immediately if this script is loaded normally (e.g. direct <script> tag execution)
GalleryEngine.init();
