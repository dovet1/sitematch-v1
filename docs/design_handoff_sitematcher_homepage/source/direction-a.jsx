/* Direction A — Editorial Restraint (revised)
   - Real logo
   - Browse Requirements / Free Tools / Articles / Post Requirement (Free!) nav
   - Per-feature CTAs
   - Responsive: works at both desktop (1440) and mobile (~390) widths */

const A_COLORS = {
  bg: "#FBFAF7",
  surface: "#FFFFFF",
  ink: "#171419",
  ink2: "#4A4451",
  ink3: "#7C7588",
  border: "#E8E4DC",
  borderSoft: "#EFEBE2",
  violet: "#7033FF",
  violetDeep: "#5421CC",
  violetTint: "#EEE9FF",
  violetTintSoft: "#F5F1FF",
  orange: "#F26B1F",
};

/* === Responsive styles — scoped by .sm-page === */
const A_CSS = `
.sm-page { container-type: inline-size; position: relative; }
.sm-page * { box-sizing: border-box; }

/* Nav ----------------------------------------------------------- */
.sm-nav { display: flex; align-items: center; justify-content: space-between;
  padding: 16px 40px; border-bottom: 1px solid ${A_COLORS.borderSoft};
  background: ${A_COLORS.bg}; position: sticky; top: 0; z-index: 50;
  backdrop-filter: saturate(140%) blur(8px); }
.sm-nav-links { display: flex; gap: 36px; align-items: center;
  font-family: Inter; font-size: 15px; font-weight: 500; color: ${A_COLORS.ink}; }
.sm-nav-links span { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; position: relative; }
.sm-nav-tools { position: relative; padding: 22px 0; margin: -22px 0; }
.sm-tools-menu { position: absolute; top: 100%; left: -16px; margin-top: -8px;
  width: 320px; background: ${A_COLORS.surface};
  border: 1px solid ${A_COLORS.border}; border-radius: 14px;
  padding: 8px; box-shadow: 0 18px 40px -16px rgba(20,10,40,0.15);
  z-index: 60; }
.sm-tools-item { padding: 12px 14px; border-radius: 10px; cursor: pointer;
  transition: background .12s; }
.sm-tools-item:hover { background: ${A_COLORS.violetTintSoft}; }
.sm-tools-name { font-family: Inter; font-size: 14px; font-weight: 600;
  color: ${A_COLORS.ink}; letter-spacing: -0.1px; }
.sm-tools-desc { font-family: Inter; font-size: 13px; color: ${A_COLORS.ink3};
  margin-top: 2px; line-height: 1.4; }
.sm-signin-link { font-family: Inter; font-size: 14px; font-weight: 500;
  color: ${A_COLORS.ink2}; cursor: pointer; }
.sm-create-btn { padding: 9px 16px; font-size: 14px; border-radius: 8px; }

/* Account (logged-in) ------------------------------------------- */
.sm-account { position: relative; padding: 18px 0; margin: -18px 0; }
.sm-account-trigger { background: transparent; border: none; cursor: pointer;
  display: inline-flex; align-items: center; gap: 8px;
  font-family: Inter; font-size: 14px; color: ${A_COLORS.ink}; padding: 0; }
.sm-avatar { width: 28px; height: 28px; border-radius: 999px;
  background: ${A_COLORS.violet}; color: white; font-family: Inter;
  font-size: 12px; font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.sm-avatar.lg { width: 40px; height: 40px; font-size: 16px; }
.sm-account-email { color: ${A_COLORS.ink}; font-weight: 500; }
.sm-account-menu { position: absolute; top: 100%; right: 0; margin-top: 6px;
  width: 260px; background: ${A_COLORS.surface};
  border: 1px solid ${A_COLORS.border}; border-radius: 14px;
  padding: 14px; box-shadow: 0 18px 40px -16px rgba(20,10,40,0.18);
  z-index: 60; }
.sm-account-head { padding: 2px 4px 12px; }
.sm-account-headEmail { font-family: Inter; font-size: 14px; font-weight: 600;
  color: ${A_COLORS.ink}; letter-spacing: -0.1px; }
.sm-account-tier { display: inline-flex; align-items: center; gap: 5px;
  margin-top: 6px; padding: 3px 8px; border-radius: 999px;
  background: #DCFCE7; color: #15803D;
  font-family: Inter; font-size: 11px; font-weight: 600; letter-spacing: 0.2px; }
.sm-account-divider { height: 1px; background: ${A_COLORS.borderSoft}; margin: 4px 0; }
.sm-account-item { display: flex; align-items: center; gap: 10px;
  padding: 9px 6px; border-radius: 8px; cursor: pointer;
  font-family: Inter; font-size: 14px; color: ${A_COLORS.ink};
  transition: background .12s; }
.sm-account-item:hover { background: ${A_COLORS.violetTintSoft}; }
.sm-account-item.danger { color: #DC2626; }
.sm-nav-right { display: flex; align-items: center; gap: 18px; }
.sm-post-pill { display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 16px; border-radius: 999px;
  background: ${A_COLORS.violetTint}; border: 1px solid transparent;
  font-family: Inter; font-size: 14px; font-weight: 600; color: ${A_COLORS.violet};
  cursor: pointer; transition: background .15s, transform .15s; }
.sm-post-pill:hover { background: #E4DBFF; }
.sm-post-pill .free { color: ${A_COLORS.orange}; }
.sm-post-pill-full { width: 100%; justify-content: center;
  padding: 14px 18px; font-size: 15px; border-radius: 12px; }

/* Mobile menu overlay (absolute over sm-page) ------------------- */
.sm-mobile-menu { position: absolute; top: 64px; left: 0; right: 0;
  background: ${A_COLORS.bg};
  z-index: 49; display: flex; flex-direction: column;
  padding: 8px 20px 24px; box-shadow: 0 24px 40px -20px rgba(20,10,40,0.15);
  border-bottom: 1px solid ${A_COLORS.borderSoft}; }
.sm-mobile-section { padding-top: 8px; }
.sm-mobile-link { display: block; padding: 18px 0;
  font-family: Inter; font-size: 20px; font-weight: 500;
  color: ${A_COLORS.ink}; letter-spacing: -0.3px;
  border-bottom: 1px solid ${A_COLORS.borderSoft}; cursor: pointer; }
.sm-mobile-grouplabel { padding: 22px 0 6px;
  font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 1.4px;
  color: ${A_COLORS.violetDeep}; text-transform: uppercase; }
.sm-mobile-toolitem { padding: 12px 0; cursor: pointer;
  border-bottom: 1px solid ${A_COLORS.borderSoft}; }
.sm-mobile-toolitem:last-of-type { border-bottom: 1px solid ${A_COLORS.borderSoft}; }
.sm-mobile-toolname { font-family: Inter; font-size: 16px; font-weight: 600;
  color: ${A_COLORS.ink}; }
.sm-mobile-tooldesc { font-family: Inter; font-size: 13px; color: ${A_COLORS.ink3};
  margin-top: 2px; }
.sm-mobile-footer { padding-top: 20px; display: flex; flex-direction: column; gap: 14px; }
.sm-mobile-signin { display: flex; gap: 10px; justify-content: center;
  font-family: Inter; font-size: 14px; color: ${A_COLORS.ink2}; }
.sm-mobile-signin .divider { color: ${A_COLORS.ink3}; }
.sm-mobile-authbtns { display: flex; gap: 10px; }
.sm-fullbtn { flex: 1; padding: 14px 16px; font-size: 15px; border-radius: 12px;
  display: inline-flex; align-items: center; justify-content: center; }
.btn.sm-signout { color: #DC2626; border-color: #FECACA; background: #FEF2F2; }
.sm-mobile-account { display: flex; align-items: center; gap: 14px;
  padding: 18px 4px; border-bottom: 1px solid ${A_COLORS.borderSoft}; }
.sm-mobile-acctlink { display: flex; align-items: center; gap: 10px;
  padding: 14px 0; border-bottom: 1px solid ${A_COLORS.borderSoft};
  font-family: Inter; font-size: 16px; font-weight: 500; color: ${A_COLORS.ink};
  cursor: pointer; }
.sm-burger { display: none; width: 36px; height: 36px; border-radius: 8px;
  background: transparent; border: 1px solid ${A_COLORS.border};
  align-items: center; justify-content: center; cursor: pointer; }

/* Hero ----------------------------------------------------------- */
.sm-hero { padding: 80px 40px 0; text-align: center; }
.sm-hero h1 { font-family: Inter; font-size: clamp(38px, 6.6cqi, 88px);
  line-height: 0.98; letter-spacing: -0.04em; font-weight: 600;
  margin: 18px auto 0; color: ${A_COLORS.ink}; max-width: 1080px; text-wrap: balance; }
.sm-hero h1 em { font-style: italic; font-weight: 500; color: ${A_COLORS.violetDeep}; }
.sm-hero p { font-family: Inter; font-size: clamp(16px, 1.6cqi, 20px);
  line-height: 1.45; color: ${A_COLORS.ink2}; max-width: 620px;
  margin: 24px auto 0; text-wrap: balance; }
.sm-hero-ctas { display: flex; gap: 10px; justify-content: center;
  margin-top: 32px; flex-wrap: wrap; }
.sm-hero-video { margin: 64px auto 0; max-width: 1180px; }

/* Section padding ------------------------------------------------ */
.sm-section { padding: clamp(72px, 9cqi, 120px) clamp(20px, 5cqi, 80px); }
.sm-narrow { max-width: 1280px; margin: 0 auto; }

/* Trusted by ----------------------------------------------------- */
.sm-trusted-eyebrow { text-align: center; font-family: Inter; font-size: 13px;
  letter-spacing: 0.4px; color: ${A_COLORS.ink3}; text-transform: uppercase; margin: 0; }
.sm-trusted-grid { margin-top: 30px; display: grid;
  grid-template-columns: repeat(8, 1fr); gap: 0;
  border-top: 1px solid ${A_COLORS.borderSoft};
  border-bottom: 1px solid ${A_COLORS.borderSoft}; }
.sm-logo-cell { padding: 26px 8px; font-family: Inter; font-size: 15px;
  font-weight: 500; color: ${A_COLORS.ink3}; letter-spacing: -0.2px;
  display: flex; align-items: center; justify-content: center; }
.sm-logo-cell + .sm-logo-cell { border-left: 1px solid ${A_COLORS.borderSoft}; }

/* Features ------------------------------------------------------- */
.sm-feat-row { display: grid; grid-template-columns: 1fr 1fr;
  gap: 80px; align-items: center; padding: 72px 0; }
.sm-feat-row + .sm-feat-row { border-top: 1px solid ${A_COLORS.borderSoft}; }
.sm-feat-row.reverse .sm-feat-copy { order: 2; }
.sm-feat-row.reverse .sm-feat-video { order: 1; }
.sm-feat-kicker { font-family: 'JetBrains Mono', monospace; font-size: 12px;
  color: ${A_COLORS.ink3}; letter-spacing: 1px; margin-bottom: 16px; }
.sm-feat-title { font-family: Inter; font-size: clamp(28px, 3.4cqi, 44px);
  line-height: 1.04; letter-spacing: -0.04em; font-weight: 600; margin: 0;
  color: ${A_COLORS.ink}; text-wrap: balance; }
.sm-feat-title .sub { color: ${A_COLORS.ink3}; font-weight: 500; }
.sm-feat-body { margin-top: 16px; font-family: Inter;
  font-size: clamp(15px, 1.4cqi, 17px); line-height: 1.55;
  color: ${A_COLORS.ink2}; max-width: 480px; }
.sm-feat-bullets { margin: 24px 0 0; padding: 0; list-style: none;
  display: flex; flex-direction: column; gap: 10px; }
.sm-feat-bullets li { display: flex; align-items: flex-start; gap: 10px;
  font-family: Inter; font-size: 15px; color: ${A_COLORS.ink}; line-height: 1.5; }
.sm-feat-bullets li::before { content: ''; margin-top: 9px; width: 5px; height: 5px;
  border-radius: 999px; background: ${A_COLORS.ink}; flex-shrink: 0; }
.sm-feat-ctas { margin-top: 28px; display: flex; gap: 10px; flex-wrap: wrap; }

/* Buttons -------------------------------------------------------- */
.btn { font-family: Inter; font-size: 15px; font-weight: 500;
  padding: 13px 20px; border-radius: 10px; cursor: pointer;
  border: 1px solid transparent; letter-spacing: -0.1px; }
.btn-primary { background: ${A_COLORS.ink}; color: white; border-color: ${A_COLORS.ink}; }
.btn-violet  { background: ${A_COLORS.violet}; color: white; border-color: ${A_COLORS.violet}; }
.btn-ghost   { background: transparent; color: ${A_COLORS.ink}; border-color: ${A_COLORS.border}; }

/* Testimonial ---------------------------------------------------- */
.sm-quote { font-family: Inter; font-size: clamp(22px, 3cqi, 36px);
  line-height: 1.25; letter-spacing: -0.025em; font-weight: 500;
  margin: 0; color: ${A_COLORS.ink}; text-wrap: balance; }

/* Pricing -------------------------------------------------------- */
.sm-price-grid { margin-top: 50px; display: grid;
  grid-template-columns: 1fr 1fr 1fr; gap: 18px; max-width: 1180px;
  margin-left: auto; margin-right: auto; text-align: left; }
.sm-price-card { border-radius: 18px; padding: 32px;
  display: flex; flex-direction: column; position: relative; }

/* FAQ ------------------------------------------------------------ */
.sm-faq { max-width: 880px; margin: 0 auto; }
.sm-faq-row { border-bottom: 1px solid ${A_COLORS.border}; }
.sm-faq-row:first-child { border-top: 1px solid ${A_COLORS.border}; }
.sm-faq-btn { width: 100%; display: flex; align-items: center;
  justify-content: space-between; padding: 22px 0; background: transparent;
  border: none; cursor: pointer; font-family: Inter; font-size: 18px;
  font-weight: 500; color: ${A_COLORS.ink}; text-align: left; letter-spacing: -0.2px; }
.sm-faq-toggle { width: 28px; height: 28px; border-radius: 999px;
  font-size: 16px; line-height: 26px; text-align: center;
  border: 1px solid ${A_COLORS.border}; color: ${A_COLORS.ink};
  background: transparent; flex-shrink: 0; }
.sm-faq-toggle.open { background: ${A_COLORS.ink}; color: white; border-color: ${A_COLORS.ink}; }
.sm-faq-answer { padding: 0 0 22px; font-family: Inter; font-size: 16px;
  line-height: 1.6; color: ${A_COLORS.ink2}; max-width: 680px; }

/* Footer --------------------------------------------------------- */
.sm-footer-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 40px; }

/* Container-query responsive (mobile) --------------------------- */
@container (max-width: 760px) {
  .sm-nav { padding: 14px 18px; }
  .sm-nav-links, .sm-signin-link { display: none; }
  .sm-burger { display: inline-flex; }
  .sm-nav .sm-post-pill, .sm-create-btn, .sm-account { display: none; }

  .sm-hero { padding: 48px 20px 0; }
  .sm-hero-video { margin-top: 40px; }
  .sm-hero-ctas .btn { flex: 1; min-width: 0; }

  .sm-trusted-grid { grid-template-columns: repeat(2, 1fr); }
  .sm-logo-cell { padding: 18px 8px; font-size: 14px; }
  .sm-logo-cell + .sm-logo-cell { border-left: none; }
  .sm-logo-cell:nth-child(odd) { border-right: 1px solid ${A_COLORS.borderSoft}; }
  .sm-logo-cell:not(:nth-last-child(-n+2)) { border-bottom: 1px solid ${A_COLORS.borderSoft}; }

  .sm-feat-row { grid-template-columns: 1fr; gap: 28px; padding: 52px 0; }
  .sm-feat-row.reverse .sm-feat-copy { order: 2; }
  .sm-feat-row.reverse .sm-feat-video { order: 1; }
  .sm-feat-row:not(.reverse) .sm-feat-copy { order: 2; }
  .sm-feat-row:not(.reverse) .sm-feat-video { order: 1; }
  .sm-feat-title { font-size: 30px; }
  .sm-feat-body { font-size: 16px; }
  .sm-feat-ctas { width: 100%; }
  .sm-feat-ctas .btn { flex: 1; min-width: 0; text-align: center; }

  .sm-price-grid { grid-template-columns: 1fr; gap: 14px; }
  .sm-price-card { padding: 26px; }

  .sm-footer-grid { grid-template-columns: 1fr 1fr; }
  .sm-footer-meta { flex-direction: column; gap: 8px; align-items: flex-start !important; }

  .sm-quote-block { padding: 0 4px; }
}
@container (max-width: 480px) {
  .sm-hero h1 { letter-spacing: -0.03em; }
}
`;

