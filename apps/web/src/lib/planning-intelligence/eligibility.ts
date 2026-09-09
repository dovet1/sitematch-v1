import { createHash } from 'crypto'
import { AMBIGUOUS_ALIASES, phrasesOn, type AliasIndex } from '@/lib/epc/aliases'
import { normTokens } from '@/lib/epc/normalise'
import type {
  BrandAliasHit,
  EligibilityDecision,
  EligibilityLimb,
  PlotaApplication,
} from './types'

const COMMERCIAL_SUPPLY = new Set(['new', 'to-commercial', 'between'])

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
  /^\s*(?:details?\b|discharge\s+of\s+conditions?\b|submission\s+of\s+details\b|approval\s+of\s+details\b|compliance\s+with\s+conditions?\b)/i

const EXISTING_CONSENT_REFERENCE =
  /\b(?:pursuant\s+to|reserved\s+by\s+conditions?|discharge\s+of\s+conditions?|conditions?\s+\d+|planning\s+permission\s+(?:dated|ref(?:erence)?))\b/i

export function isDetailSubmission(application: PlotaApplication): boolean {
  const description = application.description ?? ''
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
  if ((application.dwelling_count ?? 0) >= 16) limbs.push('B')
  if (
    options.brandLimbEnabled &&
    brandHits.some((hit) => hit.source === 'description' && !hit.ambiguous)
  ) {
    limbs.push('C')
  }
  if (application.commercial_work === 'loss') limbs.push('D')

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

