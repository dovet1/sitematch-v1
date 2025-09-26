import Stripe from 'stripe'
import { loadStripe } from '@stripe/stripe-js'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined')
}

if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
  throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined')
}

// Server-side Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
  typescript: true,
})

// Client-side Stripe promise
export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
)

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