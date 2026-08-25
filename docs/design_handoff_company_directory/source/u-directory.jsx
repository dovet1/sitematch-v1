/* GapFinder — Unified Workspace · Directory
   Card-based directory of Brands, in-house expansion Teams and Agents, with
   click-through between connected entities. Full-width takeover in the body
   (like the sketch launcher); navigation is a simple push/pop stack. */

const UD_STYLE = `
.ud-wrap { position: relative; min-height: 0; overflow: auto; background: ${SS.bg};
  background-image: radial-gradient(ellipse 900px 420px at 50% -10%, var(--acc-soft) 0%, transparent 60%); }
.ud-inner { width: min(1160px, 100%); margin: 0 auto; padding: 26px 30px 60px; }
.ud-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(248px, 1fr)); gap: 14px; }
.ud-card { text-align: left; cursor: pointer; padding: 16px; border-radius: 14px; border: 1px solid ${SS.border};
  background: ${SS.surface}; display: flex; flex-direction: column; gap: 13px; transition: border-color .12s, box-shadow .12s, transform .12s; }
.ud-card:hover { border-color: var(--acc); box-shadow: 0 14px 34px -20px rgba(20,10,40,.35); transform: translateY(-2px); }
.ud-seg { display: inline-flex; gap: 3px; padding: 3px; border-radius: 11px; background: ${SS.bg}; border: 1px solid ${SS.border}; }
.ud-seg button { display: inline-flex; align-items: center; gap: 7px; padding: 8px 15px; border: none; background: transparent; cursor: pointer;
  border-radius: 8px; font-family: Inter; font-size: 13px; font-weight: 500; color: ${SS.ink3}; }
.ud-seg button.on { background: ${SS.ink}; color: #fff; font-weight: 600; }
.ud-seg .n { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; opacity: .7; }
.ud-panel { border: 1px solid ${SS.border}; border-radius: 15px; background: ${SS.surface}; overflow: hidden; }
.ud-panel-hd { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 16px; border-bottom: 1px solid ${SS.borderSoft}; }
.ud-back { display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px 7px 9px; border-radius: 9px; cursor: pointer;
  border: 1px solid ${SS.border}; background: ${SS.surface}; color: ${SS.ink2}; font-family: Inter; font-size: 12.5px; font-weight: 500; }
.ud-back:hover { background: ${SS.bg}; color: ${SS.ink}; }
.ud-crumb { display: inline-flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: .5px; text-transform: uppercase; color: ${SS.ink3}; }
.ud-crumb b { color: ${SS.ink}; font-weight: 700; }
.ud-stat { flex: 1; }
.ud-stat .v { font-family: Inter; font-size: 20px; font-weight: 600; color: ${SS.ink}; letter-spacing: -.4px; }
.ud-stat .k { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: ${SS.ink3}; font-weight: 600; margin-top: 2px; }
.ud-minirow { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; cursor: pointer; padding: 12px 14px; border: none; background: transparent; border-bottom: 1px solid ${SS.borderSoft}; }
.ud-minirow:last-child { border-bottom: none; }
.ud-minirow:hover { background: ${SS.bg}; }

/* ---- Occupier profile (brand detail) — breathing panel bands ---- */
.oc-wrap { display: flex; flex-direction: column; gap: 14px }
.oc-panel { border: 1px solid ${SS.border}; border-radius: 15px; background: ${SS.surface}; box-shadow: 0 1px 2px rgba(23,20,25,.03) }
.oc-phd { display: flex; align-items: center; gap: 10px; padding: 14px 18px 0 }
.oc-pbody { padding: 14px 18px 18px }

/* hero */
.oc-hero { display: flex; align-items: center; gap: 16px; padding: 18px 22px }
.oc-hname { font-family: Inter; font-weight: 600; font-size: 23px; letter-spacing: -.5px; line-height: 1.1; display: flex; align-items: center; gap: 9px; color: ${SS.ink} }
.oc-hname a { color: ${SS.ink4}; display: inline-flex; transition: color .15s } .oc-hname a:hover { color: var(--acc) }
.oc-htags { display: flex; gap: 6px; margin-top: 9px; flex-wrap: wrap; align-items: center }
.oc-pill { font-family: Inter; font-size: 11px; font-weight: 500; padding: 3px 10px; border-radius: 999px; background: ${SS.bg}; border: 1px solid ${SS.borderHard}; color: ${SS.ink2} }
.oc-pill.sector { background: ${SS.ink}; color: #fff; border-color: ${SS.ink}; font-weight: 600 }
.oc-hstats { display: flex; gap: 30px; margin-left: auto; padding-left: 26px; border-left: 1px solid ${SS.borderSoft} }
.oc-hstat .v { font-family: Inter; font-size: 19px; font-weight: 600; color: ${SS.ink}; letter-spacing: -.3px }
.oc-hstat .k { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: ${SS.ink3}; font-weight: 600; margin-top: 4px }

/* main row: requirement + map */
.oc-main { display: grid; grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr); gap: 14px; align-items: stretch; grid-auto-rows: minmax(310px, auto) }

/* requirement */
.oc-rtiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px }
.oc-tile { padding: 15px 16px; border-radius: 12px; border: 1px solid ${SS.borderSoft}; background: ${SS.bg} }
.oc-tile.seen { background: linear-gradient(160deg, var(--acc-soft), #FCFBFF); border-color: var(--acc-tint) }
.oc-tlabel { font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: ${SS.ink3}; margin-bottom: 10px; display: flex; align-items: center; gap: 6px }
.oc-tlabel.ours { color: var(--acc-deep) }
.oc-tval { font-family: Inter; font-weight: 600; font-size: 24px; letter-spacing: -.7px; line-height: 1; color: ${SS.ink} }
.oc-tval .u { font-size: 12.5px; font-weight: 500; color: ${SS.ink3}; margin-left: 4px }
.oc-tsrc { font-family: Inter; font-size: 11px; color: ${SS.ink3}; margin-top: 9px; line-height: 1.45 } .oc-tsrc b { color: ${SS.ink2}; font-weight: 600 }
.oc-summary { font-family: Inter; font-size: 12.5px; color: ${SS.ink2}; line-height: 1.6; margin: 14px 0 0 }
.oc-rmeta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; padding-top: 14px; border-top: 1px solid ${SS.borderSoft} }
.oc-rmeta .k { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: ${SS.ink3}; font-weight: 600; display: block; margin-bottom: 4px }
.oc-rmeta .v { font-family: Inter; font-size: 12.5px; color: ${SS.ink}; font-weight: 500 }
.oc-broc-btn { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; margin-top: 14px; padding: 11px 15px; border-radius: 11px; background: ${SS.ink}; color: #fff; text-decoration: none; font-family: Inter; font-weight: 600; font-size: 13.5px; transition: background .15s; cursor: pointer; border: none; text-align: left }
.oc-broc-btn:hover { background: var(--acc) }
.oc-broc-btn .l { display: flex; align-items: center; gap: 11px }
.oc-broc-btn .doc { width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0; background: rgba(255,255,255,.14); display: flex; align-items: center; justify-content: center }
.oc-broc-btn .sub { display: block; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 500; color: rgba(255,255,255,.6); margin-top: 2px; letter-spacing: .3px }
.oc-loclabel { font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: ${SS.ink3}; margin: 16px 0 9px }
.oc-lchips { display: flex; flex-wrap: wrap; gap: 6px }

/* estate map */
.oc-estate { position: relative; background: #EFEBE1; border-radius: 15px; overflow: hidden; border: 1px solid ${SS.border}; min-height: 300px; height: 100% }
.oc-ehead { position: absolute; top: 0; left: 0; right: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: linear-gradient(180deg, rgba(251,250,247,.97), rgba(251,250,247,0)) }
.oc-mtoggle { display: inline-flex; gap: 3px; padding: 3px; border-radius: 11px; background: rgba(255,255,255,.9); border: 1px solid ${SS.border} }
.oc-mtab { font-family: Inter; font-size: 12px; font-weight: 500; color: ${SS.ink3}; background: transparent; border: 0; padding: 6px 13px; border-radius: 8px; cursor: pointer; transition: all .15s; white-space: nowrap }
.oc-mtab:hover { color: ${SS.ink} } .oc-mtab.on { background: ${SS.ink}; color: #fff; font-weight: 600 }
.oc-count { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; font-weight: 600; color: #fff; background: ${SS.ink}; padding: 4px 10px; border-radius: 999px }
.oc-legend { position: absolute; bottom: 0; left: 0; right: 0; z-index: 2; display: flex; gap: 16px; padding: 12px 16px; background: linear-gradient(0deg, rgba(251,250,247,.97), rgba(251,250,247,0)) }
.oc-leg { display: flex; align-items: center; gap: 6px; font-family: Inter; font-size: 11px; font-weight: 500; color: ${SS.ink2} }
.oc-leg .d { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid #fff }

/* contacts — full-width band of wide tiles */
.oc-cgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px }
.oc-ctile { padding: 13px 14px; border: 1px solid ${SS.borderSoft}; border-radius: 12px; background: ${SS.bg} }
.oc-cname { font-family: Inter; font-weight: 600; font-size: 13.5px; color: ${SS.ink}; display: flex; align-items: center; gap: 7px; flex-wrap: wrap }
.oc-cnamebtn { font-family: Inter; font-weight: 600; font-size: 13.5px; color: ${SS.ink}; background: none; border: none; padding: 0; cursor: pointer }
.oc-cnamebtn:hover { color: var(--acc) }
.oc-mini { font-family: 'JetBrains Mono', monospace; font-size: 8.5px; letter-spacing: .6px; text-transform: uppercase; color: ${SS.ink3}; background: ${SS.surface}; border: 1px solid ${SS.borderSoft}; border-radius: 5px; padding: 1px 5px }
.oc-mini.agent { color: var(--acc-deep); background: var(--acc-soft); border-color: var(--acc-tint) }
.oc-crole { font-family: Inter; font-size: 11.5px; color: ${SS.ink3}; margin-top: 3px; margin-bottom: 9px }
.oc-clines { display: flex; flex-direction: column; gap: 5px }
.oc-cline { display: flex; align-items: center; gap: 9px; font-family: Inter; font-size: 12.5px; color: ${SS.ink2}; text-decoration: none; width: fit-content; transition: color .15s }
.oc-cline:hover { color: var(--acc) }
.oc-cline svg { width: 13px; height: 13px; flex-shrink: 0; color: ${SS.ink4} } .oc-cline:hover svg { color: var(--acc) }
.oc-cline.mono { font-family: 'JetBrains Mono', monospace; font-size: 11px }

/* activity */
.oc-feed { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px }
.oc-event { padding: 13px 14px; background: ${SS.bg}; border: 1px solid ${SS.borderSoft}; border-radius: 11px; border-top: 3px solid ${SS.borderHard} }
.oc-etop { display: flex; align-items: center; gap: 7px; margin-bottom: 9px; flex-wrap: wrap }
.oc-etype { font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; padding: 2px 7px; border-radius: 5px }
.oc-edate { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; color: ${SS.ink} }
.oc-ehead2 { font-family: Inter; font-size: 12.5px; line-height: 1.45; color: ${SS.ink2}; text-decoration: none; font-weight: 500; border-bottom: 1px solid transparent; transition: color .15s, border-color .15s }
.oc-ehead2:hover { color: var(--acc); border-color: var(--acc-tint) }
@media (max-width: 720px) { .oc-main { grid-template-columns: 1fr } .oc-feed { grid-template-columns: 1fr 1fr } .oc-hstats { display: none } }
`;

