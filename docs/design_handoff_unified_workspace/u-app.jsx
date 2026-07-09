/* GapFinder — Unified Workspace · app
   Single workspace: one map, one selection, four tools as tabs. */

const ACCENTS = {
  violet:     { acc: "#7033FF", deep: "#5421CC", soft: "#F5F1FF", tint: "#EEE9FF" },
  restrained: { acc: "#26222C", deep: "#171419", soft: "#F1EFEA", tint: "#E4E0D7" },
};

const U_STYLE = (sa) => `
@keyframes uw-spin { to { transform: rotate(360deg); } }
.uw-spin { animation: uw-spin .7s linear infinite; }
.uw-app { position: absolute; inset: 0; display: grid; grid-template-rows: 56px 1fr;
  background: ${SS.bg}; font-family: Inter, sans-serif; color: ${SS.ink};
  --acc: ${sa.acc}; --acc-deep: ${sa.deep}; --acc-soft: ${sa.soft}; --acc-tint: ${sa.tint}; }
.uw-app *, .uw-app *::before, .uw-app *::after { box-sizing: border-box; }
.uw-chrome { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px;
  padding: 0 16px; background: ${SS.surface}; border-bottom: 1px solid ${SS.border}; z-index: 30; }
.uw-body { display: grid; min-height: 0; position: relative; }

/* rail */
.uw-rail { background: ${SS.surface}; border-right: 1px solid ${SS.border};
  display: flex; flex-direction: column; align-items: center; padding: 10px 8px; gap: 4px; min-height: 0; }
.uw-rail.wide { align-items: stretch; }
.uw-rail-logo { display: flex; justify-content: center; padding: 6px 0 10px; }
.uw-rail-btn { display: flex; align-items: center; justify-content: center; gap: 11px; height: 40px; width: 40px;
  border: none; background: transparent; color: ${SS.ink2}; cursor: pointer; border-radius: 10px; padding: 0; }
.uw-rail.wide .uw-rail-btn { justify-content: flex-start; padding: 0 12px; width: 100%; }
.uw-rail-btn .lab { font-family: Inter; font-size: 13px; font-weight: 500; }
.uw-rail-btn:hover { background: ${SS.borderSoft}; color: ${SS.ink}; }
.uw-rail-btn.on, .uw-rail-btn.on:hover { background: ${SS.ink}; color: #fff; }
.uw-rail-div { height: 1px; background: ${SS.borderSoft}; margin: 6px 6px; }

.uw-left { background: ${SS.surface}; border-right: 1px solid ${SS.border};
  display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.uw-insp { background: ${SS.surface}; border-left: 1px solid ${SS.border};
  display: flex; flex-direction: column; min-height: 0; overflow: hidden; }

.uw-iconbtn { width: 34px; height: 34px; border-radius: 9px; border: 1px solid ${SS.border};
  background: ${SS.surface}; display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; color: ${SS.ink}; flex-shrink: 0; }
.uw-iconbtn:hover { background: ${SS.bg}; }
.uw-filteropt:hover { background: ${SS.bg}; }

/* Per-sidebar collapse/expand handle — a small tab docked to the panel edge */
.uw-edgetoggle { position: absolute; top: 50%; z-index: 40; width: 22px; height: 48px;
  border-radius: 8px; border: 1px solid ${SS.border}; background: ${SS.surface}; color: ${SS.ink2};
  cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;
  box-shadow: 0 6px 16px -10px rgba(20,10,40,.28); transition: background .12s, color .12s; }
.uw-edgetoggle:hover { background: ${SS.bg}; color: ${SS.ink}; }

.uw-tabs { display: flex; gap: 2px; padding: 0 12px; border-bottom: 1px solid ${SS.borderSoft}; flex-shrink: 0; }
.uw-tab { padding: 13px 12px 12px; background: transparent; border: none; cursor: pointer;
  font-family: Inter; font-size: 13.5px; font-weight: 500; color: ${SS.ink3}; position: relative; letter-spacing: -0.1px; }
.uw-tab:hover { color: ${SS.ink}; }
.uw-tab.on { color: ${SS.ink}; font-weight: 600; }
.uw-tab.on::after { content: ''; position: absolute; left: 8px; right: 8px; bottom: -1px; height: 2px; background: var(--acc); border-radius: 2px; }

.uw-click { transition: filter .12s, background .12s; }
.uw-click:hover { filter: brightness(0.97); }
.uw-row:hover { background: ${SS.bg}; }

/* compare */
.uw-tray { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 16px;
  background: ${SS.surface}; border: 1px solid ${SS.border}; border-radius: 14px;
  box-shadow: 0 16px 40px -12px rgba(20,10,40,.22); z-index: 50; max-width: calc(100% - 60px); }
.uw-overlay { position: absolute; inset: 0; background: rgba(23,20,25,.45); z-index: 80;
  display: flex; align-items: center; justify-content: center; padding: 40px; }
.uw-compare { width: min(900px, 100%); max-height: 100%; background: ${SS.bg};
  border-radius: 16px; overflow: hidden; display: flex; flex-direction: column;
  box-shadow: 0 30px 80px -20px rgba(20,10,40,.4); }
.uw-nationtag { padding: 2px 7px; border-radius: 999px; background: #FEF3C7; color: #92400E;
  font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; }
.uw-livetag, .um-livetag { padding: 2px 7px; border-radius: 999px; background: var(--acc-soft); color: var(--acc-deep);
  font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; }
/* Promoted occupier-requirement rows — visually part of the missing-brands
   list (same surface/border as organic rows), marked only by a tag + hairline. */
.uw-sponsortag { padding: 2px 7px; border-radius: 999px; background: var(--acc); color: #fff;
  font-family: 'JetBrains Mono', monospace; font-size: 8.5px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; white-space: nowrap; }
.uw-spon-row { width: 100%; text-align: left; cursor: pointer; display: block; position: relative;
  padding: 11px 12px 11px 14px; border-radius: 11px; background: ${SS.surface};
  border: 1px solid ${SS.border}; box-shadow: inset 3px 0 0 var(--acc); transition: background .12s, border-color .12s; }
.uw-spon-row:hover { border-color: var(--acc); background: var(--acc-soft); }

/* ===== MAP ===== */
.um-map { position: relative; overflow: hidden; min-width: 0;
  background:
    radial-gradient(ellipse 700px 500px at 35% 38%, #ECE6F6 0%, transparent 60%),
    radial-gradient(ellipse 600px 400px at 70% 65%, #F0EBE2 0%, transparent 60%),
    repeating-linear-gradient(0deg, ${SS.borderSoft} 0 1px, transparent 1px 80px),
    repeating-linear-gradient(90deg, ${SS.borderSoft} 0 1px, transparent 1px 80px),
    #F4F1EA; }
.um-map.local { background: #DDE3DA; }
.um-svg { position: absolute; inset: 0; }
.um-dot { position: absolute; width: 6px; height: 6px; border-radius: 999px; background: #2A6FDB; transform: translate(-50%,-50%); }
.um-gap { position: absolute; transform: translate(-50%,-50%); border-radius: 999px; border: 2px solid; cursor: pointer; padding: 0; transition: box-shadow .15s, background .15s; }
.um-gap:hover { background: var(--acc-tint) !important; }
.um-reqdot { position: absolute; width: 11px; height: 11px; background: var(--acc); transform: translate(-50%,-50%) rotate(45deg); border-radius: 2px; border: 1.5px solid #fff; z-index: 5; }
.um-pin { position: absolute; transform: translate(-50%,-100%); filter: drop-shadow(0 4px 8px rgba(40,20,80,.35)); z-index: 8; }
.um-store { position: absolute; width: 11px; height: 11px; border-radius: 999px; border: 2px solid #fff; transform: translate(-50%,-50%); cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,.45); padding: 0; transition: width .12s, height .12s; }
.um-store.sel { width: 17px; height: 17px; box-shadow: 0 0 0 4px var(--acc-soft), 0 1px 4px rgba(0,0,0,.45); }
.um-reqpin { position: absolute; transform: translate(-50%,-50%); cursor: pointer; border: none; background: transparent; padding: 0; filter: drop-shadow(0 2px 4px rgba(0,0,0,.35)); line-height: 0; }
.um-reqpin svg { transition: transform .12s; }
.um-reqpin.sel svg, .uw-app.req-prom .um-reqpin svg { transform: scale(1.3); }
.um-controls { position: absolute; top: 14px; right: 14px; display: flex; flex-direction: column; gap: 8px; z-index: 12; }
.um-ctl { background: rgba(255,255,255,.95); border: 1px solid ${SS.border}; border-radius: 10px; padding: 3px; display: flex; gap: 2px; backdrop-filter: blur(8px); box-shadow: 0 6px 16px -10px rgba(20,10,40,.2); }
.um-ctl.col { flex-direction: column; }
.um-ctl button { padding: 6px 12px; border: none; background: transparent; cursor: pointer; border-radius: 7px; font-family: Inter; font-size: 12px; font-weight: 600; color: ${SS.ink2}; display: inline-flex; align-items: center; justify-content: center; }
.um-ctl button.on { background: ${SS.ink}; color: #fff; }
.um-ctl.col button { width: 34px; height: 34px; padding: 0; color: ${SS.ink}; }
.um-count { position: absolute; bottom: 16px; left: 16px; padding: 8px 12px; border-radius: 999px;
  background: rgba(255,255,255,.95); border: 1px solid ${SS.border}; font-family: 'JetBrains Mono', monospace;
  font-size: 11px; color: ${SS.ink2}; letter-spacing: .4px; text-transform: uppercase; display: inline-flex; align-items: center; gap: 8px; z-index: 11; box-shadow: 0 6px 16px -10px rgba(20,10,40,.2); }
.um-count .dot { width: 7px; height: 7px; border-radius: 999px; background: var(--acc); }
.um-count { white-space: nowrap; }
.um-legend { position: absolute; top: 14px; left: 14px; padding: 8px 12px; border-radius: 9px;
  background: rgba(255,255,255,.94); border: 1px solid ${SS.borderSoft}; display: flex; flex-direction: column; gap: 6px; z-index: 11; box-shadow: 0 4px 12px -6px rgba(20,10,40,.18); }
.um-legend .li { display: flex; align-items: center; gap: 7px; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; color: ${SS.ink2}; letter-spacing: .5px; text-transform: uppercase; }
.um-legend .d { width: 7px; height: 7px; border-radius: 999px; flex-shrink: 0; }
.um-legend .store { background: #2A6FDB; } .um-legend .traffic { background: #F26B1F; }
.um-legend .ring { width: 9px; height: 9px; border-radius: 999px; border: 2px solid var(--acc); background: var(--acc-soft); flex-shrink: 0; }
.um-legend .diamond { width: 9px; height: 9px; background: var(--acc); transform: rotate(45deg); border-radius: 1px; flex-shrink: 0; }
.um-legend .lsoa { width: 9px; height: 9px; border-radius: 2px; background: rgba(112,51,255,.32); border: 1px solid #fff; flex-shrink: 0; }
.um-lsoa { transition: fill .1s; }
.um-lsoa:hover { fill: rgba(112,51,255,0.5) !important; }
.um-scale { position: absolute; bottom: 36px; right: 16px; display: flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: ${SS.ink3}; z-index: 11; }
.um-scale .bar { width: 56px; height: 2px; background: ${SS.ink2}; }
.um-attr { position: absolute; bottom: 12px; right: 16px; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: ${SS.ink3}; background: rgba(255,255,255,.85); padding: 4px 8px; border-radius: 6px; border: 1px solid ${SS.borderSoft}; z-index: 11; }

/* popovers */
.um-pop { position: absolute; z-index: 20; background: ${SS.surface}; border: 1px solid ${SS.border};
  border-radius: 14px; padding: 16px; box-shadow: 0 24px 60px -20px rgba(20,10,40,.3); display: flex; flex-direction: column; gap: 10px;
  max-height: calc(100% - 32px); overflow-y: auto; }
.um-pop-x { position: absolute; top: 12px; right: 12px; width: 26px; height: 26px; border-radius: 7px; border: 1px solid ${SS.border}; background: ${SS.bg}; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: ${SS.ink3}; }
.um-pop-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; padding: 11px 0; border-top: 1px solid ${SS.borderSoft}; border-bottom: 1px solid ${SS.borderSoft}; font-family: Inter; font-size: 13px; color: ${SS.ink}; font-weight: 500; }
.um-pop-grid .k { display: block; font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: ${SS.ink3}; margin-bottom: 3px; font-weight: 600; }
.um-pop-sec { display: flex; flex-direction: column; gap: 8px; }
.um-contact { display: flex; gap: 10px; align-items: flex-start; padding: 10px; border-radius: 9px; background: ${SS.bg}; border: 1px solid ${SS.borderSoft}; }
.um-copy { padding: 5px 10px; border-radius: 6px; border: 1px solid ${SS.border}; background: ${SS.surface}; font-family: Inter; font-size: 12px; font-weight: 500; color: ${SS.ink2}; cursor: pointer; flex-shrink: 0; }
.um-loctag { padding: 4px 9px; border-radius: 6px; background: var(--acc-soft); color: var(--acc-deep); font-family: Inter; font-size: 12px; font-weight: 500; }
.um-loclist { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; max-height: 108px; overflow-y: auto; padding-right: 2px; }
.um-contactlist { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; padding-right: 2px; }
.um-pop-row { display: flex; gap: 8px; }
.um-pop-btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px; border-radius: 8px; border: 1px solid ${SS.border}; background: ${SS.surface}; font-family: Inter; font-size: 12.5px; font-weight: 500; color: ${SS.ink}; cursor: pointer; }
.um-pop-btn.primary { background: var(--acc); color: #fff; border-color: var(--acc); }
.um-cadtag { position: absolute; transform: translate(-50%,-130%); background: ${SS.surface}; border: 1px solid ${SS.border}; border-radius: 8px; padding: 6px 10px; z-index: 8; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 6px 16px -8px rgba(0,0,0,.3); }
.um-drophint { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); z-index: 13;
  display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px 8px 10px; border-radius: 999px;
  background: rgba(255,255,255,.96); border: 1px solid var(--acc-tint); color: ${SS.ink};
  font-family: Inter; font-size: 12.5px; font-weight: 500; white-space: nowrap;
  box-shadow: 0 10px 26px -12px rgba(20,10,40,.3); backdrop-filter: blur(8px);
  animation: uw-drop-in .3s ease; }
.um-drophint-x { display: inline-flex; line-height: 0; }
.um-drophint-x svg { width: 16px; height: 16px; }
@keyframes uw-drop-in { from { opacity: 0; transform: translate(-50%, -6px); } to { opacity: 1; transform: translate(-50%, 0); } }
`;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "nav": "contextual",
  "density": "calm",
  "accent": "violet",
  "reqEmphasis": "subtle"
}/*EDITMODE-END*/;

