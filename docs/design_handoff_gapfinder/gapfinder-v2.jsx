/* GapFinder — redesign in the editorial restraint direction
   Same functionality as the live app, restyled to match the homepage system. */

const G_COLORS = {
  bg: "#FBFAF7",
  bgAlt: "#F5F1E8",
  surface: "#FFFFFF",
  ink: "#171419",
  ink2: "#4A4451",
  ink3: "#7C7588",
  ink4: "#A39CAD",
  border: "#E8E4DC",
  borderSoft: "#EFEBE2",
  violet: "#7033FF",
  violetDeep: "#5421CC",
  violetTint: "#EEE9FF",
  violetTintSoft: "#F5F1FF",
  orange: "#F26B1F",
  green: "#15803D",
  greenTint: "#E7F5EC",
};

const G_CSS = `
.gf-app { position: absolute; inset: 0; background: ${G_COLORS.bg};
  font-family: Inter, sans-serif; color: ${G_COLORS.ink};
  display: grid; grid-template-rows: 64px 1fr; }
.gf-app * { box-sizing: border-box; }

/* === Header chrome ============================================ */
.gf-chrome { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
  padding: 0 24px; border-bottom: 1px solid ${G_COLORS.borderSoft};
  background: ${G_COLORS.bg}; }
.gf-chrome-left { display: flex; align-items: center; gap: 10px; }
.gf-back { width: 30px; height: 30px; border-radius: 7px;
  border: none; background: transparent;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; color: ${G_COLORS.ink3}; }
.gf-back:hover { background: ${G_COLORS.borderSoft}; color: ${G_COLORS.ink}; }
.gf-brand { display: flex; align-items: center; }
.gf-logo { height: 26px; width: auto; mix-blend-mode: multiply; display: block; }
.gf-sidebar-toggle { width: 30px; height: 30px; border-radius: 7px;
  border: none; background: transparent;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; color: ${G_COLORS.ink3}; }
.gf-sidebar-toggle:hover { background: ${G_COLORS.borderSoft}; color: ${G_COLORS.ink}; }
.gf-crumbs { display: flex; align-items: center; gap: 14px;
  font-family: Inter; }
.gf-crumb-back { font-size: 14px; color: ${G_COLORS.ink3}; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px; }
.gf-crumb-sep { width: 1px; height: 18px; background: ${G_COLORS.border}; }
.gf-crumb-tool { display: flex; flex-direction: column; gap: 2px;
  line-height: 1; }
.gf-crumb-kicker { font-family: 'JetBrains Mono', monospace; font-size: 10px;
  letter-spacing: 1.4px; color: ${G_COLORS.violetDeep}; text-transform: uppercase; }
.gf-crumb-name { font-family: Inter; font-size: 17px; font-weight: 600;
  color: ${G_COLORS.ink}; letter-spacing: -0.3px; margin-top: 4px; }

.gf-chrome-right { display: flex; align-items: center; justify-content: flex-end; }
.gf-chrome-search { display: flex; align-items: center; gap: 9px;
  width: 280px; padding: 0 12px; height: 36px;
  background: ${G_COLORS.surface}; border: 1px solid ${G_COLORS.border};
  border-radius: 8px; }
.gf-chrome-search input { flex: 1; border: none; outline: none; background: transparent;
  font-family: Inter; font-size: 13.5px; color: ${G_COLORS.ink}; }
.gf-chrome-search input::placeholder { color: ${G_COLORS.ink4}; }
.gf-search-kbd { font-family: 'JetBrains Mono', monospace; font-size: 10.5px;
  color: ${G_COLORS.ink4}; white-space: nowrap; flex-shrink: 0; letter-spacing: 0.3px; }
.gf-savestate { display: inline-flex; align-items: center; gap: 8px;
  padding: 7px 12px; border-radius: 999px;
  background: ${G_COLORS.surface}; border: 1px solid ${G_COLORS.border};
  font-family: 'JetBrains Mono', monospace; font-size: 10.5px;
  color: ${G_COLORS.ink3}; letter-spacing: 0.9px; text-transform: uppercase; }
.gf-savestate .dot { width: 6px; height: 6px; border-radius: 999px;
  background: ${G_COLORS.green}; }
.gf-share { padding: 9px 16px; border-radius: 10px;
  border: 1px solid ${G_COLORS.border}; background: ${G_COLORS.surface};
  font-family: Inter; font-size: 14px; font-weight: 500;
  color: ${G_COLORS.ink}; cursor: pointer; }
.gf-share.primary { background: ${G_COLORS.ink}; color: white; border-color: ${G_COLORS.ink}; }
.gf-avatar { width: 32px; height: 32px; border-radius: 999px;
  background: ${G_COLORS.violet}; color: white;
  display: inline-flex; align-items: center; justify-content: center;
  font-family: Inter; font-size: 13px; font-weight: 600; }

/* === Body 3-col layout ======================================== */
.gf-body { display: grid; grid-template-columns: 360px 1fr 380px;
  min-height: 0; transition: grid-template-columns 0.25s ease-out; }
.gf-body.collapsed { grid-template-columns: 0 1fr 380px; }
.gf-body.collapsed > .gf-side { display: none; }

/* === Sidebar (left) =========================================== */
.gf-side { background: ${G_COLORS.surface}; border-right: 1px solid ${G_COLORS.border};
  display: flex; flex-direction: column; min-height: 0; }
.gf-side-pad { padding: 22px 24px; }
.gf-tabs { display: inline-flex; gap: 2px; padding: 0;
  background: transparent; border: none; border-radius: 0; }
.gf-tab { display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  height: 36px; padding: 0 13px; border-radius: 8px; border: none;
  background: transparent; cursor: pointer;
  font-family: Inter; font-size: 13.5px; font-weight: 500;
  color: ${G_COLORS.ink2}; letter-spacing: -0.1px; }
.gf-tab:hover { background: ${G_COLORS.borderSoft}; color: ${G_COLORS.ink}; }
.gf-tab.on { background: ${G_COLORS.ink}; color: white; }
.gf-tab.on:hover { background: ${G_COLORS.ink}; color: white; }

.gf-search-label { display: flex; align-items: center; justify-content: space-between;
  margin-top: 24px; margin-bottom: 8px; }
.gf-search-label .lab {
  font-family: 'JetBrains Mono', monospace; font-size: 10.5px;
  letter-spacing: 1.2px; color: ${G_COLORS.ink3}; text-transform: uppercase; }
.gf-search-label .hint {
  font-family: 'JetBrains Mono', monospace; font-size: 10.5px;
  color: ${G_COLORS.ink4}; }
.gf-search { display: flex; align-items: center; gap: 10px;
  padding: 0 14px; height: 44px;
  background: ${G_COLORS.bg}; border: 1px solid ${G_COLORS.border};
  border-radius: 10px; }
.gf-search input { flex: 1; border: none; outline: none; background: transparent;
  font-family: Inter; font-size: 14px; color: ${G_COLORS.ink}; }
.gf-search input::placeholder { color: ${G_COLORS.ink4}; }

/* Section divider w/ kicker */
.gf-sec-hd { display: flex; align-items: center; gap: 12px;
  padding: 26px 24px 12px; }
.gf-sec-hd .line { flex: 1; height: 1px; background: ${G_COLORS.borderSoft}; }
.gf-sec-hd .kicker {
  font-family: 'JetBrains Mono', monospace; font-size: 10.5px;
  letter-spacing: 1.4px; color: ${G_COLORS.ink3}; text-transform: uppercase; }

/* Collapsible filter rows */
.gf-frow { padding: 0 24px; }
.gf-frow + .gf-frow { border-top: 1px solid ${G_COLORS.borderSoft}; }
.gf-frow-hd { display: flex; align-items: center; gap: 10px;
  padding: 16px 0; cursor: pointer; user-select: none; }
.gf-frow-hd .chev { width: 14px; height: 14px; color: ${G_COLORS.ink3};
  transition: transform .15s; }
.gf-frow.open .gf-frow-hd .chev { transform: rotate(90deg); }
.gf-frow-hd .name { flex: 1; font-family: Inter; font-size: 14px; font-weight: 500;
  color: ${G_COLORS.ink}; letter-spacing: -0.1px; }
.gf-frow-hd .val { font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: ${G_COLORS.ink3}; padding: 3px 9px; border-radius: 999px;
  background: ${G_COLORS.bg}; border: 1px solid ${G_COLORS.borderSoft};
  letter-spacing: 0.4px; text-transform: uppercase; }
.gf-frow-hd .val.active { background: ${G_COLORS.violetTintSoft};
  border-color: ${G_COLORS.violetTint}; color: ${G_COLORS.violetDeep}; }
.gf-frow-hd .toggle { width: 32px; height: 18px; border-radius: 999px;
  background: ${G_COLORS.border}; position: relative; flex-shrink: 0; }
.gf-frow-hd .toggle::after { content: ''; position: absolute;
  width: 14px; height: 14px; border-radius: 999px;
  top: 2px; left: 2px; background: white;
  transition: left .15s; }
.gf-frow-hd .toggle.on { background: ${G_COLORS.violet}; }
.gf-frow-hd .toggle.on::after { left: 16px; }

.gf-frow-body { padding: 4px 0 18px; }

/* Slider */
.gf-slider { padding-top: 4px; }
.gf-slider .track { position: relative; height: 4px; border-radius: 999px;
  background: ${G_COLORS.borderSoft}; margin: 18px 0 18px; }
.gf-slider .fill { position: absolute; top: 0; bottom: 0;
  background: ${G_COLORS.ink}; border-radius: 999px; }
.gf-slider .handle { position: absolute; top: 50%; width: 16px; height: 16px;
  border-radius: 999px; background: white; border: 2px solid ${G_COLORS.ink};
  transform: translate(-50%, -50%); }
.gf-slider .vals { display: flex; justify-content: space-between;
  font-family: 'JetBrains Mono', monospace; font-size: 11px; color: ${G_COLORS.ink2};
  letter-spacing: 0.4px; }
.gf-slider .ticks { display: flex; justify-content: space-between;
  margin-top: 10px; gap: 6px; }
.gf-tick { flex: 1; padding: 6px 0; border-radius: 6px; text-align: center;
  font-family: 'JetBrains Mono', monospace; font-size: 11px; cursor: pointer;
  background: ${G_COLORS.bg}; border: 1px solid ${G_COLORS.borderSoft};
  color: ${G_COLORS.ink2}; }
.gf-tick.on { background: ${G_COLORS.ink}; color: white; border-color: ${G_COLORS.ink}; }

/* Checklist */
.gf-check { display: flex; align-items: center; gap: 10px;
  padding: 7px 0; cursor: pointer;
  font-family: Inter; font-size: 14px; color: ${G_COLORS.ink}; }
.gf-checkbox { width: 18px; height: 18px; border-radius: 5px;
  border: 1.5px solid ${G_COLORS.border}; background: ${G_COLORS.surface};
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.gf-checkbox.on { background: ${G_COLORS.violet}; border-color: ${G_COLORS.violet}; }
.gf-check .swatch { width: 14px; height: 14px; border-radius: 4px; flex-shrink: 0; }
.gf-check .count { margin-left: auto;
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: ${G_COLORS.ink3}; }

/* Empty state for Assess Area */
.gf-empty { padding: 28px 22px; margin: 0 24px;
  border: 1.5px dashed ${G_COLORS.border};
  border-radius: 14px; background: ${G_COLORS.bg};
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: 8px; }
.gf-empty .pin-wrap { width: 44px; height: 44px; border-radius: 999px;
  background: ${G_COLORS.violetTintSoft};
  display: inline-flex; align-items: center; justify-content: center;
  margin-bottom: 6px; }
.gf-empty .t { font-family: Inter; font-size: 15px; font-weight: 600;
  color: ${G_COLORS.ink}; letter-spacing: -0.1px; }
.gf-empty .s { font-family: Inter; font-size: 13px; color: ${G_COLORS.ink2};
  line-height: 1.5; max-width: 260px; }
.gf-empty .micro { font-family: 'JetBrains Mono', monospace; font-size: 10.5px;
  letter-spacing: 1px; color: ${G_COLORS.ink3}; text-transform: uppercase;
  margin-top: 4px; }

/* Selected location card */
.gf-loc-card { margin: 0 24px; padding: 16px;
  background: ${G_COLORS.bg}; border: 1px solid ${G_COLORS.border};
  border-radius: 12px; }
.gf-loc-card .micro { font-family: 'JetBrains Mono', monospace; font-size: 10px;
  letter-spacing: 1.2px; color: ${G_COLORS.violetDeep}; text-transform: uppercase; }
.gf-loc-card .place { font-family: Inter; font-size: 15px; font-weight: 600;
  color: ${G_COLORS.ink}; margin-top: 6px; letter-spacing: -0.1px; }
.gf-loc-card .coord { font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: ${G_COLORS.ink3}; margin-top: 2px; }
.gf-loc-card .row { display: flex; gap: 8px; margin-top: 12px; }
.gf-loc-card .row button { flex: 1; padding: 8px 10px; border-radius: 8px;
  border: 1px solid ${G_COLORS.border}; background: ${G_COLORS.surface};
  font-family: Inter; font-size: 13px; color: ${G_COLORS.ink}; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; }

/* === Map (center) ============================================ */
.gf-map { position: relative; overflow: hidden;
  background:
    radial-gradient(ellipse 700px 500px at 35% 38%, #ECE6F6 0%, transparent 60%),
    radial-gradient(ellipse 600px 400px at 70% 65%, #F0EBE2 0%, transparent 60%),
    repeating-linear-gradient(0deg, ${G_COLORS.borderSoft} 0 1px, transparent 1px 80px),
    repeating-linear-gradient(90deg, ${G_COLORS.borderSoft} 0 1px, transparent 1px 80px),
    #F4F1EA; }
.gf-map-svg { position: absolute; inset: 0; }
.gf-controls { position: absolute; top: 16px; right: 16px;
  display: flex; flex-direction: column; gap: 8px; }
.gf-mode { display: inline-flex; padding: 4px; gap: 4px;
  background: ${G_COLORS.surface}; border: 1px solid ${G_COLORS.border};
  border-radius: 10px; box-shadow: 0 8px 20px -10px rgba(20,10,40,0.12); }
.gf-mode button { padding: 6px 12px; border-radius: 7px; border: none;
  background: transparent; cursor: pointer;
  font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600;
  color: ${G_COLORS.ink2}; letter-spacing: 0.6px;
  display: inline-flex; align-items: center; gap: 6px; }
.gf-mode button.on { background: ${G_COLORS.ink}; color: white; }

.gf-zoom { display: flex; flex-direction: column;
  background: ${G_COLORS.surface}; border: 1px solid ${G_COLORS.border};
  border-radius: 10px; overflow: hidden;
  box-shadow: 0 8px 20px -10px rgba(20,10,40,0.12); }
.gf-zoom button { width: 36px; height: 36px; border: none;
  background: transparent; cursor: pointer; color: ${G_COLORS.ink};
  display: inline-flex; align-items: center; justify-content: center; }
.gf-zoom button + button { border-top: 1px solid ${G_COLORS.borderSoft}; }

.gf-attribution { position: absolute; bottom: 12px; right: 16px;
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  color: ${G_COLORS.ink3}; letter-spacing: 0.4px;
  background: rgba(255,255,255,0.85); padding: 4px 8px; border-radius: 6px;
  border: 1px solid ${G_COLORS.borderSoft}; }

/* Map pins (blue dots = brand locations) */
.gf-dot { position: absolute; width: 6px; height: 6px; border-radius: 999px;
  background: #2A6FDB; transform: translate(-50%, -50%); }
.gf-dot.lg { width: 9px; height: 9px; background: #1E4FBA; }
.gf-pin-violet { position: absolute; transform: translate(-50%, -100%);
  filter: drop-shadow(0 4px 8px rgba(40,20,80,0.3)); }
.gf-pin-violet svg { display: block; }

/* Selection circle (radius) */
.gf-radius { position: absolute; transform: translate(-50%, -50%);
  border-radius: 999px;
  background: rgba(112, 51, 255, 0.08);
  border: 2px solid ${G_COLORS.violet};
  pointer-events: none; }

/* Floating count tag bottom-left */
.gf-count-chip { position: absolute; bottom: 16px; left: 16px;
  padding: 8px 12px; border-radius: 999px;
  background: ${G_COLORS.surface}; border: 1px solid ${G_COLORS.border};
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: ${G_COLORS.ink2}; letter-spacing: 0.6px; text-transform: uppercase;
  box-shadow: 0 8px 20px -10px rgba(20,10,40,0.12);
  display: inline-flex; align-items: center; gap: 8px; }
.gf-count-chip .dot { width: 7px; height: 7px; border-radius: 999px;
  background: ${G_COLORS.violet}; }

.gf-user-fab { position: absolute; bottom: 16px; left: 16px;
  width: 38px; height: 38px; border-radius: 999px;
  background: ${G_COLORS.surface}; border: 1px solid ${G_COLORS.border};
  display: inline-flex; align-items: center; justify-content: center;
  font-family: Inter; font-size: 13px; font-weight: 600; color: ${G_COLORS.ink};
  box-shadow: 0 8px 20px -10px rgba(20,10,40,0.18); cursor: pointer; }

/* Scale bar */
.gf-scalebar { position: absolute; bottom: 18px; left: 70px;
  display: flex; align-items: center; gap: 8px;
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  color: ${G_COLORS.ink3}; letter-spacing: 0.4px; }
.gf-scalebar .bar { width: 56px; height: 2px; background: ${G_COLORS.ink2}; }

/* === Results panel (right) =================================== */
.gf-results { background: ${G_COLORS.surface};
  border-left: 1px solid ${G_COLORS.border};
  display: flex; flex-direction: column; min-height: 0; }
.gf-results-hd { padding: 22px 24px 16px;
  border-bottom: 1px solid ${G_COLORS.borderSoft}; }
.gf-results-row { display: flex; align-items: center; justify-content: space-between;
  gap: 12px; }
.gf-results-kicker { font-family: 'JetBrains Mono', monospace; font-size: 10.5px;
  letter-spacing: 1.4px; color: ${G_COLORS.violetDeep}; text-transform: uppercase; }
.gf-results-title { font-family: Inter; font-size: 20px; font-weight: 600;
  color: ${G_COLORS.ink}; letter-spacing: -0.3px; margin-top: 6px; }
.gf-iconbtn { width: 36px; height: 36px; border-radius: 10px;
  border: 1px solid ${G_COLORS.border}; background: ${G_COLORS.surface};
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  color: ${G_COLORS.ink}; flex-shrink: 0; }
.gf-iconbtn.tinted { background: ${G_COLORS.violetTintSoft};
  border-color: ${G_COLORS.violetTint}; color: ${G_COLORS.violetDeep}; }

.gf-results-meta { margin-top: 14px; display: flex; align-items: baseline; gap: 8px; }
.gf-results-meta .big { font-family: Inter; font-size: 24px; font-weight: 600;
  color: ${G_COLORS.ink}; letter-spacing: -0.5px; }
.gf-results-meta .of { font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: ${G_COLORS.ink3}; letter-spacing: 0.6px; text-transform: uppercase; }
.gf-results-meta .progress { flex: 1; height: 3px; border-radius: 999px;
  background: ${G_COLORS.borderSoft}; overflow: hidden; }
.gf-results-meta .progress .fill { height: 100%; background: ${G_COLORS.violet}; }

.gf-results-sort { display: flex; align-items: center; justify-content: space-between;
  margin-top: 14px;
  font-family: 'JetBrains Mono', monospace; font-size: 10.5px;
  letter-spacing: 1.2px; color: ${G_COLORS.ink3}; text-transform: uppercase; }
.gf-results-sort .arr { color: ${G_COLORS.ink2}; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px; }

.gf-results-list { flex: 1; overflow: auto; padding: 4px 0; }
.gf-loc { display: grid; grid-template-columns: 24px 1fr;
  align-items: center; gap: 14px; padding: 14px 24px;
  cursor: pointer; border-bottom: 1px solid ${G_COLORS.borderSoft}; }
.gf-loc:hover { background: ${G_COLORS.bg}; }
.gf-loc .pin { color: ${G_COLORS.violet}; }
.gf-loc .name { font-family: Inter; font-size: 15px; font-weight: 500;
  color: ${G_COLORS.ink}; letter-spacing: -0.1px; }
.gf-loc .meta { font-family: 'JetBrains Mono', monospace; font-size: 10.5px;
  letter-spacing: 0.8px; color: ${G_COLORS.ink3}; text-transform: uppercase;
  margin-top: 3px; }
.gf-loc .arr { color: ${G_COLORS.ink4}; }

/* Empty / hint state on results panel */
.gf-results-empty { padding: 32px 32px;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: 10px; }
.gf-results-empty .ico { width: 48px; height: 48px; border-radius: 12px;
  background: ${G_COLORS.violetTintSoft}; border: 1px solid ${G_COLORS.violetTint};
  display: inline-flex; align-items: center; justify-content: center; }
.gf-results-empty .t { font-family: Inter; font-size: 15px; font-weight: 600;
  color: ${G_COLORS.ink}; letter-spacing: -0.1px; }
.gf-results-empty .s { font-family: Inter; font-size: 13px; line-height: 1.55;
  color: ${G_COLORS.ink2}; max-width: 260px; }

/* Brand-list rows (Nearby brands etc) */
.gf-brandrow { display: grid; grid-template-columns: 32px 1fr auto;
  gap: 12px; align-items: center; padding: 13px 24px;
  border-bottom: 1px solid ${G_COLORS.borderSoft}; cursor: pointer; }
.gf-brandrow:hover { background: ${G_COLORS.bg}; }
.gf-brand-logo { width: 32px; height: 32px; border-radius: 7px;
  display: inline-flex; align-items: center; justify-content: center;
  font-family: Inter; font-weight: 700; font-size: 12px; color: white;
  letter-spacing: -0.3px; flex-shrink: 0; }
.gf-brand-name { font-family: Inter; font-size: 14px; font-weight: 500;
  color: ${G_COLORS.ink}; letter-spacing: -0.1px; }
.gf-brand-meta { font-family: 'JetBrains Mono', monospace; font-size: 10.5px;
  color: ${G_COLORS.ink3}; letter-spacing: 0.6px; text-transform: uppercase;
  margin-top: 3px; }
.gf-brand-dist { font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: ${G_COLORS.ink2}; text-align: right; }
.gf-brand-dist .lbl { display: block; font-size: 10px;
  color: ${G_COLORS.ink3}; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 2px; }

/* Missing-brands collapsible bottom panel */
.gf-missing { border-top: 1px solid ${G_COLORS.border};
  padding: 0; background: ${G_COLORS.bg}; }
.gf-missing-hd { display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px; cursor: pointer; }
.gf-missing-hd .l { display: flex; align-items: center; gap: 10px; }
.gf-missing-hd .name { font-family: Inter; font-size: 14px; font-weight: 600;
  color: ${G_COLORS.ink}; }
.gf-missing-hd .count { padding: 2px 9px; border-radius: 999px;
  background: ${G_COLORS.violet}; color: white;
  font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; }
.gf-missing-body { padding: 4px 16px 18px;
  display: flex; flex-wrap: wrap; gap: 6px; }
.gf-missing-tag { padding: 5px 10px; border-radius: 6px;
  background: ${G_COLORS.surface}; border: 1px solid ${G_COLORS.border};
  font-family: Inter; font-size: 12px; color: ${G_COLORS.ink}; }
.gf-missing-tag .dot { display: inline-block; width: 6px; height: 6px;
  border-radius: 999px; background: ${G_COLORS.violet}; margin-right: 6px; }

/* === Context hint strip ========================================== */
.gf-ctx-hint { display: flex; align-items: flex-start; gap: 9px;
  margin-top: 0; padding: 11px 13px; border-radius: 10px;
  background: ${G_COLORS.violetTintSoft}; border: 1px solid ${G_COLORS.violetTint}; }
.gf-ctx-hint .icon { flex-shrink: 0; color: ${G_COLORS.violetDeep}; margin-top: 1px; }
.gf-ctx-hint .text { font-family: Inter; font-size: 12.5px; line-height: 1.5; color: ${G_COLORS.ink2}; }
.gf-ctx-hint .text strong { color: ${G_COLORS.ink}; font-weight: 600; }

/* === Results subtitle ============================================ */
.gf-results-desc { font-family: Inter; font-size: 12px; color: ${G_COLORS.ink3}; margin-top: 3px; line-height: 1.4; }

/* === Map legend ================================================== */
.gf-legend { position: absolute; bottom: 50px; left: 16px;
  padding: 8px 12px; border-radius: 9px;
  background: rgba(255,255,255,0.94); border: 1px solid ${G_COLORS.borderSoft};
  display: flex; flex-direction: column; gap: 6px;
  box-shadow: 0 2px 8px -2px rgba(20,10,40,0.1); }
.gf-legend-item { display: flex; align-items: center; gap: 7px;
  font-family: 'JetBrains Mono', monospace; font-size: 9.5px;
  color: ${G_COLORS.ink2}; letter-spacing: 0.5px; text-transform: uppercase; }
.gf-legend-dot { width: 7px; height: 7px; border-radius: 999px; flex-shrink: 0; }
.gf-legend-ring { width: 9px; height: 9px; border-radius: 999px; flex-shrink: 0;
  border: 2px solid ${G_COLORS.violet}; background: rgba(112,51,255,0.15); }

/* === Gap city rings on map ======================================= */
.gf-gap-city { position: absolute; transform: translate(-50%, -50%);
  border-radius: 999px; border: 2px solid ${G_COLORS.violet};
  background: rgba(112,51,255,0.1); pointer-events: none; }

/* === Assess steps ================================================ */
.gf-steps { padding: 4px 0 6px; }
.gf-step { display: flex; align-items: flex-start; gap: 12px; padding: 13px 24px; }
.gf-step + .gf-step { border-top: 1px solid ${G_COLORS.borderSoft}; }
.gf-step-n { width: 22px; height: 22px; border-radius: 999px; flex-shrink: 0;
  background: ${G_COLORS.violetTintSoft}; border: 1.5px solid ${G_COLORS.violetTint};
  display: inline-flex; align-items: center; justify-content: center;
  font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600;
  color: ${G_COLORS.violetDeep}; }
.gf-step-title { font-family: Inter; font-size: 13px; font-weight: 600;
  color: ${G_COLORS.ink}; letter-spacing: -0.1px; margin-bottom: 2px; }
.gf-step-sub { font-family: Inter; font-size: 12px; color: ${G_COLORS.ink3}; line-height: 1.4; }
`;

