import { periodFromMonth, previousCalendarMonth } from '../period'

describe('planning alert periods', () => {
  it('returns the previous complete month across a year boundary', () => {
    expect(previousCalendarMonth(new Date('2026-01-15T12:00:00Z'))).toEqual({
      start: '2025-12-01', end: '2026-01-01', label: 'December 2025',
    })
  })

  it('parses a report month and rejects malformed values', () => {
    expect(periodFromMonth('2026-06')).toEqual({
      start: '2026-06-01', end: '2026-07-01', label: 'June 2026',
    })
    expect(periodFromMonth('2026-13')).toBeNull()
    expect(periodFromMonth('June')).toBeNull()
  })
})
