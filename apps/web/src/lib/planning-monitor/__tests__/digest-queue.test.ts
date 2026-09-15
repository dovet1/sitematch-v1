jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/lib/planning-intelligence/db', () => ({ createPlanningAdminClient: () => ({}) }))
jest.mock('@/lib/planning-intelligence/freshness', () => ({
  FRESHNESS_UNAVAILABLE: { stale: false, staleReason: null },
  readPlanningFreshness: async () => ({ stale: false, staleReason: null }),
}))
jest.mock('@/lib/feature-flags', () => ({
  isPlanningMonitorAiEnabled: async () => false,
  isPlanningMonitorEmailEnabled: async () => false,
}))
jest.mock('../criteria', () => ({ parseCriteria: () => ({ ok: true, criteria: {} }), buildPredicate: () => ({}) }))
jest.mock('../service', () => ({
  loadWatches: async () => ({ applicationIds: [], applications: new Set(), developments: new Set() }),
  mapRow: (row: unknown) => row,
}))

import { processRuns } from '../digest-queue'

type Row = Record<string, unknown>

/**
 * A database holding one run. Updates honour the filters they were built with, so a missing guard
 * shows up as a changed row. `finish` decides what the finish call does.
 */
function fakeDb(finish: (run: Row) => { data?: unknown; error?: unknown }) {
  const run: Row = {
    id: 'run-1', patch_id: 'patch-1', revision_id: 'rev-1', subscription_id: null, kind: 'initial',
    period_start: '2026-09-07T10:00:00Z', period_end: '2026-09-14T10:00:00Z', period_label: 'Last 7 days',
    attempts: 0, lease_owner: null, status: 'queued', created_at: '2026-09-14T10:00:00Z',
  }
  let claimed = false

  function from(table: string) {
    const filters: Array<[string, unknown]> = []
    let values: Row | null = null
    const builder: any = {
      select: () => builder,
      update: (v: Row) => { values = v; return builder },
      eq: (column: string, value: unknown) => { filters.push([column, value]); return builder },
      single: async () => ({
        data: { id: 'rev-1', revision: 1, name: 'Leeds', geometry: null, criteria: {}, planning_monitor_patches: { owner_id: 'u1', archived_at: null } },
        error: null,
      }),
      then: (resolve: (value: unknown) => void) => {
        if (values && table === 'planning_monitor_digest_runs' && filters.every(([c, v]) => run[c] === v)) Object.assign(run, values)
        resolve({ data: [], error: null })
      },
    }
    return builder
  }

  const db = {
    from,
    rpc: async (name: string) => {
      if (name === 'planning_monitor_claim_run') {
        if (claimed) return { data: [], error: null }
        claimed = true
        Object.assign(run, { status: 'running', attempts: (run.attempts as number) + 1, lease_owner: 'w1' })
        return { data: [{ ...run }], error: null }
      }
      if (name === 'planning_monitor_finish_run') return finish(run)
      return { data: [], error: null }
    },
  }
  return { db: db as never, run }
}

describe('processRuns', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined))
  afterEach(() => jest.restoreAllMocks())

  it('leaves a report generated when the finish call commits but its response is lost', async () => {
    const { db, run } = fakeDb((r) => {
      Object.assign(r, { status: 'generated', lease_owner: null })
      throw new Error('fetch failed')
    })
    const outcomes = await processRuns('w1', 1, db)
    expect(outcomes[0].status).toBe('failed')
    expect(run.status).toBe('generated')
  })

  it('sends a run that failed before saving back to the queue', async () => {
    const { db, run } = fakeDb(() => { throw new Error('fetch failed') })
    await processRuns('w1', 1, db)
    expect(run).toMatchObject({ status: 'queued', lease_owner: null, error: 'fetch failed' })
  })
})