/* === Logo === */
const SiteMatcherLogo = ({ height = 24 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <svg height={height} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <g fill="#7033ff">
        <path d="M2.61,37.02a1.45852,1.45852,0,0,1-.11-.55V4A1.498,1.498,0,0,1,4,2.5H15.77a1.50728,1.50728,0,0,1,1.06.44L27.18,13.29a1.49682,1.49682,0,0,1,0,2.12L5.06,37.53A1.50653,1.50653,0,0,1,2.61,37.02Z"/>
        <path d="M61.5,4V15.77a1.809,1.809,0,0,1-.11.57,1.62577,1.62577,0,0,1-.33.49L50.71,27.18a1.50713,1.50713,0,0,1-2.12,0L26.47,5.06a1.5155,1.5155,0,0,1,.4901-2.45,1.79313,1.79313,0,0,1,.57-.11L60,2.5A1.498,1.498,0,0,1,61.5,4Z"/>
        <path d="M61.39,26.98a1.45841,1.45841,0,0,1,.11.55V60A1.498,1.498,0,0,1,60,61.5H48.23a1.50747,1.50747,0,0,1-1.06-.44L36.82,50.71a1.49678,1.49678,0,0,1,0-2.12L58.94,26.47A1.50658,1.50658,0,0,1,61.39,26.98Z"/>
        <path d="M19.17,30.94,30.94,19.17a1.509,1.509,0,0,1,2.12,0L44.83,30.94a1.50907,1.50907,0,0,1,0,2.12L33.06,44.83a1.51876,1.51876,0,0,1-2.12,0L19.17,33.06A1.50906,1.50906,0,0,1,19.17,30.94Z"/>
        <path d="M37.86,59.45a1.50661,1.50661,0,0,1-1.39,2.05L4,61.5A1.498,1.498,0,0,1,2.5,60V48.23a1.81029,1.81029,0,0,1,.11-.57,1.62669,1.62669,0,0,1,.33-.49L13.29,36.82a1.54761,1.54761,0,0,1,2.12,0L37.53,58.94A1.28931,1.28931,0,0,1,37.86,59.45Z"/>
      </g>
    </svg>
    <span style={{
      fontFamily: "Inter", fontWeight: 600, fontSize: height * 0.75,
      color: A_COLORS.ink, letterSpacing: -0.4,
    }}>SiteMatcher</span>
  </div>
);

const A_Eyebrow = ({ children, dot = true }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: 8,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase",
    color: A_COLORS.ink3,
  }}>
    {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: A_COLORS.violet }} />}
    {children}
  </div>
);

