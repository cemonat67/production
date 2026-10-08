"""Audio sources and sinks.

The engine never talks to hardware directly. It reads 16 kHz mono float32 frames from an
AudioSource and writes TTS chunks to an AudioSink. Two families exist:

* QueueSource / QueueSink — in-memory, used by tests and by the WebSocket transport when the host
  app (the Swift shell with Apple's voice-processing I/O) owns the microphone and speaker.
* SoundDeviceSource / SoundDeviceSink — local microphone/speaker via PortAudio (optional extra).
"""
from __future__ import annotations

import asyncio
import threading
import time
from collections import deque
from typing import AsyncIterator, Callable, Protocol

import numpy as np


def resample(x: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    """Linear-interpolation resampler. Good enough for 24 kHz → 16/44.1/48 kHz speech playback."""
    if sr_in == sr_out or len(x) == 0:
        return x.astype(np.float32, copy=False)
    n_out = int(round(len(x) * sr_out / sr_in))
    xp = np.linspace(0.0, 1.0, num=len(x), endpoint=False)
    xq = np.linspace(0.0, 1.0, num=n_out, endpoint=False)
    return np.interp(xq, xp, x).astype(np.float32)


def to_float32(pcm16: bytes) -> np.ndarray:
    return np.frombuffer(pcm16, dtype=np.int16).astype(np.float32) / 32768.0


def to_pcm16(x: np.ndarray) -> bytes:
    return (np.clip(x, -1.0, 1.0) * 32767.0).astype(np.int16).tobytes()


class AudioSource(Protocol):
    sample_rate: int

    def frames(self) -> AsyncIterator[np.ndarray]: ...
    async def close(self) -> None: ...


class AudioSink(Protocol):
    sample_rate: int

    def play(self, chunk: np.ndarray, sample_rate: int) -> None: ...
    def stop(self) -> None: ...
    @property
    def playing(self) -> bool: ...
    async def wait_drained(self) -> None: ...


class QueueSource:
    """Frames pushed in from anywhere (tests, WebSocket handler). Thread-safe push."""

    def __init__(self, sample_rate: int = 16000, frame_len: int = 512) -> None:
        self.sample_rate = sample_rate
        self.frame_len = frame_len
        self._q: asyncio.Queue[np.ndarray | None] = asyncio.Queue()
        self._rest = np.zeros(0, dtype=np.float32)
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def push(self, samples: np.ndarray) -> None:
        """Accept any length; re-frames to frame_len. Safe from other threads once bound."""
        buf = np.concatenate([self._rest, samples.astype(np.float32, copy=False)])
        n = (len(buf) // self.frame_len) * self.frame_len
        frames = [buf[i:i + self.frame_len] for i in range(0, n, self.frame_len)]
        self._rest = buf[n:]
        for f in frames:
            self._put(f)

    def _put(self, item: np.ndarray | None) -> None:
        loop = self._loop
        if loop is not None and threading.current_thread() is not threading.main_thread():
            loop.call_soon_threadsafe(self._q.put_nowait, item)
        else:
            self._q.put_nowait(item)

    async def frames(self) -> AsyncIterator[np.ndarray]:
        self._loop = asyncio.get_running_loop()
        while True:
            item = await self._q.get()
            if item is None:
                return
            yield item

    async def close(self) -> None:
        self._put(None)


class QueueSink:
    """Collects chunks and models playback time so `playing` and `wait_drained` behave like hardware.

    `on_chunk` (optional) receives (chunk, sample_rate) immediately, e.g. to forward over WebSocket.
    `on_stop` is called when playback is cut (barge-in).
    """

    def __init__(self, sample_rate: int = 24000, clock: Callable[[], float] = time.monotonic,
                 realtime: bool = True) -> None:
        self.sample_rate = sample_rate
        self._clock = clock
        self._realtime = realtime
        self._end = 0.0
        self.played: list[np.ndarray] = []
        self.stopped_count = 0
        self.on_chunk: Callable[[np.ndarray, int], None] | None = None
        self.on_stop: Callable[[], None] | None = None
        self._lock = threading.Lock()

    def play(self, chunk: np.ndarray, sample_rate: int) -> None:
        dur = len(chunk) / float(sample_rate)
        with self._lock:
            now = self._clock()
            self._end = max(now, self._end) + (dur if self._realtime else 0.0)
            self.played.append(chunk)
        if self.on_chunk:
            self.on_chunk(chunk, sample_rate)

    def stop(self) -> None:
        with self._lock:
            self._end = 0.0
            self.stopped_count += 1
        if self.on_stop:
            self.on_stop()

    @property
    def playing(self) -> bool:
        return self._clock() < self._end

    async def wait_drained(self) -> None:
        while True:
            remaining = self._end - self._clock()
            if remaining <= 0:
                return
            await asyncio.sleep(min(remaining, 0.05))

    def total_seconds(self) -> float:
        return sum(len(c) for c in self.played) / float(self.sample_rate)


class SoundDeviceSource:
    """Local microphone via sounddevice. Frames are delivered on the asyncio loop."""

    def __init__(self, sample_rate: int = 16000, frame_len: int = 512, device: str | int | None = None) -> None:
        import sounddevice as sd  # optional dependency
        self._sd = sd
        self.sample_rate = sample_rate
        self.frame_len = frame_len
        self.device = device
        self._inner = QueueSource(sample_rate, frame_len)
        self._stream = None

    async def frames(self) -> AsyncIterator[np.ndarray]:
        self._inner.bind(asyncio.get_running_loop())

        def cb(indata, frames, time_info, status):  # noqa: ANN001
            self._inner.push(indata[:, 0].copy())

        self._stream = self._sd.InputStream(samplerate=self.sample_rate, channels=1, dtype="float32",
                                            blocksize=self.frame_len, device=self.device, callback=cb)
        self._stream.start()
        try:
            async for f in self._inner.frames():
                yield f
        finally:
            self._stream.stop(); self._stream.close()

    async def close(self) -> None:
        await self._inner.close()


class SoundDeviceSink:
    """Local speaker via sounddevice with an interruptible ring buffer."""

    def __init__(self, sample_rate: int = 24000, device: str | int | None = None) -> None:
        import sounddevice as sd
        self._sd = sd
        self.sample_rate = sample_rate
        self._buf: deque[np.ndarray] = deque()
        self._pending = 0
        self._lock = threading.Lock()
        self._stream = sd.OutputStream(samplerate=sample_rate, channels=1, dtype="float32",
                                       device=device, callback=self._cb)
        self._stream.start()

    def _cb(self, outdata, frames, time_info, status):  # noqa: ANN001
        out = np.zeros(frames, dtype=np.float32)
        pos = 0
        with self._lock:
            while pos < frames and self._buf:
                chunk = self._buf[0]
                take = min(frames - pos, len(chunk))
                out[pos:pos + take] = chunk[:take]
                pos += take
                if take == len(chunk):
                    self._buf.popleft()
                else:
                    self._buf[0] = chunk[take:]
                self._pending -= take
        outdata[:, 0] = out

    def play(self, chunk: np.ndarray, sample_rate: int) -> None:
        chunk = resample(chunk, sample_rate, self.sample_rate)
        with self._lock:
            self._buf.append(chunk)
            self._pending += len(chunk)

    def stop(self) -> None:
        with self._lock:
            self._buf.clear()
            self._pending = 0

    @property
    def playing(self) -> bool:
        with self._lock:
            return self._pending > 0

    async def wait_drained(self) -> None:
        while self.playing:
            await asyncio.sleep(0.02)
