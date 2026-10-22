#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$ROOT_DIR"

echo "[dev] Starting Postgres via docker compose…"
docker compose up -d

echo "[dev] Loading env from .env…"
if [[ ! -f ".env" ]]; then
  echo "[dev] ERROR: .env not found. Create it from .env.example:" >&2
  echo "       cp .env.example .env" >&2
  exit 1
fi

# Export variables from .env (ignore comments and blank lines)
set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ ! -d ".venv" ]]; then
  echo "[dev] ERROR: .venv not found at repo root." >&2
  echo "       Create one and install backend deps:" >&2
  echo "       python -m venv .venv && source .venv/bin/activate && pip install -r backend/requirements.txt" >&2
  exit 1
fi

# Activate venv
# shellcheck disable=SC1091
source "$ROOT_DIR/.venv/bin/activate"

echo "[dev] Applying migrations…"
python "$ROOT_DIR/backend/manage.py" migrate

echo "[dev] Starting Django backend (http://127.0.0.1:8000)…"
python "$ROOT_DIR/backend/manage.py" runserver &
BACKEND_PID=$!

echo "[dev] Starting web dev server…"
# Install once; no-op if already installed
npm --prefix "$ROOT_DIR/web" install >/dev/null
npm --prefix "$ROOT_DIR/web" run dev &
WEB_PID=$!

cleanup() {
  echo "\n[dev] Shutting down…"
  kill "$BACKEND_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait "$BACKEND_PID" "$WEB_PID"
