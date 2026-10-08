"""Engine configuration. Defaults are local-only; cloud is off unless the user turns it on."""
from __future__ import annotations

import os
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

import yaml

PKG_DIR = Path(__file__).resolve().parent
ROOT_DIR = PKG_DIR.parent


def _default_state_dir() -> Path:
    env = os.environ.get("LINA_VOICE_STATE")
    if env:
        return Path(env).expanduser()
    if os.uname().sysname == "Darwin":
        return Path("~/Library/Application Support/ZeroRelationship/voice-engine").expanduser()
    return ROOT_DIR / "state"


@dataclass
class AudioConfig:
    sample_rate: int = 16000          # capture rate for VAD / STT / speaker models
    frame_ms: int = 32                # 512 samples at 16 kHz, matches Silero VAD window
    input_device: str | None = None   # sounddevice name/index; None = default
    output_device: str | None = None


@dataclass
class VADConfig:
    model: str = "models/silero_vad.onnx"
    threshold: float = 0.5
    min_silence_ms: int = 700         # end of utterance
    min_speech_ms: int = 250
    max_utterance_s: float = 15.0


@dataclass
class STTConfig:
    backend: str = "faster-whisper"   # faster-whisper | mlx-whisper | fake
    model: str = "small"              # faster-whisper size or HF repo; large-v3-turbo on Mac
    language: str = "tr"
    compute_type: str = "int8"
    beam_size: int = 1


@dataclass
class TTSConfig:
    # Fallback chain, first available wins.
    backends: list[str] = field(default_factory=lambda: ["pocket", "macos-say", "piper"])
    pocket_config: str = "models/pocket-tts-tr/config.local.yaml"
    pocket_voice: str = "models/voices/lina-ref.wav"   # reference clip for Lina's voice (NOT Cem's voice)
    pocket_temperature: float = 0.3
    pocket_quantize: bool = True      # int8 dynamic quantization: ~2x faster on CPU, first audio ~0.25 s
    macos_voice: str = "Yelda"        # Apple tr-TR voice; Premium if installed
    piper_model: str = "models/piper/tr_TR-fahrettin-medium.onnx"
    piper_tokens: str = "models/piper/tokens.txt"
    piper_data_dir: str = "models/piper/espeak-ng-data"
    sample_rate_out: int = 24000


@dataclass
class SpeakerConfig:
    enabled: bool = True
    model: str = "models/3dspeaker_speech_eres2net_sv_en_voxceleb_16k.onnx"
    threshold: float = 0.55           # cosine similarity; tune with `lina-voice verify`
    profile_name: str = "cem"
    min_seconds: float = 0.8          # minimum audio before an embedding is trusted


@dataclass
class BargeInConfig:
    enabled: bool = True
    min_speech_ms: int = 400          # sustained speech needed to cut Lina off
    ignore_after_play_start_ms: int = 300
    echo_window_s: float = 8.0        # how long spoken sentences count as "recent" for echo rejection
    echo_similarity: float = 0.8


@dataclass
class BrainConfig:
    backend: str = "ollama"           # ollama | http | echo
    ollama_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "gemma3:4b"
    http_url: str = "http://127.0.0.1:3000/api/chatty/local"
    system_prompt: str = (
        "Sen Lina'sın, Zero@System'in sesli asistanısın. Türkçe, kısa ve doğal konuş. "
        "Sesli okunacağı için madde işareti, markdown, kod veya URL kullanma."
    )
    timeout_s: float = 60.0


@dataclass
class CloudConfig:
    enabled: bool = False             # never on by default
    provider: str = ""


@dataclass
class ServerConfig:
    host: str = "127.0.0.1"
    port: int = 8765


@dataclass
class VoiceConfig:
    audio: AudioConfig = field(default_factory=AudioConfig)
    vad: VADConfig = field(default_factory=VADConfig)
    stt: STTConfig = field(default_factory=STTConfig)
    tts: TTSConfig = field(default_factory=TTSConfig)
    speaker: SpeakerConfig = field(default_factory=SpeakerConfig)
    barge_in: BargeInConfig = field(default_factory=BargeInConfig)
    brain: BrainConfig = field(default_factory=BrainConfig)
    cloud: CloudConfig = field(default_factory=CloudConfig)
    server: ServerConfig = field(default_factory=ServerConfig)
    state_dir: Path = field(default_factory=_default_state_dir)
    root_dir: Path = field(default_factory=lambda: ROOT_DIR)

    def resolve(self, p: str | Path) -> Path:
        p = Path(p).expanduser()
        return p if p.is_absolute() else (self.root_dir / p)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["state_dir"] = str(self.state_dir)
        d["root_dir"] = str(self.root_dir)
        return d


def _merge(dc: Any, data: dict[str, Any]) -> None:
    for k, v in (data or {}).items():
        if not hasattr(dc, k):
            raise KeyError(f"Unknown config key: {k}")
        cur = getattr(dc, k)
        if hasattr(cur, "__dataclass_fields__") and isinstance(v, dict):
            _merge(cur, v)
        elif k in ("state_dir", "root_dir"):
            setattr(dc, k, Path(v).expanduser())
        else:
            setattr(dc, k, v)


def load_config(path: str | Path | None = None) -> VoiceConfig:
    """Load config from YAML (default: $LINA_VOICE_CONFIG or lina-voice.yaml next to the package root)."""
    cfg = VoiceConfig()
    candidate = path or os.environ.get("LINA_VOICE_CONFIG") or (ROOT_DIR / "lina-voice.yaml")
    candidate = Path(candidate)
    if candidate.exists():
        with open(candidate, "r", encoding="utf-8") as f:
            _merge(cfg, yaml.safe_load(f) or {})
    cfg.state_dir.mkdir(parents=True, exist_ok=True)
    return cfg
