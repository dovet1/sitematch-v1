/* SiteSketcher — core atoms: tokens, icons, map backdrop, polygon primitives */

const SS = {
  bg: "#FBFAF7",
  surface: "#FFFFFF",
  ink: "#171419",
  ink2: "#4A4451",
  ink3: "#7C7588",
  ink4: "#B5AEC0",
  border: "#E8E4DC",
  borderSoft: "#EFEBE2",
  borderHard: "#D8D2C5",
  violet: "#7033FF",
  violetDeep: "#5421CC",
  violetTint: "#EEE9FF",
  violetTintSoft: "#F5F1FF",
  orange: "#F26B1F",
  ok: "#16A34A",
  warn: "#D97706",
};

/* Polygon palette — muted, harmonious, brand-anchored */
const POLY = [
  { id: "violet",  stroke: "#7033FF", fill: "rgba(112, 51, 255, 0.18)", label: "Plot A" },
  { id: "coral",   stroke: "#F26B1F", fill: "rgba(242, 107, 31, 0.20)", label: "Plot B" },
  { id: "teal",    stroke: "#0F9488", fill: "rgba(15, 148, 136, 0.20)", label: "Plot C" },
  { id: "amber",   stroke: "#D97706", fill: "rgba(217, 119, 6, 0.20)",  label: "Plot D" },
  { id: "rose",    stroke: "#E11D74", fill: "rgba(225, 29, 116, 0.18)", label: "Plot E" },
  { id: "lime",    stroke: "#65A30D", fill: "rgba(101, 163, 13, 0.20)", label: "Plot F" },
];

