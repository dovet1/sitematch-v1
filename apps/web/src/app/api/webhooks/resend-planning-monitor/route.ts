import { NextRequest, NextResponse } from 'next/server'
import { createPlanningAdminClient } from '@/lib/planning-intelligence/db'
import { verifySvixSignature } from '@/lib/planning-monitor/webhook-signature'

export const dynamic = 'force-dynamic'

/**
 * Bounce and complaint handling for weekly briefing emails. A hard bounce or complaint marks the
 * delivery and disables that subscription's emails, so the next week does not send again.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_PLANNING_MONITOR_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  const body = await request.text()
  const valid = verifySvixSignature({
    secret,
    id: request.headers.get('svix-id'),
    timestamp: request.headers.get('svix-timestamp'),
    signature: request.headers.get('svix-signature'),
    body,
  })
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  let event: { type?: string; data?: { email_id?: string; bounce?: { type?: string } } }
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const messageId = event.data?.email_id
  const state = event.type === 'email.bounced' ? 'bounced' : event.type === 'email.complained' ? 'complained' : null
  if (!messageId || !state) return NextResponse.json({ ignored: true })

  const db = createPlanningAdminClient()
  const { data: rows, error } = await db
    .from('planning_monitor_deliveries')
    .update({ state, last_error: event.type, updated_at: new Date().toISOString() })
    .eq('provider_message_id', messageId)
    .select('subscription_id')
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  // Soft bounces (mailbox full, temporary) do not unsubscribe; permanent bounces and complaints do.
  const permanent = state === 'complained' || (event.data?.bounce?.type ?? 'Permanent').toLowerCase() !== 'transient'
  if (permanent) {
    for (const row of rows ?? []) {
      await db.from('planning_monitor_subscriptions').update({ email_enabled: false, unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', row.subscription_id)
    }
  }
  return NextResponse.json({ ok: true, matched: rows?.length ?? 0 })
}
