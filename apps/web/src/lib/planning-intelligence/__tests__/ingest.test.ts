import { runPlotaDiscovery, runPlotaLaneDiscovery, runPlotaSync } from '../ingest'
import { PLOTA_REQUEST_RESERVE } from '../plota'
import type { PlotaApplication } from '../types'

type Result = { data: unknown; error: unknown }
type Write = { table: string; op: string; payload: unknown; onConflict?: string }

/**
 * Minimal stand-in for the Supabase query builder: every method chains, and awaiting the
 * builder resolves a result chosen by table + operation. It records what was written so a
 * test can assert on the exact row the census would persist.
 */
class Builder implements PromiseLike<Result> {
  private op = ''
  constructor(
    private readonly table: string,
    private readonly writes: Write[],
    private readonly results: Record<string, Result>
  ) {}
  select() { if (!this.op) this.op = 'select'; return this }
  insert(payload: unknown) { this.op = 'insert'; this.writes.push({ table: this.table, op: 'insert', payload }); return this }
  upsert(payload: unknown, options?: { onConflict?: string }) { this.op = 'upsert'; this.writes.push({ table: this.table, op: 'upsert', payload, onConflict: options?.onConflict }); return this }
  update(payload: unknown) { this.op = 'update'; this.writes.push({ table: this.table, op: 'update', payload }); return this }
  eq() { return this }
  like(_column: string, pattern: string) { this.op = 'like'; this.writes.push({ table: this.table, op: 'like', payload: pattern }); return this }
  gte() { return this }
  in() { return this }
  order() { return this }
  limit() { return this }
  range() { return this }
  maybeSingle() { return this }
  single() { return this }
  then<A, B>(
    onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    const key = `${this.table}:${this.op}`
    const result = this.results[key] ?? { data: [], error: null }
    return Promise.resolve(result).then(onfulfilled, onrejected)
  }
}

function makeDb() {
  const writes: Write[] = []
  const results: Record<string, Result> = {
    'planning_ingest_runs:insert': { data: { id: 'run-1' }, error: null },
    'planning_ingest_checkpoints:select': { data: null, error: null },
    'planning_applications:select': { data: [], error: null },
    'brands:select': { data: [], error: null },
    'fascias:select': { data: [], error: null },
  }
  const db = { from: (table: string) => new Builder(table, writes, results) }
  return { db: db as never, writes, results }
}

// Shaped after a real Plota record observed on 8 Sep 2026: the provider states that its
// coordinate is a centroid, never an exact site point.
function application(overrides: Partial<PlotaApplication> = {}): PlotaApplication {
  return {
    id: 'tdko9cpy',
    reference: '26/00712/FULH',
    authority: { slug: 'watford', name: 'Watford' },
    address: '32 Gade Avenue Watford',
    postcode: 'WD18 7LG',
    description: 'Erection of a new retail foodstore',
    commercial: true,
    commercial_work: 'new',
    location: { lat: 51.65759, lng: -0.422497, precision: 'centroid' },
    date_received: '2026-09-08',
    stage: 'pending',
    ...overrides,
  } as PlotaApplication
}

function client(app: PlotaApplication, monthlyRemaining: number | null = 488) {
  return {
    search: jest.fn().mockResolvedValue({
      page: { data: [app], meta: { next_cursor: null } },
      usage: { requestId: 'req_1', monthlyLimit: 500, monthlyRemaining },
    }),
  } as never
}

function upsertedApplication(writes: Array<{ table: string; op: string; payload: unknown }>) {
  const write = writes.find((w) => w.table === 'planning_applications' && w.op === 'upsert')
  return (write?.payload as Record<string, unknown>[])[0]
}

const base = {
  kind: 'discovery' as const,
  scope: 'full' as const,
  dateFrom: '2026-08-25',
  dateTo: '2026-09-08',
  pageSize: 10,
  maxPages: 1,
  nations: ['england'],
}

