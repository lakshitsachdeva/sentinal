# Claude Handoff: Cybersec Project (Dashboard + Full Codebase)

Generated on: 2026-04-09
Workspace: `/Users/lakshitsachdeva/Desktop/Projects/cybersec-proj`
Primary goal for Claude: **stabilize and fix the dashboard UX/runtime and clean up startup/process behavior**.

## 1) Executive Summary

This repo is a DNS IDS prototype with:
- Python detection pipeline (capture/feature extraction/rules/behavior/ML/scoring/alerts).
- SQLite alerts store.
- JSON API backend (`api/server.py`).
- React SOC frontend (`showcase/src/App.js`).
- Optional Streamlit dashboard (`dashboard/app.py`).
- Local process manager scripts (`run_sentinel.sh`, `scripts/sentinel_stack.sh`).

Current reality:
- API works and serves live JSON.
- React build compiles successfully.
- Tests pass (`18 passed`).
- Dashboard feels unstable/confusing due process-management and UX mismatch.

## 2) Current Runtime Snapshot

At handoff time:
- Managed status (`./scripts/sentinel_stack.sh status`):
  - `api`: running (pid file present)
  - `feed`: running (pid file present)
  - `react`: shows stopped
  - `streamlit`: stopped
- Actual listening ports:
  - `3000` is listening (React process exists externally)
  - `8000` is listening (API)
  - `8501` not listening currently

Important mismatch:
- React can be running externally but script status reports `stopped` because the process is not tracked in `.runtime/pids/react.pid`.

Live API sample (`/api/summary` at generation time):
- `alerts_total`: 88
- `alerts_high`: 18
- `alerts_medium`: 3
- `alerts_low`: 67
- `queries_total`: 330
- `queries_suspicious`: 30
- `unique_hosts`: 9
- `tests_total`: 12 (heuristic)

## 3) Repository Map

- `api/`
  - `server.py`: JSON API for frontend.
- `alerts/`
  - `alert_engine.py`: SQLite schema + insert/query/resolve alert logic.
  - `alerts.db`: runtime alert DB.
- `capture/`
  - `sniffer.py`: Scapy live capture / pcap parse capture output.
  - `pcap_reader.py`: offline pcap parser.
- `features/`
  - `lexical.py`, `temporal.py`, `session.py`, `feature_pipeline.py`.
- `detection/`
  - `rule_engine.py`, `behavior_engine.py`, `ml_model.py`, `detector.py`.
- `scoring/`
  - `threat_scorer.py`.
- `models/`
  - `train.py`, `evaluate.py`, model artifacts in `models/saved/`.
- `dashboard/`
  - `app.py`: Streamlit dashboard.
- `showcase/`
  - CRA React app; main UI in `src/App.js` (mirrored to `App.jsx`).
- `lab/`
  - `normal_traffic.py`, `attack_simulator.py`, `three_node_lab.py`.
- `scripts/`
  - `sentinel_stack.sh`: process orchestration.
  - `demo_feed_loop.sh`: repeated demo pipeline loop.
- Root:
  - `run_pipeline.py`: main pipeline runner.
  - `run_sentinel.sh`: one-command launcher.

## 4) Core Runtime/Data Flow

1. Data source:
- Demo mode: `run_pipeline.py --mode demo` generates DNS-like rows.
- Live mode: `run_pipeline.py --mode live` calls Scapy capture (`capture/sniffer.py`) and processes windows.

2. Feature extraction:
- `features/feature_pipeline.py` enriches raw data with lexical + temporal + session features.

3. Detection:
- `detection/detector.py` orchestrates:
  - rule engine (`R001..R008`),
  - behavior engine (beaconing/concentration/exfil/dga/after_hours),
  - ML score via saved model (`models/saved/dns_classifier.pkl`).

4. Scoring + alerts:
- `scoring/threat_scorer.py` outputs 0-100 threat score + severity.
- `alerts/alert_engine.py` persists alerts in SQLite.

