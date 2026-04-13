#!/usr/bin/env bash
# sentinel_stack.sh - process manager for Sentinel DNS IDS (React + API + feed)
# Usage: ./scripts/sentinel_stack.sh [up|down|status|restart] [demo|live]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME="$ROOT/.runtime"
PIDS="$RUNTIME/pids"
LOGS="$RUNTIME/logs"

mkdir -p "$PIDS" "$LOGS"

API_PORT=8000
REACT_PORT=3000
PYTHON_BIN="$ROOT/.venv/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="$(command -v python3 || true)"
fi

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;34m'; N='\033[0m'
ok()   { echo -e "${G}[OK] $*${N}"; }
warn() { echo -e "${Y}[WARN] $*${N}"; }
fail() { echo -e "${R}[FAIL] $*${N}"; }
info() { echo -e "${B}[INFO] $*${N}"; }

port_pid() {
  (lsof -nP -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $2}' | head -1) || true
}

write_pid() {
  local name="$1" pid="$2"
  echo "$pid" > "$PIDS/$name.pid"
}

read_pid() {
  local f="$PIDS/$1.pid"
  [[ -f "$f" ]] && cat "$f" || echo ""
}

pid_alive() {
  [[ -n "$1" ]] && kill -0 "$1" 2>/dev/null
}

kill_port() {
  local port="$1" name="$2"
  local pid
  pid="$(port_pid "$port")"
  if [[ -n "$pid" ]]; then
    info "Stopping $name (pid $pid on :$port)"
    kill "$pid" 2>/dev/null || true
    sleep 1
    if pid_alive "$pid"; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    ok "Stopped $name"
  else
    info "$name not running on :$port"
  fi
  rm -f "$PIDS/$name.pid"
}

cmd_status() {
  echo
  echo "SENTINEL SERVICE STATUS"
  echo "-----------------------"

  for spec in "api:$API_PORT" "react:$REACT_PORT"; do
    local name="${spec%%:*}"
    local port="${spec##*:}"
    local pid
    local pid_file
    pid="$(port_pid "$port")"
    pid_file="$(read_pid "$name")"

    if [[ -n "$pid" ]]; then
      local managed
      [[ "$pid" == "$pid_file" ]] && managed="(managed)" || managed="(external-adopted)"
      write_pid "$name" "$pid"
      ok "$name running on :$port pid=$pid $managed"
    else
      fail "$name stopped (port $port free)"
      rm -f "$PIDS/$name.pid"
    fi
  done

  local feed_pid
  feed_pid="$(read_pid feed)"
  if pid_alive "$feed_pid"; then
    ok "feed running pid=$feed_pid"
  else
    warn "feed stopped"
    rm -f "$PIDS/feed.pid"
  fi
  echo
}

cmd_up() {
  local mode="${1:-demo}"
  info "Starting Sentinel stack (mode=$mode)"

  local api_pid
  api_pid="$(port_pid "$API_PORT")"
  if [[ -n "$api_pid" ]]; then
    warn "API already running on :$API_PORT (pid $api_pid) - adopting"
    write_pid api "$api_pid"
  else
    info "Starting API server"
    cd "$ROOT"
    nohup "$PYTHON_BIN" api/server.py --port "$API_PORT" > "$LOGS/api.log" 2>&1 &
    write_pid api $!
    sleep 1
    ok "API started on :$API_PORT -> $LOGS/api.log"
  fi

  local feed_pid
  feed_pid="$(read_pid feed)"
  if pid_alive "$feed_pid"; then
    warn "Feed loop already running (pid $feed_pid) - skipping"
  else
    info "Starting feed loop"
    nohup env SENTINEL_MODE="$mode" bash "$ROOT/scripts/demo_feed_loop.sh" > "$LOGS/feed.log" 2>&1 &
    write_pid feed $!
    sleep 1
    if pid_alive "$(read_pid feed)"; then
      ok "Feed loop started -> $LOGS/feed.log"
    else
      fail "Feed loop failed to start (check $LOGS/feed.log)"
    fi
  fi

  local react_pid
  react_pid="$(port_pid "$REACT_PORT")"
  if [[ -n "$react_pid" ]]; then
    warn "React already running on :$REACT_PORT (pid $react_pid) - adopting"
    write_pid react "$react_pid"
  else
    info "Starting React dev server"
    cd "$ROOT/showcase"
    nohup env REACT_APP_API_BASE="http://localhost:$API_PORT" npm start > "$LOGS/react.log" 2>&1 &
    write_pid react $!
    cd "$ROOT"

    info "Waiting for React to become ready"
    local tries=0
    while [[ $tries -lt 30 ]]; do
      [[ -n "$(port_pid "$REACT_PORT")" ]] && break
      sleep 1
      tries=$((tries+1))
    done
    if [[ -n "$(port_pid "$REACT_PORT")" ]]; then
      write_pid react "$(port_pid "$REACT_PORT")"
      ok "React ready on :$REACT_PORT"
    else
      warn "React may still be starting"
    fi
  fi

  echo
  ok "SENTINEL IS LIVE"
  echo "Dashboard: http://localhost:$REACT_PORT"
  echo "API:       http://localhost:$API_PORT/api/summary"
  echo
}

cmd_down() {
  info "Stopping all Sentinel services"

  for spec in "api:$API_PORT" "react:$REACT_PORT"; do
    local name="${spec%%:*}"
    local port="${spec##*:}"
    local pid
    pid="$(port_pid "$port")"
    [[ -n "$pid" ]] && write_pid "$name" "$pid"
  done

  kill_port "$API_PORT" api
  kill_port "$REACT_PORT" react

  local feed_pid
  feed_pid="$(read_pid feed)"
  if pid_alive "$feed_pid"; then
    info "Stopping feed loop (pid $feed_pid)"
    kill "$feed_pid" 2>/dev/null || true
    sleep 0.5
    if pid_alive "$feed_pid"; then
      kill -9 "$feed_pid" 2>/dev/null || true
    fi
    ok "Feed loop stopped"
  fi
  rm -f "$PIDS/feed.pid"

  ok "All services stopped"
  echo
}

cmd_restart() {
  cmd_down
  sleep 1
  cmd_up "${1:-demo}"
}

CMD="${1:-status}"
shift || true

case "$CMD" in
  up)      cmd_up "$@" ;;
  down)    cmd_down ;;
  status)  cmd_status ;;
  restart) cmd_restart "$@" ;;
  *)
    echo "Usage: $0 [up|down|status|restart] [demo|live]"
    exit 1
    ;;
esac
