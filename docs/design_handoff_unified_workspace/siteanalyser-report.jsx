/* SiteAnalyser — report content: data model, summary header, census sections
   & tables with UK benchmarks, locked Pro sections, and the LSOA list. */

/* ===== Census data model ===== */
const REPORT_META = { location: "Canterbury, Kent", areas: 139, selected: 139, population: 235652, households: 96637, affluence: 51.2 };

const CENSUS = [
  {
    id: "pop", title: "Population & households", icon: "users", pro: false, open: true,
    rows: [
      { label: "Total population", count: "235,652", pct: null, uk: null, plain: "—" },
      { label: "Households", count: "96,637", pct: null, uk: null, plain: "—" },
      { label: "Avg. household size", count: "2.39", pct: null, uk: null, plain: "2.36 UK" },
      { label: "Population density", count: "412", pct: null, uk: null, plain: "/km² · 434 UK" },
      { label: "Median age", count: "41.2", pct: null, uk: null, plain: "yrs · 40.0 UK" },
    ],
  },
  {
    id: "comp", title: "Household composition", icon: "home", pro: false, open: true,
    rows: [
      { label: "Single family household", count: "61,141", pct: 63.3, uk: 63.3 },
      { label: "One person household", count: "27,692", pct: 28.7, uk: 29.7 },
      { label: "Other household types", count: "7,804", pct: 8.1, uk: 6.9 },
    ],
  },
  {
    id: "accom", title: "Type of accommodation", icon: "home", pro: false, open: true,
    rows: [
      { label: "Detached", count: "31,191", pct: 36.4, uk: 23.3 },
      { label: "Semi-detached", count: "30,892", pct: 36.0, uk: 32.3 },
      { label: "Terraced", count: "18,435", pct: 21.5, uk: 23.3 },
      { label: "Flat / converted", count: "2,330", pct: 2.7, uk: 3.2 },
      { label: "Caravan / temporary", count: "1,121", pct: 1.3, uk: 0.4 },
      { label: "Commercial building", count: "866", pct: 1.0, uk: 1.0 },
    ],
  },
  {
    id: "tenure", title: "Tenure", icon: "wallet", pro: false, open: false,
    rows: [
      { label: "Owned outright", count: "33,330", pct: 34.5, uk: 32.5 },
      { label: "Owned with mortgage", count: "27,141", pct: 28.1, uk: 28.3 },
      { label: "Social rented", count: "16,031", pct: 16.6, uk: 17.1 },
      { label: "Private rented", count: "18,361", pct: 19.0, uk: 20.3 },
      { label: "Shared ownership", count: "1,774", pct: 1.8, uk: 1.8 },
    ],
  },
  {
    id: "age", title: "Age profile", icon: "users", pro: true, open: true,
    rows: [
      { label: "0–15 years", count: "41,860", pct: 17.8, uk: 18.6 },
      { label: "16–24 years", count: "31,816", pct: 13.5, uk: 10.4 },
      { label: "25–44 years", count: "60,043", pct: 25.5, uk: 26.4 },
      { label: "45–64 years", count: "61,041", pct: 25.9, uk: 25.9 },
      { label: "65+ years", count: "40,892", pct: 17.3, uk: 18.7 },
    ],
  },
  {
    id: "econ", title: "Economic activity", icon: "briefcase", pro: true, open: false,
    rows: [
      { label: "Employed full-time", count: "78,420", pct: 41.2, uk: 39.8 },
      { label: "Employed part-time", count: "24,180", pct: 12.7, uk: 13.1 },
      { label: "Self-employed", count: "18,640", pct: 9.8, uk: 10.4 },
      { label: "Unemployed", count: "6,290", pct: 3.3, uk: 3.5 },
      { label: "Full-time students", count: "21,440", pct: 11.3, uk: 6.8 },
      { label: "Retired", count: "39,980", pct: 21.0, uk: 21.7 },
    ],
  },
  {
    id: "quals", title: "Qualifications", icon: "cap", pro: true, open: false,
    rows: [
      { label: "Degree level (L4+)", count: "82,140", pct: 38.1, uk: 33.8 },
      { label: "A-level / L3", count: "36,420", pct: 16.9, uk: 16.9 },
      { label: "GCSE / L1–2", count: "54,280", pct: 25.2, uk: 26.4 },
      { label: "No qualifications", count: "29,640", pct: 13.7, uk: 18.1 },
    ],
  },
  {
    id: "car", title: "Car or van availability", icon: "car", pro: true, open: false,
    rows: [
      { label: "No car or van", count: "21,260", pct: 22.0, uk: 23.5 },
      { label: "1 car or van", count: "40,587", pct: 42.0, uk: 41.7 },
      { label: "2 cars or vans", count: "26,090", pct: 27.0, uk: 25.8 },
      { label: "3+ cars or vans", count: "8,700", pct: 9.0, uk: 9.0 },
    ],
  },
];

