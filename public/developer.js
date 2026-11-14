(function () {
  const carousel = document.getElementById('carousel');
  const dotsBox = document.getElementById('dots');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const AUTO_MS = 3000;

  let slides = Array.from(carousel.querySelectorAll('.slide'));
  let cur = 0;
  let timer = null;

  // Remove slides whose image failed to load, then rebuild
  function init() {
    slides = slides.filter(s => s.querySelector('img'));
    const n = slides.length;
    if (n === 0) { carousel.style.display = 'none'; return; }

    dotsBox.innerHTML = '';
    slides.forEach((_, i) => {
      const d = document.createElement('div');
      d.className = 'dot';
      d.addEventListener('click', () => { go(i); restart(); });
      dotsBox.appendChild(d);
    });
    render();
    restart();
  }

  function render() {
    const n = slides.length;
    const dots = dotsBox.children;
    slides.forEach((s, i) => {
      s.classList.remove('active', 'prev', 'next');
      if (i === cur) s.classList.add('active');
      else if (n > 1 && i === (cur - 1 + n) % n) s.classList.add('prev');
      else if (n > 2 && i === (cur + 1) % n) s.classList.add('next');
      else if (n === 2 && i !== cur) s.classList.add('next');
    });
    for (let i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i === cur);
  }

  function go(i) {
    const n = slides.length;
    cur = (i + n) % n;
    render();
  }

  function restart() {
    clearInterval(timer);
    if (slides.length > 1) timer = setInterval(() => go(cur + 1), AUTO_MS);
  }

  prevBtn.addEventListener('click', () => { go(cur - 1); restart(); });
  nextBtn.addEventListener('click', () => { go(cur + 1); restart(); });

  // Pause when hovering (desktop) or when the tab is hidden
  carousel.addEventListener('mouseenter', () => clearInterval(timer));
  carousel.addEventListener('mouseleave', restart);
  document.addEventListener('visibilitychange', () => {
    document.hidden ? clearInterval(timer) : restart();
  });

  // Swipe support
  let startX = null;
  carousel.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  carousel.addEventListener('touchend', e => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) { go(cur + (dx < 0 ? 1 : -1)); restart(); }
    startX = null;
  });

  // Keyboard arrows
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { go(cur - 1); restart(); }
    if (e.key === 'ArrowRight') { go(cur + 1); restart(); }
  });

  // Footer year
  const yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  // Wait for images so broken ones can be dropped before building the carousel
  window.addEventListener('load', () => {
    slides.forEach(s => {
      const img = s.querySelector('img');
      if (img && (!img.complete || img.naturalWidth === 0)) img.remove();
    });
    init();
  });
})();