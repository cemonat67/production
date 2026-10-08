"""VoiceEngine — the turn loop.

listening ──VAD end──▶ thinking (STT → speaker gate → echo guard → brain stream)
     ▲                                      │
     │                                      ▼
     └──── playback drained ◀── speaking (sentencer → TTS stream → sink)

Barge-in while speaking:
  * fast mode (speaker gate on): after `min_speech_ms` of sustained speech, embed what was captured
    so far; if it is the enrolled speaker, cut playback + generation immediately and keep capturing
    until the utterance ends, then transcribe it as the next command. Anyone else (including Lina's
    own voice leaking back into the mic) is ignored and playback continues.
  * safe mode (speaker gate off): wait for the utterance to end, transcribe, drop it if the echo
    guard says it is Lina's own speech, otherwise cut playback and handle it.

The first `ignore_after_play_start_ms` of each playback are ignored so echo-cancellation convergence
and the speaker's own onset cannot trigger a false interrupt.
"""
from __future__ import annotations

import asyncio
import logging
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable

import numpy as np

from .config import VoiceConfig
from .echo import EchoGuard
from .sentencer import Sentencer
from .textnorm import normalize_for_speech

log = logging.getLogger("lina.engine")


class State(str, Enum):
    idle = "idle"
    listening = "listening"
    thinking = "thinking"
    speaking = "speaking"
    error = "error"


@dataclass
class TurnMetrics:
    speech_end: float = 0.0
    transcript_at: float = 0.0
    first_sentence_at: float = 0.0
    first_audio_at: float = 0.0
    reply_done_at: float = 0.0

    def as_dict(self) -> dict[str, float]:
        def d(a: float, b: float) -> float:
            return round(b - a, 3) if a and b else -1.0
        return {
            "stt_s": d(self.speech_end, self.transcript_at),
            "first_sentence_s": d(self.speech_end, self.first_sentence_at),
            "first_audio_s": d(self.speech_end, self.first_audio_at),
            "total_s": d(self.speech_end, self.reply_done_at),
        }


@dataclass
class EngineStats:
    turns: int = 0
    barge_ins: int = 0
    rejected_speaker: int = 0
    echo_rejected: int = 0
    errors: int = 0
    last_metrics: dict[str, float] = field(default_factory=dict)


