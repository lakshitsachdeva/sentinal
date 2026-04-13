import { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts"
import { T } from "../styles/theme"

const BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000"

export default function IATWaveform({ host, beaconInterval }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (!host) {
      setData([])
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    setLoading(true)
    fetch(`${BASE}/api/iat/${encodeURIComponent(host)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setData(d?.data?.iat_series || [])
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [host])

  if (loading) {
    return (
      <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 10 }}>
        <span className="blink">█</span>&nbsp;loading waveform...
      </div>
    )
  }

  if (!data || data.length === 0) return null

  const TT = { background: T.s2, border: `1px solid ${T.brd}`, fontSize: 10, fontFamily: "monospace" }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: T.g4, letterSpacing: ".2em", marginBottom: 4 }}>
        IAT WAVEFORM - INTER-ARRIVAL TIME SEQUENCE
        {beaconInterval ? <span style={{ color: T.o, marginLeft: 12 }}>detected interval: ~{beaconInterval}s</span> : null}
      </div>
      <div style={{ height: 70, background: T.s2, borderRadius: 3, padding: "4px 0" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="idx" hide />
            <YAxis domain={[0, "auto"]} hide />
            <Tooltip contentStyle={TT} formatter={(v) => [`${v}s`, "IAT"]} />
            {beaconInterval ? <ReferenceLine y={beaconInterval} stroke={T.o} strokeDasharray="3 3" opacity={0.7} /> : null}
            <Line type="monotone" dataKey="iat" stroke={T.g1} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 9, color: T.muted, marginTop: 3 }}>
        A flat waveform hugging the reference line confirms automated periodic C2 check-in. Human traffic shows random height variation.
      </div>
    </div>
  )
}
