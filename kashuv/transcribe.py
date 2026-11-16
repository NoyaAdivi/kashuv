"""Speech to text with faster-whisper. The model loads once and is shared by uploads and live sessions."""
import threading
from . import config

_model = None
_load_lock = threading.Lock()
_run_lock = threading.Lock()  # one transcription at a time keeps RAM low


def get_model():
    global _model
    with _load_lock:
        if _model is None:
            from faster_whisper import WhisperModel
            _model = WhisperModel(config.WHISPER_MODEL, device=config.WHISPER_DEVICE, compute_type=config.WHISPER_COMPUTE)
    return _model


def is_loaded():
    return _model is not None


def transcribe_file(path, language="he", on_progress=None):
    """Returns (segments, duration). Works with mp4, m4a, mp3, wav and more (decoded by PyAV)."""
    model = get_model()
    with _run_lock:
        segments, info = model.transcribe(str(path), language=language or None, vad_filter=True, beam_size=5)
        out = []
        for s in segments:
            text = s.text.strip()
            if text:
                out.append({"start": round(s.start, 1), "end": round(s.end, 1), "text": text})
            if on_progress and info.duration:
                on_progress(min(s.end / info.duration, 1.0))
    return out, info.duration


def transcribe_chunk(audio, language="he"):
    """audio: float32 mono numpy array at 16 kHz. Returns a list of (start, end, text)."""
    model = get_model()
    with _run_lock:
        segments, _ = model.transcribe(audio, language=language or None, vad_filter=True, beam_size=1,
                                       condition_on_previous_text=False)
        return [(s.start, s.end, s.text.strip()) for s in segments if s.text.strip()]
