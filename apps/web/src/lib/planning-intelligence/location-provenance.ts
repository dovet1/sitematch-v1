export type LocationProvenance = 'source_exact' | 'source_centroid' | 'postcode_centroid' | 'missing'

/**
 * Whether a stored point may sit well away from the site, so the UI must say so.
 *
 * Only a provider centroid that is not the record's own postcode centre qualifies: often a ward
 * or parish centre. A postcode centre covers a street or two and is shown as the site (85% of
 * Plota's `centroid` points turned out to be exactly that). A 'missing' record has no point.
 */
export function isApproximateLocation(provenance: LocationProvenance | null | undefined): boolean {
  return provenance === 'source_centroid'
}
