"""Speech-to-text backends. Input is 16 kHz mono float32; output is text plus timing."""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Protocol

import numpy as np


@dataclass
class STTResult:
    text: str
    language: str = "tr"
    audio_s: float = 0.0
    latency_s: float = 0.0
    backend: str = ""


class STTEngine(Protocol):
    name: str

    def transcribe(self, samples: np.ndarray, sample_rate: int = 16000) -> STTResult: ...


class FakeSTT:
    """Returns queued transcripts in order (tests)."""
    name = "fake"

    def __init__(self, transcripts: list[str] | None = None) -> None:
        self.queue = list(transcripts or [])
        self.calls = 0

    def transcribe(self, samples: np.ndarray, sample_rate: int = 16000) -> STTResult:
        self.calls += 1
        text = self.queue.pop(0) if self.queue else ""
        return STTResult(text=text, audio_s=len(samples) / sample_rate, backend=self.name)


class FasterWhisperSTT:
    name = "faster-whisper"

    def __init__(self, model: str = "small", language: str = "tr", compute_type: str = "int8",
                 beam_size: int = 1, device: str = "cpu", download_root: str | None = None) -> None:
        from faster_whisper import WhisperModel
        self.language = language
        self.beam_size = beam_size
        self._model = WhisperModel(model, device=device, compute_type=compute_type, download_root=download_root)

    def transcribe(self, samples: np.ndarray, sample_rate: int = 16000) -> STTResult:
        if sample_rate != 16000:
            from ..audio.io import resample
            samples = resample(samples, sample_rate, 16000)
        t0 = time.perf_counter()
        segments, info = self._model.transcribe(samples.astype(np.float32), language=self.language,
                                                beam_size=self.beam_size, vad_filter=False,
                                                condition_on_previous_text=False)
        text = " ".join(s.text.strip() for s in segments).strip()
        return STTResult(text=text, language=info.language, audio_s=len(samples) / 16000.0,
                         latency_s=time.perf_counter() - t0, backend=self.name)


class MLXWhisperSTT:
    """Apple Silicon path (mlx-whisper). Not runnable on Linux; kept thin on purpose."""
    name = "mlx-whisper"

    def __init__(self, model: str = "mlx-community/whisper-large-v3-turbo", language: str = "tr") -> None:
        import mlx_whisper  # noqa: F401
        self._mlx = mlx_whisper
        self.model = model
        self.language = language

    def transcribe(self, samples: np.ndarray, sample_rate: int = 16000) -> STTResult:
        if sample_rate != 16000:
            from ..audio.io import resample
            samples = resample(samples, sample_rate, 16000)
        t0 = time.perf_counter()
        out = self._mlx.transcribe(samples.astype(np.float32), path_or_hf_repo=self.model,
                                   language=self.language, fp16=True)
        return STTResult(text=str(out.get("text", "")).strip(), language=self.language,
                         audio_s=len(samples) / 16000.0, latency_s=time.perf_counter() - t0, backend=self.name)


def build_stt(cfg) -> STTEngine:
    b = cfg.stt.backend
    if b == "faster-whisper":
        return FasterWhisperSTT(cfg.stt.model, cfg.stt.language, cfg.stt.compute_type, cfg.stt.beam_size,
                                download_root=str(cfg.resolve("models/whisper")))
    if b == "mlx-whisper":
        return MLXWhisperSTT(cfg.stt.model, cfg.stt.language)
    if b == "fake":
        return FakeSTT()
    raise ValueError(f"unknown stt backend: {b}")
