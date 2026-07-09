/* SiteSketcher — chrome: top bar, left sidebar, right inspector */

/* ===== Reusable bits ===== */
const SSButton = ({ children, variant = "ghost", size = "md", icon, active, onClick, full, ...rest }) => {
  const pad = size === "sm" ? "6px 10px" : (size === "lg" ? "12px 18px" : "9px 14px");
  const fs = size === "sm" ? 12 : (size === "lg" ? 15 : 13);
  const styles = {
    primary: { background: SS.ink, color: "#FFF", border: `1px solid ${SS.ink}` },
    violet:  { background: SS.violet, color: "#FFF", border: `1px solid ${SS.violet}` },
    ghost:   { background: active ? SS.violetTintSoft : SS.surface, color: SS.ink, border: `1px solid ${active ? SS.violet : SS.border}` },
    plain:   { background: "transparent", color: SS.ink, border: "1px solid transparent" },
    danger:  { background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" },
  }[variant];
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: pad,
      fontFamily: "Inter", fontSize: fs, fontWeight: 500, letterSpacing: -0.1,
      borderRadius: 8, cursor: "pointer", width: full ? "100%" : "auto",
      justifyContent: full ? "center" : "flex-start",
      ...styles,
    }} {...rest}>
      {icon && <Ico name={icon} size={14}/>}
      {children}
    </button>
  );
};

const SSToolBtn = ({ icon, label, active, shortcut, onClick, danger }) => (
  <button onClick={onClick} title={label + (shortcut ? ` (${shortcut})` : "")} style={{
    width: 40, height: 40, borderRadius: 9, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
    background: active ? SS.ink : "transparent",
    color: active ? "#FFF" : (danger ? "#DC2626" : SS.ink),
    border: `1px solid ${active ? SS.ink : "transparent"}`,
    transition: "background .12s, color .12s",
  }}>
    <Ico name={icon} size={18}/>
    {shortcut && !active && (
      <span style={{
        position: "absolute", bottom: 3, right: 4,
        fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5,
        color: SS.ink4, letterSpacing: 0.4,
      }}>{shortcut}</span>
    )}
  </button>
);

const SSPanel = ({ title, action, children, style = {} }) => (
  <div style={{ padding: "14px 16px 16px", borderBottom: `1px solid ${SS.borderSoft}`, ...style }}>
    {title && (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
          color: SS.ink3, letterSpacing: 1.2, textTransform: "uppercase",
        }}>{title}</div>
        {action}
      </div>
    )}
    {children}
  </div>
);

const SSRow = ({ children, gap = 8, align = "center", style = {} }) => (
  <div style={{ display: "flex", alignItems: align, gap, ...style }}>{children}</div>
);

const SSField = ({ label, hint, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && <label style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink2, fontWeight: 500 }}>{label}</label>}
    {children}
    {hint && <div style={{ fontFamily: "Inter", fontSize: 11, color: SS.ink3 }}>{hint}</div>}
  </div>
);

const SSInput = ({ value, placeholder, icon, suffix, ...rest }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 10px", background: SS.surface,
    border: `1px solid ${SS.border}`, borderRadius: 8,
    fontFamily: "Inter", fontSize: 13, color: SS.ink,
  }}>
    {icon && <Ico name={icon} size={13} color={SS.ink3}/>}
    <input defaultValue={value} placeholder={placeholder} style={{
      flex: 1, border: "none", outline: "none", background: "transparent",
      fontFamily: "Inter", fontSize: 13, color: SS.ink, minWidth: 0,
    }} {...rest}/>
    {suffix && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: SS.ink3 }}>{suffix}</span>}
  </div>
);

