#!/usr/bin/env bash
# Installs the Lina voice engine on macOS (Apple Silicon or Intel) as a user-level launchd service.
# Reversible: scripts/uninstall-mac.sh removes the service; models and venv stay under this folder.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

command -v uv >/dev/null 2>&1 || { echo "uv not found: brew install uv  (or: curl -LsSf https://astral.sh/uv/install.sh | sh)"; exit 1; }
command -v brew >/dev/null 2>&1 && brew list portaudio >/dev/null 2>&1 || echo "note: for --audio local, run: brew install portaudio"

echo ">> python environment"
uv venv .venv -q --python 3.11 || uv venv .venv -q
uv pip install -q --python .venv/bin/python -e ".[tts,stt,audio,dev]"
# Apple Silicon extras (MLX Whisper). Non-fatal if unavailable.
if [ "$(uname -m)" = "arm64" ]; then uv pip install -q --python .venv/bin/python mlx-whisper || true; fi

echo ">> models"
bash scripts/download-models.sh

echo ">> config"
[ -f lina-voice.yaml ] || cp lina-voice.example.yaml lina-voice.yaml

echo ">> state dir + backups"
STATE="$HOME/Library/Application Support/ZeroRelationship/voice-engine"
mkdir -p "$STATE/backups"
PROFILE="$HOME/Library/Application Support/ZeroRelationship/voice/profile.json"
if [ -f "$PROFILE" ]; then
  cp -n "$PROFILE" "$STATE/backups/profile.json.$(date +%Y%m%d%H%M%S)" || true
  echo "   existing voice profile backed up (never modified): $PROFILE"
fi

echo ">> launchd service"
PLIST="$HOME/Library/LaunchAgents/com.zeroatsystem.lina-voice.plist"
sed -e "s#__ROOT__#$ROOT#g" -e "s#__HOME__#$HOME#g" scripts/com.zeroatsystem.lina-voice.plist > "$PLIST"
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
sleep 2
curl -s http://127.0.0.1:8765/health || { echo "engine did not answer; see $STATE/lina-voice.log"; exit 1; }
echo
echo "installed. doctor:"; .venv/bin/lina-voice doctor
