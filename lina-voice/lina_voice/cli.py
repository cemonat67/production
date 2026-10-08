"""Command line: run the engine, speak, transcribe, enroll/verify a speaker, benchmark, diagnose."""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
import time
from pathlib import Path

import numpy as np

from .config import VoiceConfig, load_config


def _log(verbose: bool) -> None:
    logging.basicConfig(level=logging.DEBUG if verbose else logging.INFO,
                        format="%(asctime)s %(name)s %(levelname)s %(message)s")


def _read_wav(path: str, target_sr: int = 16000) -> np.ndarray:
    import soundfile as sf
    from .audio.io import resample
    data, sr = sf.read(path, dtype="float32")
    if data.ndim > 1:
        data = data[:, 0]
    return resample(data, sr, target_sr)


def _write_wav(path: str, audio: np.ndarray, sr: int) -> None:
    import soundfile as sf
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    sf.write(path, audio, sr)


# ---- commands ---------------------------------------------------------------------------------
def cmd_say(cfg: VoiceConfig, args: argparse.Namespace) -> int:
    from .textnorm import normalize_for_speech
    from .tts import build_tts
    if args.backend:
        cfg.tts.backends = [args.backend]
    tts = build_tts(cfg)
    text = normalize_for_speech(args.text)
    t0 = time.perf_counter()
    first = None
    chunks = []
    for c in tts.stream(text):
        if first is None:
            first = time.perf_counter() - t0
        chunks.append(c)
    total = time.perf_counter() - t0
    audio = np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.float32)
    dur = len(audio) / tts.sample_rate
    print(json.dumps({"backend": tts.active.name, "text": text, "first_audio_s": round(first or -1, 3),
                      "synth_s": round(total, 3), "audio_s": round(dur, 2),
                      "rtf": round(total / dur, 3) if dur else None, "sample_rate": tts.sample_rate},
                     ensure_ascii=False))
    if args.out:
        _write_wav(args.out, audio, tts.sample_rate)
        print(f"wrote {args.out}")
    if args.play:
        import sounddevice as sd
        sd.play(audio, tts.sample_rate); sd.wait()
    return 0


def cmd_transcribe(cfg: VoiceConfig, args: argparse.Namespace) -> int:
    from .stt import build_stt
    stt = build_stt(cfg)
    audio = _read_wav(args.wav)
    res = stt.transcribe(audio)
    print(json.dumps(res.__dict__, ensure_ascii=False))
    return 0


def cmd_enroll(cfg: VoiceConfig, args: argparse.Namespace) -> int:
    from .speaker import build_verifier
    v = build_verifier(cfg)
    if v is None:
        print("speaker gate disabled in config", file=sys.stderr); return 2
    clips = [_read_wav(p) for p in args.wavs]
    v.enroll(args.name, clips)
    print(json.dumps({"enrolled": args.name, "clips": len(clips), "dim": v.dim, "store": str(v.store_path)}))
    return 0


def cmd_verify(cfg: VoiceConfig, args: argparse.Namespace) -> int:
    from .speaker import build_verifier
    v = build_verifier(cfg)
    if v is None:
        print("speaker gate disabled in config", file=sys.stderr); return 2
    rows = []
    for p in args.wavs:
        r = v.verify(_read_wav(p), name=args.name)
        rows.append({"wav": p, "ok": r.ok, "score": round(r.score, 3), "audio_s": round(r.audio_s, 2),
                     "latency_s": round(r.latency_s, 3)})
        print(json.dumps(rows[-1], ensure_ascii=False))
    return 0 if all(r["ok"] for r in rows) else 1


def cmd_bench(cfg: VoiceConfig, args: argparse.Namespace) -> int:
    from .textnorm import normalize_for_speech
    from .tts import build_tts
    sentences = [
        "İyi akşamlar Cem. Bugün açık kalan üç iş var.",
        "Takvimde saat on beşte Ekoten toplantısı görünüyor, otuz dakika sürecek.",
        "Sistemlerde kritik bir sorun yok; raporu hazırlayıp masaüstüne kaydettim.",
    ]
    tts = build_tts(cfg)
    rows = []
    for i, s in enumerate(sentences):
        text = normalize_for_speech(s)
        t0 = time.perf_counter(); first = None; n = 0
        for c in tts.stream(text):
            if first is None:
                first = time.perf_counter() - t0
            n += len(c)
        total = time.perf_counter() - t0
        dur = n / tts.sample_rate
        rows.append({"i": i, "backend": tts.active.name, "chars": len(text), "first_audio_s": round(first or -1, 3),
                     "synth_s": round(total, 3), "audio_s": round(dur, 2), "rtf": round(total / dur, 3) if dur else None})
        print(json.dumps(rows[-1], ensure_ascii=False))
    return 0


