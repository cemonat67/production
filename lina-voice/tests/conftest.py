from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

MODELS = ROOT / "models"


def speech_like(seconds: float, sr: int = 16000, seed: int = 0, level: float = 0.2) -> np.ndarray:
    """Band-limited noise burst that trips an energy VAD (not Silero). Deterministic."""
    rng = np.random.default_rng(seed)
    n = int(seconds * sr)
    x = rng.standard_normal(n).astype(np.float32)
    # crude low-pass by moving average so it is not white noise
    k = 8
    x = np.convolve(x, np.ones(k) / k, mode="same").astype(np.float32)
    return (x / (np.max(np.abs(x)) + 1e-9) * level).astype(np.float32)


def silence(seconds: float, sr: int = 16000) -> np.ndarray:
    return np.zeros(int(seconds * sr), dtype=np.float32)


@pytest.fixture
def ref_voice() -> np.ndarray:
    import soundfile as sf
    from lina_voice.audio.io import resample
    p = MODELS / "voices" / "test-ref-en.wav"
    if not p.exists():
        pytest.skip("reference voice not downloaded")
    d, sr = sf.read(str(p), dtype="float32")
    if d.ndim > 1:
        d = d[:, 0]
    return resample(d, sr, 16000)


@pytest.fixture
def ref_voice_2() -> np.ndarray:
    import soundfile as sf
    from lina_voice.audio.io import resample
    p = MODELS / "voices" / "test-ref-en-2.wav"
    if not p.exists():
        pytest.skip("second reference voice not downloaded")
    d, sr = sf.read(str(p), dtype="float32")
    if d.ndim > 1:
        d = d[:, 0]
    return resample(d, sr, 16000)
