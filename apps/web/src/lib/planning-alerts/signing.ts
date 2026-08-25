import { createHmac, timingSafeEqual } from 'crypto'

function signingSecret(): string {
  const secret = process.env.PLANNING_ALERT_SIGNING_SECRET ?? process.env.CRON_SECRET
  if (!secret) throw new Error('PLANNING_ALERT_SIGNING_SECRET or CRON_SECRET is required')
  return secret
}

function signature(subscriptionId: string): string {
  return createHmac('sha256', signingSecret()).update(subscriptionId).digest('base64url')
}

export function createPlanningAlertToken(subscriptionId: string): string {
  return `${subscriptionId}.${signature(subscriptionId)}`
}

export function verifyPlanningAlertToken(token: string): string | null {
  const separator = token.lastIndexOf('.')
  if (separator <= 0) return null
  const subscriptionId = token.slice(0, separator)
  const supplied = Buffer.from(token.slice(separator + 1))
  const expected = Buffer.from(signature(subscriptionId))
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null
  return subscriptionId
}
