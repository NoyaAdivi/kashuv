// Kashuv front end: a tiny hash router with four views (home, live, library, summary).
const $ = (s, el = document) => el.querySelector(s);
const main = $('#main');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (sec) => { sec = Math.max(0, Math.round(sec || 0)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(s).padStart(2, '0'); };
const toSec = (t) => String(t || '').split(':').reduce((a, n) => a * 60 + (parseInt(n, 10) || 0), 0);
const dateHe = (t) => new Date((t || 0) * 1000).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const api = async (url, opts = {}) => {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body && JSON.stringify(opts.body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'משהו השתבש');
  return j;
};
const store = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) {} } };

function toast(text, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.textContent = text;
  $('#toasts').append(t); setTimeout(() => t.remove(), kind === 'alert' ? 9000 : 4200);
}
function beep() {
  try {
    const ctx = new AudioContext(), o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; g.gain.setValueAtTime(.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .6);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .6);
  } catch (e) {}
}

let cleanup = () => {}, routeId = 0;
async function route() {
  const my = ++routeId;
  cleanup(); cleanup = () => {}; main.onclick = null; document.body.classList.remove('focus');
  const [, view, id] = location.hash.split('/');
  document.querySelectorAll('[data-nav]').forEach((a) => a.setAttribute('aria-current', a.dataset.nav === (view || 'home') ? 'page' : 'false'));
  window.scrollTo(0, 0);
  try {
    if (view === 'live') await liveView();
    else if (view === 'library') await libraryView();
    else if (view === 's' && id) await summaryView(id);
    else await homeView();
  } catch (e) { if (my === routeId) main.innerHTML = `<div class="card empty">😕 ${esc(e.message)}</div>`; }
}
addEventListener('hashchange', route);

/* ---------- home ---------- */
async function homeView() {
  main.innerHTML = `
  <section class="hero">
    <div class="wave" aria-hidden="true">${'<b></b>'.repeat(9)}</div>
    <h1>להיות <em>קשובים</em> בכל זום</h1>
    <p>תמלול בזמן אמת, עזרה להתרכז, וסיכומים מסודרים שנראים כמו המחברת הכי טובה בכיתה. חינם, ובמחשב שלך.</p>
    <div class="status-row" id="health"><span class="chip">בודק את המערכת<span class="dots"></span></span></div>
  </section>
  <section class="choices">
    <div class="card choice lilacy pop" style="--i:1">
      <div class="big">🎧</div>
      <h2>זום חי</h2>
      <p class="muted">מקשיב למה שהמחשב משמיע (אפליקציית זום, זום בדפדפן, Meet), מתמלל, מסכם תוך כדי ומקפיץ התראה כשאומרים את השם שלך.</p>
      <a class="btn lilac" href="#/live">להתחיל להקשיב</a>
    </div>
    <div class="card choice peachy pop" style="--i:2">
      <div class="big">🎬</div>
      <h2>סיכום מהקלטה</h2>
      <p class="muted">יש לך הקלטה של זום או הרצאה? גוררים אותה לכאן ומקבלים תמלול וסיכום מלא.</p>
      <label class="drop" id="drop">
        <input type="file" id="file" class="vh" accept="audio/*,video/*,.mkv">
        <b>גוררים קובץ או לוחצים לבחירה</b><br><span class="muted">mp4, m4a, mp3, wav ועוד</span>
      </label>
      <label class="field">שפת ההקלטה
        <select id="lang"><option value="he">עברית</option><option value="en">אנגלית</option><option value="">זיהוי אוטומטי</option></select>
      </label>
    </div>
  </section>
  <section class="steps">
    <div class="step card pop" style="--i:3"><span class="n">1</span><div><b>מקליטים</b><br><span class="muted">מהמחשב או מקובץ קיים</span></div></div>
    <div class="step card pop" style="--i:4"><span class="n">2</span><div><b>מתמללים</b><br><span class="muted">מודל עברית של ivrit.ai</span></div></div>
    <div class="step card pop" style="--i:5"><span class="n">3</span><div><b>מסכמים</b><br><span class="muted">מושגים, משימות, שאלות תרגול</span></div></div>
  </section>
  <div class="section-title"><h2>סיכומים אחרונים</h2><a href="#/library">לכל הסיכומים ←</a></div>
  <div class="lib" id="recent"></div>`;

  api('/api/health').then((h) => {
    $('#health').innerHTML = `
      <span class="chip" style="--c:var(--mint);--c-soft:var(--mint-soft)">🎙️ תמלול: ${h.loaded ? 'מוכן' : 'ייטען בשימוש הראשון'}</span>
      ${h.ollama.running && h.ollama.model ? `<span class="chip" style="--c:var(--mint);--c-soft:var(--mint-soft)">✨ סיכומים: ${esc(h.ollama.name)} מוכן</span>`
        : `<span class="chip" style="--c:var(--warn);--c-soft:var(--warn-soft)">⚠️ ${h.ollama.running ? `חסר המודל ${esc(h.ollama.name)} ב-Ollama` : 'Ollama לא פועל, אין סיכומים'}</span>`}`;
  }).catch(() => {});
  renderLib($('#recent'), (await api('/api/sessions')).slice(0, 6));

  const drop = $('#drop'), file = $('#file');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]); });
  file.addEventListener('change', () => file.files[0] && upload(file.files[0]));
}

