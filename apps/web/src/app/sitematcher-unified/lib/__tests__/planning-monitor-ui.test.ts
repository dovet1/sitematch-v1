import { defaultCriteria } from '@/lib/planning-monitor/criteria'
import type { MonitorRow } from '@/lib/planning-monitor/types'
import {
  cellBounds,
  clusterCellSize,
  countsLabel,
  crossingEdges,
  developmentsCsv,
  filterChips,
  groupByPosition,
  inCell,
  isNewRow,
  locationNote,
  markerKind,
  placePopover,
  removeFilterChip,
  ringAreaSqMi,
  rowMeta,
  rowTitle,
  stackItemKey,
  stackItemView,
  toCsv,
  toPlanningApplication,
} from '../planning-monitor-ui'

const row = (overrides: Partial<MonitorRow> = {}): MonitorRow => ({
  key: 'k', sortDate: null, applicationId: 'a', developmentId: null, developmentRole: null, familyState: null, matchedApplications: 1,
  providerId: 'p', authorityName: 'Leeds', reference: '26/1', address: 'Kirkstall Forge', description: 'Homes', status: 'Approved',
  stage: 'approved', procedure: 'full', planningRoute: null, commercialWork: null, sourceUrl: 'https://council.example', lng: -1.6, lat: 53.8,
  locationProvenance: 'source_exact', locationUncertaintyM: 0, inside: true, nearConfirmed: null, dwellings: 320, dwellingsReviewed: false,
  isResidential: true, isCommercial: false, dateReceived: '2026-01-01', dateValidated: null, dateDecided: '2026-09-13', watched: false,
  ...overrides,
})

describe('placePopover', () => {
  const size = { width: 320, height: 300 }
  const viewport = { width: 1200, height: 800 }

  it('sits to the right of the marker, never over it', () => {
    const p = placePopover({ anchor: { x: 400, y: 400 }, size, viewport })
    expect(p.side).toBe('right')
    expect(p.left).toBeGreaterThan(400)
  })

  it('flips left at the right edge', () => {
    const p = placePopover({ anchor: { x: 1100, y: 400 }, size, viewport })
    expect(p.side).toBe('left')
    expect(p.left + size.width).toBeLessThan(1100)
  })

  it('stays inside the viewport vertically near the top', () => {
    const p = placePopover({ anchor: { x: 400, y: 20 }, size, viewport })
    expect(p.top).toBeGreaterThanOrEqual(12)
  })

  it('goes above or below on a narrow screen', () => {
    const p = placePopover({ anchor: { x: 180, y: 600 }, size, viewport: { width: 375, height: 812 } })
    expect(['above', 'below']).toContain(p.side)
    expect(p.left).toBeGreaterThanOrEqual(12)
  })
})

describe('labels', () => {
  it('names both counting units', () => {
    expect(countsLabel({ developments: 18, applications: 31 })).toBe('18 developments · 31 applications')
    expect(countsLabel({ developments: 1, applications: 1 })).toBe('1 development · 1 application')
  })

  it('treats a scheme with both uses as mixed', () => {
    expect(markerKind(row({ isCommercial: true, dwellings: 20 }))).toBe('mixed')
  })

  it('never states a home count that is unknown', () => {
    const commercial = row({ dwellings: null, isResidential: false, isCommercial: true, commercialWork: 'between' })
    expect(rowTitle(commercial)).toBe('Kirkstall Forge')
    expect(rowMeta(commercial)).toBe('Change of commercial use · Approved 13 Sep')
    expect(rowMeta(row({ dwellings: null }))).not.toMatch(/dwellings/)
  })

  it('states dwellings and the decision on the meta line', () => {
    expect(rowMeta(row())).toBe('320 dwellings · Approved 13 Sep')
    expect(rowMeta(row({ stage: 'pending', dateDecided: null, dateValidated: '2026-09-12' }))).toBe('320 dwellings · Pending · validated 12 Sep')
  })

  it('describes approximate locations in words', () => {
    expect(locationNote(row())).toBeNull()
    expect(locationNote(row({ locationProvenance: 'postcode_centroid' }))).toBeNull()
    expect(locationNote(row({ locationProvenance: 'source_centroid' }))).toBe('Approximate location (area centre)')
  })

  it('shows only the time frame when nothing narrows the default', () => {
    expect(filterChips(defaultCriteria(), []).map((c) => c.label)).toEqual(['Last 30 days'])
  })

  it('names a single use, a raised floor, work types and a brand radius', () => {
    const criteria = defaultCriteria()
    criteria.commercial.enabled = false
    criteria.residential.minDwellings = 50
    criteria.proximity = { brandIds: ['b1'], radiusMeters: 3219 }
    const chips = filterChips(criteria, [{ id: 'b1', name: 'Aldi' } as never])
    expect(chips.map((c) => c.label)).toEqual(['Last 30 days', 'Residential 50+', '≤2 mi from Aldi'])
    expect(chips.find((c) => c.key === 'residential')?.removable).toBe(true)
  })

  it('flags filters a saved patch still carries but the panel no longer edits', () => {
    const criteria = defaultCriteria()
    criteria.watchedOnly = true
    expect(filterChips(criteria, []).at(-1)?.label).toBe('Also: watched only')
  })

  it('lifting a use chip turns both uses back on at the floor', () => {
    const criteria = defaultCriteria()
    criteria.commercial.enabled = false
    criteria.residential.minDwellings = 80
    const next = removeFilterChip(criteria, 'residential')
    expect(next.residential).toEqual({ enabled: true, minDwellings: 15 })
    expect(next.commercial.enabled).toBe(true)
    expect(criteria.commercial.enabled).toBe(false)
  })

  it('maps a row to the detail modal without applicant or agent details', () => {
    const app = toPlanningApplication(row())
    expect(app).toMatchObject({ name: 'Leeds/26/1', nDwellings: 320, applicantAddress: null, agentAddress: null, url: 'https://council.example' })
  })
})

