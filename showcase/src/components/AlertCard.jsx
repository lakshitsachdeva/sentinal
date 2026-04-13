import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import IATWaveform from "./IATWaveform"
import ThreatRadar from "./ThreatRadar"
import { T } from "../styles/theme"

function normalizeReasons(reasons) {
  if (Array.isArray(reasons)) return reasons
  if (typeof reasons === "string") {
    try {
      const parsed = JSON.parse(reasons)
      return Array.isArray(parsed) ? parsed : [reasons]
    } catch {
      return [reasons]
    }
  }
  return []
}

function reasonColor(reason) {
  const s = String(reason || "")
  const up = s.toUpperCase()
  if (up.startsWith("[RULE")) return T.r
  if (up.startsWith("[BEHAVIOR")) return T.o
  if (up.startsWith("[ML")) return T.b
  return T.txt
}

function reasonBadge(reason) {
  const s = String(reason || "")
  const up = s.toUpperCase()
  if (up.startsWith("[RULE")) {
    const m = s.match(/\[RULE\s+([^\]]+)\]/i)
    return { label: (m && m[1]) || "RULE", bg: T.r }
  }
  if (up.startsWith("[BEHAVIOR")) return { label: "BEH", bg: T.o }
  if (up.startsWith("[ML")) return { label: "ML", bg: T.b }
  return null
}