const SSSegmented = ({ options, value, onChange }) => (
  <div style={{
    display: "inline-flex", padding: 3, background: "#F1EDE4",
    border: `1px solid ${SS.border}`, borderRadius: 8, gap: 2, width: "fit-content",
  }}>
    {options.map(o => {
      const active = o.value === value;
      return (
        <button key={o.value} onClick={() => onChange && onChange(o.value)} style={{
          padding: "6px 12px", border: "none", cursor: "pointer",
          borderRadius: 6, fontFamily: "Inter", fontSize: 12, fontWeight: 500,
          background: active ? SS.surface : "transparent",
          color: active ? SS.ink : SS.ink2,
          boxShadow: active ? "0 1px 3px rgba(20,10,40,0.08)" : "none",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}>
          {o.icon && <Ico name={o.icon} size={12}/>}
          {o.label}
        </button>
      );
    })}
  </div>
);

const SSSegmentedFull = ({ options, value, onChange }) => (
  <div style={{
    display: "grid", gridTemplateColumns: `repeat(${options.length}, 1fr)`,
    padding: 3, background: "#F1EDE4",
    border: `1px solid ${SS.border}`, borderRadius: 8, gap: 2,
  }}>
    {options.map(o => {
      const active = o.value === value;
      return (
        <button key={o.value} onClick={() => onChange && onChange(o.value)} style={{
          padding: "7px 8px", border: "none", cursor: "pointer",
          borderRadius: 6, fontFamily: "Inter", fontSize: 12, fontWeight: 500,
          background: active ? SS.surface : "transparent",
          color: active ? SS.ink : SS.ink2,
          boxShadow: active ? "0 1px 3px rgba(20,10,40,0.08)" : "none",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
        }}>
          {o.icon && <Ico name={o.icon} size={12}/>}
          {o.label}
        </button>
      );
    })}
  </div>
);

const SSToggle = ({ checked, label, sublabel, onChange }) => (
  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer" }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: "Inter", fontSize: 13, color: SS.ink, fontWeight: 500 }}>{label}</div>
      {sublabel && <div style={{ fontFamily: "Inter", fontSize: 11.5, color: SS.ink3, marginTop: 1 }}>{sublabel}</div>}
    </div>
    <span style={{
      position: "relative", width: 32, height: 18, borderRadius: 999,
      background: checked ? SS.violet : "#DDD6CA", transition: "background .15s", flexShrink: 0,
    }}>
      <span style={{
        position: "absolute", top: 2, left: checked ? 16 : 2,
        width: 14, height: 14, borderRadius: 999, background: "#FFF",
        boxShadow: "0 1px 2px rgba(0,0,0,0.2)", transition: "left .15s",
      }}/>
    </span>
  </label>
);

/* ===== Top bar ===== */
const SSTopBar = ({ projectName = "Untitled sketch", searchValue = "", showResults = false, isLoggedIn = true, tier = "pro" }) => {
  // tier: "pro" | "free" | "anonymous"
  const isAnon = tier === "anonymous";
  const isFree = tier === "free";
  const isPaid = tier === "pro";
  const canSave = isPaid;

  // Project name pill: "Saved" green when pro, "Free" amber when free, none when anon
  const projectBadge = isPaid ? (
    <span style={{
      marginLeft: 6, padding: "2px 7px", borderRadius: 999,
      background: "#DCFCE7", color: "#15803D",
      fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5,
      fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase",
    }}>Saved</span>
  ) : isFree ? (
    <span style={{
      marginLeft: 6, padding: "2px 7px", borderRadius: 999,
      background: "#FEF3C7", color: "#92400E",
      fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5,
      fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <span style={{ width: 4, height: 4, borderRadius: 999, background: "#D97706" }}/>
      Unsaved
    </span>
  ) : (
    <span style={{
      marginLeft: 6, padding: "2px 7px", borderRadius: 999,
      background: "#FEE2E2", color: "#B91C1C",
      fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5,
      fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <span style={{ width: 4, height: 4, borderRadius: 999, background: "#DC2626" }}/>
      Guest
    </span>
  );

  // Project name when anonymous becomes "Guest sketch"
  const displayedName = isAnon ? "Guest sketch" : projectName;

  // Save button
  const saveBtn = canSave ? (
    <SSButton variant="primary" size="sm" icon="save">Save</SSButton>
  ) : (
    <button style={{
      display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px",
      fontFamily: "Inter", fontSize: 12.5, fontWeight: 600, letterSpacing: -0.1,
      borderRadius: 8, cursor: "pointer", color: "#FFF",
      background: SS.violet, border: `1px solid ${SS.violet}`,
      boxShadow: `0 0 0 3px ${SS.violetTintSoft}`,
    }}>
      <Ico name={isFree ? "sparkle" : "lock"} size={13}/>
      {isFree ? "Upgrade to save" : "Sign in to save"}
    </button>
  );

  // Account chip area
  const accountChip = isPaid ? (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 3px 3px 9px", borderRadius: 999,
      background: SS.bg, border: `1px solid ${SS.border}`,
    }}>
      <span style={{ fontFamily: "Inter", fontSize: 11, color: SS.ink3, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>Pro</span>
      <span style={{
        width: 26, height: 26, borderRadius: 999, background: SS.violet,
        color: "#FFF", fontFamily: "Inter", fontSize: 11.5, fontWeight: 600,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>D</span>
    </div>
  ) : isFree ? (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 3px 3px 9px", borderRadius: 999,
      background: "#FEF3C7", border: "1px solid #FCD34D",
    }}>
      <span style={{ fontFamily: "Inter", fontSize: 11, color: "#92400E", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Free</span>
      <span style={{
        width: 26, height: 26, borderRadius: 999, background: SS.ink,
        color: "#FFF", fontFamily: "Inter", fontSize: 11.5, fontWeight: 600,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>D</span>
    </div>
  ) : (
    <div style={{ display: "inline-flex", gap: 6 }}>
      <button style={{
        padding: "7px 12px", borderRadius: 8, cursor: "pointer",
        background: "transparent", border: `1px solid ${SS.border}`,
        fontFamily: "Inter", fontSize: 12.5, color: SS.ink, fontWeight: 500,
      }}>Sign in</button>
      <button style={{
        padding: "7px 12px", borderRadius: 8, cursor: "pointer",
        background: SS.ink, color: "#FFF", border: `1px solid ${SS.ink}`,
        fontFamily: "Inter", fontSize: 12.5, fontWeight: 600,
      }}>Sign up free</button>
    </div>
  );

  return (
  <div style={{
    height: 56, padding: "0 16px",
    background: SS.surface, borderBottom: `1px solid ${SS.border}`,
    display: "flex", alignItems: "center", gap: 14, position: "relative", zIndex: 30,
  }}>
    <SMLogo height={20}/>
    <div style={{ width: 1, height: 24, background: SS.border, margin: "0 6px" }}/>
    {/* Breadcrumb / project name */}
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <Ico name="folder" size={14} color={SS.ink3}/>
      {isAnon ? (
        <span style={{ fontFamily: "Inter", fontSize: 13, color: SS.ink3 }}>Not signed in</span>
      ) : (
        <React.Fragment>
          <span style={{ fontFamily: "Inter", fontSize: 13, color: SS.ink3 }}>My sketches</span>
          <span style={{ fontFamily: "Inter", fontSize: 13, color: SS.ink3 }}>/</span>
        </React.Fragment>
      )}
      <span style={{ fontFamily: "Inter", fontSize: 13, color: SS.ink, fontWeight: 500 }}>{displayedName}</span>
      {projectBadge}
    </div>

    {/* Search */}
    <div style={{ flex: 1, display: "flex", justifyContent: "center", maxWidth: 600, margin: "0 auto", position: "relative" }}>
      <div style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8,
        padding: "9px 14px", background: SS.bg,
        border: `1px solid ${showResults ? SS.violet : SS.border}`, borderRadius: 10,
        boxShadow: showResults ? `0 0 0 3px ${SS.violetTintSoft}` : "none",
      }}>
        <Ico name="search" size={14} color={SS.ink3}/>
        <input
          defaultValue={searchValue}
          placeholder="Search a location, postcode or address…"
          style={{
            flex: 1, border: "none", outline: "none", background: "transparent",
            fontFamily: "Inter", fontSize: 13.5, color: SS.ink,
          }}
        />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          color: SS.ink3, padding: "2px 6px", borderRadius: 4, background: "#F1EDE4",
        }}>⌘K</span>
      </div>
      {showResults && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, marginTop: 6,
          background: SS.surface, border: `1px solid ${SS.border}`, borderRadius: 10,
          padding: 6, boxShadow: "0 20px 50px -20px rgba(20,10,40,0.25)", zIndex: 40,
        }}>
          {[
            { name: "London Bridge, SE1, London", sub: "Borough · Greater London" },
            { name: "Liverpool Street Station, EC2", sub: "City of London" },
            { name: "London Stansted Airport", sub: "Essex" },
            { name: "Londonderry Road, M20", sub: "Manchester" },
          ].map((r, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 12px", borderRadius: 8, cursor: "pointer",
              background: i === 0 ? SS.violetTintSoft : "transparent",
            }}>
              <Ico name="pin" size={15} color={i === 0 ? SS.violet : SS.ink3}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Inter", fontSize: 13, color: SS.ink, fontWeight: 500 }}>{r.name}</div>
                <div style={{ fontFamily: "Inter", fontSize: 11.5, color: SS.ink3, marginTop: 1 }}>{r.sub}</div>
              </div>
              {i === 0 && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: SS.ink3 }}>↵</span>}
            </div>
          ))}
        </div>
      )}
    </div>

    {/* History */}
    <SSRow gap={4}>
      <SSToolBtn icon="undo" label="Undo" shortcut="⌘Z"/>
      <SSToolBtn icon="redo" label="Redo" shortcut="⇧⌘Z"/>
    </SSRow>
    <div style={{ width: 1, height: 24, background: SS.border }}/>
    <SSButton variant="ghost" size="sm" icon="share">Share</SSButton>
    {saveBtn}
    {accountChip}
  </div>
  );
};

