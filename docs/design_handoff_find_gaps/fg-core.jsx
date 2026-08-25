/* Find Gaps — redesign explorations · shared core
   Live-app visual language: satellite map, purple SiteMatcher chrome,
   cool-white panels, Inter + JetBrains Mono kickers. */

const FG = {
  surface: "#FFFFFF",
  bg: "#F7F7F9",
  bgAlt: "#FBFBFC",
  ink: "#16151C",
  ink2: "#4B4A54",
  ink3: "#8A8792",
  ink4: "#B6B3BE",
  border: "#E9E8EE",
  borderSoft: "#F1F0F4",
  violet: "#6D31E8",
  violetDeep: "#5620C4",
  violetTint: "#EBE3FC",
  violetSoft: "#F5F0FE",
  green: "#15803D",
  greenSoft: "#E7F5EC",
  amber: "#B45309",
  amberSoft: "#FBF0E2",
};

const FG_CSS = `
.fg-frame { position: absolute; inset: 0; background: ${FG.bg};
  font-family: Inter, sans-serif; color: ${FG.ink};
  display: grid; grid-template-rows: 60px 1fr; }
.fg-frame * { box-sizing: border-box; }
.fg-frame ::-webkit-scrollbar { width: 0; height: 0; }
.fg-mono { font-family: 'JetBrains Mono', monospace; }
.fg-kicker { font-family: 'JetBrains Mono', monospace; font-size: 10px;
  letter-spacing: 1.4px; text-transform: uppercase; color: ${FG.ink3}; }

/* ---- top chrome ---- */
.fg-top { display: grid; grid-template-columns: 1fr minmax(0,460px) 1fr;
  align-items: center; padding: 0 18px; gap: 16px;
  background: ${FG.surface}; border-bottom: 1px solid ${FG.border}; }
.fg-brand { display: flex; align-items: center; gap: 10px; }
.fg-brand .nm { font-size: 17px; font-weight: 700; letter-spacing: -0.4px; }
.fg-topsearch { display: flex; align-items: center; gap: 9px; height: 38px;
  padding: 0 13px; background: ${FG.bg}; border: 1px solid ${FG.border};
  border-radius: 10px; }
.fg-topsearch input { flex: 1; border: none; outline: none; background: transparent;
  font-family: Inter; font-size: 13.5px; color: ${FG.ink}; }
.fg-topsearch input::placeholder { color: ${FG.ink4}; }
.fg-topright { display: flex; align-items: center; gap: 10px; justify-content: flex-end; }
.fg-export { display: inline-flex; align-items: center; gap: 8px; height: 38px;
  padding: 0 16px; border-radius: 10px; border: none; cursor: pointer;
  background: ${FG.violet}; color: #fff; font-family: Inter; font-size: 14px; font-weight: 600; }
.fg-avatar { width: 34px; height: 34px; border-radius: 999px; background: ${FG.violet};
  color: #fff; display: inline-flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 600; }

/* ---- left icon rail ---- */
.fg-rail { width: 56px; background: ${FG.surface}; border-right: 1px solid ${FG.border};
  display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 0; }
.fg-rail-btn { width: 40px; height: 40px; border-radius: 10px; border: none; cursor: pointer;
  background: transparent; color: ${FG.ink3};
  display: inline-flex; align-items: center; justify-content: center; }
.fg-rail-btn.on { background: ${FG.ink}; color: #fff; }

/* ---- generic panel ---- */
.fg-panel { background: ${FG.surface}; display: flex; flex-direction: column; min-height: 0; }
.fg-panel.l { border-right: 1px solid ${FG.border}; }
.fg-panel.r { border-left: 1px solid ${FG.border}; }
.fg-scroll { flex: 1; overflow: auto; min-height: 0; }

.fg-sechd { display: flex; align-items: center; gap: 10px; padding: 20px 20px 10px; }
.fg-sechd .ln { flex: 1; height: 1px; background: ${FG.borderSoft}; }

/* ---- purpose banner ---- */
.fg-purpose { margin: 16px 20px 4px; padding: 13px 14px; border-radius: 12px;
  background: ${FG.violetSoft}; border: 1px solid ${FG.violetTint};
  display: flex; gap: 11px; align-items: flex-start; }
.fg-purpose .ic { flex-shrink: 0; width: 26px; height: 26px; border-radius: 8px;
  background: ${FG.violet}; color: #fff; display: inline-flex; align-items: center; justify-content: center; }
.fg-purpose .tx { font-size: 12.5px; line-height: 1.5; color: ${FG.ink2}; }
.fg-purpose .tx b { color: ${FG.ink}; font-weight: 600; }

/* ---- rule chips (plain english) ---- */
.fg-rule { display: flex; align-items: center; gap: 10px; padding: 10px 11px;
  border-radius: 10px; border: 1px solid ${FG.violetTint}; background: ${FG.violetSoft};
  margin-bottom: 8px; }
.fg-rule.neg { border-color: #F1D6D0; background: #FCEEEB; }
.fg-rule .badge { width: 26px; height: 26px; border-radius: 7px; flex-shrink: 0;
  background: ${FG.violet}; color: #fff; display: inline-flex; align-items: center; justify-content: center; }
.fg-rule.neg .badge { background: #C2452F; }
.fg-rule .body { flex: 1; min-width: 0; }
.fg-rule .op { font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700;
  letter-spacing: 0.8px; text-transform: uppercase; color: ${FG.violetDeep}; }
.fg-rule.neg .op { color: #B23A2C; }
.fg-rule .val { font-size: 13.5px; font-weight: 600; color: ${FG.ink}; margin-top: 1px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fg-rule .x { border: none; background: transparent; cursor: pointer; color: ${FG.ink4}; padding: 3px; }

.fg-ghost { display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  width: 100%; padding: 10px; border-radius: 10px; border: 1px dashed ${FG.border};
  background: ${FG.surface}; cursor: pointer; color: ${FG.ink2};
  font-family: Inter; font-size: 13px; font-weight: 500; }
.fg-ghost:hover { border-color: ${FG.violet}; color: ${FG.violetDeep}; }

/* ---- pseudo slider ---- */
.fg-slider .track { position: relative; height: 4px; border-radius: 999px;
  background: ${FG.borderSoft}; margin: 16px 0 12px; }
.fg-slider .fill { position: absolute; top: 0; bottom: 0; background: ${FG.ink}; border-radius: 999px; }
.fg-slider .h { position: absolute; top: 50%; width: 16px; height: 16px; border-radius: 999px;
  background: #fff; border: 2px solid ${FG.violet}; transform: translate(-50%,-50%); }
.fg-slider .vals { display: flex; justify-content: space-between;
  font-family: 'JetBrains Mono', monospace; font-size: 11px; color: ${FG.ink2}; }

/* ---- result rows ---- */
.fg-resulthd { padding: 18px 20px 14px; border-bottom: 1px solid ${FG.borderSoft}; }
.fg-count { font-size: 26px; font-weight: 700; letter-spacing: -0.6px; }
.fg-of { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: ${FG.ink3};
  letter-spacing: 0.5px; text-transform: uppercase; }
.fg-csvbtn { display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; height: 40px; border-radius: 10px; cursor: pointer;
  background: ${FG.ink}; color: #fff; border: none;
  font-family: Inter; font-size: 13.5px; font-weight: 600; }
.fg-csvbtn.tinted { background: ${FG.violetSoft}; color: ${FG.violetDeep}; border: 1px solid ${FG.violetTint}; }
.fg-sortrow { display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px; font-family: 'JetBrains Mono', monospace; font-size: 10px;
  letter-spacing: 1px; text-transform: uppercase; color: ${FG.ink3};
  border-bottom: 1px solid ${FG.borderSoft}; }
.fg-loc { display: grid; grid-template-columns: 22px 1fr auto; align-items: center; gap: 12px;
  padding: 13px 20px; cursor: pointer; border-bottom: 1px solid ${FG.borderSoft}; }
.fg-loc:hover { background: ${FG.bg}; }
.fg-loc .nm { font-size: 14.5px; font-weight: 600; letter-spacing: -0.1px; }
.fg-loc .meta { font-family: 'JetBrains Mono', monospace; font-size: 10px;
  letter-spacing: 0.6px; text-transform: uppercase; color: ${FG.ink3}; margin-top: 3px;
  display: flex; gap: 8px; }
.fg-loc .meta .miss { color: ${FG.violetDeep}; }
.fg-loc .chev { color: ${FG.ink4}; }

/* pills */
.fg-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px;
  border-radius: 999px; font-family: Inter; font-size: 12.5px; font-weight: 500;
  border: 1px solid ${FG.border}; background: ${FG.surface}; color: ${FG.ink}; cursor: pointer; }
.fg-pill.on { background: ${FG.ink}; color: #fff; border-color: ${FG.ink}; }
.fg-pill.acc { background: ${FG.violetSoft}; color: ${FG.violetDeep}; border-color: ${FG.violetTint}; }
`;

