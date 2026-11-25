"""Kashuv settings. Everything runs locally and is free. Override any value with an environment variable."""
import os
import sys
from pathlib import Path

FROZEN = getattr(sys, "frozen", False)  # True inside the Kashuv.exe build
# The site files (templates, static, sw.js) live next to the code, or inside the exe bundle.
ROOT = Path(sys._MEIPASS) if FROZEN else Path(__file__).resolve().parent.parent
# The installed app keeps recordings in the user's own folder, where it is always allowed to write.
_DEFAULT_DATA = Path(os.getenv("LOCALAPPDATA", Path.home())) / "Kashuv" if FROZEN else ROOT / "data"
DATA = Path(os.getenv("KASHUV_DATA", _DEFAULT_DATA))
SESSIONS = DATA / "sessions"
MEDIA = DATA / "media"
for p in (SESSIONS, MEDIA):
    p.mkdir(parents=True, exist_ok=True)

# Hebrew-tuned Whisper by ivrit.ai (free, runs on your computer). Use "small" on a slow laptop.
WHISPER_MODEL = os.getenv("KASHUV_WHISPER", "ivrit-ai/whisper-large-v3-turbo-ct2")
WHISPER_DEVICE = os.getenv("KASHUV_DEVICE", "auto")  # auto uses an NVIDIA GPU if you have one
WHISPER_COMPUTE = os.getenv("KASHUV_COMPUTE", "int8")

# Local LLM through Ollama (free). gemma3:4b is light and good in Hebrew; try qwen2.5:7b on a strong PC.
OLLAMA_URL = os.getenv("KASHUV_OLLAMA", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("KASHUV_LLM", "gemma3:4b")

LIVE_CHUNK_SECONDS = int(os.getenv("KASHUV_CHUNK", "10"))
LIVE_SUMMARY_EVERY = int(os.getenv("KASHUV_LIVE_SUMMARY_EVERY", "120"))  # seconds
PORT = int(os.getenv("KASHUV_PORT", "5170"))
