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
import numpy as np
from . import config, summarize
from .transcribe import transcribe_chunk

RATE = 48000  # what sound cards like
OUT = 16000   # what Whisper wants


def _to16k(block):
    mono = block.mean(axis=1) if block.ndim > 1 else block
    n = len(mono) // 3 * 3
    return mono[:n].reshape(-1, 3).mean(axis=1).astype(np.float32)


class Live:
    def __init__(self, sid, lang="he", name="", source="computer"):
        self.id, self.lang = sid, lang
        self.source = source if source in ("computer", "class", "both") else "computer"
        self.names = [w for w in (name or "").replace(",", " ").split() if len(w) > 1]
        self.segments, self.alerts, self.marks = [], [], []
        self.summary = {"now": "", "points": [], "questions": []}
        self.status, self.error, self.level = "starting", None, 0.0
        self.started = time.time()
        self.running = True
        self._q = queue.Queue()
        self._pending = []
        self._last_roll = time.time()
        self._rolling = False
        self._done = threading.Event()
        self.audio_name = f"{sid}.wav"
        self._wav = wave.open(str(config.MEDIA / self.audio_name), "wb")
        self._wav.setnchannels(1)
        self._wav.setsampwidth(2)
        self._wav.setframerate(OUT)
        threading.Thread(target=self._capture, daemon=True).start()
        threading.Thread(target=self._work, daemon=True).start()

    def elapsed(self):
        return time.time() - self.started

    def _device_reader(self, mic, buf):
        """Reads one device into its own buffer until the session stops."""
        try:
            if sys.platform == "win32":
                import ctypes
                ctypes.windll.ole32.CoInitializeEx(None, 0)
            with mic.recorder(samplerate=RATE) as rec:
                while self.running:
                    buf.append(_to16k(rec.record(numframes=RATE // 4)))
        except Exception:
            pass  # a device that cannot be recorded (unplugged, in use) is simply skipped

    def _devices(self):
        if sys.platform == "win32":
            import ctypes
            ctypes.windll.ole32.CoInitializeEx(None, 0)
        import soundcard as sc
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
                self._wav.writeframes((block * 32767).astype(np.int16).tobytes())
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
            if float(np.sqrt(np.mean(audio ** 2))) < 0.002:
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
            if self._pending and not self._rolling and time.time() - self._last_roll > config.LIVE_SUMMARY_EVERY:
                self.roll()
        self._done.set()

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
                "level": round(self.level, 4), "segments": self.segments[since:], "count": len(self.segments),
                "alerts": self.alerts, "marks": self.marks, "summary": self.summary, "rolling": self._rolling}

    def stop(self):
        self.running = False
        self._done.wait(timeout=120)
        try:
            self._wav.close()
        except Exception:
            pass
        return {"duration": round(self.elapsed()), "segments": self.segments, "marks": self.marks,
                "audio": self.audio_name, "source": self.source}
