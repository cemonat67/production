"""Voice activity detection. Silero (via sherpa-onnx) in production, an energy VAD as fallback/tests.

Both expose the same frame API: `process(frame) -> list[VadEvent]` plus `speech_ms` (how long the
current utterance has been running) and `current_samples()` (audio of the utterance so far), which
the engine uses for barge-in decisions while Lina is speaking.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import numpy as np


@dataclass
class VadEvent:
    kind: str                       # "start" | "end"
    samples: np.ndarray | None = None


class VAD(Protocol):
    sample_rate: int
    speech_ms: float
    in_speech: bool

    def process(self, frame: np.ndarray) -> list[VadEvent]: ...
    def current_samples(self) -> np.ndarray: ...
    def reset(self) -> None: ...


class EnergyVAD:
    """RMS gate with hangover. Deterministic, model-free; used in tests and as a last-resort fallback."""

    def __init__(self, sample_rate: int = 16000, threshold: float = 0.02, min_silence_ms: int = 700,
                 min_speech_ms: int = 250, max_utterance_s: float = 15.0) -> None:
        self.sample_rate = sample_rate
        self.threshold = threshold
        self.min_silence_ms = min_silence_ms
        self.min_speech_ms = min_speech_ms
        self.max_utterance_s = max_utterance_s
        self.reset()

    def reset(self) -> None:
        self.in_speech = False
        self.speech_ms = 0.0
        self._silence_ms = 0.0
        self._buf: list[np.ndarray] = []

    def current_samples(self) -> np.ndarray:
        return np.concatenate(self._buf) if self._buf else np.zeros(0, dtype=np.float32)

    def process(self, frame: np.ndarray) -> list[VadEvent]:
        frame_ms = 1000.0 * len(frame) / self.sample_rate
        rms = float(np.sqrt(np.mean(np.square(frame)))) if len(frame) else 0.0
        loud = rms >= self.threshold
        events: list[VadEvent] = []
        if not self.in_speech:
            if loud:
                self.in_speech = True
                self.speech_ms = frame_ms
                self._silence_ms = 0.0
                self._buf = [frame.copy()]
                events.append(VadEvent("start"))
            return events
        self._buf.append(frame.copy())
        self.speech_ms += frame_ms
        self._silence_ms = 0.0 if loud else self._silence_ms + frame_ms
        if self._silence_ms >= self.min_silence_ms or self.speech_ms >= self.max_utterance_s * 1000:
            samples = self.current_samples()
            voiced_ms = self.speech_ms - self._silence_ms
            self.reset()
            if voiced_ms >= self.min_speech_ms:
                events.append(VadEvent("end", samples))
        return events


class SileroVAD:
    """Silero VAD through sherpa-onnx. Frame must be 512 samples at 16 kHz (32 ms)."""

    def __init__(self, model_path: str, sample_rate: int = 16000, threshold: float = 0.5,
                 min_silence_ms: int = 700, min_speech_ms: int = 250, max_utterance_s: float = 15.0,
                 num_threads: int = 1) -> None:
        import sherpa_onnx
        self.sample_rate = sample_rate
        cfg = sherpa_onnx.VadModelConfig()
        cfg.silero_vad.model = model_path
        cfg.silero_vad.threshold = threshold
        cfg.silero_vad.min_silence_duration = min_silence_ms / 1000.0
        cfg.silero_vad.min_speech_duration = min_speech_ms / 1000.0
        cfg.silero_vad.max_speech_duration = max_utterance_s
        cfg.silero_vad.window_size = 512
        cfg.sample_rate = sample_rate
        cfg.num_threads = num_threads
        self._vad = sherpa_onnx.VoiceActivityDetector(cfg, buffer_size_in_seconds=max_utterance_s + 5)
        self.in_speech = False
        self.speech_ms = 0.0
        self._buf: list[np.ndarray] = []

    def reset(self) -> None:
        self._vad.reset()
        self.in_speech = False
        self.speech_ms = 0.0
        self._buf = []

    def current_samples(self) -> np.ndarray:
        return np.concatenate(self._buf) if self._buf else np.zeros(0, dtype=np.float32)

    def process(self, frame: np.ndarray) -> list[VadEvent]:
        events: list[VadEvent] = []
        frame_ms = 1000.0 * len(frame) / self.sample_rate
        self._vad.accept_waveform(frame.astype(np.float32, copy=False))
        detected = self._vad.is_speech_detected()
        if detected and not self.in_speech:
            self.in_speech = True
            self.speech_ms = 0.0
            self._buf = []
            events.append(VadEvent("start"))
        if self.in_speech:
            self._buf.append(frame.copy())
            self.speech_ms += frame_ms
        while not self._vad.empty():
            seg = self._vad.front
            samples = np.asarray(seg.samples, dtype=np.float32)
            self._vad.pop()
            self.in_speech = False
            self.speech_ms = 0.0
            self._buf = []
            events.append(VadEvent("end", samples))
        if not detected and self.in_speech and not events:
            # Silero keeps the segment open through min_silence; nothing to do until it closes.
            pass
        return events
