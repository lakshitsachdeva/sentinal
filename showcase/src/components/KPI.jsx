import { useEffect, useMemo, useRef, useState } from "react"
import { T } from "../styles/theme"

function parseNumericValue(input) {
  if (typeof input === "number" && Number.isFinite(input)) return input
  if (typeof input !== "string") return null
  const raw = input.trim()
  if (!/^-?[\d,]+(\.\d+)?$/.test(raw)) return null
  const parsed = Number.parseFloat(raw.replace(/,/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function formatDisplayLike(value, num) {
  if (typeof value === "number") return Math.round(num).toLocaleString()
  const src = String(value)
  if (src.includes(".")) return num.toFixed(1)
  return Math.round(num).toLocaleString()
}

function Sparkline({ spark, color }) {
  if (!Array.isArray(spark) || spark.length < 2) return null

  const width = 60
  const min = Math.min(...spark)
  const max = Math.max(...spark)
  const range = max - min || 1
  const stepX = width / (spark.length - 1)
  const points = spark
    .slice(0, 12)
    .map((v, i) => {
      const x = i * stepX
      const y = 20 - ((v - min) / range) * 20
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(" ")

  return (
    <svg width={60} height={24} viewBox="0 0 60 24" role="img" aria-label="kpi trend" style={{ marginTop: 6 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  )
}

export default function KPI({
  label,
  value,
  color = T.g1,
  sub,
  delta,
  spark,
  animate = true,
}) {
  const targetNumeric = parseNumericValue(value)
  const prevNumeric = useRef(targetNumeric)
  const [hovered, setHovered] = useState(false)
  const [displayNumeric, setDisplayNumeric] = useState(targetNumeric)
  const [pulseUp, setPulseUp] = useState(false)

  useEffect(() => {
    if (!animate || targetNumeric === null) {
      setDisplayNumeric(targetNumeric)
      prevNumeric.current = targetNumeric
      return
    }

    const start = prevNumeric.current ?? targetNumeric
    const end = targetNumeric

    if (start === end) {
      setDisplayNumeric(end)
      prevNumeric.current = end
      return
    }

    const duration = 800
    const startedAt = Date.now()

    const id = setInterval(() => {
      const elapsed = Date.now() - startedAt
      const t = Math.min(1, elapsed / duration)
      const next = start + (end - start) * t
      setDisplayNumeric(next)
      if (t >= 1) {
        clearInterval(id)
        prevNumeric.current = end
        if (end > start) {
          setPulseUp(true)
          setTimeout(() => setPulseUp(false), 300)
        }
      }
    }, 16)

    return () => clearInterval(id)
  }, [animate, targetNumeric])

  const renderedValue = useMemo(() => {
    if (targetNumeric === null) return String(value)
    const shown = displayNumeric ?? targetNumeric
    return formatDisplayLike(value, shown)
  }, [displayNumeric, targetNumeric, value])

  const deltaBadge = (() => {
    if (typeof delta !== "number" || delta === 0) return null
    const up = delta > 0
    return (
      <span
        style={{
          padding: "1px 6px",
          borderRadius: 2,
          fontSize: 9,
          background: up ? T.g1 : T.r,
          color: T.bg,
          marginLeft: 8,
        }}
      >
        {up ? "↑" : "↓"} {up ? `+${delta}` : `${delta}`}
      </span>
    )
  })()

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "16px 20px",
        background: pulseUp ? `${color}22` : T.s2,
        border: `1px solid ${hovered ? color : T.brd}`,
        borderTop: `2px solid ${color}`,
        borderRadius: 4,
        transition: "border-color .2s ease, background-color .2s ease",
      }}
    >
      <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".12em", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{renderedValue}</div>
        {deltaBadge}
      </div>
      <Sparkline spark={spark} color={color} />
      {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}
