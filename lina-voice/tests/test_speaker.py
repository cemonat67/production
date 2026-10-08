"""Real speaker-gate test with the sherpa-onnx model: enroll voice A, accept A's unseen audio, reject voice B."""
import numpy as np
import pytest

from conftest import MODELS
from lina_voice.speaker.verify import SpeakerVerifier

MODEL = MODELS / "3dspeaker_speech_eres2net_sv_en_voxceleb_16k.onnx"


@pytest.mark.skipif(not MODEL.exists(), reason="speaker model not downloaded")
def test_enroll_accept_reject(tmp_path, ref_voice, ref_voice_2):
    v = SpeakerVerifier(str(MODEL), tmp_path / "speakers.json", threshold=0.55, min_seconds=0.8, profile_name="cem")
    sr = 16000
    a_enroll = [ref_voice[: 3 * sr], ref_voice[3 * sr: 6 * sr]]
    a_test = ref_voice[6 * sr: 9 * sr]
    b_test = ref_voice_2[: 3 * sr]
    v.enroll("cem", a_enroll)
    ra = v.verify(a_test)
    rb = v.verify(b_test)
    print("same-speaker score", ra.score, "other-speaker score", rb.score, "latency", ra.latency_s)
    assert ra.ok and ra.score > rb.score
    assert not rb.ok
    # persistence
    v2 = SpeakerVerifier(str(MODEL), tmp_path / "speakers.json", threshold=0.55)
    assert "cem" in v2.profiles and v2.verify(a_test).ok


@pytest.mark.skipif(not MODEL.exists(), reason="speaker model not downloaded")
def test_unenrolled_profile_rejects_everything(tmp_path, ref_voice):
    v = SpeakerVerifier(str(MODEL), tmp_path / "s.json")
    r = v.verify(ref_voice[: 16000 * 2])
    assert not r.ok and r.score == -1.0
