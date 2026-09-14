/** Planning London Datahub: structured floorspace for London applications whose portals we cannot read.
 *
 * The GLA's Datahub combines borough records with the applicant's own form answers, including
 * gross internal area existing, lost and gained by use class, and site area. It is read by exact
 * borough and reference, as evidence beside research, never as a second national collector.
 *
 * Verified 14 September 2026 against the live guest API and the GLA's public technical schema v2.1:
 * - areas are gross internal, in square metres; site areas are in hectares (schema);
 * - `gia_existing` of -1 means not supplied (156,554 of 366,984 floorspace rows);
 * - post-2020 classes are coded EA…EF, EG1…EG3 alongside written forms such as E(g)(i). The
 *   schema predates Class E and does not list them; the mapping was checked against application
 *   descriptions for every code (a café as EB, a gym as ED, a nursery as EF, offices as EG1);
 * - references repeat across boroughs (26/00811/FUL exists in Lambeth, Westminster and Bexley),
 *   so every lookup is pinned to the borough;
 * - condition discharges and amendments can carry the parent scheme's figures, so they never
 *   complete a fact;
 * - `gia_existing` of 0 beside a loss is also not supplied (Wandsworth 2019/4915: existing 0, lost 351);
 * - flexible permissions list one space under each alternative use (Wandsworth 2022/2709: B8 and
 *   B1(c) each losing 1,100 m²), so those rows are never summed;
 * - site areas are sometimes entered in square metres (the same record: 3,245 beside 0.3436 ha);
 * - codes are sometimes mistyped (Hillingdon 2026/1751 codes new C3 homes as EC3), so figures do
 *   not complete a fact when the description's own classes disagree;
 * - Bromley, Kensington & Chelsea and LLDC had no 2026 applications, and Brent none after May.
 */
import type { FactFinding, FactKey } from './facts'

export const LONDON_DATAHUB_API = 'https://planningdata.london.gov.uk/api-guest'
// The guest key is published in the GLA's API instructions for read-only public access.
const GUEST_HEADER = { 'X-API-AllowRequest': 'be2rmRnt&' }

/** Our authority slugs to the Datahub's `lpa_name`. */
export const DATAHUB_BOROUGHS: Record<string, string> = {
  'barking-and-dagenham': 'Barking & Dagenham', barnet: 'Barnet', bexley: 'Bexley', brent: 'Brent',
  bromley: 'Bromley', camden: 'Camden', 'city-of-london': 'City of London', croydon: 'Croydon',
  ealing: 'Ealing', enfield: 'Enfield', greenwich: 'Greenwich', hackney: 'Hackney',
  'hammersmith-and-fulham': 'Hammersmith & Fulham', haringey: 'Haringey', harrow: 'Harrow',
  havering: 'Havering', hillingdon: 'Hillingdon', hounslow: 'Hounslow', islington: 'Islington',
  'kensington-and-chelsea': 'Kensington & Chelsea', 'kingston-upon-thames': 'Kingston',
  lambeth: 'Lambeth', lewisham: 'Lewisham', merton: 'Merton', newham: 'Newham',
  'old-oak-park-royal': 'OPDC', redbridge: 'Redbridge', 'richmond-upon-thames': 'Richmond',
  southwark: 'Southwark', sutton: 'Sutton', 'tower-hamlets': 'Tower Hamlets',
  'waltham-forest': 'Waltham Forest', wandsworth: 'Wandsworth', westminster: 'Westminster',
}

export interface DatahubFloorspaceRow {
  use_class?: string | null
  gia_existing?: number | null
  gia_gained?: number | null
  gia_lost?: number | null
}

export interface DatahubApplication {
  id: string
  lpa_name: string
  lpa_app_no: string
  description?: string | null
  application_type_full?: string | null
  last_updated?: string | null
  application_details?: {
    existing_proposed_floorspace_details?: DatahubFloorspaceRow[] | null
    site_area?: number | null
    total_gia_existing?: number | null
    total_gia_gained?: number | null
    total_gia_lost?: number | null
    non_residential_details?: {
      site_area?: number | null
      total_non_resi_gross_internal_floor_area_to_be_gained?: number | null
      total_non_resi_gross_internal_floor_area_to_be_lost?: number | null
    } | null
  } | null
}

