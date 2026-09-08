/**
 * The incremental matcher: one store against the certificates at its postcode.
 *
 * Ported from `scripts/epc/matchall.py:match()`, minus two things it deliberately does
 * not do (see below). The Python remains the source of truth and overwrites every row
 * this writes at the next quarterly run, so any drift lives at most one quarter — but
 * the two should agree, and `normalise.test.ts` pins the part most likely to diverge.
 *
 * Not ported, on purpose:
 *
 *   SPATIAL. matchall accepts a certificate within 25m for `pqi = 'Rooftop'` stores.
 *   Imported stores have no pqi; they were validated against Google Places to 10m
 *   instead, which the holdout in docs/store-floor-areas-import-plan.md 4.5 measured as
 *   a weaker signal (87.9% vs 93.8% agreement at production thresholds). It is
 *   defensible at 10m/35m and worth ~2,000 stores, and epc_certificates.geom is
 *   populated ready for it — but it is a second calibration and does not belong in a
 *   first cut.
 *
 *   PROPERTY-CLASS LEARNING. matchall runs a first pass over every property class to
 *   discover which ones a brand's certificates actually use — Screwfix as warehouse,
 *   Premier Inn as hotel. That is a whole-estate computation. Here the admissible set is
 *   read from what the quarterly run already established for the brand, falling back to
 *   retail and food.
 *
 * Size plausibility is not computed here either: `demote_implausible_floor_area_matches()`
 * applies it in SQL after the batch, because it needs profiles that this batch may change.
 */
import { storeAddrParts, storeTokens, units, numbers, houseNumbers } from './normalise'
import { phrasesOn, AMBIGUOUS_ALIASES, type AliasIndex } from './aliases'

export { BASE_CLASSES } from './classes'

export interface CandidateCert {
  source: string
  certificate_number: string
  tokens: string[]
  units: string[]
  numbers: string[]
  house_numbers: string[]
  property_type: string | null
  property_class: string | null
  floor_area_m2: number
  lodgement_date: string | null
  uprn: number | null
}

export interface MatchStore {
  id: string
  brand_id: string
  address_line_1?: string | null
  address_line_2?: string | null
  town?: string | null
  county?: string | null
}

export type Confidence = 'high' | 'medium' | 'low' | 'none'
export type MatchMethod =
  | 'address' | 'brand' | 'spatial' | 'postcode-single' | 'postcode-ambiguous' | 'none'

export interface MatchResult {
  store_id: string
  confidence: Confidence
  match_method: MatchMethod
  source: string | null
  certificate_number: string | null
  certificate_date: string | null
  property_type: string | null
  property_class: string | null
  uprn: number | null
  floor_area_m2: number | null
  address_corroboration: 'unit' | 'number' | 'spatial' | 'street-name-only' | null
  brand_on_certificate: boolean | null
  foreign_operator: string | null
  spatial_distance_m: number | null
  candidate_count: number | null
  certs_at_address: number | null
}

/** matchlib.compatible — liberal rejection. Any disagreement on unit or house number
 *  means different premises. */
function compatible(sUnits: Set<string>, sNums: Set<string>, c: CandidateCert): boolean {
  if (sUnits.size > 0 && c.units.length > 0 && !c.units.some((u) => sUnits.has(u))) return false
  if (sNums.size > 0 && c.numbers.length > 0 && !c.numbers.some((n) => sNums.has(n))) return false
  return true
}

/** matchlib.addr_score — shared tokens over store tokens, requiring at least one
 *  non-numeric token in common so "12" alone cannot score. */
function addrScore(stoks: string[], ctoks: string[]): number {
  if (stoks.length === 0) return 0
  const S = new Set(stoks)
  const C = new Set(ctoks)
  const shared = [...S].filter((t) => C.has(t))
  if (!shared.some((t) => !/^\d+$/.test(t))) return 0
  return shared.length / S.size
}

/** matchlib.corroboration — strict acceptance. */
function corroboration(
  sUnits: Set<string>, sHouse: Set<string>, c: CandidateCert
): 'unit' | 'number' | 'street-name-only' {
  if (sUnits.size > 0 && c.units.some((u) => sUnits.has(u))) return 'unit'
  if (sHouse.size > 0 && c.house_numbers.some((n) => sHouse.has(n))) return 'number'
  return 'street-name-only'
}