/* Round initials avatar (people & agents) */
const DirAvatar = ({ initials, color, size = 40, radius }) => (
  <span style={{ width: size, height: size, borderRadius: radius != null ? radius : 999, background: color, color: "#fff",
    display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    fontFamily: "Inter", fontWeight: 600, fontSize: size * 0.36, letterSpacing: -0.2 }}>{initials}</span>
);

/* Requirement status pill (Directory) */
const DirReqPill = ({ status }) => {
  const map = {
    "Actively acquiring": { bg: "#DCFCE7", fg: "#15803D", dot: "#16A34A" },
    "Growing":            { bg: "#DCFCE7", fg: "#15803D", dot: "#16A34A" },
    "Selective":          { bg: "#FEF3C7", fg: "#92400E", dot: "#D97706" },
  };
  const c = status ? (map[status] || map.Selective) : { bg: SS.bg, fg: SS.ink3, dot: SS.ink4 };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 999,
      background: c.bg, color: c.fg, fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 700, letterSpacing: .4, textTransform: "uppercase" }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: c.dot }}/>{status || "No requirement on file"}
    </span>
  );
};

/* ---- Brand's store estate: deterministic UK scatter -------------------- */
const DirEstateMap = ({ brand, height = 220 }) => {
  const anchors = [
    [540, 700], [520, 660], [500, 760], [490, 585], [455, 480], [470, 425],
    [430, 560], [450, 620], [400, 700], [400, 550], [370, 690], [400, 305], [445, 300], [335, 300],
  ];
  const n = Math.min(brand.estate.count, 44);
  let seed = 0; for (let i = 0; i < brand.name.length; i++) seed = (seed * 31 + brand.name.charCodeAt(i)) % 100000;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 1000) / 1000; };
  const dots = Array.from({ length: n }, (_, i) => {
    const a = anchors[i % anchors.length];
    return [a[0] + (rand() - 0.5) * 74, a[1] + (rand() - 0.5) * 74];
  });
  return (
    <div style={{ position: "relative", height, background: "#EFEBE1", borderRadius: 12, overflow: "hidden", border: `1px solid ${SS.borderSoft}` }}>
      <svg viewBox="255 250 350 620" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }}>
        <g opacity="0.55">
          <path d="M380 240 Q330 220 330 280 Q300 280 290 320 Q280 360 320 380 Q320 420 290 450 Q280 500 330 510 Q310 560 350 600 Q380 640 360 680 Q400 720 420 760 Q440 820 480 840 Q520 820 540 760 Q560 700 540 660 Q580 640 600 600 Q620 540 580 510 Q600 470 580 430 Q560 380 520 370 Q540 320 500 290 Q460 260 420 270 Q400 240 380 240 Z" fill="#E2DBC9" stroke="#C9C1AA" strokeWidth="1.5"/>
          <path d="M340 220 Q320 180 360 160 Q400 150 420 200 Q430 240 380 240 Q360 240 340 220 Z" fill="#E2DBC9" stroke="#C9C1AA" strokeWidth="1.5"/>
        </g>
        {dots.map((d, i) => <circle key={i} cx={d[0]} cy={d[1]} r="6" fill={brand.color} fillOpacity="0.9" stroke="#fff" strokeWidth="1.6"/>)}
      </svg>
      <div style={{ position: "absolute", bottom: 10, left: 12, padding: "5px 10px", borderRadius: 999, background: "rgba(255,255,255,.94)",
        border: `1px solid ${SS.borderSoft}`, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink2, display: "inline-flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: brand.color }}/>{brand.estate.count.toLocaleString()} UK stores
      </div>
    </div>
  );
};

