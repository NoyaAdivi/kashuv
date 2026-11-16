// Kashuv front end: a tiny hash router with four views (home, live, library, summary).
const $ = (s, el = document) => el.querySelector(s);
const main = $('#main');
let LANG = 'he';
try { LANG = localStorage.getItem('kashuv-lang') || 'he'; } catch (e) {}
const L = (he, en) => (LANG === 'en' ? en : he);
const STEP = {
  loading: ['מכינה את מודל התמלול (בפעם הראשונה זה לוקח כמה דקות)', 'Preparing the speech model (a few minutes the first time)'],
  transcribing: ['מתמללת', 'Transcribing'], summarizing: ['כותבת סיכום מטורף', 'Writing a stunning summary'],
};
function applyLang() {
  document.documentElement.lang = LANG; document.documentElement.dir = LANG === 'en' ? 'ltr' : 'rtl';
  document.querySelectorAll('[data-en]').forEach((el) => { el.dataset.he ??= el.innerHTML; el.innerHTML = LANG === 'en' ? el.dataset.en : el.dataset.he; });
  document.querySelectorAll('[data-en-label]').forEach((el) => { el.dataset.heLabel ??= el.getAttribute('aria-label'); el.setAttribute('aria-label', LANG === 'en' ? el.dataset.enLabel : el.dataset.heLabel); });
  $('#lang-btn').textContent = LANG === 'en' ? 'עב' : 'EN';
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (sec) => { sec = Math.max(0, Math.round(sec || 0)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(s).padStart(2, '0'); };
const toSec = (t) => String(t || '').split(':').reduce((a, n) => a * 60 + (parseInt(n, 10) || 0), 0);
const dateHe = (t) => new Date((t || 0) * 1000).toLocaleDateString(LANG === 'en' ? 'en-GB' : 'he-IL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const DEMO = !!window.KASHUV_DEMO;
const api = async (url, opts = {}) => {
  if (DEMO) return window.demoApi(url, opts, LANG);
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body && JSON.stringify(opts.body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || L("משהו השתבש", "Something went wrong"));
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
    else if (view === 'accessibility') a11yView();
    else await homeView();
  } catch (e) { if (my === routeId) main.innerHTML = `<div class="card empty">😕 ${esc(e.message)}</div>`; }
}
addEventListener('hashchange', route);

/* ---------- home ---------- */
async function homeView() {
  main.innerHTML = `
  <section class="hero">
    <div class="wave" aria-hidden="true">${'<b></b>'.repeat(9)}</div>
    <h1>${L("להיות <em>קשובה</em> בכל זום, הרצאה ושיעור", "Stay <em>focused</em> in every Zoom, lecture and class")}</h1>
    <p>${L("תמלול בזמן אמת, עזרה להתרכז, וסיכומים מטורפים שנראים כמו מחברת של התלמידה הכי טובה בכיתה. חינם, ובמחשב שלך.", "Live transcription, focus helpers and stunning summaries that look like the notes of the best student in class. Free, and on your own computer.")}</p>
    <div class="status-row" id="health"><span class="chip">${L("בודקת מערכת", "Checking system")}<span class="dots"></span></span></div>
  </section>
  <section class="choices">
    <div class="card choice lilacy pop" style="--i:1">
      <div class="big">🎧</div>
      <h2>${L('האזנה חיה','Live listening')}</h2>
      <p class="muted">${L("בזום (גם עם אוזניות) או בהרצאה בכיתה דרך המיקרופון: מתמללת, מסכמת תוך כדי ומקפיצה התראה כשאומרים את השם שלך.", "In a Zoom (headphones too) or in a class through the microphone: transcribes, summarizes as it goes and alerts you when someone says your name.")}</p>
      <a class="btn lilac" href="#/live">${L('התחילי להקשיב','Start listening')}</a>
    </div>
    <div class="card choice peachy pop" style="--i:2">
      <div class="big">🎬</div>
      <h2>${L('סיכום מהקלטה','Summarize a recording')}</h2>
      <p class="muted">${L("יש לך הקלטה של זום, הרצאה או שיעור (גם מהטלפון)? גררי אותה לכאן וקבלי תמלול וסיכום מלא.", "Have a recording of a Zoom, lecture or class (even from your phone)? Drop it here for a full transcript and summary.")}</p>
      <label class="drop" id="drop">
        <input type="file" id="file" class="vh" accept="audio/*,video/*,.mkv">
        <b>${L("גררי קובץ או לחצי לבחירה", "Drop a file or click to choose")}</b><br><span class="muted">${L("mp4, m4a, mp3, wav ועוד", "mp4, m4a, mp3, wav and more")}</span>
      </label>
      <label class="field">${L("שפת ההקלטה", "Recording language")}
        <select id="lang"><option value="he">${L('עברית','Hebrew')}</option><option value="en">${L('אנגלית','English')}</option><option value="">${L('זיהוי אוטומטי','Auto detect')}</option></select>
      </label>
    </div>
  </section>
  <section class="steps">
    <div class="step card pop" style="--i:3"><span class="n">1</span><div><b>${L('מקליטים','Record')}</b><br><span class="muted">${L("מהמחשב או מקובץ קיים", "From your computer or a file")}</span></div></div>
    <div class="step card pop" style="--i:4"><span class="n">2</span><div><b>${L('מתמללים','Transcribe')}</b><br><span class="muted">${L("מודל עברית של ivrit.ai", "Hebrew model by ivrit.ai")}</span></div></div>
    <div class="step card pop" style="--i:5"><span class="n">3</span><div><b>${L('מסכמים','Summarize')}</b><br><span class="muted">${L("מושגים, משימות, שאלות תרגול", "Concepts, tasks, practice questions")}</span></div></div>
  </section>
  <div class="section-title"><h2>${L('סיכומים אחרונים','Recent summaries')}</h2><a href="#/library">${L("לכל הסיכומים ←", "All summaries →")}</a></div>
  <div class="lib" id="recent"></div>`;

  api('/api/health').then((h) => {
    if (h.demo) { $('#health').innerHTML = `<span class="chip" style="--c:var(--butter);--c-soft:var(--butter-soft)">🧪 ${L('מצב הדגמה: נתונים לדוגמה, בלי הקלטה אמיתית','Demo mode: sample data, no real recording')}</span><a class="chip" href="https://github.com/NoyaAdivi/kashuv#run-locally">⬇️ ${L('להתקנה המלאה במחשב','Get the full app')}</a>`; return; }
    $('#health').innerHTML = `
      <span class="chip" style="--c:var(--mint);--c-soft:var(--mint-soft)">🎙️ ${L('תמלול','Transcription')}: ${h.loaded ? L('מוכן','ready') : L('ייטען בשימוש הראשון','loads on first use')}</span>
      ${h.ollama.running && h.ollama.model ? `<span class="chip" style="--c:var(--mint);--c-soft:var(--mint-soft)">✨ ${L('סיכומים','Summaries')}: ${esc(h.ollama.name)} ${L('מוכן','ready')}</span>`
        : `<span class="chip" style="--c:var(--warn);--c-soft:var(--warn-soft)">⚠️ ${h.ollama.running ? L(`חסר המודל ${esc(h.ollama.name)} ב-Ollama`, `Model ${esc(h.ollama.name)} is missing in Ollama`) : L('Ollama לא פועל, אין סיכומים','Ollama is not running, no summaries')}</span>`}`;
  }).catch(() => {});
  renderLib($('#recent'), (await api('/api/sessions')).slice(0, 6));

  const drop = $('#drop'), file = $('#file');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]); });
  file.addEventListener('change', () => file.files[0] && upload(file.files[0]));
}

