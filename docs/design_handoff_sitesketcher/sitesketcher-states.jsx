/* SiteSketcher — composed screens for each state. Each is sized to fill its artboard. */

/* === Shared layout shell ===
   Top bar (56) + body (left rail 56 + left panel 304 + map flex + right inspector 320) */
const SSShell = ({ width, height, tool = "select", panel = null, leftPanelTitle, leftPanelSubtitle, leftPanelAction, leftPanelContent, rightInspector, mapChildren, topBarProps = {}, showSettings = false, settingsProps = {}, statusLeft, hideRightPanel, mode3d = false, mapStyle = "hybrid", units = "metric", sideAnnots = true }) => {
  const railW = 56;
  const leftPanelW = leftPanelContent !== null ? 304 : 0;
  const rightW = hideRightPanel ? 0 : 320;
  const topH = 56;
  const mapW = width - railW - leftPanelW - rightW;
  const mapH = height - topH;
  return (
    <div style={{
      width, height, background: SS.bg, fontFamily: "Inter",
      color: SS.ink, overflow: "hidden", display: "flex", flexDirection: "column",
      position: "relative",
    }}>
      <SSTopBar {...topBarProps}/>
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <SSLeftRail active={tool} panel={panel}/>
        {leftPanelContent !== null && (
          <SSLeftPanel title={leftPanelTitle} subtitle={leftPanelSubtitle} action={leftPanelAction}>
            {leftPanelContent}
          </SSLeftPanel>
        )}
        {/* Map */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#3A3A36" }}>
          <MapBackdrop width={mapW} height={mapH} style={mapStyle}/>
          {/* 3D tilt overlay */}
          {mode3d && (
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.25) 100%)",
              pointerEvents: "none",
            }}/>
          )}
          {/* SVG overlay for sketches */}
          <svg width={mapW} height={mapH} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {mapChildren && mapChildren({ mapW, mapH })}
          </svg>
          <SSMapControls mode={mode3d ? "3d" : "2d"} mapStyle={mapStyle} units={units} sideAnnots={sideAnnots}/>
          {showSettings && <SSSettings {...settingsProps}/>}
          <SSStatusBar
            units={units}
            left={statusLeft || <React.Fragment>
              <span style={{ color: SS.ink3 }}>LAT</span>
              <span>51.5074°N</span>
              <span style={{ color: SS.ink3 }}>LON</span>
              <span>-0.1278°W</span>
              <span style={{ color: SS.ink3 }}>·</span>
              <span>Zoom 18</span>
            </React.Fragment>}
          />
        </div>
        {!hideRightPanel && (
          <div style={{
            width: rightW, background: SS.surface,
            borderLeft: `1px solid ${SS.border}`,
            display: "flex", flexDirection: "column", overflow: "auto", flexShrink: 0,
          }}>
            {rightInspector}
          </div>
        )}
      </div>
    </div>
  );
};

/* === State 1: Drawing a polygon ===
   Mid-drawing with 4 points placed, cursor on 5th, 90° mode active. */
