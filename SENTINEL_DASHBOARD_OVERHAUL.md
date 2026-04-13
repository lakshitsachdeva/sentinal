# SENTINEL — Complete Dashboard Overhaul Brief for Codex
> This document tells Codex exactly what to rewrite, file by file, with full
> before/after diagnosis, precise instructions, and reference code snippets.
> Apply prompts in the order listed. Every prompt is self-contained.

---

## What's Wrong Right Now (Read This First)

Having read the actual source code, here is the exact list of failures:

| File | Problem |
|---|---|
| `KPI.jsx` | Flat number, no animation on data change, no trend/delta, no sparkline |
| `AlertCard.jsx` | All reason text is the same color — Rule/Behavior/ML look identical. No score bar. No expand animation. |
| `Nav.jsx` | No current threat level indicator. No alert count badge. Clock is there but buried. |
| `DashboardPage.jsx` | Basic Recharts with zero customization. PieChart is a solid pie (not a donut). No chart legends. Traffic chart has no stroke animation. Attack type chart is a plain orange bar. No beaconing IAT scatter. Query log is a minimal table. |
| `LandingPage.jsx` | Hero is fine but detection cards are generic — 3 boxes with a title and a sentence. No live threat feed panel. The live ticker text just appears — no scroll animation. |
| `ArchitecturePage.jsx` | SVG nodes are plain rectangles with no hover depth. No data-flow animation along arrows. No system health bar at bottom. Module detail panel has no real stat visualization. |
| `ChartPanel.jsx` | Loading state is just a blinking cursor — no shimmer skeleton. |
| `theme.js` | Missing animation keyframes for shimmer, slide-in, draw. No `@keyframes draw` for SVG stroke animation. |

---

## GLOBAL RULES FOR EVERY PROMPT

These apply to every single file you touch. Never deviate.

```
THEME (import from styles/theme.js — never hardcode these):
  T.bg     = #060c09   (page background)
  T.s1     = #0a1510   (panel background)
  T.s2     = #0f1e14   (card background)
  T.g1     = #00ff41   (primary green / success)
  T.g2     = #00cc33
  T.g3     = #009922
  T.g4     = #1a4a25   (muted green border)
  T.r      = #ff2244   (HIGH / danger / attack)
  T.o      = #ff7700   (MEDIUM / behavior / warning)
  T.b      = #00aaff   (ML / info / blue)
  T.y      = #ffcc00   (DGA / yellow)
  T.txt    = #b8f0c8   (body text)
  T.muted  = #4a7a5a   (secondary text)
  T.brd    = #1a3323   (border)

FONT: 'Share Tech Mono', 'Courier New', monospace — always, everywhere

SEVERITY COLORS:
  HIGH   → T.r
  MEDIUM → T.o
  LOW    → T.g2

REASON COLOR CODING:
  [Rule ...]     → T.r
  [Behavior ...] → T.o
  [ML ...]       → T.b
  anything else  → T.txt

NEVER add new npm packages. Use only what's already installed:
  recharts, lucide-react, react (hooks only)

Keep all existing prop interfaces. Don't break callers.
```

---

## PROMPT 1 — `styles/theme.js`

**Why:** Missing critical animation keyframes. Add them here so every component
can use them via className.

**Exact instruction for Codex:**

```
Open showcase/src/styles/theme.js.

The file exports T (colors) and GLOBAL_CSS (injected string).

Add the following keyframe blocks INSIDE the GLOBAL_CSS template literal,
after the existing @keyframes blink block:

1. @keyframes shimmer
   Animates a diagonal highlight left-to-right.
   background-position goes from -200% to 200%.
   Duration: 1.6s linear infinite.

2. @keyframes draw
   SVG stroke animation: stroke-dashoffset goes from 1000 to 0.
   Duration: 1.2s ease-out forwards.

3. @keyframes slideInRight
   transform: translateX(40px) opacity:0 → translateX(0) opacity:1
   Duration: 0.35s ease both.

4. @keyframes countUp
   No visual keyframe needed — this is done in JS (see KPI prompt).

5. @keyframes flowDot
   A dot moving along a path: opacity 0→1→1→0 over 2s infinite.
   (Used for architecture data-flow dots.)

Add these CSS utility classes to GLOBAL_CSS:
  .shimmer-line   — a shimmer placeholder bar (use for loading states)
  .slide-in-right — applies slideInRight animation
  .flow-dot       — applies flowDot animation

Also add to GLOBAL_CSS:
  .alert-card-enter {
    animation: slideInRight 0.3s ease both;
  }

  .query-row-attack {
    animation: fadeUp 0.4s ease both;
  }

Do not change any existing exports. Just extend GLOBAL_CSS.
```

---

## PROMPT 2 — `components/KPI.jsx`

**Current state:** A div with a label, a big number, and an optional sub-label.
Zero animation. No trend.

