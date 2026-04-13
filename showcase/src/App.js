import { useEffect, useMemo, useState } from "react"
import DashboardPage from "./pages/DashboardPage"
import LandingPage from "./pages/LandingPage"
import ArchitecturePage from "./pages/ArchitecturePage"
import ModelPage from "./pages/ModelPage"
import { GLOBAL_CSS, T } from "./styles/theme"

function injectCSS(css) {
  const el = document.createElement("style")
  el.textContent = css
  document.head.appendChild(el)
  return el
}

function pageFromPath(path) {
  if (path === "/dashboard") return "dashboard"
  if (path === "/architecture") return "architecture"
  if (path === "/model") return "model"
  return "landing"
}

function pathFromPage(page) {
  if (page === "dashboard") return "/dashboard"
  if (page === "architecture") return "/architecture"
  if (page === "model") return "/model"
  return "/"
}

export default function App() {
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

  const navigate = useMemo(
    () => (nextPage) => {
      const nextPath = pathFromPage(nextPage)
      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, "", nextPath)
      }
      setPage(nextPage)
    },
    [],
  )

  if (page === "dashboard") return <DashboardPage onNavigate={navigate} />
  if (page === "architecture") return <ArchitecturePage onNavigate={navigate} />
  if (page === "model") return <ModelPage onNavigate={navigate} />
  return <LandingPage onNavigate={navigate} />
}