/* ===== Report summary header (lives at top of left panel) ===== */
const ReportHeader = ({ meta = REPORT_META, mode = "distance", value = 10, units = "miles", tier = "pro" }) => {
  const catchLabel = mode === "distance" ? `${value} ${units}` : mode === "walk" ? `${value} min walk` : `${value} min drive`;
  return (
    <div style={{ padding: "16px 16px 14px", borderBottom: `1px solid ${SS.borderSoft}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ fontFamily: "Inter", fontSize: 17, fontWeight: 700, color: SS.ink, letterSpacing: -0.3 }}>Demographics report</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: SS.ink3, marginBottom: 14 }}>
        <span style={{ color: SS.ink2 }}>{meta.location}</span>
        <span>·</span><span>{catchLabel}</span>
        <span>·</span><span>{meta.selected} of {meta.areas} areas</span>
      </div>
      {/* Hero metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatCard label="Population" value={meta.population.toLocaleString()} icon="users" tint={SS.violetTintSoft}
          sub={`${meta.households.toLocaleString()} households`}/>
        <StatCard label="Affluence" value={meta.affluence} icon="wallet" accent={SS.ink}
          sub={null}>
          <AffluenceGauge score={meta.affluence} uk={50}/>
        </StatCard>
      </div>
    </div>
  );
};

/* ===== A single census table ===== */
const CensusTable = ({ rows }) => (
  <div>
    {/* header */}
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 60px 116px", alignItems: "center", padding: "0 16px 6px", gap: 8 }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: SS.ink4, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: 600 }}>Category</span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: SS.ink4, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: 600, textAlign: "right" }}>Count</span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: SS.ink4, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: 600, textAlign: "right" }}>Share · vs UK</span>
    </div>
    {rows.map((r, i) => (
      <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 60px 116px", alignItems: "center", gap: 8, padding: "9px 16px", borderTop: `1px solid ${SS.borderSoft}` }}>
        <span style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: SS.ink2, textAlign: "right" }}>{r.count}</span>
        {r.pct == null ? (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: SS.ink3, textAlign: "right" }}>{r.plain}</span>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            <BenchmarkBar pct={r.pct} ukPct={r.uk} width={48}/>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: SS.ink, fontWeight: 600, width: 36, textAlign: "right" }}>{r.pct}%</span>
            <span style={{ width: 40, display: "flex", justifyContent: "flex-end" }}><Delta value={r.pct - r.uk}/></span>
          </div>
        )}
      </div>
    ))}
  </div>
);

/* ===== Collapsible census section (locks for free on pro-only data) ===== */
const CensusSection = ({ section, tier = "pro" }) => {
  const locked = section.pro && tier !== "pro";
  const open = locked ? true : section.open;
  return (
    <div style={{ borderBottom: `1px solid ${SS.borderSoft}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", cursor: "pointer" }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, background: locked ? SS.bg : SS.violetTintSoft, color: locked ? SS.ink4 : SS.violet, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <AIco name={section.icon} size={14}/>
        </span>
        <span style={{ flex: 1, fontFamily: "Inter", fontSize: 13.5, fontWeight: 600, color: locked ? SS.ink3 : SS.ink, letterSpacing: -0.1 }}>{section.title}</span>
        {locked ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 999, background: SS.violetTintSoft, color: SS.violetDeep, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>
            <Ico name="lock" size={8}/> Pro
          </span>
        ) : (
          <AIco name={open ? "chevdown" : "chevright"} size={14} color={SS.ink3}/>
        )}
      </div>
      {locked ? (
        <div style={{ position: "relative", padding: "0 16px 16px" }}>
          {/* blurred teaser */}
          <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${SS.borderSoft}` }}>
            <div style={{ filter: "blur(4px)", opacity: 0.5, pointerEvents: "none", padding: "8px 0" }}>
              <CensusTable rows={section.rows}/>
            </div>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(251,250,247,0.4), rgba(251,250,247,0.92))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center", padding: 16 }}>
              <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 600, color: SS.ink }}>{section.title} is a Pro insight</div>
              <div style={{ fontFamily: "Inter", fontSize: 11.5, color: SS.ink3, maxWidth: 240, lineHeight: 1.5 }}>Unlock the full census — age, employment, qualifications, car ownership & more.</div>
              <button style={{ marginTop: 2, padding: "8px 14px", borderRadius: 8, cursor: "pointer", background: SS.violet, color: "#FFF", border: `1px solid ${SS.violet}`, fontFamily: "Inter", fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Ico name="sparkle" size={12}/> Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      ) : open ? (
        <div style={{ paddingBottom: 12 }}>
          <CensusTable rows={section.rows}/>
        </div>
      ) : null}
    </div>
  );
};

/* ===== Save report bar (tier-aware) ===== */
const SaveReportBar = ({ tier = "pro" }) => (
  <div style={{ padding: 16, borderTop: `1px solid ${SS.borderSoft}`, display: "flex", flexDirection: "column", gap: 8, background: SS.surface }}>
    {tier === "pro" ? (
      <React.Fragment>
        <SSButton variant="violet" icon="save" size="md" full>Save report</SSButton>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <SSButton variant="ghost" icon="download" size="sm" full>Export</SSButton>
          <SSButton variant="ghost" icon="share" size="sm" full>Share</SSButton>
        </div>
      </React.Fragment>
    ) : (
      <button style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 16px", borderRadius: 9, cursor: "pointer", color: "#FFF", background: SS.violet, border: `1px solid ${SS.violet}`, fontFamily: "Inter", fontSize: 13.5, fontWeight: 600, boxShadow: `0 0 0 3px ${SS.violetTintSoft}` }}>
        <Ico name="sparkle" size={14}/> Upgrade to save & export
      </button>
    )}
  </div>
);

Object.assign(window, {
  REPORT_META, CENSUS, ReportHeader, CensusTable, CensusSection, SaveReportBar,
});
