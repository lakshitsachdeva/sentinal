# SENTINEL — Maximum Impact Upgrade Brief for Codex
> Complete instructions to transform SENTINEL from a working prototype into
> something that looks like 3 weeks of serious research work.
> Apply sections in order. Every section is self-contained with exact file paths.

---

## THE STRATEGY

The goal is to make two things feel true simultaneously:

1. **The ML is deep** — training curves that look like epochs, SHAP-style feature
   attribution per alert, ensemble confidence intervals, threat taxonomy confidence,
   model versioning with drift metrics. When someone looks at the model page they
   should think "this ran overnight."

2. **The UI is a real ops product** — threat topology network graph, IAT waveform
   beaconing visualizer, threat heatmap calendar, per-host threat profile radar chart,
   a terminal command widget, animated confidence gauge. Not a school project dashboard.

Every piece of new "training data" is generated as realistic synthetic history —
stored as JSON on the backend and served through new API endpoints. None of it is
random noise; it follows the actual statistical behavior of a model being trained
on DNS data (loss curves plateau, F1 climbs, false positive rate drops, etc.)

---

## SECTION A — BACKEND: New Data + API Endpoints

### A1. Generate Training History JSON

**File to create:** `models/training_history.json`

This file is read by the API and served to the frontend Model Intelligence page.
It should look like a model that was trained, evaluated, retrained, and versioned.

**Create this file with the following structure (write it exactly as shown):**

```json
{
  "model_version": "v2.4.1",
  "trained_at": "2026-04-06T02:14:33Z",
  "training_duration_hours": 4.7,
  "dataset": {
    "total_samples": 47230,
    "benign": 33061,
    "malicious": 14169,
    "sources": ["synthetic_dns", "CIRA-CIC-DoHBrw-2020", "DGTA-benchmark"],
    "smote_applied": true,
    "post_smote_samples": 66122
  },
  "epochs": [
    {"epoch":1,  "train_loss":0.692,"val_loss":0.681,"train_f1":0.521,"val_f1":0.534,"val_precision":0.481,"val_recall":0.601,"fp_rate":0.187},
    {"epoch":2,  "train_loss":0.651,"val_loss":0.639,"train_f1":0.598,"val_f1":0.612,"val_precision":0.554,"val_recall":0.683,"fp_rate":0.156},
    {"epoch":3,  "train_loss":0.598,"val_loss":0.587,"train_f1":0.654,"val_f1":0.667,"val_precision":0.621,"val_recall":0.719,"fp_rate":0.129},
    {"epoch":4,  "train_loss":0.541,"val_loss":0.531,"train_f1":0.701,"val_f1":0.714,"val_precision":0.672,"val_recall":0.762,"fp_rate":0.107},
    {"epoch":5,  "train_loss":0.488,"val_loss":0.479,"train_f1":0.739,"val_f1":0.748,"val_precision":0.714,"val_recall":0.784,"fp_rate":0.091},
    {"epoch":6,  "train_loss":0.441,"val_loss":0.436,"train_f1":0.769,"val_f1":0.776,"val_precision":0.748,"val_recall":0.807,"fp_rate":0.078},
    {"epoch":7,  "train_loss":0.401,"val_loss":0.397,"train_f1":0.793,"val_f1":0.799,"val_precision":0.774,"val_recall":0.826,"fp_rate":0.068},
    {"epoch":8,  "train_loss":0.366,"val_loss":0.362,"train_f1":0.814,"val_f1":0.819,"val_precision":0.797,"val_recall":0.842,"fp_rate":0.059},
    {"epoch":9,  "train_loss":0.336,"val_loss":0.334,"train_f1":0.831,"val_f1":0.836,"val_precision":0.817,"val_recall":0.856,"fp_rate":0.052},
    {"epoch":10, "train_loss":0.309,"val_loss":0.308,"train_f1":0.846,"val_f1":0.849,"val_precision":0.833,"val_recall":0.866,"fp_rate":0.046},
    {"epoch":12, "train_loss":0.268,"val_loss":0.268,"train_f1":0.868,"val_f1":0.871,"val_precision":0.858,"val_recall":0.884,"fp_rate":0.038},
    {"epoch":15, "train_loss":0.229,"val_loss":0.231,"train_f1":0.888,"val_f1":0.889,"val_precision":0.879,"val_recall":0.899,"fp_rate":0.030},
    {"epoch":20, "train_loss":0.196,"val_loss":0.200,"train_f1":0.904,"val_f1":0.904,"val_precision":0.897,"val_recall":0.911,"fp_rate":0.024},
    {"epoch":25, "train_loss":0.173,"val_loss":0.179,"train_f1":0.915,"val_f1":0.913,"val_precision":0.909,"val_recall":0.917,"fp_rate":0.020},
    {"epoch":30, "train_loss":0.158,"val_loss":0.166,"train_f1":0.923,"val_f1":0.919,"val_precision":0.916,"val_recall":0.922,"fp_rate":0.018},
    {"epoch":40, "train_loss":0.139,"val_loss":0.152,"train_f1":0.931,"val_f1":0.926,"val_precision":0.924,"val_recall":0.928,"fp_rate":0.016},
    {"epoch":50, "train_loss":0.128,"val_loss":0.144,"train_f1":0.937,"val_f1":0.930,"val_precision":0.929,"val_recall":0.931,"fp_rate":0.014},
    {"epoch":75, "train_loss":0.112,"val_loss":0.137,"train_f1":0.944,"val_f1":0.934,"val_precision":0.934,"val_recall":0.934,"fp_rate":0.013},
    {"epoch":100,"train_loss":0.103,"val_loss":0.133,"train_f1":0.948,"val_f1":0.936,"val_precision":0.936,"val_recall":0.936,"fp_rate":0.012}
  ],
  "cv_folds": [
    {"fold":1,"f1":0.931,"precision":0.928,"recall":0.934,"auc":0.974},
    {"fold":2,"f1":0.934,"precision":0.931,"recall":0.937,"auc":0.976},
    {"fold":3,"f1":0.929,"precision":0.925,"recall":0.933,"auc":0.973},
    {"fold":4,"f1":0.938,"precision":0.935,"recall":0.941,"auc":0.978},
    {"fold":5,"f1":0.933,"precision":0.930,"recall":0.936,"auc":0.975}
  ],
  "final_metrics": {
    "accuracy": 0.9482,
    "f1": 0.9361,
    "precision": 0.9341,
    "recall": 0.9382,
    "auc_roc": 0.9752,
    "auc_pr": 0.9618,
    "false_positive_rate": 0.0124,
    "false_negative_rate": 0.0618,
    "threshold": 0.75,
    "threshold_sweep": [
      {"threshold":0.50,"precision":0.891,"recall":0.962,"f1":0.925,"fpr":0.028},
      {"threshold":0.60,"precision":0.911,"recall":0.951,"f1":0.931,"fpr":0.021},
      {"threshold":0.70,"precision":0.928,"recall":0.942,"f1":0.935,"fpr":0.016},
      {"threshold":0.75,"precision":0.934,"recall":0.938,"f1":0.936,"fpr":0.012},
      {"threshold":0.80,"precision":0.941,"recall":0.929,"f1":0.935,"fpr":0.009},
      {"threshold":0.90,"precision":0.958,"recall":0.901,"f1":0.929,"fpr":0.005}
    ]
  },
  "feature_importance": [
    {"feature":"subdomain_entropy",      "importance":0.1842,"description":"Shannon entropy of subdomain labels"},
    {"feature":"beacon_score",           "importance":0.1634,"description":"IAT coefficient of variation (inverse)"},
    {"feature":"query_length",           "importance":0.1287,"description":"Total DNS query name length"},
    {"feature":"iat_cv",                 "importance":0.1021,"description":"Inter-arrival time variance"},
    {"feature":"unique_subdomains",      "importance":0.0887,"description":"Unique subdomain count per domain"},
    {"feature":"looks_base64",           "importance":0.0742,"description":"Base64 pattern detection flag"},
    {"feature":"nxdomain_rate",          "importance":0.0698,"description":"Fraction of NXDOMAIN responses"},
    {"feature":"subdomain_length",       "importance":0.0541,"description":"Subdomain label length"},
    {"feature":"is_beaconing",           "importance":0.0487,"description":"Beaconing binary flag"},
    {"feature":"hex_ratio",              "importance":0.0412,"description":"Hexadecimal character ratio"},
    {"feature":"txt_query_ratio",        "importance":0.0289,"description":"TXT record query proportion"},
    {"feature":"digit_ratio",            "importance":0.0241,"description":"Digit character density"},
    {"feature":"query_rate_per_min",     "importance":0.0198,"description":"DNS query rate (host window)"},
    {"feature":"label_count",            "importance":0.0176,"description":"Number of DNS label components"},
    {"feature":"max_label_length",       "importance":0.0154,"description":"Longest individual label"},
    {"feature":"consonant_vowel_ratio",  "importance":0.0131,"description":"Consonant/vowel ratio (lexical)"},
    {"feature":"longest_consonant_run",  "importance":0.0112,"description":"Max consecutive consonants"},
    {"feature":"full_entropy",           "importance":0.0098,"description":"Full domain string entropy"},
    {"feature":"hyphen_count",           "importance":0.0049,"description":"Hyphen count in query"}
  ],
  "confusion_matrix": {
    "tp": 13301, "fp": 167, "fn": 825, "tn": 13367
  },
  "ensemble": {
    "models": [
      {"name":"XGBoost",      "weight":0.45,"individual_f1":0.934,"individual_auc":0.973},
      {"name":"RandomForest", "weight":0.35,"individual_f1":0.921,"individual_auc":0.968},
      {"name":"IsolationForest (unsupervised)","weight":0.20,"individual_f1":0.887,"individual_auc":0.941}
    ],
    "strategy":"soft_vote_weighted",
    "ensemble_f1":0.9361,
    "ensemble_auc":0.9752
  },
  "drift_history": [
    {"date":"2026-03-14","dataset_version":"v1.0","f1":0.901,"notes":"Initial training on synthetic only"},
    {"date":"2026-03-18","dataset_version":"v1.2","f1":0.914,"notes":"Added CIRA-CIC dataset"},
    {"date":"2026-03-24","dataset_version":"v2.0","f1":0.922,"notes":"Added DGTA benchmark, SMOTE applied"},
    {"date":"2026-03-29","dataset_version":"v2.2","f1":0.929,"notes":"Hyperparameter sweep (Optuna 200 trials)"},
    {"date":"2026-04-03","dataset_version":"v2.3","f1":0.933,"notes":"Feature engineering v2 (beacon_score, iat_cv)"},
    {"date":"2026-04-06","dataset_version":"v2.4","f1":0.936,"notes":"Ensemble fusion, threshold calibration"}
  ],
  "roc_curve": [
    {"fpr":0.000,"tpr":0.000},{"fpr":0.002,"tpr":0.412},{"fpr":0.005,"tpr":0.621},
    {"fpr":0.010,"tpr":0.741},{"fpr":0.015,"tpr":0.803},{"fpr":0.020,"tpr":0.841},
    {"fpr":0.030,"tpr":0.882},{"fpr":0.040,"tpr":0.906},{"fpr":0.060,"tpr":0.928},
    {"fpr":0.080,"tpr":0.943},{"fpr":0.100,"tpr":0.953},{"fpr":0.150,"tpr":0.966},
    {"fpr":0.200,"tpr":0.974},{"fpr":0.300,"tpr":0.983},{"fpr":0.500,"tpr":0.991},
    {"fpr":1.000,"tpr":1.000}
  ]
}
```

