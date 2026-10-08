"""Streaming sentence splitter: feed LLM tokens, get complete sentences as soon as they close.

Turkish-aware enough for speech: handles abbreviations like "Dr.", "vb.", decimal numbers, and
flushes a long clause at a comma/semicolon when it has grown past `soft_limit` characters so the
first audio is never delayed by a run-on paragraph.
"""
from __future__ import annotations

import re
from typing import Iterator

_ABBREV = {"dr", "prof", "doç", "av", "vb", "vs", "örn", "bkz", "sn", "no", "tel", "st", "mr", "mrs", "ms"}
_END = re.compile(r"([.!?…]+)(\s+|$)")


class Sentencer:
    def __init__(self, soft_limit: int = 160, hard_limit: int = 320) -> None:
        self.buf = ""
        self.soft_limit = soft_limit
        self.hard_limit = hard_limit

    def _is_abbrev(self, text: str, end: int) -> bool:
        word = re.findall(r"(\w+)\.$", text[:end + 1])
        if not word:
            return False
        w = word[0].lower()
        return w in _ABBREV or (w.isdigit() and len(w) <= 2)

    def _terminator(self):
        pos = 0
        m = _END.search(self.buf, pos)
        while m and self._is_abbrev(self.buf, m.start(1) + len(m.group(1)) - 1):
            pos = m.end()                     # skip "Dr." and friends, look for the next terminator
            m = _END.search(self.buf, pos)
        return m

    def _emit_upto(self, end_incl: int, skip: int = 0) -> str:
        sentence = self.buf[:end_incl].strip()
        self.buf = self.buf[end_incl + skip:].lstrip()
        return sentence

    def feed(self, chunk: str) -> Iterator[str]:
        self.buf += chunk
        while True:
            m = self._terminator()
            # 1. a short sentence closed → speak it now
            if m and m.end(1) <= self.soft_limit:
                s = self._emit_upto(m.end(1))
                if s:
                    yield s
                continue
            # 2. newline inside the window → paragraph/list boundary
            nl = self.buf.find("\n")
            if 0 <= nl <= self.soft_limit:
                s = self._emit_upto(nl, 1)
                if s:
                    yield s
                continue
            # 3. buffer already long → cut at the last clause boundary so first audio is not delayed
            if len(self.buf) >= self.soft_limit:
                limit = min(len(self.buf), self.hard_limit)
                cut = max(self.buf.rfind(", ", 0, limit), self.buf.rfind("; ", 0, limit), self.buf.rfind(": ", 0, limit))
                if cut > self.soft_limit // 2:
                    yield self._emit_upto(cut + 1)
                    continue
                if m and m.end(1) <= self.hard_limit:
                    s = self._emit_upto(m.end(1))
                    if s:
                        yield s
                    continue
                if len(self.buf) >= self.hard_limit:
                    cut = self.buf.rfind(" ", 0, self.hard_limit)
                    cut = cut if cut > 0 else self.hard_limit
                    yield self._emit_upto(cut)
                    continue
            # 4. a medium sentence (soft..hard) that is complete
            if m and m.end(1) <= self.hard_limit:
                s = self._emit_upto(m.end(1))
                if s:
                    yield s
                continue
            break

    def flush(self) -> Iterator[str]:
        rest = self.buf.strip()
        self.buf = ""
        if rest:
            yield rest
