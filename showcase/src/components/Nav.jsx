import { Shield } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { T } from "../styles/theme"

function ModeLabel({ mode }) {
  const isLive = mode === "LIVE_CAPTURE"
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 2,
        fontSize: 9,
        letterSpacing: ".15em",
        background: isLive ? `${T.r}18` : `${T.g4}40`,
        border: `1px solid ${isLive ? T.r : T.g4}`,
        color: isLive ? T.r : T.muted,
      }}
    >
      {isLive ? "LIVE CAPTURE" : "DEMO FEED"}
    </span>
  )
}

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span style={{ color: T.muted, fontSize: 10, letterSpacing: ".08em" }}>
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  )
}

function ThreatPill({ level = "NONE" }) {
  const styles = {
    HIGH: { border: T.r, bg: `${T.r}18`, text: T.r, dot: T.r },
    MEDIUM: { border: T.o, bg: `${T.o}14`, text: T.o, dot: T.o },
    LOW: { border: T.g2, bg: `${T.g2}14`, text: T.g2, dot: T.g2 },
    NONE: { border: T.g4, bg: "transparent", text: T.muted, dot: T.g4 },
  }
  const s = styles[level] || styles.NONE
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 3,
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.text,
        fontSize: 10,
        letterSpacing: ".15em",
      }}
    >
      {level !== "NONE" ? (
        <span
          className="pulse-dot"
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: s.dot,
            display: "inline-block",
            marginRight: 6,
          }}
        />
      ) : null}
      THREAT: {level}
    </span>
  )
}

function navBtnStyle(active) {
  return active ? { borderColor: T.g1, color: T.g1, background: `${T.g1}12` } : undefined
}

export default function Nav({
  page,
  onNavigate,
  liveQueries = 0,
  lifetimeQueries = 0,
  mode = "DEMO_FEED",
  highAlerts = 0,
  totalAlerts = 0,
  threatLevel = "NONE",
}) {
  const queryText = useMemo(() => `${(liveQueries || 0).toLocaleString()} queries`, [liveQueries])

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        padding: "11px 24px",
        display: "flex",
        alignItems: "center",
        background: `${T.s1}f0`,
        borderBottom: `1px solid ${T.brd}`,
        backdropFilter: "blur(12px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {page !== "landing" ? (
          <button className="nav-btn" onClick={() => onNavigate("landing")}>
            HOME
          </button>
        ) : null}
        <Shield size={17} color={T.g1} />
        <span style={{ color: T.g1, fontSize: 14, letterSpacing: ".22em", fontWeight: 700 }}>SENTINEL</span>
        <ThreatPill level={threatLevel} />
      </div>

      <div style={{ marginLeft: "auto", marginRight: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <ModeLabel mode={mode} />
        <Clock />
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.g1 }}>
          <span
            className="pulse-dot"
            style={{ width: 7, height: 7, borderRadius: "50%", background: T.g1, display: "inline-block" }}
          />
          {queryText}
        </span>
        <span style={{ fontSize: 10, color: T.muted }}>{(lifetimeQueries || 0).toLocaleString()} lifetime</span>
        {totalAlerts > 0 ? (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 3,
              fontSize: 10,
              border: `1px solid ${T.r}44`,
              background: `${T.r}18`,
              color: T.r,
              whiteSpace: "nowrap",
            }}
          >
            {highAlerts > 0 ? "🔴 " : ""}
            {totalAlerts} alerts
          </span>
        ) : null}

        <button className="nav-btn" onClick={() => onNavigate("dashboard")} style={navBtnStyle(page === "dashboard")}>
          DASHBOARD
        </button>
        <button
          className="nav-btn"
          onClick={() => onNavigate("architecture")}
          style={navBtnStyle(page === "architecture")}
        >
          ARCHITECTURE
        </button>
        <button className="nav-btn" onClick={() => onNavigate("model")} style={navBtnStyle(page === "model")}>
          MODEL
        </button>
      </div>
    </nav>
  )
}