function upload(f) {
  const fd = new FormData(); fd.append('file', f); fd.append('lang', $('#lang').value);
  progressView('מעלה את הקובץ', 0);
  const x = new XMLHttpRequest();
  x.open('POST', '/api/upload');
  x.upload.onprogress = (e) => e.lengthComputable && progressView('מעלה את הקובץ', e.loaded / e.total);
  x.onload = () => {
    const j = JSON.parse(x.responseText || '{}');
    if (x.status !== 200) { toast(j.error || 'ההעלאה נכשלה'); return route(); }
    watchJob(j.job, j.session);
  };
  x.onerror = () => { toast('ההעלאה נכשלה'); route(); };
  x.send(fd);
}

function progressView(step, p) {
  if (!$('.progress-view')) {
    main.innerHTML = `<section class="progress-view">
      <div class="wave" aria-hidden="true">${'<b></b>'.repeat(7)}</div>
      <div class="ring" id="ring"><span id="pct">0%</span></div>
      <h2 id="step"></h2><p class="muted">אפשר להשאיר את החלון פתוח ולחזור אחר כך. הכל נשמר אוטומטית.</p></section>`;
  }
  const pct = Math.round((p || 0) * 100);
  $('#ring').style.background = `conic-gradient(var(--lilac) ${pct}%, var(--lilac-soft) 0)`;
  $('#pct').textContent = pct + '%';
  $('#step').innerHTML = esc(step) + '<span class="dots"></span>';
}

function watchJob(jid, sid) {
  let alive = true; cleanup = () => { alive = false; };
  const tick = async () => {
    if (!alive) return;
    const j = await api('/api/jobs/' + jid).catch(() => ({ status: 'error', error: 'השרת לא עונה' }));
    if (j.status === 'done') { location.hash = '#/s/' + (j.session || sid); return; }
    if (j.status === 'error') {
      toast('הסיכום לא הושלם: ' + j.error);
      if (sid) location.hash = '#/s/' + sid; else route();
      return;
    }
    progressView(j.step || 'מתחיל', j.progress);
    setTimeout(tick, 1000);
  };
  tick();
}

/* ---------- library ---------- */
function renderLib(el, items) {
  if (!items.length) { el.innerHTML = '<div class="card empty" style="grid-column:1/-1">✨ עוד אין סיכומים. נתחיל?</div>'; return; }
  el.innerHTML = items.map((s, i) => `
    <a class="card pop" style="--i:${i}" href="#/s/${esc(s.id)}">
      <span class="emo">${esc(s.emoji)}</span>
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.tldr || 'בלי סיכום עדיין')}</p>
      <div class="chips"><span class="chip">${s.kind === 'live' ? '🎧 חי' : '🎬 הקלטה'}</span><span class="chip" style="--c:var(--peach-deep);--c-soft:var(--peach-soft)">⏱ ${fmt(s.duration)}</span></div>
      <small class="muted">${dateHe(s.created)}</small>
    </a>`).join('');
}
async function libraryView() {
  main.innerHTML = `<div class="section-title" style="margin-top:0"><h1>הסיכומים שלי</h1>
    <input class="search" id="q" type="search" placeholder="חיפוש לפי נושא או מילה" aria-label="חיפוש סיכומים"></div><div class="lib" id="all"></div>`;
  const items = await api('/api/sessions');
  const draw = () => {
    const q = $('#q').value.trim();
    renderLib($('#all'), items.filter((s) => !q || [s.title, s.tldr, ...(s.keywords || [])].join(' ').includes(q)));
  };
  $('#q').addEventListener('input', draw); draw();
}