/* === Nav === */
const FREE_TOOLS = [
  { name: "GapFinder", desc: "Map brand presence across the UK" },
  { name: "Requirement Directory", desc: "Verified live opportunities" },
  { name: "SiteAnalyser", desc: "Demographics for any UK postcode" },
  { name: "SiteSketcher", desc: "Sketch sites in 2D & 3D" },
];

const Chevron = ({ open = false }) => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
    style={{ marginLeft: 4, transition: "transform .18s", transform: open ? "rotate(180deg)" : "none" }}>
    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ACCOUNT_MENU = [
  { label: "Dashboard", icon: "grid" },
  { label: "Admin", icon: "shield" },
  { label: "Manage Subscription", icon: "card" },
];

const AccountIcon = ({ kind }) => {
  const sw = 1.6;
  const c = A_COLORS.ink2;
  if (kind === "grid")   return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke={c} strokeWidth={sw}/><rect x="9" y="2" width="5" height="5" rx="1" stroke={c} strokeWidth={sw}/><rect x="2" y="9" width="5" height="5" rx="1" stroke={c} strokeWidth={sw}/><rect x="9" y="9" width="5" height="5" rx="1" stroke={c} strokeWidth={sw}/></svg>;
  if (kind === "shield") return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L13 4V8C13 11 8 14 8 14C8 14 3 11 3 8V4L8 2Z" stroke={c} strokeWidth={sw} strokeLinejoin="round"/></svg>;
  if (kind === "card")   return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="9" rx="1.5" stroke={c} strokeWidth={sw}/><path d="M2 7H14" stroke={c} strokeWidth={sw}/></svg>;
  if (kind === "logout") return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 2H3V14H6" stroke={c} strokeWidth={sw} strokeLinecap="round"/><path d="M10 5L13 8L10 11M13 8H6" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/></svg>;
  return null;
};

