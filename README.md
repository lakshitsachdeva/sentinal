# SENTINEL DNS IDS

Real-time DNS intrusion detection prototype with:
- Rule-based detection
- Behavioral detection (beaconing, concentration, tunneling signals)
- ML scoring and explainable alert panels
- React SOC dashboard + Python API + continuous feed loop

## Architecture (Local Runtime)

- React UI: `http://localhost:3000`
- API: `http://localhost:8000`
- Feed loop: background process that continuously runs pipeline cycles

---

## Quick Start (macOS / Linux)

### 1) Prerequisites

- Python 3.11+ (virtual environment recommended)
- Node.js 18+ and npm

### 2) Install dependencies

```bash
cd /Users/lakshitsachdeva/Desktop/Projects/cybersec-proj

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cd showcase
npm install
cd ..
```

### 3) Run (one command)

```bash
./run_sentinel.sh --reset
```

Then open:
- `http://localhost:3000`

Useful commands:

```bash
./run_sentinel.sh --status
./run_sentinel.sh --down
./run_sentinel.sh --reset
```

---

## Quick Start (Windows)

You have 2 options.

## Option A (Recommended): WSL2 Ubuntu

This gives the most reliable experience and uses the same commands as macOS/Linux.

1. Open WSL terminal and clone/open project.
2. Run:

```bash
cd /mnt/c/Users/<your-user>/Desktop/Projects/cybersec-proj

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cd showcase
npm install
cd ..

./run_sentinel.sh --reset
```

Open `http://localhost:3000` from Windows browser.

## Option B: Native Windows (PowerShell)

### 1) Prerequisites

- Python 3.11+ (`py --version`)
- Node.js 18+ (`node -v`)

### 2) Install dependencies

```powershell
cd C:\Users\<your-user>\Desktop\Projects\cybersec-proj

py -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt

cd showcase
npm install
cd ..
```

### 3) Start in 3 terminals

Terminal 1 (API):

```powershell
cd C:\Users\<your-user>\Desktop\Projects\cybersec-proj
.\.venv\Scripts\python api\server.py --port 8000
```

Terminal 2 (feed loop demo):

```powershell
cd C:\Users\<your-user>\Desktop\Projects\cybersec-proj
while ($true) {
  $runId = "win-feed-" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  .\.venv\Scripts\python run_pipeline.py --mode demo --no-dashboard --run-id $runId
  Start-Sleep -Seconds 12
}
```

Terminal 3 (React):

```powershell
cd C:\Users\<your-user>\Desktop\Projects\cybersec-proj\showcase
$env:REACT_APP_API_BASE="http://localhost:8000"
npm start
```

Open:
- `http://localhost:3000`

---

## Demo Flow (for presentations)

1. Landing page: system mode + counters + matrix visualization
2. Dashboard:
   - Situation summary bar
   - KPI cards
   - Alerts panel (HIGH/MEDIUM prioritized)
   - Threat network graph
   - Query log
3. Expand a HIGH alert:
   - Score gauge
   - SHAP feature attribution bars
   - IAT waveform (if beaconing)
   - Threat radar profile
4. Model page (`/model`):
   - Training curves
   - ROC curve
   - Threshold sweep
   - Confusion matrix
   - Drift/version history

---

## Troubleshooting

## Dashboard looks stale / old UI

```bash
./run_sentinel.sh --down
./run_sentinel.sh --reset
```

Then hard-refresh browser:
- macOS: `Cmd + Shift + R`
- Windows: `Ctrl + F5`

## Port already in use

- API `8000` or React `3000` collision:

```bash
./run_sentinel.sh --down
./run_sentinel.sh
```

## No HIGH alerts visible

- Alerts are now sorted by severity and score in API + dashboard.
- Reset and let feed run for ~15-30 seconds:

```bash
./run_sentinel.sh --reset
```

## Verify health quickly

```bash
./run_sentinel.sh --status
curl http://localhost:8000/api/summary
```

---

## Testing and Build

Run backend tests:

```bash
cd /Users/lakshitsachdeva/Desktop/Projects/cybersec-proj
pytest -q --tb=no
```

Build frontend:

```bash
cd /Users/lakshitsachdeva/Desktop/Projects/cybersec-proj/showcase
npm run build
```

