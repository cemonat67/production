"""Local HTTP/WebSocket server the Zero@System app (Swift shell or web UI) talks to.

  GET  /health            → backends, state
  GET  /state             → engine snapshot
  POST /say   {text}      → speak text (no brain)
  POST /text  {text}      → run text through the brain and speak the reply
  POST /interrupt         → stop speaking now
  POST /mic   {enabled}   → pause/resume listening
  WS   /events            → JSON event stream (state, transcript, sentence, barge_in, metrics …)
  WS   /audio             → host-owned audio: client sends 16 kHz mono PCM16 frames; server sends
                            24 kHz PCM16 TTS chunks and JSON control messages ({"type":"stop"}).

Binds to 127.0.0.1 only. No cloud calls.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from .audio.io import QueueSink, QueueSource, to_float32, to_pcm16
from .engine import VoiceEngine

log = logging.getLogger("lina.server")


class TextIn(BaseModel):
    text: str


class MicIn(BaseModel):
    enabled: bool


class EventHub:
    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()
        self.loop: asyncio.AbstractEventLoop | None = None
        self.recent: list[dict[str, Any]] = []

    def publish(self, ev: dict[str, Any]) -> None:
        self.recent = (self.recent + [ev])[-200:]
        loop = self.loop
        if loop is None:
            return
        for ws in list(self.clients):
            asyncio.run_coroutine_threadsafe(self._send(ws, ev), loop)

    async def _send(self, ws: WebSocket, ev: dict[str, Any]) -> None:
        try:
            await ws.send_text(json.dumps(ev, ensure_ascii=False))
        except Exception:  # noqa: BLE001
            self.clients.discard(ws)


class AudioHub:
    """Fans TTS audio out to the connected /audio client(s)."""

    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()
        self.loop: asyncio.AbstractEventLoop | None = None

    def on_chunk(self, chunk, sample_rate: int) -> None:  # noqa: ANN001
        self._broadcast_bytes(to_pcm16(chunk))

    def on_stop(self) -> None:
        self._broadcast_text(json.dumps({"type": "stop"}))

    def _broadcast_bytes(self, data: bytes) -> None:
        if self.loop:
            for ws in list(self.clients):
                asyncio.run_coroutine_threadsafe(self._safe(ws.send_bytes(data), ws), self.loop)

    def _broadcast_text(self, data: str) -> None:
        if self.loop:
            for ws in list(self.clients):
                asyncio.run_coroutine_threadsafe(self._safe(ws.send_text(data), ws), self.loop)

    async def _safe(self, coro, ws: WebSocket) -> None:  # noqa: ANN001
        try:
            await coro
        except Exception:  # noqa: BLE001
            self.clients.discard(ws)


def create_app(engine: VoiceEngine, source: QueueSource | None = None, sink: QueueSink | None = None,
               run_engine: bool = True) -> FastAPI:
    events = EventHub()
    audio = AudioHub()
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        loop = asyncio.get_running_loop()
        events.loop = loop
        audio.loop = loop
        if source is not None:
            source.bind(loop)
        if run_engine:
            app.state.task = asyncio.create_task(engine.run())
        try:
            yield
        finally:
            await engine.stop()
            if app.state.task:
                app.state.task.cancel()

    app = FastAPI(title="Lina Voice Engine", version="0.1.0", lifespan=lifespan)
    engine.subscribe(events.publish)
    if sink is not None:
        sink.on_chunk = audio.on_chunk
        sink.on_stop = audio.on_stop
    app.state.engine = engine
    app.state.task = None

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return {"ok": True, **engine.snapshot()}

    @app.get("/state")
    async def state() -> dict[str, Any]:
        return engine.snapshot()

    @app.post("/say")
    async def say(body: TextIn) -> dict[str, Any]:
        asyncio.create_task(engine.speak(body.text))
        return {"accepted": True}

    @app.post("/text")
    async def text(body: TextIn) -> dict[str, Any]:
        asyncio.create_task(engine.submit_text(body.text))
        return {"accepted": True}

    @app.post("/interrupt")
    async def interrupt() -> dict[str, Any]:
        await engine.interrupt(reason="api")
        return {"ok": True, "state": engine.state.value}

    @app.post("/mic")
    async def mic(body: MicIn) -> dict[str, Any]:
        engine.mic_enabled = body.enabled
        if not body.enabled:
            engine.vad.reset()
        return {"mic_enabled": engine.mic_enabled}

    @app.websocket("/events")
    async def ws_events(ws: WebSocket) -> None:
        await ws.accept()
        events.clients.add(ws)
        await ws.send_text(json.dumps({"type": "hello", **engine.snapshot()}, ensure_ascii=False))
        try:
            while True:
                msg = await ws.receive_text()
                try:
                    data = json.loads(msg)
                except json.JSONDecodeError:
                    continue
                if data.get("type") == "interrupt":
                    await engine.interrupt(reason="ws")
                elif data.get("type") == "text" and data.get("text"):
                    asyncio.create_task(engine.submit_text(str(data["text"])))
                elif data.get("type") == "say" and data.get("text"):
                    asyncio.create_task(engine.speak(str(data["text"])))
        except WebSocketDisconnect:
            pass
        finally:
            events.clients.discard(ws)

    @app.websocket("/audio")
    async def ws_audio(ws: WebSocket) -> None:
        await ws.accept()
        audio.clients.add(ws)
        try:
            while True:
                msg = await ws.receive()
                if msg.get("type") == "websocket.disconnect":
                    break
                if msg.get("bytes") is not None and source is not None:
                    source.push(to_float32(msg["bytes"]))
                elif msg.get("text"):
                    try:
                        data = json.loads(msg["text"])
                    except json.JSONDecodeError:
                        continue
                    if data.get("type") == "interrupt":
                        await engine.interrupt(reason="ws")
        except WebSocketDisconnect:
            pass
        finally:
            audio.clients.discard(ws)

    return app
