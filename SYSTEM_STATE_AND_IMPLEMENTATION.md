# Sentinel DNS IDS - Complete Implementation and System State

Last verified: 2026-04-09 (Asia/Kolkata)
Project root: `/Users/lakshitsachdeva/Desktop/Projects/cybersec-proj`

## 1) What this project is (and is not)

This project is a **real, working DNS intrusion detection prototype** with:
- a Python detection pipeline,
- a trained ML classifier loaded from disk,
- rule + behavior + ML ensemble scoring,
- SQLite-backed alerts,
- a JSON backend API,
- a React SOC-style frontend,
- and a three-role lab orchestrator (`client`, `defender`, `server`).

It is **not** a production SIEM/EDR platform yet. It is a strong prototype that can run in:
- fully simulated/demo mode (works without root), and
- live capture mode (requires packet-capture permissions).

## 2) Direct answer to your legit questions

### Is it real-time?
- **Frontend polling is real-time-ish**: React polls API every few seconds and updates live counters/charts/tables.
- **Backend can be real-time when live mode works**: `run_pipeline.py --mode live` captures traffic in rolling windows and processes new packets each cycle.
- On macOS/Linux, live sniffing needs elevated permissions. Without that, system falls back to demo mode and still processes generated traffic.

### Is it actually set up like 3 agents (client/server/defender)?
Yes, via `lab/three_node_lab.py`:
- `client-normal`: benign DNS generator.
- `client-attack`: attack simulator (beacon/exfil/dga/full).
- `defender-live`: live pipeline (`run_pipeline.py --mode live`).
- `server-api`: optional API process.
- optional dashboard processes (`streamlit`, `react`) are server-side UIs.

This is a **three-role runtime orchestration**, not Kubernetes microservices with strict network isolation.

### Are you actually using ML? Which model?
Yes. The runtime detector uses `detection/ml_model.py` to load:
- model file: `models/saved/dns_classifier.pkl`
- scaler file: `models/saved/standard_scaler.pkl`

Training (`models/train.py`) evaluates supervised models (RandomForest and XGB/fallback), selects best by F1, and persists the chosen model with `joblib`.

There is no LLM in detection path. ML here is classic tabular classification over engineered DNS features.

## 3) Current verified system state (exact snapshot)

### Runtime processes detected
- API server running: `api/server.py --port 8000`
- React dev server running: `react-scripts start` on port `3000`
- Streamlit dashboard running: `streamlit run dashboard/app.py` on port `8501`

### Listening ports detected
- `8000/tcp` -> API server
- `3000/tcp` -> React dev server
- `8501/tcp` -> Streamlit dashboard

### API live snapshot
`GET /api/summary` returned:
- `alerts_total = 75`
- `alerts_unresolved = 75`
- `alerts_high = 5`
- `alerts_medium = 3`
- `alerts_low = 67`
- `queries_total = 330`
- `queries_suspicious = 30`
- `unique_hosts = 9`
- `tests_total = 12`
- `tests_passed = 12`

`GET /api/system` returned:
- model exists: `true` (`419801` bytes)
- scaler exists: `true` (`1599` bytes)
- parsed CSV exists: `true`
- raw live CSV exists: `false`
- raw demo CSV exists: `true`
- alerts DB exists: `true`

Important nuance:
- API test counter (`12`) is a static function-count heuristic.
- Actual executed pytest count is higher due parametrized test expansion.

### Validation commands run
- `python3 -m py_compile ...` on touched Python files: **pass**
- `.venv/bin/python -m pytest -q`: **18 passed**
- `cd showcase && npm run build`: **compiled successfully**
- API endpoint smoke tests (`/api/health`, `/api/summary`, `/api/system`, `/api/charts`, `/api/modules`): **pass**

### Three-node lab behavior verified
Command run:
- `.venv/bin/python lab/three_node_lab.py --duration 5 --interface lo0 --skip-api --attack-mode dga`

Observed behavior:
- Defender live capture failed with Scapy permission error (`/dev/bpf0` permission denied).
- Orchestrator correctly fell back to demo pipeline.
- Client traffic processes were started and then terminated cleanly.
- After recent fix, fallback demo no longer launches extra Streamlit processes unexpectedly.

## 4) What was implemented in this integration pass

## 4.1 Backend JSON API (new)
File: `api/server.py`

