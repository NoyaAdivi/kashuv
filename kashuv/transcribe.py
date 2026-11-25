"""Speech to text with faster-whisper. The model loads once and is shared by uploads and live sessions."""
import threading
from . import config

_models = {}
_load_lock = threading.Lock()
_run_lock = threading.Lock()  # one transcription at a time keeps RAM low


def _key(language):
    return "en" if language == "en" else "he"


def get_model(language="he"):
    """Hebrew uses the ivrit.ai model; English uses the regular Whisper turbo (downloaded the first time it is needed)."""
    key = _key(language)
    with _load_lock:
        if key not in _models:
            from faster_whisper import WhisperModel
            name = config.WHISPER_MODEL_EN if key == "en" else config.WHISPER_MODEL
            _models[key] = WhisperModel(name, device=config.WHISPER_DEVICE, compute_type=config.WHISPER_COMPUTE,
                                        cpu_threads=config.CPU_THREADS)
    return _models[key]


def is_loaded():
    return "he" in _models


def decode(path):
    """Any audio or video file to 16 kHz mono float32, read with PyAV directly
    (newer PyAV versions no longer accept an option faster-whisper passes when it opens files itself)."""
    import av
    import numpy as np
    chunks = []
    with av.open(str(path)) as container:
        stream = next((s for s in container.streams if s.type == "audio"), None)
        if stream is None:
            raise ValueError("לא נמצא קול בקובץ הזה / No audio found in this file")
        resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)
        for frame in container.decode(stream):
            for out in resampler.resample(frame):
                chunks.append(out.to_ndarray().reshape(-1))
        for out in resampler.resample(None):  # flush what is left inside the resampler
            chunks.append(out.to_ndarray().reshape(-1))
    if not chunks:
        return np.zeros(0, np.float32)
    return np.concatenate(chunks).astype(np.float32) / 32768.0


def transcribe_file(path, language="he", on_progress=None):
    """Returns (segments, duration). Works with mp4, m4a, mp3, wav and more."""
    model = get_model(language)
    audio = decode(path)
    duration = len(audio) / 16000
    with _run_lock:
        segments, _ = model.transcribe(audio, language=_key(language), vad_filter=True, beam_size=1)  # greedy: about 3x faster on a laptop, same quality in tests
        out = []
        for s in segments:
            text = s.text.strip()
            if text:
                out.append({"start": round(s.start, 1), "end": round(s.end, 1), "text": text})
            if on_progress and duration:
                on_progress(min(s.end / duration, 1.0))
    return out, duration


def transcribe_chunk(audio, language="he"):
    """audio: float32 mono numpy array at 16 kHz. Returns a list of (start, end, text)."""
    model = get_model(language)
    with _run_lock:
        segments, _ = model.transcribe(audio, language=_key(language), vad_filter=True, beam_size=1,
                                       condition_on_previous_text=False)
        return [(s.start, s.end, s.text.strip()) for s in segments if s.text.strip()]
