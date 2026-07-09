/* GapFinder — Unified Workspace · SiteSketcher session
   The launcher shown when sketch mode is first opened (start new / open saved),
   the in-session header (inline rename + autosave status), and the leave guard
   that catches an exit with unsaved changes. All atoms (SS, Ico, AIco, UKicker,
   UGhostBtn, UPrimaryBtn) come from the shared cores / panels. */

/* relative "x ago" from a timestamp */
const fmtAgo = (ts) => {
  if (!ts) return "not yet";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

/* ---- autosave status chip ---------------------------------------------- */
const AutosaveChip = ({ status, savedAt }) => {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (status !== "saved") return;
    const id = setInterval(() => setTick(n => n + 1), 15000);
    return () => clearInterval(id);
  }, [status, savedAt]);

  let label, fg, bg, glyph;
  if (status === "saving") {
    label = "Saving…"; fg = SS.ink2; bg = SS.bg;
    glyph = <span className="uw-spin" style={{ width: 9, height: 9, borderRadius: 999, border: `1.5px solid ${SS.border}`, borderTopColor: SS.ink2, display: "inline-block" }}/>;
  } else if (status === "editing") {
    label = "Unsaved changes"; fg = "#92400E"; bg = "#FEF3C7";
    glyph = <span style={{ width: 6, height: 6, borderRadius: 999, background: "#D97706" }}/>;
  } else {
    label = `Saved · ${fmtAgo(savedAt)}`; fg = "#15803D"; bg = "#E7F5EC";
    glyph = <Ico name="check" size={10} color="#15803D"/>;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 9px", borderRadius: 999, background: bg,
      fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: fg, whiteSpace: "nowrap" }}>
      {glyph}{label}
    </span>
  );
};