const StateDrawing = ({ width, height, units = "metric" }) => {
  // sample polygon being drawn — bounded inside mapW
  // Map area: width - 56 (rail) - 304 (panel) - 320 (inspector); height - 56
  const mw = width - 56 - 304 - 320, mh = height - 56;
  // 4 points + ghost
  const pts = [
    { x: mw*0.32, y: mh*0.30 },
    { x: mw*0.68, y: mh*0.30 },
    { x: mw*0.68, y: mh*0.62 },
    { x: mw*0.45, y: mh*0.62 },
  ];
  const cursor = { x: mw*0.45, y: mh*0.78 };
  return (
    <SSShell
      width={width} height={height} tool="polygon" units={units}
      leftPanelTitle="Draw polygon"
      leftPanelSubtitle="Plot A · live"
      leftPanelAction={<button style={{ background: "transparent", border: "none", cursor: "pointer", color: SS.ink3, padding: 4 }}><Ico name="close" size={13}/></button>}
      leftPanelContent={<PolygonToolConfig rightAngle={true} showDistances={true} fillColor="violet" snapPoints={false}/>}
      rightInspector={<DrawingInspector pts={pts} units={units}/>}
      topBarProps={{ projectName: "Untitled sketch", isLoggedIn: true }}
      mapStyle="hybrid"
      mapChildren={({ mapW, mapH }) => {
        const edges = pts.map((p, i) => {
          const q = i === pts.length - 1 ? cursor : pts[i + 1];
          const dx = q.x - p.x, dy = q.y - p.y;
          const len = Math.sqrt(dx*dx + dy*dy);
          return { p, q, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2, len, angle: Math.atan2(dy, dx) * 180 / Math.PI };
        });
        const stroke = POLY[0].stroke, fill = POLY[0].fill;
        const lenLabel = (px) => units === "imperial" ? `${(px * 0.39).toFixed(1)} ft` : `${(px * 0.12).toFixed(1)} m`;
        const closePath = "M " + pts.map(p => `${p.x} ${p.y}`).join(" L ") + ` L ${cursor.x} ${cursor.y} Z`;
        return (
          <g>
            {/* Filled (semi) */}
            <path d={closePath} fill={fill} stroke="none" opacity="0.7"/>
            {/* Solid edges (placed) */}
            {pts.slice(0, -1).map((p, i) => (
              <line key={i} x1={p.x} y1={p.y} x2={pts[i+1].x} y2={pts[i+1].y} stroke={stroke} strokeWidth="2.4"/>
            ))}
            {/* Last placed → cursor: dashed (live) */}
            <line x1={pts[pts.length - 1].x} y1={pts[pts.length - 1].y} x2={cursor.x} y2={cursor.y}
              stroke={stroke} strokeWidth="2.4" strokeDasharray="5 5"/>
            {/* Close hint line back to start, very faint */}
            <line x1={cursor.x} y1={cursor.y} x2={pts[0].x} y2={pts[0].y}
              stroke={stroke} strokeWidth="1.4" strokeDasharray="3 5" opacity="0.5"/>
            {/* 90° indicator at last corner */}
            {(() => {
              const corner = pts[pts.length - 1];
              return (
                <g>
                  <rect x={corner.x - 1} y={corner.y - 11} width={11} height={11} fill="none" stroke={stroke} strokeWidth="1.4"/>
                  <circle cx={corner.x + 4} cy={corner.y - 6} r="1.4" fill={stroke}/>
                </g>
              );
            })()}
            {/* Distance markers on placed edges + live edge */}
            {edges.map((e, i) => (
              <g key={i} transform={`translate(${e.mx} ${e.my}) rotate(${e.angle > 90 || e.angle < -90 ? e.angle + 180 : e.angle})`}>
                <rect x={-26} y={-11} width={52} height={20} rx={5} fill="rgba(23,20,25,0.92)"/>
                <text x={0} y={4} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="11" fill="#FBFAF7" letterSpacing="0.3" fontWeight="500">{lenLabel(e.len)}</text>
              </g>
            ))}
            {/* Vertex dots */}
            {pts.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={i === 0 ? 8 : 6} fill="#FFFFFF" stroke={stroke} strokeWidth="2"/>
                <circle cx={p.x} cy={p.y} r={i === 0 ? 3 : 2.5} fill={stroke}/>
                {i === 0 && (
                  <g>
                    <circle cx={p.x} cy={p.y} r="14" fill="none" stroke={stroke} strokeWidth="1.4" strokeDasharray="3 3" opacity="0.6"/>
                  </g>
                )}
              </g>
            ))}
            {/* Cursor marker */}
            <g transform={`translate(${cursor.x} ${cursor.y})`}>
              <circle r="8" fill="rgba(255,255,255,0.9)" stroke={stroke} strokeWidth="2"/>
              <circle r="3" fill={stroke}/>
              <g transform="translate(14, -14)">
                <rect x={0} y={0} width={88} height={22} rx={4} fill={stroke}/>
                <text x={8} y={14} fontFamily="'JetBrains Mono', monospace" fontSize="10" fill="#FFFFFF" letterSpacing="0.3" fontWeight="500">Click to place · 90° lock</text>
              </g>
            </g>
          </g>
        );
      }}
      statusLeft={<React.Fragment>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: SS.violet, fontWeight: 600 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: SS.violet, animation: "ss-pulse 1.4s infinite" }}/>
          DRAWING POLYGON
        </span>
        <span style={{ color: SS.ink3 }}>·</span>
        <span>4 points placed</span>
        <span style={{ color: SS.ink3 }}>·</span>
        <span style={{
          padding: "2px 7px", borderRadius: 4, background: SS.violetTintSoft,
          color: SS.violetDeep, fontWeight: 600,
        }}>90° lock ON</span>
      </React.Fragment>}
    />
  );
};