/* ---- Cards (root grid) ------------------------------------------------- */
const DirBrandCard = ({ brand, onOpen }) => (
  <button className="ud-card uw-click" onClick={() => onOpen(brand)}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <DirAvatar initials={brand.initials} color={brand.color} size={44} radius={11}/>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "Inter", fontSize: 15.5, fontWeight: 600, color: SS.ink, letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brand.name}</div>
        <div style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink3, marginTop: 1 }}>{brand.sector}</div>
      </div>
    </div>
    <DirReqPill status={brand.requirement ? brand.requirement.status : null}/>
    <div style={{ display: "flex", gap: 10, paddingTop: 11, borderTop: `1px solid ${SS.borderSoft}` }}>
      {[[brand.ukStores.toLocaleString(), "UK stores"], [brand.team.length, "In-house"], [brand.agentIds.length, "Agents"]].map((s, i) => (
        <div key={i} className="ud-stat"><div className="v">{s[0]}</div><div className="k">{s[1]}</div></div>
      ))}
    </div>
  </button>
);

const DirAgentCard = ({ agent, onOpen }) => {
  const brands = dirAgentBrands(agent.id);
  return (
    <button className="ud-card uw-click" onClick={() => onOpen(agent)}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <DirAvatar initials={agent.initials} color={agent.color} size={44}/>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "Inter", fontSize: 15, fontWeight: 600, color: SS.ink, letterSpacing: -0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{agent.name}</div>
          <div style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink3, marginTop: 1 }}>{agent.role} · {agent.firm}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {brands.slice(0, 4).map(b => <DirAvatar key={b.id} initials={b.initials} color={b.color} size={22} radius={6}/>)}
        {brands.length > 4 && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: SS.ink3, alignSelf: "center" }}>+{brands.length - 4}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 11, borderTop: `1px solid ${SS.borderSoft}` }}>
        <span style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink2 }}>Represents <strong style={{ color: SS.ink }}>{brands.length}</strong> brand{brands.length === 1 ? "" : "s"}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, letterSpacing: .4, textTransform: "uppercase" }}>{agent.region}</span>
      </div>
    </button>
  );
};

