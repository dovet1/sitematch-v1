/* SiteSketcher — panels content: left "Sketch" panel content for each tool/state, right inspector */

/* ===== Left panel content: Layers list (default state) ===== */
const LayersList = ({ items = [], selectedId, onSelect }) => (
  <div style={{ display: "flex", flexDirection: "column" }}>
    {items.map(it => {
      const selected = it.id === selectedId;
      return (
        <div key={it.id}
          onClick={() => onSelect && onSelect(it.id)}
          style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px",
          borderLeft: `3px solid ${selected ? it.color.stroke : "transparent"}`,
          background: selected ? SS.violetTintSoft : "transparent",
          cursor: "pointer",
        }}>
          <Ico name="drag" size={12} color={SS.ink4}/>
          <span style={{
            width: 12, height: 12, borderRadius: 3,
            background: it.color.fill, border: `1.5px solid ${it.color.stroke}`,
            flexShrink: 0,
          }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Inter", fontSize: 13, color: SS.ink, fontWeight: selected ? 600 : 500, letterSpacing: -0.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3, marginTop: 1 }}>{it.detail}</div>
          </div>
          <button style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: SS.ink3 }}>
            <Ico name={it.hidden ? "eyeoff" : "eye"} size={13}/>
          </button>
        </div>
      );
    })}
  </div>
);

/* ===== Left panel: Saved sketches ===== */
const SavedSketches = ({ items = [], currentId }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: 8 }}>
    {items.map(it => {
      const active = it.id === currentId;
      return (
        <div key={it.id} style={{
          padding: 10, borderRadius: 9, cursor: "pointer",
          background: active ? SS.violetTintSoft : "transparent",
          border: `1px solid ${active ? SS.violet : "transparent"}`,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "Inter", fontSize: 13.5, fontWeight: 600, color: SS.ink, letterSpacing: -0.1 }}>{it.name}</div>
              <div style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink2, marginTop: 2 }}>{it.location}</div>
              <div style={{ display: "flex", gap: 10, marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.ink3 }}>
                <span>{it.polygons} polygons</span>
                <span>·</span>
                <span>{it.updated}</span>
              </div>
            </div>
            <button style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: SS.ink3, flexShrink: 0 }}>
              <Ico name="more" size={14}/>
            </button>
          </div>
          {active && (
            <div style={{
              marginTop: 8, padding: "6px 8px", borderRadius: 6,
              background: SS.surface, border: `1px solid ${SS.border}`,
              display: "flex", alignItems: "center", gap: 6,
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: SS.violetDeep,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: SS.violet }}/>
              Open · flying to location
            </div>
          )}
        </div>
      );
    })}
  </div>
);

/* ===== Left panel: Polygon tool config ===== */
const PolygonToolConfig = ({ rightAngle, onRightAngle, showDistances, onShowDistances, fillColor, onFillColor, snapPoints, onSnapPoints }) => (
  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
    <div style={{
      padding: 12, borderRadius: 10,
      background: SS.violetTintSoft, border: `1px solid ${SS.violetTint}`,
      display: "flex", gap: 10, alignItems: "flex-start",
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 999, background: SS.violet, color: "#FFF",
        fontFamily: "Inter", fontSize: 11, fontWeight: 600,
        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>i</span>
      <div style={{ fontFamily: "Inter", fontSize: 12.5, color: SS.ink2, lineHeight: 1.45 }}>
        Click on the map to drop points. Click the first point to close, or press <kbd style={kbdStyle}>↵</kbd> to finish.
      </div>
    </div>

    <SSField label="Polygon colour">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
        {POLY.map(p => {
          const active = fillColor === p.id;
          return (
            <button key={p.id} onClick={() => onFillColor && onFillColor(p.id)} style={{
              aspectRatio: "1", borderRadius: 8, cursor: "pointer",
              background: p.fill, border: `2px solid ${active ? p.stroke : "transparent"}`,
              padding: 0, position: "relative",
            }}>
              <span style={{
                position: "absolute", inset: 4, borderRadius: 5,
                background: p.fill, border: `1.5px solid ${p.stroke}`,
              }}/>
            </button>
          );
        })}
      </div>
    </SSField>

    <div style={{ height: 1, background: SS.borderSoft }}/>

    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SSToggle
        checked={rightAngle}
        onChange={onRightAngle}
        label="90° mode"
        sublabel="Force the next edge to a right angle"
      />
      <SSToggle
        checked={showDistances}
        onChange={onShowDistances}
        label="Show edge distances"
        sublabel="Live measurement on every edge"
      />
      <SSToggle
        checked={snapPoints}
        onChange={onSnapPoints}
        label="Snap to grid (1m)"
        sublabel="Round points to nearest metre"
      />
    </div>

    <div style={{ height: 1, background: SS.borderSoft }}/>

    <div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink3, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Shortcuts</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 7, columnGap: 12 }}>
        {[
          ["Finish polygon", "↵"], ["Cancel last point", "⌫"],
          ["Toggle 90° mode", "⇧"], ["Close polygon", "Click first point"],
        ].map(([k, v]) => (
          <React.Fragment key={k}>
            <span style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink2 }}>{k}</span>
            <kbd style={kbdStyle}>{v}</kbd>
          </React.Fragment>
        ))}
      </div>
    </div>
  </div>
);

