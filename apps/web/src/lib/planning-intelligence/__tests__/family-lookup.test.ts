import broadland from './fixtures/plota-family-broadland-2024-3141.json'
import { FAMILY_ENDPOINT, runFamilyLookups, storeFamily, type LookupRow } from '../family-lookup'
import { lookupPriority, quotesMajorProposal } from '../family-priority'
import { PlotaError } from '../plota'
import type { PlotaFamily } from '../types'

type Row = Record<string, unknown>

/** An in-memory stand-in for the Supabase client, enough for the queries family lookups make. */
function makeDb(tables: Record<string, Row[]>, rpcHandlers: Record<string, (args: Row) => unknown> = {}) {
  let sequence = 0
  const rpcs: Array<{ name: string; args: Row }> = []
  class Query implements PromiseLike<{ data: unknown; error: null; count?: number }> {
    private filters: Array<(row: Row) => boolean> = []
    private op: 'select' | 'upsert' | 'update' | 'insert' = 'select'
    private payload: Row[] = []
    private options: { onConflict?: string; ignoreDuplicates?: boolean; count?: string; head?: boolean } = {}
    private ordering: Array<[string, boolean]> = []
    private max = Infinity
    private one = false
    private returning = false
    constructor(private readonly table: string) { tables[table] ??= [] }
    select(_columns?: string, options?: { count?: string; head?: boolean }) { if (this.op !== 'select') this.returning = true; Object.assign(this.options, options); return this }
    eq(column: string, value: unknown) { this.filters.push(row => row[column] === value); return this }
    neq(column: string, value: unknown) { this.filters.push(row => row[column] !== value); return this }
    in(column: string, values: unknown[]) { this.filters.push(row => values.includes(row[column])); return this }
    is(column: string, value: null) { this.filters.push(row => (row[column] ?? null) === value); return this }
    not(column: string, _op: string, _value: null) { this.filters.push(row => (row[column] ?? null) !== null); return this }
    gte(column: string, value: string) { this.filters.push(row => String(row[column] ?? '') >= value); return this }
    order(column: string, options?: { ascending?: boolean }) { this.ordering.push([column, options?.ascending ?? true]); return this }
    limit(count: number) { this.max = count; return this }
    maybeSingle() { this.one = true; return this }
    single() { this.one = true; return this }
    upsert(rows: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) { this.op = 'upsert'; this.payload = ([] as Row[]).concat(rows); Object.assign(this.options, options); return this }
    update(values: Row) { this.op = 'update'; this.payload = [values]; return this }
    insert(rows: Row | Row[]) { this.op = 'insert'; this.payload = ([] as Row[]).concat(rows); return this }
    then<A, B>(done?: ((value: { data: unknown; error: null; count?: number }) => A | PromiseLike<A>) | null, fail?: ((reason: unknown) => B | PromiseLike<B>) | null) {
      return Promise.resolve(this.run()).then(done, fail)
    }
    private run() {
      const rows = tables[this.table]
      if (this.op === 'insert') { for (const row of this.payload) rows.push({ id: `${this.table}-${++sequence}`, ...row }); return { data: null, error: null as null } }
      if (this.op === 'upsert') {
        const keys = (this.options.onConflict ?? 'id').split(',')
        const affected: Row[] = []
        for (const row of this.payload) {
          const existing = rows.find(candidate => keys.every(key => candidate[key] === row[key]))
          if (existing) { if (!this.options.ignoreDuplicates) Object.assign(existing, row); affected.push(existing) }
          else { const created = { id: `${this.table}-${++sequence}`, ...row }; rows.push(created); affected.push(created) }
        }
        return { data: this.one ? affected[0] : affected, error: null as null }
      }
      let matched = rows.filter(row => this.filters.every(filter => filter(row)))
      if (this.op === 'update') { for (const row of matched) Object.assign(row, this.payload[0]); return { data: this.returning ? matched : null, error: null as null } }
      for (const [column, ascending] of [...this.ordering].reverse()) {
        matched = [...matched].sort((a, b) => (String(a[column] ?? '') < String(b[column] ?? '') ? -1 : 1) * (ascending ? 1 : -1))
      }
      matched = matched.slice(0, this.max)
      if (this.options.head) return { data: null, error: null as null, count: matched.length }
      return { data: this.one ? matched[0] ?? null : matched, error: null as null }
    }
  }
  const db = {
    from: (table: string) => new Query(table),
    rpc: (name: string, args: Row) => { rpcs.push({ name, args }); return Promise.resolve({ data: rpcHandlers[name]?.(args) ?? 0, error: null }) },
  }
  return { db: db as never, tables, rpcs }
}

const family = (broadland as { data: PlotaFamily }).data
const COUNCIL = 'south-norfolk-broadland'

function application(id: string, providerId: string, reference: string, extra: Row = {}): Row {
  return { id, provider: 'plota', provider_id: providerId, authority_slug: COUNCIL, reference, reference_normalised: reference,
    location_provenance: 'source_exact', source_kind: 'live', date_received: '2026-04-02', intelligence_tier: false, ...extra }
}