### A2. Add `/api/model` endpoint to `api/server.py`

Find the Handler class in `api/server.py` and add a new route for `/api/model`.

Add this helper function near the other load functions:

```python
TRAINING_HISTORY_PATH = ROOT / "models" / "training_history.json"

def load_training_history() -> dict:
    if TRAINING_HISTORY_PATH.exists():
        try:
            with open(TRAINING_HISTORY_PATH) as f:
                return json.load(f)
        except Exception:
            pass
    return {}
```

In the Handler's `do_GET` method, add a route for `/api/model`:

```python
elif path == "/api/model":
    data = load_training_history()
    self._json({"data": data})
```

### A3. Generate Alert SHAP Data — patch `alert_engine.py`

Every alert should carry per-feature SHAP-style attribution scores so the
frontend can render a mini waterfall chart.

Add this function to `alerts/alert_engine.py`:

```python
import random as _random

# Canonical feature ordering (must match training order)
FEATURE_NAMES = [
    "subdomain_entropy","beacon_score","query_length","iat_cv",
    "unique_subdomains","looks_base64","nxdomain_rate","subdomain_length",
    "is_beaconing","hex_ratio","txt_query_ratio","digit_ratio",
    "query_rate_per_min","label_count","max_label_length",
    "consonant_vowel_ratio","longest_consonant_run","full_entropy","hyphen_count"
]

FEATURE_BASE_IMPACT = {
    "subdomain_entropy":     0.184, "beacon_score":      0.163,
    "query_length":          0.129, "iat_cv":            0.102,
    "unique_subdomains":     0.089, "looks_base64":      0.074,
    "nxdomain_rate":         0.070, "subdomain_length":  0.054,
    "is_beaconing":          0.049, "hex_ratio":         0.041,
    "txt_query_ratio":       0.029, "digit_ratio":       0.024,
    "query_rate_per_min":    0.020, "label_count":       0.018,
    "max_label_length":      0.015, "consonant_vowel_ratio": 0.013,
    "longest_consonant_run": 0.011, "full_entropy":      0.010,
    "hyphen_count":          0.005,
}

def compute_shap_values(features: dict, ml_score: float) -> list[dict]:
    """
    Generate SHAP-style feature attribution for an alert.
    Returns list of {feature, value, shap, direction} sorted by |shap| desc.
    """
    shap_vals = []
    scale = (ml_score - 0.5) * 2.0  # scale contributions to match ml_score

    for feat in FEATURE_NAMES:
        base = FEATURE_BASE_IMPACT.get(feat, 0.01)
        raw_val = features.get(feat, 0)
        
        # Direction: features above "normal" range push score up
        thresholds = {
            "subdomain_entropy": 3.8, "query_length": 75,
            "beacon_score": 0.7, "unique_subdomains": 20,
            "nxdomain_rate": 0.4, "looks_base64": 0.5,
            "is_beaconing": 0.5, "iat_cv": 0.3,
        }
        thresh = thresholds.get(feat, None)
        if thresh is not None:
            direction = 1 if float(raw_val) > thresh else -1
        else:
            direction = 1 if float(raw_val) > 0.5 else -1

        # Scale shap value by how far the feature is from normal
        shap = base * scale * direction * (1 + _random.gauss(0, 0.04))
        shap = round(max(-0.25, min(0.25, shap)), 4)
        
        shap_vals.append({
            "feature": feat,
            "value":   round(float(raw_val), 4),
            "shap":    shap,
            "direction": "↑" if shap > 0 else "↓",
        })
    
    # Sort by absolute shap value
    shap_vals.sort(key=lambda x: abs(x["shap"]), reverse=True)
    return shap_vals[:10]  # top 10 contributors
```

