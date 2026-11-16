"""Sessions are plain JSON files in data/sessions, so nothing needs a database."""
import json
import time
import uuid
from . import config


def new_id():
    return time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:4]


def path(sid):
    if not sid.replace("-", "").isalnum():
        raise ValueError("bad id")
    return config.SESSIONS / f"{sid}.json"


def save(session):
    p = path(session["id"])
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(session, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(p)


def load(sid):
    p = path(sid)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def delete(sid):
    s = load(sid)
    if s and s.get("audio"):
        (config.MEDIA / s["audio"]).unlink(missing_ok=True)
    path(sid).unlink(missing_ok=True)


def list_all():
    items = []
    for p in sorted(config.SESSIONS.glob("*.json"), reverse=True):
        try:
            s = json.loads(p.read_text(encoding="utf-8"))
        except ValueError:
            continue
        sm = s.get("summary") or {}
        items.append({"id": s["id"], "title": sm.get("title") or s.get("name"), "emoji": sm.get("emoji", "📝"),
                      "tldr": sm.get("tldr", ""), "created": s.get("created"), "kind": s.get("kind"),
                      "duration": s.get("duration", 0), "keywords": sm.get("keywords", [])[:4]})
    return items
