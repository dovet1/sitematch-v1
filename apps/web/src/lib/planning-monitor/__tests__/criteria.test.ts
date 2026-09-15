import {
  CAPABILITIES,
  buildPredicate,
  defaultCriteria,
  likePattern,
  parseCriteria,
  resolveDateWindow,
  type MonitorCriteria,
} from '../criteria'
import { criteriaHash } from '../hash'

function withChanges(change: (c: MonitorCriteria) => void): MonitorCriteria {
  const criteria = defaultCriteria()
  change(criteria)
  return criteria
}

describe('parseCriteria', () => {
  it('accepts the launch defaults', () => {
    const result = parseCriteria(defaultCriteria())
    expect(result.ok).toBe(true)
  })

  it('never lets the residential threshold fall below 15 homes', () => {
    const result = parseCriteria(withChanges((c) => { c.residential.minDwellings = 14 }))
    expect(result).toMatchObject({ ok: false })
  })

  it('allows the threshold to rise', () => {
    const result = parseCriteria(withChanges((c) => { c.residential.minDwellings = 50 }))
    expect(result.ok && result.criteria.residential.minDwellings).toBe(50)
  })

  it('requires at least one branch', () => {
    const result = parseCriteria(withChanges((c) => { c.residential.enabled = false; c.commercial.enabled = false }))
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('residential, commercial, or both') })
  })

  it('rejects a follow-on filter that is not yet enabled rather than ignoring it', () => {
    const result = parseCriteria({ ...defaultCriteria(), siteArea: { minM2: 1000 } })
    expect(result).toMatchObject({ ok: false, unavailable: ['siteArea'] })
  })

  it('rejects unknown keys', () => {
    expect(parseCriteria({ ...defaultCriteria(), brandWatch: ['Aldi'] }).ok).toBe(false)
  })

  it('rejects an inverted custom range', () => {
    const result = parseCriteria(withChanges((c) => { c.dates = { field: 'received', preset: 'custom', from: '2026-09-10', to: '2026-09-01' } }))
    expect(result.ok).toBe(false)
  })

  it('normalises list order, case and full selections so equal intent hashes equally', () => {
    const a = parseCriteria(withChanges((c) => {
      c.stages = ['pending', 'approved']
      c.keywords.include = ['Foodstore', ' drive-thru ']
      c.commercial.work = ['new', 'extension', 'to-commercial', 'between', 'loss']
    }))
    const b = parseCriteria(withChanges((c) => {
      c.stages = ['approved', 'pending', 'approved']
      c.keywords.include = ['drive-thru', 'foodstore']
    }))
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.criteria.commercial.work).toEqual([])
    expect(criteriaHash(a.criteria)).toBe(criteriaHash(b.criteria))
  })

  it('changes the hash when the capability version changes', () => {
    const criteria = defaultCriteria()
    expect(criteriaHash(criteria)).not.toBe(criteriaHash(criteria, { ...CAPABILITIES, version: CAPABILITIES.version + 1 }))
  })

  it('drops custom dates when a preset is chosen', () => {
    const result = parseCriteria(withChanges((c) => { c.dates = { field: 'received', preset: '7d', from: '2026-01-01', to: null } }))
    expect(result.ok && result.criteria.dates.from).toBeNull()
  })
})

describe('resolveDateWindow', () => {
  it.each([
    ['7d', { from: '2026-09-08', to: null }],
    ['30d', { from: '2026-08-16', to: null }],
    ['this_year', { from: '2026-01-01', to: null }],
    ['all', { from: null, to: null }],
  ] as const)('%s', (preset, expected) => {
    expect(resolveDateWindow({ field: 'received', preset, from: null, to: null }, '2026-09-15')).toEqual(expected)
  })
})

describe('buildPredicate', () => {
  it('keeps an unset optional filter as no restriction', () => {
    const predicate = buildPredicate(defaultCriteria(), { boundary: null, today: '2026-09-15' })
    expect(predicate).toMatchObject({
      residential: true,
      min_dwellings: 15,
      commercial: true,
      commercial_work: null,
      stages: null,
      procedures: null,
      brand_ids: null,
      include: null,
      watched_application_ids: null,
      date_from: '2026-08-16',
    })
  })

  it('matches nothing when watched-only is on and nothing is watched', () => {
    const predicate = buildPredicate(withChanges((c) => { c.watchedOnly = true }), { boundary: null })
    expect(predicate.watched_application_ids).toEqual([])
  })

  it('expands procedures to the provider values', () => {
    const predicate = buildPredicate(withChanges((c) => { c.procedures = ['paperwork'] }), { boundary: null })
    expect(predicate.procedures).toEqual(['discharge', 'amendment'])
  })

  it('can omit the map date window for weekly selection', () => {
    expect(buildPredicate(defaultCriteria(), { boundary: null, applyDates: false }).date_from).toBeNull()
  })
})

it('escapes LIKE wildcards in keywords', () => {
  expect(likePattern('50%_off')).toBe('%50\\%\\_off%')
})