/* ----- Mock data ------------------------------------------------ */
const LOCATIONS = [
  { name: "Birmingham", pop: "1,121,375", verified: "ENGLAND",  x: 42, y: 57 },
  { name: "Glasgow",    pop: "612,444",   verified: "SCOTLAND", x: 33, y: 30 },
  { name: "Liverpool",  pop: "506,565",   verified: "ENGLAND",  x: 36, y: 44 },
  { name: "Leeds",      pop: "504,713",   verified: "ENGLAND",  x: 41, y: 37 },
  { name: "Sheffield",  pop: "500,535",   verified: "ENGLAND",  x: 42, y: 42 },
  { name: "Manchester", pop: "470,405",   verified: "ENGLAND",  x: 38, y: 43 },
  { name: "Edinburgh",  pop: "458,492",   verified: "SCOTLAND", x: 37, y: 24 },
  { name: "Bristol",    pop: "425,215",   verified: "ENGLAND",  x: 36, y: 65 },
  { name: "Leicester",  pop: "406,580",   verified: "ENGLAND",  x: 44, y: 53 },
  { name: "Croydon",    pop: "377,211",   verified: "ENGLAND",  x: 46, y: 73 },
  { name: "Coventry",   pop: "352,911",   verified: "ENGLAND",  x: 43, y: 55 },
  { name: "Cardiff",    pop: "335,145",   verified: "WALES",    x: 35, y: 67 },
];

