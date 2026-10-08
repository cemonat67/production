"""Turn loop tests with fake STT/TTS/brain/verifier and an energy VAD. These run anywhere."""
from __future__ import annotations

import asyncio

import numpy as np
import pytest

from conftest import silence, speech_like
from lina_voice.audio.io import QueueSink, QueueSource
from lina_voice.audio.vad import EnergyVAD
from lina_voice.brain import EchoBrain
from lina_voice.config import VoiceConfig
from lina_voice.engine import State, VoiceEngine
from lina_voice.speaker import FakeVerifier
from lina_voice.stt import FakeSTT
from lina_voice.tts import FakeTTS

FRAME = 512


def make_engine(transcripts, replies, verifier=None, barge=True):
    cfg = VoiceConfig()
    cfg.barge_in.enabled = barge
    cfg.barge_in.min_speech_ms = 200
    cfg.barge_in.ignore_after_play_start_ms = 100
    source = QueueSource(16000, FRAME)
    sink = QueueSink(24000)
    vad = EnergyVAD(min_silence_ms=300, min_speech_ms=150)
    stt = FakeSTT(transcripts)
    tts = FakeTTS(ms_per_char=40)
    brain = EchoBrain(replies)
    eng = VoiceEngine(cfg, source, sink, vad, stt, tts, brain, verifier)
    events = []
    eng.subscribe(events.append)
    return eng, source, sink, events


async def push_audio(source: QueueSource, audio: np.ndarray, realtime: float = 0.0):
    for i in range(0, len(audio) - FRAME + 1, FRAME):
        source.push(audio[i:i + FRAME])
        if realtime:
            await asyncio.sleep(realtime)
        else:
            await asyncio.sleep(0)


@pytest.mark.asyncio
async def test_full_turn_then_listens_again():
    eng, source, sink, events = make_engine(["bugün ne kaldı"], ["Bugün üç iş var. Hepsi açık."])
    task = asyncio.create_task(eng.run())
    await asyncio.sleep(0.01)
    assert eng.state == State.listening
    await push_audio(source, np.concatenate([speech_like(0.5), silence(0.5)]))
    await asyncio.sleep(1.5)
    kinds = [e["type"] for e in events]
    assert "transcript" in kinds and "sentence" in kinds and "reply_done" in kinds
    sentences = [e["text"] for e in events if e["type"] == "sentence"]
    assert sentences == ["Bugün üç iş var.", "Hepsi açık."]
    assert eng.state == State.listening                   # back to listening automatically
    assert eng.history[-1]["role"] == "assistant"
    assert sink.total_seconds() > 0.5
    # second turn works without any reset
    eng.stt.queue.append("teşekkürler")
    eng.brain.replies.append("Rica ederim.")
    await push_audio(source, np.concatenate([speech_like(0.5, seed=1), silence(0.5)]))
    await asyncio.sleep(1.0)
    assert eng.stats.turns == 2 and eng.state == State.listening
    await eng.stop(); await task


@pytest.mark.asyncio
async def test_barge_in_fast_mode_cuts_playback_for_verified_speaker():
    eng, source, sink, events = make_engine(["dur", "takvimde ne var"], ["Çok uzun bir cevap. " * 12, "Toplantı var."],
                                            verifier=FakeVerifier(accept=True, min_seconds=0.3))
    task = asyncio.create_task(eng.run())
    await asyncio.sleep(0.01)
    await push_audio(source, np.concatenate([speech_like(0.4), silence(0.5)]))
    await asyncio.sleep(0.6)
    assert eng.state == State.speaking and sink.playing
    # user talks over Lina
    await push_audio(source, np.concatenate([speech_like(0.8, seed=2), silence(0.5)]), realtime=0.004)
    await asyncio.sleep(0.8)
    kinds = [e["type"] for e in events]
    assert "barge_in" in kinds
    assert sink.stopped_count >= 1
    assert eng.stats.barge_ins == 1
    assert "Toplantı var." in [e["text"] for e in events if e["type"] == "sentence"]
    await eng.stop(); await task