def cmd_doctor(cfg: VoiceConfig, args: argparse.Namespace) -> int:
    import platform
    report: dict = {"platform": platform.platform(), "python": sys.version.split()[0]}
    for key in ("vad.model", "speaker.model", "tts.pocket_config", "tts.pocket_voice", "tts.piper_model"):
        sect, name = key.split(".")
        p = cfg.resolve(getattr(getattr(cfg, sect), name))
        report[key] = {"path": str(p), "exists": p.exists()}
    for mod in ("pocket_tts", "faster_whisper", "sherpa_onnx", "sounddevice", "mlx_whisper"):
        try:
            __import__(mod); report[mod] = "ok"
        except Exception as e:  # noqa: BLE001
            report[mod] = f"missing ({type(e).__name__})"
    from .tts import build_tts
    try:
        chain = build_tts(cfg)
        report["tts_available"] = [e.name for e in chain.engines]
    except Exception as e:  # noqa: BLE001
        report["tts_available"] = f"none ({e})"
    if platform.system() == "Darwin":
        import subprocess
        out = subprocess.run(["say", "-v", "?"], capture_output=True, text=True).stdout
        report["macos_tr_voices"] = [l.split()[0] for l in out.splitlines() if "tr_TR" in l]
    from .brain import OllamaBrain
    report["ollama"] = asyncio.run(OllamaBrain(cfg.brain.ollama_url, cfg.brain.ollama_model).alive())
    report["state_dir"] = str(cfg.state_dir)
    report["cloud_enabled"] = cfg.cloud.enabled
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


def cmd_run(cfg: VoiceConfig, args: argparse.Namespace) -> int:
    import uvicorn
    from .audio.io import QueueSink, QueueSource, SoundDeviceSink, SoundDeviceSource
    from .audio.vad import EnergyVAD, SileroVAD
    from .brain import build_brain
    from .engine import VoiceEngine
    from .server import create_app
    from .speaker import build_verifier
    from .stt import build_stt
    from .tts import build_tts

    tts = build_tts(cfg)
    stt = build_stt(cfg)
    brain = build_brain(cfg)
    verifier = build_verifier(cfg)
    vad_path = cfg.resolve(cfg.vad.model)
    if vad_path.exists():
        vad = SileroVAD(str(vad_path), cfg.audio.sample_rate, cfg.vad.threshold, cfg.vad.min_silence_ms,
                        cfg.vad.min_speech_ms, cfg.vad.max_utterance_s)
    else:
        logging.warning("Silero VAD model missing at %s; using energy VAD", vad_path)
        vad = EnergyVAD(cfg.audio.sample_rate, min_silence_ms=cfg.vad.min_silence_ms,
                        min_speech_ms=cfg.vad.min_speech_ms, max_utterance_s=cfg.vad.max_utterance_s)
    frame_len = int(cfg.audio.sample_rate * cfg.audio.frame_ms / 1000)
    q_source = q_sink = None
    if args.audio == "local":
        source = SoundDeviceSource(cfg.audio.sample_rate, frame_len, cfg.audio.input_device)
        sink = SoundDeviceSink(tts.sample_rate, cfg.audio.output_device)
    else:
        q_source = source = QueueSource(cfg.audio.sample_rate, frame_len)
        q_sink = sink = QueueSink(tts.sample_rate)
    engine = VoiceEngine(cfg, source, sink, vad, stt, tts, brain, verifier)
    if verifier is not None and cfg.speaker.profile_name not in getattr(verifier, "profiles", {}):
        logging.warning("speaker profile '%s' not enrolled: every utterance will be rejected until you run "
                        "`lina-voice enroll %s clip1.wav clip2.wav`", cfg.speaker.profile_name, cfg.speaker.profile_name)
    app = create_app(engine, q_source, q_sink)
    uvicorn.run(app, host=cfg.server.host, port=cfg.server.port, log_level="info")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="lina-voice", description="Lina local Turkish voice engine")
    ap.add_argument("--config", help="YAML config path")
    ap.add_argument("-v", "--verbose", action="store_true")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("run", help="start the engine + local server")
    p.add_argument("--audio", choices=["local", "ws"], default="ws",
                   help="local: engine owns mic/speaker; ws: host app streams audio over /audio")
    p = sub.add_parser("say", help="synthesize text"); p.add_argument("text"); p.add_argument("--out"); p.add_argument("--play", action="store_true"); p.add_argument("--backend")
    p = sub.add_parser("transcribe", help="transcribe a wav"); p.add_argument("wav")
    p = sub.add_parser("enroll", help="enroll a speaker from wav clips"); p.add_argument("name"); p.add_argument("wavs", nargs="+")
    p = sub.add_parser("verify", help="score wav clips against a profile"); p.add_argument("wavs", nargs="+"); p.add_argument("--name", default=None)
    sub.add_parser("bench", help="TTS latency / RTF on three Turkish sentences")
    sub.add_parser("doctor", help="check models, backends, Ollama")

    args = ap.parse_args(argv)
    _log(args.verbose)
    cfg = load_config(args.config)
    return {"run": cmd_run, "say": cmd_say, "transcribe": cmd_transcribe, "enroll": cmd_enroll,
            "verify": cmd_verify, "bench": cmd_bench, "doctor": cmd_doctor}[args.cmd](cfg, args)


if __name__ == "__main__":
    sys.exit(main())
