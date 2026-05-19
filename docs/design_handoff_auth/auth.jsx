/* Sign in / Create account — matches Direction A editorial-restraint style.
   Reuses A_COLORS and A_Nav from direction-a.jsx. */

const AUTH_CSS = `
.sm-auth-shell { min-height: 100%; background: ${A_COLORS.bg}; display: flex; flex-direction: column; }
.sm-auth-main { flex: 1; display: grid; grid-template-columns: 1fr 1fr; min-height: 0; }
.sm-auth-left { padding: 80px 64px; display: flex; flex-direction: column;
  justify-content: space-between; border-right: 1px solid ${A_COLORS.borderSoft};
  background: ${A_COLORS.bg}; }
.sm-auth-right { padding: 80px 64px; display: flex; align-items: flex-start;
  justify-content: center; background: ${A_COLORS.surface}; }
.sm-auth-card { width: 100%; max-width: 460px; }

.sm-auth-eyebrow { display: inline-flex; align-items: center; gap: 8px;
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  letter-spacing: 1.4px; text-transform: uppercase; color: ${A_COLORS.ink3}; }
.sm-auth-eyebrow .dot { width: 6px; height: 6px; border-radius: 999px; background: ${A_COLORS.violet}; }
.sm-auth-h1 { font-family: Inter; font-size: clamp(36px, 4.6cqi, 56px); line-height: 1.0;
  letter-spacing: -0.04em; font-weight: 600; color: ${A_COLORS.ink};
  margin: 20px 0 0; text-wrap: balance; }
.sm-auth-h1 em { font-style: italic; font-weight: 500; color: ${A_COLORS.violetDeep}; }
.sm-auth-sub { font-family: Inter; font-size: 16px; line-height: 1.5;
  color: ${A_COLORS.ink2}; margin: 20px 0 0; max-width: 420px; }

.sm-auth-features { margin: 40px 0 0; padding: 0; list-style: none;
  display: flex; flex-direction: column; gap: 14px; }
.sm-auth-features li { display: flex; gap: 12px; align-items: flex-start;
  font-family: Inter; font-size: 15px; color: ${A_COLORS.ink}; line-height: 1.5; }
.sm-auth-features li svg { flex-shrink: 0; margin-top: 3px; }
.sm-auth-features li b { font-weight: 600; }
.sm-auth-features li span.muted { color: ${A_COLORS.ink2}; }

.sm-auth-quote { padding: 24px; border-top: 1px solid ${A_COLORS.borderSoft};
  margin-top: 48px; }
.sm-auth-quote p { font-family: Inter; font-size: 16px; line-height: 1.5;
  color: ${A_COLORS.ink}; margin: 0; letter-spacing: -0.2px; text-wrap: balance; }
.sm-auth-quote .who { margin-top: 14px; display: flex; align-items: center; gap: 10px;
  font-family: Inter; font-size: 13px; color: ${A_COLORS.ink3}; }
.sm-auth-quote .who .avatar { width: 28px; height: 28px; border-radius: 999px; background: #D9D2E4; }
.sm-auth-quote .who b { color: ${A_COLORS.ink}; font-weight: 600; }

.sm-auth-tabs { display: inline-flex; padding: 4px; background: ${A_COLORS.bg};
  border: 1px solid ${A_COLORS.border}; border-radius: 999px; }
.sm-auth-tab { padding: 8px 18px; border: none; background: transparent;
  border-radius: 999px; cursor: pointer; font-family: Inter; font-size: 14px;
  font-weight: 500; color: ${A_COLORS.ink2}; letter-spacing: -0.1px;
  transition: background .15s, color .15s; }
.sm-auth-tab.active { background: ${A_COLORS.violet}; color: white; }

.sm-auth-title { font-family: Inter; font-size: 30px; line-height: 1.1;
  letter-spacing: -0.03em; font-weight: 600; color: ${A_COLORS.ink};
  margin: 28px 0 6px; }
.sm-auth-titlesub { font-family: Inter; font-size: 15px;
  color: ${A_COLORS.ink2}; margin: 0 0 28px; }

.sm-form { display: flex; flex-direction: column; gap: 18px; }
.sm-field { display: flex; flex-direction: column; gap: 7px; }
.sm-label { font-family: Inter; font-size: 13px; font-weight: 500;
  color: ${A_COLORS.ink}; letter-spacing: -0.1px; }
.sm-input-wrap { position: relative; }
.sm-input { width: 100%; height: 46px; padding: 0 14px;
  background: ${A_COLORS.surface}; color: ${A_COLORS.ink};
  border: 1px solid ${A_COLORS.border}; border-radius: 10px;
  font-family: Inter; font-size: 15px; outline: none;
  transition: border-color .15s, box-shadow .15s; }
.sm-input::placeholder { color: ${A_COLORS.ink3}; }
.sm-input:focus { border-color: ${A_COLORS.violet}; box-shadow: 0 0 0 3px rgba(112,51,255,0.12); }
.sm-input.has-trail { padding-right: 44px; }
.sm-input-trail { position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: transparent; border: none; cursor: pointer; padding: 6px;
  color: ${A_COLORS.ink3}; display: inline-flex; }
.sm-input-trail:hover { color: ${A_COLORS.ink}; }

.sm-select { appearance: none; -webkit-appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10' fill='none'><path d='M2 3.5L5 6.5L8 3.5' stroke='%237C7588' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  background-repeat: no-repeat; background-position: right 14px center;
  padding-right: 36px; }
.sm-select.placeholder { color: ${A_COLORS.ink3}; }

.sm-helper { font-family: Inter; font-size: 12px; color: ${A_COLORS.ink3};
  margin-top: 2px; line-height: 1.45; }

.sm-pw-rules { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px;
  margin-top: 8px; }
.sm-pw-rule { display: flex; align-items: center; gap: 7px;
  font-family: Inter; font-size: 12px; color: ${A_COLORS.ink3};
  transition: color .15s; }
.sm-pw-rule.met { color: #15803D; }
.sm-pw-rule .tick { width: 14px; height: 14px; border-radius: 999px;
  border: 1px solid ${A_COLORS.border}; display: inline-flex;
  align-items: center; justify-content: center; flex-shrink: 0;
  transition: background .15s, border-color .15s; }
.sm-pw-rule.met .tick { background: #DCFCE7; border-color: #BBF7D0; }

.sm-row-between { display: flex; align-items: center; justify-content: space-between;
  margin-top: -4px; }
.sm-link { font-family: Inter; font-size: 13px; color: ${A_COLORS.violetDeep};
  cursor: pointer; font-weight: 500; }
.sm-link:hover { text-decoration: underline; }

.sm-checkbox-row { display: flex; gap: 12px; align-items: flex-start;
  cursor: pointer; user-select: none; }
.sm-checkbox { width: 18px; height: 18px; border-radius: 5px;
  border: 1px solid ${A_COLORS.border}; background: ${A_COLORS.surface};
  flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  margin-top: 1px; transition: background .15s, border-color .15s; }
.sm-checkbox.checked { background: ${A_COLORS.violet}; border-color: ${A_COLORS.violet}; }
.sm-checkbox-row .label { font-family: Inter; font-size: 13px; color: ${A_COLORS.ink2};
  line-height: 1.5; }
.sm-checkbox-row .label b { color: ${A_COLORS.ink}; font-weight: 500; }

.sm-submit { width: 100%; height: 50px; border-radius: 10px;
  background: ${A_COLORS.violet}; color: white; border: 1px solid ${A_COLORS.violet};
  font-family: Inter; font-size: 15px; font-weight: 600; letter-spacing: -0.1px;
  cursor: pointer; transition: background .15s; }
.sm-submit:hover { background: ${A_COLORS.violetDeep}; }
.sm-submit:disabled { background: ${A_COLORS.border}; color: ${A_COLORS.ink3};
  border-color: ${A_COLORS.border}; cursor: not-allowed; }

.sm-divider { display: flex; align-items: center; gap: 14px; margin: 4px 0;
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  letter-spacing: 1.2px; color: ${A_COLORS.ink3}; text-transform: uppercase; }
.sm-divider::before, .sm-divider::after { content: ''; flex: 1; height: 1px; background: ${A_COLORS.borderSoft}; }

.sm-oauth { width: 100%; height: 46px; border-radius: 10px;
  background: ${A_COLORS.surface}; color: ${A_COLORS.ink};
  border: 1px solid ${A_COLORS.border};
  font-family: Inter; font-size: 14px; font-weight: 500; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  transition: background .15s; }
.sm-oauth:hover { background: ${A_COLORS.bg}; }

.sm-tcs { font-family: Inter; font-size: 12px; color: ${A_COLORS.ink3};
  text-align: center; line-height: 1.55; margin: 0; }
.sm-tcs a { color: ${A_COLORS.violetDeep}; text-decoration: none; }
.sm-tcs a:hover { text-decoration: underline; }

.sm-switch-row { font-family: Inter; font-size: 14px; color: ${A_COLORS.ink2};
  text-align: center; margin-top: 24px; }
.sm-switch-row button { background: transparent; border: none; padding: 0;
  font: inherit; color: ${A_COLORS.violetDeep}; font-weight: 600; cursor: pointer; }
.sm-switch-row button:hover { text-decoration: underline; }

/* Mobile */
@container (max-width: 860px) {
  .sm-auth-main { grid-template-columns: 1fr; }
  .sm-auth-left { display: none; }
  .sm-auth-right { padding: 32px 20px 64px; }
}
`;