/* ===== Left sidebar — tools + collapsible content ===== */
const TOOL_LIST = [
  { id: "select",  icon: "cursor",  label: "Select",       shortcut: "V" },
  { id: "polygon", icon: "polygon", label: "Draw polygon", shortcut: "P" },
  { id: "parking", icon: "parking", label: "Parking",      shortcut: "K" },
  { id: "cad",     icon: "cad",     label: "Place CAD",    shortcut: "C" },
  { id: "ruler",   icon: "ruler",   label: "Measure",      shortcut: "M" },
];

const SSLeftRail = ({ active = "select", panel = null, onPick, tier = "pro" }) => {
  const cadLocked = tier !== "pro";
  return (
  <div style={{
    width: 56, background: SS.surface, borderRight: `1px solid ${SS.border}`,
    display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0", gap: 4,
    flexShrink: 0,
  }}>
    <div style={{
      fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, color: SS.ink4,
      letterSpacing: 1, textTransform: "uppercase", marginBottom: 4,
    }}>Tools</div>
    {TOOL_LIST.map(t => {
      const locked = t.id === "cad" && cadLocked;
      return (
        <div key={t.id} style={{ position: "relative" }}>
          <div style={{ opacity: locked ? 0.55 : 1 }}>
            <SSToolBtn icon={t.icon} label={t.label} shortcut={t.shortcut}
              active={active === t.id} onClick={() => onPick && onPick(t.id)}/>
          </div>
          {locked && (
            <span style={{
              position: "absolute", top: 2, right: 2,
              width: 14, height: 14, borderRadius: 999,
              background: SS.violet, color: "#FFF",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              border: "1.5px solid #FFF",
              pointerEvents: "none",
            }}>
              <Ico name="lock" size={8}/>
            </span>
          )}
        </div>
      );
    })}
    <div style={{ flex: 1 }}/>
    <div style={{ width: 28, height: 1, background: SS.borderSoft, margin: "6px 0" }}/>
    <SSToolBtn icon="folder" label="Saved sketches" active={panel === "saved"}/>
  </div>
  );
};

