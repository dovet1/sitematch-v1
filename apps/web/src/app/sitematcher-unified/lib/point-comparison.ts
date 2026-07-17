import type {
  PresentBrand,
  MissingBrand,
  ComparePointResult,
  CompareStatRow,
} from '../types/unified-workspace'

export interface BrandDiff {
  onlyA: PresentBrand[]
  onlyB: PresentBrand[]
  bothCount: number
  missingBoth: MissingBrand[]
}

// Head-to-head brand diff between two catchments, keyed on brandId:
//   onlyA/onlyB = present in one but not the other;
//   bothCount   = brands trading in both;
//   missingBoth = brands with no presence in either (intersection of the gaps).
export function computeBrandDiff(
  presentA: PresentBrand[],
  presentB: PresentBrand[],
  missingA: MissingBrand[],
  missingB: MissingBrand[]
): BrandDiff {
  const presentBIds = new Set(presentB.map((b) => b.brandId))
  const presentAIds = new Set(presentA.map((b) => b.brandId))

  const onlyA = presentA.filter((b) => !presentBIds.has(b.brandId))
  const onlyB = presentB.filter((b) => !presentAIds.has(b.brandId))
  const bothCount = presentA.length - onlyA.length

  const missingBIds = new Set(missingB.map((b) => b.brandId))
  const missingBoth = missingA.filter((b) => missingBIds.has(b.brandId))

  return { onlyA, onlyB, bothCount, missingBoth }
}

function delta(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null
  return b - a
}
function pct(a: number | null, d: number | null): number | null {
  if (a == null || d == null || a === 0) return null
  return (d / a) * 100
}

// The five catchment-stats rows (Pin A · Pin B · Δ B−A). Population/Households/
// Affluence come from demographics; Brands trading/missing are derived from the
// per-side brand lists here (stats deliberately doesn't carry brand counts).
export function computeStatDeltas(
  sideA: ComparePointResult,
  sideB: ComparePointResult
): CompareStatRow[] {
  const rows: Array<
    Omit<CompareStatRow, 'delta' | 'pct'> & { a: number | null; b: number | null }
  > = [
    {
      key: 'population',
      label: 'Population',
      a: sideA.stats.population,
      b: sideB.stats.population,
      better: 'up',
      decimals: 0,
    },
    {
      key: 'households',
      label: 'Households',
      a: sideA.stats.households,
      b: sideB.stats.households,
      better: 'up',
      decimals: 0,
    },
    {
      key: 'affluence',
      label: 'Affluence',
      a: sideA.stats.affluence,
      b: sideB.stats.affluence,
      better: 'up',
      decimals: 1,
    },
    {
      key: 'trading',
      label: 'Brands trading',
      a: sideA.present.length,
      b: sideB.present.length,
      better: 'up',
      decimals: 0,
    },
    {
      key: 'missing',
      label: 'Brands missing',
      a: sideA.missing.length,
      b: sideB.missing.length,
      better: 'down',
      decimals: 0,
    },
  ]

  return rows.map((r) => {
    const d = delta(r.a, r.b)
    return { ...r, delta: d, pct: pct(r.a, d) }
  })
}
