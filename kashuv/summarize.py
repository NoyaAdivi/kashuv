"""Summaries with a local LLM through Ollama. Long meetings are summarized in parts and then merged."""
import json
import re
import threading
import requests
from . import config

CHUNK_CHARS = 6000
MERGE_CHARS = 30000  # notes longer than this are merged in rounds, so nothing from a long lecture is lost
CTX = 16384  # tokens the model can read at once (enough for a full lecture's notes)

# Download state of the summary model, shown on the home page and in the progress screen.
pull_state = {"pulling": False, "progress": 0.0, "error": ""}
_pull_lock = threading.Lock()


class OllamaMissing(RuntimeError):
    pass


def _installed_models():
    r = requests.get(f"{config.OLLAMA_URL}/api/tags", timeout=3)
    return [m.get("name", "") for m in r.json().get("models", [])]


def ensure_model(on_progress=None):
    """Makes sure Ollama runs and the summary model is installed, and downloads it once if it is missing."""
    try:
        names = _installed_models()
    except Exception:
        raise OllamaMissing("Ollama לא מותקן או לא פועל. כדי לקבל סיכומים התקיני אותו מ-ollama.com (חינם) ופתחי את Kashuv מחדש. "
                            "Ollama is not installed or not running: get it free at ollama.com.")
    if any(n.startswith(config.OLLAMA_MODEL) for n in names):
        return
    with _pull_lock:  # one download at a time; a second caller simply waits for it
        if any(n.startswith(config.OLLAMA_MODEL) for n in _installed_models()):
            return
        pull_state.update(pulling=True, progress=0.0, error="")
        try:
            with requests.post(f"{config.OLLAMA_URL}/api/pull", json={"model": config.OLLAMA_MODEL, "stream": True},
                               stream=True, timeout=(10, 600)) as r:
                r.raise_for_status()
                for line in r.iter_lines():
                    if not line:
                        continue
                    msg = json.loads(line)
                    if msg.get("error"):
                        raise RuntimeError(msg["error"])
                    if msg.get("total") and msg.get("completed") is not None:
                        pull_state["progress"] = msg["completed"] / msg["total"]
                        if on_progress:
                            on_progress(pull_state["progress"])
        except Exception as e:
            pull_state["error"] = str(e)
            raise RuntimeError(f"לא הצלחתי להוריד את מודל הסיכומים ({e}). בדקי את האינטרנט ונסי שוב.")
        finally:
            pull_state["pulling"] = False


def ensure_model_background():
    """Called when the app starts: downloads the summary model ahead of time, without blocking anything."""
    def run():
        try:
            ensure_model()
        except Exception:
            pass
    threading.Thread(target=run, daemon=True).start()

STYLE = ("את עוזרת סיכומים מעולה לסטודנטים. כתבי בעברית תקנית, ברורה ומדויקת, בלי להמציא מידע שלא נאמר. "
         "אם ההרצאה באנגלית, סכמי בעברית והשאירי מונחים מקצועיים גם באנגלית בסוגריים. "
         "לעולם אל תשתמשי בקו מפריד ארוך. החזירי JSON תקין בלבד.")

STYLE_EN = ("You are an excellent note taker for students. Write in clear, accurate English and never invent anything "
            "that was not said. Never use long dashes. Return valid JSON only.")
EN_TAIL = "\n\nWrite every value in English only."


def style(lang):
    return STYLE_EN if lang == "en" else STYLE


def tail(lang):
    return EN_TAIL if lang == "en" else ""


NOTES_SCHEMA = """{"points": ["נקודה חשובה"], "concepts": [{"term": "מונח", "explain": "הסבר קצר"}],
"tasks": ["משימה או מטלה שהוזכרה"], "questions": ["שאלה שעלתה"], "topics": [{"time": "12:30", "title": "נושא"}]}"""

FINAL_SCHEMA = """{"title": "כותרת קצרה ומדויקת", "emoji": "אימוג'י אחד שמתאים לנושא",
"tldr": "שניים עד שלושה משפטים שמסכמים את הכל",
"sections": [{"title": "שם החלק", "emoji": "אימוג'י", "bullets": ["נקודה", "נקודה"]}],
"concepts": [{"term": "מונח", "explain": "הסבר ברור"}],
"tasks": ["משימה, מטלה, תאריך הגשה"], "questions": ["שאלה פתוחה שעלתה"],
"quiz": [{"q": "שאלת תרגול", "a": "תשובה"}], "timeline": [{"time": "00:00", "title": "נושא"}],
"keywords": ["מילת מפתח"], "exam_tips": ["מה המרצה הדגיש שחשוב למבחן"]}"""


