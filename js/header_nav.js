(function () {
  const logo = document.querySelector('.nav-logo');
  const maxScroll = 150;       // scroll distance over which it fully disappears
  const travelDistance = 140;  // how far up it needs to move to clear the viewport
                                // (a bit more than logo height + its top offset)

  function onScroll() {
    const y = Math.min(window.scrollY, maxScroll);
    const progress = y / maxScroll; // 0 to 1

    const translateY = -progress * travelDistance;
    logo.style.transform = `translateY(${translateY}px)`;
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
