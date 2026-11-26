"""Live mode, three sources:
- "computer": what your computer plays (Zoom app, Zoom in the browser, Meet, Teams). Every output device is
  captured, so it works with speakers, wired headphones and Bluetooth headphones alike.
- "class": the microphone, for a lecture or lesson in the room.
- "both": computer sound and microphone mixed (a Zoom where you also talk).
Each device is read in its own thread, so a silent device never blocks the others."""
import sys
import threading
import time
import wave
import queue
import collections
import warnings
import numpy as np
from . import config, summarize, storage
from .transcribe import transcribe_chunk
from . import draft

warnings.filterwarnings("ignore", message="data discontinuity")  # harmless gaps reported by Windows loopback
RATE = 48000  # what sound cards like
OUT = 16000   # what Whisper wants


def _to16k(block):
    mono = block.mean(axis=1) if block.ndim > 1 else block
    n = len(mono) // 3 * 3
    return mono[:n].reshape(-1, 3).mean(axis=1).astype(np.float32)


class Live:
    def __init__(self, sid, lang="he", name="", source="computer", title=""):
        self.title = title
        self.id, self.lang = sid, lang
        self.source = source if source in ("computer", "class", "both") else "computer"
        self.names = [w for w in (name or "").replace(",", " ").split() if len(w) > 1]
        self.segments, self.alerts, self.marks = [], [], []
        self.summary = {"now": "", "points": [], "questions": []}
        self.status, self.error, self.level = "starting", None, 0.0
        self.levels, self.lcount = collections.deque(maxlen=240), 0  # one value every half second, for the live sound wave
        self.started = time.time()
        self.running = True
        self._q = queue.Queue()
        self._pending = []
        self._last_roll = time.time()
        self._rolling = False
        self._done = threading.Event()
        self._closed = False
        self._recent = collections.deque()  # (start time, audio) of the last seconds, for the instant draft
        self._final_t = 0.0  # everything before this time already has accurate text
        self.draft = {"t": 0, "text": ""}  # set once the final session is handed over, so autosave never overwrites it
        self.audio_name = f"{sid}.wav"
        self._wav = wave.open(str(config.MEDIA / self.audio_name), "wb")
        self._wav.setnchannels(1)
        self._wav.setsampwidth(2)
        self._wav.setframerate(OUT)
        threading.Thread(target=self._capture, daemon=True).start()
        threading.Thread(target=self._work, daemon=True).start()
        if lang != "en":  # the draft model is Hebrew only
            threading.Thread(target=self._drafter, daemon=True).start()

    def elapsed(self):
        return time.time() - self.started

    def _device_reader(self, mic, buf):
        """Reads one device into its own buffer until the session stops."""
        try:
            if sys.platform == "win32":
                import ctypes
                ctypes.windll.ole32.CoInitializeEx(None, 0)
            # a bigger buffer rides out short CPU spikes (Zoom + transcription) without dropping sound
            with mic.recorder(samplerate=RATE, blocksize=RATE // 2) as rec:
                while self.running:
                    buf.append(_to16k(rec.record(numframes=RATE // 4)))
        except Exception:
            pass  # a device that cannot be recorded (unplugged, in use) is simply skipped

    def _devices(self):
        # Import soundcard first: on its first import it sets up Windows audio (COM) itself,
        # and fails with "Error 0x100000001" if this thread was already set up before it.
        import soundcard as sc
        if sys.platform == "win32":
            import ctypes
            ctypes.windll.ole32.CoInitializeEx(None, 0)
        devs = []
        if self.source in ("computer", "both"):
            for spk in sc.all_speakers():  # speakers, headphones, Bluetooth: whatever Zoom plays to
                try:
                    devs.append(sc.get_microphone(id=str(spk.id), include_loopback=True))
                except Exception:
                    pass
        if self.source in ("class", "both"):
            devs.append(sc.default_microphone())
        if not devs:
            raise RuntimeError("לא נמצא התקן שמע" if self.lang != "en" else "No audio device found")
        return devs

    def _capture(self):
        try:
            bufs = []
            for d in self._devices():
                b = collections.deque()
                bufs.append(b)
                threading.Thread(target=self._device_reader, args=(d, b), daemon=True).start()
            self.status = "listening"
            need, chunk, have = OUT * config.LIVE_CHUNK_SECONDS, [], 0
            step = OUT // 2
            next_t = time.time()
            while self.running:
                next_t += 0.5
                time.sleep(max(0, next_t - time.time()))
                parts = []
                for b in bufs:
                    got = []
                    while b:
                        got.append(b.popleft())
                    parts.append(np.concatenate(got) if got else np.zeros(0, np.float32))
                n = max([step] + [len(x) for x in parts])
                block = np.zeros(n, np.float32)
                for x in parts:
                    block[:len(x)] += x
                block = np.clip(block, -1, 1)
                self.level = float(np.sqrt(np.mean(block ** 2)))
                self.levels.append(round(self.level, 4))
                self.lcount += 1
                self._wav.writeframes((block * 32767).astype(np.int16).tobytes())
                self._recent.append((self.elapsed() - n / OUT, block))
                while self._recent and self._recent[0][0] < self.elapsed() - 35:
                    self._recent.popleft()
                chunk.append(block)
                have += n
                if have >= need:
                    self._q.put((self.elapsed() - have / OUT, np.concatenate(chunk)))
                    chunk, have = [], 0
            if have > OUT:
                self._q.put((self.elapsed() - have / OUT, np.concatenate(chunk)))
        except Exception as e:  # no sound card, missing package, Mac without BlackHole...
            self.error = (f"Audio capture problem: {e}" if self.lang == "en" else f"בעיה בהקלטת הקול: {e}")
            self.status = "error"
        finally:
            self._q.put(None)

    def _work(self):
        while True:
            item = self._q.get()
            if item is None:
                break
            t0, audio = item
            done_until = t0 + len(audio) / OUT
            if float(np.sqrt(np.mean(audio ** 2))) < 0.002:
                self._final_t = max(self._final_t, done_until)
                continue  # silence
            try:
                segs = transcribe_chunk(audio, self.lang)
            except Exception as e:
                self.error = f"בעיה בתמלול: {e}"
                continue
            for s, e, text in segs:
                seg = {"start": round(max(t0 + s, 0), 1), "end": round(max(t0 + e, 0), 1), "text": text}
                self.segments.append(seg)
                self._pending.append(f"[{summarize.fmt_time(seg['start'])}] {text}")
                if any(n in text for n in self.names):
                    self.alerts.append({"t": seg["start"], "text": text})
            self._final_t = max(self._final_t, done_until)
            self.draft = {"t": self._final_t, "text": ""}  # the accurate text now covers it
            self.autosave()

    def _drafter(self):
        """Every ~3 seconds: a quick draft of what was said since the last accurate text."""
        if draft.load() is None:
            return  # no internet the first time, or the model failed: live mode simply works without drafts
        while self.running:
            time.sleep(3)  # often enough to feel live, light enough that the accurate text keeps its pace
            parts = [(t, b) for t, b in list(self._recent) if t + len(b) / OUT > self._final_t]
            if not parts:
                continue
            start = max(parts[0][0], self._final_t)
            audio = np.concatenate([b for _, b in parts])[-int(28 * OUT):]
            if len(audio) < OUT or float(np.sqrt(np.mean(audio ** 2))) < 0.003:
                continue
            try:
                text = draft.transcribe(audio)
            except Exception:
                return
            if start >= self._final_t - 1:  # still newer than the accurate text
                self.draft = {"t": round(start, 1), "text": text}
            # refresh the live summary only when transcription is caught up, so the text never falls behind
            if self._pending and not self._rolling and self._q.empty() and time.time() - self._last_roll > config.LIVE_SUMMARY_EVERY:
                self.roll()
        self._done.set()

    def autosave(self):
        """Saves the transcript so far, so nothing is lost if the app or the computer closes mid lecture."""
        if self._closed:
            return
        try:
            storage.save({"id": self.id, "kind": "live", "partial": True, "name": self.title or time.strftime("%d.%m %H:%M"),
                          "created": self.started, "lang": self.lang, "source": self.source, "duration": round(self.elapsed()),
                          "segments": self.segments, "marks": self.marks, "audio": self.audio_name})
        except Exception:
            pass

    def roll(self):
        """Refresh the live summary in the background so transcription never waits."""
        if self._rolling or not self._pending:
            return
        self._rolling = True
        text, self._pending = "\n".join(self._pending), []
        self._last_roll = time.time()

        def run():
            try:
                s = summarize.live_update(self.summary, text, self.lang)
                if isinstance(s, dict) and s:
                    self.summary = {"now": str(s.get("now", "")), "points": list(s.get("points") or [])[:8],
                                    "questions": list(s.get("questions") or [])[:8]}
            except Exception:
                self._pending.insert(0, text)
            finally:
                self._rolling = False
        threading.Thread(target=run, daemon=True).start()

    def recent_text(self, minutes):
        since = self.elapsed() - minutes * 60
        return "\n".join(s["text"] for s in self.segments if s["end"] >= since)

    def state(self, since=0):
        return {"status": self.status, "error": self.error, "elapsed": round(self.elapsed()),
                "level": round(self.level, 4), "levels": list(self.levels)[-80:], "lcount": self.lcount, "segments": self.segments[since:], "count": len(self.segments),
                "alerts": self.alerts, "marks": self.marks, "summary": self.summary, "rolling": self._rolling,
                "draft": self.draft}

    def stop(self, on_progress=None):
        self.running = False
        total, waited = self._q.qsize() + 1, 0
        while not self._done.wait(timeout=1) and waited < 1800:  # finish transcribing everything already recorded
            waited += 1
            if on_progress:
                on_progress(max(0.0, 1 - self._q.qsize() / total))
        self._closed = True
        try:
            self._wav.close()
        except Exception:
            pass
        return {"duration": round(self.elapsed()), "segments": self.segments, "marks": self.marks,
                "audio": self.audio_name, "source": self.source, "alerts": self.alerts}