const A_Nav = ({ isLoggedIn = false, user = { email: "you@company.co.uk", initial: "D", tier: "Pro Member" } }) => {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [toolsOpen, setToolsOpen] = React.useState(false);
  const [acctOpen, setAcctOpen] = React.useState(false);
  return (
    <React.Fragment>
      <nav className="sm-nav" data-screen-label="Nav">
        <SiteMatcherLogo height={26} />
        <div className="sm-nav-links">
          <span>Browse Requirements</span>
          <span
            className="sm-nav-tools"
            onMouseEnter={() => setToolsOpen(true)}
            onMouseLeave={() => setToolsOpen(false)}
          >
            Free Tools <Chevron open={toolsOpen}/>
            {toolsOpen && (
              <div className="sm-tools-menu">
                {FREE_TOOLS.map(t => (
                  <div key={t.name} className="sm-tools-item">
                    <div className="sm-tools-name">{t.name}</div>
                    <div className="sm-tools-desc">{t.desc}</div>
                  </div>
                ))}
              </div>
            )}
          </span>
          <span>Articles</span>
        </div>
        <div className="sm-nav-right">
          <button className="sm-post-pill">
            Post Requirement <span className="free">(Free!)</span>
          </button>
          {!isLoggedIn ? (
            <React.Fragment>
              <span className="sm-signin-link">Sign in</span>
              <button className="btn btn-violet sm-create-btn">Create account</button>
            </React.Fragment>
          ) : (
            <div
              className="sm-account"
              onMouseEnter={() => setAcctOpen(true)}
              onMouseLeave={() => setAcctOpen(false)}
            >
              <button className="sm-account-trigger">
                <span className="sm-avatar">{user.initial}</span>
                <span className="sm-account-email">{user.email}</span>
                <Chevron open={acctOpen}/>
              </button>
              {acctOpen && (
                <div className="sm-account-menu">
                  <div className="sm-account-head">
                    <div className="sm-account-headEmail">{user.email}</div>
                    <div className="sm-account-tier">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.5 4.5L11 5L8.5 7.5L9 11L6 9L3 11L3.5 7.5L1 5L4.5 4.5L6 1Z" fill="#16A34A"/></svg>
                      {user.tier}
                    </div>
                  </div>
                  <div className="sm-account-divider"/>
                  {ACCOUNT_MENU.map(m => (
                    <div key={m.label} className="sm-account-item">
                      <AccountIcon kind={m.icon}/>
                      <span>{m.label}</span>
                    </div>
                  ))}
                  <div className="sm-account-divider"/>
                  <div className="sm-account-item">
                    <AccountIcon kind="logout"/>
                    <span>Log out all devices</span>
                  </div>
                  <div className="sm-account-item danger">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 2H3V14H6" stroke="#DC2626" strokeWidth="1.6" strokeLinecap="round"/><path d="M10 5L13 8L10 11M13 8H6" stroke="#DC2626" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span>Sign out</span>
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            className="sm-burger"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen(o => !o)}
          >
            {mobileOpen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3L13 13M13 3L3 13" stroke={A_COLORS.ink} strokeWidth="1.6" strokeLinecap="round"/></svg>
            ) : (
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none"><path d="M1 1H17M1 7H17M1 13H17" stroke={A_COLORS.ink} strokeWidth="1.6" strokeLinecap="round"/></svg>
            )}
          </button>
        </div>
      </nav>
      {mobileOpen && (
        <div className="sm-mobile-menu" role="dialog" aria-label="Menu">
          {isLoggedIn && (
            <div className="sm-mobile-account">
              <span className="sm-avatar lg">{user.initial}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Inter", fontSize: 15, fontWeight: 600, color: A_COLORS.ink }}>{user.email}</div>
                <div className="sm-account-tier" style={{ marginTop: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.5 4.5L11 5L8.5 7.5L9 11L6 9L3 11L3.5 7.5L1 5L4.5 4.5L6 1Z" fill="#16A34A"/></svg>
                  {user.tier}
                </div>
              </div>
            </div>
          )}
          <div className="sm-mobile-section">
            <a className="sm-mobile-link">Browse Requirements</a>
            <div className="sm-mobile-grouplabel">Free Tools</div>
            {FREE_TOOLS.map(t => (
              <div key={t.name} className="sm-mobile-toolitem">
                <div className="sm-mobile-toolname">{t.name}</div>
                <div className="sm-mobile-tooldesc">{t.desc}</div>
              </div>
            ))}
            <a className="sm-mobile-link">Articles</a>
            {isLoggedIn && (
              <React.Fragment>
                <div className="sm-mobile-grouplabel">Account</div>
                {ACCOUNT_MENU.map(m => (
                  <div key={m.label} className="sm-mobile-acctlink">
                    <AccountIcon kind={m.icon}/> {m.label}
                  </div>
                ))}
              </React.Fragment>
            )}
          </div>
          <div className="sm-mobile-footer">
            <button className="sm-post-pill sm-post-pill-full">
              Post Requirement <span className="free">(Free!)</span>
            </button>
            {!isLoggedIn ? (
              <div className="sm-mobile-authbtns">
                <button className="btn btn-ghost sm-fullbtn">Sign in</button>
                <button className="btn btn-violet sm-fullbtn">Create account</button>
              </div>
            ) : (
              <button className="btn btn-ghost sm-fullbtn sm-signout">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}><path d="M6 2H3V14H6" stroke="#DC2626" strokeWidth="1.6" strokeLinecap="round"/><path d="M10 5L13 8L10 11M13 8H6" stroke="#DC2626" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Sign out
              </button>
            )}
          </div>
        </div>
      )}
    </React.Fragment>
  );
};

/* === Hero === */
const A_Hero = () => (
  <section className="sm-hero" data-screen-label="Hero" data-reveal>
    <A_Eyebrow>For commercial property professionals</A_Eyebrow>
    <h1>
      The clearest view of UK<br/>commercial property — <em>in one place.</em>
    </h1>
    <p>
      Find requirements, map brand presence, analyse catchments and mock up sites — without the spreadsheet trail.
    </p>
    <div className="sm-hero-ctas">
      <button className="btn btn-violet">Start 30-day free trial</button>
      <button className="btn btn-ghost">See it in action ↓</button>
    </div>
    <div className="sm-hero-video">
      <VideoSlot
        label="Full product overview"
        note="60-second walkthrough showing the dashboard, map and key flows"
        ratio="16/9"
      />
    </div>
  </section>
);

/* === Trusted by === */
const A_TrustedBy = () => (
  <section className="sm-section" style={{ paddingTop: 100, paddingBottom: 60 }} data-screen-label="Trusted by" data-reveal>
    <p className="sm-trusted-eyebrow">Trusted by the biggest names in UK commercial property</p>
    <div className="sm-trusted-grid">
      {LOGOS.map((l, i) => (
        <div key={i} className="sm-logo-cell">{l}</div>
      ))}
    </div>
  </section>
);

/* === Feature row === */
const A_FeatureRow = ({ idx, name, kicker, headline, body, bullets, videoLabel, videoNote, reverse, ctas }) => (
  <div className={`sm-feat-row${reverse ? " reverse" : ""}`} data-reveal>
    <div className="sm-feat-copy">
      <div className="sm-feat-kicker">0{idx} / {kicker}</div>
      <h3 className="sm-feat-title">
        {name} <span className="sub">— {headline}</span>
      </h3>
      <p className="sm-feat-body">{body}</p>
      <ul className="sm-feat-bullets">
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
      <div className="sm-feat-ctas">
        {ctas.map((c, i) => (
          <button key={i} className={`btn ${c.style === "violet" ? "btn-violet" : (c.style === "primary" ? "btn-primary" : "btn-ghost")}`}>
            {c.label}
          </button>
        ))}
      </div>
    </div>
    <div className="sm-feat-video">
      <VideoSlot label={videoLabel} note={videoNote} ratio="4/3" />
    </div>
  </div>
);

const A_Features = () => (
  <section className="sm-section" style={{ paddingTop: 60, paddingBottom: 40 }} data-screen-label="Features">
    <div className="sm-narrow">
      <div style={{ maxWidth: 720, marginBottom: 36 }} data-reveal>
        <A_Eyebrow>How it works</A_Eyebrow>
        <h2 style={{
          fontFamily: "Inter", fontSize: "clamp(32px, 4.4cqi, 56px)", lineHeight: 1.02,
          letterSpacing: "-0.035em", fontWeight: 600, margin: "16px 0 0",
          color: A_COLORS.ink, textWrap: "balance",
        }}>
          Four tools. One workflow. From shortlist to signed.
        </h2>
      </div>
      <A_FeatureRow
        idx={1}
        name="GapFinder"
        kicker="Map brand presence"
        headline="see where every brand isn't yet."
        body="GapFinder maps brand presence across the UK so you can find the gaps before anyone else. Spot off-market opportunities your competitors miss."
        bullets={[
          "Every major UK retail brand, mapped",
          "Filter by sector, fascia or catchment",
          "Export shortlists to PDF",
        ]}
        videoLabel="GapFinder demo"
        videoNote="Map view zooming into a region; gaps highlighting"
        ctas={[{ label: "Find Gaps Now", style: "violet" }]}
      />
      <A_FeatureRow
        idx={2}
        name="Requirement Directory"
        kicker="Verified live opportunities"
        headline="only the live ones, only the real ones."
        body="A curated directory of commercial property requirements in the UK. Every listing is verified by us and kept current, so you're only working with live opportunities."
        bullets={[
          "Hand-verified before going live",
          "Re-checked on a rolling basis",
          "Direct contact details on Pro+",
        ]}
        videoLabel="Requirement Directory"
        videoNote="Scrolling the list, filtering, opening a detail card"
        reverse
        ctas={[
          { label: "Browse Requirements Now", style: "violet" },
          { label: "Post For Free (Forever!)", style: "ghost" },
        ]}
      />
      <A_FeatureRow
        idx={3}
        name="SiteAnalyser"
        kicker="Catchment & demographics"
        headline="instant demographics for any UK postcode."
        body="SiteAnalyser pulls population, affluence and household data for any catchment in seconds — no consultant report required."
        bullets={[
          "Drive-time and walk-time catchments",
          "Affluence, age, household composition",
          "Branded PDF reports on Plus",
        ]}
        videoLabel="SiteAnalyser"
        videoNote="Dropping a pin, isochrone forming, stats panel populating"
        ctas={[{ label: "Try For Free", style: "violet" }]}
      />
      <A_FeatureRow
        idx={4}
        name="SiteSketcher"
        kicker="2D & 3D site mock-ups"
        headline="sketch a feasibility in a coffee break."
        body="Mock up site layouts in 2D and 3D. Draw, measure and visualise on any plot — without opening CAD."
        bullets={[
          "Drag, draw and measure on any plot",
          "Toggle between 2D and 3D views",
          "Share live links with clients",
        ]}
        videoLabel="SiteSketcher"
        videoNote="Drawing a footprint on a plot, extruding to 3D"
        reverse
        ctas={[{ label: "Try For Free", style: "violet" }]}
      />
    </div>
  </section>
);

/* === Testimonial === */
const A_Testimonial = () => (
  <section className="sm-section" data-screen-label="Testimonial" data-reveal style={{
    background: A_COLORS.surface,
    borderTop: `1px solid ${A_COLORS.borderSoft}`,
    borderBottom: `1px solid ${A_COLORS.borderSoft}`,
  }}>
    <div className="sm-quote-block" style={{ maxWidth: 980, margin: "0 auto", textAlign: "center" }}>
      <svg width="32" height="24" viewBox="0 0 32 24" style={{ marginBottom: 22, opacity: 0.25 }}>
        <path d="M0 24V14C0 6.5 4.5 1 12 0L13 4C8.5 5 6 8.5 6 13H12V24H0ZM18 24V14C18 6.5 22.5 1 30 0L31 4C26.5 5 24 8.5 24 13H30V24H18Z" fill={A_COLORS.ink}/>
      </svg>
      <blockquote className="sm-quote">
        With SiteMatcher I can see the market in seconds. Searching and filtering is straightforward, contacts are right there, and the flyers give me the detail when I need it. It is easily the fastest way I have found to spot real opportunities.
      </blockquote>
      <div style={{
        marginTop: 28, display: "flex", alignItems: "center", gap: 12,
        justifyContent: "center", fontFamily: "Inter", fontSize: 14,
      }}>
        <div style={{ width: 40, height: 40, borderRadius: 999, background: "#D9D2E4" }} />
        <div style={{ textAlign: "left" }}>
          <div style={{ fontWeight: 600, color: A_COLORS.ink }}>Karry Northfield</div>
          <div style={{ color: A_COLORS.ink3 }}>Director Advisor · Voicemagic Shopworthy</div>
        </div>
      </div>
    </div>
  </section>
);

/* === Pricing === */
const A_PricingCard = ({ tier, period, featured }) => {
  const p = PRICING[tier];
  const pr = p[period];
  return (
    <div className="sm-price-card" style={{
      background: featured ? A_COLORS.ink : A_COLORS.surface,
      border: featured ? "none" : `1px solid ${A_COLORS.border}`,
      color: featured ? "white" : A_COLORS.ink,
    }}>
      {p.badge && (
        <div style={{
          position: "absolute", top: -12, left: 32,
          background: A_COLORS.violet, color: "white",
          fontFamily: "Inter", fontSize: 12, fontWeight: 600,
          padding: "5px 12px", borderRadius: 999, letterSpacing: 0.2,
        }}>{p.badge}</div>
      )}
      <div>
        <div style={{ fontFamily: "Inter", fontSize: 18, fontWeight: 600 }}>{p.name}</div>
        <div style={{ fontFamily: "Inter", fontSize: 14, color: featured ? "rgba(255,255,255,0.65)" : A_COLORS.ink3, marginTop: 2 }}>{p.audience}</div>
      </div>
      <div style={{ marginTop: 26, minHeight: 92 }}>
        {pr.strike && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{
              textDecoration: "line-through", fontFamily: "Inter",
              fontSize: 16, color: featured ? "rgba(255,255,255,0.45)" : A_COLORS.ink3,
            }}>{pr.strike}</span>
            <span style={{
              fontFamily: "Inter", fontSize: 11, fontWeight: 600,
              padding: "2px 7px", borderRadius: 4,
              background: featured ? "rgba(255,255,255,0.15)" : A_COLORS.violetTint,
              color: featured ? "white" : A_COLORS.violetDeep,
            }}>{pr.discount}</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontFamily: "Inter", fontSize: 46, fontWeight: 600, letterSpacing: "-0.035em" }}>{pr.price}</span>
          <span style={{ fontFamily: "Inter", fontSize: 15, color: featured ? "rgba(255,255,255,0.65)" : A_COLORS.ink3 }}>{pr.suffix}</span>
        </div>
        {pr.footnote && (
          <div style={{ fontFamily: "Inter", fontSize: 12, color: featured ? "rgba(255,255,255,0.55)" : A_COLORS.ink3, marginTop: 6, lineHeight: 1.45 }}>
            {pr.footnote}
          </div>
        )}
      </div>
      <button className="btn" style={{
        marginTop: 20,
        background: featured ? A_COLORS.violet : (p.ctaStyle === "outline" ? "transparent" : A_COLORS.ink),
        color: featured ? "white" : (p.ctaStyle === "outline" ? A_COLORS.ink : "white"),
        borderColor: featured ? A_COLORS.violet : (p.ctaStyle === "outline" ? A_COLORS.border : A_COLORS.ink),
      }}>{p.cta}</button>
      {p.intro && (
        <div style={{
          marginTop: 22, fontFamily: "Inter", fontSize: 13, fontWeight: 500,
          color: featured ? "rgba(255,255,255,0.7)" : A_COLORS.ink3,
        }}>{p.intro}</div>
      )}
      {p.callout && (
        <div style={{
          marginTop: 14, padding: 14, borderRadius: 10,
          background: "rgba(124,58,237,0.20)",
          border: "1px solid rgba(124,58,237,0.30)",
        }}>
          <div style={{ fontFamily: "Inter", fontSize: 13, fontWeight: 600 }}>◆ {p.callout.title}</div>
          <div style={{ fontFamily: "Inter", fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 4, lineHeight: 1.45 }}>{p.callout.body}</div>
        </div>
      )}
      <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
        {p.features.map((f, i) => (
          <li key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            fontFamily: "Inter", fontSize: 14,
            color: f.on ? (featured ? "white" : A_COLORS.ink) : (featured ? "rgba(255,255,255,0.4)" : A_COLORS.ink3),
            textDecoration: f.on ? "none" : "line-through",
          }}>
            {f.on
              ? <Check size={14} color={featured ? "white" : A_COLORS.violet} />
              : <Dash size={14} color={featured ? "rgba(255,255,255,0.4)" : A_COLORS.ink3} />}
            {f.text}
          </li>
        ))}
      </ul>
    </div>
  );
};

