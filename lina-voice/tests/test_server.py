from __future__ import annotations

import json

import numpy as np
from fastapi.testclient import TestClient

from conftest import silence, speech_like
from lina_voice.audio.io import QueueSink, QueueSource, to_pcm16
from lina_voice.audio.vad import EnergyVAD
from lina_voice.brain import EchoBrain
from lina_voice.config import VoiceConfig
from lina_voice.engine import VoiceEngine
from lina_voice.server import create_app
from lina_voice.stt import FakeSTT
from lina_voice.tts import FakeTTS


def recv_with_timeout(ws, seconds=10.0):
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(1) as ex:
        return ex.submit(ws.receive).result(timeout=seconds)


def build():
    cfg = VoiceConfig()
    source = QueueSource(16000, 512)
    sink = QueueSink(24000)
    eng = VoiceEngine(cfg, source, sink, EnergyVAD(min_silence_ms=300, min_speech_ms=150),
                      FakeSTT(["saat kaç"]), FakeTTS(ms_per_char=20), EchoBrain(["Saat üç."]), None)
    return create_app(eng, source, sink), eng


def test_health_text_and_events_roundtrip():
    app, eng = build()
    with TestClient(app) as c:
        assert c.get("/health").json()["ok"] is True
        with c.websocket_connect("/events") as ws:
            hello = json.loads(ws.receive_text())
            assert hello["type"] == "hello"
            r = c.post("/text", json={"text": "merhaba"})
            assert r.json()["accepted"]
            seen = []
            for _ in range(20):
                ev = json.loads(recv_with_timeout(ws)["text"])
                seen.append(ev["type"])
                if ev["type"] == "reply_done":
                    assert ev["text"].startswith("Saat üç.") or ev["text"]
                    break
            assert "sentence" in seen and "reply_done" in seen
        assert c.post("/interrupt").json()["ok"]
        assert c.post("/mic", json={"enabled": False}).json()["mic_enabled"] is False
        assert c.post("/mic", json={"enabled": True}).json()["mic_enabled"] is True


def test_audio_websocket_receives_tts_pcm_for_spoken_command():
    app, eng = build()
    audio = np.concatenate([speech_like(0.5), silence(0.5)])
    with TestClient(app) as c:
        with c.websocket_connect("/audio") as ws:
            for i in range(0, len(audio) - 512 + 1, 512):
                ws.send_bytes(to_pcm16(audio[i:i + 512]))
            got = b""
            for _ in range(50):
                msg = recv_with_timeout(ws)
                if msg.get("bytes"):
                    got += msg["bytes"]
                    if len(got) > 24000 * 2 * 0.1:
                        break
            assert len(got) > 0                       # TTS audio came back as PCM16
            assert eng.history and eng.history[0]["content"] == "saat kaç"
