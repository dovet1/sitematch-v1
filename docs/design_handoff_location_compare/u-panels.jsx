/* GapFinder — Unified Workspace · panels
   Top chrome, left rail + context panel, right opportunity inspector (the four
   tools as tabs on one selection), and the compare tray. Accent flows through
   var(--acc); density through the `gp` prop. */

/* ---- buttons / rows --------------------------------------------------- */
const UPrimaryBtn = ({ children, icon, onClick, full, AIcon }) => (
  <button onClick={onClick} className="uw-click" style={{
    display: "inline-flex", alignItems: "center", justifyContent: full ? "center" : "flex-start", gap: 7,
    padding: "9px 14px", borderRadius: 9, border: "1px solid var(--acc)", background: "var(--acc)",
    color: "#fff", fontFamily: "Inter", fontSize: 13, fontWeight: 600, cursor: "pointer", width: full ? "100%" : "auto",
  }}>{AIcon ? <AIco name={AIcon} size={14}/> : icon ? <Ico name={icon} size={14}/> : null}{children}</button>
);
const UGhostBtn = ({ children, icon, AIcon, onClick, full, active, danger }) => (
  <button onClick={onClick} className="uw-click" style={{
    display: "inline-flex", alignItems: "center", justifyContent: full ? "center" : "flex-start", gap: 7,
    padding: "8px 12px", borderRadius: 9,
    border: `1px solid ${active ? "var(--acc)" : SS.border}`,
    background: active ? "var(--acc-soft)" : SS.surface,
    color: danger ? "#DC2626" : active ? "var(--acc-deep)" : SS.ink,
    fontFamily: "Inter", fontSize: 12.5, fontWeight: 500, cursor: "pointer", width: full ? "100%" : "auto",
  }}>{AIcon ? <AIco name={AIcon} size={13}/> : icon ? <Ico name={icon} size={13}/> : null}{children}</button>
);

const UToggle = ({ on }) => (
  <span style={{ position: "relative", width: 32, height: 18, borderRadius: 999, flexShrink: 0,
    background: on ? "var(--acc)" : "#DDD6CA", transition: "background .15s" }}>
    <span style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: 999, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)", transition: "left .15s" }}/>
  </span>
);
const UToggleRow = ({ label, sub, on, onClick }) => (
  <div className="uw-click" onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 0", cursor: "pointer" }}>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 500, color: SS.ink }}>{label}</div>
      {sub && <div style={{ fontFamily: "Inter", fontSize: 11.5, color: SS.ink3, marginTop: 1 }}>{sub}</div>}
    </div>
    <UToggle on={on}/>
  </div>
);

const UCheck = ({ on, brand, label, count, onClick }) => (
  <div className="uw-click" onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", cursor: "pointer", fontFamily: "Inter", fontSize: 13.5, color: SS.ink }}>
    <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
      border: `1.5px solid ${on ? "var(--acc)" : SS.border}`, background: on ? "var(--acc)" : SS.surface }}>
      {on && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5L4.5 8L9 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </span>
    {brand && <span style={{ width: 13, height: 13, borderRadius: 4, background: brand, flexShrink: 0 }}/>}
    <span style={{ flex: 1 }}>{label}</span>
    {count != null && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: SS.ink3 }}>{count}</span>}
  </div>
);

const UPseudoSlider = ({ left = "0%", right = "20%", a = "0%", b, labels }) => (
  <div style={{ padding: "12px 0 4px" }}>
    <div style={{ position: "relative", height: 4, borderRadius: 999, background: SS.borderSoft, margin: "14px 0" }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, left, right, background: SS.ink, borderRadius: 999 }}/>
      <div style={{ position: "absolute", top: "50%", left: a, width: 16, height: 16, borderRadius: 999, background: "#fff", border: "2px solid var(--acc)", transform: "translate(-50%,-50%)" }}/>
      {b != null && <div style={{ position: "absolute", top: "50%", left: b, width: 16, height: 16, borderRadius: 999, background: "#fff", border: "2px solid var(--acc)", transform: "translate(-50%,-50%)" }}/>}
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: SS.ink2 }}>
      {labels.map((l, i) => <span key={i}>{l}</span>)}
    </div>
  </div>
);

const USearchBox = ({ placeholder }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 42, background: SS.bg, border: `1px solid ${SS.border}`, borderRadius: 10 }}>
    <Ico name="search" size={15} color={SS.ink3}/>
    <input placeholder={placeholder} style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "Inter", fontSize: 13.5, color: SS.ink }}/>
    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink4 }}>⌘K</span>
  </div>
);

/* ========================================================================
   TOP CHROME
   ======================================================================== */
const ACCOUNT_MENU = [
  { id: "account", label: "Account settings", icon: "user" },
  { id: "subscription", label: "Manage subscription", icon: "wallet" },
  { id: "billing", label: "Billing & invoices", icon: "doc" },
  { divider: true },
  { id: "help", label: "Help & support", icon: "info" },
  { id: "logout", label: "Log out", icon: "logout", danger: true },
];

const UChrome = ({ overlays, onOverlay, area }) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  return (
  <header className="uw-chrome" data-screen-label="App chrome">
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <SMLogoMark/>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
        <span style={{ fontFamily: "Inter", fontSize: 16, fontWeight: 600, color: SS.ink, letterSpacing: -0.3 }}>SiteMatcher</span>
      </div>
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 9, justifySelf: "center", width: "100%", maxWidth: 460 }}>
      <div style={{ flex: 1 }}><USearchBox placeholder="Search a town, postcode or address…"/></div>
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
      <button className="uw-click" onClick={() => onOverlay("requirements")} style={{
        display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 11px", borderRadius: 9, cursor: "pointer",
        border: `1px solid ${overlays.requirements ? "var(--acc)" : SS.border}`,
        background: overlays.requirements ? "var(--acc-soft)" : SS.surface,
        color: overlays.requirements ? "var(--acc-deep)" : SS.ink2, fontFamily: "Inter", fontSize: 12.5, fontWeight: 500 }}>
        <span style={{ width: 9, height: 9, transform: "rotate(45deg)", background: overlays.requirements ? "var(--acc)" : SS.ink4, borderRadius: 2 }}/>
        Requirements
      </button>
      <button className="uw-click" onClick={() => onOverlay("traffic")} style={{
        display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 11px", borderRadius: 9, cursor: "pointer",
        border: `1px solid ${overlays.traffic ? SS.orange : SS.border}`,
        background: overlays.traffic ? "#FEF1E7" : SS.surface,
        color: overlays.traffic ? "#C2410C" : SS.ink2, fontFamily: "Inter", fontSize: 12.5, fontWeight: 500 }}>
        <AIco name="road" size={13}/> Traffic
      </button>
      <div style={{ width: 1, height: 24, background: SS.border, margin: "0 2px" }}/>
      <UPrimaryBtn icon="download">Export</UPrimaryBtn>

      <div ref={wrapRef} style={{ position: "relative", marginLeft: 4 }}>
        <button
          className="uw-click"
          onClick={() => setMenuOpen(o => !o)}
          title="Account"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 6px 3px 3px",
            borderRadius: 999, cursor: "pointer",
            background: menuOpen ? SS.bg : "transparent",
            border: `1px solid ${menuOpen ? SS.border : "transparent"}`,
          }}>
          <span style={{ width: 30, height: 30, borderRadius: 999, background: "var(--acc)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter", fontSize: 13, fontWeight: 600 }}>N</span>
          <AIco name="chevdown" size={13} color={SS.ink3}/>
        </button>

        {menuOpen && (
          <div role="menu" style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0, width: 248,
            background: SS.surface, border: `1px solid ${SS.border}`, borderRadius: 12,
            boxShadow: "0 24px 60px -20px rgba(20,10,40,.3)", padding: 6, zIndex: 60,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 10px" }}>
              <span style={{ width: 38, height: 38, borderRadius: 999, background: "var(--acc)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter", fontSize: 15, fontWeight: 600, flexShrink: 0 }}>N</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "Inter", fontSize: 13.5, fontWeight: 600, color: SS.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Naomi Whitfield</div>
                <div style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>naomi@northpoint.co.uk</div>
              </div>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, margin: "0 10px 6px", padding: "2px 8px", borderRadius: 999, background: "var(--acc-soft)", color: "var(--acc-deep)", fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 700, letterSpacing: .4, textTransform: "uppercase" }}>Pro plan</div>
            <div style={{ height: 1, background: SS.borderSoft, margin: "4px 4px" }}/>
            {ACCOUNT_MENU.map((m, i) => m.divider ? (
              <div key={`d${i}`} style={{ height: 1, background: SS.borderSoft, margin: "4px 4px" }}/>
            ) : (
              <button key={m.id} role="menuitem" onClick={() => setMenuOpen(false)} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px",
                border: "none", background: "transparent", cursor: "pointer", borderRadius: 8,
                fontFamily: "Inter", fontSize: 13, fontWeight: 500, textAlign: "left",
                color: m.danger ? "#C2410C" : SS.ink,
              }}
                onMouseEnter={e => e.currentTarget.style.background = m.danger ? "#FEF1E7" : SS.bg}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <AccMenuIco name={m.icon} color={m.danger ? "#C2410C" : SS.ink3}/>
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  </header>
  );
};

