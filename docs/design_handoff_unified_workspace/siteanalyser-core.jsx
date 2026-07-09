/* SiteAnalyser — core atoms: extra icons, benchmark visuals, affluence gauge,
   census table primitives, and the LSOA catchment map overlay.
   Reuses SS tokens, Ico, MapBackdrop, SMLogo from sitesketcher-core.jsx. */

/* Semantic colours layered on top of the SiteSketcher palette */
const SA = {
  up: "#16A34A",      // above UK average (positive delta)
  upBg: "#DCFCE7",
  down: "#DC2626",    // below UK average
  downBg: "#FEE2E2",
  flat: "#7C7588",
  // LSOA catchment fills (violet family, brand-anchored)
  lsoaFill: "rgba(112, 51, 255, 0.30)",
  lsoaFillSoft: "rgba(112, 51, 255, 0.16)",
  lsoaStroke: "#FFFFFF",
  lsoaOff: "rgba(20, 16, 26, 0.16)",
  // Catchment ring
  ring: "#7033FF",
  // Traffic heat ramp (low → high)
  traffic: ["#16A34A", "#84CC16", "#F59E0B", "#F26B1F", "#DC2626"],
};

/* === Extra icons not in the SiteSketcher Ico set === */
const AIco = ({ name, size = 16, color }) => {
  const c = color || "currentColor";
  const props = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: c, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "users":     return <svg {...props}><circle cx="6" cy="5.5" r="2.3"/><path d="M2.5 13a3.5 3.5 0 0 1 7 0"/><path d="M10.5 3.6a2.3 2.3 0 0 1 0 4.3M11 13a3.5 3.5 0 0 0-1.6-2.9"/></svg>;
    case "home":      return <svg {...props}><path d="M2.5 7L8 2.5L13.5 7"/><path d="M4 6.5V13h8V6.5"/><path d="M6.5 13V9.5h3V13"/></svg>;
    case "wallet":    return <svg {...props}><rect x="2" y="4" width="12" height="9" rx="1.5"/><path d="M2 6.5h12"/><circle cx="11" cy="9.5" r="0.9" fill={c} stroke="none"/></svg>;
    case "briefcase": return <svg {...props}><rect x="2.5" y="5" width="11" height="8" rx="1.2"/><path d="M6 5V3.8a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V5"/><path d="M2.5 8.5h11"/></svg>;
    case "cap":       return <svg {...props}><path d="M8 3L14.5 6L8 9L1.5 6L8 3Z"/><path d="M4.5 7.2V10.5C4.5 11.3 6 12.5 8 12.5S11.5 11.3 11.5 10.5V7.2"/></svg>;
    case "car":       return <svg {...props}><path d="M2.5 10.5V8.5L4 5.5a1 1 0 0 1 .9-.5h6.2a1 1 0 0 1 .9.5L13.5 8.5v2"/><rect x="1.8" y="10" width="12.4" height="2.3" rx="0.8"/><circle cx="4.6" cy="12.3" r="1.1" fill={c} stroke="none"/><circle cx="11.4" cy="12.3" r="1.1" fill={c} stroke="none"/></svg>;
    case "road":      return <svg {...props}><path d="M5 2.5L3 13.5M11 2.5L13 13.5M8 4v1.5M8 8v1.5M8 12v1.5"/></svg>;
    case "info":      return <svg {...props}><circle cx="8" cy="8" r="6"/><path d="M8 7.2V11"/><circle cx="8" cy="5.2" r="0.5" fill={c} stroke="none"/></svg>;
    case "chevdown":  return <svg {...props}><path d="M4 6L8 10L12 6"/></svg>;
    case "chevright": return <svg {...props}><path d="M6 4L10 8L6 12"/></svg>;
    case "arrowup":   return <svg {...props}><path d="M8 13V3M4 7l4-4 4 4"/></svg>;
    case "arrowdown": return <svg {...props}><path d="M8 3v10M4 9l4 4 4-4"/></svg>;
    case "bars":      return <svg {...props}><path d="M3 13V8M7 13V3M11 13V6"/></svg>;
    case "sliders":   return <svg {...props}><path d="M3 5h6M11 5h2M3 11h2M7 11h6"/><circle cx="10" cy="5" r="1.4"/><circle cx="6" cy="11" r="1.4"/></svg>;
    case "download":  return <svg {...props}><path d="M8 2.5v7M5 7l3 3 3-3"/><path d="M3 11.5v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1"/></svg>;
    case "target":    return <svg {...props}><circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2.4"/><circle cx="8" cy="8" r="0.6" fill={c} stroke="none"/></svg>;
    case "walk":      return <svg {...props}><circle cx="8.5" cy="3" r="1.3"/><path d="M8.5 5L7 8.5l-2 1M8.5 5l1.5 2 2 .8M7 8.5L5.5 13.5M9.2 7L10 13.5"/></svg>;
    case "clock":     return <svg {...props}><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg>;
    case "doc":       return <svg {...props}><path d="M4 2.5h5L12.5 6v7.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z"/><path d="M9 2.5V6h3.5"/><path d="M5.5 9h5M5.5 11h5"/></svg>;
    case "lock":      return <svg {...props}><rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>;
    case "filter":    return <svg {...props}><path d="M2.5 3.5h11l-4.2 5v4l-2.6 1.3v-5.3z"/></svg>;
    default: return null;
  }
};

