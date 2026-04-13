import { T } from "../styles/theme"

export default function Badge({ children, color = T.g1 }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 3,
        border: `1px solid ${color}`,
        color,
        fontSize: 10,
        letterSpacing: ".08em",
        background: `${color}18`,
      }}
    >
      {children}
    </span>
  )
}
