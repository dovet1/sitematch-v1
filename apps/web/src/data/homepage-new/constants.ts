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
      { text: "Search & filter all requirements", on: true },
      { text: "Reveal contact details", on: true },
      { text: "SiteAnalyser reports", on: true },
      { text: "SiteSketcher layouts", on: true },
      { text: "Requirement alerts", on: true },
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
      { text: "Add CADs to SiteSketcher", on: true },
      { text: "Priority email support", on: true },
    ],
    callout: {
      title: "GapFinder included",
      body: "Spot opportunities your competitors miss",
    },
  },
};

export const FAQS = [
  {
    q: "How does the free trial work?",
    a: "Start your 30-day free trial of Pro or Plus and if you cancel anytime before the trial ends you won't be charged. After 30 days, you'll move to your selected plan at your chosen price.",
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

// ============================================
// ACTIVE PROMOTION CONFIGURATION
// ============================================
export const ACTIVE_PROMOTION = {
  isActive: true,
  name: 'Summer Sale',
  discountPercent: 50,
  endDate: '2026-08-31', // ISO format for easy comparison
  displayEndDate: '31 August',
  message: 'Summer Sale - 50% off',
  fullMessage: 'Summer Sale - 50% off',
}

// Helper to check if promotion is currently active
export function isPromotionActive(): boolean {
  if (!ACTIVE_PROMOTION.isActive) return false
  const now = new Date()
  const endDate = new Date(ACTIVE_PROMOTION.endDate)
  return now <= endDate
}

// Get current promotion message (returns null if no active promotion)
export function getPromotionMessage(includeEndDate = true): string | null {
  if (!isPromotionActive()) return null
  return includeEndDate ? ACTIVE_PROMOTION.fullMessage : ACTIVE_PROMOTION.message
}

// ============================================
// PRICING VALUES FOR MODALS & UPGRADE FLOWS
// ============================================
export const PRICING_VALUES = {
  pro: {
    monthly: {
      price: 39.50,
      formatted: '£39.50',
      display: '£39.50/month',
      original: 79,
      originalFormatted: '£79',
      discountPercent: 50,
      savings: 39.50,
      savingsFormatted: '£39.50',
      yearlyTotal: 474, // Monthly discount * 12 months
      yearlyTotalFormatted: '£474',
    },
    annual: {
      price: 395,
      formatted: '£395',
      display: '£395/year',
      original: 790,
      originalFormatted: '£790',
      discountPercent: 50,
      savings: 395,
      savingsFormatted: '£395',
    },
  },
  plus: {
    monthly: {
      price: 49.50,
      formatted: '£49.50',
      display: '£49.50/month',
      original: 99,
      originalFormatted: '£99',
      discountPercent: 50,
      savings: 49.50,
      savingsFormatted: '£49.50',
      yearlyTotal: 594, // Monthly discount * 12 months
      yearlyTotalFormatted: '£594',
    },
    annual: {
      price: 495,
      formatted: '£495',
      display: '£495/year',
      original: 990,
      originalFormatted: '£990',
      discountPercent: 50,
      savings: 495,
      savingsFormatted: '£495',
    },
  },
  // Annual savings compared to monthly (17% discount)
  annualSavings: {
    pro: {
      percent: 17,
      amount: 79, // (£39.50 * 12) - £395 = £79
      formatted: '£79',
      message: 'Save 17%',
    },
    plus: {
      percent: 17,
      amount: 99, // (£49.50 * 12) - £495 = £99
      formatted: '£99',
      message: 'Save 17%',
    },
  },
  // Upgrade differences (Pro → Plus)
  upgrade: {
    monthly: {
      difference: 10,
      formatted: '£10',
      display: '£10/month',
    },
    annual: {
      difference: 100,
      formatted: '£100',
      display: '£100/year',
    },
  },
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Get pricing for a specific tier and interval (for modals)
export function getModalPricing(
  tier: 'pro' | 'plus',
  interval: 'month' | 'year'
) {
  return PRICING_VALUES[tier][interval === 'month' ? 'monthly' : 'annual']
}

// Get upgrade pricing comparison (Pro → Plus)
export function getUpgradePricing(interval: 'month' | 'year') {
  const intervalKey = interval === 'month' ? 'monthly' : 'annual'
  return {
    current: PRICING_VALUES.pro[intervalKey],
    new: PRICING_VALUES.plus[intervalKey],
    difference: PRICING_VALUES.upgrade[intervalKey],
  }
}

// Get annual savings message for tier
export function getAnnualSavingsMessage(tier: 'pro' | 'plus'): string {
  return PRICING_VALUES.annualSavings[tier].message
}

// Get promotional footnote (e.g., "For 12 months, then £79/mo · Save £474 in your first year")
export function getPromotionalFootnote(
  tier: 'pro' | 'plus',
  interval: 'month' | 'year'
): string {
  if (interval === 'month') {
    const monthlyPricing = PRICING_VALUES[tier].monthly
    return `For 12 months, then ${monthlyPricing.originalFormatted}/mo · Save ${monthlyPricing.yearlyTotalFormatted} in your first year`
  } else {
    const annualPricing = PRICING_VALUES[tier].annual
    return `${annualPricing.formatted} billed yearly · was ${annualPricing.originalFormatted}`
  }
}