const SSLeftPanel = ({ children, title = "Sketch", subtitle, action }) => (
  <div style={{
    width: 304, background: SS.surface, borderRight: `1px solid ${SS.border}`,
    display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden",
  }}>
    <div style={{
      padding: "14px 16px", borderBottom: `1px solid ${SS.borderSoft}`,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "Inter", fontSize: 14, color: SS.ink, fontWeight: 600, letterSpacing: -0.1 }}>{title}</div>
        {subtitle && <div style={{ fontFamily: "Inter", fontSize: 12, color: SS.ink3, marginTop: 1 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
    <div style={{ flex: 1, overflow: "auto" }}>
      {children}
    </div>
  </div>
);

/* === Status bar (bottom of map) === */
const SSStatusBar = ({ left, right, units = "metric" }) => (
  <div style={{
    position: "absolute", left: 12, right: 12, bottom: 12,
    display: "flex", justifyContent: "space-between", alignItems: "center",
    pointerEvents: "none", zIndex: 10,
  }}>
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      padding: "7px 12px", background: "rgba(255,255,255,0.95)",
      backdropFilter: "blur(8px)", border: `1px solid ${SS.border}`,
      borderRadius: 8, fontFamily: "'JetBrains Mono', monospace",
      fontSize: 11, color: SS.ink2, pointerEvents: "auto",
    }}>
      {left}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 10, pointerEvents: "auto" }}>
      {/* Scale bar */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "7px 12px", background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(8px)", border: `1px solid ${SS.border}`, borderRadius: 8,
      }}>
        <div style={{ position: "relative", width: 80, height: 6, borderBottom: `2px solid ${SS.ink}`, borderLeft: `2px solid ${SS.ink}`, borderRight: `2px solid ${SS.ink}` }}/>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: SS.ink2 }}>
          {units === "metric" ? "20 m" : "60 ft"}
        </span>
      </div>
      {right}
    </div>
  </div>
);