const kbdStyle = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 500,
  padding: "2px 6px", borderRadius: 4,
  background: SS.surface, border: `1px solid ${SS.border}`,
  color: SS.ink2, justifySelf: "end",
};

/* ===== Left panel: Parking tool config ===== */
const ParkingToolConfig = ({ count, onCount, layer, onLayer, size, onSize }) => {
  const totalArea = (layer === "double" ? 2 : 1) * count * (size === "standard" ? 2.4 * 4.8 : 2.7 * 5.0);
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        padding: 12, borderRadius: 10,
        background: SS.violetTintSoft, border: `1px solid ${SS.violetTint}`,
        fontFamily: "Inter", fontSize: 12.5, color: SS.ink2, lineHeight: 1.45,
      }}>
        Configure the block, then click on the map to drop it.
      </div>

      <SSField label="Number of spaces">
        <div style={{
          display: "flex", alignItems: "stretch",
          border: `1px solid ${SS.border}`, borderRadius: 8, overflow: "hidden",
          background: SS.surface,
        }}>
          <button onClick={() => onCount(Math.max(1, count - 1))} style={iconBtn}><Ico name="minus" size={13}/></button>
          <input value={count} onChange={(e) => onCount(parseInt(e.target.value) || 1)} style={{
            flex: 1, border: "none", outline: "none", textAlign: "center",
            fontFamily: "Inter", fontSize: 14, fontWeight: 500, color: SS.ink,
            background: "transparent",
          }}/>
          <button onClick={() => onCount(count + 1)} style={iconBtn}><Ico name="plus" size={13}/></button>
        </div>
      </SSField>

      <SSField label="Layout">
        <SSSegmentedFull value={layer} onChange={onLayer} options={[
          { value: "single", label: "Single row" },
          { value: "double", label: "Double row" },
        ]}/>
      </SSField>

      <SSField label="Stall size">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { v: "standard", title: "Standard", sub: "2.4 × 4.8 m" },
            { v: "larger",   title: "Larger",   sub: "2.7 × 5.0 m" },
          ].map(o => {
            const active = size === o.v;
            return (
              <button key={o.v} onClick={() => onSize(o.v)} style={{
                padding: "10px 12px", textAlign: "left", cursor: "pointer",
                border: `1px solid ${active ? SS.violet : SS.border}`,
                background: active ? SS.violetTintSoft : SS.surface,
                borderRadius: 9,
                outline: active ? `3px solid ${SS.violetTintSoft}` : "none",
              }}>
                <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 600, color: SS.ink }}>{o.title}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink3, marginTop: 2 }}>{o.sub}</div>
              </button>
            );
          })}
        </div>
      </SSField>

      <div style={{
        padding: 12, borderRadius: 10, background: SS.bg, border: `1px solid ${SS.borderSoft}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink3 }}>Block footprint</div>
          <div style={{ fontFamily: "Inter", fontSize: 18, fontWeight: 600, color: SS.ink, marginTop: 2 }}>
            ~{Math.round(totalArea).toLocaleString()} m²
          </div>
        </div>
        <SSButton variant="violet" icon="plus" size="sm">Drop on map</SSButton>
      </div>
    </div>
  );
};

const iconBtn = {
  width: 36, padding: 0, border: "none", cursor: "pointer",
  background: SS.bg, color: SS.ink2,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};

/* ===== Left panel: CAD tool config ===== */
const CADToolConfig = ({ hasFile = false, fileName = "", scale = 100 }) => (
  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
    {!hasFile ? (
      <React.Fragment>
        <div style={{
          border: `2px dashed ${SS.borderHard}`, borderRadius: 12,
          padding: "32px 16px", textAlign: "center", background: SS.bg,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: SS.violetTint, color: SS.violet,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12,
          }}>
            <Ico name="upload" size={22}/>
          </div>
          <div style={{ fontFamily: "Inter", fontSize: 14, color: SS.ink, fontWeight: 600 }}>Upload a CAD image</div>
          <div style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink3, marginTop: 4, lineHeight: 1.5 }}>
            Drop a PNG or JPG of your store plan. We'll ask you for a known dimension to scale it.
          </div>
          <div style={{ marginTop: 14 }}>
            <SSButton variant="ghost" size="sm" icon="upload">Choose file</SSButton>
          </div>
          <div style={{
            marginTop: 14, fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, color: SS.ink3, letterSpacing: 0.4,
          }}>
            PNG · JPG up to 20 MB
          </div>
        </div>
        <div style={{
          padding: 12, borderRadius: 10, background: SS.bg,
          border: `1px solid ${SS.borderSoft}`,
        }}>
          <div style={{ fontFamily: "Inter", fontSize: 12.5, fontWeight: 600, color: SS.ink, marginBottom: 4 }}>How it works</div>
          <ol style={{ margin: 0, paddingLeft: 18, fontFamily: "Inter", fontSize: 12, color: SS.ink2, lineHeight: 1.6 }}>
            <li>Upload a PNG or JPG of your store plan</li>
            <li>Click two points on a known dimension</li>
            <li>Type the real-world distance between them</li>
            <li>We scale, then place it on the map for you to position</li>
          </ol>
        </div>
      </React.Fragment>
    ) : (
      <React.Fragment>
        <div style={{
          padding: 12, borderRadius: 10, background: SS.surface,
          border: `1px solid ${SS.border}`,
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
              <div style={{ fontFamily: "Inter", fontSize: 13, color: SS.ink, fontWeight: 600 }}>{fileName}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink3, marginTop: 2 }}>1.4 MB · PNG · placed on map</div>
            </div>
          </div>
        </div>

        <SSField label="Real-world scale" hint="Calibrated from your two reference points">
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 12px", background: SS.bg,
            border: `1px solid ${SS.border}`, borderRadius: 8,
          }}>
            <Ico name="lock" size={13} color={SS.ink3}/>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: SS.ink }}>1 px = 0.0238 m</span>
            <span style={{ flex: 1 }}/>
            <button style={{
              background: "transparent", border: "none", cursor: "pointer",
              fontFamily: "Inter", fontSize: 11.5, color: SS.violet, fontWeight: 500,
            }}>Recalibrate</button>
          </div>
        </SSField>

        <SSField label="Position">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <SSButton variant="ghost" icon="drag" size="sm" full>Move</SSButton>
            <SSButton variant="ghost" icon="rotate" size="sm" full>Rotate</SSButton>
          </div>
        </SSField>

        <div style={{ height: 1, background: SS.borderSoft }}/>

        <SSButton variant="danger" icon="trash" size="sm" full>Remove from map</SSButton>
      </React.Fragment>
    )}
  </div>
);

/* ===== Right inspector — polygon selected ===== */
const PolygonInspector = ({ poly, units }) => {
  const sqm = poly.area || 1248;
  const peri = poly.perimeter || 162;
  const areaStr = units === "imperial"
    ? `${(sqm * 10.7639).toLocaleString(undefined, { maximumFractionDigits: 0 })} ft²`
    : `${sqm.toLocaleString()} m²`;
  const periStr = units === "imperial" ? `${(peri * 3.281).toFixed(1)} ft` : `${peri} m`;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <SSPanel title="Selected" action={
        <button style={{ background: "transparent", border: "none", cursor: "pointer", color: SS.ink3, padding: 4 }}>
          <Ico name="close" size={13}/>
        </button>
      }>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 7,
            background: poly.color.fill, border: `2px solid ${poly.color.stroke}`,
          }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 600, color: SS.ink, letterSpacing: -0.1 }}>{poly.name}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink3, marginTop: 2 }}>polygon · {poly.points} pts</div>
          </div>
        </div>
      </SSPanel>

      <SSPanel title="Measurements">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Metric label="Area" value={areaStr.split(" ")[0]} unit={areaStr.split(" ")[1]} accent={poly.color.stroke}/>
          <Metric label="Perimeter" value={periStr.split(" ")[0]} unit={periStr.split(" ")[1]}/>
        </div>
        <div style={{ marginTop: 10, padding: "9px 10px", background: SS.bg, borderRadius: 8, border: `1px solid ${SS.borderSoft}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink2, fontWeight: 500 }}>Width × Depth</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: SS.ink }}>
              {units === "metric" ? "42 × 30 m" : "138 × 98 ft"}
            </span>
          </div>
          <div style={{ fontFamily: "Inter", fontSize: 11, color: SS.ink3, marginTop: 2 }}>
            Smallest rectangle this shape fits in — useful for plot sizing
          </div>
        </div>
      </SSPanel>

      <SSPanel title="Transform">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SSField label="Rotation">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                flex: 1, height: 6, borderRadius: 999, background: "#E8E2D2",
                position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", inset: 0, width: "23%", background: SS.violet, borderRadius: 999 }}/>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: SS.ink, width: 44, textAlign: "right" }}>82°</span>
            </div>
          </SSField>
          <SSRow>
            <SSButton variant="ghost" icon="right" size="sm">Snap to N</SSButton>
            <SSButton variant="ghost" icon="rotate" size="sm">Reset</SSButton>
          </SSRow>
        </div>
      </SSPanel>

      <SSPanel title="Display">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SSToggle checked label="Show edge distances" sublabel="Live measurements on each edge"/>
          <SSToggle checked label="Show area readout"/>
          <SSField label="Colour">
            <div style={{ display: "flex", gap: 6 }}>
              {POLY.map(p => {
                const active = p.id === poly.color.id;
                return (
                  <button key={p.id} style={{
                    width: 28, height: 28, borderRadius: 7, padding: 0,
                    background: p.fill, cursor: "pointer",
                    border: `2px solid ${active ? p.stroke : "transparent"}`,
                  }}>
                    <span style={{ display: "block", width: "100%", height: "100%", borderRadius: 5, border: `1.5px solid ${p.stroke}` }}/>
                  </button>
                );
              })}
            </div>
          </SSField>
        </div>
      </SSPanel>

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        <SSButton variant="ghost" icon="folder" size="sm" full>Duplicate</SSButton>
        <SSButton variant="danger" icon="trash" size="sm" full>Delete polygon</SSButton>
      </div>
    </div>
  );
};

