/* GapFinder — Unified Workspace · the shared map
   One map, two scales: "national" for discovery (gap rings on UK), "local" for
   a selected opportunity (aerial + catchment / requirements / sketch overlays). */

/* Measure a container so SVG overlays can use pixel geometry. */
function useSize(ref) {
  const [size, setSize] = React.useState({ w: 1000, h: 700 });
  React.useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/* Scattered store dots for the national view. */
const NAT_DOTS = [
  [44,70],[44,71],[45,69],[45,72],[43,70],[38,42],[37,41],[39,42],[38,43],[40,36],[41,35],[42,37],
  [34,32],[35,31],[33,32],[42,56],[43,54],[41,58],[36,64],[50,60],[51,58],[49,62],[33,76],[30,40],
  [42,64],[43,65],[45,50],[46,52],[44,51],[40,48],[41,49],[38,60],[39,62],[33,36],[34,38],[27,28],
  [46,76],[47,74],[35,50],[36,52],[37,53],
];

/* ---- National (UK) map ------------------------------------------------- */
const PIN_B_COLOR = "#E8622C";
const PinBadge = ({ label, color }) => (
  <span style={{ position: "absolute", top: -3, right: -8, width: 16, height: 16, borderRadius: 999,
    background: color || "#7033FF", color: "#fff", border: "2px solid #fff",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700, lineHeight: 1 }}>{label}</span>
);
const NationalMap = ({ area, accent, overlays, onPickArea, comparing, compareB, arming }) => {
  const violet = "#7033FF";
  return (
    <React.Fragment>
      <svg className="um-svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet">
        <g opacity="0.55">
          <path d="M380 240 Q330 220 330 280 Q300 280 290 320 Q280 360 320 380 Q320 420 290 450 Q280 500 330 510 Q310 560 350 600 Q380 640 360 680 Q400 720 420 760 Q440 820 480 840 Q520 820 540 760 Q560 700 540 660 Q580 640 600 600 Q620 540 580 510 Q600 470 580 430 Q560 380 520 370 Q540 320 500 290 Q460 260 420 270 Q400 240 380 240 Z" fill="#E2DBC9" stroke="#C9C1AA" strokeWidth="1.5"/>
          <path d="M180 460 Q150 440 160 490 Q140 520 160 560 Q150 600 190 610 Q230 620 250 580 Q270 540 260 500 Q240 460 180 460 Z" fill="#E2DBC9" stroke="#C9C1AA" strokeWidth="1.5"/>
          <path d="M340 220 Q320 180 360 160 Q400 150 420 200 Q430 240 380 240 Q360 240 340 220 Z" fill="#E2DBC9" stroke="#C9C1AA" strokeWidth="1.5"/>
        </g>
      </svg>

      {/* traffic heat */}
      {overlays.traffic && NAT_DOTS.slice(0, 10).map((d, i) => (
        <div key={`t${i}`} style={{ position: "absolute", left: `${d[0]}%`, top: `${d[1]}%`, width: 120, height: 120,
          transform: "translate(-50%,-50%)", borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle, rgba(242,107,31,0.34), rgba(242,107,31,0) 70%)", mixBlendMode: "multiply" }}/>
      ))}

      {/* store dots */}
      {NAT_DOTS.map((d, i) => (
        <span key={i} className="um-dot" style={{ left: `${d[0]}%`, top: `${d[1]}%` }}/>
      ))}

      {/* gap-city rings — muted & non-interactive while dropping a compare pin */}
      {U_BUAS.map((b) => {
        const size = b.pop > 1000000 ? 32 : b.pop > 550000 ? 24 : b.pop > 450000 ? 19 : 15;
        const sel = area && area.id === b.id;
        const strong = b.gap === "High";
        return (
          <button key={b.id} className="um-gap" onClick={(e) => { e.stopPropagation(); onPickArea(b); }}
            style={{ left: `${b.x}%`, top: `${b.y}%`, width: size, height: size,
              borderColor: strong ? violet : "rgba(112,51,255,0.45)",
              background: sel ? "rgba(112,51,255,0.28)" : strong ? "rgba(112,51,255,0.12)" : "rgba(112,51,255,0.05)",
              boxShadow: sel ? `0 0 0 4px rgba(112,51,255,0.18)` : "none", zIndex: sel ? 6 : 4,
              opacity: arming ? 0.35 : 1, pointerEvents: arming ? "none" : "auto" }}
            title={`${b.name} · ${b.gap} gap`}/>
        );
      })}

      {/* requirement markers per area (overlay) */}
      {overlays.requirements && U_BUAS.filter(b => b.reqLocal > 0).map((b) => (
        <span key={`rq${b.id}`} className="um-reqdot" style={{ left: `${b.x + 1.3}%`, top: `${b.y - 1.6}%` }} title={`${b.reqLocal} live requirements`}/>
      ))}

      {/* dropped pin A (the current point) */}
      {area && (
        <div className="um-pin" style={{ left: `${area.x}%`, top: `${area.y}%` }}>
          <IcPinBig color={violet}/>
          {comparing && <PinBadge label="A"/>}
        </div>
      )}
      {/* dropped pin B (comparison point) */}
      {compareB && (
        <div className="um-pin" style={{ left: `${compareB.x}%`, top: `${compareB.y}%` }}>
          <IcPinBig color={PIN_B_COLOR}/>
          <PinBadge label="B" color={PIN_B_COLOR}/>
        </div>
      )}
    </React.Fragment>
  );
};

/* Synthesize a plausible opportunity from an arbitrary clicked point on the
   UK map (Assess Area · drop-a-pin). Deterministic from the coordinates so the
   same point always reads the same. */
function uSynthArea(x, y) {
  const seed = (Math.round(x * 131.7 + y * 977.3) >>> 0) || 1;
  const r = uRng(seed);
  const pop = Math.round(110000 + r() * 520000);
  const households = Math.round(pop * (0.42 + r() * 0.05));
  const affluence = +(38 + r() * 22).toFixed(1);
  const missing = 6 + Math.floor(r() * 9);
  const stores = 12 + Math.floor(r() * 30);
  const reqLocal = 1 + Math.floor(r() * 7);
  const traffic = 55 + Math.floor(r() * 38);
  const gap = missing >= 12 ? "High" : missing >= 9 ? "Med" : "Low";
  const lat = +(58.2 - (y / 100) * 8.0).toFixed(4);
  const lon = +(-5.5 + (x / 100) * 7.2).toFixed(4);
  return {
    id: "drop-" + Date.now(), name: "Dropped point", region: "Custom point",
    custom: true, x, y, lat, lon, coords: `${lat}, ${lon}`,
    pop, households, affluence, gap, missing, stores, reqLocal, reqNation: 9, traffic,
  };
}

/* ---- Catchment geometry helpers (shared by map + count chip) ----------- */
function uRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const uCellWeight = (id) => 0.55 + uRng(id * 1013904223 + 7)() * 0.95;

function uPointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

/* Irregular built-up-area boundary blob (Find Gaps catchment) */
function uBUAOutline(cx, cy, R, seed = 11) {
  const rng = uRng(seed);
  const N = 16, amps = [];
  for (let k = 0; k < N; k++) amps.push(0.74 + rng() * 0.6);
  const pts = [];
  for (let k = 0; k < N; k++) {
    const th = (k / N) * Math.PI * 2;
    const r = R * 1.22 * amps[k];
    pts.push({ x: cx + Math.cos(th) * r, y: cy + Math.sin(th) * r * 0.9 });
  }
  return pts;
}

/* Catchment geometry for the current focus + mode */
function uCatchGeom({ w, h, catchment, view }) {
  const cx = w * 0.5, cy = h * 0.5;
  const baseR = Math.min(w, h) * (catchment.value >= 10 ? 0.4 : catchment.value >= 5 ? 0.32 : 0.24);
  const outline = view === "find" ? uBUAOutline(cx, cy, baseR) : null;
  return { cx, cy, baseR, outline };
}

/* Build LSOA cells with effective selection (overrides over default membership) */
function uBuildCells({ w, h, cx, cy, baseR, mode, view, outline, overrides = {} }) {
  const cells = buildLSOAs({ mw: w, mh: h, cx, cy, baseR, mode, seed: 7 });
  return cells.map((c) => {
    let inCatch = c.inCatch, nearEdge = c.nearEdge;
    if (outline) {
      inCatch = uPointInPoly(c.cx, c.cy, outline);
      const expanded = outline.map((p) => ({ x: cx + (p.x - cx) * 1.13, y: cy + (p.y - cy) * 1.13 }));
      nearEdge = inCatch || uPointInPoly(c.cx, c.cy, expanded);
    }
    const defIn = inCatch;
    const selected = overrides[c.id] !== undefined ? overrides[c.id] : defIn;
    return { ...c, inCatch, nearEdge, defIn, selected, weight: uCellWeight(c.id) };
  });
}

/* Is a store inside the current catchment? */
function uStoreInCatch(s, { w, h, cx, cy, baseR, outline }) {
  const sx = (s.mx / 100) * w, sy = (s.my / 100) * h;
  if (outline) return uPointInPoly(sx, sy, outline);
  const dx = sx - cx, dy = sy - cy;
  return Math.sqrt(dx * dx + dy * dy) < baseR;
}

const uCellPath = (c) => "M " + c.pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ") + " Z";
const uCellFill = (c) => c.selected ? SA.lsoaFill : c.inCatch ? SA.lsoaOff : "rgba(20,16,26,0.10)";

/* ---- Local (aerial) map with overlays ---------------------------------- */
const LocalMap = ({ w, h, area, tab, mapStyle, overlays, accent, catchment, sketch, selected, view, showLsoa, lsoaSel, onToggleLsoa, onLsoaStats, onPickStore, onPickReq }) => {
  const { cx, cy, baseR, outline } = uCatchGeom({ w, h, catchment, view });
  const isCatch = tab === "catchment";
  const cells = React.useMemo(
    () => isCatch ? uBuildCells({ w, h, cx, cy, baseR, mode: catchment.mode, view, outline, overrides: lsoaSel }) : [],
    [isCatch, w, h, cx, cy, baseR, catchment.mode, view, lsoaSel]
  );

  /* report selection stats up for live census recompute */
  React.useEffect(() => {
    if (!isCatch || !onLsoaStats) return;
    let selW = 0, totW = 0, selN = 0, totN = 0;
    cells.forEach((c) => {
      if (c.defIn) { totW += c.weight; totN++; }
      if (c.selected) { selW += c.weight; selN++; }
    });
    onLsoaStats({ factor: totW ? selW / totW : 1, selCount: selN, totalCount: totN });
  }, [cells, isCatch]);

  const showStores = true;
  const showReq = overlays.requirements || tab === "requirements";
  const localReqs = U_REQS.filter(r => r.scope === "local");

  return (
    <React.Fragment>
      <MapBackdrop width={w} height={h} style={mapStyle}/>

      {/* traffic heat (local) */}
      {overlays.traffic && [[30,34],[58,42],[46,64],[68,58],[40,50]].map((p, i) => (
        <div key={`t${i}`} style={{ position: "absolute", left: `${p[0]}%`, top: `${p[1]}%`, width: 180, height: 180,
          transform: "translate(-50%,-50%)", borderRadius: "50%", pointerEvents: "none", zIndex: 2,
          background: "radial-gradient(circle, rgba(242,107,31,0.4), rgba(242,107,31,0) 70%)", mixBlendMode: "screen" }}/>
      ))}

      {/* Catchment overlay — clickable LSOA cells + boundary */}
      {isCatch && showLsoa && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", inset: 0, zIndex: 4, pointerEvents: "none" }}>
          <g>
            {cells.map((c) => (c.inCatch || c.nearEdge) && (
              <path key={c.id} className="um-lsoa" d={uCellPath(c)}
                fill={uCellFill(c)} stroke={c.selected ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.5)"} strokeWidth={c.selected ? 1.1 : 0.8}
                style={{ pointerEvents: "auto", cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); onToggleLsoa(c.id, !c.selected); }}>
                <title>{c.selected ? "In catchment — click to remove" : "Click to add to catchment"}</title>
              </path>
            ))}
            {outline
              ? <path d={uCellPath({ pts: outline })} fill="none" stroke={SA.ring} strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" opacity="0.95"/>
              : <CatchmentRing cx={cx} cy={cy} baseR={baseR} mode={catchment.mode}/>}
          </g>
        </svg>
      )}

      {/* SVG overlay layer (sketch) */}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
        {tab === "sketch" && sketch.show && (
          <g>
            <SketchPolygon
              pts={[{x:cx-150,y:cy-90},{x:cx+150,y:cy-90},{x:cx+150,y:cy+70},{x:cx-150,y:cy+70}]}
              color={POLY[0]} selected={sketch.layer === "plot"} showHandles={sketch.layer === "plot"} showDistances label={`Scheme ${sketch.scheme}`} area={2480}/>
            <ParkingBlock x={cx-140} y={cy+82} cols={10} rows={1} stallW={16} stallL={30} color={POLY[1]} selected={sketch.layer === "parking"} label="24 spaces"/>
            {sketch.cad && (
              <g transform={`translate(${cx-66} ${cy-78}) scale(1.32 1.3)`} opacity="0.95">
                <rect x="-6" y="-6" width="112" height="132" fill="rgba(255,255,255,0.05)" stroke={CAD_TEAL} strokeWidth="1.2" strokeDasharray="4 3"/>
                {(CAD_BY_ID[sketch.cad] || {}).draw && CAD_BY_ID[sketch.cad].draw(CAD_TEAL)}
              </g>
            )}
          </g>
        )}
      </svg>

      {/* CAD provenance chip */}
      {tab === "sketch" && sketch.cad && CAD_BY_ID[sketch.cad] && (
        <div className="um-cadtag" style={{ left: `${(cx-70)/w*100}%`, top: `${(cy-78)/h*100}%` }}>
          <UKicker color="#0F9488">CAD · {CAD_BY_ID[sketch.cad].brand}</UKicker>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: SS.ink3 }}>{CAD_BY_ID[sketch.cad].format} · {CAD_BY_ID[sketch.cad].source}, {CAD_BY_ID[sketch.cad].year} · 1:200</span>
        </div>
      )}

      {/* store dots — dimmed when outside the active catchment */}
      {showStores && U_STORES.map((s) => {
        const b = U_BRAND_BY_NAME[s.brand];
        const sel = selected && selected.type === "store" && selected.id === s.id;
        const inC = !isCatch || uStoreInCatch(s, { w, h, cx, cy, baseR, outline });
        return (
          <button key={s.id} className={`um-store${sel ? " sel" : ""}`} onClick={(e) => { e.stopPropagation(); if (inC) onPickStore(s); }}
            style={{ left: `${s.mx}%`, top: `${s.my}%`, background: b ? b.color : SS.ink, zIndex: sel ? 9 : 5,
              opacity: inC ? 1 : 0.22, pointerEvents: inC ? "auto" : "none" }}
            title={s.brand}/>
        );
      })}

      {/* requirement pins (local) */}
      {showReq && localReqs.map((r) => {
        const sel = selected && selected.type === "req" && selected.id === r.id;
        return (
          <button key={r.id} className={`um-reqpin${sel ? " sel" : ""}`} onClick={(e) => { e.stopPropagation(); onPickReq(r); }}
            style={{ left: `${r.mx}%`, top: `${r.my}%`, zIndex: sel ? 9 : 6 }} title={`${r.brand} · wants here`}>
            <IcDiamond/>
          </button>
        );
      })}

      {/* anchor pin */}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", inset: 0, zIndex: 7, pointerEvents: "none" }}>
        <SitePin x={cx} y={cy}/>
      </svg>

      {/* popovers */}
      {selected && selected.type === "store" && (() => {
        const s = U_STORES.find(x => x.id === selected.id); if (!s) return null;
        return <StorePopover s={s} x={s.mx} y={s.my} onClose={() => onPickStore(null)}/>;
      })()}
      {selected && selected.type === "req" && (() => {
        const r = localReqs.find(x => x.id === selected.id); if (!r) return null;
        return <ReqPopover r={r} x={r.mx} y={r.my} onClose={() => onPickReq(null)}/>;
      })()}
    </React.Fragment>
  );
};

