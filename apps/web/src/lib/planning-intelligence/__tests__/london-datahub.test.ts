/** @jest-environment node */
import { findingsFromDescription, resolveFindings, type FactFinding, type FactKey } from '../facts'
import {
  datahubUseClass, candidateFindingsFromDatahub as findingsFromDatahub, findingsFromDatahub as reviewEvidence, lookupDatahubApplication, type DatahubApplication, type DatahubFloorspaceRow,
} from '../london-datahub'
import fixture from './fixtures/london-datahub-2026-09-14.json'

const records = fixture.records as unknown as Record<string, DatahubApplication>
const AT = '2026-09-14T00:00:00Z'

function facts(id: string) {
  const record = records[id]
  const described = findingsFromDescription(record.description, { councilUrl: null, at: AT })
  return findingsFromDatahub(record, AT, {
    text: record.description,
    existing: described.existing_use_class.map(f => f.useClass!),
    proposed: described.proposed_use_class.map(f => f.useClass!),
  })
}
const completing = (findings: FactFinding[]) => findings.filter(f => f.completes)
const state = (all: Record<FactKey, FactFinding[]>, fact: FactKey) => resolveFindings(fact, all[fact])

describe('London Datahub use classes', () => {
  it.each([
    ['EA', 'E(a)'], ['EB', 'E(b)'], ['EC1', 'E(c)(i)'], ['EC3', 'E(c)(iii)'], ['ED', 'E(d)'],
    ['EF', 'E(f)'], ['EG1', 'E(g)(i)'], ['EG3', 'E(g)(iii)'], ['E(g)(i)', 'E(g)(i)'], ['E', 'E'],
    ['SG', 'Sui Generis'], ['B1a', 'B1(a)'], ['c3', 'C3'], ['C2A', 'C2a'], ['F2', 'F2'],
  ])('reads %s as %s', (code, expected) => {
    expect(datahubUseClass(code)).toBe(expected)
  })

  it.each(['SpecifiedOther', 'Other', '', 'FloorAreaUseClasses', 'ED1', 'E (a) (b) (c)'])('does not read %p as a class', code => {
    expect(datahubUseClass(code)).toBeNull()
  })
})