def ollama_ok():
    try:
        r = requests.get(f"{config.OLLAMA_URL}/api/tags", timeout=2)
        names = [m.get("name", "") for m in r.json().get("models", [])]
        return {"running": True, "model": any(n.startswith(config.OLLAMA_MODEL) for n in names), "name": config.OLLAMA_MODEL,
                "pulling": pull_state["pulling"], "progress": round(pull_state["progress"], 3)}
    except Exception:
        return {"running": False, "model": False, "name": config.OLLAMA_MODEL, "pulling": False, "progress": 0}


def chat(system, user, json_mode=True, timeout=900, on_tokens=None, ctx=CTX, max_tokens=None):
    """Asks the local model. on_tokens(n) is called while the answer is being written, so the page can show progress."""
    body = {"model": config.OLLAMA_MODEL, "stream": bool(on_tokens), "keep_alive": "30m",
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "options": {"temperature": 0.3, "num_ctx": ctx}}
    if max_tokens:
        body["options"]["num_predict"] = max_tokens
    if json_mode:
        body["format"] = "json"
    if on_tokens:
        parts, blank = [], 0
        with requests.post(f"{config.OLLAMA_URL}/api/chat", json=body, stream=True, timeout=(10, timeout)) as r:
            r.raise_for_status()
            for line in r.iter_lines():
                if not line:
                    continue
                msg = json.loads(line)
                piece = msg.get("message", {}).get("content", "")
                parts.append(piece)
                on_tokens(len(parts))
                blank = blank + 1 if not piece.strip() else 0
                if msg.get("done") or blank > 60:  # small models sometimes pad JSON with endless spaces: stop there
                    break
        text = "".join(parts)
    else:
        r = requests.post(f"{config.OLLAMA_URL}/api/chat", json=body, timeout=timeout)
        r.raise_for_status()
        text = r.json()["message"]["content"]
    return parse_json(text) if json_mode else text.strip()


def parse_json(text):
    try:
        return json.loads(text)
    except ValueError:
        m = re.search(r"\{.*\}", text, re.S)
        if m:
            try:
                return json.loads(m.group(0))
            except ValueError:
                pass
    return {}


def fmt_time(sec):
    sec = int(sec or 0)
    h, m, s = sec // 3600, sec % 3600 // 60, sec % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def transcript_text(segments):
    return "\n".join(f"[{fmt_time(s['start'])}] {s['text']}" for s in segments)


def _chunks(text):
    lines, buf, size = text.split("\n"), [], 0
    for line in lines:
        if size + len(line) > CHUNK_CHARS and buf:
            yield "\n".join(buf)
            buf, size = [], 0
        buf.append(line)
        size += len(line) + 1
    if buf:
        yield "\n".join(buf)


def _merge_notes(notes, lang):
    """Merges a long list of part notes in rounds until they fit in one request."""
    while len(json.dumps(notes, ensure_ascii=False)) > MERGE_CHARS and len(notes) > 1:
        merged = []
        for i in range(0, len(notes), 4):
            group = notes[i:i + 4]
            if len(group) == 1:
                merged.append(group[0])
                continue
            merged.append(chat(style(lang), "אחדי את ההערות של כמה חלקים רצופים מהרצאה להערות אחת באותו מבנה. "
                                            "שמרי כל נקודה חשובה, מושג, משימה, תאריך וזמן, ואל תכפילי.\n"
                                            f"המבנה:\n{NOTES_SCHEMA}\n\nההערות:\n{json.dumps(group, ensure_ascii=False)}{tail(lang)}"))
        notes = merged
    return notes


CORE_SCHEMA = """{"title": "כותרת קצרה ומדויקת לנושא ההרצאה", "emoji": "אימוג'י אחד שמתאים לנושא",
"tldr": "שלושה עד ארבעה משפטים שמסכמים את כל ההרצאה",
"keywords": ["4 עד 8 מילות מפתח"],
"sections": [{"title": "שם החלק", "emoji": "אימוג'י", "bullets": ["משפט מלא וברור", "משפט מלא וברור", "משפט מלא וברור"]}]}"""

