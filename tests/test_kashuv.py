"""Fast tests that need no models: the LLM and Whisper are replaced with fakes."""
import io
import time
import pytest

import app as server
from kashuv import storage, summarize


@pytest.fixture
def client():
    server.app.config["TESTING"] = True
    return server.app.test_client()


def make_session(sid="20260101-120000-abcd", **extra):
    s = {"id": sid, "kind": "file", "name": "lecture", "created": time.time(), "lang": "he", "duration": 65,
         "segments": [{"start": 0, "end": 5, "text": "שלום"}, {"start": 61, "end": 65, "text": "עצי AVL"}], "marks": []}
    s.update(extra)
    storage.save(s)
    return s


def test_parse_json_handles_extra_text():
    assert summarize.parse_json('{"a": 1}') == {"a": 1}
    assert summarize.parse_json('Sure! {"a": 2} hope it helps') == {"a": 2}
    assert summarize.parse_json("not json") == {}


def test_clean_fills_every_field():
    out = summarize.clean({"title": "T", "sections": [{"title": "x", "bullets": []}, {"title": "y", "bullets": ["b"]}], "quiz": "oops"})
    assert out["title"] == "T" and out["emoji"]
    assert out["quiz"] == [] and len(out["sections"]) == 1
    for key in ("concepts", "tasks", "questions", "timeline", "keywords", "exam_tips"):
        assert out[key] == []


def test_fmt_time_and_transcript():
    assert summarize.fmt_time(65) == "01:05"
    assert summarize.fmt_time(3725) == "1:02:05"
    text = summarize.transcript_text([{"start": 61, "text": "hi"}])
    assert text == "[01:01] hi"


def test_long_transcripts_are_summarized_in_parts(monkeypatch):
    calls = []

    def fake_chat(system, user, json_mode=True, timeout=0):
        calls.append(user)
        return {"title": "Final", "sections": [{"title": "s", "bullets": ["b"]}]} if "המבנה" in user else {"points": ["p"]}
    monkeypatch.setattr(summarize, "chat", fake_chat)
    segs = [{"start": i, "end": i + 1, "text": "מילה " * 60} for i in range(80)]
    out = summarize.summarize(segs)
    assert out["title"] == "Final"
    assert len(calls) > 2  # several parts plus the final merge


def test_english_summaries_ask_for_english(monkeypatch):
    seen = {}
    monkeypatch.setattr(summarize, "chat", lambda system, user, **k: seen.update(system=system, user=user) or {"title": "x"})
    summarize.summarize([{"start": 0, "end": 1, "text": "hello"}], lang="en")
    assert seen["system"] == summarize.STYLE_EN and "English" in seen["user"]


def test_empty_transcript_needs_no_model():
    assert summarize.summarize([])["title"]


def test_storage_round_trip_and_bad_ids():
    s = make_session("20260101-120000-aaaa")
    assert storage.load(s["id"])["name"] == "lecture"
    assert any(x["id"] == s["id"] for x in storage.list_all())
    with pytest.raises(ValueError):
        storage.load("../../etc/passwd")
    storage.delete(s["id"])
    assert storage.load(s["id"]) is None


def test_api_sessions_rename_and_delete(client):
    s = make_session("20260101-120000-bbbb", summary={"title": "Old", "tldr": ""})
    assert client.get("/api/sessions").status_code == 200
    assert client.get(f"/api/sessions/{s['id']}").json["name"] == "lecture"
    assert client.post(f"/api/sessions/{s['id']}/rename", json={"title": "New"}).status_code == 200
    assert storage.load(s["id"])["summary"]["title"] == "New"
    assert client.post(f"/api/sessions/{s['id']}/rename", json={"title": " "}).status_code == 400
    assert client.delete(f"/api/sessions/{s['id']}").json["ok"]
    assert client.get(f"/api/sessions/{s['id']}").status_code == 404


def test_upload_rejects_non_media(client):
    r = client.post("/api/upload", data={"file": (io.BytesIO(b"x"), "notes.txt")}, content_type="multipart/form-data")
    assert r.status_code == 400


def test_health_when_ollama_is_off(client, monkeypatch):
    monkeypatch.setattr(summarize.config, "OLLAMA_URL", "http://127.0.0.1:9")
    h = client.get("/api/health").json
    assert h["ollama"]["running"] is False


def test_resummarize_clears_partial_flag(client, monkeypatch):
    monkeypatch.setattr(summarize, "chat", lambda *a, **k: {"title": "Done", "sections": [{"title": "s", "bullets": ["b"]}]})
    s = make_session("20260101-120000-cccc", kind="live", partial=True)
    job = client.post(f"/api/sessions/{s['id']}/resummarize").json["job"]
    for _ in range(50):
        if client.get(f"/api/jobs/{job}").json["status"] == "done":
            break
        time.sleep(0.05)
    saved = storage.load(s["id"])
    assert saved["summary"]["title"] == "Done" and "partial" not in saved


def test_index_page_loads(client):
    r = client.get("/")
    assert r.status_code == 200 and b"kashuv" in r.data


def test_bad_ids_and_broken_bodies_do_not_crash(client):
    assert client.get("/api/sessions/..%2F..%2Fetc").status_code == 404
    s = make_session("20260101-120000-dddd")
    r = client.post(f"/api/sessions/{s['id']}/rename", data="oops", content_type="text/plain")
    assert r.status_code == 400


def test_service_worker_is_served_from_the_root(client):
    r = client.get("/sw.js")
    assert r.status_code == 200 and b"caches" in r.data


def test_page_loads_faq_and_app_files(client):
    html = client.get("/").data.decode()
    for f in ("static/faq.js", "static/noya-app.js", "static/manifest.webmanifest"):
        assert f in html and client.get("/" + f).status_code == 200


def test_search_finds_words_inside_transcripts(client):
    make_session("20260101-120000-eeee")
    hits = client.get("/api/search?q=avl").json
    assert hits and hits[0]["t"] == 61 and hits[0]["id"] == "20260101-120000-eeee"
    assert client.get("/api/search?q=a").json == []
    assert client.get("/api/stats").status_code == 200