describe('findings from a London Datahub record', () => {
  it('uses the per-class rows when the non-residential totals are zero (Camden gym)', () => {
    const all = facts('Camden-2026_3418_P')
    expect(state(all, 'existing_use_class')?.value).toEqual({ useClasses: ['E(b)'] })
    expect(state(all, 'proposed_use_class')?.value).toEqual({ useClasses: ['E(d)'] })
    expect(state(all, 'existing_floorspace')?.value).toEqual(expect.objectContaining({ sqm: 516.82, basis: 'gross_internal' }))
    expect(state(all, 'proposed_floorspace')?.value).toEqual(expect.objectContaining({ sqm: 516.82 }))
    expect(state(all, 'net_floorspace')?.value).toEqual(expect.objectContaining({ sqm: 0 }))
    expect(state(all, 'site_area')?.value).toEqual(expect.objectContaining({ sqm: 516.82, original: { value: 0.051682, unit: 'hectares' } }))
    expect(all.net_floorspace[0].source).toEqual(expect.objectContaining({
      kind: 'dataset', url: 'https://planningdata.london.gov.uk/api-guest/applications/_source/Camden-2026_3418_P',
    }))
  })

  it('does not complete anything from existing areas that record no change (Hounslow flat to office)', () => {
    const all = facts('Hounslow-P_2026_2133')
    expect(completing(all.existing_use_class)).toEqual([])
    expect(completing(all.existing_floorspace)).toEqual([])
    expect(all.existing_floorspace[0].note).toContain('no gain or loss')
  })

  it('treats a zero existing area beside a loss as not supplied (Wandsworth 2019/4915)', () => {
    const all = facts('Wandsworth-2019_4915')
    expect(all.existing_floorspace).toEqual([])
    expect(all.proposed_floorspace).toEqual([])
    expect(state(all, 'net_floorspace')?.value).toEqual(expect.objectContaining({ sqm: 18 }))
  })

  it('never adds up one space listed under alternative uses, and rejects a site area in square metres (Wandsworth 2022/2709)', () => {
    const all = facts('Wandsworth-2022_2709')
    expect(completing(all.net_floorspace)).toEqual([])
    expect(all.net_floorspace[0].note).toContain('alternative uses')
    expect(completing(all.site_area).map(f => f.sqm)).toEqual([3436])
    expect(all.site_area.find(f => !f.completes)?.note).toContain('square metres')
  })

  it('holds back figures whose classes contradict the description (Hillingdon EC3 for new homes)', () => {
    const all = facts('Hillingdon-16483_APP_2026_1751')
    expect(completing(all.proposed_floorspace)).toEqual([])
    const described = findingsFromDescription(records['Hillingdon-16483_APP_2026_1751'].description, { councilUrl: null, at: AT })
    expect(resolveFindings('proposed_use_class', [...described.proposed_use_class, ...all.proposed_use_class])?.state).toBe('conflicting')
  })

  it('counts only commercial rows and does not treat the wider non-residential total as a rival figure (Wandsworth 2026/2930)', () => {
    const all = facts('Wandsworth-2026_2930')
    expect(state(all, 'existing_floorspace')?.value).toEqual(expect.objectContaining({ sqm: 194.89 }))
    expect(state(all, 'net_floorspace')?.value).toEqual(expect.objectContaining({ sqm: -149.89 }))
    expect(state(all, 'proposed_floorspace')?.value).toEqual(expect.objectContaining({ sqm: 45 }))
    expect(all.net_floorspace.some(f => !f.completes && f.source.page === 'application_details.non_residential_details')).toBe(true)
  })

  it('leaves residential institutions and unrecognised classes out of commercial floor area', () => {
    expect(completing(facts('Wandsworth-2025_3651').proposed_floorspace)).toEqual([])
    const other = facts('Camden-2026_3272_P')
    expect(completing(other.net_floorspace)).toEqual([])
    expect(other.net_floorspace[0].note).toContain('Unrecognised use class')
  })

  it('never completes a fact from a condition or amendment record', () => {
    const record: DatahubApplication = {
      ...records['Camden-2026_3418_P'],
      application_type_full: 'Approval of details reserved by a condition (discharge)',
    }
    const all = findingsFromDatahub(record, AT)
    for (const findings of Object.values(all)) expect(completing(findings)).toEqual([])
    expect(all.net_floorspace[0].note).toContain('parent scheme')
  })

  // Live records from the 14 September spot check, trimmed to the fields the adapter reads.
  const live = (id: string, description: string, rows: DatahubFloorspaceRow[]) => {
    const record: DatahubApplication = { id, lpa_name: id.split('-')[0], lpa_app_no: id, description, application_type_full: 'Full planning permission', application_details: { existing_proposed_floorspace_details: rows } }
    const described = findingsFromDescription(description, { councilUrl: null, at: AT })
    return findingsFromDatahub(record, AT, {
      text: description, existing: described.existing_use_class.map(f => f.useClass!), proposed: described.proposed_use_class.map(f => f.useClass!),
    })
  }

  it('does not trust an area recorded as both lost and gained in one class (Lambeth 26/01884/FUL)', () => {
    const all = live('Lambeth-26_01884_FUL', 'Conversion of the existing Class E(f) Nursery into two residential dwellings (Class C3)',
      [{ gia_existing: 203, gia_gained: 203, use_class: 'EF', gia_lost: 203 }])
    expect(completing(all.proposed_use_class)).toEqual([])
    expect(completing(all.proposed_floorspace)).toEqual([])
    expect(completing(all.net_floorspace)).toEqual([])
  })

  it('holds back proposed and net areas when a changed use records no loss (Waltham Forest 261642)', () => {
    const all = live('Waltham_Forest-261642', 'Change of use of the ground floor unit from an education centre (Use Class F1) into a self-contained residential flat (Use Class C3)',
      [{ gia_existing: 73, gia_gained: 0, use_class: 'F1', gia_lost: 0 }, { gia_existing: 0, gia_gained: 73, use_class: 'C3', gia_lost: 0 }])
    expect(state(all, 'existing_floorspace')?.value).toEqual(expect.objectContaining({ sqm: 73 }))
    expect(completing(all.proposed_floorspace)).toEqual([])
    expect(completing(all.net_floorspace)).toEqual([])
  })

  it('does not report a commercial total that leaves out a Sui Generis betting shop (Richmond PA26/1630)', () => {
    const all = live('Richmond-PA26_1630', 'Change of use from a Betting Shop (Sui Generis) to a Restaurant (Class E)',
      [{ gia_existing: 230, gia_gained: 0, use_class: 'SG', gia_lost: 230 }, { gia_existing: 0, gia_gained: 230, use_class: 'EB', gia_lost: 0 }])
    expect(state(all, 'proposed_use_class')?.value).toEqual({ useClasses: ['E(b)'] })
    for (const fact of ['existing_floorspace', 'proposed_floorspace', 'net_floorspace'] as const) {
      expect(completing(all[fact])).toEqual([])
    }
  })

  it('does not trust a gain equal to all the existing commercial space (Redbridge 1397/26)', () => {
    const all = live('Redbridge-1397_26', 'Merge two ground floor units into a restaurant with associated internal alterations',
      [{ gia_existing: 61.4, use_class: 'EB', gia_gained: 116.5, gia_lost: 0 }, { gia_existing: 55.1, use_class: 'EA', gia_gained: 0, gia_lost: 55.1 }])
    expect(completing(all.proposed_floorspace)).toEqual([])
    expect(completing(all.net_floorspace)).toEqual([])
  })

  it('does not take an existing class from a row recorded as lost and regained (Islington P2026/1577/FUL)', () => {
    const all = live('Islington-P2026_1577_FUL', 'Change of use of single storey building from a community hall (Use Class F1(e)) to an office (Use Class E(g))',
      [{ gia_existing: 208, gia_gained: 208, use_class: 'EG1', gia_lost: 208 }])
    expect(completing(all.existing_use_class)).toEqual([])
  })

  it('treats a -1 existing area as not supplied', () => {
    const record: DatahubApplication = {
      id: 'Test-1', lpa_name: 'Test', lpa_app_no: '1',
      application_details: { existing_proposed_floorspace_details: [{ use_class: 'EG1', gia_existing: -1, gia_gained: 200, gia_lost: 0 }] },
    }
    const all = findingsFromDatahub(record, AT)
    expect(all.existing_floorspace).toEqual([])
    expect(state(all, 'net_floorspace')?.value).toEqual(expect.objectContaining({ sqm: 200 }))
  })
})

