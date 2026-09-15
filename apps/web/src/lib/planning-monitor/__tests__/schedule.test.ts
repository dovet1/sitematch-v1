import { nextWeeklyDue, periodForDue, zonedTimeToUtc } from '../schedule'

describe('nextWeeklyDue', () => {
  it('is Monday 08:00 BST (07:00 UTC) in summer', () => {
    expect(nextWeeklyDue(new Date('2026-09-15T10:00:00Z')).toISOString()).toBe('2026-09-21T07:00:00.000Z')
  })

  it('is Monday 08:00 GMT (08:00 UTC) in winter', () => {
    expect(nextWeeklyDue(new Date('2026-11-04T10:00:00Z')).toISOString()).toBe('2026-11-09T08:00:00.000Z')
  })

  it('returns this Monday when called earlier the same morning', () => {
    expect(nextWeeklyDue(new Date('2026-09-21T06:59:00Z')).toISOString()).toBe('2026-09-21T07:00:00.000Z')
  })

  it('moves to next week exactly at the send time', () => {
    expect(nextWeeklyDue(new Date('2026-09-21T07:00:00Z')).toISOString()).toBe('2026-09-28T07:00:00.000Z')
  })

  it('crosses the autumn clock change (25 Oct 2026) without shifting the local hour', () => {
    expect(nextWeeklyDue(new Date('2026-10-20T12:00:00Z')).toISOString()).toBe('2026-10-26T08:00:00.000Z')
  })

  it('crosses the spring clock change (29 Mar 2026)', () => {
    expect(nextWeeklyDue(new Date('2026-03-25T12:00:00Z')).toISOString()).toBe('2026-03-30T07:00:00.000Z')
  })

  it('treats a Sunday late evening in London as the week before Monday', () => {
    // 23:30 UTC on Sunday 20 Sep is 00:30 BST on Monday 21 Sep: this Monday's send is still ahead.
    expect(nextWeeklyDue(new Date('2026-09-20T23:30:00Z')).toISOString()).toBe('2026-09-21T07:00:00.000Z')
  })
})

describe('periodForDue', () => {
  it('covers the previous local Monday to Monday', () => {
    expect(periodForDue(new Date('2026-09-21T07:00:00Z'))).toEqual({
      start: '2026-09-13T23:00:00.000Z',
      end: '2026-09-20T23:00:00.000Z',
      dueAt: '2026-09-21T07:00:00.000Z',
      label: '14 Sept – 20 Sept 2026',
    })
  })

  it('has a 169-hour week when the clocks go back', () => {
    const period = periodForDue(new Date('2026-10-26T08:00:00Z'))
    expect(period.start).toBe('2026-10-18T23:00:00.000Z')
    expect(period.end).toBe('2026-10-26T00:00:00.000Z')
    expect((Date.parse(period.end) - Date.parse(period.start)) / 3_600_000).toBe(169)
  })
})

it('zonedTimeToUtc resolves London wall time', () => {
  expect(zonedTimeToUtc({ year: 2026, month: 1, day: 5, hour: 8 }, 'Europe/London').toISOString()).toBe('2026-01-05T08:00:00.000Z')
})