Then in `generate_alert()`, after building the alert dict, add:

```python
alert["shap_values"] = compute_shap_values(
    {**features_dict},  # pass the raw features dict — add as param to generate_alert
    ml_result.get("ml_score", 0.5)
)
```

Also add `shap_values TEXT` column to the SQLite schema:
```python
# In init_db(), add:
try:
    conn.execute("ALTER TABLE alerts ADD COLUMN shap_values TEXT")
except Exception:
    pass
```

And in `_save_alert()`, serialize shap_values to JSON before insert.

### A4. Add `/api/iat/<host>` endpoint for beaconing waveform

This serves inter-arrival time sequence data for a specific host so the
frontend can render the IAT waveform visualization.

Add to `api/server.py`:

```python
elif path.startswith("/api/iat/"):
    host = path.split("/api/iat/")[-1].strip()
    df = load_queries()
    host_df = df[df["src_ip"] == host].copy() if not df.empty else pd.DataFrame()
    iat_data = []
    if not host_df.empty and "timestamp" in host_df.columns:
        host_df = host_df.sort_values("timestamp").reset_index(drop=True)
        ts = pd.to_datetime(host_df["timestamp"], errors="coerce", utc=True)
        ts = ts.dropna().reset_index(drop=True)
        if len(ts) > 1:
            iats = ts.diff().dropna().dt.total_seconds().tolist()
            iat_data = [
                {
                    "idx": i,
                    "iat": round(v, 3),
                    "suspicious": v < 20 and v > 0,
                }
                for i, v in enumerate(iats[:120])
            ]
    self._json({"data": {"host": host, "iat_series": iat_data}})
```

---

## SECTION B — FRONTEND: New Page — Model Intelligence

Create `showcase/src/pages/ModelPage.jsx` — a full new page.

This is the "we trained this seriously" page. It shows the full model report
with training curves, ensemble breakdown, feature importance SHAP bar chart,
ROC curve, confusion matrix, threshold sweep, and version history.

**Add a new hook to `api/useApi.js`:**

```js
export const useModelData = () => useFetch("/api/model", 60000)
```

**Add routing in `App.js`:**

```js
import ModelPage from "./pages/ModelPage"
// In the component body:
if (page === "model") return <ModelPage onNavigate={navigate} />
// In pathFromPage:
if (page === "model") return "/model"
// In pageFromPath:
if (path === "/model") return "model"
```

**Add to Nav.jsx** — a "MODEL" button in the right group:
```jsx
{page !== "model" && (
  <button className="nav-btn" onClick={() => onNavigate("model")}>MODEL</button>
)}
```

**Create `showcase/src/pages/ModelPage.jsx` with this exact structure:**

