/* Direction F — "Two buckets" (D's guided sidebar, reduced to two plain boxes)
   The entire filter is two labelled boxes:
     ① Show towns MISSING these  (drop brands/categories in)
     ② …that ALREADY HAVE these  (drop brands/categories in)
   Everything is AND: results = towns missing ALL of box 1 AND having ALL of box 2.
   The AND logic is made visible with an "and" chip between tokens and a plain-
   English summary sentence that reads back exactly what the user built. */

const F_avatarColors = ["#6D31E8", "#0E7C86", "#B4530E", "#2456C4", "#8A1F5C"];

const F_Token = ({ label, kind, i, tone }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 8px 6px 6px", borderRadius: 999,
    border: `1px solid ${tone === "have" ? FG.border : FG.border}`, background: FG.surface, color: FG.ink }}>
    <span style={{ width: 22, height: 22, borderRadius: kind === "cat" ? 6 : 999, flexShrink: 0,
      background: kind === "cat" ? FG.violetSoft : F_avatarColors[i % F_avatarColors.length],
      color: kind === "cat" ? FG.violetDeep : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700 }}>
      {kind === "cat" ? <Ico n="layers" s={12} c={FG.violetDeep}/> : label[0]}
    </span>
    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
    <button style={{ border: "none", background: "transparent", cursor: "pointer", color: FG.ink4, padding: "0 1px", display: "inline-flex" }}><Ico n="close" s={12}/></button>
  </span>
);

const F_AddBtn = ({ solid }) => (
  <button style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", fontFamily: "Inter", fontWeight: 600,
    padding: solid ? "9px 16px" : "7px 12px 7px 10px", fontSize: solid ? 13.5 : 13, borderRadius: 999,
    border: solid ? "none" : `1px solid ${FG.violetTint}`,
    background: solid ? FG.violet : FG.violetSoft, color: solid ? "#fff" : FG.violetDeep }}>
    <Ico n="plus" s={solid ? 15 : 13} c={solid ? "#fff" : FG.violetDeep} w={2.4}/>{solid ? "Add a brand or category" : "Add"}
  </button>
);

const F_And = () => (
  <span className="fg-mono" style={{ alignSelf: "center", fontSize: 9.5, letterSpacing: 1, color: FG.ink4, textTransform: "uppercase", padding: "0 1px" }}>and</span>
);