/* === Small SVG helpers === */
const EyeIcon = ({ open }) => (
  open
    ? <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6S1.5 10 1.5 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/></svg>
    : <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M3 3L17 17M8 4.5C8.6 4.3 9.3 4.2 10 4.2c5.5 0 8.5 5.8 8.5 5.8s-1 1.9-2.8 3.5M5.3 6.2C2.8 7.8 1.5 10 1.5 10S4.5 16 10 16c1.5 0 2.8-.4 3.9-1M8.5 8.5a2.5 2.5 0 0 0 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

const CheckIcon = ({ size = 10, color = "white" }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="none">
    <path d="M2 5L4 7L8 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const FeatureCheck = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="8" fill={A_COLORS.violetTint}/>
    <path d="M5 8L7 10L11 6" stroke={A_COLORS.violetDeep} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const GoogleMark = () => (
  <svg width="16" height="16" viewBox="0 0 18 18">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.56 2.69-3.86 2.69-6.62Z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.92v2.33A9 9 0 0 0 9 18Z"/>
    <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.97H.92A9 9 0 0 0 0 9c0 1.45.35 2.83.92 4.03l3.03-2.33Z"/>
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .92 4.97l3.03 2.33C4.66 5.17 6.65 3.58 9 3.58Z"/>
  </svg>
);

const MicrosoftMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <rect x="0" y="0" width="7" height="7" fill="#F25022"/>
    <rect x="9" y="0" width="7" height="7" fill="#7FBA00"/>
    <rect x="0" y="9" width="7" height="7" fill="#00A4EF"/>
    <rect x="9" y="9" width="7" height="7" fill="#FFB900"/>
  </svg>
);

/* === Constants === */
const ROLE_OPTIONS = [
  "Commercial Occupier",
  "Landlord/developer",
  "Housebuilder",
  "Agent",
  "Government",
  "Other",
];

const PW_RULES = [
  { id: "len", label: "8+ characters", test: v => v.length >= 8 },
  { id: "upper", label: "Uppercase letter", test: v => /[A-Z]/.test(v) },
  { id: "lower", label: "Lowercase letter", test: v => /[a-z]/.test(v) },
  { id: "num", label: "A number", test: v => /[0-9]/.test(v) },
];

/* === Left rail (editorial side) === */
const AuthLeftRail = ({ mode }) => (
  <div className="sm-auth-left">
    <div>
      <div className="sm-auth-eyebrow"><span className="dot"/>{mode === "signin" ? "Welcome back" : "Create your account"}</div>
      {mode === "signin" ? (
        <React.Fragment>
          <h1 className="sm-auth-h1">
            Pick up <em>right where you left off.</em>
          </h1>
          <p className="sm-auth-sub">
            Your shortlists, saved searches and reports — all waiting on the other side of one quick sign in.
          </p>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <h1 className="sm-auth-h1">
            The clearest view of UK property — <em>starts free.</em>
          </h1>
          <p className="sm-auth-sub">
            Create an account in under a minute. No card required. Cancel any time.
          </p>
          <ul className="sm-auth-features">
            <li>
              <FeatureCheck/>
              <span><b>Full database access</b> <span className="muted">— every verified live requirement, refreshed daily.</span></span>
            </li>
            <li>
              <FeatureCheck/>
              <span><b>Free tools forever</b> <span className="muted">— GapFinder, SiteAnalyser and SiteSketcher, no time limit.</span></span>
            </li>
            <li>
              <FeatureCheck/>
              <span><b>30-day trial of Pro</b> <span className="muted">— direct contacts, branded PDFs and CSV exports.</span></span>
            </li>
          </ul>
        </React.Fragment>
      )}
    </div>
    <div className="sm-auth-quote">
      <p>"With SiteMatcher I can see the market in seconds. It's easily the fastest way I've found to spot real opportunities."</p>
      <div className="who">
        <span className="avatar"/>
        <span><b>Karry Northfield</b> · Director Advisor, Voicemagic Shopworthy</span>
      </div>
    </div>
  </div>
);

/* === Sign in form === */
const SignInForm = ({ onSwitch }) => {
  const [email, setEmail] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);
  const [remember, setRemember] = React.useState(true);

  return (
    <div className="sm-auth-card">
      <h2 className="sm-auth-title">Sign in</h2>
      <p className="sm-auth-titlesub">Enter your details to access your account.</p>

      <div className="sm-form">
        <div className="sm-field">
          <label className="sm-label" htmlFor="si-email">Email address</label>
          <div className="sm-input-wrap">
            <input id="si-email" className="sm-input" type="email" autoComplete="email"
              placeholder="you@company.co.uk"
              value={email} onChange={e => setEmail(e.target.value)}/>
          </div>
        </div>

        <div className="sm-field">
          <label className="sm-label" htmlFor="si-pw">Password</label>
          <div className="sm-input-wrap">
            <input id="si-pw" className="sm-input has-trail"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={pw} onChange={e => setPw(e.target.value)}/>
            <button type="button" className="sm-input-trail"
              aria-label={showPw ? "Hide password" : "Show password"}
              onClick={() => setShowPw(s => !s)}>
              <EyeIcon open={showPw}/>
            </button>
          </div>
        </div>

        <div className="sm-row-between">
          <label className="sm-checkbox-row" onClick={() => setRemember(r => !r)}>
            <span className={`sm-checkbox${remember ? " checked" : ""}`}>
              {remember && <CheckIcon size={10}/>}
            </span>
            <span className="label">Remember me for 30 days</span>
          </label>
          <span className="sm-link">Forgot password?</span>
        </div>

        <button className="sm-submit" type="button" disabled={!email || !pw}>Sign in</button>

        <div className="sm-divider">or continue with</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button className="sm-oauth" type="button"><GoogleMark/> Google</button>
          <button className="sm-oauth" type="button"><MicrosoftMark/> Microsoft</button>
        </div>
      </div>

      <div className="sm-switch-row">
        New to SiteMatcher? <button type="button" onClick={onSwitch}>Create an account</button>
      </div>
    </div>
  );
};

