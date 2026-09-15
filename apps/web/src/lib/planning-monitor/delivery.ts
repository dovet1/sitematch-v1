import 'server-only'

import { Resend } from 'resend'
import { createPlanningAdminClient, type PlanningAdminClient } from '@/lib/planning-intelligence/db'
import { checkPlusAccess } from '@/lib/gapfinder-access'
import { isPlanningMonitorEmailEnabled } from '@/lib/feature-flags'
import { toDigestReport } from './digest-queue'
import { renderWeeklyEmail } from './email'
import { createUnsubscribeToken } from './signing'

/**
 * Weekly email delivery with a durable ledger.
 *
 * Each delivery has one stable key, sent to Resend as its idempotency key. A worker that crashes
 * after Resend accepted the message leaves the row in `sending`; the next claim retries with the
 * same key, which Resend deduplicates for 24 hours. Past that window a retry could send twice, so
 * the row is parked as `ambiguous` for reconciliation instead of being resent.
 */

export const IDEMPOTENCY_WINDOW_MS = 23 * 3_600_000
const MAX_ATTEMPTS = 5

export type DeliveryDecision = 'send' | 'park_ambiguous' | 'suppress'

export function decideDelivery(input: {
  state: string
  sendingStartedAt: string | null
  now: number
  eligible: boolean
}): DeliveryDecision {
  if (!input.eligible) return 'suppress'
  if ((input.state === 'sending' || input.state === 'ambiguous') && input.sendingStartedAt) {
    if (input.now - Date.parse(input.sendingStartedAt) > IDEMPOTENCY_WINDOW_MS) return 'park_ambiguous'
  }
  return 'send'
}

export function backoffMs(attempts: number): number {
  return Math.min(6 * 3_600_000, 60_000 * 2 ** Math.max(0, attempts - 1))
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://sitematcher.co.uk').replace(/\/$/, '')
}

interface DeliveryRecord {
  id: string
  run_id: string
  subscription_id: string
  user_id: string
  delivery_key: string
  email: string
  state: string
  attempts: number
  sending_started_at: string | null
}

export interface DeliveryOutcome {
  id: string
  state: string
  error?: string
}

async function stillEligible(db: PlanningAdminClient, delivery: DeliveryRecord): Promise<boolean> {
  if (!(await isPlanningMonitorEmailEnabled())) return false
  const { data: sub } = await db
    .from('planning_monitor_subscriptions')
    .select('email_enabled, unsubscribed_at, planning_monitor_patches!inner(archived_at, is_active)')
    .eq('id', delivery.subscription_id)
    .maybeSingle()
  const patch = sub && (Array.isArray(sub.planning_monitor_patches) ? sub.planning_monitor_patches[0] : sub.planning_monitor_patches) as { archived_at: string | null; is_active: boolean } | undefined
  if (!sub || !sub.email_enabled || sub.unsubscribed_at || !patch || patch.archived_at || !patch.is_active) return false
  return checkPlusAccess(delivery.user_id)
}

