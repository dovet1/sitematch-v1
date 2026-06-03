/* SiteSketcher — modal & flow screens. Each renders a full app shell with a dimmed
   overlay + modal on top. */

const SSScrim = ({ children }) => (
  <div style={{
    position: "absolute", inset: 0, zIndex: 50,
    background: "rgba(20, 14, 34, 0.45)", backdropFilter: "blur(2px)",
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    {children}
  </div>
);

const SSModal = ({ width = 460, title, subtitle, onClose, children, footer }) => (
  <div style={{
    width, background: SS.surface, borderRadius: 16,
    border: `1px solid ${SS.border}`,
    boxShadow: "0 40px 80px -20px rgba(20,10,40,0.4), 0 0 0 1px rgba(0,0,0,0.04)",
    overflow: "hidden", display: "flex", flexDirection: "column",
  }}>
    <div style={{
      padding: "18px 22px", borderBottom: `1px solid ${SS.borderSoft}`,
      display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "Inter", fontSize: 17, fontWeight: 600, color: SS.ink, letterSpacing: -0.2 }}>{title}</div>
        {subtitle && <div style={{ fontFamily: "Inter", fontSize: 13, color: SS.ink3, marginTop: 3, lineHeight: 1.5 }}>{subtitle}</div>}
      </div>
      <button onClick={onClose} style={{
        background: "transparent", border: "none", cursor: "pointer",
        padding: 6, borderRadius: 7, color: SS.ink3,
      }}>
        <Ico name="close" size={14}/>
      </button>
    </div>
    <div style={{ padding: 22, flex: 1, overflow: "auto" }}>{children}</div>
    {footer && (
      <div style={{
        padding: "14px 22px", borderTop: `1px solid ${SS.borderSoft}`, background: SS.bg,
        display: "flex", justifyContent: "flex-end", gap: 8,
      }}>{footer}</div>
    )}
  </div>
);

/* === Save flow — first-time save modal === */
const StateSaveFlow = ({ width, height, units = "metric" }) => (
  <div style={{ width, height, position: "relative" }}>
    <StateSelected width={width} height={height} units={units}/>
    <SSScrim>
      <SSModal
        width={520}
        title="Save sketch"
        subtitle="Give your sketch a name. We'll remember the map location, polygons, parking and CAD."
        footer={
          <React.Fragment>
            <SSButton variant="ghost" size="md">Cancel</SSButton>
            <SSButton variant="violet" size="md" icon="save">Save sketch</SSButton>
          </React.Fragment>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SSField label="Name">
            <SSInput value="Abbeyville Retail Park" placeholder="e.g. Bristol Drive-thru"/>
          </SSField>
          <SSField label="Folder" hint="Drop into any folder to keep things tidy">
            <div style={{
              padding: "10px 12px", background: SS.surface,
              border: `1px solid ${SS.border}`, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              fontFamily: "Inter", fontSize: 13, color: SS.ink,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Ico name="folder" size={14} color={SS.violet}/>
                <span>My sketches</span>
                <span style={{ color: SS.ink3 }}>/</span>
                <span>UK · 2026</span>
              </div>
              <Ico name="more" size={13} color={SS.ink3}/>
            </div>
          </SSField>
          <div style={{
            padding: 14, borderRadius: 10, background: SS.bg, border: `1px solid ${SS.borderSoft}`,
          }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>What we're saving</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontFamily: "Inter", fontSize: 12.5, color: SS.ink2 }}>
              {[
                ["Location", "52.586°N, -2.128°W"],
                ["Zoom level", "18 · hybrid"],
                ["Polygons", "3"],
                ["Parking blocks", "1 (12 spaces)"],
                ["CAD overlays", "—"],
                ["Total area", units === "metric" ? "2,184 m²" : "23,508 ft²"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${SS.borderSoft}` }}>
                  <span style={{ color: SS.ink3 }}>{k}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: SS.ink, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <SSToggle
            checked={true}
            label="Keep auto-saving from now on"
            sublabel="Changes save quietly in the background"
          />
        </div>
      </SSModal>
    </SSScrim>
  </div>
);

/* === Share flow === */
const StateShareFlow = ({ width, height, units = "metric" }) => (
  <div style={{ width, height, position: "relative" }}>
    <StateSelected width={width} height={height} units={units}/>
    <SSScrim>
      <SSModal
        width={500}
        title="Share Abbeyville Retail Park"
        subtitle="Anyone with the link can view this sketch. Edit access is invite-only."
        footer={
          <React.Fragment>
            <SSButton variant="ghost" size="md">Done</SSButton>
            <SSButton variant="primary" size="md" icon="check">Copy link</SSButton>
          </React.Fragment>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <SSField label="Share link">
            <div style={{
              display: "flex", alignItems: "center",
              border: `1px solid ${SS.border}`, borderRadius: 8, background: SS.bg,
              overflow: "hidden",
            }}>
              <span style={{ flex: 1, padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: SS.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                sitematcher.com/s/abbeyville-7f3e
              </span>
              <button style={{
                padding: "10px 14px", background: SS.ink, color: "#FFF",
                border: "none", cursor: "pointer",
                fontFamily: "Inter", fontSize: 12, fontWeight: 500,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                <Ico name="check" size={12}/> Copy
              </button>
            </div>
          </SSField>
          <SSField label="Access">
            <SSSegmentedFull value="link" options={[
              { value: "private", label: "Only me" },
              { value: "link",    label: "Anyone with link" },
              { value: "team",    label: "My team" },
            ]}/>
          </SSField>
          <SSField label="Invite by email">
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <SSInput placeholder="name@company.com"/>
              </div>
              <SSButton variant="ghost" size="md">Can view</SSButton>
              <SSButton variant="violet" size="md">Invite</SSButton>
            </div>
          </SSField>
          <div style={{
            padding: "10px 12px", borderRadius: 8, background: SS.bg, border: `1px solid ${SS.borderSoft}`,
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: SS.ink3, letterSpacing: 1, textTransform: "uppercase" }}>People with access</div>
            {[
              { name: "Dom Robinson", email: "dom@sitematcher.com", role: "Owner" },
              { name: "Sarah Patel", email: "sarah@sitematcher.com", role: "Can edit" },
            ].map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 999, background: i === 0 ? SS.violet : SS.orange,
                  color: "#FFF", fontFamily: "Inter", fontSize: 11, fontWeight: 600,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>{p.name[0]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Inter", fontSize: 13, color: SS.ink, fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontFamily: "Inter", fontSize: 11.5, color: SS.ink3 }}>{p.email}</div>
                </div>
                <span style={{ fontFamily: "Inter", fontSize: 11.5, color: SS.ink3 }}>{p.role}</span>
              </div>
            ))}
          </div>
        </div>
      </SSModal>
    </SSScrim>
  </div>
);

/* === Delete confirmation === */
const StateDeleteFlow = ({ width, height, units = "metric" }) => (
  <div style={{ width, height, position: "relative" }}>
    <StateSelected width={width} height={height} units={units}/>
    <SSScrim>
      <SSModal
        width={420}
        title="Delete Plot C — Service yard?"
        subtitle="This polygon will be removed from the sketch. You can undo from the top bar for the next 30 seconds."
        footer={
          <React.Fragment>
            <SSButton variant="ghost" size="md">Cancel</SSButton>
            <SSButton variant="primary" size="md" icon="trash" style={{ background: "#DC2626", borderColor: "#DC2626" }}>Delete polygon</SSButton>
          </React.Fragment>
        }
      >
        <div style={{
          padding: 14, borderRadius: 10, background: SS.bg, border: `1px solid ${SS.borderSoft}`,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ width: 36, height: 36, borderRadius: 8, background: POLY[2].fill, border: `2px solid ${POLY[2].stroke}`, flexShrink: 0 }}/>
          <div>
            <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 600, color: SS.ink }}>Plot C — Service yard</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: SS.ink3, marginTop: 2 }}>
              612 m² · 4 points · created 2 days ago
            </div>
          </div>
        </div>
      </SSModal>
    </SSScrim>
  </div>
);

/* === Right-click context menu === */
const StateContextMenu = ({ width, height, units = "metric" }) => (
  <div style={{ width, height, position: "relative" }}>
    <StateSelected width={width} height={height} units={units}/>
    {/* Context menu positioned over the selected polygon */}
    <div style={{
      position: "absolute",
      // Roughly over Plot C center: (56 + 304) + mw*0.62, 56 + mh*0.55
      top: 56 + (height - 56) * 0.55 - 20,
      left: 56 + 304 + (width - 56 - 304 - 320) * 0.62 + 60,
      width: 240, background: SS.surface, borderRadius: 10,
      border: `1px solid ${SS.border}`,
      boxShadow: "0 20px 50px -10px rgba(20,10,40,0.35), 0 0 0 1px rgba(0,0,0,0.04)",
      padding: 5, zIndex: 50,
    }}>
      {[
        { icon: "drag",    label: "Move",                  shortcut: "" },
        { icon: "rotate",  label: "Rotate",                shortcut: "R" },
        { icon: "right",   label: "Snap to 90° grid",      shortcut: "⇧G" },
        { icon: "folder",  label: "Duplicate",             shortcut: "⌘D" },
        { divider: true },
        { icon: "eyeoff",  label: "Hide layer",            shortcut: "H" },
        { icon: "layers",  label: "Bring to front",        shortcut: "]" },
        { icon: "layers",  label: "Send to back",          shortcut: "[" },
        { divider: true },
        { icon: "trash",   label: "Delete polygon",        shortcut: "⌫", danger: true },
      ].map((it, i) => it.divider ? (
        <div key={i} style={{ height: 1, background: SS.borderSoft, margin: "4px 6px" }}/>
      ) : (
        <button key={i} style={{
          width: "100%", padding: "7px 10px", border: "none", cursor: "pointer",
          background: "transparent", borderRadius: 6,
          display: "flex", alignItems: "center", gap: 10,
          color: it.danger ? "#DC2626" : SS.ink,
          fontFamily: "Inter", fontSize: 12.5, fontWeight: 500,
        }}>
          <Ico name={it.icon} size={13}/>
          <span style={{ flex: 1, textAlign: "left" }}>{it.label}</span>
          {it.shortcut && (
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3 }}>{it.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  </div>
);

/* === CAD upload — image preview, ready to calibrate ===
   The user has dropped a PNG/JPG; we show it in the map area at a neutral size,
   ready for the calibration step. */
const StateCADUpload = ({ width, height, units = "metric" }) => {
  const mw = width - 56 - 304 - 320, mh = height - 56;
  // Stylised store-plan thumbnail rendered in the map area
  const cx = mw * 0.5, cy = mh * 0.5;
  const planW = Math.min(mw * 0.62, 600), planH = Math.min(mh * 0.7, 420);
  return (
    <SSShell
      width={width} height={height} tool="cad" units={units}
      leftPanelTitle="CAD image"
      leftPanelSubtitle="Ready to calibrate"
      leftPanelContent={
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{
            padding: 12, borderRadius: 10, background: SS.surface, border: `1px solid ${SS.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: SS.violetTint, color: SS.violet,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>
                <Ico name="cad" size={18}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "Inter", fontSize: 13, color: SS.ink, fontWeight: 600 }}>storeplan_v3.png</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink3, marginTop: 2 }}>1.4 MB · 2400 × 1680 px</div>
              </div>
              <button style={{ background: "transparent", border: "none", cursor: "pointer", color: SS.ink3, padding: 4 }}>
                <Ico name="close" size={13}/>
              </button>
            </div>
          </div>
          <div style={{
            padding: 14, borderRadius: 10, background: SS.violetTintSoft, border: `1px solid ${SS.violetTint}`,
          }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: SS.violetDeep, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>Next — calibrate</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontFamily: "Inter", fontSize: 12.5, color: SS.ink2, lineHeight: 1.6 }}>
              <li>Find a known dimension in the image (a wall, a door, a parking bay)</li>
              <li>Click two points to mark its endpoints</li>
              <li>Tell us how long it is in real life</li>
            </ol>
          </div>
          <SSButton variant="violet" icon="ruler" size="md" full>Calibrate scale</SSButton>
          <button style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontFamily: "Inter", fontSize: 12, color: SS.ink3, fontWeight: 500, textAlign: "center",
          }}>Replace image</button>
        </div>
      }
      rightInspector={<EmptyInspector/>}
      mapStyle="hybrid"
      mapChildren={() => (
        <g>
          {/* Dim the map underneath */}
          <rect width="100%" height="100%" fill="rgba(20, 14, 34, 0.55)"/>
          {/* "Photo frame" white card holding the plan */}
          <g transform={`translate(${cx} ${cy})`}>
            <rect x={-planW/2 - 6} y={-planH/2 - 6} width={planW + 12} height={planH + 12} rx={4} fill="#FFFFFF" stroke={SS.border}/>
            {/* Mock CAD drawing inside */}
            <rect x={-planW/2} y={-planH/2} width={planW} height={planH} fill="#FAFAF7"/>
            {/* Plan walls — irregular store shape */}
            <CADPlanPreview width={planW} height={planH}/>
            {/* Floating label top-right */}
            <g transform={`translate(${planW/2 - 8} ${-planH/2 + 8})`}>
              <rect x={-110} y={0} width={110} height={22} rx={4} fill="rgba(23,20,25,0.92)"/>
              <text x={-55} y={14} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="10" fill="#FBFAF7" fontWeight="500">storeplan_v3.png</text>
            </g>
          </g>
        </g>
      )}
      statusLeft={<React.Fragment>
        <span style={{ color: SS.violet, fontWeight: 600 }}>CAD UPLOADED</span>
        <span style={{ color: SS.ink3 }}>·</span>
        <span>storeplan_v3.png · 2400 × 1680</span>
        <span style={{ color: SS.ink3 }}>·</span>
        <span>awaiting calibration</span>
      </React.Fragment>}
    />
  );
};

/* Reusable CAD plan SVG — drawn inside whatever frame size we give it.
   It's just decorative; renders walls + a door + dimension lines so the
   calibration scene feels like a real store plan. */
const CADPlanPreview = ({ width, height, calibration }) => {
  const w = width, h = height;
  // Build a non-rectangular store shape inside the frame
  const m = 30; // margin
  const path = `
    M ${-w/2 + m} ${-h/2 + m}
    L ${w/2 - m} ${-h/2 + m}
    L ${w/2 - m} ${-h/2 + h*0.45}
    L ${-w/2 + w*0.55} ${-h/2 + h*0.45}
    L ${-w/2 + w*0.55} ${h/2 - m}
    L ${-w/2 + m} ${h/2 - m}
    Z
  `;
  return (
    <g>
      {/* Outer walls thick */}
      <path d={path} fill="none" stroke="#1A1822" strokeWidth="3"/>
      {/* Inner partitions */}
      <line x1={-w/2 + m} y1={-h/2 + h*0.30} x2={-w/2 + w*0.55} y2={-h/2 + h*0.30} stroke="#1A1822" strokeWidth="1.6"/>
      <line x1={-w/2 + w*0.35} y1={-h/2 + h*0.30} x2={-w/2 + w*0.35} y2={-h/2 + h*0.45} stroke="#1A1822" strokeWidth="1.6"/>
      <line x1={-w/2 + w*0.15} y1={-h/2 + h*0.45} x2={-w/2 + w*0.15} y2={h/2 - m} stroke="#1A1822" strokeWidth="1.6"/>
      {/* Door — gap + arc */}
      <line x1={-w/2 + m} y1={-h/2 + h*0.62} x2={-w/2 + m} y2={-h/2 + h*0.72} stroke="#FAFAF7" strokeWidth="4"/>
      <path d={`M ${-w/2 + m} ${-h/2 + h*0.62} A 30 30 0 0 1 ${-w/2 + m + 30} ${-h/2 + h*0.62 + 30}`} fill="none" stroke="#1A1822" strokeWidth="1"/>
      {/* Dimension tick marks on the top wall (so users see something to measure against) */}
      <g stroke="#9CA3AF" strokeWidth="0.8">
        <line x1={-w/2 + m} y1={-h/2 + m - 12} x2={-w/2 + m} y2={-h/2 + m - 4}/>
        <line x1={w/2 - m} y1={-h/2 + m - 12} x2={w/2 - m} y2={-h/2 + m - 4}/>
        <line x1={-w/2 + m} y1={-h/2 + m - 8} x2={w/2 - m} y2={-h/2 + m - 8}/>
      </g>
      <text x={0} y={-h/2 + m - 12} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="11" fill="#6B7280">48.0 m</text>
      {/* Title block bottom-right */}
      <g transform={`translate(${w/2 - 110} ${h/2 - 50})`}>
        <rect x={0} y={0} width={90} height={36} fill="none" stroke="#9CA3AF" strokeWidth="0.8"/>
        <text x={5} y={14} fontFamily="Inter" fontSize="9" fill="#6B7280">STORE PLAN — REV 3</text>
        <text x={5} y={26} fontFamily="'JetBrains Mono', monospace" fontSize="8" fill="#9CA3AF">1:200 · 12 FEB 2026</text>
      </g>
      {/* Calibration overlay — two points + line + label */}
      {calibration && (
        <g>
          <line x1={calibration.a.x} y1={calibration.a.y} x2={calibration.b.x} y2={calibration.b.y}
            stroke={SS.violet} strokeWidth="2.5" strokeDasharray="0"/>
          {[calibration.a, calibration.b].map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="9" fill="#FFFFFF" stroke={SS.violet} strokeWidth="2.5"/>
              <text x={p.x + 14} y={p.y - 10} fontFamily="'JetBrains Mono', monospace" fontSize="12" fontWeight="700" fill={SS.violet}
                stroke="#FFF" strokeWidth="3" paintOrder="stroke">{i === 0 ? "A" : "B"}</text>
            </g>
          ))}
          {calibration.label && (() => {
            const mx = (calibration.a.x + calibration.b.x) / 2;
            const my = (calibration.a.y + calibration.b.y) / 2;
            const dx = calibration.b.x - calibration.a.x;
            const dy = calibration.b.y - calibration.a.y;
            let ang = Math.atan2(dy, dx) * 180 / Math.PI;
            if (ang > 90 || ang < -90) ang += 180;
            return (
              <g transform={`translate(${mx} ${my}) rotate(${ang}) translate(0, -22)`}>
                <rect x={-36} y={-12} width={72} height={24} rx={5} fill={SS.violet}/>
                <text x={0} y={4} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="12" fill="#FFFFFF" fontWeight="700">{calibration.label}</text>
              </g>
            );
          })()}
        </g>
      )}
    </g>
  );
};