/** The use class in our written form (E(g)(i), B1(a), Sui Generis), or null when the value is not a class. */
export function datahubUseClass(value: string | null | undefined): string | null {
  const text = (value ?? '').trim()
  const coded = text.toUpperCase().match(/^E([A-G])([1-3])?$/)
  if (coded) {
    const numeral = coded[2] ? `(${['i', 'ii', 'iii'][Number(coded[2]) - 1]})` : ''
    // Only E(c) and E(g) have numbered sub-classes.
    if (coded[2] && !['C', 'G'].includes(coded[1])) return null
    return `E(${coded[1].toLowerCase()})${numeral}`
  }
  if (/^(?:sg|sui generis)$/i.test(text)) return 'Sui Generis'
  const b1 = text.match(/^B1([abc])$/i)
  if (b1) return `B1(${b1[1].toLowerCase()})`
  if (/^(?:[A-D]\d|C2a|F[12]|E)$/i.test(text)) return text.toUpperCase().replace('C2A', 'C2a')
  const written = text.replace(/\s+/g, '').match(/^([EF])(\([a-g]\))?(\((?:i|ii|iii)\))?$/i)
  if (written) return `${written[1].toUpperCase()}${(written[2] ?? '').toLowerCase()}${(written[3] ?? '').toLowerCase()}`
  return null
}

/**
 * Classes whose floor area counts as commercial. Dwellings (C3, C4), care and residential
 * institutions (C2, C2a) and Sui Generis are left out: Sui Generis covers co-living, student
 * housing and HMOs as often as pubs and takeaways, so its area goes to the admin as context.
 */
export function isCommercialClass(useClass: string): boolean {
  return /^(?:A\d|B\d|B1\([abc]\)|C1|D\d|E|E\(|F\d)/.test(useClass)
}

// Section 73 variations change the scheme and keep their figures; these records do not describe a whole scheme.
const PAPERWORK_TYPE = /discharge|non-material|details reserved by a condition|approval of reserved matters|deed of variation|legal agreement/i
const PAPERWORK_DESCRIPTION = /\bpursuant to condition|\bdischarge of condition|\bnon-material amendment/i

function findingKey(fact: FactKey, parts: unknown[]): string {
  return `datahub:${fact}:${JSON.stringify(parts)}`
}

const sameArea = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.max(a, b) * 0.01)

const classKey = (value: string) => value.replace(/^(?:use\s+)?class\s+/i, '').replace(/[\s.]/g, '').toUpperCase()

/** Two classes match at the depth both give: "E" matches E(g)(i), E(g)(i) does not match E(c)(iii). */
function compatible(a: string, b: string): boolean {
  const x = classKey(a)
  const y = classKey(b)
  return Boolean(x && y) && (x.startsWith(y) || y.startsWith(x))
}

/** True when the description states classes and none of them matches the record's. */
function disagrees(described: string[], recorded: string[]): boolean {
  if (described.length === 0 || recorded.length === 0) return false
  return !described.some(x => recorded.some(y => compatible(x, y)))
}

const area = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null

const round = (value: number) => Math.round(value * 100) / 100

/**
 * EXPERIMENTAL candidates for offline evaluation only; never send these directly to the checklist.
 * Findings from one Datahub record. Figures come from the detailed per-class rows; an aggregate
 * that disagrees is attached as its own finding so the checklist marks the fact conflicting, and a
 * zero aggregate beside detailed rows is ignored rather than copied over them.
 */