/* account-menu icons: reuse Ico/AIco where available, custom logout glyph */
const AccMenuIco = ({ name, color }) => {
  if (name === "logout") return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6"/><path d="M10 11l3-3-3-3"/><path d="M13 8H6.5"/>
    </svg>
  );
  if (name === "wallet" || name === "doc" || name === "info") return <AIco name={name} size={15} color={color}/>;
  return <Ico name={name} size={15} color={color}/>;
};

const SMLogoMark = ({ size = 26 }) => (
  <svg height={size} viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
    <g fill="var(--acc)">
      <path d="M2.61,37.02a1.46,1.46,0,0,1-.11-.55V4A1.5,1.5,0,0,1,4,2.5H15.77a1.5,1.5,0,0,1,1.06.44L27.18,13.29a1.5,1.5,0,0,1,0,2.12L5.06,37.53A1.51,1.51,0,0,1,2.61,37.02Z"/>
      <path d="M61.5,4V15.77a1.8,1.8,0,0,1-.11.57,1.63,1.63,0,0,1-.33.49L50.71,27.18a1.51,1.51,0,0,1-2.12,0L26.47,5.06a1.52,1.52,0,0,1,.49-2.45,1.79,1.79,0,0,1,.57-.11L60,2.5A1.5,1.5,0,0,1,61.5,4Z"/>
      <path d="M61.39,26.98a1.46,1.46,0,0,1,.11.55V60A1.5,1.5,0,0,1,60,61.5H48.23a1.51,1.51,0,0,1-1.06-.44L36.82,50.71a1.5,1.5,0,0,1,0-2.12L58.94,26.47A1.51,1.51,0,0,1,61.39,26.98Z"/>
      <path d="M19.17,30.94,30.94,19.17a1.51,1.51,0,0,1,2.12,0L44.83,30.94a1.51,1.51,0,0,1,0,2.12L33.06,44.83a1.52,1.52,0,0,1-2.12,0L19.17,33.06A1.51,1.51,0,0,1,19.17,30.94Z"/>
      <path d="M37.86,59.45a1.51,1.51,0,0,1-1.39,2.05L4,61.5A1.5,1.5,0,0,1,2.5,60V48.23a1.81,1.81,0,0,1,.11-.57,1.63,1.63,0,0,1,.33-.49L13.29,36.82a1.55,1.55,0,0,1,2.12,0L37.53,58.94A1.29,1.29,0,0,1,37.86,59.45Z"/>
    </g>
  </svg>
);

/* ========================================================================
   LEFT RAIL
   ======================================================================== */
const RAIL_MODES = [
  { id: "assess", icon: "pin", label: "Assess Area" },
  { id: "find", icon: "search", label: "Find Gaps" },
  { id: "sketch", icon: "polygon", label: "Sketch Site" },
  { id: "requirements", icon: "doc", label: "Requirements" },
  { id: "directory", icon: "layers", label: "Directory" },
];
const RAIL_TOOLS = [
  { id: "catchment", icon: "target", label: "Catchment" },
];

const URail = ({ wide, view, tab, area, onMode, onTool }) => (
  <nav className={`uw-rail${wide ? " wide" : ""}`} data-screen-label="Tool rail">
    {RAIL_MODES.map(m => (
      <button key={m.id} className={`uw-rail-btn uw-click${view === m.id && !area ? " on" : ""}`} onClick={() => onMode(m.id)} title={m.label}>
        {m.id === "requirements" ? <span style={{ width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><span style={{ width: 11, height: 11, transform: "rotate(45deg)", background: "currentColor", borderRadius: 2 }}/></span> : <Ico name={m.icon} size={18}/>}
        {wide && <span className="lab">{m.label}</span>}
      </button>
    ))}
    {wide && area && <div className="uw-rail-div"/>}
    {wide && area && RAIL_TOOLS.map(tl => (
      <button key={tl.id} className={`uw-rail-btn uw-click${tab === tl.id ? " on" : ""}`} onClick={() => onTool(tl.id)} title={tl.label}>
        <Ico name={tl.icon} size={18}/>{wide && <span className="lab">{tl.label}</span>}
      </button>
    ))}
    <div style={{ flex: 1 }}/>
    <button className="uw-rail-btn uw-click" title="Help"><span style={{ fontFamily: "Inter", fontWeight: 700, fontSize: 15 }}>?</span>{wide && <span className="lab">Help</span>}</button>
  </nav>
);

/* ========================================================================
   LEFT CONTEXT PANEL
   ======================================================================== */
const PanelHd = ({ kicker, title, sub, gp }) => (
  <div style={{ padding: `${gp}px ${gp}px ${gp - 4}px`, borderBottom: `1px solid ${SS.borderSoft}` }}>
    <UKicker color="var(--acc-deep)">{kicker}</UKicker>
    <div style={{ fontFamily: "Inter", fontSize: 17, fontWeight: 600, color: SS.ink, letterSpacing: -0.3, marginTop: 5 }}>{title}</div>
    {sub && <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink3, marginTop: 4, lineHeight: 1.45 }}>{sub}</div>}
  </div>
);

