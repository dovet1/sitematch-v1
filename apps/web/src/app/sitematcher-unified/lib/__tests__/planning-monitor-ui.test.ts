import { defaultCriteria } from '@/lib/planning-monitor/criteria'
import type { MonitorRow } from '@/lib/planning-monitor/types'
import { countsLabel, criteriaChips, locationNote, markerKind, placePopover, rowTitle, toPlanningApplication, typeLabelFor } from '../planning-monitor-ui'

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

  it('keeps both type labels on a mixed-use scheme', () => {
    const mixed = row({ isCommercial: true, dwellings: 20 })
    expect(markerKind(mixed)).toBe('mixed')
    expect(typeLabelFor(mixed)).toBe('Residential · 20 homes + Commercial')
  })

  it('never states a home count that is unknown', () => {
    expect(rowTitle(row({ dwellings: null, isResidential: false, isCommercial: true }))).toBe('Kirkstall Forge')
  })

  it('describes approximate locations in words', () => {
    expect(locationNote(row())).toBeNull()
    expect(locationNote(row({ locationProvenance: 'source_centroid', inside: false }))).toMatch(/may be in this area/)
  })

  it('shows only launch chips, with the 15-home default', () => {
    const chips = criteriaChips({ criteria: defaultCriteria(), patchLabel: 'Leeds patch (drawn)', brands: [] })
    expect(chips.map((c) => c.label)).toEqual(['Leeds patch (drawn)', 'Residential ≥15 homes', 'Commercial', 'Last 30 days'])
  })

  it('maps a row to the detail modal without applicant or agent details', () => {
    const app = toPlanningApplication(row())
    expect(app).toMatchObject({ name: 'Leeds/26/1', nDwellings: 320, applicantAddress: null, agentAddress: null, url: 'https://council.example' })
  })
})
