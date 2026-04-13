# SENTINEL DNS IDS — Complete Technical Deep Dive

This document explains exactly how the current SENTINEL project works end-to-end:
- architecture and runtime
- data flow and real-time behavior
- detection logic (rule + behavior + ML)
- alert generation, dedup, and persistence
- API contracts powering the dashboard
- frontend rendering and interaction model
- model training/evaluation pipeline
- limitations, gotchas, and extension points

Project root:
`/Users/lakshitsachdeva/Desktop/Projects/cybersec-proj`

---

## 1. System Purpose

SENTINEL is a DNS intrusion detection system (IDS) focused on spotting covert channels and command-and-control patterns in DNS traffic. It combines:
- deterministic rules
- temporal/behavioral heuristics
- ML probability scoring

and fuses all of that into explainable alerts and a real-time SOC-style dashboard.

---

## 2. Runtime Topology

Core running services:
- React UI: `http://localhost:3000`
- Python API: `http://localhost:8000`
- Feed loop process (demo/live runner): background shell process

Primary launch/management scripts:
- `run_sentinel.sh` (one command launcher)
- `scripts/sentinel_stack.sh` (port-aware process manager)
- `scripts/demo_feed_loop.sh` (continuous data generation + pipeline execution)

Data stores:
- alerts DB: `alerts/alerts.db` (SQLite)
- parsed DNS CSV: `data/parsed/parsed_dns.csv`
- raw demo/live CSVs: `data/raw/demo_raw.csv`, `data/raw/live.csv`

---

## 3. Data Flow (Exact Pipeline)

### 3.1 Demo mode cycle

Each feed-loop cycle does:
1. Generate synthetic DNS traffic into raw CSV.
2. Run feature pipeline -> engineered feature matrix.
3. Run detector over host-domain sessions.
4. Generate/insert alerts (with dedup window).
5. Prune old alerts per severity cap.
6. Sleep for interval and repeat.

Entry points:
- `run_pipeline.py --mode demo --no-dashboard --run-id <...>`
- called continuously by `scripts/demo_feed_loop.sh`

### 3.2 Live mode cycle

In live mode, packet capture writes fresh live windows, then the same feature + detect + alert path runs.

---

## 4. Feature Engineering

Main feature orchestrator:
- `features/feature_pipeline.py`

Feature list (19 primary columns):
- query length structure: `query_length`, `subdomain_length`, `label_count`, `max_label_length`
- entropy/content: `full_entropy`, `subdomain_entropy`, `digit_ratio`, `hyphen_count`, `consonant_vowel_ratio`, `longest_consonant_run`, `hex_ratio`, `looks_base64`
- temporal/behavioral: `is_beaconing`, `beacon_score`, `iat_cv`, `query_rate_per_min`
- session aggregates: `unique_subdomains`, `nxdomain_rate`, `txt_query_ratio`

Pipeline combines:
- lexical row-level extraction
- temporal host-level extraction
- session/domain-level aggregation

Outputs:
- engineered CSV written to `data/features/*.csv`

---

## 5. Detection Layers

### 5.1 Rule engine

File:
- `detection/rule_engine.py`

Provides explicit rule violations (R001...R008 style). These are deterministic and interpretable.

### 5.2 Behavior engine

File:
- `detection/behavior_engine.py`

Detects patterns such as:
- beacon-like periodicity
- tunneling signatures (subdomain churn)
- scan/DGA-like behavior
- concentration anomalies

### 5.3 ML detector

Wrapper:
- `detection/ml_model.py`

Loads model from:
- `models/saved/dns_classifier.pkl`

Returns:
- `ml_score` (0-1)
- `ml_malicious` (threshold comparison)
- `ml_threshold`
- confidence band

### 5.4 Threat scoring fusion

File:
- `scoring/threat_scorer.py`

Combines signals from all layers into a composite risk score and severity label.

---

## 6. Alert Lifecycle

Alert engine:
- `alerts/alert_engine.py`

Key behavior:
- Creates evidence chain strings from rule/behavior/ML outcomes.
- Writes alerts to SQLite.
- Uses content fingerprint dedup (`src_host + domain + sorted reasons`) within a configurable window.
- Supports pruning by severity bucket.
- Supports full reset (demo hygiene).

Stored fields include:
- `alert_id`, `timestamp`, `src_host`, `domain`, `severity`, `total_score`
- `reasons` (JSON)
- `ml_score`
- `is_beaconing`
- `resolved`
- `fingerprint`
- `run_id`

---

## 7. API Contracts

Main server:
- `api/server.py`

### 7.1 `/api/summary`