/* ---------- live ---------- */
async function liveView() {
  const running = store.get('kashuv-live');
  if (running) return liveRun(running);
  main.innerHTML = `
  <section class="live-setup">
    <div class="hero" style="padding:0"><div class="wave" aria-hidden="true">${'<b></b>'.repeat(9)}</div><h1>זום חי</h1>
    <p>פותחים את הזום (באפליקציה או בדפדפן) ולוחצים התחלה. Kashuv שומע את מה שהמחשב משמיע.</p></div>
    <div class="card grid">
      <label class="field">שם הפגישה <input id="title" placeholder="למשל: מבני נתונים, הרצאה 5"></label>
      <label class="field">השם שלך (בשביל התראה כשקוראים לך) <input id="name" placeholder="נויה"></label>
      <label class="field">שפה <select id="lang"><option value="he">עברית</option><option value="en">אנגלית</option><option value="">זיהוי אוטומטי</option></select></label>
      <label class="check"><input type="checkbox" id="mic"> להקליט גם את המיקרופון שלי</label>
      <p class="note">💛 חשוב: ספרו למשתתפים ולמרצה שאתם מקליטים ומתמללים. ההקלטה נשמרת רק במחשב שלך.</p>
      <button class="btn lilac" id="go">🎧 להתחיל להקשיב</button>
    </div>
  </section>`;
  try { const p = JSON.parse(localStorage.getItem('kashuv-live-prefs') || '{}'); if (p.name) $('#name').value = p.name; if (p.lang != null) $('#lang').value = p.lang; $('#mic').checked = !!p.mic; } catch (e) {}
  $('#go').addEventListener('click', async () => {
    const body = { title: $('#title').value, name: $('#name').value, lang: $('#lang').value, mic: $('#mic').checked };
    try { localStorage.setItem('kashuv-live-prefs', JSON.stringify({ name: body.name, lang: body.lang, mic: body.mic })); } catch (e) {}
    $('#go').disabled = true;
    try { const j = await api('/api/live/start', { method: 'POST', body }); store.set('kashuv-live', j.id); liveRun(j.id); }
    catch (e) { toast(e.message); $('#go').disabled = false; }
  });
}

