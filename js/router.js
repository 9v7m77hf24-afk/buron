const content = document.getElementById('content');
const FADE_MS = 200; // keep in sync with CSS transition duration

async function loadPage(page, push = true) {
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
    history.pushState({ page }, '', `#${page}`);
  }
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
const initialPage = location.hash.slice(1) || 'home';
loadPage(initialPage, false);
