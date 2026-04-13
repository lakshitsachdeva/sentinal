import { useState, useEffect, useCallback, useRef } from "react"

const BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000"

function useFetch(endpoint, intervalMs = 4000) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastOk, setLastOk] = useState(null)
  const mounted = useRef(true)

  const fetchNow = useCallback(async () => {
    try {
      const response = await fetch(`${BASE}${endpoint}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json()
      if (!mounted.current) return
      setData(payload?.data ?? null)
      setError(null)
      setLastOk(Date.now())
    } catch (e) {
      if (!mounted.current) return
      setError(e?.message || String(e))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    mounted.current = true
    fetchNow()
    const id = setInterval(fetchNow, intervalMs)
    return () => {
      mounted.current = false
      clearInterval(id)
    }
  }, [fetchNow, intervalMs])

  return { data, error, loading, lastOk, refresh: fetchNow, base: BASE }
}

export const useSummary = () => useFetch("/api/summary", 4000)
export const useAlerts = () => useFetch("/api/alerts?limit=50", 4000)
export const useQueries = () => useFetch("/api/queries?limit=50", 4000)
export const useCharts = () => useFetch("/api/charts", 4000)
export const useModules = () => useFetch("/api/modules", 15000)
export const useSystemInfo = () => useFetch("/api/system", 6000)
export const useModelData = () => useFetch("/api/model", 60000)

export function useRealtimeSignals() {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)
  const [newAlerts, setNewAlerts] = useState([])
  const [lastEventTs, setLastEventTs] = useState(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const url = `${BASE}/api/stream`
    let es = null
    let retryId = null

    const connect = () => {
      try {
        es = new EventSource(url)
      } catch (e) {
        if (!mounted.current) return
        setConnected(false)
        setError(e?.message || String(e))
        retryId = setTimeout(connect, 2000)
        return
      }

      es.addEventListener("tick", (ev) => {
        if (!mounted.current) return
        try {
          const payload = JSON.parse(ev.data || "{}")
          setSummary(payload.summary || null)
          setNewAlerts(Array.isArray(payload.new_alerts) ? payload.new_alerts : [])
          setLastEventTs(Date.now())
          setConnected(true)
          setError(null)
        } catch (e) {
          setError(e?.message || String(e))
        }
      })

      es.addEventListener("error", () => {
        if (!mounted.current) return
        setConnected(false)
        setError("realtime stream disconnected")
        try {
          es?.close()
        } catch (_) {}
        retryId = setTimeout(connect, 2000)
      })
    }

    connect()

    return () => {
      mounted.current = false
      if (retryId) clearTimeout(retryId)
      try {
        es?.close()
      } catch (_) {}
    }
  }, [])

  return { connected, error, summary, newAlerts, lastEventTs, base: BASE }
}
