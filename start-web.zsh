#!/usr/bin/env zsh
set -euo pipefail

# One-command local startup for the OIPay web app.
# Safe defaults:
# - applies committed Prisma migrations
# - does NOT reset database unless --reset-db is passed

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$ROOT_DIR/web"

RESET_DB=false
RUN_SEED=false
SKIP_INSTALL=false
LOCAL_DB=false
PORT=""

print_help() {
  printf '%s\n' \
    'OIPay web startup script' \
    '' \
    'Usage:' \
    '  ./start-web.zsh [options]' \
    '' \
    'Options:' \
    '  --local-db      Start the legacy local Docker Postgres database' \
    '  --reset-db      Reset the local database, then seed demo data (destructive)' \
    '  --seed          Run seed data without resetting database' \
    '  --skip-install  Skip npm install' \
    '  --port <port>   Run Next.js on a specific port' \
    '  -h, --help      Show this help' \
    '' \
    'Examples:' \
    '  ./start-web.zsh' \
    '  ./start-web.zsh --local-db --reset-db' \
    '  ./start-web.zsh --port 3001'
}

log() {
  echo "[web-start] $1"
}

fail() {
  echo "[web-start] ERROR: $1" >&2
  exit 1
}

check_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required tool: $1"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --reset-db)
        RESET_DB=true
        RUN_SEED=true
        shift
        ;;
      --local-db)
        LOCAL_DB=true
        shift
        ;;
      --seed)
        RUN_SEED=true
        shift
        ;;
      --skip-install)
        SKIP_INSTALL=true
        shift
        ;;
      --skip-docker)
        LOCAL_DB=false
        shift
        ;;
      --port)
        [[ $# -ge 2 ]] || fail "--port needs a value"
        PORT="$2"
        shift 2
        ;;
      -h|--help)
        print_help
        exit 0
        ;;
      *)
        fail "Unknown option: $1 (use --help)"
        ;;
    esac
  done
}

ensure_env_file() {
  if [[ ! -f "$WEB_DIR/.env" ]]; then
    if [[ -f "$WEB_DIR/.env.example" ]]; then
      cp "$WEB_DIR/.env.example" "$WEB_DIR/.env"
      log "Created web/.env from web/.env.example"
      log "Add the Supabase connection values before starting the app."
    else
      fail "web/.env and web/.env.example are both missing"
    fi
  fi
}

ensure_docker() {
  $LOCAL_DB || return 0
  check_cmd docker

  if ! docker info >/dev/null 2>&1; then
    fail "Docker is not running. Please open Docker Desktop and retry."
  fi

  log "Starting Postgres via docker compose..."
  (cd "$ROOT_DIR" && docker compose up -d)
}

install_deps() {
  $SKIP_INSTALL && return 0
  log "Installing the exact npm lockfile in web/..."
  npm --prefix "$WEB_DIR" ci
}

setup_db() {
  log "Generating Prisma client..."
  npm --prefix "$WEB_DIR" run prisma:generate

  if $RESET_DB; then
    $LOCAL_DB || fail "--reset-db is allowed only with --local-db"
    log "Resetting the local database and replaying migrations..."
    (cd "$WEB_DIR" && npx prisma migrate reset --force)
  else
    log "Applying committed database migrations..."
    npm --prefix "$WEB_DIR" run prisma:deploy
  fi

  if $RUN_SEED; then
    log "Seeding demo data..."
    npm --prefix "$WEB_DIR" run prisma:seed
  fi
}

start_dev_server() {
  log "Starting web app..."
  if [[ -n "$PORT" ]]; then
    log "Open: http://localhost:$PORT"
    npm --prefix "$WEB_DIR" run dev -- --port "$PORT"
  else
    log "Open the local URL printed by Next.js (usually http://localhost:3000)."
    npm --prefix "$WEB_DIR" run dev
  fi
}

main() {
  parse_args "$@"

  check_cmd node
  check_cmd npm
  check_cmd npx

  [[ -d "$WEB_DIR" ]] || fail "web/ directory not found"

  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  [[ "$NODE_MAJOR" == "24" ]] || fail "Node.js 24 is required (current: $(node --version))"

  ensure_env_file
  ensure_docker
  install_deps
  setup_db
  start_dev_server
}

main "$@"
