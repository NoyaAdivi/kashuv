"""Instant draft captions for live mode.

The accurate Hebrew model needs about half a minute on a laptop without a graphics card.
To make live mode feel live, a tiny Hebrew model (Ozen-v1 by Itay Inbar, Apache-2.0, distilled from ivrit.ai)
writes a quick grey draft of the last seconds every couple of seconds. The accurate text replaces it when ready.
It runs with ONNX Runtime, which Kashuv already ships, and is downloaded once in the background.
"""
import threading
import numpy as np

REPO = "itayinbar/Ozen-v1"
FILES = ("onnx/encoder_model.onnx", "onnx/decoder_model_merged.onnx", "tokenizer.json")
WINDOW = 16000 * 30
BOS, EOS, MAX_TOKENS = 1, 2, 200
HEADS, HEAD_DIM = 8, 64

_lock = threading.Lock()
_model = None
state = {"ready": False, "error": ""}


class _Ozen:
    def __init__(self, paths):
        import onnxruntime as ort
        from tokenizers import Tokenizer
        from faster_whisper.feature_extractor import FeatureExtractor
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 2  # leave the rest of the CPU to the accurate model and to Zoom
        self.enc = ort.InferenceSession(paths[0], opts, providers=["CPUExecutionProvider"])
        self.dec = ort.InferenceSession(paths[1], opts, providers=["CPUExecutionProvider"])
        self.tok = Tokenizer.from_file(paths[2])
        self.fe = FeatureExtractor(feature_size=80)
        self.dec_in = [i.name for i in self.dec.get_inputs()]
        self.dec_out = [o.name for o in self.dec.get_outputs()]
        self.enc_in = self.enc.get_inputs()[0].name

    def transcribe(self, audio):
        audio = audio[-WINDOW:].astype(np.float32)
        padded = np.zeros(WINDOW, np.float32)
        padded[:len(audio)] = audio
        mel = self.fe(padded)[:, :3000][None].astype(np.float32)
        enc = self.enc.run(None, {self.enc_in: mel})[0]
        past = {n: np.zeros((1, HEADS, 0, HEAD_DIM), np.float32) for n in self.dec_in if n.startswith("past_key_values")}
        ids = [BOS]
        for step in range(MAX_TOKENS):
            feed = {"input_ids": np.array([[ids[-1]]], np.int64), "encoder_hidden_states": enc, **past}
            if "use_cache_branch" in self.dec_in:
                feed["use_cache_branch"] = np.array([step > 0])
            res = dict(zip(self.dec_out, self.dec.run(None, feed)))
            nxt = int(res["logits"][0, -1].argmax())
            if nxt == EOS:
                break
            ids.append(nxt)
            for name, value in res.items():
                if not name.startswith("present"):
                    continue
                if step > 0 and ".encoder." in name:
                    continue  # the cross-attention cache from the first step stays valid
                past[name.replace("present", "past_key_values")] = value
        return self.tok.decode(ids[1:], skip_special_tokens=True).strip()


def load():
    """Downloads (once, about 250 MB) and loads the draft model. Safe to call many times."""
    global _model
    with _lock:
        if _model is not None:
            return _model
        try:
            from huggingface_hub import hf_hub_download
            paths = [hf_hub_download(REPO, f) for f in FILES]
            _model = _Ozen(paths)
            state.update(ready=True, error="")
        except Exception as e:
            state["error"] = str(e)
        return _model


def load_background():
    threading.Thread(target=load, daemon=True).start()


def transcribe(audio):
    m = _model
    return m.transcribe(audio) if m else ""
