import { classifyCommercialRelevance } from '../relevance'
import type { PlanningAlertApplication } from '../types'

function application(
  applicationType: string,
  description: string,
  address = 'Test site, Barnsley'
): PlanningAlertApplication {
  return {
    id: description,
    reference: '2026/0001',
    address,
    postcode: 'S70 1AA',
    description,
    status: 'Validated',
    applicationType,
    authorityName: 'Barnsley',
    dateReceived: '2026-06-10',
    lat: 53.55,
    lng: -1.48,
    sourceUrl: null,
    nearestStore: null,
  }
}

describe('classifyCommercialRelevance', () => {
  it('marks major housing and commercial changes of use as priority', () => {
    expect(classifyCommercialRelevance(application(
      'full_planning',
      'Residential development of 114no. dwellings and associated works.'
    ))).toMatchObject({ level: 'priority' })

    expect(classifyCommercialRelevance(application(
      'change_of_use',
      'Change of use from retail shop to a bar.'
    ))).toEqual({ level: 'priority', reason: 'Commercial or institutional change of use' })
  })

  it('keeps progress on a major scheme on the watchlist instead of duplicating the headline', () => {
    expect(classifyCommercialRelevance(application(
      'discharge_conditions',
      'Discharge of drainage conditions for residential development of 114no. dwellings.'
    ))).toEqual({ level: 'watchlist', reason: 'Progress update for a significant scheme' })
  })

  it('marks smaller residential development as watchlist', () => {
    expect(classifyCommercialRelevance(application(
      'full_planning',
      'Erection of 3 dwellings with associated parking.'
    ))).toEqual({ level: 'watchlist', reason: 'Smaller residential development' })
  })

  it.each([
    ['householder', 'Two storey side extension to dwelling'],
    ['tree_works', 'Crown reduce one Ash tree'],
    ['advertisement', 'Replacement fascia signage'],
  ])('marks %s applications as low relevance', (applicationType, description) => {
    expect(classifyCommercialRelevance(application(applicationType, description)).level).toBe('low')
  })
})