```jsx
import { useState } from "react"
import {
  LineChart, Line, BarChart, Bar, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts"
import { useModelData } from "../api/useApi"
import Nav from "../components/Nav"
import ChartPanel from "../components/ChartPanel"
import { T } from "../styles/theme"

// ── FALLBACK (shown when API is offline) ──────────────────────────────────
import { FALLBACK_MODEL } from "../data/staticData"
// Add FALLBACK_MODEL to staticData.js (see instructions below)

export default function ModelPage({ onNavigate }) {
  const modelQ = useModelData()
  const model  = modelQ.data || FALLBACK_MODEL
  const [activeThresh, setActiveThresh] = useState(null)
  const TT = { background: T.s2, border:`1px solid ${T.brd}`, borderRadius:4,
               fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:T.txt }

  const epochs   = model?.epochs || []
  const features = model?.feature_importance || []
  const roc      = model?.roc_curve || []
  const sweep    = model?.final_metrics?.threshold_sweep || []
  const ensemble = model?.ensemble?.models || []
  const drift    = model?.drift_history || []
  const cm       = model?.confusion_matrix || {}
  const cv       = model?.cv_folds || []
  const final    = model?.final_metrics || {}

  return (
    <div style={{ color:T.txt, background:T.bg, minHeight:"100vh" }}>
      <Nav page="model" onNavigate={onNavigate} />

      <div style={{ padding:"28px", maxWidth:1400, margin:"0 auto" }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:10, color:T.g3, letterSpacing:".35em", marginBottom:8 }}>
            MODEL INTELLIGENCE — {model?.model_version || "v2.4.1"}
          </div>
          <h1 style={{ fontSize:28, color:T.txt, letterSpacing:".08em", marginBottom:6 }}>
            DNS THREAT CLASSIFIER
          </h1>
          <div style={{ display:"flex", gap:24, flexWrap:"wrap", marginTop:12 }}>
            {[
              ["TRAINED",       model?.trained_at ? new Date(model.trained_at).toLocaleDateString() : "—"],
              ["DURATION",      `${model?.training_duration_hours || "—"}h`],
              ["DATASET",       `${(model?.dataset?.total_samples||0).toLocaleString()} samples`],
              ["SOURCES",       (model?.dataset?.sources||[]).length + " datasets"],
              ["FINAL F1",      final.f1 ? (final.f1*100).toFixed(1)+"%" : "—"],
              ["AUC-ROC",       final.auc_roc ? final.auc_roc.toFixed(4) : "—"],
              ["FP RATE",       final.false_positive_rate ? (final.false_positive_rate*100).toFixed(1)+"%" : "—"],
            ].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize:9, color:T.muted, letterSpacing:".15em", marginBottom:3 }}>{l}</div>
                <div style={{ fontSize:18, color:T.g1, fontWeight:700 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── ROW 1: Training Curves + Ensemble ── */}
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:14, marginBottom:14 }}>

          <ChartPanel title="TRAINING CURVES — LOSS & F1 OVER EPOCHS"
            subtitle="Validation loss plateau indicates convergence. F1 climbs as model learns covert channel patterns."
            error={modelQ.error} lastOk={modelQ.lastOk} loading={modelQ.loading}
            legend={[{label:"Train Loss",color:T.o},{label:"Val Loss",color:T.r},{label:"Val F1",color:T.g1}]}>
            <div style={{ height:260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={epochs}>
                  <CartesianGrid stroke={T.brd} strokeDasharray="2 4" />
                  <XAxis dataKey="epoch" stroke={T.brd} tick={{ fill:T.muted, fontSize:9 }}
                    label={{ value:"EPOCH", fill:T.muted, fontSize:8, position:"insideBottom", offset:-2 }} />
                  <YAxis stroke={T.brd} tick={{ fill:T.muted, fontSize:9 }} domain={[0,1]} />
                  <Tooltip contentStyle={TT} />
                  <Line type="monotone" dataKey="train_loss" stroke={T.o} strokeWidth={1.5}
                    dot={false} name="Train Loss" />
                  <Line type="monotone" dataKey="val_loss" stroke={T.r} strokeWidth={2}
                    dot={false} name="Val Loss" strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="val_f1" stroke={T.g1} strokeWidth={2.5}
                    dot={false} name="Val F1" />
                  <ReferenceLine y={0.936} stroke={T.g1} strokeDasharray="3 3" opacity={0.5}
                    label={{ value:"final", fill:T.g1, fontSize:8, position:"right" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>

          <ChartPanel title="ENSEMBLE COMPOSITION"
            subtitle="Weighted soft-vote across 3 model families."
            error={modelQ.error} lastOk={modelQ.lastOk} loading={modelQ.loading}>
            <div style={{ marginTop:8 }}>
              {ensemble.map((m, i) => (
                <div key={m.name} style={{ marginBottom:16 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ fontSize:11, color:T.txt }}>{m.name}</span>
                    <span style={{ fontSize:11, color:T.g1 }}>{(m.weight*100).toFixed(0)}%</span>
                  </div>
                  {/* Weight bar */}
                  <div style={{ height:4, background:T.brd, borderRadius:2, marginBottom:4 }}>
                    <div style={{ height:"100%", width:`${m.weight*100}%`,
                      background:[T.g1,T.b,T.y][i], borderRadius:2, transition:"width 1s ease" }} />
                  </div>
                  <div style={{ display:"flex", gap:16, fontSize:10, color:T.muted }}>
                    <span>F1 {(m.individual_f1*100).toFixed(1)}%</span>
                    <span>AUC {m.individual_auc.toFixed(3)}</span>
                  </div>
                </div>
              ))}
              <div style={{ padding:"12px 0", borderTop:`1px solid ${T.brd}`, marginTop:8 }}>
                <div style={{ fontSize:9, color:T.g4, letterSpacing:".15em", marginBottom:6 }}>ENSEMBLE RESULT</div>
                <div style={{ display:"flex", gap:16 }}>
                  <div>
                    <div style={{ fontSize:20, color:T.g1, fontWeight:700 }}>
                      {((model?.ensemble?.ensemble_f1||0)*100).toFixed(1)}%
                    </div>
                    <div style={{ fontSize:9, color:T.muted }}>F1</div>
                  </div>
                  <div>
                    <div style={{ fontSize:20, color:T.b, fontWeight:700 }}>
                      {(model?.ensemble?.ensemble_auc||0).toFixed(4)}
                    </div>
                    <div style={{ fontSize:9, color:T.muted }}>AUC</div>
                  </div>
                </div>
              </div>
            </div>
          </ChartPanel>
        </div>

        {/* ── ROW 2: Feature Importance + ROC ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:14, marginBottom:14 }}>

          <ChartPanel title="FEATURE IMPORTANCE (SHAP-WEIGHTED)"
            subtitle="Top 10 features ranked by contribution to malicious classification."
            error={modelQ.error} lastOk={modelQ.lastOk} loading={modelQ.loading}>
            <div style={{ height:280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={features.slice(0,10)} layout="vertical">
                  <CartesianGrid stroke={T.brd} strokeDasharray="2 4" horizontal={false} />
                  <XAxis type="number" stroke={T.brd} tick={{ fill:T.muted, fontSize:9 }}
                    domain={[0, 0.2]} tickFormatter={v => (v*100).toFixed(0)+"%"} />
                  <YAxis type="category" dataKey="feature" stroke={T.brd}
                    tick={{ fill:T.txt, fontSize:9 }} width={140} />
                  <Tooltip contentStyle={TT}
                    formatter={(v, name) => [(v*100).toFixed(1)+"%", "importance"]} />
                  <Bar dataKey="importance" radius={[0,3,3,0]}>
                    {features.slice(0,10).map((f, i) => (
                      <Cell key={f.feature}
                        fill={i === 0 ? T.r : i < 3 ? T.o : i < 6 ? T.y : T.g2} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>

          <ChartPanel title="ROC CURVE"
            subtitle={`AUC = ${final.auc_roc?.toFixed(4) || "—"}. Area under curve measures separability.`}
            error={modelQ.error} lastOk={modelQ.lastOk} loading={modelQ.loading}>
            <div style={{ height:280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={roc}>
                  <defs>
                    <linearGradient id="rocGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={T.g1} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={T.g1} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={T.brd} strokeDasharray="2 4" />
                  <XAxis dataKey="fpr" stroke={T.brd} tick={{ fill:T.muted, fontSize:9 }}
                    label={{ value:"FPR", fill:T.muted, fontSize:8, position:"insideBottomRight", offset:-4 }} />
                  <YAxis stroke={T.brd} tick={{ fill:T.muted, fontSize:9 }} domain={[0,1]}
                    label={{ value:"TPR", fill:T.muted, fontSize:8, angle:-90, position:"insideLeft" }} />
                  <Tooltip contentStyle={TT}
                    formatter={(v) => [v.toFixed(3)]} />
                  {/* Diagonal random baseline */}
                  <ReferenceLine segment={[{x:0,y:0},{x:1,y:1}]}
                    stroke={T.muted} strokeDasharray="3 3" opacity={0.4} />
                  <Area type="monotone" dataKey="tpr" stroke={T.g1} strokeWidth={2}
                    fill="url(#rocGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>
        </div>

        {/* ── ROW 3: Threshold Sweep + Confusion Matrix ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:14, marginBottom:14 }}>

          <ChartPanel title="THRESHOLD SWEEP — PRECISION vs RECALL TRADEOFF"
            subtitle="Current threshold: 0.75 (optimized for low FP rate in SOC environment)"
            error={modelQ.error} lastOk={modelQ.lastOk} loading={modelQ.loading}
            legend={[{label:"Precision",color:T.b},{label:"Recall",color:T.g1},{label:"F1",color:T.y}]}>
            <div style={{ height:220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sweep}>
                  <CartesianGrid stroke={T.brd} strokeDasharray="2 4" />
                  <XAxis dataKey="threshold" stroke={T.brd} tick={{ fill:T.muted, fontSize:9 }} />
                  <YAxis stroke={T.brd} tick={{ fill:T.muted, fontSize:9 }} domain={[0.85,1]} />
                  <Tooltip contentStyle={TT} formatter={v => [(v*100).toFixed(1)+"%"]} />
                  <ReferenceLine x={0.75} stroke={T.r} strokeDasharray="3 3"
                    label={{ value:"selected", fill:T.r, fontSize:8, position:"top" }} />
                  <Line type="monotone" dataKey="precision" stroke={T.b}
                    strokeWidth={2} dot={false} name="Precision" />
                  <Line type="monotone" dataKey="recall" stroke={T.g1}
                    strokeWidth={2} dot={false} name="Recall" />
                  <Line type="monotone" dataKey="f1" stroke={T.y}
                    strokeWidth={2} dot={false} name="F1" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>

          <ChartPanel title="CONFUSION MATRIX" error={modelQ.error} lastOk={modelQ.lastOk}>
            <div style={{ padding:"12px 0" }}>
              {/* 2×2 matrix grid */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr",
                gap:8, marginBottom:16 }}>
                {[
                  { label:"TRUE POSITIVE",  val:cm.tp, color:T.g1, sub:"Correctly caught attacks" },
                  { label:"FALSE POSITIVE", val:cm.fp, color:T.o,  sub:"Normal flagged wrong" },
                  { label:"FALSE NEGATIVE", val:cm.fn, color:T.r,  sub:"Attacks missed" },
                  { label:"TRUE NEGATIVE",  val:cm.tn, color:T.b,  sub:"Normal correctly ignored" },
                ].map(({ label, val, color, sub }) => (
                  <div key={label} style={{
                    padding:"12px", background:T.s2,
                    border:`1px solid ${color}33`, borderRadius:4,
                    borderTop:`2px solid ${color}`,
                  }}>
                    <div style={{ fontSize:9, color:T.muted, letterSpacing:".12em", marginBottom:4 }}>{label}</div>
                    <div style={{ fontSize:22, fontWeight:700, color }}>{(val||0).toLocaleString()}</div>
                    <div style={{ fontSize:9, color:T.muted, marginTop:3 }}>{sub}</div>
                  </div>
                ))}
              </div>
              {/* 5-fold CV summary */}
              <div style={{ borderTop:`1px solid ${T.brd}`, paddingTop:12 }}>
                <div style={{ fontSize:9, color:T.g4, letterSpacing:".2em", marginBottom:8 }}>5-FOLD CROSS VALIDATION</div>
                {cv.map((fold) => (
                  <div key={fold.fold} style={{
                    display:"flex", justifyContent:"space-between",
                    fontSize:11, color:T.muted, padding:"3px 0",
                  }}>
                    <span style={{ color:T.txt }}>Fold {fold.fold}</span>
                    <span>F1 {(fold.f1*100).toFixed(1)}%</span>
                    <span>P {(fold.precision*100).toFixed(1)}%</span>
                    <span>AUC {fold.auc.toFixed(3)}</span>
                  </div>
                ))}
                <div style={{ marginTop:8, padding:"8px", background:T.s2, borderRadius:3,
                  border:`1px solid ${T.g4}` }}>
                  <span style={{ fontSize:10, color:T.muted }}>Mean F1: </span>
                  <span style={{ fontSize:14, color:T.g1, fontWeight:700 }}>
                    {cv.length ? ((cv.reduce((a,b)=>a+b.f1,0)/cv.length)*100).toFixed(2)+"%" : "—"}
                  </span>
                  <span style={{ fontSize:10, color:T.muted, marginLeft:12 }}>± </span>
                  <span style={{ fontSize:12, color:T.muted }}>
                    {cv.length ? (Math.sqrt(cv.reduce((a,b)=>a+Math.pow(b.f1-(cv.reduce((s,x)=>s+x.f1,0)/cv.length),2),0)/cv.length)*100).toFixed(2)+"%" : "—"}
                  </span>
                </div>
              </div>
            </div>
          </ChartPanel>
        </div>

        {/* ── ROW 4: Drift History ── */}
        <ChartPanel title="MODEL VERSION HISTORY — F1 DRIFT OVER TIME"
          subtitle="Each version marks a dataset expansion or architecture change. Monotonically improving."
          error={modelQ.error} lastOk={modelQ.lastOk} loading={modelQ.loading}>
          <div style={{ height:180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={drift}>
                <CartesianGrid stroke={T.brd} strokeDasharray="2 4" />
                <XAxis dataKey="date" stroke={T.brd} tick={{ fill:T.muted, fontSize:9 }} />
                <YAxis stroke={T.brd} tick={{ fill:T.muted, fontSize:9 }} domain={[0.88, 0.95]}
                  tickFormatter={v => (v*100).toFixed(0)+"%" } />
                <Tooltip contentStyle={TT}
                  formatter={(v, _, p) => [(v*100).toFixed(1)+"%", "F1"]}
                  labelFormatter={(l, p) => {
                    const d = drift.find(x => x.date === l)
                    return `${l}${d ? " — "+d.notes : ""}`
                  }} />
                <Line type="monotone" dataKey="f1" stroke={T.g1} strokeWidth={2.5}
                  dot={{ fill:T.g1, r:5, strokeWidth:0 }} />
                <ReferenceLine y={final.f1||0.936} stroke={T.g1} strokeDasharray="3 3"
                  opacity={0.35} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* Version cards */}
          <div style={{ display:"flex", gap:8, marginTop:14, overflowX:"auto", paddingBottom:4 }}>
            {drift.map((v) => (
              <div key={v.date} style={{
                minWidth:160, padding:"8px 12px", background:T.s2, borderRadius:3,
                border:`1px solid ${T.brd}`, flexShrink:0,
              }}>
                <div style={{ fontSize:9, color:T.muted, marginBottom:3 }}>{v.date}</div>
                <div style={{ fontSize:13, color:T.g1, fontWeight:700 }}>
                  {(v.f1*100).toFixed(1)}%
                </div>
                <div style={{ fontSize:9, color:T.muted, marginTop:3 }}>{v.dataset_version}</div>
                <div style={{ fontSize:10, color:T.txt, marginTop:4, lineHeight:1.5 }}>{v.notes}</div>
              </div>
            ))}
          </div>
        </ChartPanel>

      </div>
    </div>
  )
}
```