@pytest.mark.asyncio
async def test_other_speaker_cannot_interrupt_and_is_rejected():
    verifier = FakeVerifier(accept=True, min_seconds=0.3)
    eng, source, sink, events = make_engine(["başka biri", "x"], ["Uzun cevap devam ediyor. " * 12], verifier=verifier)
    task = asyncio.create_task(eng.run())
    await asyncio.sleep(0.01)
    await push_audio(source, np.concatenate([speech_like(0.4), silence(0.5)]))   # the owner speaks first
    await asyncio.sleep(0.6)
    assert eng.state == State.speaking
    verifier.accept = False                                                       # now someone else talks
    stopped_before = sink.stopped_count
    await push_audio(source, np.concatenate([speech_like(0.8, seed=3), silence(0.5)]), realtime=0.004)
    await asyncio.sleep(0.5)
    kinds = [e["type"] for e in events]
    assert "barge_in" not in kinds
    assert "barge_in_ignored" in kinds or "rejected_speaker" in kinds
    assert sink.stopped_count == stopped_before          # playback was never cut
    assert eng.stats.rejected_speaker >= 1
    await eng.stop(); await task


@pytest.mark.asyncio
async def test_echo_of_own_speech_is_dropped_in_safe_mode():
    reply = "Bugün açık kalan üç iş var. " * 6
    eng, source, sink, events = make_engine(["bugün ne kaldı", "bugün açık kalan üç iş var"], [reply], verifier=None)
    task = asyncio.create_task(eng.run())
    await asyncio.sleep(0.01)
    await push_audio(source, np.concatenate([speech_like(0.4), silence(0.5)]))
    await asyncio.sleep(0.6)
    assert eng.state == State.speaking
    stopped_before = sink.stopped_count
    await push_audio(source, np.concatenate([speech_like(0.5, seed=4), silence(0.5)]), realtime=0.003)
    await asyncio.sleep(0.4)
    kinds = [e["type"] for e in events]
    assert "echo_rejected" in kinds and "barge_in" not in kinds
    assert sink.stopped_count == stopped_before
    await eng.stop(); await task


@pytest.mark.asyncio
async def test_safe_mode_real_command_interrupts_after_stt():
    eng, source, sink, events = make_engine(["bugün ne kaldı", "takvimi aç"], ["Uzun cevap. " * 15, "Açıyorum."], verifier=None)
    task = asyncio.create_task(eng.run())
    await asyncio.sleep(0.01)
    await push_audio(source, np.concatenate([speech_like(0.4), silence(0.5)]))
    await asyncio.sleep(0.6)
    assert eng.state == State.speaking
    await push_audio(source, np.concatenate([speech_like(0.5, seed=5), silence(0.5)]), realtime=0.003)
    await asyncio.sleep(0.8)
    kinds = [e["type"] for e in events]
    assert "barge_in" in kinds
    assert "Açıyorum." in [e["text"] for e in events if e["type"] == "sentence"]
    await eng.stop(); await task


@pytest.mark.asyncio
async def test_text_path_and_say_and_interrupt_api():
    eng, source, sink, events = make_engine([], ["Metinden geldi."], verifier=FakeVerifier())
    task = asyncio.create_task(eng.run())
    await asyncio.sleep(0.01)
    await eng.submit_text("merhaba")
    assert eng.history[0] == {"role": "user", "content": "merhaba"}
    assert [e["text"] for e in events if e["type"] == "sentence"] == ["Metinden geldi."]
    say_task = asyncio.create_task(eng.speak("Bu uzun bir duyuru. " * 10))
    await asyncio.sleep(0.2)
    assert sink.playing
    await eng.interrupt("api")
    await say_task
    assert not sink.playing and eng.state == State.listening
    await eng.stop(); await task


@pytest.mark.asyncio
async def test_brain_failure_speaks_error_and_recovers():
    class Broken:
        name = "broken"

        async def stream(self, messages):
            raise RuntimeError("ollama down")
            yield ""  # pragma: no cover

    eng, source, sink, events = make_engine([], [], verifier=None)
    eng.brain = Broken()
    task = asyncio.create_task(eng.run())
    await asyncio.sleep(0.01)
    await eng.submit_text("test")
    assert any(e["type"] == "error" and e["where"] == "brain" for e in events)
    assert any("bağlantı sorunu" in e["text"] for e in events if e["type"] == "sentence")
    assert eng.state == State.listening
    await eng.stop(); await task