/* === Map floating controls (top-right of map) === */
const SSMapControls = ({ mode = "2d", onModeChange, mapStyle = "hybrid", onMapStyleChange, units = "metric", onUnitsChange, sideAnnots = true, onSideAnnots }) => (
  <div style={{
    position: "absolute", top: 12, right: 12, display: "flex", flexDirection: "column", gap: 8, zIndex: 10,
  }}>
    {/* 2D / 3D */}
    <div style={{
      background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)",
      border: `1px solid ${SS.border}`, borderRadius: 10, padding: 3,
      display: "flex", gap: 2,
    }}>
      {[{value:"2d", label:"2D", icon:"square"}, {value:"3d", label:"3D", icon:"cube"}].map(o => {
        const active = mode === o.value;
        return (
          <button key={o.value} onClick={() => onModeChange && onModeChange(o.value)} style={{
            padding: "6px 12px", border: "none", cursor: "pointer", borderRadius: 7,
            background: active ? SS.ink : "transparent", color: active ? "#FFF" : SS.ink,
            fontFamily: "Inter", fontSize: 12, fontWeight: 500,
            display: "inline-flex", alignItems: "center", gap: 5,
          }}>
            <Ico name={o.icon} size={12}/> {o.label}
          </button>
        );
      })}
    </div>
    {/* Units M / FT */}
    <div style={{
      background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)",
      border: `1px solid ${SS.border}`, borderRadius: 10, padding: 3,
      display: "flex", gap: 2,
    }}>
      {[{value:"metric", label:"m"}, {value:"imperial", label:"ft"}].map(o => {
        const active = units === o.value;
        return (
          <button key={o.value} onClick={() => onUnitsChange && onUnitsChange(o.value)} style={{
            flex: 1, padding: "6px 10px", border: "none", cursor: "pointer", borderRadius: 7,
            background: active ? SS.ink : "transparent", color: active ? "#FFF" : SS.ink2,
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
            textTransform: "uppercase",
          }}>{o.label}</button>
        );
      })}
    </div>
    {/* Map style stack */}
    <div style={{
      background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)",
      border: `1px solid ${SS.border}`, borderRadius: 10, padding: 6,
      display: "flex", flexDirection: "column", gap: 4, width: 132,
    }}>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: SS.ink3,
        letterSpacing: 1, textTransform: "uppercase", padding: "2px 4px 4px",
      }}>Map style</div>
      {[{value:"satellite", label:"Satellite"}, {value:"hybrid", label:"Hybrid"}, {value:"streets", label:"Streets"}].map(o => {
        const active = mapStyle === o.value;
        return (
          <button key={o.value} onClick={() => onMapStyleChange && onMapStyleChange(o.value)} style={{
            padding: "6px 10px", border: "none", cursor: "pointer", borderRadius: 6,
            background: active ? SS.violetTintSoft : "transparent",
            color: active ? SS.violetDeep : SS.ink2,
            fontFamily: "Inter", fontSize: 12, fontWeight: active ? 600 : 500,
            textAlign: "left",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            {o.label}
            {active && <Ico name="check" size={11}/>}
          </button>
        );
      })}
      <div style={{ height: 1, background: SS.borderSoft, margin: "2px 4px" }}/>
      <button onClick={() => onSideAnnots && onSideAnnots(!sideAnnots)} style={{
        padding: "6px 10px", border: "none", cursor: "pointer", borderRadius: 6,
        background: "transparent", color: sideAnnots ? SS.ink : SS.ink3,
        fontFamily: "Inter", fontSize: 11.5, fontWeight: 500,
        textAlign: "left",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        Side labels
        <span style={{
          position: "relative", width: 22, height: 12, borderRadius: 999,
          background: sideAnnots ? SS.violet : "#DDD6CA", flexShrink: 0,
        }}>
          <span style={{
            position: "absolute", top: 1.5, left: sideAnnots ? 11 : 1.5,
            width: 9, height: 9, borderRadius: 999, background: "#FFF",
          }}/>
        </span>
      </button>
    </div>
    {/* Zoom + compass */}
    <div style={{
      background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)",
      border: `1px solid ${SS.border}`, borderRadius: 10, padding: 3,
      display: "flex", flexDirection: "column", gap: 2,
    }}>
      <button style={{ padding: 8, border: "none", cursor: "pointer", borderRadius: 7, background: "transparent", color: SS.ink }}>
        <Ico name="plus" size={14}/>
      </button>
      <div style={{ height: 1, background: SS.borderSoft, margin: "0 6px" }}/>
      <button style={{ padding: 8, border: "none", cursor: "pointer", borderRadius: 7, background: "transparent", color: SS.ink }}>
        <Ico name="minus" size={14}/>
      </button>
      <div style={{ height: 1, background: SS.borderSoft, margin: "0 6px" }}/>
      <button style={{ padding: 8, border: "none", cursor: "pointer", borderRadius: 7, background: "transparent", color: SS.ink, position: "relative" }}>
        <svg width="16" height="16" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6" fill="none" stroke={SS.ink} strokeWidth="1.4"/>
          <path d="M8 3.5L9.5 8L8 7L6.5 8Z" fill="#E11D48"/>
          <path d="M8 8L9.5 8L8 12.5L6.5 8Z" fill={SS.ink}/>
        </svg>
      </button>
    </div>
  </div>
);

/* === Settings popover (gear icon area) === */
const SSSettings = ({ units, onUnits, mode3d, on3d, sideAnnots, onSideAnnots, onClose }) => (
  <div style={{
    position: "absolute", top: 12, right: 200, zIndex: 20,
    width: 280, background: SS.surface, border: `1px solid ${SS.border}`,
    borderRadius: 12, padding: 14, boxShadow: "0 24px 60px -20px rgba(20,10,40,0.25)",
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <div style={{ fontFamily: "Inter", fontSize: 14, fontWeight: 600, color: SS.ink }}>Display settings</div>
      <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: SS.ink3 }}>
        <Ico name="close" size={12}/>
      </button>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SSField label="Units">
        <SSSegmentedFull value={units} onChange={onUnits} options={[
          { value: "metric", label: "Metric (m / m²)" },
          { value: "imperial", label: "Imperial (ft / ft²)" },
        ]}/>
      </SSField>
      <SSField label="View">
        <SSSegmentedFull value={mode3d ? "3d" : "2d"} onChange={(v) => on3d(v === "3d")} options={[
          { value: "2d", label: "2D plan", icon: "square" },
          { value: "3d", label: "3D extrude", icon: "cube" },
        ]}/>
      </SSField>
      <SSToggle checked={sideAnnots} onChange={onSideAnnots}
        label="Side length annotations"
        sublabel="Show distances on each polygon edge"/>
    </div>
  </div>
);

Object.assign(window, {
  SSButton, SSToolBtn, SSPanel, SSRow, SSField, SSInput,
  SSSegmented, SSSegmentedFull, SSToggle,
  SSTopBar, SSLeftRail, SSLeftPanel, SSStatusBar, SSMapControls, SSSettings,
  TOOL_LIST,
});