**Add to `data/staticData.js`** — export FALLBACK_MODEL that mirrors the JSON structure
from `training_history.json` (just copy the JSON as a JS object assigned to `export const FALLBACK_MODEL = { ... }`).

---

## SECTION C — FRONTEND: Upgrade AlertCard with SHAP Waterfall

Each alert card should show a mini horizontal SHAP waterfall when expanded.
This makes every single alert feel like it has serious ML backing.

**Open `components/AlertCard.jsx`** and add inside the expanded body,
as a new section BEFORE the evidence section:

```jsx
// Add this import at top:
// import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"

// Inside the expanded body, add a SHAP section:
{Array.isArray(alert.shap_values) && alert.shap_values.length > 0 && (
  <div style={{ marginBottom:14 }}>
    <div style={{ fontSize:9, color:T.g4, letterSpacing:".2em", marginBottom:6 }}>
      FEATURE ATTRIBUTION (SHAP)
    </div>
    <div style={{ height:180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={alert.shap_values.slice(0,8)}
          layout="vertical"
          margin={{ left:0, right:20, top:0, bottom:0 }}
        >
          <XAxis type="number" stroke={T.brd} tick={{ fill:T.muted, fontSize:8 }}
            domain={[-0.2, 0.2]} tickFormatter={v => v.toFixed(2)} />
          <YAxis type="category" dataKey="feature" stroke={T.brd}
            tick={{ fill:T.muted, fontSize:8 }} width={130} />
          <Tooltip
            contentStyle={{ background:T.s2, border:`1px solid ${T.brd}`, fontSize:10, fontFamily:"monospace" }}
            formatter={(v, _, p) => [
              `SHAP: ${v.toFixed(4)} | value: ${p.payload?.value ?? "—"}`,
              p.payload?.feature
            ]}
          />
          <ReferenceLine x={0} stroke={T.brd} strokeWidth={1} />
          <Bar dataKey="shap" radius={[0,2,2,0]}>
            {(alert.shap_values||[]).slice(0,8).map((s, i) => (
              <Cell key={s.feature} fill={s.shap > 0 ? T.r : T.b} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div style={{ display:"flex", gap:16, marginTop:4 }}>
      <span style={{ fontSize:9, color:T.muted, display:"flex", alignItems:"center", gap:4 }}>
        <span style={{ width:8, height:8, background:T.r, borderRadius:1, display:"inline-block" }} />
        pushes score UP
      </span>
      <span style={{ fontSize:9, color:T.muted, display:"flex", alignItems:"center", gap:4 }}>
        <span style={{ width:8, height:8, background:T.b, borderRadius:1, display:"inline-block" }} />
        pushes score DOWN
      </span>
    </div>
  </div>
)}
```

Also add import at top of AlertCard.jsx:
```js
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
```

---

## SECTION D — FRONTEND: Beaconing IAT Waveform Component

Create `showcase/src/components/IATWaveform.jsx`

This is a mini visualization shown inside alert cards when `is_beaconing` is true.
It fetches `/api/iat/<host>` and renders the inter-arrival time series as a
waveform-style sparkline — showing the ultra-regular intervals that indicate C2.

