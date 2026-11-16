<p align="center">
  <img src="static/logo.svg" width="96" alt="Kashuv logo">
</p>

<h1 align="center">Kashuv</h1>

<p align="center">
  <b>Stay focused in every Zoom.</b><br>
  Live transcription, focus helpers and beautiful summaries. Free, private, and running on your own computer.
</p>

<p align="center">
  <a href="README.he.md">עברית</a> ·
  <img src="https://img.shields.io/badge/Python-3.10+-8B7BFF?style=flat-square" alt="Python">
  <img src="https://img.shields.io/badge/Whisper-ivrit.ai-FFB4A2?style=flat-square" alt="Whisper">
  <img src="https://img.shields.io/badge/LLM-Ollama-2A9A66?style=flat-square" alt="Ollama">
  <img src="https://img.shields.io/badge/cost-%240-F2C258?style=flat-square" alt="Free">
</p>

## Why

Long Zoom lectures are hard to follow. Kashuv ("attentive" in Hebrew) listens with you, writes everything down, tells you when someone says your name, and turns the whole meeting into a summary that looks like the notes of the best student in class.

## Features

**Live Zoom mode**
- Captures whatever your computer plays: the Zoom desktop app, Zoom in the browser, Google Meet, Teams, YouTube
- Optional: your own microphone too
- Live transcript every few seconds and a rolling summary ("what are they talking about right now")
- 🙈 **What did I miss?** Summary of the last 2, 5 or 10 minutes in one click
- 📣 **Name alert:** a sound and a highlight when someone says your name
- ⭐ **Important moment** bookmarks and a 🎯 **focus mode** that hides everything but the essentials
- Saves the recording as a WAV file

**Summaries from recordings**
- Drop an mp4, m4a, mp3, wav and more
- TL;DR, sections, exam tips, key concepts, tasks, open questions, timeline and flip-card quiz
- Clickable transcript that follows the audio, with search
- 💬 **Ask the recording** anything
- Export to PDF or Markdown

**Design**
- Soft pastel look with motion, dark mode, RTL Hebrew
- Draggable accessibility menu (text size, contrast, stop animations, link highlight, simple font)

## How it works

```
Zoom audio ──► soundcard (WASAPI loopback) ──► faster-whisper (ivrit-ai turbo) ──► transcript
                                                                     │
                                         Ollama (gemma3:4b) ◄─────────┘ ──► rolling + final summary
```

| Part | Tech |
|---|---|
| Server | Python, Flask |
| Speech to text | faster-whisper with the Hebrew model `ivrit-ai/whisper-large-v3-turbo-ct2` |
| Summaries | Local LLM through Ollama (map-reduce for long meetings, JSON output) |
| Audio capture | `soundcard` loopback recording |
| Front end | Vanilla JS single-page app, CSS animations, print stylesheet for PDF |
| Storage | JSON files in `data/` |

## Run it (Windows)

1. Install [Python 3.10+](https://www.python.org/downloads/) (tick "Add to PATH")
2. Install [Ollama](https://ollama.com/download) and run `ollama pull gemma3:4b`
3. Double click `start.bat`. The first run installs everything and downloads the speech model (about 1.6 GB)
4. Kashuv opens at `http://localhost:5170`

Settings live in `kashuv/config.py` and can be changed with environment variables (for example `KASHUV_LLM=qwen2.5:7b` or `KASHUV_WHISPER=small` on a slow laptop). On a Mac, live mode needs a loopback device such as BlackHole.

## Privacy

Nothing leaves your computer. Always tell the other participants that you are recording.

## License

MIT
