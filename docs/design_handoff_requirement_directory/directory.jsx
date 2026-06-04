/* Requirement Directory — Editorial Restraint
   Matches the homepage direction:
   - Warm cream bg, hairline borders
   - JetBrains Mono for meta/labels, Inter for everything else
   - Violet only for verified state + primary CTA
*/

const D_COLORS = {
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

const D_CSS = `
.dir-page { container-type: inline-size; position: relative;
  background: ${D_COLORS.bg}; min-height: 100%;
  font-family: Inter, sans-serif; color: ${D_COLORS.ink}; }
.dir-page * { box-sizing: border-box; }

/* Toolbar (search + filters + view toggle) */
.dir-toolbar { display: flex; align-items: stretch; gap: 12px;
  padding: 20px 40px; border-bottom: 1px solid ${D_COLORS.borderSoft};
  background: ${D_COLORS.bg}; position: sticky; top: 64px; z-index: 40; }
.dir-search { flex: 1; display: flex; align-items: center; gap: 12px;
  padding: 0 18px; height: 48px;
  background: ${D_COLORS.surface}; border: 1px solid ${D_COLORS.border};
  border-radius: 10px; }
.dir-search input { flex: 1; border: none; outline: none; background: transparent;
  font-family: Inter; font-size: 15px; color: ${D_COLORS.ink};
  letter-spacing: -0.1px; }
.dir-search input::placeholder { color: ${D_COLORS.ink4}; }
.dir-search .kbd { font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: ${D_COLORS.ink3}; padding: 3px 7px; border: 1px solid ${D_COLORS.border};
  border-radius: 5px; background: ${D_COLORS.bg}; }
.dir-filterbtn { display: inline-flex; align-items: center; gap: 8px;
  padding: 0 18px; height: 48px; border-radius: 10px;
  background: ${D_COLORS.surface}; border: 1px solid ${D_COLORS.border};
  font-family: Inter; font-size: 14px; font-weight: 500; color: ${D_COLORS.ink};
  cursor: pointer; }
.dir-filterbtn .count { padding: 1px 7px; border-radius: 999px;
  background: ${D_COLORS.violet}; color: white;
  font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; }
.dir-toggle { display: inline-flex; align-items: center; padding: 4px; height: 48px;
  background: ${D_COLORS.surface}; border: 1px solid ${D_COLORS.border};
  border-radius: 10px; }
.dir-toggle button { display: inline-flex; align-items: center; gap: 6px;
  padding: 0 14px; height: 38px; border-radius: 7px; border: none;
  background: transparent; cursor: pointer;
  font-family: Inter; font-size: 14px; font-weight: 500; color: ${D_COLORS.ink2}; }
.dir-toggle button.on { background: ${D_COLORS.ink}; color: white; }

/* Header strip ------------------------------------------- */
.dir-header { padding: 40px 40px 24px;
  display: flex; align-items: flex-end; justify-content: space-between; gap: 24px;
  flex-wrap: wrap; }
.dir-header h1 { font-family: Inter; font-size: 44px; font-weight: 600;
  letter-spacing: -0.035em; margin: 12px 0 0; color: ${D_COLORS.ink}; }
.dir-header h1 em { font-style: italic; font-weight: 500; color: ${D_COLORS.violetDeep}; }
.dir-header .lede { font-family: Inter; font-size: 16px; color: ${D_COLORS.ink2};
  margin-top: 10px; max-width: 580px; }
.dir-meta { display: flex; align-items: center; gap: 16px;
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: ${D_COLORS.ink3}; letter-spacing: 1.2px; text-transform: uppercase; }
.dir-meta .sep { width: 4px; height: 4px; border-radius: 999px; background: ${D_COLORS.ink4}; }

/* Active filter chips ------------------------------------ */
.dir-chiprow { display: flex; align-items: center; gap: 8px;
  padding: 0 40px 24px; flex-wrap: wrap;
  border-bottom: 1px solid ${D_COLORS.borderSoft}; }
.dir-chip { display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px 6px 12px; border-radius: 999px;
  background: ${D_COLORS.surface}; border: 1px solid ${D_COLORS.border};
  font-family: Inter; font-size: 13px; color: ${D_COLORS.ink}; cursor: pointer; }
.dir-chip .x { color: ${D_COLORS.ink4}; font-size: 14px; line-height: 1; padding: 0 2px; }
.dir-chip .key { font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: ${D_COLORS.ink3}; text-transform: uppercase; letter-spacing: 0.6px; }
.dir-chip-add { padding: 6px 12px; border-radius: 999px;
  background: transparent; border: 1px dashed ${D_COLORS.border};
  font-family: Inter; font-size: 13px; color: ${D_COLORS.ink2}; cursor: pointer; }
.dir-clear { margin-left: auto; padding: 6px 0; cursor: pointer;
  font-family: Inter; font-size: 13px; color: ${D_COLORS.ink3};
  text-decoration: underline; text-underline-offset: 3px; }
.dir-sort { display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: 999px;
  background: transparent; border: 1px solid transparent;
  font-family: Inter; font-size: 13px; color: ${D_COLORS.ink2}; cursor: pointer; }

/* Card grid --------------------------------------------- */
.dir-grid { display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 16px; padding: 28px 40px 80px; }
.dir-card { background: ${D_COLORS.surface}; border: 1px solid ${D_COLORS.border};
  border-radius: 14px; padding: 22px; cursor: pointer;
  display: flex; flex-direction: column;
  transition: border-color .15s, transform .15s, box-shadow .15s; }
.dir-card:hover { border-color: ${D_COLORS.ink3};
  box-shadow: 0 8px 24px -12px rgba(20,10,40,0.12); }
.dir-card-head { display: flex; align-items: flex-start; gap: 14px; }
.dir-logo { width: 52px; height: 52px; border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  font-family: Inter; font-weight: 700; font-size: 18px; color: white;
  flex-shrink: 0; letter-spacing: -0.4px; }
.dir-card-name { font-family: Inter; font-size: 17px; font-weight: 600;
  color: ${D_COLORS.ink}; letter-spacing: -0.3px; line-height: 1.2; }
.dir-card-sector { margin-top: 6px;
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  letter-spacing: 1.2px; text-transform: uppercase; color: ${D_COLORS.violetDeep}; }
.dir-card-body { margin-top: 18px; padding-top: 18px;
  border-top: 1px solid ${D_COLORS.borderSoft};
  display: flex; flex-direction: column; gap: 10px; }
.dir-row { display: grid; grid-template-columns: 64px 1fr; gap: 12px;
  font-family: Inter; font-size: 14px; color: ${D_COLORS.ink}; align-items: baseline; }
.dir-row .k { font-family: 'JetBrains Mono', monospace; font-size: 10px;
  color: ${D_COLORS.ink3}; letter-spacing: 1px; text-transform: uppercase;
  padding-top: 2px; }
.dir-card-foot { margin-top: 18px; padding-top: 18px;
  border-top: 1px solid ${D_COLORS.borderSoft};
  display: flex; align-items: center; justify-content: space-between; }
.dir-verified { display: inline-flex; align-items: center; gap: 6px;
  font-family: Inter; font-size: 12px; font-weight: 500; color: ${D_COLORS.green}; }
.dir-verified.dot { width: 6px; height: 6px; border-radius: 999px; background: ${D_COLORS.green}; }
.dir-card-link { font-family: Inter; font-size: 14px; font-weight: 500;
  color: ${D_COLORS.ink}; display: inline-flex; align-items: center; gap: 4px; }
.dir-card-link .arrow { transition: transform .15s; }
.dir-card:hover .dir-card-link .arrow { transform: translateX(3px); }

/* Map view --------------------------------------------- */
.dir-mapwrap { padding: 0; position: relative; }
.dir-map { width: 100%; height: 920px; position: relative; overflow: hidden;
  background:
    radial-gradient(ellipse 800px 600px at 30% 40%, #ECE6F6 0%, transparent 60%),
    radial-gradient(ellipse 600px 400px at 70% 60%, #F0EBE2 0%, transparent 60%),
    repeating-linear-gradient(0deg, ${D_COLORS.borderSoft} 0 1px, transparent 1px 80px),
    repeating-linear-gradient(90deg, ${D_COLORS.borderSoft} 0 1px, transparent 1px 80px),
    #F4F1EA;
  border-top: 1px solid ${D_COLORS.borderSoft}; }
.dir-pin { position: absolute; transform: translate(-50%, -50%);
  width: 28px; height: 28px; border-radius: 999px; background: ${D_COLORS.violet};
  color: white; display: inline-flex; align-items: center; justify-content: center;
  font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600;
  border: 2px solid white; box-shadow: 0 4px 12px rgba(20,10,40,0.2); cursor: pointer; }
.dir-pin.lg { width: 44px; height: 44px; font-size: 14px; }
.dir-pin.sm { width: 14px; height: 14px; }
.dir-mapcard { position: absolute; width: 340px;
  background: ${D_COLORS.surface}; border: 1px solid ${D_COLORS.border};
  border-radius: 14px; padding: 16px; box-shadow: 0 16px 40px -12px rgba(20,10,40,0.18); }
.dir-mapcard h4 { font-family: Inter; font-size: 14px; font-weight: 600;
  margin: 0; color: ${D_COLORS.ink}; }
.dir-mapcard .row { display: flex; align-items: center; gap: 10px; padding: 8px 0;
  border-bottom: 1px solid ${D_COLORS.borderSoft}; }
.dir-mapcard .row:last-child { border-bottom: none; }
.dir-mapcard .row .l { font-family: Inter; font-size: 14px; color: ${D_COLORS.ink};
  font-weight: 500; flex: 1; }
.dir-mapcard .row .meta { font-family: 'JetBrains Mono', monospace; font-size: 10px;
  color: ${D_COLORS.ink3}; letter-spacing: 0.6px; text-transform: uppercase; }

/* Filter drawer ---------------------------------------- */
.dir-overlay { position: absolute; inset: 0; background: rgba(23, 20, 25, 0.4);
  z-index: 70; }
.dir-drawer { position: absolute; top: 0; left: 0; bottom: 0;
  width: 420px; background: ${D_COLORS.bg};
  border-right: 1px solid ${D_COLORS.border}; z-index: 71;
  display: flex; flex-direction: column; }
.dir-drawer-head { padding: 24px 28px;
  border-bottom: 1px solid ${D_COLORS.borderSoft};
  display: flex; align-items: center; justify-content: space-between; }
.dir-drawer-head h3 { font-family: Inter; font-size: 22px; font-weight: 600;
  letter-spacing: -0.025em; margin: 0; }
.dir-drawer-head .kicker {
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  letter-spacing: 1.4px; color: ${D_COLORS.violetDeep}; text-transform: uppercase; }
.dir-drawer-body { flex: 1; overflow: auto; padding: 8px 0; }
.dir-filter-group { padding: 18px 28px; border-bottom: 1px solid ${D_COLORS.borderSoft}; }
.dir-filter-group .glabel { display: flex; align-items: center; justify-content: space-between;
  font-family: Inter; font-size: 15px; font-weight: 600; color: ${D_COLORS.ink};
  letter-spacing: -0.15px; cursor: pointer; }
.dir-filter-group .meta {
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  color: ${D_COLORS.ink3}; letter-spacing: 0.8px; text-transform: uppercase; margin-top: 4px; }
.dir-filter-group.open .glabel { margin-bottom: 16px; }
.dir-checkrow { display: flex; align-items: center; gap: 10px;
  padding: 8px 0; cursor: pointer;
  font-family: Inter; font-size: 14px; color: ${D_COLORS.ink}; }
.dir-checkbox { width: 18px; height: 18px; border-radius: 5px;
  border: 1.5px solid ${D_COLORS.border}; background: ${D_COLORS.surface};
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.dir-checkbox.on { background: ${D_COLORS.violet}; border-color: ${D_COLORS.violet}; }
.dir-checkrow .count {
  margin-left: auto; font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: ${D_COLORS.ink3}; }
.dir-range { padding-top: 8px; }
.dir-range .track { position: relative; height: 4px; border-radius: 999px;
  background: ${D_COLORS.borderSoft}; margin: 16px 0 22px; }
.dir-range .fill { position: absolute; top: 0; bottom: 0;
  background: ${D_COLORS.ink}; border-radius: 999px; }
.dir-range .handle { position: absolute; top: 50%; width: 16px; height: 16px;
  border-radius: 999px; background: white; border: 2px solid ${D_COLORS.ink};
  transform: translate(-50%, -50%); }
.dir-range .vals { display: flex; justify-content: space-between;
  font-family: 'JetBrains Mono', monospace; font-size: 12px; color: ${D_COLORS.ink2}; }
.dir-pillrow { display: flex; flex-wrap: wrap; gap: 8px; }
.dir-pill { padding: 7px 13px; border-radius: 999px;
  background: ${D_COLORS.surface}; border: 1px solid ${D_COLORS.border};
  font-family: Inter; font-size: 13px; color: ${D_COLORS.ink}; cursor: pointer; }
.dir-pill.on { background: ${D_COLORS.ink}; color: white; border-color: ${D_COLORS.ink}; }
.dir-drawer-foot { padding: 16px 28px; border-top: 1px solid ${D_COLORS.borderSoft};
  background: ${D_COLORS.bg}; display: flex; gap: 10px; align-items: center; }

/* Listing modal --------------------------------------- */
.dir-modal { position: absolute; inset: 0; background: ${D_COLORS.bg}; z-index: 80;
  display: grid; grid-template-columns: 1fr 1.05fr;
  font-family: Inter; color: ${D_COLORS.ink}; }
.dir-modal-close { position: absolute; top: 20px; left: 20px; width: 40px; height: 40px;
  border-radius: 10px; border: 1px solid ${D_COLORS.border}; background: ${D_COLORS.surface};
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  z-index: 3; }
.dir-modal-map { position: relative; overflow: hidden;
  background:
    radial-gradient(ellipse 400px 300px at 50% 50%, #ECE6F6 0%, transparent 70%),
    repeating-linear-gradient(0deg, ${D_COLORS.borderSoft} 0 1px, transparent 1px 60px),
    repeating-linear-gradient(90deg, ${D_COLORS.borderSoft} 0 1px, transparent 1px 60px),
    #F4F1EA;
  border-right: 1px solid ${D_COLORS.borderSoft}; }
.dir-loc-badge { position: absolute; top: 24px; left: 80px;
  padding: 8px 14px; border-radius: 999px;
  background: ${D_COLORS.ink}; color: white;
  font-family: Inter; font-size: 13px; font-weight: 500; }
.dir-loc-badge .dot { display: inline-block; width: 6px; height: 6px;
  border-radius: 999px; background: ${D_COLORS.violet}; margin-right: 8px; }
.dir-mapscale { position: absolute; bottom: 20px; right: 24px;
  display: flex; align-items: center; gap: 10px;
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: ${D_COLORS.ink3}; }
.dir-mapscale .bar { width: 60px; height: 2px; background: ${D_COLORS.ink}; }
.dir-modal-side { padding: 24px 40px 80px; overflow-y: auto; }
.dir-modal-header { padding: 8px 0 28px; }
.dir-modal-eyebrow {
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  letter-spacing: 1.4px; text-transform: uppercase; color: ${D_COLORS.violetDeep}; }
.dir-modal-title { display: flex; align-items: center; gap: 18px; margin-top: 14px; }
.dir-modal-title h2 { font-family: Inter; font-size: 36px; font-weight: 600;
  letter-spacing: -0.035em; margin: 0; }
.dir-modal-stats { margin-top: 22px; display: grid;
  grid-template-columns: repeat(3, 1fr); gap: 4px;
  border-top: 1px solid ${D_COLORS.borderSoft};
  border-bottom: 1px solid ${D_COLORS.borderSoft}; }
.dir-stat { padding: 16px 4px 16px 0; }
.dir-stat:not(:last-child) { border-right: 1px solid ${D_COLORS.borderSoft}; padding-right: 16px; }
.dir-stat .k {
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  letter-spacing: 1.2px; text-transform: uppercase; color: ${D_COLORS.ink3}; }
.dir-stat .v { font-family: Inter; font-size: 17px; font-weight: 500;
  color: ${D_COLORS.ink}; margin-top: 4px; letter-spacing: -0.2px; }
.dir-tabs { display: flex; gap: 4px; border-bottom: 1px solid ${D_COLORS.borderSoft};
  margin-top: 8px; }
.dir-tab { padding: 16px 18px 14px; background: transparent; border: none;
  cursor: pointer; font-family: Inter; font-size: 15px; font-weight: 500;
  color: ${D_COLORS.ink3}; position: relative;
  letter-spacing: -0.1px; }
.dir-tab.on { color: ${D_COLORS.ink}; }
.dir-tab.on::after { content: ''; position: absolute; left: 12px; right: 12px;
  bottom: -1px; height: 2px; background: ${D_COLORS.ink}; }
.dir-modal-section { padding: 28px 0; }
.dir-modal-section h3 { font-family: Inter; font-size: 13px; font-weight: 600;
  margin: 0 0 14px; color: ${D_COLORS.ink3};
  letter-spacing: 1px; text-transform: uppercase;
  font-family: 'JetBrains Mono', monospace; }
.dir-brochure { display: flex; align-items: center; gap: 16px;
  padding: 18px 18px; border: 1px solid ${D_COLORS.border};
  border-radius: 12px; background: ${D_COLORS.surface}; }
.dir-brochure .icon { width: 44px; height: 44px; border-radius: 10px;
  background: ${D_COLORS.violetTint};
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.dir-brochure .title { font-family: Inter; font-size: 15px; font-weight: 500;
  color: ${D_COLORS.ink}; }
.dir-brochure .sub { font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: ${D_COLORS.ink3}; margin-top: 3px; letter-spacing: 0.6px; }
.dir-brochure .dl { margin-left: auto; padding: 9px 14px; border-radius: 8px;
  border: 1px solid ${D_COLORS.border}; background: ${D_COLORS.bg};
  font-family: Inter; font-size: 13px; font-weight: 500; color: ${D_COLORS.ink};
  cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.dir-verifycard { margin-top: 14px; padding: 16px 18px;
  border: 1px solid ${D_COLORS.greenTint}; background: ${D_COLORS.greenTint};
  border-radius: 12px; display: flex; align-items: center; gap: 14px; }
.dir-verifycard .icon { width: 36px; height: 36px; border-radius: 999px;
  background: white; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.dir-verifycard .t { font-family: Inter; font-size: 14px; font-weight: 600;
  color: ${D_COLORS.green}; }
.dir-verifycard .s { font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: ${D_COLORS.green}; letter-spacing: 0.6px; opacity: 0.85; margin-top: 2px; }

/* Requirements tab */
.dir-req-card { padding: 18px; border: 1px solid ${D_COLORS.border};
  border-radius: 12px; background: ${D_COLORS.surface}; margin-bottom: 10px; }
.dir-req-card .label {
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  letter-spacing: 1.2px; text-transform: uppercase; color: ${D_COLORS.ink3}; }
.dir-req-card .val { font-family: Inter; font-size: 22px; font-weight: 500;
  color: ${D_COLORS.ink}; margin-top: 6px; letter-spacing: -0.4px; }
.dir-req-card .val.sm { font-size: 16px; font-weight: 500; }
.dir-req-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.dir-req-tag { padding: 5px 10px; border-radius: 6px;
  background: ${D_COLORS.violetTintSoft}; color: ${D_COLORS.violetDeep};
  font-family: Inter; font-size: 13px; font-weight: 500; }
.dir-req-tag.use { background: ${D_COLORS.greenTint}; color: ${D_COLORS.green}; }

/* Target locations tab */
.dir-loc-card { display: flex; align-items: center; gap: 14px;
  padding: 14px 16px; border: 1px solid ${D_COLORS.border};
  border-radius: 10px; background: ${D_COLORS.surface}; margin-bottom: 8px; }
.dir-loc-card .num { width: 26px; height: 26px; border-radius: 6px;
  background: ${D_COLORS.violetTint};
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600;
  color: ${D_COLORS.violetDeep}; }
.dir-loc-card .place { flex: 1; font-family: Inter; font-size: 15px; color: ${D_COLORS.ink}; }
.dir-loc-card .pin { color: ${D_COLORS.ink4}; }

/* Contact tab */
.dir-contact-card { padding: 24px; border: 1px solid ${D_COLORS.border};
  border-radius: 14px; background: ${D_COLORS.surface}; }
.dir-contact-head { display: flex; align-items: center; gap: 14px;
  padding-bottom: 18px; border-bottom: 1px solid ${D_COLORS.borderSoft}; }
.dir-contact-avatar { width: 52px; height: 52px; border-radius: 999px;
  background: ${D_COLORS.violet}; color: white;
  display: inline-flex; align-items: center; justify-content: center;
  font-family: Inter; font-size: 20px; font-weight: 600; }
.dir-contact-name { font-family: Inter; font-size: 18px; font-weight: 600;
  color: ${D_COLORS.ink}; letter-spacing: -0.2px; }
.dir-contact-role { font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: ${D_COLORS.ink3}; letter-spacing: 0.8px; text-transform: uppercase; margin-top: 4px; }
.dir-contact-fields { display: flex; flex-direction: column; gap: 14px; padding-top: 18px; }
.dir-contact-field { display: grid; grid-template-columns: 64px 1fr auto;
  gap: 12px; align-items: center; }
.dir-contact-field .k {
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  letter-spacing: 1.2px; text-transform: uppercase; color: ${D_COLORS.ink3}; }
.dir-contact-field .v { font-family: Inter; font-size: 15px; color: ${D_COLORS.ink};
  font-weight: 500; }
.dir-contact-field .copy { padding: 5px 10px; border-radius: 6px;
  border: 1px solid ${D_COLORS.border}; background: ${D_COLORS.bg};
  font-family: Inter; font-size: 12px; font-weight: 500; color: ${D_COLORS.ink2}; cursor: pointer; }

/* Upgrade CTA in modal */
.dir-upgrade { margin-top: 32px; padding: 32px;
  background: ${D_COLORS.ink}; color: white; border-radius: 18px;
  text-align: center; }
.dir-upgrade .eye {
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  letter-spacing: 1.4px; text-transform: uppercase; color: ${D_COLORS.violet}; }
.dir-upgrade h4 { font-family: Inter; font-size: 24px; font-weight: 600;
  margin: 12px 0 8px; letter-spacing: -0.025em; }
.dir-upgrade h4 em { font-style: italic; font-weight: 500; color: #B79DFF; }
.dir-upgrade p { font-family: Inter; font-size: 14px; line-height: 1.5;
  color: rgba(255,255,255,0.7); margin: 0 auto; max-width: 360px; }
.dir-upgrade .cta { margin-top: 22px; padding: 13px 22px; border-radius: 10px;
  background: ${D_COLORS.violet}; color: white; border: none;
  font-family: Inter; font-size: 15px; font-weight: 500; cursor: pointer;
  display: inline-flex; align-items: center; gap: 8px; }

/* Mobile responsive ----------------------------------- */
@container (max-width: 760px) {
  .dir-toolbar { padding: 12px 16px; gap: 8px; flex-wrap: wrap; top: 64px; }
  .dir-search { width: 100%; }
  .dir-filterbtn, .dir-toggle { flex: 1; }
  .dir-toggle button { flex: 1; }
  .dir-header { padding: 28px 20px 18px; }
  .dir-header h1 { font-size: 32px; }
  .dir-chiprow { padding: 0 20px 18px; }
  .dir-grid { grid-template-columns: 1fr; padding: 20px 20px 60px; gap: 12px; }
  .dir-modal { grid-template-columns: 1fr; }
  .dir-modal-map { height: 280px; }
  .dir-modal-side { padding: 20px 20px 40px; }
  .dir-modal-title h2 { font-size: 28px; }
  .dir-tabs { overflow-x: auto; gap: 0; }
  .dir-tab { white-space: nowrap; padding: 14px 14px 12px; font-size: 14px; }
  .dir-drawer { width: 100%; }
}
`;

/* ------- Brands / mock data ------- */
const BRANDS = [
  { name: "Allpress Espresso",  sector: "Food & Beverage", initials: "AE", color: "#6F4A2E",
    location: "London Bridge + 5 more", size: "750 – 5,000 sq ft", verified: "1 week ago" },
  { name: "Goodhood",           sector: "Retail",          initials: "GH", color: "#171419",
    location: "Shoreditch & Soho",      size: "5,000 – 10,000 sq ft", verified: "1 week ago" },
  { name: "ShakeDown",          sector: "Food & Beverage", initials: "SD", color: "#E8B22A",
    location: "Manchester + 3 more",    size: "750 – 1,500 sq ft",   verified: "1 month ago" },
  { name: "Card Factory",       sector: "Retail",          initials: "CF", color: "#2A5DD1",
    location: "All locations considered", size: "1,000 – 4,000 sq ft", verified: "1 month ago" },
  { name: "The Entertainer",    sector: "Retail",          initials: "TE", color: "#E0392F",
    location: "All locations considered", size: "6,000 – 8,000 sq ft", verified: "3 months ago" },
  { name: "Knoops",             sector: "Food & Beverage", initials: "K",  color: "#1F1A14",
    location: "All locations considered", size: "500 – 2,000 sq ft",   verified: "4 months ago" },
  { name: "Rodd & Gunn",        sector: "Retail",          initials: "R&", color: "#2C3F2A",
    location: "St. Ives + 36 more",       size: "1,000 – 2,500 sq ft", verified: "6 months ago" },
  { name: "Ben's Greengrocers", sector: "Retail",          initials: "BG", color: "#7A1F2E",
    location: "Barnes + 14 more",         size: "1,500 – 3,000 sq ft", verified: "6 months ago" },
];

/* ------- Toolbar ------- */
const D_Toolbar = ({ view = "list", filterCount = 3 }) => (
  <div className="dir-toolbar">
    <div className="dir-search">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke={D_COLORS.ink3} strokeWidth="1.5"/>
        <path d="M12 12L16 16" stroke={D_COLORS.ink3} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <input placeholder="Search location, brand or sector" />
      <span className="kbd">⌘ K</span>
    </div>
    <button className="dir-filterbtn">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M1 3H13M3 7H11M5 11H9" stroke={D_COLORS.ink} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      Filters
      {filterCount > 0 && <span className="count">{filterCount}</span>}
    </button>
    <div className="dir-toggle">
      <button className={view === "list" ? "on" : ""}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 3H12M2 7H12M2 11H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        List
      </button>
      <button className={view === "map" ? "on" : ""}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1C4 1 2 3 2 5.5C2 9 7 13 7 13C7 13 12 9 12 5.5C12 3 10 1 7 1Z" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="7" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        Map
      </button>
    </div>
  </div>
);

/* ------- Header strip ------- */
const D_Header = ({ count = 3417 }) => (
  <header className="dir-header" data-screen-label="Header">
    <div>
      <div className="dir-meta">
        <span>Directory</span>
        <span className="sep"/>
        <span>Updated daily</span>
      </div>
      <h1>Live requirements — <em>verified, current.</em></h1>
      <p className="lede">Every live commercial property requirement in the UK, hand-checked by our team. Filter by sector, size or location and reach the right person.</p>
    </div>
    <div className="dir-meta" style={{ paddingBottom: 8 }}>
      <span>{count.toLocaleString()} live</span>
      <span className="sep"/>
      <span>Last sync · 2 hours ago</span>
    </div>
  </header>
);

/* ------- Active filter chips ------- */
const D_ChipRow = () => (
  <div className="dir-chiprow">
    <span className="dir-chip"><span className="key">Sector</span> Food &amp; Beverage <span className="x">×</span></span>
    <span className="dir-chip"><span className="key">Size</span> 1k – 5k sq ft <span className="x">×</span></span>
    <span className="dir-chip"><span className="key">Use</span> E (Commercial) <span className="x">×</span></span>
    <button className="dir-chip-add">+ Add filter</button>
    <button className="dir-sort">
      Sort: Recently verified
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke={D_COLORS.ink2} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
    <span className="dir-clear">Clear all</span>
  </div>
);

/* ------- Card ------- */
const D_Card = ({ b }) => (
  <div className="dir-card">
    <div className="dir-card-head">
      <div className="dir-logo" style={{ background: b.color }}>{b.initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="dir-card-name">{b.name}</div>
        <div className="dir-card-sector">{b.sector}</div>
      </div>
    </div>
    <div className="dir-card-body">
      <div className="dir-row"><span className="k">Where</span><span>{b.location}</span></div>
      <div className="dir-row"><span className="k">Size</span><span>{b.size}</span></div>
    </div>
    <div className="dir-card-foot">
      <span className="dir-verified">
        <span style={{ width: 6, height: 6, borderRadius: 999, background: D_COLORS.green }}/>
        Verified {b.verified}
      </span>
      <span className="dir-card-link">
        View <svg className="arrow" width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5H12M12 5L8 1M12 5L8 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </span>
    </div>
  </div>
);

/* ------- LIST VIEW ------- */
const D_ListView = () => (
  <React.Fragment>
    <D_Header />
    <D_Toolbar view="list" />
    <D_ChipRow />
    <div className="dir-grid" data-screen-label="Results">
      {BRANDS.map((b, i) => <D_Card key={i} b={b} />)}
    </div>
  </React.Fragment>
);

/* ------- MAP VIEW ------- */
const D_MapView = () => (
  <React.Fragment>
    <D_Header />
    <D_Toolbar view="map" />
    <div className="dir-mapwrap" data-screen-label="Map">
      <div className="dir-map">
        {/* abstract land outline */}
        <svg width="100%" height="100%" viewBox="0 0 1440 920" preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute", inset: 0, opacity: 0.35 }}>
          <path d="M280 80 L340 60 L420 100 L460 180 L520 200 L580 240 L600 320 L580 400 L640 460 L700 460 L760 520 L820 540 L860 620 L820 700 L760 740 L660 780 L560 760 L500 800 L400 780 L320 720 L300 640 L260 580 L240 480 L260 400 L240 320 L260 220 L280 80Z"
            fill="#E8E2D6" stroke="#D8D0BD" strokeWidth="1"/>
        </svg>
        <div className="dir-pin lg" style={{ left: "32%", top: "30%" }}>12</div>
        <div className="dir-pin"    style={{ left: "26%", top: "44%" }}>3</div>
        <div className="dir-pin"    style={{ left: "40%", top: "50%" }}>5</div>
        <div className="dir-pin lg" style={{ left: "44%", top: "62%" }}>36</div>
        <div className="dir-pin sm" style={{ left: "30%", top: "58%" }}/>
        <div className="dir-pin sm" style={{ left: "48%", top: "70%" }}/>
        <div className="dir-pin"    style={{ left: "38%", top: "78%" }}>2</div>

        <div className="dir-mapcard" style={{ left: "52%", top: "44%" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12 }}>
            <h4>3 Properties</h4>
            <span style={{ fontSize: 16, color: D_COLORS.ink4, cursor: "pointer" }}>×</span>
          </div>
          {BRANDS.slice(0, 3).map((b, i) => (
            <div key={i} className="row">
              <div className="dir-logo" style={{ background: b.color, width: 32, height: 32, fontSize: 12, borderRadius: 7 }}>{b.initials}</div>
              <div>
                <div className="l">{b.name}</div>
                <div className="meta">{b.sector}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 11L11 3M11 3H5M11 3V9" stroke={D_COLORS.ink3} strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
          ))}
        </div>

        <div style={{
          position: "absolute", bottom: 24, left: 24,
          padding: "10px 14px", borderRadius: 10,
          background: "rgba(255,255,255,0.92)", border: `1px solid ${D_COLORS.border}`,
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: D_COLORS.ink2,
          letterSpacing: 0.4, textTransform: "uppercase",
        }}>
          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 999, background: D_COLORS.violet, marginRight: 8 }}/>
          1,247 properties in view
        </div>
        <div className="dir-mapscale">
          <span>0</span><span className="bar"/><span>50 km</span>
        </div>
      </div>
    </div>
  </React.Fragment>
);