/* ---------- icons ---------- */
const I = {
  search: "M7 2a5 5 0 1 0 3.2 8.9l3 3 .01-.01M12 7A5 5 0 1 0 2 7a5 5 0 0 0 10 0Z",
};
const Ico = ({ n, s = 16, c = "currentColor", w = 1.6 }) => {
  const p = {
    search: <g><circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/></g>,
    pin: <path d="M8 1.5c-2.5 0-4.5 2-4.5 4.5 0 3.4 4.5 8 4.5 8s4.5-4.6 4.5-8c0-2.5-2-4.5-4.5-4.5Z"/>,
    pinf: null,
    pen: <path d="M11 2.5l2.5 2.5L6 12.5 3 13l.5-3L11 2.5Z"/>,
    layers: <g><path d="M8 2L2 5l6 3 6-3-6-3Z"/><path d="M2 9l6 3 6-3"/></g>,
    doc: <g><path d="M4 2h5l3 3v9H4V2Z"/><path d="M9 2v3h3"/></g>,
    chevR: <path d="M6 3l4 4-4 4"/>,
    chevD: <path d="M3 6l4 4 4-4"/>,
    check: <path d="M2.5 7l3 3 6-6.5"/>,
    close: <path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>,
    plus: <path d="M8 3v10M3 8h10"/>,
    download: <g><path d="M8 2v8M5 7l3 3 3-3"/><path d="M3 13h10"/></g>,
    target: <g><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.4"/></g>,
    ban: <g><circle cx="8" cy="8" r="6"/><path d="M4 4l8 8"/></g>,
    arrowR: <path d="M3 8h10M9 4l4 4-4 4"/>,
    arrowL: <path d="M13 8H3M7 4L3 8l4 4"/>,
    spark: <path d="M8 2l1.4 4.6L14 8l-4.6 1.4L8 14l-1.4-4.6L2 8l4.6-1.4L8 2Z"/>,
    users: <g><circle cx="6" cy="6" r="2.3"/><path d="M2.5 13c0-2 1.6-3.3 3.5-3.3S9.5 11 9.5 13"/><path d="M10.5 4.2A2.3 2.3 0 0 1 11 8.6M13.5 13c0-1.6-1-2.8-2.4-3.2"/></g>,
    info: <g><circle cx="8" cy="8" r="6.3"/><path d="M8 7.2v4"/><circle cx="8" cy="5" r=".6" fill={c} stroke="none"/></g>,
  }[n];
  return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">{p}</svg>;
};
const IcoFill = ({ n, s = 16, c }) => {
  if (n === "pin") return <svg width={s} height={s} viewBox="0 0 16 16" fill={c}><path d="M8 1c-2.8 0-5 2.2-5 5 0 3.6 5 9 5 9s5-5.4 5-9c0-2.8-2.2-5-5-5Z"/><circle cx="8" cy="6" r="1.8" fill="#fff"/></svg>;
  return null;
};

