import { useEffect, useMemo, useState } from "react"
import { Activity, Brain, Database, Network } from "lucide-react"
import { useAlerts, useSummary } from "../api/useApi"
import Nav from "../components/Nav"
import MatrixRain from "../components/MatrixRain"
import OnboardingTour from "../components/OnboardingTour"
import { FALLBACK_ALERTS, FALLBACK_SUMMARY } from "../data/staticData"
import { T } from "../styles/theme"

function animatedCount(target, stepDiv = 200) {
  return Math.max(1, Math.ceil(target / stepDiv))
}

function fmtShortTime(ts) {
  if (!ts) return "--:--"
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return "--:--"
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export default function LandingPage({ onNavigate }) {
  const summaryQ = useSummary()
  const alertsQ = useAlerts()

  const summary = summaryQ.data || FALLBACK_SUMMARY
  const alerts = alertsQ.data || FALLBACK_ALERTS

  const [displayAlerts, setDisplayAlerts] = useState(0)
  const [displayQueries, setDisplayQueries] = useState(0)
  const [displayTests, setDisplayTests] = useState(0)
  const [tourOpen, setTourOpen] = useState(false)

  const targetAlerts = Number(summary?.alerts_total || 0)
  const targetQueries = Number(summary?.queries_lifetime || summary?.queries_total || 0)
  const targetTests = Number(summary?.tests_passed || 0)

  useEffect(() => {
    setDisplayAlerts((n) => (n > targetAlerts ? targetAlerts : n))
    setDisplayQueries((n) => (n > targetQueries ? targetQueries : n))
    setDisplayTests((n) => (n > targetTests ? targetTests : n))

    const t1 = setInterval(() => setDisplayAlerts((n) => (n < targetAlerts ? n + 1 : n)), 25)
    const t2 = setInterval(() => setDisplayQueries((n) => (n < targetQueries ? n + animatedCount(targetQueries) : n)), 25)
    const t3 = setInterval(() => setDisplayTests((n) => (n < targetTests ? n + 1 : n)), 45)
    return () => {
      clearInterval(t1)
      clearInterval(t2)
      clearInterval(t3)
    }
  }, [targetAlerts, targetQueries, targetTests])

  useEffect(() => {
    try {
      const seen = localStorage.getItem("sentinel_tour_seen_v1")
      if (!seen) setTourOpen(true)
    } catch (_) {}
  }, [])

  const tickers = useMemo(() => {
    const t = []
    for (const a of (alerts || []).slice(0, 10)) {
      const sev = String(a.severity || "LOW")
      const score = Number(a.total_score || 0).toFixed(1)
      t.push(`ALERT ${sev} - ${a.src_host} -> ${a.domain} | score ${score}`)
      const reason = Array.isArray(a.reasons) ? a.reasons[0] : null
      if (reason) t.push(reason)
    }
    if (!t.length) t.push("No alerts yet - pipeline running")
    return t
  }, [alerts])

  const tickerStr = tickers.join(" ◆ ")
  const highAlerts = (alerts || []).filter((a) => String(a.severity || "").toUpperCase() === "HIGH").slice(0, 3)

  const threatLevel =
    summary?.alerts_high > 0 ? "HIGH" : summary?.alerts_medium > 0 ? "MEDIUM" : summary?.alerts_low > 0 ? "LOW" : "NONE"

  const cards = [
    {
      icon: <Activity size={18} />,
      title: "Beaconing Detection",
      color: T.r,
      desc: "Temporal periodicity and inter-arrival CV identify C2 callback behavior.",
      stat: summary?.alerts_high || 0,
      statLabel: "HIGH alerts",
    },
    {
      icon: <Database size={18} />,
      title: "Exfiltration Signals",
      color: T.o,
      desc: "Entropy, query length, TXT ratios, and subdomain uniqueness catch tunneling patterns.",
      stat: summary?.queries_suspicious || 0,
      statLabel: "suspicious queries",
    },
    {
      icon: <Network size={18} />,
      title: "DGA Sweep Detection",
      color: T.y,
      desc: "High NXDOMAIN + random labels + host concentration indicate generated-domain probing.",
      stat: summary?.unique_hosts || 0,
      statLabel: "hosts tracked",
    },
    {
      icon: <Brain size={18} />,
      title: "ML Classification",
      color: T.b,
      desc: "Model confidence combines with rule/behavior engines for explainable threat scoring.",
      stat: summary?.tests_passed || 0,
      statLabel: "tests passing",
    },
  ]

  return (
    <div style={{ color: T.txt, background: T.bg, minHeight: "100vh" }}>
      <Nav
        page="landing"
        onNavigate={onNavigate}
        liveQueries={summary?.queries_total || 0}
        lifetimeQueries={summary?.queries_lifetime || 0}
        mode={summary?.mode || "DEMO_FEED"}
        threatLevel={threatLevel}
        highAlerts={summary?.alerts_high || 0}
        totalAlerts={summary?.alerts_total || 0}
      />

      <section style={{ position: "relative", height: "calc(100vh - 48px)", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.42 }}>
          <MatrixRain />
        </div>

        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            padding: "0 24px",
            textAlign: "center",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 14px",
              border: `1px solid ${T.g1}`,
              borderRadius: 2,
              fontSize: 11,
              color: T.g1,
              letterSpacing: ".22em",
              marginBottom: 24,
            }}
          >
            <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.g1 }} />
            SYSTEM ACTIVE - {summary?.mode || "DEMO_FEED"}
          </span>

          <h1
            className="glitch"
            style={{
              fontSize: "clamp(52px, 11vw, 100px)",
              fontWeight: 900,
              color: T.g1,
              letterSpacing: ".18em",
              lineHeight: 1,
              marginBottom: 12,
            }}
          >
            SENTINEL
          </h1>

          <p style={{ maxWidth: 680, fontSize: 13, color: T.muted, lineHeight: 1.9, marginBottom: 42 }}>
            DNS IDS prototype with rule, behavior, and ML scoring wired to API-backed live dashboard panels.
          </p>

          <div style={{ display: "flex", gap: 56, marginBottom: 40, flexWrap: "wrap", justifyContent: "center" }}>
            <div>
              <div style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 900, color: T.r }}>{displayAlerts}</div>
              <div style={{ fontSize: 9, color: T.muted, letterSpacing: ".18em", marginTop: 6 }}>ALERTS RAISED</div>
            </div>
            <div>
              <div style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 900, color: T.g1 }}>{displayQueries.toLocaleString()}</div>
              <div style={{ fontSize: 9, color: T.muted, letterSpacing: ".18em", marginTop: 6 }}>QUERIES INGESTED (LIFETIME)</div>
            </div>
            <div>
              <div style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 900, color: T.b }}>
                {displayTests}/{summary?.tests_total || 0}
              </div>
              <div style={{ fontSize: 9, color: T.muted, letterSpacing: ".18em", marginTop: 6 }}>TESTS PASSING</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={() => onNavigate("dashboard")}
              style={{
                padding: "13px 36px",
                background: T.g1,
                border: "none",
                borderRadius: 3,
                color: T.bg,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: ".12em",
                cursor: "pointer",
              }}
            >
              LIVE DASHBOARD
            </button>
            <button
              onClick={() => onNavigate("architecture")}
              style={{
                padding: "13px 36px",
                background: "transparent",
                border: `1px solid ${T.g1}`,
                borderRadius: 3,
                color: T.g1,
                fontFamily: "inherit",
                fontSize: 13,
                cursor: "pointer",
                letterSpacing: ".12em",
              }}
            >
              ARCHITECTURE
            </button>
            <button
              onClick={() => setTourOpen(true)}
              style={{
                padding: "13px 24px",
                background: "transparent",
                border: `1px solid ${T.b}`,
                borderRadius: 3,
                color: T.b,
                fontFamily: "inherit",
                fontSize: 13,
                cursor: "pointer",
                letterSpacing: ".12em",
              }}
            >
              GUIDED TOUR
            </button>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: `${T.g1}12`,
            borderTop: `1px solid ${T.g1}2a`,
            padding: "9px 24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ color: T.g1, fontSize: 10, letterSpacing: ".15em", minWidth: 95 }}>LIVE FEED</span>
            <div style={{ overflow: "hidden", flex: 1 }}>
              <span style={{ color: T.txt, fontSize: 11, display: "inline-block", whiteSpace: "nowrap", animation: "marquee 28s linear infinite" }}>
                {tickerStr}&nbsp;&nbsp;&nbsp;{tickerStr}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div style={{ width: "100%", height: 1, background: `linear-gradient(90deg, transparent, ${T.g4}, transparent)` }} />

      <section style={{ padding: "44px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: T.g3, letterSpacing: ".35em", marginBottom: 8 }}>THREAT COVERAGE</div>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", color: T.txt, letterSpacing: ".1em" }}>WHAT WE DETECT</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          {cards.map(({ icon, title, color, desc, stat, statLabel }) => (
            <div key={title} style={{ padding: 20, background: T.s1, border: `1px solid ${T.brd}`, borderTop: `2px solid ${color}`, borderRadius: 4 }}>
              <div style={{ color, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontSize: 13, color: T.txt, letterSpacing: ".08em", marginBottom: 8, fontWeight: 700 }}>{title}</div>
              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.7 }}>{desc}</div>
              <div style={{ height: 1, margin: "10px 0", background: T.brd }} />
              <div style={{ fontSize: 20, fontWeight: 700, color }}>{Number(stat || 0).toLocaleString()}</div>
              <div style={{ fontSize: 9, color: T.muted, letterSpacing: ".15em", marginTop: 2 }}>{statLabel}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ width: "100%", height: 1, background: `linear-gradient(90deg, transparent, ${T.g4}, transparent)` }} />

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "44px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: T.r, letterSpacing: ".3em" }}>LATEST HIGH SEVERITY ALERTS</div>
          <button className="nav-btn" onClick={() => onNavigate("dashboard")} style={{ marginLeft: "auto", color: T.r, borderColor: `${T.r}66` }}>
            VIEW ALL →
          </button>
        </div>

        {highAlerts.length === 0 ? (
          <div style={{ color: T.muted, fontSize: 12, padding: "20px 0" }}>No HIGH alerts active. System nominal.</div>
        ) : (
          highAlerts.map((a) => (
            <div
              key={a.alert_id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                marginBottom: 6,
                background: T.s1,
                border: `1px solid ${T.r}22`,
                borderLeft: `3px solid ${T.r}`,
                borderRadius: 3,
              }}
            >
              <span style={{ color: T.r, fontSize: 10, minWidth: 50 }}>[HIGH]</span>
              <span style={{ color: T.txt, fontSize: 11, flex: 1 }}>
                {a.src_host} → {a.domain}
              </span>
              <span style={{ color: T.r, fontSize: 14, fontWeight: 700 }}>{Number(a.total_score || 0).toFixed(0)}</span>
              <span style={{ color: T.muted, fontSize: 9 }}>{fmtShortTime(a.timestamp)}</span>
            </div>
          ))
        )}
      </section>

      <OnboardingTour
        open={tourOpen}
        onNavigate={onNavigate}
        onClose={() => {
          setTourOpen(false)
          try {
            localStorage.setItem("sentinel_tour_seen_v1", "1")
          } catch (_) {}
        }}
      />
    </div>
  )
}