function upload(f) {
  if (DEMO) { progressView(L('מעלה את הקובץ','Uploading the file'), 0); api('/api/upload', { method: 'POST' }).then((j) => watchJob(j.job, j.session)); return; }
  const fd = new FormData(); fd.append('file', f); fd.append('lang', $('#lang').value);
  progressView(L('מעלה את הקובץ','Uploading the file'), 0);
  const x = new XMLHttpRequest();
  x.open('POST', '/api/upload');
  x.upload.onprogress = (e) => e.lengthComputable && progressView(L('מעלה את הקובץ','Uploading the file'), e.loaded / e.total);
  x.onload = () => {
    const j = JSON.parse(x.responseText || '{}');
    if (x.status !== 200) { toast(j.error || L('ההעלאה נכשלה','Upload failed')); return route(); }
    watchJob(j.job, j.session);
  };
  x.onerror = () => { toast(L('ההעלאה נכשלה','Upload failed')); route(); };
  x.send(fd);
}

function progressView(step, p) {
  if (!$('.progress-view')) {
    main.innerHTML = `<section class="progress-view">
      <div class="wave" aria-hidden="true">${'<b></b>'.repeat(7)}</div>
      <div class="ring" id="ring"><span id="pct">0%</span></div>
      <h2 id="step"></h2><p class="muted">${L("אפשר להשאיר את החלון פתוח ולחזור אחר כך. הכל נשמר אוטומטית.", "You can leave this window and come back later. Everything is saved automatically.")}</p></section>`;
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
    const j = await api('/api/jobs/' + jid).catch(() => ({ status: 'error', error: L('השרת לא עונה','The server is not responding') }));
    if (j.status === 'done') { location.hash = '#/s/' + (j.session || sid); return; }
    if (j.status === 'error') {
      toast(L('הסיכום לא הושלם: ','The summary did not finish: ') + j.error);
      if (sid) location.hash = '#/s/' + sid; else route();
      return;
    }
    progressView(STEP[j.status] ? L(...STEP[j.status]) : L('מתחילה','Starting'), j.progress);
    setTimeout(tick, 1000);
  };
  tick();
}

