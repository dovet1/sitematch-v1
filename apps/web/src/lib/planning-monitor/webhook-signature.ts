import { createHmac, timingSafeEqual } from 'crypto'

const TOLERANCE_SECONDS = 300

/** Resend signs webhooks with Svix: HMAC-SHA256 over "id.timestamp.body" with the base64 secret after "whsec_". */
export function verifySvixSignature(input: { secret: string; id: string | null; timestamp: string | null; signature: string | null; body: string; now?: number }): boolean {
  if (!input.id || !input.timestamp || !input.signature) return false
  const ts = Number(input.timestamp)
  if (!Number.isFinite(ts) || Math.abs((input.now ?? Date.now()) / 1000 - ts) > TOLERANCE_SECONDS) return false
  const key = Buffer.from(input.secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${input.id}.${input.timestamp}.${input.body}`).digest()
  return input.signature.split(' ').some((part) => {
    const [version, value] = part.split(',')
    if (version !== 'v1' || !value) return false
    const supplied = Buffer.from(value, 'base64')
    return supplied.length === expected.length && timingSafeEqual(supplied, expected)
  })
}
