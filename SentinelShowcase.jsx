import { useState, useEffect, useRef } from "react"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import {
  Shield, AlertTriangle, Activity, Server, Network,
  Database, Lock, Radio, ChevronDown, ChevronRight,
  Terminal, Zap, Eye, Cpu,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
//  THEME
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg:     "#060c09",
  s1:     "#0a1510",
  s2:     "#0f1e14",
  s3:     "#142619",
  g1:     "#00ff41",
  g2:     "#00cc33",
  g3:     "#009922",
  g4:     "#1a4a25",
  r:      "#ff2244",
  o:      "#ff7700",
  b:      "#00aaff",
  y:      "#ffcc00",
  txt:    "#b8f0c8",
  muted:  "#4a7a5a",
  brd:    "#1a3323",
}

// ─────────────────────────────────────────────────────────────────────────────
//  GLOBAL CSS (injected once)
// ─────────────────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body, html { background: ${T.bg}; font-family: 'Share Tech Mono', 'Courier New', monospace; }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: ${T.s1}; }
  ::-webkit-scrollbar-thumb { background: ${T.g4}; border-radius: 3px; }

  @keyframes glitch {
    0%, 88%, 100% { clip-path: none; transform: none; color: ${T.g1}; }
    89% { clip-path: polygon(0 22%, 100% 22%, 100% 38%, 0 38%); transform: translate(-4px, 2px); color: ${T.r}; }
    90% { clip-path: polygon(0 62%, 100% 62%, 100% 76%, 0 76%); transform: translate(4px, -2px); color: #00aaff; }
    91% { clip-path: polygon(0 8%,  100% 8%,  100% 22%, 0 22%); transform: translate(-2px, 1px); color: ${T.g1}; }
    92% { clip-path: none; transform: none; color: ${T.g1}; }
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.35; transform: scale(0.75); }
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes scanline {
    0%   { transform: translateY(0); }
    100% { transform: translateY(100vh); }
  }

  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

  @keyframes flowDash {
    from { stroke-dashoffset: 24; }
    to   { stroke-dashoffset: 0; }
  }

  .glitch     { animation: glitch 9s infinite; }
  .pulse-dot  { animation: pulse-dot 1.8s ease-in-out infinite; }
  .blink      { animation: blink 1.1s step-end infinite; }
  .fade-up    { animation: fadeUp 0.5s ease both; }

  .nav-btn {
    background: transparent;
    border: 1px solid ${T.brd};
    color: ${T.muted};
    padding: 6px 14px;
    border-radius: 3px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    letter-spacing: .1em;
    transition: color .15s, border-color .15s;
  }
  .nav-btn:hover { color: ${T.g1}; border-color: ${T.g1}; }

  .module-node { cursor: pointer; transition: opacity .15s; }
  .module-node:hover rect { stroke-width: 2 !important; }
`

function injectCSS(css) {
  const el = document.createElement("style")
  el.textContent = css
  document.head.appendChild(el)
  return el
}

// ─────────────────────────────────────────────────────────────────────────────
//  DATA GENERATORS
// ─────────────────────────────────────────────────────────────────────────────
function genTrafficData(n = 22) {
  return Array.from({ length: n }, (_, i) => {
    const m = new Date(Date.now() - (n - i) * 60_000)
    return {
      t:          m.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
      normal:     Math.floor(7 + Math.random() * 13),
      suspicious: i < 7 ? 0 : Math.floor(3 + Math.random() * 15),
    }
  })
}

function genEntropyBins() {
  return Array.from({ length: 22 }, (_, i) => ({
    e:      (i * 0.22).toFixed(1),
    normal: i < 13 ? Math.floor(Math.exp(-((i - 6) ** 2) / 8) * 85 + Math.random() * 8) : Math.floor(Math.random() * 4),
    attack: i >= 10 ? Math.floor(Math.exp(-((i - 16) ** 2) / 5) * 65 + Math.random() * 7) : Math.floor(Math.random() * 3),
  }))
}

const ATTACK_TYPES = [
  { type: "Beaconing",     count: 28, color: T.r },
  { type: "DNS Tunneling", count: 22, color: T.o },
  { type: "DGA Scanning",  count: 15, color: T.y },
  { type: "Exfiltration",  count:  8, color: T.b },
]

const SEV_DATA = [
  { name: "HIGH",   value: 3,  color: T.r },
  { name: "MEDIUM", value: 3,  color: T.o },
  { name: "LOW",    value: 67, color: T.g2 },
]

const DEMO_ALERTS = [
  {
    id: "A7F2C1", host: "10.0.0.99", domain: "labdomain.internal",
    severity: "HIGH", score: 93, time: "14:32:07",
    queries: 43, uniqueSubs: 18, beaconing: true,
    reasons: [
      "[Rule R001] Abnormally long query (91 chars) — payload encoding",
      "[Rule R002] High subdomain entropy (4.21) — encoded data detected",
      "[Rule R003] Base64 pattern matched in subdomain label",
      "[Behavior] Regular C2 beacon every ~15s  |  beacon score: 0.94",
      "[Behavior] 18 unique subdomains → DNS tunneling confirmed",
      "[ML] XGBoost malicious probability: 91.3%  (threshold 75%)",
    ],
  },
  {
    id: "B3E9A2", host: "10.0.0.99", domain: "labdomain.internal",
    severity: "HIGH", score: 87, time: "14:38:19",
    queries: 31, uniqueSubs: 22, beaconing: false,
    reasons: [
      "[Rule R004] 22 unique subdomains — DNS tunneling signature",
      "[Rule R005] 68% NXDOMAIN rate — DGA domain scanning",
      "[Behavior] DGA sweep: 25 probed domains, all NXDOMAIN",
      "[ML] Malicious probability: 88.6%",
    ],
  },
  {
    id: "C1D4F7", host: "10.0.0.99", domain: "labdomain.internal",
    severity: "HIGH", score: 79, time: "14:45:52",
    queries: 19, uniqueSubs: 12, beaconing: false,
    reasons: [
      "[Rule R002] High entropy subdomain (4.05)",
      "[Rule R006] TXT query ratio 0.67 — data exfiltration abuse",
      "[Behavior] Est. ~1.4KB exfiltrated through DNS queries",
      "[ML] Malicious probability: 82.1%",
    ],
  },
]

const LOG_ROWS = [
  ["14:46:01","10.0.0.99",  "chunk17.dGhpcyBpcyBhIHNlY3JldA==.labdomain.internal","TXT","NXDOMAIN","ATTACK"],
  ["14:45:59","192.168.1.5","api.github.com",                                       "A",  "OK",      "NORMAL"],
  ["14:45:57","10.0.0.99",  "alive-host7.labdomain.internal",                       "A",  "NXDOMAIN","BEACON"],
  ["14:45:55","192.168.1.7","cdn.cloudflare.com",                                   "A",  "OK",      "NORMAL"],
  ["14:45:53","10.0.0.99",  "a8f9d2bc3e1a.labdomain.internal",                      "A",  "NXDOMAIN","DGA"],
  ["14:45:51","192.168.1.9","mail.google.com",                                      "MX", "OK",      "NORMAL"],
  ["14:45:49","10.0.0.99",  "chunk16.aGVsbG8gd29ybGQ=.labdomain.internal",          "TXT","NXDOMAIN","ATTACK"],
  ["14:45:47","192.168.1.5","www.reddit.com",                                       "A",  "OK",      "NORMAL"],
  ["14:45:45","10.0.0.99",  "9cd72ef1b04a.labdomain.internal",                      "A",  "NXDOMAIN","DGA"],
  ["14:45:43","192.168.1.11","static.twitter.com",                                  "A",  "OK",      "NORMAL"],
]

// ─────────────────────────────────────────────────────────────────────────────
//  TINY COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function Badge({ children, color = T.g1 }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 3,
      border: `1px solid ${color}`,
      color, fontSize: 10, letterSpacing: ".08em",
      background: `${color}18`,
    }}>
      {children}
    </span>
  )
}

function KPI({ label, value, color = T.g1, sub }) {
  return (
    <div style={{
      padding: "16px 20px", background: T.s2,
      border: `1px solid ${T.brd}`, borderTop: `2px solid ${color}`,
      borderRadius: 4,
    }}>
      <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".12em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function AlertCard({ alert, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const c = alert.severity === "HIGH" ? T.r : alert.severity === "MEDIUM" ? T.o : T.g2

  return (
    <div style={{
      border: `1px solid ${c}33`, borderLeft: `3px solid ${c}`,
      borderRadius: 4, marginBottom: 8, background: `${c}07`, overflow: "hidden",
    }}>
      <div onClick={() => setOpen(!open)} style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 14px", cursor: "pointer",
      }}>
        <span style={{ color: c, fontSize: 11, fontWeight: 700, minWidth: 64 }}>[{alert.severity}]</span>
        <span style={{ color: T.txt, fontSize: 12, flex: 1 }}>{alert.host} → {alert.domain}</span>
        <span style={{ color: c, fontSize: 15, fontWeight: 700 }}>{alert.score}/100</span>
        <span style={{ color: T.muted, fontSize: 11 }}>{alert.time}</span>
        {open
          ? <ChevronDown  size={13} color={T.muted} />
          : <ChevronRight size={13} color={T.muted} />
        }
      </div>

      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${c}1a` }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, margin: "12px 0" }}>
            {[["RISK", `${alert.score}/100`], ["QUERIES", alert.queries], ["SUBS", alert.uniqueSubs]].map(([k, v]) => (
              <div key={k} style={{
                padding: "8px 10px", background: T.s1, borderRadius: 3, border: `1px solid ${T.brd}`,
              }}>
                <div style={{ fontSize: 9, color: T.muted, letterSpacing: ".12em", marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: 20, color: c, fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>

          {alert.beaconing && (
            <div style={{
              padding: "8px 12px", marginBottom: 10, borderRadius: 3,
              background: `${T.o}12`, border: `1px solid ${T.o}44`,
              fontSize: 12, color: T.o,
            }}>
              ⏱  Beaconing detected — automated C2 check-in pattern
            </div>
          )}

          <div style={{ fontSize: 11, marginTop: 4 }}>
            <div style={{ fontSize: 9, color: T.g4, letterSpacing: ".2em", marginBottom: 6 }}>EVIDENCE</div>
            {alert.reasons.map((r, i) => {
              const col = r.startsWith("[ML]")
                ? T.b : r.includes("HIGH") || r.includes("R001") || r.includes("R002")
                ? T.r : r.startsWith("[Behavior]")
                ? T.o : T.txt
              return (
                <div key={i} style={{
                  padding: "5px 0", borderBottom: `1px solid ${T.brd}33`, color: col,
                }}>
                  › {r}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  MATRIX RAIN
// ─────────────────────────────────────────────────────────────────────────────
function MatrixRain() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    const chars = "01アイウエオカキクケコ01010101ABCDEF"
    let drops

    const init = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      const cols = Math.floor(canvas.width / 14)
      drops = Array(cols).fill(1)
    }
    init()

    const ro = new ResizeObserver(init)
    ro.observe(canvas)

    const id = setInterval(() => {
      ctx.fillStyle = "rgba(6,12,9,0.05)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = T.g1
      ctx.font = "12px monospace"
      drops.forEach((y, x) => {
        const ch = chars[Math.floor(Math.random() * chars.length)]
        ctx.globalAlpha = Math.random() > 0.92 ? 1 : 0.12
        ctx.fillText(ch, x * 14, y * 16)
        ctx.globalAlpha = 1
        if (y * 16 > canvas.height && Math.random() > 0.975) drops[x] = 0
        else drops[x]++
      })
    }, 50)

    return () => { clearInterval(id); ro.disconnect() }
  }, [])

  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />
}

// ─────────────────────────────────────────────────────────────────────────────
//  SHARED NAV
// ─────────────────────────────────────────────────────────────────────────────
function Nav({ page, onNavigate, live = false, queries }) {
  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      padding: "11px 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
      background: `${T.s1}f0`, borderBottom: `1px solid ${T.brd}`,
      backdropFilter: "blur(12px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {page !== "landing" && (
          <button className="nav-btn" onClick={() => onNavigate("landing")} style={{ padding: "5px 10px", marginRight: 4 }}>
            ← HOME
          </button>
        )}
        <Shield size={17} color={T.g1} />
        <span style={{ color: T.g1, fontSize: 14, letterSpacing: ".22em", fontWeight: 700 }}>SENTINEL</span>
        <span style={{ color: T.muted, fontSize: 11 }}>
          / DNS-IDS v1.0 /
          {page === "landing" && " HOME"}
          {page === "dashboard" && " SOC DASHBOARD"}
          {page === "architecture" && " ARCHITECTURE"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {live && (
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.g1 }}>
            <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: T.g1, display: "inline-block" }} />
            LIVE — {queries?.toLocaleString()} analyzed
          </span>
        )}
        {page !== "dashboard"    && <button className="nav-btn" onClick={() => onNavigate("dashboard")}>DASHBOARD</button>}
        {page !== "architecture" && <button className="nav-btn" onClick={() => onNavigate("architecture")}>ARCHITECTURE</button>}
      </div>
    </nav>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  PAGE 1 — LANDING
// ─────────────────────────────────────────────────────────────────────────────
function LandingPage({ onNavigate }) {
  const [alertN,  setAlertN]  = useState(0)
  const [queryN,  setQueryN]  = useState(0)
  const [tickIdx, setTickIdx] = useState(0)

  const TICKERS = [
    "⚠  HIGH ALERT — 10.0.0.99 → labdomain.internal  |  SCORE 93/100  |  BEACONING DETECTED",
    "✓  Rule R002 triggered: subdomain entropy 4.21  — encoded payload identified",
    "✓  Behavior engine: regular C2 check-in every ~15s  |  beacon score 0.94",
    "⚠  HIGH ALERT — DNS tunneling confirmed  |  18 unique subdomains  |  ~1.4KB exfiltrated",
    "✓  ML classifier: XGBoost confidence 91.3% malicious  (threshold 75%)",
    "✓  DGA sweep: 25 generated domains probed  |  68% NXDOMAIN rate",
  ]
  const tickerCount = TICKERS.length

  useEffect(() => {
    const t1 = setInterval(() => setAlertN(n  => Math.min(n + 1,  73)),    35)
    const t2 = setInterval(() => setQueryN(n  => Math.min(n + 37, 4847)),  12)
    const t3 = setInterval(() => setTickIdx(i => (i + 1) % tickerCount), 4000)
    return () => [t1, t2, t3].forEach(clearInterval)
  }, [tickerCount])

  const DETECTION_CARDS = [
    { icon: <Radio size={20} />,   title: "C2 Beaconing",    color: T.r, desc: "Detects malware check-ins using inter-arrival time variance and coefficient of variation. Scores regularity 0–1." },
    { icon: <Database size={20} />,title: "DNS Tunneling",    color: T.o, desc: "Shannon entropy analysis on subdomain labels catches Base64 and hex-encoded payloads hidden in query names." },
    { icon: <Zap size={20} />,     title: "DGA Scanning",     color: T.y, desc: "NXDOMAIN rate monitoring exposes Domain Generation Algorithm sweeps where malware probes for its C2 server." },
    { icon: <Lock size={20} />,    title: "Data Exfiltration",color: T.b, desc: "Estimates bytes leaving through DNS by tracking unique high-entropy subdomains and TXT record abuse patterns." },
  ]

  const LAYERS = [
    { n: "01", name: "Rule Engine",     col: T.g1, desc: "8 deterministic heuristics. Instant catches on query length, entropy, Base64, DGA rate, TXT abuse." },
    { n: "02", name: "Behavior Engine", col: T.o,  desc: "Temporal pattern analysis over 60s windows. Beaconing, tunneling volume, DGA sweeps." },
    { n: "03", name: "ML Classifier",   col: T.b,  desc: "XGBoost on 19 features. 5-fold CV F1 > 93%. Catches subtle multi-signal cases rules miss." },
  ]

  const STATS = [
    { label: "DNS QUERIES ANALYZED", val: queryN.toLocaleString(), color: T.g1 },
    { label: "ALERTS RAISED",        val: alertN,                  color: T.r  },
    { label: "TESTS PASSING",        val: "18 / 18",               color: T.b  },
  ]

  return (
    <div style={{ fontFamily: "monospace", color: T.txt, background: T.bg, minHeight: "100vh" }}>
      <Nav page="landing" onNavigate={onNavigate} />

      {/* ── HERO ── */}
      <section style={{ position: "relative", height: "calc(100vh - 48px)", overflow: "hidden" }}>
        {/* matrix rain bg */}
        <div style={{ position: "absolute", inset: 0, opacity: .22 }}>
          <MatrixRain />
        </div>
        {/* scanlines */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,.04) 2px, rgba(0,0,0,.04) 4px)",
        }} />
        {/* vignette */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `radial-gradient(ellipse at center, transparent 40%, ${T.bg}cc 100%)`,
        }} />

        {/* content */}
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          height: "100%", padding: "0 24px", textAlign: "center",
        }}>
          {/* STATUS BADGE */}
          <div style={{ marginBottom: 24 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "5px 14px", border: `1px solid ${T.g1}`,
              borderRadius: 2, fontSize: 11, color: T.g1, letterSpacing: ".22em",
            }}>
              <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.g1, display: "inline-block" }} />
              SYSTEM ACTIVE  —  MONITORING DNS TRAFFIC
            </span>
          </div>

          {/* TITLE */}
          <h1 className="glitch" style={{
            fontSize: "clamp(52px, 11vw, 100px)",
            fontWeight: 900, color: T.g1, letterSpacing: ".18em", lineHeight: 1,
            textShadow: `0 0 60px ${T.g1}33`,
            marginBottom: 12,
          }}>
            SENTINEL
          </h1>

          <div style={{ fontSize: 11, color: T.muted, letterSpacing: ".4em", marginBottom: 12 }}>
            ──────────────────────────────────────────────────
          </div>

          <p style={{ fontSize: "clamp(11px, 1.8vw, 15px)", color: T.txt, letterSpacing: ".22em", marginBottom: 36, opacity: .9 }}>
            DNS INTRUSION DETECTION SYSTEM
          </p>

          <p style={{ maxWidth: 560, fontSize: 13, color: T.muted, lineHeight: 1.9, marginBottom: 52 }}>
            Hybrid three-layer detection framework — rule engine + behavioral analysis + ML classifier —
            designed to catch covert command-and-control communication hiding inside DNS traffic.
          </p>

          {/* LIVE COUNTERS */}
          <div style={{ display: "flex", gap: 56, marginBottom: 48, flexWrap: "wrap", justifyContent: "center" }}>
            {STATS.map(({ label, val, color }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: 9, color: T.muted, letterSpacing: ".18em", marginTop: 6 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <button onClick={() => onNavigate("dashboard")} style={{
              padding: "13px 36px", background: T.g1,
              border: "none", borderRadius: 3, color: T.bg,
              fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              letterSpacing: ".12em", cursor: "pointer",
            }}>
              LIVE DASHBOARD →
            </button>
            <button onClick={() => onNavigate("architecture")} style={{
              padding: "13px 36px", background: "transparent",
              border: `1px solid ${T.g1}`, borderRadius: 3, color: T.g1,
              fontFamily: "inherit", fontSize: 13, cursor: "pointer", letterSpacing: ".12em",
            }}>
              ARCHITECTURE
            </button>
          </div>
        </div>

        {/* LIVE TICKER */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: `${T.g1}12`, borderTop: `1px solid ${T.g1}2a`,
          padding: "9px 24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 9, color: T.g1, letterSpacing: ".25em", whiteSpace: "nowrap" }}>LIVE FEED</span>
            <span style={{ color: T.brd }}>│</span>
            <span key={tickIdx} className="fade-up" style={{ fontSize: 12, color: T.txt }}>
              {TICKERS[tickIdx]}
            </span>
          </div>
        </div>
      </section>

      {/* ── WHAT WE DETECT ── */}
      <section style={{ padding: "88px 40px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div style={{ fontSize: 10, color: T.g3, letterSpacing: ".35em", marginBottom: 10 }}>THREAT COVERAGE</div>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 34px)", color: T.txt, letterSpacing: ".1em" }}>WHAT WE DETECT</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {DETECTION_CARDS.map(({ icon, title, color, desc }) => (
            <div key={title} style={{
              padding: 26, background: T.s1,
              border: `1px solid ${T.brd}`, borderTop: `2px solid ${color}`,
              borderRadius: 4, transition: "transform .2s",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-5px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
            >
              <div style={{ color, marginBottom: 14 }}>{icon}</div>
              <div style={{ fontSize: 13, color: T.txt, letterSpacing: ".08em", marginBottom: 10, fontWeight: 700 }}>{title}</div>
              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.8 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── THREE LAYERS ── */}
      <section style={{
        padding: "72px 40px",
        background: T.s1, borderTop: `1px solid ${T.brd}`, borderBottom: `1px solid ${T.brd}`,
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{ fontSize: 10, color: T.g3, letterSpacing: ".35em", marginBottom: 10 }}>DETECTION METHODOLOGY</div>
            <h2 style={{ fontSize: "clamp(22px, 4vw, 34px)", color: T.txt, letterSpacing: ".1em" }}>THREE LAYERS OF DEFENSE</h2>
          </div>
          <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
            {LAYERS.map(({ n, name, col, desc }, i) => (
              <div key={n} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <div style={{
                  flex: 1, padding: 28, background: T.s2,
                  border: `1px solid ${T.brd}`, borderRadius: 4,
                }}>
                  <div style={{ fontSize: 36, color: col, fontWeight: 900, opacity: .35, marginBottom: 10 }}>{n}</div>
                  <div style={{ fontSize: 14, color: T.txt, fontWeight: 700, letterSpacing: ".06em", marginBottom: 10 }}>{name}</div>
                  <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.8 }}>{desc}</div>
                </div>
                {i < LAYERS.length - 1 && (
                  <div style={{ padding: "0 14px", color: T.g4, fontSize: 22 }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: "88px 40px", textAlign: "center" }}>
        <h2 style={{ fontSize: 26, color: T.txt, letterSpacing: ".1em", marginBottom: 14 }}>
          SEE IT IN ACTION
        </h2>
        <p style={{ fontSize: 13, color: T.muted, marginBottom: 36, maxWidth: 480, margin: "0 auto 36px" }}>
          SOC dashboard with live alert feed, entropy visualization, beaconing detection, and full evidence trail.
        </p>
        <button onClick={() => onNavigate("dashboard")} style={{
          padding: "14px 44px", background: T.g1,
          border: "none", borderRadius: 3, color: T.bg,
          fontFamily: "inherit", fontSize: 13, fontWeight: 700,
          letterSpacing: ".12em", cursor: "pointer",
        }}>
          OPEN LIVE DASHBOARD →
        </button>
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  PAGE 2 — SOC DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function DashboardPage({ onNavigate }) {
  const [traffic]  = useState(() => genTrafficData(22))
  const [entropy]  = useState(() => genEntropyBins())
  const [queries,   setQueries]  = useState(4847)

  useEffect(() => {
    const id = setInterval(() => setQueries(q => q + Math.floor(Math.random() * 4 + 1)), 1800)
    return () => clearInterval(id)
  }, [])

  const TT = { background: T.s2, border: `1px solid ${T.brd}`, borderRadius: 4, fontFamily: "monospace", fontSize: 11, color: T.txt }

  return (
    <div style={{ fontFamily: "monospace", color: T.txt, background: T.bg, minHeight: "100vh" }}>
      <Nav page="dashboard" onNavigate={onNavigate} live queries={queries} />

      <div style={{ padding: "22px 28px" }}>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
          <KPI label="TOTAL QUERIES"     value={queries.toLocaleString()} color={T.g1} />
          <KPI label="SUSPICIOUS"        value="243"  color={T.o} sub="5.0% of total" />
          <KPI label="ALERTS RAISED"     value="73"   color={T.r} />
          <KPI label="HIGH SEVERITY"     value="3"    color={T.r} sub="immediate action" />
          <KPI label="COMPROMISED HOSTS" value="1"    color={T.r} sub="10.0.0.99" />
        </div>

        {/* ROW 1: Traffic + Severity */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>

          <div style={{ background: T.s1, border: `1px solid ${T.brd}`, borderRadius: 4, padding: 18 }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".16em", marginBottom: 14 }}>DNS TRAFFIC OVER TIME</div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={traffic}>
                <defs>
                  <linearGradient id="gn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={T.g2} stopOpacity={.35} />
                    <stop offset="95%" stopColor={T.g2} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={T.r} stopOpacity={.35} />
                    <stop offset="95%" stopColor={T.r} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.brd} />
                <XAxis dataKey="t" tick={{ fill: T.muted, fontSize: 9 }} stroke={T.brd} />
                <YAxis tick={{ fill: T.muted, fontSize: 9 }} stroke={T.brd} />
                <Tooltip contentStyle={TT} />
                <Area type="monotone" dataKey="normal"     stroke={T.g2} fill="url(#gn)" strokeWidth={2} name="Normal" />
                <Area type="monotone" dataKey="suspicious" stroke={T.r}  fill="url(#gs)" strokeWidth={2} name="Suspicious" />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
              {[["Normal", T.g2], ["Suspicious", T.r]].map(([l, c]) => (
                <span key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.muted }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: "inline-block" }} />{l}
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: T.s1, border: `1px solid ${T.brd}`, borderRadius: 4, padding: 18 }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".16em", marginBottom: 14 }}>ALERT SEVERITY</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={SEV_DATA} cx="50%" cy="50%" innerRadius={52} outerRadius={78} dataKey="value" paddingAngle={3}>
                  {SEV_DATA.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={TT} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {SEV_DATA.map(({ name, value, color }) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, color: T.muted }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }} />
                    {name}
                  </span>
                  <span style={{ color, fontWeight: 700 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ROW 2: Entropy + Attack types */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

          <div style={{ background: T.s1, border: `1px solid ${T.brd}`, borderRadius: 4, padding: 18 }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".16em", marginBottom: 4 }}>SUBDOMAIN ENTROPY DISTRIBUTION</div>
            <div style={{ fontSize: 10, color: T.g4, marginBottom: 14 }}>High entropy = encoded/encrypted payload hidden in query</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={entropy} barSize={5}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.brd} />
                <XAxis dataKey="e" tick={{ fill: T.muted, fontSize: 9 }} stroke={T.brd} interval={3} />
                <YAxis tick={{ fill: T.muted, fontSize: 9 }} stroke={T.brd} />
                <Tooltip contentStyle={TT} />
                <Bar dataKey="normal" fill={T.g3} name="Normal" opacity={.85} />
                <Bar dataKey="attack" fill={T.r}  name="Attack" opacity={.85} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
              {[["Normal", T.g3], ["Attack", T.r]].map(([l, c]) => (
                <span key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.muted }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: "inline-block" }} />{l}
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: T.s1, border: `1px solid ${T.brd}`, borderRadius: 4, padding: 18 }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".16em", marginBottom: 14 }}>ATTACK TYPE BREAKDOWN</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ATTACK_TYPES} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.brd} horizontal={false} />
                <XAxis type="number"   tick={{ fill: T.muted, fontSize: 10 }} stroke={T.brd} />
                <YAxis type="category" dataKey="type" tick={{ fill: T.txt, fontSize: 11 }} stroke={T.brd} width={105} />
                <Tooltip contentStyle={TT} />
                <Bar dataKey="count" name="Detections">
                  {ATTACK_TYPES.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ALERTS */}
        <div style={{ background: T.s1, border: `1px solid ${T.brd}`, borderRadius: 4, padding: 18, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".16em" }}>
              ACTIVE ALERTS — 73 total
            </div>
            <Badge color={T.r}>3 HIGH</Badge>
          </div>
          {DEMO_ALERTS.map((a, i) => <AlertCard key={a.id} alert={a} defaultOpen={i === 0} />)}
        </div>

        {/* DNS LOG */}
        <div style={{ background: T.s1, border: `1px solid ${T.brd}`, borderRadius: 4, padding: 18 }}>
          <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".16em", marginBottom: 12 }}>LIVE DNS QUERY LOG</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.brd}` }}>
                  {["TIME", "SRC IP", "QUERY NAME", "TYPE", "RCODE", "STATUS"].map(h => (
                    <th key={h} style={{ padding: "5px 10px", textAlign: "left", color: T.muted, fontSize: 9, letterSpacing: ".15em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LOG_ROWS.map(([t, ip, q, type, rcode, status], i) => {
                  const bad = status !== "NORMAL"
                  const sc  = status === "ATTACK" ? T.r : status === "BEACON" ? T.o : status === "DGA" ? T.y : T.g3
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.brd}22`, background: bad ? `${sc}07` : "transparent" }}>
                      <td style={{ padding: "7px 10px", color: T.muted, whiteSpace: "nowrap" }}>{t}</td>
                      <td style={{ padding: "7px 10px", color: bad ? sc : T.muted, whiteSpace: "nowrap" }}>{ip}</td>
                      <td style={{ padding: "7px 10px", color: bad ? sc : T.txt, maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q}</td>
                      <td style={{ padding: "7px 10px", color: T.muted }}>{type}</td>
                      <td style={{ padding: "7px 10px", color: rcode === "NXDOMAIN" ? T.r : T.g3 }}>{rcode}</td>
                      <td style={{ padding: "7px 10px" }}><Badge color={sc}>{status}</Badge></td>
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

// ─────────────────────────────────────────────────────────────────────────────
//  PAGE 3 — ARCHITECTURE
// ─────────────────────────────────────────────────────────────────────────────
function ArchitecturePage({ onNavigate }) {
  const [selected, setSelected] = useState(null)

  const MODULES = [
    {
      id: "sim",   x: 40,   y: 110, label: "TRAFFIC SIM",   icon: <Terminal  size={14} />, color: T.g1,
      title: "Traffic Simulator",
      detail: "Generates both normal DNS traffic (top-1000 domains, irregular human timing) and four covert attack modes: beaconing at configurable intervals with jitter, Base64-encoded exfil chunk queries, DGA-style random domain scanning, and full combined attack sessions.",
      files: ["lab/normal_traffic.py", "lab/attack_simulator.py"],
      stats: ["4 attack modes (beacon/exfil/dga/full)", "Configurable beacon interval", "Jitter ±1s on beacon timing"],
    },
    {
      id: "cap",   x: 40,   y: 290, label: "CAPTURE",       icon: <Network   size={14} />, color: T.b,
      title: "Packet Capture",
      detail: "Scapy live sniffer on UDP port 53 captures all DNS queries. Extracts: timestamp, src_ip, dst_ip, query_name, query_type, rcode, transaction_id. Also supports offline .pcap parsing via pyshark for replaying or analyzing captured sessions.",
      files: ["capture/sniffer.py", "capture/pcap_reader.py"],
      stats: ["Scapy + pyshark", "Live + .pcap offline modes", "CSV flush every 100 packets"],
    },
    {
      id: "feat",  x: 310,  y: 200, label: "FEATURES",      icon: <Cpu       size={14} />, color: T.y,
      title: "Feature Extraction",
      detail: "19 security-relevant features across three modules: Lexical (Shannon entropy, Base64 detection, hex ratio, consonant-vowel ratio), Temporal (inter-arrival time CV, beacon score, query rate), and Session (unique subdomains per domain, NXDOMAIN rate, TXT query ratio).",
      files: ["features/lexical.py", "features/temporal.py", "features/session.py", "features/feature_pipeline.py"],
      stats: ["19 features per session", "Shannon entropy scoring", "Beacon CV detection"],
    },
    {
      id: "rule",  x: 570,  y: 80,  label: "RULE ENGINE",   icon: <Eye       size={14} />, color: T.r,
      title: "Rule Engine",
      detail: "8 deterministic heuristics with configurable YAML thresholds. Each rule maps to a known attack indicator and attaches evidence (actual value vs threshold). Produces HIGH/MEDIUM/LOW violations that feed directly into the threat scorer.",
      files: ["detection/rule_engine.py"],
      stats: ["8 rules (R001–R008)", "HIGH / MEDIUM / LOW severity", "Evidence dict per violation"],
    },
    {
      id: "beh",   x: 570,  y: 240, label: "BEHAVIOR",      icon: <Activity  size={14} />, color: T.o,
      title: "Behavior Engine",
      detail: "Detects sustained multi-query behavioral patterns over time windows: beaconing (low inter-arrival time CV), single-host domain concentration, DNS exfil volume estimation, DGA sweeps (high NXDOMAIN + high unique subdomains), and after-hours activity spikes.",
      files: ["detection/behavior_engine.py"],
      stats: ["5 behavioral flags", "IAT coefficient of variation", "Exfil byte estimation"],
    },
    {
      id: "ml",    x: 570,  y: 400, label: "ML MODEL",      icon: <Database  size={14} />, color: T.b,
      title: "ML Classifier",
      detail: "XGBoost trained on 10,000 synthetic + public dataset samples with SMOTE oversampling for class balance. Top features: subdomain_entropy, beacon_score, query_length, iat_cv, is_beaconing. 5-fold stratified CV F1 > 93%. All 18 tests passing.",
      files: ["detection/ml_model.py", "models/train.py", "models/evaluate.py"],
      stats: ["XGBoost + RandomForest ensemble", "F1 > 93%  —  18/18 tests pass", "Threshold 0.75 (configurable)"],
    },
    {
      id: "score", x: 820,  y: 240, label: "THREAT SCORER", icon: <Zap       size={14} />, color: T.r,
      title: "Threat Scorer",
      detail: "Fuses all three detection layers into a 0–100 score: Rule layer (max 40pts: HIGH=15, MED=8, LOW=3) + Behavior layer (max 35pts: beacon=20, concentration=8, tunnel=10) + ML layer (max 25pts: ml_score × 25). HIGH ≥ 70, MEDIUM ≥ 40.",
      files: ["scoring/threat_scorer.py"],
      stats: ["0–100 composite score", "3-layer fusion", "HIGH ≥ 70  /  MEDIUM ≥ 40"],
    },
    {
      id: "alert", x: 1030, y: 110, label: "ALERTS",        icon: <AlertTriangle size={14} />, color: T.r,
      title: "Alert Engine",
      detail: "Generates structured explainable alerts with full evidence chains (rule violations + behavioral flags + ML score). Persists to SQLite. Current DB: 73 total alerts — 3 HIGH at score 93/100 for host 10.0.0.99. Each alert has alert_id, timestamp, reasons list.",
      files: ["alerts/alert_engine.py"],
      stats: ["73 alerts in DB", "3 HIGH  /  3 MEDIUM  /  67 LOW", "SQLite persistent store"],
    },
    {
      id: "dash",  x: 1030, y: 330, label: "DASHBOARD",     icon: <Server    size={14} />, color: T.g1,
      title: "Dashboard",
      detail: "Streamlit SOC dashboard running on :8501. Sections: live traffic timeline (normal vs suspicious), entropy histogram, severity pie, attack type bar chart, expandable alert cards with full evidence, raw DNS query log. Auto-refreshes every 30s via st.rerun().",
      files: ["dashboard/app.py", "dashboard/components/beacon_chart.py"],
      stats: ["Streamlit + Plotly", "Port :8501 active", "30s auto-refresh"],
    },
  ]

  const ARROWS = [
    ["sim",  "cap"],  ["sim",  "feat"],
    ["cap",  "feat"],
    ["feat", "rule"], ["feat", "beh"], ["feat", "ml"],
    ["rule", "score"],["beh",  "score"],["ml", "score"],
    ["score","alert"],["score","dash"],
    ["alert","dash"],
  ]

  const ctr = (id) => {
    const m = MODULES.find(m => m.id === id)
    return m ? { x: m.x + 70, y: m.y + 22 } : null
  }

  const sel = MODULES.find(m => m.id === selected)
  const W = 1200, H = 530

  return (
    <div style={{ fontFamily: "monospace", color: T.txt, background: T.bg, minHeight: "100vh" }}>
      <Nav page="architecture" onNavigate={onNavigate} />

      <div style={{ padding: "28px 28px" }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, color: T.g3, letterSpacing: ".35em", marginBottom: 8 }}>SYSTEM PIPELINE — 9 MODULES IMPLEMENTED</div>
          <h2 style={{ fontSize: 22, color: T.txt, letterSpacing: ".1em", marginBottom: 4 }}>DETECTION ARCHITECTURE</h2>
          <p style={{ fontSize: 11, color: T.muted }}>Click any node to inspect implementation details, files, and stats.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 320px" : "1fr", gap: 18, marginBottom: 20 }}>

          {/* SVG PIPELINE */}
          <div style={{ background: T.s1, border: `1px solid ${T.brd}`, borderRadius: 4, overflow: "auto" }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 700, height: "auto", display: "block" }}>
              <defs>
                <marker id="arr" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
                  <polygon points="0 0, 7 2.5, 0 5" fill={T.g4} />
                </marker>
                <marker id="arr-hi" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
                  <polygon points="0 0, 7 2.5, 0 5" fill={T.g1} />
                </marker>
              </defs>

              {/* COLUMN HEADERS */}
              {[
                { x: 40,   label: "INPUT" },
                { x: 310,  label: "EXTRACT" },
                { x: 570,  label: "DETECT" },
                { x: 820,  label: "SCORE" },
                { x: 1030, label: "OUTPUT" },
              ].map(({ x, label }) => (
                <text key={label} x={x + 70} y={28} textAnchor="middle"
                  fill={T.g4} fontSize="9" letterSpacing="2" fontFamily="monospace">{label}</text>
              ))}

              {/* COLUMN DIVIDERS */}
              {[220, 480, 740, 960].map(x => (
                <line key={x} x1={x} y1={42} x2={x} y2={H - 20} stroke={T.brd} strokeDasharray="2 5" opacity={.5} />
              ))}

              {/* ARROWS */}
              {ARROWS.map(([f, t], i) => {
                const a = ctr(f), b = ctr(t)
                if (!a || !b) return null
                const hi = selected === f || selected === t
                return (
                  <line key={i}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={hi ? T.g1 : T.g4}
                    strokeWidth={hi ? 1.5 : 0.8}
                    strokeDasharray="5 4"
                    markerEnd={hi ? "url(#arr-hi)" : "url(#arr)"}
                    opacity={hi ? 1 : 0.45}
                  />
                )
              })}

              {/* MODULE NODES */}
              {MODULES.map(m => {
                const isSelected = selected === m.id
                return (
                  <g key={m.id} className="module-node" onClick={() => setSelected(isSelected ? null : m.id)}>
                    <rect
                      x={m.x} y={m.y - 22} width={140} height={44}
                      rx={4}
                      fill={isSelected ? `${m.color}20` : T.s2}
                      stroke={isSelected ? m.color : T.brd}
                      strokeWidth={isSelected ? 1.5 : 1}
                    />
                    {/* color accent bar */}
                    <rect x={m.x} y={m.y - 22} width={3} height={44} rx={1} fill={m.color} opacity={.8} />
                    <text x={m.x + 12} y={m.y - 4} fill={m.color} fontSize="9" fontFamily="monospace" fontWeight="700" letterSpacing="1.5">
                      {m.label}
                    </text>
                    <text x={m.x + 12} y={m.y + 12} fill={T.muted} fontSize="8.5" fontFamily="monospace">
                      {m.files[0]}
                    </text>
                    {isSelected && <circle cx={m.x + 134} cy={m.y - 18} r={4} fill={m.color} />}
                  </g>
                )
              })}
            </svg>
          </div>

          {/* DETAIL PANEL */}
          {sel && (
            <div style={{
              background: T.s1, border: `1px solid ${sel.color}44`,
              borderTop: `2px solid ${sel.color}`, borderRadius: 4, padding: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ color: sel.color }}>{sel.icon}</span>
                <span style={{ fontSize: 14, color: T.txt, fontWeight: 700, letterSpacing: ".06em" }}>{sel.title}</span>
              </div>

              <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.85, marginBottom: 18 }}>{sel.detail}</p>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, color: T.g4, letterSpacing: ".2em", marginBottom: 8 }}>FILES</div>
                {sel.files.map(f => (
                  <div key={f} style={{
                    padding: "5px 8px", background: T.s2, borderRadius: 3,
                    fontSize: 11, color: sel.color, marginBottom: 4,
                    border: `1px solid ${T.brd}`,
                  }}>{f}</div>
                ))}
              </div>

              <div>
                <div style={{ fontSize: 9, color: T.g4, letterSpacing: ".2em", marginBottom: 8 }}>KEY STATS</div>
                {sel.stats.map(s => (
                  <div key={s} style={{ fontSize: 12, color: T.txt, padding: "5px 0", borderBottom: `1px solid ${T.brd}33` }}>
                    › {s}
                  </div>
                ))}
              </div>

              <button onClick={() => onNavigate("dashboard")} style={{
                marginTop: 18, width: "100%", padding: "10px",
                background: "transparent", border: `1px solid ${sel.color}`,
                borderRadius: 3, color: sel.color,
                fontFamily: "inherit", fontSize: 12, cursor: "pointer", letterSpacing: ".1em",
              }}>
                VIEW IN DASHBOARD →
              </button>
            </div>
          )}
        </div>

        {/* MODULE GRID */}
        <div>
          <div style={{ fontSize: 10, color: T.g4, letterSpacing: ".22em", marginBottom: 14 }}>
            ALL MODULES — {MODULES.length} implemented
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
            {MODULES.map(m => (
              <div key={m.id}
                onClick={() => setSelected(m.id === selected ? null : m.id)}
                style={{
                  padding: "12px 14px",
                  background: selected === m.id ? `${m.color}12` : T.s1,
                  border: `1px solid ${selected === m.id ? m.color : T.brd}`,
                  borderLeft: `3px solid ${m.color}`,
                  borderRadius: 4, cursor: "pointer", transition: "all .15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ color: m.color }}>{m.icon}</span>
                  <span style={{ fontSize: 11, color: T.txt, fontWeight: 700 }}>{m.title}</span>
                </div>
                <div style={{ fontSize: 10, color: T.muted }}>{m.files[0]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const pageFromPath = (path) => {
    if (path === "/dashboard") return "dashboard"
    if (path === "/architecture") return "architecture"
    return "landing"
  }

  const pathFromPage = (p) => {
    if (p === "dashboard") return "/dashboard"
    if (p === "architecture") return "/architecture"
    return "/"
  }

  const [page, setPage] = useState(() => pageFromPath(window.location.pathname))

  useEffect(() => {
    const el = injectCSS(GLOBAL_CSS)
    document.body.style.cssText = `background:${T.bg};color:${T.txt};font-family:'Share Tech Mono','Courier New',monospace;`
    const onPop = () => setPage(pageFromPath(window.location.pathname))
    window.addEventListener("popstate", onPop)
    return () => {
      window.removeEventListener("popstate", onPop)
      el.remove()
      document.body.style.cssText = ""
    }
  }, [])

  const navigate = (nextPage) => {
    const nextPath = pathFromPage(nextPage)
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath)
    }
    setPage(nextPage)
  }

  if (page === "dashboard")    return <DashboardPage    onNavigate={navigate} />
  if (page === "architecture") return <ArchitecturePage onNavigate={navigate} />
  return <LandingPage onNavigate={navigate} />
}