/* === Create account form === */
const CreateAccountForm = ({ onSwitch }) => {
  const [email, setEmail] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);

  const ruleStates = PW_RULES.map(r => ({ ...r, met: r.test(pw) }));
  const pwValid = ruleStates.every(r => r.met);
  const formValid = email && pwValid;

  return (
    <div className="sm-auth-card">
      <h2 className="sm-auth-title">Create your account</h2>
      <p className="sm-auth-titlesub">Free forever. Upgrade when you're ready.</p>

      <div className="sm-form">
        <div className="sm-field">
          <label className="sm-label" htmlFor="ca-email">Email address</label>
          <div className="sm-input-wrap">
            <input id="ca-email" className="sm-input" type="email" autoComplete="email"
              placeholder="you@company.co.uk"
              value={email} onChange={e => setEmail(e.target.value)}/>
          </div>
        </div>

        <div className="sm-field">
          <label className="sm-label" htmlFor="ca-pw">Password</label>
          <div className="sm-input-wrap">
            <input id="ca-pw" className="sm-input has-trail"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Create a password"
              value={pw} onChange={e => setPw(e.target.value)}/>
            <button type="button" className="sm-input-trail"
              aria-label={showPw ? "Hide password" : "Show password"}
              onClick={() => setShowPw(s => !s)}>
              <EyeIcon open={showPw}/>
            </button>
          </div>
          <div className="sm-pw-rules">
            {ruleStates.map(r => (
              <div key={r.id} className={`sm-pw-rule${r.met ? " met" : ""}`}>
                <span className="tick">
                  {r.met && <CheckIcon size={9} color="#15803D"/>}
                </span>
                {r.label}
              </div>
            ))}
          </div>
        </div>

        <label className="sm-checkbox-row" onClick={() => setMarketing(m => !m)}
          style={{ marginTop: 2 }}>
          <span className={`sm-checkbox${marketing ? " checked" : ""}`}>
            {marketing && <CheckIcon size={10}/>}
          </span>
          <span className="label">
            <b>Keep me in the loop.</b> Send me product updates, market insights and the occasional newsletter. You can unsubscribe anytime.
          </span>
        </label>

        <button className="sm-submit" type="button" disabled={!formValid}>Create account</button>

        <p className="sm-tcs">
          By creating an account, you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.
        </p>

        <div className="sm-divider">or sign up with</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button className="sm-oauth" type="button"><GoogleMark/> Google</button>
          <button className="sm-oauth" type="button"><MicrosoftMark/> Microsoft</button>
        </div>
      </div>

      <div className="sm-switch-row">
        Already have an account? <button type="button" onClick={onSwitch}>Sign in</button>
      </div>
    </div>
  );
};

