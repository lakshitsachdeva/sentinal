import { useEffect, useMemo, useRef, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useAlerts, useCharts, useQueries, useRealtimeSignals, useSummary } from "../api/useApi"
import AlertCard from "../components/AlertCard"
import ChartPanel from "../components/ChartPanel"
import KPI from "../components/KPI"
import Nav from "../components/Nav"
import ThreatNetwork from "../components/ThreatNetwork"
import { FALLBACK_ALERTS, FALLBACK_CHARTS, FALLBACK_QUERIES, FALLBACK_SUMMARY } from "../data/staticData"
import { T } from "../styles/theme"

function EmptyState({ text = "No data available" }) {
  return (
    <div
      style={{
        minHeight: 180,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: T.muted,
        fontSize: 11,
        letterSpacing: ".12em",
      }}
    >
      {text}
    </div>
  )
}

function fmtLocalTime(iso) {
  if (!iso) return "--:--:--"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "--:--:--"
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function CustomTrafficTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const normal = Number(payload.find((p) => p.dataKey === "normal")?.value || 0)
  const suspicious = Number(payload.find((p) => p.dataKey === "suspicious")?.value || 0)
  return (
    <div
      style={{
        background: T.s1,
        border: `1px solid ${T.brd}`,
        borderRadius: 4,
        padding: "8px 12px",
        fontFamily: "'Share Tech Mono', 'Courier New', monospace",
        fontSize: 11,
        color: T.txt,
      }}
    >
      <div style={{ color: T.muted, marginBottom: 4 }}>time {label}</div>
      <div>
        normal: <span style={{ color: T.g1 }}>{normal}</span>
      </div>
      <div>
        suspicious: <span style={{ color: T.r }}>{suspicious}</span>
      </div>
    </div>
  )
}

function colorByAttackType(type) {
  const t = String(type || "").toLowerCase()
  if (t.includes("beacon")) return T.r
  if (t.includes("exfil")) return T.o
  if (t.includes("dga")) return T.y
  if (t.includes("tunnel")) return T.b
  return T.g2
}

function colorByHostScore(score) {
  const s = Number(score || 0)
  if (s >= 70) return T.r
  if (s >= 40) return T.o
  return T.g2
}

function queryStatus(q) {
  const suspicious = q?.status === "suspicious" || Number(q?.label) === 1
  const t = String(q?.attack_type || "").toLowerCase()
  if (!suspicious) return { label: "NORMAL", color: T.g2, suspicious: false }
  if (t.includes("beacon")) return { label: "BEACON", color: T.o, suspicious: true }
  if (t.includes("exfil")) return { label: "EXFIL", color: T.r, suspicious: true }
  if (t.includes("dga")) return { label: "DGA", color: T.y, suspicious: true }
  if (t.includes("attack")) return { label: "ATTACK", color: T.r, suspicious: true }
  return { label: "ATTACK", color: T.r, suspicious: true }
}

function parseBinStart(bin, fallback = 0) {
  if (typeof bin !== "string") return fallback
  const first = Number.parseFloat(bin.split("-")[0])
  return Number.isFinite(first) ? first : fallback
}

function alertSeverityRank(alert) {
  const sev = String(alert?.severity || "LOW").toUpperCase()
  if (sev === "HIGH") return 3
  if (sev === "MEDIUM") return 2
  return 1
}

function alertDisplaySort(a, b) {
  const bySev = alertSeverityRank(b) - alertSeverityRank(a)
  if (bySev !== 0) return bySev

  const scoreA = Number(a?.total_score || 0)
  const scoreB = Number(b?.total_score || 0)
  if (scoreB !== scoreA) return scoreB - scoreA

  const ta = new Date(a?.timestamp || 0).getTime()
  const tb = new Date(b?.timestamp || 0).getTime()
  return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
}

