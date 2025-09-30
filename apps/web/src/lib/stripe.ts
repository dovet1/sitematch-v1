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

// Subscription configuration
export const SUBSCRIPTION_CONFIG = {
  PRICE_ID: process.env.STRIPE_PRICE_ID || '', // £975/year price ID
  TRIAL_DAYS: 30,
  CURRENCY: 'gbp',
  ANNUAL_PRICE: 97500, // £975.00 in pence
} as const

// Webhook configuration
export const WEBHOOK_CONFIG = {
  SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
} as const