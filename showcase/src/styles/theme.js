export const T = {
  bg: "#060c09",
  s1: "#0a1510",
  s2: "#0f1e14",
  s3: "#142619",
  g1: "#00ff41",
  g2: "#00cc33",
  g3: "#009922",
  g4: "#1a4a25",
  r: "#ff2244",
  o: "#ff7700",
  b: "#00aaff",
  y: "#ffcc00",
  txt: "#b8f0c8",
  muted: "#4a7a5a",
  brd: "#1a3323",
}

export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: ${T.bg};
    color: ${T.txt};
    font-family: 'Share Tech Mono', 'Courier New', monospace;
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: ${T.s1}; }
  ::-webkit-scrollbar-thumb { background: ${T.g4}; border-radius: 3px; }

  @keyframes glitch {
    0%,88%,100% { clip-path:none; transform:none; color:${T.g1}; }
    89% { clip-path:polygon(0 22%,100% 22%,100% 38%,0 38%); transform:translate(-4px,2px); color:${T.r}; }
    90% { clip-path:polygon(0 62%,100% 62%,100% 76%,0 76%); transform:translate(4px,-2px); color:${T.b}; }
    91% { clip-path:none; transform:none; color:${T.g1}; }
  }

  @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.75)} }
  @keyframes fadeUp    { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes shimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes draw      { from{stroke-dashoffset:1000} to{stroke-dashoffset:0} }
  @keyframes slideInRight { from{transform:translateX(40px);opacity:0} to{transform:translateX(0);opacity:1} }
  @keyframes countUp   { from{opacity:1} to{opacity:1} }
  @keyframes flowDot   { 0%{opacity:0} 20%{opacity:1} 80%{opacity:1} 100%{opacity:0} }
  @keyframes marquee   { from{transform:translateX(0)} to{transform:translateX(-50%)} }

  .glitch    { animation: glitch 9s infinite; }
  .pulse-dot { animation: pulse-dot 1.8s ease-in-out infinite; }
  .fade-up   { animation: fadeUp .5s ease both; }
  .blink     { animation: blink 1.1s step-end infinite; }
  .slide-in-right { animation: slideInRight .35s ease both; }
  .flow-dot { animation: flowDot 2s linear infinite; }
  .shimmer-line {
    background: linear-gradient(90deg, ${T.s2} 25%, ${T.s3} 50%, ${T.s2} 75%);
    background-size: 200% 100%;
    animation: shimmer 1.6s linear infinite;
  }
  .alert-card-enter { animation: slideInRight .3s ease both; }
  .query-row-attack { animation: fadeUp .4s ease both; }

  .nav-btn {
    background:transparent; border:1px solid ${T.brd}; color:${T.muted};
    padding:6px 14px; border-radius:3px; font-family:inherit; font-size:11px;
    cursor:pointer; letter-spacing:.1em; transition:color .15s,border-color .15s;
  }
  .nav-btn:hover { color:${T.g1}; border-color:${T.g1}; }

  .module-node { cursor: pointer; transition: opacity .15s; }
  .module-node:hover rect { stroke-width: 2 !important; }
`
