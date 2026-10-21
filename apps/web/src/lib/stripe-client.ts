import { loadStripe, type Stripe } from '@stripe/stripe-js'

// Browser-side Stripe.js, loaded once. Kept apart from lib/stripe.ts, which pulls in the Node SDK.
let promise: Promise<Stripe | null> | null = null

export function getStripeJs(): Promise<Stripe | null> | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key) return null
  promise ??= loadStripe(key)
  return promise
}