const NEARBY_BRANDS = [
  { name: "Allpress Espresso", sector: "Food & Beverage", initials: "AE", color: "#6F4A2E", dist: "0.4 km" },
  { name: "Goodhood",          sector: "Retail",          initials: "GH", color: "#171419", dist: "0.7 km" },
  { name: "ShakeDown",         sector: "Food & Beverage", initials: "SD", color: "#E8B22A", dist: "1.1 km" },
  { name: "Card Factory",      sector: "Retail",          initials: "CF", color: "#2A5DD1", dist: "1.4 km" },
  { name: "The Entertainer",   sector: "Retail",          initials: "TE", color: "#E0392F", dist: "1.8 km" },
  { name: "Knoops",            sector: "Food & Beverage", initials: "K",  color: "#1F1A14", dist: "2.2 km" },
  { name: "Rodd & Gunn",       sector: "Retail",          initials: "R&", color: "#2C3F2A", dist: "2.7 km" },
  { name: "Ben's Greengrocers",sector: "Retail",          initials: "BG", color: "#7A1F2E", dist: "3.4 km" },
];

const MISSING_BRANDS = [
  "Pret A Manger", "Pure", "Joe & The Juice", "LEON",
  "Itsu", "Wagamama", "Five Guys", "Honest Burgers",
  "Crosstown", "Boots", "Lush", "Rituals",
];