**Target state:** Number counts up when value changes. Color-coded delta badge
(↑ or ↓ vs last value). Optional mini sparkline (array of numbers → tiny inline
SVG line). Subtle top-border pulse when value increases.

**Exact instruction for Codex:**

```
Rewrite showcase/src/components/KPI.jsx completely.

Props (keep these identical to current):
  label: string
  value: string | number
  color: string (default T.g1)
  sub: string (optional)

Add these NEW optional props:
  delta: number (optional — positive = up, negative = down)
  spark: number[] (optional — array of up to 12 values for sparkline)
  animate: boolean (default true)

Implementation requirements:

1. ANIMATED COUNT-UP
   When the numeric part of `value` changes, animate from previous to new
   over 800ms using a useEffect + setInterval counting toward the target.
   Use a ref to store the previous value.
   Parse numeric value from the string using parseFloat.
   If value is non-numeric (like "18/18") skip animation and display as-is.

2. DELTA BADGE (if delta prop provided)
   Show a small badge to the right of the number:
   - delta > 0: "↑ +N" in T.g1 background, T.bg text, 9px
   - delta < 0: "↓ N" in T.r background, T.bg text, 9px
   - delta = 0: nothing
   Badge style: padding 1px 6px, borderRadius 2, fontSize 9

3. SPARKLINE (if spark prop provided)
   Render a tiny inline SVG (width 60, height 24) below the number.
   Draw a polyline connecting normalized data points.
   Stroke: color prop, strokeWidth 1.5, fill none.
   No axes, no labels — purely visual.
   Points: normalize spark array to fit within height 0–20.

4. HOVER EFFECT
   On hover: border-color transitions to color prop (0.2s).
   Use onMouseEnter/onMouseLeave with useState.

5. PULSE ON INCREASE
   When animated value reaches its target and it's higher than before,
   briefly (300ms) set a brighter background tint (color + "22")
   then fade back to T.s2.

Keep existing layout: label on top, big number below, sub below that.
Add sparkline between number and sub if provided.
Add delta badge inline with number (flex row, alignItems baseline).
```

---

## PROMPT 3 — `components/AlertCard.jsx`

**Current state:** Evidence reasons are all the same `T.txt` color.
No visual score bar. No expand animation. Badge row is messy.

**Target state:** Color-coded reasons by source. Score arc/bar visualization.
Smooth expand animation. Structured evidence sections.

**Exact instruction for Codex:**

```
Rewrite showcase/src/components/AlertCard.jsx completely.

Keep the same props: alert, defaultOpen.
Keep the same normalizeReasons helper function.

HEADER ROW (always visible, clickable to expand):
  Left:   [SEVERITY] label in severity color, bold, 64px min-width
  Center: "src_host → domain" in T.txt, fontSize 12, flex:1
          If is_beaconing is truthy, show a small "⏱ BEACON" badge (T.o, 9px)
          inline after domain, no extra line
  Right:  score/100 — display as "NN.N / 100"
          Color the number by score: ≥70=T.r, ≥40=T.o, else T.g2
  Far right: timestamp formatted as HH:MM:SS, T.muted, 10px
  Chevron: ChevronDown/Right from lucide-react, T.muted, size 13

SCORE BAR (always visible, below header):
  A thin (3px height) horizontal progress bar the full width of the card.
  Background: T.brd
  Filled portion: width = `${alert.total_score}%`
  Fill color: same score-based color as above
  No border radius — flush with card edges.
  This is NOT inside the collapsible section.

EXPANDED BODY (collapsible, animate height with maxHeight transition):
  Use maxHeight: open ? "600px" : "0" with overflow hidden,
  transition: "max-height 0.3s ease, opacity 0.3s ease",
  opacity: open ? 1 : 0

  SECTION 1 — SCORE BREAKDOWN (if rule_score or behavior_score exists on alert)
    Three mini-stat boxes in a row:
      "RULE"  | alert.rule_score or "—"     | color T.r
      "BEH"   | alert.behavior_score or "—" | color T.o
      "ML"    | (alert.ml_score*100).toFixed(0)+"%" or "—" | color T.b
    Each box: background T.s2, border 1px T.brd, padding 8px 10px, borderRadius 3
    Label: 9px T.muted above. Value: 18px bold colored number.

  SECTION 2 — EVIDENCE
    Label: "EVIDENCE" in 9px T.g4 letterSpacing .2em, marginBottom 6

    For each reason string, determine color:
      starts with "[Rule"     → T.r
      starts with "[Behavior" → T.o
      starts with "[ML"       → T.b
      else                    → T.txt

    Also extract a source tag to show before the text:
      "[Rule R001]" → show "R001" as a tiny badge (T.r bg, T.bg text)
      "[Behavior]"  → show "BEH" badge (T.o bg, T.bg text)
      "[ML]"        → show "ML" badge (T.b bg, T.bg text)

    Each reason row:
      display flex, gap 8, paddingY 5, borderBottom 1px T.brd+"22"
      badge (8px padding 1px 5px borderRadius 2) + reason text (colored, 11px)

  SECTION 3 — RUN INFO (if alert.run_id exists)
    One line: "run: {run_id}" in 9px T.muted

The card container:
  border: `1px solid ${c}22`
  borderLeft: `3px solid ${c}`
  borderRadius: 4
  marginBottom: 8
  background: `${c}06`
  overflow: hidden

Add className="alert-card-enter" to the outermost div for the slide-in animation.
```