class VoiceEngine:
    def __init__(self, cfg: VoiceConfig, source, sink, vad, stt, tts, brain, verifier=None,
                 clock: Callable[[], float] = time.monotonic) -> None:
        self.cfg = cfg
        self.source, self.sink, self.vad, self.stt, self.tts, self.brain, self.verifier = (
            source, sink, vad, stt, tts, brain, verifier)
        self.clock = clock
        self.state = State.idle
        self.history: list[dict[str, str]] = []
        self.stats = EngineStats()
        self.echo = EchoGuard(cfg.barge_in.echo_window_s, cfg.barge_in.echo_similarity, clock)
        self._listeners: list[Callable[[dict[str, Any]], None]] = []
        self._reply_task: asyncio.Task | None = None
        self._tts_stop = threading.Event()
        self._stopped = asyncio.Event()
        self._play_started_at = 0.0
        self._barge_verified = False      # current utterance already passed the speaker gate
        self._barge_rejected = False      # current utterance failed the gate while Lina was speaking
        self._barge_checked_ms = 0.0
        self._utter_start = 0.0
        self.mic_enabled = True

    # ---- events --------------------------------------------------------------------------------
    def subscribe(self, fn: Callable[[dict[str, Any]], None]) -> Callable[[], None]:
        self._listeners.append(fn)
        return lambda: self._listeners.remove(fn)

    def emit(self, kind: str, **data: Any) -> None:
        ev = {"type": kind, "t": round(self.clock(), 3), "state": self.state.value, **data}
        for fn in list(self._listeners):
            try:
                fn(ev)
            except Exception:  # noqa: BLE001
                log.exception("listener failed")

    def _set_state(self, s: State, **data: Any) -> None:
        if s != self.state:
            self.state = s
            self.emit("state", **data)

    # ---- lifecycle -----------------------------------------------------------------------------
    async def run(self) -> None:
        self._set_state(State.listening)
        try:
            async for frame in self.source.frames():
                if self._stopped.is_set():
                    break
                if not self.mic_enabled:
                    continue
                await self._on_frame(frame)
        finally:
            await self.interrupt(reason="shutdown")
            self._set_state(State.idle)

    async def stop(self) -> None:
        self._stopped.set()
        await self.source.close()

    # ---- frame handling ------------------------------------------------------------------------
    async def _on_frame(self, frame: np.ndarray) -> None:
        speaking = self.state == State.speaking or self.sink.playing
        events = self.vad.process(frame)
        for ev in events:
            if ev.kind == "start":
                self._utter_start = self.clock()
                self._barge_verified = False
                self._barge_rejected = False
                self._barge_checked_ms = 0.0
                self.emit("vad_start")
            elif ev.kind == "end":
                self.emit("vad_end", audio_s=round(len(ev.samples) / self.vad.sample_rate, 2))
                await self._on_utterance(ev.samples, was_speaking=speaking)
        if speaking and self.vad.in_speech and self.cfg.barge_in.enabled:
            await self._maybe_barge_in()

    async def _maybe_barge_in(self) -> None:
        bi = self.cfg.barge_in
        if self._barge_verified or self._barge_rejected:
            return
        since_play = (self.clock() - self._play_started_at) * 1000.0
        if since_play < bi.ignore_after_play_start_ms:
            return
        if self.vad.speech_ms < bi.min_speech_ms:
            return
        if self.verifier is None or not self.verifier.enabled:
            return                                    # safe mode: decided after STT in _on_utterance
        samples = self.vad.current_samples()
        audio_s = len(samples) / self.vad.sample_rate
        if audio_s < self.verifier.min_seconds:
            return
        # re-check at most every 300 ms of new audio
        if self.vad.speech_ms - self._barge_checked_ms < 300 and self._barge_checked_ms > 0:
            return
        self._barge_checked_ms = self.vad.speech_ms
        res = await asyncio.to_thread(self.verifier.verify, samples, self.vad.sample_rate)
        if res.ok:
            self._barge_verified = True
            self.stats.barge_ins += 1
            self.emit("barge_in", score=round(res.score, 3), audio_s=round(audio_s, 2))
            await self.interrupt(reason="barge_in")
            self._set_state(State.listening)
        else:
            self.emit("barge_in_ignored", score=round(res.score, 3), audio_s=round(audio_s, 2))
            # not rejected for good: a longer sample may pass; try again after 300 ms more audio

    async def _on_utterance(self, samples: np.ndarray, was_speaking: bool) -> None:
        m = TurnMetrics(speech_end=self.clock())
        if was_speaking and not self._barge_verified:
            if self.verifier is not None and self.verifier.enabled:
                # fast mode: speaker never passed while Lina spoke → treat as echo/other person
                self.stats.rejected_speaker += 1
                self.emit("rejected_speaker", reason="unverified_during_playback")
                return
        self._set_state(State.thinking)
        try:
            res = await asyncio.to_thread(self.stt.transcribe, samples, self.vad.sample_rate)
        except Exception as e:  # noqa: BLE001
            self.stats.errors += 1
            self.emit("error", where="stt", message=str(e))
            self._set_state(State.listening)
            return
        m.transcript_at = self.clock()
        text = res.text.strip()
        if not text:
            self.emit("empty_transcript")
            self._set_state(State.listening if not self.sink.playing else State.speaking)
            return
        if self.echo.is_echo(text):
            self.stats.echo_rejected += 1
            self.emit("echo_rejected", text=text)
            self._set_state(State.listening if not self.sink.playing else State.speaking)
            return
        if self.verifier is not None and self.verifier.enabled and not self._barge_verified:
            v = await asyncio.to_thread(self.verifier.verify, samples, self.vad.sample_rate)
            if not v.ok:
                self.stats.rejected_speaker += 1
                self.emit("rejected_speaker", score=round(v.score, 3), text=text)
                self._set_state(State.listening if not self.sink.playing else State.speaking)
                return
            self.emit("speaker_ok", score=round(v.score, 3))
        if was_speaking and not self._barge_verified:
            # safe mode barge-in: a real, non-echo utterance arrived while speaking
            self.stats.barge_ins += 1
            self.emit("barge_in", mode="safe")
            await self.interrupt(reason="barge_in")
        self.emit("transcript", text=text, stt_s=round(res.latency_s, 3), backend=res.backend)
        self._start_reply(text, m)          # do not await: the frame loop must keep running for barge-in

    # ---- speaking --------------------------------------------------------------------------------
    async def interrupt(self, reason: str = "user") -> None:
        """Cut playback and generation immediately."""
        self._tts_stop.set()
        self.sink.stop()
        task = self._reply_task
        if task and not task.done() and task is not asyncio.current_task():
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
        self._reply_task = None
        if reason != "shutdown":
            self.emit("interrupted", reason=reason)

    def _start_reply(self, user_text: str, metrics: TurnMetrics | None = None) -> asyncio.Task:
        self._cancel_reply_nowait()
        self.history.append({"role": "user", "content": user_text})
        self._reply_task = asyncio.create_task(self._reply(metrics or TurnMetrics(speech_end=self.clock())))
        return self._reply_task

    def _cancel_reply_nowait(self) -> None:
        self._tts_stop.set()
        self.sink.stop()
        task = self._reply_task
        if task and not task.done() and task is not asyncio.current_task():
            task.cancel()
        self._reply_task = None

    async def respond(self, user_text: str, metrics: TurnMetrics | None = None) -> None:
        """Send text to the brain and speak the streamed answer; waits for it. Cancels any reply in progress."""
        await self.interrupt(reason="new_turn")
        task = self._start_reply(user_text, metrics)
        try:
            await task
        except asyncio.CancelledError:
            pass

    async def speak(self, text: str) -> None:
        """Speak given text directly (no brain). Used by the /say endpoint and the host app."""
        await self.interrupt(reason="new_turn")
        self._reply_task = asyncio.create_task(self._speak_text(text))
        try:
            await self._reply_task
        except asyncio.CancelledError:
            pass

    async def _reply(self, m: TurnMetrics) -> None:
        self._tts_stop = threading.Event()
        sentencer = Sentencer()
        reply_parts: list[str] = []
        self._set_state(State.thinking)
        try:
            async def sentences():
                async for piece in self.brain.stream(self.history[-20:]):
                    reply_parts.append(piece)
                    for s in sentencer.feed(piece):
                        yield s
                for s in sentencer.flush():
                    yield s

            await self._speak_sentences(sentences(), m)
            full = "".join(reply_parts).strip()
            if full:
                self.history.append({"role": "assistant", "content": full})
            m.reply_done_at = self.clock()
            self.stats.turns += 1
            self.stats.last_metrics = m.as_dict()
            self.emit("reply_done", text=full, metrics=self.stats.last_metrics)
        except asyncio.CancelledError:
            partial = "".join(reply_parts).strip()
            if partial:
                self.history.append({"role": "assistant", "content": partial + " …"})
            raise
        except Exception as e:  # noqa: BLE001
            self.stats.errors += 1
            self.emit("error", where="brain", message=str(e))
            await self._speak_sentences(_aiter(["Bir bağlantı sorunu var. Tekrar deneyebilirim."]), m)
        finally:
            if self.state != State.idle:
                self._set_state(State.listening)

    async def _speak_text(self, text: str) -> None:
        self._tts_stop = threading.Event()
        sentencer = Sentencer()
        sents = list(sentencer.feed(text)) + list(sentencer.flush())
        m = TurnMetrics(speech_end=self.clock())
        try:
            await self._speak_sentences(_aiter(sents), m)
            self.emit("reply_done", text=text, metrics=m.as_dict())
        finally:
            if self.state != State.idle:
                self._set_state(State.listening)

    async def _speak_sentences(self, sentences, m: TurnMetrics) -> None:  # noqa: ANN001
        stop = self._tts_stop
        pending: asyncio.Task | None = None
        async for raw in sentences:
            text = normalize_for_speech(raw)
            if not text:
                continue
            if not m.first_sentence_at:
                m.first_sentence_at = self.clock()
            self.emit("sentence", text=text)
            if pending is not None:
                await pending
                if stop.is_set():
                    return
            pending = asyncio.create_task(asyncio.to_thread(self._synth_to_sink, text, stop, m))
        if pending is not None:
            await pending
        if stop.is_set():
            return
        await self.sink.wait_drained()

    def _synth_to_sink(self, text: str, stop: threading.Event, m: TurnMetrics) -> None:
        first = True
        for chunk in self.tts.stream(text, stop):
            if stop.is_set():
                return
            if first:
                first = False
                if not self.sink.playing:
                    self._play_started_at = self.clock()
                if not m.first_audio_at:
                    m.first_audio_at = self.clock()
                self._set_state(State.speaking)
                self.echo.note_spoken(text)
            self.sink.play(chunk, self.tts.sample_rate)

    # ---- text path -------------------------------------------------------------------------------
    async def submit_text(self, text: str) -> None:
        self.emit("transcript", text=text, backend="text")
        await self.respond(text)

    def snapshot(self) -> dict[str, Any]:
        return {"state": self.state.value, "history_len": len(self.history), "stats": self.stats.__dict__,
                "tts": getattr(getattr(self.tts, "active", None), "name", getattr(self.tts, "name", "?")),
                "stt": getattr(self.stt, "name", "?"), "brain": getattr(self.brain, "name", "?"),
                "speaker_gate": bool(self.verifier is not None and self.verifier.enabled),
                "mic_enabled": self.mic_enabled}


async def _aiter(items):  # noqa: ANN001
    for it in items:
        yield it