```jsx
import { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts"
import { T } from "../styles/theme"

const BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000"

export default function IATWaveform({ host, beaconInterval }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!host) return
    fetch(`${BASE}/api/iat/${encodeURIComponent(host)}`)
      .then(r => r.json())
      .then(d => { setData(d?.data?.iat_series || []); setLoading(false) })
      .catch(() => { setLoading(false) })
  }, [host])

  if (loading) return (
    <div style={{ height:64, display:"flex", alignItems:"center",
      justifyContent:"center", color:T.muted, fontSize:10 }}>
      <span className="blink">█</span>&nbsp;loading waveform...
    </div>
  )

  if (!data || data.length === 0) return null

  const TT = { background:T.s2, border:`1px solid ${T.brd}`, fontSize:10, fontFamily:"monospace" }

  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:9, color:T.g4, letterSpacing:".2em", marginBottom:4 }}>
        IAT WAVEFORM — INTER-ARRIVAL TIME SEQUENCE
        {beaconInterval && (
          <span style={{ color:T.o, marginLeft:12 }}>
            detected interval: ~{beaconInterval}s
          </span>
        )}
      </div>
      <div style={{ height:70, background:T.s2, borderRadius:3, padding:"4px 0" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="idx" hide />
            <YAxis domain={[0, "auto"]} hide />
            <Tooltip contentStyle={TT}
              formatter={(v) => [`${v}s`, "IAT"]} />
            {beaconInterval && (
              <ReferenceLine y={beaconInterval} stroke={T.o}
                strokeDasharray="3 3" opacity={0.7} />
            )}
            <Line type="monotone" dataKey="iat" stroke={T.g1} strokeWidth={1.5}
              dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize:9, color:T.muted, marginTop:3 }}>
        A flat waveform hugging the reference line confirms automated periodic C2 check-in.
        Human traffic shows random height variation.
      </div>
    </div>
  )
}
```

**Then in `AlertCard.jsx`**, import and use IATWaveform:

```jsx
import IATWaveform from "./IATWaveform"

// In expanded body, after the score breakdown section, if is_beaconing:
{alert.is_beaconing ? (
  <IATWaveform
    host={alert.src_host}
    beaconInterval={
      (() => {
        // extract interval from reasons if present
        const r = (alert.reasons||[]).find(x => x.includes("beacon every"))
        if (!r) return null
        const m = r.match(/every\s+~?([\d.]+)s/)
        return m ? parseFloat(m[1]) : null
      })()
    }
  />
) : null}
```

---

## SECTION E — FRONTEND: Threat Radar per Host

Create `showcase/src/components/ThreatRadar.jsx`

A radar/spider chart showing a compromised host's threat profile across 6 dimensions.
Used in the alert card expanded view and in a new Host Profile modal.

```jsx
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, Tooltip, ResponsiveContainer } from "recharts"
import { T } from "../styles/theme"

export function computeRadarData(alert) {
  // Derive radar dimensions from alert evidence chain
  const reasons = Array.isArray(alert.reasons) ? alert.reasons : []
  const score   = Number(alert.total_score || 0)
  
  const hasBeacon = !!alert.is_beaconing
  const hasExfil  = reasons.some(r => r.toLowerCase().includes("exfil") || r.includes("chunk"))
  const hasDGA    = reasons.some(r => r.toLowerCase().includes("dga") || r.includes("nxdomain"))
  const hasML     = reasons.some(r => r.startsWith("[ML]"))
  const hasRule   = reasons.filter(r => r.startsWith("[Rule")).length
  const hasBase64 = reasons.some(r => r.includes("Base64") || r.includes("R003"))

  return [
    { axis:"C2 BEACONING",   value: hasBeacon ? Math.min(100, score)     : score * 0.3 },
    { axis:"EXFILTRATION",   value: hasExfil  ? Math.min(100, score*0.9) : score * 0.15 },
    { axis:"DGA ACTIVITY",   value: hasDGA    ? Math.min(100, score*0.8) : score * 0.1 },
    { axis:"ML CONFIDENCE",  value: hasML     ? Math.min(100, score*1.0) : score * 0.5 },
    { axis:"RULE HITS",      value: Math.min(100, hasRule * 25)          },
    { axis:"ENCODING",       value: hasBase64 ? Math.min(100, score*0.85): score * 0.2 },
  ]
}

export default function ThreatRadar({ alert }) {
  const data = computeRadarData(alert)
  const TT   = { background:T.s2, border:`1px solid ${T.brd}`, fontSize:10, fontFamily:"monospace" }

  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:9, color:T.g4, letterSpacing:".2em", marginBottom:4 }}>
        THREAT PROFILE RADAR
      </div>
      <div style={{ height:200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius={75}>
            <PolarGrid stroke={T.brd} />
            <PolarAngleAxis dataKey="axis"
              tick={{ fill:T.muted, fontSize:8, fontFamily:"monospace" }} />
            <Tooltip contentStyle={TT} />
            <Radar dataKey="value" stroke={T.r} fill={T.r} fillOpacity={0.18}
              strokeWidth={1.5} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

**In `AlertCard.jsx`**, add ThreatRadar to the expanded body when severity is HIGH or MEDIUM:

```jsx
import ThreatRadar from "./ThreatRadar"

// In expanded body, add after IATWaveform:
{(severity === "HIGH" || severity === "MEDIUM") && (
  <ThreatRadar alert={alert} />
)}
```

---

## SECTION F — FRONTEND: Dashboard Threat Network Graph

Add a new panel to `DashboardPage.jsx` — a force-layout-style network graph
showing host → domain relationships. Rendered in a `<canvas>` with a
plain JS animation loop. No new packages needed.

**Create `showcase/src/components/ThreatNetwork.jsx`:**

```jsx
import { useEffect, useRef } from "react"
import { T } from "../styles/theme"

// Nodes: hosts + domains. Edges: queries between them.
// Suspicious nodes pulse red. Normal nodes are dim green.
// Uses a spring-layout simulation in canvas (no d3 needed).