---

## PROMPT 4 — `components/Nav.jsx`

**Current state:** No threat level. No alert count badge. Queries counter is
just text. Navigation buttons are fine but the overall bar lacks hierarchy.

**Target state:** Threat level indicator (color-coded pill showing worst active
severity). Alert count badge. Active page indicator on nav buttons.

**Exact instruction for Codex:**

```
Rewrite showcase/src/components/Nav.jsx completely.

Keep existing props:
  page, onNavigate, liveQueries, lifetimeQueries, mode
  
Add new props:
  highAlerts: number (default 0) — count of HIGH severity alerts
  totalAlerts: number (default 0)
  threatLevel: "HIGH" | "MEDIUM" | "LOW" | "NONE" (default "NONE")

LAYOUT (left to right):
  LEFT GROUP (gap 14, alignItems center):
    - [if page !== "landing"] HOME button (nav-btn class)
    - Shield icon (size 17, T.g1)
    - "SENTINEL" text (T.g1, 14px, letterSpacing .22em, fontWeight 700)
    - Threat level pill: ThreatPill component (see below)

  CENTER GROUP (auto, flex 1, display flex, justifyContent center):
    - ModeLabel (existing logic, keep it)
    - Live clock (existing Clock component, keep it)

  RIGHT GROUP (gap 10, alignItems center):
    - Query counter: "{liveQueries.toLocaleString()} queries" in T.g1, 11px
      with the pulse-dot span before it (existing)
    - Alert badge: if totalAlerts > 0, show a pill:
      "{totalAlerts} alerts" background T.r+"18" border T.r+"44" color T.r
      If highAlerts > 0, prepend a "🔴" or just color it T.r solid
    - [if page !== "dashboard"]    DASHBOARD button
    - [if page !== "architecture"] ARCHITECTURE button

ThreatPill component (inline, not exported):
  Props: level ("HIGH"|"MEDIUM"|"LOW"|"NONE")
  Colors:
    HIGH   → border T.r,   background T.r+"18",  text T.r,   dot T.r
    MEDIUM → border T.o,   background T.o+"14",  text T.o,   dot T.o
    LOW    → border T.g2,  background T.g2+"14", text T.g2,  dot T.g2
    NONE   → border T.g4,  background transparent, text T.muted
  Render:
    <span padding="3px 10px" borderRadius=3 border fontSize=10 letterSpacing=.15em>
      <span className="pulse-dot" style={dot color, 5x5, borderRadius 50%} />
      &nbsp; THREAT: {level}
    </span>
  Pulse-dot only shows when level !== "NONE"

Nav bar container: unchanged (sticky, top 0, zIndex 100, backdropFilter blur(12px),
  borderBottom 1px T.brd, background T.s1+"f0")

Update all three Page files to pass the new props:
  In DashboardPage.jsx, derive threatLevel from:
    summary.alerts_high > 0 ? "HIGH" :
    summary.alerts_medium > 0 ? "MEDIUM" :
    summary.alerts_low > 0 ? "LOW" : "NONE"
  Pass highAlerts={summary.alerts_high} totalAlerts={summary.alerts_total}
  Do the same in LandingPage.jsx and ArchitecturePage.jsx using summary data.
```

---

## PROMPT 5 — `components/ChartPanel.jsx`

**Current state:** Loading state shows a blinking cursor text. That's it.

**Target state:** Shimmer skeleton loading state. Error state with retry button.
Proper header with optional legend slots.

**Exact instruction for Codex:**

