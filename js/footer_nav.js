(function () {
  const bottomNav = document.getElementById('bottomNav');
  let lastY = window.scrollY;
  let ticking = false;
  const threshold = 8; // ignore tiny jitter

  function onScroll() {
    const currentY = window.scrollY;
    const delta = currentY - lastY;

    if (Math.abs(delta) > threshold) {
      if (delta < 0 && currentY > 50) {
        // scrolling up (and not right at the very top)
        bottomNav.classList.add('visible');
      } else if (delta > 0) {
        // scrolling down
        bottomNav.classList.remove('visible');
      }
      lastY = currentY;
    }

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });
})();

(function () {
  const backBtn = document.getElementById('navBack');
  const forwardBtn = document.getElementById('navForward');

  backBtn.addEventListener('click', () => history.back());
  forwardBtn.addEventListener('click', () => history.forward());
})();
