"""Summaries with a local LLM through Ollama. Long meetings are summarized in parts and then merged."""
import json
import re
import requests
from . import config

CHUNK_CHARS = 6000

STYLE = ("את עוזרת סיכומים מעולה לסטודנטים. כתבי בעברית תקנית, ברורה ומדויקת, בלי להמציא מידע שלא נאמר. "
         "אם ההרצאה באנגלית, סכמי בעברית והשאירי מונחים מקצועיים גם באנגלית בסוגריים. "
         "לעולם אל תשתמשי בקו מפריד ארוך. החזירי JSON תקין בלבד.")

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
        return {"running": True, "model": any(n.startswith(config.OLLAMA_MODEL) for n in names), "name": config.OLLAMA_MODEL}
    except Exception:
        return {"running": False, "model": False, "name": config.OLLAMA_MODEL}


def chat(system, user, json_mode=True, timeout=900):
    body = {"model": config.OLLAMA_MODEL, "stream": False,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "options": {"temperature": 0.3, "num_ctx": 8192}}
    if json_mode:
        body["format"] = "json"
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


def summarize(segments, on_progress=None):
    text = transcript_text(segments)
    if not text.strip():
        return {"title": "לא זוהה דיבור", "emoji": "🤫", "tldr": "לא נמצא דיבור בהקלטה.", "sections": []}
    parts = list(_chunks(text))
    if len(parts) == 1:
        source = "תמלול מלא:\n" + text
    else:
        notes = []
        for i, part in enumerate(parts):
            n = chat(STYLE, f"זה חלק {i + 1} מתוך {len(parts)} של תמלול. הוציאי ממנו הערות במבנה:\n{NOTES_SCHEMA}\n\nתמלול:\n{part}")
            notes.append(n)
            if on_progress:
                on_progress((i + 1) / (len(parts) + 1))
        source = "הערות מכל חלקי ההרצאה לפי הסדר:\n" + json.dumps(notes, ensure_ascii=False)
    result = chat(STYLE, "בני סיכום מעולה, מסודר ומעמיק ברמה של הסטודנט הכי טוב בכיתה. "
                         "4 עד 8 חלקים, 5 עד 10 שאלות תרגול, ציר זמן לפי השעות שבתמלול. "
                         f"המבנה:\n{FINAL_SCHEMA}\n\n{source}")
    return clean(result)


def clean(s):
    """Make sure every field exists and has the right type, so the page never breaks."""
    out = {"title": str(s.get("title") or "סיכום"), "emoji": str(s.get("emoji") or "📝"), "tldr": str(s.get("tldr") or "")}
    for key in ("sections", "concepts", "tasks", "questions", "quiz", "timeline", "keywords", "exam_tips"):
        v = s.get(key)
        out[key] = v if isinstance(v, list) else []
    out["sections"] = [x for x in out["sections"] if isinstance(x, dict) and x.get("bullets")]
    return out


def live_update(previous, new_text):
    """Short rolling summary during a live meeting."""
    return chat(STYLE, "את עוקבת אחרי זום בזמן אמת. עדכני את הסיכום החי לפי הקטע החדש. "
                       'מבנה: {"now": "על מה מדברים עכשיו במשפט אחד", "points": ["עד 8 נקודות חשובות מכל הפגישה"], '
                       '"questions": ["שאלות או משימות שעלו"]}\n\n'
                       f"הסיכום עד עכשיו:\n{json.dumps(previous, ensure_ascii=False)}\n\nקטע חדש:\n{new_text}", timeout=300)


def missed(text, minutes):
    return chat(STYLE.replace("החזירי JSON תקין בלבד.", ""),
                f"סכמי בשלוש עד חמש נקודות קצרות מה נאמר ב-{minutes} הדקות האחרונות, כדי שמי שהתפזר יחזור מהר לעניינים. "
                f"כתבי כל נקודה בשורה שמתחילה ב-•\n\n{text}", json_mode=False, timeout=300)


def ask(segments, question):
    text = transcript_text(segments)[-24000:]
    return chat(STYLE.replace("החזירי JSON תקין בלבד.", ""),
                f"עני על השאלה רק לפי התמלול. אם התשובה לא נאמרה, תגידי את זה. צייני זמן [mm:ss] כשאפשר.\n\nשאלה: {question}\n\nתמלול:\n{text}",
                json_mode=False, timeout=300)