/* === SiteAnalyser wordmark (mirrors SMLogo but says "/ Analyser") === */
const SALogo = ({ height = 20 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <svg height={height} viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
      <g fill={SS.violet}>
        <path d="M2.61,37.02a1.46,1.46,0,0,1-.11-.55V4A1.5,1.5,0,0,1,4,2.5H15.77a1.5,1.5,0,0,1,1.06.44L27.18,13.29a1.5,1.5,0,0,1,0,2.12L5.06,37.53A1.51,1.51,0,0,1,2.61,37.02Z"/>
        <path d="M61.5,4V15.77a1.8,1.8,0,0,1-.11.57,1.63,1.63,0,0,1-.33.49L50.71,27.18a1.51,1.51,0,0,1-2.12,0L26.47,5.06a1.52,1.52,0,0,1,.49-2.45,1.79,1.79,0,0,1,.57-.11L60,2.5A1.5,1.5,0,0,1,61.5,4Z"/>
        <path d="M61.39,26.98a1.46,1.46,0,0,1,.11.55V60A1.5,1.5,0,0,1,60,61.5H48.23a1.51,1.51,0,0,1-1.06-.44L36.82,50.71a1.5,1.5,0,0,1,0-2.12L58.94,26.47A1.51,1.51,0,0,1,61.39,26.98Z"/>
        <path d="M19.17,30.94,30.94,19.17a1.51,1.51,0,0,1,2.12,0L44.83,30.94a1.51,1.51,0,0,1,0,2.12L33.06,44.83a1.52,1.52,0,0,1-2.12,0L19.17,33.06A1.51,1.51,0,0,1,19.17,30.94Z"/>
        <path d="M37.86,59.45a1.51,1.51,0,0,1-1.39,2.05L4,61.5A1.5,1.5,0,0,1,2.5,60V48.23a1.81,1.81,0,0,1,.11-.57,1.63,1.63,0,0,1,.33-.49L13.29,36.82a1.55,1.55,0,0,1,2.12,0L37.53,58.94A1.29,1.29,0,0,1,37.86,59.45Z"/>
      </g>
    </svg>
    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: height * 0.68, color: SS.ink, letterSpacing: -0.3 }}>SiteMatcher</span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, letterSpacing: 1, textTransform: "uppercase" }}>/ Analyser</span>
    </div>
  </div>
);

/* === Delta chip — area value vs UK average === */
const Delta = ({ value, suffix = "%", invert = false }) => {
  // value is signed delta in percentage points
  const isUp = value > 0.05;
  const isDown = value < -0.05;
  const good = invert ? isDown : isUp;
  const color = isUp ? (invert ? SA.down : SA.up) : isDown ? (invert ? SA.up : SA.down) : SA.flat;
  if (!isUp && !isDown) {
    return <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: SA.flat, fontWeight: 500 }}>±0{suffix}</span>;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color, fontWeight: 600 }}>
      <AIco name={isUp ? "arrowup" : "arrowdown"} size={10} color={color}/>
      {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
};

