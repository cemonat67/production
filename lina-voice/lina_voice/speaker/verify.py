"""Speaker gate: only the enrolled person's voice (Cem) becomes a command.

Embeddings come from a sherpa-onnx speaker model (3D-Speaker ERes2Net or WeSpeaker CAM++, Apache-2.0,
language-independent). Enrollment averages several clips. Scores are cosine similarities; anything
below `threshold` is rejected. Profiles are stored in the engine's own state dir — the app's existing
voice/profile.json is only ever read, never written.
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import numpy as np


@dataclass
class VerifyResult:
    ok: bool
    score: float
    name: str
    audio_s: float
    latency_s: float = 0.0


class Verifier(Protocol):
    enabled: bool
    min_seconds: float

    def verify(self, samples: np.ndarray, sample_rate: int = 16000) -> VerifyResult: ...


class FakeVerifier:
    """Decides by a tag the test attaches to the audio (`samples.speaker`) or a default answer."""

    def __init__(self, accept: bool = True, min_seconds: float = 0.8, score_ok: float = 0.9, score_bad: float = 0.2) -> None:
        self.enabled = True
        self.min_seconds = min_seconds
        self.accept = accept
        self.score_ok, self.score_bad = score_ok, score_bad
        self.calls: list[float] = []

    def verify(self, samples: np.ndarray, sample_rate: int = 16000) -> VerifyResult:
        audio_s = len(samples) / sample_rate
        self.calls.append(audio_s)
        ok = getattr(samples, "speaker_ok", self.accept)
        return VerifyResult(ok, self.score_ok if ok else self.score_bad, "cem", audio_s)


class SpeakerVerifier:
    def __init__(self, model_path: str, store_path: str | Path, threshold: float = 0.55,
                 min_seconds: float = 0.8, profile_name: str = "cem", num_threads: int = 1) -> None:
        import sherpa_onnx
        cfg = sherpa_onnx.SpeakerEmbeddingExtractorConfig(model=model_path, num_threads=num_threads, provider="cpu")
        if not cfg.validate():
            raise FileNotFoundError(f"speaker model not usable: {model_path}")
        self._ext = sherpa_onnx.SpeakerEmbeddingExtractor(cfg)
        self.dim = self._ext.dim
        self.threshold = threshold
        self.min_seconds = min_seconds
        self.profile_name = profile_name
        self.store_path = Path(store_path)
        self.enabled = True
        self.profiles: dict[str, np.ndarray] = {}
        self._load()

    # ---- persistence -------------------------------------------------------------------------
    def _load(self) -> None:
        if self.store_path.exists():
            data = json.loads(self.store_path.read_text())
            for name, vec in data.get("profiles", {}).items():
                v = np.asarray(vec, dtype=np.float32)
                if v.shape == (self.dim,):
                    self.profiles[name] = v

    def _save(self) -> None:
        self.store_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"dim": self.dim, "updated": time.time(),
                   "profiles": {k: v.tolist() for k, v in self.profiles.items()}}
        self.store_path.write_text(json.dumps(payload))

    # ---- embeddings --------------------------------------------------------------------------
    def embed(self, samples: np.ndarray, sample_rate: int = 16000) -> np.ndarray:
        if sample_rate != 16000:
            from ..audio.io import resample
            samples = resample(samples, sample_rate, 16000)
        stream = self._ext.create_stream()
        stream.accept_waveform(sample_rate=16000, waveform=samples.astype(np.float32))
        stream.input_finished()
        vec = np.asarray(self._ext.compute(stream), dtype=np.float32)
        n = np.linalg.norm(vec)
        return vec / n if n > 0 else vec

    @staticmethod
    def cosine(a: np.ndarray, b: np.ndarray) -> float:
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))

    def enroll(self, name: str, clips: list[np.ndarray], sample_rate: int = 16000) -> np.ndarray:
        embs = [self.embed(c, sample_rate) for c in clips if len(c) >= int(self.min_seconds * sample_rate)]
        if not embs:
            raise ValueError("no clip is long enough to enroll")
        mean = np.mean(np.stack(embs), axis=0)
        mean /= np.linalg.norm(mean) + 1e-9
        self.profiles[name] = mean.astype(np.float32)
        self._save()
        return mean

    def import_vector(self, name: str, vec: list[float]) -> bool:
        """Import an embedding produced elsewhere (e.g. the app's VoiceIdentity) if dimensions match."""
        v = np.asarray(vec, dtype=np.float32)
        if v.shape != (self.dim,):
            return False
        self.profiles[name] = v / (np.linalg.norm(v) + 1e-9)
        self._save()
        return True

    def score(self, samples: np.ndarray, sample_rate: int = 16000, name: str | None = None) -> float:
        name = name or self.profile_name
        if name not in self.profiles:
            return -1.0
        return self.cosine(self.embed(samples, sample_rate), self.profiles[name])

    def verify(self, samples: np.ndarray, sample_rate: int = 16000, name: str | None = None) -> VerifyResult:
        name = name or self.profile_name
        t0 = time.perf_counter()
        audio_s = len(samples) / sample_rate
        if name not in self.profiles:
            return VerifyResult(False, -1.0, name, audio_s, time.perf_counter() - t0)
        s = self.score(samples, sample_rate, name)
        return VerifyResult(s >= self.threshold, s, name, audio_s, time.perf_counter() - t0)


def build_verifier(cfg) -> Verifier | None:
    if not cfg.speaker.enabled:
        return None
    return SpeakerVerifier(str(cfg.resolve(cfg.speaker.model)), cfg.state_dir / "speakers.json",
                           cfg.speaker.threshold, cfg.speaker.min_seconds, cfg.speaker.profile_name)