const DrawingInspector = ({ pts, units }) => {
  const lenLabel = (px) => units === "imperial" ? `${(px * 0.39).toFixed(1)} ft` : `${(px * 0.12).toFixed(1)} m`;
  return (
    <div>
      <SSPanel title="Drawing — Plot A">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 28, height: 28, borderRadius: 7, background: POLY[0].fill, border: `2px solid ${POLY[0].stroke}` }}/>
          <div>
            <div style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 600, color: SS.ink }}>New polygon</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink3, marginTop: 2 }}>4 pts placed · adding 5th</div>
          </div>
        </div>
      </SSPanel>
      <SSPanel title="Live measurements">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {pts.map((p, i) => {
            const q = pts[(i + 1) % pts.length];
            const dx = q.x - p.x, dy = q.y - p.y;
            const len = Math.sqrt(dx*dx + dy*dy);
            return (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 10px", borderRadius: 7, background: SS.bg,
                border: `1px solid ${SS.borderSoft}`,
              }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: SS.ink3, letterSpacing: 0.4 }}>
                  EDGE {i + 1}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: SS.ink, fontWeight: 500 }}>
                  {lenLabel(len)}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{
          marginTop: 10, padding: 10, borderRadius: 8,
          background: SS.violetTintSoft, border: `1px solid ${SS.violetTint}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontFamily: "Inter", fontSize: 12, color: SS.violetDeep, fontWeight: 600 }}>Current area</span>
          <span style={{ fontFamily: "Inter", fontSize: 15, color: SS.violetDeep, fontWeight: 700 }}>
            {units === "metric" ? "874 m²" : "9,408 ft²"}
          </span>
        </div>
      </SSPanel>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        <SSButton variant="violet" icon="check" size="md" full>Finish polygon</SSButton>
        <SSButton variant="ghost" icon="undo" size="sm" full>Undo last point</SSButton>
        <SSButton variant="danger" icon="trash" size="sm" full>Cancel drawing</SSButton>
      </div>
    </div>
  );
};

/* === State 2: Polygon selected ===
   The default left sidebar IS the layers manager (search, filter, grouped list,
   bulk actions). When a layer is clicked it becomes the selected item; the
   right inspector shows its details. Selecting on the map mirrors selection
   in the panel. */
const StateSelected = ({ width, height, units = "metric" }) => {
  const mw = width - 56 - 304 - 320, mh = height - 56;
  // Existing polygon A (big), B (small), and selected polygon C with handles
  const polyA = [
    { x: mw*0.18, y: mh*0.18 },
    { x: mw*0.40, y: mh*0.15 },
    { x: mw*0.42, y: mh*0.36 },
    { x: mw*0.20, y: mh*0.39 },
  ];
  const polyB = [
    { x: mw*0.10, y: mh*0.62 },
    { x: mw*0.26, y: mh*0.60 },
    { x: mw*0.27, y: mh*0.78 },
    { x: mw*0.11, y: mh*0.80 },
  ];
  // Selected — rotated 12 degrees
  const cx = mw*0.62, cy = mh*0.55;
  const w0 = mw*0.22, h0 = mh*0.30;
  const rad = 12 * Math.PI / 180;
  const rot = (px, py) => ({
    x: cx + (px - cx) * Math.cos(rad) - (py - cy) * Math.sin(rad),
    y: cy + (px - cx) * Math.sin(rad) + (py - cy) * Math.cos(rad),
  });
  const polyC = [
    rot(cx - w0/2, cy - h0/2),
    rot(cx + w0/2, cy - h0/2),
    rot(cx + w0/2, cy + h0/2),
    rot(cx - w0/2, cy + h0/2),
  ];

  const selectedPoly = {
    name: "Plot C — Service yard",
    color: POLY[2],
    points: 4,
    area: 612,
    perimeter: 102,
  };

  // Grouped layer list (lifted from the old StateLayers)
  const groups = [
    {
      id: "buildings", name: "Buildings", count: 2, expanded: true,
      items: [
        { id: "a", kind: "poly", name: "Plot A — Main building", detail: "1,248 m² · 4 pts", color: POLY[0], visible: true },
        { id: "c", kind: "poly", name: "Plot C — Service yard", detail: "612 m² · 4 pts",   color: POLY[2], visible: true, selected: true },
      ],
    },
    {
      id: "parking", name: "Parking", count: 1, expanded: true,
      items: [
        { id: "b", kind: "parking", name: "Plot B — Loading dock", detail: "12 spaces · single", color: POLY[1], visible: true },
      ],
    },
  ];

  return (
    <SSShell
      width={width} height={height} tool="select" units={units}
      leftPanelTitle="Sketch"
      leftPanelSubtitle="3 layers · 1 selected"
      leftPanelAction={<SSButton variant="ghost" icon="plus" size="sm">Add</SSButton>}
      leftPanelContent={
        <div>
          {/* Totals strip */}
          <div style={{
            padding: "12px 14px", borderBottom: `1px solid ${SS.borderSoft}`,
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
          }}>
            <Metric label="Total area" value={units === "metric" ? "2,184" : "23,508"} unit={units === "metric" ? "m²" : "ft²"} accent={SS.violet}/>
            <Metric label="Layers" value="3" unit=""/>
          </div>

          {/* Filter + search */}
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${SS.borderSoft}`, display: "flex", flexDirection: "column", gap: 8 }}>
            <SSInput placeholder="Filter layers…" icon="search"/>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {[
                { label: "All", count: 3, active: true },
                { label: "Polygons", count: 2 },
                { label: "Parking", count: 1 },
                { label: "CAD", count: 0 },
              ].map((f, i) => (
                <button key={i} style={{
                  padding: "4px 9px", borderRadius: 999, cursor: "pointer",
                  background: f.active ? SS.ink : SS.bg,
                  color: f.active ? "#FFF" : SS.ink2,
                  border: `1px solid ${f.active ? SS.ink : SS.border}`,
                  fontFamily: "Inter", fontSize: 11.5, fontWeight: 500,
                  display: "inline-flex", alignItems: "center", gap: 5,
                  opacity: f.count === 0 ? 0.5 : 1,
                }}>
                  {f.label}
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5,
                    color: f.active ? "rgba(255,255,255,0.7)" : SS.ink3,
                    fontWeight: 600,
                  }}>{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Grouped list */}
          {groups.map(g => (
            <div key={g.id}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px 6px", background: SS.bg,
              }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                  color: SS.ink3, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 600,
                }}>{g.name}</span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                  color: SS.ink4, fontWeight: 500,
                }}>{g.count}</span>
                <div style={{ flex: 1 }}/>
                <Ico name={g.expanded ? "minus" : "plus"} size={10} color={SS.ink3}/>
              </div>
              {g.expanded && g.items.map(it => (
                <div key={it.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 14px",
                  borderLeft: `3px solid ${it.selected ? it.color.stroke : "transparent"}`,
                  background: it.selected ? SS.violetTintSoft : "transparent",
                  cursor: "pointer",
                  opacity: it.visible ? 1 : 0.55,
                }}>
                  <Ico name="drag" size={11} color={SS.ink4}/>
                  <span style={{
                    width: 14, height: 14, borderRadius: 3,
                    background: it.color.fill, border: `1.5px solid ${it.color.stroke}`,
                    flexShrink: 0,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {it.kind === "parking" && <Ico name="parking" size={8} color={it.color.stroke}/>}
                    {it.kind === "cad" && <Ico name="cad" size={8} color={it.color.stroke}/>}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "Inter", fontSize: 12.5, color: SS.ink,
                      fontWeight: it.selected ? 600 : 500,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      letterSpacing: -0.1,
                    }}>{it.name}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, marginTop: 1 }}>{it.detail}</div>
                  </div>
                  <button style={{ background: "transparent", border: "none", cursor: "pointer", padding: 3, borderRadius: 5, color: SS.ink3 }}>
                    <Ico name={it.visible ? "eye" : "eyeoff"} size={13}/>
                  </button>
                  <button style={{ background: "transparent", border: "none", cursor: "pointer", padding: 3, borderRadius: 5, color: SS.ink3 }}>
                    <Ico name="more" size={13}/>
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      }
      rightInspector={<PolygonInspector poly={selectedPoly} units={units}/>}
      mapStyle="satellite"
      mapChildren={() => (
        <g>
          <SketchPolygon pts={polyA} color={POLY[0]} showDistances showArea label="Plot A" area={1248} units={units}/>
          <SketchPolygon pts={polyB} color={POLY[1]} showDistances showArea label="Plot B" area={324} units={units}/>
          <SketchPolygon pts={polyC} color={POLY[2]} selected showDistances showArea showHandles showRotate label="Plot C" area={612} units={units}/>
        </g>
      )}
      statusLeft={<React.Fragment>
        <span>3 layers</span>
        <span style={{ color: SS.ink3 }}>·</span>
        <span><b style={{ color: SS.ink }}>Plot C</b> selected</span>
        <span style={{ color: SS.ink3 }}>·</span>
        <span>rotation 12°</span>
      </React.Fragment>}
    />
  );
};

