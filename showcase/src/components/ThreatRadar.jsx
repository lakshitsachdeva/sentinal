import { Radar, RadarChart, PolarGrid, PolarAngleAxis, Tooltip, ResponsiveContainer } from "recharts"
import { T } from "../styles/theme"

export function computeRadarData(alert) {
  const reasons = Array.isArray(alert?.reasons) ? alert.reasons : []
  const score = Number(alert?.total_score || 0)

  const hasBeacon = Boolean(alert?.is_beaconing)
  const hasExfil = reasons.some((r) => String(r).toLowerCase().includes("exfil") || String(r).includes("chunk"))
  const hasDGA = reasons.some((r) => String(r).toLowerCase().includes("dga") || String(r).toLowerCase().includes("nxdomain"))
  const hasML = reasons.some((r) => String(r).startsWith("[ML]"))
  const hasRule = reasons.filter((r) => String(r).toUpperCase().startsWith("[RULE")).length
  const hasBase64 = reasons.some((r) => String(r).includes("Base64") || String(r).includes("R003"))

  return [
    { axis: "C2 BEACONING", value: hasBeacon ? Math.min(100, score) : score * 0.3 },
    { axis: "EXFILTRATION", value: hasExfil ? Math.min(100, score * 0.9) : score * 0.15 },
    { axis: "DGA ACTIVITY", value: hasDGA ? Math.min(100, score * 0.8) : score * 0.1 },
    { axis: "ML CONFIDENCE", value: hasML ? Math.min(100, score) : score * 0.5 },
    { axis: "RULE HITS", value: Math.min(100, hasRule * 25) },
    { axis: "ENCODING", value: hasBase64 ? Math.min(100, score * 0.85) : score * 0.2 },
  ]
}

export default function ThreatRadar({ alert }) {
  const data = computeRadarData(alert)
  const TT = { background: T.s2, border: `1px solid ${T.brd}`, fontSize: 10, fontFamily: "monospace" }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: T.g4, letterSpacing: ".2em", marginBottom: 4 }}>THREAT PROFILE RADAR</div>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius={75}>
            <PolarGrid stroke={T.brd} />
            <PolarAngleAxis dataKey="axis" tick={{ fill: T.muted, fontSize: 8, fontFamily: "monospace" }} />
            <Tooltip contentStyle={TT} />
            <Radar dataKey="value" stroke={T.r} fill={T.r} fillOpacity={0.18} strokeWidth={1.5} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