/* ------- Filter Drawer ------- */
const FilterGroup = ({ label, meta, open = false, children }) => (
  <div className={`dir-filter-group${open ? " open" : ""}`}>
    <div className="glabel">
      <div>
        {label}
        {meta && <div className="meta">{meta}</div>}
      </div>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
        style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
        <path d="M3 4.5L6 7.5L9 4.5" stroke={D_COLORS.ink2} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
    {open && children}
  </div>
);

const Check = ({ on }) => (
  <span className={`dir-checkbox${on ? " on" : ""}`}>
    {on && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5L4.5 8L9 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
  </span>
);

const D_Filters = ({ children }) => (
  <React.Fragment>
    {children}
    <div className="dir-overlay"/>
    <aside className="dir-drawer" data-screen-label="Filter drawer">
      <div className="dir-drawer-head">
        <div>
          <div className="kicker">Filter results</div>
          <h3 style={{ marginTop: 6 }}>Refine your search</h3>
        </div>
        <button style={{ width: 36, height: 36, border: `1px solid ${D_COLORS.border}`, background: D_COLORS.surface, borderRadius: 8, cursor: "pointer" }}>×</button>
      </div>
      <div className="dir-drawer-body">
        <FilterGroup label="Company name">
          <input style={{
            width: "100%", padding: "10px 14px", borderRadius: 8,
            border: `1px solid ${D_COLORS.border}`, background: D_COLORS.surface,
            fontFamily: "Inter", fontSize: 14, color: D_COLORS.ink, outline: "none",
          }} placeholder="e.g. Allpress, Knoops"/>
        </FilterGroup>
        <FilterGroup label="Sectors" meta="3 selected" open>
          {[
            { name: "Food & Beverage", count: 847, on: true },
            { name: "Retail",          count: 1240, on: true },
            { name: "Commercial",      count: 532, on: true },
            { name: "Leisure",         count: 218, on: false },
            { name: "Health & Beauty", count: 164, on: false },
            { name: "Automotive",      count: 92, on: false },
          ].map((s, i) => (
            <div key={i} className="dir-checkrow">
              <Check on={s.on}/>
              <span>{s.name}</span>
              <span className="count">{s.count}</span>
            </div>
          ))}
        </FilterGroup>
        <FilterGroup label="Planning use class" meta="1 selected" open>
          <div className="dir-pillrow">
            {["E (Commercial)", "F (Local Community)", "Sui Generis", "C1 Hotel", "B8 Storage"].map((p, i) => (
              <span key={i} className={`dir-pill${i === 0 ? " on" : ""}`}>{p}</span>
            ))}
          </div>
        </FilterGroup>
        <FilterGroup label="Listing type">
          <div className="meta" style={{ marginTop: 0 }}>All types</div>
        </FilterGroup>
        <FilterGroup label="Site size (sq ft)" meta="1,000 – 5,000" open>
          <div className="dir-range">
            <div className="track">
              <div className="fill" style={{ left: "12%", right: "32%" }}/>
              <div className="handle" style={{ left: "12%" }}/>
              <div className="handle" style={{ left: "68%" }}/>
            </div>
            <div className="vals"><span>1,000</span><span>5,000</span></div>
          </div>
        </FilterGroup>
        <FilterGroup label="Site size (acres)"/>
        <FilterGroup label="Dwelling count"/>
      </div>
      <div className="dir-drawer-foot">
        <button className="btn btn-ghost" style={{ flexShrink: 0,
          padding: "13px 18px", borderRadius: 10,
          border: `1px solid ${D_COLORS.border}`, background: D_COLORS.surface,
          fontFamily: "Inter", fontSize: 14, fontWeight: 500, color: D_COLORS.ink, cursor: "pointer" }}>
          Reset
        </button>
        <button style={{ flex: 1,
          padding: "13px 18px", borderRadius: 10, border: "none",
          background: D_COLORS.ink, color: "white",
          fontFamily: "Inter", fontSize: 14, fontWeight: 500, cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          Apply filters
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
            padding: "2px 7px", borderRadius: 999,
            background: "rgba(255,255,255,0.15)", letterSpacing: 0.4,
          }}>847 results</span>
        </button>
      </div>
    </aside>
  </React.Fragment>
);

/* ------- Modal ------- */
const ModalShell = ({ tab = "overview", brand, children, page }) => {
  const tabs = [
    { id: "overview", label: `From ${brand.name}` },
    { id: "requirements", label: "Requirements" },
    { id: "locations", label: "Target locations" },
    { id: "contact", label: "Contact" },
  ];
  return (
    <React.Fragment>
      {page}
      <div className="dir-modal" data-screen-label={`Modal · ${tab}`}>
        <button className="dir-modal-close" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3L11 11M11 3L3 11" stroke={D_COLORS.ink} strokeWidth="1.6" strokeLinecap="round"/></svg>
        </button>
        <div className="dir-modal-map">
          <div className="dir-loc-badge"><span className="dot"/>6 locations · London</div>
          {/* abstract Thames silhouette */}
          <svg width="100%" height="100%" viewBox="0 0 800 1080" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0 }}>
            <path d="M0 560 Q120 540 200 600 T380 620 Q480 640 540 580 T700 560 L800 560 L800 1080 L0 1080 Z" fill="#DDE4E9" opacity="0.7"/>
            <path d="M0 580 Q120 560 200 620 T380 640 Q480 660 540 600 T700 580 L800 580 L800 600 Q700 620 540 620 T380 660 Q280 680 200 640 Q120 600 0 600 Z" fill="#9FB7C5" opacity="0.5"/>
          </svg>
          {[
            { x: 18, y: 36 }, { x: 26, y: 40 }, { x: 36, y: 44 },
            { x: 48, y: 50 }, { x: 56, y: 60 }, { x: 68, y: 60 },
          ].map((p, i) => (
            <div key={i} className="dir-pin sm" style={{ left: `${p.x}%`, top: `${p.y}%`, width: 22, height: 22 }}/>
          ))}
          <div className="dir-mapscale">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 5H10M2 5L5 2M2 5L5 8" stroke={D_COLORS.ink3} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            mapbox · 1 km
          </div>
        </div>
        <div className="dir-modal-side">
          <div className="dir-modal-header">
            <div className="dir-modal-eyebrow">Live requirement · verified 7 May 2026</div>
            <div className="dir-modal-title">
              <div className="dir-logo" style={{ background: brand.color, width: 64, height: 64, fontSize: 24, borderRadius: 14 }}>{brand.initials}</div>
              <div>
                <h2>{brand.name}</h2>
                <div style={{ fontFamily: "Inter", fontSize: 14, color: D_COLORS.ink2, marginTop: 4 }}>{brand.sector} · Commercial</div>
              </div>
            </div>
            <div className="dir-modal-stats">
              <div className="dir-stat"><div className="k">Locations</div><div className="v">6 cities</div></div>
              <div className="dir-stat"><div className="k">Size</div><div className="v">750 – 5,000 sq ft</div></div>
              <div className="dir-stat"><div className="k">Use class</div><div className="v">E (Commercial)</div></div>
            </div>
          </div>
          <div className="dir-tabs">
            {tabs.map(t => <button key={t.id} className={`dir-tab${tab === t.id ? " on" : ""}`}>{t.label}</button>)}
          </div>
          {children}
          <div className="dir-upgrade">
            <div className="eye">Unlock the full directory</div>
            <h4>Discover 3,500+ more <em>required locations</em></h4>
            <p>Access the complete directory with advanced filters, instant contact details and requirements verified weekly.</p>
            <button className="cta">Start 30-day free trial <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5H11M11 5L8 2M11 5L8 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
            <div style={{ marginTop: 14, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: 0.6, textTransform: "uppercase" }}>30-day free trial · Cancel anytime</div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
};

