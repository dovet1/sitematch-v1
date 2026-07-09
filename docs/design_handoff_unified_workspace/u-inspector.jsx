/* GapFinder — Unified Workspace · right inspector + compare
   The selected opportunity, with the four tools as tabs:
   Summary (GapFinder) · Catchment (SiteAnalyser) · Requirements (Browse) · Sketch (SiteSketcher). */

/* ---- Results list: Find Gaps ------------------------------------------ */
const UResultsFind = ({ gp, onPick, brandFilter, overlays, gapRules = [] }) => {
  const TOTAL = 1586;
  // deterministic pseudo-narrowing so the headline reacts to the active rules
  const shown = gapRules.reduce((n, r) => {
    const positive = r.op === "has" || r.op === "within";
    const base = r.kind === "proximity" ? (positive ? 0.58 : 0.5) : (positive ? 0.64 : 0.46);
    const byType = r.type === "fascia" ? 0.82 : r.type === "brand" ? 0.9 : 1;
    return Math.max(1, Math.round(n * base * byType));
  }, TOTAL);
  const pct = Math.max(4, Math.round((shown / TOTAL) * 100));
  return (
  <aside className="uw-insp" data-screen-label="Results">
    <div style={{ padding: `${gp}px ${gp}px ${gp - 6}px`, borderBottom: `1px solid ${SS.borderSoft}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <UKicker color="var(--acc-deep)">Find Gaps · live</UKicker>
          <div style={{ fontFamily: "Inter", fontSize: 20, fontWeight: 600, color: SS.ink, letterSpacing: -0.3, marginTop: 5 }}>Gap opportunities</div>
        </div>
        <button className="uw-iconbtn uw-click" title="Export CSV"><Ico name="download" size={14}/></button>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
        <span style={{ fontFamily: "Inter", fontSize: 24, fontWeight: 600, letterSpacing: -0.5 }}>{shown.toLocaleString()}</span>
        <UKicker>of {TOTAL.toLocaleString()}</UKicker>
        <span style={{ flex: 1, height: 3, borderRadius: 999, background: SS.borderSoft, overflow: "hidden" }}><span style={{ display: "block", width: `${pct}%`, height: "100%", background: "var(--acc)" }}/></span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
        <UKicker>{gapRules.length ? `${gapRules.length} filter${gapRules.length > 1 ? "s" : ""} · gap strength` : "Sorted · gap strength"}</UKicker>
        <span className="uw-click" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: SS.ink2, cursor: "pointer" }}>Change ↓</span>
      </div>
    </div>
    <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
      {U_BUAS.map(b => (
        <div key={b.id} className="uw-row uw-click" onClick={() => onPick(b)} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", padding: `13px ${gp}px`, borderBottom: `1px solid ${SS.borderSoft}`, cursor: "pointer" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--acc)", display: "inline-flex" }}><Ico name="pin" size={16}/></span>
              <span style={{ fontFamily: "Inter", fontSize: 15, fontWeight: 500, color: SS.ink }}>{b.name}</span>
              <UGapPill level={b.gap}/>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: SS.ink3, marginTop: 4, marginLeft: 24 }}>
              {b.region} · Pop {b.pop.toLocaleString()} · {b.missing} missing{overlays.requirements ? ` · ${b.reqLocal} req` : ""}
            </div>
          </div>
          <Ico name="chevright" size={14} color={SS.ink4}/>
        </div>
      ))}
    </div>
  </aside>
  );
};

/* ---- Results list: Requirements (standalone browse) ------------------- */
const UResultsReqs = ({ gp, includeNation, onSelectReq }) => {
  const list = U_REQS.filter(r => includeNation || r.scope === "local");
  return (
    <aside className="uw-insp" data-screen-label="Results">
      <div style={{ padding: `${gp}px ${gp}px ${gp - 6}px`, borderBottom: `1px solid ${SS.borderSoft}` }}>
        <UKicker color="var(--acc-deep)">Browse Requirements · live</UKicker>
        <div style={{ fontFamily: "Inter", fontSize: 20, fontWeight: 600, color: SS.ink, letterSpacing: -0.3, marginTop: 5 }}>Live demand</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
          <span style={{ fontFamily: "Inter", fontSize: 24, fontWeight: 600, letterSpacing: -0.5 }}>3,417</span>
          <UKicker>verified requirements</UKicker>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", minHeight: 0, padding: `${gp - 4}px` }}>
        {list.map(r => <ReqCard key={r.id} r={r} onClick={() => onSelectReq(r)}/>)}
      </div>
    </aside>
  );
};

const ReqCard = ({ r, onClick, compact }) => (
  <div className="uw-row uw-click" onClick={onClick} style={{ padding: 14, border: `1px solid ${SS.border}`, borderRadius: 12, background: SS.surface, marginBottom: 8, cursor: "pointer" }}>
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <UBrandLogo brand={r} size={38} radius={9}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontFamily: "Inter", fontSize: 14.5, fontWeight: 600, color: SS.ink, letterSpacing: -0.2 }}>{r.brand}</span>
          {r.scope === "nationwide" && <span className="uw-nationtag">Nationwide</span>}
        </div>
        <UKicker color="var(--acc-deep)" style={{ marginTop: 2, display: "block" }}>{r.sector}</UKicker>
      </div>
      <Ico name="chevright" size={14} color={SS.ink4}/>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${SS.borderSoft}` }}>
      <KV k="Size" v={r.size}/>
      <KV k="Use class" v={r.useClass}/>
    </div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
      <UVerified when={r.verified}/>
      {r.brochure && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, letterSpacing: 0.4, textTransform: "uppercase" }}><Ico name="doc" size={11}/> Brochure</span>}
    </div>
  </div>
);

