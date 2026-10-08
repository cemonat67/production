"""Text-to-speech backends with a fallback chain.

Every backend streams float32 chunks: `stream(text, stop) -> Iterator[np.ndarray]` at `sample_rate`.
`stop` is a threading.Event; a backend must check it between chunks so barge-in cuts synthesis.
"""
from __future__ import annotations

import logging
import platform
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path
from typing import Iterator, Protocol

import numpy as np

log = logging.getLogger("lina.tts")


class TTSEngine(Protocol):
    name: str
    sample_rate: int

    def available(self) -> bool: ...
    def stream(self, text: str, stop: threading.Event | None = None) -> Iterator[np.ndarray]: ...


class FakeTTS:
    """Synthesizes a quiet tone whose length scales with the text (≈ 60 ms per character). Tests only."""
    name = "fake"

    def __init__(self, sample_rate: int = 24000, ms_per_char: float = 60.0, chunk_ms: float = 80.0) -> None:
        self.sample_rate = sample_rate
        self.ms_per_char = ms_per_char
        self.chunk_ms = chunk_ms
        self.spoken: list[str] = []

    def available(self) -> bool:
        return True

    def stream(self, text: str, stop: threading.Event | None = None) -> Iterator[np.ndarray]:
        self.spoken.append(text)
        total = int(self.sample_rate * self.ms_per_char * max(len(text), 1) / 1000.0)
        chunk = int(self.sample_rate * self.chunk_ms / 1000.0)
        t = np.arange(total) / self.sample_rate
        wave = (0.2 * np.sin(2 * np.pi * 220.0 * t)).astype(np.float32)
        for i in range(0, total, chunk):
            if stop is not None and stop.is_set():
                return
            yield wave[i:i + chunk]


class PocketTTS:
    """Kyutai Pocket TTS runtime with the Turkish weights (config.local.yaml points at local files)."""
    name = "pocket"

    def __init__(self, config_path: str, voice_path: str, temperature: float = 0.3, quantize: bool = False,
                 max_tokens: int = 400) -> None:
        self.config_path = Path(config_path)
        self.voice_path = Path(voice_path)
        self.temperature = temperature
        self.quantize = quantize
        self.max_tokens = max_tokens
        self._model = None
        self._state = None
        self.sample_rate = 24000
        self._lock = threading.Lock()

    def available(self) -> bool:
        try:
            import pocket_tts  # noqa: F401
        except Exception:
            return False
        return self.config_path.exists() and self.voice_path.exists()

    def load(self) -> None:
        with self._lock:
            if self._model is not None:
                return
            from pocket_tts import TTSModel
            log.info("loading Pocket TTS from %s", self.config_path)
            self._model = TTSModel.load_model(config=str(self.config_path), temp=self.temperature,
                                              quantize=self.quantize)
            self.sample_rate = int(self._model.sample_rate)
            self._state = self._model.get_state_for_audio_prompt(str(self.voice_path))

    def set_voice(self, voice_path: str) -> None:
        self.load()
        self.voice_path = Path(voice_path)
        self._state = self._model.get_state_for_audio_prompt(str(self.voice_path))

    def stream(self, text: str, stop: threading.Event | None = None) -> Iterator[np.ndarray]:
        """Synthesize sentence by sentence: Pocket TTS can stop early on long multi-sentence inputs."""
        self.load()
        from ..sentencer import Sentencer
        sentencer = Sentencer(soft_limit=140, hard_limit=240)
        pieces = list(sentencer.feed(text)) + list(sentencer.flush())
        for piece in pieces:
            for chunk in self._model.generate_audio_stream(self._state, piece, max_tokens=self.max_tokens, stop=stop):
                if stop is not None and stop.is_set():
                    return
                arr = chunk.detach().cpu().float().numpy().reshape(-1)
                if arr.size:
                    yield arr.astype(np.float32)