const Metric = ({ label, value, unit, accent }) => (
  <div style={{
    padding: 11, borderRadius: 9, background: SS.bg, border: `1px solid ${SS.borderSoft}`,
  }}>
    <div style={{ fontFamily: "Inter", fontSize: 11, color: SS.ink3, fontWeight: 500 }}>{label}</div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
      <span style={{ fontFamily: "Inter", fontSize: 22, fontWeight: 600, color: accent || SS.ink, letterSpacing: -0.5 }}>{value}</span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: SS.ink3 }}>{unit}</span>
    </div>
  </div>
);

/* ===== Right inspector — empty state ===== */
const EmptyInspector = () => (
  <div style={{
    padding: "28px 20px", textAlign: "center", color: SS.ink3,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
  }}>
    <div style={{
      width: 44, height: 44, borderRadius: 12, background: SS.bg,
      border: `1px solid ${SS.borderSoft}`, color: SS.ink4,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>
      <Ico name="cursor" size={20}/>
    </div>
    <div style={{ fontFamily: "Inter", fontSize: 13.5, fontWeight: 600, color: SS.ink }}>Nothing selected</div>
    <div style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink3, lineHeight: 1.5, maxWidth: 220 }}>
      Click a polygon, parking block or CAD outline to inspect and edit it.
    </div>
  </div>
);

