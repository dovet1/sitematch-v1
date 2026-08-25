import { classifyPlanningApplications } from './classify'
import { previousCalendarMonth, type MonthlyPeriod } from './period'
import type {
  PlanningAlertApplication,
  PlanningAlertBoundary,
  PlanningAlertDigest,
  PlanningAlertStore,
} from './types'

export const DEMO_PATCH: PlanningAlertBoundary = {
  type: 'Polygon',
  coordinates: [[
    [-2.52, 53.30],
    [-1.93, 53.30],
    [-1.93, 53.64],
    [-2.52, 53.64],
    [-2.52, 53.30],
  ]],
}

export const DEMO_STORES: PlanningAlertStore[] = [
  { id: 'store-1', name: 'Manchester Arndale', town: 'Manchester', postcode: 'M4 3AQ', lat: 53.4848, lng: -2.2416 },
  { id: 'store-2', name: 'Trafford Centre', town: 'Trafford', postcode: 'M17 8AA', lat: 53.4659, lng: -2.3489 },
  { id: 'store-3', name: 'Stockport', town: 'Stockport', postcode: 'SK1 1PD', lat: 53.4106, lng: -2.1575 },
  { id: 'store-4', name: 'Bury', town: 'Bury', postcode: 'BL9 0QQ', lat: 53.5932, lng: -2.2971 },
]

function dateInPeriod(period: MonthlyPeriod, day: number): string {
  return `${period.start.slice(0, 8)}${String(day).padStart(2, '0')}`
}

function application(
  period: MonthlyPeriod,
  values: Omit<PlanningAlertApplication, 'dateReceived' | 'nearestStore'> & { day: number }
): PlanningAlertApplication {
  const { day, ...rest } = values
  return { ...rest, dateReceived: dateInPeriod(period, day), nearestStore: null }
}

export function createDemoDigest(
  period = previousCalendarMonth(),
  overrides: Partial<Pick<PlanningAlertDigest, 'subscriptionId' | 'recipient' | 'brand'>> = {}
): PlanningAlertDigest {
  const applications: PlanningAlertApplication[] = [
    application(period, {
      id: 'pn-demo-1', reference: '139421/FO/2026', day: 26,
      address: '12–18 High Street, Manchester M4 1AZ', postcode: 'M4 1AZ',
      description: 'Change of use and refurbishment of the ground floor to create two flexible retail units, with new shopfronts and public realm works.',
      status: 'Validated', applicationType: 'Full', authorityName: 'Manchester City Council',
      lat: 53.4823, lng: -2.2378, sourceUrl: 'https://plannexus.io/',
    }),
    application(period, {
      id: 'pn-demo-2', reference: '114203/FO/2026', day: 21,
      address: 'Unit 4, Trafford Retail Park, Neary Way M41 7FN', postcode: 'M41 7FN',
      description: 'Demolition of the existing unit and development of a 2,150 sq m food store with associated parking, landscaping and servicing.',
      status: 'Consultation', applicationType: 'Full', authorityName: 'Trafford Council',
      lat: 53.4691, lng: -2.3542, sourceUrl: 'https://plannexus.io/',
    }),
    application(period, {
      id: 'pn-demo-3', reference: 'DC/097421', day: 17,
      address: 'Mersey Square, Stockport SK1 1SP', postcode: 'SK1 1SP',
      description: 'Mixed-use redevelopment comprising flexible commercial space at ground floor and 68 apartments above.',
      status: 'Validated', applicationType: 'Outline', authorityName: 'Stockport Council',
      lat: 53.4102, lng: -2.1598, sourceUrl: 'https://plannexus.io/',
    }),
    application(period, {
      id: 'pn-demo-4', reference: '71204/FUL/26', day: 12,
      address: 'The Rock, Bury BL9 0ND', postcode: 'BL9 0ND',
      description: 'Installation of a new restaurant extract system, external plant and associated alterations to the rear service elevation.',
      status: 'Validated', applicationType: 'Full', authorityName: 'Bury Council',
      lat: 53.5918, lng: -2.2952, sourceUrl: 'https://plannexus.io/',
    }),
    application(period, {
      id: 'pn-demo-5', reference: '25/01874/FUL', day: 23,
      address: 'Former Mill Site, Oldham Road, Failsworth M35 0FH', postcode: 'M35 0FH',
      description: 'Redevelopment of the former mill site for a neighbourhood retail scheme, workspace and 142 homes.',
      status: 'Validated', applicationType: 'Full', authorityName: 'Oldham Council',
      lat: 53.5109, lng: -2.1601, sourceUrl: 'https://plannexus.io/',
    }),
    application(period, {
      id: 'pn-demo-6', reference: '2026/00642/FUL', day: 9,
      address: 'Bolton Road, Walkden M28 3ZH', postcode: 'M28 3ZH',
      description: 'Construction of three commercial units for retail, leisure and food-and-beverage uses with new access and parking.',
      status: 'Consultation', applicationType: 'Full', authorityName: 'Salford City Council',
      lat: 53.5227, lng: -2.3953, sourceUrl: 'https://plannexus.io/',
    }),
    application(period, {
      id: 'pn-demo-7', reference: '2026/00198/OUT', day: 4,
      address: 'Land east of Ashton Road, Droylsden M43 6QU', postcode: 'M43 6QU',
      description: 'Outline application for employment floorspace with ancillary café and convenience retail provision.',
      status: 'Validated', applicationType: 'Outline', authorityName: 'Tameside Council',
      lat: 53.4812, lng: -2.1306, sourceUrl: 'https://plannexus.io/',
    }),
    // Deliberately outside the patch and every store radius; should not appear.
    application(period, {
      id: 'pn-demo-8', reference: 'OUTSIDE/001', day: 2,
      address: 'Chester Road, Northwich CW8 1BE', postcode: 'CW8 1BE',
      description: 'Commercial development outside the configured alert area.',
      status: 'Validated', applicationType: 'Full', authorityName: 'Cheshire West and Chester',
      lat: 53.257, lng: -2.516, sourceUrl: 'https://plannexus.io/',
    }),
  ]

  const classified = classifyPlanningApplications(applications, DEMO_STORES, DEMO_PATCH)

  return {
    subscriptionId: overrides.subscriptionId ?? 'demo',
    recipient: overrides.recipient ?? { name: 'Alex Morgan', email: 'alex@example.com' },
    brand: overrides.brand ?? { id: 'demo-brand', name: 'Northstar Coffee', logoUrl: null },
    period,
    patch: { name: 'Greater Manchester growth patch', geometry: DEMO_PATCH },
    radiusKm: 5,
    stores: DEMO_STORES,
    nearStoreApplications: classified.nearStore,
    patchApplications: classified.inPatch,
    generatedAt: new Date().toISOString(),
    provider: 'mock',
    summary: null,
  }
}