const DirTeamCard = ({ person, onOpen }) => (
  <button className="ud-card uw-click" onClick={() => onOpen(U_DIR_BRAND_BY_ID[person.brandId])}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <DirAvatar initials={person.initials} color={person.color} size={44}/>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "Inter", fontSize: 15, fontWeight: 600, color: SS.ink, letterSpacing: -0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{person.name}</div>
        <div style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink3, marginTop: 1 }}>{person.role}</div>
      </div>
    </div>
    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink2 }}>{person.email}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 11, borderTop: `1px solid ${SS.borderSoft}` }}>
      <DirAvatar initials={person.initials && U_DIR_BRAND_BY_ID[person.brandId].initials} color={person.color} size={20} radius={5}/>
      <span style={{ fontFamily: "Inter", fontSize: 12.5, fontWeight: 500, color: SS.ink }}>{person.brandName}</span>
    </div>
  </button>
);

/* ---- Shared contact row ------------------------------------------------ */
const DirContact = ({ name, role, org, email, phone, label }) => (
  <div className="um-contact">
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 600, color: SS.ink }}>{name}</div>
        {label && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, letterSpacing: .6, textTransform: "uppercase", color: SS.ink3, background: SS.surface, border: `1px solid ${SS.borderSoft}`, borderRadius: 5, padding: "1px 5px" }}>{label}</span>}
      </div>
      <div style={{ fontFamily: "Inter", fontSize: 11.5, color: SS.ink3 }}>{role}{org ? ` · ${org}` : ""}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink2, marginTop: 3 }}>{email} · {phone}</div>
    </div>
    <button className="um-copy uw-click">Copy</button>
  </div>
);

