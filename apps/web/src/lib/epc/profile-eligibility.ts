/**
 * Why a store's measurement does or does not reach a user.
 *
 * `rebuild_brand_floor_area_profiles()` publishes a distribution from
 * `confidence = 'high'` rows with an area, at two grains, and only where five such rows
 * exist. Three separate things can therefore stop a measured store from reaching the
 * product, and the difference between them matters to whoever is looking:
 *
 *   the match was not good enough      the row is evidence, not data
 *   the match was demoted              it was high confidence and the area was not
 *                                      credible for the format — almost always a
 *                                      concession carrying its host building's area
 *   the format has too few measured    nothing wrong with this store at all; the
 *   shops                              fascia has no distribution to put it in
 *
 * Pure, and shared by the store evidence view (§6.2) and the brand profile tab (§6.3),
 * because two screens answering the same question differently is how a rule quietly
 * becomes two rules. The thresholds here are read from the SQL, not chosen again:
 * migration 20260910000000 is the authority.
 */

/** The floor of migration 20260910000000's `HAVING count(*) >= 5`. */
export const PROFILE_MIN_SAMPLE = 5

export interface FloorAreaRow {
  confidence: 'high' | 'medium' | 'low' | 'none' | string
  floor_area_m2: number | null
  size_plausibility: string | null
}

export type ExclusionReason =
  | 'never-matched'
  | 'demoted'
  | 'low-confidence'
  | 'no-area'

export interface ProfileEligibility {
  /** Does this row feed the aggregate? Nothing about whether a profile is published. */
  counts: boolean
  reason: ExclusionReason | null
  /** One line, for a screen. */
  headline: string
  /** The why, in the terms the pipeline actually used. */
  detail: string
}

export function profileEligibility(row: FloorAreaRow | null): ProfileEligibility {
  if (!row) {
    return {
      counts: false,
      reason: 'never-matched',
      headline: 'Not counted — never matched',
      detail:
        'This store has no floor-area row, so it has never been through the matcher. '
        + 'It is in the queue by definition; the next run will consider it.',
    }
  }

  // Order matters: a demoted row IS a low-confidence row, and reporting it as merely
  // low confidence would hide the fact that the matcher found something and rejected it.
  if (row.size_plausibility === 'implausible') {
    return {
      counts: false,
      reason: 'demoted',
      headline: 'Not counted — demoted as implausible',
      detail:
        'The match was high confidence, but the area is not credible for this format. '
        + 'Almost always a concession recorded against its host building’s certificate '
        + '— a shop inside a supermarket carrying the supermarket’s floor area.',
    }
  }

  if (row.confidence !== 'high') {
    return {
      counts: false,
      reason: 'low-confidence',
      headline: `Not counted — confidence is ${row.confidence}`,
      detail:
        row.confidence === 'none'
          ? 'No admissible certificate was found at this postcode.'
          : 'A certificate was found but the evidence does not identify these premises. '
            + 'In assessment, rows at this tier were the wrong premises about half the time, '
            + 'so they are kept as evidence and never shown to a user.',
    }
  }

  if (row.floor_area_m2 === null) {
    return {
      counts: false,
      reason: 'no-area',
      headline: 'Not counted — no area on the certificate',
      detail:
        'The match is high confidence but carries no floor area, so there is nothing to '
        + 'aggregate. This should not occur: a row citing a certificate is expected to '
        + 'carry its measurement.',
    }
  }

  return {
    counts: true,
    reason: null,
    headline: 'Counted toward the brand profile',
    detail:
      'High confidence with an area, so it feeds the brand’s distribution and its '
      + 'fascia’s, wherever those have enough measured shops to publish.',
  }
}

/**
 * Whether a grain has enough measured shops to publish a distribution, and what to say
 * when it does not. `measured` is the count of rows for which profileEligibility().counts
 * is true at that grain.
 */
export function profilePublication(measured: number, grain: 'brand' | 'fascia'): {
  published: boolean
  detail: string
} {
  if (measured >= PROFILE_MIN_SAMPLE) {
    return {
      published: true,
      detail: `${measured} measured shops, so a distribution is published for this ${grain}.`,
    }
  }
  return {
    published: false,
    // Not a failure state, and the product does not treat it as one: below the floor it
    // shows the individual measured shops instead of quartiles over three points.
    detail:
      `${measured} measured shop${measured === 1 ? '' : 's'} — fewer than the `
      + `${PROFILE_MIN_SAMPLE} this ${grain} needs before quartiles mean anything. `
      + 'The product shows the individual measured shops instead.',
  }
}
