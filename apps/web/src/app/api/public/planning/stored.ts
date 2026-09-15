import type {
  PlanningApplication,
  PlanningTruncationReason,
} from '@/app/sitematcher-unified/types/unified-workspace'
import { createPlanningAdminClient } from '@/lib/planning-intelligence/db'
import {
  FRESHNESS_UNAVAILABLE,
  readPlanningFreshness,
  type PlanningFreshness,
} from '@/lib/planning-intelligence/freshness'
import type { Boundary } from './boundary'

export interface PlanningResult {
  applications: PlanningApplication[]
  total: number
  truncated: boolean
  truncationReason: PlanningTruncationReason
  freshness: PlanningFreshness
}

/** The tab's long-standing contract: rank everything, then show at most this many. */
const RECORD_CAP = 2000

interface StoredRow {
  sort_rank: number
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
  longitude: number | null
  latitude: number | null
  location_provenance: 'source_exact' | 'source_centroid' | 'postcode_centroid' | 'missing'
  location_uncertainty_m: number | null
  inside_boundary: boolean
  date_received: string | null
  date_decided: string | null
  date_validated: string | null
  stated_dwelling_count: number | null
  eligibility_limbs?: string[] | null
  intelligence_tier: boolean
  development_id: string | null
  /** v4 onwards: the application's role in its Development, and that Development's family state. */
  development_role?: string | null
  family_state?: string | null
  relevance: 'high' | 'medium' | 'low' | null
  summary: string | null
  model_dwelling_basis?: string | null
  model_dwelling_count: number | null
  creates_commercial_space: 'yes' | 'no' | 'unclear' | null
}

const COMMERCIAL_WORK = new Set(['new', 'to-commercial', 'between', 'loss'])
const COMMERCIAL_ELIGIBILITY_LIMBS = new Set(['A', 'A-described', 'D', 'D-described'])

/**
 * The public tab is an opportunities view, not the full planning census. Keep schemes that
 * create/change commercial space (including commercial loss), or housing schemes with a
 * confirmed count of at least 15 homes. A human dwelling correction is authoritative,
 * including a correction to unknown; otherwise the provider's stated count wins and the
 * classifier fills the gaps where the provider supplied no count.
 *
 * The database applies this before ranking and the record cap. Repeating it here is a
 * fail-closed guard during a rolling migration and makes the display contract explicit.
 */
function isVisiblePlanningScheme(row: StoredRow): boolean {
  const commercial =
    (row.commercial_work != null && COMMERCIAL_WORK.has(row.commercial_work)) ||
    (row.eligibility_limbs?.some((limb) => COMMERCIAL_ELIGIBILITY_LIMBS.has(limb)) ?? false) ||
    row.creates_commercial_space === 'yes'
  const dwellings = row.model_dwelling_basis === 'human_review'
    ? row.model_dwelling_count
    : row.stated_dwelling_count ?? row.model_dwelling_count

  return commercial || (dwellings != null && dwellings >= 15)
}

const TAB_READ_V4 = 'planning_tab_applications_v4'
const TAB_READ_V3 = 'planning_tab_applications_v3'

function isMissingFunction(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'PGRST202'
}

async function readRanked(
  db: ReturnType<typeof createPlanningAdminClient>,
  name: string,
  boundary: Boundary
): Promise<StoredRow[]> {
  const rows: StoredRow[] = []
  for (const [from, to] of [[0, 999], [1000, 1999], [2000, 2000]] as const) {
    const { data, error } = await db
      .rpc(name, { p_boundary: boundary, p_limit: RECORD_CAP + 1 })
      .order('sort_rank', { ascending: true })
      .range(from, to)
    if (error) throw error
    rows.push(...((data ?? []) as StoredRow[]))
    if ((data ?? []).length < to - from + 1) break
  }
  return rows
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

  // Ranking, the classification join and the record cap all happen in the database. Sorting
  // here instead would sort only what survived the cap, permanently dropping a high-relevance
  // application that never made the newest 2,000.
  //
  // Supabase's API caps each response at 1,000 rows, so this still pages -- but it pages a
  // result that is already ordered, and asks for one row beyond the cap so a truncated answer
  // can say so. `sort_rank` is ordered explicitly: a function's row order stops being a
  // contract once PostgREST wraps a LIMIT and OFFSET around it.
  //
  // v3 returns v2's rows in v2's order but ranks narrow columns first and tests distance only
  // for uncertain points outside the boundary. Measured 14 Sep 2026 on Micro compute: warm
  // reads 0.1-1.0 s against v2's 0.2-5.1 s, identical apart from a few rows on the 1,500 m
  // allowance line (see migration 20261005000000).
  //
  // v4 adds each application's role in its Development and ranks paperwork after every scheme
  // (linking plan, step 5). Until its migration is applied the read falls back to v3, which has the
  // same rows without roles, so deploying this code first cannot break the tab.
  const rows = await readRanked(db, TAB_READ_V4, boundary).catch(async (error: unknown) => {
    if (!isMissingFunction(error)) throw error
    return readRanked(db, TAB_READ_V3, boundary)
  })

  const applications: PlanningApplication[] = []
  for (const row of rows.slice(0, RECORD_CAP)) {
    if (row.longitude == null || row.latitude == null) continue
    if (!isVisiblePlanningScheme(row)) continue
    applications.push({
      name: `${row.authority_name}/${row.reference}`,
      uid: row.provider_id,
      address: row.address ?? '',
      appSize: row.stated_floorspace_sqm == null ? '' : `${row.stated_floorspace_sqm} sqm stated`,
      appState: row.status ?? row.stage ?? '',
      appType: row.planning_route ?? row.procedure ?? row.commercial_work ?? '',
      description: row.description,
      url: row.links?.council ?? row.links?.plota ?? '',
      lat: row.latitude,
      lng: row.longitude,
      decidedDate: row.date_decided,
      dateValidated: row.date_validated,
      nDwellings: row.model_dwelling_basis === 'human_review' ? row.model_dwelling_count : row.stated_dwelling_count,
      dwellingCountReviewed: row.model_dwelling_basis === 'human_review',
      applicantAddress: null,
      agentAddress: null,
      provider: 'plota',
      developmentId: row.development_id,
      developmentRole: row.development_role ?? null,
      familyState: row.family_state ?? null,
      intelligenceTier: row.intelligence_tier,
      locationProvenance: row.location_provenance,
      commercialWork: row.commercial_work,
      locationUncertaintyM: row.location_uncertainty_m,
      insideBoundary: row.inside_boundary,
      relevance: row.relevance,
      summary: row.summary,
      modelDwellingCount: row.model_dwelling_count,
      createsCommercialSpace: row.creates_commercial_space,
    })
  }

  return {
    applications,
    total: applications.length,
    truncated: rows.length > RECORD_CAP,
    truncationReason: rows.length > RECORD_CAP ? 'record_cap' : null,
    freshness: await freshnessPromise,
  }
}