const SMMark = ({ size = 28 }) => (
  <svg height={size} viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
    <g fill={FG.violet}>
      <path d="M2.61,37.02a1.46,1.46,0,0,1-.11-.55V4A1.5,1.5,0,0,1,4,2.5H15.77a1.5,1.5,0,0,1,1.06.44L27.18,13.29a1.5,1.5,0,0,1,0,2.12L5.06,37.53A1.51,1.51,0,0,1,2.61,37.02Z"/>
      <path d="M61.5,4V15.77a1.8,1.8,0,0,1-.11.57,1.63,1.63,0,0,1-.33.49L50.71,27.18a1.51,1.51,0,0,1-2.12,0L26.47,5.06a1.52,1.52,0,0,1,.49-2.45,1.79,1.79,0,0,1,.57-.11L60,2.5A1.5,1.5,0,0,1,61.5,4Z"/>
      <path d="M61.39,26.98a1.46,1.46,0,0,1,.11.55V60A1.5,1.5,0,0,1,60,61.5H48.23a1.51,1.51,0,0,1-1.06-.44L36.82,50.71a1.5,1.5,0,0,1,0-2.12L58.94,26.47A1.51,1.51,0,0,1,61.39,26.98Z"/>
      <path d="M19.17,30.94,30.94,19.17a1.51,1.51,0,0,1,2.12,0L44.83,30.94a1.51,1.51,0,0,1,0,2.12L33.06,44.83a1.52,1.52,0,0,1-2.12,0L19.17,33.06A1.51,1.51,0,0,1,19.17,30.94Z"/>
      <path d="M37.86,59.45a1.51,1.51,0,0,1-1.39,2.05L4,61.5A1.5,1.5,0,0,1,2.5,60V48.23a1.81,1.81,0,0,1,.11-.57,1.63,1.63,0,0,1,.33-.49L13.29,36.82a1.55,1.55,0,0,1,2.12,0L37.53,58.94A1.29,1.29,0,0,1,37.86,59.45Z"/>
    </g>
  </svg>
);