describe('runPlotaSync census mapping', () => {
  it('retries an ambiguous full terminal page without advancing its cursor or hiding quota use', async () => {
    const { db, writes, results } = makeDb()
    results['planning_ingest_checkpoints:select'] = { data: { next_cursor: 'saved' }, error: null }
    const usage = { monthlyRemaining: 19000 }
    const plota = { search: jest.fn()
      .mockResolvedValueOnce({ page: { data: [application(), application()], meta: { next_cursor: null, historical_available: true } }, usage })
      .mockResolvedValueOnce({ page: { data: [application()], meta: { next_cursor: 'last' } }, usage })
      .mockResolvedValueOnce({ page: { data: [application({ id: 'second', reference: 'other' })], meta: { next_cursor: null, historical_included: true } }, usage }) }
    const result = await runPlotaSync({ ...base, pageSize: 2, maxPages: 3, db, client: plota as never })
    expect(plota.search.mock.calls.map(([params]) => [params.limit, params.cursor])).toEqual([
      ['2', 'saved'], ['1', 'saved'], ['1', 'last'],
    ])
    expect(result).toMatchObject({ status: 'complete', requestsMade: 3, recordsSeen: 2, recordsUpserted: 2 })
    expect(writes.filter(w => w.table === 'planning_provider_usage')).toHaveLength(3)
  })

  it('persists the smaller page size across bounded invocations and obeys the reserve', async () => {
    const { db, writes, results } = makeDb()
    const plota = { search: jest.fn().mockResolvedValue({ page: {
      data: [application(), application()], meta: { next_cursor: null, historical_available: true },
    }, usage: { monthlyRemaining: PLOTA_REQUEST_RESERVE } }) }
    const result = await runPlotaSync({ ...base, kind: 'backfill', pageSize: 2, maxPages: 4, db, client: plota as never })
    expect(result).toMatchObject({ status: 'partial', requestsMade: 1, stoppedForReserve: true })
    const saved = writes.filter(w => w.table === 'planning_ingest_checkpoints').at(-1)?.payload
    expect(saved).toMatchObject({ parameters: { limit: '1' }, status: 'pending', next_cursor: null })
    results['planning_ingest_checkpoints:select'] = { data: saved, error: null }
    plota.search.mockResolvedValue({ page: { data: [], meta: { next_cursor: null, historical_included: true } }, usage: { monthlyRemaining: 19000 } })
    await runPlotaSync({ ...base, pageSize: 2, db, client: plota as never })
    expect(plota.search).toHaveBeenLastCalledWith(expect.objectContaining({ limit: '1' }))
  })

  it('follows advertised history through the live pages instead of treating it as an entitlement failure', async () => {
    const { db } = makeDb()
    const usage = { requestId: 'archive-request', monthlyLimit: 20000, monthlyRemaining: 19000 }
    const plota = { search: jest.fn()
      .mockResolvedValueOnce({ page: { data: [application()], meta: { next_cursor: 'live-cursor', historical_available: true } }, usage })
      .mockResolvedValueOnce({ page: { data: [], meta: { next_cursor: null, historical_included: true } }, usage }) }
    const result = await runPlotaSync({ ...base, kind: 'backfill', maxPages: 2,
      db, client: plota as never })
    expect(plota.search).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'live-cursor' }))
    expect(result.status).toBe('complete')
    expect(result.requestsMade).toBe(2)
  })

  it('does not overwrite a live application with its historical twin', async () => {
    const { db, writes, results } = makeDb()
    results['planning_applications:select'] = { data: [{ provider_id: 'live-id',
      authority_slug: 'watford', reference: '26/00712/FULH', source: 'live', classification_state: 'classified' }], error: null }
    const result = await runPlotaSync({ ...base, db,
      client: client(application({ id: 'archive-id', source: 'historical' })) })
    expect(result.recordsUpserted).toBe(0)
    expect(writes.some(w => w.table === 'planning_applications' && w.op === 'upsert')).toBe(false)
  })

  it('replaces an archive provider id through the natural key, retaining existing application links', async () => {
    const { db, writes, results } = makeDb()
    results['planning_applications:select'] = { data: [{ provider_id: 'archive-id',
      authority_slug: 'watford', reference: '26/00712/FULH', source: 'historical' }], error: null }
    await runPlotaSync({ ...base, db, client: client(application({ source: 'live' })) })
    const write = writes.find(w => w.table === 'planning_applications' && w.op === 'upsert')
    expect(write?.onConflict).toBe('authority_slug,reference')
    expect(upsertedApplication(writes).provider_id).toBe('tdko9cpy')
    expect(upsertedApplication(writes)).not.toHaveProperty('id')
  })

  it('prefers a live record when a page also contains its archive twin', async () => {
    const { db, writes } = makeDb()
    const plota = { search: jest.fn().mockResolvedValue({
      page: { data: [application({ source: 'live' }), application({ id: 'archive-id', source: 'historical' })], meta: { next_cursor: null } },
      usage: { monthlyRemaining: 19000 },
    }) }
    const result = await runPlotaSync({ ...base, db, client: plota as never })
    expect(result.recordsUpserted).toBe(1)
    expect(upsertedApplication(writes).provider_id).toBe('tdko9cpy')
  })

  it('records usage but refuses to advance or complete a backfill when the archive is withheld', async () => {
    const { db, writes } = makeDb()
    const plota = { search: jest.fn().mockResolvedValue({
      page: { data: [application()], meta: { next_cursor: null, historical_available: true } },
      usage: { requestId: 'archive-request', monthlyLimit: 20000, monthlyRemaining: 19000 },
    }) }
    await expect(runPlotaSync({ ...base, kind: 'backfill', dateFrom: '2025-09-10', dateTo: '2025-09-30',
      db, client: plota as never })).rejects.toThrow('withheld historical records')
    expect(writes.some(w => w.table === 'planning_provider_usage' && w.op === 'insert')).toBe(true)
    expect(writes.some(w => w.table === 'planning_applications' && w.op === 'upsert')).toBe(false)
    expect(writes.filter(w => w.table === 'planning_ingest_checkpoints').some(w =>
      (w.payload as { status: string }).status === 'complete')).toBe(false)
    expect(writes.find(w => w.table === 'planning_ingest_runs' && w.op === 'update')?.payload)
      .toMatchObject({ status: 'failed', requests_made: 1 })
  })

  it("carries the provider's own precision rather than implying an exact site", async () => {
    const { db, writes } = makeDb()
    const result = await runPlotaSync({ ...base, db, client: client(application()) })

    const row = upsertedApplication(writes)
    expect(row.location_precision).toBe('centroid')
    expect(row.location).toBe('POINT(-0.422497 51.65759)')
    expect(result.recordsUpserted).toBe(1)
  })

  it('records a null precision when the provider omits one', async () => {
    const { db, writes } = makeDb()
    await runPlotaSync({
      ...base,
      db,
      client: client(application({ location: { lat: 51.6, lng: -0.4 } })),
    })
    expect(upsertedApplication(writes).location_precision).toBeNull()
  })

  it('stores no coordinate and no precision when the provider has no location', async () => {
    const { db, writes } = makeDb()
    await runPlotaSync({ ...base, db, client: client(application({ location: null })) })

    const row = upsertedApplication(writes)
    expect(row.location).toBeNull()
    expect(row.location_precision).toBeNull()
  })

  it('promotes a new-commercial record to the intelligence tier', async () => {
    const { db, writes } = makeDb()
    const result = await runPlotaSync({ ...base, db, client: client(application()) })

    const row = upsertedApplication(writes)
    expect(row.intelligence_tier).toBe(true)
    expect(row.classification_state).toBe('queued')
    expect(result.intelligenceRecords).toBe(1)
  })

  // Matches the live Demo key, whose 500/month allowance sits below the request reserve.
  it('stops after one request when the remaining allowance is inside the reserve', async () => {
    const { db } = makeDb()
    const result = await runPlotaSync({ ...base, kind: 'backfill', db, client: client(application(), 488) })

    expect(result.requestsMade).toBe(1)
    expect(result.stoppedForReserve).toBe(true)
    expect(result.status).toBe('partial')
  })

  it('makes no backfill request once the recorded allowance reaches the reserve', async () => {
    const { db, results } = makeDb()
    results['planning_provider_usage:select'] = { data: { monthly_remaining: PLOTA_REQUEST_RESERVE }, error: null }
    const plota = { search: jest.fn() }
    expect(await runPlotaSync({ ...base, kind: 'backfill', db, client: plota as never }))
      .toMatchObject({ requestsMade: 0, stoppedForReserve: true, status: 'partial' })
    expect(plota.search).not.toHaveBeenCalled()
  })

  it('allows new-application discovery to use the protected reserve', async () => {
    const { db, results } = makeDb()
    results['planning_provider_usage:select'] = { data: { monthly_remaining: PLOTA_REQUEST_RESERVE }, error: null }
    expect(await runPlotaSync({ ...base, db, client: client(application(), PLOTA_REQUEST_RESERVE - 1) }))
      .toMatchObject({ requestsMade: 1, stoppedForReserve: false, status: 'complete' })
  })

  it('does not attempt discovery when the recorded allowance is exhausted', async () => {
    const { db, results } = makeDb()
    results['planning_provider_usage:select'] = { data: { monthly_remaining: 0 }, error: null }
    const plota = { search: jest.fn() }
    expect(await runPlotaSync({ ...base, db, client: plota as never }))
      .toMatchObject({ requestsMade: 0, stoppedForReserve: true })
    expect(plota.search).not.toHaveBeenCalled()
  })
})