const A_Pricing = ({ period, setPeriod }) => (
  <section className="sm-section" data-screen-label="Pricing" data-reveal style={{ textAlign: "center" }}>
    <A_Eyebrow>Pricing</A_Eyebrow>
    <h2 style={{
      fontFamily: "Inter", fontSize: "clamp(32px, 4.4cqi, 56px)", lineHeight: 1.02,
      letterSpacing: "-0.035em", fontWeight: 600, margin: "16px 0 12px",
      color: A_COLORS.ink, textWrap: "balance",
    }}>Simple, transparent pricing.</h2>
    <p style={{ fontFamily: "Inter", fontSize: 17, color: A_COLORS.ink2, margin: 0 }}>
      Start with Free, upgrade to Pro when you're ready. 30-day free trial on Pro &amp; Plus.
    </p>
    <div style={{
      display: "inline-flex", alignItems: "center",
      marginTop: 26, padding: 4, background: A_COLORS.surface,
      border: `1px solid ${A_COLORS.border}`, borderRadius: 999,
    }}>
      {["monthly", "annual"].map(k => (
        <button key={k} onClick={() => setPeriod(k)} style={{
          padding: "8px 18px", border: "none", cursor: "pointer",
          background: period === k ? A_COLORS.ink : "transparent",
          color: period === k ? "white" : A_COLORS.ink2,
          borderRadius: 999, fontFamily: "Inter", fontSize: 14, fontWeight: 500,
        }}>
          {k === "monthly" ? "Monthly" : "Annual · save 17%"}
        </button>
      ))}
    </div>
    <div style={{
      marginTop: 18, display: "inline-flex", alignItems: "center", gap: 8,
      padding: "6px 12px", borderRadius: 999,
      background: "rgba(112,51,255,0.06)", border: "1px solid rgba(112,51,255,0.18)",
      fontFamily: "Inter", fontSize: 12, color: A_COLORS.violetDeep,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: A_COLORS.violet }}/>
      Summer Sale — 50% off, ends 31 August
    </div>
    <div className="sm-price-grid">
      <A_PricingCard tier="free" period={period} />
      <A_PricingCard tier="pro" period={period} />
      <A_PricingCard tier="plus" period={period} featured />
    </div>
    <div style={{ marginTop: 24, fontFamily: "Inter", fontSize: 13, color: A_COLORS.ink3 }}>
      All plans include the full SiteMatcher database. Cancel anytime. No card required for trial.
    </div>
  </section>
);