```
Rewrite showcase/src/components/ChartPanel.jsx completely.

Props:
  title: string
  subtitle: string (optional)
  error: string | null
  lastOk: Date | null
  loading: boolean
  children: ReactNode
  minHeight: number (default 200)
  legend: array of {label, color} (optional) — rendered as inline legend row
  onRetry: function (optional) — shows retry button in error state

SHIMMER LOADING STATE (when loading && !error):
  Show 3 shimmer bars stacked vertically, each:
    height: 14px, borderRadius: 3, marginBottom: 8
    background: linear-gradient(90deg, T.s2 25%, T.s3 50%, T.s2 75%)
    backgroundSize: 200% 100%
    animation: shimmer 1.6s linear infinite
  First bar width: 80%, second: 60%, third: 40%
  Wrap in a div with minHeight padding vertically centered

ERROR STATE (when error):
  Red tinted box:
    background: T.r+"10", border: 1px T.r+"33", borderRadius 3, padding 10px
    Row 1: "⚠ API ERROR" in T.r 10px + error message in T.muted 10px
    Row 2: if lastOk, "last successful data: {N}s ago" in T.muted 9px
    Row 3: if onRetry, a small retry button: "RETRY ↺" nav-btn class T.o color

NORMAL STATE:
  Just render {children}

LEGEND ROW (if legend prop provided, rendered below title/before children):
  display flex, gap 16, marginBottom 10
  For each {label, color}:
    <span display=flex alignItems=center gap=6 fontSize=11 color=T.muted>
      <span width=10 height=10 borderRadius=2 background={color} display=inline-block />
      {label}
    </span>

LAST UPDATED LINE:
  Below children (or error box):
  If lastOk: "updated {N}s ago" in 9px T.muted textAlign=right
  Recompute N every 5 seconds using setInterval inside a useState

PANEL WRAPPER:
  background: T.s1
  border: 1px solid T.brd
  borderRadius: 4
  padding: 18px
  
HEADER:
  title: 10px T.muted letterSpacing .16em marginBottom 4
  subtitle (if provided): 10px T.g4 marginBottom 10
  legend (if provided): legend row
```

---

## PROMPT 6 — `pages/DashboardPage.jsx` — Charts and Layout

**Current state:** 6 plain Recharts, basic layout, boring colors.

**Target:** All charts heavily customized. Better layout. New Threat Radar panel.
Beaconing IAT chart. Live scrolling query log.

**Exact instruction for Codex:**