/* ---------- data ---------- */
const FG_LOCS = [
  { nm: "Birmingham", pop: "1,121,375", reg: "West Midlands", x: 45, y: 58, r: 40, present: 4, missing: 11 },
  { nm: "Glasgow", pop: "612,444", reg: "Scotland", x: 34, y: 27, r: 30, present: 2, missing: 13 },
  { nm: "Liverpool", pop: "506,565", reg: "North West", x: 38, y: 43, r: 26, present: 3, missing: 12 },
  { nm: "Leeds", pop: "504,713", reg: "Yorkshire", x: 46, y: 38, r: 26, present: 1, missing: 14 },
  { nm: "Sheffield", pop: "500,535", reg: "Yorkshire", x: 47, y: 44, r: 24, present: 3, missing: 12 },
  { nm: "Manchester", pop: "470,405", reg: "North West", x: 42, y: 42, r: 24, present: 2, missing: 13 },
  { nm: "Edinburgh", pop: "458,492", reg: "Scotland", x: 40, y: 22, r: 22, present: 0, missing: 15 },
  { nm: "Bristol", pop: "425,215", reg: "South West", x: 37, y: 66, r: 21, present: 5, missing: 10 },
  { nm: "Leicester", pop: "406,580", reg: "East Midlands", x: 49, y: 54, r: 20, present: 2, missing: 13 },
  { nm: "Coventry", pop: "352,911", reg: "West Midlands", x: 47, y: 56, r: 18, present: 1, missing: 14 },
  { nm: "Cardiff", pop: "335,145", reg: "Wales", x: 33, y: 67, r: 18, present: 3, missing: 12 },
  { nm: "Nottingham", pop: "323,632", reg: "East Midlands", x: 49, y: 50, r: 17, present: 2, missing: 13 },
];