/* === Icon set — 16px line, currentColor === */
const Ico = ({ name, size = 16, color }) => {
  const s = size;
  const c = color || "currentColor";
  const sw = 1.6;
  const props = { width: s, height: s, viewBox: "0 0 16 16", fill: "none", stroke: c, strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "cursor":  return <svg {...props}><path d="M3 2L13 7L8.5 8.5L7 13L3 2Z"/></svg>;
    case "polygon": return <svg {...props}><path d="M8 2L14 6L12 13H4L2 6L8 2Z"/></svg>;
    case "parking": return <svg {...props}><rect x="3" y="2" width="10" height="12" rx="1.2"/><path d="M6.5 11V5h2.2a1.8 1.8 0 1 1 0 3.6H6.5"/></svg>;
    case "cad":     return <svg {...props}><path d="M3 13L8 3L13 13H3Z"/><path d="M5.5 13L8 8L10.5 13"/></svg>;
    case "ruler":   return <svg {...props}><rect x="1.5" y="5" width="13" height="6" rx="0.8" transform="rotate(-30 8 8)"/><path d="M5 6.5L5.6 7.7M7 5.4L7.6 6.6M9 4.3L9.6 5.5M11 3.2L11.6 4.4"/></svg>;
    case "right":   return <svg {...props}><path d="M3 13V3H13"/><path d="M3 8H8V13"/></svg>;
    case "rotate":  return <svg {...props}><path d="M13 8a5 5 0 1 1-1.5-3.5"/><path d="M13 2.5V5H10.5"/></svg>;
    case "trash":   return <svg {...props}><path d="M3 4H13"/><path d="M5.5 4V2.5h5V4"/><path d="M4.5 4l.8 9.2a1 1 0 0 0 1 .9h3.4a1 1 0 0 0 1-.9L11.5 4"/></svg>;
    case "search":  return <svg {...props}><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L13.5 13.5"/></svg>;
    case "layers":  return <svg {...props}><path d="M8 1.5L14.5 5L8 8.5L1.5 5L8 1.5Z"/><path d="M2.5 8L8 10.5L13.5 8M2.5 11L8 13.5L13.5 11"/></svg>;
    case "save":    return <svg {...props}><path d="M3 2.5h8L13.5 5v8.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"/><rect x="5" y="2.5" width="6" height="4"/><rect x="5" y="9" width="6" height="5.5"/></svg>;
    case "folder":  return <svg {...props}><path d="M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5h5.5a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5Z"/></svg>;
    case "upload":  return <svg {...props}><path d="M8 11V3"/><path d="M5 6L8 3L11 6"/><path d="M3 11v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2"/></svg>;
    case "plus":    return <svg {...props}><path d="M8 3v10M3 8h10"/></svg>;
    case "minus":   return <svg {...props}><path d="M3 8h10"/></svg>;
    case "close":   return <svg {...props}><path d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5"/></svg>;
    case "check":   return <svg {...props}><path d="M3 8.5L6.5 12L13 4.5"/></svg>;
    case "more":    return <svg {...props}><circle cx="4" cy="8" r="1" fill={c} stroke="none"/><circle cx="8" cy="8" r="1" fill={c} stroke="none"/><circle cx="12" cy="8" r="1" fill={c} stroke="none"/></svg>;
    case "eye":     return <svg {...props}><path d="M1.5 8S3.5 4 8 4s6.5 4 6.5 4-2 4-6.5 4S1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/></svg>;
    case "eyeoff":  return <svg {...props}><path d="M3 3l10 10"/><path d="M6.5 5.2C7 5.1 7.5 5 8 5c4 0 6 3 6 3a10 10 0 0 1-1.6 2M10 11a6 6 0 0 1-2 .4c-4 0-6-3-6-3a10 10 0 0 1 2.4-2.6"/></svg>;
    case "cube":    return <svg {...props}><path d="M8 2L13.5 5v6L8 14L2.5 11V5L8 2Z"/><path d="M2.5 5L8 8M8 8L13.5 5M8 8V14"/></svg>;
    case "square":  return <svg {...props}><rect x="3" y="3" width="10" height="10"/></svg>;
    case "drag":    return <svg {...props}><circle cx="6" cy="4" r="0.6" fill={c} stroke="none"/><circle cx="10" cy="4" r="0.6" fill={c} stroke="none"/><circle cx="6" cy="8" r="0.6" fill={c} stroke="none"/><circle cx="10" cy="8" r="0.6" fill={c} stroke="none"/><circle cx="6" cy="12" r="0.6" fill={c} stroke="none"/><circle cx="10" cy="12" r="0.6" fill={c} stroke="none"/></svg>;
    case "pin":     return <svg {...props}><path d="M8 14s-4.5-4-4.5-7.5a4.5 4.5 0 1 1 9 0C12.5 10 8 14 8 14Z"/><circle cx="8" cy="6.5" r="1.5"/></svg>;
    case "undo":    return <svg {...props}><path d="M3.5 7.5h7a3.5 3.5 0 0 1 0 7H6"/><path d="M6 4L3 7l3 3"/></svg>;
    case "redo":    return <svg {...props}><path d="M12.5 7.5h-7a3.5 3.5 0 0 0 0 7H10"/><path d="M10 4l3 3-3 3"/></svg>;
    case "compass": return <svg {...props}><circle cx="8" cy="8" r="6"/><path d="M8 4L9.5 8L8 12L6.5 8Z" fill={c} stroke="none"/></svg>;
    case "lock":    return <svg {...props}><rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>;
    case "sparkle": return <svg {...props}><path d="M8 1.5L9.4 6.6L14.5 8L9.4 9.4L8 14.5L6.6 9.4L1.5 8L6.6 6.6L8 1.5Z" fill={c} stroke="none"/></svg>;
    case "user":    return <svg {...props}><circle cx="8" cy="5.5" r="2.5"/><path d="M3 13.5a5 5 0 0 1 10 0"/></svg>;
    case "share":   return <svg {...props}><circle cx="4" cy="8" r="1.8"/><circle cx="12" cy="4" r="1.8"/><circle cx="12" cy="12" r="1.8"/><path d="M5.5 7L10.5 4.7M5.5 9L10.5 11.3"/></svg>;
    default: return null;
  }
};