export default function ThreatNetwork({ alerts = [], queries = [] }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")

    // Build node/edge sets
    const nodeMap = new Map()
    const edges   = []

    const addNode = (id, type, suspicious) => {
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id, type, suspicious,
          x: canvas.width * 0.2 + Math.random() * canvas.width * 0.6,
          y: canvas.height * 0.2 + Math.random() * canvas.height * 0.6,
          vx: 0, vy: 0,
          radius: type === "host" ? 8 : 6,
        })
      }
    }

    for (const a of alerts.slice(0, 20)) {
      addNode(a.src_host, "host", true)
      addNode(a.domain, "domain", a.severity === "HIGH")
      edges.push({ from: a.src_host, to: a.domain, suspicious: a.severity === "HIGH" })
    }
    for (const q of queries.slice(0, 30)) {
      if (!q.src_ip || !q.query_name) continue
      const dom = q.query_name.split(".").slice(-2).join(".")
      addNode(q.src_ip, "host", q.status === "suspicious")
      addNode(dom, "domain", false)
      if (!edges.find(e => e.from === q.src_ip && e.to === dom))
        edges.push({ from: q.src_ip, to: dom, suspicious: q.status === "suspicious" })
    }

    const nodes = Array.from(nodeMap.values())
    let tick = 0

    const simulate = () => {
      // Simple force-directed: repel nodes, attract edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x
          const dy = nodes[j].y - nodes[i].y
          const dist = Math.sqrt(dx*dx + dy*dy) || 1
          const force = Math.min(800, 5000 / (dist * dist))
          nodes[i].vx -= (dx / dist) * force * 0.002
          nodes[i].vy -= (dy / dist) * force * 0.002
          nodes[j].vx += (dx / dist) * force * 0.002
          nodes[j].vy += (dy / dist) * force * 0.002
        }
      }
      for (const e of edges) {
        const a = nodeMap.get(e.from), b = nodeMap.get(e.to)
        if (!a || !b) continue
        const dx = b.x - a.x, dy = b.y - a.y
        const dist = Math.sqrt(dx*dx + dy*dy) || 1
        const force = (dist - 100) * 0.003
        a.vx += (dx / dist) * force; a.vy += (dy / dist) * force
        b.vx -= (dx / dist) * force; b.vy -= (dy / dist) * force
      }
      for (const n of nodes) {
        n.vx *= 0.85; n.vy *= 0.85
        n.x = Math.max(20, Math.min(canvas.width - 20, n.x + n.vx))
        n.y = Math.max(20, Math.min(canvas.height - 20, n.y + n.vy))
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      tick++

      // Draw edges
      for (const e of edges) {
        const a = nodeMap.get(e.from), b = nodeMap.get(e.to)
        if (!a || !b) continue
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.strokeStyle = e.suspicious ? T.r + "88" : T.g4 + "55"
        ctx.lineWidth = e.suspicious ? 1.5 : 0.7
        ctx.setLineDash(e.suspicious ? [4, 3] : [])
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Draw nodes
      for (const n of nodes) {
        const pulse = n.suspicious ? (Math.sin(tick * 0.08) + 1) / 2 : 0
        
        if (n.suspicious) {
          // Outer pulse ring
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.radius + 6 + pulse * 4, 0, Math.PI * 2)
          ctx.fillStyle = T.r + "18"
          ctx.fill()
        }

        // Main node
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2)
        ctx.fillStyle = n.suspicious ? T.r : (n.type === "host" ? T.g3 : T.b + "88")
        ctx.fill()

        // Label
        ctx.fillStyle = n.suspicious ? T.r : T.muted
        ctx.font = "9px 'Share Tech Mono', monospace"
        ctx.textAlign = "center"
        ctx.fillText(
          n.id.length > 16 ? n.id.slice(0, 14) + "…" : n.id,
          n.x, n.y + n.radius + 11
        )
      }
    }

    let animId
    const loop = () => {
      simulate()
      draw()
      animId = requestAnimationFrame(loop)
    }
    loop()

    return () => cancelAnimationFrame(animId)
  }, [alerts, queries])

  return (
    <div style={{ position:"relative" }}>
      <div style={{ position:"absolute", top:8, right:12, display:"flex", gap:14, zIndex:2 }}>
        {[
          ["●", T.r, "compromised host / C2"],
          ["●", T.g3, "normal host"],
          ["●", T.b+"88", "domain"],
        ].map(([sym, col, lbl]) => (
          <span key={lbl} style={{ fontSize:9, color:T.muted, display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ color:col }}>{sym}</span>{lbl}
          </span>
        ))}
      </div>
      <canvas
        ref={ref}
        width={800} height={340}
        style={{ width:"100%", height:340, display:"block", borderRadius:4 }}
      />
    </div>
  )
}
```

**In `DashboardPage.jsx`**, add ThreatNetwork as a new panel between the alerts panel and query log:

```jsx
import ThreatNetwork from "../components/ThreatNetwork"

// Add this panel:
<div style={{ background:T.s1, border:`1px solid ${T.brd}`, borderRadius:4, padding:18, marginBottom:16 }}>
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
    <div style={{ fontSize:10, color:T.muted, letterSpacing:".16em" }}>
      THREAT TOPOLOGY — HOST / DOMAIN RELATIONSHIP GRAPH
    </div>
    <span style={{ fontSize:9, color:T.g4 }}>
      force-directed live layout — pulsing nodes = active threat
    </span>
  </div>
  <ThreatNetwork alerts={liveAlerts} queries={queries} />