export function candidateFindingsFromDatahub(
  record: DatahubApplication,
  at: string,
  /** The application description and the classes it states (`findingsFromDescription`). */
  description: { text?: string | null; existing: string[]; proposed: string[] } = { existing: [], proposed: [] }
): Record<FactKey, FactFinding[]> {
  const out = { operator: [], existing_use_class: [], proposed_use_class: [], existing_floorspace: [], proposed_floorspace: [], net_floorspace: [], site_area: [] } as Record<FactKey, FactFinding[]>
  const url = `${LONDON_DATAHUB_API}/applications/_source/${encodeURIComponent(record.id)}`
  const paperwork = PAPERWORK_TYPE.test(record.application_type_full ?? '') || PAPERWORK_DESCRIPTION.test(record.description ?? '')
  const base = (page: string, excerpt: string) => ({
    origin: 'research' as const, confidence: 0.85, runId: null, observedAt: at,
    source: { kind: 'dataset' as const, url, excerpt, page },
  })
  const paperworkNote = 'Condition, amendment or reserved-matters record; its figures may be the parent scheme’s'

  const details = record.application_details ?? {}
  const rows = (details.existing_proposed_floorspace_details ?? []).map((row, index) => ({
    index, raw: row.use_class ?? '', useClass: datahubUseClass(row.use_class),
    existing: area(row.gia_existing), gained: area(row.gia_gained) ?? 0, lost: area(row.gia_lost) ?? 0,
  })).map(row => ({ ...row, existing: row.existing !== null && row.lost > row.existing ? null : row.existing }))
  const recordsChange = rows.some(row => row.gained > 0 || row.lost > 0)
  const rowPath = (index: number) => `application_details.existing_proposed_floorspace_details[${index}]`

  // Applicants often enter an unchanged or converted space as both lost and gained in one class
  // (Lambeth 26/01884/FUL: a nursery becoming homes, recorded as E(f) 203 lost and 203 gained).
  const regained = (row: typeof rows[number]) => row.gained > 0 && sameArea(row.gained, row.lost)

  for (const row of rows) {
    const excerpt = `use_class ${row.raw}; gia_existing ${row.existing ?? 'not supplied'}; gia_lost ${row.lost}; gia_gained ${row.gained}`
    if (!row.useClass) continue
    // Existing rows with no gain or loss anywhere do not say what changes (Hounslow P/2026/2133
    // lists a flat and an office, both "existing", for a flat-to-office conversion).
    if (row.lost > 0 || (row.existing ?? 0) > 0) {
      out.existing_use_class.push({
        ...base(rowPath(row.index), excerpt), key: findingKey('existing_use_class', [row.useClass]),
        completes: recordsChange && !paperwork && !regained(row), useClass: row.useClass,
        note: paperwork ? paperworkNote : !recordsChange ? 'Existing area listed, but the record states no gain or loss'
          : regained(row) ? 'The same area is recorded as lost and gained in this class' : undefined,
      })
    }
    if (row.gained > 0) {
      out.proposed_use_class.push({
        ...base(rowPath(row.index), excerpt), key: findingKey('proposed_use_class', [row.useClass]),
        completes: !paperwork && !regained(row), useClass: row.useClass,
        note: paperwork ? paperworkNote : regained(row) ? 'The same area is recorded as lost and gained in this class' : undefined,
      })
    }
  }

  const commercial = rows.filter(row => row.useClass && isCommercialClass(row.useClass))
  const excluded = rows.filter(row => !row.useClass || !isCommercialClass(row.useClass))
  const changing = commercial.filter(row => row.gained > 0 || row.lost > 0)
  const flexible = changing.some((row, i) => changing.slice(i + 1).some(other =>
    row.lost > 0 && sameArea(row.lost, other.lost) && sameArea(row.gained, other.gained)))
  const classesDisagree = disagrees([...description.existing, ...description.proposed],
    rows.flatMap(row => row.useClass && (row.gained > 0 || row.lost > 0) ? [row.useClass] : []))
  // Sui Generis covers betting shops, pubs and gaming centres as well as housing, so a commercial
  // total that leaves it out may be wrong either way.
  const unclassified = excluded.some(row => (row.useClass === 'Sui Generis' || !row.useClass)
    && (row.gained > 0 || row.lost > 0 || (row.existing ?? 0) > 0))
  // A class the description says is being changed away from, whose row loses nothing: the loss was
  // not entered (Waltham Forest 261642: education to a flat, with the F1 row losing 0 m²).
  const changeOfUse = /\bchange of use|\bconver(?:t|sion)/i.test(description.text ?? record.description ?? '')
  const unrecordedLoss = changeOfUse && commercial.some(row => row.lost === 0 && (row.existing ?? 0) > 0
    && description.existing.some(named => compatible(named, row.useClass!))
    && !description.proposed.some(named => compatible(named, row.useClass!)))
  // A gain equal to all the existing commercial space is the resulting total entered as the gain
  // (Redbridge 1397/26: two units of 61.4 and 55.1 m² merged, with 116.5 m² "gained").
  const existingTotal = commercial.reduce((sum, row) => sum + (row.existing ?? 0), 0)
  const totalAsGain = commercial.some(row => row.gained > (row.existing ?? 0) && existingTotal > 0
    && commercial.filter(other => (other.existing ?? 0) > 0).length > 1 && sameArea(row.gained, existingTotal))
  const doubt = flexible ? 'Rows look like one space under alternative uses, so they are not added together'
    : totalAsGain ? 'A gain equals all the existing commercial space, so it may be the resulting total'
    : classesDisagree ? 'The Datahub’s use classes disagree with the application description'
      : commercial.some(regained) ? 'The same area is recorded as lost and gained in one class'
        : unclassified ? 'Sui Generis or unrecognised floor area may be commercial, so the commercial total is uncertain'
          : null
  const changeDoubt = unrecordedLoss ? 'The description changes a use whose row records no loss' : null
  const areaFinding = (fact: FactKey, sqm: number, page: string, excerpt: string, note?: string, completes = true) => {
    const reason = doubt ?? (fact === 'existing_floorspace' ? null : changeDoubt)
    out[fact].push({
      ...base(page, excerpt), key: findingKey(fact, [page, round(sqm)]),
      completes: completes && !paperwork && !reason, sqm: round(sqm), basis: 'gross_internal', extent: 'whole_development',
      note: [paperwork ? paperworkNote : null, reason, note].filter(Boolean).join('. ') || undefined,
    })
  }

  if (commercial.length > 0) {
    const classes = commercial.map(row => row.useClass).join(', ')
    const gained = commercial.reduce((sum, row) => sum + row.gained, 0)
    const lost = commercial.reduce((sum, row) => sum + row.lost, 0)
    const existingKnown = commercial.every(row => row.existing !== null)
    const existing = commercial.reduce((sum, row) => sum + (row.existing ?? 0), 0)
    const page = 'application_details.existing_proposed_floorspace_details'
    const excerpt = `Commercial rows ${classes}: existing ${existingKnown ? existing : 'not supplied'}, lost ${lost}, gained ${gained} m² GIA`
    if (recordsChange) {
      areaFinding('net_floorspace', gained - lost, page, excerpt, 'Gained less lost across commercial use classes')
      if (existingKnown) {
        areaFinding('existing_floorspace', existing, page, excerpt)
        areaFinding('proposed_floorspace', existing - lost + gained, page, excerpt, 'Existing less lost plus gained, per the Datahub’s definitions')
      }
    } else if (existingKnown && existing > 0) {
      areaFinding('existing_floorspace', existing, page, excerpt, 'The record states no gain or loss', false)
    }

    const aggregateGained = area(details.non_residential_details?.total_non_resi_gross_internal_floor_area_to_be_gained)
    const aggregateLost = area(details.non_residential_details?.total_non_resi_gross_internal_floor_area_to_be_lost)
    if (recordsChange && aggregateGained !== null && aggregateLost !== null && aggregateGained + aggregateLost > 0) {
      const net = aggregateGained - aggregateLost
      // The aggregate also counts non-residential classes this checklist leaves out, so it is
      // only a rival figure when no such rows exist.
      const comparable = excluded.every(row => row.gained === 0 && row.lost === 0)
      if (Math.abs(net - (gained - lost)) > Math.max(1, Math.abs(gained - lost) * 0.01)) {
        areaFinding('net_floorspace', net, 'application_details.non_residential_details',
          `total_non_resi_gross_internal_floor_area_to_be_gained ${aggregateGained}; _to_be_lost ${aggregateLost}`,
          comparable ? 'Non-residential totals disagree with the per-class rows' : 'Non-residential totals, which include classes not counted as commercial',
          comparable)
      }
    }
  }

  for (const row of excluded.filter(row => row.gained > 0 || row.lost > 0)) {
    if (row.useClass === 'Sui Generis' || !row.useClass) {
      areaFinding('net_floorspace', row.gained - row.lost, rowPath(row.index),
        `use_class ${row.raw}; gia_lost ${row.lost}; gia_gained ${row.gained}`,
        row.useClass ? 'Sui Generis area, not counted as commercial' : `Unrecognised use class "${row.raw}", not counted`, false)
    }
  }

  const sites = [
    ['application_details.site_area', details.site_area],
    ['application_details.non_residential_details.site_area', details.non_residential_details?.site_area],
  ] as const
  const stated = sites.flatMap(([, value]) => typeof value === 'number' && value > 0 ? [value] : [])
  for (const [page, hectares] of sites) {
    if (!(typeof hectares === 'number' && hectares > 0)) continue
    const sqm = round(hectares * 10_000)
    // A figure far above the record's other site area was entered in square metres. Above 50 ha is
    // possible for a masterplan but far more often a unit error (Merton 26/FULL/0550: 251.2 ha for
    // a flat conversion), so a person checks it.
    const plausible = hectares <= 50 && !stated.some(other => hectares / other > 1_000)
    out.site_area.push({
      ...base(page, `${page.split('.').at(-1)} ${hectares} ha`), key: findingKey('site_area', [round(hectares * 1e6)]),
      completes: plausible && !paperwork, sqm, original: { value: hectares, unit: 'hectares' },
      extent: 'whole_development', basis: 'unspecified',
      note: [paperwork ? paperworkNote : null, plausible ? null : 'Unusually large; probably entered in square metres'].filter(Boolean).join('. ') || undefined,
    })
  }
  return out
}