class MacSayTTS:
    """Apple speech synthesis through `say` (AVSpeechSynthesizer voices, e.g. Yelda Premium for tr-TR).

    Produces one chunk per sentence. Used as the always-available fallback on macOS.
    """
    name = "macos-say"

    def __init__(self, voice: str = "Yelda", sample_rate: int = 24000, rate_wpm: int | None = None) -> None:
        self.voice = voice
        self.sample_rate = sample_rate
        self.rate_wpm = rate_wpm

    def available(self) -> bool:
        if platform.system() != "Darwin" or not shutil.which("say"):
            return False
        try:
            out = subprocess.run(["say", "-v", "?"], capture_output=True, text=True, timeout=10).stdout
        except Exception:
            return False
        return any(line.split()[0] == self.voice for line in out.splitlines() if line.strip())

    def stream(self, text: str, stop: threading.Event | None = None) -> Iterator[np.ndarray]:
        import soundfile as sf
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "s.wav"
            cmd = ["say", "-v", self.voice, "--file-format=WAVE", f"--data-format=LEF32@{self.sample_rate}", "-o", str(out)]
            if self.rate_wpm:
                cmd += ["-r", str(self.rate_wpm)]
            subprocess.run(cmd + [text], check=True, timeout=60)
            data, sr = sf.read(str(out), dtype="float32")
            if data.ndim > 1:
                data = data[:, 0]
            if sr != self.sample_rate:
                from ..audio.io import resample
                data = resample(data, sr, self.sample_rate)
            if stop is None or not stop.is_set():
                yield data


class PiperTTS:
    """Piper Turkish voice via sherpa-onnx (emergency fallback: fast, robotic)."""
    name = "piper"

    def __init__(self, model: str, tokens: str, data_dir: str, num_threads: int = 2) -> None:
        self.model, self.tokens, self.data_dir = model, tokens, data_dir
        self.num_threads = num_threads
        self._tts = None
        self.sample_rate = 22050

    def available(self) -> bool:
        return Path(self.model).exists() and Path(self.tokens).exists() and Path(self.data_dir).exists()

    def load(self) -> None:
        if self._tts is not None:
            return
        import sherpa_onnx
        vits = sherpa_onnx.OfflineTtsVitsModelConfig(model=self.model, lexicon="", tokens=self.tokens,
                                                      data_dir=self.data_dir)
        mcfg = sherpa_onnx.OfflineTtsModelConfig(vits=vits, num_threads=self.num_threads, provider="cpu")
        self._tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=mcfg))
        self.sample_rate = self._tts.sample_rate

    def stream(self, text: str, stop: threading.Event | None = None) -> Iterator[np.ndarray]:
        self.load()
        audio = self._tts.generate(text, sid=0, speed=1.0)
        if stop is None or not stop.is_set():
            yield np.asarray(audio.samples, dtype=np.float32)


class TTSChain:
    """Tries backends in order; if one raises mid-sentence, the next one speaks that sentence."""
    name = "chain"

    def __init__(self, engines: list[TTSEngine]) -> None:
        self.engines = [e for e in engines if e.available()]
        if not self.engines:
            raise RuntimeError("no TTS backend available")
        self.active: TTSEngine = self.engines[0]
        self.sample_rate = self.active.sample_rate
        self.fallbacks = 0

    def available(self) -> bool:
        return bool(self.engines)

    def stream(self, text: str, stop: threading.Event | None = None) -> Iterator[np.ndarray]:
        start = self.engines.index(self.active)
        last_err: Exception | None = None
        for eng in self.engines[start:]:
            try:
                produced = False
                for chunk in eng.stream(text, stop):
                    produced = True
                    self.active = eng
                    self.sample_rate = eng.sample_rate
                    yield chunk
                if produced or (stop is not None and stop.is_set()):
                    return
            except Exception as e:  # noqa: BLE001
                last_err = e
                self.fallbacks += 1
                log.warning("TTS backend %s failed (%s); falling back", eng.name, e)
        if last_err:
            raise last_err


def build_tts(cfg) -> TTSChain:
    engines: list[TTSEngine] = []
    for name in cfg.tts.backends:
        if name == "pocket":
            engines.append(PocketTTS(str(cfg.resolve(cfg.tts.pocket_config)), str(cfg.resolve(cfg.tts.pocket_voice)),
                                     cfg.tts.pocket_temperature, quantize=cfg.tts.pocket_quantize))
        elif name == "macos-say":
            engines.append(MacSayTTS(cfg.tts.macos_voice, cfg.tts.sample_rate_out))
        elif name == "piper":
            engines.append(PiperTTS(str(cfg.resolve(cfg.tts.piper_model)), str(cfg.resolve(cfg.tts.piper_tokens)),
                                    str(cfg.resolve(cfg.tts.piper_data_dir))))
        elif name == "fake":
            engines.append(FakeTTS(cfg.tts.sample_rate_out))
        else:
            raise ValueError(f"unknown tts backend: {name}")
    return TTSChain(engines)
