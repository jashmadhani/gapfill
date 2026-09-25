#!/usr/bin/env bash
# One-command local run: sets up the backend venv + frontend deps on first run, then starts both servers.
set -e
cd "$(dirname "$0")"

if [ ! -d backend/.venv ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -q -r backend/requirements.txt
fi
if [ ! -d frontend/node_modules ]; then
  npm --prefix frontend install
fi

backend/.venv/bin/uvicorn app.main:app --port 8000 --app-dir backend &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT

echo ""
echo "  Traveler app:  http://localhost:5173"
echo "  Live Ops:      http://localhost:5173/ops"
echo "  Vendor:        http://localhost:5173/vendor/1   (chat onboarding: /vendor/chat)"
echo "  API docs:      http://localhost:8000/docs"
echo ""
npm --prefix frontend run dev