/* === Full Auth page === */
const AuthPage = ({ initialMode = "signin" } = {}) => {
  const [mode, setMode] = React.useState(initialMode);
  return (
    <div className="sm-page" style={{
      background: A_COLORS.bg, fontFamily: "Inter, sans-serif",
      color: A_COLORS.ink, minHeight: "100%",
    }}>
      <style>{A_CSS}{AUTH_CSS}</style>
      <A_Nav/>
      <div className="sm-auth-shell">
        <div className="sm-auth-main" data-screen-label={mode === "signin" ? "Sign in" : "Create account"}>
          <AuthLeftRail mode={mode}/>
          <div className="sm-auth-right">
            <div style={{ width: "100%", maxWidth: 460 }}>
              <div className="sm-auth-tabs">
                <button className={`sm-auth-tab${mode === "signin" ? " active" : ""}`}
                  onClick={() => setMode("signin")}>Sign in</button>
                <button className={`sm-auth-tab${mode === "signup" ? " active" : ""}`}
                  onClick={() => setMode("signup")}>Create account</button>
              </div>
              {mode === "signin"
                ? <SignInForm onSwitch={() => setMode("signup")}/>
                : <CreateAccountForm onSwitch={() => setMode("signin")}/>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.AuthPage = AuthPage;
window.AUTH_CSS = AUTH_CSS;