/* === SiteMatcher logo (compact) === */
const SMLogo = ({ height = 22 }) => (
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
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, letterSpacing: 1, textTransform: "uppercase" }}>/ Sketcher</span>
    </div>
  </div>
);

/* === Map backdrop — stylised satellite-ish aerial view ===
   Pure SVG so it scales cleanly inside any artboard size. */
const MapBackdrop = ({ width, height, style = "satellite", offset = { x: 0, y: 0 } }) => {
  const w = width, h = height;
  const isSatellite = style === "satellite" || style === "hybrid";
  const grass = isSatellite ? "#4F5A3E" : "#E8E5DC";
  const grassHi = isSatellite ? "#5C6948" : "#EFEBE2";
  const earth = isSatellite ? "#7A6E54" : "#E8E0CF";
  const road = isSatellite ? "#2F2D29" : "#FFFFFF";
  const roadEdge = isSatellite ? "#1A1916" : "#E0DBCF";
  const buildingA = isSatellite ? "#6B6358" : "#F0EBE0";
  const buildingB = isSatellite ? "#5A5147" : "#EAE4D7";
  const buildingC = isSatellite ? "#7D7466" : "#F4EFE4";
  const water = isSatellite ? "#2C3E50" : "#D6E4EE";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", inset: 0, display: "block" }}>
      <defs>
        <pattern id={`grass-tex-${w}`} patternUnits="userSpaceOnUse" width="40" height="40">
          <rect width="40" height="40" fill={grass}/>
          <circle cx="6" cy="9" r="1.4" fill={grassHi} opacity="0.6"/>
          <circle cx="22" cy="14" r="1" fill={grassHi} opacity="0.5"/>
          <circle cx="32" cy="28" r="1.6" fill={grassHi} opacity="0.6"/>
          <circle cx="12" cy="32" r="1" fill={grassHi} opacity="0.4"/>
        </pattern>
        <pattern id={`earth-tex-${w}`} patternUnits="userSpaceOnUse" width="60" height="60">
          <rect width="60" height="60" fill={earth}/>
          <circle cx="10" cy="12" r="2" fill={isSatellite ? "#8A7E62" : "#E0D6BF"} opacity="0.5"/>
          <circle cx="40" cy="30" r="2.4" fill={isSatellite ? "#8A7E62" : "#E0D6BF"} opacity="0.4"/>
          <circle cx="22" cy="48" r="1.8" fill={isSatellite ? "#8A7E62" : "#E0D6BF"} opacity="0.5"/>
        </pattern>
      </defs>
      {/* Base earth */}
      <rect width={w} height={h} fill={`url(#earth-tex-${w})`}/>
      <g transform={`translate(${offset.x},${offset.y})`}>
        {/* Big green parcels */}
        <path d={`M-50 ${h*0.55} L${w*0.28} ${h*0.42} L${w*0.36} ${h*0.78} L${w*0.05} ${h+50} L-50 ${h+50} Z`} fill={`url(#grass-tex-${w})`}/>
        <path d={`M${w*0.72} -50 L${w+50} -50 L${w+50} ${h*0.32} L${w*0.78} ${h*0.36} Z`} fill={`url(#grass-tex-${w})`}/>
        <ellipse cx={w*0.55} cy={h*0.18} rx={w*0.12} ry={h*0.09} fill={`url(#grass-tex-${w})`}/>
        {/* Water — a thin river curve */}
        <path d={`M-20 ${h*0.85} C ${w*0.25} ${h*0.75}, ${w*0.45} ${h*0.95}, ${w+20} ${h*0.78}`} stroke={water} strokeWidth="22" fill="none" opacity="0.95"/>
        {/* Roads — main */}
        <line x1="-20" y1={h*0.5} x2={w+20} y2={h*0.5} stroke={roadEdge} strokeWidth="28"/>
        <line x1="-20" y1={h*0.5} x2={w+20} y2={h*0.5} stroke={road} strokeWidth="22"/>
        <line x1={w*0.66} y1="-20" x2={w*0.66} y2={h+20} stroke={roadEdge} strokeWidth="22"/>
        <line x1={w*0.66} y1="-20" x2={w*0.66} y2={h+20} stroke={road} strokeWidth="16"/>
        {/* Roads — minor */}
        <line x1={w*0.18} y1="-20" x2={w*0.18} y2={h+20} stroke={roadEdge} strokeWidth="14"/>
        <line x1={w*0.18} y1="-20" x2={w*0.18} y2={h+20} stroke={road} strokeWidth="10"/>
        <line x1="-20" y1={h*0.78} x2={w+20} y2={h*0.78} stroke={roadEdge} strokeWidth="12"/>
        <line x1="-20" y1={h*0.78} x2={w+20} y2={h*0.78} stroke={road} strokeWidth="8"/>
        <line x1="-20" y1={h*0.22} x2={w+20} y2={h*0.22} stroke={roadEdge} strokeWidth="10"/>
        <line x1="-20" y1={h*0.22} x2={w+20} y2={h*0.22} stroke={road} strokeWidth="6"/>
        {/* Road dashed centerline (main only) */}
        <line x1="-20" y1={h*0.5} x2={w+20} y2={h*0.5} stroke="#E8C46A" strokeWidth="1.2" strokeDasharray="14 14" opacity={isSatellite ? 0.85 : 0}/>
        {/* Buildings — clusters of footprints */}
        {/* Top-left commercial block */}
        <g>
          <rect x={w*0.04} y={h*0.06} width={w*0.07} height={h*0.10} fill={buildingA} stroke={roadEdge} strokeWidth="0.6"/>
          <rect x={w*0.12} y={h*0.06} width={w*0.04} height={h*0.06} fill={buildingB} stroke={roadEdge} strokeWidth="0.6"/>
          <rect x={w*0.04} y={h*0.18} width={w*0.05} height={h*0.04} fill={buildingC} stroke={roadEdge} strokeWidth="0.6"/>
          <rect x={w*0.10} y={h*0.14} width={w*0.06} height={h*0.05} fill={buildingB} stroke={roadEdge} strokeWidth="0.6"/>
        </g>
        {/* Big retail box (the one being mocked typically) */}
        <rect x={w*0.36} y={h*0.30} width={w*0.18} height={h*0.14} fill={buildingC} stroke={roadEdge} strokeWidth="0.8"/>
        {/* Surrounding small */}
        <rect x={w*0.22} y={h*0.30} width={w*0.10} height={h*0.06} fill={buildingA} stroke={roadEdge} strokeWidth="0.6"/>
        <rect x={w*0.22} y={h*0.39} width={w*0.07} height={h*0.05} fill={buildingB} stroke={roadEdge} strokeWidth="0.6"/>
        {/* Lower-right industrial */}
        <g>
          <rect x={w*0.70} y={h*0.55} width={w*0.18} height={h*0.10} fill={buildingB} stroke={roadEdge} strokeWidth="0.6"/>
          <rect x={w*0.70} y={h*0.66} width={w*0.10} height={h*0.06} fill={buildingA} stroke={roadEdge} strokeWidth="0.6"/>
          <rect x={w*0.82} y={h*0.66} width={w*0.06} height={h*0.06} fill={buildingC} stroke={roadEdge} strokeWidth="0.6"/>
        </g>
        {/* Houses on a curve - lower left */}
        <g opacity="0.95">
          {Array.from({ length: 8 }).map((_, i) => (
            <rect key={i} x={w*0.02 + i*22} y={h*0.62 + (i%2)*8} width="16" height="14" fill={buildingC} stroke={roadEdge} strokeWidth="0.5"/>
          ))}
        </g>
        {/* Parking lot stripes (existing) */}
        <g>
          <rect x={w*0.36} y={h*0.46} width={w*0.18} height={h*0.06} fill={isSatellite ? "#3A3833" : "#EDEAE0"} stroke={roadEdge} strokeWidth="0.4"/>
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={i} x1={w*0.36 + 8 + i*((w*0.18-16)/12)} y1={h*0.46+4} x2={w*0.36 + 8 + i*((w*0.18-16)/12)} y2={h*0.52-4} stroke={isSatellite ? "#E8C46A" : "#C9C2B0"} strokeWidth="0.8" opacity="0.7"/>
          ))}
        </g>
        {/* Trees - scattered dots */}
        {[[w*0.06,h*0.32],[w*0.13,h*0.28],[w*0.08,h*0.4],[w*0.6,h*0.06],[w*0.62,h*0.12],[w*0.92,h*0.4],[w*0.88,h*0.48],[w*0.3,h*0.6],[w*0.35,h*0.62],[w*0.4,h*0.6],[w*0.48,h*0.62]].map(([cx,cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="6" fill={isSatellite ? "#3D4A2C" : "#C8D2B0"} opacity="0.85"/>
        ))}
        {/* Labels — hybrid only */}
        {style === "hybrid" && (
          <g fontFamily="Inter" fontSize="10" fill="#FFF" stroke="#000" strokeWidth="2.5" paintOrder="stroke" fontWeight="500">
            <text x={w*0.34} y={h*0.49} letterSpacing="0.5">HIGH ROAD</text>
            <text x={w*0.68} y={h*0.4} letterSpacing="0.5" transform={`rotate(90 ${w*0.68} ${h*0.4})`}>STATION RD</text>
            <text x={w*0.55} y={h*0.2}>OAK PARK</text>
          </g>
        )}
      </g>
    </svg>
  );
};

