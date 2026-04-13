import { useEffect, useRef } from "react"
import { T } from "../styles/theme"

export default function ThreatNetwork({ alerts = [], queries = [] }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return undefined
    const ctx = canvas.getContext("2d")
    if (!ctx) return undefined

    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const resize = () => {
      const w = canvas.clientWidth || 800
      const h = canvas.clientHeight || 340
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener("resize", resize)

    const nodeMap = new Map()
    const edges = []

    const addNode = (id, type, suspicious) => {
      if (!id) return
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          type,
          suspicious: Boolean(suspicious),
          x: (canvas.clientWidth || 800) * 0.2 + Math.random() * (canvas.clientWidth || 800) * 0.6,
          y: (canvas.clientHeight || 340) * 0.2 + Math.random() * (canvas.clientHeight || 340) * 0.6,
          vx: 0,
          vy: 0,
          radius: type === "host" ? 8 : 6,
        })
      } else if (suspicious) {
        nodeMap.get(id).suspicious = true
      }
    }

    for (const a of alerts.slice(0, 20)) {
      addNode(a.src_host, "host", true)
      addNode(a.domain, "domain", String(a.severity || "").toUpperCase() === "HIGH")
      edges.push({
        from: a.src_host,
        to: a.domain,
        suspicious: String(a.severity || "").toUpperCase() === "HIGH",
      })
    }
    for (const q of queries.slice(0, 30)) {
      if (!q.src_ip || !q.query_name) continue
      const dom = String(q.query_name).split(".").slice(-2).join(".")
      addNode(q.src_ip, "host", q.status === "suspicious")
      addNode(dom, "domain", false)
      if (!edges.find((e) => e.from === q.src_ip && e.to === dom)) {
        edges.push({ from: q.src_ip, to: dom, suspicious: q.status === "suspicious" })
      }
    }

    const nodes = Array.from(nodeMap.values())
    let tick = 0
    let animId = null

    const simulate = () => {
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const dx = nodes[j].x - nodes[i].x
          const dy = nodes[j].y - nodes[i].y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = Math.min(800, 5000 / (dist * dist))
          nodes[i].vx -= (dx / dist) * force * 0.002
          nodes[i].vy -= (dy / dist) * force * 0.002
          nodes[j].vx += (dx / dist) * force * 0.002
          nodes[j].vy += (dy / dist) * force * 0.002
        }
      }
      for (const e of edges) {
        const a = nodeMap.get(e.from)
        const b = nodeMap.get(e.to)
        if (!a || !b) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = (dist - 100) * 0.003
        a.vx += (dx / dist) * force
        a.vy += (dy / dist) * force
        b.vx -= (dx / dist) * force
        b.vy -= (dy / dist) * force
      }

      const w = canvas.clientWidth || 800
      const h = canvas.clientHeight || 340
      for (const n of nodes) {
        n.vx *= 0.85
        n.vy *= 0.85
        n.x = Math.max(20, Math.min(w - 20, n.x + n.vx))
        n.y = Math.max(20, Math.min(h - 20, n.y + n.vy))
      }
    }

    const draw = () => {
      const w = canvas.clientWidth || 800
      const h = canvas.clientHeight || 340
      ctx.clearRect(0, 0, w, h)
      tick += 1

      for (const e of edges) {
        const a = nodeMap.get(e.from)
        const b = nodeMap.get(e.to)
        if (!a || !b) continue
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.strokeStyle = e.suspicious ? `${T.r}88` : `${T.g4}55`
        ctx.lineWidth = e.suspicious ? 1.5 : 0.7
        ctx.setLineDash(e.suspicious ? [4, 3] : [])
        ctx.stroke()
        ctx.setLineDash([])
      }

      for (const n of nodes) {
        const pulse = n.suspicious ? (Math.sin(tick * 0.08) + 1) / 2 : 0
        if (n.suspicious) {
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.radius + 6 + pulse * 4, 0, Math.PI * 2)
          ctx.fillStyle = `${T.r}18`
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2)
        ctx.fillStyle = n.suspicious ? T.r : n.type === "host" ? T.g3 : `${T.b}88`
        ctx.fill()

        ctx.fillStyle = n.suspicious ? T.r : T.muted
        ctx.font = "9px 'Share Tech Mono', monospace"
        ctx.textAlign = "center"
        const label = n.id.length > 16 ? `${n.id.slice(0, 14)}…` : n.id
        ctx.fillText(label, n.x, n.y + n.radius + 11)
      }
    }

    const loop = () => {
      simulate()
      draw()
      animId = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      if (animId) cancelAnimationFrame(animId)
      window.removeEventListener("resize", resize)
    }
  }, [alerts, queries])

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", top: 8, right: 12, display: "flex", gap: 14, zIndex: 2 }}>
        {[
          ["●", T.r, "compromised host / C2"],
          ["●", T.g3, "normal host"],
          ["●", `${T.b}88`, "domain"],
        ].map(([sym, col, lbl]) => (
          <span key={lbl} style={{ fontSize: 9, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: col }}>{sym}</span>
            {lbl}
          </span>
        ))}
      </div>
      <canvas ref={ref} style={{ width: "100%", height: 340, display: "block", borderRadius: 4 }} />
    </div>
  )
}
