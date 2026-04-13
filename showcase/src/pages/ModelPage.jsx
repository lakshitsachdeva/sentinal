import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { useModelData } from "../api/useApi"
import Nav from "../components/Nav"
import ChartPanel from "../components/ChartPanel"
import { T } from "../styles/theme"
import { FALLBACK_MODEL } from "../data/staticData"

export default function ModelPage({ onNavigate }) {
  const modelQ = useModelData()
  const model = modelQ.data || FALLBACK_MODEL
  const TT = {
    background: T.s2,
    border: `1px solid ${T.brd}`,
    borderRadius: 4,
    fontFamily: "'Share Tech Mono',monospace",
    fontSize: 11,
    color: T.txt,
  }

  const epochs = model?.epochs || []
  const features = model?.feature_importance || []
  const roc = model?.roc_curve || []
  const sweep = model?.final_metrics?.threshold_sweep || []
  const ensemble = model?.ensemble?.models || []
  const drift = model?.drift_history || []
  const cm = model?.confusion_matrix || {}
  const cv = model?.cv_folds || []
  const final = model?.final_metrics || {}

  return (
    <div style={{ color: T.txt, background: T.bg, minHeight: "100vh" }}>
      <Nav page="model" onNavigate={onNavigate} />

      <div style={{ padding: "28px", maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, color: T.g3, letterSpacing: ".35em", marginBottom: 8 }}>
            MODEL INTELLIGENCE - {model?.model_version || "v2.4.1"}
          </div>
          <h1 style={{ fontSize: 28, color: T.txt, letterSpacing: ".08em", marginBottom: 6 }}>DNS THREAT CLASSIFIER</h1>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 12 }}>
            {[
              ["TRAINED", model?.trained_at ? new Date(model.trained_at).toLocaleDateString() : "-"],
              ["DURATION", `${model?.training_duration_hours || "-"}h`],
              ["DATASET", `${(model?.dataset?.total_samples || 0).toLocaleString()} samples`],
              ["SOURCES", `${(model?.dataset?.sources || []).length} datasets`],
              ["FINAL F1", final.f1 ? `${(final.f1 * 100).toFixed(1)}%` : "-"],
              ["AUC-ROC", final.auc_roc ? final.auc_roc.toFixed(4) : "-"],
              ["FP RATE", final.false_positive_rate ? `${(final.false_positive_rate * 100).toFixed(1)}%` : "-"],
            ].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 9, color: T.muted, letterSpacing: ".15em", marginBottom: 3 }}>{l}</div>
                <div style={{ fontSize: 18, color: T.g1, fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
          <ChartPanel
            title="TRAINING CURVES - LOSS & F1 OVER EPOCHS"
            subtitle="Validation loss plateau indicates convergence. F1 climbs as model learns covert channel patterns."
            error={modelQ.error}
            lastOk={modelQ.lastOk}
            loading={modelQ.loading}
            legend={[
              { label: "Train Loss", color: T.o },
              { label: "Val Loss", color: T.r },
              { label: "Val F1", color: T.g1 },
            ]}
          >
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={epochs}>
                  <CartesianGrid stroke={T.brd} strokeDasharray="2 4" />
                  <XAxis
                    dataKey="epoch"
                    stroke={T.brd}
                    tick={{ fill: T.muted, fontSize: 9 }}
                    label={{ value: "EPOCH", fill: T.muted, fontSize: 8, position: "insideBottom", offset: -2 }}
                  />
                  <YAxis stroke={T.brd} tick={{ fill: T.muted, fontSize: 9 }} domain={[0, 1]} />
                  <Tooltip contentStyle={TT} />
                  <Line type="monotone" dataKey="train_loss" stroke={T.o} strokeWidth={1.5} dot={false} name="Train Loss" />
                  <Line type="monotone" dataKey="val_loss" stroke={T.r} strokeWidth={2} dot={false} name="Val Loss" strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="val_f1" stroke={T.g1} strokeWidth={2.5} dot={false} name="Val F1" />
                  <ReferenceLine
                    y={0.936}
                    stroke={T.g1}
                    strokeDasharray="3 3"
                    opacity={0.5}
                    label={{ value: "final", fill: T.g1, fontSize: 8, position: "right" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>

          <ChartPanel
            title="ENSEMBLE COMPOSITION"
            subtitle="Weighted soft-vote across 3 model families."
            error={modelQ.error}
            lastOk={modelQ.lastOk}
            loading={modelQ.loading}
          >
            <div style={{ marginTop: 8 }}>
              {ensemble.map((m, i) => (
                <div key={m.name} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: T.txt }}>{m.name}</span>
                    <span style={{ fontSize: 11, color: T.g1 }}>{(m.weight * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 4, background: T.brd, borderRadius: 2, marginBottom: 4 }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${m.weight * 100}%`,
                        background: [T.g1, T.b, T.y][i] || T.g2,
                        borderRadius: 2,
                        transition: "width 1s ease",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 10, color: T.muted }}>
                    <span>F1 {(m.individual_f1 * 100).toFixed(1)}%</span>
                    <span>AUC {m.individual_auc.toFixed(3)}</span>
                  </div>
                </div>
              ))}

              <div style={{ padding: "12px 0", borderTop: `1px solid ${T.brd}`, marginTop: 8 }}>
                <div style={{ fontSize: 9, color: T.g4, letterSpacing: ".15em", marginBottom: 6 }}>ENSEMBLE RESULT</div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 20, color: T.g1, fontWeight: 700 }}>{((model?.ensemble?.ensemble_f1 || 0) * 100).toFixed(1)}%</div>
                    <div style={{ fontSize: 9, color: T.muted }}>F1</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 20, color: T.b, fontWeight: 700 }}>{(model?.ensemble?.ensemble_auc || 0).toFixed(4)}</div>
                    <div style={{ fontSize: 9, color: T.muted }}>AUC</div>
                  </div>
                </div>
              </div>
            </div>
          </ChartPanel>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14, marginBottom: 14 }}>
          <ChartPanel
            title="FEATURE IMPORTANCE (SHAP-WEIGHTED)"
            subtitle="Top 10 features ranked by contribution to malicious classification."
            error={modelQ.error}
            lastOk={modelQ.lastOk}
            loading={modelQ.loading}
          >
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={features.slice(0, 10)} layout="vertical">
                  <CartesianGrid stroke={T.brd} strokeDasharray="2 4" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke={T.brd}
                    tick={{ fill: T.muted, fontSize: 9 }}
                    domain={[0, 0.2]}
                    tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  />
                  <YAxis type="category" dataKey="feature" stroke={T.brd} tick={{ fill: T.txt, fontSize: 9 }} width={140} />
                  <Tooltip contentStyle={TT} formatter={(v) => [`${(v * 100).toFixed(1)}%`, "importance"]} />
                  <Bar dataKey="importance" radius={[0, 3, 3, 0]}>
                    {features.slice(0, 10).map((f, i) => (
                      <Cell key={f.feature} fill={i === 0 ? T.r : i < 3 ? T.o : i < 6 ? T.y : T.g2} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>

          <ChartPanel
            title="ROC CURVE"
            subtitle={`AUC = ${final.auc_roc?.toFixed(4) || "-"}. Area under curve measures separability.`}
            error={modelQ.error}
            lastOk={modelQ.lastOk}
            loading={modelQ.loading}
          >
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={roc}>
                  <defs>
                    <linearGradient id="rocGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={T.g1} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={T.g1} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={T.brd} strokeDasharray="2 4" />
                  <XAxis
                    dataKey="fpr"
                    stroke={T.brd}
                    tick={{ fill: T.muted, fontSize: 9 }}
                    label={{ value: "FPR", fill: T.muted, fontSize: 8, position: "insideBottomRight", offset: -4 }}
                  />
                  <YAxis
                    stroke={T.brd}
                    tick={{ fill: T.muted, fontSize: 9 }}
                    domain={[0, 1]}
                    label={{ value: "TPR", fill: T.muted, fontSize: 8, angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip contentStyle={TT} formatter={(v) => [Number(v).toFixed(3)]} />
                  <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke={T.muted} strokeDasharray="3 3" opacity={0.4} />
                  <Area type="monotone" dataKey="tpr" stroke={T.g1} strokeWidth={2} fill="url(#rocGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginBottom: 14 }}>
          <ChartPanel
            title="THRESHOLD SWEEP - PRECISION vs RECALL TRADEOFF"
            subtitle="Current threshold: 0.75 (optimized for low FP rate in SOC environment)"
            error={modelQ.error}
            lastOk={modelQ.lastOk}
            loading={modelQ.loading}
            legend={[
              { label: "Precision", color: T.b },
              { label: "Recall", color: T.g1 },
              { label: "F1", color: T.y },
            ]}
          >
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sweep}>
                  <CartesianGrid stroke={T.brd} strokeDasharray="2 4" />
                  <XAxis dataKey="threshold" stroke={T.brd} tick={{ fill: T.muted, fontSize: 9 }} />
                  <YAxis stroke={T.brd} tick={{ fill: T.muted, fontSize: 9 }} domain={[0.85, 1]} />
                  <Tooltip contentStyle={TT} formatter={(v) => [`${(Number(v) * 100).toFixed(1)}%`]} />
                  <ReferenceLine x={0.75} stroke={T.r} strokeDasharray="3 3" label={{ value: "selected", fill: T.r, fontSize: 8, position: "top" }} />
                  <Line type="monotone" dataKey="precision" stroke={T.b} strokeWidth={2} dot={false} name="Precision" />
                  <Line type="monotone" dataKey="recall" stroke={T.g1} strokeWidth={2} dot={false} name="Recall" />
                  <Line type="monotone" dataKey="f1" stroke={T.y} strokeWidth={2} dot={false} name="F1" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>

          <ChartPanel title="CONFUSION MATRIX" error={modelQ.error} lastOk={modelQ.lastOk} loading={modelQ.loading}>
            <div style={{ padding: "12px 0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                {[
                  { label: "TRUE POSITIVE", val: cm.tp, color: T.g1, sub: "Correctly caught attacks" },
                  { label: "FALSE POSITIVE", val: cm.fp, color: T.o, sub: "Normal flagged wrong" },
                  { label: "FALSE NEGATIVE", val: cm.fn, color: T.r, sub: "Attacks missed" },
                  { label: "TRUE NEGATIVE", val: cm.tn, color: T.b, sub: "Normal correctly ignored" },
                ].map(({ label, val, color, sub }) => (
                  <div
                    key={label}
                    style={{
                      padding: "12px",
                      background: T.s2,
                      border: `1px solid ${color}33`,
                      borderRadius: 4,
                      borderTop: `2px solid ${color}`,
                    }}
                  >
                    <div style={{ fontSize: 9, color: T.muted, letterSpacing: ".12em", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color }}>{(val || 0).toLocaleString()}</div>
                    <div style={{ fontSize: 9, color: T.muted, marginTop: 3 }}>{sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: `1px solid ${T.brd}`, paddingTop: 12 }}>
                <div style={{ fontSize: 9, color: T.g4, letterSpacing: ".2em", marginBottom: 8 }}>5-FOLD CROSS VALIDATION</div>
                {cv.map((fold) => (
                  <div
                    key={fold.fold}
                    style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted, padding: "3px 0" }}
                  >
                    <span style={{ color: T.txt }}>Fold {fold.fold}</span>
                    <span>F1 {(fold.f1 * 100).toFixed(1)}%</span>
                    <span>P {(fold.precision * 100).toFixed(1)}%</span>
                    <span>AUC {fold.auc.toFixed(3)}</span>
                  </div>
                ))}

                <div style={{ marginTop: 8, padding: "8px", background: T.s2, borderRadius: 3, border: `1px solid ${T.g4}` }}>
                  <span style={{ fontSize: 10, color: T.muted }}>Mean F1: </span>
                  <span style={{ fontSize: 14, color: T.g1, fontWeight: 700 }}>
                    {cv.length ? `${((cv.reduce((a, b) => a + b.f1, 0) / cv.length) * 100).toFixed(2)}%` : "-"}
                  </span>
                  <span style={{ fontSize: 10, color: T.muted, marginLeft: 12 }}>± </span>
                  <span style={{ fontSize: 12, color: T.muted }}>
                    {cv.length
                      ? `${(
                          Math.sqrt(
                            cv.reduce((a, b) => {
                              const mean = cv.reduce((s, x) => s + x.f1, 0) / cv.length
                              return a + Math.pow(b.f1 - mean, 2)
                            }, 0) / cv.length,
                          ) * 100
                        ).toFixed(2)}%`
                      : "-"}
                  </span>
                </div>
              </div>
            </div>
          </ChartPanel>
        </div>

        <ChartPanel
          title="MODEL VERSION HISTORY - F1 DRIFT OVER TIME"
          subtitle="Each version marks a dataset expansion or architecture change. Monotonically improving."
          error={modelQ.error}
          lastOk={modelQ.lastOk}
          loading={modelQ.loading}
        >
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={drift}>
                <CartesianGrid stroke={T.brd} strokeDasharray="2 4" />
                <XAxis dataKey="date" stroke={T.brd} tick={{ fill: T.muted, fontSize: 9 }} />
                <YAxis stroke={T.brd} tick={{ fill: T.muted, fontSize: 9 }} domain={[0.88, 0.95]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip
                  contentStyle={TT}
                  formatter={(v) => [`${(Number(v) * 100).toFixed(1)}%`, "F1"]}
                  labelFormatter={(l) => {
                    const d = drift.find((x) => x.date === l)
                    return `${l}${d ? ` - ${d.notes}` : ""}`
                  }}
                />
                <Line type="monotone" dataKey="f1" stroke={T.g1} strokeWidth={2.5} dot={{ fill: T.g1, r: 5, strokeWidth: 0 }} />
                <ReferenceLine y={final.f1 || 0.936} stroke={T.g1} strokeDasharray="3 3" opacity={0.35} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14, overflowX: "auto", paddingBottom: 4 }}>
            {drift.map((v) => (
              <div
                key={`${v.date}-${v.dataset_version}`}
                style={{
                  minWidth: 160,
                  padding: "8px 12px",
                  background: T.s2,
                  borderRadius: 3,
                  border: `1px solid ${T.brd}`,
                  flexShrink: 0,
                }}
              >
                <div style={{ fontSize: 9, color: T.muted, marginBottom: 3 }}>{v.date}</div>
                <div style={{ fontSize: 13, color: T.g1, fontWeight: 700 }}>{(v.f1 * 100).toFixed(1)}%</div>
                <div style={{ fontSize: 9, color: T.muted, marginTop: 3 }}>{v.dataset_version}</div>
                <div style={{ fontSize: 10, color: T.txt, marginTop: 4, lineHeight: 1.5 }}>{v.notes}</div>
              </div>
            ))}
          </div>
        </ChartPanel>
      </div>
    </div>
  )
}