/* ---------- library ---------- */
const kindLabel = (s) => s.kind !== 'live' ? L('🎬 הקלטה', '🎬 Recording') : s.source === 'class' ? L('🎓 הרצאה בכיתה', '🎓 In class') : s.source === 'both' ? L('🎧 זום ומיקרופון', '🎧 Zoom + mic') : L('🎧 זום', '🎧 Zoom');
function renderLib(el, items) {
  if (!items.length) { el.innerHTML = `<div class="card empty" style="grid-column:1/-1">✨ ${L('עוד אין סיכומים. נתחיל?','No summaries yet. Shall we start?')}</div>`; return; }
  el.innerHTML = items.map((s, i) => `
    <a class="card pop" style="--i:${i}" href="#/s/${esc(s.id)}">
      <span class="emo">${esc(s.emoji)}</span>
      <h3>${esc(s.title)}${s.partial ? ` <span class="chip" style="--c:var(--warn);--c-soft:var(--warn-soft)">${L('נשמר באמצע', 'Saved mid-way')}</span>` : ''}</h3>
      <p>${esc(s.tldr || L("בלי סיכום עדיין", "No summary yet"))}</p>
      <div class="chips"><span class="chip">${kindLabel(s)}</span><span class="chip" style="--c:var(--peach-deep);--c-soft:var(--peach-soft)">⏱ ${fmt(s.duration)}</span></div>
      <small class="muted">${dateHe(s.created)}</small>
    </a>`).join('');
}
async function libraryView() {
  main.innerHTML = `<div class="section-title" style="margin-top:0"><h1>${L('הסיכומים שלי','My summaries')}</h1>
    <input class="search" id="q" type="search" placeholder="${L('חיפוש לפי נושא או מילה','Search by topic or word')}" aria-label="${L('חיפוש סיכומים','Search summaries')}"></div><div class="lib" id="all"></div>`;
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
    <div class="hero" style="padding:0"><div class="wave" aria-hidden="true">${'<b></b>'.repeat(9)}</div><h1>${L('האזנה חיה','Live listening')}</h1>
    <p>${L("בחרי מאיפה להקשיב ולחצי התחלה. עובד עם רמקולים, אוזניות חוטיות ואוזניות בלוטות'.", "Choose where to listen from and press start. Works with speakers, wired and Bluetooth headphones.")}</p></div>
    <div class="card grid">
      <label class="field">${L('שם השיעור או הפגישה','Class or meeting name')} <input id="title" placeholder="${L('למשל: מבני נתונים, הרצאה 5','e.g. Data Structures, lecture 5')}"></label>
      <label class="field">${L('השם שלך (בשביל התראה כשקוראים לך)','Your name (for an alert when you are called)')} <input id="name" placeholder="${L('השם שלך','Your name')}"></label>
      <label class="field">${L('שפה','Language')} <select id="lang"><option value="he">${L('עברית','Hebrew')}</option><option value="en">${L('אנגלית','English')}</option><option value="">${L('זיהוי אוטומטי','Auto detect')}</option></select></label>
      <fieldset class="sources"><legend>${L('מאיפה להקשיב?', 'Where should I listen?')}</legend>
        ${[['computer', '💻', L('זום או שיעור אונליין', 'Zoom or online class'), L('הקול של המחשב, גם באוזניות', 'Computer sound, headphones too')],
           ['class', '🎓', L('הרצאה בכיתה', 'Lecture in class'), L('המיקרופון של המחשב', 'Your computer microphone')],
           ['both', '✨', L('זום ואני מדברת', 'Zoom and I talk too'), L('המחשב והמיקרופון יחד', 'Computer and microphone together')]]
          .map(([v, e, t, d], i) => `<label class="source pop" style="--i:${i}"><input type="radio" name="source" value="${v}"${i ? '' : ' checked'}><span class="ico">${e}</span><b>${t}</b><small>${d}</small></label>`).join('')}
      </fieldset>
      <p class="note">${L("💛 חשוב: ספרי למשתתפים ולמרצה שאת מקליטה ומתמללת. ההקלטה נשמרת רק במחשב שלך.", "💛 Important: tell the participants and the lecturer that you are recording. The recording stays on your computer.")}</p>
      <button class="btn lilac" id="go">${L("🎧 התחילי להקשיב", "🎧 Start listening")}</button>
    </div>
  </section>`;
  try { const p = JSON.parse(localStorage.getItem('kashuv-live-prefs') || '{}'); if (p.name) $('#name').value = p.name; if (p.lang != null) $('#lang').value = p.lang; if (p.source) { const r = main.querySelector(`[name=source][value=${p.source}]`); if (r) r.checked = true; } } catch (e) {}
  $('#go').addEventListener('click', async () => {
    const body = { title: $('#title').value, name: $('#name').value, lang: $('#lang').value, source: main.querySelector('[name=source]:checked').value };
    try { localStorage.setItem('kashuv-live-prefs', JSON.stringify({ name: body.name, lang: body.lang, source: body.source })); } catch (e) {}
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
    <span class="muted" id="lstatus">${L('מתחברת לשמע','Connecting to audio')}<span class="dots"></span></span>
    <div class="live-tools">
      <button class="btn soft small" data-missed="2">${L("🙈 מה פספסתי? 2 דק'", "🙈 What did I miss? 2 min")}</button>
      <button class="btn soft small" data-missed="5">${L("5 דק'",'5 min')}</button>
      <button class="btn soft small" data-missed="10">${L("10 דק'",'10 min')}</button>
      <button class="btn soft small" id="mark">${L('⭐ רגע חשוב','⭐ Important moment')}</button>
      <button class="btn soft small" id="focus" aria-pressed="false">${L('🎯 מצב ריכוז','🎯 Focus mode')}</button>
      <button class="btn peach small" id="stop">${L("⏹ סיימי וסכמי", "⏹ Stop & summarize")}</button>
    </div>
  </div>
  <p class="muted keys no-print">⌨️ ${L('קיצורים: M רגע חשוב · F מצב ריכוז · 1 / 2 / 3 מה פספסתי · נשמר אוטומטית כל כמה שניות', 'Shortcuts: M important moment · F focus mode · 1 / 2 / 3 what did I miss · auto-saved every few seconds')}</p>
  <div id="lerr"></div>
  <div class="live-grid">
    <section class="card stream-card"><h2 style="font-size:1.2rem;margin-bottom:10px">${L("📝 תמלול חי", "📝 Live transcript")}</h2>
      <div class="stream" id="stream" aria-live="polite"><p class="muted" id="wait">${L("מחכה שמישהו ידבר. בפעם הראשונה מודל התמלול נטען וזה לוקח כמה דקות.", "Waiting for someone to speak. The first time, the speech model loads and this takes a few minutes.")}</p></div></section>
    <aside class="side">
      <div class="card now"><h3>${L('עכשיו מדברים על','Talking about now')}</h3><p id="now">${L("עוד רגע יופיע כאן 🙂", "Coming up in a moment 🙂")}</p>
        <button class="btn soft small" id="refresh" style="margin-top:12px">${L("✨ רענני סיכום עכשיו", "✨ Refresh summary now")}</button></div>
      <div class="card" id="missed-card" hidden><h3>${L('🙈 מה פספסת','🙈 What you missed')}</h3><p class="missed-box" id="missed"></p></div>
      <div class="card"><h3>${L("✦ הנקודות החשובות", "✦ Key points")}</h3><ul class="ticks" id="points"><li class="muted">${L("יתמלא תוך כמה דקות", "Fills up within a few minutes")}</li></ul></div>
      <div class="card"><h3>${L('❓ שאלות ומשימות','❓ Questions and tasks')}</h3><ul class="ticks" id="qs"></ul></div>
      <div class="card" id="alerts-card" hidden><h3>${L("📣 הזכירו אותך", "📣 You were mentioned")}</h3><ul class="ticks" id="alerts"></ul></div>
      <div class="card" id="marks-card" hidden><h3>${L('⭐ רגעים חשובים','⭐ Important moments')}</h3><ul class="ticks" id="marks"></ul></div>
    </aside>
  </div>`;

  let since = 0, alive = true, seenAlerts = 0, timerId;
  const keys = (e) => {
    if (e.target.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const btn = k === 'm' || k === 'צ' ? '#mark' : k === 'f' || k === 'כ' ? '#focus' : { 1: '[data-missed="2"]', 2: '[data-missed="5"]', 3: '[data-missed="10"]' }[k];
    if (btn && $(btn)) { e.preventDefault(); $(btn).click(); }
  };
  addEventListener('keydown', keys);
  cleanup = () => { alive = false; clearTimeout(timerId); document.title = 'Kashuv'; removeEventListener('keydown', keys); };
  const list = (el, arr, render = esc) => { const h = arr.length ? arr.map((x) => `<li>${render(x)}</li>`).join('') : ''; if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; } };

  const poll = async () => {
    if (!alive) return;
    let s;
    try { s = await api(`/api/live/${id}?since=${since}`); }
    catch (e) { store.set('kashuv-live', null); toast(L('הפגישה החיה הסתיימה','The live session ended')); location.hash = '#/'; return; }
    $('#timer').textContent = fmt(s.elapsed);
    $('#orb').classList.toggle('idle', s.status !== 'listening');
    $('#lstatus').innerHTML = s.status === 'listening' ? (s.rolling ? L('מעדכנת סיכום','Updating summary') + '<span class="dots"></span>' : L('מקשיבה','Listening')) : s.status === 'error' ? L('שגיאה','Error') : L('מתחברת לשמע','Connecting to audio') + '<span class="dots"></span>';
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
      toast(`${L("📣 הזכירו אותך", "📣 You were mentioned")}: "${a.text}"`, 'alert'); beep();
      $('.now').classList.add('flash'); setTimeout(() => $('.now')?.classList.remove('flash'), 3000);
      document.title = L('📣 קוראים לך! Kashuv','📣 You are called! Kashuv');
    }
    $('#alerts-card').hidden = !s.alerts.length; list($('#alerts'), s.alerts, (a) => `<b>${fmt(a.t)}</b> ${esc(a.text)}`);
    $('#marks-card').hidden = !s.marks.length; list($('#marks'), s.marks, (m) => `<b>${fmt(m.t)}</b> ${esc(m.note || L('רגע חשוב','Important moment'))}`);
    timerId = setTimeout(poll, 1500);
  };
  poll();
  addEventListener('focus', () => { document.title = 'Kashuv'; }, { once: true });

  main.querySelectorAll('[data-missed]').forEach((b) => b.addEventListener('click', async () => {
    $('#missed-card').hidden = false; $('#missed').innerHTML = L('מסכמת','Summarizing') + '<span class="dots"></span>';
    try { $('#missed').textContent = (await api(`/api/live/${id}/missed`, { method: 'POST', body: { minutes: +b.dataset.missed } })).text; }
    catch (e) { $('#missed').textContent = e.message; }
  }));
  $('#mark').addEventListener('click', async () => {
    const note = prompt(L('מה חשוב פה? (אפשר להשאיר ריק)','What matters here? (optional)')) ?? '';
    await api(`/api/live/${id}/mark`, { method: 'POST', body: { note } }); toast(L('⭐ סימנתי את הרגע','⭐ Moment marked'));
  });
  $('#refresh').addEventListener('click', () => { api(`/api/live/${id}/refresh`, { method: 'POST' }); toast(L('✨ מעדכנת את הסיכום','✨ Updating the summary')); });
  $('#focus').addEventListener('click', (e) => {
    const on = document.body.classList.toggle('focus'); e.currentTarget.setAttribute('aria-pressed', String(on));
    toast(on ? L('🎯 מצב ריכוז: רק מה שחשוב','🎯 Focus mode: only what matters') : L('חזרנו לתצוגה המלאה','Back to the full view'));
  });
  $('#stop').addEventListener('click', async () => {
    if (!confirm(L('לסיים את ההקלטה ולבנות סיכום מלא?','Stop recording and build a full summary?'))) return;
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
    ['sum', L('📒 סיכום','📒 Summary')], has(m.concepts) && ['con', L('💡 מושגים','💡 Concepts')], (has(m.tasks) || has(m.questions)) && ['todo', L('✅ משימות ושאלות','✅ Tasks & questions')],
    has(m.quiz) && ['quiz', L('🧠 תרגול','🧠 Practice')], (has(m.timeline) || has(s.marks)) && ['tl', L('🕒 ציר זמן','🕒 Timeline')], ['tr', L('📝 תמלול','📝 Transcript')], ['ask', L('💬 שאלי את ההקלטה','💬 Ask the recording')],
  ].filter(Boolean);
  const titleOf = Object.fromEntries(tabs);

  main.innerHTML = `
  <section class="card sum-hero pop">
    <span class="emo" aria-hidden="true">${esc(m.emoji || '📝')}</span>
    <h1 id="title">${esc(m.title || s.name)} <button class="icon-btn rename no-print" id="rename" type="button" aria-label="${L('שינוי שם', 'Rename')}">✏️</button></h1>
    <div class="meta">
      <span class="chip">${kindLabel(s)}</span>
      <span class="chip" style="--c:var(--peach-deep);--c-soft:var(--peach-soft)">⏱ ${fmt(s.duration)}</span>
      <span class="chip" style="--c:var(--mint);--c-soft:var(--mint-soft)">📅 ${dateHe(s.created)}</span>
    </div>
    ${m.tldr ? `<p class="tldr">${esc(m.tldr)}</p>` : `<p class="note warn">${L("⚠️ עוד אין סיכום להקלטה הזאת (כנראה Ollama לא פעל). התמלול שמור, אפשר לנסות שוב.", "⚠️ No summary yet for this recording (Ollama was probably off). The transcript is saved, you can try again.")}</p>`}
    ${has(m.keywords) ? `<div class="chips">${m.keywords.map((k) => `<span class="chip" style="--c:var(--butter);--c-soft:var(--butter-soft)"># ${esc(k)}</span>`).join('')}</div>` : ''}
    <div class="actions">
      <button class="btn small" id="pdf">🖨️ PDF</button>
      <button class="btn soft small" id="md">⬇️ Markdown</button>
      <button class="btn soft small" id="copy">${L("📋 העתקה", "📋 Copy")}</button>
      <button class="btn soft small" id="again">${L("✨ סיכום מחדש", "✨ Summarize again")}</button>
      <button class="btn danger small" id="del">${L("🗑 מחיקה", "🗑 Delete")}</button>
    </div>
  </section>
  ${s.audio ? `<div class="card player"><span aria-hidden="true">🎵</span><audio id="audio" controls preload="metadata" src="/media/${esc(s.audio)}"></audio></div>` : ''}
  <div class="tabs" role="tablist" aria-label="${L('חלקי הסיכום','Summary sections')}">
    ${tabs.map(([k, t], i) => `<button role="tab" id="t-${k}" aria-controls="p-${k}" aria-selected="${i === 0}">${t}</button>`).join('')}
  </div>

  <section class="panel" id="p-sum" role="tabpanel" data-title="${L('סיכום','Summary')}">
    ${has(m.exam_tips) ? `<div class="card tips pop"><h3>${L('🎯 מה חשוב למבחן','🎯 What matters for the exam')}</h3><ul class="ticks">${m.exam_tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
    <div class="secs">${(m.sections || []).map((x, i) => `
      <article class="card sec pop" style="--i:${i}"><h3><span>${esc(x.emoji || '✦')}</span>${esc(x.title)}</h3>
      <ul>${(x.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('')}</ul></article>`).join('') || `<p class="muted">${L('אין עדיין חלקים בסיכום.','No sections yet.')}</p>`}</div>
  </section>
  ${has(m.concepts) ? `<section class="panel" id="p-con" role="tabpanel" data-title="${L('מושגים','Concepts')}" hidden><div class="concepts">${m.concepts.map((c, i) => `
    <div class="card concept pop" style="--i:${i}"><b>${esc(c.term)}</b>${esc(c.explain)}</div>`).join('')}</div></section>` : ''}
  ${titleOf.todo ? `<section class="panel" id="p-todo" role="tabpanel" data-title="${L('משימות ושאלות','Tasks and questions')}" hidden><div class="two">
    <div class="card pop"><h3>${L('✅ משימות','✅ Tasks')}</h3><ul class="todo">${(m.tasks || []).map((t, i) => `<li><label><input type="checkbox" data-todo="${i}"><span>${esc(t)}</span></label></li>`).join('') || `<li class="muted">${L('לא הוזכרו משימות','No tasks were mentioned')}</li>`}</ul></div>
    <div class="card pop" style="--i:1"><h3>${L("❓ שאלות שעלו", "❓ Questions raised")}</h3><ul class="ticks">${(m.questions || []).map((q) => `<li>${esc(q)}</li>`).join('') || `<li class="muted">${L('לא עלו שאלות','No questions came up')}</li>`}</ul></div>
  </div></section>` : ''}
  ${has(m.quiz) ? `<section class="panel" id="p-quiz" role="tabpanel" data-title="${L('תרגול','Practice')}" hidden><p class="muted no-print">${L("לחצי על כרטיס כדי לראות את התשובה.", "Click a card to see the answer.")}</p><div class="cards">${m.quiz.map((q, i) => `
    <button class="flip pop" style="--i:${i}" aria-label="${L('שאלה','Question')} ${i + 1}"><div class="in"><div class="f"><small>${L('שאלה','Question')} ${i + 1}</small>${esc(q.q)}</div><div class="b"><small>${L('תשובה','Answer')}</small>${esc(q.a)}</div></div></button>`).join('')}</div></section>` : ''}
  ${titleOf.tl ? `<section class="panel" id="p-tl" role="tabpanel" data-title="${L('ציר זמן','Timeline')}" hidden><div class="card"><ol class="tl">
    ${[...(m.timeline || []).map((t) => ({ sec: toSec(t.time), title: t.title, star: false })), ...(s.marks || []).map((k) => ({ sec: k.t, title: k.note || L('רגע חשוב','Important moment'), star: true }))]
      .sort((a, b) => a.sec - b.sec).map((t) => `<li><button data-seek="${t.sec}">${fmt(t.sec)}</button><span>${t.star ? '⭐ ' : ''}${esc(t.title)}</span></li>`).join('')}
  </ol></div></section>` : ''}
  <section class="panel" id="p-tr" role="tabpanel" data-title="${L('תמלול מלא','Full transcript')}" hidden><div class="card">
    <input class="search no-print" id="find" type="search" placeholder="${L('חיפוש בתמלול','Search the transcript')}" aria-label="${L('חיפוש בתמלול','Search the transcript')}" style="margin-bottom:12px">
    <div class="transcript" id="tr"></div></div></section>
  <section class="panel no-print" id="p-ask" role="tabpanel" data-title="${L('שאלות','Questions')}" hidden><div class="card chat">
    <div class="chat" id="chat"><div class="bubble ai">${L("היי! אפשר לשאול אותי כל דבר על ההקלטה, למשל \"מה המרצה אמר על המבחן?\" 🙂", "Hi! Ask me anything about this recording, like \"what did the lecturer say about the exam?\" 🙂")}</div></div>
    <form class="ask-row" id="askf"><input id="askq" placeholder="${L('השאלה שלך','Your question')}" aria-label="${L('השאלה שלך','Your question')}" required><button class="btn lilac">${L('שלחי','Send')}</button></form>
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
      || `<p class="muted">${L('לא נמצא','Not found')}</p>`;
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
    $('#chat').insertAdjacentHTML('beforeend', `<div class="bubble me">${esc(q)}</div><div class="bubble ai" id="pending">${L('חושבת','Thinking')}<span class="dots"></span></div>`);
    try { $('#pending').textContent = (await api(`/api/sessions/${id}/ask`, { method: 'POST', body: { q } })).answer; }
    catch (err) { $('#pending').textContent = err.message; }
    $('#pending').removeAttribute('id');
  });

  // export
  const markdown = () => [
    `# ${m.emoji || ''} ${m.title || s.name}`, '', m.tldr || '', '',
    ...(m.exam_tips || []).length ? [L("## 🎯 מה חשוב למבחן", "## 🎯 What matters for the exam"), ...m.exam_tips.map((t) => '- ' + t), ''] : [],
    ...(m.sections || []).flatMap((x) => [`## ${x.emoji || ''} ${x.title}`, ...(x.bullets || []).map((b) => '- ' + b), '']),
    ...has(m.concepts) ? [L("## 💡 מושגים", "## 💡 Concepts"), ...m.concepts.map((c) => `- **${c.term}**: ${c.explain}`), ''] : [],
    ...has(m.tasks) ? [L("## ✅ משימות", "## ✅ Tasks"), ...m.tasks.map((t) => '- [ ] ' + t), ''] : [],
    ...has(m.questions) ? [L("## ❓ שאלות", "## ❓ Questions"), ...m.questions.map((t) => '- ' + t), ''] : [],
    ...has(m.quiz) ? [L("## 🧠 תרגול", "## 🧠 Practice"), ...m.quiz.flatMap((q, i) => [`${i + 1}. ${q.q}`, `   > ${q.a}`]), ''] : [],
    L("## 📝 תמלול", "## 📝 Transcript"), ...segs.map((g) => `[${fmt(g.start)}] ${g.text}`),
  ].join('\n');
  $('#pdf').addEventListener('click', () => print());
  $('#md').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([markdown()], { type: 'text/markdown' }));
    a.download = (m.title || s.name || 'kashuv') + '.md'; a.click(); URL.revokeObjectURL(a.href);
  });
  $('#copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(markdown()); toast(L('📋 הועתק','📋 Copied')); } catch (e) { toast(L('לא הצלחתי להעתיק','Could not copy')); } });
  $('#rename').addEventListener('click', async () => {
    const t = prompt(L('שם חדש לסיכום:', 'New name for this summary:'), m.title || s.name);
    if (!t || !t.trim()) return;
    try { await api(`/api/sessions/${id}/rename`, { method: 'POST', body: { title: t.trim() } }); toast(L('✏️ השם עודכן', '✏️ Renamed')); route(); } catch (e) { toast(e.message); }
  });
  $('#again').addEventListener('click', async () => { const j = await api(`/api/sessions/${id}/resummarize`, { method: 'POST' }); watchJob(j.job, id); });
  $('#del').addEventListener('click', async () => {
    if (!confirm(L('למחוק את הסיכום וההקלטה לגמרי?','Delete this summary and recording for good?'))) return;
    await api('/api/sessions/' + id, { method: 'DELETE' }); toast(L('נמחק','Deleted')); location.hash = '#/library';
  });
}