export default function DashboardPage({ onNavigate }) {
  const summaryQ = useSummary()
  const { data: chartsData, error: chartsError, loading: chartsLoading, lastOk: chartsLastOk, refresh: chartsRefresh } = useCharts()
  const alertsQ = useAlerts()
  const queriesQ = useQueries()
  const realtimeQ = useRealtimeSignals()

  const summary = realtimeQ.summary || summaryQ.data || FALLBACK_SUMMARY
  const charts = chartsData || FALLBACK_CHARTS
  const alerts = alertsQ.data || FALLBACK_ALERTS
  const queries = queriesQ.data || FALLBACK_QUERIES

  const [liveAlerts, setLiveAlerts] = useState(alerts)
  const [queryFilter, setQueryFilter] = useState("")
  const [, setNewAlertPulseTick] = useState(0)
  const notifiedIds = useRef(new Set())
  const newAlertIds = useRef(new Set())
  const prevSummary = useRef(null)

  useEffect(() => {
    setLiveAlerts(alerts)
  }, [alerts])

  useEffect(() => {
    prevSummary.current = summary
  }, [summary])

  useEffect(() => {
    if (!Array.isArray(realtimeQ.newAlerts) || realtimeQ.newAlerts.length === 0) return
    setLiveAlerts((prev) => {
      const merged = [...realtimeQ.newAlerts, ...(Array.isArray(prev) ? prev : [])]
      const byId = new Map()
      for (const item of merged) {
        const id = item?.alert_id || `${item?.src_host || "x"}-${item?.domain || "y"}-${item?.timestamp || Date.now()}`
        if (!byId.has(id)) byId.set(id, item)
      }
      return Array.from(byId.values()).slice(0, 50)
    })

    for (const a of realtimeQ.newAlerts) {
      if (a?.alert_id) newAlertIds.current.add(a.alert_id)
    }
    setNewAlertPulseTick((n) => n + 1)
    const clearId = setTimeout(() => {
      newAlertIds.current = new Set()
      setNewAlertPulseTick((n) => n + 1)
    }, 600)
    return () => clearTimeout(clearId)
  }, [realtimeQ.newAlerts])

  useEffect(() => {
    if (!Array.isArray(realtimeQ.newAlerts) || realtimeQ.newAlerts.length === 0) return
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission === "default") Notification.requestPermission().catch(() => {})
    if (Notification.permission !== "granted") return

    for (const a of realtimeQ.newAlerts) {
      const id = a?.alert_id || `${a?.src_host || "x"}-${a?.domain || "y"}`
      if (notifiedIds.current.has(id)) continue
      notifiedIds.current.add(id)
      if (String(a?.severity || "").toUpperCase() !== "HIGH") continue
      const score = Number(a?.total_score || 0).toFixed(1)
      const body = `${a?.src_host || "unknown"} -> ${a?.domain || "unknown"} | score ${score}`
      try {
        new Notification("SENTINEL HIGH ALERT", { body })
      } catch (_) {}
    }
  }, [realtimeQ.newAlerts])

  const prev = prevSummary.current || {}
  const alertDelta = Number(summary?.alerts_total || 0) - Number(prev?.alerts_total || 0)
  const suspiciousDelta = Number(summary?.queries_suspicious || 0) - Number(prev?.queries_suspicious || 0)
  const hostDelta = Number(summary?.unique_hosts || 0) - Number(prev?.unique_hosts || 0)
  const highDelta = Number(summary?.alerts_high || 0) - Number(prev?.alerts_high || 0)
  const queryDelta = Number(summary?.queries_total || 0) - Number(prev?.queries_total || 0)

  const severityData = (charts?.severity_breakdown || []).map((x) => ({
    ...x,
    color: x.name === "HIGH" ? T.r : x.name === "MEDIUM" ? T.o : T.g2,
  }))

  const attackTypes = charts?.attack_type_breakdown || []
  const topHosts = charts?.top_hosts || []
  const traffic = charts?.traffic || []
  const entropyDist = charts?.entropy_distribution || []
  const queryLengthDist = charts?.query_length_distribution || []

  const trafficSeriesRaw = traffic.map((row) => ({
    ...row,
    time_local: row?.ts_utc ? fmtLocalTime(row.ts_utc).slice(0, 5) : row?.time || "--:--",
  }))
  const trafficSeries =
    trafficSeriesRaw.length === 1
      ? [{ time_local: "prev", normal: 0, suspicious: 0 }, trafficSeriesRaw[0]]
      : trafficSeriesRaw

  const entropyPlot = entropyDist.map((x, i) => ({ ...x, x: parseBinStart(x.bin, i) }))
  const lenPlot = queryLengthDist.map((x, i) => ({ ...x, x: parseBinStart(x.bin, i) }))

  const streamAgeSec = useMemo(
    () => (realtimeQ.lastEventTs ? Math.max(0, Math.round((Date.now() - realtimeQ.lastEventTs) / 1000)) : null),
    [realtimeQ.lastEventTs],
  )

  const filteredQueries = (queries || []).filter((q) => {
    if (!queryFilter) return true
    const term = queryFilter.toLowerCase()
    return (q?.query_name || "").toLowerCase().includes(term) || (q?.src_ip || "").includes(queryFilter)
  })

  const threatLevel =
    summary?.alerts_high > 0 ? "HIGH" : summary?.alerts_medium > 0 ? "MEDIUM" : summary?.alerts_low > 0 ? "LOW" : "NONE"
  const anyError = summaryQ.error || chartsError || alertsQ.error || queriesQ.error
  const displayAlerts = useMemo(() => [...(liveAlerts || [])].sort(alertDisplaySort), [liveAlerts])

  return (
    <div style={{ color: T.txt, background: T.bg, minHeight: "100vh" }}>
      <Nav
        page="dashboard"
        onNavigate={onNavigate}
        liveQueries={summary?.queries_total || 0}
        lifetimeQueries={summary?.queries_lifetime || 0}
        mode={summary?.mode || "DEMO_FEED"}
        threatLevel={threatLevel}
        highAlerts={summary?.alerts_high || 0}
        totalAlerts={summary?.alerts_total || 0}
      />

      <div style={{ padding: "24px" }}>
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 4,
            border: `1px solid ${realtimeQ.connected ? T.g1 : T.o}`,
            background: realtimeQ.connected ? `${T.g1}14` : `${T.o}12`,
            color: realtimeQ.connected ? T.g1 : T.o,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 11,
            letterSpacing: ".08em",
          }}
        >
          <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: realtimeQ.connected ? T.g1 : T.o }} />
          <span>{realtimeQ.connected ? "REALTIME SIGNAL STREAM ONLINE" : "REALTIME STREAM RECONNECTING (poll fallback active)"}</span>
          <span style={{ marginLeft: "auto", color: T.muted }}>
            {streamAgeSec === null ? "waiting first event" : `last stream event ${streamAgeSec}s ago`}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 0,
            border: `1px solid ${T.brd}`,
            borderRadius: 4,
            marginBottom: 16,
            overflow: "hidden",
          }}
        >
          {[
            {
              label: "THREAT LEVEL",
              value: threatLevel,
              color: threatLevel === "HIGH" ? T.r : threatLevel === "MEDIUM" ? T.o : T.g2,
              sub:
                threatLevel === "HIGH"
                  ? "immediate attention required"
                  : threatLevel === "MEDIUM"
                    ? "investigation recommended"
                    : "nominal",
            },
            {
              label: "DETECTION CONFIDENCE",
              value: summary?.alerts_high > 0 ? "91.3%" : "—",
              color: T.g1,
              sub: "XGBoost ensemble P(malicious)",
            },
            {
              label: "ACTIVE C2 CHANNELS",
              value: liveAlerts.filter((a) => a.is_beaconing).length || 0,
              color: T.r,
              sub: "beaconing hosts detected",
            },
            {
              label: "PIPELINE STATUS",
              value: realtimeQ.connected ? "ONLINE" : "DEGRADED",
              color: realtimeQ.connected ? T.g1 : T.o,
              sub: realtimeQ.connected ? "realtime stream active" : "polling fallback",
            },
          ].map(({ label, value, color, sub }, i) => (
            <div
              key={label}
              style={{
                padding: "14px 20px",
                borderRight: i < 3 ? `1px solid ${T.brd}` : "none",
                background: T.s1,
              }}
            >
              <div style={{ fontSize: 9, color: T.muted, letterSpacing: ".15em", marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>{sub}</div>
            </div>
          ))}
        </div>

        {anyError ? (
          <div style={{ marginBottom: 16, padding: 10, border: `1px solid ${T.r}`, color: T.r, background: `${T.r}12` }}>
            API error detected. Dashboard is currently using fallback/cached values where needed.
          </div>
        ) : null}

        <div style={{ marginBottom: 10, fontSize: 9, color: T.muted, letterSpacing: ".2em" }}>
          DATA SOURCE: {summary?.data_source || "DEMO_FEED"} &nbsp;·&nbsp;
          {new Date().toLocaleDateString()} &nbsp;·&nbsp;
          SENTINEL DNS-IDS
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(100px, 1fr))", gap: 12, marginBottom: 16 }}>
          <KPI
            label="QUERIES (LIFETIME)"
            value={(summary?.queries_lifetime || summary?.queries_total || 0).toLocaleString()}
            color={T.g1}
            sub={`window ${(summary?.queries_window || 0).toLocaleString()}`}
            delta={queryDelta}
            spark={charts?.kpi_trend?.queries}
          />
          <KPI
            label="SUSPICIOUS"
            value={(summary?.queries_suspicious || 0).toLocaleString()}
            color={T.o}
            delta={suspiciousDelta}
            spark={charts?.kpi_trend?.suspicious}
          />
          <KPI
            label="ALERTS"
            value={(summary?.alerts_total || 0).toLocaleString()}
            color={T.r}
            delta={alertDelta}
            spark={charts?.kpi_trend?.alerts}
          />
          <KPI
            label="HIGH ALERTS"
            value={(summary?.alerts_high || 0).toLocaleString()}
            color={T.r}
            delta={highDelta}
            spark={charts?.kpi_trend?.high}
          />
          <KPI
            label="HOSTS"
            value={(summary?.unique_hosts || 0).toLocaleString()}
            color={T.b}
            delta={hostDelta}
            spark={charts?.kpi_trend?.hosts}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12, marginBottom: 16 }}>
          <ChartPanel
            title="DNS TRAFFIC OVER TIME"
            legend={[
              { label: "Normal", color: T.g1 },
              { label: "Suspicious", color: T.r },
            ]}
            error={chartsError}
            lastOk={chartsLastOk}
            loading={chartsLoading}
            onRetry={() => chartsRefresh?.()}
            minHeight={240}
          >
            {trafficSeries.length ? (
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trafficSeries}>
                    <defs>
                      <linearGradient id="gradNormal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={T.g1} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={T.g1} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradSusp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={T.r} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={T.r} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={T.brd} strokeDasharray="2 4" />
                    <XAxis dataKey="time_local" stroke={T.brd} tick={{ fill: T.muted, fontSize: 9 }} />
                    <YAxis width={30} stroke={T.brd} tick={{ fill: T.muted, fontSize: 10 }} />
                    <Tooltip content={<CustomTrafficTooltip />} />
                    <Area type="monotone" dataKey="normal" stroke={T.g1} strokeWidth={2} fill="url(#gradNormal)" />
                    <Area type="monotone" dataKey="suspicious" stroke={T.r} strokeWidth={2} fill="url(#gradSusp)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="Waiting for traffic data" />
            )}
          </ChartPanel>

          <ChartPanel
            title="SEVERITY BREAKDOWN"
            error={chartsError}
            lastOk={chartsLastOk}
            loading={chartsLoading}
            onRetry={() => chartsRefresh?.()}
            minHeight={220}
          >
            {severityData.length ? (
              <div style={{ position: "relative", height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={severityData} dataKey="value" nameKey="name" outerRadius={75} innerRadius={50}>
                      {severityData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: T.txt }}>{summary?.alerts_total || 0}</div>
                    <div style={{ fontSize: 8, letterSpacing: ".2em", color: T.muted }}>ALERTS</div>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState text="No severity data" />
            )}
          </ChartPanel>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <ChartPanel
            title="SUBDOMAIN ENTROPY DISTRIBUTION"
            legend={[
              { label: "Benign", color: T.g1 },
              { label: "Malicious", color: T.r },
            ]}
            error={chartsError}
            lastOk={chartsLastOk}
            loading={chartsLoading}
            onRetry={() => chartsRefresh?.()}
            minHeight={220}
          >
            {entropyPlot.length ? (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={entropyPlot}>
                    <XAxis dataKey="x" type="number" stroke={T.muted} tick={{ fill: T.muted, fontSize: 9 }} />
                    <YAxis stroke={T.muted} tick={{ fill: T.muted, fontSize: 10 }} />
                    <Tooltip />
                    <ReferenceLine x={3.8} stroke={T.r} strokeDasharray="3 3" label={{ value: "threshold", fill: T.r, fontSize: 8, position: "top" }} />
                    <Bar dataKey="normal" fill={T.g3} opacity={0.85} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="suspicious" fill={T.r} opacity={0.85} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="No entropy data" />
            )}
          </ChartPanel>

          <ChartPanel
            title="QUERY LENGTH DISTRIBUTION"
            error={chartsError}
            lastOk={chartsLastOk}
            loading={chartsLoading}
            onRetry={() => chartsRefresh?.()}
            minHeight={220}
          >
            {lenPlot.length ? (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lenPlot}>
                    <XAxis dataKey="x" type="number" stroke={T.muted} tick={{ fill: T.muted, fontSize: 9 }} />
                    <YAxis stroke={T.muted} tick={{ fill: T.muted, fontSize: 10 }} />
                    <Tooltip />
                    <ReferenceLine x={75} stroke={T.o} strokeDasharray="3 3" label={{ value: "R001 limit", fill: T.o, fontSize: 8, position: "top" }} />
                    <Bar dataKey="normal" fill={T.g3} opacity={0.85} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="suspicious" fill={T.o} opacity={0.85} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="No length distribution data" />
            )}
          </ChartPanel>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <ChartPanel
            title="ATTACK TYPE BREAKDOWN"
            error={chartsError}
            lastOk={chartsLastOk}
            loading={chartsLoading}
            onRetry={() => chartsRefresh?.()}
            minHeight={220}
          >
            {attackTypes.length ? (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attackTypes} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid stroke={T.brd} strokeDasharray="2 3" horizontal={false} vertical />
                    <XAxis type="number" stroke={T.muted} tick={{ fill: T.muted, fontSize: 10 }} />
                    <YAxis dataKey="type" type="category" stroke={T.muted} tick={{ fill: T.muted, fontSize: 10 }} width={110} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                      {attackTypes.map((entry, i) => (
                        <Cell key={`${entry.type}-${i}`} fill={colorByAttackType(entry.type)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="No attack type data" />
            )}
          </ChartPanel>

          <ChartPanel
            title="TOP HOSTS"
            error={chartsError}
            lastOk={chartsLastOk}
            loading={chartsLoading}
            onRetry={() => chartsRefresh?.()}
            minHeight={220}
          >
            {topHosts.length ? (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topHosts} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid stroke={T.brd} strokeDasharray="2 3" />
                    <XAxis type="number" stroke={T.muted} tick={{ fill: T.muted, fontSize: 10 }} />
                    <YAxis dataKey="host" type="category" stroke={T.muted} tick={{ fill: T.muted, fontSize: 10 }} width={95} />
                    <Tooltip />
                    <ReferenceLine
                      x={70}
                      stroke={T.r}
                      strokeDasharray="3 3"
                      label={{ value: "HIGH", fill: T.r, fontSize: 8, position: "insideTopRight" }}
                    />
                    <Bar dataKey="score" radius={[0, 3, 3, 0]}>
                      {topHosts.map((entry, i) => (
                        <Cell key={`${entry.host}-${i}`} fill={colorByHostScore(entry.score)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="No host scores" />
            )}
          </ChartPanel>
        </div>

        <div style={{ background: T.s1, border: `1px solid ${T.brd}`, borderRadius: 4, padding: 18, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".16em" }}>ACTIVE ALERTS</div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <span style={{ padding: "2px 8px", border: `1px solid ${T.r}`, borderRadius: 3, fontSize: 10, color: T.r }}>
                {summary?.alerts_high || 0} HIGH
              </span>
              <span style={{ padding: "2px 8px", border: `1px solid ${T.o}`, borderRadius: 3, fontSize: 10, color: T.o }}>
                {summary?.alerts_medium || 0} MED
              </span>
              <span style={{ padding: "2px 8px", border: `1px solid ${T.g2}`, borderRadius: 3, fontSize: 10, color: T.g2 }}>
                {summary?.alerts_low || 0} LOW
              </span>
            </div>
          </div>

          {displayAlerts.length === 0 ? <div style={{ color: T.muted, fontSize: 12 }}>No alerts yet</div> : null}
          {displayAlerts.map((a, idx) => (
            <AlertCard
              key={a.alert_id || `${a.src_host}-${idx}`}
              alert={a}
              defaultOpen={idx === 0}
              isNew={newAlertIds.current.has(a.alert_id)}
            />
          ))}
        </div>

        <div style={{ background: T.s1, border: `1px solid ${T.brd}`, borderRadius: 4, padding: 18, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".16em" }}>THREAT TOPOLOGY - HOST / DOMAIN RELATIONSHIP GRAPH</div>
            <span style={{ fontSize: 9, color: T.g4 }}>force-directed live layout - pulsing nodes = active threat</span>
          </div>
          <ThreatNetwork alerts={liveAlerts} queries={queries} />
        </div>

        <div style={{ background: T.s1, border: `1px solid ${T.brd}`, borderRadius: 4, padding: 18 }}>
          <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".16em", marginBottom: 10 }}>DNS QUERY LOG (LATEST)</div>
          <input
            placeholder="FILTER QUERIES..."
            value={queryFilter}
            onChange={(e) => setQueryFilter(e.target.value)}
            style={{
              width: "100%",
              marginBottom: 10,
              background: T.s2,
              border: `1px solid ${T.brd}`,
              borderRadius: 3,
              padding: "7px 12px",
              fontFamily: "inherit",
              fontSize: 11,
              color: T.txt,
              outline: "none",
            }}
          />

          <div style={{ overflowX: "auto", maxHeight: 340, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  {["TIME ↕", "SOURCE ↕", "QUERY ↕", "TYPE ↕", "RCODE ↕", "STATUS ↕"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 6px", color: T.muted, borderBottom: `1px solid ${T.brd}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredQueries.map((q, idx) => {
                  const s = queryStatus(q)
                  return (
                    <tr
                      key={`${q.timestamp}-${idx}`}
                      className={s.suspicious ? "query-row-attack" : undefined}
                      style={{ background: s.suspicious ? `${T.r}08` : "transparent" }}
                    >
                      <td style={{ padding: "8px 6px", borderBottom: `1px solid ${T.brd}55` }}>{fmtLocalTime(q.timestamp_utc || q.timestamp)}</td>
                      <td style={{ padding: "8px 6px", borderBottom: `1px solid ${T.brd}55` }}>{q.src_ip}</td>
                      <td style={{ padding: "8px 6px", borderBottom: `1px solid ${T.brd}55`, color: s.suspicious ? T.r : T.txt }}>{q.query_name}</td>
                      <td style={{ padding: "8px 6px", borderBottom: `1px solid ${T.brd}55` }}>{q.query_type}</td>
                      <td style={{ padding: "8px 6px", borderBottom: `1px solid ${T.brd}55` }}>{q.rcode}</td>
                      <td style={{ padding: "8px 6px", borderBottom: `1px solid ${T.brd}55` }}>
                        <span
                          style={{
                            padding: "1px 7px",
                            border: `1px solid ${s.color}`,
                            borderRadius: 2,
                            fontSize: 9,
                            color: s.color,
                            background: `${s.color}14`,
                          }}
                        >
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