describe('drawing', () => {
  const square: [number, number][] = [[0, 0], [0, 1], [1, 1], [1, 0]]

  it('accepts a simple shape', () => {
    expect(crossingEdges(square, true)).toEqual([])
  })

  it('flags both edges of a bow tie', () => {
    expect(crossingEdges([[0, 0], [1, 1], [1, 0], [0, 1]], true)).toEqual([0, 2])
  })

  it('ignores the unclosed edge while drawing', () => {
    // A C shape whose closing edge would cross nothing yet stays valid while open.
    expect(crossingEdges([[0, 0], [0, 2], [2, 2], [2, 0], [1, 1]], false)).toEqual([])
  })

  it('measures area in square miles', () => {
    // One degree square at the equator is about 4,775 sq mi.
    expect(ringAreaSqMi(square)).toBeGreaterThan(4700)
    expect(ringAreaSqMi(square)).toBeLessThan(4850)
  })
})

describe('new this week', () => {
  it('counts the last seven days by validation, then receipt', () => {
    expect(isNewRow({ dateValidated: '2026-09-10', dateReceived: '2026-08-01' }, '2026-09-16')).toBe(true)
    expect(isNewRow({ dateValidated: null, dateReceived: '2026-09-08' }, '2026-09-16')).toBe(false)
    expect(isNewRow({ dateValidated: null, dateReceived: null }, '2026-09-16')).toBe(false)
  })
})

describe('csv', () => {
  it('quotes cells and neutralises formulas', () => {
    expect(toCsv([['a"b', '=SUM(A1)', null, 3]])).toBe('"a""b","\'=SUM(A1)","","3"')
  })

  it('downloads only ref, address, description, use, dwellings and status', () => {
    const lines = developmentsCsv([
      row(),
      row({ reference: '26/2', address: 'Retail Park', description: 'Drive-thru', isResidential: false, isCommercial: true, dwellings: 4, stage: 'pending' }),
      { reference: '26/3', address: 'Old report', description: undefined, stage: undefined },
    ]).split('\r\n')
    expect(lines[0]).toBe('"Planning ref","Address","Description","Use","Dwellings","Status"')
    expect(lines[1]).toBe('"26/1","Kirkstall Forge","Homes","Residential","320","Approved"')
    // Dwellings only for residential schemes.
    expect(lines[2]).toMatch(/^"26\/2","Retail Park","Drive-thru","Commercial","",/)
    expect(lines[3]).toBe('"26/3","Old report","","","",""')
  })
})

describe('stacked pins', () => {
  const zoom = 18
  const size = clusterCellSize(zoom)

  it('matches the server cell size', () => {
    // 360 / 2^18 * 64 / 512
    expect(size).toBeCloseTo(0.000171661, 8)
  })

  it('bounds a cell and places points by the floor rule', () => {
    const key = `${Math.floor(-1.6 / size)}:${Math.floor(53.8 / size)}`
    const box = cellBounds(key, zoom)
    expect(box).not.toBeNull()
    const [w, s, e, n] = box as number[]
    expect(w).toBeLessThanOrEqual(-1.6)
    expect(e).toBeGreaterThan(-1.6)
    expect(s).toBeLessThanOrEqual(53.8)
    expect(n).toBeGreaterThan(53.8)
    expect(inCell(-1.6, 53.8, key, zoom)).toBe(true)
    expect(inCell(e, 53.8, key, zoom)).toBe(false)
    expect(cellBounds('h:abc', zoom)).toBeNull()
  })

  it('groups points sharing a position and skips unplaced ones', () => {
    const groups = groupByPosition([
      { id: 1, lng: -1.6, lat: 53.8 },
      { id: 2, lng: -1.6000001, lat: 53.8000001 },
      { id: 3, lng: -1.61, lat: 53.8 },
      { id: 4 },
    ])
    expect(groups.map((g) => g.points.map((p) => p.id))).toEqual([[1, 2], [3]])
  })

  it('keys and describes both kinds of item', () => {
    const r = row({ key: 'dev-1', locationProvenance: 'source_centroid' })
    expect(stackItemKey({ type: 'row', row: r })).toBe('dev-1')
    expect(stackItemView({ type: 'row', row: r })).toMatchObject({ title: 'Kirkstall Forge', description: 'Homes', kind: 'residential', approximate: true })

    const highlight = {
      applicationId: 'a1', developmentId: null, reference: '26/2', authorityName: 'Leeds', address: '', headline: 'Change of use to gym ',
      sourceUrl: null, approximateLocation: false, isCommercial: true, stage: 'pending', dateValidated: '2026-09-12',
    }
    expect(stackItemKey({ type: 'highlight', highlight })).toBe('app:a1')
    expect(stackItemView({ type: 'highlight', highlight })).toMatchObject({
      title: 'Leeds 26/2', description: 'Change of use to gym', kind: 'commercial', approximate: false,
    })
  })
})