/* ---- Map popovers ------------------------------------------------------ */
const PopoverShell = ({ x, y, onClose, children, w = 320 }) => {
  const left = x > 60 ? `calc(${x}% - ${w + 18}px)` : `calc(${x}% + 18px)`;
  const top = `clamp(16px, ${y}%, calc(100% - 300px))`;
  return (
    <div className="um-pop" style={{ left, top, width: w, maxHeight: `calc(100% - ${top} - 16px)` }} onClick={(e) => e.stopPropagation()}>
      <button className="um-pop-x" onClick={onClose} aria-label="Close"><Ico name="close" size={12}/></button>
      {children}
    </div>
  );
};

const StorePopover = ({ s, x, y, onClose }) => {
  const b = U_BRAND_BY_NAME[s.brand] || { color: SS.ink, sector: "" };
  return (
    <PopoverShell x={x} y={y} onClose={onClose}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", paddingRight: 18 }}>
        <UBrandLogo brand={s.brand} size={40} radius={9}/>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "Inter", fontSize: 15, fontWeight: 600, color: SS.ink, letterSpacing: -0.2 }}>{s.brand}</div>
          <UKicker color={SS.violetDeep}>{b.sector}</UKicker>
        </div>
      </div>
      <div className="um-pop-grid">
        <div><span className="k">Format</span>{s.occupier.format}</div>
        <div><span className="k">UK stores</span>{s.occupier.units}</div>
        <div><span className="k">This site</span>Opened {s.occupier.openedYear}</div>
        <div><span className="k">Distance</span>{s.dist} from pin</div>
      </div>
      <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink2, padding: "0 2px 4px" }}>{s.addr}</div>
      <div className="um-pop-sec">
        <UKicker>Expansion / acquiring team</UKicker>
        {s.agents.map((a, i) => (
          <div key={i} className="um-contact">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 600, color: SS.ink }}>{a.name}</div>
              <div style={{ fontFamily: "Inter", fontSize: 11.5, color: SS.ink3 }}>{a.role}{a.org ? ` · ${a.org}` : ""}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink2, marginTop: 3 }}>{a.email} · {a.phone}</div>
            </div>
            <button className="um-copy">Copy</button>
          </div>
        ))}
      </div>
    </PopoverShell>
  );
};

