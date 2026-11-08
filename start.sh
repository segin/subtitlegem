#!/usr/bin/env bash
# Start SubtitleGem in production mode, installing and building first if needed.
#
#   ./start.sh            # http://<this-host>:3050, reachable from the LAN
#   PORT=4000 ./start.sh  # different port
#   ./start.sh --rebuild  # force a fresh build
set -euo pipefail

cd "$(dirname "$0")"
PORT="${PORT:-3050}"

# Install dependencies when missing or when package-lock.json changed
if [[ ! -d node_modules || package-lock.json -nt node_modules/.package-lock.json ]]; then
  echo "==> Installing dependencies"
  npm ci
fi

# npm 12+ skips install scripts, so the native SQLite module may not be built
if ! node -e 'require("better-sqlite3")(":memory:")' 2>/dev/null; then
  echo "==> Building better-sqlite3"
  (cd node_modules/better-sqlite3 && { npx --no prebuild-install || npx --no node-gyp rebuild --release; })
fi

# Rebuild when there is no build or the code (committed or not) changed since the last one
SOURCE_STATE="$( { git rev-parse HEAD; git diff HEAD -- src public package.json 'next.config.*'; } 2>/dev/null | sha1sum)"
if [[ "${1:-}" == "--rebuild" || ! -f .next/BUILD_ID || "$(cat .next/.source-state 2>/dev/null)" != "$SOURCE_STATE" ]]; then
  echo "==> Building"
  npm run build
  echo "$SOURCE_STATE" > .next/.source-state
fi

if [[ -z "${GOOGLE_GENERATIVE_AI_API_KEY:-}${GEMINI_API_KEY:-}" ]] \
   && ! grep -qsE '^(GOOGLE_GENERATIVE_AI_API_KEY|GEMINI_API_KEY)=.+' .env .env.local; then
  echo "WARNING: no Gemini API key. Put GOOGLE_GENERATIVE_AI_API_KEY=... in .env or subtitle generation will fail." >&2
fi

echo "==> Starting on http://$(hostname):$PORT"
exec npx next start -H 0.0.0.0 -p "$PORT"