/* ----- SVG icons ----------------------------------------------- */
const IcChevR = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
    <path d="M5 3L9 7L5 11" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcArrow = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
    <path d="M3 7H11M11 7L8 4M11 7L8 10" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcSearch = ({ color = "currentColor" }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="7" cy="7" r="5" stroke={color} strokeWidth="1.5"/>
    <path d="M11 11L14 14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IcPinFilled = ({ size = 18, color }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M8 1C5 1 3 3.2 3 6c0 3.6 5 9 5 9s5-5.4 5-9c0-2.8-2-5-5-5Z" fill={color}/>
    <circle cx="8" cy="6" r="1.7" fill="white"/>
  </svg>
);
const IcPinLine = ({ size = 16, color }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.4 4.5 8 4.5 8s4.5-4.6 4.5-8c0-2.5-2-4.5-4.5-4.5Z" stroke={color} strokeWidth="1.5"/>
    <circle cx="8" cy="6" r="1.6" stroke={color} strokeWidth="1.5"/>
  </svg>
);
const IcDownload = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M8 2V10M8 10L5 7M8 10L11 7M3 13H13" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcLayers2D = ({ color = "currentColor" }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M8 2L2 5L8 8L14 5L8 2Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);
const IcLayers3D = ({ color = "currentColor" }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M8 2L2 5L8 8L14 5L8 2Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M2 9L8 12L14 9" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);

/* ===== Header chrome ========================================== */
const GF_Chrome = ({ mode = "find", sidebarOpen = true, onToggleSidebar = () => {} }) => (
  <header className="gf-chrome" data-screen-label="App chrome">
    <div className="gf-chrome-left">
      <div className="gf-brand">
        <img src="sitematcher-logo.png" alt="GapFinder" className="gf-logo"/>
      </div>
      <button className="gf-sidebar-toggle" onClick={onToggleSidebar} aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
          <line x1="6.5" y1="3.5" x2="6.5" y2="12.5" stroke="currentColor" strokeWidth="1.4"/>
        </svg>
      </button>
    </div>
    <GF_Tabs mode={mode}/>
    <div className="gf-chrome-right">
      <div className="gf-chrome-search">
        <IcSearch color={G_COLORS.ink3}/>
        <input placeholder="Search for a location…"/>
        <span className="gf-search-kbd">⌘K</span>
      </div>
    </div>
  </header>
);

/* ===== Mode tabs ============================================= */
const GF_Tabs = ({ mode }) => (
  <div className="gf-tabs">
    <button className={`gf-tab${mode === "find" ? " on" : ""}`}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      Find Gaps
    </button>
    <button className={`gf-tab${mode === "assess" ? " on" : ""}`}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.4 4.5 8 4.5 8s4.5-4.6 4.5-8c0-2.5-2-4.5-4.5-4.5Z" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
      Assess Area
    </button>
  </div>
);

/* ===== FILTER ROW ============================================ */
const GF_FRow = ({ name, value, valueActive, open, toggle, children }) => (
  <div className={`gf-frow${open ? " open" : ""}`}>
    <div className="gf-frow-hd">
      <svg className="chev" viewBox="0 0 14 14" fill="none">
        <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className="name">{name}</span>
      {toggle != null ? (
        <span className={`toggle${toggle ? " on" : ""}`}/>
      ) : (
        <span className={`val${valueActive ? " active" : ""}`}>{value}</span>
      )}
    </div>
    {open && <div className="gf-frow-body">{children}</div>}
  </div>
);

/* ===== Context hint ========================================== */
const GF_ContextHint = ({ mode }) => (
  <div className="gf-ctx-hint">
    <svg className="icon" width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="11.5" r="0.75" fill="currentColor"/>
    </svg>
    <span className="text">
      {mode === "find"
        ? <span>Pick <strong>Brands</strong> in Filters below — the map and list show cities where those brands have <strong>no store yet</strong>.</span>
        : <span><strong>Click the map</strong> to drop a pin. We'll show every brand trading within your radius, and who's <strong>absent</strong>.</span>
      }
    </span>
  </div>
);

/* ===== Map legend ============================================ */
const GF_MapLegend = ({ mode }) => (
  <div className="gf-legend">
    <div className="gf-legend-item">
      <span className="gf-legend-dot" style={{ background: "#2A6FDB" }}/>
      <span>Existing stores</span>
    </div>
    {mode === "find" && (
      <div className="gf-legend-item">
        <span className="gf-legend-ring"/>
        <span>Gap cities</span>
      </div>
    )}
  </div>
);

/* ===== Sidebar (Find Gaps) =================================== */
const GF_SideFind = ({ openFilter = null }) => (
  <aside className="gf-side" data-screen-label="Sidebar">
    <div className="gf-side-pad">
      <GF_ContextHint mode="find"/>
    </div>

    <div className="gf-sec-hd">
      <span className="line"/>
      <span className="kicker">Overlay</span>
      <span className="line"/>
    </div>
    <GF_FRow name="Requirement Locations" toggle={false}/>
    <GF_FRow name="Traffic" toggle={false}/>

    <div className="gf-sec-hd">
      <span className="line"/>
      <span className="kicker">Filters</span>
      <span className="line"/>
    </div>
    <GF_FRow name="Population" value="All" open={openFilter === "population"}>
      <div className="gf-slider">
        <div className="track">
          <div className="fill" style={{ left: "0%", right: "20%" }}/>
          <div className="handle" style={{ left: "0%" }}/>
          <div className="handle" style={{ left: "80%" }}/>
        </div>
        <div className="vals"><span>0</span><span>500k+</span></div>
        <div className="ticks">
          <span className="gf-tick">10k</span>
          <span className="gf-tick">50k</span>
          <span className="gf-tick on">100k</span>
          <span className="gf-tick">250k</span>
        </div>
      </div>
    </GF_FRow>
    <GF_FRow name="Brands" value="All" open={openFilter === "brands"}>
      {[
        { n: "Allpress Espresso", c: "#6F4A2E", k: 847, on: true },
        { n: "Goodhood", c: "#171419", k: 1240, on: true },
        { n: "ShakeDown", c: "#E8B22A", k: 532, on: true },
        { n: "Card Factory", c: "#2A5DD1", k: 218, on: false },
        { n: "The Entertainer", c: "#E0392F", k: 164, on: false },
        { n: "Knoops", c: "#1F1A14", k: 92, on: false },
      ].map((b, i) => (
        <div key={i} className="gf-check">
          <span className={`gf-checkbox${b.on ? " on" : ""}`}>
            {b.on && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5L4.5 8L9 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </span>
          <span className="swatch" style={{ background: b.c }}/>
          <span>{b.n}</span>
          <span className="count">{b.k}</span>
        </div>
      ))}
    </GF_FRow>
  </aside>
);

/* ===== Sidebar (Assess Area) ================================ */
const GF_SideAssess = ({ selected = false, openFilter = null }) => (
  <aside className="gf-side" data-screen-label="Sidebar">
    <div className="gf-side-pad">
      <GF_ContextHint mode="assess"/>
    </div>

    <div className="gf-sec-hd">
      <span className="line"/>
      <span className="kicker">Selection</span>
      <span className="line"/>
    </div>

    {!selected ? (
      <div className="gf-steps">
        {[
          { n: "1", title: "Drop a pin", sub: "Click anywhere on the map" },
          { n: "2", title: "Set your radius", sub: "1 km to 25 km — adjust below" },
          { n: "3", title: "Read the landscape", sub: "Brands present + who's missing" },
        ].map((s) => (
          <div key={s.n} className="gf-step">
            <span className="gf-step-n">{s.n}</span>
            <div>
              <div className="gf-step-title">{s.title}</div>
              <div className="gf-step-sub">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="gf-loc-card">
        <div className="micro">Anchor point · saved</div>
        <div className="place">Manchester city centre</div>
        <div className="coord">53.4808° N · 2.2426° W · M1 1AE</div>
        <div className="row">
          <button>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6H10M2 6L5 3M2 6L5 9" stroke={G_COLORS.ink2} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Move
          </button>
          <button>Clear</button>
        </div>
      </div>
    )}

    <div className="gf-sec-hd">
      <span className="line"/>
      <span className="kicker">Parameters</span>
      <span className="line"/>
    </div>

    <GF_FRow name="Radius" value="5 km" valueActive open={openFilter === "radius"}>
      <div className="gf-slider">
        <div className="track">
          <div className="fill" style={{ left: "0%", right: "60%" }}/>
          <div className="handle" style={{ left: "40%" }}/>
        </div>
        <div className="vals"><span>0.5 km</span><span>25 km</span></div>
        <div className="ticks">
          <span className="gf-tick">1</span>
          <span className="gf-tick">2</span>
          <span className="gf-tick on">5</span>
          <span className="gf-tick">10</span>
          <span className="gf-tick">25</span>
        </div>
      </div>
    </GF_FRow>
    <GF_FRow name="Brands" value="All"/>
    <GF_FRow name="Requirement Locations" toggle={false}/>
  </aside>
);

/* ===== Mock UK map ========================================== */
const UKMap = ({ mode = "find", radius = false, anchor = null }) => {
  // tiny svg-driven map. Faint UK silhouette + scattered brand dots.
  // Coordinates are arbitrary % so we get a believable distribution.
  const dots = [
    // major cities clusters
    [44, 70, "lg"], [44, 71], [45, 69], [45, 72], [43, 70], // London
    [38, 42, "lg"], [37, 41], [39, 42], [38, 43], // Manchester / Liverpool
    [40, 36], [41, 35], [42, 37], // Leeds
    [34, 32, "lg"], [35, 31], [33, 32], // Edinburgh / Glasgow
    [42, 56], [43, 54], [41, 58], // Birmingham
    [36, 64], // Bristol/Cardiff
    [50, 60], [51, 58], [49, 62], // Norwich/Ipswich
    [33, 76], // Brighton
    [22, 50], // Northern Ireland (Belfast)
    [27, 56], // Dublin area
    [30, 40], // Glasgow secondary
    [42, 64], [43, 65],
    [45, 50], [46, 52], [44, 51],
    [40, 48], [41, 49],
    [38, 60], [39, 62],
    [33, 36], [34, 38],
    [27, 28], [28, 30],
    [46, 76], [47, 74],
    [50, 56], [51, 58],
    [35, 50], [36, 52], [37, 53],
  ];

  return (
    <div className="gf-map" data-screen-label="Map">
      {/* faint UK silhouette */}
      <svg className="gf-map-svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet">
        {/* Great Britain mainland (rough) */}
        <g opacity="0.55">
          <path d="
            M380 240 Q330 220 330 280
            Q300 280 290 320 Q280 360 320 380
            Q320 420 290 450 Q280 500 330 510
            Q310 560 350 600 Q380 640 360 680
            Q400 720 420 760 Q440 820 480 840
            Q520 820 540 760 Q560 700 540 660
            Q580 640 600 600 Q620 540 580 510
            Q600 470 580 430 Q560 380 520 370
            Q540 320 500 290 Q460 260 420 270
            Q400 240 380 240 Z"
            fill="#E2DBC9" stroke="#C9C1AA" strokeWidth="1.5"/>
          {/* Ireland */}
          <path d="
            M180 460 Q150 440 160 490
            Q140 520 160 560 Q150 600 190 610
            Q230 620 250 580 Q270 540 260 500
            Q240 460 180 460 Z"
            fill="#E2DBC9" stroke="#C9C1AA" strokeWidth="1.5"/>
          {/* Scotland highlands fade */}
          <path d="M340 220 Q320 180 360 160 Q400 150 420 200 Q430 240 380 240 Q360 240 340 220 Z"
            fill="#E2DBC9" stroke="#C9C1AA" strokeWidth="1.5"/>
        </g>
      </svg>

      {/* Brand-location dots */}
      {dots.map((d, i) => (
        <span key={i}
          className={`gf-dot${d[2] === "lg" ? " lg" : ""}`}
          style={{ left: `${d[0]}%`, top: `${d[1]}%` }}/>
      ))}

      {/* Gap city rings — each result-list city, sized by population */}
      {mode === "find" && LOCATIONS.map((l, i) => {
        const pop = parseInt(l.pop.replace(/,/g, ""));
        const size = pop > 1000000 ? 30 : pop > 500000 ? 22 : pop > 400000 ? 17 : 14;
        return (
          <div key={`gap-${i}`} className="gf-gap-city"
            style={{ left: `${l.x}%`, top: `${l.y}%`, width: size, height: size }}/>
        );
      })}

      {/* Radius preview (assess area, when selected) */}
      {radius && anchor && (
        <div className="gf-radius"
          style={{ left: `${anchor[0]}%`, top: `${anchor[1]}%`, width: 220, height: 220 }}/>
      )}
      {anchor && (
        <div className="gf-pin-violet" style={{ left: `${anchor[0]}%`, top: `${anchor[1]}%` }}>
          <IcPinFilled size={32} color={G_COLORS.violet}/>
        </div>
      )}

      {/* Top-right controls */}
      <div className="gf-controls">
        <div className="gf-mode">
          <button className="on"><IcLayers2D color="white"/>2D</button>
          <button><IcLayers3D color={G_COLORS.ink2}/>3D</button>
        </div>
        <div className="gf-zoom">
          <button aria-label="Zoom in">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2V12M2 7H12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
          <button aria-label="Zoom out">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7H12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
          <button aria-label="Reset compass">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2L9 6L7 5L5 6L7 2Z" fill="currentColor"/>
              <path d="M7 12L5 8L7 9L9 8L7 12Z" fill="currentColor" opacity="0.5"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom-left counts */}
      <div className="gf-count-chip">
        <span className="dot"/>
        {mode === "find" ? "1,586 candidate gaps · 22,470 stores mapped" : "Click anywhere to drop a pin"}
      </div>
      <div className="gf-scalebar">
        <span>0</span><span className="bar"/><span>50 km</span>
      </div>
      <GF_MapLegend mode={mode}/>

      <div className="gf-attribution">© Mapbox · OpenStreetMap · Maxar</div>
    </div>
  );
};

/* ===== Results panel — Find Gaps =========================== */
const GF_ResultsMatching = () => (
  <aside className="gf-results" data-screen-label="Results">
    <div className="gf-results-hd">
      <div className="gf-results-row">
        <div>
          <div className="gf-results-kicker">Find Gaps · Live</div>
          <div className="gf-results-title">Gap opportunities</div>
          <div className="gf-results-desc">Cities where selected brands have no store</div>
        </div>
        <button className="gf-iconbtn tinted" aria-label="Download CSV">
          <IcDownload size={14}/>
        </button>
      </div>
      <div className="gf-results-meta">
        <span className="big">1,000</span>
        <span className="of">of 1,586</span>
        <span className="progress"><span className="fill" style={{ width: "63%" }}/></span>
      </div>
      <div className="gf-results-sort">
        <span>Sorted · Population ↓</span>
        <span className="arr">
          Change
          <IcArrow size={11} color={G_COLORS.ink2}/>
        </span>
      </div>
    </div>
    <div className="gf-results-list">
      {LOCATIONS.map((l, i) => (
        <div key={i} className="gf-loc">
          <span className="pin"><IcPinLine size={18} color={G_COLORS.violet}/></span>
          <div>
            <div className="name">{l.name}</div>
            <div className="meta">{l.verified} · Pop {l.pop}</div>
          </div>
        </div>
      ))}
    </div>
  </aside>
);

/* ===== Results panel — Assess Area, empty =================== */
const GF_ResultsAssessEmpty = () => (
  <aside className="gf-results" data-screen-label="Results">
    <div className="gf-results-hd">
      <div className="gf-results-row">
        <div>
          <div className="gf-results-kicker">Live · assess area</div>
          <div className="gf-results-title">Nearby brands</div>
        </div>
        <button className="gf-iconbtn" aria-label="Download CSV" style={{ opacity: 0.4, pointerEvents: "none" }}>
          <IcDownload size={14}/>
        </button>
      </div>
      <div className="gf-results-meta">
        <span className="big">0</span>
        <span className="of">locations in radius</span>
      </div>
    </div>
    <div className="gf-results-empty" style={{ flex: 1, justifyContent: "center" }}>
      <span className="ico">
        <IcPinFilled size={20} color={G_COLORS.violet}/>
      </span>
      <div className="t">Drop a pin to begin</div>
      <div className="s">Click any point on the map and we'll list every brand currently trading within your chosen radius — plus the brands missing from the area.</div>
      <div style={{
        marginTop: 14, padding: "9px 14px", borderRadius: 999,
        background: G_COLORS.bg, border: `1px solid ${G_COLORS.borderSoft}`,
        fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
        letterSpacing: 0.8, color: G_COLORS.ink3, textTransform: "uppercase",
      }}>↖ Click on the map to start</div>
    </div>
    <div className="gf-missing">
      <div className="gf-missing-hd">
        <div className="l">
          <IcChevR size={14} color={G_COLORS.ink3}/>
          <span className="name">Missing brands</span>
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: G_COLORS.ink3,
          padding: "2px 9px", borderRadius: 999,
          background: G_COLORS.surface, border: `1px solid ${G_COLORS.border}`,
        }}>0</span>
      </div>
    </div>
  </aside>
);

/* ===== Results panel — Assess Area, populated =============== */
const GF_ResultsAssessPopulated = () => (
  <aside className="gf-results" data-screen-label="Results">
    <div className="gf-results-hd">
      <div className="gf-results-row">
        <div>
          <div className="gf-results-kicker">Live · assess area · 5 km</div>
          <div className="gf-results-title">Nearby brands</div>
        </div>
        <button className="gf-iconbtn tinted" aria-label="Download CSV">
          <IcDownload size={14}/>
        </button>
      </div>
      <div className="gf-results-meta">
        <span className="big">36</span>
        <span className="of">brands in radius</span>
        <span className="progress"><span className="fill" style={{ width: "45%" }}/></span>
      </div>
      <div className="gf-results-sort">
        <span>Sorted · Distance ↑</span>
        <span className="arr">Change <IcArrow size={11} color={G_COLORS.ink2}/></span>
      </div>
    </div>
    <div className="gf-results-list">
      {NEARBY_BRANDS.map((b, i) => (
        <div key={i} className="gf-brandrow">
          <span className="gf-brand-logo" style={{ background: b.color }}>{b.initials}</span>
          <div>
            <div className="gf-brand-name">{b.name}</div>
            <div className="gf-brand-meta">{b.sector}</div>
          </div>
          <div className="gf-brand-dist">
            <span className="lbl">Dist</span>
            {b.dist}
          </div>
        </div>
      ))}
    </div>
    <div className="gf-missing">
      <div className="gf-missing-hd">
        <div className="l">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: "rotate(90deg)" }}>
            <path d="M5 3L9 7L5 11" stroke={G_COLORS.ink3} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="name">Missing brands</span>
        </div>
        <span className="count">12</span>
      </div>
      <div className="gf-missing-body">
        {MISSING_BRANDS.map((m, i) => (
          <span key={i} className="gf-missing-tag"><span className="dot"/>{m}</span>
        ))}
      </div>
    </div>
  </aside>
);