const DirPanel = ({ title, count, children, span }) => (
  <section className="ud-panel" style={span ? { gridColumn: "1 / -1" } : undefined}>
    <div className="ud-panel-hd">
      <UKicker color="var(--acc-deep)">{title}</UKicker>
      {count != null && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink3 }}>{count}</span>}
    </div>
    {children}
  </section>
);

/* ---- Occupier estate map (existing estate + targets toggle) ----------- */
const OC_ANCHORS = [[540,700],[520,660],[500,760],[490,585],[455,480],[470,425],[430,560],[450,620],[400,700],[400,550],[370,690],[400,305],[445,300],[335,300],[480,540],[510,620]];
const OC_TARGETS = [[410,430],[430,370],[370,440],[360,670],[400,300]];
const OC_LAND = "M380 240 Q330 220 330 280 Q300 280 290 320 Q280 360 320 380 Q320 420 290 450 Q280 500 330 510 Q310 560 350 600 Q380 640 360 680 Q400 720 420 760 Q440 820 480 840 Q520 820 540 760 Q560 700 540 660 Q580 640 600 600 Q620 540 580 510 Q600 470 580 430 Q560 380 520 370 Q540 320 500 290 Q460 260 420 270 Q400 240 380 240 Z";
const OC_LAND2 = "M340 220 Q320 180 360 160 Q400 150 420 200 Q430 240 380 240 Q360 240 340 220 Z";

const OccMap = ({ brand }) => {
  const [view, setView] = React.useState("estate");
  const nT = brand.requirement ? brand.requirement.locations.length : 0;
  const targets = OC_TARGETS.slice(0, Math.max(1, Math.min(5, nT || 3)));
  return (
    <div className="oc-estate">
      <div className="oc-ehead">
        <div className="oc-mtoggle" role="tablist">
          <button className={"oc-mtab uw-click" + (view === "estate" ? " on" : "")} onClick={() => setView("estate")}>Existing estate</button>
          <button className={"oc-mtab uw-click" + (view === "targets" ? " on" : "")} onClick={() => setView("targets")}>Targets</button>
        </div>
        <div className="oc-count">{view === "estate" ? `${brand.estate.count.toLocaleString()} stores` : `${targets.length} target towns`}</div>
      </div>
      <div style={{ position: "absolute", inset: 0 }}>
        <svg viewBox="255 250 350 620" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
          <g opacity="0.6">
            <path d={OC_LAND} fill="#E2DBC9" stroke="#C9C1AA" strokeWidth="1.5"/>
            <path d={OC_LAND2} fill="#E2DBC9" stroke="#C9C1AA" strokeWidth="1.5"/>
          </g>
          {view === "estate" ? OC_ANCHORS.map((d, i) => {
            const isNew = i === 4 || i === 11, isClose = i === 7;
            const fill = isNew ? SS.ok : isClose ? "#DC2626" : brand.color;
            return <circle key={i} cx={d[0]} cy={d[1]} r={isNew || isClose ? 7 : 6} fill={fill} fillOpacity={isNew || isClose ? 1 : 0.9} stroke="#fff" strokeWidth="1.6"/>;
          }) : targets.map((t, i) => (
            <g key={i}><circle cx={t[0]} cy={t[1]} r="22" fill={SS.violet} opacity="0.16"/><circle cx={t[0]} cy={t[1]} r="8" fill={SS.violet} stroke="#fff" strokeWidth="2"/></g>
          ))}
        </svg>
      </div>
      {view === "estate" && (
        <div className="oc-legend">
          <span className="oc-leg"><span className="d" style={{ background: brand.color }}/>Trading</span>
          <span className="oc-leg"><span className="d" style={{ background: SS.ok }}/>New</span>
          <span className="oc-leg"><span className="d" style={{ background: "#DC2626" }}/>Closing</span>
        </div>
      )}
    </div>
  );
};

/* Panel header: kicker + rule + optional right-hand slot */
const OcHd = ({ title, right }) => (
  <div className="oc-phd">
    <UKicker color="var(--acc-deep)">{title}</UKicker>
    <span style={{ flex: 1, height: 1, background: SS.borderSoft }}/>
    {right}
  </div>
);