function fmtTime(ts) {
  if (!ts) return "--:--:--"
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return "--:--:--"
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function extractBeaconInterval(reasons) {
  const matchStr = (reasons || []).find((x) => String(x).toLowerCase().includes("beacon every"))
  if (!matchStr) return null
  const m = String(matchStr).match(/every\s+~?([\d.]+)s/i)
  return m ? Number.parseFloat(m[1]) : null
}

function ScoreGauge({ score, color }) {
  const safeScore = Math.max(0, Math.min(100, Number(score || 0)))
  const [drawn, setDrawn] = useState(0)

  useEffect(() => {
    let raf = null
    let start = null
    const animate = (ts) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / 800, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDrawn(eased * safeScore)
      if (progress < 1) raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [safeScore])

  const R = 36
  const CX = 44
  const CY = 44
  const startAngle = Math.PI
  const arcAngle = startAngle + (drawn / 100) * Math.PI
  const x1 = CX + R * Math.cos(startAngle)
  const y1 = CY + R * Math.sin(startAngle)
  const x2 = CX + R * Math.cos(arcAngle)
  const y2 = CY + R * Math.sin(arcAngle)
  const large = drawn > 50 ? 1 : 0

  return (
    <svg width={88} height={52} style={{ overflow: "visible", marginTop: 2 }}>
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke={T.brd} strokeWidth={5} strokeLinecap="round" />
      {drawn > 0 ? (
        <path d={`M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" />
      ) : null}
      <text x={CX} y={CY - 4} textAnchor="middle" fill={color} fontSize="13" fontWeight="700" fontFamily="'Share Tech Mono',monospace">
        {Math.round(drawn)}
      </text>
      <text x={CX} y={CY + 10} textAnchor="middle" fill={T.muted} fontSize="7" fontFamily="'Share Tech Mono',monospace">
        / 100
      </text>
    </svg>
  )
}

export default function AlertCard({ alert, defaultOpen = false, isNew = false }) {
  const [open, setOpen] = useState(defaultOpen)

  const severity = String(alert?.severity || "LOW").toUpperCase()
  const c = severity === "HIGH" ? T.r : severity === "MEDIUM" ? T.o : T.g2
  const reasons = useMemo(() => normalizeReasons(alert?.reasons), [alert?.reasons])

  const score = Number(alert?.total_score || 0)
  const scoreColor = score >= 70 ? T.r : score >= 40 ? T.o : T.g2
  const pct = Math.max(0, Math.min(100, score))

  const mlPct = Number.isFinite(Number(alert?.ml_score))
    ? `${(Number(alert.ml_score) * 100).toFixed(0)}%`
    : "—"
  const beaconInterval = useMemo(() => extractBeaconInterval(reasons), [reasons])
  const tooltipStyle = useMemo(
    () => ({
      background: T.s2,
      border: `1px solid ${T.brd}`,
      fontSize: 10,
      fontFamily: "monospace",
    }),
    [],
  )

  return (
    <div
      className={isNew ? "alert-card-enter" : undefined}
      style={{
        border: `1px solid ${c}22`,
        borderLeft: `3px solid ${c}`,
        borderRadius: 4,
        marginBottom: 8,
        background: `${c}06`,
        overflow: "hidden",
      }}
    >
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          cursor: "pointer",
        }}
      >
        <span style={{ color: c, fontSize: 11, fontWeight: 700, minWidth: 64 }}>[{severity}]</span>
        <span style={{ color: T.txt, fontSize: 12, flex: 1 }}>
          {alert?.src_host || "-"} -&gt; {alert?.domain || "-"}
          {alert?.is_beaconing ? (
            <span
              style={{
                marginLeft: 8,
                padding: "1px 6px",
                borderRadius: 2,
                border: `1px solid ${T.o}88`,
                background: `${T.o}20`,
                color: T.o,
                fontSize: 9,
              }}
            >
              BEACON
            </span>
          ) : null}
        </span>
        <ScoreGauge score={score} color={c} />
        <span style={{ color: T.muted, fontSize: 10 }}>{fmtTime(alert?.timestamp)}</span>
        {open ? <ChevronDown size={13} color={T.muted} /> : <ChevronRight size={13} color={T.muted} />}
      </div>

      <div style={{ height: 3, width: "100%", background: T.brd }}>
        <div style={{ height: "100%", width: `${pct}%`, background: scoreColor }} />
      </div>

      <div
        style={{
          maxHeight: open ? "600px" : "0",
          overflow: "hidden",
          transition: "max-height 0.3s ease, opacity 0.3s ease",
          opacity: open ? 1 : 0,
        }}
      >
        <div style={{ padding: "12px 14px 14px", borderTop: `1px solid ${c}1a` }}>
          {(alert?.rule_score !== undefined || alert?.behavior_score !== undefined || alert?.ml_score !== undefined) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
              <div style={{ padding: "8px 10px", background: T.s2, border: `1px solid ${T.brd}`, borderRadius: 3 }}>
                <div style={{ fontSize: 9, color: T.muted, marginBottom: 4 }}>RULE</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.r }}>{alert?.rule_score ?? "—"}</div>
              </div>
              <div style={{ padding: "8px 10px", background: T.s2, border: `1px solid ${T.brd}`, borderRadius: 3 }}>
                <div style={{ fontSize: 9, color: T.muted, marginBottom: 4 }}>BEH</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.o }}>{alert?.behavior_score ?? "—"}</div>
              </div>
              <div style={{ padding: "8px 10px", background: T.s2, border: `1px solid ${T.brd}`, borderRadius: 3 }}>
                <div style={{ fontSize: 9, color: T.muted, marginBottom: 4 }}>ML</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.b }}>{mlPct}</div>
              </div>
            </div>
          )}

          {alert?.is_beaconing ? <IATWaveform host={alert?.src_host} beaconInterval={beaconInterval} /> : null}

          {(severity === "HIGH" || severity === "MEDIUM") && <ThreatRadar alert={alert} />}

          {Array.isArray(alert?.shap_values) && alert.shap_values.length > 0 ? (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: T.g4, letterSpacing: ".2em", marginBottom: 6 }}>FEATURE ATTRIBUTION (SHAP)</div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={alert.shap_values.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                    <XAxis type="number" stroke={T.brd} tick={{ fill: T.muted, fontSize: 8 }} domain={[-0.2, 0.2]} tickFormatter={(v) => v.toFixed(2)} />
                    <YAxis type="category" dataKey="feature" stroke={T.brd} tick={{ fill: T.muted, fontSize: 8 }} width={130} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v, _, p) => [`SHAP: ${Number(v).toFixed(4)} | value: ${p?.payload?.value ?? "—"}`, p?.payload?.feature]}
                    />
                    <ReferenceLine x={0} stroke={T.brd} strokeWidth={1} />
                    <Bar dataKey="shap" radius={[0, 2, 2, 0]}>
                      {alert.shap_values.slice(0, 8).map((s) => (
                        <Cell key={s.feature} fill={Number(s.shap) > 0 ? T.r : T.b} opacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                <span style={{ fontSize: 9, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, background: T.r, borderRadius: 1, display: "inline-block" }} />
                  pushes score UP
                </span>
                <span style={{ fontSize: 9, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, background: T.b, borderRadius: 1, display: "inline-block" }} />
                  pushes score DOWN
                </span>
              </div>
            </div>
          ) : null}

          <div style={{ fontSize: 9, color: T.g4, letterSpacing: ".2em", marginBottom: 6 }}>EVIDENCE</div>
          {reasons.length ? (
            <div style={{ fontSize: 11, marginBottom: 8 }}>
              {reasons.map((r, i) => {
                const rowColor = reasonColor(r)
                const badge = reasonBadge(r)
                return (
                  <div
                    key={`${r}-${i}`}
                    style={{
                      display: "flex",
                      gap: 8,
                      padding: "5px 0",
                      borderBottom: `1px solid ${T.brd}22`,
                      alignItems: "flex-start",
                    }}
                  >
                    {badge ? (
                      <span
                        style={{
                          padding: "1px 5px",
                          borderRadius: 2,
                          fontSize: 8,
                          background: badge.bg,
                          color: T.bg,
                          marginTop: 1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {badge.label}
                      </span>
                    ) : null}
                    <span style={{ color: rowColor, fontSize: 11 }}>{r}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>No evidence reasons available.</div>
          )}

          {alert?.run_id ? <div style={{ fontSize: 9, color: T.muted }}>run: {alert.run_id}</div> : null}
        </div>
      </div>
    </div>
  )
}