/* ---------- satellite map ---------- */
const FGMap = ({ children, showGaps = true, dim = false }) => (
  <div style={{ position: "relative", overflow: "hidden", background: "#42502f" }} data-screen-label="Map">
    {/* aerial patchwork */}
    <div style={{ position: "absolute", inset: 0, background: `
      radial-gradient(ellipse 40% 30% at 20% 25%, #5d6b45 0%, transparent 70%),
      radial-gradient(ellipse 45% 35% at 78% 30%, #4a5836 0%, transparent 70%),
      radial-gradient(ellipse 50% 40% at 60% 78%, #566539 0%, transparent 70%),
      radial-gradient(ellipse 35% 30% at 30% 80%, #616e48 0%, transparent 70%)` }}/>
    <div style={{ position: "absolute", inset: 0, opacity: 0.5, background: `
      repeating-linear-gradient(38deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 46px),
      repeating-linear-gradient(128deg, rgba(0,0,0,0.06) 0 1px, transparent 1px 58px),
      repeating-linear-gradient(38deg, rgba(120,140,80,0.10) 0 22px, transparent 22px 44px)` }}/>
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 1000 640" preserveAspectRatio="xMidYMid slice">
      {/* field blocks for texture */}
      {[[60,80,140,90,"#556340"],[210,60,120,120,"#4d5a38"],[340,120,150,80,"#5f6d47"],[520,70,110,100,"#4a5735"],[80,300,130,110,"#5a6842"],[700,90,160,120,"#525f3c"],[620,260,140,90,"#586744"],[820,320,120,140,"#4e5b39"],[260,420,150,110,"#5c6a43"],[440,460,170,100,"#515e3a"],[120,470,120,90,"#606e47"],[680,470,150,120,"#556240"]].map((f,i)=>(
        <rect key={i} x={f[0]} y={f[1]} width={f[2]} height={f[3]} fill={f[4]} opacity="0.55" rx="4"/>
      ))}
      {/* water */}
      <path d="M-20 40 Q120 90 90 200 Q60 300 160 360 L-20 400 Z" fill="#2f4a63" opacity="0.7"/>
      <path d="M760 -20 Q820 120 940 160 L1020 60 Z" fill="#2f4a63" opacity="0.6"/>
      {/* roads */}
      <g stroke="#d9cfa0" strokeWidth="3" fill="none" opacity="0.55">
        <path d="M100 560 Q300 460 460 420 Q640 380 900 300"/>
        <path d="M200 60 Q320 260 420 420 Q520 560 640 620"/>
        <path d="M900 90 Q700 200 560 340 Q420 460 260 560"/>
      </g>
      <g stroke="#e8e0bb" strokeWidth="1.4" fill="none" opacity="0.4">
        <path d="M40 300 Q260 320 520 300 Q760 280 980 320"/>
        <path d="M480 30 L500 610"/>
      </g>
      {dim && <rect x="0" y="0" width="1000" height="640" fill="#1b2412" opacity="0.35"/>}
    </svg>
    {/* built-up areas + gap rings */}
    {showGaps && FG_LOCS.map((l, i) => (
      <React.Fragment key={i}>
        <div style={{ position: "absolute", left: `${l.x}%`, top: `${l.y}%`, width: l.r * 1.7, height: l.r * 1.4,
          transform: "translate(-50%,-50%)", borderRadius: "48% 52% 55% 45%",
          background: "rgba(120,170,235,0.34)", border: "1px solid rgba(150,195,245,0.6)" }}/>
      </React.Fragment>
    ))}
    {children}
    {/* attribution + zoom */}
    <div style={{ position: "absolute", bottom: 10, right: 12, fontFamily: "'JetBrains Mono', monospace",
      fontSize: 9.5, color: "rgba(255,255,255,0.75)", background: "rgba(0,0,0,0.3)", padding: "3px 8px",
      borderRadius: 5, letterSpacing: 0.3 }}>© Mapbox · OpenStreetMap · Maxar</div>
    <div style={{ position: "absolute", top: 14, right: 14, display: "flex", flexDirection: "column",
      background: FG.surface, border: `1px solid ${FG.border}`, borderRadius: 10, overflow: "hidden",
      boxShadow: "0 6px 16px -8px rgba(0,0,0,0.3)" }}>
      {["plus", "close"].map((n, i) => (
        <button key={n} style={{ width: 36, height: 36, border: "none", background: "transparent", cursor: "pointer",
          color: FG.ink, borderTop: i ? `1px solid ${FG.borderSoft}` : "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Ico n={i ? "close" : "plus"} s={13}/>
        </button>
      ))}
    </div>
  </div>
);

/* gap ring + label overlay for the map (purple, = matching towns) */
const FGGapMarkers = ({ labelled = false }) => (
  <React.Fragment>
    {FG_LOCS.map((l, i) => (
      <div key={i} style={{ position: "absolute", left: `${l.x}%`, top: `${l.y}%`, transform: "translate(-50%,-50%)",
        pointerEvents: "none" }}>
        <div style={{ width: l.r, height: l.r, borderRadius: "999px", border: `2px solid ${FG.violet}`,
          background: "rgba(109,49,232,0.16)", transform: "translate(-50%,-50%)", position: "absolute" }}/>
        {labelled && i < 6 && (
          <div style={{ position: "absolute", left: l.r / 2 + 6, top: -9, whiteSpace: "nowrap",
            background: FG.surface, border: `1px solid ${FG.border}`, borderRadius: 6, padding: "2px 7px",
            fontFamily: "Inter", fontSize: 10.5, fontWeight: 600, color: FG.ink, boxShadow: "0 3px 8px -4px rgba(0,0,0,0.3)" }}>{l.nm}</div>
        )}
      </div>
    ))}
  </React.Fragment>
);

const FGChrome = ({ mode = "find" }) => (
  <header className="fg-top" data-screen-label="App chrome">
    <div className="fg-brand"><SMMark/><span className="nm">SiteMatcher</span></div>
    <div className="fg-topsearch"><Ico n="search" s={15} c={FG.ink3}/><input placeholder="Search a town, postcode or address…"/><span className="fg-mono" style={{ fontSize: 10.5, color: FG.ink4 }}>⌘K</span></div>
    <div className="fg-topright">
      <button className="fg-export"><Ico n="download" s={15} c="#fff"/>Export</button>
      <span className="fg-avatar">D</span>
    </div>
  </header>
);

const FGRail = () => (
  <nav className="fg-rail" data-screen-label="Tool rail">
    {[["pin", 0], ["search", 1], ["pen", 0]].map(([n, on], i) => (
      <button key={i} className={`fg-rail-btn${on ? " on" : ""}`} title={n}><Ico n={n} s={19}/></button>
    ))}
    <div style={{ flex: 1 }}/>
    <button className="fg-rail-btn" title="Help"><span style={{ fontWeight: 700, fontSize: 15 }}>?</span></button>
  </nav>
);

/* shared result list */
const FGResultRow = ({ l }) => (
  <div className="fg-loc">
    <span style={{ color: FG.violet }}><IcoFill n="pin" s={18} c={FG.violet}/></span>
    <div>
      <div className="nm">{l.nm}</div>
      <div className="meta"><span>POP {l.pop}</span><span className="miss">· {l.missing} MISSING</span></div>
    </div>
    <span className="chev"><Ico n="chevR" s={14}/></span>
  </div>
);

Object.assign(window, { FG, FG_CSS, FG_LOCS, Ico, IcoFill, SMMark, FGMap, FGGapMarkers, FGChrome, FGRail, FGResultRow });