const OcContact = ({ name, label, agent, role, email, phone, onClick, linkText }) => (
  <div className="oc-ctile">
    <div className="oc-cname">
      {onClick ? <button className="oc-cnamebtn uw-click" onClick={onClick}>{name}</button> : name}
      <span className={"oc-mini" + (agent ? " agent" : "")}>{label}</span>
    </div>
    <div className="oc-crole">{role}</div>
    <div className="oc-clines">
      <a className="oc-cline mono" href={`mailto:${email}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>{email}</a>
      {phone && <a className="oc-cline mono" href={`tel:${phone.replace(/\s/g, "")}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>{phone}</a>}
      {onClick
        ? <button className="oc-cline uw-click" onClick={onClick} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><AIco name="chevright" size={13}/>{linkText}</button>
        : <a className="oc-cline" href="#" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05C20.4 8.65 21 10.9 21 14v7h-4v-6.2c0-1.48-.03-3.38-2.06-3.38-2.06 0-2.38 1.6-2.38 3.27V21H9z"/></svg>{linkText}</a>}
    </div>
  </div>
);

/* ---- Brand detail (occupier profile) ---------------------------------- */
const DirBrandDetail = ({ brand, onBack, onAgent }) => {
  const agents = dirBrandAgents(brand);
  const req = brand.requirement;
  const team = brand.team || [];
  const cities = (brand.estate.top || []).map(t => t[0]);
  const lo = (brand.lastOpened || "").split("·");
  const loPlace = (lo[1] || "").trim();
  const loMonth = ((lo[0] || "").trim().split(" ").slice(1).join(" ")) || "2026";
  const locs = req ? req.locations : cities;
  const events = [
    { k: "open", d: "Sep 2026", t: `Signs for ${req ? req.sizeSeen : "a new"} unit at ${locs[0] || cities[0] || "a prime scheme"}` },
    { k: "open", d: loMonth, t: `New ${loPlace || cities[0] || "regional"} store now trading` },
    { k: "open", d: "Apr 2026", t: `Confirmed for ${locs[1] || cities[1] || "a new city-centre scheme"}` },
    { k: "close", d: "Feb 2026", t: `Exits smaller ${cities[cities.length - 1] || "regional"} site ahead of relocation` },
  ];
  const globe = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/></svg>;
  return (
    <div className="ud-inner" data-screen-label="Directory · brand" style={{ width: "min(1480px, 100%)", padding: "16px 30px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <button className="ud-back uw-click" onClick={onBack}><span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><AIco name="chevright" size={14}/></span>Back</button>
        <span className="ud-crumb">Directory<AIco name="chevright" size={11}/>Brands<AIco name="chevright" size={11}/><b>{brand.name}</b></span>
      </div>

      <div className="oc-wrap">
        {/* hero */}
        <div className="oc-panel oc-hero">
          <DirAvatar initials={brand.initials} color={brand.color} size={54} radius={14}/>
          <div style={{ minWidth: 0 }}>
            <div className="oc-hname">{brand.name}
              {brand.website && <a href={`https://${brand.website}`} target="_blank" rel="noopener" title={brand.website} aria-label="Company website">{globe}</a>}
            </div>
            <div className="oc-htags">
              <span className="oc-pill sector">{brand.sector}</span>
              {req && <span className="oc-pill">{req.useClass}</span>}
              {req && <DirReqPill status={req.status}/>}
            </div>
          </div>
          <div className="oc-hstats">
            {[[brand.ukStores.toLocaleString(), "UK stores"], [brand.hq, "Head office"], [String(brand.since), "Operating since"]].map((s, i) => (
              <div key={i} className="oc-hstat"><div className="v">{s[0]}</div><div className="k">{s[1]}</div></div>
            ))}
          </div>
        </div>

        {/* requirement + map */}
        <div className="oc-main">
          <section className="oc-panel">
            <OcHd title="Expansion requirement"/>
            <div className="oc-pbody">
              {req ? (
                <React.Fragment>
                  <div className="oc-rtiles">
                    <div className="oc-tile">
                      <div className="oc-tlabel">Stated requirement</div>
                      <div className="oc-tval">{req.size.replace(" sq ft", "")}<span className="u">sq ft</span></div>
                    </div>
                    <div className="oc-tile seen">
                      <div className="oc-tlabel ours"><AIco name="check" size={12} color="var(--acc-deep)"/>Size seen in market</div>
                      <div className="oc-tval">{(req.sizeSeen || "").replace(" sq ft", "")}<span className="u">sq ft</span></div>
                      <div className="oc-tsrc"><b>Basis:</b> {req.sizeSeenBasis}</div>
                    </div>
                  </div>
                  {req.summary && <p className="oc-summary">{req.summary}</p>}
                  <div className="oc-rmeta">
                    <div><span className="k">Listing</span><span className="v">{req.listing || "Leasehold"}</span></div>
                    <div><span className="k">Use class</span><span className="v">{req.useClass}</span></div>
                    <div><span className="k">Verified</span><span className="v">{req.verified}</span></div>
                  </div>
                  {req.brochure && (
                    <a className="oc-broc-btn uw-click" href="#" target="_blank" rel="noopener">
                      <span className="l">
                        <span className="doc"><AIco name="doc" size={14} color="#fff"/></span>
                        <span>View requirement brochure<span className="sub">PDF · VERIFIED {(req.verified || "").toUpperCase()}</span></span>
                      </span>
                      <AIco name="chevright" size={16} color="#fff"/>
                    </a>
                  )}
                  {req.locations.length > 0 && (
                    <React.Fragment>
                      <div className="oc-loclabel">Target locations</div>
                      <div className="oc-lchips">{req.locations.map((l, i) => <span key={i} className="um-loctag">{l}</span>)}</div>
                    </React.Fragment>
                  )}
                </React.Fragment>
              ) : (
                <div style={{ padding: "22px 0", textAlign: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: SS.bg, border: `1px solid ${SS.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", color: SS.ink4 }}><AIco name="doc" size={18}/></div>
                  <div style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 600, color: SS.ink, marginTop: 10 }}>No requirement on file</div>
                  <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink3, marginTop: 4, maxWidth: 340, marginInline: "auto", lineHeight: 1.55 }}>{brand.name} hasn't published a live requirement — contact the team below to register interest or request their acquisition criteria.</div>
                </div>
              )}
            </div>
          </section>

          <OccMap brand={brand}/>
        </div>

        {/* contacts band */}
        <section className="oc-panel">
          <OcHd title="Key contacts" right={<span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink3 }}>{team.length} in-house · {agents.length} agent{agents.length === 1 ? "" : "s"}</span>}/>
          <div className="oc-pbody">
            <div className="oc-cgrid">
              {team.map((p, i) => (
                <OcContact key={`t${i}`} name={p.name} label="In-house" role={`${p.role} · ${brand.name}`} email={p.email} phone={p.phone} linkText="LinkedIn profile"/>
              ))}
              {agents.map(a => (
                <OcContact key={a.id} name={a.name} label={`Agent · ${a.firm}`} agent role={`${a.role} · acting for ${brand.name}`} email={a.email} phone={a.phone} onClick={() => onAgent(a)} linkText="View agent profile"/>
              ))}
            </div>
          </div>
        </section>

        {/* activity band */}
        <section className="oc-panel">
          <OcHd title="Recent & upcoming activity"/>
          <div className="oc-pbody">
            <div className="oc-feed">
              {events.map((e, i) => (
                <div className="oc-event" key={i} style={{ borderTopColor: e.k === "open" ? SS.ok : "#DC2626" }}>
                  <div className="oc-etop">
                    <span className="oc-etype" style={e.k === "open" ? { background: "#DCFCE7", color: "#15803D" } : { background: "#FEE2E2", color: "#DC2626" }}>{e.k === "open" ? "Opening" : "Closure"}</span>
                    <span className="oc-edate">{e.d}</span>
                  </div>
                  <a className="oc-ehead2" href="#" target="_blank" rel="noopener">{e.t} <span style={{ color: SS.ink4 }}>↗</span></a>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

/* ---- Agent detail ------------------------------------------------------ */
const DirAgentDetail = ({ agent, onBack, onBrand }) => {
  const brands = dirAgentBrands(agent.id);
  return (
    <div className="ud-inner" data-screen-label="Directory · agent">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="ud-back uw-click" onClick={onBack}><span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><AIco name="chevright" size={14}/></span>Back</button>
        <span className="ud-crumb">Directory<AIco name="chevright" size={11}/>Agents<AIco name="chevright" size={11}/><b>{agent.name}</b></span>
      </div>

      {/* hero */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 18, marginBottom: 22 }}>
        <DirAvatar initials={agent.initials} color={agent.color} size={64}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontFamily: "Inter", fontSize: 27, fontWeight: 600, color: SS.ink, letterSpacing: -0.7 }}>{agent.name}</h2>
          <div style={{ fontFamily: "Inter", fontSize: 13.5, color: SS.ink2, marginTop: 4 }}>{agent.role} · <strong style={{ color: SS.ink }}>{agent.firm}</strong></div>
          <div style={{ display: "flex", gap: 26, marginTop: 16, flexWrap: "wrap" }}>
            {[[brands.length, "Brands acting for"], [agent.region, "Coverage"], [agent.focus, "Specialism"]].map((s, i) => (
              <div key={i} className="ud-stat"><div className="v" style={{ fontSize: 18 }}>{s[0]}</div><div className="k">{s[1]}</div></div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <a href={`mailto:${agent.email}`} className="uw-click" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 9, textDecoration: "none",
              border: "1px solid var(--acc)", background: "var(--acc)", color: "#fff", fontFamily: "Inter", fontSize: 13, fontWeight: 600 }}>
              <AIco name="doc" size={14} color="#fff"/>{agent.email}
            </a>
            <a href={`tel:${agent.phone.replace(/\s/g, "")}`} className="uw-click" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 9, textDecoration: "none",
              border: `1px solid ${SS.border}`, background: SS.surface, color: SS.ink, fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 500 }}>
              {agent.phone}
            </a>
          </div>
        </div>
      </div>

      <DirPanel title={`Represents ${brands.length} brand${brands.length === 1 ? "" : "s"}`} count={brands.length}>
        <div style={{ padding: 14 }}>
          <div className="ud-grid">
            {brands.map(b => <DirBrandCard key={b.id} brand={b} onOpen={onBrand}/>)}
          </div>
        </div>
      </DirPanel>
    </div>
  );
};

/* ---- Root (card grid + tabs) ------------------------------------------ */
const DirRoot = ({ tab, onTab, onBrand, onAgent }) => {
  const [q, setQ] = React.useState("");
  const qq = q.trim().toLowerCase();
  const tabs = [
    { id: "brands", label: "Brands", n: U_DIR_BRANDS.length },
    { id: "agents", label: "Agents", n: U_DIR_AGENTS.length },
    { id: "team",   label: "In-house teams", n: U_DIR_TEAM.length },
  ];
  const brands = U_DIR_BRANDS.filter(b => !qq || `${b.name} ${b.sector}`.toLowerCase().includes(qq));
  const agents = U_DIR_AGENTS.filter(a => !qq || `${a.name} ${a.firm} ${a.focus}`.toLowerCase().includes(qq));
  const team = U_DIR_TEAM.filter(p => !qq || `${p.name} ${p.role} ${p.brandName}`.toLowerCase().includes(qq));
  const count = tab === "brands" ? brands.length : tab === "agents" ? agents.length : team.length;

  return (
    <div className="ud-inner" data-screen-label="Directory">
      <div style={{ marginBottom: 18 }}>
        <UKicker color="var(--acc-deep)">Directory</UKicker>
        <h2 style={{ margin: "5px 0 0", fontFamily: "Inter", fontSize: 25, fontWeight: 600, color: SS.ink, letterSpacing: -0.6 }}>Brands, teams &amp; agents</h2>
        <div style={{ fontFamily: "Inter", fontSize: 13.5, color: SS.ink2, marginTop: 6, lineHeight: 1.55, maxWidth: 560 }}>
          Browse everyone in the market and see how they connect — a brand's in-house expansion team, the agents acting for them, and their live store estate and requirements.
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div className="ud-seg">
          {tabs.map(t => (
            <button key={t.id} className={tab === t.id ? "on uw-click" : "uw-click"} onClick={() => { onTab(t.id); }}>
              {t.label}<span className="n">{t.n}</span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 220, maxWidth: 340, marginLeft: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 12px", height: 40, background: SS.surface, border: `1px solid ${SS.border}`, borderRadius: 10 }}>
            <Ico name="search" size={14} color={SS.ink3}/>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${tab === "team" ? "people" : tab}…`}
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "Inter", fontSize: 13, color: SS.ink, minWidth: 0 }}/>
          </div>
        </div>
      </div>

      {count === 0 ? (
        <div style={{ padding: "48px 16px", textAlign: "center", borderRadius: 14, border: `1px dashed ${SS.border}`, background: SS.surface }}>
          <div style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 600, color: SS.ink }}>No matches for “{q}”</div>
          <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink3, marginTop: 4 }}>Try a different name, sector or firm.</div>
        </div>
      ) : (
        <div className="ud-grid">
          {tab === "brands" && brands.map(b => <DirBrandCard key={b.id} brand={b} onOpen={onBrand}/>)}
          {tab === "agents" && agents.map(a => <DirAgentCard key={a.id} agent={a} onOpen={onAgent}/>)}
          {tab === "team"   && team.map(p => <DirTeamCard key={p.id} person={p} onOpen={onBrand}/>)}
        </div>
      )}
    </div>
  );
};