STUDY_SCHEMA = """{"concepts": [{"term": "מונח", "explain": "הסבר של משפט או שניים"}],
"quiz": [{"q": "שאלת תרגול", "a": "תשובה מלאה"}]}"""

ACTION_SCHEMA = """{"tasks": ["רק מטלות, הגשות ותאריכים שהמרצה אמר במפורש"],
"exam_tips": ["רק מה שהמרצה אמר במפורש שחשוב או שיהיה במבחן"],
"questions": ["שאלות שהסטודנטים או המרצה שאלו בשיעור"],
"timeline": [{"time": "mm:ss מתוך התמלול", "title": "הנושא שהתחיל בזמן הזה"}]}"""

CORE_RULES = ("כתבי את החלק המרכזי של סיכום מעולה, ברמה של הסטודנט הכי טוב בכיתה, כזה שאפשר ללמוד ממנו בלי לשמוע את ההרצאה. "
              "חובה: בין 4 ל-8 חלקים לפי סדר ההרצאה, ובכל חלק בין 3 ל-6 נקודות. כל נקודה היא משפט שלם שמסביר רעיון, דוגמה או נימוק, לא רק שם של נושא. "
              "אל תחזרי על אותו רעיון בשני חלקים.")
STUDY_RULES = ("בני חומר לימוד מתוך ההרצאה. חובה: בין 4 ל-10 מושגים, וכל הסבר מובן למי שלא היה בשיעור. "
               "חובה: בין 5 ל-8 שאלות תרגול שבודקות הבנה (למה, איך, מה ההבדל), כל אחת עם תשובה מלאה של משפט או שניים.")
ACTION_RULES = ("חלצי מהתמלול רק מה שנאמר בו באמת. אסור להמציא. "
                "משימות וטיפים למבחן: רק אם נאמרו במפורש בתמלול, אחרת החזירי רשימה ריקה []. "
                "ציר זמן: בין 3 ל-10 נקודות, והזמן חייב להיות מועתק בדיוק מאחד הזמנים בסוגריים המרובעים שבתמלול.")


def _time_ok(t, max_sec):
    m = re.fullmatch(r"(?:(\d+):)?(\d{1,2}):(\d{2})", str(t).strip())
    if not m:
        return False
    sec = int(m.group(1) or 0) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
    return sec <= max_sec + 30


def summarize(segments, on_progress=None, lang="he"):
    text = transcript_text(segments)
    if not text.strip():
        return {"title": "לא זוהה דיבור", "emoji": "🤫", "tldr": "לא נמצא דיבור בהקלטה.", "sections": []}
    parts = list(_chunks(text))
    if len(parts) == 1:
        source = "תמלול מלא (הזמנים בסוגריים המרובעים):\n" + text
    else:
        notes = []
        for i, part in enumerate(parts):
            n = chat(style(lang), f"זה חלק {i + 1} מתוך {len(parts)} של תמלול. הוציאי ממנו הערות מפורטות במבנה:\n{NOTES_SCHEMA}\n\nתמלול:\n{part}{tail(lang)}")
            notes.append(n)
            if on_progress:
                on_progress(0.5 * (i + 1) / len(parts))
        notes = _merge_notes(notes, lang)
        source = "הערות מכל חלקי ההרצאה לפי הסדר (הזמנים מתוך התמלול):\n" + json.dumps(notes, ensure_ascii=False)

    # Three focused requests: a small model follows short, specific instructions much better than one huge one.
    start = 0.5 if len(parts) > 1 else 0.0
    steps = [(CORE_RULES, CORE_SCHEMA, 1300), (STUDY_RULES, STUDY_SCHEMA, 1000), (ACTION_RULES, ACTION_SCHEMA, 450)]
    total, done, result = sum(x[2] for x in steps), 0, {}
    for rules, schema, expected in steps:
        tick = (lambda n, d=done: on_progress(min(0.98, start + (1 - start) * (d + min(n, expected)) / total))) if on_progress else None
        part = {}
        for _ in range(2):  # a rare broken answer: try once more
            # the transcript comes first: Ollama reuses it between the three requests instead of reading it again
            part = chat(style(lang), f"{source}\n\n---\n{rules}\nהמבנה:\n{schema}{tail(lang)}", on_tokens=tick,
                        max_tokens=expected * 2)
            if any(part.get(k) for k in json.loads(schema.replace("\n", " ")).keys()):
                break
        result.update({k: v for k, v in part.items() if v})
        done += expected
    if on_progress:
        on_progress(1.0)
    out = clean(result)
    # a small model sometimes lists topics as "tasks": keep only real to-dos (submit, read, practice, a date...)
    todo = re.compile(r"להגיש|הגשה|מטלה|תרגיל|שיעורי בית|לקרוא|לתרגל|לפתור|לסיים|להכין|בוחן|מבחן|עד יום|עד ה|דדליין|submit|due|homework|assignment|read|practice|quiz|exam|deadline", re.I)
    out["tasks"] = [t for t in out["tasks"] if todo.search(t)]
    max_sec = max((s.get("end", 0) for s in segments), default=0)
    tl = [x for x in out["timeline"] if _time_ok(x.get("time"), max_sec)]
    if len(tl) > 10:  # keep the timeline readable: 10 evenly spread moments
        tl = [tl[round(i * (len(tl) - 1) / 9)] for i in range(10)]
    out["timeline"] = tl
    return out


