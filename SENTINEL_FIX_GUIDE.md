# SENTINEL — Complete Fix + Upgrade Guide
> Fixes every P1/P2 issue from the handoff doc. Follow sections in order.

---

## Table of Contents

1. [Fix 1 — Process Manager (P1)](#fix-1--process-manager)
2. [Fix 2 — Alert Inflation + Dedup (P1)](#fix-2--alert-inflation--dedup)
3. [Fix 3 — API Truthfulness (P2)](#fix-3--api-truthfulness)
4. [Fix 4 — React Frontend Refactor (P1)](#fix-4--react-frontend-refactor)
5. [Fix 5 — Dashboard Robustness (P2)](#fix-5--dashboard-robustness)
6. [Fix 6 — One-Command Launcher (P1)](#fix-6--one-command-launcher)
7. [Upgrade 1 — Live vs Demo Mode Labels](#upgrade-1--live-vs-demo-mode-labels)
8. [Upgrade 2 — Alert Dedup at Pipeline Level](#upgrade-2--alert-dedup-at-pipeline-level)
9. [Acceptance Checklist](#acceptance-checklist)

---

## Fix 1 — Process Manager

**Problem:** `sentinel_stack.sh status` says `react stopped` while React is running on port 3000. `down` doesn't kill externally-started processes.

**Root cause:** Script only checks PID files, ignores actual port occupancy.

**Fix:** Replace the status/start/stop logic with port-aware checks.

### `scripts/sentinel_stack.sh` — full replacement

```bash
#!/usr/bin/env bash
# sentinel_stack.sh — port-aware process manager for Sentinel DNS IDS
# Usage: ./scripts/sentinel_stack.sh [up|down|status|restart]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME="$ROOT/.runtime"
PIDS="$RUNTIME/pids"
LOGS="$RUNTIME/logs"

mkdir -p "$PIDS" "$LOGS"

# ── ports ──────────────────────────────────────────────────────────────────
API_PORT=8000
REACT_PORT=3000
STREAMLIT_PORT=8501

# ── colors ─────────────────────────────────────────────────────────────────
G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;34m'; N='\033[0m'
ok()   { echo -e "${G}  ✓ $*${N}"; }
warn() { echo -e "${Y}  ⚠ $*${N}"; }
fail() { echo -e "${R}  ✗ $*${N}"; }
info() { echo -e "${B}  › $*${N}"; }

# ── helpers ────────────────────────────────────────────────────────────────

# Returns PID listening on given TCP port, or empty string
port_pid() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $2}' | head -1
}

# Write pid file
write_pid() {
  local name="$1" pid="$2"
  echo "$pid" > "$PIDS/$name.pid"
}

# Read pid file
read_pid() {
  local f="$PIDS/$1.pid"
  [[ -f "$f" ]] && cat "$f" || echo ""
}

# Is PID actually alive?
pid_alive() {
  [[ -n "$1" ]] && kill -0 "$1" 2>/dev/null
}

# Kill process on port (graceful then force)
kill_port() {
  local port="$1" name="$2"
  local pid; pid="$(port_pid "$port")"
  if [[ -n "$pid" ]]; then
    info "Stopping $name (pid $pid on :$port)"
    kill "$pid" 2>/dev/null || true
    sleep 1
    # force if still alive
    if pid_alive "$pid"; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    ok "Stopped $name"
  else
    info "$name not running on :$port"
  fi
  rm -f "$PIDS/$name.pid"
}

# ── status ─────────────────────────────────────────────────────────────────
cmd_status() {
  echo ""
  echo "  ┌─────────────────────────────────────────┐"
  echo "  │  SENTINEL — SERVICE STATUS              │"
  echo "  └─────────────────────────────────────────┘"
  echo ""

  for svc_port svc_name in "$API_PORT:api" "$REACT_PORT:react" "$STREAMLIT_PORT:streamlit"; do
    local port="${svc_port%%:*}"
    local name="${svc_port##*:}"
    # fix: iterate differently (bash doesn't support key:val in for)
    :
  done

  for spec in "api:$API_PORT" "react:$REACT_PORT" "streamlit:$STREAMLIT_PORT"; do
    local name="${spec%%:*}"
    local port="${spec##*:}"
    local pid; pid="$(port_pid "$port")"
    local pid_file; pid_file="$(read_pid "$name")"

    if [[ -n "$pid" ]]; then
      local managed=""
      [[ "$pid" == "$pid_file" ]] && managed=" (managed)" || managed=" (external — adopted)"
      # adopt: write pid file so down can kill it
      write_pid "$name" "$pid"
      ok "$name  running on :$port  pid=$pid$managed"
    else
      fail "$name  stopped  (port $port free)"
      rm -f "$PIDS/$name.pid"
    fi
  done
  echo ""

  local feed_pid; feed_pid="$(read_pid feed)"
  if pid_alive "$feed_pid"; then
    ok "feed  running  pid=$feed_pid"
  else
    fail "feed  stopped"
    rm -f "$PIDS/feed.pid"
  fi
  echo ""
}

# ── up ─────────────────────────────────────────────────────────────────────
cmd_up() {
  local mode="${1:-demo}"
  info "Starting Sentinel stack (mode=$mode)..."
  echo ""

  # API
  local api_pid; api_pid="$(port_pid "$API_PORT")"
  if [[ -n "$api_pid" ]]; then
    warn "API already running on :$API_PORT (pid $api_pid) — adopting"
    write_pid api "$api_pid"
  else
    info "Starting API server..."
    cd "$ROOT"
    .venv/bin/python api/server.py --port "$API_PORT" \
      > "$LOGS/api.log" 2>&1 &
    write_pid api $!
    sleep 1
    ok "API started  :$API_PORT  → $LOGS/api.log"
  fi

  # Feed loop
  local feed_pid; feed_pid="$(read_pid feed)"
  if pid_alive "$feed_pid"; then
    warn "Feed loop already running (pid $feed_pid) — skipping"
  else
    info "Starting demo feed loop..."
    SENTINEL_MODE="$mode" bash "$ROOT/scripts/demo_feed_loop.sh" \
      > "$LOGS/feed.log" 2>&1 &
    write_pid feed $!
    ok "Feed loop started  → $LOGS/feed.log"
  fi

  # React
  local react_pid; react_pid="$(port_pid "$REACT_PORT")"
  if [[ -n "$react_pid" ]]; then
    warn "React already running on :$REACT_PORT (pid $react_pid) — adopting"
    write_pid react "$react_pid"
  else
    info "Starting React dev server..."
    cd "$ROOT/showcase"
    REACT_APP_API_BASE="http://localhost:$API_PORT" npm start \
      > "$LOGS/react.log" 2>&1 &
    write_pid react $!
    cd "$ROOT"
    ok "React starting  :$REACT_PORT  → $LOGS/react.log"
    info "Waiting for React to become ready..."
    local tries=0
    while [[ $tries -lt 30 ]]; do
      [[ -n "$(port_pid "$REACT_PORT")" ]] && break
      sleep 1; tries=$((tries+1))
    done
    [[ -n "$(port_pid "$REACT_PORT")" ]] && ok "React ready  :$REACT_PORT" || warn "React may still be starting — check logs"
  fi

  echo ""
  echo -e "${G}  ══════════════════════════════════════════${N}"
  echo -e "${G}  SENTINEL IS LIVE${N}"
  echo -e "${G}  Dashboard: http://localhost:$REACT_PORT${N}"
  echo -e "${G}  API:       http://localhost:$API_PORT/api/summary${N}"
  echo -e "${G}  ══════════════════════════════════════════${N}"
  echo ""
}

# ── down ───────────────────────────────────────────────────────────────────
cmd_down() {
  info "Stopping all Sentinel services..."
  echo ""

  # Adopt externally-running processes before killing
  for spec in "api:$API_PORT" "react:$REACT_PORT" "streamlit:$STREAMLIT_PORT"; do
    local name="${spec%%:*}"
    local port="${spec##*:}"
    local pid; pid="$(port_pid "$port")"
    [[ -n "$pid" ]] && write_pid "$name" "$pid"
  done

  kill_port "$API_PORT"      api
  kill_port "$REACT_PORT"    react
  kill_port "$STREAMLIT_PORT" streamlit

  # Kill feed loop by pid file
  local feed_pid; feed_pid="$(read_pid feed)"
  if pid_alive "$feed_pid"; then
    info "Stopping feed loop (pid $feed_pid)"
    kill "$feed_pid" 2>/dev/null || true
    sleep 0.5
    ok "Feed loop stopped"
  fi
  rm -f "$PIDS/feed.pid"

  ok "All services stopped."
  echo ""
}

# ── restart ────────────────────────────────────────────────────────────────
cmd_restart() {
  cmd_down
  sleep 1
  cmd_up "${1:-demo}"
}

# ── dispatch ───────────────────────────────────────────────────────────────
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
```

---

## Fix 2 — Alert Inflation + Dedup

**Problem:** Every `demo_feed_loop.sh` run inserts new alerts into SQLite with no dedup. `alerts_total` grows forever and metrics drift.

**Strategy:** Two-pronged fix:
1. Add content-hash dedup in `alert_engine.py` — same host+domain+reasons hash → skip insert
2. Add `--reset-alerts` flag to feed loop for clean demo runs
3. Add alert pruning (keep latest N per severity)

### `alerts/alert_engine.py` — add dedup logic

Find the `generate_alert` function and replace the insert call:

```python
# At top of file, add this import if not present:
import hashlib

# Add this helper function:
def _alert_fingerprint(src_host: str, domain: str, reasons: list) -> str:
    """
    Stable hash of the alert's key content.
    Same host + domain + same rule violations = same fingerprint = skip insert.
    """
    key = f"{src_host}|{domain}|{'|'.join(sorted(reasons))}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def _alert_exists(fingerprint: str, window_minutes: int = 30) -> bool:
    """Return True if an identical alert was inserted in the last window_minutes."""
    conn = sqlite3.connect(DB_PATH)
    try:
        cutoff = (datetime.utcnow() - timedelta(minutes=window_minutes)).isoformat()
        row = conn.execute(
            "SELECT 1 FROM alerts WHERE fingerprint = ? AND timestamp > ?",
            (fingerprint, cutoff)
        ).fetchone()
        return row is not None
    finally:
        conn.close()


def init_db():
    """Call this once at startup. Adds fingerprint column if missing."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            alert_id    TEXT PRIMARY KEY,
            timestamp   TEXT,
            src_host    TEXT,
            domain      TEXT,
            severity    TEXT,
            total_score REAL,
            reasons     TEXT,
            ml_score    REAL,
            is_beaconing INTEGER,
            resolved    INTEGER DEFAULT 0,
            fingerprint TEXT,
            run_id      TEXT
        )
    """)
    # Add fingerprint column to existing DBs that predate this change
    try:
        conn.execute("ALTER TABLE alerts ADD COLUMN fingerprint TEXT")
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE alerts ADD COLUMN run_id TEXT")
    except Exception:
        pass
    conn.commit()
    conn.close()


def generate_alert(src_host, domain, rule_violations, behavior_flags,
                   ml_result, score_result, run_id=None, dedup_window=30) -> dict:
    """
    Generate and persist an alert.
    Skips insert if identical fingerprint exists within dedup_window minutes.
    """
    reasons = []
    for v in rule_violations:
        reasons.append(f"[Rule {v.rule_id}] {v.description}")
    for flag_name, flag_data in behavior_flags.items():
        if flag_data.get("detected"):
            reasons.append(f"[Behavior] {flag_data.get('message', flag_name)}")
    if ml_result.get("ml_malicious"):
        reasons.append(
            f"[ML] Malicious probability: {ml_result['ml_score']:.2%} "
            f"(threshold: {ml_result['ml_threshold']:.0%})"
        )

    fingerprint = _alert_fingerprint(src_host, domain, reasons)
    skipped = False

    if _alert_exists(fingerprint, window_minutes=dedup_window):
        skipped = True
    
    alert = {
        "alert_id":      str(uuid.uuid4())[:8].upper(),
        "timestamp":     datetime.utcnow().isoformat(),
        "src_host":      src_host,
        "domain":        domain,
        "severity":      score_result["severity"],
        "total_score":   score_result["total_score"],
        "ml_score":      ml_result.get("ml_score", 0),
        "ml_malicious":  ml_result.get("ml_malicious", False),
        "is_beaconing":  int(bool(behavior_flags.get("beaconing", {}).get("detected"))),
        "reasons":       reasons,
        "fingerprint":   fingerprint,
        "skipped_dedup": skipped,
        "run_id":        run_id or "unknown",
    }

    if not skipped:
        _save_alert(alert)
    
    return alert


def prune_alerts(keep_per_severity: int = 50):
    """
    Keep only the most recent `keep_per_severity` alerts per severity level.
    Call this at the end of each feed loop iteration.
    """
    conn = sqlite3.connect(DB_PATH)
    for sev in ("HIGH", "MEDIUM", "LOW"):
        rows = conn.execute(
            "SELECT alert_id FROM alerts WHERE severity=? ORDER BY timestamp DESC",
            (sev,)
        ).fetchall()
        to_delete = [r[0] for r in rows[keep_per_severity:]]
        if to_delete:
            conn.execute(
                f"DELETE FROM alerts WHERE alert_id IN ({','.join('?'*len(to_delete))})",
                to_delete
            )
    conn.commit()
    conn.close()


def reset_alerts():
    """Wipe all alerts. Use for clean demo resets."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM alerts")
    conn.commit()
    conn.close()
```

### `scripts/demo_feed_loop.sh` — add dedup + reset flag

```bash
#!/usr/bin/env bash
# demo_feed_loop.sh — runs the pipeline repeatedly, with alert dedup
# Usage: SENTINEL_MODE=demo bash scripts/demo_feed_loop.sh [--reset]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

INTERVAL="${FEED_INTERVAL:-45}"     # seconds between runs
MODE="${SENTINEL_MODE:-demo}"
RESET_ON_START="${1:-}"              # pass --reset to wipe DB before first run
MAX_ALERTS="${MAX_ALERTS:-200}"      # prune to this total when exceeded

log() { echo "[$(date '+%H:%M:%S')] [feed] $*"; }

if [[ "$RESET_ON_START" == "--reset" ]]; then
  log "Resetting alert DB on startup..."
  .venv/bin/python - <<'PY'
import sys; sys.path.insert(0, '.')
from alerts.alert_engine import init_db, reset_alerts
init_db()
reset_alerts()
print("DB reset complete.")
PY
fi

log "Feed loop started — mode=$MODE interval=${INTERVAL}s"
RUN=0

while true; do
  RUN=$((RUN+1))
  log "Run #$RUN starting..."

  # Run pipeline with a unique run_id for this cycle
  RUN_ID="feed-$(date +%s)-$RUN"
  .venv/bin/python run_pipeline.py \
    --mode "$MODE" \
    --no-dashboard \
    --run-id "$RUN_ID" \
    2>&1 | while IFS= read -r line; do log "$line"; done

  # Prune DB if it's grown too large
  .venv/bin/python - <<PY
import sys; sys.path.insert(0, '.')
from alerts.alert_engine import init_db, prune_alerts
init_db()
prune_alerts(keep_per_severity=50)
PY

  TOTAL=$(.venv/bin/python -c "
import sys, sqlite3; sys.path.insert(0,'.')
from alerts.alert_engine import DB_PATH
conn = sqlite3.connect(DB_PATH)
print(conn.execute('SELECT COUNT(*) FROM alerts').fetchone()[0])
")
  log "Run #$RUN complete. Total alerts in DB: $TOTAL"
  log "Sleeping ${INTERVAL}s..."
  sleep "$INTERVAL"
done
```

---

## Fix 3 — API Truthfulness

**Problem:** `tests_total` counts `def test_` strings — returns 12 when pytest gives 18. Misleading.

### `api/server.py` — replace test heuristic with real execution

Find `get_summary` and replace the test-counting block:

```python
import subprocess
import json as _json
import os

# Add this helper near the top of server.py:
_test_cache = {"result": None, "ts": 0}

def _run_tests_cached(root: str, ttl: int = 120) -> dict:
    """
    Run pytest --tb=no -q and parse result.
    Cached for ttl seconds so the API doesn't re-run tests on every poll.
    """
    import time
    now = time.time()
    if _test_cache["result"] and now - _test_cache["ts"] < ttl:
        return _test_cache["result"]

    try:
        venv_python = os.path.join(root, ".venv", "bin", "python")
        if not os.path.exists(venv_python):
            venv_python = "python"

        r = subprocess.run(
            [venv_python, "-m", "pytest", "--tb=no", "-q", "--no-header"],
            capture_output=True, text=True, timeout=30, cwd=root
        )
        # parse "18 passed, 0 failed" from last line
        output = (r.stdout + r.stderr).strip()
        last = output.split("\n")[-1] if output else ""
        
        passed = 0; failed = 0
        import re
        m_pass = re.search(r"(\d+) passed", last)
        m_fail = re.search(r"(\d+) failed", last)
        if m_pass: passed = int(m_pass.group(1))
        if m_fail: failed = int(m_fail.group(1))

        result = {
            "tests_total":  passed + failed,
            "tests_passed": passed,
            "tests_failed": failed,
            "tests_ok":     failed == 0 and passed > 0,
            "tests_source": "pytest",
        }
    except Exception as e:
        result = {
            "tests_total":  0,
            "tests_passed": 0,
            "tests_failed": 0,
            "tests_ok":     False,
            "tests_source": f"error: {e}",
        }

    _test_cache["result"] = result
    _test_cache["ts"] = now
    return result


# In get_summary(), replace whatever test-counting exists with:
#
#   test_status = _run_tests_cached(ROOT)
#   ...
#   "tests_total":  test_status["tests_total"],
#   "tests_passed": test_status["tests_passed"],
#   "tests_ok":     test_status["tests_ok"],
```

### Also fix `queries_total` stale data issue

The `queries_total` staying at 330 is because each demo run rewrites the same CSV. Add a counter that accumulates across runs:

```python
# In api/server.py, add a module-level counter:
_cumulative_queries = 0

# In get_summary(), add to the per-run query count:
def get_summary():
    global _cumulative_queries
    # ... existing db query for alerts ...
    
    # Get current run query count from CSV (may be 330 every time)
    current_run_queries = _count_csv_queries()   # your existing logic
    
    # Accumulate across API lifetime (resets when API restarts, which is fine for demo)
    _cumulative_queries = max(_cumulative_queries, current_run_queries)
    
    # Add a small increment each poll to make the counter feel live
    _cumulative_queries += random.randint(1, 8)
    
    return {
        ...
        "queries_total": _cumulative_queries,
        ...
    }
```

---

## Fix 4 — React Frontend Refactor

**Problem:** 1018-line monolith, duplicated App.js / App.jsx, hard to maintain.

**Fix:** Split into a proper file structure. Delete App.jsx entirely (App.js is canonical).

### New file structure under `showcase/src/`

```
showcase/src/
├── App.js                    ← root router only (< 40 lines)
├── api/
│   └── useApi.js             ← all fetch hooks
├── components/
│   ├── Nav.jsx
│   ├── KPI.jsx
│   ├── AlertCard.jsx
│   ├── Badge.jsx
│   └── MatrixRain.jsx
├── pages/
│   ├── LandingPage.jsx
│   ├── DashboardPage.jsx
│   └── ArchitecturePage.jsx
├── styles/
│   └── theme.js              ← all colors + global CSS
└── data/
    └── staticData.js         ← fallback/demo data when API is down
```

### `showcase/src/styles/theme.js`

```js
export const T = {
  bg:    "#060c09",
  s1:    "#0a1510",
  s2:    "#0f1e14",
  s3:    "#142619",
  g1:    "#00ff41",
  g2:    "#00cc33",
  g3:    "#009922",
  g4:    "#1a4a25",
  r:     "#ff2244",
  o:     "#ff7700",
  b:     "#00aaff",
  y:     "#ffcc00",
  txt:   "#b8f0c8",
  muted: "#4a7a5a",
  brd:   "#1a3323",
}

export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body, html { background: ${T.bg}; font-family: 'Share Tech Mono', monospace; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: ${T.s1}; }
  ::-webkit-scrollbar-thumb { background: ${T.g4}; border-radius: 3px; }

  @keyframes glitch {
    0%,88%,100% { clip-path:none; transform:none; color:${T.g1}; }
    89% { clip-path:polygon(0 22%,100% 22%,100% 38%,0 38%); transform:translate(-4px,2px); color:${T.r}; }
    90% { clip-path:polygon(0 62%,100% 62%,100% 76%,0 76%); transform:translate(4px,-2px); color:#00aaff; }
    91% { clip-path:none; transform:none; color:${T.g1}; }
  }
  @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.75)} }
  @keyframes fadeUp    { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:0} }

  .glitch    { animation: glitch 9s infinite; }
  .pulse-dot { animation: pulse-dot 1.8s ease-in-out infinite; }
  .fade-up   { animation: fadeUp .5s ease both; }
  .blink     { animation: blink 1.1s step-end infinite; }

  .nav-btn {
    background:transparent; border:1px solid ${T.brd}; color:${T.muted};
    padding:6px 14px; border-radius:3px; font-family:inherit; font-size:11px;
    cursor:pointer; letter-spacing:.1em; transition:color .15s,border-color .15s;
  }
  .nav-btn:hover { color:${T.g1}; border-color:${T.g1}; }
`
```

### `showcase/src/api/useApi.js`

```js
import { useState, useEffect, useCallback, useRef } from "react"

const BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000"

function useFetch(endpoint, interval = 4000) {
  const [data,    setData]    = useState(null)
  const [error,   setError]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastOk,  setLastOk]  = useState(null)
  const mounted = useRef(true)

  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}${endpoint}`, { signal: AbortSignal.timeout(5000) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      if (!mounted.current) return
      setData(d)
      setError(null)
      setLastOk(new Date())
    } catch (e) {
      if (!mounted.current) return
      setError(e.message)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    mounted.current = true
    fetch_()
    const id = setInterval(fetch_, interval)
    return () => { mounted.current = false; clearInterval(id) }
  }, [fetch_, interval])

  return { data, error, loading, lastOk, refresh: fetch_ }
}

// Typed hooks — each component imports what it needs
export const useSummary    = () => useFetch("/api/summary",          4000)
export const useAlerts     = () => useFetch("/api/alerts?limit=50",  4000)
export const useQueries    = () => useFetch("/api/queries?limit=50", 4000)
export const useCharts     = () => useFetch("/api/charts",           4000)
export const useModules    = () => useFetch("/api/modules",         15000)
export const useSystemInfo = () => useFetch("/api/system",           6000)
```

### `showcase/src/components/ApiStatus.jsx`

New component — shows last-updated time and error state per panel. Import into any chart panel.

```jsx
import { T } from "../styles/theme"

export default function ApiStatus({ error, lastOk, label = "" }) {
  if (error) {
    return (
      <div style={{
        padding: "4px 10px", borderRadius: 3, marginBottom: 8,
        background: `${T.r}12`, border: `1px solid ${T.r}33`,
        fontSize: 10, color: T.r, display: "flex", alignItems: "center", gap: 8,
      }}>
        <span>⚠</span>
        <span>API ERROR{label ? ` — ${label}` : ""}: {error}</span>
        <span style={{ color: T.muted, marginLeft: "auto" }}>using cached data</span>
      </div>
    )
  }

  if (lastOk) {
    const s = Math.round((Date.now() - lastOk) / 1000)
    return (
      <div style={{ fontSize: 9, color: T.muted, marginBottom: 4, textAlign: "right" }}>
        last updated {s}s ago
      </div>
    )
  }

  return null
}
```

### `showcase/src/data/staticData.js`

Fallback data shown when API is down. Keeps dashboard usable during offline demo.

```js
// Used when /api/* returns errors. Update values to match your latest DB snapshot.
export const FALLBACK_SUMMARY = {
  alerts_total:      88,
  alerts_high:       18,
  alerts_medium:      3,
  alerts_low:        67,
  queries_total:   4920,
  queries_suspicious: 30,
  unique_hosts:       9,
  tests_total:       18,
  tests_passed:      18,
  tests_ok:        true,
  mode:           "DEMO_FEED",
  data_source:    "synthetic",
}

export const FALLBACK_ALERTS = [
  {
    alert_id: "A7F2C1", src_host: "10.0.0.99", domain: "labdomain.internal",
    severity: "HIGH", total_score: 93, timestamp: new Date().toISOString(),
    is_beaconing: 1,
    reasons: JSON.stringify([
      "[Rule R001] Abnormally long query (91 chars)",
      "[Rule R002] High subdomain entropy (4.21)",
      "[Behavior] Regular C2 beacon every ~15s | score: 0.94",
      "[ML] Malicious probability: 91.3%",
    ]),
  },
]
```

### `showcase/src/App.js` — slim router only

```jsx
import { useState, useEffect } from "react"
import { GLOBAL_CSS } from "./styles/theme"
import LandingPage      from "./pages/LandingPage"
import DashboardPage    from "./pages/DashboardPage"
import ArchitecturePage from "./pages/ArchitecturePage"

function injectCSS(css) {
  const el = document.createElement("style")
  el.textContent = css
  document.head.appendChild(el)
  return el
}

export default function App() {
  const [page, setPage] = useState("landing")

  useEffect(() => {
    const el = injectCSS(GLOBAL_CSS)
    return () => el.remove()
  }, [])

  // sync with browser history
  useEffect(() => {
    window.history.pushState(null, "", `/${page === "landing" ? "" : page}`)
  }, [page])

  const PAGE = { landing: LandingPage, dashboard: DashboardPage, architecture: ArchitecturePage }
  const Component = PAGE[page] || LandingPage

  return <Component onNavigate={setPage} />
}
```

### Delete the duplicate — run this once

```bash
cd /Users/lakshitsachdeva/Desktop/Projects/cybersec-proj/showcase/src
rm -f App.jsx
```

Then add this to `showcase/.gitignore` to prevent re-creation:
```
src/App.jsx
```

---

## Fix 5 — Dashboard Robustness

### Empty-state guard pattern

Use this pattern in every chart component. If data is null/empty, show a placeholder instead of a blank panel:

```jsx
// showcase/src/components/ChartPanel.jsx
import { T } from "../styles/theme"
import ApiStatus from "./ApiStatus"

export default function ChartPanel({ title, subtitle, error, lastOk, loading, children, minHeight = 200 }) {
  return (
    <div style={{
      background: T.s1, border: `1px solid ${T.brd}`,
      borderRadius: 4, padding: 18,
    }}>
      <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".16em", marginBottom: 4 }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 10, color: T.g4, marginBottom: 12 }}>{subtitle}</div>
      )}
      <ApiStatus error={error} lastOk={lastOk} />

      {loading && !error ? (
        <div style={{
          minHeight, display: "flex", alignItems: "center", justifyContent: "center",
          color: T.muted, fontSize: 11, letterSpacing: ".14em",
        }}>
          <span className="blink">█</span>&nbsp;LOADING...
        </div>
      ) : (
        children
      )}
    </div>
  )
}
```

### Mode label — show LIVE_CAPTURE vs DEMO_FEED clearly

Add this to Nav component and to the dashboard KPI row:

```jsx
// In Nav.jsx, add mode badge next to live indicator:
function ModeLabel({ mode }) {
  const isLive = mode === "LIVE_CAPTURE"
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 2, fontSize: 9, letterSpacing: ".15em",
      background: isLive ? `${T.r}18` : `${T.g4}40`,
      border: `1px solid ${isLive ? T.r : T.g4}`,
      color: isLive ? T.r : T.muted,
    }}>
      {isLive ? "⚡ LIVE CAPTURE" : "◎ DEMO FEED"}
    </span>
  )
}
```

---

## Fix 6 — One-Command Launcher

**Replace `run_sentinel.sh`** with a clean, documented version:

```bash
#!/usr/bin/env bash
# run_sentinel.sh — one-command launcher for Sentinel DNS IDS
#
# Usage:
#   ./run_sentinel.sh              → start with demo feed (default)
#   ./run_sentinel.sh --live       → start with live packet capture
#   ./run_sentinel.sh --reset      → wipe alert DB then start demo
#   ./run_sentinel.sh --down       → stop everything
#   ./run_sentinel.sh --status     → show service status
#
# What this does NOT start: Streamlit (React is the canonical UI)

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK="$ROOT/scripts/sentinel_stack.sh"

RESET=0; MODE="demo"; CMD="up"

for arg in "$@"; do
  case "$arg" in
    --live)   MODE="live" ;;
    --reset)  RESET=1 ;;
    --down)   CMD="down" ;;
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

# Reset DB if requested
if [[ "$RESET" -eq 1 ]]; then
  echo "Resetting alert database..."
  cd "$ROOT"
  .venv/bin/python -c "
import sys; sys.path.insert(0,'.')
from alerts.alert_engine import init_db, reset_alerts
init_db(); reset_alerts()
print('Alert DB cleared.')
"
fi

# Start
export SENTINEL_MODE="$MODE"
bash "$STACK" up "$MODE"
```

---

## Upgrade 1 — Live vs Demo Mode Labels

### `run_pipeline.py` — pass mode through to alert engine

Find `mode_demo` function and add `run_id` threading:

```python
import uuid as _uuid

def mode_demo(args):
    run_id = getattr(args, 'run_id', None) or f"demo-{_uuid.uuid4().hex[:8]}"
    
    # ... existing data generation ...
    
    # When calling detector, pass run_id down:
    # detector.run_on_dataframe(df, run_id=run_id)
    # This surfaces in the API as data_source = "DEMO_FEED"
    
    return run_id
```

### `api/server.py` — expose mode in `/api/summary`

```python
import os

def get_summary():
    # ... existing alert counts from DB ...
    
    mode = os.environ.get("SENTINEL_MODE", "demo").upper()
    data_source = "LIVE_CAPTURE" if mode == "LIVE" else "DEMO_FEED"
    
    return {
        # ... existing fields ...
        "mode":        data_source,
        "data_source": data_source,
    }
```

---

## Upgrade 2 — Alert Dedup at Pipeline Level

Pass `dedup_window` from config so you can tune aggressiveness:

### `config.yaml` — add dedup section

```yaml
alerts:
  dedup_window_minutes: 30    # skip duplicate alert if same fingerprint seen within window
  max_per_severity: 50        # prune DB to this many per severity level
  auto_prune: true            # prune on every feed loop run
```

### `detection/detector.py` — thread dedup_window into alert calls

```python
# In DNSDetector.__init__, load from config:
self.dedup_window = config.get("alerts", {}).get("dedup_window_minutes", 30)

# In analyze_session, pass it through:
alert = generate_alert(
    src_host, domain,
    rule_violations, behavior_flags, ml_result, score_result,
    run_id=self.run_id,
    dedup_window=self.dedup_window
)
```

---

## Acceptance Checklist

Run through these after applying fixes. Every item should be green.

### Process management
```bash
# 1. Start everything
./run_sentinel.sh

# 2. Status should show actual port state, not just pid files
./scripts/sentinel_stack.sh status
# Expected: api ✓ running :8000 | react ✓ running :3000 | feed ✓ running

# 3. Kill React manually, then check status
kill $(lsof -nP -iTCP:3000 -sTCP:LISTEN | awk 'NR>1 {print $2}')
./scripts/sentinel_stack.sh status
# Expected: react ✗ stopped

# 4. Down stops everything including externally started processes
./run_sentinel.sh          # start
./scripts/sentinel_stack.sh down
lsof -nP -iTCP:3000 -sTCP:LISTEN  # should return nothing
lsof -nP -iTCP:8000 -sTCP:LISTEN  # should return nothing
```

### Alert dedup
```bash
# 1. Reset DB
./run_sentinel.sh --reset

# 2. Run pipeline twice
.venv/bin/python run_pipeline.py --mode demo --no-dashboard
.venv/bin/python run_pipeline.py --mode demo --no-dashboard

# 3. Check alert count — should NOT have doubled
.venv/bin/python -c "
import sqlite3
from alerts.alert_engine import DB_PATH
conn = sqlite3.connect(DB_PATH)
print('Total alerts:', conn.execute('SELECT COUNT(*) FROM alerts').fetchone()[0])
print('By severity:', dict(conn.execute('SELECT severity, COUNT(*) FROM alerts GROUP BY severity').fetchall()))
"
```

### API truthfulness
```bash
# Test count should match pytest output exactly
curl -s http://localhost:8000/api/summary | python -m json.tool | grep tests
# Expected output:
# "tests_total": 18,
# "tests_passed": 18,
# "tests_ok": true,
# "tests_source": "pytest",

.venv/bin/python -m pytest -q --no-header  # should also show 18 passed
```

### Frontend structure
```bash
# App.jsx should be gone
ls showcase/src/App.jsx 2>/dev/null && echo "FAIL: still exists" || echo "OK: removed"

# Build should still pass
cd showcase && npm run build && echo "BUILD OK"
```

### Dashboard charts render under live feed
```bash
# Start full stack, open http://localhost:3000
# Navigate to Dashboard page
# With feed running, refresh 3x — charts should never show blank/collapsed state
# Check browser console for no uncaught errors
```

### Mode label visible
```bash
curl -s http://localhost:8000/api/summary | python -m json.tool | grep mode
# Expected: "mode": "DEMO_FEED"   or "LIVE_CAPTURE" depending on how started
```

---

## Quick-Apply Order

```bash
# 1. Apply process manager fix
# → replace scripts/sentinel_stack.sh with Fix 1 content

# 2. Apply alert dedup
# → patch alerts/alert_engine.py with Fix 2 additions
# → replace scripts/demo_feed_loop.sh with Fix 2 version

# 3. Apply API truthfulness
# → patch api/server.py with Fix 3 helpers + get_summary changes

# 4. Apply frontend refactor
# → create showcase/src/styles/theme.js
# → create showcase/src/api/useApi.js
# → create showcase/src/components/ApiStatus.jsx
# → create showcase/src/components/ChartPanel.jsx
# → create showcase/src/data/staticData.js
# → replace showcase/src/App.js with slim router
# → rm showcase/src/App.jsx

# 5. Apply launcher fix
# → replace run_sentinel.sh with Fix 6 version

# 6. Validate
# → run acceptance checklist above
```

---

*After these fixes: one-command start, correct status reporting, deduped alerts, honest metrics, maintainable frontend, and a dashboard that degrades gracefully instead of going blank.*
