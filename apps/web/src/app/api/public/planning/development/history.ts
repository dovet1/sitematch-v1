import type { PlanningApplication } from '@/app/sitematcher-unified/types/unified-workspace'

export interface HistoryRow {
  role: string
  planning_applications: {
    provider_id: string
    authority_name: string
    reference: string
    address: string | null
    status: string | null
    stage: string | null
    planning_route: string | null
    procedure: string | null
    commercial_work: string | null
    stated_floorspace_sqm: number | null
    description: string | null
    links: { council?: string | null; plota?: string | null } | null
    date_received: string | null
    date_validated: string | null
    date_decided: string | null
  } | null
}

export const HISTORY_COLUMNS =
  'role,planning_applications(provider_id,authority_name,reference,address,status,stage,planning_route,procedure,commercial_work,stated_floorspace_sqm,description,links,date_received,date_validated,date_decided)'

/**
 * One application in a development's history, in the tab's shape so the same timeline and detail
 * window read it. Only public council-record fields: no applicant or agent details, no classifier
 * figures (those belong to the development and are already on its card), and no position -- a
 * history entry is never drawn on the map, so its coordinates are left at zero.
 */
export function historyApplication(row: HistoryRow, developmentId: string): PlanningApplication | null {
  const a = row.planning_applications
  if (!a) return null
  return {
    name: `${a.authority_name}/${a.reference}`,
    uid: a.provider_id,
    address: a.address ?? '',
    appSize: a.stated_floorspace_sqm == null ? '' : `${a.stated_floorspace_sqm} sqm stated`,
    appState: a.status ?? a.stage ?? '',
    appType: a.planning_route ?? a.procedure ?? a.commercial_work ?? '',
    description: a.description ?? '',
    url: a.links?.council ?? a.links?.plota ?? '',
    lat: 0,
    lng: 0,
    decidedDate: a.date_decided,
    dateValidated: a.date_validated,
    dateReceived: a.date_received,
    nDwellings: null,
    applicantAddress: null,
    agentAddress: null,
    provider: 'plota',
    developmentId,
    developmentRole: row.role,
  }
}