def clean(s):
    """Make sure every field exists and has the right type, so the page never breaks."""
    out = {"title": str(s.get("title") or "סיכום"), "emoji": str(s.get("emoji") or "📝"), "tldr": str(s.get("tldr") or "")}
    for key in ("sections", "concepts", "tasks", "questions", "quiz", "timeline", "keywords", "exam_tips"):
        v = s.get(key)
        out[key] = v if isinstance(v, list) else []
    out["sections"] = [x for x in out["sections"] if isinstance(x, dict) and isinstance(x.get("bullets"), list) and x["bullets"]]
    out["concepts"] = [x for x in out["concepts"] if isinstance(x, dict) and x.get("term")]
    out["quiz"] = [x for x in out["quiz"] if isinstance(x, dict) and x.get("q")]
    out["timeline"] = [x for x in out["timeline"] if isinstance(x, dict) and x.get("title")]
    for key in ("tasks", "questions", "keywords", "exam_tips"):
        out[key] = [str(x) for x in out[key] if isinstance(x, (str, int, float)) and str(x).strip()]
    return out


def live_update(previous, new_text, lang="he"):
    """Short rolling summary during a live meeting."""
    return chat(style(lang), "את עוקבת אחרי זום בזמן אמת. עדכני את הסיכום החי לפי הקטע החדש. "
                       'מבנה: {"now": "על מה מדברים עכשיו במשפט אחד", "points": ["עד 8 נקודות חשובות מכל הפגישה"], '
                       '"questions": ["שאלות או משימות שעלו"]}\n\n'
                       f"הסיכום עד עכשיו:\n{json.dumps(previous, ensure_ascii=False)}\n\nקטע חדש:\n{new_text}{tail(lang)}",
                timeout=600, ctx=4096, max_tokens=500)  # small and quick, so live transcription keeps its pace


def missed(text, minutes, lang="he"):
    return chat(style(lang).replace("החזירי JSON תקין בלבד.", "").replace(" Return valid JSON only.", ""),
                f"סכמי בשלוש עד חמש נקודות קצרות מה נאמר ב-{minutes} הדקות האחרונות, כדי שמי שהתפזר יחזור מהר לעניינים. "
                f"כתבי כל נקודה בשורה שמתחילה ב-•\n\n{text}{tail(lang)}", json_mode=False, timeout=300, ctx=4096, max_tokens=300)


def ask(segments, question, lang="he"):
    text = transcript_text(segments)[-24000:]
    return chat(style(lang).replace("החזירי JSON תקין בלבד.", "").replace(" Return valid JSON only.", ""),
                f"עני על השאלה רק לפי התמלול. אם התשובה לא נאמרה, תגידי את זה. צייני זמן [mm:ss] כשאפשר.\n\nשאלה: {question}\n\nתמלול:\n{text}{tail(lang)}",
                json_mode=False, timeout=300)
