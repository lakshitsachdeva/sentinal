import { T } from "../styles/theme"

export default function ApiStatus({ error, lastOk, label = "" }) {
  if (error) {
    return (
      <div
        style={{
          padding: "4px 10px",
          borderRadius: 3,
          marginBottom: 8,
          background: `${T.r}12`,
          border: `1px solid ${T.r}33`,
          fontSize: 10,
          color: T.r,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>!</span>
        <span>API ERROR{label ? ` - ${label}` : ""}: {error}</span>
        <span style={{ color: T.muted, marginLeft: "auto" }}>using fallback/cached data</span>
      </div>
    )
  }

  if (lastOk) {
    const s = Math.round((Date.now() - lastOk) / 1000)
    return (
      <div style={{ fontSize: 9, color: T.muted, marginBottom: 4, textAlign: "right" }}>
        last updated {s}s ago
      </div>
    )
  }

  return null
}
