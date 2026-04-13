import { useMemo, useState } from "react"
import { T } from "../styles/theme"

export default function OnboardingTour({ open, onClose, onNavigate }) {
  const steps = useMemo(
    () => [
      {
        title: "Welcome to SENTINEL",
        text: "This project is a real DNS IDS pipeline: traffic -> features -> rule/behavior/ML detection -> scoring -> persisted alerts -> realtime dashboard.",
      },
      {
        title: "Live Data Contract",
        text: "Window metrics show what is currently loaded in memory/files. Lifetime metrics show how much data has been ingested across cycles since API start.",
      },
      {
        title: "Landing Page",
        text: "Landing is your mission-control intro: mode status, alert/query/test counters, and live threat ticker sourced from API alerts.",
      },
      {
        title: "Dashboard KPIs",
        text: "Top cards summarize window-level operational state: query volume, suspicious count, alert pressure, and host spread.",
      },
      {
        title: "Realtime Stream",
        text: "Dashboard subscribes to /api/stream via SSE. New alerts are injected instantly and HIGH alerts can trigger browser notifications.",
      },
      {
        title: "Traffic and Distribution Charts",
        text: "Charts visualize normal vs suspicious timeline, severity mix, entropy/length distributions, attack type share, and top risky hosts.",
      },
      {
        title: "Evidence-Rich Alerts",
        text: "Every alert card includes source host/domain, severity score, beaconing indicator, and reason chain from rule/behavior/ML layers.",
      },
      {
        title: "Architecture Map",
        text: "Architecture page is interactive. Click any module node to inspect responsibilities, file ownership, and runtime system context.",
        actionLabel: "Open Architecture",
        action: () => onNavigate("architecture"),
      },
      {
        title: "How To Demo Live",
        text: "Run ./run_sentinel.sh --reset, keep dashboard open on /dashboard, and watch stream status + live signal cards update every cycle.",
        actionLabel: "Open Dashboard",
        action: () => onNavigate("dashboard"),
      },
      {
        title: "You Are Ready",
        text: "Use this tour as your talking track in demos. You can reopen it anytime from Landing via the GUIDED TOUR button.",
      },
    ],
    [onNavigate],
  )

  const [idx, setIdx] = useState(0)
  if (!open) return null
  const step = steps[idx]

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.66)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(760px, 100%)",
          background: T.s1,
          border: `1px solid ${T.g1}55`,
          borderTop: `2px solid ${T.g1}`,
          borderRadius: 6,
          padding: 22,
        }}
      >
        <div style={{ color: T.g3, fontSize: 10, letterSpacing: ".22em", marginBottom: 10 }}>
          ONBOARDING TOUR {idx + 1}/{steps.length}
        </div>
        <div style={{ color: T.g1, fontSize: 22, letterSpacing: ".06em", marginBottom: 12 }}>{step.title}</div>
        <p style={{ color: T.txt, fontSize: 13, lineHeight: 1.8, marginBottom: 20 }}>{step.text}</p>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            className="nav-btn"
            onClick={() => setIdx((n) => Math.max(0, n - 1))}
            disabled={idx === 0}
            style={{ opacity: idx === 0 ? 0.5 : 1 }}
          >
            PREV
          </button>
          <button
            className="nav-btn"
            onClick={() => {
              if (step.action) step.action()
            }}
            style={{ visibility: step.actionLabel ? "visible" : "hidden" }}
          >
            {step.actionLabel || "ACTION"}
          </button>
          <button
            className="nav-btn"
            onClick={() => {
              if (idx < steps.length - 1) setIdx((n) => n + 1)
              else onClose()
            }}
            style={{ marginLeft: "auto", borderColor: T.g1, color: T.g1 }}
          >
            {idx < steps.length - 1 ? "NEXT" : "FINISH"}
          </button>
          <button className="nav-btn" onClick={onClose}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  )
}