Returns operational headline metrics:
- alert counts by severity + unresolved
- query counters
- host cardinality
- test status
- mode/data_source

Important query counter semantics:
- `queries_window`: rows currently loaded in the active parsed dataset (often ~330 in demo).
- `queries_lifetime`: cumulative ingested count tracked by API across cycles.
- `queries_total`: alias to cumulative headline counter (same as `queries_lifetime`).

Why 330 appears often:
- demo feed rewrites a fixed-size window file each cycle.
- the window size can remain constant while cumulative ingestion keeps rising.

### 7.2 `/api/charts`

Returns pre-shaped chart payloads:
- `traffic[]` with `time`, `ts_utc`, `normal`, `suspicious`
- `entropy_distribution[]`
- `query_length_distribution[]`
- `severity_breakdown[]`
- `attack_type_breakdown[]`
- `top_hosts[]`

### 7.3 `/api/alerts`

Latest alert rows (optional limit/severity filter), with reasons normalized to arrays.

### 7.4 `/api/queries`

Latest DNS rows for log table:
- includes `timestamp_utc`
- includes `src_ip`, `query_name`, `query_type`, `rcode`, `label`, `status`

### 7.5 `/api/stream` (SSE)

Server-sent events, event type `tick`, includes:
- `timestamp_utc`
- `summary`
- `new_alerts[]` (since last observed alert id)

Frontend uses this for low-latency updates and alert notification hooks.

---

## 8. Frontend Architecture

App entry:
- `showcase/src/App.js`

Pages:
- `pages/LandingPage.jsx`
- `pages/DashboardPage.jsx`
- `pages/ArchitecturePage.jsx`

Data hooks:
- `api/useApi.js`
  - polling hooks (`useSummary`, `useAlerts`, `useQueries`, `useCharts`, ...)
  - SSE hook (`useRealtimeSignals`) with reconnect behavior

Shared components:
- `components/Nav.jsx`
- `components/KPI.jsx`
- `components/ChartPanel.jsx`
- `components/AlertCard.jsx`
- `components/ApiStatus.jsx`
- `components/MatrixRain.jsx`
- `components/OnboardingTour.jsx`

Styling:
- `styles/theme.js`

---

## 9. Dashboard Rendering Logic

Current dashboard behavior:
- Realtime stream health banner at top.
- KPI cards reflect summary metrics with animation and delta.
- Charts consume `/api/charts` payload.
- Alerts list merges SSE `new_alerts` into current state.
- Query log includes filter + attack-status badges.
- Local-time conversion is applied to UTC timestamps before render.

Threat level is derived from summary severity hierarchy:
- HIGH if `alerts_high > 0`
- else MEDIUM if `alerts_medium > 0`
- else LOW if `alerts_low > 0`
- else NONE

---

## 10. Landing Page Behavior

Landing page serves as a demo-ready hero:
- matrix visual backdrop
- live counters
- scrolling threat marquee
- detection capability cards with live stat values
- compact latest HIGH alert preview
- guided onboarding modal

---

## 11. Architecture Page Behavior

Architecture page visualizes module flow:
- interactive SVG nodes
- highlighted edge paths
- animated flow dots along active node edges
- module detail side panel with file + stat context
- system health strip (API/DB/model/pipeline/tests)

---

## 12. Model Training and Evaluation

Training script:
- `models/train.py`

Evaluation script:
- `models/evaluate.py`

Training design currently includes:
- candidate supervised models (RandomForest + XGB/GB fallback)
- optional SMOTE balancing when available
- holdout evaluation + 5-fold CV F1
- threshold-based malicious classification
- feature importance export

Evaluation includes:
- classification report + confusion matrix
- ROC and PR curves
- threshold sweep table
- false-positive/false-negative summaries

Saved artifacts:
- model: `models/saved/dns_classifier.pkl`
- scaler: `models/saved/standard_scaler.pkl`
- evaluation outputs under `models/evaluation_report/`

---

## 13. Why Real-Time Can Still Look “Static”

Common reasons:
1. You are looking at `queries_window` behavior (fixed demo window size), not cumulative ingestion.
2. Stale old processes are serving old code/metrics.
3. Browser tab not hard-refreshed after frontend rebuild.
4. Feed loop stopped while UI remains open.

Recommended check sequence:
1. `./run_sentinel.sh --down`
2. `./run_sentinel.sh --reset`
3. hard refresh browser (`Cmd+Shift+R`)
4. verify `http://localhost:8000/api/summary` directly

---

## 14. Operational Commands

Start clean:
```bash
cd /Users/lakshitsachdeva/Desktop/Projects/cybersec-proj
./run_sentinel.sh --reset
```