const KV = ({ k, v }) => (
  <div><span style={{ display: "block", fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase", color: SS.ink3, marginBottom: 3 }}>{k}</span><span style={{ fontFamily: "Inter", fontSize: 13, color: SS.ink, fontWeight: 500 }}>{v}</span></div>
);

/* ---- Opportunity inspector (area selected) ---------------------------- */
const OPP_TABS = [
  { id: "summary", label: "Summary" },
  { id: "catchment", label: "Catchment" },
  { id: "requirements", label: "Requirements" },
];

const UOpportunity = ({ area, tab, gp, onTab, onClose, onCompare, inCompare, includeNation, onSelectReq, sketch, view, catchment, catchStats, lsoaOverlay, onToggleLsoaOverlay }) => (
  <aside className="uw-insp" data-screen-label="Opportunity inspector">
    {/* header */}
    <div style={{ padding: `${gp}px ${gp}px ${gp - 8}px`, borderBottom: `1px solid ${SS.borderSoft}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <UKicker color="var(--acc-deep)">Opportunity · {area.region}</UKicker>
          <div style={{ fontFamily: "Inter", fontSize: 24, fontWeight: 600, color: SS.ink, letterSpacing: -0.5, marginTop: 5 }}>{area.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink3 }}>Pop {area.pop.toLocaleString()}</span>
          </div>
        </div>
        <button className="uw-iconbtn uw-click" onClick={onClose} title="Close"><Ico name="close" size={13}/></button>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <UGhostBtn icon="layers" active={inCompare} onClick={() => onCompare(area)} full>{inCompare ? "Added to compare" : "Compare"}</UGhostBtn>
      </div>
    </div>
    {/* tab bar */}
    <div className="uw-tabs">
      {OPP_TABS.map(t => (
        <button key={t.id} className={`uw-tab uw-click${tab === t.id ? " on" : ""}`} onClick={() => onTab(t.id)}>{t.label}</button>
      ))}
    </div>
    {/* body */}
    <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
      {tab === "summary" && <TabSummary area={area} gp={gp} onSelectReq={onSelectReq}/>}
      {tab === "catchment" && <TabCatchment area={area} gp={gp} view={view} catchment={catchment} catchStats={catchStats} lsoaOverlay={lsoaOverlay} onToggleLsoaOverlay={onToggleLsoaOverlay}/>}
      {tab === "requirements" && <TabRequirements area={area} gp={gp} includeNation={includeNation} onSelectReq={onSelectReq}/>}
    </div>
  </aside>
);

/* ---- Brand-result filter: multi-select popover (category / brand) ----- */
const UFilterMenu = ({ label, options, counts, selected, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const toggle = (v) => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  const active = selected.length > 0;
  return (
    <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <button className="uw-click" onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "8px 11px", cursor: "pointer",
          borderRadius: 9, border: `1px solid ${open ? "var(--acc)" : active ? "var(--acc)" : SS.border}`,
          background: active ? "var(--acc-soft)" : SS.surface, boxShadow: open ? "0 0 0 3px var(--acc-soft)" : "none",
          fontFamily: "Inter", fontSize: 12.5, fontWeight: 500, color: active ? "var(--acc-deep)" : SS.ink, transition: "box-shadow .12s, border-color .12s" }}>
        <span style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
        {active && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, lineHeight: 1, padding: "3px 5px", borderRadius: 5, background: "var(--acc)", color: "#fff" }}>{selected.length}</span>
        )}
        <span style={{ display: "inline-flex", transform: open ? "rotate(180deg)" : "none", transition: "transform .14s", color: SS.ink3 }}><AIco name="chevdown" size={12}/></span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 40, maxHeight: 260, overflowY: "auto",
          background: SS.surface, border: `1px solid ${SS.border}`, borderRadius: 12, padding: 5,
          boxShadow: "0 20px 48px -16px rgba(20,10,40,.36)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px 6px", borderBottom: `1px solid ${SS.border}`, marginBottom: 4 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: 0.8, textTransform: "uppercase", color: SS.ink3 }}>{label}</span>
            {active && (
              <button className="uw-click" onClick={() => onChange([])}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontFamily: "Inter", fontSize: 11.5, color: "var(--acc-deep)", fontWeight: 500, padding: 0 }}>Reset</button>
            )}
          </div>
          {options.map(o => {
            const on = selected.includes(o);
            const c = counts ? counts[o] : null;
            return (
              <button key={o} className="uw-click uw-filteropt" onClick={() => toggle(o)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 8px", cursor: "pointer",
                  border: "none", background: on ? "var(--acc-soft)" : "transparent", borderRadius: 8, textAlign: "left" }}>
                <span style={{ width: 16, height: 16, borderRadius: 5, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                  border: `1.5px solid ${on ? "var(--acc)" : SS.border}`, background: on ? "var(--acc)" : "transparent", color: "#fff" }}>
                  {on && <Ico name="check" size={10}/>}
                </span>
                <span style={{ flex: 1, fontFamily: "Inter", fontSize: 13, color: SS.ink, fontWeight: on ? 600 : 500 }}>{o}</span>
                {c != null && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink3 }}>{c}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* A removable active-filter pill. */
const UFilterChip = ({ label, onRemove }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 5px 3px 9px", borderRadius: 999,
    background: "var(--acc-soft)", border: "1px solid var(--acc)", fontFamily: "Inter", fontSize: 11.5, fontWeight: 500, color: "var(--acc-deep)" }}>
    {label}
    <button className="uw-click" onClick={onRemove} title={`Remove ${label}`}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 15, height: 15, borderRadius: 999,
        border: "none", background: "transparent", cursor: "pointer", color: "var(--acc-deep)" }}>
      <Ico name="close" size={9}/>
    </button>
  </span>
);

/* ---- Tab: Summary ----------------------------------------------------- */
const U_FIT_COLOR = { Strong: "var(--acc)", Good: "#3B7A57", Moderate: "#B0872F" };

const TabSummary = ({ area, gp, onSelectReq }) => {
  const [detail, setDetail] = React.useState(null); // { kind: "missing"|"trading", data }
  const [catSel, setCatSel] = React.useState([]);   // category (sector) filter
  const [brandSel, setBrandSel] = React.useState([]); // brand-name filter
  // Occupiers who have named THIS location as a target — shown as promoted listings.
  const localReqs = U_REQS.filter(r => r.scope === "local");
  const storeSector = (s) => { const b = U_BRAND_BY_NAME[s.brand]; return b ? b.sector : ""; };

  // Filter option universes drawn from everything returned for this point.
  const catOptions = React.useMemo(() => [...new Set([
    ...localReqs.map(r => r.sector), ...U_MISSING.map(m => m.sector), ...U_STORES.map(storeSector),
  ].filter(Boolean))].sort(), []);
  const brandOptions = React.useMemo(() => [...new Set([
    ...localReqs.map(r => r.brand), ...U_MISSING.map(m => m.name), ...U_STORES.map(s => s.brand),
  ].filter(Boolean))].sort(), []);

  const catOk = (sector) => catSel.length === 0 || catSel.includes(sector);
  const brandOk = (name) => brandSel.length === 0 || brandSel.includes(name);
  const fReqs = localReqs.filter(r => catOk(r.sector) && brandOk(r.brand));
  const fMissing = U_MISSING.filter(m => catOk(m.sector) && brandOk(m.name));
  const fStores = U_STORES.filter(s => catOk(storeSector(s)) && brandOk(s.brand));
  const filterActive = catSel.length > 0 || brandSel.length > 0;
  const gapCount = fReqs.length + fMissing.length;

  // Per-option result counts, shown in the dropdowns.
  const tally = (arr) => arr.reduce((m, k) => (k ? (m[k] = (m[k] || 0) + 1, m) : m), {});
  const catCounts = React.useMemo(() => tally([
    ...localReqs.map(r => r.sector), ...U_MISSING.map(m => m.sector), ...U_STORES.map(storeSector),
  ]), []);
  const brandCounts = React.useMemo(() => tally([
    ...localReqs.map(r => r.brand), ...U_MISSING.map(m => m.name), ...U_STORES.map(s => s.brand),
  ]), []);

  return (
    <div>
      <div style={{ padding: gp, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatCard label="Population" value={area.pop.toLocaleString()} icon="users" tint="var(--acc-soft)" sub={`${area.households.toLocaleString()} households`}/>
        <StatCard label="Affluence" value={area.affluence} icon="wallet"><AffluenceGauge score={area.affluence} uk={50}/></StatCard>
      </div>

      {/* Filter the returned brands by category and by brand */}
      <div style={{ padding: `0 ${gp}px` }}>
        <div style={{ padding: 10, borderRadius: 12, border: `1px solid ${SS.border}`, background: SS.bg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: 0.8, textTransform: "uppercase", color: SS.ink3, flexShrink: 0 }}>
              <AIco name="filter" size={12}/>Filter
            </span>
            <UFilterMenu label="Category" options={catOptions} counts={catCounts} selected={catSel} onChange={setCatSel}/>
            <UFilterMenu label="Brand" options={brandOptions} counts={brandCounts} selected={brandSel} onChange={setBrandSel}/>
          </div>
          {filterActive && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 10 }}>
              {catSel.map(v => <UFilterChip key={"c" + v} label={v} onRemove={() => setCatSel(catSel.filter(x => x !== v))}/>)}
              {brandSel.map(v => <UFilterChip key={"b" + v} label={v} onRemove={() => setBrandSel(brandSel.filter(x => x !== v))}/>)}
              <button className="uw-click" onClick={() => { setCatSel([]); setBrandSel([]); }}
                style={{ marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer", fontFamily: "Inter", fontSize: 12, color: SS.ink3, fontWeight: 500, padding: 0, whiteSpace: "nowrap" }}>
                Clear all
              </button>
            </div>
          )}
        </div>
        {filterActive && (
          <div style={{ marginTop: 9, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: SS.ink3 }}>
            {gapCount} missing · {fStores.length} trading match
          </div>
        )}
      </div>

      {/* PRIMARY — the gap: brands missing here, with occupiers who have named
          this location promoted to the top of the same list (Google-style). */}
      <div style={{ padding: `0 ${gp}px`, marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "Inter", fontSize: 17, fontWeight: 600, color: SS.ink, letterSpacing: -0.3 }}>The gap · brands missing here</div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: SS.ink2 }}>{gapCount}</span>
        </div>
        <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink3, lineHeight: 1.5, marginTop: 4 }}>
          {fReqs.length > 0
            ? <React.Fragment>Occupiers with a live requirement naming {area.name} show first, then established brands with no presence here. Tap any for the case.</React.Fragment>
            : <React.Fragment>Established brands with no presence in {area.name} that fit its demographics and footfall. Tap any brand for the case.</React.Fragment>}
        </div>
      </div>
      <div style={{ padding: `10px ${gp}px ${gp}px`, display: "flex", flexDirection: "column", gap: 8 }}>
        {gapCount === 0 && (
          <div style={{ padding: 14, borderRadius: 11, border: `1px dashed ${SS.border}`, background: SS.bg, textAlign: "center", fontFamily: "Inter", fontSize: 12.5, color: SS.ink3 }}>
            No missing brands match these filters.
          </div>
        )}
        {/* Promoted — occupiers targeting this location specifically */}
        {fReqs.map(r => (
          <button key={r.id} className="uw-spon-row uw-click" onClick={() => onSelectReq && onSelectReq(r)}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
              <span className="uw-sponsortag">Requirement</span>
              <UKicker color="var(--acc-deep)">Wants to open here</UKicker>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center" }}>
              <UBrandLogo brand={r} size={36} radius={9}/>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 600, color: SS.ink }}>{r.brand}</div>
                <UKicker style={{ marginTop: 2, display: "block" }}>{r.sector} · {r.size}</UKicker>
              </div>
              <span style={{ color: "var(--acc-deep)", display: "inline-flex" }}><AIco name="chevright" size={15}/></span>
            </div>
            {(r.nearest || r.lastOpened) && (
              <div style={{ marginTop: 9, paddingTop: 9, borderTop: `1px solid ${SS.borderSoft}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {r.nearest && (
                  <div style={{ minWidth: 0 }}>
                    <UKicker style={{ display: "block" }}>Nearest store</UKicker>
                    <div style={{ fontFamily: "Inter", fontSize: 12.5, fontWeight: 500, color: SS.ink2, marginTop: 2 }}>{r.nearest}</div>
                  </div>
                )}
                {r.lastOpened && (
                  <div style={{ minWidth: 0 }}>
                    <UKicker style={{ display: "block" }}>Latest opening</UKicker>
                    <div style={{ fontFamily: "Inter", fontSize: 12.5, fontWeight: 500, color: SS.ink2, marginTop: 2 }}>{r.lastOpened}</div>
                  </div>
                )}
              </div>
            )}
          </button>
        ))}
        {/* Organic — established brands absent from this area */}
        {fMissing.map(m => (
          <button key={m.name} className="uw-click" onClick={() => setDetail({ kind: "missing", data: m })}
            style={{ textAlign: "left", cursor: "pointer", display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center",
              padding: "11px 12px", borderRadius: 11, background: SS.surface, border: `1px solid ${SS.border}` }}>
            <UBrandLogo brand={m} size={36} radius={9}/>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 600, color: SS.ink }}>{m.name}</div>
              <UKicker style={{ marginTop: 2, display: "block" }}>{m.sector} · {m.ukStores.toLocaleString()} UK stores</UKicker>
            </div>
            <span style={{ color: SS.ink3, display: "inline-flex" }}><AIco name="chevright" size={15}/></span>
          </button>
        ))}
      </div>

      {/* SECONDARY — who already trades here */}
      <USecHd>Already trading here · {filterActive ? fStores.length : area.stores}</USecHd>
      <div>
        {fStores.length === 0 && (
          <div style={{ padding: `12px ${gp}px`, fontFamily: "Inter", fontSize: 12.5, color: SS.ink3 }}>No trading brands match these filters.</div>
        )}
        {fStores.slice(0, 6).map(s => {
          const b = U_BRAND_BY_NAME[s.brand];
          return (
            <button key={s.id} className="uw-row uw-click" onClick={() => setDetail({ kind: "trading", data: s })}
              style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "transparent", border: "none",
                display: "grid", gridTemplateColumns: "28px 1fr auto 16px", gap: 11, alignItems: "center", padding: `10px ${gp}px`, borderBottom: `1px solid ${SS.borderSoft}` }}>
              <UBrandLogo brand={s.brand} size={28} radius={7}/>
              <div style={{ minWidth: 0 }}><div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 500, color: SS.ink2 }}>{s.brand}</div><UKicker style={{ marginTop: 1, display: "block" }}>{b ? b.sector : ""}</UKicker></div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink3 }}>{s.dist}</span>
              <span style={{ color: SS.ink3, display: "inline-flex" }}><AIco name="chevright" size={14}/></span>
            </button>
          );
        })}
      </div>

      {detail && <UBrandModal detail={detail} area={area} onClose={() => setDetail(null)}/>}
    </div>
  );
};