function broadlandStore(extraLinks: Row[] = []) {
  const tables: Record<string, Row[]> = {
    planning_applications: [
      application('a-0994', '7gdc72mt', '2026/0994'),
      application('a-2652', 'uy29jz34', '2026/2652', { date_received: '2026-09-07' }),
      application('a-elsewhere', 'zzz', '2026/9999', { date_received: '2026-05-01' }),
    ],
    planning_application_links: [
      { id: 'l1', authority_slug: COUNCIL, child_application_id: 'a-0994', parent_key: '2024/3141', strength: 'strong', source: 'cited_reference', removed_at: null },
      { id: 'l2', authority_slug: COUNCIL, child_application_id: 'a-2652', parent_key: '2024/3141', strength: 'strong', source: 'cited_reference', removed_at: null },
      ...extraLinks,
    ],
    planning_family_lookups: [
      { id: 'lookup-1', authority_slug: COUNCIL, parent_key: '2024/3141', parent_reference: '2024/3141', status: 'queued', attempts: 0, priority: 1500, last_requested_at: '2026-09-14' },
    ],
    planning_families: [],
    planning_provider_usage: [],
  }
  return tables
}

const lookup = (tables: Record<string, Row[]>) => tables.planning_family_lookups[0] as unknown as LookupRow

describe('storeFamily', () => {
  it('stores the Broadland warehouse club family once and closes its lookup', async () => {
    const tables = broadlandStore()
    const { db, rpcs } = makeDb(tables)

    const result = await storeFamily(db, { lookup: lookup(tables), family, requestedVia: 'uy29jz34' })

    const principal = tables.planning_applications.find(row => row.reference === '2024/3141')!
    expect(principal).toMatchObject({ provider_id: 'h_07ea8ed7473e', intelligence_tier: false, classification_state: 'not_eligible', stage: 'approved' })
    // The warehouse club meets the described commercial limb, recorded for step 5 to act on.
    expect(principal.eligibility_limbs).toEqual(['A-described'])
    expect(result).toMatchObject({ members: 12, newApplications: 10, conflict: null })
    expect(tables.planning_families).toHaveLength(1)
    expect(tables.planning_families[0]).toMatchObject({ principal_reference: '2024/3141', member_count: 12, requested_via_provider_id: 'uy29jz34' })
    expect((tables.planning_families[0].condition_ledger as unknown[]).length).toBe(10)
    expect(tables.planning_family_lookups[0]).toMatchObject({ status: 'complete', family_id: tables.planning_families[0].id, review_state: 'none' })
    const plotaLinks = tables.planning_application_links.filter(row => row.source === 'plota_associated')
    expect(plotaLinks).toHaveLength(11)
    expect(plotaLinks.every(row => row.parent_application_id === principal.id && row.parent_key === '2024/3141')).toBe(true)
    // Fetched members borrow a stored member's location, and waiting follow-ons are attached.
    expect(rpcs.filter(call => call.name === 'planning_copy_family_location')).toHaveLength(10)
    expect(rpcs.some(call => call.name === 'planning_resolve_family_parents')).toBe(true)
  })

  it('closes other queued lookups the same family answers, so they cost no request', async () => {
    const tables = broadlandStore()
    tables.planning_family_lookups.push({ id: 'lookup-2', authority_slug: COUNCIL, parent_key: '2026/0941', parent_reference: '2026/0941', status: 'queued', attempts: 0 })
    const { db } = makeDb(tables)
    const result = await storeFamily(db, { lookup: lookup(tables), family, requestedVia: 'uy29jz34' })
    expect(tables.planning_family_lookups[1]).toMatchObject({ status: 'complete', family_id: tables.planning_families[0].id })
    expect(result.lookupsClosed).toBe(2)
  })

  it('never recreates a link a person removed', async () => {
    const tables = broadlandStore([
      { id: 'l3', authority_slug: COUNCIL, child_application_id: 'a-2652', parent_key: '2024/3141', strength: 'strong', source: 'manual', removed_at: '2026-09-14T00:00:00Z' },
    ])
    const { db } = makeDb(tables)
    const result = await storeFamily(db, { lookup: lookup(tables), family, requestedVia: 'uy29jz34' })
    expect(result.skippedRemovedLinks).toBe(1)
    expect(tables.planning_application_links.some(row => row.source === 'plota_associated' && row.child_application_id === 'a-2652')).toBe(false)
  })

  it('stores the family but marks it for review when local evidence disagrees', async () => {
    const tables = broadlandStore([
      { id: 'l4', authority_slug: COUNCIL, child_application_id: 'a-elsewhere', parent_key: '2024/3141', strength: 'strong', source: 'cited_reference', removed_at: null },
    ])
    const { db } = makeDb(tables)
    const result = await storeFamily(db, { lookup: lookup(tables), family, requestedVia: 'uy29jz34' })
    expect(result.conflict).toEqual({ localFollowOnsOutsideFamily: ['2026/9999'], membersLinkedElsewhere: [] })
    expect(tables.planning_family_lookups[0]).toMatchObject({ status: 'complete', review_state: 'pending' })
  })
})