Implemented endpoints:
- `/api/health`
- `/api/summary`
- `/api/alerts`
- `/api/queries`
- `/api/charts`
- `/api/modules`
- `/api/system`

Key behavior:
- Reads alerts from `alerts/alerts.db`.
- Reads DNS records from first available source among:
  - `data/parsed/parsed_dns.csv`
  - `data/raw/live.csv`
  - `data/raw/demo_raw.csv`
- Computes chart-ready datasets from real records.
- Provides module inventory mapped to real file paths.
- Adds CORS headers (`Access-Control-Allow-Origin: *`) for frontend.

## 4.2 React app wired to real backend (rewritten)
Files:
- `showcase/src/App.js`
- `showcase/src/App.jsx` (synced copy)

Behavior:
- Polls backend via `fetch` to `REACT_APP_API_BASE` (default `http://localhost:8000`).
- Landing page pulls real counters and alert ticker.
- Dashboard charts/tables render from backend data, not static hardcoded arrays.
- Architecture page reads module graph/status from `/api/modules` + `/api/system`.
- Router behavior uses browser history paths:
  - `/`
  - `/dashboard`
  - `/architecture`

## 4.3 Live-mode processing improvements
File: `run_pipeline.py`

Changes:
- Live mode now tracks new packets per cycle and processes only new rows.
- Parsed dashboard log is maintained (`data/parsed/parsed_dns.csv`) with rolling cap.
- Better error messaging for interface/permission issues.
- Interface default:
  - macOS -> `lo0`
  - others -> `eth0`
- Added `--no-dashboard` flag to demo mode to prevent unwanted Streamlit spawn in orchestrated fallback.

## 4.4 Three-node orchestrator (new)
File: `lab/three_node_lab.py`

Implemented orchestration:
- starts optional API and dashboards,
- starts normal client traffic generator,
- starts attack simulator,
- runs defender live pipeline,
- falls back to demo mode if live capture fails.

Latest reliability fix:
- fallback now runs `run_pipeline.py --mode demo --no-dashboard` to avoid orphan Streamlit processes.

## 4.5 Runtime cleanup fixes
Files:
- `lab/normal_traffic.py`
- `lab/attack_simulator.py`

Fix:
- replaced deprecated `datetime.utcnow()` with timezone-aware UTC calls.

## 4.6 Frontend warning cleanup
File:
- `showcase/src/App.js`

Fix:
- removed unused icon imports so CRA production build is clean.

## 5) End-to-end architecture and dataflow

## 5.1 Data producers
- `lab/normal_traffic.py`: benign DNS-style queries against common domains.
- `lab/attack_simulator.py`: malicious-like DNS patterns:
  - beaconing,
  - exfil via encoded chunks in subdomains/TXT queries,
  - DGA-like sweeps.
- `capture/sniffer.py`: packet capture from interface via Scapy.

## 5.2 Parsing and feature pipeline
`features/feature_pipeline.py` produces combined features from raw rows:
- lexical features (`features/lexical.py`): entropy, base64-like patterns, ratios, lengths.
- temporal features (`features/temporal.py`): inter-arrival stats, beacon score, rate.
- session/domain features (`features/session.py`): uniqueness, concentration, NXDOMAIN/TXT ratios.

Output goes to feature CSVs such as:
- `data/features/demo_features.csv`
- `data/features/live_features.csv`

## 5.3 Detection engines
`detection/detector.py` orchestrates three layers:

1) Rule engine (`detection/rule_engine.py`)
- Rules R001-R008 covering long queries, entropy, base64, subdomain explosion, NXDOMAIN rate, TXT ratio, high query rate, hex tunneling pattern.

2) Behavior engine (`detection/behavior_engine.py`)
- Flags beaconing, single-host concentration, tunnel exfil estimate, DGA sweep, after-hours activity.

3) ML detector (`detection/ml_model.py`)
- Loads saved model, scores malicious probability, applies threshold (`ml_threshold` from config).

## 5.4 Scoring and severity
`scoring/threat_scorer.py` computes total 0-100:
- rules capped at 40,
- behavior capped at 35,
- ML contribution capped at 25.

Severity bands:
- HIGH >= 70
- MEDIUM >= 40
- LOW < 40

## 5.5 Alert persistence
`alerts/alert_engine.py`:
- writes alerts to SQLite (`alerts/alerts.db`),
- stores evidence chain (`reasons`) as JSON,
- supports query/resolve operations.