/* Centered brand detail — works for a missing brand or a trading store */
const UBrandModal = ({ detail, area, onClose }) => {
  const { kind, data } = detail;
  const b = U_BRAND_BY_NAME[data.brand] || (kind === "missing" ? data : { color: SS.ink, sector: data.sector || "" });
  const missing = kind === "missing";
  // A brand can hold a live requirement that names no specific location ("nationwide").
  // Those don't appear in the promoted list on the map — they surface here, in the brand's card.
  const natReq = missing
    ? U_REQS.find(r => r.scope === "nationwide" && (r.brand === data.name || r.brand.startsWith(data.name) || data.name.startsWith(r.brand)))
    : null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(23,20,25,.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(420px,100%)", maxHeight: "100%", overflow: "auto", background: SS.surface, borderRadius: 16, padding: 22, boxShadow: "0 30px 80px -20px rgba(20,10,40,.4)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 13, alignItems: "center", paddingRight: 4 }}>
          <UBrandLogo brand={missing ? data : data.brand} size={44} radius={10}/>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontFamily: "Inter", fontSize: 17, fontWeight: 600, color: SS.ink, letterSpacing: -0.2 }}>{missing ? data.name : data.brand}</div>
              {missing
                ? null
                : <span style={{ padding: "3px 8px", borderRadius: 999, fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: 0.6, textTransform: "uppercase", color: SS.ink3, background: SS.bg }}>Trading</span>}
            </div>
            <UKicker color={SS.violetDeep} style={{ marginTop: 3, display: "block" }}>{missing ? data.sector : (b.sector || "")}</UKicker>
          </div>
          <button className="uw-iconbtn uw-click" onClick={onClose} title="Close"><Ico name="close" size={14}/></button>
        </div>

        {missing ? (
          <React.Fragment>
            <div style={{ fontFamily: "Inter", fontSize: 13, color: SS.ink2, lineHeight: 1.55 }}>{data.note}</div>
            <div className="um-pop-grid">
              <div><span className="k">UK stores</span>{data.ukStores.toLocaleString()}</div>
              <div><span className="k">Nearest unit</span>{data.nearest}</div>
              <div><span className="k">Latest UK opening</span>{data.lastOpened}</div>
              <div><span className="k">In {area.name}</span>None</div>
            </div>
            {natReq && (
              <div style={{ border: "1px solid var(--acc-tint)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 13px", background: "var(--acc-soft)", borderBottom: "1px solid var(--acc-tint)" }}>
                  <AIco name="pin" size={13} color="var(--acc-deep)"/>
                  <span style={{ flex: 1, fontFamily: "Inter", fontSize: 12.5, fontWeight: 600, color: SS.ink }}>Live requirement</span>
                  <span className="uw-nationtag">Nationwide</span>
                </div>
                <div style={{ padding: 13, display: "flex", flexDirection: "column", gap: 11 }}>
                  <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink2, lineHeight: 1.55 }}>{natReq.summary}</div>
                  <div className="um-pop-grid">
                    <div><span className="k">Size wanted</span>{natReq.size}</div>
                    <div><span className="k">Use class</span>{natReq.useClass}</div>
                    <div><span className="k">Listing</span>{natReq.listing}</div>
                    <div><span className="k">Verified</span>{natReq.verified}</div>
                  </div>
                  <div>
                    <UKicker>Wants to be in</UKicker>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
                      {natReq.locations.map((l, i) => <span key={i} className="um-loctag">{l}</span>)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 10, background: SS.bg, border: `1px solid ${SS.borderSoft}` }}>
                    <span style={{ width: 34, height: 34, borderRadius: 999, background: "var(--acc)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter", fontWeight: 600, flexShrink: 0 }}>{natReq.contact.name[0]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 600, color: SS.ink }}>{natReq.contact.name}</div>
                      <div style={{ fontFamily: "Inter", fontSize: 11.5, color: SS.ink3 }}>{natReq.contact.role} · {natReq.contact.org}</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink2, marginTop: 3 }}>{natReq.contact.email} · {natReq.contact.phone}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </React.Fragment>
        ) : (
          <React.Fragment>
            <div className="um-pop-grid">
              <div><span className="k">Format</span>{data.occupier.format}</div>
              <div><span className="k">UK units</span>{data.occupier.units}</div>
              <div><span className="k">This site</span>Opened {data.occupier.openedYear}</div>
              <div><span className="k">Distance</span>{data.dist} from pin</div>
            </div>
            <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink2 }}>{data.addr}</div>
            <div>
              <UKicker>Expansion / acquiring team</UKicker>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {data.agents.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, background: SS.bg, border: `1px solid ${SS.borderSoft}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 600, color: SS.ink }}>{a.name}</div>
                      <div style={{ fontFamily: "Inter", fontSize: 11.5, color: SS.ink3 }}>{a.role}{a.org ? ` · ${a.org}` : ""}</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink2, marginTop: 3 }}>{a.email} · {a.phone}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
};

/* ---- Tab: Catchment (demographics) ------------------------------------ */
/* Scale census counts by the share of LSOAs currently selected. */
const uScaleCount = (str, f) => {
  const n = parseFloat(String(str).replace(/,/g, ""));
  if (isNaN(n)) return str;
  return Math.round(n * f).toLocaleString();
};
const uScaleCensus = (f) => CENSUS.map(s => ({
  ...s,
  rows: s.rows.map(r => ((r.pct != null) || r.plain === "—") ? { ...r, count: uScaleCount(r.count, f) } : r),
}));

const TabCatchment = ({ area, gp, view, catchment, catchStats, lsoaOverlay, onToggleLsoaOverlay }) => {
  const stats = catchStats || { factor: 1, selCount: 0, totalCount: 0 };
  const f = stats.factor || 1;
  const census = React.useMemo(() => uScaleCensus(f), [f]);
  const c = catchment || { mode: "distance", value: 5 };
  const catchLabel = view === "find" ? "Built-up area"
    : c.mode === "distance" ? `${c.value} mi radius`
    : c.mode === "drive" ? `${c.value} min drive` : `${c.value} min walk`;
  return (
    <div>
      <div style={{ padding: `${gp}px ${gp}px 0` }}>
        <div style={{ padding: "4px 14px", borderRadius: 10, background: SS.bg, border: `1px solid ${SS.borderSoft}` }}>
          <UToggleRow label="Show LSOA overlay" sub="Highlight catchment areas on the map" on={lsoaOverlay} onClick={onToggleLsoaOverlay}/>
        </div>
        <div style={{ marginTop: 10, fontFamily: "Inter", fontSize: 11.5, color: SS.ink3, lineHeight: 1.5 }}>
          Click areas on the map to add or remove them — every figure below recomputes live.
        </div>
      </div>
      <div style={{ padding: gp, borderBottom: `1px solid ${SS.borderSoft}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink3, flexWrap: "wrap" }}>
          <span style={{ color: SS.ink2 }}>{area.name}</span><span>·</span><span>{catchLabel}</span><span>·</span><span>{stats.selCount} of {stats.totalCount} areas</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatCard label="Population" value={Math.round(area.pop * f).toLocaleString()} icon="users" tint="var(--acc-soft)" sub={`${Math.round(area.households * f).toLocaleString()} households`}/>
          <StatCard label="Affluence" value={area.affluence} icon="wallet"><AffluenceGauge score={area.affluence} uk={50}/></StatCard>
        </div>
      </div>
      {census.map(s => <CensusSection key={s.id} section={s} tier="pro"/>)}
      <div style={{ padding: gp, display: "flex", flexDirection: "column", gap: 8 }}>
        <UPrimaryBtn icon="download" full>Export demographics report</UPrimaryBtn>
      </div>
    </div>
  );
};

