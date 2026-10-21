import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient, createServerClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

// Shared by the in-page trial flow (app/api/stripe/trial/*): who is asking, whether they may
// start a trial, and their Stripe customer.

export interface TrialUser {
  id: string
  email: string
  stripe_customer_id: string | null
  subscription_status: string | null
  stripe_subscription_id: string | null
}

type Gate = { error: NextResponse; user?: never } | { error: null; user: TrialUser }

export async function requireTrialUser(): Promise<Gate> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Sign in to start your trial' }, { status: 401 }) }
  }

  const { data } = await createAdminClient()
    .from('users')
    .select('id, email, stripe_customer_id, subscription_status, stripe_subscription_id')
    .eq('id', user.id)
    .maybeSingle()
  const row = data as TrialUser | null
  if (!row) return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) }

  // One real subscription per person. past_due counts: a second sub would dodge dunning.
  if (row.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(row.subscription_status ?? '')) {
    return {
      error: NextResponse.json(
        { error: 'You already have a subscription', code: 'already_subscribed' },
        { status: 409 }
      ),
    }
  }
  return { error: null, user: { ...row, email: row.email || user.email || '' } }
}

// The user's Stripe customer, created (or replaced, if the saved id no longer exists) on demand.
export async function ensureCustomer(user: TrialUser): Promise<string> {
  if (user.stripe_customer_id) {
    try {
      const existing = await stripe.customers.retrieve(user.stripe_customer_id)
      if (!('deleted' in existing && existing.deleted)) return existing.id
    } catch (error: any) {
      if (error?.code !== 'resource_missing') throw error
    }
  }
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { user_id: user.id, user_type: 'brand_matcher' },
  })
  await (createAdminClient().from('users') as any).update({ stripe_customer_id: customer.id }).eq('id', user.id)
  return customer.id
}