async function datahubRequest(path: string, init: RequestInit, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher(`${LONDON_DATAHUB_API}${path}`, {
    ...init, headers: { ...GUEST_HEADER, 'Content-Type': 'application/json', ...init.headers },
    signal: init.signal ?? AbortSignal.timeout(20_000),
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`London Datahub returned ${response.status}`)
  return response.json()
}

/** The Datahub's record for one application, matched exactly on borough and reference, or null. */
export async function lookupDatahubApplication(
  input: { authoritySlug: string; reference: string },
  fetcher: typeof fetch = fetch
): Promise<DatahubApplication | null> {
  const borough = DATAHUB_BOROUGHS[input.authoritySlug]
  if (!borough) return null
  const payload = await datahubRequest('/applications/_search', {
    method: 'POST',
    body: JSON.stringify({
      size: 10,
      query: { bool: { filter: [{ term: { 'lpa_name.raw': borough } }], must: [{ match_phrase: { lpa_app_no: input.reference } }] } },
      _source: { excludes: ['polygon', 'centroid', 'wgs84_polygon', 'wgs84_centroid'] },
    }),
  }, fetcher) as { hits?: { hits?: Array<{ _source: DatahubApplication }> } } | null
  const matches = (payload?.hits?.hits ?? []).map(hit => hit._source)
    .filter(record => record.lpa_name === borough && record.lpa_app_no.trim().toUpperCase() === input.reference.trim().toUpperCase())
  return matches.length === 1 ? matches[0] : null
}

/** Evidence for the real checklist. The frozen 40-record evaluation failed the publication gate.
 * Preserve candidate values and their field paths for a person to check; a matching public record
 * is not independent verification of an applicant-entered number. Do not send these candidates
 * through a model as authoritative facts, which would bypass this review requirement.
 */
export function findingsFromDatahub(
  record: DatahubApplication,
  at: string,
  description: { text?: string | null; existing: string[]; proposed: string[] } = { existing: [], proposed: [] }
): Record<FactKey, FactFinding[]> {
  const candidates = candidateFindingsFromDatahub(record, at, description)
  for (const findings of Object.values(candidates)) {
    for (const finding of findings) {
      finding.completes = false
      finding.note = ['Unverified Datahub evidence: check the application form or another source before confirming', finding.note]
        .filter(Boolean).join('. ')
    }
  }
  return candidates
}
