import { useEffect, useRef } from "react"
import { T } from "../styles/theme"

export default function MatrixRain() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    const chars = "01ABCDEFアイウエオカキクケコ"
    let drops = []

    const init = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      const cols = Math.max(1, Math.floor(canvas.width / 14))
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
        ctx.globalAlpha = Math.random() > 0.92 ? 1 : 0.14
        ctx.fillText(ch, x * 14, y * 16)
        ctx.globalAlpha = 1
        if (y * 16 > canvas.height && Math.random() > 0.975) drops[x] = 0
        else drops[x] += 1
      })
    }, 50)

    return () => {
      clearInterval(id)
      ro.disconnect()
    }
  }, [])

  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />
}
