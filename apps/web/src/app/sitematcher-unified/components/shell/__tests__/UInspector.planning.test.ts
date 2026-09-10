import {
  isApproximatelyLocated,
  planningApproximateNote,
  planningDwellingLabel,
  planningFreshnessMessage,
  planningProgressMessage,
  planningRelevanceBadge,
  planningTruncationMessage,
} from '../UInspector'
import type {
  PlanningApplication,
  PlanningFreshness,
} from '../../../types/unified-workspace'

function application(overrides: Partial<PlanningApplication> = {}): PlanningApplication {
  return {
    name: 'Watford/26/00712/FULH',
    uid: 'tdko9cpy',
    address: '32 Gade Avenue Watford',
    appSize: '',
    appState: 'Undecided',
    appType: 'full',
    description: 'Erection of a new retail foodstore',
    url: '',
    lat: 51.65759,
    lng: -0.422497,
    decidedDate: null,
    dateValidated: '2026-09-08',
    nDwellings: null,
    applicantAddress: null,
    agentAddress: null,
    provider: 'plota',
    locationProvenance: 'source_exact',
    locationUncertaintyM: 0,
    insideBoundary: true,
    relevance: null,
    summary: null,
    modelDwellingCount: null,
    ...overrides,
  }
}

describe('planningRelevanceBadge', () => {
  it('labels each band the classifier can return', () => {
    expect(planningRelevanceBadge('high')?.label).toBe('High')
    expect(planningRelevanceBadge('medium')?.label).toBe('Medium')
    expect(planningRelevanceBadge('low')?.label).toBe('Low')
  })

  // Unclassified sorts last but is not a judgement, and rendering it as one would claim
  // something the classifier never said.
  it('shows nothing for an unclassified application rather than calling it low', () => {
    expect(planningRelevanceBadge(null)).toBeNull()
    expect(planningRelevanceBadge(undefined)).toBeNull()
  })
})

describe('planningDwellingLabel', () => {
  it("prefers the provider's own count", () => {
    expect(planningDwellingLabel(application({ nDwellings: 12, modelDwellingCount: 9 })))
      .toBe('12 homes')
  })

  // Plota leaves its count empty on most records while the description states it plainly,
  // so the model recovers the number -- but it must not be dressed up as the source's.
  it('marks a count the model read out of the description', () => {
    expect(planningDwellingLabel(application({ modelDwellingCount: 9 })))
      .toBe('9 homes in the description')
  })

  it('says nothing when neither figure exists', () => {
    expect(planningDwellingLabel(application())).toBeNull()
  })

  it('reads a single home as singular', () => {
    expect(planningDwellingLabel(application({ nDwellings: 1 }))).toBe('1 home')
  })
})

describe('approximate locations', () => {
  it('treats an exact position inside the area as exact', () => {
    expect(isApproximatelyLocated(application())).toBe(false)
  })

  it('treats a ward or postcode centre as approximate', () => {
    expect(isApproximatelyLocated(application({
      locationProvenance: 'source_centroid', locationUncertaintyM: 1500,
    }))).toBe(true)
  })

  // A record admitted only because its uncertainty overlapped the area is approximate
  // whatever its radius says.
  it('treats a record shown on overlap alone as approximate', () => {
    expect(isApproximatelyLocated(application({ insideBoundary: false }))).toBe(true)
  })

  it('says nothing when every position is a real site', () => {
    expect(planningApproximateNote([application(), application()])).toBeNull()
  })

  it('counts approximate positions where the count is read', () => {
    const note = planningApproximateNote([
      application(),
      application({ locationProvenance: 'source_centroid', locationUncertaintyM: 1500 }),
      application({ insideBoundary: false }),
    ])
    expect(note).toContain('2 of these')
    expect(note).toContain('may sit outside this area')
  })
})

function freshness(overrides: Partial<PlanningFreshness> = {}): PlanningFreshness {
  return {
    lastDiscoveryAt: '2026-09-10T06:00:00.000Z',
    lastRefreshAt: '2026-09-08T05:00:00.000Z',
    oldestLiveCheckedAt: '2026-09-01T05:00:00.000Z',
    latestApplicationDate: '2026-09-09',
    stale: false,
    staleReason: null,
    ...overrides,
  }
}

describe('planningFreshnessMessage', () => {
  it('says nothing when the data is current', () => {
    expect(planningFreshnessMessage(freshness())).toBeNull()
  })

  // The live PlanIt path has no store behind it, so there is nothing to be out of date.
  it('says nothing when there is no stored data behind the answer', () => {
    expect(planningFreshnessMessage(null)).toBeNull()
  })

  it('warns that newer applications may be missing when discovery is behind', () => {
    const message = planningFreshnessMessage(
      freshness({ stale: true, staleReason: 'discovery_overdue' })
    )
    expect(message).toBe(
      'Planning data has not updated recently, so newer applications may be missing.'
    )
  })

  // Refresh falling behind is the more dangerous case: the list looks complete and the
  // decisions on it are the part that has moved on, so the copy must name decisions.
  it('warns about decisions, not coverage, when refresh is behind', () => {
    const message = planningFreshnessMessage(
      freshness({ stale: true, staleReason: 'refresh_overdue' })
    )
    expect(message).toContain('decisions')
    expect(message).not.toContain('missing')
  })

  it('admits when currency could not be established at all', () => {
    expect(planningFreshnessMessage(
      freshness({ stale: true, staleReason: 'freshness_unavailable' })
    )).toBe("We couldn't confirm how current this planning data is.")
  })

  it('warns before anything has been ingested', () => {
    expect(planningFreshnessMessage(
      freshness({ stale: true, staleReason: 'never_ingested' })
    )).toContain('has not been collected yet')
  })
})

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
