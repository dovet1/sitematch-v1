import {
  DISCOVERY_STALE_AFTER_HOURS,
  LIVE_CHECK_STALE_AFTER_DAYS,
  deriveFreshness,
  readPlanningFreshness,
} from '../freshness'

const NOW = Date.parse('2026-09-10T12:00:00.000Z')

function hoursAgo(hours: number): string {
  return new Date(NOW - hours * 3_600_000).toISOString()
}

function status(overrides: {
  lastDiscoveryAt?: string | null
  lastRefreshAt?: string | null
  oldestLiveCheckedAt?: string | null
} = {}) {
  // `in` rather than `??`, so a test can override a field to null and mean null.
  return {
    coverage: {
      last_discovery_at: 'lastDiscoveryAt' in overrides ? overrides.lastDiscoveryAt : hoursAgo(6),
      last_refresh_at: 'lastRefreshAt' in overrides ? overrides.lastRefreshAt : hoursAgo(30),
    },
    freshness: {
      oldest_live_checked_at:
        'oldestLiveCheckedAt' in overrides ? overrides.oldestLiveCheckedAt : hoursAgo(48),
      latest_application_date: '2026-09-09',
    },
  }
}

describe('deriveFreshness', () => {
  it('calls a pipeline running to schedule fresh', () => {
    const result = deriveFreshness(status(), NOW)
    expect(result.stale).toBe(false)
    expect(result.staleReason).toBeNull()
    expect(result.latestApplicationDate).toBe('2026-09-09')
  })

  it('treats a store that has never been ingested as stale', () => {
    const result = deriveFreshness(status({ lastDiscoveryAt: null }), NOW)
    expect(result.staleReason).toBe('never_ingested')
    expect(result.stale).toBe(true)
  })

  it('reports discovery falling behind, because new applications are then missing entirely', () => {
    const result = deriveFreshness(
      status({ lastDiscoveryAt: hoursAgo(DISCOVERY_STALE_AFTER_HOURS + 1) }),
      NOW
    )
    expect(result.staleReason).toBe('discovery_overdue')
  })

  it('reports refresh falling behind separately, because the list still looks complete', () => {
    const result = deriveFreshness(
      status({ oldestLiveCheckedAt: hoursAgo((LIVE_CHECK_STALE_AFTER_DAYS + 1) * 24) }),
      NOW
    )
    expect(result.staleReason).toBe('refresh_overdue')
  })

  it('prefers the discovery failure when both are overdue', () => {
    // Missing applications outrank out-of-date decisions: one is a gap in what is shown,
    // the other a caveat on it, and only one message can lead.
    const result = deriveFreshness(
      status({
        lastDiscoveryAt: hoursAgo(DISCOVERY_STALE_AFTER_HOURS + 1),
        oldestLiveCheckedAt: hoursAgo((LIVE_CHECK_STALE_AFTER_DAYS + 1) * 24),
      }),
      NOW
    )
    expect(result.staleReason).toBe('discovery_overdue')
  })

  it('does not call a store stale for unchecked records when it holds none', () => {
    const result = deriveFreshness(status({ oldestLiveCheckedAt: null }), NOW)
    expect(result.stale).toBe(false)
  })

  it('ignores an unparseable timestamp rather than reading it as ancient', () => {
    const result = deriveFreshness(status({ oldestLiveCheckedAt: 'not a date' }), NOW)
    expect(result.stale).toBe(false)
  })

  it('is stale when the status document is empty', () => {
    expect(deriveFreshness({}, NOW).staleReason).toBe('never_ingested')
  })
})

describe('readPlanningFreshness', () => {
  // Each chain resolves to the rows its table and ordered column would return.
  function fakeDb(rows: Record<string, unknown[]>, failing?: string) {
    const rpc = jest.fn()
    const from = (table: string) => {
      let column = ''
      const chain = {
        select: (selected: string) => { column = selected; return chain },
        not: () => chain,
        or: () => chain,
        order: () => chain,
        limit: () => Promise.resolve(failing === column
          ? { data: null, error: new Error(`${column} timed out`) }
          : { data: rows[`${table}.${column}`] ?? [], error: null }),
      }
      return chain
    }
    return { db: { from, rpc } as never, rpc }
  }

  it('reads the four values directly and never runs the full pipeline report', async () => {
    const { db, rpc } = fakeDb({
      'planning_authority_coverage.last_discovery_at': [{ last_discovery_at: '2026-09-14T07:30:00Z' }],
      'planning_authority_coverage.last_refresh_at': [{ last_refresh_at: '2026-09-12T06:31:00Z' }],
      'planning_applications.last_checked_at': [{ last_checked_at: '2026-09-10T14:58:00Z' }],
      'planning_applications.date_received': [{ date_received: '2026-09-13' }],
    })
    const result = await readPlanningFreshness(db)
    expect(rpc).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      lastDiscoveryAt: '2026-09-14T07:30:00Z',
      lastRefreshAt: '2026-09-12T06:31:00Z',
      oldestLiveCheckedAt: '2026-09-10T14:58:00Z',
      latestApplicationDate: '2026-09-13',
    })
  })

  it('reports an empty store as never ingested', async () => {
    const result = await readPlanningFreshness(fakeDb({}).db)
    expect(result.staleReason).toBe('never_ingested')
  })

  it('fails rather than guessing when one of the reads fails', async () => {
    await expect(readPlanningFreshness(fakeDb({}, 'last_checked_at').db)).rejects.toThrow('last_checked_at timed out')
  })
})
