// Theme toggle and a draggable accessibility menu. Settings are kept in localStorage when it works.
(() => {
  const root = document.documentElement;
  const read = () => { try { return JSON.parse(localStorage.getItem('kashuv-prefs') || '{}'); } catch (e) { return {}; } };
  const write = (p) => { try { localStorage.setItem('kashuv-prefs', JSON.stringify(p)); } catch (e) {} };
  let prefs = read();

  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const themeBtn = document.getElementById('theme');
  const paintTheme = () => { themeBtn.textContent = isDark() ? '☀️' : '🌙'; };
  themeBtn.addEventListener('click', () => {
    prefs.theme = isDark() ? 'light' : 'dark';
    root.dataset.theme = prefs.theme; write(prefs); paintTheme();
  });
  paintTheme();

  const btn = document.getElementById('a11y-btn');
  const panel = document.getElementById('a11y-panel');
  const place = (x, y) => {
    x = Math.max(8, Math.min(innerWidth - 64, x)); y = Math.max(8, Math.min(innerHeight - 64, y));
    btn.style.left = x + 'px'; btn.style.top = y + 'px'; btn.style.right = 'auto'; btn.style.bottom = 'auto';
    panel.style.left = Math.min(x, innerWidth - 270) + 'px';
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
    const ph = panel.offsetHeight || 380;
    panel.style.top = Math.max(8, Math.min(innerHeight - ph - 8, y > innerHeight / 2 ? y - ph - 12 : y + 64)) + 'px';
  };
  if (prefs.pos) requestAnimationFrame(() => place(prefs.pos[0], prefs.pos[1]));

  let drag = null, moved = false;
  const onMove = (e) => {
    if (!drag) return;
    const x = e.clientX - drag.dx, y = e.clientY - drag.dy;
    if (!moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 4) moved = true;
    if (moved) { btn.classList.add('dragging'); place(x, y); }
  };
  const onUp = () => {
    removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp);
    if (moved) { prefs.pos = [btn.offsetLeft, btn.offsetTop]; write(prefs); }
    drag = null; btn.classList.remove('dragging');
  };
  btn.addEventListener('dragstart', (e) => e.preventDefault());
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); btn.focus();
    drag = { dx: e.clientX - btn.offsetLeft, dy: e.clientY - btn.offsetTop, sx: e.clientX, sy: e.clientY }; moved = false;
    addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
  });
  btn.addEventListener('click', (e) => {
    if (moved) { e.preventDefault(); moved = false; return; }
    const open = panel.hidden;
    panel.hidden = !open; btn.setAttribute('aria-expanded', String(open));
    if (open) { place(btn.offsetLeft, btn.offsetTop); panel.querySelector('button').focus(); }
  });
  btn.addEventListener('keydown', (e) => {
    const d = { ArrowUp: [0, -20], ArrowDown: [0, 20], ArrowLeft: [-20, 0], ArrowRight: [20, 0] }[e.key];
    if (!d) return;
    e.preventDefault(); place(btn.offsetLeft + d[0], btn.offsetTop + d[1]);
    prefs.pos = [btn.offsetLeft, btn.offsetTop]; write(prefs);
  });
  addEventListener('resize', () => { if (prefs.pos) place(btn.offsetLeft, btn.offsetTop); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { panel.hidden = true; btn.focus(); } });

  const sync = () => panel.querySelectorAll('[data-a11y]').forEach((b) => {
    if (['contrast', 'still', 'links', 'plain'].includes(b.dataset.a11y)) b.setAttribute('aria-pressed', String(!!prefs[b.dataset.a11y]));
  });
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a11y]'); if (!b) return;
    const k = b.dataset.a11y;
    if (k === 'bigger' || k === 'smaller') {
      prefs.size = Math.max(0.85, Math.min(1.5, (prefs.size || 1) + (k === 'bigger' ? 0.1 : -0.1)));
      root.style.setProperty('--scale', prefs.size);
    } else if (k === 'reset') {
      ['contrast', 'still', 'links', 'plain'].forEach((c) => root.classList.remove('a11y-' + c));
      root.style.removeProperty('--scale'); delete root.dataset.theme;
      prefs = { pos: prefs.pos }; paintTheme();
    } else {
      prefs[k] = !prefs[k]; root.classList.toggle('a11y-' + k, prefs[k]);
    }
    write(prefs); sync();
  });
  sync();
})();