5. API exposure:
- `api/server.py` serves summary, alerts, queries, charts, modules, system.

6. Frontend:
- React polls API every few seconds and renders landing/dashboard/architecture pages.

## 5) Important Entry Points (for Claude quick navigation)

- API:
  - `_normalize_queries`: `api/server.py:41`
  - `get_summary`: `api/server.py:124`
  - `get_charts`: `api/server.py:162`
  - `get_modules`: `api/server.py:233`
  - `Handler`: `api/server.py:330`

- Pipeline runner:
  - `mode_demo`: `run_pipeline.py:66`
  - `mode_live`: `run_pipeline.py:87`
  - `main`: `run_pipeline.py:174`

- Detector:
  - `DNSDetector`: `detection/detector.py:17`
  - `run_on_dataframe`: `detection/detector.py:70`

- React UI:
  - API base: `showcase/src/App.js:31`
  - `useApi`: `showcase/src/App.js:95`
  - `LandingPage`: `showcase/src/App.js:284`
  - `DashboardPage`: `showcase/src/App.js:459`
  - `ArchitecturePage`: `showcase/src/App.js:640`
  - root app: `showcase/src/App.js:957`

- Process scripts:
  - stack script options + up logic: `scripts/sentinel_stack.sh` (`up` starts at line ~178)
  - launcher defaults: `run_sentinel.sh:7-24`
  - demo feed loop: `scripts/demo_feed_loop.sh:7-20`

## 6) API Contract Used by React

Base URL:
- `REACT_APP_API_BASE` env var, default `http://localhost:8000`.

Endpoints consumed:
- `/api/summary` (4s polling)
- `/api/alerts?limit=50` (4s)
- `/api/queries?limit=50` (4s)
- `/api/charts` (4s)
- `/api/modules` (15s)
- `/api/system` (6s)

Charts payload currently includes:
- `traffic`
- `entropy_distribution`
- `query_length_distribution`
- `severity_breakdown`
- `attack_type_breakdown`
- `top_hosts`

## 7) Dashboard/Frontend State

Frontend is a single large file (`showcase/src/App.js`, ~1018 LOC):
- custom path routing with `window.history` (not react-router).
- heavy inline styles and animation code.
- architecture page is a hybrid:
  - static visual metadata (positions/icons/colors/details)
  - dynamic file status/content from `/api/modules` + `/api/system`.

There is intentional duplicate file:
- `showcase/src/App.js`
- `showcase/src/App.jsx`
They are currently identical; manual sync is error-prone.

## 8) Known Problems / Technical Debt (Priority)

### P1 - Process manager can misreport service state
Symptom:
- `sentinel_stack.sh status` says `react stopped` while React is actually running on port 3000.

Cause:
- script supports “reuse existing external service on occupied port” but only tracks pid-file-managed processes.

Impact:
- user confusion; `down` won’t stop external reused process.

### P1 - One-command startup historically conflicted with Streamlit/React ports
Symptom:
- startup failed when ports already occupied.

Current behavior:
- improved to reuse occupied services.

Remaining UX issue:
- users expect `down` to stop everything they see; script currently only stops managed processes.

### P1 - Feed loop inflates alerts endlessly
Symptom:
- `alerts_total` keeps increasing due repeated demo runs (`feed` mode).

Cause:
- `scripts/demo_feed_loop.sh` runs `run_pipeline.py --mode demo --no-dashboard` every N seconds.
- each run inserts new alerts into SQLite with no pruning/dedup.

Impact:
- severity metrics drift; dashboard can feel “wrong/noisy”.

### P1 - Frontend monolith and duplicated source file
Symptom:
- difficult to safely iterate/fix dashboard.

Cause:
- all pages/components/styles in one huge file + duplicate App.js/App.jsx.

Impact:
- fragile edits and regression risk.

### P2 - API `tests_total/tests_passed` are heuristic, not real execution status
Symptom:
- summary shows `12/12` while pytest executed is `18` due parameterized tests.