```
Open showcase/src/pages/DashboardPage.jsx.

You are NOT restructuring the data-fetching or API logic.
You are ONLY upgrading the visual rendering.
Keep all existing hooks: useSummary, useCharts, useAlerts, useQueries, useRealtimeSignals.
Keep all fallback logic (FALLBACK_* imports).
Keep the realtime stream status bar.

─── SECTION 1: KPI ROW ───────────────────────────────────────────────────

Replace the 5 plain <KPI> calls with upgraded versions using the new KPI props.

Derive delta values by comparing current vs previous using a useRef:

  const prevSummary = useRef(null)
  useEffect(() => { prevSummary.current = summary }, [summary])

  alertDelta = summary.alerts_total - (prevSummary.current?.alerts_total || 0)

Pass spark arrays if charts.kpi_trend exists (array of recent totals).
Otherwise don't pass spark — it's optional.

KPI row grid: repeat(5, minmax(100px, 1fr)) gap 12

─── SECTION 2: MAIN CHART ROW ────────────────────────────────────────────

Layout: grid-template-columns "1.6fr 1fr" gap 12

LEFT: Traffic Over Time (AreaChart)
  Add ChartPanel with legend=[{label:"Normal",color:T.g1},{label:"Suspicious",color:T.r}]
  
  Customize the AreaChart:
    Add <defs> with two <linearGradient> elements:
      "gradNormal": T.g1 at 0% opacity .4 → T.g1 at 95% opacity 0
      "gradSusp":   T.r  at 0% opacity .4 → T.r  at 95% opacity 0
    Area for "normal":     stroke=T.g1 strokeWidth=2 fill="url(#gradNormal)"
    Area for "suspicious": stroke=T.r  strokeWidth=2 fill="url(#gradSusp)"
    
    CartesianGrid: stroke=T.brd strokeDasharray="2 4"
    XAxis: tick fill=T.muted fontSize=9, stroke=T.brd
    YAxis: tick fill=T.muted fontSize=10, stroke=T.brd, width=30
    
    Custom Tooltip:
      Create a CustomTrafficTooltip component that renders a styled div:
        background T.s1, border 1px T.brd, borderRadius 4, padding "8px 12px"
        font Share Tech Mono 11px, color T.txt
        Show time, normal count, suspicious count each on own line
        Color "normal" value T.g1, "suspicious" value T.r

RIGHT: Severity Donut (PieChart)
  Change outerRadius to 75, ADD innerRadius={50}
  This makes it a donut, not a pie.
  
  In the center of the donut, overlay a <text> showing total alert count:
    Use a custom label render or position a div with absolute positioning
    over the ResponsiveContainer.
    Actually: use Recharts customized label on center:
      Add a <text> element at cx/cy via customized active shape, OR
      Use a simple absolute-positioned div centered over the chart div:
        position: "relative", height: 180
        inside: ResponsiveContainer
        inside: a div position=absolute inset=0 display=flex alignItems=center
                justifyContent=center pointerEvents=none
          showing: total alert count in T.txt 20px fontWeight 700
                   below it: "ALERTS" in T.muted 8px letterSpacing .2em
  
  Add ChartPanel with no legend (severity is self-explanatory from colors)
  
─── SECTION 3: DISTRIBUTION CHARTS ──────────────────────────────────────

Two-column grid (1fr 1fr) gap 12

LEFT: Entropy Distribution
  Pass legend=[{label:"Benign",color:T.g1},{label:"Malicious",color:T.r}] to ChartPanel
  
  In the BarChart:
    Remove CartesianGrid
    Bar for "normal":     fill=T.g3 opacity=0.85 radius=[2,2,0,0]
    Bar for "suspicious": fill=T.r  opacity=0.85 radius=[2,2,0,0]
    XAxis: interval=2 (skip every other label to avoid cramping)
    Add a <ReferenceLine x={3.8} stroke={T.r} strokeDasharray="3 3"
      label={{ value: "threshold", fill: T.r, fontSize: 8, position: "top" }} />
    This visually marks the entropy detection threshold.

RIGHT: Query Length Distribution  
  Same style as entropy chart.
  Bar "normal": fill=T.g3, Bar "suspicious": fill=T.o
  Add ReferenceLine x=75 (the query length rule threshold):
    stroke=T.o strokeDasharray="3 3"
    label={{ value: "R001 limit", fill: T.o, fontSize: 8, position: "top" }}

─── SECTION 4: ATTACK BREAKDOWN + TOP HOSTS ROW ─────────────────────────

Two-column grid (1fr 1fr) gap 12

LEFT: Attack Type Breakdown (horizontal BarChart)
  For each bar, use a different color by attack type:
    Create a colorByType function:
      "beaconing"     → T.r
      "exfiltration"  → T.o
      "dga"           → T.y
      "tunneling"     → T.b
      default         → T.g2
  Use <Cell> inside <Bar> to assign per-entry colors.
  Add radius=[0,3,3,0] on bars.
  Remove CartesianGrid horizontal lines, keep vertical.
  YAxis width=110

RIGHT: Top Hosts (horizontal BarChart)
  Color bars by score:
    score >= 70 → T.r
    score >= 40 → T.o
    else        → T.g2
  Use <Cell> per bar.
  Add radius=[0,3,3,0]
  Add a <ReferenceLine x={70} stroke={T.r} strokeDasharray="3 3"
    label={{ value: "HIGH", fill: T.r, fontSize: 8, position: "insideTopRight" }} />

─── SECTION 5: ALERTS PANEL ──────────────────────────────────────────────

Keep existing logic (liveAlerts state, realtime merge, dedup).

Header row upgrades:
  Left: "ACTIVE ALERTS" in 10px T.muted letterSpacing .16em
  Right side: show three badges inline:
    "{alerts_high} HIGH" → T.r pill
    "{alerts_medium} MED" → T.o pill  
    "{alerts_low} LOW"  → T.g2 pill
  These come from summary (not liveAlerts.length) for accuracy.
  
  Pill style: padding 2px 8px, border 1px, borderRadius 3, fontSize 10

No other logic changes — AlertCard handles all the visual work now.

─── SECTION 6: QUERY LOG ─────────────────────────────────────────────────

Upgrade the query table:

Add a search/filter input above the table:
  <input
    placeholder="FILTER QUERIES..."
    value={queryFilter} onChange={e => setQueryFilter(e.target.value)}
    style={{
      width: "100%", marginBottom: 10,
      background: T.s2, border: `1px solid ${T.brd}`,
      borderRadius: 3, padding: "7px 12px",
      fontFamily: "inherit", fontSize: 11, color: T.txt,
      outline: "none",
    }}
  />

Add useState queryFilter = "" and filter queries:
  const filteredQueries = queries.filter(q =>
    !queryFilter ||
    (q.query_name || "").toLowerCase().includes(queryFilter.toLowerCase()) ||
    (q.src_ip || "").includes(queryFilter)
  )

Table row upgrades:
  For suspicious rows (q.status === "suspicious" or q.label === 1):
    Row background: T.r + "08"
    query_name cell: color T.r
    Add a status badge in Status column:
      determine badge color/text from q.attack_type:
        "beaconing"    → T.o, "BEACON"
        "exfiltration" → T.r, "EXFIL"  
        "dga"          → T.y, "DGA"
        "attack"       → T.r, "ATTACK"
        else (normal)  → T.g2, "NORMAL"
      Badge: padding 1px 7px border 1px borderRadius 2 fontSize 9

  For normal rows: query_name T.txt, status badge T.g2 "NORMAL"

  Add max-height: 340px overflow-y: auto to tbody wrapper
  
  Table header: add sort indicators (visual only, no actual sort needed):
    Just "TIME ↕" "SOURCE ↕" etc in the th text — static decorative
```

---

## PROMPT 7 — `pages/LandingPage.jsx`

**Current state:** Hero is decent. Detection cards are 3 generic boxes.
No live threat panel. Ticker text appears instantly.