/* ---- in-session header: name (inline edit) + autosave + actions -------- */
const SketchSessionBar = ({ session, gp, onRename, onSave, onExit }) => {
  const editable = !!onRename;
  return (
    <div style={{ padding: `${gp - 2}px ${gp}px ${gp - 4}px`, borderBottom: `1px solid ${SS.borderSoft}`, display: "flex", flexDirection: "column", gap: 11, flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <button className="uw-click" onClick={onExit} title="Back to your sketches" style={{
          display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", cursor: "pointer", padding: 0,
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: SS.ink3 }}>
          <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><AIco name="chevright" size={12} color={SS.ink3}/></span>
          Sketches
        </button>
        <AutosaveChip status={session.status} savedAt={session.savedAt}/>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 28, height: 28, borderRadius: 7, background: "var(--acc-soft)", color: "var(--acc-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico name="polygon" size={15}/></span>
        <input
          value={session.name}
          onChange={e => editable && onRename(e.target.value)}
          spellCheck={false}
          aria-label="Sketch name"
          style={{ flex: 1, minWidth: 0, border: "1px solid transparent", outline: "none", background: "transparent",
            fontFamily: "Inter", fontSize: 17, fontWeight: 600, color: SS.ink, letterSpacing: -0.3, padding: "3px 7px", borderRadius: 7 }}
          onFocus={e => { e.target.style.borderColor = SS.border; e.target.style.background = SS.bg; }}
          onBlur={e => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }}
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="uw-click" onClick={onSave} disabled={session.status === "saved"} style={{
          flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "8px 12px", borderRadius: 9,
          border: `1px solid ${session.status === "saved" ? SS.border : "var(--acc)"}`,
          background: session.status === "saved" ? SS.surface : "var(--acc)",
          color: session.status === "saved" ? SS.ink3 : "#fff",
          fontFamily: "Inter", fontSize: 12.5, fontWeight: 600, cursor: session.status === "saved" ? "default" : "pointer" }}>
          <Ico name="save" size={13}/>{session.status === "saved" ? "Saved" : "Save now"}
        </button>
        <UGhostBtn icon="share" onClick={() => {}}>Share</UGhostBtn>
      </div>
    </div>
  );
};

/* ---- launcher: first thing you see in sketch mode ---------------------- */
const SketchLauncher = ({ saved, onNew, onOpen }) => {
  const [q, setQ] = React.useState("");
  const sketches = saved.filter(s => s.kind === "sketch");
  const list = sketches.filter(s => !q.trim() || `${s.name} ${s.area}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div data-screen-label="Sketch launcher" style={{ position: "relative", minHeight: 0, overflow: "auto", background: SS.bg,
      backgroundImage: "radial-gradient(ellipse 760px 460px at 50% -8%, var(--acc-soft) 0%, transparent 62%)" }}>
      <div style={{ width: "min(660px, 100%)", margin: "0 auto", padding: "60px 32px 48px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* heading */}
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <span style={{ width: 52, height: 52, borderRadius: 14, background: "var(--acc)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 30px -10px var(--acc)" }}><Ico name="polygon" size={24}/></span>
          <div>
            <UKicker color="var(--acc-deep)">SiteSketcher</UKicker>
            <div style={{ fontFamily: "Inter", fontSize: 27, fontWeight: 600, color: SS.ink, letterSpacing: -0.6, marginTop: 4 }}>Sketch a site on the map</div>
            <div style={{ fontFamily: "Inter", fontSize: 13.5, color: SS.ink2, marginTop: 6, lineHeight: 1.55, maxWidth: 420, marginInline: "auto" }}>Draw plots, test parking and drop CAD plans on any parcel. Start fresh, or pick up a sketch you saved earlier.</div>
          </div>
        </div>

        {/* start new — primary card */}
        <button className="uw-click" onClick={onNew} style={{
          display: "flex", alignItems: "center", gap: 16, textAlign: "left", cursor: "pointer", width: "100%",
          padding: "18px 20px", borderRadius: 16, border: "1px solid var(--acc)", background: "var(--acc)", color: "#fff",
          boxShadow: "0 18px 44px -20px var(--acc)" }}>
          <span style={{ width: 44, height: 44, borderRadius: 11, background: "rgba(255,255,255,.18)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico name="plus" size={22} color="#fff"/></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Inter", fontSize: 16, fontWeight: 600, letterSpacing: -0.2 }}>Start a new sketch</div>
            <div style={{ fontFamily: "Inter", fontSize: 12.5, opacity: 0.85, marginTop: 2 }}>Blank parcel — search a location and start drawing</div>
          </div>
          <AIco name="chevright" size={18} color="#fff"/>
        </button>

        {/* open saved */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <UKicker>Or open a saved sketch · {sketches.length}</UKicker>
            <span style={{ flex: 1, height: 1, background: SS.borderSoft }}/>
          </div>

          {sketches.length > 3 && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 12px", height: 38, background: SS.surface, border: `1px solid ${SS.border}`, borderRadius: 10 }}>
              <Ico name="search" size={14} color={SS.ink3}/>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search your sketches…"
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "Inter", fontSize: 13, color: SS.ink, minWidth: 0 }}/>
            </div>
          )}

          {list.length === 0 ? (
            <div style={{ padding: "30px 16px", textAlign: "center", borderRadius: 12, border: `1px dashed ${SS.border}`, background: SS.surface }}>
              <div style={{ fontFamily: "Inter", fontSize: 13.5, fontWeight: 600, color: SS.ink }}>{q ? `No sketches match “${q}”` : "No saved sketches yet"}</div>
              <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink3, marginTop: 4 }}>{q ? "Try a different name or town." : "Start a new sketch above — it'll save here automatically."}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {list.map(sv => (
                <button key={sv.id} className="uw-click" onClick={() => onOpen(sv)} style={{
                  display: "flex", alignItems: "center", gap: 13, textAlign: "left", cursor: "pointer", width: "100%",
                  padding: "13px 15px", borderRadius: 13, border: `1px solid ${SS.border}`, background: SS.surface }}>
                  <span style={{ width: 38, height: 38, borderRadius: 9, background: "var(--acc-soft)", color: "var(--acc-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico name="polygon" size={17}/></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 600, color: SS.ink, letterSpacing: -0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sv.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, letterSpacing: 0.3 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Ico name="pin" size={10} color={SS.ink4}/>{sv.area}</span>
                      <span>·</span><span>{sv.schemes} scheme{sv.schemes === 1 ? "" : "s"}</span>
                      <span>·</span><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AIco name="clock" size={10} color={SS.ink4}/>{sv.updated}</span>
                    </div>
                  </div>
                  <AIco name="chevright" size={15} color={SS.ink4}/>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 4, fontFamily: "Inter", fontSize: 12, color: SS.ink3 }}>
          <AIco name="clock" size={13} color={SS.ink4}/>
          Sketches autosave as you work — your progress is kept safe.
        </div>
      </div>
    </div>
  );
};

/* ---- leave guard: unsaved changes on the way out ----------------------- */
const LeaveGuardModal = ({ name, onSave, onDiscard, onCancel }) => {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="uw-overlay" onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(420px, 100%)", background: SS.surface, borderRadius: 16, padding: 24,
        boxShadow: "0 30px 80px -20px rgba(20,10,40,.4)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
          <span style={{ width: 42, height: 42, borderRadius: 11, background: "#FEF3C7", color: "#92400E", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico name="save" size={19}/></span>
          <div>
            <div style={{ fontFamily: "Inter", fontSize: 18, fontWeight: 600, color: SS.ink, letterSpacing: -0.3 }}>Save your sketch?</div>
            <div style={{ fontFamily: "Inter", fontSize: 13, color: SS.ink2, lineHeight: 1.55, marginTop: 6 }}>
              You have unsaved changes to <strong style={{ color: SS.ink }}>“{name}”</strong>. Save them before you leave, or discard them and lose your latest edits.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 2 }}>
          <UPrimaryBtn icon="save" full onClick={onSave}>Save &amp; leave</UPrimaryBtn>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <UGhostBtn full onClick={onCancel}>Keep editing</UGhostBtn>
            <UGhostBtn icon="trash" danger full onClick={onDiscard}>Discard</UGhostBtn>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { fmtAgo, AutosaveChip, SketchSessionBar, SketchLauncher, LeaveGuardModal });