Cause:
- API counts `def test_` strings across files.

Impact:
- misleading health metric.

### P2 - Live mode still needs elevated permissions
Symptom:
- live capture can fail with `/dev/bpf* permission denied` on macOS.

Behavior:
- orchestrator falls back to demo mode.

Impact:
- not truly live packet-driven unless privileged capture is enabled.

### P2 - Streamlit and React both exist; ownership is unclear
Symptom:
- user expects React only, but Streamlit process may still exist from older runs.

Impact:
- confusion on what UI is canonical.

## 9) Validation Snapshot

Executed and passing:
- `cd /Users/lakshitsachdeva/Desktop/Projects/cybersec-proj && .venv/bin/python -m pytest -q`
  - Result: `18 passed`
- `cd /Users/lakshitsachdeva/Desktop/Projects/cybersec-proj/showcase && npm run build`
  - Result: build success
- API health and endpoints return 200 with valid JSON.

## 10) What Claude Should Fix First (Suggested Plan)

1. Process-management correctness.
- Make `status/down` consistently handle reused external processes.
- Option A: no reuse; force explicit kill or fail-fast with exact command.
- Option B: adopt external pid by command matching and mark as adopted.

2. React-only mode as default and documented.
- Ensure launcher defaults never start Streamlit unless explicit flag.
- Add clear startup banner for active UI endpoint.

3. Feed-loop strategy.
- Add alert dedup or periodic DB reset option for demo feed.
- Add explicit mode labels in UI: `LIVE_CAPTURE` vs `DEMO_FEED`.

4. Refactor frontend.
- Split `App.js` into modules/pages/components.
- Remove `App.jsx` duplication (single source of truth).
- Keep architecture visual quality while making charts/components testable.

5. Dashboard robustness.
- Add empty-state guards and clear indicators when data is synthetic/demo.
- Add “last updated” timestamps and API error states per panel.

6. API truthfulness.
- Replace test-count heuristic with optional real test status endpoint or remove metric.

## 11) Reproduction Commands for Claude

### Start current stack (react + api + feed)
```bash
cd /Users/lakshitsachdeva/Desktop/Projects/cybersec-proj
./run_sentinel.sh
```

### Check status
```bash
./scripts/sentinel_stack.sh status
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:8000 -sTCP:LISTEN
lsof -nP -iTCP:8501 -sTCP:LISTEN
```

### Stop managed services
```bash
./scripts/sentinel_stack.sh down
```

### Run API manually
```bash
.venv/bin/python api/server.py --port 8000
```

### Run React manually
```bash
cd showcase
REACT_APP_API_BASE=http://localhost:8000 npm start
```

### Build + tests
```bash
cd /Users/lakshitsachdeva/Desktop/Projects/cybersec-proj
.venv/bin/python -m pytest -q
cd showcase && npm run build
```

## 12) Key Files Claude Will Likely Edit

- `scripts/sentinel_stack.sh`
- `run_sentinel.sh`
- `scripts/demo_feed_loop.sh`
- `showcase/src/App.js` (or split into multiple files)
- `api/server.py`
- optional: `alerts/alert_engine.py` for dedup/pruning strategy

## 13) Notes on Data Characteristics

- Current demo dataset is highly separable; several features correlate nearly 1.0 with label in feed logs.
- `queries_total` often remains 330 because demo generation rewrites the same-size dataset each cycle.
- `alerts_total` grows because new alerts are inserted each cycle into SQLite.

## 14) Practical Acceptance Criteria for “Dashboard Fixed”

- One command reliably opens React dashboard with no streamlit confusion.
- `status` output matches actual running processes.
- `down` behavior is predictable and clearly documented.
- Dashboard charts render without collapse/blank states under demo feed.
- Metrics are semantically correct (or clearly labeled when approximate).
- Frontend source structure is maintainable (not duplicated monolith).