/* ===== Compositions ========================================= */
const GapFinderApp = ({ mode, sidebar, map, results }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  return (
    <div className="gf-app">
      <style>{G_CSS}</style>
      <GF_Chrome mode={mode} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(o => !o)}/>
      <div className={`gf-body${sidebarOpen ? "" : " collapsed"}`}>
        {sidebar}
        {map}
        {results}
      </div>
    </div>
  );
};

const GapFinderFind = () => (
  <GapFinderApp
    mode="find"
    sidebar={<GF_SideFind openFilter={null}/>}
    map={<UKMap mode="find"/>}
    results={<GF_ResultsMatching/>}
  />
);

const GapFinderFindBrandsOpen = () => (
  <GapFinderApp
    mode="find"
    sidebar={<GF_SideFind openFilter="brands"/>}
    map={<UKMap mode="find"/>}
    results={<GF_ResultsMatching/>}
  />
);

const GapFinderAssessEmpty = () => (
  <GapFinderApp
    mode="assess"
    sidebar={<GF_SideAssess selected={false}/>}
    map={<UKMap mode="assess"/>}
    results={<GF_ResultsAssessEmpty/>}
  />
);

const GapFinderAssessPicked = () => (
  <GapFinderApp
    mode="assess"
    sidebar={<GF_SideAssess selected={true} openFilter="radius"/>}
    map={<UKMap mode="assess" radius anchor={[38, 42]}/>}
    results={<GF_ResultsAssessPopulated/>}
  />
);

Object.assign(window, {
  GapFinderFind, GapFinderFindBrandsOpen,
  GapFinderAssessEmpty, GapFinderAssessPicked,
});