function liveRun(id) {
  main.innerHTML = `
  <div class="card live-top">
    <span class="orb idle" id="orb"></span><span class="timer" id="timer">00:00</span>
    <span class="meter" id="meter" aria-hidden="true">${'<b></b>'.repeat(8)}</span>
    <span class="muted" id="lstatus">מתחבר לשמע<span class="dots"></span></span>
    <div class="live-tools">
      <button class="btn soft small" data-missed="2">🙈 מה פספסתי? 2 דק'</button>
      <button class="btn soft small" data-missed="5">5 דק'</button>
      <button class="btn soft small" data-missed="10">10 דק'</button>
      <button class="btn soft small" id="mark">⭐ רגע חשוב</button>
      <button class="btn soft small" id="focus" aria-pressed="false">🎯 מצב ריכוז</button>
      <button class="btn peach small" id="stop">⏹ לסיים ולסכם</button>
    </div>
  </div>
  <div id="lerr"></div>
  <div class="live-grid">
    <section class="card stream-card"><h2 style="font-size:1.2rem;margin-bottom:10px">📝 תמלול חי</h2>
      <div class="stream" id="stream" aria-live="polite"><p class="muted" id="wait">מחכה שמישהו ידבר. בפעם הראשונה מודל התמלול נטען וזה לוקח כמה דקות.</p></div></section>
    <aside class="side">
      <div class="card now"><h3>עכשיו מדברים על</h3><p id="now">עוד רגע יופיע כאן 🙂</p>
        <button class="btn soft small" id="refresh" style="margin-top:12px">✨ לרענן את הסיכום עכשיו</button></div>
      <div class="card" id="missed-card" hidden><h3>🙈 מה פספסת</h3><p class="missed-box" id="missed"></p></div>
      <div class="card"><h3>✦ הנקודות החשובות</h3><ul class="ticks" id="points"><li class="muted">יתמלא תוך כמה דקות</li></ul></div>
      <div class="card"><h3>❓ שאלות ומשימות</h3><ul class="ticks" id="qs"></ul></div>
      <div class="card" id="alerts-card" hidden><h3>📣 הזכירו אותך</h3><ul class="ticks" id="alerts"></ul></div>
      <div class="card" id="marks-card" hidden><h3>⭐ רגעים חשובים</h3><ul class="ticks" id="marks"></ul></div>
    </aside>
  </div>`;

  let since = 0, alive = true, seenAlerts = 0, timerId;
  cleanup = () => { alive = false; clearTimeout(timerId); document.title = 'Kashuv'; };
  const list = (el, arr, render = esc) => { el.innerHTML = arr.length ? arr.map((x) => `<li>${render(x)}</li>`).join('') : ''; };

  const poll = async () => {
    if (!alive) return;
    let s;
    try { s = await api(`/api/live/${id}?since=${since}`); }
    catch (e) { store.set('kashuv-live', null); toast('הפגישה החיה הסתיימה'); location.hash = '#/'; return; }
    $('#timer').textContent = fmt(s.elapsed);
    $('#orb').classList.toggle('idle', s.status !== 'listening');
    $('#lstatus').innerHTML = s.status === 'listening' ? (s.rolling ? 'מעדכן סיכום<span class="dots"></span>' : 'מקשיב') : s.status === 'error' ? 'שגיאה' : 'מתחבר לשמע<span class="dots"></span>';
    const lvl = Math.min(1, s.level * 12);
    $('#meter').querySelectorAll('b').forEach((b, i) => { b.style.height = Math.max(4, lvl * 26 * (0.5 + Math.abs(Math.sin(Date.now() / 200 + i)))) + 'px'; });
    $('#lerr').innerHTML = s.error ? `<p class="note warn">⚠️ ${esc(s.error)}</p>` : '';
    if (s.segments.length) {
      $('#wait')?.remove();
      const st = $('#stream'), atBottom = st.scrollHeight - st.scrollTop - st.clientHeight < 80;
      const names = (JSON.parse(localStorage.getItem('kashuv-live-prefs') || '{}').name || '').split(/\s+/).filter((w) => w.length > 1);
      st.insertAdjacentHTML('beforeend', s.segments.map((g) => `<div class="line${names.some((n) => g.text.includes(n)) ? ' hit' : ''}"><time>${fmt(g.start)}</time><span>${esc(g.text)}</span></div>`).join(''));
      if (atBottom) st.scrollTop = st.scrollHeight;
      since = s.count;
    }
    if (s.summary.now) $('#now').textContent = s.summary.now;
    if (s.summary.points.length) list($('#points'), s.summary.points);
    list($('#qs'), s.summary.questions);
    if (s.alerts.length > seenAlerts) {
      const a = s.alerts[s.alerts.length - 1]; seenAlerts = s.alerts.length;
      toast(`📣 הזכירו אותך: "${a.text}"`, 'alert'); beep();
      $('.now').classList.add('flash'); setTimeout(() => $('.now')?.classList.remove('flash'), 3000);
      document.title = '📣 קוראים לך! Kashuv';
    }
    $('#alerts-card').hidden = !s.alerts.length; list($('#alerts'), s.alerts, (a) => `<b>${fmt(a.t)}</b> ${esc(a.text)}`);
    $('#marks-card').hidden = !s.marks.length; list($('#marks'), s.marks, (m) => `<b>${fmt(m.t)}</b> ${esc(m.note || 'רגע חשוב')}`);
    timerId = setTimeout(poll, 1500);
  };
  poll();
  addEventListener('focus', () => { document.title = 'Kashuv'; }, { once: true });

  main.querySelectorAll('[data-missed]').forEach((b) => b.addEventListener('click', async () => {
    $('#missed-card').hidden = false; $('#missed').innerHTML = 'מסכם<span class="dots"></span>';
    try { $('#missed').textContent = (await api(`/api/live/${id}/missed`, { method: 'POST', body: { minutes: +b.dataset.missed } })).text; }
    catch (e) { $('#missed').textContent = e.message; }
  }));
  $('#mark').addEventListener('click', async () => {
    const note = prompt('מה חשוב פה? (אפשר להשאיר ריק)') ?? '';
    await api(`/api/live/${id}/mark`, { method: 'POST', body: { note } }); toast('⭐ הרגע סומן');
  });
  $('#refresh').addEventListener('click', () => { api(`/api/live/${id}/refresh`, { method: 'POST' }); toast('✨ מעדכן את הסיכום'); });
  $('#focus').addEventListener('click', (e) => {
    const on = document.body.classList.toggle('focus'); e.currentTarget.setAttribute('aria-pressed', String(on));
    toast(on ? '🎯 מצב ריכוז: רק מה שחשוב' : 'חזרנו לתצוגה המלאה');
  });
  $('#stop').addEventListener('click', async () => {
    if (!confirm('לסיים את ההקלטה ולבנות סיכום מלא?')) return;
    alive = false;
    const j = await api(`/api/live/${id}/stop`, { method: 'POST' });
    store.set('kashuv-live', null); document.body.classList.remove('focus');
    watchJob(j.job, id);
  });
}