/* === State 3: Parking workflow === */
const StateParking = ({ width, height, units = "metric" }) => {
  const mw = width - 56 - 304 - 320, mh = height - 56;
  // Main building polygon
  const building = [
    { x: mw*0.22, y: mh*0.18 },
    { x: mw*0.62, y: mh*0.18 },
    { x: mw*0.62, y: mh*0.44 },
    { x: mw*0.22, y: mh*0.44 },
  ];
  // Two parking blocks already placed + one being placed
  return (
    <SSShell
      width={width} height={height} tool="parking" units={units}
      leftPanelTitle="Add parking"
      leftPanelSubtitle="Configure, then drop on map"
      leftPanelContent={<ParkingToolConfig count={24} layer="double" size="standard" onCount={()=>{}} onLayer={()=>{}} onSize={()=>{}}/>}
      rightInspector={<ParkingInspector block={{ color: POLY[1], spaces: 24, layout: "Double row", size: "standard" }} units={units}/>}
      mapStyle="hybrid"
      mapChildren={() => (
        <g>
          <SketchPolygon pts={building} color={POLY[0]} showDistances={false} showArea label="Store" area={2400} units={units}/>
          {/* Existing parking block 1 — single row */}
          <ParkingBlock x={mw*0.22} y={mh*0.49} cols={20} rows={1} stallW={(mw*0.40)/20} stallL={mh*0.07} color={POLY[1]} label="20 spaces · single"/>
          {/* Existing parking block 2 — double row */}
          <ParkingBlock x={mw*0.22} y={mh*0.62} cols={16} rows={2} stallW={(mw*0.32)/16} stallL={mh*0.06} color={POLY[1]} selected
            label="32 spaces · double"/>
          {/* Ghost block being placed (follows cursor) */}
          <g opacity="0.65">
            <ParkingBlock x={mw*0.65} y={mh*0.55} cols={12} rows={2} stallW={(mw*0.24)/12} stallL={mh*0.07} color={POLY[1]}/>
          </g>
          {/* Cursor */}
          <g transform={`translate(${mw*0.78} ${mh*0.62})`}>
            <circle r="8" fill="rgba(255,255,255,0.9)" stroke={POLY[1].stroke} strokeWidth="2"/>
            <circle r="3" fill={POLY[1].stroke}/>
            <g transform="translate(14, -14)">
              <rect width={132} height={22} rx={4} fill={POLY[1].stroke}/>
              <text x={8} y={14} fontFamily="'JetBrains Mono', monospace" fontSize="10" fill="#FFFFFF" letterSpacing="0.3" fontWeight="500">24 spaces · click to place</text>
            </g>
          </g>
        </g>
      )}
      statusLeft={<React.Fragment>
        <span style={{ color: POLY[1].stroke, fontWeight: 600 }}>
          PARKING TOOL
        </span>
        <span style={{ color: SS.ink3 }}>·</span>
        <span>52 spaces total</span>
        <span style={{ color: SS.ink3 }}>·</span>
        <span>~599 m² apron</span>
      </React.Fragment>}
    />
  );
};

