import { createMonthlyPlanningAlertEmail } from '../email'
import { createDemoDigest } from '../mock-data'

describe('monthly planning alert email', () => {
  it('renders both mutually exclusive groups and the report link', () => {
    const digest = createDemoDigest({
      start: '2026-06-01', end: '2026-07-01', label: 'June 2026',
    })
    const email = createMonthlyPlanningAlertEmail(
      digest,
      'https://app.example.test',
      'https://app.example.test/planning-alerts/demo'
    )

    expect(email.subject).toBe('Northstar Coffee: 7 planning updates for June 2026')
    expect(email.html).toContain('Within 5 km of a store')
    expect(email.html).toContain('Elsewhere in your patch')
    expect(email.html).toContain('https://app.example.test/planning-alerts/demo')
    expect(email.html).toContain('Demonstration data modelled on the PlanNexus response format.')
    expect(email.text).toContain('4 within 5 km of a store and 3 elsewhere')
  })
})