/* ---------- summary ---------- */
async function summaryView(id) {
  const s = await api('/api/sessions/' + id);
  const m = s.summary || {};
  const has = (a) => Array.isArray(a) && a.length;
  const tabs = [
    ['sum', '📒 סיכום'], has(m.concepts) && ['con', '💡 מושגים'], (has(m.tasks) || has(m.questions)) && ['todo', '✅ משימות ושאלות'],
    has(m.quiz) && ['quiz', '🧠 תרגול'], (has(m.timeline) || has(s.marks)) && ['tl', '🕒 ציר זמן'], ['tr', '📝 תמלול'], ['ask', '💬 לשאול את ההקלטה'],
  ].filter(Boolean);
  const titleOf = Object.fromEntries(tabs);

  main.innerHTML = `
  <section class="card sum-hero pop">
    <span class="emo" aria-hidden="true">${esc(m.emoji || '📝')}</span>
    <h1>${esc(m.title || s.name)}</h1>
    <div class="meta">
      <span class="chip">${s.kind === 'live' ? '🎧 זום חי' : '🎬 הקלטה'}</span>
      <span class="chip" style="--c:var(--peach-deep);--c-soft:var(--peach-soft)">⏱ ${fmt(s.duration)}</span>
      <span class="chip" style="--c:var(--mint);--c-soft:var(--mint-soft)">📅 ${dateHe(s.created)}</span>
    </div>
    ${m.tldr ? `<p class="tldr">${esc(m.tldr)}</p>` : `<p class="note warn">⚠️ עוד אין סיכום להקלטה הזאת (כנראה Ollama לא פעל). התמלול שמור, אפשר לנסות שוב.</p>`}
    ${has(m.keywords) ? `<div class="chips">${m.keywords.map((k) => `<span class="chip" style="--c:var(--butter);--c-soft:var(--butter-soft)"># ${esc(k)}</span>`).join('')}</div>` : ''}
    <div class="actions">
      <button class="btn small" id="pdf">🖨️ PDF</button>
      <button class="btn soft small" id="md">⬇️ Markdown</button>
      <button class="btn soft small" id="copy">📋 העתקה</button>
      <button class="btn soft small" id="again">✨ סיכום מחדש</button>
      <button class="btn danger small" id="del">🗑 מחיקה</button>
    </div>
  </section>
  ${s.audio ? `<div class="card player"><span aria-hidden="true">🎵</span><audio id="audio" controls preload="metadata" src="/media/${esc(s.audio)}"></audio></div>` : ''}
  <div class="tabs" role="tablist" aria-label="חלקי הסיכום">
    ${tabs.map(([k, t], i) => `<button role="tab" id="t-${k}" aria-controls="p-${k}" aria-selected="${i === 0}">${t}</button>`).join('')}
  </div>

  <section class="panel" id="p-sum" role="tabpanel" data-title="סיכום">
    ${has(m.exam_tips) ? `<div class="card tips pop"><h3>🎯 מה חשוב למבחן</h3><ul class="ticks">${m.exam_tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
    <div class="secs">${(m.sections || []).map((x, i) => `
      <article class="card sec pop" style="--i:${i}"><h3><span>${esc(x.emoji || '✦')}</span>${esc(x.title)}</h3>
      <ul>${(x.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('')}</ul></article>`).join('') || '<p class="muted">אין עדיין חלקים בסיכום.</p>'}</div>
  </section>
  ${has(m.concepts) ? `<section class="panel" id="p-con" role="tabpanel" data-title="מושגים" hidden><div class="concepts">${m.concepts.map((c, i) => `
    <div class="card concept pop" style="--i:${i}"><b>${esc(c.term)}</b>${esc(c.explain)}</div>`).join('')}</div></section>` : ''}
  ${titleOf.todo ? `<section class="panel" id="p-todo" role="tabpanel" data-title="משימות ושאלות" hidden><div class="two">
    <div class="card pop"><h3>✅ משימות</h3><ul class="todo">${(m.tasks || []).map((t, i) => `<li><label><input type="checkbox" data-todo="${i}"><span>${esc(t)}</span></label></li>`).join('') || '<li class="muted">לא הוזכרו משימות</li>'}</ul></div>
    <div class="card pop" style="--i:1"><h3>❓ שאלות שעלו</h3><ul class="ticks">${(m.questions || []).map((q) => `<li>${esc(q)}</li>`).join('') || '<li class="muted">לא עלו שאלות</li>'}</ul></div>
  </div></section>` : ''}
  ${has(m.quiz) ? `<section class="panel" id="p-quiz" role="tabpanel" data-title="תרגול" hidden><p class="muted no-print">לוחצים על כרטיס כדי לראות את התשובה.</p><div class="cards">${m.quiz.map((q, i) => `
    <button class="flip pop" style="--i:${i}" aria-label="שאלה ${i + 1}"><div class="in"><div class="f"><small>שאלה ${i + 1}</small>${esc(q.q)}</div><div class="b"><small>תשובה</small>${esc(q.a)}</div></div></button>`).join('')}</div></section>` : ''}
  ${titleOf.tl ? `<section class="panel" id="p-tl" role="tabpanel" data-title="ציר זמן" hidden><div class="card"><ol class="tl">
    ${[...(m.timeline || []).map((t) => ({ sec: toSec(t.time), title: t.title, star: false })), ...(s.marks || []).map((k) => ({ sec: k.t, title: k.note || 'רגע חשוב', star: true }))]
      .sort((a, b) => a.sec - b.sec).map((t) => `<li><button data-seek="${t.sec}">${fmt(t.sec)}</button><span>${t.star ? '⭐ ' : ''}${esc(t.title)}</span></li>`).join('')}
  </ol></div></section>` : ''}
  <section class="panel" id="p-tr" role="tabpanel" data-title="תמלול מלא" hidden><div class="card">
    <input class="search no-print" id="find" type="search" placeholder="חיפוש בתמלול" aria-label="חיפוש בתמלול" style="margin-bottom:12px">
    <div class="transcript" id="tr"></div></div></section>
  <section class="panel no-print" id="p-ask" role="tabpanel" data-title="שאלות" hidden><div class="card chat">
    <div class="chat" id="chat"><div class="bubble ai">היי! אפשר לשאול אותי כל דבר על ההקלטה, למשל "מה המרצה אמר על המבחן?" 🙂</div></div>
    <form class="ask-row" id="askf"><input id="askq" placeholder="השאלה שלך" aria-label="השאלה שלך" required><button class="btn lilac">שליחה</button></form>
  </div></section>`;

  // tabs
  main.querySelectorAll('[role=tab]').forEach((t) => t.addEventListener('click', () => {
    main.querySelectorAll('[role=tab]').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    main.querySelectorAll('.panel').forEach((p) => { p.hidden = p.id !== 'p-' + t.id.slice(2); });
  }));

  // transcript, search, seek and follow the audio
  const segs = s.segments || [];
  const drawTr = (q = '') => {
    const re = q && new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    $('#tr').innerHTML = segs.filter((g) => !q || g.text.includes(q)).map((g) => `<button class="seg" data-seek="${g.start}" data-start="${g.start}"><time>${fmt(g.start)}</time><span>${re ? esc(g.text).replace(re, (x) => `<mark>${x}</mark>`) : esc(g.text)}</span></button>`).join('')
      || '<p class="muted">לא נמצא</p>';
  };
  drawTr(); $('#find').addEventListener('input', (e) => drawTr(e.target.value.trim()));
  const audio = $('#audio');
  main.onclick = (e) => {
    const b = e.target.closest('[data-seek]');
    if (b && audio) { audio.currentTime = +b.dataset.seek; audio.play(); }
    const f = e.target.closest('.flip'); if (f) f.classList.toggle('on');
  };
  if (audio) audio.addEventListener('timeupdate', () => {
    let cur = null;
    main.querySelectorAll('.seg').forEach((el) => { if (+el.dataset.start <= audio.currentTime) cur = el; el.classList.remove('cur'); });
    cur?.classList.add('cur');
  });

  // checklist remembers what you did
  const key = 'kashuv-todo-' + id;
  let done = {}; try { done = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) {}
  main.querySelectorAll('[data-todo]').forEach((c) => { c.checked = !!done[c.dataset.todo]; c.addEventListener('change', () => { done[c.dataset.todo] = c.checked; try { localStorage.setItem(key, JSON.stringify(done)); } catch (e) {} }); });

  // ask the recording
  $('#askf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = $('#askq').value.trim(); if (!q) return; $('#askq').value = '';
    $('#chat').insertAdjacentHTML('beforeend', `<div class="bubble me">${esc(q)}</div><div class="bubble ai" id="pending">חושב<span class="dots"></span></div>`);
    try { $('#pending').textContent = (await api(`/api/sessions/${id}/ask`, { method: 'POST', body: { q } })).answer; }
    catch (err) { $('#pending').textContent = err.message; }
    $('#pending').removeAttribute('id');
  });

  // export
  const markdown = () => [
    `# ${m.emoji || ''} ${m.title || s.name}`, '', m.tldr || '', '',
    ...(m.exam_tips || []).length ? ['## 🎯 מה חשוב למבחן', ...m.exam_tips.map((t) => '- ' + t), ''] : [],
    ...(m.sections || []).flatMap((x) => [`## ${x.emoji || ''} ${x.title}`, ...(x.bullets || []).map((b) => '- ' + b), '']),
    ...has(m.concepts) ? ['## 💡 מושגים', ...m.concepts.map((c) => `- **${c.term}**: ${c.explain}`), ''] : [],
    ...has(m.tasks) ? ['## ✅ משימות', ...m.tasks.map((t) => '- [ ] ' + t), ''] : [],
    ...has(m.questions) ? ['## ❓ שאלות', ...m.questions.map((t) => '- ' + t), ''] : [],
    ...has(m.quiz) ? ['## 🧠 תרגול', ...m.quiz.flatMap((q, i) => [`${i + 1}. ${q.q}`, `   > ${q.a}`]), ''] : [],
    '## 📝 תמלול', ...segs.map((g) => `[${fmt(g.start)}] ${g.text}`),
  ].join('\n');
  $('#pdf').addEventListener('click', () => print());
  $('#md').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([markdown()], { type: 'text/markdown' }));
    a.download = (m.title || s.name || 'kashuv') + '.md'; a.click(); URL.revokeObjectURL(a.href);
  });
  $('#copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(markdown()); toast('📋 הועתק'); } catch (e) { toast('לא הצלחתי להעתיק'); } });
  $('#again').addEventListener('click', async () => { const j = await api(`/api/sessions/${id}/resummarize`, { method: 'POST' }); watchJob(j.job, id); });
  $('#del').addEventListener('click', async () => {
    if (!confirm('למחוק את הסיכום וההקלטה לגמרי?')) return;
    await api('/api/sessions/' + id, { method: 'DELETE' }); toast('נמחק'); location.hash = '#/library';
  });
}

route();
