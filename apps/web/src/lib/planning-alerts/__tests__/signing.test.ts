import { createPlanningAlertToken, verifyPlanningAlertToken } from '../signing'

describe('planning alert signed links', () => {
  const originalSigningSecret = process.env.PLANNING_ALERT_SIGNING_SECRET
  const originalCronSecret = process.env.CRON_SECRET

  beforeEach(() => {
    process.env.PLANNING_ALERT_SIGNING_SECRET = 'test-signing-secret'
  })

  afterEach(() => {
    if (originalSigningSecret === undefined) delete process.env.PLANNING_ALERT_SIGNING_SECRET
    else process.env.PLANNING_ALERT_SIGNING_SECRET = originalSigningSecret
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalCronSecret
  })

  it('round-trips a subscription id', () => {
    const token = createPlanningAlertToken('subscription-123')
    expect(verifyPlanningAlertToken(token)).toBe('subscription-123')
  })

  it('rejects a tampered token', () => {
    const token = createPlanningAlertToken('subscription-123')
    expect(verifyPlanningAlertToken(`${token}x`)).toBeNull()
  })
})