const F_Prox = ({ verbColor, value }) => (
  <div style={{ borderTop: `1px dashed ${FG.border}`, padding: "9px 15px 11px", background: "rgba(255,255,255,0.5)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
      <Ico n="pin" s={13} c={FG.ink3}/>
      <span style={{ fontSize: 12.5, color: FG.ink2 }}>Count a match when it's</span>
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {["In the town", "1 km", "3 km", "5 km", "10 km"].map(d => {
        const on = d === value;
        return (
          <button key={d} style={{ cursor: "pointer", fontFamily: "Inter", fontSize: 12, fontWeight: 600,
            padding: "6px 11px", borderRadius: 999, border: `1px solid ${on ? verbColor : FG.border}`,
            background: on ? verbColor : FG.surface, color: on ? "#fff" : FG.ink2, whiteSpace: "nowrap" }}>
            {d === "In the town" ? d : `Within ${d}`}
          </button>
        );
      })}
    </div>
  </div>
);

const F_Bucket = ({ n, verb, verbColor, tint, ring, sub, tokens, empty, tone, active, prox }) => (
  <div style={{ border: `1.5px solid ${active ? FG.violet : empty ? FG.border : ring}`, borderRadius: 14, background: empty ? FG.surface : tint, overflow: "hidden", position: active ? "relative" : "static", zIndex: active ? 25 : "auto", boxShadow: active ? "0 0 0 4px rgba(109,49,232,0.12)" : "none" }}>
    <div style={{ padding: "13px 15px 12px", display: "flex", gap: 11, alignItems: "flex-start" }}>
      <span style={{ width: 24, height: 24, borderRadius: 999, flexShrink: 0, background: verbColor, color: "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, marginTop: 1 }}>{n}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: -0.2 }}>Show towns that <span style={{ color: verbColor }}>{verb}</span></div>
        <div style={{ fontSize: 12, color: FG.ink3, marginTop: 2 }}>{sub}</div>
      </div>
    </div>
    <div style={{ padding: "0 15px 15px", display: "flex", flexWrap: "wrap", gap: 8 }}>
      {empty ? (
        <div style={{ width: "100%", border: `1px dashed ${FG.border}`, borderRadius: 11, padding: "16px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 11, background: FG.surface }}>
          <span style={{ fontSize: 12.5, color: FG.ink3 }}>{tone === "have" ? "Optional — leave empty to ignore" : "Add the shops you're checking for"}</span>
          <F_AddBtn solid="missing"/>
        </div>
      ) : active ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <F_Token label="Aldi" i={0}/><F_And/><F_Token label="Lidl" i={1}/>
          <F_AddBtn solid="missing"/>
        </div>
      ) : (
        <React.Fragment>
          {tokens.map((t, k) => (
            <React.Fragment key={k}>
              {k > 0 && <F_And/>}
              <F_Token label={t.label} kind={t.kind} i={t.i} tone={tone}/>
            </React.Fragment>
          ))}
          <F_AddBtn/>
        </React.Fragment>
      )}
    </div>
    {!empty && !active && <F_Prox verbColor={verbColor} value={prox}/>}
  </div>
);

const F_PICK_BRANDS = [
  { label: "Aldi", i: 0, added: true }, { label: "Lidl", i: 1, added: true },
  { label: "Asda", i: 3 }, { label: "Sainsbury's", i: 4 }, { label: "Morrisons", i: 2 }, { label: "Co-op", i: 0 },
];
const F_PICK_CATS = [{ label: "Supermarkets" }, { label: "Discount grocers" }, { label: "Clothing" }, { label: "Coffee shops" }];

const F_PickRow = ({ label, i, kind, added, query }) => (
  <button style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", border: "none",
    background: "transparent", cursor: "pointer", textAlign: "left", borderRadius: 9 }}
    onMouseOver={e => e.currentTarget.style.background = FG.bg} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
    <span style={{ width: 26, height: 26, borderRadius: kind === "cat" ? 7 : 999, flexShrink: 0,
      background: kind === "cat" ? FG.violetSoft : F_avatarColors[i % F_avatarColors.length],
      color: kind === "cat" ? FG.violetDeep : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700 }}>
      {kind === "cat" ? <Ico n="layers" s={13} c={FG.violetDeep}/> : label[0]}
    </span>
    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: FG.ink }}>{label}{kind === "cat" && <span className="fg-mono" style={{ fontSize: 9, letterSpacing: 0.5, color: FG.ink4, textTransform: "uppercase", marginLeft: 8 }}>Category</span>}</span>
    {added ? (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: FG.violetDeep }}><Ico n="check" s={13} c={FG.violetDeep} w={2.4}/>Added</span>
    ) : (
      <span style={{ width: 22, height: 22, borderRadius: 999, border: `1.5px solid ${FG.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", color: FG.ink3 }}><Ico n="plus" s={13}/></span>
    )}
  </button>
);

const F_Picker = () => (
  <div style={{ position: "absolute", left: 20, right: 20, top: 210, zIndex: 30, background: FG.surface,
    border: `1px solid ${FG.border}`, borderRadius: 14, boxShadow: "0 20px 48px -16px rgba(20,16,40,0.4)", overflow: "hidden" }}>
    <div style={{ padding: "12px 14px 10px", borderBottom: `1px solid ${FG.borderSoft}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${FG.violet}`, background: FG.surface }}>
        <Ico n="search" s={15} c={FG.ink3}/>
        <span style={{ flex: 1, fontSize: 13.5, color: FG.ink }}>al<span style={{ display: "inline-block", width: 1, height: 15, background: FG.violet, verticalAlign: "middle", marginLeft: 1 }}/></span>
        <span style={{ fontSize: 11.5, color: FG.ink4 }}>Type a shop or category</span>
      </div>
    </div>
    <div style={{ maxHeight: 360, overflow: "hidden", padding: "8px 6px 6px" }}>
      <div className="fg-mono" style={{ fontSize: 9.5, letterSpacing: 1, color: FG.ink4, textTransform: "uppercase", padding: "4px 8px 6px" }}>Brands</div>
      {F_PICK_BRANDS.map((b, k) => <F_PickRow key={k} {...b}/>)}
      <div className="fg-mono" style={{ fontSize: 9.5, letterSpacing: 1, color: FG.ink4, textTransform: "uppercase", padding: "10px 8px 6px" }}>Categories</div>
      {F_PICK_CATS.map((c, k) => <F_PickRow key={k} {...c} kind="cat"/>)}
    </div>
    <div style={{ padding: "11px 14px", borderTop: `1px solid ${FG.borderSoft}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: FG.ink3 }}><b style={{ color: FG.ink }}>2</b> added to “missing”</span>
      <button className="fg-csvbtn" style={{ width: "auto", height: 34, padding: "0 16px", background: FG.violet }}>Done</button>
    </div>
  </div>
);

const F_Left = ({ empty, picking }) => (
  <aside className="fg-panel l" style={{ width: 400, position: "relative", overflowY: "auto" }} data-screen-label="Filters">
    {picking && <div style={{ position: "absolute", inset: 0, background: "rgba(20,16,40,0.14)", zIndex: 20 }}/>}
    {picking && <F_Picker/>}
    <div style={{ padding: "18px 20px 14px" }}>
      <div className="fg-kicker" style={{ color: FG.violetDeep }}>Find Gaps</div>
      <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: -0.5, marginTop: 6 }}>Where can we open next?</div>
      <div style={{ fontSize: 12.5, color: FG.ink2, marginTop: 7, lineHeight: 1.55 }}>Fill the two boxes below. We'll show every town that matches <b style={{ color: FG.ink }}>both</b>.</div>
    </div>
    <div style={{ height: 1, background: FG.borderSoft, margin: "0 20px 14px" }}/>

    <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 11 }}>
      <F_Bucket n="1" verb="are MISSING" verbColor={FG.violet} tint={FG.violetSoft} ring={FG.violetTint} tone="missing"
        sub="Towns where these haven't opened yet" empty={empty && !picking} active={picking} prox="In the town"
        tokens={[{ label: "Aldi", i: 0 }, { label: "Lidl", i: 1 }]}/>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: FG.borderSoft }}/>
        <span className="fg-mono" style={{ fontSize: 10, letterSpacing: 1.5, color: FG.ink4, textTransform: "uppercase" }}>and also</span>
        <div style={{ flex: 1, height: 1, background: FG.borderSoft }}/>
      </div>

      <F_Bucket n="2" verb="ALREADY HAVE" verbColor={FG.teal || "#0E7C86"} tint="#eef6f6" ring="#bfe0e0" tone="have"
        sub="Towns that already contain these" empty={empty} prox="5 km"
        tokens={[{ label: "Tesco", i: 2 }, { label: "Asda", i: 3 }]}/>

      <div style={{ borderTop: `1px solid ${FG.borderSoft}`, paddingTop: 13 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>Town size <span style={{ color: FG.ink4, fontWeight: 500 }}>(optional)</span></span>
          <span className="fg-mono" style={{ fontSize: 11, color: FG.ink2 }}>50k – 500k</span>
        </div>
        <div style={{ fontSize: 12, color: FG.ink3, marginBottom: 2 }}>Only show towns within this population range.</div>
        <div className="fg-slider">
          <div className="track"><div className="fill" style={{ left: "14%", right: "40%" }}/><div className="h" style={{ left: "14%" }}/><div className="h" style={{ left: "60%" }}/></div>
          <div className="vals"><span>5k</span><span>1.2m</span></div>
        </div>
      </div>
    </div>

    <div style={{ flex: 1, minHeight: 12 }}/>
  </aside>
);

const F_Right = ({ empty }) => (
  <aside className="fg-panel r" style={{ width: 440 }} data-screen-label="Results">
    {empty ? (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "32px 34px", gap: 18 }}>
        <span style={{ width: 56, height: 56, borderRadius: 16, background: FG.violetSoft, border: `1px solid ${FG.violetTint}`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ico n="target" s={24} c={FG.violet}/></span>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Two boxes, one list</div>
          <div style={{ fontSize: 13.5, color: FG.ink2, marginTop: 8, lineHeight: 1.6, maxWidth: 330 }}>Put the shops you want to be <b style={{ color: FG.ink }}>missing</b> in the first box, and any that must <b style={{ color: FG.ink }}>already be there</b> in the second. Towns matching both show up here.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 2 }}>
          {[["Box 1 = missing", "Aldi, Lidl haven't opened there"], ["Box 2 = already have", "Tesco, Asda are present"], ["Both must be true", "We match on AND, not either/or"], ["Export as CSV", "Send the shortlist to your team"]].map((s, k) => (
            <div key={k} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: FG.violetSoft, color: FG.violetDeep, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ico n="check" s={13} c={FG.violetDeep} w={2.4}/></span>
              <div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{s[0]}</div><div style={{ fontSize: 12, color: FG.ink3, marginTop: 1 }}>{s[1]}</div></div>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <React.Fragment>
        <div className="fg-resulthd" style={{ padding: "20px 22px 16px" }}>
          <div style={{ padding: "12px 15px", borderRadius: 12, background: FG.paper2 || "#f6f4ef", border: `1px solid ${FG.borderSoft}`, marginBottom: 16 }}>
            <div className="fg-mono" style={{ fontSize: 9.5, letterSpacing: 1, color: FG.ink4, textTransform: "uppercase", marginBottom: 6 }}>You're looking for</div>
            <div style={{ fontSize: 13, color: FG.ink, lineHeight: 1.6 }}>
              Towns missing <b>Aldi</b> and <b>Lidl</b>, that have <b>Tesco</b> and <b>Asda</b> <b>within 5&nbsp;km</b>, with a population of <b>50k–500k</b>.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div className="fg-mono" style={{ fontSize: 9.5, letterSpacing: 1, color: FG.ink4, textTransform: "uppercase", marginBottom: 3 }}>Matching towns</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span className="fg-count" style={{ fontSize: 32 }}>212</span><span className="fg-of">of 1,586 UK towns</span>
              </div>
            </div>
            <button className="fg-csvbtn" style={{ width: "auto", padding: "0 16px", flexShrink: 0 }}><Ico n="download" s={15} c="#fff"/>Export CSV</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
            <span className="fg-mono" style={{ fontSize: 9.5, letterSpacing: 1, color: FG.ink4, textTransform: "uppercase", marginRight: 2 }}>Sort</span>
            <span className="fg-pill on" style={{ fontSize: 11.5 }}>Population ↓</span>
            <span className="fg-pill" style={{ fontSize: 11.5 }}>A–Z</span>
          </div>
        </div>
        <div className="fg-scroll">
          {FG_LOCS.map((l, i) => (
            <div key={i} className="fg-loc" style={{ gridTemplateColumns: "22px 1fr auto", padding: "14px 22px" }}>
              <span style={{ color: FG.violet }}><IcoFill n="pin" s={18} c={FG.violet}/></span>
              <div>
                <div className="nm">{l.nm}</div>
                <div className="meta"><span>{l.reg}</span><span>· POP {l.pop}</span></div>
                <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                  <span className="fg-pill acc" style={{ fontSize: 10.5, padding: "3px 8px", cursor: "default" }}>Missing Aldi, Lidl</span>
                  <span className="fg-pill" style={{ fontSize: 10.5, padding: "3px 8px", cursor: "default", color: "#0E7C86", background: "#eef6f6", borderColor: "#bfe0e0" }}>Tesco, Asda within 5 km</span>
                </div>
              </div>
              <span style={{ color: FG.violetDeep, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>Open<Ico n="chevR" s={13}/></span>
            </div>
          ))}
        </div>
      </React.Fragment>
    )}
  </aside>
);

const DirectionF = ({ empty = false, picking = false }) => (
  <div className="fg-frame">
    <style>{FG_CSS}</style>
    <FGChrome/>
    <div style={{ display: "grid", gridTemplateColumns: "56px 400px 1fr 440px", minHeight: 0 }}>
      <FGRail/>
      <F_Left empty={empty} picking={picking}/>
      <FGMap>
        {!empty && <FGGapMarkers labelled/>}
        {(empty && !picking) && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "rgba(255,255,255,0.94)", border: `1px solid ${FG.border}`, borderRadius: 14, padding: "16px 20px", textAlign: "center", boxShadow: "0 12px 32px -12px rgba(0,0,0,0.4)", maxWidth: 320 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Fill the boxes to light up the map</div>
              <div style={{ fontSize: 12, color: FG.ink3, marginTop: 4, lineHeight: 1.5 }}>Matching towns appear as rings here.</div>
            </div>
          </div>
        )}
      </FGMap>
      <F_Right empty={empty}/>
    </div>
  </div>
);

Object.assign(window, { DirectionF });