const ReqEstateMap = ({ r }) => {
  // Deterministic scatter of the brand's store estate across a UK silhouette.
  const anchors = [
    [540, 700], [430, 560], [450, 620], [470, 520], [400, 700], [470, 425],
    [400, 550], [400, 305], [445, 300], [500, 760], [490, 585], [370, 690], [520, 660], [455, 480],
  ];
  const n = Math.min(r.ukStores || 24, 30);
  let seed = 0; for (let i = 0; i < r.brand.length; i++) seed = (seed * 31 + r.brand.charCodeAt(i)) % 100000;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 1000) / 1000; };
  const dots = Array.from({ length: n }, (_, i) => {
    const a = anchors[i % anchors.length];
    return [a[0] + (rand() - 0.5) * 70, a[1] + (rand() - 0.5) * 70];
  });
  return (
    <div className="um-pop-sec">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <UKicker>Current estate</UKicker>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink2 }}>{(r.ukStores || 0).toLocaleString()} UK stores · nearest {r.nearest}</span>
      </div>
      <div style={{ marginTop: 8, borderRadius: 10, background: SS.bg, border: `1px solid ${SS.borderSoft}`, height: 150, overflow: "hidden" }}>
        <svg viewBox="255 250 350 620" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }}>
          <g opacity="0.5">
            <path d="M380 240 Q330 220 330 280 Q300 280 290 320 Q280 360 320 380 Q320 420 290 450 Q280 500 330 510 Q310 560 350 600 Q380 640 360 680 Q400 720 420 760 Q440 820 480 840 Q520 820 540 760 Q560 700 540 660 Q580 640 600 600 Q620 540 580 510 Q600 470 580 430 Q560 380 520 370 Q540 320 500 290 Q460 260 420 270 Q400 240 380 240 Z" fill="#E2DBC9" stroke="#C9C1AA" strokeWidth="1.5"/>
            <path d="M340 220 Q320 180 360 160 Q400 150 420 200 Q430 240 380 240 Q360 240 340 220 Z" fill="#E2DBC9" stroke="#C9C1AA" strokeWidth="1.5"/>
          </g>
          {dots.map((d, i) => <circle key={i} cx={d[0]} cy={d[1]} r="6" fill="var(--acc)" fillOpacity="0.85" stroke="#fff" strokeWidth="1.5"/>)}
        </svg>
      </div>
    </div>
  );
};