Status:
```bash
./scripts/sentinel_stack.sh status
```

Stop:
```bash
./run_sentinel.sh --down
```

Build frontend:
```bash
cd showcase
npm run build
```

Run tests:
```bash
cd /Users/lakshitsachdeva/Desktop/Projects/cybersec-proj
.venv/bin/python -m pytest -q --no-header
```

---

## 15. Extension Roadmap (Practical)

High-value next additions:
- persistent time-series store (instead of CSV overwrite windows)
- richer attack taxonomy classifier and attack_type labeling at source
- drift monitoring for model score distributions
- scenario replay mode with saved captures
- alert triage workflow (ack/assign/escalate)
- role-based dashboards for analyst vs demo viewers

---

## 16. File Map (Most Important)

Backend:
- `api/server.py`
- `alerts/alert_engine.py`
- `detection/detector.py`
- `detection/ml_model.py`
- `models/train.py`
- `models/evaluate.py`
- `run_pipeline.py`

Frontend:
- `showcase/src/pages/DashboardPage.jsx`
- `showcase/src/pages/LandingPage.jsx`
- `showcase/src/pages/ArchitecturePage.jsx`
- `showcase/src/api/useApi.js`
- `showcase/src/components/Nav.jsx`
- `showcase/src/components/AlertCard.jsx`
- `showcase/src/components/KPI.jsx`
- `showcase/src/components/ChartPanel.jsx`
- `showcase/src/styles/theme.js`

Runtime scripts:
- `run_sentinel.sh`
- `scripts/sentinel_stack.sh`
- `scripts/demo_feed_loop.sh`

---

## 17. Truthfulness Notes

This project is a real, executable pipeline with real feature extraction, model inference, alert persistence, and live dashboard updates.  
However, in demo mode traffic is synthetic by design, and some counters are derived from rolling files rather than a full telemetry database. The system is legitimate as a working prototype and demo platform, not yet a production SIEM replacement.

---

## 18. Speaker Notes Pack (Presentation Ready)

Verified state for this talk pack: **April 13, 2026**.

### 18.1 One-line Pitch

SENTINEL is a real-time DNS IDS prototype that combines rule logic, behavior analytics, and ML scoring into explainable SOC alerts with a live operator dashboard.

### 18.2 30-second Opening Script

Use this exact opener:

“This project is SENTINEL, a DNS intrusion detection system focused on covert C2 and exfiltration behavior. We ingest DNS activity continuously, engineer lexical and temporal features, run three detection layers, and push explainable alerts into a live SOC dashboard. The key point is not just detection accuracy, but analyst usability: each alert includes evidence chains, scoring rationale, and threat context.”

### 18.3 2-minute Technical Summary Script

Use this as your concise technical explanation:

“At runtime, SENTINEL has three active pieces: a React dashboard on port 3000, a Python API on 8000, and a continuous feed loop process. The feed loop runs `run_pipeline.py` in cycles, generates or captures DNS data, computes features, runs detection, writes alerts to SQLite, and repeats.  
Detection is layered. Rules catch explicit signatures, behavior analytics catch periodic beaconing and traffic anomalies, and ML provides a probability score. These are fused into a 0-100 risk score and severity.  
The frontend consumes both polled API data and a live SSE stream. That gives us near-real-time KPI updates, alert insertions, and topology visualization. We also ship a model intelligence page with training curves, ROC, threshold sweep, and drift history to show model governance and explainability.”

### 18.4 5-minute Live Demo Talk Track

Suggested timing:

1. **00:00-00:40 — Landing page and objective**
   - Say: “This is the operational entry point. It shows system mode, live query volume, and current threat posture.”
   - Show: hero counters, threat ticker, nav.

2. **00:40-02:20 — Dashboard operations view**
   - Say: “This is the SOC panel. Top KPIs show lifetime ingestion, suspicious traffic, and active severity levels.”
   - Show: KPI row and situation summary bar.
   - Say: “These panels refresh from API and stream updates, not static screenshots.”
   - Show: traffic, severity, entropy, and top hosts panels.

3. **02:20-03:40 — Alert explainability**
   - Say: “Each alert is explainable. We show fused score, evidence chain, SHAP-style feature attribution, and beacon waveform when periodic C2 is detected.”
   - Show: expand one HIGH alert.
   - Point out: SHAP bars, IAT waveform, threat radar.

4. **03:40-04:30 — Threat topology**
   - Say: “This graph surfaces host-to-domain relationship context. Pulsing nodes indicate active threat entities.”
   - Show: Threat Network panel.

