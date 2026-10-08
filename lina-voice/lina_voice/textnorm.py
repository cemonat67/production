"""Turkish text normalization for speech: strip markdown/code/URLs, expand numbers, times and dates."""
from __future__ import annotations

import re

ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"]
TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"]
SCALES = [(10**9, "milyar"), (10**6, "milyon"), (1000, "bin")]
MONTHS = {1: "Ocak", 2: "Şubat", 3: "Mart", 4: "Nisan", 5: "Mayıs", 6: "Haziran", 7: "Temmuz",
          8: "Ağustos", 9: "Eylül", 10: "Ekim", 11: "Kasım", 12: "Aralık"}


def number_to_words(n: int) -> str:
    if n < 0:
        return "eksi " + number_to_words(-n)
    if n == 0:
        return "sıfır"
    parts: list[str] = []
    for value, name in SCALES:
        if n >= value:
            q, n = divmod(n, value)
            if value == 1000 and q == 1:
                parts.append(name)            # "bin", not "bir bin"
            else:
                parts.append(f"{number_to_words(q)} {name}")
    if n >= 100:
        h, n = divmod(n, 100)
        parts.append("yüz" if h == 1 else f"{ONES[h]} yüz")
    if n >= 10:
        t, n = divmod(n, 10)
        parts.append(TENS[t])
    if n > 0:
        parts.append(ONES[n])
    return " ".join(parts)


def _decimal_to_words(m: re.Match) -> str:
    whole, frac = m.group(1), m.group(2)
    frac_words = " ".join(number_to_words(int(d)) for d in frac)
    return f"{number_to_words(int(whole))} virgül {frac_words}"


def _time_to_words(m: re.Match) -> str:
    h, mi = int(m.group(1)), int(m.group(2))
    if h > 23 or mi > 59:
        return m.group(0)
    if mi == 0:
        return number_to_words(h)             # "saat 15:00" → "saat on beş" (the word "saat" is usually already there)
    return f"{number_to_words(h)} {number_to_words(mi)}"


def _date_to_words(m: re.Match) -> str:
    d, mo, y = int(m.group(1)), int(m.group(2)), m.group(3)
    if mo not in MONTHS or d < 1 or d > 31:
        return m.group(0)
    out = f"{number_to_words(d)} {MONTHS[mo]}"
    if y:
        yy = int(y)
        if yy < 100:
            yy += 2000
        out += f" {number_to_words(yy)}"
    return out


_RE_CODEBLOCK = re.compile(r"```.*?```", re.S)
_RE_INLINE_CODE = re.compile(r"`([^`]*)`")
_RE_URL = re.compile(r"https?://\S+|www\.\S+")
_RE_MD = re.compile(r"[*_#>]+")
_RE_LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_RE_BULLET = re.compile(r"^\s*(?:[-•]|\d+[.)])\s+", re.M)
_RE_DATE = re.compile(r"\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b")
_RE_TIME = re.compile(r"\b(\d{1,2}):(\d{2})\b")
_RE_PERCENT = re.compile(r"\b(\d+)\s?%|%\s?(\d+)\b")
_RE_DECIMAL = re.compile(r"\b(\d+)[,.](\d+)\b")
_RE_INT = re.compile(r"\b\d+\b")
_RE_WS = re.compile(r"[ \t]+")
_EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿⭐✅❌]")


def normalize_for_speech(text: str) -> str:
    """Turn model output into something that reads naturally aloud in Turkish."""
    t = _RE_CODEBLOCK.sub(" ", text)
    t = _RE_INLINE_CODE.sub(r"\1", t)
    t = _RE_LINK.sub(r"\1", t)
    t = _RE_URL.sub("bağlantı", t)
    t = _RE_BULLET.sub("", t)
    t = _RE_MD.sub("", t)
    t = _EMOJI.sub("", t)
    t = _RE_DATE.sub(_date_to_words, t)
    t = _RE_TIME.sub(_time_to_words, t)
    t = _RE_PERCENT.sub(lambda m: "yüzde " + number_to_words(int(m.group(1) or m.group(2))), t)
    t = _RE_DECIMAL.sub(_decimal_to_words, t)
    t = _RE_INT.sub(lambda m: number_to_words(int(m.group(0))), t)
    t = t.replace("&", " ve ").replace("@", " et ").replace("/", " bölü ")
    t = _RE_WS.sub(" ", t)
    t = re.sub(r"\n{2,}", "\n", t)
    return t.strip()


def normalize_for_match(text: str) -> str:
    """Lowercase, strip punctuation and extra spaces — used to compare transcripts with spoken text."""
    t = text.lower().replace("i̇", "i")
    t = re.sub(r"[^\w\s]", " ", t, flags=re.U)
    return re.sub(r"\s+", " ", t).strip()
