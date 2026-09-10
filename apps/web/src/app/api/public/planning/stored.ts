import type { PlanningApplication } from '@/app/sitematcher-unified/types/unified-workspace'
import { createPlanningAdminClient } from '@/lib/planning-intelligence/db'
import { FRESHNESS_UNAVAILABLE, readPlanningFreshness } from '@/lib/planning-intelligence/freshness'
import type { Boundary, PlanningResult } from './planit'

interface StoredRow {
  id: string
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
  description: string
  links: { council?: string | null; plota?: string | null } | null
  location: { type?: string; coordinates?: unknown } | string | null
  location_provenance: 'source_exact' | 'source_centroid' | 'postcode_centroid' | 'missing'
  date_decided: string | null
  date_validated: string | null
  stated_dwelling_count: number | null
  intelligence_tier: boolean
}

function coordinates(location: StoredRow['location']): [number, number] | null {
  if (!location || typeof location === 'string') return null
  const coords = location.coordinates
  if (!Array.isArray(coords) || coords.length < 2) return null
  const [lng, lat] = coords
  return typeof lng === 'number' && typeof lat === 'number' ? [lng, lat] : null
}

export async function fetchStoredPlanningApplications(boundary: Boundary): Promise<PlanningResult> {
  const db = createPlanningAdminClient()
  // Read freshness alongside the applications, not after them. A caller that has to ask a
  // second time is a caller that can forget to, and then the tab shows stale data as though
  // it were current -- the one failure this path exists to make impossible.
  //
  // A failed status read degrades to "unknown, treat as stale" rather than failing the
  // lookup. Freshness is a caption on the answer; losing the caption should not lose the
  // answer, and the planning tab going dark because an aggregate query broke is a worse
  // outcome than showing applications under an honest warning.
  const freshnessPromise = readPlanningFreshness(db).catch((error: unknown) => {
    console.error('[planning-stored] Freshness read failed', error)
    return FRESHNESS_UNAVAILABLE
  })
  // Supabase's API caps each response at 1,000 rows. Two full pages and a one-row
  // sentinel preserve the Planning tab's existing 2,000-record truncation contract.
  const rows: StoredRow[] = []
  for (const [from, to] of [[0, 999], [1000, 1999], [2000, 2000]] as const) {
    const { data, error } = await db
      .rpc('planning_applications_in_boundary', { p_boundary: boundary, p_since: null })
      .order('date_received', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to)
    if (error) throw error
    rows.push(...((data ?? []) as StoredRow[]))
    if ((data ?? []).length < to - from + 1) break
  }
  const kept = rows.slice(0, 2000)
  const appIds = kept.filter((row) => row.intelligence_tier).map((row) => row.id)
  const developmentByApplication = new Map<string, string>()
  for (let offset = 0; offset < appIds.length; offset += 200) {
    const { data: links, error: linkError } = await db
      .from('development_applications')
      .select('planning_application_id,development_id')
      .in('planning_application_id', appIds.slice(offset, offset + 200))
    if (linkError) throw linkError
    for (const link of links ?? []) {
      developmentByApplication.set(link.planning_application_id as string, link.development_id as string)
    }
  }

  const applications: PlanningApplication[] = []
  for (const row of kept) {
    const point = coordinates(row.location)
    if (!point) continue
    const [lng, lat] = point
    applications.push({
      name: `${row.authority_name}/${row.reference}`,
      uid: row.provider_id,
      address: row.address ?? '',
      appSize: row.stated_floorspace_sqm == null ? '' : `${row.stated_floorspace_sqm} sqm stated`,
      appState: row.status ?? row.stage ?? '',
      appType: row.planning_route ?? row.procedure ?? row.commercial_work ?? '',
      description: row.description,
      url: row.links?.council ?? row.links?.plota ?? '',
      lat,
      lng,
      decidedDate: row.date_decided,
      dateValidated: row.date_validated,
      nDwellings: row.stated_dwelling_count,
      applicantAddress: null,
      agentAddress: null,
      provider: 'plota',
      developmentId: developmentByApplication.get(row.id) ?? null,
      intelligenceTier: row.intelligence_tier,
      locationProvenance: row.location_provenance,
      commercialWork: row.commercial_work,
    })
  }

  return {
    applications,
    total: applications.length,
    truncated: rows.length > 2000,
    truncationReason: rows.length > 2000 ? 'record_cap' : null,
    freshness: await freshnessPromise,
  }
}
