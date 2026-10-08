"""Real-model round trip: Turkish text → Pocket TTS → Silero VAD → faster-whisper → text.

Runs only when the models are downloaded (see scripts/download-models.sh). Slow on CPU (model load),
so it is marked `slow`; run with `pytest -m slow tests/test_roundtrip.py -s`.
"""
from __future__ import annotations

import time

import numpy as np
import pytest

from conftest import MODELS, ROOT, silence
from lina_voice.textnorm import normalize_for_match, normalize_for_speech

POCKET = MODELS / "pocket-tts-tr" / "config.local.yaml"
VOICE = MODELS / "voices" / "lina-ref.wav"
SILERO = MODELS / "silero_vad.onnx"

SENTENCE = "Bugün açık kalan üç iş var. Sistemlerde kritik bir sorun yok."


def _wer(ref: str, hyp: str) -> float:
    r, h = ref.split(), hyp.split()
    d = np.zeros((len(r) + 1, len(h) + 1), dtype=int)
    d[:, 0] = np.arange(len(r) + 1); d[0, :] = np.arange(len(h) + 1)
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (r[i - 1] != h[j - 1]))
    return d[len(r), len(h)] / max(len(r), 1)


@pytest.mark.slow
@pytest.mark.skipif(not (POCKET.exists() and VOICE.exists() and SILERO.exists()), reason="models missing")
def test_tts_vad_stt_roundtrip_turkish():
    from lina_voice.audio.io import resample
    from lina_voice.audio.vad import SileroVAD
    from lina_voice.stt.base import FasterWhisperSTT
    from lina_voice.tts.base import PocketTTS

    tts = PocketTTS(str(POCKET), str(VOICE))
    t0 = time.perf_counter()
    tts.load()
    load_s = time.perf_counter() - t0

    text = normalize_for_speech(SENTENCE)
    t0 = time.perf_counter(); first = None; chunks = []
    for c in tts.stream(text):
        if first is None:
            first = time.perf_counter() - t0
        chunks.append(c)
    synth_s = time.perf_counter() - t0
    audio24 = np.concatenate(chunks)
    audio_s = len(audio24) / tts.sample_rate
    print(f"\nTTS load {load_s:.1f}s | first audio {first:.3f}s | synth {synth_s:.2f}s for {audio_s:.2f}s audio | RTF {synth_s/audio_s:.2f}")
    assert audio_s > 1.0

    # VAD must see speech in the synthesized audio
    audio16 = np.concatenate([silence(0.3), resample(audio24, tts.sample_rate, 16000), silence(1.0)])
    vad = SileroVAD(str(SILERO), min_silence_ms=500)
    ends = []
    for i in range(0, len(audio16) - 511, 512):
        for ev in vad.process(audio16[i:i + 512]):
            if ev.kind == "end":
                ends.append(ev.samples)
    assert ends, "Silero VAD did not detect speech in TTS output"
    voiced = sum(len(e) for e in ends) / 16000
    print(f"VAD voiced {voiced:.2f}s of {audio_s:.2f}s")

    # STT must get the words back
    stt = FasterWhisperSTT("small", "tr", download_root=str(ROOT / "models" / "whisper"))
    res = stt.transcribe(resample(audio24, tts.sample_rate, 16000))
    wer = _wer(normalize_for_match(SENTENCE), normalize_for_match(res.text))
    print(f"STT ({res.latency_s:.2f}s): '{res.text}'  WER={wer:.2f}")
    assert wer <= 0.35, f"round-trip WER too high: {wer:.2f} ({res.text!r})"
