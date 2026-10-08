#!/usr/bin/env bash
# Run the engine in the foreground (for development). --audio local uses the Mac mic/speaker directly;
# --audio ws (default) expects the Zero@ app to stream audio over ws://127.0.0.1:8765/audio.
set -euo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"
export LINA_VOICE_CONFIG="${LINA_VOICE_CONFIG:-$PWD/lina-voice.yaml}"
exec .venv/bin/lina-voice run "$@"
