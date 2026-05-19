import Stripe from 'stripe'
import { loadStripe } from '@stripe/stripe-js'

// Server-side Stripe instance - lazy initialization to avoid build-time errors
let _stripe: Stripe | null = null

export const getStripe = () => {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not defined')
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil',
      typescript: true,
    })
  }
  return _stripe
}

// Export for backwards compatibility
export const stripe = new Proxy({} as Stripe, {
  get: (target, prop) => {
    const stripeInstance = getStripe()
    return (stripeInstance as any)[prop]
  }
})

// Client-side Stripe promise - safe for build time as it only uses public key
export const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

// Billing interval type
export type BillingInterval = 'month' | 'year'

// Subscription tier type
export type SubscriptionTier = 'pro' | 'plus'

// Subscription configuration
export const SUBSCRIPTION_CONFIG = {
  // ===== NEW 3-TIER PRICING =====

  // Pro Plan - £39.50/month or £395/year (50% off: was £79/mo or £790/yr)
  PRO: {
    MONTHLY_PRICE_ID: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '',
    ANNUAL_PRICE_ID: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || '',
    MONTHLY_COUPON_ID: process.env.STRIPE_PRO_MONTHLY_COUPON_ID || '', // 50% off for 12 months
    ANNUAL_COUPON_ID: process.env.STRIPE_PRO_ANNUAL_COUPON_ID || '', // 50% off once
  },

  // Plus Plan - £49.50/month or £495/year (50% off: was £99/mo or £990/yr)
  PLUS: {
    MONTHLY_PRICE_ID: process.env.STRIPE_PLUS_MONTHLY_PRICE_ID || '',
    ANNUAL_PRICE_ID: process.env.STRIPE_PLUS_ANNUAL_PRICE_ID || '',
    MONTHLY_COUPON_ID: process.env.STRIPE_PLUS_MONTHLY_COUPON_ID || '', // 50% off for 12 months
    ANNUAL_COUPON_ID: process.env.STRIPE_PLUS_ANNUAL_COUPON_ID || '', // 50% off once
  },

  // ===== LEGACY PRICING (for reference, can be removed) =====
  ANNUAL_PRICE_ID: process.env.STRIPE_PRICE_ID || '', // £975/year price ID (DEPRECATED)
  ANNUAL_FULL_PRICE: 97500, // £975.00 in pence (DEPRECATED)
  ANNUAL_DISCOUNTED_PRICE: 48750, // £487.50 in pence (DEPRECATED)
  MONTHLY_PRICE_ID: process.env.STRIPE_MONTHLY_PRICE_ID || '', // £99/month price ID (DEPRECATED)
  MONTHLY_FULL_PRICE: 9900, // £99.00 in pence (DEPRECATED)
  MONTHLY_DISCOUNTED_PRICE: 4900, // £49.00 in pence (DEPRECATED)
  ANNUAL_COUPON_ID: process.env.STRIPE_COUPON_ID || '', // (DEPRECATED)
  MONTHLY_COUPON_ID: process.env.STRIPE_MONTHLY_COUPON_ID || '', // (DEPRECATED)

  // Shared config
  TRIAL_DAYS: 30,
  CURRENCY: 'gbp',

  // ===== NEW TIER-AWARE HELPERS =====

  // Get price ID for specific tier and interval
  getPriceIdForTier: (tier: SubscriptionTier, interval: BillingInterval = 'year'): string => {
    if (tier === 'plus') {
      return interval === 'month'
        ? process.env.STRIPE_PLUS_MONTHLY_PRICE_ID || ''
        : process.env.STRIPE_PLUS_ANNUAL_PRICE_ID || ''
    }
    // Default to 'pro'
    return interval === 'month'
      ? process.env.STRIPE_PRO_MONTHLY_PRICE_ID || ''
      : process.env.STRIPE_PRO_ANNUAL_PRICE_ID || ''
  },

  // Get coupon ID for specific tier and interval
  getCouponIdForTier: (tier: SubscriptionTier, interval: BillingInterval = 'year'): string => {
    if (tier === 'plus') {
      return interval === 'month'
        ? process.env.STRIPE_PLUS_MONTHLY_COUPON_ID || ''
        : process.env.STRIPE_PLUS_ANNUAL_COUPON_ID || ''
    }
    // Default to 'pro'
    return interval === 'month'
      ? process.env.STRIPE_PRO_MONTHLY_COUPON_ID || ''
      : process.env.STRIPE_PRO_ANNUAL_COUPON_ID || ''
  },

  // ===== LEGACY HELPERS (for backward compatibility) =====

  // Helper to get price ID by interval (defaults to Pro tier)
  getPriceId: (interval: BillingInterval = 'year') => {
    return interval === 'month'
      ? process.env.STRIPE_PRO_MONTHLY_PRICE_ID || process.env.STRIPE_MONTHLY_PRICE_ID || ''
      : process.env.STRIPE_PRO_ANNUAL_PRICE_ID || process.env.STRIPE_PRICE_ID || ''
  },

  // Helper to get coupon ID by interval (defaults to Pro tier)
  getCouponId: (interval: BillingInterval = 'year') => {
    return interval === 'month'
      ? process.env.STRIPE_PRO_MONTHLY_COUPON_ID || process.env.STRIPE_MONTHLY_COUPON_ID || ''
      : process.env.STRIPE_PRO_ANNUAL_COUPON_ID || process.env.STRIPE_COUPON_ID || ''
  },
} as const

// Webhook configuration
export const WEBHOOK_CONFIG = {
  SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
} as const