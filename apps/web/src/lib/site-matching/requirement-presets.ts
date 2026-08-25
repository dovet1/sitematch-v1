// Worked example acquisition briefs — data, not hardcoded logic — so Find Sites is generic
// across property formats, not built around any one brand or a single drive-thru shape.
//
// Each preset is a brand-agnostic `OccupierRequirement`. Brand + same-brand distance are
// OPTIONAL: call `withSameBrand()` to append the same-brand gate only when a brand is chosen
// (the engine already treats "no brand" as satisfied). The three non-drive-thru briefs
// deliberately span different plot-size bands + land-use preferences so M10 can confirm the
// same interface + evidence model support materially different requirements — the point is
// coverage of the criteria space, not proving any land use definitively.
//
// Convention (recall-favouring, per M9): only HARD criteria are `required` (they eliminate) —
// a minimum plot size and an excluding flood zone; oversized titles are RETAINED (M9.1 area
// semantics). Everything else is `preferred` (ranks, never eliminates) or `warning`.

import type { OccupierRequirement } from './types'

const AB = ['A Road', 'B Road']
const ABM = ['A Road', 'B Road', 'Motorway']
const NON_RESIDENTIAL_EXCLUDE = ['residential']

/** Small roadside drive-thru (the M7/M9 worked example): 0.3–0.7 ac, fronting an A/B road. */
const driveThru: OccupierRequirement = {
  id: 'preset-drive-thru',
  brandId: null,
  name: 'Drive-thru (small roadside)',
  profileType: 'drive-thru',
  description: 'A small roadside drive-thru unit fronting a classified road.',
  criteria: [
    { key: 'site_area', mode: 'required', params: { minAcres: 0.3, maxAcres: 0.7 } },
    { key: 'planning_constraints', mode: 'required', params: { exclusions: ['flood_zone_3'], warnings: ['flood_zone_2', 'green_belt'] } },
    { key: 'road_proximity', mode: 'preferred', weight: 2, params: { roadClasses: AB, maxDistanceM: 100 } },
    { key: 'traffic_aadf', mode: 'preferred', weight: 2, params: { minAadf: 10000, roadClasses: AB } },
    { key: 'road_frontage', mode: 'preferred', params: { minM: 20 } },
    { key: 'junction_distance', mode: 'preferred', params: { maxM: 500 } },
    { key: 'land_use', mode: 'preferred', params: { preferred: ['retail', 'commercial', 'food_drink', 'fuel', 'parking', 'leisure_recreation', 'vacant_or_brownfield'], excluded: NON_RESIDENTIAL_EXCLUDE } },
    { key: 'access', mode: 'warning', params: {} },
  ],
}

/** A smaller roadside / commercial requirement — a bit more generous than a drive-thru. */
const roadsideCommercial: OccupierRequirement = {
  id: 'preset-roadside-commercial',
  brandId: null,
  name: 'Roadside / commercial unit',
  profileType: 'roadside_commercial',
  description: 'A small-to-mid roadside commercial unit near a classified road.',
  criteria: [
    { key: 'site_area', mode: 'required', params: { minAcres: 0.25, maxAcres: 1.5 } },
    { key: 'planning_constraints', mode: 'required', params: { exclusions: ['flood_zone_3'], warnings: ['flood_zone_2', 'green_belt'] } },
    { key: 'road_proximity', mode: 'preferred', weight: 2, params: { roadClasses: AB, maxDistanceM: 150 } },
    { key: 'traffic_aadf', mode: 'preferred', params: { minAadf: 8000, roadClasses: AB } },
    { key: 'road_frontage', mode: 'preferred', params: { minM: 15 } },
    { key: 'junction_distance', mode: 'preferred', params: { maxM: 750 } },
    { key: 'land_use', mode: 'preferred', params: { preferred: ['retail', 'commercial', 'food_drink', 'fuel', 'parking', 'vacant_or_brownfield'], excluded: NON_RESIDENTIAL_EXCLUDE } },
    { key: 'access', mode: 'warning', params: {} },
  ],
}

/** A larger retail / leisure / employment requirement (e.g. a store or leisure box). */
const retailLeisure: OccupierRequirement = {
  id: 'preset-retail-leisure',
  brandId: null,
  name: 'Retail / leisure / employment (larger)',
  profileType: 'retail_leisure',
  description: 'A larger retail, leisure or employment plot with a classified-road relationship.',
  criteria: [
    { key: 'site_area', mode: 'required', params: { minAcres: 1.0, maxAcres: 6.0 } },
    { key: 'planning_constraints', mode: 'required', params: { exclusions: ['flood_zone_3'], warnings: ['flood_zone_2', 'green_belt'] } },
    { key: 'road_proximity', mode: 'preferred', weight: 2, params: { roadClasses: AB, maxDistanceM: 250 } },
    { key: 'traffic_aadf', mode: 'preferred', weight: 2, params: { minAadf: 15000, roadClasses: AB } },
    { key: 'road_frontage', mode: 'preferred', params: { minM: 40 } },
    { key: 'junction_distance', mode: 'preferred', params: { maxM: 1000 } },
    { key: 'land_use', mode: 'preferred', params: { preferred: ['retail', 'commercial', 'leisure_recreation', 'parking', 'vacant_or_brownfield'], excluded: NON_RESIDENTIAL_EXCLUDE } },
    { key: 'access', mode: 'warning', params: {} },
  ],
}

/** An industrial / logistics requirement — big plot, motorway/A-road access, less about AADF. */
const industrialLogistics: OccupierRequirement = {
  id: 'preset-industrial-logistics',
  brandId: null,
  name: 'Industrial / logistics',
  profileType: 'industrial_logistics',
  description: 'A large industrial or distribution plot with strategic-road access.',
  criteria: [
    { key: 'site_area', mode: 'required', params: { minAcres: 2.0, maxAcres: 25.0 } },
    { key: 'planning_constraints', mode: 'required', params: { exclusions: ['flood_zone_3'], warnings: ['flood_zone_2', 'green_belt'] } },
    { key: 'road_proximity', mode: 'preferred', weight: 2, params: { roadClasses: ABM, maxDistanceM: 500 } },
    { key: 'junction_distance', mode: 'preferred', weight: 2, params: { maxM: 1500 } },
    { key: 'traffic_aadf', mode: 'preferred', params: { minAadf: 10000, roadClasses: ABM } },
    { key: 'land_use', mode: 'preferred', params: { preferred: ['industrial', 'storage_distribution', 'commercial', 'vacant_or_brownfield'], excluded: NON_RESIDENTIAL_EXCLUDE } },
    { key: 'access', mode: 'warning', params: {} },
  ],
}

export const REQUIREMENT_PRESETS = {
  'drive-thru': driveThru,
  roadside: roadsideCommercial,
  retail: retailLeisure,
  industrial: industrialLogistics,
} as const

export type RequirementPresetKey = keyof typeof REQUIREMENT_PRESETS

export function getPreset(key: string): OccupierRequirement | null {
  return (REQUIREMENT_PRESETS as Record<string, OccupierRequirement>)[key] ?? null
}

/** Append the same-brand-distance gate to a brief, for a brand-specific search. Same-brand is
 *  a HARD gate (avoid cannibalising an existing store); omit it entirely for a brand-agnostic
 *  search (the engine then treats same-brand as satisfied). */
export function withSameBrand(
  req: OccupierRequirement,
  brandId: string,
  minMiles: number
): OccupierRequirement {
  return {
    ...req,
    brandId,
    criteria: [
      ...req.criteria,
      { key: 'same_brand_distance', mode: 'required', params: { minMiles } },
    ],
  }
}
