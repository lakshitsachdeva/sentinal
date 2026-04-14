import { useEffect, useRef } from "react"
import { T } from "../styles/theme"

export default function MatrixRain() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const chars = "01ABCDEFアイウエオカキクケコ"
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false
    let drops = []

    const init = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      const cols = Math.max(1, Math.floor(canvas.width / 13))
      drops = Array(cols).fill(1)
    }

    init()
    const ro = new ResizeObserver(init)
    ro.observe(canvas)

    const intervalMs = prefersReducedMotion ? 92 : 58
    const id = setInterval(() => {
      ctx.fillStyle = "rgba(6,12,9,0.08)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.font = "12px 'Share Tech Mono', monospace"
      drops.forEach((y, x) => {
        const ch = chars[Math.floor(Math.random() * chars.length)]
        const highlight = Math.random() > 0.93
        ctx.fillStyle = highlight ? "#7dff9f" : T.g1
        ctx.globalAlpha = highlight ? 0.78 : 0.26
        ctx.fillText(ch, x * 13, y * 16)
        ctx.globalAlpha = 1
        if (y * 16 > canvas.height && Math.random() > 0.975) drops[x] = 0
        else drops[x] += 1
      })
    }, intervalMs)

    return () => {
      clearInterval(id)
      ro.disconnect()
    }
  }, [])

  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />
}
