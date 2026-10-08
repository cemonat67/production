"""The "brain" is whatever turns a user utterance into streamed reply text.

Lina stays the single system: the engine forwards every verified utterance here and speaks the
answer. Two real backends: Ollama (default, local) and an HTTP route (the app's Chatty endpoint, so
lina-task-router can run real actions and hand back the spoken result).
"""
from __future__ import annotations

import json
from typing import AsyncIterator, Protocol

import httpx


class Brain(Protocol):
    name: str

    def stream(self, messages: list[dict]) -> AsyncIterator[str]: ...


class EchoBrain:
    """Tests: replies with scripted text, streamed in small pieces."""
    name = "echo"

    def __init__(self, replies: list[str] | None = None, piece: int = 7) -> None:
        self.replies = list(replies or [])
        self.piece = piece
        self.seen: list[list[dict]] = []

    async def stream(self, messages: list[dict]) -> AsyncIterator[str]:
        self.seen.append(messages)
        text = self.replies.pop(0) if self.replies else f"Dedin ki: {messages[-1]['content']}"
        for i in range(0, len(text), self.piece):
            yield text[i:i + self.piece]


class OllamaBrain:
    name = "ollama"

    def __init__(self, url: str = "http://127.0.0.1:11434", model: str = "gemma3:4b", system_prompt: str = "",
                 timeout_s: float = 60.0) -> None:
        self.url = url.rstrip("/")
        self.model = model
        self.system_prompt = system_prompt
        self.timeout_s = timeout_s

    async def stream(self, messages: list[dict]) -> AsyncIterator[str]:
        msgs = ([{"role": "system", "content": self.system_prompt}] if self.system_prompt else []) + messages
        payload = {"model": self.model, "messages": msgs, "stream": True, "think": False,
                   "options": {"temperature": 0.4}}
        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            async with client.stream("POST", f"{self.url}/api/chat", json=payload) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line.strip():
                        continue
                    data = json.loads(line)
                    piece = (data.get("message") or {}).get("content", "")
                    if piece:
                        yield piece
                    if data.get("done"):
                        return

    async def alive(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3) as c:
                r = await c.get(f"{self.url}/api/tags")
                return r.status_code == 200
        except Exception:
            return False


class HTTPBrain:
    """POST {message, history} to the app's local chat route; accepts SSE, NDJSON or plain chunked text."""
    name = "http"

    def __init__(self, url: str, timeout_s: float = 60.0, source: str = "lina-voice") -> None:
        self.url = url
        self.timeout_s = timeout_s
        self.source = source

    @staticmethod
    def _extract(obj) -> str:  # noqa: ANN001
        if isinstance(obj, str):
            return obj
        if isinstance(obj, dict):
            for k in ("content", "delta", "text", "token", "response"):
                v = obj.get(k)
                if isinstance(v, str):
                    return v
                if isinstance(v, dict):
                    return HTTPBrain._extract(v)
            msg = obj.get("message")
            if isinstance(msg, dict):
                return HTTPBrain._extract(msg)
        return ""

    async def stream(self, messages: list[dict]) -> AsyncIterator[str]:
        payload = {"message": messages[-1]["content"], "history": messages[:-1], "source": self.source, "stream": True}
        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            async with client.stream("POST", self.url, json=payload) as r:
                r.raise_for_status()
                ctype = r.headers.get("content-type", "")
                if "text/event-stream" in ctype or "ndjson" in ctype or "json" in ctype and "stream" in ctype:
                    async for line in r.aiter_lines():
                        line = line.strip()
                        if not line or line.startswith(":"):
                            continue
                        if line.startswith("data:"):
                            line = line[5:].strip()
                        if line in ("[DONE]", ""):
                            continue
                        try:
                            piece = self._extract(json.loads(line))
                        except json.JSONDecodeError:
                            piece = line
                        if piece:
                            yield piece
                elif "application/json" in ctype:
                    body = await r.aread()
                    piece = self._extract(json.loads(body))
                    if piece:
                        yield piece
                else:
                    async for chunk in r.aiter_text():
                        if chunk:
                            yield chunk


def build_brain(cfg) -> Brain:
    b = cfg.brain.backend
    if b == "ollama":
        return OllamaBrain(cfg.brain.ollama_url, cfg.brain.ollama_model, cfg.brain.system_prompt, cfg.brain.timeout_s)
    if b == "http":
        return HTTPBrain(cfg.brain.http_url, cfg.brain.timeout_s)
    if b == "echo":
        return EchoBrain()
    raise ValueError(f"unknown brain backend: {b}")
