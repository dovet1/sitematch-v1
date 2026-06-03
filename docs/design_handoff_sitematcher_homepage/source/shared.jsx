/* Shared components for both directions */

/* Video placeholder — striped SVG, monospace label of what should be there */
const VideoSlot = ({ label, ratio = "16/9", note, theme = "light", className = "", style = {} }) => {
  const isDark = theme === "dark";
  const stripeA = isDark ? "#2A2433" : "#F3F0FA";
  const stripeB = isDark ? "#241E2B" : "#EDE8F6";
  const textColor = isDark ? "#A89DB8" : "#8A7FA0";
  const labelColor = isDark ? "#E6E2EF" : "#3A2E55";
  const borderColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(60,40,100,0.08)";
  return (
    <div
      className={`video-slot ${className}`}
      style={{
        aspectRatio: ratio,
        position: "relative",
        width: "100%",
        borderRadius: 14,
        overflow: "hidden",
        background: `repeating-linear-gradient(135deg, ${stripeA} 0 14px, ${stripeB} 14px 28px)`,
        border: `1px solid ${borderColor}`,
        ...style,
      }}
    >
      {/* Center caption */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "24px 32px",
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 10px",
          background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)",
          borderRadius: 999,
          fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 11, letterSpacing: 0.4, color: textColor,
          textTransform: "uppercase",
          backdropFilter: "blur(6px)",
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: "#7C3AED" }}></span>
          mp4 / gif placeholder
        </div>
        <div style={{
          marginTop: 14,
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 13, color: labelColor, fontWeight: 500,
          maxWidth: 420, lineHeight: 1.45,
        }}>
          {label}
        </div>
        {note && (
          <div style={{
            marginTop: 6,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 11, color: textColor, lineHeight: 1.5, maxWidth: 360,
          }}>
            {note}
          </div>
        )}
      </div>
      {/* corner play affordance */}
      <div style={{
        position: "absolute", bottom: 12, left: 12,
        display: "flex", alignItems: "center", gap: 6,
        fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
        color: textColor, letterSpacing: 0.4,
      }}>
        <span style={{
          width: 18, height: 18, borderRadius: 4,
          background: isDark ? "rgba(255,255,255,0.08)" : "rgba(124,58,237,0.12)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1 0.5L7 4L1 7.5V0.5Z" fill="#7C3AED"/>
          </svg>
        </span>
        00:00 / 00:24
      </div>
    </div>
  );
};

/* Inline checkmark icon (svg) */
const Check = ({ size = 16, color = "#7C3AED" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const Dash = ({ size = 16, color = "#B5B0BF" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path d="M4 8H12" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
  </svg>
);

/* Pricing data — single source of truth */
const PRICING = {
  free: {
    name: "Free",
    audience: "For occupiers",
    monthly: { price: "£0", suffix: "/forever", footnote: "No card required" },
    annual: { price: "£0", suffix: "/forever", footnote: "No card required" },
    cta: "Get started",
    ctaStyle: "ghost",
    features: [
      { text: "Post unlimited requirements", on: true },
      { text: "Get matched with sites", on: true },
      { text: "Browse the database", on: true },
      { text: "Standard map view", on: true },
    ],
  },
  pro: {
    name: "Pro",
    audience: "For agents & landlords",
    monthly: {
      price: "£39.50", suffix: "/month",
      strike: "£79", discount: "50% off",
      footnote: "For 12 months, then £79/mo · Save £474 in your first year",
    },
    annual: {
      price: "£33", suffix: "/month",
      strike: "£79", discount: "50% off",
      footnote: "£395 billed yearly · was £790",
    },
    cta: "Start 30-day free trial",
    ctaStyle: "outline",
    intro: "Everything in Free, plus",
    features: [
      { text: "Full search & filters", on: true },
      { text: "Reveal contact details", on: true },
      { text: "SiteAnalyser reports", on: true },
      { text: "SiteSketcher layouts", on: true },
      { text: "Requirement alerts", on: true },
      { text: "Data exports", on: true },
      { text: "GapFinder", on: false },
    ],
  },
  plus: {
    name: "Plus",
    audience: "For deal-led teams",
    monthly: {
      price: "£49.50", suffix: "/month",
      strike: "£99", discount: "50% off",
      footnote: "For 12 months, then £99/mo · Save £594 in your first year",
    },
    annual: {
      price: "£41", suffix: "/month",
      strike: "£99", discount: "50% off",
      footnote: "£495 billed yearly · was £990",
    },
    cta: "Start 30-day free trial",
    ctaStyle: "primary",
    badge: "Most popular",
    intro: "Everything in Pro, plus",
    features: [
      { text: "GapFinder access", on: true, highlight: true },
      { text: "Priority email support", on: true },
      { text: "Unlimited alerts & exports", on: true },
      { text: "Multiple user seats", on: true },
    ],
    callout: {
      title: "GapFinder included",
      body: "Spot off-market opportunities your competitors miss",
    },
  },
};

/* FAQ data */
const FAQS = [
  {
    q: "How does the free trial work?",
    a: "Start your 30-day free trial of Pro or Plus — no credit card required. Cancel anytime before the trial ends and you won't be charged. After 30 days, you'll move to your selected plan at your chosen price.",
  },
  {
    q: "How are requirements verified?",
    a: "Every requirement is reviewed by our team before going live. We confirm the brand, contact and brief are current, and we re-check live requirements regularly so what you see is genuinely active.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Yes, you can cancel any time from your account. Your plan stays active until the end of your billing period and you keep access until then.",
  },
  {
    q: "What payment methods do you accept?",
    a: "All major credit and debit cards via Stripe. For annual plans we can also invoice directly — get in touch and we'll arrange it.",
  },
  {
    q: "How do you make sure listed requirements are active?",
    a: "We re-verify each requirement on a rolling basis and remove anything we can't confirm is still live. If you flag a stale listing, we'll check it within one working day.",
  },
];

/* Logo placeholders for "Trusted by" */
const LOGOS = [
  "GreyHart Ltd", "Northfield", "Castor & Co", "Ridgeway Group",
  "Marlow Estates", "Polaris Retail", "Bevan Property", "Hawthorn",
];

Object.assign(window, { VideoSlot, Check, Dash, PRICING, FAQS, LOGOS });
