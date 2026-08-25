// M9 search analysis — PURE metrics over a ranked result set: the known-site recall
// test and the shortlist quality summary. IO (the spatial store→parcel lookup, the
// ranking itself) lives in the script; everything here is unit-testable.

import type { MatchLabel, SiteMatchResult } from './types'

/**
 * A known real-world site (e.g. an existing Canterbury drive-thru) resolved to the
 * candidate parcel it falls in or nearest to. Produced by the spatial helper RPC; `siteId`
 * is null when NO candidate parcel is within the lookup radius (a genuine miss of the
 * universe, not of the ranking).
 */
export interface KnownSite {
  label: string
  /** The candidate parcel the known site maps to, or null if none found in the universe. */
  siteId: string | null
  /** Whether the known point falls INSIDE that parcel (vs merely nearest). */
  contained: boolean
  /** Distance (m) from the known point to that parcel (0 when contained). */
  distanceM: number | null
  /** WGS84 coordinates of the known point (carried through for the debug map). */
  lon?: number | null
  lat?: number | null
}

export interface KnownSiteOutcome {
  label: string
  siteId: string | null
  contained: boolean
  distanceM: number | null
  lon: number | null
  lat: number | null
  /** true once the mapped parcel is present in the search universe/results. */
  inUniverse: boolean
  /** 1-based rank among ALL results (eligible first, then score); null if not in universe. */
  rank: number | null
  score: number | null
  eligible: boolean | null
  label_: MatchLabel | null
  inTopN: boolean
}

export interface RecallReport {
  topN: number
  known: number
  /** Known sites that mapped to a candidate parcel at all (spatial hit). */
  mappedToParcel: number
  /** Of those, how many parcels are actually in the searched universe. */
  inUniverse: number
  /** Of the in-universe parcels, how many survive the required gates (eligible). */
  eligible: number
  /** How many landed in the ranked top-N. */
  inTopN: number
  outcomes: KnownSiteOutcome[]
  /** Median rank of the in-universe known parcels (null if none). */
  medianRank: number | null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Score the known-site recall test against an already-ranked result set. `ranked` MUST be
 * the full ranking (rankSites output), not the truncated shortlist, so ranks are absolute.
 */
export function knownSiteRecall(
  ranked: SiteMatchResult[],
  known: KnownSite[],
  topN: number
): RecallReport {
  const rankById = new Map<string, number>()
  ranked.forEach((r, i) => rankById.set(r.siteId, i + 1))
  const byId = new Map(ranked.map((r) => [r.siteId, r]))

  const outcomes: KnownSiteOutcome[] = known.map((k) => {
    const result = k.siteId ? byId.get(k.siteId) : undefined
    const rank = k.siteId ? (rankById.get(k.siteId) ?? null) : null
    return {
      label: k.label,
      siteId: k.siteId,
      contained: k.contained,
      distanceM: k.distanceM,
      lon: k.lon ?? null,
      lat: k.lat ?? null,
      inUniverse: !!result,
      rank,
      score: result ? result.score : null,
      eligible: result ? result.eligible : null,
      label_: result ? result.label : null,
      inTopN: rank != null && rank <= topN,
    }
  })

  const inUniverseRanks = outcomes
    .filter((o) => o.inUniverse && o.rank != null)
    .map((o) => o.rank as number)

  return {
    topN,
    known: known.length,
    mappedToParcel: known.filter((k) => k.siteId != null).length,
    inUniverse: outcomes.filter((o) => o.inUniverse).length,
    eligible: outcomes.filter((o) => o.eligible === true).length,
    inTopN: outcomes.filter((o) => o.inTopN).length,
    outcomes,
    medianRank: median(inUniverseRanks),
  }
}

export interface ShortlistQuality {
  universe: number
  eligible: number
  ineligible: number
  labels: Record<MatchLabel, number>
  /** Top-N summary: how many of each label make the shortlist. */
  topN: number
  topNLabels: Record<MatchLabel, number>
  /** Score at the top and at the shortlist cut, for a "how steep is the tail" read. */
  topScore: number | null
  cutScore: number | null
}

/** Summarise the quality of a ranked result set + its top-N shortlist. */
export function shortlistQuality(ranked: SiteMatchResult[], topN: number): ShortlistQuality {
  const labels: Record<MatchLabel, number> = { strong: 0, potential: 0, weak: 0 }
  for (const r of ranked) labels[r.label]++
  const eligible = ranked.filter((r) => r.eligible)
  const top = eligible.slice(0, topN)
  const topNLabels: Record<MatchLabel, number> = { strong: 0, potential: 0, weak: 0 }
  for (const r of top) topNLabels[r.label]++
  return {
    universe: ranked.length,
    eligible: eligible.length,
    ineligible: ranked.length - eligible.length,
    labels,
    topN,
    topNLabels,
    topScore: top.length ? top[0].score : null,
    cutScore: top.length ? top[top.length - 1].score : null,
  }
}
