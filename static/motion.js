// Kashuv motion: page transitions, scroll reveal, sliding nav pill, button ripples, soft card tilt,
// pastel confetti, floating hero sparkles and a circle reveal when switching dark mode.
// Everything turns off with "stop animations" in the accessibility menu or the system "reduce motion" setting.
(() => {
  const root = document.documentElement;
  const calm = () => root.classList.contains('a11y-still') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const main = document.getElementById('main');
  const PASTEL = ['#FFB4A2', '#8B7BFF', '#9EE6C3', '#FFD97A', '#9CCBFF', '#FFC6DA'];

  /* ---------- pastel confetti ---------- */
  window.confetti = (x = innerWidth / 2, y = innerHeight / 3, n = 70) => {
    if (calm()) return;
    const cv = document.createElement('canvas'); cv.className = 'confetti'; cv.setAttribute('aria-hidden', 'true');
    const dpr = devicePixelRatio || 1; cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    document.body.append(cv);
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const bits = Array.from({ length: n }, () => ({ x, y, vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 13 - 3, r: Math.random() * 6 + 4,
      a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3, c: PASTEL[Math.floor(Math.random() * PASTEL.length)], round: Math.random() < 0.4 }));
    const t0 = performance.now();
    const step = (now) => {
      const t = now - t0; g.clearRect(0, 0, innerWidth, innerHeight);
      for (const b of bits) {
        b.vy += 0.32; b.vx *= 0.985; b.x += b.vx; b.y += b.vy; b.a += b.va;
        g.save(); g.globalAlpha = Math.max(0, 1 - t / 2400); g.translate(b.x, b.y); g.rotate(b.a); g.fillStyle = b.c;
        if (b.round) { g.beginPath(); g.arc(0, 0, b.r / 2, 0, 7); g.fill(); } else g.fillRect(-b.r / 2, -b.r / 4, b.r, b.r / 2);
        g.restore();
      }
      if (t < 2400) requestAnimationFrame(step); else cv.remove();
    };
    requestAnimationFrame(step);
  };

  /* ---------- page transitions, scroll reveal and celebrations ---------- */
  let wasProgress = false;
  const io = 'IntersectionObserver' in window && new IntersectionObserver((list) => list.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  function reveal() {
    if (calm() || !io) return;
    main.querySelectorAll('.card, .section-title, .hit, .steps, .na-faq').forEach((el, i) => {
      if (el.closest('.rv') || el.classList.contains('rv')) return;
      if (el.getBoundingClientRect().top > innerHeight * 0.92) { el.classList.add('rv'); el.style.setProperty('--d', (i % 4) * 70 + 'ms'); io.observe(el); }
    });
  }
  new MutationObserver(() => {
    const first = main.firstElementChild;
    if (!first || first.dataset.seen) return;
    first.dataset.seen = '1';
    if (!calm()) { main.classList.remove('page-in'); void main.offsetWidth; main.classList.add('page-in'); }
    const isProgress = first.classList.contains('progress-view');
    if (wasProgress && !isProgress && location.hash.startsWith('#/s/')) setTimeout(() => confetti(innerWidth / 2, 160, 110), 350);
    wasProgress = isProgress;
    requestAnimationFrame(reveal); setTimeout(reveal, 500);
    pill();
  }).observe(main, { childList: true });

  /* ---------- sliding nav pill ---------- */
  const nav = document.querySelector('.site-head nav');
  const blob = document.createElement('span'); blob.className = 'nav-pill'; blob.setAttribute('aria-hidden', 'true'); nav.prepend(blob);
  function pill() {
    const cur = nav.querySelector('[aria-current="page"]');
    if (!cur) { blob.style.opacity = 0; return; }
    blob.style.opacity = 1;
    blob.style.width = cur.offsetWidth + 'px'; blob.style.height = cur.offsetHeight + 'px';
    blob.style.transform = `translate(${cur.offsetLeft}px, ${cur.offsetTop}px)`;
  }
  addEventListener('hashchange', () => setTimeout(pill, 30));
  addEventListener('resize', pill);
  new MutationObserver(pill).observe(root, { attributes: true, attributeFilter: ['lang', 'class'] });
  setTimeout(pill, 300);

  /* ---------- ripples on buttons ---------- */
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.btn, .chip[type=button], .site-head nav a, [role=tab]');
    if (!b || calm()) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2;
    const w = document.createElement('i'); w.className = 'ripple';
    Object.assign(w.style, { width: s + 'px', height: s + 'px', left: e.clientX - r.left - s / 2 + 'px', top: e.clientY - r.top - s / 2 + 'px' });
    b.classList.add('rippling'); b.append(w); setTimeout(() => w.remove(), 650);
  });

  /* ---------- soft 3D tilt on cards ---------- */
  const TILT = '.lib a, .choice, .kpi, .concept, .hero-demo';
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener('pointermove', (e) => {
      const c = e.target.closest(TILT);
      if (!c || calm()) return;
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      c.style.setProperty('--rx', (-y * 5).toFixed(2) + 'deg'); c.style.setProperty('--ry', (x * 6).toFixed(2) + 'deg');
      c.style.setProperty('--mx', (x + 0.5) * 100 + '%'); c.style.setProperty('--my', (y + 0.5) * 100 + '%');
      c.classList.add('tilting');
    });
    document.addEventListener('pointerout', (e) => {
      const c = e.target.closest(TILT); if (c && !c.contains(e.relatedTarget)) c.classList.remove('tilting');
    });
  }

  /* ---------- floating sparkles behind the hero ---------- */
  function sparkles() {
    const hero = main.querySelector('.hero-split');
    if (!hero || hero.querySelector('.sparkles') || calm()) return;
    const box = document.createElement('div'); box.className = 'sparkles'; box.setAttribute('aria-hidden', 'true');
    box.innerHTML = ['✨', '🎧', '📝', '💜', '⭐', '🌸'].map((e, i) => `<span style="--x:${8 + i * 16}%;--t:${9 + i * 1.7}s;--dl:${-i * 2.3}s">${e}</span>`).join('');
    hero.prepend(box);
  }
  new MutationObserver(sparkles).observe(main, { childList: true });

  /* ---------- dark mode with a circle reveal ---------- */
  const theme = document.getElementById('theme');
  let passing = false;
  theme.addEventListener('click', (e) => {
    if (passing || calm() || !document.startViewTransition) return;
    e.stopImmediatePropagation();
    const r = theme.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    root.style.setProperty('--vx', x + 'px'); root.style.setProperty('--vy', y + 'px');
    document.startViewTransition(() => { passing = true; theme.click(); passing = false; });
  }, true);

  /* ---------- header shadow once you scroll ---------- */
  const head = document.querySelector('.site-head');
  addEventListener('scroll', () => head.classList.toggle('scrolled', scrollY > 8), { passive: true });

  /* ---------- celebrate finished practice decks ---------- */
  new MutationObserver(() => {
    const done = main.querySelector('.deck-done:not([data-party])');
    if (done) { done.dataset.party = '1'; const r = done.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + 40, 90); }
  }).observe(main, { childList: true, subtree: true });
})();
