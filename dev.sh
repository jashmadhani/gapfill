#!/usr/bin/env bash
# One-command local run: sets up the backend venv + frontend deps on first run, then starts both servers.
set -e
cd "$(dirname "$0")"

PY=python3
command -v $PY >/dev/null 2>&1 || PY=python
BIN=backend/.venv/bin
[ -d backend/.venv/Scripts ] && BIN=backend/.venv/Scripts  # Windows (Git Bash)

if [ ! -d backend/.venv ]; then
  $PY -m venv backend/.venv
  [ -d backend/.venv/Scripts ] && BIN=backend/.venv/Scripts
  $BIN/python -m pip install -q -r backend/requirements.txt
fi
if [ ! -d frontend/node_modules ]; then
  npm --prefix frontend install
fi

$BIN/python -m uvicorn app.main:app --port 8000 --app-dir backend &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT

echo ""
echo "  Traveler app:      http://localhost:5173"
echo "  Live Ops demo:     http://localhost:5173/ops"
echo "  Operator console:  http://localhost:5173/operator"
echo "  Vendor portal:     http://localhost:5173/vendor/1"
echo "  API docs:          http://localhost:8000/docs"
echo ""
npm --prefix frontend run dev
