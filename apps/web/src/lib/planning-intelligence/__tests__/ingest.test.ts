import { runPlotaSync } from '../ingest'
import type { PlotaApplication } from '../types'

type Result = { data: unknown; error: unknown }

/**
 * Minimal stand-in for the Supabase query builder: every method chains, and awaiting the
 * builder resolves a result chosen by table + operation. It records what was written so a
 * test can assert on the exact row the census would persist.
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
    const result = this.results[key] ?? { data: [], error: null }
    return Promise.resolve(result).then(onfulfilled, onrejected)
  }
}

function makeDb() {
  const writes: Array<{ table: string; op: string; payload: unknown }> = []
  const results: Record<string, Result> = {
    'planning_ingest_runs:insert': { data: { id: 'run-1' }, error: null },
    'planning_ingest_checkpoints:select': { data: null, error: null },
    'planning_applications:select': { data: [], error: null },
    'brands:select': { data: [], error: null },
    'fascias:select': { data: [], error: null },
  }
  const db = { from: (table: string) => new Builder(table, writes, results) }
  return { db: db as never, writes }
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
    const result = await runPlotaSync({ ...base, db, client: client(application(), 488) })

    expect(result.requestsMade).toBe(1)
    expect(result.stoppedForReserve).toBe(true)
    expect(result.status).toBe('partial')
  })
})
