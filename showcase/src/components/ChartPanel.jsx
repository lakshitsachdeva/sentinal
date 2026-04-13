import { useEffect, useMemo, useState } from "react"
import { T } from "../styles/theme"

export default function ChartPanel({
  title,
  subtitle,
  error,
  lastOk,
  loading,
  children,
  minHeight = 200,
  legend,
  onRetry,
}) {
  const [tick, setTick] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 5000)
    return () => clearInterval(id)
  }, [])

  const ageSec = useMemo(() => {
    if (!lastOk) return null
    return Math.max(0, Math.round((tick - Number(lastOk)) / 1000))
  }, [lastOk, tick])

  const loadingState = (
    <div style={{ minHeight, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%" }}>
        <div className="shimmer-line" style={{ height: 14, borderRadius: 3, marginBottom: 8, width: "80%" }} />
        <div className="shimmer-line" style={{ height: 14, borderRadius: 3, marginBottom: 8, width: "60%" }} />
        <div className="shimmer-line" style={{ height: 14, borderRadius: 3, width: "40%" }} />
      </div>
    </div>
  )

  const errorState = (
    <div style={{ background: `${T.r}10`, border: `1px solid ${T.r}33`, borderRadius: 3, padding: 10 }}>
      <div style={{ fontSize: 10, color: T.r, marginBottom: 4 }}>⚠ API ERROR</div>
      <div style={{ fontSize: 10, color: T.muted, marginBottom: 6 }}>{error}</div>
      {ageSec !== null ? <div style={{ fontSize: 9, color: T.muted, marginBottom: 6 }}>last successful data: {ageSec}s ago</div> : null}
      {onRetry ? (
        <button
          className="nav-btn"
          onClick={onRetry}
          style={{ color: T.o, borderColor: T.o, padding: "4px 10px", fontSize: 10 }}
        >
          RETRY ↺
        </button>
      ) : null}
    </div>
  )

  return (
    <div style={{ background: T.s1, border: `1px solid ${T.brd}`, borderRadius: 4, padding: 18 }}>
      <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".16em", marginBottom: 4 }}>{title}</div>
      {subtitle ? <div style={{ fontSize: 10, color: T.g4, marginBottom: 10 }}>{subtitle}</div> : null}

      {Array.isArray(legend) && legend.length ? (
        <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
          {legend.map((it) => (
            <span key={`${it.label}-${it.color}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.muted }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: it.color, display: "inline-block" }} />
              {it.label}
            </span>
          ))}
        </div>
      ) : null}

      {loading && !error ? loadingState : error ? errorState : children}

      {ageSec !== null ? (
        <div style={{ marginTop: 8, fontSize: 9, color: T.muted, textAlign: "right" }}>updated {ageSec}s ago</div>
      ) : null}
    </div>
  )
}