/* === State 4: CAD image placed on map ===
   The CAD is a raster image (PNG/JPG) the user uploaded and calibrated; we draw
   it as a rotated, semi-transparent photo-frame so the satellite shows through. */
const StateCAD = ({ width, height, units = "metric" }) => {
  const mw = width - 56 - 304 - 320, mh = height - 56;
  // Image footprint on map (in px) — 48 m wide × 34 m deep at zoom 18 ≈
  const cx = mw*0.50, cy = mh*0.50;
  const imgW = 280, imgH = 200;
  const rotDeg = 28;
  return (
    <SSShell
      width={width} height={height} tool="cad" units={units}
      leftPanelTitle="CAD image"
      leftPanelSubtitle="storeplan_v3.png"
      leftPanelContent={<CADToolConfig hasFile fileName="storeplan_v3.png"/>}
      rightInspector={
        <div>
          <SSPanel title="CAD image">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 28, height: 28, borderRadius: 7, background: SS.violetTint, color: SS.violet,
                display: "inline-flex", alignItems: "center", justifyContent: "center", border: `1.5px solid ${SS.violet}`,
              }}>
                <Ico name="cad" size={14}/>
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 600, color: SS.ink }}>storeplan_v3.png</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink3, marginTop: 2 }}>Calibrated · 1 px = 0.0238 m</div>
              </div>
            </div>
          </SSPanel>
          <SSPanel title="Real-world dimensions">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Metric label="Footprint" value="1,632" unit="m²" accent={SS.violet}/>
              <Metric label="Width × Depth" value="48 × 34" unit="m"/>
            </div>
          </SSPanel>
          <SSPanel title="Transform">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <SSField label="Rotation">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: "#E8E2D2", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, width: "8%", background: SS.violet, borderRadius: 999 }}/>
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: SS.ink, width: 44, textAlign: "right" }}>28°</span>
                </div>
              </SSField>
              <SSField label="Opacity">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: "#E8E2D2", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, width: "70%", background: SS.violet, borderRadius: 999 }}/>
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: SS.ink, width: 44, textAlign: "right" }}>70%</span>
                </div>
              </SSField>
              <div style={{
                padding: 10, borderRadius: 8, background: SS.bg,
                border: `1px solid ${SS.borderSoft}`,
                display: "flex", gap: 8, alignItems: "flex-start",
              }}>
                <Ico name="lock" size={13} color={SS.ink3}/>
                <span style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink2, lineHeight: 1.45 }}>
                  Size is locked to your calibrated scale. You can move and rotate the image only.
                </span>
              </div>
            </div>
          </SSPanel>
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <SSButton variant="ghost" icon="ruler" size="sm" full>Recalibrate scale</SSButton>
            <SSButton variant="ghost" icon="upload" size="sm" full>Replace image</SSButton>
            <SSButton variant="danger" icon="trash" size="sm" full>Remove from map</SSButton>
          </div>
        </div>
      }
      mapStyle="satellite"
      mapChildren={() => (
        <g transform={`translate(${cx} ${cy}) rotate(${rotDeg})`}>
          {/* The "raster image" rendered as a translucent white photo-frame
              with the CAD plan inside — same component used in the calibration step */}
          <g opacity="0.78">
            <rect x={-imgW/2} y={-imgH/2} width={imgW} height={imgH} fill="#FAFAF7" stroke={SS.violet} strokeWidth="0.6"/>
            <CADPlanPreview width={imgW} height={imgH}/>
          </g>
          {/* Strong outline so the user can see where the image is */}
          <rect x={-imgW/2} y={-imgH/2} width={imgW} height={imgH} fill="none" stroke={SS.violet} strokeWidth="2"/>
          {/* Corner handles (move only — no resize) */}
          {[
            [-imgW/2, -imgH/2], [imgW/2, -imgH/2],
            [imgW/2, imgH/2],   [-imgW/2, imgH/2],
          ].map(([px, py], i) => (
            <rect key={i} x={px - 4} y={py - 4} width="8" height="8" fill="#FFF" stroke={SS.violet} strokeWidth="1.5"/>
          ))}
          {/* Rotation handle */}
          <line x1={0} y1={-imgH/2} x2={0} y2={-imgH/2 - 26} stroke={SS.violet} strokeWidth="1.5" strokeDasharray="3 3"/>
          <circle cx={0} cy={-imgH/2 - 32} r="9" fill="#FFFFFF" stroke={SS.violet} strokeWidth="2"/>
          {/* Label — counter-rotated so it reads upright on the map */}
          <g transform={`translate(${imgW/2 - 6} ${-imgH/2 + 6}) rotate(${-rotDeg})`}>
            <rect x={-118} y={-14} width={118} height={26} rx={5} fill={SS.violet}/>
            <text x={-8} y={3} textAnchor="end" fontFamily="Inter" fontSize="11" fontWeight="600" fill="#FFF">storeplan_v3 · 1,632 m²</text>
          </g>
        </g>
      )}
      statusLeft={<React.Fragment>
        <span style={{ color: SS.violet, fontWeight: 600 }}>CAD PLACED</span>
        <span style={{ color: SS.ink3 }}>·</span>
        <span>storeplan_v3.png</span>
        <span style={{ color: SS.ink3 }}>·</span>
        <span>1,632 m² · rotation 28° · opacity 70%</span>
      </React.Fragment>}
    />
  );
};

