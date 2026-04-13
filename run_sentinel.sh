#!/usr/bin/env bash
# run_sentinel.sh - one-command launcher for Sentinel DNS IDS
#
# Usage:
#   ./run_sentinel.sh              -> start with demo feed (default)
#   ./run_sentinel.sh --live       -> start with live packet-capture mode flag for feed loop
#   ./run_sentinel.sh --reset      -> wipe alert DB then start
#   ./run_sentinel.sh --down       -> stop everything
#   ./run_sentinel.sh --status     -> show service status
#
# Canonical UI: React dashboard (Streamlit not auto-started)

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK="$ROOT/scripts/sentinel_stack.sh"

RESET=0
MODE="demo"
CMD="up"

for arg in "$@"; do
  case "$arg" in
    --live) MODE="live" ;;
    --reset) RESET=1 ;;
    --down) CMD="down" ;;
    --status) CMD="status" ;;
    --help|-h)
      sed -n '/^# /p' "$0" | sed 's/^# //'
      exit 0
      ;;
  esac
done

if [[ "$CMD" == "down" ]]; then
  bash "$STACK" down
  exit 0
fi

if [[ "$CMD" == "status" ]]; then
  bash "$STACK" status
  exit 0
fi

if [[ "$RESET" -eq 1 ]]; then
  echo "Resetting alert database..."
  cd "$ROOT"
  PYTHON_BIN="$ROOT/.venv/bin/python"
  if [[ ! -x "$PYTHON_BIN" ]]; then
    PYTHON_BIN="$(command -v python3 || true)"
  fi
  "$PYTHON_BIN" - <<'PY'
import sys
sys.path.insert(0, '.')
from alerts.alert_engine import init_db, reset_alerts
init_db()
reset_alerts()
print('Alert DB cleared.')
PY
fi

export SENTINEL_MODE="$MODE"
bash "$STACK" up "$MODE"