/* ---- Workspace shell (nav stack) -------------------------------------- */
const DirectoryWorkspace = () => {
  const [tab, setTab] = React.useState("brands");
  const [stack, setStack] = React.useState([]); // [{kind:'brand'|'agent', id}]
  const scrollRef = React.useRef(null);
  const node = stack[stack.length - 1] || null;

  const toTop = () => { if (scrollRef.current) scrollRef.current.scrollTop = 0; };
  const push = (n) => { setStack(s => [...s, n]); toTop(); };
  const openBrand = (b) => push({ kind: "brand", id: b.id });
  const openAgent = (a) => push({ kind: "agent", id: a.id });
  const back = () => { setStack(s => s.slice(0, -1)); toTop(); };
  const onTab = (t) => { setTab(t); setStack([]); toTop(); };

  return (
    <div className="ud-wrap" ref={scrollRef}>
      <style>{UD_STYLE}</style>
      {node == null && <DirRoot tab={tab} onTab={onTab} onBrand={openBrand} onAgent={openAgent}/>}
      {node && node.kind === "brand" && <DirBrandDetail brand={U_DIR_BRAND_BY_ID[node.id]} onBack={back} onAgent={openAgent}/>}
      {node && node.kind === "agent" && <DirAgentDetail agent={U_DIR_AGENT_BY_ID[node.id]} onBack={back} onBrand={openBrand}/>}
    </div>
  );
};

Object.assign(window, { DirectoryWorkspace });