/* ---- Tab: Requirements (who wants to be here) ------------------------- */
const TabRequirements = ({ area, gp, includeNation, onSelectReq }) => {
  const locals = U_REQS.filter(r => r.scope === "local");
  const nation = U_REQS.filter(r => r.scope === "nationwide");
  return (
    <div>
      <div style={{ padding: gp }}>
        <div style={{ padding: 12, borderRadius: 10, background: "var(--acc-soft)", border: "1px solid var(--acc-tint)", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AIco name="info" size={14} color="var(--acc-deep)"/>
          <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink2, lineHeight: 1.5 }}>
            <strong style={{ color: SS.ink }}>{locals.length + (includeNation ? nation.length : 0)} brands</strong> may want to be in {area.name} — {locals.length} naming it, {nation.length} open to all locations.
          </div>
        </div>
      </div>
      <USecHd>Targeting {area.name} · {locals.length}</USecHd>
      <div style={{ padding: `0 ${gp}px` }}>{locals.map(r => <ReqCard key={r.id} r={r} onClick={() => onSelectReq(r)}/>)}</div>
      {includeNation && (
        <React.Fragment>
          <USecHd>Open to all locations · {nation.length}</USecHd>
          <div style={{ padding: `0 ${gp}px ${gp}px` }}>{nation.map(r => <ReqCard key={r.id} r={r} onClick={() => onSelectReq(r)}/>)}</div>
        </React.Fragment>
      )}
      {!includeNation && (
        <div style={{ padding: `0 ${gp}px ${gp}px` }}>
          <div style={{ padding: 14, borderRadius: 12, border: `1px dashed ${SS.border}`, background: SS.bg, textAlign: "center" }}>
            <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 600, color: SS.ink }}>{nation.length} nationwide brands hidden</div>
            <div style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink3, margintop: 4, lineHeight: 1.5, marginTop: 4 }}>Brands open to all UK locations could also take space here.</div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---- Tab: Sketch (inspector side) ------------------------------------- */
