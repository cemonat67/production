#!/usr/bin/env bash
# Downloads every model the engine needs into ./models (idempotent, checksum-verified where available).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
M="$ROOT/models"
mkdir -p "$M/pocket-tts-tr" "$M/voices" "$M/whisper"

dl() { # url dest
  if [ -s "$2" ]; then echo "exists  $(basename "$2")"; return; fi
  echo "fetch   $(basename "$2")"; curl -fL --retry 3 -o "$2.part" "$1" && mv "$2.part" "$2"
}

SHERPA=https://github.com/k2-fsa/sherpa-onnx/releases/download
dl "$SHERPA/asr-models/silero_vad.onnx" "$M/silero_vad.onnx"
dl "$SHERPA/speaker-recongition-models/3dspeaker_speech_eres2net_sv_en_voxceleb_16k.onnx" \
   "$M/3dspeaker_speech_eres2net_sv_en_voxceleb_16k.onnx"

# Pocket TTS Turkish (kaanhgunay/pocket-tts-tr, CC BY 4.0) pinned to a commit
REV=e5aa490d9aa6075cf047e4286fb57cecb99aa1ed
HF="https://huggingface.co/kaanhgunay/pocket-tts-tr/resolve/$REV"
for f in config.yaml tokenizer.model SHA256SUMS model.safetensors; do dl "$HF/$f" "$M/pocket-tts-tr/$f"; done
(cd "$M/pocket-tts-tr" && shasum -a 256 -c SHA256SUMS)
# local config: replace hf:// references with absolute local paths
sed -e "s#hf://kaanhgunay/pocket-tts-tr/model.safetensors@v0.1-base#$M/pocket-tts-tr/model.safetensors#" \
    -e "s#hf://kaanhgunay/pocket-tts-tr/tokenizer.model@v0.1-base#$M/pocket-tts-tr/tokenizer.model#" \
    "$M/pocket-tts-tr/config.yaml" > "$M/pocket-tts-tr/config.local.yaml"

# A placeholder reference voice for first run (Kyutai tts-voices). Replace models/voices/lina-ref.wav
# with a 10–20 s clean Turkish clip of the voice Lina should have. Do NOT use Cem's own voice here:
# the speaker gate relies on Lina's voice being different from the enrolled user.
dl "https://huggingface.co/kyutai/tts-voices/resolve/main/alba-mackenna/casual.wav" "$M/voices/test-ref-en.wav"
[ -s "$M/voices/lina-ref.wav" ] || cp "$M/voices/test-ref-en.wav" "$M/voices/lina-ref.wav"

# Optional: Piper Turkish emergency fallback (MIT). Uncomment to fetch.
# mkdir -p "$M/piper"
# dl "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/tr/tr_TR/fahrettin/medium/tr_TR-fahrettin-medium.onnx" "$M/piper/tr_TR-fahrettin-medium.onnx"
# dl "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/tr/tr_TR/fahrettin/medium/tr_TR-fahrettin-medium.onnx.json" "$M/piper/tr_TR-fahrettin-medium.onnx.json"
echo "models ready in $M"
