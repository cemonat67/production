from lina_voice.textnorm import normalize_for_match, normalize_for_speech, number_to_words


def test_numbers():
    assert number_to_words(0) == "sıfır"
    assert number_to_words(7) == "yedi"
    assert number_to_words(15) == "on beş"
    assert number_to_words(100) == "yüz"
    assert number_to_words(250) == "iki yüz elli"
    assert number_to_words(1000) == "bin"
    assert number_to_words(2026) == "iki bin yirmi altı"
    assert number_to_words(1_500_000) == "bir milyon beş yüz bin"


def test_speech_normalization_numbers_dates_times():
    out = normalize_for_speech("Toplantı 15:30'da, 3 iş açık, %20 artış, 27.09.2026 tarihinde.")
    assert "on beş otuz" in out
    assert "üç iş" in out
    assert "yüzde yirmi" in out
    assert "yirmi yedi Eylül iki bin yirmi altı" in out


def test_speech_normalization_strips_markdown_code_urls():
    out = normalize_for_speech("**Önemli:** `git status` çalıştır.\n- madde bir\n- madde iki\nBkz https://example.com/x")
    assert "*" not in out and "`" not in out and "https" not in out
    assert "bağlantı" in out
    assert "madde bir" in out and "- " not in out


def test_full_hour_does_not_duplicate_saat():
    assert normalize_for_speech("Toplantı saat 15:00'te") == "Toplantı saat on beş'te"


def test_decimal():
    assert "iki virgül beş" in normalize_for_speech("CO2 değeri 2,5 kg")


def test_match_normalization():
    assert normalize_for_match("Merhaba, Cem!  Nasılsın?") == "merhaba cem nasılsın"