/* ------- Modal tab content ------- */
const D_ModalOverview = ({ brand }) => (
  <div className="dir-modal-section">
    <h3>In {brand.name}'s own words</h3>
    <div className="dir-brochure">
      <span className="icon">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke={D_COLORS.violet} strokeWidth="1.6"/><path d="M6 6H14M6 10H14M6 14H11" stroke={D_COLORS.violet} strokeWidth="1.6" strokeLinecap="round"/></svg>
      </span>
      <div style={{ flex: 1 }}>
        <div className="title">{brand.name}'s Requirement Brochure</div>
        <div className="sub">PDF · 1.2 MB · Updated 7 May 2026</div>
      </div>
      <button className="dl">
        Download
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2V8M6 8L3 5M6 8L9 5M2 10H10" stroke={D_COLORS.ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
    </div>
    <div className="dir-verifycard">
      <span className="icon">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke={D_COLORS.green} strokeWidth="1.6"/><path d="M5.5 9L7.5 11L12 6.5" stroke={D_COLORS.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </span>
      <div>
        <div className="t">Verified listing</div>
        <div className="s">Last verified 7 May 2026 · Next check in 23 days</div>
      </div>
    </div>
    <h3 style={{ marginTop: 32 }}>Brief summary</h3>
    <p style={{ fontFamily: "Inter", fontSize: 15, lineHeight: 1.6, color: D_COLORS.ink2, margin: 0 }}>
      Allpress Espresso is seeking high street and station-adjacent units in central London for new flagship coffee bars. Preference for ground floor with frontage 4m+, A1/A3 history, and outdoor seating potential. Targeting Q3 2026 openings.
    </p>
  </div>
);

const D_ModalRequirements = () => (
  <div className="dir-modal-section">
    <h3>Requirements</h3>
    <div className="dir-req-card">
      <div className="label">Site size</div>
      <div className="val">750 – 5,000 sq ft</div>
    </div>
    <div className="dir-req-card">
      <div className="label">Sectors</div>
      <div className="dir-req-tags">
        <span className="dir-req-tag">Food &amp; Beverage</span>
        <span className="dir-req-tag">Specialty Coffee</span>
      </div>
    </div>
    <div className="dir-req-card">
      <div className="label">Planning use classes</div>
      <div className="dir-req-tags">
        <span className="dir-req-tag use">E (Commercial)</span>
        <span className="dir-req-tag use">Sui Generis</span>
      </div>
    </div>
    <div className="dir-req-card">
      <div className="label">Tenure preference</div>
      <div className="val sm">Leasehold · 10–15 year terms · Breaks negotiable</div>
    </div>
    <div className="dir-req-card">
      <div className="label">Frontage minimum</div>
      <div className="val sm">4 metres · Ground floor preferred</div>
    </div>
  </div>
);

const TARGET_LOCS = [
  "London Bridge, Southwark, London, Greater London, England, UK",
  "Clerkenwell, Islington, London, Greater London, England, UK",
  "Fitzrovia, Camden, London, Greater London, England, UK",
  "Marylebone, Westminster, London, Greater London, England, UK",
  "City of London, Greater London, England, UK",
  "Canary Wharf, Tower Hamlets, London, Greater London, England, UK",
];

const D_ModalLocations = () => (
  <div className="dir-modal-section">
    <h3>Target locations <span style={{ marginLeft: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: D_COLORS.ink3 }}>· 6 areas</span></h3>
    {TARGET_LOCS.map((l, i) => (
      <div key={i} className="dir-loc-card">
        <span className="num">{String(i + 1).padStart(2, "0")}</span>
        <div className="place">{l}</div>
        <svg className="pin" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1C5 1 3 3 3 5.5C3 9 8 14 8 14C8 14 13 9 13 5.5C13 3 11 1 8 1Z" stroke="currentColor" strokeWidth="1.5"/><circle cx="8" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>
      </div>
    ))}
  </div>
);

const D_ModalContact = () => (
  <div className="dir-modal-section">
    <h3>Direct contact</h3>
    <div className="dir-contact-card">
      <div className="dir-contact-head">
        <div className="dir-contact-avatar">O</div>
        <div>
          <div className="dir-contact-name">Oliver Serrant</div>
          <div className="dir-contact-role">Director / Founder</div>
        </div>
      </div>
      <div className="dir-contact-fields">
        <div className="dir-contact-field">
          <span className="k">Email</span>
          <span className="v">oliver@stance.london</span>
          <button className="copy">Copy</button>
        </div>
        <div className="dir-contact-field">
          <span className="k">Phone</span>
          <span className="v">+44 7850 205 928</span>
          <button className="copy">Copy</button>
        </div>
        <div className="dir-contact-field">
          <span className="k">Website</span>
          <span className="v">allpressespresso.com</span>
          <button className="copy">Open ↗</button>
        </div>
      </div>
    </div>
    <div style={{ marginTop: 16, padding: 16, background: D_COLORS.violetTintSoft,
      border: `1px solid ${D_COLORS.violetTint}`, borderRadius: 12, display: "flex", gap: 12 }}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
        <circle cx="9" cy="9" r="7" stroke={D_COLORS.violetDeep} strokeWidth="1.4"/>
        <path d="M9 5V9M9 13V13.01" stroke={D_COLORS.violetDeep} strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
      <div style={{ fontFamily: "Inter", fontSize: 13, lineHeight: 1.5, color: D_COLORS.violetDeep }}>
        <strong>Mention SiteMatcher when you reach out.</strong> Brands are more likely to respond when they know you're a verified subscriber.
      </div>
    </div>
  </div>
);

/* ------- Page wrappers (for design canvas) ------- */
const PageShell = ({ children }) => (
  <div className="dir-page">
    <style>{A_CSS}</style>
    <style>{D_CSS}</style>
    <A_Nav />
    {children}
  </div>
);

/* Renders the list view as background behind the modal/drawer */
const FrozenList = () => (
  <div style={{ filter: "blur(0px) brightness(0.96)", pointerEvents: "none" }}>
    <D_ListView />
  </div>
);

const DirectoryList    = () => <PageShell><D_ListView/></PageShell>;
const DirectoryMap     = () => <PageShell><D_MapView/></PageShell>;
const DirectoryFilters = () => <PageShell><D_Filters><FrozenList/></D_Filters></PageShell>;

const DirectoryModal = ({ tab = "overview" }) => {
  const brand = BRANDS[0];
  let content;
  if (tab === "overview")     content = <D_ModalOverview brand={brand}/>;
  if (tab === "requirements") content = <D_ModalRequirements/>;
  if (tab === "locations")    content = <D_ModalLocations/>;
  if (tab === "contact")      content = <D_ModalContact/>;
  return (
    <div className="dir-page">
      <style>{A_CSS}</style>
      <style>{D_CSS}</style>
      <A_Nav />
      <ModalShell tab={tab} brand={brand} page={<FrozenList/>}>{content}</ModalShell>
    </div>
  );
};

Object.assign(window, { DirectoryList, DirectoryMap, DirectoryFilters, DirectoryModal });
