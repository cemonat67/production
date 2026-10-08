from lina_voice.sentencer import Sentencer


def run(chunks):
    s = Sentencer()
    out = []
    for c in chunks:
        out += list(s.feed(c))
    out += list(s.flush())
    return out


def test_streams_sentences_as_they_close():
    out = run(["Merhaba Cem. Bugün ", "üç iş var! Sistemler ", "sorunsuz mu? Evet."])
    assert out == ["Merhaba Cem.", "Bugün üç iş var!", "Sistemler sorunsuz mu?", "Evet."]


def test_abbreviations_and_decimals_do_not_split():
    out = run(["Dr. Ayşe saat 3.5 saat sürdü dedi. Tamam."])
    assert out == ["Dr. Ayşe saat 3.5 saat sürdü dedi.", "Tamam."]


def test_long_clause_flushes_at_comma():
    text = ("Bu çok uzun bir cümle, " * 10) + "sonunda bitti."
    out = run([text])
    assert len(out) >= 2
    assert all(len(x) <= 320 for x in out)


def test_newline_splits():
    assert run(["Birinci satır\nİkinci satır"]) == ["Birinci satır", "İkinci satır"]


def test_flush_returns_tail():
    s = Sentencer()
    assert list(s.feed("Bitmemiş cümle")) == []
    assert list(s.flush()) == ["Bitmemiş cümle"]