describe('London Datahub lookup', () => {
  const response = (hits: Partial<DatahubApplication>[]) => ({
    ok: true, status: 200, json: async () => ({ hits: { hits: hits.map(_source => ({ _source })) } }),
  })

  it('pins the search to the borough and returns only an exact reference match', async () => {
    const fetcher = jest.fn().mockResolvedValue(response([
      { id: 'Lambeth-26_00811_FULL', lpa_name: 'Lambeth', lpa_app_no: '26/00811/FULL' },
      { id: 'Lambeth-26_00811_FUL', lpa_name: 'Lambeth', lpa_app_no: '26/00811/FUL' },
      { id: 'Westminster-26_00811_FUL', lpa_name: 'Westminster', lpa_app_no: '26/00811/FUL' },
    ]))
    const record = await lookupDatahubApplication({ authoritySlug: 'lambeth', reference: '26/00811/FUL' }, fetcher as unknown as typeof fetch)
    expect(record?.id).toBe('Lambeth-26_00811_FUL')
    const body = JSON.parse(fetcher.mock.calls[0][1].body)
    expect(body.query.bool.filter).toEqual([{ term: { 'lpa_name.raw': 'Lambeth' } }])
    expect(fetcher.mock.calls[0][1].headers['X-API-AllowRequest']).toBeTruthy()
  })

  it('makes no request outside London', async () => {
    const fetcher = jest.fn()
    expect(await lookupDatahubApplication({ authoritySlug: 'crawley', reference: 'CR/2026/0173/FUL' }, fetcher as unknown as typeof fetch)).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })
})


describe('Datahub publication gate', () => {
  it('keeps even plausible figures as review evidence, without completing any public fact', () => {
    const all = reviewEvidence(records['Camden-2026_3418_P'], AT)
    expect(all.proposed_floorspace[0].sqm).toBe(516.82)
    expect(all.proposed_floorspace[0].source.kind).toBe('dataset')
    for (const [fact, findings] of Object.entries(all)) {
      expect(findings.every(f => !f.completes)).toBe(true)
      expect(resolveFindings(fact as FactKey, findings)).toBeNull()
    }
  })
})
