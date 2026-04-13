# DNS_IDS_Implementation

# DNS IDS

---

## 🚨 READ THIS FIRST — You Have 20 Minutes

**Here is exactly what to do right now, in order:**

### Step 1 — Make one file (2 minutes)

Create a new file called `demo.py` and paste the entire block from [Section: PASTE THIS NOW](about:blank#paste-this-now) below.

### Step 2 — Install dependencies (3 minutes)

```bash
pip install streamlit plotly pandas numpy
```

If pip is slow, just run `demo.py` with plain Python — it also works without Streamlit.

### Step 3 — Run it (30 seconds)

```bash
streamlit run demo.py
```

Or without Streamlit:

```bash
python demo.py
```

### Step 4 — What you get

- A live browser dashboard showing DNS traffic, alert timeline, risk scores, and detection reasons
- Simulated normal + attack traffic with rule-based + behavioral detection already running
- Real alerts with host, domain, score, and evidence

### What to tell your professor RIGHT NOW

> “Sir/Ma’am, this is a working prototype of our DNS Intrusion Detection System. The system is currently simulating network traffic — normal DNS queries on the left, and covert command-and-control communication on the right. You can see the detection engine raising alerts with risk scores and evidence. The full system adds ML classification on top of these rule and behavior layers.”
> 

That’s it. You’re showing:
- live data simulation
- real feature extraction (entropy, beaconing, query length)
- layered detection (rules + behavior)
- threat scoring (0–100)
- explainable alerts with reasons

---

## PASTE THIS NOW

Save this as `demo.py` and run `streamlit run demo.py`

---

## All Codex Prompts — Full Project

Use these prompts in order, one module at a time. Each prompt is self-contained — paste it into Claude / ChatGPT / Cursor and it will generate the full file.

---

### MODULE 1 — Lab Setup

### Prompt 1.1 — Normal Traffic Generator

```
Write a Python script `lab/normal_traffic.py` that simulates realistic benign DNS traffic.

Requirements:
- Load a list of 200 popular domains from a text file at `data/top1000_domains.txt`
- Generate DNS queries using the `dnspython` library (dns.resolver.Resolver)
- Randomly combine subdomain prefixes like www, api, cdn, mail, static with base domains
- Send queries at random intervals between 0.5s and 5.0s to simulate human browsing
- Accept CLI arguments: --duration (seconds, default 300), --interface, --log-file
- Log each query to both stdout and a CSV file with columns: timestamp, src_ip, query_name, query_type
- Handle NXDOMAIN and timeout exceptions silently
- Use loguru for logging with colored output
```

### Prompt 1.2 — Attack Simulator

```
Write a Python script `lab/attack_simulator.py` that simulates DNS-based covert C2 communication.

The script must implement 4 attack modes:

1. BEACONING: Send DNS queries to alive-host7.labdomain.internal at regular intervals
   (default 15 seconds, with ±1s jitter). Run for specified duration.

2. EXFILTRATION: Take a secret string, split into 30-char chunks, Base64-encode each chunk,
   embed in subdomain like chunk0.dGhpcyBpcyBhIHNlY3JldA==.labdomain.internal and send as TXT queries.

3. DGA: Generate 50 pseudo-random subdomains using MD5(seed+index)[:12], query each as A record.
   Most will NXDOMAIN — that is intentional.

4. FULL_SESSION: Run beaconing(60s) → exfil(sample_data) → dga(30 domains) → beaconing(120s)

Requirements:
- Use dnspython for queries
- CLI: --mode [beacon|exfil|dga|full] --duration --c2-domain --interval
- Log all queries with [ATTACK] prefix using loguru
- Never actually connect to real attacker infrastructure — all queries go to local DNS only
```

### Prompt 1.3 — Docker Compose Lab

```
Write a docker-compose.yml that sets up a 3-container DNS IDS lab:

Container 1: victim
- Image: python:3.11
- Runs both normal_traffic.py and attack_simulator.py
- Volume mounts ./lab into /app
- Environment variable: ATTACK_MODE=full

Container 2: defender
- Image: python:3.11
- Runs capture/sniffer.py
- Shares a network with victim
- Volume mounts ./data/raw into /data/raw

Container 3: dashboard
- Image: python:3.11
- Runs: streamlit run dashboard/app.py
- Port: 8501:8501
- Volume mounts ./alerts and ./data

All containers on a custom bridge network called dns-lab-net.
Include a Makefile with targets: up, down, logs, demo.
```

---

### MODULE 2 — Capture & Parsing

### Prompt 2.1 — Live Packet Sniffer

```
Write a Python script `capture/sniffer.py` that captures DNS packets from a network interface.

Requirements:
- Use Scapy to sniff packets with filter "udp port 53"
- For each DNS query packet (qr=0), extract:
  timestamp, src_ip, dst_ip, query_name, query_type (integer), transaction_id
- For DNS response packets (qr=1), also extract: rcode, answer_count, response_ips
- Store records in a thread-safe list, flush to CSV every 100 records or every 30 seconds
- Accept CLI args: --interface (default eth0), --output (default data/raw/live.csv), --duration
- Handle packet decode errors gracefully with try/except
- Print a live counter to terminal: "Captured: 142 queries | Suspicious-looking: 7"
- Use loguru for all logging
- Include a mode --pcap-file to read from existing .pcap instead of live capture
```

### Prompt 2.2 — PCAP Parser

```
Write a Python script `capture/pcap_reader.py` that parses .pcap files into structured DataFrames.

Requirements:
- Use pyshark with display_filter='dns' to parse the pcap file
- Extract per packet: timestamp (float epoch), src_ip, dst_ip, query_name, query_type,
  rcode (from flags_rcode), transaction_id, answer (first A record if available)
- Convert timestamps to pandas datetime
- Clean query_name: strip trailing dot, lowercase, handle decode errors
- Save output as CSV to data/parsed/
- Print summary: total records, unique hosts, unique domains, NXDOMAIN rate
- Accept CLI: --input (pcap path) --output (csv path) --verbose
- Include a simple validate_record() function that drops malformed rows
```

---

### MODULE 3 — Feature Extraction

### Prompt 3.1 — Lexical Features

```
Write `features/lexical.py` — a module that extracts lexical/structural features from DNS query names.

Implement these functions:

1. shannon_entropy(s: str) -> float
   Shannon entropy of the character distribution. Higher = more random.

2. extract_lexical_features(query_name: str) -> dict
   Returns a dict with these keys:
   - query_length: total length of full query name
   - subdomain_length: length of subdomain part only
   - label_count: number of dot-separated labels
   - max_label_length: length of the longest label
   - full_entropy: entropy of full domain (no dots)
   - subdomain_entropy: entropy of subdomain only
   - digit_ratio: fraction of characters that are digits
   - hyphen_count: total hyphens
   - consonant_vowel_ratio: consonants / (consonants + vowels)
   - longest_consonant_run: max consecutive consonants
   - hex_ratio: fraction of chars that are valid hex [0-9a-fA-F]
   - looks_base64: 1 if subdomain looks like base64 (length>15, >88% base64 chars)
   - has_numeric_subdomain: 1 if any label is all digits length>=4

Include full docstrings for each function explaining the security meaning.
Write unit tests using pytest at the bottom in a if __name__ == '__main__' block.
```

### Prompt 3.2 — Temporal Features

```
Write `features/temporal.py` — a module for detecting temporal anomalies in DNS query sequences.

Requirements:

1. compute_inter_arrival_times(timestamps: List[float]) -> np.ndarray
   Returns array of time differences between consecutive queries from same source.

2. detect_beaconing(timestamps: List[float], min_queries=5, min_interval=5.0) -> dict
   Detect if a host is beaconing by checking if inter-arrival times have low coefficient of variation.
   Returns: {is_beaconing, beacon_interval, beacon_score (0-1), iat_mean, iat_std, iat_cv}
   A beacon_score > 0.7 indicates strong periodic behavior.
   Low CV = regular intervals = automated = suspicious.

3. temporal_features_for_host(host_df: pd.DataFrame) -> dict
   Given all DNS records for one host (with 'timestamp' column as float epoch):
   Returns: total_queries, query_rate_per_min, iat_mean, iat_std, iat_cv,
            is_beaconing (int), beacon_score, beacon_interval_est

Add detailed comments explaining why each metric matters for C2 detection.
Include example usage with synthetic data showing clearly that a beaconing machine
scores very differently from a human browsing machine.
```

### Prompt 3.3 — Session Features

```
Write `features/session.py` — a module for computing per-domain/per-host behavioral session features.

Requirements:

1. session_features_per_domain(df: pd.DataFrame, domain: str) -> dict
   For all queries containing the given domain, compute:
   - unique_src_hosts: number of distinct source IPs
   - total_queries: total query count
   - unique_subdomains: count of distinct full query names
   - nxdomain_rate: fraction with rcode==3
   - txt_query_ratio: fraction with query_type==16
   - queries_per_host_mean, queries_per_host_max
   - avg_query_length: mean of query_name lengths
   - avg_subdomain_entropy: mean of subdomain entropy values

2. host_domain_concentration(df: pd.DataFrame) -> pd.DataFrame
   For each (src_ip, base_domain) pair, compute how concentrated the host's
   queries are on that domain vs all domains.
   Returns DataFrame with columns: src_ip, domain, query_count, concentration_ratio

3. build_session_feature_matrix(df: pd.DataFrame) -> pd.DataFrame
   Runs all session features for every unique domain in df.
   Returns one row per domain with all features.
   Label column: 1 if domain contains 'labdomain' or known attack domain, else 0.

Include clear docstrings and example output.
```

### Prompt 3.4 — Feature Pipeline

```
Write `features/feature_pipeline.py` — the main orchestrator that runs all feature modules.

Requirements:
- Import lexical, temporal, and session feature modules
- Function: run_full_pipeline(raw_csv_path: str, output_path: str) -> pd.DataFrame
  1. Load raw CSV (columns: timestamp, src_ip, query_name, query_type, rcode, label)
  2. For each row, run extract_lexical_features() → merge back as columns
  3. For each src_ip, run temporal_features_for_host() → merge back per host
  4. For each domain, run session_features_per_domain() → merge back per domain
  5. Final DataFrame has all raw columns + all feature columns + label
  6. Save to output_path
  7. Print feature summary: shape, label distribution, top 5 most predictive features (by correlation with label)

- Function: get_feature_columns() -> List[str]
  Returns the ordered list of feature column names used for ML training.

- Include progress bars using tqdm.
- Handle missing values by filling with 0.
```

---

### MODULE 4 — Detection Engine

### Prompt 4.1 — Rule Engine

```
Write `detection/rule_engine.py` — a deterministic rule-based IDS for DNS anomalies.

Define a RuleViolation dataclass with fields: rule_id, description, severity (HIGH/MEDIUM/LOW), evidence (dict).

Implement run_rules(features: dict) -> List[RuleViolation] that checks these 8 rules:

R001: query_length > 80  → HIGH "Abnormally long query — possible payload encoding"
R002: subdomain_entropy > 3.8  → HIGH "High entropy subdomain — likely encoded/encrypted data"
R003: looks_base64 == 1  → MEDIUM "Base64 encoding pattern detected in subdomain"
R004: unique_subdomains > 25  → HIGH "Excessive unique subdomains — DNS tunneling signature"
R005: nxdomain_rate > 0.40  → MEDIUM "High NXDOMAIN rate — possible DGA domain scanning"
R006: txt_query_ratio > 0.30  → MEDIUM "Excessive TXT queries — possible data exfiltration"
R007: query_rate_per_min > 30  → MEDIUM "Abnormally high DNS query rate"
R008: hex_ratio > 0.75 AND subdomain_length > 20  → HIGH "Hex-encoded subdomain — possible tunneling"

Each violation must include the actual value and threshold in its evidence dict.

Add a function format_violations(violations: List[RuleViolation]) -> str
that formats violations as a readable report.

Add a function violation_summary(violations) -> dict
returning count by severity.
```

### Prompt 4.2 — Behavior Engine

```
Write `detection/behavior_engine.py` — detects sustained behavioral attack patterns.

Implement analyze_behavior(features: dict, temporal: dict) -> dict that returns a flags dict.

Check for these behavioral patterns:

1. BEACONING: temporal['is_beaconing'] == True
   Flag: {"detected": True, "interval": ..., "score": ..., "message": "Regular C2 check-in every Xs"}

2. SINGLE_HOST_CONCENTRATION: features['queries_per_host_max'] > 20 AND features['unique_src_hosts'] == 1
   Flag: {"detected": True, "message": "Single host repeatedly targeting rare domain — C2 behavior"}

3. TUNNEL_EXFIL_ESTIMATE: features['unique_subdomains'] > 10 AND features['avg_query_length'] > 50
   Flag with estimated bytes exfiltrated using formula: n_unique * (avg_len - 20) * 0.75
   Flag: {"detected": True, "estimated_bytes": ..., "message": "Estimated Xkb may have been exfiltrated"}

4. DGA_SWEEP: features['nxdomain_rate'] > 0.6 AND features['unique_subdomains'] > 20
   Flag: {"detected": True, "message": "DGA scanning pattern — malware looking for C2 server"}

5. AFTER_HOURS: If any queries occur between 00:00–06:00, flag as suspicious (automated activity)
   Flag: {"detected": True, "off_hours_count": ..., "message": "Activity during off-hours — automated behavior"}

Return all detected flags in a flat dict keyed by flag name.
```

### Prompt 4.3 — ML Model Wrapper

```
Write `detection/ml_model.py` — a clean wrapper around a trained scikit-learn/XGBoost model.

Requirements:

Class MLDetector:
  __init__(self, model_path: str, threshold: float = 0.75):
    Load model from pkl file using joblib.
    Store threshold and feature column list (import from features/feature_pipeline.py).

  predict(self, features: dict) -> dict:
    Convert features dict to DataFrame row with correct column order.
    Fill missing values with 0.
    Run model.predict_proba(), return:
    {"ml_score": float, "ml_malicious": bool, "ml_threshold": float, "confidence": "HIGH"/"MEDIUM"/"LOW"}
    Confidence: HIGH if score > 0.9 or < 0.1, MEDIUM if 0.7-0.9 or 0.1-0.3, LOW otherwise.

  predict_batch(self, df: pd.DataFrame) -> pd.DataFrame:
    Run predictions on entire DataFrame, return df with ml_score and ml_malicious columns added.

  explain(self, features: dict) -> List[str]:
    If model has feature_importances_, return top 5 features driving this prediction
    as human-readable strings like "subdomain_entropy=4.2 (high — expected ≤2.5)"

Add fallback: if model file doesn't exist, return ml_score=0.0 with a warning.
```

### Prompt 4.4 — Main Detector Orchestrator

```
Write `detection/detector.py` — the main orchestrator that combines all 3 detection layers.

Class DNSDetector:

  __init__(self, config_path="config.yaml"):
    Load config. Initialize RuleEngine, BehaviorEngine, MLDetector.

  analyze_session(self, src_ip: str, domain: str, features: dict, temporal: dict) -> dict:
    Run all 3 layers:
    1. rule_violations = run_rules(features)
    2. behavior_flags  = analyze_behavior(features, temporal)
    3. ml_result       = ml_detector.predict(features)
    4. score, severity = compute_risk_score(rule_violations, behavior_flags, ml_result)
    5. alert           = generate_alert(src_ip, domain, rule_violations, behavior_flags, ml_result, score_result)
    Return full result dict with all layers' output.

  run_on_dataframe(self, df: pd.DataFrame) -> List[dict]:
    For each unique (src_ip, domain) pair in df:
    - Compute aggregate features (call session/temporal modules)
    - Call analyze_session()
    - Collect all alerts
    Return sorted by score descending.

  live_analyze(self, pcap_path=None, interface=None):
    Stream packets, extract features on a rolling 60-second window per host,
    call analyze_session() every time window updates with new data.
    Print alerts to terminal in real-time.
```

---

### MODULE 5 — ML Training

### Prompt 5.1 — Full Training Script

```
Write `models/train.py` — a complete ML training pipeline for DNS malicious traffic classification.

Requirements:

FEATURE_COLS list (19 features):
query_length, subdomain_length, label_count, max_label_length,
full_entropy, subdomain_entropy, digit_ratio, hyphen_count,
consonant_vowel_ratio, longest_consonant_run, hex_ratio, looks_base64,
is_beaconing, beacon_score, iat_cv, query_rate_per_min,
unique_subdomains, nxdomain_rate, txt_query_ratio

Steps:
1. Load CSV from data/features/labeled_features.csv
2. Print class distribution
3. Apply SMOTE (from imblearn) to handle class imbalance
4. Train/test split 80/20 stratified
5. Train 3 models:
   a. RandomForestClassifier(n_estimators=200, class_weight='balanced')
   b. XGBClassifier(n_estimators=300, learning_rate=0.05)
   c. IsolationForest for unsupervised anomaly fallback
6. For RF and XGB: print classification_report and confusion_matrix
7. Run 5-fold stratified CV, print mean ± std F1
8. Plot and save feature importance chart as PNG
9. Save best model (by F1) to models/saved/dns_classifier.pkl
10. Also save a StandardScaler fitted on training data

Accept CLI: --data path --output-model path --verbose
Use loguru for all output.
```

### Prompt 5.2 — Model Evaluation

```
Write `models/evaluate.py` — a thorough model evaluation and analysis script.

Requirements:

1. Load model from models/saved/dns_classifier.pkl and test data
2. Generate and print:
   - Classification report (precision, recall, F1 per class)
   - Confusion matrix (formatted as a nice table)
   - ROC curve with AUC score
   - Precision-Recall curve
   - Feature importance bar chart (top 15 features)
   - False positive analysis: what do false positive cases look like?
   - False negative analysis: what do false negatives look like?

3. Threshold sweep: test model at thresholds 0.5, 0.6, 0.7, 0.75, 0.8, 0.9
   Show precision/recall/F1 at each threshold in a table.
   Recommend optimal threshold for this use case (security = prefer low FP rate).

4. Save all charts to models/evaluation_report/

5. Print a final human-readable summary:
   "At threshold 0.75: catches X% of attacks, with only Y% false positive rate"

Use matplotlib and sklearn.metrics throughout.
```

---

### MODULE 6 — Threat Scoring + Alerts

### Prompt 6.1 — Threat Scorer

```
Write `scoring/threat_scorer.py` — combines all detection signals into a 0-100 risk score.

Function compute_risk_score(rule_violations, behavior_flags, ml_result) -> dict:

Scoring breakdown (total max = 100):
- Rule layer (max 40 pts): HIGH=15pts, MEDIUM=8pts, LOW=3pts per violation (capped at 40)
- Behavior layer (max 35 pts):
    beaconing = 20pts
    single_host_concentration = 8pts
    tunnel_exfil_estimate = 10pts
    dga_sweep = 12pts
    after_hours = 5pts
    (capped at 35)
- ML layer (max 25 pts): ml_score * 25

Severity thresholds: HIGH>=70, MEDIUM>=40, LOW<40

Returns dict with:
total_score (0-100), rule_score, behavior_score, ml_score_contribution,
severity, recommended_action (string explaining what analyst should do)

Also write: score_to_color(score) -> str  returns hex color for dashboard use
And: format_score_breakdown(score_dict) -> str  readable formatted summary
```

### Prompt 6.2 — Alert Engine

```
Write `alerts/alert_engine.py` — generates structured, analyst-ready alerts with full evidence.

1. Create SQLite database with table:
   alerts(alert_id TEXT, timestamp TEXT, src_host TEXT, domain TEXT,
          severity TEXT, total_score REAL, reasons TEXT (JSON),
          ml_score REAL, is_beaconing INTEGER, resolved INTEGER DEFAULT 0)

2. Function generate_alert(src_host, domain, rule_violations, behavior_flags, ml_result, score_result) -> dict:
   Build complete alert dict with:
   - alert_id: 8-char uppercase UUID prefix
   - All input fields summarized
   - reasons: list of human-readable strings for each evidence piece
   - Save to SQLite
   - Return dict

3. Function get_alerts(severity=None, resolved=False, limit=50) -> List[dict]:
   Query and return alerts from DB with optional filters.

4. Function resolve_alert(alert_id: str):
   Mark alert as resolved.

5. Function format_terminal_alert(alert: dict) -> str:
   Format alert as a colored terminal block using colorama:
   ╔══════════════╗
   ║ 🚨 HIGH      ║
   ╠══════════════╣
   ║ Host: ...    ║
   ║ Score: 84/100║
   ║ Evidence:    ║
   ║   • ...      ║
   ╚══════════════╝
```

---

### MODULE 7 — Dashboard

### Prompt 7.1 — Main Streamlit Dashboard

```
Write `dashboard/app.py` — a dark-themed SOC-style Streamlit security dashboard.

Requirements:

Theme: dark background (#0d0d14), green accent (#00ff99), blue headings (#88ccff), monospace fonts.

Layout (6 sections):

1. HEADER: Title "🛡️ DNS Intrusion Detection System" + status indicator (MONITORING ACTIVE)

2. KPI ROW: 5 metric cards showing:
   Total DNS Queries, Suspicious Queries, Alerts Raised, HIGH Severity Alerts, Unique Compromised Hosts

3. LEFT COLUMN (60%):
   a. DNS Traffic Over Time — plotly line chart, normal (green) vs suspicious (red) per minute
   b. Subdomain Entropy Distribution — histogram showing normal vs attack separation
   c. Query Length Distribution — same

4. RIGHT COLUMN (40%):
   a. Severity Breakdown — plotly pie chart
   b. Attack Type Breakdown — bar chart
   c. Top Suspicious Hosts — bar chart ranked by risk score

5. ALERTS PANEL:
   For each alert (sorted HIGH first), show an expander with:
   - Header: severity icon + host + domain + score
   - Body: 3 metric cols + evidence bullet list (color-coded by rule vs behavior vs ml)
   - Beaconing badge if beaconing detected

6. DNS QUERY LOG: Last 50 queries in a dataframe with color-coded status column

Load data from SQLite alerts DB and a parsed CSV.
Auto-refresh every 10 seconds using st.rerun().
Add sidebar with: simulation controls, threshold sliders for rules.
```

### Prompt 7.2 — Beacon Visualization

```
Write `dashboard/components/beacon_chart.py` — a plotly chart component for beaconing analysis.

Function render_beacon_chart(host_df: pd.DataFrame, host_ip: str):
  host_df has columns: timestamp, query_name, label

1. Plot inter-arrival times as a scatter plot over time
   - X axis: query sequence number
   - Y axis: seconds since last query
   - Color: red if IAT is within 3s of detected beacon interval, green otherwise
   - Title: f"Inter-arrival times for {host_ip}"

2. If beaconing is detected, add a horizontal dashed line at the beacon interval
   with annotation: "Beacon interval: Xs"

3. Add a second subplot below showing query_name entropy over time
   to visualize when encoded subdomains appear

4. Return the plotly figure (do not call st.plotly_chart — let the caller do that)

Also write render_iat_histogram(timestamps: List[float]) that shows the distribution
of inter-arrival times as a histogram. A beaconing machine will show a sharp spike
at the beacon interval, while a human will show a flat distribution.
```

---

### MODULE 8 — Integration & Testing

### Prompt 8.1 — End-to-End Integration Script

```
Write `run_pipeline.py` — a single script that runs the entire DNS IDS pipeline.

Modes:
--mode demo:
  1. Generate 5 minutes of simulated traffic (normal + attack) using the simulation functions
  2. Run feature extraction
  3. Run detection engine (rules + behavior, skip ML if no model)
  4. Print all alerts to terminal with colorama formatting
  5. Launch Streamlit dashboard

--mode live:
  1. Start packet sniffer on --interface (default eth0)
  2. Every 30 seconds, run feature pipeline on new packets
  3. Run detection on new sessions
  4. Append alerts to DB
  (Dashboard must be running separately)

--mode offline --pcap path/to/file.pcap:
  1. Parse pcap file
  2. Run full pipeline
  3. Print report + save alerts

--mode train --data path/to/features.csv:
  1. Run model training
  2. Print evaluation results
  3. Save model

Handle all modes cleanly with argparse.
Print a startup banner showing which mode is active and what is being monitored.
```

### Prompt 8.2 — Test Suite

```
Write a pytest test suite covering the core modules.

File `tests/test_features.py`:
- Test shannon_entropy: empty string=0, uniform string = log2(n), all-same chars = 0
- Test extract_lexical_features: normal domain (google.com) should have entropy < 3.0
- Test extract_lexical_features: encoded subdomain should have entropy > 3.5 and looks_base64=1
- Test detect_beaconing: timestamps at exactly 15s intervals → is_beaconing=True, beacon_score > 0.9
- Test detect_beaconing: random timestamps → is_beaconing=False

File `tests/test_rules.py`:
- Test each rule individually with features that trigger it and features that don't
- Test that a normal google.com query triggers zero rules
- Test that a Base64-encoded 90-char subdomain query triggers at least R001 and R002

File `tests/test_scoring.py`:
- Test that HIGH severity requires score >= 70
- Test that all-HIGH violations + beaconing + ml_score=0.95 gives score >= 70
- Test that zero violations + no beaconing + ml_score=0.1 gives LOW severity

Use pytest.mark.parametrize for edge cases.
```

---

### MODULE 9 — Dataset Utilities

### Prompt 9.1 — Data Generator for ML Training

```
Write `data/generate_training_data.py` — generates a fully labeled dataset for ML training.

Requirements:
Generate a CSV with 10,000 rows total (70% benign, 30% malicious).

BENIGN rows:
- Random domains from top-1000 list with normal subdomains
- Realistic feature values: entropy 1.5-3.0, length 10-40, digit_ratio < 0.15
- Random timestamps with human-like irregular gaps
- is_beaconing=0, beacon_score=0, all normal values

MALICIOUS rows (mix of attack types, 3 subtypes equally distributed):

Type A — DNS Tunneling:
- Base64-looking subdomains, length 60-100, entropy 3.8-4.5
- unique_subdomains 15-50, txt_query_ratio 0.3-0.8

Type B — Beaconing C2:
- Regular timestamps (beacon every 10-20s), beacon_score 0.8-1.0, iat_cv < 0.2
- Length 25-45, entropy 2.0-3.0

Type C — DGA Scanning:
- Random hex-looking subdomains, nxdomain_rate 0.6-0.95
- unique_subdomains 20-60, entropy 3.5-4.2

Add Gaussian noise to all features to prevent perfect separation.
Save to data/features/synthetic_training_data.csv
Print class distribution and feature statistics at the end.
```

### Prompt 9.2 — Dataset Downloader

```
Write `data/download_datasets.py` — downloads and preprocesses public DNS security datasets.

Implement download functions for:

1. CIRA-CIC-DoHBrw 2020 dataset:
   URL: https://www.unb.ca/cic/datasets/dohbrw-2020.html
   Process: Extract relevant columns, rename to standard schema, add label column

2. DGTA Benchmark (DGA domains):
   URL: https://github.com/philarkwright/DGA-ThreatAnalysis (GitHub release)
   Process: Load benign and DGA domain lists, compute lexical features for each, label accordingly

3. Majestic Million (benign domains):
   URL: https://downloads.majestic.com/majestic_million.csv
   Process: Take top 10000 rows, generate realistic DNS query records

For each dataset:
- Download to data/external/ if not already present
- Parse into standard schema: query_name, label, source_dataset
- Compute all lexical features using features/lexical.py
- Save processed version to data/external/processed/

Final function: merge_all_datasets() -> pd.DataFrame
Combines all processed datasets, deduplicates, balances classes.
Saves to data/features/merged_training_data.csv

Use requests with progress bars (tqdm) for downloads.
Handle failed downloads gracefully.
```

---

## Quick Reference — What to Run in What Order

```
WEEK 1
------
demo.py            ← Run THIS right now (it's in this file above)
Prompt 1.1         ← normal_traffic.py
Prompt 1.2         ← attack_simulator.py
Prompt 2.1         ← sniffer.py

WEEK 2
------
Prompt 2.2         ← pcap_reader.py
Prompt 3.1         ← lexical.py
Prompt 3.2         ← temporal.py
Prompt 3.3         ← session.py
Prompt 3.4         ← feature_pipeline.py

WEEK 3
------
Prompt 9.1         ← generate_training_data.py (get data FIRST)
Prompt 5.1         ← train.py (train the model)
Prompt 5.2         ← evaluate.py

WEEK 4
------
Prompt 4.1         ← rule_engine.py
Prompt 4.2         ← behavior_engine.py
Prompt 4.3         ← ml_model.py
Prompt 4.4         ← detector.py

WEEK 5
------
Prompt 6.1         ← threat_scorer.py
Prompt 6.2         ← alert_engine.py
Prompt 7.1         ← dashboard/app.py (full version)
Prompt 8.1         ← run_pipeline.py
Prompt 8.2         ← tests/
```

---

## What You Can Show Right Now vs Later

| Time | What to Show | How to Run |
| --- | --- | --- |
| **Now (20 min)** | Live dashboard with simulation, alerts, entropy charts, beaconing detection | `streamlit run demo.py` |
| **Day 1** | Real DNS capture + parsed CSV + feature extraction output | `python capture/sniffer.py` |
| **Week 1** | Rule engine + behavior engine raising real alerts on real captured traffic | `python run_pipeline.py --mode offline` |
| **Week 2** | Trained ML model + confusion matrix + feature importance chart | `python models/train.py` |
| **Week 3** | Full end-to-end: simulate → capture → detect → dashboard | `python run_pipeline.py --mode demo` |
| **Final demo** | Live demo: start normal, start attack, watch alerts fire in real time | Full demo flow |

---

*All prompts are designed for Claude, ChatGPT, or Cursor. Paste each prompt as-is — they are written to produce production-usable code, not toy examples.*