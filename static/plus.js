// Kashuv extras: live hero demo, live sound wave, interactive timeline, practice deck, progress dashboard and a demo tour.
// Loaded before app.js; uses its helpers ($, L, esc, fmt, api, toast) when the functions run.
const still = () => document.documentElement.classList.contains('a11y-still') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* ---------- sound wave drawing, shared by the hero demo and live mode ---------- */
function drawWave(cv, levels, offset = 0) {
  const dpr = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const grad = g.createLinearGradient(0, 0, w, 0); grad.addColorStop(0, css('--peach') || '#FFB4A2'); grad.addColorStop(1, css('--lilac') || '#8B7BFF');
  g.fillStyle = grad;
  const bar = 4, gap = 3, n = Math.ceil(w / (bar + gap)) + 1;
  for (let i = 0; i < n; i++) {
    const v = levels[levels.length - n + i] ?? 0, bh = Math.max(3, Math.min(1, v) * (h - 4));
    const x = i * (bar + gap) - offset * (bar + gap);
    g.beginPath(); g.roundRect ? g.roundRect(x, (h - bh) / 2, bar, bh, 2) : g.rect(x, (h - bh) / 2, bar, bh); g.fill();
  }
}

/* ---------- 1. live demo in the home hero ---------- */
const HERO = {
  he: { lines: ['בוקר טוב, היום מדברים על עצי AVL', 'לכל צומת יש גורם איזון', 'הוא תמיד מינוס אחד, אפס או אחד', 'אם הוא יוצא מהטווח עושים רוטציה', 'שימו לב, את זה תצטרכו לדעת למבחן', 'נויה, את יכולה להגיד איזו רוטציה צריך?'],
    pts: { 1: '🌳 עצי AVL שומרים על איזון', 3: '🔄 גורם איזון לא תקין = רוטציה', 4: '🎯 רוטציות יהיו במבחן' }, alert: 5, alertText: '📣 קראו לך!', live: 'בשידור חי', sum: '✨ הסיכום נבנה לבד' },
  en: { lines: ['Good morning, today we talk about AVL trees', 'Every node has a balance factor', 'It is always minus one, zero or one', 'If it goes out of range we rotate', 'Pay attention, this will be on the exam', 'Noya, which rotation do we need here?'],
    pts: { 1: '🌳 AVL trees stay balanced', 3: '🔄 Bad balance factor = rotate', 4: '🎯 Rotations are on the exam' }, alert: 5, alertText: '📣 Your name was called!', live: 'Live', sum: '✨ The summary writes itself' },
};
function heroDemoHTML() {
  const H = HERO[LANG === 'en' ? 'en' : 'he'];
  return `<div class="card hero-demo pop" id="hdemo" style="--i:1" aria-label="${L('הדגמה של האזנה חיה', 'A live listening demo')}" role="img">
    <div class="hd-top"><span class="orb"></span><b>${H.live}</b><span class="hd-t" id="hd-t">00:00</span><canvas class="hd-wave" id="hd-wave"></canvas></div>
    <div class="hd-body"><div class="hd-tr" id="hd-tr"></div><div class="hd-sum"><small>${H.sum}</small><ul id="hd-pts"></ul></div></div>
    <div class="hd-alert" id="hd-alert" hidden>${H.alertText}</div></div>`;
}
function heroDemo() {
  const H = HERO[LANG === 'en' ? 'en' : 'he'], tr = $('#hd-tr'), pts = $('#hd-pts'), cv = $('#hd-wave'), al = $('#hd-alert'), tt = $('#hd-t');
  if (!tr) return () => {};
  const line = (i, text) => `<div class="hd-line"><time>${fmt(i * 7)}</time><span>${esc(text)}</span></div>`;
  if (still()) {
    tr.innerHTML = H.lines.map((t, i) => line(i, t)).join('');
    pts.innerHTML = Object.values(H.pts).map((p) => `<li>${esc(p)}</li>`).join('');
    drawWave(cv, Array.from({ length: 120 }, (_, i) => 0.25 + 0.5 * Math.abs(Math.sin(i * 0.7))));
    return () => {};
  }
  let alive = true, talking = false, levels = [], timer = 0, raf, to;
  const later = (ms) => new Promise((r) => { to = setTimeout(r, ms); });
  const frame = () => {
    if (!alive) return;
    levels.push(talking ? 0.3 + Math.random() * 0.6 : 0.05 + Math.random() * 0.08); if (levels.length > 400) levels.shift();
    drawWave(cv, levels); raf = setTimeout(() => requestAnimationFrame(frame), 70);
  };
  frame();
  const clock = setInterval(() => { timer += 1; tt.textContent = fmt(timer); }, 1000);
  (async () => {
    while (alive) {
      tr.innerHTML = ''; pts.innerHTML = ''; al.hidden = true; timer = 0;
      for (let i = 0; i < H.lines.length && alive; i++) {
        tr.insertAdjacentHTML('beforeend', line(i, ''));
        const span = tr.lastElementChild.querySelector('span'), words = H.lines[i].split(' ');
        talking = true;
        for (const w of words) { if (!alive) return; span.textContent += (span.textContent ? ' ' : '') + w; await later(110); }
        talking = false;
        if (i === H.alert) { al.hidden = false; tr.lastElementChild.classList.add('hit'); }
        if (H.pts[i]) { pts.insertAdjacentHTML('beforeend', `<li class="pop">${esc(H.pts[i])}</li>`); }
        while (tr.children.length > 4) tr.firstElementChild.remove();
        await later(650);
      }
      await later(3200);
    }
  })();
  return () => { alive = false; clearTimeout(to); clearTimeout(raf); clearInterval(clock); };
}

