import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { ensureCustomer, requireTrialUser } from '@/lib/stripe-trial'

export const dynamic = 'force-dynamic'

// Step 2 of the trial flow: a SetupIntent the card form confirms with Stripe Elements. Nothing
// is charged; the card is saved for the first payment on day 14 (see ../start).
export async function POST() {
  try {
    const gate = await requireTrialUser()
    if (gate.error) return gate.error

    const customer = await ensureCustomer(gate.user)
    const intent = await stripe.setupIntents.create({
      customer,
      usage: 'off_session',
      payment_method_types: ['card'],
      metadata: { user_id: gate.user.id, purpose: 'sitematcher_pro_trial' },
    })
    return NextResponse.json({ clientSecret: intent.client_secret })
  } catch (error) {
    console.error('[TRIAL] setup intent failed:', error)
    return NextResponse.json({ error: 'Could not start card setup. Please try again.' }, { status: 500 })
  }
}
