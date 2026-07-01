// Re-runnable init for the photo carousel + fullscreen viewer.
// Safe to call every time this page is loaded/injected by the router,
// even if the user navigates away and comes back multiple times.

let _galleryKeydownHandler = null; // tracks the listener so we can remove it on re-init

function initGalleryCarousel() {
  const slides = Array.from(document.querySelectorAll('.slide'));
  if (slides.length === 0) return; // this page has no gallery, do nothing

  const dotsContainer = document.getElementById('dots');
  const viewer = document.getElementById('viewer');
  const viewerImg = document.getElementById('viewerImg');
  const viewerCaption = document.getElementById('viewerCaption');
  let current = 0;

  // clear any dots from a previous init (in case this page was visited before)
  dotsContainer.innerHTML = '';

  // build dots
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.classList.add('dot');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goTo(i));
    dotsContainer.appendChild(dot);
  });
  const dots = Array.from(document.querySelectorAll('.dot'));

  function goTo(index) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
  }

  document.getElementById('prevSlide').addEventListener('click', () => goTo(current - 1));
  document.getElementById('nextSlide').addEventListener('click', () => goTo(current + 1));

  // swipe support
  let startX = 0;
  const track = document.getElementById('track');
  track.addEventListener('touchstart', (e) => startX = e.touches[0].clientX);
  track.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientX - startX;
    if (diff > 50) goTo(current - 1);
    if (diff < -50) goTo(current + 1);
  });

  // --- fullscreen viewer ---
  function openViewer(index) {
    const img = slides[index].querySelector('img');
    viewerImg.src = img.src;
    viewerImg.alt = img.alt;
    viewerCaption.textContent = img.alt;
    viewer.classList.add('active');
  }

  function closeViewer() {
    viewer.classList.remove('active');
  }

  document.querySelectorAll('.expand-btn, .slide img').forEach(el => {
    el.addEventListener('click', () => openViewer(current));
  });

  document.getElementById('closeBtn').addEventListener('click', closeViewer);
  document.getElementById('viewerNext').addEventListener('click', () => { goTo(current + 1); openViewer(current); });
  document.getElementById('viewerPrev').addEventListener('click', () => { goTo(current - 1); openViewer(current); });

  viewer.addEventListener('click', (e) => {
    if (e.target === viewer) closeViewer();
  });

  // --- keyboard navigation (main carousel + viewer combined) ---
  // remove the previous handler first, so re-running init doesn't stack listeners
  if (_galleryKeydownHandler) {
    document.removeEventListener('keydown', _galleryKeydownHandler);
  }

  _galleryKeydownHandler = (e) => {
    if (viewer.classList.contains('active')) {
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowRight') { goTo(current + 1); openViewer(current); }
      if (e.key === 'ArrowLeft') { goTo(current - 1); openViewer(current); }
    } else {
      if (e.key === 'ArrowRight') goTo(current + 1);
      if (e.key === 'ArrowLeft') goTo(current - 1);
    }
  };

  document.addEventListener('keydown', _galleryKeydownHandler);
}

// Run immediately if this script is loaded normally (e.g. direct <script> tag execution)
initGalleryCarousel();