**Target:** Ticker scrolls horizontally (marquee-style). Live HIGH alerts panel
below hero. Detection cards show real numbers from API.

**Exact instruction for Codex:**

```
Open showcase/src/pages/LandingPage.jsx.

─── CHANGE 1: HERO TICKER ────────────────────────────────────────────────

Replace the static ticker text rendering with a horizontal scroll animation.

The ticker container (bottom of hero section) currently shows:
  tickers[tickIdx] as static text

Replace with a horizontally scrolling marquee effect:
  Show ALL tickers as one long string separated by " ◆ " (with spaces).
  Join: tickers.join(" ◆ ")
  
  Wrap in a div with overflow hidden.
  Inside: a span that animates transform: translateX from 0 to -50%
  Duplicate the string twice so it loops seamlessly:
    <span style={{ display: "inline-block", animation: "marquee 28s linear infinite", whiteSpace: "nowrap" }}>
      {tickerStr} &nbsp;&nbsp;&nbsp; {tickerStr}
    </span>
  
  Add to GLOBAL_CSS:
    @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }

  Remove the tickIdx state and the setTickIdx interval — no longer needed.

─── CHANGE 2: DETECTION CARDS ────────────────────────────────────────────

The current DETECTION_CARDS array has 3 items with generic descriptions.

Expand to 4 items (add DGA Scanning as 4th).
For each card, add a `stat` field showing a live number:
  { title: "Beaconing Detection",    color: T.r, stat: summary?.alerts_high || 0,  statLabel: "HIGH alerts" }
  { title: "Exfiltration Signals",   color: T.o, stat: summary?.queries_suspicious || 0, statLabel: "suspicious queries" }
  { title: "DGA Sweep Detection",    color: T.y, stat: summary?.unique_hosts || 0, statLabel: "hosts tracked" }
  { title: "ML Classification",      color: T.b, stat: summary?.tests_passed || 0, statLabel: "tests passing" }

Card rendering upgrade — add a live stat at the bottom of each card:
  A separator line (1px T.brd, marginY 10)
  A number in 20px fontWeight 700 colored by card's color
  Below it: statLabel in 9px T.muted letterSpacing .15em

Grid: repeat(auto-fit, minmax(200px, 1fr)) — 4 cards now

─── CHANGE 3: LIVE ALERTS PREVIEW SECTION ────────────────────────────────

Add a new section AFTER the detection cards section (before closing </div>):

Section heading row:
  Left: "LATEST HIGH SEVERITY ALERTS" in 10px T.r letterSpacing .3em
  Right: "VIEW ALL →" button (nav-btn) that calls onNavigate("dashboard")

Content:
  Filter alerts for HIGH severity only: const highAlerts = (alerts||[]).filter(a => a.severity==="HIGH").slice(0,3)
  
  If highAlerts.length === 0:
    <div style={{ color: T.muted, fontSize: 12, padding: "20px 0" }}>No HIGH alerts active. System nominal.</div>
  
  Else: render each high alert as a compact row (NOT a full AlertCard — a slim version):
    <div key={a.alert_id} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 14px", marginBottom: 6,
      background: T.s1, border: `1px solid ${T.r}22`,
      borderLeft: `3px solid ${T.r}`, borderRadius: 3,
    }}>
      <span style={{ color: T.r, fontSize: 10, minWidth: 50 }}>[HIGH]</span>
      <span style={{ color: T.txt, fontSize: 11, flex: 1 }}>{a.src_host} → {a.domain}</span>
      <span style={{ color: T.r, fontSize: 14, fontWeight: 700 }}>{Number(a.total_score||0).toFixed(0)}</span>
      <span style={{ color: T.muted, fontSize: 9 }}>
        {new Date(a.timestamp).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
      </span>
    </div>

Section container: maxWidth 1100, margin "0 auto", padding "44px 24px"

─── CHANGE 4: SECTION DIVIDER STYLING ────────────────────────────────────

Between the hero section and detection cards section,
add a full-width visual separator:
  <div style={{ width: "100%", height: 1, background: `linear-gradient(90deg, transparent, ${T.g4}, transparent)` }} />

Between detection cards and live alerts section, same separator.

No other changes to data fetching, counter animations, or navigation buttons.
```

---

## PROMPT 8 — `pages/ArchitecturePage.jsx`

**Current state:** SVG nodes are plain rectangles. No animation. No system health.
Arrows are static dashes.

**Target:** Animated data-flow dots along arrows when a node is selected.
System health strip at bottom. Better node hover states.

**Exact instruction for Codex:**

