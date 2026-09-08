import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser, adminClient, adminError } from '@/lib/admin-auth'
import { sqFtFromM2 } from '@/app/sitematcher-unified/lib/size-filter'
import { profileEligibility, profilePublication } from '@/lib/epc/profile-eligibility'
import type { BrandFloorAreas, ProfileStore } from '@/types/floor-area-health'

export const dynamic = 'force-dynamic'

/**
 * The chain behind one brand's published sizes — docs/store-floor-areas-import-plan.md §6.3.
 *
 * The profile rows are converted with `sqFtFromM2`, the same function the public route
 * uses, so this screen cannot drift from the product it is meant to explain. If a number
 * here disagrees with the size filter, the disagreement is real and worth chasing rather
 * than an artefact of a second conversion.
 *
 * The measured shops come back in full, because the drill-down is the point of the
 * screen: not "what is the median" but "which shops produced that median". The excluded
 * ones come back as counts plus a handful of examples each — Tesco alone has 1,344 of
 * them, and sending every one to render twelve was a megabyte of JSON for a list nobody
 * reads past the first line.
 */

// Brands run to a few thousand shops (Tesco is the ceiling); PostgREST pages at 1,000.
const PAGE = 1000
const MAX_PAGES = 10
// Enough examples of each exclusion to recognise a pattern; the count carries the scale.
const EXCLUDED_SAMPLE = 12

interface RawStore {
  id: string
  name: string | null
  town: string | null
  fascia_id: string | null
  store_floor_areas:
    | { floor_area_sqft: number | null; floor_area_m2: number | null; confidence: string
        size_plausibility: string | null; matcher_version: string; computed_at: string }
    | null
    | { floor_area_sqft: number | null; floor_area_m2: number | null; confidence: string
        size_plausibility: string | null; matcher_version: string; computed_at: string }[]
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminUser()
  if (gate.error) return gate.error

  try {
    const { id: brandId } = await params
    const supabase = adminClient()

    const [profileRes, fasciaRes] = await Promise.all([
      supabase
        .from('brand_floor_area_profiles')
        .select('brand_id,fascia_id,min_m2,p25_m2,median_m2,p75_m2,max_m2,sample_count,coefficient_of_variation,matcher_version,generated_at')
        .eq('brand_id', brandId),
      supabase.from('fascias').select('id,name').eq('brand_id', brandId),
    ])
    if (profileRes.error) throw new Error(`profiles: ${profileRes.error.message}`)
    if (fasciaRes.error) throw new Error(`fascias: ${fasciaRes.error.message}`)

    const fasciaNames = new Map<string, string>(
      ((fasciaRes.data ?? []) as { id: string; name: string }[]).map((f) => [f.id, f.name])
    )

    const stores: RawStore[] = []
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const from = page * PAGE
      const { data, error } = await supabase
        .from('stores')
        .select('id,name,town,fascia_id,store_floor_areas(floor_area_sqft,floor_area_m2,confidence,size_plausibility,matcher_version,computed_at)')
        .eq('brand_id', brandId)
        .range(from, from + PAGE - 1)
      if (error) throw new Error(`stores: ${error.message}`)
      stores.push(...((data ?? []) as unknown as RawStore[]))
      if (!data || data.length < PAGE) break
    }

    const all: (ProfileStore & { counts: boolean; reasonHeadline: string })[] = stores.map((s) => {
      // PostgREST returns a to-one embed as an object or a single-element array
      // depending on how it reads the relationship; both shapes occur.
      const areaRaw = Array.isArray(s.store_floor_areas)
        ? (s.store_floor_areas[0] ?? null)
        : s.store_floor_areas
      const area = areaRaw ?? null
      const eligibility = profileEligibility(
        area && {
          confidence: area.confidence,
          floor_area_m2: area.floor_area_m2,
          size_plausibility: area.size_plausibility,
        }
      )
      return {
        id: s.id,
        name: s.name,
        town: s.town,
        fasciaId: s.fascia_id,
        sqFt: area?.floor_area_sqft ?? null,
        m2: area?.floor_area_m2 ?? null,
        counts: eligibility.counts,
        reasonHeadline: eligibility.headline,
      }
    })

    const measuredStores = all
      .filter((r) => r.counts)
      .map(({ counts, reasonHeadline, ...rest }) => rest)

    // Grouped here rather than in the browser: the groups are what the screen shows, and
    // the rows behind them are not.
    const groups = new Map<string, { headline: string; count: number; sample: ProfileStore[] }>()
    for (const r of all) {
      if (r.counts) continue
      const g = groups.get(r.reasonHeadline)
        ?? { headline: r.reasonHeadline, count: 0, sample: [] }
      g.count += 1
      if (g.sample.length < EXCLUDED_SAMPLE) {
        const { counts, reasonHeadline, ...rest } = r
        g.sample.push(rest)
      }
      groups.set(r.reasonHeadline, g)
    }

    const profiles = ((profileRes.data ?? []) as {
      brand_id: string; fascia_id: string | null
      min_m2: number; p25_m2: number; median_m2: number; p75_m2: number; max_m2: number
      sample_count: number; coefficient_of_variation: number | null
      matcher_version: string | null; generated_at: string | null
    }[]).map((p) => ({
      brandId: p.brand_id,
      fasciaId: p.fascia_id,
      fasciaName: p.fascia_id ? (fasciaNames.get(p.fascia_id) ?? null) : null,
      minSqFt: sqFtFromM2(p.min_m2),
      p25SqFt: sqFtFromM2(p.p25_m2),
      medianSqFt: sqFtFromM2(p.median_m2),
      p75SqFt: sqFtFromM2(p.p75_m2),
      maxSqFt: sqFtFromM2(p.max_m2),
      sampleCount: p.sample_count,
      coefficientOfVariation: p.coefficient_of_variation,
      matcherVersion: p.matcher_version,
      generatedAt: p.generated_at,
    }))

    const measured = measuredStores.length
    const payload: BrandFloorAreas = {
      profiles,
      stores: measuredStores,
      excluded: Array.from(groups.values()).sort((a, b) => b.count - a.count),
      estate: { stores: all.length, measured, truncated: stores.length >= PAGE * MAX_PAGES },
      brandPublication: profilePublication(measured, 'brand'),
    }
    return NextResponse.json(payload)
  } catch (error) {
    return adminError('Brand floor areas', error)
  }
}