/* === FAQ === */
const A_FAQ = ({ openIdx, setOpenIdx }) => (
  <section className="sm-section" data-screen-label="FAQ" data-reveal>
    <div className="sm-faq">
      <A_Eyebrow>FAQ</A_Eyebrow>
      <h2 style={{
        fontFamily: "Inter", fontSize: "clamp(30px, 3.8cqi, 48px)", lineHeight: 1.04,
        letterSpacing: "-0.035em", fontWeight: 600, margin: "16px 0 36px",
        color: A_COLORS.ink, textWrap: "balance",
      }}>Everything you need to know.</h2>
      <div>
        {FAQS.map((f, i) => {
          const open = openIdx === i;
          return (
            <div key={i} className="sm-faq-row">
              <button className="sm-faq-btn" onClick={() => setOpenIdx(open ? -1 : i)}>
                {f.q}
                <span className={`sm-faq-toggle${open ? " open" : ""}`}>{open ? "−" : "+"}</span>
              </button>
              {open && <div className="sm-faq-answer">{f.a}</div>}
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop: 32, padding: 24,
        background: A_COLORS.surface, borderRadius: 14,
        border: `1px solid ${A_COLORS.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20,
        flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontFamily: "Inter", fontSize: 17, fontWeight: 600, color: A_COLORS.ink }}>Still have questions?</div>
          <div style={{ fontFamily: "Inter", fontSize: 14, color: A_COLORS.ink2, marginTop: 2 }}>Our team is here to help. We'll get back within 24 hours.</div>
        </div>
        <button className="btn btn-violet" style={{ flexShrink: 0 }}>hello@sitematcher.co.uk</button>
      </div>
    </div>
  </section>
);

/* === Footer === */
const A_Footer = () => (
  <footer data-screen-label="Footer" style={{
    padding: "60px clamp(20px, 5cqi, 80px) 32px",
    background: A_COLORS.ink, color: "rgba(255,255,255,0.75)",
  }}>
    <div className="sm-footer-grid">
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg height="26" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <g fill="#9B6BFF">
              <path d="M2.61,37.02a1.45852,1.45852,0,0,1-.11-.55V4A1.498,1.498,0,0,1,4,2.5H15.77a1.50728,1.50728,0,0,1,1.06.44L27.18,13.29a1.49682,1.49682,0,0,1,0,2.12L5.06,37.53A1.50653,1.50653,0,0,1,2.61,37.02Z"/>
              <path d="M61.5,4V15.77a1.809,1.809,0,0,1-.11.57,1.62577,1.62577,0,0,1-.33.49L50.71,27.18a1.50713,1.50713,0,0,1-2.12,0L26.47,5.06a1.5155,1.5155,0,0,1,.4901-2.45,1.79313,1.79313,0,0,1,.57-.11L60,2.5A1.498,1.498,0,0,1,61.5,4Z"/>
              <path d="M61.39,26.98a1.45841,1.45841,0,0,1,.11.55V60A1.498,1.498,0,0,1,60,61.5H48.23a1.50747,1.50747,0,0,1-1.06-.44L36.82,50.71a1.49678,1.49678,0,0,1,0-2.12L58.94,26.47A1.50658,1.50658,0,0,1,61.39,26.98Z"/>
              <path d="M19.17,30.94,30.94,19.17a1.509,1.509,0,0,1,2.12,0L44.83,30.94a1.50907,1.50907,0,0,1,0,2.12L33.06,44.83a1.51876,1.51876,0,0,1-2.12,0L19.17,33.06A1.50906,1.50906,0,0,1,19.17,30.94Z"/>
              <path d="M37.86,59.45a1.50661,1.50661,0,0,1-1.39,2.05L4,61.5A1.498,1.498,0,0,1,2.5,60V48.23a1.81029,1.81029,0,0,1,.11-.57,1.62669,1.62669,0,0,1,.33-.49L13.29,36.82a1.54761,1.54761,0,0,1,2.12,0L37.53,58.94A1.28931,1.28931,0,0,1,37.86,59.45Z"/>
            </g>
          </svg>
          <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 18, color: "white", letterSpacing: -0.4 }}>SiteMatcher</span>
        </div>
        <div style={{ marginTop: 16, fontFamily: "Inter", fontSize: 13, lineHeight: 1.55, maxWidth: 280 }}>
          The clearest view of UK commercial property. Built for occupiers, agents and landlords.
        </div>
      </div>
      {[
        { h: "Product", items: ["GapFinder", "Requirement Directory", "SiteAnalyser", "SiteSketcher"] },
        { h: "Company", items: ["About", "Customers", "Careers", "Contact"] },
        { h: "Legal", items: ["Terms", "Privacy", "Cookies"] },
      ].map((c, i) => (
        <div key={i}>
          <div style={{ fontFamily: "Inter", fontSize: 13, color: "white", fontWeight: 600, marginBottom: 12, letterSpacing: 0.2 }}>{c.h}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, fontFamily: "Inter", fontSize: 14 }}>
            {c.items.map(it => <span key={it}>{it}</span>)}
          </div>
        </div>
      ))}
    </div>
    <div className="sm-footer-meta" style={{
      marginTop: 44, paddingTop: 22,
      borderTop: "1px solid rgba(255,255,255,0.1)",
      display: "flex", justifyContent: "space-between",
      fontFamily: "Inter", fontSize: 13, color: "rgba(255,255,255,0.5)",
    }}>
      <span>© 2026 SiteMatcher Ltd</span>
      <span>hello@sitematcher.co.uk</span>
    </div>
  </footer>
);

/* === Page === */
const DirectionA = ({ isLoggedIn = false } = {}) => {
  const [period, setPeriod] = React.useState("annual");
  const [openIdx, setOpenIdx] = React.useState(0);
  return (
    <div className="sm-page" style={{
      background: A_COLORS.bg, fontFamily: "Inter, sans-serif",
      color: A_COLORS.ink, minHeight: "100%",
    }}>
      <style>{A_CSS}</style>
      <A_Nav isLoggedIn={isLoggedIn} />
      <A_Hero />
      <A_TrustedBy />
      <A_Features />
      <A_Testimonial />
      <A_Pricing period={period} setPeriod={setPeriod} />
      <A_FAQ openIdx={openIdx} setOpenIdx={setOpenIdx} />
      <A_Footer />
    </div>
  );
};

window.DirectionA = DirectionA;