```
Open showcase/src/pages/ArchitecturePage.jsx.

─── CHANGE 1: ANIMATED DATA-FLOW DOTS ───────────────────────────────────

When a node is selected, show animated dots traveling along the edges
connected to that node.

Implementation:
  Add state: const [animTick, setAnimTick] = useState(0)
  useEffect: when selected !== null, start interval(50ms) incrementing animTick
             when selected === null, clear interval

  For each ARROW [from, to]:
    const isActive = selected === from || selected === to
    if (isActive):
      Compute a point along the line at progress t (0→1 cycling):
        t = (animTick % 60) / 60
        dotX = a.x + (b.x - a.x) * t
        dotY = a.y + (b.y - a.y) * t
      Render: <circle cx={dotX} cy={dotY} r={3} fill={T.g1} opacity={0.9} />
      Render: <circle cx={dotX} cy={dotY} r={6} fill={T.g1} opacity={0.2} />
      (inner solid dot + outer glow circle)

  These circles go AFTER the lines in the SVG render order.

─── CHANGE 2: NODE HOVER ENHANCEMENT ────────────────────────────────────

Add useState hovered = null alongside selected.
On <g> elements: add onMouseEnter={() => setHovered(m.id)} onMouseLeave={() => setHovered(null)}

For hovered nodes (not selected):
  rect: stroke = T.g4 (slightly brighter than T.brd), strokeWidth 1
  Add a subtle outer glow: render a second rect behind it:
    same position, width, height, rx
    fill="none"
    stroke={m.color}
    strokeWidth=6
    opacity=0.08
    (this is the glow halo)

─── CHANGE 3: SYSTEM HEALTH BAR ─────────────────────────────────────────

After the module grid section, add a new system health section.

Source data: systemQ.data?.health or derive from systemQ.data

Show a row of health indicators:
  const healthItems = [
    { label: "API",        ok: !!systemQ.data,                   detail: "port 8000" },
    { label: "ALERTS DB",  ok: system?.db_alerts_total > 0,      detail: `${system?.db_alerts_total||0} records` },
    { label: "ML MODEL",   ok: system?.model_loaded,              detail: system?.model_path?.split("/").pop() || "—" },
    { label: "PIPELINE",   ok: system?.pipeline_ok,              detail: system?.mode || "DEMO" },
    { label: "TESTS",      ok: system?.tests_ok,                 detail: `${system?.tests_passed||0}/${system?.tests_total||0}` },
  ]

Each indicator:
  <div style={{
    padding: "10px 14px", background: T.s1,
    border: `1px solid ${item.ok ? T.g4 : T.r+"44"}`,
    borderTop: `2px solid ${item.ok ? T.g1 : T.r}`,
    borderRadius: 4, flex: 1,
  }}>
    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background: item.ok ? T.g1 : T.r, display:"inline-block" }} className={item.ok ? "pulse-dot" : ""} />
      <span style={{ fontSize:9, color:T.muted, letterSpacing:".15em" }}>{item.label}</span>
    </div>
    <div style={{ fontSize:10, color: item.ok ? T.g1 : T.r }}>
      {item.ok ? "OPERATIONAL" : "DEGRADED"}
    </div>
    <div style={{ fontSize:9, color:T.muted, marginTop:2 }}>{item.detail}</div>
  </div>

Container: display flex, gap 10, marginTop 20
Section label: "SYSTEM HEALTH" in 10px T.g4 letterSpacing .3em marginBottom 10

─── CHANGE 4: DETAIL PANEL UPGRADE ──────────────────────────────────────

In the right detail panel (shown when sel !== null):

Add a visual score bar for each stat:
  Each stat is just a string currently (e.g. "Rules R001-R008")
  Keep the text but add a thin 2px colored line before each:
    <div style={{ display:"flex", gap:8, alignItems:"flex-start", padding:"5px 0", borderBottom:`1px solid ${T.brd}33` }}>
      <div style={{ width:2, minWidth:2, height:12, background:sel.color, borderRadius:1, marginTop:2 }} />
      <div style={{ fontSize:12, color:T.txt }}>{s}</div>
    </div>

Change "VIEW IN DASHBOARD ->" button to include an arrow that animates on hover:
  Add onMouseEnter/Leave state to show "→" sliding right on hover
  (just change button text from "VIEW IN DASHBOARD →" to "VIEW IN DASHBOARD ⟶"
   and add transform: translateX(3px) on hover with transition)
```

---

## PROMPT 9 — Final integration pass

**This prompt is for cleanup and wiring the new props together.**