/* === CAD calibration step — user picks two points & enters real distance === */
const StateCADCalibrate = ({ width, height, units = "metric" }) => {
  const mw = width - 56 - 304 - 320, mh = height - 56;
  const cx = mw * 0.5, cy = mh * 0.5;
  const planW = Math.min(mw * 0.62, 600), planH = Math.min(mh * 0.7, 420);
  // Two reference points already placed on the plan (front wall corners)
  const calib = {
    a: { x: -planW/2 + 30, y: -planH/2 + 30 },
    b: { x: planW/2 - 30, y: -planH/2 + 30 },
    label: "48.0 m",
  };
  return (
    <SSShell
      width={width} height={height} tool="cad" units={units}
      leftPanelTitle="Calibrate scale"
      leftPanelSubtitle="Step 2 of 3 · pick two points"
      leftPanelContent={
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Stepper */}
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { label: "Upload", done: true },
              { label: "Calibrate", active: true },
              { label: "Place" },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ width: "100%", height: 3, borderRadius: 999,
                  background: s.done ? SS.violet : (s.active ? SS.violet : "#E8E2D2") }}/>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                  color: s.done || s.active ? SS.violetDeep : SS.ink3,
                  fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase",
                }}>{s.label}</span>
              </div>
            ))}
          </div>

          <div style={{
            padding: 12, borderRadius: 10, background: SS.violetTintSoft, border: `1px solid ${SS.violetTint}`,
            fontFamily: "Inter", fontSize: 12.5, color: SS.ink2, lineHeight: 1.5,
          }}>
            Click two points on a known distance — like the full width of the building, a doorway or a parking bay. Then tell us how long that line is in real life.
          </div>

          <SSField label="Points">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "Point A", coord: "x: 124, y: 86", set: true },
                { label: "Point B", coord: "x: 1,892, y: 86", set: true },
              ].map((p, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 10px", borderRadius: 7, background: SS.bg, border: `1px solid ${SS.borderSoft}`,
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 999, background: SS.violet, color: "#FFF",
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>{i === 0 ? "A" : "B"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink, fontWeight: 500 }}>{p.label}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, marginTop: 1 }}>{p.coord}</div>
                  </div>
                  <Ico name="check" size={13} color={SS.ok}/>
                </div>
              ))}
            </div>
          </SSField>

          <SSField label="Real-world distance" hint="The actual length of the line between A and B">
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <SSInput value="48.0" suffix={units === "metric" ? "m" : "ft"}/>
              </div>
              <SSSegmented value={units} options={[
                { value: "metric", label: "m" },
                { value: "imperial", label: "ft" },
              ]}/>
            </div>
          </SSField>

          <div style={{
            padding: 12, borderRadius: 10, background: SS.bg, border: `1px solid ${SS.borderSoft}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, letterSpacing: 0.4, textTransform: "uppercase" }}>Resulting scale</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: SS.ink, fontWeight: 600, marginTop: 4 }}>1 px = 0.0238 m</div>
            </div>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, letterSpacing: 0.4, textTransform: "uppercase", textAlign: "right" }}>Implied footprint</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: SS.ink, fontWeight: 600, marginTop: 4, textAlign: "right" }}>48 × 34 m</div>
            </div>
          </div>

          <div style={{
            padding: "10px 12px", borderRadius: 8, background: "#FEF3C7", border: "1px solid #FCD34D",
            fontFamily: "Inter", fontSize: 12, color: "#92400E", lineHeight: 1.45,
            display: "flex", gap: 8,
          }}>
            <span style={{ fontWeight: 700 }}>⚠</span>
            <span>Once placed, the image size is locked. You can only move and rotate it on the map.</span>
          </div>

          <SSRow gap={8}>
            <SSButton variant="ghost" icon="undo" size="md" full>Reset points</SSButton>
            <SSButton variant="violet" icon="check" size="md" full>Confirm &amp; place</SSButton>
          </SSRow>
        </div>
      }
      rightInspector={<EmptyInspector/>}
      mapStyle="hybrid"
      mapChildren={() => (
        <g>
          <rect width="100%" height="100%" fill="rgba(20, 14, 34, 0.6)"/>
          <g transform={`translate(${cx} ${cy})`}>
            <rect x={-planW/2 - 6} y={-planH/2 - 6} width={planW + 12} height={planH + 12} rx={4} fill="#FFFFFF" stroke={SS.border}/>
            <rect x={-planW/2} y={-planH/2} width={planW} height={planH} fill="#FAFAF7"/>
            <CADPlanPreview width={planW} height={planH} calibration={calib}/>
          </g>
          {/* Cursor hint near point B */}
          <g transform={`translate(${cx + planW/2 - 30} ${cy - planH/2 + 30 - 36})`}>
            <rect x={-72} y={-12} width={144} height={24} rx={5} fill="rgba(23,20,25,0.92)"/>
            <text x={0} y={4} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="11" fill="#FBFAF7" fontWeight="500">A–B set · enter distance →</text>
          </g>
        </g>
      )}
      statusLeft={<React.Fragment>
        <span style={{ color: SS.violet, fontWeight: 600 }}>CALIBRATING CAD</span>
        <span style={{ color: SS.ink3 }}>·</span>
        <span>2 points · 1,768 px apart</span>
        <span style={{ color: SS.ink3 }}>·</span>
        <span>= 48.0 m</span>
      </React.Fragment>}
    />
  );
};

/* === Measure tool active === */
const StateMeasure = ({ width, height, units = "metric" }) => {
  const mw = width - 56 - 304 - 320, mh = height - 56;
  // A multi-segment measurement
  const measurePts = [
    { x: mw*0.20, y: mh*0.65 },
    { x: mw*0.50, y: mh*0.55 },
    { x: mw*0.50, y: mh*0.30 },
    { x: mw*0.78, y: mh*0.30 },
  ];
  const lenLabel = (px) => units === "imperial" ? `${(px * 0.39).toFixed(1)} ft` : `${(px * 0.12).toFixed(1)} m`;
  const totalPx = measurePts.slice(0, -1).reduce((sum, p, i) => {
    const q = measurePts[i + 1];
    return sum + Math.sqrt((q.x - p.x) ** 2 + (q.y - p.y) ** 2);
  }, 0);
  return (
    <SSShell
      width={width} height={height} tool="ruler" units={units}
      leftPanelTitle="Measure"
      leftPanelSubtitle="Tap points to chain distances"
      leftPanelContent={
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            padding: 12, borderRadius: 10, background: SS.violetTintSoft, border: `1px solid ${SS.violetTint}`,
            fontFamily: "Inter", fontSize: 12.5, color: SS.ink2, lineHeight: 1.45,
          }}>
            Click any two or more points on the map. We'll measure straight-line distances between them.
          </div>
          <SSField label="Segments">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {measurePts.slice(0, -1).map((p, i) => {
                const q = measurePts[i + 1];
                const len = Math.sqrt((q.x - p.x) ** 2 + (q.y - p.y) ** 2);
                return (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 10px", borderRadius: 7, background: SS.bg, border: `1px solid ${SS.borderSoft}`,
                  }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: SS.ink3 }}>
                      A{i + 1} → A{i + 2}
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: SS.ink, fontWeight: 500 }}>
                      {lenLabel(len)}
                    </span>
                  </div>
                );
              })}
            </div>
          </SSField>
          <div style={{
            padding: 12, borderRadius: 10, background: SS.ink, color: "#FFF",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontFamily: "Inter", fontSize: 11, color: "rgba(255,255,255,0.6)", letterSpacing: 0.4, textTransform: "uppercase" }}>Total distance</div>
              <div style={{ fontFamily: "Inter", fontSize: 22, fontWeight: 600, marginTop: 2, letterSpacing: -0.5 }}>{lenLabel(totalPx)}</div>
            </div>
            <Ico name="ruler" size={22} color="rgba(255,255,255,0.6)"/>
          </div>
          <SSRow gap={8}>
            <SSButton variant="ghost" icon="undo" size="sm" full>Undo</SSButton>
            <SSButton variant="ghost" icon="trash" size="sm" full>Clear</SSButton>
          </SSRow>
        </div>
      }
      rightInspector={<EmptyInspector/>}
      mapStyle="satellite"
      mapChildren={() => (
        <g>
          {/* Polyline */}
          {measurePts.slice(0, -1).map((p, i) => {
            const q = measurePts[i + 1];
            return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#FACC15" strokeWidth="2.4"/>;
          })}
          {/* Distance pills */}
          {measurePts.slice(0, -1).map((p, i) => {
            const q = measurePts[i + 1];
            const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
            const dx = q.x - p.x, dy = q.y - p.y;
            let angle = Math.atan2(dy, dx) * 180 / Math.PI;
            if (angle > 90 || angle < -90) angle += 180;
            const len = Math.sqrt(dx*dx + dy*dy);
            return (
              <g key={i} transform={`translate(${mx} ${my}) rotate(${angle})`}>
                <rect x={-28} y={-11} width={56} height={20} rx={5} fill="rgba(23,20,25,0.92)"/>
                <text x={0} y={4} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="11" fill="#FACC15" letterSpacing="0.3" fontWeight="600">{lenLabel(len)}</text>
              </g>
            );
          })}
          {/* Points with labels */}
          {measurePts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="7" fill="#FFFFFF" stroke="#FACC15" strokeWidth="2.5"/>
              <text x={p.x + 12} y={p.y - 10} fontFamily="'JetBrains Mono', monospace" fontSize="11" fontWeight="700" fill="#FACC15"
                stroke="rgba(0,0,0,0.65)" strokeWidth="3" paintOrder="stroke">A{i + 1}</text>
            </g>
          ))}
          {/* Total readout */}
          <g transform={`translate(${mw*0.5} ${mh*0.88})`}>
            <rect x={-72} y={-16} width={144} height={32} rx={8} fill="rgba(23,20,25,0.95)"/>
            <text x={0} y={4} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="12" fill="#FACC15" letterSpacing="0.3" fontWeight="700">
              Total {lenLabel(totalPx)}
            </text>
          </g>
        </g>
      )}
      statusLeft={<React.Fragment>
        <span style={{ color: "#CA8A04", fontWeight: 600 }}>MEASURE TOOL</span>
        <span style={{ color: SS.ink3 }}>·</span>
        <span>4 points · 3 segments</span>
        <span style={{ color: SS.ink3 }}>·</span>
        <span>Total {lenLabel(totalPx)}</span>
      </React.Fragment>}
    />
  );
};

/* === Search results active (live, narrowed down) === */
const StateSearch = ({ width, height, units = "metric" }) => (
  <div style={{ width, height, position: "relative" }}>
    <StateEmpty width={width} height={height} units={units}/>
    {/* Override the topbar by absolutely positioning a search dropdown over it */}
    <div style={{
      position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
      width: 560, zIndex: 50,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", background: SS.surface,
        border: `1px solid ${SS.violet}`, borderRadius: 10,
        boxShadow: `0 0 0 3px ${SS.violetTintSoft}, 0 14px 30px -10px rgba(20,10,40,0.2)`,
      }}>
        <Ico name="search" size={14} color={SS.violet}/>
        <input defaultValue="Bristol" style={{
          flex: 1, border: "none", outline: "none", background: "transparent",
          fontFamily: "Inter", fontSize: 14, color: SS.ink,
        }}/>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          color: SS.ink3, padding: "2px 6px", borderRadius: 4, background: "#F1EDE4",
        }}>ESC</span>
      </div>
      <div style={{
        marginTop: 6, background: SS.surface, border: `1px solid ${SS.border}`, borderRadius: 12,
        padding: 6, boxShadow: "0 24px 60px -20px rgba(20,10,40,0.3)",
        maxHeight: 420, overflow: "auto",
      }}>
        <div style={{ padding: "6px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, letterSpacing: 1, textTransform: "uppercase" }}>
          Locations · powered by Mapbox
        </div>
        {[
          { name: "Bristol, BS1 — City centre", sub: "Bristol · England", icon: "pin", featured: true },
          { name: "Bristol Temple Meads station", sub: "Train station · BS1 6QF" },
          { name: "Bristol Airport", sub: "International airport · BS48 3DY" },
          { name: "Bristol Road, Birmingham", sub: "Birmingham · B5" },
          { name: "Bristol, Pennsylvania", sub: "United States · PA 19007" },
        ].map((r, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 12px", borderRadius: 8, cursor: "pointer",
            background: r.featured ? SS.violetTintSoft : "transparent",
          }}>
            <Ico name="pin" size={16} color={r.featured ? SS.violet : SS.ink3}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Inter", fontSize: 13.5, color: SS.ink, fontWeight: r.featured ? 600 : 500 }}>{r.name}</div>
              <div style={{ fontFamily: "Inter", fontSize: 11.5, color: SS.ink3, marginTop: 1 }}>{r.sub}</div>
            </div>
            {r.featured && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: SS.ink3 }}>↵</span>}
          </div>
        ))}
        <div style={{ height: 1, background: SS.borderSoft, margin: "4px 6px" }}/>
        <div style={{ padding: "6px 12px 4px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, letterSpacing: 1, textTransform: "uppercase" }}>
          From your sketches
        </div>
        {[{ name: "Bristol Drive-thru", sub: "Saved 1 month ago" }].map((r, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
            borderRadius: 8, cursor: "pointer",
          }}>
            <Ico name="folder" size={16} color={SS.ink3}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Inter", fontSize: 13.5, color: SS.ink, fontWeight: 500 }}>{r.name}</div>
              <div style={{ fontFamily: "Inter", fontSize: 11.5, color: SS.ink3, marginTop: 1 }}>{r.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* === Empty saved sketches (first-time user) === */
const StateSavedEmpty = ({ width, height, units = "metric" }) => (
  <SSShell
    width={width} height={height} tool="select" panel="saved" units={units}
    leftPanelTitle="My sketches"
    leftPanelSubtitle="0 saved"
    leftPanelAction={<SSButton variant="ghost" icon="plus" size="sm">New</SSButton>}
    leftPanelContent={
      <div style={{
        padding: 20, display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", gap: 10, marginTop: 30,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: SS.violetTint, color: SS.violet,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <Ico name="folder" size={26}/>
        </div>
        <div style={{ fontFamily: "Inter", fontSize: 15, fontWeight: 600, color: SS.ink }}>No saved sketches yet</div>
        <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink3, lineHeight: 1.55, maxWidth: 240 }}>
          Sketches you save will show up here. Hit ⌘S any time to save your current map.
        </div>
        <div style={{ marginTop: 14, width: "100%" }}>
          <SSButton variant="violet" icon="plus" size="md" full>Start a new sketch</SSButton>
        </div>
      </div>
    }
    rightInspector={<EmptyInspector/>}
    mapStyle="hybrid"
    mapChildren={() => null}
    statusLeft={<span>Ready · 0 sketches</span>}
  />
);

/* === Unsupported viewport (portrait phone) === */
const StateUnsupported = ({ width, height }) => (
  <div style={{
    width, height, background: SS.bg, fontFamily: "Inter",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 32,
  }}>
    <div style={{
      maxWidth: 360, textAlign: "center",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
    }}>
      <SMLogo height={26}/>
      <div style={{
        width: 80, height: 80, borderRadius: 20,
        background: SS.violetTint, color: SS.violet,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        marginTop: 12,
      }}>
        <Ico name="cube" size={36}/>
      </div>
      <div style={{ fontFamily: "Inter", fontSize: 22, fontWeight: 600, color: SS.ink, letterSpacing: -0.3 }}>Best on a bigger screen</div>
      <div style={{ fontFamily: "Inter", fontSize: 14, color: SS.ink2, lineHeight: 1.55 }}>
        SiteSketcher needs at least a tablet (10" or larger, landscape) to give you room to draw accurately. Pop back on a laptop or a tablet to get started.
      </div>
      <div style={{
        marginTop: 8, padding: 14, borderRadius: 12,
        background: SS.surface, border: `1px solid ${SS.border}`, width: "100%",
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, letterSpacing: 1, textTransform: "uppercase" }}>Try instead</div>
        <div style={{ fontFamily: "Inter", fontSize: 13, color: SS.ink2 }}>📍 Browse your saved sketches</div>
        <div style={{ fontFamily: "Inter", fontSize: 13, color: SS.ink2 }}>📨 Email yourself a link to open later</div>
      </div>
      <SSButton variant="ghost" size="md">Email me a link</SSButton>
    </div>
  </div>
);

Object.assign(window, {
  SSScrim, SSModal,
  StateSaveFlow, StateShareFlow, StateDeleteFlow, StateContextMenu,
  StateCADUpload, StateCADCalibrate, StateMeasure,
  StateSearch, StateSavedEmpty, StateUnsupported,
  CADPlanPreview,
});
