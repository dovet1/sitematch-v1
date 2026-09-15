import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Signed unsubscribe links. A token disables exactly one weekly subscription and nothing else: it
 * cannot read a report, change criteria, or unsubscribe any other patch. The purpose prefix keeps
 * these tokens distinct from the monthly alert tokens that share the secret.
 */

const PURPOSE = 'planning-monitor-unsubscribe:v1'

function secret(): string {
  const value = process.env.PLANNING_ALERT_SIGNING_SECRET ?? process.env.CRON_SECRET
  if (!value) throw new Error('PLANNING_ALERT_SIGNING_SECRET or CRON_SECRET is required')
  return value
}

function sign(subscriptionId: string): string {
  return createHmac('sha256', secret()).update(`${PURPOSE}:${subscriptionId}`).digest('base64url')
}

export function createUnsubscribeToken(subscriptionId: string): string {
  return `${subscriptionId}.${sign(subscriptionId)}`
}

export function verifyUnsubscribeToken(token: string): string | null {
  const separator = token.lastIndexOf('.')
  if (separator <= 0) return null
  const subscriptionId = token.slice(0, separator)
  if (!/^[0-9a-f-]{36}$/i.test(subscriptionId)) return null
  const supplied = Buffer.from(token.slice(separator + 1))
  const expected = Buffer.from(sign(subscriptionId))
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null
  return subscriptionId
}