5. **04:30-05:00 — Model governance page**
   - Say: “This page demonstrates training behavior and calibration choices: convergence curves, ROC, confusion matrix, threshold sweep, and version drift.”
   - Show: `/model` page.

### 18.5 10-minute Deep Technical Talk Track

Use this if judges ask for deeper implementation details:

1. **Architecture**
   - “The stack is script-managed and reproducible via `run_sentinel.sh`.”
   - “Data path: raw DNS -> feature pipeline -> detector -> alert engine -> API -> React.”

2. **Feature layer**
   - “We use lexical, entropy, temporal, and session-aggregate features.”
   - “Key discriminators include subdomain entropy, beacon metrics, query length, NXDOMAIN rate, and TXT ratio.”

3. **Detection fusion**
   - “Rules provide deterministic catches; behavior layer finds periodic and concentration anomalies; ML adds calibrated probability.”
   - “Threat score converts this into severity tiers for analyst action.”

4. **Explainability and analyst UX**
   - “Alerts expose reason chains and SHAP-style top contributors.”
   - “Beaconing hosts get IAT waveform confirmation to distinguish automation from human traffic.”
   - “Threat radar summarizes six dimensions for triage speed.”

5. **Operations reliability**
   - “Alerts are deduplicated using a fingerprint over host-domain-evidence to reduce noise.”
   - “Realtime stream has polling fallback behavior.”
   - “Frontend has offline fallback datasets for demo continuity.”

6. **Model lifecycle**
   - “Model page shows epoch trends, CV folds, threshold tradeoff, and drift history.”
   - “This demonstrates we considered calibration and false-positive control, not only raw accuracy.”

### 18.6 Slide-by-Slide Speaker Notes

If you are preparing slides, use this mapping:

1. **Slide: Problem**
   - “DNS is often abused for low-and-slow C2 and exfiltration.”
   - “Traditional blocking misses behavioral stealth.”

2. **Slide: Solution**
   - “SENTINEL fuses rule, behavior, and ML.”
   - “Outcome is explainable, real-time detection for SOC use.”

3. **Slide: Architecture**
   - “Three runtime services and one continuous feed loop.”
   - “SQLite + CSV pipeline today; extensible to TSDB and queue.”

4. **Slide: Detection Logic**
   - “Rules catch known bad patterns.”
   - “Behavior catches periodicity and traffic structure anomalies.”
   - “ML catches non-linear combinations.”

5. **Slide: Dashboard**
   - “Operational KPIs, chart panels, alert queue, query log, topology.”
   - “Everything is API-backed and refreshes live.”

6. **Slide: Explainability**
   - “Alert-level SHAP-style contributions.”
   - “IAT waveform for beacon validation.”
   - “Threat radar for triage posture.”

7. **Slide: Model Intelligence**
   - “Training convergence, ROC, threshold sweep, confusion matrix.”
   - “Drift/version history for governance narrative.”

8. **Slide: Results + Limits**
   - “Strong prototype with real pipeline and real UI.”
   - “Demo feed is synthetic; production hardening is next.”

### 18.7 Judge/Interviewer Q&A Bank

Q: “Is this real-time or fake animation?”  
A: “Realtime updates are driven by the API and SSE stream. In demo mode, data is synthetic but generated and processed by the actual pipeline each cycle.”

Q: “Why does query count sometimes look stable?”  
A: “The active demo file is a rolling window. `queries_window` can stay around a fixed size while `queries_lifetime` keeps increasing cumulatively.”

Q: “Are you actually using ML?”  
A: “Yes. The detector loads a trained classifier from `models/saved/dns_classifier.pkl`, computes `ml_score`, and fuses that with rule and behavior signals.”

Q: “What prevents alert spam?”  
A: “Fingerprint-based dedup in the alert engine, plus per-severity pruning.”

Q: “What is still missing for production?”  
A: “Persistent streaming infra, stronger identity/enrichment context, and analyst workflow features like assignment/escalation.”

### 18.8 Demo Reliability Checklist (Before You Present)

Run this sequence before your talk:

1. `cd /Users/lakshitsachdeva/Desktop/Projects/cybersec-proj`
2. `./run_sentinel.sh --down`
3. `./run_sentinel.sh --reset`
4. `./run_sentinel.sh --status`
5. open `http://localhost:3000`
6. hard refresh browser (`Cmd+Shift+R`)

Expected status:
- API on `:8000`
- React on `:3000`
- feed running

### 18.9 Closing Script (20 seconds)

“SENTINEL demonstrates an end-to-end detection product, not just a model notebook: continuous ingestion, multi-layer detection, explainable alerts, and live operational visualization. The current system is demo-ready today and has a clear path to production-grade deployment.”