const TabSketch = ({ area, gp, sketch, onSave }) => (
  <div>
    <div style={{ padding: gp, borderBottom: `1px solid ${SS.borderSoft}` }}>
      <UKicker>Active scheme</UKicker>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <span style={{ width: 30, height: 30, borderRadius: 7, background: POLY[0].fill, border: `2px solid ${POLY[0].stroke}`, flexShrink: 0 }}/>
        <div><div style={{ fontFamily: "Inter", fontSize: 15, fontWeight: 600, color: SS.ink }}>Scheme {sketch.scheme}</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink3 }}>{area ? `${area.name} · NQ corner parcel` : "Untitled site · 4-point parcel"}</div></div>
      </div>
    </div>
    <div style={{ padding: gp, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <Metric label="Plot area" value="2,480" unit="m²" accent={POLY[0].stroke}/>
      <Metric label="Footprint" value="58" unit="% cover"/>
      <Metric label="Parking" value="24" unit="spaces"/>
      <Metric label="Frontage" value="30" unit="m"/>
    </div>
    <USecHd>Measurements</USecHd>
    <div style={{ padding: `0 ${gp}px ${gp}px` }}>
      <div style={{ padding: "10px 12px", borderRadius: 9, background: SS.bg, border: `1px solid ${SS.borderSoft}` }}>
        {[["Width × depth", "62 × 40 m"], ["Perimeter", "204 m"], ["GIA estimate", "1,438 m²"]].map(r => (
          <div key={r[0]} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontFamily: "Inter", fontSize: 12.5, color: SS.ink2 }}>
            <span>{r[0]}</span><span style={{ fontFamily: "'JetBrains Mono', monospace", color: SS.ink }}>{r[1]}</span>
          </div>
        ))}
      </div>
    </div>
    <div style={{ padding: gp, display: "flex", flexDirection: "column", gap: 8 }}>
      <UPrimaryBtn icon="save" full onClick={onSave}>Save scheme {sketch.scheme}</UPrimaryBtn>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <UGhostBtn icon="folder" full>Duplicate</UGhostBtn>
        <UGhostBtn icon="download" full>Export</UGhostBtn>
      </div>
    </div>
  </div>
);