```
Open ALL THREE page files (LandingPage.jsx, DashboardPage.jsx, ArchitecturePage.jsx)
and make these final changes:

1. NAV PROPS — In all three pages, compute and pass threatLevel, highAlerts,
   totalAlerts to <Nav>:

   const threatLevel = (summary?.alerts_high > 0) ? "HIGH" :
                       (summary?.alerts_medium > 0) ? "MEDIUM" :
                       (summary?.alerts_low > 0) ? "LOW" : "NONE"
   
   <Nav
     page="..."
     onNavigate={onNavigate}
     liveQueries={summary?.queries_total || 0}
     lifetimeQueries={summary?.queries_lifetime || 0}
     mode={summary?.mode || "DEMO_FEED"}
     threatLevel={threatLevel}
     highAlerts={summary?.alerts_high || 0}
     totalAlerts={summary?.alerts_total || 0}
   />

2. CHARTPANEL RETRY — In DashboardPage.jsx, pass onRetry to each ChartPanel:
   onRetry={() => chartsQ.refresh?.()}
   (This requires exposing refresh from useCharts — check useApi.js,
    the useFetch hook already returns refresh. Just destructure it:
    const { data: chartsData, error: chartsError, loading: chartsLoading,
            lastOk: chartsLastOk, refresh: chartsRefresh } = useCharts()
    Then pass onRetry={chartsRefresh} to each ChartPanel)

3. ALERT CARDS ENTER ANIMATION — In DashboardPage.jsx, when liveAlerts changes
   (new alerts arrive), the new items at the top of the list should have
   className="alert-card-enter" on their AlertCard wrapper.
   Track which alert_ids are "new" using a useRef Set:
     const newAlertIds = useRef(new Set())
     When realtimeQ.newAlerts fires, add their IDs to newAlertIds.current
     After 600ms, clear them (setTimeout to reset Set).
   Pass isNew={newAlertIds.current.has(a.alert_id)} to AlertCard.
   In AlertCard, if isNew prop: add className="alert-card-enter" to outer div.

4. QUERY LOG FILTER — Make sure queryFilter state is initialized in DashboardPage:
   const [queryFilter, setQueryFilter] = useState("")
   This was added in Prompt 6 but needs to be declared at the top of the component.

5. DATA_SOURCE LABEL — In DashboardPage, above the KPI row, add a one-line
   mode indicator:
   <div style={{ marginBottom: 10, fontSize: 9, color: T.muted, letterSpacing: ".2em" }}>
     DATA SOURCE: {summary?.data_source || "DEMO_FEED"} &nbsp;·&nbsp;
     {new Date().toLocaleDateString()} &nbsp;·&nbsp;
     SENTINEL DNS-IDS
   </div>
```

---

## Apply Order (for Codex)

```
1. styles/theme.js          ← Prompt 1  (foundation, other files depend on it)
2. components/KPI.jsx       ← Prompt 2
3. components/AlertCard.jsx ← Prompt 3
4. components/Nav.jsx       ← Prompt 4
5. components/ChartPanel.jsx← Prompt 5
6. pages/DashboardPage.jsx  ← Prompt 6
7. pages/LandingPage.jsx    ← Prompt 7
8. pages/ArchitecturePage.jsx ← Prompt 8
9. All three pages (wiring) ← Prompt 9
```

After all prompts: run `cd showcase && npm run build` — must compile with 0 errors.

---

## What You'll Have After All Prompts

| Component | Before | After |
|---|---|---|
| KPI | Static number | Animated count-up + delta badge + sparkline |
| AlertCard | Same-color text wall | Color-coded by source (Rule/Behavior/ML), score bar, expand animation |
| Nav | No threat level | ThreatPill showing live severity, alert count badge |
| ChartPanel | Blinking cursor loading | Shimmer skeleton, error retry, last-updated timestamp |
| Traffic chart | Plain area | Gradient fill, custom tooltip, animated |
| Severity | Solid pie | Donut with total count in center |
| Entropy chart | Plain bars | Reference line at threshold 3.8 |
| Query length | Plain bars | Reference line at R001 limit (75) |
| Attack breakdown | Orange bars only | Per-type colors via Cell |
| Top hosts | Blue bars only | Score-colored bars + HIGH threshold line |
| Alerts panel | Plain list | Severity count badges in header, slide-in animation |
| Query log | Minimal table | Filterable, colored rows, attack-type badges |
| Landing hero | Static ticker | Scrolling horizontal marquee |
| Landing cards | 3 generic boxes | 4 cards with live API stat numbers |
| Landing page | Hero + cards | Hero + cards + Live HIGH alerts preview panel |
| Architecture SVG | Static nodes | Animated flow dots on selected edges |
| Architecture nodes | Plain rectangles | Hover glow halos |
| Architecture page | No system status | System health strip (5 indicators) |
| Detail panel | Text stats | Colored accent lines per stat |

---

## Quick Sanity Tests After Each Prompt

After each prompt, run this in the showcase directory:

```bash
# Compile check — should be 0 errors
npm run build 2>&1 | grep -E "ERROR|error" | grep -v "node_modules"

# Start dev and visually check
npm start
```

For KPI: check that number animates when you manually change a value
For AlertCard: check that "[Rule ...]" text is red, "[ML ...]" text is blue
For Nav: check that ThreatPill shows RED when any HIGH alerts exist
For Charts: verify entropy chart shows the vertical reference line at 3.8
For ArchitecturePage: click a node and verify dots animate along connected arrows