const ReqContact = ({ c, label }) => (
  <div className="um-contact">
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 600, color: SS.ink }}>{c.name}</div>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, letterSpacing: 0.6, textTransform: "uppercase", color: SS.ink3, background: SS.surface, border: `1px solid ${SS.borderSoft}`, borderRadius: 5, padding: "1px 5px" }}>{label}</span>
      </div>
      <div style={{ fontFamily: "Inter", fontSize: 11.5, color: SS.ink3 }}>{c.role}{c.org ? ` · ${c.org}` : ""}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink2, marginTop: 3 }}>{c.email} · {c.phone}</div>
    </div>
    <button className="um-copy">Copy</button>
  </div>
);

const ReqPopover = ({ r, x, y, onClose }) => {
  // Normalise contacts: prefer an explicit array (up to ~10), else fall back to the
  // single in-house / agency pair. Guarantees at least one entry for the CTA.
  const contacts = (r.contacts && r.contacts.length)
    ? r.contacts
    : [
        ...(r.contact ? [{ ...r.contact, label: "In-house" }] : []),
        ...(r.agent ? [{ ...r.agent, label: "Agency" }] : []),
      ];
  const primary = contacts[0];
  const locations = r.locations || [];
  return (
  <PopoverShell x={x} y={y} onClose={onClose}>
    <div style={{ display: "flex", gap: 12, alignItems: "center", paddingRight: 18 }}>
      <UBrandLogo brand={r} size={40} radius={9}/>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontFamily: "Inter", fontSize: 15, fontWeight: 600, color: SS.ink, letterSpacing: -0.2 }}>{r.brand}</div>
          <span className="um-livetag">Live requirement</span>
        </div>
        <UKicker color={SS.violetDeep}>{r.sector}</UKicker>
      </div>
    </div>
    <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink2, lineHeight: 1.5, padding: "2px 2px 0" }}>{r.summary}</div>
    <div className="um-pop-grid">
      <div><span className="k">Size wanted</span>{r.size}</div>
      <div><span className="k">Use class</span>{r.useClass}</div>
      <div><span className="k">Listing</span>{r.listing}</div>
      <div><span className="k">Verified</span>{r.verified}</div>
    </div>
    {r.brochure && (
      <div className="um-pop-sec">
        <UKicker>Brochure</UKicker>
        <button className="um-contact" style={{ cursor: "pointer", textAlign: "left" }}>
          <span style={{ width: 34, height: 34, borderRadius: 8, background: "var(--acc-soft)", color: "var(--acc-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico name="doc" size={15}/></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Inter", fontSize: 12.5, fontWeight: 600, color: SS.ink }}>{r.brand} — requirement brief</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, marginTop: 2 }}>PDF · 2 pages</div>
          </div>
          <span style={{ color: "var(--acc-deep)", display: "inline-flex" }}><Ico name="download" size={14}/></span>
        </button>
      </div>
    )}
    <div className="um-pop-sec">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <UKicker>Target locations</UKicker>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink2 }}>{locations.length}</span>
      </div>
      <div className="um-loclist">
        {locations.map((l, i) => <span key={i} className="um-loctag">{l}</span>)}
      </div>
    </div>
    <ReqEstateMap r={r}/>
    <div className="um-pop-sec">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <UKicker>Contacts</UKicker>
        {contacts.length > 1 && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink2 }}>{contacts.length}</span>}
      </div>
      <div className="um-contactlist">
        {contacts.map((c, i) => <ReqContact key={i} c={c} label={c.label || "Contact"}/>)}
      </div>
    </div>
    {primary && (
      <div className="um-pop-row">
        <button className="um-pop-btn primary"><AIco name="users" size={13}/> Contact {primary.name.split(" ")[0]}</button>
      </div>
    )}
  </PopoverShell>
  );
};

