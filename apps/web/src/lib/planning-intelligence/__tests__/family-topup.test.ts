import { expectedDailyNeed, familyTopUpBudget, SCHEDULED_DAILY_REQUESTS } from '../family-topup'
import { membershipCouncils } from '../membership-ingest'

const at = (iso: string) => new Date(iso)

describe('familyTopUpBudget', () => {
  it('spends nothing before the 26th', () => {
    expect(familyTopUpBudget({ now: at('2026-10-25T23:00:00Z'), monthlyRemaining: 15000, dailyNeed: 360, perRunCap: 40 }))
      .toMatchObject({ eligible: false, reason: 'before_top_up_window', thisRun: 0 })
  })

  it('holds back the reserve and the schedule\'s need to month end, then spends the rest in capped runs', () => {
    // 26 Oct 10:00 UTC: six days to the reset, counting today. 360 × 6 × 1.25 = 2,700 held.
    const budget = familyTopUpBudget({ now: at('2026-10-26T10:00:00Z'), monthlyRemaining: 9000, dailyNeed: 360, perRunCap: 40 })
    expect(budget).toMatchObject({ eligible: true, daysLeft: 6, heldForSchedule: 2700, spendable: 9000 - 3500 - 2700, thisRun: 40 })
  })

  it('spends nothing when the remainder only covers the reserve and the schedule', () => {
    // This September: 3,615 left on the 15th would not even cover the reserve plus the month's discovery.
    expect(familyTopUpBudget({ now: at('2026-09-26T10:00:00Z'), monthlyRemaining: 3615, dailyNeed: 360, perRunCap: 40 }))
      .toMatchObject({ eligible: false, reason: 'nothing_spare', spendable: 0 })
  })

  it('releases more as the month ends, because less needs holding back', () => {
    const early = familyTopUpBudget({ now: at('2026-10-26T00:30:00Z'), monthlyRemaining: 8000, dailyNeed: 360, perRunCap: 10000 })
    const late = familyTopUpBudget({ now: at('2026-10-31T20:00:00Z'), monthlyRemaining: 8000, dailyNeed: 360, perRunCap: 10000 })
    expect(late.spendable).toBeGreaterThan(early.spendable)
    expect(late).toMatchObject({ daysLeft: 1, heldForSchedule: 450, spendable: 8000 - 3500 - 450 })
  })

  it('never spends when the allowance has not been reported', () => {
    expect(familyTopUpBudget({ now: at('2026-10-28T10:00:00Z'), monthlyRemaining: null, dailyNeed: 360, perRunCap: 40 }))
      .toMatchObject({ eligible: false, reason: 'allowance_unknown' })
  })
})

describe('expectedDailyNeed', () => {
  it('uses the schedule\'s ceiling unless the workers actually spent more', () => {
    expect(expectedDailyNeed(900)).toBe(SCHEDULED_DAILY_REQUESTS)
    expect(expectedDailyNeed(4500)).toBe(1500)
  })
})

describe('membershipCouncils', () => {
  it('groups only the councils listed, and none when the list is empty', () => {
    expect([...membershipCouncils(' south-norfolk-broadland, wandsworth ,,glasgow')]).toEqual(['south-norfolk-broadland', 'wandsworth', 'glasgow'])
    expect(membershipCouncils(undefined).size).toBe(0)
    expect(membershipCouncils('').size).toBe(0)
  })
})
