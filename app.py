"""Kashuv: free, local Zoom transcription, live focus helpers and beautiful summaries."""
import threading
import time
import uuid
import webbrowser
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory, render_template, abort
from werkzeug.utils import secure_filename

from kashuv import config, storage, summarize, transcribe
from kashuv.live import Live

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 4 * 1024 ** 3  # 4 GB recordings
jobs, lives = {}, {}
MEDIA_TYPES = {".mp4", ".m4a", ".mp3", ".wav", ".webm", ".mkv", ".mov", ".ogg", ".aac", ".flac"}


def run_job(job_id, work):
    job = jobs[job_id]

    def target():
        try:
            work(job)
            job["status"] = "done"
        except Exception as e:
            job.update(status="error", error=str(e))
    threading.Thread(target=target, daemon=True).start()


def body():
    """The JSON body of a request, or {} when it is missing or broken."""
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def new_job():
    jid = uuid.uuid4().hex[:10]
    jobs[jid] = {"id": jid, "status": "queued", "step": "", "progress": 0.0}
    return jid


def finish(job, session):
    """Summarize a session that already has segments, then save it."""
    job.update(status="summarizing", step="כותבת סיכום מטורף", progress=0.0)
    session.pop("partial", None)
    storage.save(session)
    session["summary"] = summarize.summarize(session["segments"], lambda p: job.update(progress=p), session.get("lang", "he"))
    storage.save(session)
    job["session"] = session["id"]


@app.errorhandler(ValueError)
def bad_request(e):
    return jsonify(error="not found"), 404


@app.get("/sw.js")
def service_worker():
    """Served from the root so the installed app works on every page."""
    res = send_from_directory(config.ROOT, "sw.js", mimetype="application/javascript")
    res.headers["Cache-Control"] = "no-cache"
    return res


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/health")
def health():
    return jsonify(ollama=summarize.ollama_ok(), whisper=config.WHISPER_MODEL, loaded=transcribe.is_loaded())


@app.post("/api/upload")
def upload():
    f = request.files.get("file")
    if not f or Path(f.filename).suffix.lower() not in MEDIA_TYPES:
        return jsonify(error="צריך קובץ אודיו או וידאו (mp4, m4a, mp3, wav...)"), 400
    sid = storage.new_id()
    name = f"{sid}{Path(f.filename).suffix.lower()}"
    f.save(config.MEDIA / name)
    lang = request.form.get("lang", "he")
    session = {"id": sid, "kind": "file", "name": Path(secure_filename(f.filename) or f.filename).stem or "הקלטה",
               "created": time.time(), "audio": name, "lang": lang, "segments": [], "marks": []}
    jid = new_job()

    def work(job):
        job.update(status="loading", step="מכינה את מודל התמלול (בפעם הראשונה זה לוקח כמה דקות)")
        transcribe.get_model()
        job.update(status="transcribing", step="מתמללת")
        session["segments"], session["duration"] = transcribe.transcribe_file(
            config.MEDIA / name, lang, lambda p: job.update(progress=p))
        finish(job, session)
    run_job(jid, work)
    return jsonify(job=jid, session=sid)


@app.get("/api/jobs/<jid>")
def job_state(jid):
    return jsonify(jobs.get(jid) or {"status": "missing"})


@app.get("/api/sessions")
def sessions():
    return jsonify(storage.list_all())


@app.get("/api/sessions/<sid>")
def session(sid):
    s = storage.load(sid)
    return jsonify(s) if s else (jsonify(error="not found"), 404)


@app.delete("/api/sessions/<sid>")
def delete_session(sid):
    storage.delete(sid)
    return jsonify(ok=True)


@app.post("/api/sessions/<sid>/resummarize")
def resummarize(sid):
    s = storage.load(sid) or abort(404)
    jid = new_job()
    run_job(jid, lambda job: finish(job, s))
    return jsonify(job=jid)


@app.post("/api/sessions/<sid>/rename")
def rename(sid):
    s = storage.load(sid) or abort(404)
    title = body().get("title", "").strip()[:120]
    if not title:
        return jsonify(error="empty"), 400
    s["name"] = title
    if s.get("summary"):
        s["summary"]["title"] = title
    storage.save(s)
    return jsonify(ok=True)


@app.post("/api/sessions/<sid>/ask")
def ask(sid):
    s = storage.load(sid) or abort(404)
    q = body().get("q", "").strip()
    if not q:
        return jsonify(error="empty"), 400
    try:
        return jsonify(answer=summarize.ask(s["segments"], q, s.get("lang", "he")))
    except Exception as e:
        return jsonify(error=f"Ollama לא זמין: {e}"), 503


@app.post("/api/live/start")
def live_start():
    data = body()
    sid = storage.new_id()
    lives[sid] = Live(sid, data.get("lang", "he"), data.get("name", ""), data.get("source", "computer"),
                      (data.get("title") or "").strip())
    threading.Thread(target=transcribe.get_model, daemon=True).start()
    return jsonify(id=sid)


@app.get("/api/live/<sid>")
def live_state(sid):
    lv = lives.get(sid) or abort(404)
    return jsonify(lv.state(int(request.args.get("since", 0))))


@app.post("/api/live/<sid>/missed")
def live_missed(sid):
    lv = lives.get(sid) or abort(404)
    try:
        minutes = max(1, min(int(body().get("minutes", 3)), 60))
    except (TypeError, ValueError):
        minutes = 3
    text = lv.recent_text(minutes)
    if not text.strip():
        return jsonify(text="עוד לא נאמר כלום בדקות האלה 🙂")
    try:
        return jsonify(text=summarize.missed(text, minutes, lv.lang))
    except Exception as e:
        return jsonify(error=f"Ollama לא זמין: {e}"), 503


@app.post("/api/live/<sid>/mark")
def live_mark(sid):
    lv = lives.get(sid) or abort(404)
    lv.marks.append({"t": round(lv.elapsed()), "note": body().get("note", "")})
    return jsonify(marks=lv.marks)


@app.post("/api/live/<sid>/refresh")
def live_refresh(sid):
    lv = lives.get(sid) or abort(404)
    lv.roll()
    return jsonify(ok=True)


@app.post("/api/live/<sid>/stop")
def live_stop(sid):
    lv = lives.pop(sid, None) or abort(404)
    jid = new_job()

    def work(job):
        job.update(status="transcribing", step="מסיימת לתמלל את השניות האחרונות")
        data = lv.stop()
        session = {"id": sid, "kind": "live", "name": lv.title or time.strftime(("Class " if lv.source == "class" else "Zoom ") + "%d.%m %H:%M"),
                   "created": lv.started, "lang": lv.lang, **data}
        finish(job, session)
    run_job(jid, work)
    return jsonify(job=jid)


@app.get("/media/<path:name>")
def media(name):
    return send_from_directory(config.MEDIA, name, conditional=True)


def warm_up():
    try:
        transcribe.get_model()
    except Exception as e:
        print(f"  Speech model will load on first use ({e})")


if __name__ == "__main__":
    url = f"http://localhost:{config.PORT}"
    print(f"\n  Kashuv is running at {url}\n")
    threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    threading.Thread(target=warm_up, daemon=True).start()  # warm up so the first lecture starts fast
    app.run(port=config.PORT, threaded=True)
