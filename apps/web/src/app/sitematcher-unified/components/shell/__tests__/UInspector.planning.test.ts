import {
  planningProgressMessage,
  planningTruncationMessage,
} from '../UInspector'

describe('planningTruncationMessage', () => {
  it('returns no warning when there is no truncation reason', () => {
    expect(planningTruncationMessage(null)).toBeNull()
  })

  it('explains an authority cap without the old generic subset copy', () => {
    expect(planningTruncationMessage('authority_cap')).toBe(
      'This area spans a lot of councils, so only part of it was checked.'
    )
  })

  it('explains PlanIt rate limits', () => {
    expect(planningTruncationMessage('rate_limited')).toBe(
      'PlanIt temporarily limited the search, so results may be incomplete.'
    )
  })

  // PlanIt sheds load with a connection-pool error that has nothing to do with
  // how large the query was, so it must not read as "your area was too big".
  it('distinguishes an overloaded PlanIt from councils that did not respond', () => {
    expect(planningTruncationMessage('upstream_busy')).toBe(
      'PlanIt was busy for some councils, so results may be incomplete.'
    )
    expect(planningTruncationMessage('upstream_timeout')).toBe(
      "Some councils didn't respond, so results may be incomplete."
    )
    expect(planningTruncationMessage('upstream_error')).toBe(
      "Some councils didn't respond, so results may be incomplete."
    )
  })

  it('no longer mentions tiles, which are not part of the query model', () => {
    const reasons = [
      'authority_cap',
      'rate_limited',
      'upstream_busy',
      'upstream_timeout',
      'upstream_error',
      'page_cap',
      'record_cap',
    ] as const
    for (const reason of reasons) {
      expect(planningTruncationMessage(reason)).not.toMatch(/tile/i)
    }
  })

  it('explains page and record caps', () => {
    expect(planningTruncationMessage('page_cap')).toBe(
      'There are more matching applications than we can show here.'
    )
    expect(planningTruncationMessage('record_cap')).toBe(
      'There are more matching applications than we can show here.'
    )
  })
})

describe('planningProgressMessage', () => {
  it('falls back to a generic message before any progress arrives', () => {
    expect(planningProgressMessage(null)).toBe('Reading planning applications…')
    expect(planningProgressMessage({ done: 0, total: 0, authority: null })).toBe(
      'Reading planning applications…'
    )
  })

  it('counts the council currently being checked, one-based', () => {
    expect(planningProgressMessage({ done: 0, total: 18, authority: null })).toBe(
      'Checking council 1 of 18…'
    )
    expect(
      planningProgressMessage({ done: 2, total: 18, authority: 'Camden' })
    ).toBe('Checking council 3 of 18…')
  })

  it('never counts past the total on the final update', () => {
    expect(
      planningProgressMessage({ done: 18, total: 18, authority: 'Westminster' })
    ).toBe('Checking council 18 of 18…')
  })
})