const Hint = ({ children, gp }) => (
  <div style={{ margin: `${gp}px`, padding: 12, borderRadius: 10, background: "var(--acc-soft)", border: "1px solid var(--acc-tint)", display: "flex", gap: 9, alignItems: "flex-start" }}>
    <AIco name="info" size={14} color="var(--acc-deep)"/>
    <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink2, lineHeight: 1.5 }}>{children}</div>
  </div>
);

/* ---- CAD plan library: scales to 100+ instanced store plans ---------- */
const CADLibrary = ({ gp, selected, onSelect }) => {
  const [q, setQ] = React.useState("");
  const [fmt, setFmt] = React.useState("all");

  const counts = React.useMemo(() => {
    const c = { all: CAD_LIBRARY.length };
    CAD_LIBRARY.forEach(p => { c[p.archetype] = (c[p.archetype] || 0) + 1; });
    return c;
  }, []);
  const formatChips = React.useMemo(() => (
    [{ key: "all", label: "All" }, ...Object.keys(CAD_FORMATS).map(k => ({ key: k, label: CAD_FORMATS[k].format }))]
      .filter(ch => ch.key === "all" || counts[ch.key])
  ), [counts]);

  const list = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    return CAD_LIBRARY.filter(p =>
      (fmt === "all" || p.archetype === fmt) &&
      (!qq || `${p.brand} ${p.format} ${p.source} ${p.year}`.toLowerCase().includes(qq))
    );
  }, [q, fmt]);

  return (
    <React.Fragment>
      <USecHd>CAD plan library</USecHd>
      <div style={{ padding: `0 ${gp}px 4px`, fontFamily: "Inter", fontSize: 11.5, color: SS.ink3, lineHeight: 1.5 }}>
        Drop a to-scale store plan onto the parcel to test fit. Tap to place; tap again to remove.
      </div>

      {/* search */}
      <div style={{ padding: `8px ${gp}px 0` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 11px", height: 34, background: SS.bg, border: `1px solid ${SS.border}`, borderRadius: 8 }}>
          <Ico name="search" size={13} color={SS.ink3}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search brand, format or store…"
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "Inter", fontSize: 12.5, color: SS.ink, minWidth: 0 }}/>
          {q && <button className="uw-click" onClick={() => setQ("")} title="Clear" style={{ border: "none", background: "transparent", cursor: "pointer", color: SS.ink3, fontFamily: "Inter", fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>}
        </div>
      </div>

      {/* format filter chips */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: `9px ${gp}px 2px`, scrollbarWidth: "none" }}>
        {formatChips.map(ch => {
          const on = fmt === ch.key;
          return (
            <button key={ch.key} className="uw-click" onClick={() => setFmt(ch.key)} style={{
              flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999, cursor: "pointer",
              border: `1px solid ${on ? CAD_TEAL : SS.border}`, background: on ? "#ECFBF8" : SS.surface,
              color: on ? "#0B6F65" : SS.ink2, fontFamily: "Inter", fontSize: 11.5, fontWeight: 500, whiteSpace: "nowrap" }}>
              {ch.label}
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: on ? "#0B6F65" : SS.ink4 }}>{counts[ch.key] || 0}</span>
            </button>
          );
        })}
      </div>

      {/* result count */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: `8px ${gp}px 0` }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink3, letterSpacing: 0.3 }}>
          {list.length === CAD_LIBRARY.length ? `${CAD_LIBRARY.length} PLANS` : `${list.length} OF ${CAD_LIBRARY.length}`}
        </span>
        {selected && <button className="uw-click" onClick={() => onSelect(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: CAD_TEAL, fontFamily: "Inter", fontSize: 11.5, fontWeight: 600, padding: 0 }}>Clear placed</button>}
      </div>

      {/* scrollable result grid */}
      <div style={{ margin: `6px ${gp}px ${gp}px`, maxHeight: 332, overflowY: "auto", borderRadius: 10, border: `1px solid ${SS.borderSoft}`, background: SS.bg }}>
        {list.length === 0 ? (
          <div style={{ padding: "28px 16px", textAlign: "center", fontFamily: "Inter", fontSize: 12.5, color: SS.ink3, lineHeight: 1.5 }}>
            No plans match “{q}”.<br/><span style={{ color: SS.ink4 }}>Try a different brand, format or store.</span>
          </div>
        ) : (
          <div style={{ padding: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {list.map(p => {
              const on = selected === p.id;
              return (
                <button key={p.id} className="uw-click" onClick={() => onSelect(on ? null : p.id)} style={{
                  textAlign: "left", padding: 0, overflow: "hidden", borderRadius: 10, cursor: "pointer",
                  border: `1px solid ${on ? CAD_TEAL : SS.border}`, background: SS.surface,
                  boxShadow: on ? `0 0 0 3px ${CAD_TEAL}22` : "none" }}>
                  <div style={{ position: "relative", height: 66, background: on ? "#ECFBF8" : SS.bg, borderBottom: `1px solid ${SS.borderSoft}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CADPlanSVG plan={p} width={46} height={55} stroke={on ? CAD_TEAL : SS.ink3}/>
                    {on && <span style={{ position: "absolute", top: 6, right: 6, width: 16, height: 16, borderRadius: 999, background: CAD_TEAL, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ico name="check" size={10} color="#fff"/></span>}
                    <span style={{ position: "absolute", bottom: 5, left: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: 0.4, color: SS.ink4 }}>1:200</span>
                  </div>
                  <div style={{ padding: "7px 9px 9px" }}>
                    <div style={{ fontFamily: "Inter", fontSize: 12.5, fontWeight: 600, color: SS.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.brand}</div>
                    <div style={{ fontFamily: "Inter", fontSize: 11, color: SS.ink3, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.format}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5, color: on ? "#0B6F65" : SS.ink2, minWidth: 0 }}>
                      <Ico name="pin" size={10} color={on ? CAD_TEAL : SS.ink4}/>
                      <span style={{ fontFamily: "Inter", fontSize: 10.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.source}, {p.year}</span>
                    </div>
                    <div style={{ marginTop: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: SS.ink3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.gia} m² · {p.dims}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </React.Fragment>
  );
};

/* ---- Sketch Site: per-tool panel (Select / Polygon / Parking / CAD / Measure) ---- */
const U_KBD = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 500,
  padding: "2px 7px", borderRadius: 5, background: SS.bg, border: `1px solid ${SS.border}`,
  color: SS.ink2, justifySelf: "end", whiteSpace: "nowrap",
};
const UShortcuts = ({ gp, rows }) => (
  <React.Fragment>
    <USecHd>Shortcuts</USecHd>
    <div style={{ padding: `0 ${gp}px ${gp}px`, display: "grid", gridTemplateColumns: "1fr auto", rowGap: 9, columnGap: 12, alignItems: "center" }}>
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <span style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink2 }}>{k}</span>
          <kbd style={U_KBD}>{v}</kbd>
        </React.Fragment>
      ))}
    </div>
  </React.Fragment>
);

const SKETCH_TOOLS = [
  { id: "select", icon: "cursor", l: "Select" },
  { id: "plot", icon: "polygon", l: "Polygon" },
  { id: "parking", icon: "parking", l: "Parking" },
  { id: "cad", icon: "cad", l: "CAD" },
  { id: "ruler", icon: "ruler", l: "Measure" },
];
const SKETCH_META = {
  select:  { title: "Layers", sub: "Everything placed on this parcel — pick an object to inspect it." },
  plot:    { title: "Draw polygon", sub: "Click on the map to drop points. Hold Shift to snap edges to 90°." },
  parking: { title: "Add parking", sub: "Configure the block, then click on the map to place it." },
  cad:     { title: "CAD plans", sub: "Drop a to-scale store plan onto the parcel to test fit." },
  ruler:   { title: "Measure distance", sub: "Click points on the map to measure. Enter to finish, Esc to clear." },
};

const SketchPanel = ({ gp, sketch, onSketch, session, onRename, onSave, onExit }) => {
  const [poly, setPoly] = React.useState({ color: "violet", snap90: false, dist: true, grid: false });
  const [park, setPark] = React.useState({ count: 24, layout: "single", size: "standard" });
  const [selObj, setSelObj] = React.useState("plot");
  const layer = sketch.layer || "select";
  const meta = SKETCH_META[layer] || SKETCH_META.select;

  /* parking preview maths */
  const stallW = park.size === "standard" ? 2.4 : 2.7;
  const stallL = park.size === "standard" ? 4.8 : 5.0;
  const perRow = park.layout === "double" ? Math.ceil(park.count / 2) : park.count;
  const pvW = (perRow * stallW).toFixed(1);
  const pvD = (stallL * (park.layout === "double" ? 2 : 1)).toFixed(1);

  if (!session) return null;
  return (
    <aside className="uw-left" data-screen-label="Left panel">
      <SketchSessionBar session={session} gp={gp} onRename={onRename} onSave={onSave} onExit={onExit}/>
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <div style={{ padding: `${gp}px ${gp}px 0` }}>
          <UKicker color="var(--acc-deep)">{meta.title}</UKicker>
          <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink3, marginTop: 5, lineHeight: 1.45 }}>{meta.sub}</div>
        </div>
        {/* tool selector — always visible */}
        <div style={{ padding: gp }}>
          <UKicker>Tools</UKicker>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, marginTop: 8 }}>
            {SKETCH_TOOLS.map(tl => (
              <button key={tl.id} className="uw-click" onClick={() => onSketch({ ...sketch, layer: tl.id })} title={tl.l} style={{
                aspectRatio: "1", borderRadius: 9, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                border: `1px solid ${layer === tl.id ? "var(--acc)" : SS.border}`, background: layer === tl.id ? "var(--acc-soft)" : SS.surface,
                color: layer === tl.id ? "var(--acc-deep)" : SS.ink2 }}>
                <Ico name={tl.icon} size={16}/>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: 0.3, textTransform: "uppercase" }}>{tl.l}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: 1, background: SS.borderSoft, margin: `0 ${gp}px` }}/>

        {/* ===== SELECT → Layers ===== */}
        {layer === "select" && (
          <React.Fragment>
            <div style={{ padding: `${gp}px ${gp}px 0`, fontFamily: "Inter", fontSize: 12, color: SS.ink3 }}>2 objects in sketch</div>
            <USecHd>Polygons (1)</USecHd>
            <div style={{ padding: `0 0 4px` }}>
              {[{ n: `Scheme ${sketch.scheme} · Plot A`, d: "2,480 m² · 4 pts", c: POLY[0], id: "plot" }].map(l => (
                <div key={l.id} className="uw-row uw-click" onClick={() => setSelObj(l.id)} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: `9px ${gp}px`, cursor: "pointer",
                  borderLeft: `3px solid ${selObj === l.id ? l.c.stroke : "transparent"}`, background: selObj === l.id ? "var(--acc-soft)" : "transparent" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: l.c.fill, border: `1.5px solid ${l.c.stroke}`, flexShrink: 0 }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 500, color: SS.ink }}>{l.n}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, marginTop: 1 }}>{l.d}</div>
                  </div>
                </div>
              ))}
            </div>
            <USecHd>Parking (1) · 24 spaces</USecHd>
            <div style={{ padding: `0 0 4px` }}>
              {[{ n: "Parking block", d: "24 spaces · single row", c: POLY[1], id: "parking" }].map(l => (
                <div key={l.id} className="uw-row uw-click" onClick={() => setSelObj(l.id)} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: `9px ${gp}px`, cursor: "pointer",
                  borderLeft: `3px solid ${selObj === l.id ? l.c.stroke : "transparent"}`, background: selObj === l.id ? "var(--acc-soft)" : "transparent" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: l.c.fill, border: `1.5px solid ${l.c.stroke}`, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ico name="parking" size={9} color={l.c.stroke}/></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 500, color: SS.ink }}>{l.n}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, marginTop: 1 }}>{l.d}</div>
                  </div>
                </div>
              ))}
            </div>
            {sketch.cad && CAD_BY_ID[sketch.cad] && (
              <React.Fragment>
                <USecHd>CAD overlay (1)</USecHd>
                <div style={{ padding: `0 0 4px` }}>
                  <div className="uw-row uw-click" onClick={() => setSelObj("cad")} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: `9px ${gp}px`, cursor: "pointer",
                    borderLeft: `3px solid ${selObj === "cad" ? CAD_TEAL : "transparent"}`, background: selObj === "cad" ? "#ECFBF8" : "transparent" }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, border: `1.5px solid ${CAD_TEAL}`, flexShrink: 0 }}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 500, color: SS.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{CAD_BY_ID[sketch.cad].brand} · {CAD_BY_ID[sketch.cad].format}</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, marginTop: 1 }}>{CAD_BY_ID[sketch.cad].source}, {CAD_BY_ID[sketch.cad].year}</div>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            )}
            <USecHd>Scheme versions</USecHd>
            <div style={{ padding: `0 ${gp}px`, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["A", "B", "C"].map(s => (
                <button key={s} className="uw-click" onClick={() => onSketch({ ...sketch, scheme: s })} style={{
                  padding: "7px 13px", borderRadius: 8, cursor: "pointer", fontFamily: "Inter", fontSize: 13, fontWeight: 600,
                  border: `1px solid ${sketch.scheme === s ? "var(--acc)" : SS.border}`, background: sketch.scheme === s ? "var(--acc)" : SS.surface, color: sketch.scheme === s ? "#fff" : SS.ink }}>Scheme {s}</button>
              ))}
              <button className="uw-click" style={{ padding: "7px 11px", borderRadius: 8, cursor: "pointer", border: `1px dashed ${SS.border}`, background: "transparent", color: SS.ink2, fontFamily: "Inter", fontSize: 13 }}>+ New</button>
            </div>
            <div style={{ padding: gp, fontFamily: "Inter", fontSize: 11.5, color: SS.ink3, lineHeight: 1.5 }}>
              Each scheme is a saved version of this parcel — duplicate to compare layouts side by side.
            </div>
          </React.Fragment>
        )}

        {/* ===== POLYGON ===== */}
        {layer === "plot" && (
          <React.Fragment>
            <Hint gp={gp}>Click on the map to drop points. Click the first point to close, or press <kbd style={U_KBD}>↵</kbd> to finish.</Hint>
            <USecHd>Polygon colour</USecHd>
            <div style={{ padding: `0 ${gp}px ${gp}px`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {POLY.map(p => {
                const on = poly.color === p.id;
                return (
                  <button key={p.id} className="uw-click" onClick={() => setPoly({ ...poly, color: p.id })} style={{
                    display: "flex", alignItems: "center", gap: 7, padding: "8px 10px", borderRadius: 9, cursor: "pointer",
                    border: `1px solid ${on ? p.stroke : SS.border}`, background: on ? p.fill : SS.surface,
                    boxShadow: on ? `0 0 0 3px ${p.fill}` : "none" }}>
                    <span style={{ width: 14, height: 14, borderRadius: 999, background: p.fill, border: `2px solid ${p.stroke}`, flexShrink: 0 }}/>
                    <span style={{ fontFamily: "Inter", fontSize: 12.5, fontWeight: on ? 600 : 500, color: SS.ink, textTransform: "capitalize" }}>{p.id}</span>
                  </button>
                );
              })}
            </div>
            <USecHd>Options</USecHd>
            <div style={{ padding: `0 ${gp}px` }}>
              <UToggleRow label="90° mode" sub="Force the next edge to a right angle" on={poly.snap90} onClick={() => setPoly({ ...poly, snap90: !poly.snap90 })}/>
              <div style={{ height: 1, background: SS.borderSoft }}/>
              <UToggleRow label="Show edge distances" sub="Live measurement on every edge" on={poly.dist} onClick={() => setPoly({ ...poly, dist: !poly.dist })}/>
              <div style={{ height: 1, background: SS.borderSoft }}/>
              <UToggleRow label="Snap to grid (1m)" sub="Round points to nearest metre" on={poly.grid} onClick={() => setPoly({ ...poly, grid: !poly.grid })}/>
            </div>
            <UShortcuts gp={gp} rows={[["Finish polygon", "↵"], ["Cancel last point", "⌫"], ["Snap edge to 90°", "⇧"], ["Switch to select", "V"]]}/>
          </React.Fragment>
        )}

        {/* ===== PARKING ===== */}
        {layer === "parking" && (
          <React.Fragment>
            <Hint gp={gp}>Configure the block below, then click on the map to drop it. Drag to rotate.</Hint>
            <USecHd>Number of spaces</USecHd>
            <div style={{ padding: `0 ${gp}px ${gp}px` }}>
              <div style={{ display: "flex", alignItems: "stretch", border: `1px solid ${SS.border}`, borderRadius: 9, overflow: "hidden", background: SS.surface }}>
                <button className="uw-click" onClick={() => setPark({ ...park, count: Math.max(1, park.count - 1) })} style={{ width: 42, border: "none", borderRight: `1px solid ${SS.borderSoft}`, cursor: "pointer", background: SS.bg, color: SS.ink2, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ico name="minus" size={14}/></button>
                <div style={{ flex: 1, textAlign: "center", padding: "10px 0", fontFamily: "Inter", fontSize: 15, fontWeight: 600, color: SS.ink }}>{park.count}</div>
                <button className="uw-click" onClick={() => setPark({ ...park, count: park.count + 1 })} style={{ width: 42, border: "none", borderLeft: `1px solid ${SS.borderSoft}`, cursor: "pointer", background: SS.bg, color: SS.ink2, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ico name="plus" size={14}/></button>
              </div>
            </div>
            <USecHd>Layout</USecHd>
            <div style={{ padding: `0 ${gp}px ${gp}px` }}>
              <SSSegmentedFull value={park.layout} onChange={(v) => setPark({ ...park, layout: v })} options={[{ value: "single", label: "Single row" }, { value: "double", label: "Double row" }]}/>
            </div>
            <USecHd>Stall size</USecHd>
            <div style={{ padding: `0 ${gp}px ${gp}px`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[{ v: "standard", t: "Standard", s: "2.4 × 4.8 m" }, { v: "larger", t: "Larger", s: "2.7 × 5.0 m" }].map(o => {
                const on = park.size === o.v;
                return (
                  <button key={o.v} className="uw-click" onClick={() => setPark({ ...park, size: o.v })} style={{
                    padding: "10px 12px", textAlign: "left", cursor: "pointer", borderRadius: 9,
                    border: `1px solid ${on ? "var(--acc)" : SS.border}`, background: on ? "var(--acc-soft)" : SS.surface }}>
                    <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 600, color: on ? "var(--acc-deep)" : SS.ink }}>{o.t}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, marginTop: 2 }}>{o.s}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ padding: `0 ${gp}px ${gp}px` }}>
              <div style={{ padding: 12, borderRadius: 10, background: "var(--acc-soft)", border: "1px solid var(--acc-tint)" }}>
                <UKicker color="var(--acc-deep)">Preview</UKicker>
                <div style={{ fontFamily: "Inter", fontSize: 17, fontWeight: 600, color: SS.ink, marginTop: 5 }}>{pvW} × {pvD} m</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: SS.ink2, marginTop: 2 }}>{park.count} spaces · {park.layout} row</div>
              </div>
            </div>
            <UShortcuts gp={gp} rows={[["Place block", "Click map"], ["Rotate", "Drag"], ["Switch to select", "V"], ["Cancel", "Esc"]]}/>
          </React.Fragment>
        )}

        {/* ===== CAD ===== */}
        {layer === "cad" && (
          <React.Fragment>
            <div style={{ padding: `${gp}px ${gp}px 0` }}>
              <UGhostBtn icon="upload" full>Upload a new CAD plan</UGhostBtn>
            </div>
            <CADLibrary gp={gp} selected={sketch.cad} onSelect={(id) => onSketch({ ...sketch, cad: id })}/>
          </React.Fragment>
        )}

        {/* ===== MEASURE ===== */}
        {layer === "ruler" && (
          <React.Fragment>
            <Hint gp={gp}>Click points on the map to measure distances. Press <kbd style={U_KBD}>↵</kbd> to finish, or <kbd style={U_KBD}>Esc</kbd> to clear.</Hint>
            <div style={{ padding: `0 ${gp}px ${gp}px` }}>
              <div style={{ border: `1.5px dashed ${SS.border}`, borderRadius: 12, padding: "26px 16px", textAlign: "center", background: SS.bg, fontFamily: "Inter", fontSize: 13, color: SS.ink3, lineHeight: 1.5 }}>
                Click on the map to start measuring
              </div>
            </div>
            <UShortcuts gp={gp} rows={[["Measure tool", "M"], ["Finish & keep visible", "↵"], ["Clear measurement", "Esc"], ["Switch to select", "V"]]}/>
          </React.Fragment>
        )}
      </div>
    </aside>
  );
};

/* ========================================================================
   PRESENCE & PROXIMITY FILTERS  (Find Gaps left panel)
   A rule builder: “towns that contain / exclude / sit within N km of a
   category · brand · fascia.” Each rule is
   { id, kind:"presence"|"proximity", op, type:"category"|"brand"|"fascia", value, km }
   ======================================================================== */
const U_TYPE_LABEL = { category: "Category", brand: "Brand", fascia: "Fascia" };
const U_KM_STEPS = [1, 3, 5, 10];
const U_POS = { soft: "var(--acc-soft)", tint: "var(--acc-tint)", deep: "var(--acc-deep)", acc: "var(--acc)" };
const U_NEG = { soft: "#FCECEA", tint: "#F4D2CC", deep: "#B23A2C", acc: "#C2452F" };

const uRuleLabel = (r) => {
  if (r.kind === "proximity") return `${r.op === "within" ? "Within" : "Beyond"} ${r.km} km`;
  return r.op === "has" ? "Contains" : "Excludes";
};
const uRulePositive = (r) => r.op === "has" || r.op === "within";

/* A committed rule, shown as an editable row */
const URuleRow = ({ r, onToggle, onRemove }) => {
  const pos = uRulePositive(r);
  const c = pos ? U_POS : U_NEG;
  const icon = r.kind === "proximity" ? "target" : (pos ? "check" : "close");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10,
      border: `1px solid ${c.tint}`, background: c.soft, marginBottom: 7 }}>
      <span style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: c.acc, color: "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ico name={icon} size={13}/></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <button className="uw-click" onClick={() => onToggle(r)} title="Flip condition" style={{
          border: "none", background: "transparent", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
          fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: 700, color: c.deep }}>
          {uRuleLabel(r)} <Ico name="rotate" size={10} color={c.deep}/>
        </button>
        <div style={{ fontFamily: "Inter", fontSize: 13.5, fontWeight: 600, color: SS.ink, letterSpacing: -0.1, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {r.value} <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, fontWeight: 400 }}>· {U_TYPE_LABEL[r.type]}</span>
        </div>
      </div>
      <button className="uw-click" onClick={() => onRemove(r)} title="Remove" style={{ border: "none", background: "transparent", cursor: "pointer", color: SS.ink4, padding: 4, display: "inline-flex", flexShrink: 0 }}><Ico name="close" size={12}/></button>
    </div>
  );
};

/* Searchable value picker for the builder */
const UValuePicker = ({ type, value, onPick }) => {
  const [q, setQ] = React.useState("");
  const opts = U_FILTER_OPTIONS[type] || [];
  const filtered = opts.filter(o => (o.label + " " + (o.sub || "")).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px", height: 34, background: SS.surface, border: `1px solid ${SS.border}`, borderRadius: 8 }}>
        <Ico name="search" size={13} color={SS.ink3}/>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${U_TYPE_LABEL[type].toLowerCase()}…`}
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "Inter", fontSize: 12.5, color: SS.ink, minWidth: 0 }}/>
      </div>
      <div style={{ maxHeight: 132, overflow: "auto", marginTop: 6, border: `1px solid ${SS.borderSoft}`, borderRadius: 8, background: SS.surface }}>
        {filtered.length === 0 && <div style={{ padding: "10px 11px", fontFamily: "Inter", fontSize: 12, color: SS.ink3 }}>No matches</div>}
        {filtered.map(o => {
          const on = o.value === value;
          return (
            <div key={o.value} className="uw-click" onClick={() => onPick(o.value)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 11px", cursor: "pointer",
              background: on ? "var(--acc-soft)" : "transparent", borderBottom: `1px solid ${SS.borderSoft}` }}>
              <span style={{ width: 15, height: 15, borderRadius: 999, flexShrink: 0, border: `1.5px solid ${on ? "var(--acc)" : SS.border}`, background: on ? "var(--acc)" : SS.surface, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                {on && <Ico name="check" size={9} color="#fff"/>}
              </span>
              <span style={{ flex: 1, fontFamily: "Inter", fontSize: 12.5, fontWeight: on ? 600 : 400, color: SS.ink }}>{o.label}</span>
              {o.sub && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: SS.ink3 }}>{o.sub}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* Inline rule builder */
const URuleBuilder = ({ onAdd, onCancel }) => {
  const [kind, setKind] = React.useState("presence");
  const [type, setType] = React.useState("brand");
  const [value, setValue] = React.useState(null);
  const [pOp, setPOp] = React.useState("has");    // presence
  const [zOp, setZOp] = React.useState("within"); // proximity
  const [km, setKm] = React.useState(5);
  const commit = () => {
    if (!value) return;
    onAdd(kind === "presence"
      ? { id: "r" + Date.now(), kind, type, value, op: pOp }
      : { id: "r" + Date.now(), kind, type, value, op: zOp, km });
  };
  const seg = (opts, v, on) => <SSSegmentedFull options={opts} value={v} onChange={on}/>;
  return (
    <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${SS.border}`, background: SS.bg }}>
      <UKicker>Condition</UKicker>
      <div style={{ marginTop: 6 }}>{seg([{ value: "presence", label: "Presence" }, { value: "proximity", label: "Proximity" }], kind, setKind)}</div>

      <UKicker style={{ display: "block", marginTop: 12 }}>Match on</UKicker>
      <div style={{ marginTop: 6 }}>{seg([{ value: "category", label: "Category" }, { value: "brand", label: "Brand" }, { value: "fascia", label: "Fascia" }], type, (t) => { setType(t); setValue(null); })}</div>

      <div style={{ marginTop: 10 }}><UValuePicker type={type} value={value} onPick={setValue}/></div>

      {kind === "presence" ? (
        <React.Fragment>
          <UKicker style={{ display: "block", marginTop: 12 }}>Town must</UKicker>
          <div style={{ marginTop: 6 }}>{seg([{ value: "has", label: "Contain it", icon: "check" }, { value: "lacks", label: "Exclude it", icon: "close" }], pOp, setPOp)}</div>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <UKicker style={{ display: "block", marginTop: 12 }}>Proximity</UKicker>
          <div style={{ marginTop: 6 }}>{seg([{ value: "within", label: "Within" }, { value: "beyond", label: "Beyond" }], zOp, setZOp)}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {U_KM_STEPS.map(v => (
              <button key={v} className="uw-click" onClick={() => setKm(v)} style={{ flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11, border: `1px solid ${km === v ? SS.ink : SS.borderSoft}`,
                background: km === v ? SS.ink : SS.surface, color: km === v ? "#fff" : SS.ink2 }}>{v} km</button>
            ))}
          </div>
        </React.Fragment>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="uw-click" onClick={onCancel} style={{ flex: 1, padding: "9px 0", borderRadius: 9, cursor: "pointer", border: `1px solid ${SS.border}`, background: SS.surface, fontFamily: "Inter", fontSize: 13, fontWeight: 500, color: SS.ink2 }}>Cancel</button>
        <button className="uw-click" onClick={commit} disabled={!value} style={{ flex: 1.4, padding: "9px 0", borderRadius: 9, cursor: value ? "pointer" : "not-allowed",
          border: "1px solid var(--acc)", background: value ? "var(--acc)" : "var(--acc-soft)", color: value ? "#fff" : "var(--acc-deep)", opacity: value ? 1 : 0.6,
          fontFamily: "Inter", fontSize: 13, fontWeight: 600 }}>Add filter</button>
      </div>
    </div>
  );
};

const UGapFilters = ({ gp, rules, onAdd, onRemove, onToggle }) => {
  const [building, setBuilding] = React.useState(false);
  return (
    <React.Fragment>
      <USecHd>Presence &amp; proximity</USecHd>
      <div style={{ padding: `0 ${gp}px ${gp}px` }}>
        <div style={{ fontFamily: "Inter", fontSize: 11.5, color: SS.ink3, marginBottom: 10, lineHeight: 1.45 }}>Surface towns by what they contain — or don’t — and by distance to any category, brand or individual fascia.</div>
        {rules.map(r => <URuleRow key={r.id} r={r} onToggle={onToggle} onRemove={onRemove}/>)}
        {rules.length === 0 && !building && (
          <div style={{ border: `1.5px dashed ${SS.border}`, borderRadius: 10, padding: "16px 12px", textAlign: "center", fontFamily: "Inter", fontSize: 12, color: SS.ink3, marginBottom: 10 }}>No filters yet — showing every built-up area.</div>
        )}
        {building ? (
          <div style={{ marginTop: 3 }}>
            <URuleBuilder onAdd={(r) => { onAdd(r); setBuilding(false); }} onCancel={() => setBuilding(false)}/>
          </div>
        ) : (
          <UGhostBtn icon="plus" full onClick={() => setBuilding(true)}>Add filter</UGhostBtn>
        )}
      </div>
    </React.Fragment>
  );
};

const ULeftPanel = ({ view, area, tab, gp, overlays, onOverlay, brandFilter, onBrand, gapRules, onAddRule, onRemoveRule, onToggleRule, catchment, onCatchment, catchStats, sketch, onSketch, session, onRenameSketch, onSaveSketch, onExitSketch, saved, onOpenSaved, onPointCompare, compareArm, comparePair }) => {
  const Body = ({ children }) => <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>{children}</div>;

  /* --- when an area is selected, the panel follows the active tab --- */
  if (area && tab === "catchment") {
    const findMode = view === "find";
    const stats = catchStats || { selCount: 0, totalCount: 0 };
    return (
      <aside className="uw-left" data-screen-label="Left panel">
        <PanelHd kicker="SiteAnalyser" title="Catchment"
          sub={findMode ? "Census for every small area touching the built-up boundary." : "Define the trade area, then read the demographics on the right."} gp={gp}/>
        <Body>
          {findMode ? (
            <div style={{ padding: gp }}>
              <div style={{ padding: 12, borderRadius: 10, background: "var(--acc-soft)", border: "1px solid var(--acc-tint)", display: "flex", gap: 9, alignItems: "flex-start" }}>
                <AIco name="info" size={14} color="var(--acc-deep)"/>
                <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink2, lineHeight: 1.5 }}>
                  In Find Gaps the catchment is fixed to the <strong style={{ color: SS.ink }}>{area.name} built-up area</strong> — every LSOA its outline crosses. Toggle the overlay or click areas on the map to refine it.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: gp }}>
              <UKicker>Measure by</UKicker>
              <div style={{ marginTop: 8 }}>
                <SSSegmentedFull value={catchment.mode} onChange={(v) => onCatchment({ ...catchment, mode: v })}
                  options={[{ value: "distance", label: "Radius" }, { value: "drive", label: "Drive" }, { value: "walk", label: "Walk" }]}/>
              </div>
              <div style={{ marginTop: 16 }}>
                <UKicker>{catchment.mode === "distance" ? "Radius" : catchment.mode === "drive" ? "Drive time" : "Walk time"}</UKicker>
                <UPseudoSlider left="0%" right={`${100 - (catchment.value / 25) * 100}%`} a={`${(catchment.value / 25) * 100}%`}
                  labels={catchment.mode === "distance" ? ["0", `${catchment.value} mi`, "25 mi"] : ["0", `${catchment.value} min`, "45 min"]}/>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  {(catchment.mode === "distance" ? [1, 3, 5, 10, 20] : [5, 10, 15, 20, 30]).map(v => (
                    <button key={v} className="uw-click" onClick={() => onCatchment({ ...catchment, value: v })} style={{
                      flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                      border: `1px solid ${catchment.value === v ? SS.ink : SS.borderSoft}`, background: catchment.value === v ? SS.ink : SS.bg, color: catchment.value === v ? "#fff" : SS.ink2 }}>{v}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <USecHd>Catchment areas</USecHd>
          <div style={{ padding: `0 ${gp}px ${gp}px` }}>
            <div style={{ padding: 12, borderRadius: 10, background: SS.bg, border: `1px solid ${SS.borderSoft}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Inter", fontSize: 12.5, color: SS.ink2 }}>
                <span>{stats.selCount} LSOAs selected</span><span style={{ fontFamily: "'JetBrains Mono', monospace", color: SS.ink3 }}>of {stats.totalCount}</span>
              </div>
              <div style={{ position: "relative", height: 4, borderRadius: 999, background: SS.borderSoft, margin: "10px 0 8px", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, width: `${stats.totalCount ? (stats.selCount / stats.totalCount) * 100 : 0}%`, background: "var(--acc)", borderRadius: 999 }}/>
              </div>
              <div style={{ fontFamily: "Inter", fontSize: 11.5, color: SS.ink3, lineHeight: 1.5 }}>Click cells on the map to add or remove small areas — the figures on the right update live.</div>
            </div>
          </div>
        </Body>
      </aside>
    );
  }

  if (view === "sketch") {
    return <SketchPanel gp={gp} sketch={sketch} onSketch={onSketch} session={session} onRename={onRenameSketch} onSave={onSaveSketch} onExit={onExitSketch}/>;
  }

  if (area && tab === "requirements") {
    return <LeftRequirements gp={gp} includeNation={overlays.nationwide} onNation={() => onOverlay("nationwide")}/>;
  }

  /* --- discovery modes (no selection, or summary tab keeps Find filters) --- */
  if (view === "saved") {
    return (
      <aside className="uw-left" data-screen-label="Left panel">
        <PanelHd kicker="Workspace" title="Saved" sub="Opportunities and sketches you've parked to return to." gp={gp}/>
        <Body>
          <div style={{ padding: 8 }}>
            {saved.map(sv => (
              <div key={sv.id} className="uw-row uw-click" onClick={() => onOpenSaved(sv)} style={{ padding: 12, borderRadius: 10, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "Inter", fontSize: 13.5, fontWeight: 600, color: SS.ink }}>{sv.name}</div>
                    <div style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink2, marginTop: 2 }}>{sv.area}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3 }}>
                      <span>{sv.kind === "sketch" ? `${sv.schemes} scheme${sv.schemes === 1 ? "" : "s"}` : "Area shortlist"}</span><span>·</span><span>{sv.updated}</span>
                    </div>
                  </div>
                  <span style={{ width: 30, height: 30, borderRadius: 7, background: "var(--acc-soft)", color: "var(--acc-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Ico name={sv.kind === "sketch" ? "polygon" : "pin"} size={14}/>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Body>
      </aside>
    );
  }

  /* --- assess mode with a dropped point: radius + landscape, never Find Gaps --- */
  if (view === "assess" && area) {
    return (
      <aside className="uw-left" data-screen-label="Left panel">
        <PanelHd kicker="Assess Area" title="This point" sub="Set the radius around the dropped pin — the landscape on the right updates." gp={gp}/>
        <Body>
          <div style={{ padding: gp }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 10, background: "var(--acc-soft)", border: "1px solid var(--acc-tint)" }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: "var(--acc)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ico name="pin" size={15}/></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "Inter", fontSize: 13.5, fontWeight: 600, color: SS.ink }}>{area.name}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: SS.ink3, marginTop: 2 }}>{area.region}</div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <UKicker>Radius</UKicker>
              <UPseudoSlider left="0%" right={`${100 - (catchment.value / 25) * 100}%`} a={`${(catchment.value / 25) * 100}%`}
                labels={["0", `${catchment.value} mi`, "25 mi"]}/>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {[1, 3, 5, 10, 20].map(v => (
                  <button key={v} className="uw-click" onClick={() => onCatchment({ ...catchment, value: v })} style={{
                    flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                    border: `1px solid ${catchment.value === v ? SS.ink : SS.borderSoft}`, background: catchment.value === v ? SS.ink : SS.bg, color: catchment.value === v ? "#fff" : SS.ink2 }}>{v}</button>
                ))}
              </div>
            </div>
          </div>
          <USecHd>Compare</USecHd>
          <div style={{ padding: `0 ${gp}px ${gp}px` }}>
            {comparePair ? (
              <div style={{ padding: 12, borderRadius: 10, background: SS.bg, border: `1px solid ${SS.borderSoft}` }}>
                <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink2, lineHeight: 1.5 }}>Comparing this point with a second location. Use the tray below to view or clear it.</div>
              </div>
            ) : (
              <React.Fragment>
                <UGhostBtn icon="layers" full active={compareArm} onClick={onPointCompare}>
                  {compareArm ? "Drop pin B on the map…" : "Compare with another location"}
                </UGhostBtn>
                <div style={{ fontFamily: "Inter", fontSize: 11.5, color: SS.ink3, lineHeight: 1.5, marginTop: 8 }}>
                  {compareArm ? "Click anywhere on the map to drop the second pin." : "Drop a second pin to compare brands and catchment stats side by side."}
                </div>
              </React.Fragment>
            )}
          </div>
          <USecHd>Overlays</USecHd>
          <div style={{ padding: `0 ${gp}px` }}>
            <UToggleRow label="Requirement locations" sub="Where brands want to open here" on={overlays.requirements} onClick={() => onOverlay("requirements")}/>
            <div style={{ height: 1, background: SS.borderSoft }}/>
            <UToggleRow label="Traffic heatmap" sub="Count-point intensity" on={overlays.traffic} onClick={() => onOverlay("traffic")}/>
          </div>
          <div style={{ padding: gp }}>
            <div style={{ fontFamily: "Inter", fontSize: 11.5, color: SS.ink3, lineHeight: 1.5 }}>Drop a different pin anywhere on the map to assess another point.</div>
          </div>
        </Body>
      </aside>
    );
  }

  if (view === "assess" && !area) {
    return (
      <aside className="uw-left" data-screen-label="Left panel">
        <PanelHd kicker="Assess Area" title="Drop a point" sub="Click anywhere on the map to assess what's trading nearby and what's missing." gp={gp}/>
        <Body>
          <div style={{ padding: `${gp}px` }}>
            {[["1", "Drop a pin", "Click any point on the map"], ["2", "Set a radius", "1–25 km around the point"], ["3", "Read the landscape", "Brands present + brands missing"]].map(s => (
              <div key={s[0]} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: `1px solid ${SS.borderSoft}` }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0, background: "var(--acc-soft)", border: "1.5px solid var(--acc-tint)", color: "var(--acc-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600 }}>{s[0]}</span>
                <div><div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 600, color: SS.ink }}>{s[1]}</div><div style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink3, marginTop: 1 }}>{s[2]}</div></div>
              </div>
            ))}
            <div style={{ marginTop: 14 }}><UGhostBtn icon="pin" full onClick={() => onOpenSaved({ id: "manchester" })}>Or pick Manchester to preview</UGhostBtn></div>
          </div>
        </Body>
      </aside>
    );
  }

  if (view === "requirements" && !area) {
    return <LeftRequirements gp={gp} includeNation={overlays.nationwide} onNation={() => onOverlay("nationwide")} standalone/>;
  }

  /* default: Find Gaps filters */
  return (
    <aside className="uw-left" data-screen-label="Left panel">
      <PanelHd kicker="Find Gaps" title="Filters" sub="Surface towns by presence, proximity and demographics — then read the gaps." gp={gp}/>
      <Body>
        <USecHd>Overlays</USecHd>
        <div style={{ padding: `0 ${gp}px` }}>
          <UToggleRow label="Requirement locations" sub="Where brands want to open" on={overlays.requirements} onClick={() => onOverlay("requirements")}/>
          <div style={{ height: 1, background: SS.borderSoft }}/>
          <UToggleRow label="Traffic heatmap" sub="Count-point intensity" on={overlays.traffic} onClick={() => onOverlay("traffic")}/>
        </div>
        <UGapFilters gp={gp} rules={gapRules} onAdd={onAddRule} onRemove={onRemoveRule} onToggle={onToggleRule}/>
        <USecHd>Population</USecHd>
        <div style={{ padding: `0 ${gp}px ${gp}px` }}>
          <UPseudoSlider left="0%" right="20%" a="0%" b="80%" labels={["0", "100k+", "1.2m"]}/>
        </div>
      </Body>
    </aside>
  );
};

const LeftRequirements = ({ gp, includeNation, onNation, standalone }) => (
  <aside className="uw-left" data-screen-label="Left panel">
    <PanelHd kicker="Browse Requirements" title="Demand filters" sub={standalone ? "Live, verified requirements — where brands have said they want to open." : "Filter the demand shown for this area."} gp={gp}/>
    <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
      <div style={{ padding: gp }}>
        <UToggleRow label="Include nationwide brands" sub="Brands open to all UK locations" on={includeNation} onClick={onNation}/>
      </div>
      <USecHd>Sector</USecHd>
      <div style={{ padding: `0 ${gp}px ${gp}px` }}>
        {[["Food & Beverage", 847], ["Retail", 1240], ["Health & Beauty", 164], ["Leisure", 218]].map((s, i) => (
          <UCheck key={s[0]} on={i < 2} label={s[0]} count={s[1]} onClick={() => {}}/>
        ))}
      </div>
      <USecHd>Use class</USecHd>
      <div style={{ padding: `0 ${gp}px ${gp}px`, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {["E (Commercial)", "Sui Generis", "F (Community)", "C1 Hotel"].map((p, i) => (
          <span key={p} style={{ padding: "6px 11px", borderRadius: 999, fontFamily: "Inter", fontSize: 12.5, cursor: "pointer",
            border: `1px solid ${i === 0 ? SS.ink : SS.border}`, background: i === 0 ? SS.ink : SS.surface, color: i === 0 ? "#fff" : SS.ink }}>{p}</span>
        ))}
      </div>
      <USecHd>Size wanted</USecHd>
      <div style={{ padding: `0 ${gp}px ${gp}px` }}>
        <UPseudoSlider left="12%" right="30%" a="12%" b="70%" labels={["500", "sq ft", "10k"]}/>
      </div>
    </div>
  </aside>
);

Object.assign(window, { UChrome, URail, ULeftPanel, UPrimaryBtn, UGhostBtn, UToggle, UToggleRow, UCheck, USecHd, PanelHd });
