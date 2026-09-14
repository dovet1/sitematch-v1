import { createHash } from 'crypto'
import { AMBIGUOUS_ALIASES, phrasesOn, type AliasIndex } from '@/lib/epc/aliases'
import { describedCommercialWork } from './commercial-description'
import { normTokens } from '@/lib/epc/normalise'
import type {
  BrandAliasHit,
  EligibilityDecision,
  EligibilityLimb,
  PlotaApplication,
} from './types'

/**
 * Where a housing scheme becomes large enough to move market size.
 *
 * Was 16, from an original brief reading "greater than 15 dwellings". The domain expert
 * writes the rule as not interested "below 15 dwellings", which puts a 15-unit scheme inside
 * the net rather than outside it, and that reading is the one adopted. No record in the
 * 164-record sample sits at 15 or 16, so nothing was decided wrongly under either; the
 * difference only ever shows up on new data.
 *
 * Exported because the evaluation scripts measure agreement on exactly this cut, and a
 * threshold written out twice is a threshold that eventually disagrees with itself.
 */
export const MAJOR_HOUSING_DWELLINGS = 15

const COMMERCIAL_SUPPLY = new Set(['new', 'to-commercial', 'between'])

// This is a recall gate for classification, not an inferred dwelling count or a
// display threshold. Full-census ingestion is required to see these source rows.
// Require a proposal to create housing; a mention of existing homes alone is not
// enough (for example replacement windows to flats or a fence beside new homes).
const HOUSING_PROPOSAL = /\b(?:erection|construction|conversion|redevelopment|development|creation|provision|subdivision|sub-division|change\s+of\s+use)\s+(?:of\s+|to\s+|for\s+|into\s+)?(?:up\s+to\s+)?(?:a\s+|an\s+|new\s+|proposed\s+|replacement\s+|additional\s+|residential\s+|\d+\s+|[a-z]+-bed(?:room)?\s+|\d+-bed(?:room)?\s+)*(?:dwellings|dwellinghouses|houses|homes|flats|apartments|residential\s+units|housing(?!\s+(?:manager|officer|association\s+offices)(?:[’'s]*\b)))\b/i
const RESIDENTIAL_SCHEME = /^\s*(?:(?:outline|full|hybrid)\s+(?:planning\s+)?(?:application|permission)\s+(?:for\s+)?)?(?:(?:proposed|new)\s+)?(?:residential|housing)\s+(?:development|redevelopment|scheme)\b/i

export function hasUncountedHousingProposal(application: PlotaApplication): boolean {
  if (application.dwelling_count != null) return false
  const description = application.description ?? ''
  return HOUSING_PROPOSAL.test(description) || RESIDENTIAL_SCHEME.test(description)
}

function hitsFor(
  text: string | null | undefined,
  source: BrandAliasHit['source'],
  index: AliasIndex
): BrandAliasHit[] {
  const phrases = phrasesOn(normTokens(text), index.byFirst)
  const hits: BrandAliasHit[] = []
  for (const phrase of phrases) {
    for (const brandId of index.owners.get(phrase) ?? []) {
      hits.push({
        brandId,
        observedAlias: phrase.split('|').join(' '),
        source,
        ambiguous: AMBIGUOUS_ALIASES.has(phrase) || (index.owners.get(phrase)?.size ?? 0) > 1,
      })
    }
  }
  return hits
}

/**
 * Applications that only submit information required by an existing consent. They propose
 * no development of their own, but Plota quotes the parent permission in the description
 * and reports the parent's `dwelling_count`, so they trip limbs A and B and then present
 * as major schemes. In a ten-record sample two such records each claimed the same 113
 * dwellings and each created its own Development, double-counting one real scheme.
 *
 * `procedure` cannot carry this test: Wandsworth returned "reserved-matters" both for those
 * two records and for a genuine retail-warehouse-to-gymnasium change of use. The reliable
 * discriminator is the leading phrase these submissions conventionally use.
 *
 * Anchoring to the start of the description AND requiring a reference to the existing
 * consent keeps the rule narrow on purpose. A false exclusion silently loses an opportunity,
 * which is far worse than a fraction of a penny of wasted model spend. Reserved matters
 * proper and section 73 variations stay eligible -- both can change what actually gets built.
 */
const DETAIL_SUBMISSION_LEAD =
  /^\s*(?:details?\b|(?:part(?:ial)?\s+)?discharge\s+of\s+conditions?\b|submission\s+of\s+details\b|approval\s+of\s+details\b|compliance\s+with\s+conditions?\b)/i

const EXISTING_CONSENT_REFERENCE =
  /\b(?:pursuant\s+to|reserved\s+by\s+conditions?|discharge\s+of\s+conditions?|conditions?\s+\d+|planning\s+permission\s+(?:dated|ref(?:erence)?))\b/i

export function isDetailSubmission(application: PlotaApplication): boolean {
  const description = (application.description ?? '').replace(
    /^\s*(?:residential|housing)\s+(?:development|redevelopment|scheme)\b[^\n]{0,300}?\s[-:]\s*(?=(?:part(?:ial)?\s+)?discharge\s+of\s+conditions?\b|(?:submission|approval)\s+of\s+details\b)/i, ''
  )
  return (
    DETAIL_SUBMISSION_LEAD.test(description) && EXISTING_CONSENT_REFERENCE.test(description)
  )
}

/**
 * The LLM never decides membership of the intelligence tier. Limb C is present but
 * feature-gated until the labelled 200-hit set reaches 95% precision. Even then an
 * address-only hit cannot promote a record.
 */
export function decideEligibility(
  application: PlotaApplication,
  aliases?: AliasIndex,
  options: { brandLimbEnabled?: boolean } = {}
): EligibilityDecision {
  const brandHits = aliases
    ? [
        ...hitsFor(application.description, 'description', aliases),
        ...hitsFor(application.address, 'address', aliases),
      ]
    : []

  const limbs: EligibilityLimb[] = []
  if (application.commercial_work && COMMERCIAL_SUPPLY.has(application.commercial_work)) limbs.push('A')
  // Plota derives commercial_work only on live records, so an archive record could never meet the
  // commercial limbs. For those the description is read instead; a live record's null stays a no.
  const described = application.source && application.source !== 'live' && application.commercial_work == null
    ? describedCommercialWork(application.description)
    : null
  if (described && COMMERCIAL_SUPPLY.has(described.work)) limbs.push('A-described')
  if ((application.dwelling_count ?? 0) >= MAJOR_HOUSING_DWELLINGS ||
    hasUncountedHousingProposal(application)) limbs.push('B')
  if (
    options.brandLimbEnabled &&
    brandHits.some((hit) => hit.source === 'description' && !hit.ambiguous)
  ) {
    limbs.push('C')
  }
  if (application.commercial_work === 'loss') limbs.push('D')
  if (described?.work === 'loss') limbs.push('D-described')

  // The limbs are reported even when excluded, so the stored row records what it would
  // have qualified under. Excluded rows are exactly those with limbs and no tier.
  const detailSubmission = isDetailSubmission(application)
  return {
    intelligenceTier: limbs.length > 0 && !detailSubmission,
    limbs,
    brandHits,
    detailSubmission,
  }
}

/** Hash only fields that can change the deterministic or model decision. */
export function classificationInputHash(application: PlotaApplication): string {
  const input = {
    description: application.description ?? '',
    address: application.address ?? null,
    procedure: application.procedure ?? null,
    category: application.category ?? null,
    categories: application.categories ?? [],
    dwelling_count: application.dwelling_count ?? null,
    commercial: application.commercial ?? null,
    commercial_work: application.commercial_work ?? null,
    commercial_use_class: application.commercial_use_class ?? null,
    floorspace_sqm: application.floorspace_sqm ?? null,
    stage: application.stage ?? null,
    decision: application.decision ?? null,
  }
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}
