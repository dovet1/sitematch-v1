import { runPlotaRefresh, selectRefreshCohorts } from '../ingest'

type Result = { data: unknown; error: unknown }

/**
 * The same chaining stand-in the ingest tests use, plus `rpc` — refresh picks its cohorts
 * from a database function rather than a table read.
 */
class Builder implements PromiseLike<Result> {
  private op = ''
  constructor(
    private readonly table: string,
    private readonly writes: Array<{ table: string; op: string; payload: unknown }>,
    private readonly results: Record<string, Result>
  ) {}
  select() { if (!this.op) this.op = 'select'; return this }
  insert(payload: unknown) { this.op = 'insert'; this.writes.push({ table: this.table, op: 'insert', payload }); return this }
  upsert(payload: unknown) { this.op = 'upsert'; this.writes.push({ table: this.table, op: 'upsert', payload }); return this }
  update(payload: unknown) { this.op = 'update'; this.writes.push({ table: this.table, op: 'update', payload }); return this }
  eq() { return this }
  in() { return this }
  range() { return this }
  maybeSingle() { return this }
  single() { return this }
  then<A, B>(
    onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    const key = `${this.table}:${this.op}`
    return Promise.resolve(this.results[key] ?? { data: [], error: null }).then(onfulfilled, onrejected)
  }
}

function cohortRow(windowStart: string, windowEnd: string, liveRecords = 4) {
  return {
    window_start: windowStart,
    window_end: windowEnd,
    live_records: liveRecords,
    oldest_checked_at: '2026-08-01T00:00:00.000Z',
  }
}

function makeDb(cohorts: unknown[]) {
  const writes: Array<{ table: string; op: string; payload: unknown }> = []
  const results: Record<string, Result> = {
    'planning_ingest_runs:insert': { data: { id: 'run-1' }, error: null },
    'planning_ingest_checkpoints:select': { data: null, error: null },
    'planning_applications:select': { data: [], error: null },
    'brands:select': { data: [], error: null },
    'fascias:select': { data: [], error: null },
  }
  const rpc = jest.fn().mockResolvedValue({ data: cohorts, error: null })
  const db = { from: (table: string) => new Builder(table, writes, results), rpc }
  return { db: db as never, writes, rpc }
}

function client() {
  return {
    search: jest.fn().mockResolvedValue({
      page: { data: [], meta: { next_cursor: null } },
      usage: { requestId: 'req_1', monthlyLimit: 15000, monthlyRemaining: 14000 },
    }),
  }
}

const base = {
  scope: 'full' as const,
  pageSize: 50,
  maxPages: 6,
  nations: ['england'],
  cohortLimit: 3,
}

describe('selectRefreshCohorts', () => {
  it('reads the cohort function and maps its rows', async () => {
    const { db, rpc } = makeDb([cohortRow('2026-07-01', '2026-07-31', 12)])
    const cohorts = await selectRefreshCohorts(db, 3)
    expect(rpc).toHaveBeenCalledWith('planning_refresh_cohorts', { p_limit: 3 })
    expect(cohorts).toEqual([{
      windowStart: '2026-07-01',
      windowEnd: '2026-07-31',
      liveRecords: 12,
      oldestCheckedAt: '2026-08-01T00:00:00.000Z',
    }])
  })

  it('surfaces a failure rather than refreshing nothing quietly', async () => {
    const { db } = makeDb([])
    ;(db as unknown as { rpc: jest.Mock }).rpc.mockResolvedValue({
      data: null, error: { message: 'function does not exist' },
    })
    await expect(selectRefreshCohorts(db, 3)).rejects.toBeDefined()
  })
})

describe('runPlotaRefresh', () => {
  it('re-searches each stale window in its own run', async () => {
    const { db } = makeDb([
      cohortRow('2026-07-01', '2026-07-31'),
      cohortRow('2026-06-01', '2026-06-30'),
    ])
    const plota = client()
    const result = await runPlotaRefresh({ ...base, db, client: plota as never })

    expect(plota.search).toHaveBeenCalledTimes(2)
    expect(plota.search.mock.calls.map(([params]) => params.date_from)).toEqual([
      '2026-07-01', '2026-06-01',
    ])
    expect(result.cohorts).toHaveLength(2)
    expect(result.requestsMade).toBe(2)
  })

  it('shares one page budget across cohorts instead of splitting it', async () => {
    const { db } = makeDb([
      cohortRow('2026-07-01', '2026-07-31'),
      cohortRow('2026-06-01', '2026-06-30'),
    ])
    const plota = client()
    const result = await runPlotaRefresh({ ...base, maxPages: 1, db, client: plota as never })

    // The stalest cohort is first, so a budget that covers only one window spends it there.
    expect(plota.search).toHaveBeenCalledTimes(1)
    expect(result.cohorts).toHaveLength(1)
    expect(result.cohorts[0].windowStart).toBe('2026-07-01')
  })

  it('refuses a pre-archive window under reduced scope and says why', async () => {
    const { db } = makeDb([
      cohortRow('2025-11-01', '2025-11-30'),
      cohortRow('2026-07-01', '2026-07-31'),
    ])
    const plota = client()
    const result = await runPlotaRefresh({
      ...base, scope: 'reduced', db, client: plota as never,
    })

    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].windowStart).toBe('2025-11-01')
    expect(result.skipped[0].reason).toContain('2026-01-01')
    // Only the searchable window costs requests; reduced scope fans out across three specs.
    for (const [params] of plota.search.mock.calls) {
      expect(params.date_from).toBe('2026-07-01')
    }
  })

  it('searches a pre-archive window under a full census, which has no derived filter to lose', async () => {
    const { db } = makeDb([cohortRow('2025-11-01', '2025-11-30')])
    const plota = client()
    const result = await runPlotaRefresh({ ...base, db, client: plota as never })

    expect(result.skipped).toHaveLength(0)
    expect(plota.search).toHaveBeenCalledTimes(1)
  })

  it('keys checkpoints by cycle, so a finished window is re-walked on the next pass', async () => {
    const { db, writes } = makeDb([cohortRow('2026-07-01', '2026-07-31')])
    await runPlotaRefresh({
      ...base, db, client: client() as never, cycleKey: '2026-09-14',
    })
    const scopeKeys = writes
      .filter((w) => w.table === 'planning_ingest_checkpoints')
      .map((w) => (w.payload as { scope_key: string }).scope_key)

    expect(scopeKeys.length).toBeGreaterThan(0)
    for (const key of scopeKeys) {
      expect(key).toContain('2026-09-14')
      expect(key.startsWith('refresh:')).toBe(true)
    }
  })

  it('stops once the provider reserve is reached rather than draining the allowance', async () => {
    const { db } = makeDb([
      cohortRow('2026-07-01', '2026-07-31'),
      cohortRow('2026-06-01', '2026-06-30'),
    ])
    const plota = {
      search: jest.fn().mockResolvedValue({
        page: { data: [], meta: { next_cursor: null } },
        usage: { requestId: 'req_1', monthlyLimit: 15000, monthlyRemaining: 10 },
      }),
    }
    const result = await runPlotaRefresh({ ...base, db, client: plota as never })

    expect(result.stoppedForReserve).toBe(true)
    expect(plota.search).toHaveBeenCalledTimes(1)
  })
})
