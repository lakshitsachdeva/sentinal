#!/usr/bin/env bash
# demo_feed_loop.sh - runs pipeline repeatedly with dedup/prune support
# Usage: SENTINEL_MODE=demo bash scripts/demo_feed_loop.sh [--reset]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

INTERVAL="${FEED_INTERVAL:-12}"
MODE="${SENTINEL_MODE:-demo}"
RESET_ON_START="${1:-}"

log() { echo "[$(date '+%H:%M:%S')] [feed] $*"; }

if [[ "$RESET_ON_START" == "--reset" ]]; then
  log "Resetting alert DB on startup"
  .venv/bin/python - <<'PY'
import sys
sys.path.insert(0, '.')
from alerts.alert_engine import init_db, reset_alerts
init_db()
reset_alerts()
print('DB reset complete.')
PY
fi

log "Feed loop started - mode=$MODE interval=${INTERVAL}s"
RUN=0
while true; do
  RUN=$((RUN+1))
  RUN_ID="feed-$(date +%s)-$RUN"
  log "Run #$RUN starting (run_id=$RUN_ID)"

  .venv/bin/python run_pipeline.py \
    --mode "$MODE" \
    --no-dashboard \
    --run-id "$RUN_ID" \
    2>&1 | while IFS= read -r line; do log "$line"; done

  .venv/bin/python - <<'PY'
import sys
sys.path.insert(0, '.')
from alerts.alert_engine import init_db, prune_alerts
init_db()
prune_alerts(keep_per_severity=50)
PY

  TOTAL=$(.venv/bin/python - <<'PY'
import sys
import sqlite3
sys.path.insert(0, '.')
from alerts.alert_engine import DB_PATH
conn = sqlite3.connect(DB_PATH)
print(conn.execute('SELECT COUNT(*) FROM alerts').fetchone()[0])
conn.close()
PY
)

  log "Run #$RUN complete. Total alerts in DB: $TOTAL"
  log "Sleeping ${INTERVAL}s"
  sleep "$INTERVAL"
done