export function matchStore(
  store: MatchStore,
  candidates: CandidateCert[],
  idx: AliasIndex,
  admissibleClasses: Set<string>
): MatchResult {
  const none: MatchResult = {
    store_id: store.id, confidence: 'none', match_method: 'none',
    source: null, certificate_number: null, certificate_date: null,
    property_type: null, property_class: null, uprn: null, floor_area_m2: null,
    address_corroboration: null, brand_on_certificate: null, foreign_operator: null,
    // null, not 0, because matchall.py emits no candidate_count for a 'none' row.
    // A 0 here would be truer, but it would differ from every quarterly run and show up
    // in the admin audit trail as a change that never actually happened.
    spatial_distance_m: null, candidate_count: null, certs_at_address: null,
  }

  const mine = idx.aliases.get(store.brand_id) ?? new Set<string>()
  const fam = idx.family.get(store.brand_id) ?? new Set([store.brand_id])
  const unamb = new Set([...mine].filter((p) => !AMBIGUOUS_ALIASES.has(p)))

  const elig = candidates.filter(
    (c) => c.property_class !== null && admissibleClasses.has(c.property_class)
  )
  if (elig.length === 0) return none

  const sParts = storeAddrParts(store)
  const stoks = storeTokens(store)
  const sUnits = units(...sParts)
  const sNums = numbers(...sParts)
  const sHouse = houseNumbers(...sParts)

  const scored = elig.map((c) => {
    const present = phrasesOn(c.tokens, idx.byFirst)
    const named = [...present].some((p) => mine.has(p))
    let rival = ''
    for (const p of Array.from(present)) {
      if (mine.has(p)) continue
      const others = [...(idx.owners.get(p) ?? [])].filter((b) => !fam.has(b))
      if (others.length > 0) { rival = p; break }
    }
    const ok = compatible(sUnits, sNums, c)
    return {
      c, ok, named, rival,
      unamb: [...present].some((p) => unamb.has(p)),
      sc: ok ? addrScore(stoks, c.tokens) : 0,
    }
  })

  const addr = scored.filter((x) => x.ok && x.sc >= 0.6)
  // An ambiguous alias may corroborate but may not carry a match on its own.
  const brandm = scored.filter((x) => x.ok && x.unamb)

  let method: MatchMethod
  let group: typeof scored
  if (addr.length > 0) { method = 'address'; group = addr }
  else if (brandm.length > 0) { method = 'brand'; group = brandm }
  else if (elig.length === 1) { method = 'postcode-single'; group = scored }
  else { method = 'postcode-ambiguous'; group = scored }

  // Best by score, then most recent certificate. Where several certificates share an
  // address, the newest wins and the certificate number breaks any remaining tie, so the
  // result is deterministic rather than dependent on row order.
  const best = group.reduce((a, b) =>
    b.sc > a.sc || (b.sc === a.sc && (b.c.lodgement_date ?? '') > (a.c.lodgement_date ?? '')) ? b : a
  )
  const key = best.c.tokens.join('|')
  const same = group.filter((g) => g.c.tokens.join('|') === key)
  const newest = same.reduce((a, b) => ((b.c.lodgement_date ?? '') > (a.c.lodgement_date ?? '') ? b : a))
  const tied = same.filter((g) => (g.c.lodgement_date ?? '') === (newest.c.lodgement_date ?? ''))
  const pick = tied.sort((a, b) => a.c.certificate_number.localeCompare(b.c.certificate_number))[0]
  const c = pick.c

  const corr = corroboration(sUnits, sHouse, c)
  let confidence: Confidence
  if (pick.rival && !pick.named) confidence = 'low'
  else if (pick.named || corr === 'unit' || corr === 'number') confidence = 'high'
  else if (method === 'address' || method === 'brand') confidence = 'medium'
  else confidence = 'low'

  return {
    store_id: store.id,
    confidence,
    match_method: method,
    source: c.source,
    certificate_number: c.certificate_number,
    certificate_date: c.lodgement_date,
    property_type: c.property_type,
    property_class: c.property_class,
    uprn: c.uprn,
    floor_area_m2: c.floor_area_m2,
    address_corroboration: corr,
    brand_on_certificate: pick.named,
    foreign_operator: pick.rival || null,
    spatial_distance_m: null,
    candidate_count: elig.length,
    certs_at_address: same.length,
  }
}