/* === State 5: Saved sketches (left panel shows list) + open flow === */
const StateSaved = ({ width, height, units = "metric" }) => {
  const mw = width - 56 - 304 - 320, mh = height - 56;
  // Pretend we're flying to a sketch — show map with a polygon
  const poly = [
    { x: mw*0.30, y: mh*0.25 },
    { x: mw*0.65, y: mh*0.25 },
    { x: mw*0.65, y: mh*0.55 },
    { x: mw*0.30, y: mh*0.55 },
  ];
  return (
    <SSShell
      width={width} height={height} tool="select" panel="saved" units={units}
      leftPanelTitle="My sketches"
      leftPanelSubtitle="12 saved · synced"
      leftPanelAction={<SSButton variant="ghost" icon="plus" size="sm">New</SSButton>}
      leftPanelContent={
        <div>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${SS.borderSoft}` }}>
            <SSInput placeholder="Filter sketches…" icon="search"/>
          </div>
          <SavedSketches currentId="abbeyville" items={[
            { id: "abbeyville", name: "Abbeyville Retail Park", location: "Wolverhampton · WV1 4DH", polygons: 4, updated: "2 days ago" },
            { id: "bridgwater", name: "Bridgwater Drive-thru", location: "Somerset · TA6 4RR", polygons: 2, updated: "5 days ago" },
            { id: "kestrel", name: "Kestrel Way A1(M)", location: "Hertfordshire · SG4 7DD", polygons: 6, updated: "1 week ago" },
            { id: "deansgate", name: "Deansgate Corner Site", location: "Manchester · M3 4LZ", polygons: 3, updated: "2 weeks ago" },
            { id: "swansea", name: "Swansea Marina", location: "SA1 1JW", polygons: 1, updated: "1 month ago" },
            { id: "kingston", name: "Kingston-upon-Hull HU2", location: "East Yorkshire", polygons: 5, updated: "1 month ago" },
          ]}/>
        </div>
      }
      rightInspector={
        <div>
          <SSPanel title="Sketch info">
            <div style={{ fontFamily: "Inter", fontSize: 15, fontWeight: 600, color: SS.ink, letterSpacing: -0.2 }}>Abbeyville Retail Park</div>
            <div style={{ fontFamily: "Inter", fontSize: 13, color: SS.ink2, marginTop: 4 }}>Wolverhampton · WV1 4DH</div>
            <div style={{
              marginTop: 12, padding: "8px 10px", borderRadius: 8,
              background: SS.violetTintSoft, border: `1px solid ${SS.violetTint}`,
              display: "flex", alignItems: "center", gap: 8, fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10.5, color: SS.violetDeep,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: SS.violet, animation: "ss-pulse 1.4s infinite" }}/>
              FLYING TO LOCATION…
            </div>
          </SSPanel>
          <SSPanel title="Contents">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { c: POLY[0], name: "Main building", area: "1,840 m²" },
                { c: POLY[1], name: "Parking · 64 spaces", area: "874 m²" },
                { c: POLY[2], name: "Loading bay", area: "412 m²" },
                { c: POLY[3], name: "Drive-thru lane", area: "180 m²" },
              ].map((it, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 10px", borderRadius: 7,
                  background: SS.bg, border: `1px solid ${SS.borderSoft}`,
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: it.c.fill, border: `1.5px solid ${it.c.stroke}` }}/>
                  <span style={{ flex: 1, fontFamily: "Inter", fontSize: 12.5, color: SS.ink }}>{it.name}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink3 }}>{it.area}</span>
                </div>
              ))}
            </div>
          </SSPanel>
          <SSPanel title="Activity">
            <div style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink2, lineHeight: 1.55 }}>
              Last edited 2 days ago<br/>
              Created on 4 Feb 2026<br/>
              Auto-saved every change
            </div>
          </SSPanel>
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <SSButton variant="violet" icon="folder" size="md" full>Open sketch</SSButton>
            <SSButton variant="ghost" icon="share" size="sm" full>Share link</SSButton>
            <SSButton variant="danger" icon="trash" size="sm" full>Delete sketch</SSButton>
          </div>
        </div>
      }
      mapStyle="hybrid"
      mapChildren={() => (
        <g>
          {/* Fade overlay while "flying" */}
          <rect width="100%" height="100%" fill="rgba(23,20,25,0.06)"/>
          <SketchPolygon pts={poly} color={POLY[0]} showDistances showArea label="Main building" area={1840} units={units}/>
          {/* Subtle target ring at center */}
          <g transform={`translate(${mw*0.475} ${mh*0.40})`}>
            <circle r="48" fill="none" stroke={SS.violet} strokeWidth="1.4" strokeDasharray="4 6" opacity="0.6"/>
            <circle r="80" fill="none" stroke={SS.violet} strokeWidth="1.2" strokeDasharray="3 8" opacity="0.4"/>
          </g>
        </g>
      )}
      statusLeft={<React.Fragment>
        <span style={{ color: SS.violet, fontWeight: 600 }}>OPENING SKETCH</span>
        <span style={{ color: SS.ink3 }}>·</span>
        <span>Abbeyville Retail Park</span>
        <span style={{ color: SS.ink3 }}>·</span>
        <span>flying to 52.586°N, -2.128°W</span>
      </React.Fragment>}
    />
  );
};

/* === State 6: 3D mode (extruded polygons) === */
const State3D = ({ width, height, units = "metric" }) => {
  const mw = width - 56 - 304 - 320, mh = height - 56;
  // Iso-projected polygons. We'll render footprints + a parallelogram side + top.
  const baseA = [
    { x: mw*0.30, y: mh*0.40 },
    { x: mw*0.58, y: mh*0.40 },
    { x: mw*0.58, y: mh*0.60 },
    { x: mw*0.30, y: mh*0.60 },
  ];
  const baseB = [
    { x: mw*0.62, y: mh*0.50 },
    { x: mw*0.80, y: mh*0.50 },
    { x: mw*0.80, y: mh*0.66 },
    { x: mw*0.62, y: mh*0.66 },
  ];
  // Lift offset (px) — simulate height
  const liftA = 32, liftB = 22;
  const items = [
    { id: "a", name: "Main building", detail: "1,840 m² · 8 m tall", color: POLY[0] },
    { id: "b", name: "Storage annex", detail: "612 m² · 5 m tall", color: POLY[2] },
  ];
  return (
    <SSShell
      width={width} height={height} tool="select" mode3d units={units}
      leftPanelTitle="Sketch (3D)"
      leftPanelSubtitle="Drag the map to orbit"
      leftPanelContent={
        <div>
          <SSPanel title="Layers">
            <div style={{ marginLeft: -16, marginRight: -16 }}>
              <LayersList items={items} selectedId="a"/>
            </div>
          </SSPanel>
          <SSPanel title="Building heights">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map(it => (
                <div key={it.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink2 }}>{it.name}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: SS.ink, fontWeight: 500 }}>{it.id === "a" ? "8 m" : "5 m"}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "#E8E2D2", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, width: it.id === "a" ? "62%" : "40%", background: it.color.stroke, borderRadius: 999 }}/>
                  </div>
                </div>
              ))}
            </div>
          </SSPanel>
          <SSPanel title="Camera">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SSField label="Pitch">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: "#E8E2D2", position: "relative" }}>
                    <div style={{ position: "absolute", inset: 0, width: "64%", background: SS.ink, borderRadius: 999 }}/>
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: SS.ink, width: 36, textAlign: "right" }}>52°</span>
                </div>
              </SSField>
              <SSField label="Bearing">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: "#E8E2D2", position: "relative" }}>
                    <div style={{ position: "absolute", inset: 0, width: "12%", background: SS.ink, borderRadius: 999 }}/>
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: SS.ink, width: 36, textAlign: "right" }}>43°</span>
                </div>
              </SSField>
            </div>
          </SSPanel>
        </div>
      }
      rightInspector={<PolygonInspector poly={{ name: "Main building", color: POLY[0], points: 4, area: 1840, perimeter: 172 }} units={units}/>}
      mapStyle="satellite"
      mapChildren={() => {
        const ExtrudedPoly = ({ pts, lift, color }) => {
          const top = pts.map(p => ({ x: p.x, y: p.y - lift }));
          const topPath = "M " + top.map(p => `${p.x} ${p.y}`).join(" L ") + " Z";
          // Sides: render each visible quad
          // Visible sides: the front and right sides of the rectangle
          const sides = [];
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            const ta = top[i], tb = top[(i + 1) % pts.length];
            // Only render sides where base y > top y of next (i.e. front-facing) — for axis-aligned rect this means edges where the base is "in front"
            // Simpler heuristic: render all sides but with different shades
            const path = `M ${a.x} ${a.y} L ${b.x} ${b.y} L ${tb.x} ${tb.y} L ${ta.x} ${ta.y} Z`;
            // shade: front = lighter, sides = darker, back = darkest
            // Use y of midpoint
            const my = (a.y + b.y) / 2;
            const isFront = my > pts.reduce((s, p) => s + p.y, 0) / pts.length;
            const isRight = (a.x + b.x) / 2 > pts.reduce((s, p) => s + p.x, 0) / pts.length;
            const shade = isFront ? color.stroke : (isRight ? color.stroke : color.stroke);
            const opacity = isFront ? 0.55 : (isRight ? 0.4 : 0.25);
            sides.push({ path, opacity });
          }
          return (
            <g>
              {/* sides */}
              {sides.map((s, i) => (
                <path key={i} d={s.path} fill={color.stroke} opacity={s.opacity} stroke={color.stroke} strokeWidth="0.6"/>
              ))}
              {/* top */}
              <path d={topPath} fill={color.fill} stroke={color.stroke} strokeWidth="2"/>
              {/* top edges highlight */}
            </g>
          );
        };
        return (
          <g>
            <ExtrudedPoly pts={baseB} lift={liftB} color={POLY[2]}/>
            <ExtrudedPoly pts={baseA} lift={liftA} color={POLY[0]}/>
            {/* Selection corner handles + rotate on top of A */}
            {(() => {
              const top = baseA.map(p => ({ x: p.x, y: p.y - liftA }));
              const cx = (top[0].x + top[1].x) / 2, cy = top[0].y;
              return (
                <g>
                  {top.map((p, i) => (
                    <rect key={i} x={p.x - 4} y={p.y - 4} width="8" height="8" fill="#FFF" stroke={POLY[0].stroke} strokeWidth="1.5"/>
                  ))}
                  <line x1={cx} y1={cy} x2={cx} y2={cy - 26} stroke={POLY[0].stroke} strokeWidth="1.4" strokeDasharray="3 3"/>
                  <circle cx={cx} cy={cy - 32} r="8" fill="#FFFFFF" stroke={POLY[0].stroke} strokeWidth="1.6"/>
                </g>
              );
            })()}
            {/* Area readout on top of A */}
            {(() => {
              const cx = (baseA[0].x + baseA[2].x) / 2;
              const cy = (baseA[0].y + baseA[2].y) / 2 - liftA;
              return (
                <g transform={`translate(${cx} ${cy})`}>
                  <rect x={-50} y={-14} width={100} height={28} rx={6} fill="#FFFFFF" stroke={POLY[0].stroke} strokeWidth="1.4"/>
                  <text x={-42} y={4} fontFamily="Inter" fontSize="11.5" fontWeight="600" fill={POLY[0].stroke}>Main</text>
                  <text x={42} y={4} textAnchor="end" fontFamily="'JetBrains Mono', monospace" fontSize="10" fill={SS.ink}>1,840 m²</text>
                </g>
              );
            })()}
          </g>
        );
      }}
      statusLeft={<React.Fragment>
        <span style={{ color: SS.ink, fontWeight: 600 }}>3D MODE</span>
        <span style={{ color: SS.ink3 }}>·</span>
        <span>pitch 52°</span>
        <span style={{ color: SS.ink3 }}>·</span>
        <span>bearing 43°</span>
      </React.Fragment>}
    />
  );
};

/* === State 0: Empty / fresh map === */
const StateEmpty = ({ width, height, units = "metric" }) => (
  <SSShell
    width={width} height={height} tool="select" units={units}
      leftPanelTitle="Sketch"
    leftPanelSubtitle="Empty · pick a tool to start"
    leftPanelAction={<SSButton variant="ghost" icon="plus" size="sm">Add</SSButton>}
    leftPanelContent={
      <div style={{
        padding: 20, display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", gap: 10, marginTop: 20,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: SS.violetTint, color: SS.violet,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <Ico name="polygon" size={22}/>
        </div>
        <div style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 600, color: SS.ink }}>Start sketching</div>
        <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink3, lineHeight: 1.55, maxWidth: 220 }}>
          Pick a tool on the left, then click on the map to drop your first point.
        </div>
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
          <SSButton variant="violet" icon="polygon" size="md" full>Draw a polygon</SSButton>
          <SSButton variant="ghost" icon="parking" size="sm" full>Add parking</SSButton>
          <SSButton variant="ghost" icon="upload" size="sm" full>Upload CAD</SSButton>
        </div>
        <div style={{
          marginTop: 18, padding: 12, borderRadius: 10,
          background: SS.bg, border: `1px solid ${SS.borderSoft}`,
          width: "100%", textAlign: "left",
        }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Shortcut</div>
          <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink2 }}>Search a postcode above to fly there first.</div>
        </div>
      </div>
    }
    rightInspector={<EmptyInspector/>}
    mapStyle="hybrid"
    mapChildren={({ mapW, mapH }) => (
      <g>
        {/* Center crosshair hint */}
        <g transform={`translate(${mapW/2} ${mapH/2})`} opacity="0.6">
          <line x1="-14" y1="0" x2="-4" y2="0" stroke="#FFF" strokeWidth="2" strokeLinecap="round"/>
          <line x1="14" y1="0" x2="4" y2="0" stroke="#FFF" strokeWidth="2" strokeLinecap="round"/>
          <line x1="0" y1="-14" x2="0" y2="-4" stroke="#FFF" strokeWidth="2" strokeLinecap="round"/>
          <line x1="0" y1="14" x2="0" y2="4" stroke="#FFF" strokeWidth="2" strokeLinecap="round"/>
          <circle r="2" fill="#FFF"/>
        </g>
      </g>
    )}
    statusLeft={<React.Fragment>
      <span>Ready</span>
      <span style={{ color: SS.ink3 }}>·</span>
      <span>0 polygons</span>
    </React.Fragment>}
    topBarProps={{ projectName: "Untitled sketch", isLoggedIn: true }}
  />
);

Object.assign(window, { StateEmpty, StateDrawing, StateSelected, StateParking, StateCAD, StateSaved, State3D });