describe('late-published discovery lanes', () => {
  const lateBase = { dateFrom: '2026-05-16', dateTo: '2026-09-06', pageSize: 10, maxPages: 5, nations: ['england'] }
  const checkpointKeys = (writes: Write[]) => [...new Set(writes
    .filter(w => w.table === 'planning_ingest_checkpoints' && w.op === 'upsert')
    .map(w => (w.payload as { scope_key: string }).scope_key))]

  it('walks the reduced filters under its own checkpoint prefix', async () => {
    const { db, writes } = makeDb()
    const result = await runPlotaLaneDiscovery('late', { ...lateBase, db, client: client(application(), 9000) })
    expect(result).toMatchObject({ requestsMade: 3, status: 'complete' })
    expect(checkpointKeys(writes)).toEqual([
      'discovery-late:reduced:2026-05-16:2026-09-06:england:commercial',
      'discovery-late:reduced:2026-05-16:2026-09-06:england:residential',
      'discovery-late:reduced:2026-05-16:2026-09-06:england:brand-evidence-routes',
    ])
    expect(writes.find(w => w.table === 'planning_ingest_runs' && w.op === 'insert')?.payload)
      .toMatchObject({ kind: 'discovery_late', census_scope: 'reduced' })
  })

  it('never lets a lane stand in for main discovery in freshness or run status', async () => {
    const coverage = async (run: (db: never) => Promise<unknown>) => {
      const { db, writes } = makeDb()
      await run(db)
      return writes.filter(w => w.table === 'planning_authority_coverage').map(w => w.payload as Record<string, unknown>)
    }
    const lane = await coverage(db => runPlotaLaneDiscovery('deep', { ...lateBase, db, client: client(application(), 9000) }))
    expect(lane.length).toBeGreaterThan(0)
    expect(lane.every(row => !('last_discovery_at' in row))).toBe(true)
    const main = await coverage(db => runPlotaSync({ ...base, db, client: client(application(), 9000) }))
    expect(main.every(row => typeof row.last_discovery_at === 'string')).toBe(true)
  })

  it('stops at the protected reserve, which only main discovery may spend', async () => {
    const { db, results } = makeDb()
    results['planning_provider_usage:select'] = { data: { monthly_remaining: PLOTA_REQUEST_RESERVE }, error: null }
    const plota = { search: jest.fn() }
    expect(await runPlotaLaneDiscovery('late', { ...lateBase, db, client: plota as never }))
      .toMatchObject({ requestsMade: 0, stoppedForReserve: true, status: 'partial' })
    expect(plota.search).not.toHaveBeenCalled()
  })

  it('finishes an unfinished late window before starting a newer one', async () => {
    const { db, writes, results } = makeDb()
    results['planning_ingest_checkpoints:like'] = { data: [
      { scope_key: 'discovery-late:reduced:2026-05-01:2026-08-22:england:commercial', status: 'pending' },
    ], error: null }
    await runPlotaLaneDiscovery('late', { ...lateBase, db, client: client(application(), 9000) })
    expect(writes.find(w => w.table === 'planning_ingest_runs' && w.op === 'insert')?.payload)
      .toMatchObject({ date_from: '2026-05-01', date_to: '2026-08-22' })
  })

  it('keeps main discovery and the late lane from resuming each other', async () => {
    const { db, writes } = makeDb()
    await runPlotaDiscovery({ ...lateBase, scope: 'reduced', db, client: client(application(), 9000) })
    await runPlotaLaneDiscovery('late', { ...lateBase, db, client: client(application(), 9000) })
    await runPlotaLaneDiscovery('deep', { ...lateBase, db, client: client(application(), 9000) })
    expect(writes.filter(w => w.op === 'like').map(w => w.payload))
      .toEqual(['discovery:reduced:%', 'discovery-late:reduced:%', 'discovery-deep:reduced:%'])
  })

  it('gives the deep lane its own checkpoints and the same reserve limit', async () => {
    const { db, writes, results } = makeDb()
    await runPlotaLaneDiscovery('deep', { ...lateBase, db, client: client(application(), 9000) })
    expect(checkpointKeys(writes)[0]).toBe('discovery-deep:reduced:2026-05-16:2026-09-06:england:commercial')
    expect(writes.find(w => w.table === 'planning_ingest_runs' && w.op === 'insert')?.payload)
      .toMatchObject({ kind: 'discovery_deep' })
    results['planning_provider_usage:select'] = { data: { monthly_remaining: PLOTA_REQUEST_RESERVE }, error: null }
    const plota = { search: jest.fn() }
    expect(await runPlotaLaneDiscovery('deep', { ...lateBase, db, client: plota as never }))
      .toMatchObject({ requestsMade: 0, stoppedForReserve: true })
  })

  it('refuses a lane on anything but discovery before logging a run', async () => {
    const { db, writes } = makeDb()
    await expect(runPlotaSync({ ...base, kind: 'backfill', lane: 'late', db, client: client(application()) }))
      .rejects.toThrow('Only discovery has lanes')
    expect(writes).toHaveLength(0)
  })
})