describe('runFamilyLookups', () => {
  const monthStart = () => { const date = new Date(); date.setUTCDate(1); date.setUTCHours(0, 0, 0, 0); return date.toISOString() }
  const client = () => ({ associated: jest.fn().mockResolvedValue({ family, usage: { requestId: 'req_family', monthlyLimit: 20000, monthlyRemaining: 9000 } }) })

  it('reports what it would fetch without spending anything unless committed', async () => {
    const tables = broadlandStore()
    const plota = client()
    const result = await runFamilyLookups(makeDb(tables).db, plota, { limit: 5, monthlyAllowance: 300, commit: false })
    expect(plota.associated).not.toHaveBeenCalled()
    expect(result.planned).toEqual([{ lookupId: 'lookup-1', council: COUNCIL, parentReference: '2024/3141', via: 'uy29jz34' }])
  })

  it('fetches, records usage against the lookup allowance and stores the family', async () => {
    const tables = broadlandStore()
    const plota = client()
    const result = await runFamilyLookups(makeDb(tables).db, plota, { limit: 5, monthlyAllowance: 300, commit: true })
    expect(plota.associated).toHaveBeenCalledWith('uy29jz34')
    expect(result).toMatchObject({ requestsMade: 1, stoppedFor: null })
    expect(tables.planning_provider_usage).toEqual([expect.objectContaining({ endpoint: FAMILY_ENDPOINT, status_code: 200, monthly_remaining: 9000 })])
    expect(tables.planning_families).toHaveLength(1)
  })

  it('stops at the agreed allowance, counting earlier lookups this month', async () => {
    const tables = broadlandStore()
    tables.planning_provider_usage.push(...Array.from({ length: 300 }, () => ({ provider: 'plota', endpoint: FAMILY_ENDPOINT, occurred_at: monthStart(), status_code: 200 })))
    const plota = client()
    const result = await runFamilyLookups(makeDb(tables).db, plota, { limit: 5, monthlyAllowance: 300, commit: true })
    expect(plota.associated).not.toHaveBeenCalled()
    expect(result.stoppedFor).toBe('allowance')
  })

  it('never spends the discovery reserve', async () => {
    const tables = broadlandStore()
    tables.planning_provider_usage.push({ provider: 'plota', endpoint: '/v1/applications', occurred_at: new Date().toISOString(), monthly_remaining: 3500, status_code: 200 })
    const plota = client()
    const result = await runFamilyLookups(makeDb(tables).db, plota, { limit: 5, monthlyAllowance: 300, commit: true })
    expect(plota.associated).not.toHaveBeenCalled()
    expect(result.stoppedFor).toBe('reserve')
  })

  it('defers a rate-limited lookup and stops the run', async () => {
    const tables = broadlandStore()
    const plota = { associated: jest.fn().mockRejectedValue(new PlotaError('Too many requests', 429, 'req_429', 30)) }
    const result = await runFamilyLookups(makeDb(tables).db, plota, { limit: 5, monthlyAllowance: 300, commit: true })
    expect(result.stoppedFor).toBe('rate_limit')
    expect(tables.planning_family_lookups[0]).toMatchObject({ status: 'deferred', last_error: 'Too many requests' })
  })
})

describe('lookup priority', () => {
  const now = new Date('2026-10-01T00:00:00Z')
  const base = { childCount: 1, bestRelevance: null, anyChildInTier: false, latestChildReceived: null, quotesMajorProposal: false }

  it('puts relevant Developments missing their originals first, then quoted major schemes, recent activity and size', () => {
    const relevant = lookupPriority({ ...base, bestRelevance: 'high' }, now)
    const quoted = lookupPriority({ ...base, quotesMajorProposal: true }, now)
    const broadlandLike = lookupPriority({ ...base, childCount: 11, latestChildReceived: '2026-09-07' }, now)
    const householder = lookupPriority({ ...base, latestChildReceived: '2025-10-01' }, now)
    expect(relevant).toBeGreaterThan(quoted)
    expect(broadlandLike).toBeGreaterThan(householder)
    expect(quoted).toBeGreaterThan(householder)
  })

  it('reads a major proposal quoted by a single follow-on', () => {
    expect(quotesMajorProposal('Details pursuant to condition 14 (archaeology) of planning permission ref. 2021/3958 dated 13/7/2023 (for "Demolition of existing buildings and erection of 392 dwellings")', '2021/3958')).toBe(true)
    expect(quotesMajorProposal('Details of condition 6 of 2025/0103 (Erection of a warehouse and distribution unit)', '2025/0103')).toBe(true)
    expect(quotesMajorProposal('Details for condition 7 - Materials of permission 2024/0703', '2024/0703')).toBe(false)
    expect(quotesMajorProposal('Variation of condition 2 of 25/00102/FUL (single storey rear extension)', '25/00102/FUL')).toBe(false)
  })
})