/* ---- Compare tray + panel --------------------------------------------- */
const UCompareTray = ({ items, onOpen, onClear, onRemove }) => {
  if (items.length === 0) return null;
  return (
    <div className="uw-tray">
      <UKicker>Compare</UKicker>
      <div style={{ display: "flex", gap: 8 }}>
        {items.map(a => (
          <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 8px 6px 12px", borderRadius: 999, background: SS.bg, border: `1px solid ${SS.border}`, fontFamily: "Inter", fontSize: 13, fontWeight: 500, color: SS.ink }}>
            {a.name}
            <button className="uw-click" onClick={() => onRemove(a)} style={{ border: "none", background: "transparent", cursor: "pointer", color: SS.ink4, padding: 2, display: "inline-flex" }}><Ico name="close" size={11}/></button>
          </span>
        ))}
      </div>
      <div style={{ flex: 1 }}/>
      <span className="uw-click" onClick={onClear} style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink3, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>Clear</span>
      <UPrimaryBtn icon="layers" onClick={onOpen}>Compare {items.length} area{items.length === 1 ? "" : "s"}</UPrimaryBtn>
    </div>
  );
};

const UComparePanel = ({ items, onClose }) => {
  const rows = [
    ["Region", a => a.region],
    ["Population", a => a.pop.toLocaleString()],
    ["Households", a => a.households.toLocaleString()],
    ["Affluence (0–100)", a => a.affluence],
    ["Gap strength", a => `${a.gap}`],
    ["Brands trading", a => a.stores],
    ["Brands missing", a => a.missing],
    ["Live requirements", a => `${a.reqLocal} local · ${a.reqNation} nationwide`],
    ["Traffic index", a => a.traffic],
  ];
  return (
    <div className="uw-overlay" onClick={onClose}>
      <div className="uw-compare" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: `1px solid ${SS.borderSoft}` }}>
          <div><UKicker color="var(--acc-deep)">Compare areas</UKicker><div style={{ fontFamily: "Inter", fontSize: 22, fontWeight: 600, letterSpacing: -0.4, marginTop: 4 }}>{items.map(i => i.name).join("  vs  ")}</div></div>
          <button className="uw-iconbtn uw-click" onClick={onClose}><Ico name="close" size={14}/></button>
        </div>
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thS}></th>
                {items.map(a => <th key={a.id} style={{ ...thS, textAlign: "left", fontFamily: "Inter", fontSize: 16, fontWeight: 600, color: SS.ink, letterSpacing: -0.2 }}>{a.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ ...tdS, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: 0.6, textTransform: "uppercase", color: SS.ink3, width: 180 }}>{r[0]}</td>
                  {items.map(a => <td key={a.id} style={{ ...tdS, fontFamily: "Inter", fontSize: 14.5, color: SS.ink, fontWeight: 500 }}>{r[1](a)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
const thS = { padding: "14px 24px", textAlign: "left", borderBottom: `1px solid ${SS.border}` };
const tdS = { padding: "13px 24px", borderBottom: `1px solid ${SS.borderSoft}`, verticalAlign: "top" };

/* ---- Inspector switch ------------------------------------------------- */
const UInspector = (props) => {
  const { area, view, gp } = props;
  if (view === "sketch") return (
    <aside className="uw-insp" data-screen-label="Sketch inspector">
      <div style={{ padding: `${gp}px ${gp}px ${gp - 8}px`, borderBottom: `1px solid ${SS.borderSoft}` }}>
        <UKicker color="var(--acc-deep)">SiteSketcher</UKicker>
        <div style={{ fontFamily: "Inter", fontSize: 24, fontWeight: 600, color: SS.ink, letterSpacing: -0.5, marginTop: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{props.session ? props.session.name : "Site sketch"}</div>
        <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink3, marginTop: 6, lineHeight: 1.45 }}>{area ? `${area.name} · feasibility layout` : "Untitled site — search a location to anchor this sketch."}</div>
      </div>
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <TabSketch area={props.area} gp={gp} sketch={props.sketch} onSave={props.onSaveSketch}/>
      </div>
    </aside>
  );
  if (area) return <UOpportunity {...props}/>;
  if (view === "requirements") return <UResultsReqs gp={gp} includeNation={props.includeNation} onSelectReq={props.onSelectReq}/>;
  if (view === "saved") return (
    <aside className="uw-insp" data-screen-label="Results">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 40, gap: 10 }}>
        <span style={{ width: 48, height: 48, borderRadius: 12, background: "var(--acc-soft)", color: "var(--acc-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ico name="folder" size={22}/></span>
        <div style={{ fontFamily: "Inter", fontSize: 15, fontWeight: 600, color: SS.ink }}>Open a saved item</div>
        <div style={{ fontFamily: "Inter", fontSize: 13, color: SS.ink3, maxWidth: 240, lineHeight: 1.5 }}>Pick a saved opportunity or sketch on the left to reopen it in the workspace.</div>
      </div>
    </aside>
  );
  return <UResultsFind gp={gp} onPick={props.onPick} brandFilter={props.brandFilter} overlays={props.overlays} gapRules={props.gapRules}/>;
};

Object.assign(window, { UInspector, UCompareTray, UComparePanel, ReqCard });
