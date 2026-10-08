#!/usr/bin/env bash
# Stops and removes the launchd service. Keeps models, venv, config and enrolled speaker profiles.
set -euo pipefail
PLIST="$HOME/Library/LaunchAgents/com.zeroatsystem.lina-voice.plist"
launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
echo "service removed. To delete everything: rm -rf $(cd "$(dirname "$0")/.." && pwd)/.venv models"
echo "the app's own voice/profile.json was never touched; backups are in"
echo "  $HOME/Library/Application Support/ZeroRelationship/voice-engine/backups"
