import numpy as np
import pytest

from conftest import MODELS, silence, speech_like
from lina_voice.audio.vad import EnergyVAD, SileroVAD


def feed(vad, audio, frame=512):
    events = []
    for i in range(0, len(audio) - frame + 1, frame):
        events += vad.process(audio[i:i + frame])
    return events


def test_energy_vad_start_end_and_min_silence():
    vad = EnergyVAD(min_silence_ms=700, min_speech_ms=250)
    audio = np.concatenate([silence(0.5), speech_like(1.0), silence(1.0)])
    ev = feed(vad, audio)
    kinds = [e.kind for e in ev]
    assert kinds == ["start", "end"]
    assert 0.9 < len(ev[1].samples) / 16000 < 2.0


def test_energy_vad_drops_too_short_blips():
    vad = EnergyVAD(min_silence_ms=300, min_speech_ms=250)
    audio = np.concatenate([silence(0.3), speech_like(0.1), silence(1.0)])
    ev = feed(vad, audio)
    assert [e.kind for e in ev] == ["start"]       # started but never produced an utterance


def test_energy_vad_speech_ms_grows_during_speech():
    vad = EnergyVAD()
    audio = np.concatenate([silence(0.2), speech_like(0.6)])
    feed(vad, audio)
    assert vad.in_speech and vad.speech_ms >= 550
    assert len(vad.current_samples()) >= 16000 * 0.55


@pytest.mark.skipif(not (MODELS / "silero_vad.onnx").exists(), reason="silero model not downloaded")
def test_silero_detects_real_speech_and_ignores_silence(ref_voice):
    vad = SileroVAD(str(MODELS / "silero_vad.onnx"), min_silence_ms=500)
    audio = np.concatenate([silence(0.5), ref_voice[: 16000 * 3], silence(1.5)])
    ev = feed(vad, audio)
    kinds = [e.kind for e in ev]
    assert "start" in kinds and "end" in kinds
    seg = [e for e in ev if e.kind == "end"][-1].samples
    assert len(seg) / 16000 > 1.0
    vad2 = SileroVAD(str(MODELS / "silero_vad.onnx"))
    assert feed(vad2, silence(3.0)) == []
    assert feed(vad2, speech_like(2.0)) == []     # noise burst is not speech for Silero