/* ===== Right inspector — parking selected ===== */
const ParkingInspector = ({ block, units }) => (
  <div style={{ display: "flex", flexDirection: "column" }}>
    <SSPanel title="Selected">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 7,
          background: block.color.fill, border: `2px solid ${block.color.stroke}`,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <Ico name="parking" size={14} color={block.color.stroke}/>
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 600, color: SS.ink }}>Parking block</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: SS.ink3, marginTop: 2 }}>{block.spaces} spaces · {block.layout}</div>
        </div>
      </div>
    </SSPanel>
    <SSPanel title="Configuration">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SSField label="Stall size">
          <SSSegmentedFull value={block.size} options={[
            { value: "standard", label: "2.4 × 4.8" },
            { value: "larger",   label: "2.7 × 5.0" },
          ]}/>
        </SSField>
        <SSField label="Layout">
          <SSSegmentedFull value={block.layout} options={[
            { value: "single", label: "Single" },
            { value: "double", label: "Double" },
          ]}/>
        </SSField>
        <SSField label="Spaces">
          <SSInput value={block.spaces} suffix="spaces"/>
        </SSField>
      </div>
    </SSPanel>
    <SSPanel title="Measurements">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Metric label="Total spaces" value={block.spaces} unit="cars"/>
        <Metric label="Area" value={units === "metric" ? "276" : "2,971"} unit={units === "metric" ? "m²" : "ft²"} accent={block.color.stroke}/>
      </div>
    </SSPanel>
    <div style={{ padding: 14 }}>
      <SSButton variant="danger" icon="trash" size="sm" full>Delete parking block</SSButton>
    </div>
  </div>
);

Object.assign(window, {
  LayersList, SavedSketches, PolygonToolConfig, ParkingToolConfig, CADToolConfig,
  PolygonInspector, EmptyInspector, ParkingInspector,
});