/* === Polygon overlay primitive ===
   pts = [{x, y}, ...] in artboard pixels. */
const SketchPolygon = ({
  pts,
  color = POLY[0],
  selected = false,
  showDistances = true,
  showHandles = false,
  showRotate = false,
  showArea = true,
  units = "metric",
  label = "Plot A",
  area, // override sq m
}) => {
  if (!pts || pts.length < 2) return null;
  const path = "M " + pts.map(p => `${p.x} ${p.y}`).join(" L ") + " Z";
  // Compute edge midpoints + distances
  const edges = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    // perpendicular outward
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    return { mx, my, len, angle };
  });
  // Bounding box for area readout placement
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const top = Math.min(...ys);
  // Shoelace area in px²
  let pxArea = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    pxArea += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  pxArea = Math.abs(pxArea) / 2;
  // Use displayed area if provided, otherwise fake-scale (1px = ~0.12m on map)
  const sqm = area != null ? area : pxArea * 0.014;
  const areaStr = units === "imperial"
    ? `${Math.round(sqm * 10.7639).toLocaleString()} ft²`
    : `${Math.round(sqm).toLocaleString()} m²`;
  const lenLabel = (px) => units === "imperial"
    ? `${(px * 0.39).toFixed(1)}ft`
    : `${(px * 0.12).toFixed(1)}m`;

  return (
    <g>
      <path d={path} fill={color.fill} stroke={color.stroke} strokeWidth={selected ? 2.4 : 1.8} strokeLinejoin="round"/>
      {/* Distance markers */}
      {showDistances && edges.map((e, i) => (
        <g key={i} transform={`translate(${e.mx} ${e.my}) rotate(${e.angle > 90 || e.angle < -90 ? e.angle + 180 : e.angle})`}>
          <rect x={-22} y={-10} width={44} height={18} rx={4} fill="rgba(23,20,25,0.88)"/>
          <text x={0} y={3} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="10" fill="#FBFAF7" letterSpacing="0.3">{lenLabel(e.len)}</text>
        </g>
      ))}
      {/* Corner handles */}
      {showHandles && pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="6" fill="#FFFFFF" stroke={color.stroke} strokeWidth="2"/>
          <circle cx={p.x} cy={p.y} r="2" fill={color.stroke}/>
        </g>
      ))}
      {/* Rotation handle */}
      {showRotate && (
        <g>
          <line x1={cx} y1={top} x2={cx} y2={top - 36} stroke={color.stroke} strokeWidth="1.5" strokeDasharray="3 3"/>
          <circle cx={cx} cy={top - 42} r="9" fill="#FFFFFF" stroke={color.stroke} strokeWidth="2"/>
          <path d={`M ${cx-3.5} ${top - 44} A 4 4 0 1 0 ${cx + 3.5} ${top - 44}`} stroke={color.stroke} strokeWidth="1.4" fill="none"/>
          <path d={`M ${cx + 3.5} ${top - 44} l 1 -2 l -2 0`} stroke={color.stroke} strokeWidth="1.4" fill="none"/>
        </g>
      )}
      {/* Area readout */}
      {showArea && (
        <g transform={`translate(${cx} ${cy})`}>
          <rect x={-44} y={-14} width={88} height={28} rx={6} fill="#FFFFFF" stroke={color.stroke} strokeWidth="1.4"/>
          <text x={-36} y={4} fontFamily="Inter" fontSize="11" fontWeight="600" fill={color.stroke}>{label}</text>
          <text x={36} y={4} textAnchor="end" fontFamily="'JetBrains Mono', monospace" fontSize="10" fill={SS.ink}>{areaStr}</text>
        </g>
      )}
    </g>
  );
};