/* Big map pin + diamond + helpers */
const IcPinBig = ({ color }) => (
  <svg width="30" height="30" viewBox="0 0 16 16" fill="none">
    <path d="M8 1C5 1 3 3.2 3 6c0 3.6 5 9 5 9s5-5.4 5-9c0-2.8-2-5-5-5Z" fill={color}/>
    <circle cx="8" cy="6" r="1.8" fill="white"/>
  </svg>
);
const IcDiamond = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <path d="M8 1.5L14.5 8L8 14.5L1.5 8L8 1.5Z" fill="#7033FF" stroke="#fff" strokeWidth="1.6"/>
  </svg>
);

/* ---- The Unified Map shell -------------------------------------------- */
const UnifiedMap = (props) => {
  const { scale } = props;
  const ref = React.useRef(null);
  const { w, h } = useSize(ref);
  const local = scale === "local";
  const assessDrop = !local && props.view === "assess";
  const arming = !!props.compareArm;                 // waiting for the 2nd pin
  const paired = !!props.comparePair;                // a comparison already exists
  const canDropNew = assessDrop && !arming && !paired;
  const dropMode = arming || canDropNew;
  const compareB = props.comparePair ? props.comparePair.b : null;
  const inCatch = local && props.tab === "catchment";
  const storesIn = React.useMemo(() => {
    if (!inCatch) return U_STORES.length;
    const { cx, cy, baseR, outline } = uCatchGeom({ w, h, catchment: props.catchment, view: props.view });
    return U_STORES.filter(s => uStoreInCatch(s, { w, h, cx, cy, baseR, outline })).length;
  }, [inCatch, w, h, props.catchment, props.view]);

  const onMapClick = (e) => {
    props.onPickStore(null);
    props.onPickReq(null);
    if (!dropMode || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    if (px < 1 || px > 99 || py < 1 || py > 99) return;
    const pt = uSynthArea(+px.toFixed(2), +py.toFixed(2));
    if (arming && props.onDropCompare) props.onDropCompare(pt);
    else if (canDropNew && props.onPickPoint) props.onPickPoint(pt);
  };

  return (
    <div className={`um-map${local ? " local" : ""}`} ref={ref}
      onClick={onMapClick}
      style={dropMode ? { cursor: "crosshair" } : undefined}
      data-screen-label="Map">
      {local
        ? <LocalMap w={w} h={h} {...props}/>
        : <NationalMap {...props} comparing={arming || paired} compareB={compareB} arming={arming}/>}

      {/* Drop-a-pin hint */}
      {dropMode && (
        <div className="um-drophint">
          <span className="um-drophint-x"><IcPinBig color={arming ? "#E8622C" : "#7033FF"}/></span>
          {arming ? "Click a second location to drop pin B and compare" : "Click anywhere to drop a pin and assess that point"}
        </div>
      )}

      {/* Top-right controls */}
      <div className="um-controls">
        <div className="um-ctl">
          <button className="on">2D</button>
          <button>3D</button>
        </div>
        <div className="um-ctl col">
          <button aria-label="Zoom in"><Ico name="plus" size={14}/></button>
          <button aria-label="Zoom out"><Ico name="minus" size={14}/></button>
        </div>
      </div>

      {/* Count chip */}
      <div className="um-count">
        <span className="dot"/>
        {local
          ? `${storesIn} stores ${inCatch ? "in catchment" : "in radius"} · ${U_MISSING.length} brands missing`
          : `1,586 candidate gaps · 22,470 stores mapped`}
      </div>

      {/* Legend */}
      <div className="um-legend">
        <div className="li"><span className="d store"/>Existing stores</div>
        {!local && <div className="li"><span className="ring"/>Gap areas</div>}
        {(props.overlays.requirements || props.tab === "requirements") && <div className="li"><span className="diamond"/>Live requirements</div>}
        {props.overlays.traffic && <div className="li"><span className="d traffic"/>Traffic intensity</div>}
        {local && props.tab === "catchment" && props.showLsoa && <div className="li"><span className="lsoa"/>{props.view === "find" ? "Catchment (BUA)" : "Catchment (LSOA)"}</div>}
      </div>

      {/* Scale + attribution */}
      <div className="um-scale"><span>0</span><span className="bar"/><span>{local ? "500 m" : "50 km"}</span></div>
      <div className="um-attr">© Mapbox · OpenStreetMap{local && props.mapStyle === "satellite" ? " · Maxar" : ""}</div>
    </div>
  );
};

Object.assign(window, { UnifiedMap });