export async function processDeliveries(limit: number, db: PlanningAdminClient = createPlanningAdminClient()): Promise<DeliveryOutcome[]> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured')
  const resend = new Resend(apiKey)
  const outcomes: DeliveryOutcome[] = []

  for (let i = 0; i < limit; i++) {
    const { data, error } = await db.rpc('planning_monitor_claim_delivery', { p_max_attempts: MAX_ATTEMPTS })
    if (error) throw error
    const delivery = ((data ?? []) as DeliveryRecord[])[0]
    if (!delivery) break
    const now = new Date()

    const decision = decideDelivery({
      state: delivery.state,
      sendingStartedAt: delivery.sending_started_at,
      now: now.getTime(),
      eligible: await stillEligible(db, delivery),
    })
    if (decision === 'suppress') {
      await db.from('planning_monitor_deliveries').update({ state: 'suppressed', lease_expires_at: null, updated_at: now.toISOString() }).eq('id', delivery.id)
      outcomes.push({ id: delivery.id, state: 'suppressed' })
      continue
    }
    if (decision === 'park_ambiguous') {
      await db.from('planning_monitor_deliveries').update({
        state: 'ambiguous',
        last_error: 'Send outcome unknown beyond the idempotency window; reconcile before resending',
        next_attempt_at: '9999-12-31T00:00:00Z',
        lease_expires_at: null,
        updated_at: now.toISOString(),
      }).eq('id', delivery.id)
      outcomes.push({ id: delivery.id, state: 'ambiguous' })
      continue
    }

    try {
      const { data: run, error: runError } = await db
        .from('planning_monitor_digest_runs')
        .select('*, planning_monitor_patch_revisions!inner(name)')
        .eq('id', delivery.run_id)
        .eq('status', 'generated')
        .single()
      if (runError || !run) throw new Error('Report is not ready')
      const revision = Array.isArray(run.planning_monitor_patch_revisions) ? run.planning_monitor_patch_revisions[0] : run.planning_monitor_patch_revisions
      const report = toDigestReport(run, revision.name)
      const base = siteUrl()
      const email = renderWeeklyEmail({
        report,
        reportUrl: `${base}/sitematcher-unified?mode=planning&patch=${report.patchId}&report=${report.runId}`,
        mapUrl: `${base}/sitematcher-unified?mode=planning&patch=${report.patchId}`,
        preferencesUrl: `${base}/sitematcher-unified?mode=planning&patch=${report.patchId}&settings=notifications`,
        unsubscribeUrl: `${base}/api/planning-monitor/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(delivery.subscription_id))}`,
      })
      const unsubscribePost = `${base}/api/planning-monitor/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(delivery.subscription_id))}`
      const result = await resend.emails.send(
        {
          from: process.env.PLANNING_MONITOR_FROM_EMAIL ?? 'SiteMatcher <noreply@sitematcher.co.uk>',
          to: [delivery.email],
          subject: email.subject,
          html: email.html,
          text: email.text,
          headers: { 'List-Unsubscribe': `<${unsubscribePost}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
          tags: [{ name: 'kind', value: 'planning_monitor_weekly' }],
        },
        { idempotencyKey: delivery.delivery_key }
      )
      if (result.error) {
        const message = result.error.message ?? 'Resend rejected the message'
        // A validation error will never succeed; anything else is retried with the same key.
        const permanent = /validation|invalid|not allowed/i.test(`${result.error.name ?? ''} ${message}`)
        await db.from('planning_monitor_deliveries').update({
          state: permanent || delivery.attempts >= MAX_ATTEMPTS ? 'failed' : 'ambiguous',
          last_error: message,
          next_attempt_at: new Date(now.getTime() + backoffMs(delivery.attempts)).toISOString(),
          lease_expires_at: null,
          updated_at: now.toISOString(),
        }).eq('id', delivery.id)
        outcomes.push({ id: delivery.id, state: 'failed', error: message })
        continue
      }
      await db.from('planning_monitor_deliveries').update({
        state: 'sent',
        provider_message_id: result.data?.id ?? null,
        sent_at: now.toISOString(),
        last_error: null,
        lease_expires_at: null,
        updated_at: now.toISOString(),
      }).eq('id', delivery.id)
      outcomes.push({ id: delivery.id, state: 'sent' })
    } catch (err) {
      // Network failure: the provider may or may not have accepted it. Retry under the same key.
      const message = err instanceof Error ? err.message : 'Unknown error'
      await db.from('planning_monitor_deliveries').update({
        state: delivery.attempts >= MAX_ATTEMPTS ? 'failed' : 'ambiguous',
        last_error: message,
        next_attempt_at: new Date(now.getTime() + backoffMs(delivery.attempts)).toISOString(),
        lease_expires_at: null,
        updated_at: now.toISOString(),
      }).eq('id', delivery.id)
      outcomes.push({ id: delivery.id, state: 'ambiguous', error: message })
    }
  }
  return outcomes
}
