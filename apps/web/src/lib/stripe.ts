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

// Subscription configuration
export const SUBSCRIPTION_CONFIG = {
  // Annual plan
  ANNUAL_PRICE_ID: process.env.STRIPE_PRICE_ID || '', // £975/year price ID
  ANNUAL_FULL_PRICE: 97500, // £975.00 in pence
  ANNUAL_DISCOUNTED_PRICE: 48750, // £487.50 in pence

  // Monthly plan
  MONTHLY_PRICE_ID: process.env.STRIPE_MONTHLY_PRICE_ID || '', // £99/month price ID
  MONTHLY_FULL_PRICE: 9900, // £99.00 in pence
  MONTHLY_DISCOUNTED_PRICE: 4900, // £49.00 in pence

  // Shared config
  TRIAL_DAYS: 30,
  CURRENCY: 'gbp',

  // Coupons
  ANNUAL_COUPON_ID: process.env.STRIPE_COUPON_ID || '', // 50% off once for annual
  MONTHLY_COUPON_ID: process.env.STRIPE_MONTHLY_COUPON_ID || '', // 50% off for 12 months

  // Helper to get price ID by interval
  getPriceId: (interval: BillingInterval = 'year') => {
    return interval === 'month'
      ? process.env.STRIPE_MONTHLY_PRICE_ID || ''
      : process.env.STRIPE_PRICE_ID || ''
  },

  // Helper to get coupon ID by interval
  getCouponId: (interval: BillingInterval = 'year') => {
    return interval === 'month'
      ? process.env.STRIPE_MONTHLY_COUPON_ID || ''
      : process.env.STRIPE_COUPON_ID || ''
  },
} as const

// Webhook configuration
export const WEBHOOK_CONFIG = {
  SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
} as const