/* ---------- 2. live sound wave ---------- */
function liveWave(cv) {
  let levels = [], shown = 0, alive = true, last = performance.now(), seen = null;
  const loop = (now) => {
    if (!alive) return;
    // glide smoothly toward the newest values that arrived from the server
    shown = Math.min(levels.length, shown + (now - last) / 500); last = now;
    const upto = Math.floor(shown), frac = shown - upto;
    drawWave(cv, levels.slice(0, upto).map((v) => Math.min(1, v * 9)), still() ? 0 : frac);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return {
    push(state) {
      let add;
      if (state.levels && state.lcount != null) { add = seen == null ? state.levels.slice(-20) : state.levels.slice(-Math.min(state.levels.length, state.lcount - seen)); seen = state.lcount; }
      else add = [0, 1, 2].map(() => (state.level || 0) * (0.6 + Math.random() * 0.8)); // demo mode sends one value
      levels.push(...add); if (levels.length > 600) { const cut = levels.length - 600; levels = levels.slice(cut); shown -= cut; }
      if (levels.length - shown > 8) shown = levels.length - 3;
    },
    stop() { alive = false; },
  };
}

/* ---------- 3. interactive timeline bar ---------- */
function timelineHTML(s, m) {
  const dur = Math.max(1, s.duration || (s.segments || []).slice(-1)[0]?.end || 1);
  const topics = (m.timeline || []).map((t) => ({ sec: toSec(t.time), title: t.title })).filter((t) => t.sec <= dur).sort((a, b) => a.sec - b.sec);
  const marks = s.marks || [], alerts = s.alerts || [];
  if (!topics.length && !marks.length && !alerts.length) return '';
  const pct = (x) => Math.min(100, Math.max(0, x / dur * 100)).toFixed(2);
  const colors = ['lilac', 'peach', 'mint', 'sky', 'butter'];
  return `<section class="card tbar-card pop no-print" aria-label="${L('ציר הזמן של ההרצאה', 'Lecture timeline')}">
    <div class="tbar-head"><h3>${L('🗺️ המפה של ההרצאה', '🗺️ Lecture map')}</h3><span class="muted">${L('לחצו על נושא או סימן כדי לקפוץ לרגע הזה', 'Click a topic or a pin to jump to that moment')}</span></div>
    <div class="tbar" id="tbar">
      ${topics.map((t, i) => { const end = topics[i + 1]?.sec ?? dur; return `<button class="tb-seg" data-seek="${t.sec}" style="--s:${pct(t.sec)}%;--w:${pct(end - t.sec)}%;--c:var(--${colors[i % 5]});--c-soft:var(--${colors[i % 5]}-soft);--i:${i}" title="${fmt(t.sec)} ${esc(t.title)}"><span>${esc(t.title)}</span></button>`; }).join('')}
      ${marks.map((k) => `<button class="tb-pin star" data-seek="${k.t}" style="--s:${pct(k.t)}%" title="⭐ ${fmt(k.t)} ${esc(k.note || L('רגע חשוב', 'Important moment'))}" aria-label="⭐ ${fmt(k.t)}">⭐</button>`).join('')}
      ${alerts.map((a) => `<button class="tb-pin bell" data-seek="${a.t}" style="--s:${pct(a.t)}%" title="📣 ${fmt(a.t)} ${esc(a.text)}" aria-label="📣 ${fmt(a.t)}">📣</button>`).join('')}
      <span class="tb-head" id="tb-head" aria-hidden="true"></span>
    </div>
    <div class="tbar-legend"><span>00:00</span><span>${topics.length ? `🎨 ${topics.length} ${L('נושאים', 'topics')}` : ''} ${marks.length ? `· ⭐ ${marks.length}` : ''} ${alerts.length ? `· 📣 ${alerts.length}` : ''}</span><span>${fmt(dur)}</span></div>
  </section>`;
}
function followTimeline(audio, dur) {
  const head = $('#tb-head'); if (!head || !audio) return;
  audio.addEventListener('timeupdate', () => { head.style.setProperty('--s', Math.min(100, audio.currentTime / Math.max(1, dur) * 100) + '%'); head.classList.add('on'); });
}

/* ---------- 4. practice deck ---------- */
function deckHTML(quiz) {
  return `<div class="deck no-print" id="deck">
    <div class="deck-top"><div class="deck-bar"><i id="deck-fill"></i></div><span id="deck-count"></span></div>
    <div class="deck-stage"><button class="flip deck-card" id="deck-card" type="button"><div class="in"><div class="f"><small id="deck-n"></small><span id="deck-q"></span><em>${L('לחצו כדי להפוך', 'Click to flip')}</em></div><div class="b"><small>${L('תשובה', 'Answer')}</small><span id="deck-a"></span></div></div></button></div>
    <div class="deck-actions"><button class="btn soft" id="deck-no" type="button">${L('🤔 עוד לא', '🤔 Not yet')}</button><button class="btn lilac" id="deck-yes" type="button">${L('✅ ידעתי', '✅ Got it')}</button></div>
    <p class="muted deck-keys">⌨️ ${L('רווח להפוך · חץ ימינה ידעתי · חץ שמאלה עוד לא', 'Space flips · right arrow got it · left arrow not yet')}</p>
  </div>
  <details class="all-cards"><summary>${L('📚 כל הכרטיסים', '📚 All cards')}</summary><div class="cards">${quiz.map((q, i) => `
    <button class="flip" type="button" aria-label="${L('שאלה', 'Question')} ${i + 1}"><div class="in"><div class="f"><small>${L('שאלה', 'Question')} ${i + 1}</small>${esc(q.q)}</div><div class="b"><small>${L('תשובה', 'Answer')}</small>${esc(q.a)}</div></div></button>`).join('')}</div></details>`;
}
function deck(quiz, id) {
  const card = $('#deck-card'); if (!card) return () => {};
  const key = 'kashuv-deck-' + id;
  let queue = quiz.map((_, i) => i), known = new Set(), round = 1;
  const show = () => {
    const total = quiz.length;
    $('#deck-fill').style.width = (known.size / total * 100) + '%';
    $('#deck-count').textContent = `${known.size} / ${total}`;
    if (!queue.length) {
      try { localStorage.setItem(key, JSON.stringify({ best: total, at: Date.now() })); } catch (e) {}
      $('#deck').querySelector('.deck-stage').innerHTML = `<div class="card deck-done pop"><div class="big">🎉</div><h3>${L('ידעת את כל הכרטיסים!', 'You know every card!')}</h3><p class="muted">${round > 1 ? L(`הצלחת אחרי ${round} סבבים`, `Done in ${round} rounds`) : L('בסבב הראשון, מושלם', 'First round, perfect')}</p><button class="btn lilac" id="deck-again" type="button">${L('🔁 עוד פעם', '🔁 Again')}</button></div>`;
      $('#deck').querySelector('.deck-actions').hidden = true;
      $('#deck-again').addEventListener('click', () => { const d = $('#deck'); d.outerHTML = deckHTML(quiz).split('<details')[0]; deck(quiz, id); });
      return;
    }
    const i = queue[0]; card.classList.remove('on');
    $('#deck-n').textContent = `${L('שאלה', 'Question')} ${i + 1} · ${L('סבב', 'Round')} ${round}`;
    $('#deck-q').textContent = quiz[i].q; setTimeout(() => { $('#deck-a').textContent = quiz[i].a; }, 150);
    card.classList.remove('enter'); void card.offsetWidth; card.classList.add('enter');
  };
  let left = quiz.length; // cards left in this round
  const answer = (ok) => {
    if (!queue.length) return;
    const i = queue.shift();
    if (ok) known.add(i); else queue.push(i);
    if (--left === 0) { round++; left = queue.length; }
    card.classList.remove('enter'); card.classList.add(ok ? 'out-yes' : 'out-no');
    setTimeout(() => { card.classList.remove('out-yes', 'out-no'); if (!queue.length) round--; show(); }, still() ? 0 : 280);
  };
  $('#deck-yes').addEventListener('click', () => answer(true));
  $('#deck-no').addEventListener('click', () => answer(false));
  const keys = (e) => {
    if ($('#p-quiz')?.hidden || e.target.closest('input, textarea, select')) return;
    if (e.key === ' ') { e.preventDefault(); card.classList.toggle('on'); }
    else if (e.key === 'ArrowRight') $('#deck-yes')?.click();
    else if (e.key === 'ArrowLeft') $('#deck-no')?.click();
  };
  addEventListener('keydown', keys);
  show();
  return () => removeEventListener('keydown', keys);
}

/* ---------- 5. search inside every recording ---------- */
async function searchEverywhere(q, el) {
  if (q.length < 2) { el.innerHTML = ''; return; }
  const hits = await api('/api/search?q=' + encodeURIComponent(q));
  if (!hits.length) { el.innerHTML = `<p class="muted">${L('המילה לא נאמרה באף הקלטה', 'Nobody said that in any recording')}</p>`; return; }
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  el.innerHTML = `<h2 class="hits-title">${L('🔎 נאמר בהקלטות', '🔎 Said in the recordings')} <span class="chip">${hits.length}</span></h2>` +
    hits.map((h, i) => `<a class="hit pop" style="--i:${Math.min(i, 12)}" href="#/s/${esc(h.id)}/${Math.floor(h.t)}"><span class="emo">${esc(h.emoji)}</span><span><b>${esc(h.title)}</b><span class="hit-text">${esc(h.text).replace(re, (x) => `<mark>${x}</mark>`)}</span></span><time>▶ ${fmt(h.t)}</time></a>`).join('');
}

/* ---------- 6. progress dashboard ---------- */
async function statsView() {
  const items = await api('/api/stats');
  const day = (t) => { const d = new Date(t * 1000); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const today = day(Date.now() / 1000), DAY = 864e5;
  const total = items.reduce((a, s) => a + (s.duration || 0), 0);
  const week = items.filter((s) => s.created * 1000 > today - 6 * DAY).reduce((a, s) => a + (s.duration || 0), 0);
  const days = new Set(items.map((s) => day(s.created)));
  let streak = 0; for (let d = days.has(today) ? today : today - DAY; days.has(d); d -= DAY) streak++;
  const bars = Array.from({ length: 7 }, (_, i) => { const d = today - (6 - i) * DAY; return { d, min: items.filter((s) => day(s.created) === d).reduce((a, s) => a + (s.duration || 0), 0) / 60 }; });
  const maxMin = Math.max(30, ...bars.map((b) => b.min));
  const kw = {}; items.forEach((s) => (s.keywords || []).forEach((k) => { kw[k] = (kw[k] || 0) + 1; }));
  const top = Object.entries(kw).sort((a, b) => b[1] - a[1]).slice(0, 14);
  const kinds = [['live', '🎧', L('זום', 'Zoom')], ['class', '🎓', L('בכיתה', 'In class')], ['file', '🎬', L('הקלטות', 'Recordings')]]
    .map(([k, e, t]) => [e, t, items.filter((s) => (k === 'file' ? s.kind !== 'live' : s.kind === 'live' && (k === 'class' ? s.source === 'class' : s.source !== 'class'))).length]);
  const hours = (sec) => sec >= 3600 ? (sec / 3600).toFixed(1).replace('.0', '') + L(' שע׳', ' h') : Math.round(sec / 60) + L(' דק׳', ' min');
  const wd = (d) => new Date(d).toLocaleDateString(LANG === 'en' ? 'en-GB' : 'he-IL', { weekday: 'short' });
  main.innerHTML = `
  <div class="section-title" style="margin-top:0"><h1>${L('📊 ההתקדמות שלי', '📊 My progress')}</h1>${DEMO ? `<span class="chip" style="--c:var(--butter);--c-soft:var(--butter-soft)">🧪 ${L('נתונים לדוגמה', 'Sample data')}</span>` : ''}</div>
  ${!items.length ? `<div class="card empty">✨ ${L('עוד אין נתונים. אחרי ההקלטה הראשונה יופיעו כאן גרפים.', 'No data yet. Charts appear after your first recording.')} <a class="btn lilac" href="#/live">${L('התחילו להקשיב', 'Start listening')}</a></div>` : `
  <div class="kpis">
    ${[['⏱', hours(total), L('הקשבת בסך הכל', 'Listened in total'), 'lilac'], ['📅', hours(week), L('ב-7 הימים האחרונים', 'In the last 7 days'), 'peach'],
       ['🔥', streak, L(streak === 1 ? 'יום ברצף' : 'ימים ברצף', 'day streak'), 'butter'], ['📚', items.length, L('סיכומים', 'Summaries'), 'mint']]
      .map(([e, v, t, c], i) => `<div class="card kpi pop" style="--i:${i};--c:var(--${c});--c-soft:var(--${c}-soft)"><span class="kpi-e">${e}</span><b class="count" data-to="${parseFloat(v)}">${esc(v)}</b><small>${t}</small></div>`).join('')}
  </div>
  <div class="two">
    <section class="card pop" style="--i:4"><h3>${L('🗓️ דקות האזנה השבוע', '🗓️ Listening minutes this week')}</h3>
      <div class="week">${bars.map((b, i) => `<div class="wk${b.d === today ? ' today' : ''}" title="${Math.round(b.min)} ${L('דק׳', 'min')}"><i style="--h:${(b.min / maxMin * 100).toFixed(1)}%;--i:${i}"></i><small>${wd(b.d)}</small></div>`).join('')}</div></section>
    <section class="card pop" style="--i:5"><h3>${L('🎛️ מאיפה הקשבת', '🎛️ Where you listened')}</h3>
      <div class="split">${kinds.map(([e, t, n]) => `<div class="sp"><span>${e} ${t}</span><div class="sp-bar"><i style="--w:${(n / Math.max(1, items.length) * 100).toFixed(1)}%"></i></div><b>${n}</b></div>`).join('')}</div></section>
  </div>
  ${top.length ? `<section class="card pop" style="--i:6;margin-top:18px"><h3>${L('☁️ הנושאים שהכי חוזרים', '☁️ Your most common topics')}</h3>
    <div class="cloud">${top.map(([k, n], i) => `<a class="chip pop" style="--i:${i};font-size:${(0.9 + Math.min(n, 5) * 0.18).toFixed(2)}rem" href="#/library/${encodeURIComponent(k)}"># ${esc(k)} <small>${n}</small></a>`).join('')}</div></section>` : ''}`}`;
  if (!still()) main.querySelectorAll('.count').forEach((el) => {
    const to = +el.dataset.to, txt = el.textContent; if (!to) return; const t0 = performance.now();
    const step = (now) => { const p = Math.min(1, (now - t0) / 900); el.textContent = txt.replace(/[\d.]+/, (to * (1 - Math.pow(1 - p, 3))).toFixed(String(to).includes('.') ? 1 : 0)); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

/* ---------- 7. demo tour ---------- */
function tour(force = false) {
  const KEY = 'kashuv-tour-done';
  try { if (!force && localStorage.getItem(KEY)) return; } catch (e) {}
  const steps = [
    ['#hdemo', L('👋 ככה זה נראה בזום', '👋 This is what it looks like in a Zoom'), L('קשב מתמללת בזמן אמת, בונה סיכום תוך כדי, ומקפיצה התראה כשקוראים לך.', 'Kashuv transcribes live, builds a summary as it goes and alerts you when your name is called.')],
    ['[data-nav=live]', L('🎧 נסו האזנה חיה', '🎧 Try live listening'), L('כאן מתחילים. בדמו תראו תמלול מדומה, "מה פספסתי?" ומצב ריכוז.', 'Start here. The demo shows a sample transcript, "What did I miss?" and focus mode.')],
    ['#recent .card', L('📒 סיכום מוכן', '📒 A finished summary'), L('מפת ההרצאה, כרטיסיות תרגול, מושגים, ושאלות על ההקלטה.', 'A lecture map, practice cards, concepts and questions about the recording.')],
    ['[data-nav=stats]', L('📊 ההתקדמות שלך', '📊 Your progress'), L('כמה הקשבת, רצף ימים והנושאים שהכי חוזרים.', 'How much you listened, your streak and your top topics.')],
  ];
  let i = 0;
  const box = document.createElement('div'); box.className = 'tour'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'false');
  const ring = document.createElement('div'); ring.className = 'tour-ring'; ring.setAttribute('aria-hidden', 'true');
  document.body.append(ring, box);
  const end = () => { try { localStorage.setItem(KEY, '1'); } catch (e) {} box.remove(); ring.remove(); removeEventListener('resize', place); removeEventListener('hashchange', end); removeEventListener('keydown', esc_); };
  const esc_ = (e) => { if (e.key === 'Escape') end(); };
  function place() {
    const [sel, title, text] = steps[i], el = $(sel);
    if (!el) { if (++i < steps.length) return place(); return end(); }
    el.scrollIntoView({ block: 'center', behavior: still() ? 'auto' : 'smooth' });
    setTimeout(() => {
      const r = el.getBoundingClientRect(), pad = 8;
      Object.assign(ring.style, { top: r.top - pad + 'px', left: r.left - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
      box.innerHTML = `<small>${i + 1} / ${steps.length}</small><h3>${title}</h3><p>${text}</p><div class="tour-btns"><button class="btn soft small" type="button" data-t="skip">${L('דילוג', 'Skip')}</button><button class="btn lilac small" type="button" data-t="next">${i === steps.length - 1 ? L('בואו נתחיל 🎉', "Let's go 🎉") : L('הבא ←', 'Next →')}</button></div>`;
      const below = r.bottom + 220 < innerHeight;
      box.style.top = (below ? r.bottom + 16 : Math.max(12, r.top - box.offsetHeight - 16)) + 'px';
      box.style.left = Math.min(innerWidth - box.offsetWidth - 12, Math.max(12, r.left + r.width / 2 - box.offsetWidth / 2)) + 'px';
      box.querySelector('[data-t=next]').focus();
    }, still() ? 0 : 350);
  }
  box.addEventListener('click', (e) => { const t = e.target.closest('[data-t]'); if (!t) return; if (t.dataset.t === 'skip' || i === steps.length - 1) end(); else { i++; place(); } });
  addEventListener('resize', place); addEventListener('hashchange', end); addEventListener('keydown', esc_);
  place();
}