/* ---------- accessibility statement ---------- */
function a11yView() {
  const items = L(
    ['ניווט מלא במקלדת עם סימון פוקוס ברור, וקישור "דילוג לתוכן"', 'תפריט נגישות שאפשר לגרור לכל מקום במסך (או להזיז עם החצים): גודל טקסט, ניגודיות גבוהה, עצירת אנימציות, הדגשת קישורים וגופן פשוט', 'מצב כהה ובהיר, ותמיכה בהגדרת "הפחתת תנועה" של המערכת', 'תוויות לקוראי מסך, הודעות חיות (aria-live) ומבנה כותרות מסודר', 'ניגודיות צבעים שנבדקה, עברית מימין לשמאל ואנגלית משמאל לימין', 'התאמה למסכים קטנים ולהגדלה עד 150%'],
    ['Full keyboard navigation with a clear focus ring and a "skip to content" link', 'An accessibility menu you can drag anywhere (or move with the arrow keys): text size, high contrast, stop animations, highlight links and a simple font', 'Dark and light mode, and respect for the system "reduce motion" setting', 'Screen reader labels, live regions (aria-live) and a clean heading structure', 'Checked color contrast, Hebrew right to left and English left to right', 'Works on small screens and with zoom up to 150%']);
  main.innerHTML = `<section class="card pop" style="max-width:820px;margin:0 auto">
    <h1 style="margin-bottom:12px">♿ ${L('הצהרת נגישות', 'Accessibility statement')}</h1>
    <p>${L('Kashuv נבנתה כדי שכל אחד ואחת יוכלו להשתמש בה בנוחות, בהתאם להנחיות WCAG 2.1 ברמה AA ולתקן הישראלי 5568.', 'Kashuv is built so everyone can use it comfortably, following WCAG 2.1 level AA and the Israeli standard IS 5568.')}</p>
    <ul class="ticks">${items.map((t) => `<li>${t}</li>`).join('')}</ul>
    <p class="muted" style="margin-top:18px">${L('מצאת בעיה? אשמח לשמוע:', 'Found a problem? I would love to hear:')} <a href="https://www.linkedin.com/in/noya-adivi" target="_blank" rel="noopener noreferrer">LinkedIn</a></p>
  </section>`;
}

$('#lang-btn').addEventListener('click', () => {
  LANG = LANG === 'en' ? 'he' : 'en';
  try { localStorage.setItem('kashuv-lang', LANG); } catch (e) {}
  applyLang(); route();
});
applyLang();
route();
