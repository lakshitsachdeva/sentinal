import { useEffect, useMemo, useState } from "react"
import { Activity, AlertTriangle, Cpu, Database, Eye, Network, Server, Terminal, Zap } from "lucide-react"
import { useSummary, useSystemInfo } from "../api/useApi"
import Nav from "../components/Nav"
import { FALLBACK_SUMMARY } from "../data/staticData"
import { T } from "../styles/theme"

export default function ArchitecturePage({ onNavigate }) {
  const systemQ = useSystemInfo()
  const summaryQ = useSummary()
  const system = systemQ.data || {}
  const summary = summaryQ.data || FALLBACK_SUMMARY

  const [selected, setSelected] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [animTick, setAnimTick] = useState(0)
  const [dashHover, setDashHover] = useState(false)

  useEffect(() => {
    if (!selected) return undefined
    const id = setInterval(() => setAnimTick((n) => n + 1), 50)
    return () => clearInterval(id)
  }, [selected])

  const MODULES = useMemo(
    () => [
      {
        id: "sim",
        x: 40,
        y: 110,
        label: "TRAFFIC SIM",
        icon: <Terminal size={14} />,
        color: T.g1,
        title: "Traffic Simulator",
        detail:
          "Generates both normal DNS traffic and covert attack modes: beaconing with jitter, Base64 exfil chunks, DGA-style domain scans, and mixed sessions.",
        files: ["lab/normal_traffic.py", "lab/attack_simulator.py"],
        stats: ["4 attack modes", "Configurable beacon interval", "Jitter support for realism"],
      },
      {
        id: "cap",
        x: 40,
        y: 290,
        label: "CAPTURE",
        icon: <Network size={14} />,
        color: T.b,
        title: "Packet Capture",
        detail:
          "Scapy live sniffing on UDP/53 with structured extraction (timestamp, source, domain, type, rcode). Also supports offline replay through PCAP parsing.",
        files: ["capture/sniffer.py", "capture/pcap_reader.py"],
        stats: ["Live + offline modes", "CSV output pipeline", "Continuous feed windows"],
      },
      {
        id: "feat",
        x: 310,
        y: 200,
        label: "FEATURES",
        icon: <Cpu size={14} />,
        color: T.y,
        title: "Feature Extraction",
        detail:
          "Builds lexical, temporal, and session-level signals (entropy, subdomain structure, inter-arrival behavior, NXDOMAIN ratios, TXT ratios, host concentration).",
        files: ["features/lexical.py", "features/temporal.py", "features/session.py", "features/feature_pipeline.py"],
        stats: ["19+ feature signals", "Entropy + sequence features", "Session aggregation"],
      },
      {
        id: "rule",
        x: 570,
        y: 80,
        label: "RULE ENGINE",
        icon: <Eye size={14} />,
        color: T.r,
        title: "Rule Engine",
        detail:
          "Deterministic threat heuristics with threshold evidence. Violations are severity-tagged and forwarded to scoring as explainable artifacts.",
        files: ["detection/rule_engine.py"],
        stats: ["Rules R001-R008", "Severity evidence output", "Config-driven thresholds"],
      },
      {
        id: "beh",
        x: 570,
        y: 240,
        label: "BEHAVIOR",
        icon: <Activity size={14} />,
        color: T.o,
        title: "Behavior Engine",
        detail:
          "Detects temporal and population patterns: beacon periodicity, tunnel-like subdomain churn, host-domain concentration, and suspicious scan behavior.",
        files: ["detection/behavior_engine.py"],
        stats: ["Beaconing heuristics", "Exfil estimations", "DGA sweep flags"],
      },
      {
        id: "ml",
        x: 570,
        y: 400,
        label: "ML MODEL",
        icon: <Database size={14} />,
        color: T.b,
        title: "ML Classifier",
        detail:
          "Model inference over engineered DNS features to surface malicious likelihood. Combined with rules and behavior for final triage confidence.",
        files: ["detection/ml_model.py", "models/saved/dns_classifier.pkl"],
        stats: ["Probability output", "Thresholded malicious flag", "Integrated into scoring"],
      },
      {
        id: "score",
        x: 820,
        y: 240,
        label: "THREAT SCORER",
        icon: <Zap size={14} />,
        color: T.r,
        title: "Threat Scorer",
        detail:
          "Fuses rule hits, behavioral indicators, and ML signal into one 0-100 risk score, then assigns LOW/MEDIUM/HIGH severity bands for analyst workflow.",
        files: ["scoring/threat_scorer.py"],
        stats: ["0-100 composite score", "3-layer fusion", "Severity mapping"],
      },
      {
        id: "alert",
        x: 1030,
        y: 110,
        label: "ALERTS",
        icon: <AlertTriangle size={14} />,
        color: T.r,
        title: "Alert Engine",
        detail:
          "Creates explainable alert objects with evidence chains and persists them in SQLite. Includes dedup fingerprinting and optional pruning controls.",
        files: ["alerts/alert_engine.py", "alerts/alerts.db"],
        stats: ["SQLite persistence", "Dedup + run_id tracking", "Analyst-ready reason list"],
      },
      {
        id: "dash",
        x: 1030,
        y: 330,
        label: "DASHBOARD",
        icon: <Server size={14} />,
        color: T.g1,
        title: "Dashboard",
        detail:
          "React SOC interface consuming live API endpoints for KPIs, charts, evidence-rich alerts, query logs, and architecture/system introspection.",
        files: ["showcase/src/pages/DashboardPage.jsx", "api/server.py"],
        stats: ["Realtime polling", "Graceful fallback states", "Multi-page ops UI"],
      },
    ],
    [],
  )

  const ARROWS = [
    ["sim", "cap"],
    ["sim", "feat"],
    ["cap", "feat"],
    ["feat", "rule"],
    ["feat", "beh"],
    ["feat", "ml"],
    ["rule", "score"],
    ["beh", "score"],
    ["ml", "score"],
    ["score", "alert"],
    ["score", "dash"],
    ["alert", "dash"],
  ]

  const ctr = (id) => {
    const m = MODULES.find((x) => x.id === id)
    return m ? { x: m.x + 70, y: m.y + 22 } : null
  }

  const sel = MODULES.find((m) => m.id === selected)
  const W = 1200
  const H = 530

  const dbAlertsTotal = Number(system?.runtime?.alerts_loaded || 0)
  const modelLoaded = Boolean(system?.model?.exists)
  const modelPath = system?.model?.path || "—"
  const pipelineMode = system?.runtime?.mode || "DEMO_FEED"
  const testsOk = Boolean(summary?.tests_ok)

  const healthItems = [
    { label: "API", ok: Boolean(systemQ.data), detail: "port 8000" },
    { label: "ALERTS DB", ok: dbAlertsTotal > 0, detail: `${dbAlertsTotal} records` },
    { label: "ML MODEL", ok: modelLoaded, detail: String(modelPath).split("/").pop() || "—" },
    { label: "PIPELINE", ok: Boolean(pipelineMode), detail: pipelineMode || "DEMO" },
    { label: "TESTS", ok: testsOk, detail: `${summary?.tests_passed || 0}/${summary?.tests_total || 0}` },
  ]

  const threatLevel =
    summary?.alerts_high > 0 ? "HIGH" : summary?.alerts_medium > 0 ? "MEDIUM" : summary?.alerts_low > 0 ? "LOW" : "NONE"

  return (
    <div style={{ color: T.txt, background: T.bg, minHeight: "100vh" }}>
      <Nav
        page="architecture"
        onNavigate={onNavigate}
        liveQueries={summary?.queries_total || 0}
        lifetimeQueries={summary?.queries_lifetime || 0}
        mode={summary?.mode || "DEMO_FEED"}
        threatLevel={threatLevel}
        highAlerts={summary?.alerts_high || 0}
        totalAlerts={summary?.alerts_total || 0}
      />

      <div style={{ padding: "28px" }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, color: T.g3, letterSpacing: ".35em", marginBottom: 8 }}>SYSTEM PIPELINE - 9 MODULES IMPLEMENTED</div>
          <h2 style={{ fontSize: 22, color: T.txt, letterSpacing: ".1em", marginBottom: 4 }}>DETECTION ARCHITECTURE</h2>
          <p style={{ fontSize: 11, color: T.muted }}>Click any node to inspect implementation details, files, and key stats.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 320px" : "1fr", gap: 18, marginBottom: 20 }}>
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

              {[{ x: 40, label: "INPUT" }, { x: 310, label: "EXTRACT" }, { x: 570, label: "DETECT" }, { x: 820, label: "SCORE" }, { x: 1030, label: "OUTPUT" }].map(
                ({ x, label }) => (
                  <text key={label} x={x + 70} y={28} textAnchor="middle" fill={T.g4} fontSize="9" letterSpacing="2">
                    {label}
                  </text>
                ),
              )}

              {[220, 480, 740, 960].map((x) => (
                <line key={x} x1={x} y1={42} x2={x} y2={H - 20} stroke={T.brd} strokeDasharray="2 5" opacity={0.5} />
              ))}

              {ARROWS.map(([f, t], i) => {
                const a = ctr(f)
                const b = ctr(t)
                if (!a || !b) return null
                const active = selected === f || selected === t
                return (
                  <line
                    key={`${f}-${t}-${i}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={active ? T.g1 : T.g4}
                    strokeWidth={active ? 1.5 : 0.8}
                    strokeDasharray="5 4"
                    markerEnd={active ? "url(#arr-hi)" : "url(#arr)"}
                    opacity={active ? 1 : 0.45}
                    style={active ? { strokeDashoffset: 1000, animation: "draw 1.2s ease-out forwards" } : undefined}
                  />
                )
              })}

              {ARROWS.map(([f, t], i) => {
                const a = ctr(f)
                const b = ctr(t)
                const isActive = selected === f || selected === t
                if (!a || !b || !isActive) return null
                const travel = ((animTick + i * 7) % 60) / 60
                const dotX = a.x + (b.x - a.x) * travel
                const dotY = a.y + (b.y - a.y) * travel
                return (
                  <g key={`dot-${f}-${t}-${i}`}>
                    <circle cx={dotX} cy={dotY} r={6} fill={T.g1} opacity={0.2} className="flow-dot" />
                    <circle cx={dotX} cy={dotY} r={3} fill={T.g1} opacity={0.9} className="flow-dot" />
                  </g>
                )
              })}

              {MODULES.map((m) => {
                const isSelected = selected === m.id
                const isHovered = hovered === m.id && !isSelected
                return (
                  <g
                    key={m.id}
                    className="module-node"
                    onClick={() => setSelected(isSelected ? null : m.id)}
                    onMouseEnter={() => setHovered(m.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {isHovered ? (
                      <rect
                        x={m.x}
                        y={m.y - 22}
                        width={140}
                        height={44}
                        rx={4}
                        fill="none"
                        stroke={m.color}
                        strokeWidth={6}
                        opacity={0.08}
                      />
                    ) : null}
                    <rect
                      x={m.x}
                      y={m.y - 22}
                      width={140}
                      height={44}
                      rx={4}
                      fill={isSelected ? `${m.color}20` : T.s2}
                      stroke={isSelected ? m.color : isHovered ? T.g4 : T.brd}
                      strokeWidth={isSelected ? 1.5 : 1}
                    />
                    <rect x={m.x} y={m.y - 22} width={3} height={44} rx={1} fill={m.color} opacity={0.8} />
                    <text x={m.x + 12} y={m.y - 4} fill={m.color} fontSize="9" fontWeight={700} letterSpacing="1.5">
                      {m.label}
                    </text>
                    <text x={m.x + 12} y={m.y + 12} fill={T.muted} fontSize="8.5">
                      {m.files[0]}
                    </text>
                    {isSelected ? <circle cx={m.x + 134} cy={m.y - 18} r={4} fill={m.color} /> : null}
                  </g>
                )
              })}
            </svg>
          </div>

          {sel ? (
            <div
              style={{
                background: T.s1,
                border: `1px solid ${sel.color}44`,
                borderTop: `2px solid ${sel.color}`,
                borderRadius: 4,
                padding: 20,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ color: sel.color }}>{sel.icon}</span>
                <span style={{ fontSize: 14, color: T.txt, fontWeight: 700, letterSpacing: ".06em" }}>{sel.title}</span>
              </div>

              <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.85, marginBottom: 18 }}>{sel.detail}</p>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, color: T.g4, letterSpacing: ".2em", marginBottom: 8 }}>FILES</div>
                {sel.files.map((f) => (
                  <div
                    key={f}
                    style={{
                      padding: "5px 8px",
                      background: T.s2,
                      borderRadius: 3,
                      fontSize: 11,
                      color: sel.color,
                      marginBottom: 4,
                      border: `1px solid ${T.brd}`,
                    }}
                  >
                    {f}
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontSize: 9, color: T.g4, letterSpacing: ".2em", marginBottom: 8 }}>KEY STATS</div>
                {sel.stats.map((s) => (
                  <div key={s} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "5px 0", borderBottom: `1px solid ${T.brd}33` }}>
                    <div style={{ width: 2, minWidth: 2, height: 12, background: sel.color, borderRadius: 1, marginTop: 2 }} />
                    <div style={{ fontSize: 12, color: T.txt }}>{s}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => onNavigate("dashboard")}
                onMouseEnter={() => setDashHover(true)}
                onMouseLeave={() => setDashHover(false)}
                style={{
                  marginTop: 18,
                  width: "100%",
                  padding: "10px",
                  background: "transparent",
                  border: `1px solid ${sel.color}`,
                  borderRadius: 3,
                  color: sel.color,
                  fontFamily: "inherit",
                  fontSize: 12,
                  cursor: "pointer",
                  letterSpacing: ".1em",
                }}
              >
                VIEW IN DASHBOARD <span style={{ display: "inline-block", transform: dashHover ? "translateX(3px)" : "translateX(0)", transition: "transform .15s ease" }}>⟶</span>
              </button>
            </div>
          ) : null}
        </div>

        <div>
          <div style={{ fontSize: 10, color: T.g4, letterSpacing: ".22em", marginBottom: 14 }}>ALL MODULES - {MODULES.length} IMPLEMENTED</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
            {MODULES.map((m) => (
              <div
                key={m.id}
                onClick={() => setSelected(m.id === selected ? null : m.id)}
                style={{
                  padding: "12px 14px",
                  background: selected === m.id ? `${m.color}12` : T.s1,
                  border: `1px solid ${selected === m.id ? m.color : T.brd}`,
                  borderLeft: `3px solid ${m.color}`,
                  borderRadius: 4,
                  cursor: "pointer",
                  transition: "all .15s",
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

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 10, color: T.g4, letterSpacing: ".3em", marginBottom: 10 }}>SYSTEM HEALTH</div>
          <div style={{ display: "flex", gap: 10 }}>
            {healthItems.map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "10px 14px",
                  background: T.s1,
                  border: `1px solid ${item.ok ? T.g4 : `${T.r}44`}`,
                  borderTop: `2px solid ${item.ok ? T.g1 : T.r}`,
                  borderRadius: 4,
                  flex: 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span
                    className={item.ok ? "pulse-dot" : undefined}
                    style={{ width: 6, height: 6, borderRadius: "50%", background: item.ok ? T.g1 : T.r, display: "inline-block" }}
                  />
                  <span style={{ fontSize: 9, color: T.muted, letterSpacing: ".15em" }}>{item.label}</span>
                </div>
                <div style={{ fontSize: 10, color: item.ok ? T.g1 : T.r }}>{item.ok ? "OPERATIONAL" : "DEGRADED"}</div>
                <div style={{ fontSize: 9, color: T.muted, marginTop: 2 }}>{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
