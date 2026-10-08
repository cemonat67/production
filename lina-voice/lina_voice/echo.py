"""Echo guard: reject transcripts that are really Lina's own recent speech leaking into the mic."""
from __future__ import annotations

import time
from collections import deque
from difflib import SequenceMatcher

from .textnorm import normalize_for_match


class EchoGuard:
    def __init__(self, window_s: float = 8.0, similarity: float = 0.8, clock=time.monotonic) -> None:
        self.window_s = window_s
        self.similarity = similarity
        self._clock = clock
        self._spoken: deque[tuple[float, str]] = deque(maxlen=32)

    def note_spoken(self, sentence: str) -> None:
        norm = normalize_for_match(sentence)
        if norm:
            self._spoken.append((self._clock(), norm))

    def _recent(self) -> list[str]:
        now = self._clock()
        return [s for t, s in self._spoken if now - t <= self.window_s]

    def is_echo(self, transcript: str) -> bool:
        t = normalize_for_match(transcript)
        if not t:
            return True
        words = t.split()
        for s in self._recent():
            if t in s and len(words) >= 2:
                return True                      # transcript is a substring of a spoken sentence
            ratio = SequenceMatcher(None, t, s).ratio()
            if ratio >= self.similarity:
                return True
            # Short replies people actually interrupt with ("dur", "tamam") are never echoes
            # unless they literally match a whole recent sentence, handled above.
        return False