## 5.6 Serving and visualization
- API: `api/server.py` exposes operational JSON.
- React SOC UI: `showcase/src/App.js` consumes API.
- Streamlit dashboard: `dashboard/app.py` reads DB/CSV directly.

## 6) ML pipeline details

Training script: `models/train.py`
- Ensures full feature set exists.
- Optional class balancing with SMOTE (if available).
- Trains/evaluates RandomForest + XGB (or GradientBoosting fallback).
- Performs CV F1 checks.
- Persists best model + scaler.
- Saves feature importance chart.

Evaluation script: `models/evaluate.py`
- Loads model, computes classification report and confusion matrix.
- Generates ROC/PR curves.
- Performs threshold sweep.
- Exports FP/FN analysis CSVs.

Saved artifacts currently present:
- `models/saved/dns_classifier.pkl`
- `models/saved/standard_scaler.pkl`
- reports under `models/evaluation_report/`

## 7) API contract (high level)

### `/api/summary`
Global counters for alerts, severities, query totals, host count, test counts.

### `/api/alerts?limit=50&severity=HIGH`
Alert rows sorted newest first; includes parsed `reasons` array.

### `/api/queries?limit=50`
Latest normalized query rows with `status` (`normal`/`suspicious`).

### `/api/charts`
Chart payloads:
- traffic timeline,
- entropy distribution,
- query length distribution,
- severity breakdown,
- attack type breakdown,
- top hosts by score.

### `/api/modules`
Nine architecture modules with file existence checks.

### `/api/system`
Model/scaler existence + data-source runtime state.

## 8) What is genuinely live vs simulated right now

Live in current environment:
- React UI updates from API polling.
- API serves real files/DB content.
- Alerts and query metrics change when demo/lab pipeline runs.

Simulated in current environment:
- Packet capture on `lo0` is blocked without elevated privileges, so detector fallback uses generated demo traffic.

To make capture truly live:
- run pipeline/orchestrator with elevated permissions suitable for Scapy packet sniffing on your OS.

## 9) Known limitations and honesty notes

- Live sniffing permission is the main blocker for true packet-level real-time in this session.
- Attack simulator defaults to local-safe resolver behavior (`127.0.0.1`) to avoid external abuse.
- API test count is not pytest execution count; it is a lightweight static estimate.
- This is not hardened for production-scale retention, auth, tenancy, or secure remote deployment.

## 10) How to run cleanly

## 10.1 Backend API
```bash
cd /Users/lakshitsachdeva/Desktop/Projects/cybersec-proj
.venv/bin/python api/server.py --port 8000
```

## 10.2 React UI
```bash
cd /Users/lakshitsachdeva/Desktop/Projects/cybersec-proj/showcase
REACT_APP_API_BASE=http://localhost:8000 npm start
```

## 10.3 Demo pipeline (no live sniffing needed)
```bash
cd /Users/lakshitsachdeva/Desktop/Projects/cybersec-proj
.venv/bin/python run_pipeline.py --mode demo
```

## 10.4 Three-role lab orchestration
```bash
cd /Users/lakshitsachdeva/Desktop/Projects/cybersec-proj
.venv/bin/python lab/three_node_lab.py --duration 180 --interface lo0 --api-port 8000 --start-react
```

If live capture permissions fail, orchestrator auto-falls back to demo mode and keeps detection + alerting functional.

## 11) File index for key components

- API: `api/server.py`
- Main pipeline runner: `run_pipeline.py`
- Orchestrator: `lab/three_node_lab.py`
- Capture: `capture/sniffer.py`, `capture/pcap_reader.py`
- Feature engineering: `features/lexical.py`, `features/temporal.py`, `features/session.py`, `features/feature_pipeline.py`
- Detection orchestration: `detection/detector.py`
- Rule engine: `detection/rule_engine.py`
- Behavior engine: `detection/behavior_engine.py`
- ML wrapper: `detection/ml_model.py`
- Risk scoring: `scoring/threat_scorer.py`
- Alerts DB layer: `alerts/alert_engine.py`
- Model train/eval: `models/train.py`, `models/evaluate.py`
- Streamlit dashboard: `dashboard/app.py`
- React dashboard: `showcase/src/App.js`
- Tests: `tests/test_features.py`, `tests/test_rules.py`, `tests/test_scoring.py`