/* === Parking block overlay ===
   Renders an N×rows grid of stalls at (x, y) anchor, rotated `angle` deg. */
const ParkingBlock = ({ x, y, cols = 12, rows = 1, stallW = 16, stallL = 32, angle = 0, color = POLY[1], selected = false, label }) => {
  const totalW = cols * stallW;
  const totalH = rows * stallL;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <rect x={0} y={0} width={totalW} height={totalH} fill="rgba(255,255,255,0.05)" stroke={color.stroke} strokeWidth={selected ? 2 : 1.4} strokeDasharray="0"/>
      {/* Stall dividers */}
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <line key={`v${i}`} x1={(i+1)*stallW} y1={2} x2={(i+1)*stallW} y2={totalH - 2} stroke={color.stroke} strokeWidth="1"/>
      ))}
      {rows > 1 && Array.from({ length: rows - 1 }).map((_, i) => (
        <line key={`h${i}`} x1={0} y1={(i+1)*stallL} x2={totalW} y2={(i+1)*stallL} stroke={color.stroke} strokeWidth="1"/>
      ))}
      {/* Curb hatch */}
      <rect x={-1} y={-3} width={totalW + 2} height={3} fill={color.stroke} opacity="0.6"/>
      {/* Selected — corner handles + rotate */}
      {selected && (
        <g>
          {[[0,0],[totalW,0],[totalW,totalH],[0,totalH]].map(([px,py], i) => (
            <rect key={i} x={px - 4} y={py - 4} width={8} height={8} fill="#FFFFFF" stroke={color.stroke} strokeWidth="1.5"/>
          ))}
          <line x1={totalW/2} y1={0} x2={totalW/2} y2={-26} stroke={color.stroke} strokeWidth="1.4" strokeDasharray="3 3"/>
          <circle cx={totalW/2} cy={-32} r="7" fill="#FFFFFF" stroke={color.stroke} strokeWidth="1.6"/>
        </g>
      )}
      {label && (
        <g transform={`translate(${totalW/2} ${totalH + 14})`}>
          <rect x={-32} y={-9} width={64} height={18} rx={4} fill="rgba(23,20,25,0.88)"/>
          <text x={0} y={3} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="9" fill="#FBFAF7" letterSpacing="0.3">{label}</text>
        </g>
      )}
    </g>
  );
};

Object.assign(window, { SS, POLY, Ico, SMLogo, MapBackdrop, SketchPolygon, ParkingBlock });
