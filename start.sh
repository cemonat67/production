#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-8087}"

# site root
cd "$(dirname "$0")/dist/site"

# default route interface -> IP (en0/en1 vs otomatik)
IF="$(route -n get default 2>/dev/null | awk '/interface:/{print $2}' | head -n1)"
IP="$(ipconfig getifaddr "$IF" 2>/dev/null || true)"

# fallback: en0 / en1 dene
if [ -z "${IP:-}" ]; then
  IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
fi
if [ -z "${IP:-}" ]; then
  IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
fi

echo "✅ ZeroAtYarnDeploy serving on:"
echo "   http://${IP:-127.0.0.1}:$PORT/yarn-dpp.html"
echo ""

python3 -m http.server "$PORT"
