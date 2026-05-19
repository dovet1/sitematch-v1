// Data constants for homepage redesign
// Extracted from Claude Design handoff shared.jsx

export const PRICING = {
  free: {
    name: "Free",
    audience: "For occupiers",
    monthly: { price: "£0", suffix: "/forever", footnote: "No card required" },
    annual: { price: "£0", suffix: "/forever", footnote: "No card required" },
    cta: "Get started",
    ctaStyle: "ghost" as const,
    features: [
      { text: "Post unlimited requirements", on: true },
      { text: "SiteSketcher (Free Version)", on: true },
      { text: "SiteAnalyser (Free Version)", on: true },
      { text: "SiteMatcher's weekly market snapshot direct to your inbox", on: true },
    ],
  },
  pro: {
    name: "Pro",
    audience: "For agents & landlords",
    monthly: {
      price: "£39.50",
      suffix: "/month",
      strike: "£79",
      discount: "50% off",
      footnote: "For 12 months, then £79/mo · Save £474 in your first year",
    },
    annual: {
      price: "£33",
      suffix: "/month",
      strike: "£79",
      discount: "50% off",
      footnote: "£395 billed yearly · was £790",
    },
    cta: "Start 30-day free trial",
    ctaStyle: "outline" as const,
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
      price: "£49.50",
      suffix: "/month",
      strike: "£99",
      discount: "50% off",
      footnote: "For 12 months, then £99/mo · Save £594 in your first year",
    },
    annual: {
      price: "£41",
      suffix: "/month",
      strike: "£99",
      discount: "50% off",
      footnote: "£495 billed yearly · was £990",
    },
    cta: "Start 30-day free trial",
    ctaStyle: "primary" as const,
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

export const FAQS = [
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

export const LOGOS = [
  "GreyHart Ltd",
  "Northfield",
  "Castor & Co",
  "Ridgeway Group",
  "Marlow Estates",
  "Polaris Retail",
  "Bevan Property",
  "Hawthorn",
];

export const FREE_TOOLS = [
  { name: "GapFinder", desc: "Map brand presence across the UK" },
  { name: "Requirement Directory", desc: "Verified live opportunities" },
  { name: "SiteAnalyser", desc: "Demographics for any UK postcode" },
  { name: "SiteSketcher", desc: "Sketch sites in 2D & 3D" },
];

export const ACCOUNT_MENU = [
  { label: "Dashboard", icon: "grid" as const },
  { label: "Admin", icon: "shield" as const },
  { label: "Manage Subscription", icon: "card" as const },
];
