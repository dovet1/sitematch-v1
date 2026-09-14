import { linkStoredApplications, referenceKeys, type StoredApplication } from '../link-ingest'

type Call = { table: string; op: string; payload?: unknown; filters: Array<[string, string, unknown]>; options?: unknown }

/**
 * A query builder stand-in that answers selects from an in-memory table, so the test exercises
 * the real lookups (by council, normalised reference and case number) rather than canned results.
 */
function makeDb(tables: Record<string, Array<Record<string, unknown>>>) {
  const calls: Call[] = []
  const rpcs: Array<{ name: string; args: { p_rows: Array<Record<string, unknown>> } }> = []
  class Builder implements PromiseLike<{ data: unknown; error: null }> {
    private call: Call
    constructor(table: string) { this.call = { table, op: 'select', filters: [] }; calls.push(this.call) }
    select() { return this }
    upsert(payload: unknown, options?: unknown) { Object.assign(this.call, { op: 'upsert', payload, options }); return this }
    eq(column: string, value: unknown) { this.call.filters.push(['eq', column, value]); return this }
    in(column: string, values: unknown[]) { this.call.filters.push(['in', column, values]); return this }
    then<A, B>(done?: ((value: { data: unknown; error: null }) => A | PromiseLike<A>) | null, fail?: ((reason: unknown) => B | PromiseLike<B>) | null) {
      const rows = this.call.op === 'select'
        ? (tables[this.call.table] ?? []).filter(row => this.call.filters.every(([op, column, value]) =>
          op === 'eq' ? row[column] === value : (value as unknown[]).includes(row[column])))
        : null
      return Promise.resolve({ data: rows, error: null as null }).then(done, fail)
    }
  }
  const db = {
    from: (table: string) => new Builder(table),
    rpc: (name: string, args: { p_rows: Array<Record<string, unknown>> }) => { rpcs.push({ name, args }); return Promise.resolve({ data: args.p_rows.length, error: null }) },
  }
  return { db: db as never, calls, rpcs }
}

const profile = (slug: string) => ({ authority_slug: slug, reference_shapes: ['9999/9999'], reusing_suffix_families: [] })

function stored(id: string, reference: string, description: string, extra: Partial<StoredApplication> = {}) {
  return { id, authority_slug: 'south-norfolk-broadland', reference, description, procedure: null, ...referenceKeys(reference), ...extra }
}

const linkWrites = (calls: Call[]) => calls.filter(call => call.table === 'planning_application_links' && call.op === 'upsert')
  .flatMap(call => call.payload as Array<Record<string, unknown>>)

describe('linkStoredApplications', () => {
  it('links a new follow-on to a permission already stored', async () => {
    const parent = stored('p1', '2026/0443', 'Alterations including removal of existing dormer extensions')
    const { db, calls, rpcs } = makeDb({
      planning_council_link_profiles: [profile('south-norfolk-broadland')],
      planning_applications: [parent],
    })
    const child = stored('c1', '2026/2482', 'Details of external materials pursuant to condition 4 of planning permission ref. 2026/0443')

    const result = await linkStoredApplications(db, [child])

    expect(linkWrites(calls)).toEqual([expect.objectContaining({
      child_application_id: 'c1', parent_application_id: 'p1', parent_key: '2026/0443', kind: 'condition', strength: 'strong',
    })])
    expect(result).toMatchObject({ links: 1, strongLinks: 1, resolvedToStoredParent: 1, lookupsRequested: 0 })
    expect(rpcs.some(call => call.name === 'planning_request_family_lookups')).toBe(false)
  })

  it('requests one lookup for a missing parent however many follow-ons cite it, like Broadland Business Park', async () => {
    const { db, calls, rpcs } = makeDb({ planning_council_link_profiles: [profile('south-norfolk-broadland')], planning_applications: [] })
    const followOns = [
      stored('c1', '2026/0994', 'Details for condition 9 - Travel Plan of permission 2024/3141'),
      stored('c2', '2026/2156', 'Details for condition 24 of 2024/3141 - (24) Site Layout Fire Hydrant Locations'),
    ]

    const result = await linkStoredApplications(db, followOns)

    expect(linkWrites(calls).map(row => [row.child_application_id, row.parent_application_id, row.parent_key]))
      .toEqual([['c1', null, '2024/3141'], ['c2', null, '2024/3141']])
    const requests = rpcs.filter(call => call.name === 'planning_request_family_lookups').flatMap(call => call.args.p_rows)
    expect(requests).toEqual([{ authority_slug: 'south-norfolk-broadland', parent_key: '2024/3141', parent_reference: '2024/3141' }])
    expect(result.lookupsRequested).toBe(1)
  })

  it('never overwrites existing evidence, so a removed link is not recreated', async () => {
    const { db, calls } = makeDb({ planning_council_link_profiles: [profile('south-norfolk-broadland')], planning_applications: [] })
    await linkStoredApplications(db, [stored('c1', '2026/0994', 'Details for condition 9 - Travel Plan of permission 2024/3141')])
    expect(calls.find(call => call.table === 'planning_application_links')?.options)
      .toEqual({ onConflict: 'child_application_id,parent_key,source', ignoreDuplicates: true })
  })

  it('offers every stored application as a parent for earlier follow-ons, by case number only if it can head a family', async () => {
    const { db, rpcs } = makeDb({ planning_council_link_profiles: [profile('glasgow')], planning_applications: [] })
    await linkStoredApplications(db, [
      stored('p1', '25/02808/FUL', 'Erection of student accommodation', { authority_slug: 'glasgow' }),
      stored('c1', '25/02808/DOC01', 'Discharge of condition 3', { authority_slug: 'glasgow', procedure: 'discharge' }),
    ])
    expect(rpcs.find(call => call.name === 'planning_resolve_family_parents')?.args.p_rows).toEqual([
      { id: 'p1', authority_slug: 'glasgow', reference_normalised: '25/02808/FUL', reference_core: '25/02808' },
      { id: 'c1', authority_slug: 'glasgow', reference_normalised: '25/02808/DOC01', reference_core: null },
    ])
  })

  it('does not guess at a council without a profile', async () => {
    const { db, calls } = makeDb({ planning_council_link_profiles: [], planning_applications: [] })
    const result = await linkStoredApplications(db, [stored('c1', '2026/0994', 'Details for condition 9 of permission 2024/3141')])
    expect(linkWrites(calls)).toEqual([])
    expect(result.unprofiledCouncils).toEqual(['south-norfolk-broadland'])
  })
})
