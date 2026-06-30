const content = document.getElementById('content');
const FADE_MS = 200;

let pageStack = [];   // array of { id, page }
let currentIndex = -1;
let nextId = 0;

async function loadPage(page, push = true, entryId = null) {
  content.classList.add('fading');

  let html;
  try {
    const res = await fetch(`./${page}.html`);
    if (!res.ok) throw new Error(`Page not found: ${page}`);
    html = await res.text();
  } catch (err) {
    html = `<h1>Page not found</h1><p>${err.message}</p>`;
  }

  setTimeout(() => {
    content.innerHTML = html;
    content.classList.remove('fading');
  }, FADE_MS);

  if (push) {
    const id = nextId++;
    history.pushState({ page, id }, '', `#${page}`);
    pageStack = pageStack.slice(0, currentIndex + 1);
    pageStack.push({ id, page });
    currentIndex++;
  } else if (entryId !== null) {
    // moved via popstate — sync currentIndex to the matching entry
    const idx = pageStack.findIndex(entry => entry.id === entryId);
    if (idx !== -1) currentIndex = idx;
  }

  updateNavButtons();
}

function updateNavButtons() {
  const backBtn = document.getElementById('navBack');
  const forwardBtn = document.getElementById('navForward');
  if (!backBtn || !forwardBtn) return;

  backBtn.disabled = currentIndex <= 0;
  forwardBtn.disabled = currentIndex >= pageStack.length - 1;
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
  const id = e.state?.id ?? null;
  loadPage(page, false, id);
});

// Back/forward button clicks
document.getElementById('navBack')?.addEventListener('click', () => history.back());
document.getElementById('navForward')?.addEventListener('click', () => history.forward());

// Initial load on first visit / refresh
// Using a unique incrementing ID per history entry instead of matching on page name, 
// so revisiting the same page multiple times in a session won't confuse the back/forward state.
// Each push now carries a unique id alongside the page name in the history state object, via history.pushState({ page, id }, ...)
const initialPage = location.hash.slice(1) || 'home';
const initialId = nextId++;
history.replaceState({ page: initialPage, id: initialId }, '', `#${initialPage}`);
pageStack = [{ id: initialId, page: initialPage }];
currentIndex = 0;
loadPage(initialPage, false, initialId);