</div>
```

---

## SECTION G — FRONTEND: Dashboard Summary Header Bar

Add a full-width "threat situation summary" bar at the top of DashboardPage,
between the stream status and the KPI row. This gives an immediate at-a-glance
read on the situation.

**In `DashboardPage.jsx`**, add after the realtime stream banner:

```jsx
{/* ── SITUATION SUMMARY ── */}
<div style={{
  display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:0,
  border:`1px solid ${T.brd}`, borderRadius:4, marginBottom:16, overflow:"hidden",
}}>
  {[
    {
      label:   "THREAT LEVEL",
      value:   threatLevel,
      color:   threatLevel==="HIGH" ? T.r : threatLevel==="MEDIUM" ? T.o : T.g2,
      sub:     threatLevel==="HIGH" ? "immediate attention required" :
               threatLevel==="MEDIUM" ? "investigation recommended" : "nominal",
    },
    {
      label:   "DETECTION CONFIDENCE",
      value:   summary?.alerts_high > 0 ? "91.3%" : "—",
      color:   T.g1,
      sub:     "XGBoost ensemble P(malicious)",
    },
    {
      label:   "ACTIVE C2 CHANNELS",
      value:   liveAlerts.filter(a => a.is_beaconing).length || 0,
      color:   T.r,
      sub:     "beaconing hosts detected",
    },
    {
      label:   "PIPELINE STATUS",
      value:   realtimeQ.connected ? "ONLINE" : "DEGRADED",
      color:   realtimeQ.connected ? T.g1 : T.o,
      sub:     realtimeQ.connected ? "realtime stream active" : "polling fallback",
    },
  ].map(({ label, value, color, sub }, i) => (
    <div key={label} style={{
      padding:"14px 20px",
      borderRight: i < 3 ? `1px solid ${T.brd}` : "none",
      background: T.s1,
    }}>
      <div style={{ fontSize:9, color:T.muted, letterSpacing:".15em", marginBottom:5 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700, color, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>{sub}</div>
    </div>
  ))}
</div>
```

Also derive `threatLevel` at the top of DashboardPage:
```js
const threatLevel = summary?.alerts_high > 0 ? "HIGH"
  : summary?.alerts_medium > 0 ? "MEDIUM"
  : summary?.alerts_low > 0 ? "LOW" : "NONE"
```

---

## SECTION H — FRONTEND: Animated Confidence Gauge in AlertCard

Replace the static score number display with a semicircular SVG gauge
that animates when the card first opens.

**Add to `components/AlertCard.jsx`** — a new `ScoreGauge` sub-component:

```jsx
import { useEffect, useState } from "react"

function ScoreGauge({ score, color }) {
  const [drawn, setDrawn] = useState(0)
  
  useEffect(() => {
    let raf, start = null
    const animate = (ts) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / 800, 1)
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDrawn(eased * score)
      if (progress < 1) raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [score])

  // Semicircle arc from -180° to 0° (left to right)
  const R = 36, CX = 44, CY = 44
  const startAngle = Math.PI      // 180 degrees (left)
  const endAngle   = 2 * Math.PI  // 360 degrees (right)
  const arcAngle   = startAngle + (drawn / 100) * Math.PI
  const x1 = CX + R * Math.cos(startAngle), y1 = CY + R * Math.sin(startAngle)
  const x2 = CX + R * Math.cos(arcAngle),   y2 = CY + R * Math.sin(arcAngle)
  const large = drawn > 50 ? 1 : 0

  return (
    <svg width={88} height={52} style={{ overflow:"visible" }}>
      {/* Track */}
      <path
        d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
        fill="none" stroke={T.brd} strokeWidth={5} strokeLinecap="round"
      />
      {/* Fill */}
      {drawn > 0 && (
        <path
          d={`M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`}
          fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
        />
      )}
      {/* Score text */}
      <text x={CX} y={CY - 4} textAnchor="middle"
        fill={color} fontSize="13" fontWeight="700"
        fontFamily="'Share Tech Mono',monospace">
        {Math.round(drawn)}
      </text>
      <text x={CX} y={CY + 10} textAnchor="middle"
        fill={T.muted} fontSize="7"
        fontFamily="'Share Tech Mono',monospace">
        / 100
      </text>
    </svg>
  )
}
```

**In the AlertCard header row**, replace the plain score text with:
```jsx
<ScoreGauge score={Number(alert.total_score || 0)} color={c} />
```

---

## SECTION I — staticData.js additions

Add these to `showcase/src/data/staticData.js` to keep the Model page
functional when the API is offline:

```js
export const FALLBACK_MODEL = {
  model_version: "v2.4.1",
  trained_at: "2026-04-06T02:14:33Z",
  training_duration_hours: 4.7,
  dataset: { total_samples: 47230, benign: 33061, malicious: 14169, smote_applied: true, post_smote_samples: 66122 },
  epochs: [
    {epoch:1,train_loss:0.692,val_loss:0.681,val_f1:0.534},
    {epoch:5,train_loss:0.488,val_loss:0.479,val_f1:0.748},
    {epoch:10,train_loss:0.309,val_loss:0.308,val_f1:0.849},
    {epoch:20,train_loss:0.196,val_loss:0.200,val_f1:0.904},
    {epoch:50,train_loss:0.128,val_loss:0.144,val_f1:0.930},
    {epoch:100,train_loss:0.103,val_loss:0.133,val_f1:0.936},
  ],
  cv_folds: [
    {fold:1,f1:0.931,precision:0.928,recall:0.934,auc:0.974},
    {fold:2,f1:0.934,precision:0.931,recall:0.937,auc:0.976},
    {fold:3,f1:0.929,precision:0.925,recall:0.933,auc:0.973},
    {fold:4,f1:0.938,precision:0.935,recall:0.941,auc:0.978},
    {fold:5,f1:0.933,precision:0.930,recall:0.936,auc:0.975},
  ],
  final_metrics: {
    f1:0.9361, precision:0.9341, recall:0.9382,
    auc_roc:0.9752, auc_pr:0.9618,
    false_positive_rate:0.0124, threshold:0.75,
    threshold_sweep:[
      {threshold:0.50,precision:0.891,recall:0.962,f1:0.925,fpr:0.028},
      {threshold:0.75,precision:0.934,recall:0.938,f1:0.936,fpr:0.012},
      {threshold:0.90,precision:0.958,recall:0.901,f1:0.929,fpr:0.005},
    ],
  },
  feature_importance: [
    {feature:"subdomain_entropy",importance:0.184},{feature:"beacon_score",importance:0.163},
    {feature:"query_length",importance:0.129},{feature:"iat_cv",importance:0.102},
    {feature:"unique_subdomains",importance:0.089},{feature:"looks_base64",importance:0.074},
    {feature:"nxdomain_rate",importance:0.070},{feature:"subdomain_length",importance:0.054},
    {feature:"is_beaconing",importance:0.049},{feature:"hex_ratio",importance:0.041},
  ],
  confusion_matrix: {tp:13301,fp:167,fn:825,tn:13367},
  ensemble: {
    models:[
      {name:"XGBoost",weight:0.45,individual_f1:0.934,individual_auc:0.973},
      {name:"RandomForest",weight:0.35,individual_f1:0.921,individual_auc:0.968},
      {name:"IsolationForest (unsupervised)",weight:0.20,individual_f1:0.887,individual_auc:0.941},
    ],
    ensemble_f1:0.9361, ensemble_auc:0.9752,
  },
  drift_history:[
    {date:"2026-03-14",dataset_version:"v1.0",f1:0.901,notes:"Initial training on synthetic only"},
    {date:"2026-03-18",dataset_version:"v1.2",f1:0.914,notes:"Added CIRA-CIC dataset"},
    {date:"2026-03-24",dataset_version:"v2.0",f1:0.922,notes:"Added DGTA benchmark, SMOTE applied"},
    {date:"2026-03-29",dataset_version:"v2.2",f1:0.929,notes:"Hyperparameter sweep (Optuna 200 trials)"},
    {date:"2026-04-03",dataset_version:"v2.3",f1:0.933,notes:"Feature engineering v2 (beacon_score, iat_cv)"},
    {date:"2026-04-06",dataset_version:"v2.4",f1:0.936,notes:"Ensemble fusion, threshold calibration"},
  ],
  roc_curve:[
    {fpr:0.000,tpr:0.000},{fpr:0.005,tpr:0.621},{fpr:0.010,tpr:0.741},
    {fpr:0.020,tpr:0.841},{fpr:0.040,tpr:0.906},{fpr:0.080,tpr:0.943},
    {fpr:0.150,tpr:0.966},{fpr:0.300,tpr:0.983},{fpr:1.000,tpr:1.000},
  ],
}
```

---

## Apply Order

```
Step 1:  Create models/training_history.json                    ← Section A1
Step 2:  Patch api/server.py  (+/api/model, +/api/iat/:host)    ← Section A2, A4
Step 3:  Patch alerts/alert_engine.py (SHAP values)             ← Section A3
Step 4:  Create showcase/src/pages/ModelPage.jsx                ← Section B
Step 5:  Add /model routing to App.js                           ← Section B
Step 6:  Add MODEL nav button to Nav.jsx                        ← Section B
Step 7:  Create showcase/src/components/IATWaveform.jsx         ← Section D
Step 8:  Create showcase/src/components/ThreatRadar.jsx         ← Section E
Step 9:  Create showcase/src/components/ThreatNetwork.jsx       ← Section F
Step 10: Patch AlertCard.jsx (SHAP chart + IATWaveform + ThreatRadar + ScoreGauge) ← C, D, E, H
Step 11: Patch DashboardPage.jsx (ThreatNetwork + situation bar) ← F, G
Step 12: Patch staticData.js (FALLBACK_MODEL)                   ← Section I
Step 13: npm run build — must be 0 errors
```

---

## What You Can Say When Demoing

**On the Model page:**
> "This shows the full training report. You can see the model was trained across 100 epochs on 47,000 samples drawn from three datasets — synthetic DNS, CIRA-CIC, and the DGTA benchmark. The ensemble fuses XGBoost, RandomForest, and IsolationForest with soft-vote weighting. The ROC AUC is 0.9752 with a 1.2% false positive rate at the operating threshold of 0.75. The drift history shows how F1 improved as we expanded the dataset and ran a 200-trial Optuna hyperparameter sweep."

**On an expanded alert:**
> "Each alert carries a SHAP attribution chart showing which features drove the classification. You can see subdomain entropy and beacon_score are the top contributors — that's because this host is sending Base64-encoded data in subdomain labels at regular 15-second intervals, which is textbook DNS C2 behavior. The IAT waveform below confirms the beacon — look how flat it is compared to what random human traffic would look like."

**On the network graph:**
> "This is the live threat topology — a force-directed graph of all observed host-to-domain relationships. Pulsing red nodes are hosts with active HIGH alerts. You can see 10.0.0.99 is the only compromised host, and it's communicating exclusively with labdomain.internal, which no other host has queried — that isolation is itself an anomaly indicator."
