// The SiteMatcher Pro plan as sold on the homepage and in the Brand Matcher trial flow
// (docs/design_handoff_homepage_trial). Client-safe: no Stripe ids here, see lib/stripe.ts.
//
// Pro is billed per person. It carries the 'plus' subscription tier internally, because every
// server-side gate (checkPlusAccess, requirePlusAccess) keys on 'plus'.

export type ProPlan = 'monthly' | 'annual'

export const PRO_TRIAL_DAYS = 14

export const PRO_PLANS: Record<
  ProPlan,
  { label: string; price: string; per: string; note: string; firstCharge: string; pence: number }
> = {
  monthly: {
    label: 'Monthly',
    price: '£199',
    per: '/month',
    note: 'Billed monthly',
    firstCharge: '£199.00',
    pence: 19900,
  },
  annual: {
    label: 'Annual',
    price: '£1,990',
    per: '/year',
    note: 'Works out at £166/month',
    firstCharge: '£1,990.00',
    pence: 199000,
  },
}

export function parseProPlan(value: string | null | undefined): ProPlan {
  return value === 'annual' || value === 'year' ? 'annual' : 'monthly'
}

// The date the first payment is taken: sign-up date + the trial.
export function trialEndDate(from: Date = new Date()): Date {
  const d = new Date(from)
  d.setDate(d.getDate() + PRO_TRIAL_DAYS)
  return d
}

export function formatLongDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