/* Collapse/expand handle docked to a sidebar's map-side edge. `dir` is the
   direction the chevron points (= the direction the panel would move). */
const UEdgeToggle = ({ style, dir, title, onClick }) => (
  <button className="uw-edgetoggle uw-click" style={style} onClick={onClick} title={title} aria-label={title}>
    <span style={{ display: "inline-flex", transform: dir === "left" ? "rotate(180deg)" : "none" }}>
      <AIco name="chevright" size={14}/>
    </span>
  </button>
);

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const sa = ACCENTS[t.accent] || ACCENTS.violet;
  const gp = t.density === "dense" ? 13 : 18;
  const wide = t.nav === "rail";

  const [view, setView] = React.useState("assess");
  const [area, setArea] = React.useState(null);
  const [tab, setTab] = React.useState("summary");
  const [overlays, setOverlays] = React.useState({ requirements: false, traffic: false, nationwide: true });
  const [selected, setSelected] = React.useState(null); // {type:'store'|'req', id}
  const [reqModal, setReqModal] = React.useState(null);
  const [compare, setCompare] = React.useState([]);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [brandFilter, setBrandFilter] = React.useState(["Allpress Espresso", "Goodhood", "ShakeDown"]);
  const [gapRules, setGapRules] = React.useState([
    { id: "r-seed1", kind: "presence",  type: "category", value: "Grocery",    op: "has" },
    { id: "r-seed2", kind: "presence",  type: "brand",    value: "Greggs",     op: "lacks" },
    { id: "r-seed3", kind: "proximity", type: "fascia",   value: "Asda Local", op: "within", km: 5 },
  ]);
  const [catchment, setCatchment] = React.useState({ mode: "distance", value: 5 });
  const [showLsoa, setShowLsoa] = React.useState(true);
  const [lsoaSel, setLsoaSel] = React.useState({}); // cell id -> explicit selected override
  const [catchStats, setCatchStats] = React.useState({ factor: 1, selCount: 0, totalCount: 0 });
  const [sketch, setSketch] = React.useState({ layer: "select", scheme: "A", cad: null, show: true });
  /* SiteSketcher session: null = launcher (first open). Otherwise the open sketch. */
  const [sketchSession, setSketchSession] = React.useState(null);
  const [leaveTo, setLeaveTo] = React.useState(null); // pending nav blocked by unsaved changes
  const [leftHidden, setLeftHidden] = React.useState(false); // collapse the left panel to widen the map
  const [inspHidden, setInspHidden] = React.useState(false); // collapse the right detail panel

  const reqProm = t.reqEmphasis === "prominent";
  const effOverlays = { ...overlays, requirements: overlays.requirements || reqProm || view === "requirements" };

  const pickArea = (b) => { setArea(b); setTab("summary"); setSelected(null); setReqModal(null); };
  const pickPoint = (a) => { setArea(a); setTab("summary"); setSelected(null); setReqModal(null); };
  const closeArea = () => { setArea(null); setSelected(null); };
  const doMode = (id) => {
    setView(id); setArea(null); setSelected(null); setReqModal(null);
    if (id !== "sketch") setSketchSession(null); // leaving sketch ends the session
  };
  /* guarded mode switch — intercept if there are unsaved sketch changes */
  const onMode = (id) => {
    if (id === "sketch" && view === "sketch") return;
    if (view === "sketch" && sketchSession && sketchSession.status !== "saved") setLeaveTo({ kind: "mode", id });
    else doMode(id);
  };
  const onTool = (id) => { if (area) setTab(id); };
  const toggleOverlay = (k) => setOverlays(o => ({ ...o, [k]: !o[k] }));
  const toggleBrand = (n) => setBrandFilter(f => f.includes(n) ? f.filter(x => x !== n) : [...f, n]);
  const addRule = (r) => setGapRules(rs => [...rs, r]);
  const removeRule = (r) => setGapRules(rs => rs.filter(x => x.id !== r.id));
  const toggleRule = (r) => setGapRules(rs => rs.map(x => x.id !== r.id ? x
    : (x.kind === "presence" ? { ...x, op: x.op === "has" ? "lacks" : "has" } : { ...x, op: x.op === "within" ? "beyond" : "within" })));
  /* catchment LSOA selection — reset when the focus or catchment definition changes */
  React.useEffect(() => { setLsoaSel({}); }, [area && area.id, view, catchment.mode, catchment.value]);
  const toggleLsoa = (id, next) => setLsoaSel(s => ({ ...s, [id]: next }));
  const onLsoaStats = React.useCallback((st) => setCatchStats(prev =>
    (prev.factor === st.factor && prev.selCount === st.selCount && prev.totalCount === st.totalCount) ? prev : st), []);
  const onSelectReq = (r) => {
    if (!r) { setSelected(null); return; }
    if (area && r.scope === "local") setSelected({ type: "req", id: r.id });
    else setReqModal(r);
  };
  const onPickStore = (s) => { setSelected(s ? { type: "store", id: s.id } : null); };
  const onPickReqMap = (r) => { setSelected(r ? { type: "req", id: r.id } : null); };
  const addCompare = (a) => setCompare(c => c.find(x => x.id === a.id) ? c : (c.length >= 3 ? c : [...c, a]));
  const removeCompare = (a) => setCompare(c => c.filter(x => x.id !== a.id));

  /* ---- SiteSketcher session ------------------------------------------- */
  const touchSketch = () => setSketchSession(s => s ? { ...s, status: "editing", dirty: true, rev: (s.rev || 0) + 1 } : s);
  const handleSketch = (next) => { setSketch(next); touchSketch(); };
  const newSketch = () => {
    setArea(null); setSelected(null);
    setSketch({ layer: "plot", scheme: "A", cad: null, show: true });
    setSketchSession({ id: "draft-" + Date.now(), name: "Untitled sketch", status: "editing", dirty: true, savedAt: null, rev: 1, isNew: true });
  };
  const openSketch = (sv) => {
    setArea(U_BUA_BY_ID[(sv.area || "").toLowerCase()] || null); setSelected(null);
    setSketch({ layer: "select", scheme: "A", cad: null, show: true });
    setSketchSession({ id: sv.id, name: sv.name, status: "saved", dirty: false, savedAt: Date.now() - 2 * 60 * 1000, rev: 0, schemes: sv.schemes });
  };
  const renameSketch = (name) => setSketchSession(s => s ? { ...s, name, status: "editing", dirty: true, rev: (s.rev || 0) + 1 } : s);
  const saveSketch = () => {
    setSketchSession(s => s ? { ...s, status: "saving" } : s);
    setTimeout(() => setSketchSession(s => s ? { ...s, status: "saved", dirty: false, savedAt: Date.now() } : s), 650);
  };
  const exitSketch = () => {
    if (sketchSession && sketchSession.status !== "saved") setLeaveTo({ kind: "exit" });
    else { setSketchSession(null); setArea(null); }
  };
  /* leave-guard resolutions */
  const guardCancel = () => setLeaveTo(null);
  const guardProceed = () => {
    const target = leaveTo; setLeaveTo(null);
    if (target && target.kind === "mode") doMode(target.id);
    else { setSketchSession(null); setArea(null); } // exit → back to launcher
  };
  const guardSave = () => {
    setSketchSession(s => s ? { ...s, status: "saved", dirty: false, savedAt: Date.now() } : s);
    guardProceed();
  };

  /* autosave: debounce ~2.5s after the last edit, then saving → saved */
  React.useEffect(() => {
    if (!sketchSession || sketchSession.status !== "editing") return;
    let t2;
    const t1 = setTimeout(() => {
      setSketchSession(s => s ? { ...s, status: "saving" } : s);
      t2 = setTimeout(() => setSketchSession(s => s ? { ...s, status: "saved", dirty: false, savedAt: Date.now() } : s), 850);
    }, 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [sketchSession && sketchSession.status, sketchSession && sketchSession.rev]);

  const sketchMode = view === "sketch";
  const effTab = sketchMode ? "sketch" : tab;
  const scale = (area || sketchMode) ? "local" : "national";
  const mapStyle = effTab === "sketch" ? "satellite" : "streets";

  const hideInsp = view === "assess" && !area;
  const inspW = t.density === "dense" ? 376 : 404;
  const leftW = t.density === "dense" ? 296 : 320;
  const railW = wide ? 172 : 56;
  const showLeft = !leftHidden;
  const showInsp = !hideInsp && !inspHidden;
  const cols = `${railW}px${showLeft ? ` ${leftW}px` : ""} 1fr${showInsp ? ` ${inspW}px` : ""}`;
  const inLauncher = sketchMode && !sketchSession;
  const bodyCols = inLauncher ? `${railW}px 1fr` : cols;

  return (
    <div className={`uw-app${reqProm ? " req-prom" : ""}`}>
      <style>{U_STYLE(sa)}</style>
      <UChrome overlays={effOverlays} onOverlay={toggleOverlay} area={area}/>
      <div className="uw-body" style={{ gridTemplateColumns: bodyCols }}>
        <URail wide={wide} view={view} tab={tab} area={area} onMode={onMode} onTool={onTool}/>
        {inLauncher ? (
          <SketchLauncher saved={U_SAVED} onNew={newSketch} onOpen={openSketch}/>
        ) : (
          <React.Fragment>
        {showLeft && <ULeftPanel
          view={view} area={area} tab={tab} gp={gp}
          overlays={effOverlays} onOverlay={toggleOverlay}
          brandFilter={brandFilter} onBrand={toggleBrand}
          gapRules={gapRules} onAddRule={addRule} onRemoveRule={removeRule} onToggleRule={toggleRule}
          catchment={catchment} onCatchment={setCatchment} catchStats={catchStats}
          sketch={sketch} onSketch={handleSketch}
          session={sketchSession} onRenameSketch={renameSketch} onSaveSketch={saveSketch} onExitSketch={exitSketch}
          saved={U_SAVED} onOpenSaved={(sv) => pickArea(U_BUA_BY_ID[(sv.area || sv.id || "").toLowerCase()] || U_BUA_BY_ID.manchester)}
        />}
        <UnifiedMap
          scale={scale} view={view} tab={effTab} area={area} mapStyle={mapStyle}
          overlays={effOverlays} accent={sa.acc}
          catchment={catchment} sketch={sketch}
          selected={selected}
          showLsoa={showLsoa} lsoaSel={lsoaSel} onToggleLsoa={toggleLsoa} onLsoaStats={onLsoaStats}
          onPickArea={pickArea} onPickStore={onPickStore} onPickReq={onPickReqMap} onPickPoint={pickPoint}
        />
        {showInsp && <UInspector
          area={area} view={view} tab={tab} gp={gp}
          onPick={pickArea} onTab={setTab} onClose={closeArea}
          onCompare={addCompare} inCompare={!!(area && compare.find(x => x.id === area.id))}
          includeNation={overlays.nationwide} onSelectReq={onSelectReq}
          brandFilter={brandFilter} overlays={effOverlays} sketch={sketch} gapRules={gapRules}
          catchment={catchment} catchStats={catchStats}
          lsoaOverlay={showLsoa} onToggleLsoaOverlay={() => setShowLsoa(v => !v)}
          session={sketchSession} onSaveSketch={saveSketch}
        />}
        <UCompareTray items={compare} onOpen={() => setCompareOpen(true)} onClear={() => setCompare([])} onRemove={removeCompare}/>
        {/* Per-sidebar collapse / expand handles, docked to each panel's map-side edge */}
        <UEdgeToggle
          style={{ left: railW + (showLeft ? leftW : 0), transform: "translate(-50%,-50%)" }}
          dir={showLeft ? "left" : "right"}
          title={showLeft ? "Hide left panel" : "Show left panel"}
          onClick={() => setLeftHidden(v => !v)}
        />
        {!hideInsp && <UEdgeToggle
          style={{ right: showInsp ? inspW : 0, transform: "translate(50%,-50%)" }}
          dir={showInsp ? "right" : "left"}
          title={showInsp ? "Hide detail panel" : "Show detail panel"}
          onClick={() => setInspHidden(v => !v)}
        />}
          </React.Fragment>
        )}
        {compareOpen && compare.length > 0 && <UComparePanel items={compare} onClose={() => setCompareOpen(false)}/>}
        {reqModal && <UReqModal r={reqModal} onClose={() => setReqModal(null)}/>}
        {leaveTo && sketchSession && <LeaveGuardModal name={sketchSession.name} onSave={guardSave} onDiscard={guardProceed} onCancel={guardCancel}/>}
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Integration">
          <TweakRadio label="Navigation" value={t.nav} options={[{ value: "contextual", label: "Contextual" }, { value: "rail", label: "Mode rail" }]} onChange={v => setTweak("nav", v)}/>
        </TweakSection>
        <TweakSection label="Layout">
          <TweakRadio label="Density" value={t.density} options={[{ value: "calm", label: "Calm" }, { value: "dense", label: "Dense" }]} onChange={v => setTweak("density", v)}/>
        </TweakSection>
        <TweakSection label="Theme">
          <TweakRadio label="Accent" value={t.accent} options={[{ value: "violet", label: "Violet" }, { value: "restrained", label: "Restrained" }]} onChange={v => setTweak("accent", v)}/>
        </TweakSection>
        <TweakSection label="Requirements">
          <TweakRadio label="Emphasis" value={t.reqEmphasis} options={[{ value: "subtle", label: "Subtle" }, { value: "prominent", label: "Prominent" }]} onChange={v => setTweak("reqEmphasis", v)}/>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

/* Centered requirement detail (nationwide / browse) */
const UReqModal = ({ r, onClose }) => (
  <div className="uw-overlay" onClick={onClose}>
    <div style={{ width: "min(440px,100%)", background: SS.surface, borderRadius: 16, padding: 24, boxShadow: "0 30px 80px -20px rgba(20,10,40,.4)", display: "flex", flexDirection: "column", gap: 12 }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <UBrandLogo brand={r} size={48} radius={11}/>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontFamily: "Inter", fontSize: 19, fontWeight: 600, color: SS.ink, letterSpacing: -0.3 }}>{r.brand}</div>
            {r.scope === "nationwide" && <span className="uw-nationtag">Nationwide</span>}
          </div>
          <UKicker color="var(--acc-deep)">{r.sector}</UKicker>
        </div>
        <button className="uw-iconbtn uw-click" onClick={onClose}><Ico name="close" size={14}/></button>
      </div>
      <div style={{ fontFamily: "Inter", fontSize: 13.5, color: SS.ink2, lineHeight: 1.55 }}>{r.summary}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px", padding: "14px 0", borderTop: `1px solid ${SS.borderSoft}`, borderBottom: `1px solid ${SS.borderSoft}` }}>
        <KV k="Size wanted" v={r.size}/><KV k="Use class" v={r.useClass}/>
        <KV k="Listing" v={r.listing}/><KV k="Verified" v={r.verified}/>
      </div>
      <div>
        <UKicker>Wants to be in</UKicker>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {r.locations.map((l, i) => <span key={i} className="um-loctag">{l}</span>)}
        </div>
      </div>
      <div style={{ padding: 14, borderRadius: 12, background: SS.bg, border: `1px solid ${SS.borderSoft}`, display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ width: 40, height: 40, borderRadius: 999, background: "var(--acc)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter", fontWeight: 600 }}>{r.contact.name[0]}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 600, color: SS.ink }}>{r.contact.name}</div>
          <div style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink3 }}>{r.contact.role} · {r.contact.org}</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink2, marginTop: 3 }}>{r.contact.email} · {r.contact.phone}</div>
        </div>
      </div>
      <div className="um-pop-row">
        {r.brochure && <button className="um-pop-btn"><Ico name="doc" size={13}/> Brochure</button>}
        <button className="um-pop-btn primary"><AIco name="users" size={13}/> Contact</button>
      </div>
    </div>
  </div>
);

Object.assign(window, { App });

/* Scale the 1440×900 desktop workspace to fit any viewport (letterboxed). */
function Stage() {
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1440, window.innerHeight / 900));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0E0B12", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 1440, height: 900, position: "relative", flex: "none", transform: `scale(${scale})`, transformOrigin: "center center", boxShadow: "0 24px 90px rgba(0,0,0,.5)", borderRadius: scale < 0.999 ? 6 : 0, overflow: "hidden" }}>
        <App/>
      </div>
    </div>
  );
}

Object.assign(window, { Stage });