/* === Benchmark bar — horizontal % bar with a UK-average tick === */
const BenchmarkBar = ({ pct, ukPct, color = SS.violet, width = 100 }) => {
  const w = Math.max(2, Math.min(100, pct));
  const tick = Math.max(0, Math.min(100, ukPct));
  return (
    <div style={{ position: "relative", width, height: 8, borderRadius: 999, background: "#EDE9E0", overflow: "visible" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${w}%`, background: color, borderRadius: 999 }}/>
      {/* UK avg tick */}
      <div style={{ position: "absolute", left: `${tick}%`, top: -2, bottom: -2, width: 2, background: SS.ink, transform: "translateX(-1px)", borderRadius: 2 }} title="UK average"/>
    </div>
  );
};

/* === Affluence gauge — 0–100 horizontal scale with marker + UK avg === */
const AffluenceGauge = ({ score = 51.2, uk = 50, width = "100%" }) => {
  const pos = Math.max(0, Math.min(100, score));
  const ukPos = Math.max(0, Math.min(100, uk));
  // colour by band
  const band = score < 35 ? "#DC2626" : score < 55 ? "#D97706" : score < 70 ? "#65A30D" : "#16A34A";
  const label = score < 35 ? "Less affluent" : score < 55 ? "Mid-market" : score < 70 ? "Comfortable" : "Affluent";
  return (
    <div style={{ width }}>
      <div style={{ position: "relative", height: 10, borderRadius: 999, overflow: "hidden",
        background: "linear-gradient(90deg, #E11D74 0%, #D97706 38%, #65A30D 64%, #16A34A 100%)", opacity: 0.85 }}/>
      <div style={{ position: "relative", height: 0 }}>
        {/* UK avg tick (above the bar) */}
        <div style={{ position: "absolute", top: -16, left: `${ukPos}%`, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, color: SS.ink3, whiteSpace: "nowrap" }}>UK {uk}</span>
        </div>
        {/* marker */}
        <div style={{ position: "absolute", top: -13, left: `${pos}%`, transform: "translateX(-50%)" }}>
          <div style={{ width: 14, height: 14, borderRadius: 999, background: "#FFF", border: `3px solid ${band}`, boxShadow: "0 1px 4px rgba(20,10,40,0.25)" }}/>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: SS.ink4 }}>
        <span>0</span>
        <span style={{ color: band, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>{label}</span>
        <span>100</span>
      </div>
    </div>
  );
};

/* === Big stat card (Population / Affluence hero) === */
const StatCard = ({ label, value, unit, icon, accent = SS.ink, sub, children, tint }) => (
  <div style={{
    padding: 14, borderRadius: 12, background: tint || SS.surface,
    border: `1px solid ${SS.border}`, display: "flex", flexDirection: "column", gap: 8,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      {icon && <span style={{ color: SS.ink3, display: "inline-flex" }}><AIco name={icon} size={13}/></span>}
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
    </div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ fontFamily: "Inter", fontSize: 28, fontWeight: 700, color: accent, letterSpacing: -1 }}>{value}</span>
      {unit && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: SS.ink3 }}>{unit}</span>}
    </div>
    {sub && <div style={{ fontFamily: "Inter", fontSize: 11.5, color: SS.ink3 }}>{sub}</div>}
    {children}
  </div>
);

/* ===========================================================================
   LSOA catchment map overlay
   Generates a deformed grid of cells (approximating LSOA boundaries), clips
   them to an irregular catchment blob, and renders selected / deselected /
   out-of-catchment states.
   =========================================================================== */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Catchment boundary radius as a function of angle (blob for walk/drive). */
function catchmentRadius(theta, baseR, mode) {
  if (mode === "distance") return baseR;
  // walk / drive: lobed isochrone following "roads"
  const lobes = mode === "drive" ? 0.30 : 0.20;
  return baseR * (1 + lobes * Math.sin(3 * theta + 0.7) * 0.6 + lobes * Math.cos(2 * theta - 1.1) * 0.5);
}

/* Build LSOA cells for a given map size + catchment. */
function buildLSOAs({ mw, mh, cx, cy, baseR, mode = "distance", seed = 7, deselect = [] }) {
  const rng = mulberry32(seed);
  const cols = 11, rows = 8;
  const stepX = (mw * 1.3) / cols, stepY = (mh * 1.3) / rows;
  const ox = -mw * 0.15, oy = -mh * 0.15;
  // grid points with jitter
  const P = [];
  for (let j = 0; j <= rows; j++) {
    P[j] = [];
    for (let i = 0; i <= cols; i++) {
      const jx = (rng() - 0.5) * stepX * 0.55;
      const jy = (rng() - 0.5) * stepY * 0.55;
      P[j][i] = { x: ox + i * stepX + jx, y: oy + j * stepY + jy };
    }
  }
  const cells = [];
  let idx = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const pts = [P[j][i], P[j][i + 1], P[j + 1][i + 1], P[j + 1][i]];
      const ccx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
      const ccy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
      const dx = ccx - cx, dy = ccy - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const theta = Math.atan2(dy, dx);
      const r = catchmentRadius(theta, baseR, mode);
      const inCatch = dist < r;
      // edge cells (just outside) partially shown for context
      const nearEdge = dist < r * 1.18;
      cells.push({
        id: idx, pts, cx: ccx, cy: ccy, dist, inCatch, nearEdge,
        selected: inCatch && !deselect.includes(idx),
      });
      idx++;
    }
  }
  return cells;
}

/* Render a single LSOA cell as SVG path */
const LSOACell = ({ cell, hover, showAll }) => {
  const path = "M " + cell.pts.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ") + " Z";
  if (!cell.inCatch && !cell.nearEdge) {
    return showAll ? <path d={path} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6"/> : null;
  }
  if (!cell.inCatch) {
    // near-edge context cell
    return <path d={path} fill="rgba(20,16,26,0.12)" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8"/>;
  }
  const fill = cell.selected
    ? (hover ? "rgba(112,51,255,0.42)" : SA.lsoaFill)
    : SA.lsoaOff;
  return (
    <path d={path} fill={fill} stroke={cell.selected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)"} strokeWidth={cell.selected ? 1.1 : 0.8}/>
  );
};

/* The catchment ring (circle for distance, blob path for walk/drive) */
const CatchmentRing = ({ cx, cy, baseR, mode = "distance", color = SA.ring }) => {
  if (mode === "distance") {
    return (
      <g>
        <circle cx={cx} cy={cy} r={baseR} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" opacity="0.95"/>
        <circle cx={cx} cy={cy} r={baseR} fill={color} fillOpacity="0.04" stroke="none"/>
      </g>
    );
  }
  // blob path
  const N = 64;
  let d = "";
  for (let k = 0; k <= N; k++) {
    const th = (k / N) * Math.PI * 2;
    const r = catchmentRadius(th, baseR, mode);
    const x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r;
    d += (k === 0 ? "M " : "L ") + `${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  d += "Z";
  return (
    <g>
      <path d={d} fill={color} fillOpacity="0.04" stroke={color} strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" opacity="0.95"/>
    </g>
  );
};

/* Centre location pin (matches SiteSketcher pin styling) */
const SitePin = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`}>
    <ellipse cx="0" cy="2" rx="7" ry="3" fill="rgba(0,0,0,0.25)"/>
    <path d="M0 -26 C 8 -26 13 -20 13 -13 C 13 -5 0 2 0 2 C 0 2 -13 -5 -13 -13 C -13 -20 -8 -26 0 -26 Z" fill={SS.violet} stroke="#FFF" strokeWidth="2"/>
    <circle cx="0" cy="-13" r="4.5" fill="#FFF"/>
  </g>
);

Object.assign(window, {
  SA, AIco, SALogo, Delta, BenchmarkBar, AffluenceGauge, StatCard,
  buildLSOAs, LSOACell, CatchmentRing, SitePin,
});
