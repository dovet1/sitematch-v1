// Land-use SOURCE classification for "Find Sites" M5 (evidence fusion).
//
// A PURE mapping from a source feature's tags to SiteMatcher's normalised broad
// land-use class + a source-level confidence. This is deliberately unit-testable
// (Jest, synthetic tag fixtures only) because it is the part most prone to silent
// misclassification — the M5 gate literally measures how right this is on real data.
//
// Design rules:
// - We NEVER invent a class we cannot justify from the tags. A feature we cannot
//   confidently classify returns `null` and is simply not imported as evidence
//   (a bare `building=yes` says "built", not what the use is — that is `unknown`,
//   and unknown must never masquerade as a class).
// - Confidence is about the SOURCE→class mapping only (how firmly these tags imply
//   this class), NOT about how much of a candidate site the feature covers — that
//   spatial relevance is applied later, in the fusion step.
// - Explicit land-use / amenity / shop statements are `high`; a typed building
//   footprint (`building=house`) is `medium` (it describes the structure, which
//   usually but not always equals the use). Nothing here is a suitability claim.

import type { LandUseConfidence } from './types'

/** SiteMatcher's normalised broad land-use vocabulary. Occupier-relevant, source-
 *  agnostic. `mixed` is produced ONLY by fusion (conflicting strong evidence), never
 *  by single-feature classification; `null` everywhere means unknown, never a class. */
export type LandUseClass =
  | 'residential'
  | 'retail'
  | 'food_drink'
  | 'pub_bar'
  | 'fuel'
  | 'parking'
  | 'commercial'
  | 'industrial'
  | 'storage_distribution'
  | 'community'
  | 'leisure_recreation'
  | 'agricultural'
  | 'natural'
  | 'transport'
  | 'utility'
  | 'vacant_or_brownfield'
  | 'construction'
  | 'mixed'

export interface SourceClassification {
  landUseClass: LandUseClass
  confidence: LandUseConfidence
}

/** Lower-case a tag map's keys AND values so lookups are case-insensitive. OSM tag
 *  values are conventionally lower-case already, but source exports vary. */
export function normaliseTags(tags: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(tags)) {
    if (v == null) continue
    const val = String(v).trim()
    if (val === '') continue
    out[k.toLowerCase()] = val.toLowerCase()
  }
  return out
}

function inSet(value: string | undefined, ...values: string[]): boolean {
  return value != null && values.includes(value)
}

const H: LandUseConfidence = 'high'
const M: LandUseConfidence = 'medium'

/** Classify a set of OSM-style tags into a normalised class + source confidence.
 *  Rules are ordered most-specific/most-confident first; the first match wins.
 *  Returns null when the tags do not justify any class (→ not imported as evidence).
 *
 *  `kind` (the feature's geometry) gates a few tags that only mean land use as an AREA:
 *  a `power=generator` POINT is overwhelmingly a rooftop solar panel (noise that would
 *  mislabel a house as `utility`), while a `power=generator` POLYGON is a real generating
 *  station / solar farm. Omit `kind` to apply the area-permissive interpretation. */
export function classifyOsmTags(
  rawTags: Record<string, unknown>,
  kind?: 'polygon' | 'point',
): SourceClassification | null {
  const t = normaliseTags(rawTags)
  const amenity = t.amenity
  const shop = t.shop
  const office = t.office
  const tourism = t.tourism
  const leisure = t.leisure
  const landuse = t.landuse
  const natural = t.natural
  const manMade = t.man_made
  const power = t.power
  const railway = t.railway
  const building = t.building

  // --- Explicit points of use (high) ------------------------------------------
  if (shop && shop !== 'no') return { landUseClass: 'retail', confidence: H }

  if (amenity) {
    if (inSet(amenity, 'pub', 'bar', 'nightclub', 'biergarten')) return { landUseClass: 'pub_bar', confidence: H }
    if (amenity === 'fuel') return { landUseClass: 'fuel', confidence: H }
    if (inSet(amenity, 'fast_food', 'restaurant', 'cafe', 'food_court', 'ice_cream'))
      return { landUseClass: 'food_drink', confidence: H }
    if (inSet(amenity, 'parking', 'parking_space', 'motorcycle_parking', 'bicycle_parking', 'taxi'))
      return { landUseClass: 'parking', confidence: H }
    if (inSet(amenity, 'school', 'college', 'university', 'kindergarten', 'childcare', 'library', 'community_centre', 'place_of_worship', 'hospital', 'clinic', 'doctors', 'dentist', 'pharmacy', 'nursing_home', 'social_facility', 'townhall', 'courthouse', 'police', 'fire_station', 'post_office', 'prison'))
      return { landUseClass: 'community', confidence: H }
    if (inSet(amenity, 'bank', 'bureau_de_change')) return { landUseClass: 'retail', confidence: H }
    if (inSet(amenity, 'theatre', 'cinema', 'arts_centre', 'casino', 'nightclub'))
      return { landUseClass: 'leisure_recreation', confidence: H }
    // an unrecognised amenity falls through to landuse/building context
  }

  if (office && office !== 'no') return { landUseClass: 'commercial', confidence: H }

  if (tourism) {
    if (inSet(tourism, 'hotel', 'motel', 'guest_house', 'hostel', 'apartment', 'chalet'))
      return { landUseClass: 'commercial', confidence: H }
    if (inSet(tourism, 'attraction', 'museum', 'gallery', 'theme_park', 'zoo', 'aquarium'))
      return { landUseClass: 'leisure_recreation', confidence: H }
  }

  if (leisure) {
    if (inSet(leisure, 'park', 'garden', 'nature_reserve', 'common', 'dog_park', 'recreation_ground'))
      return { landUseClass: 'leisure_recreation', confidence: H }
    if (inSet(leisure, 'pitch', 'sports_centre', 'stadium', 'track', 'golf_course', 'swimming_pool', 'fitness_centre', 'playground', 'water_park', 'marina', 'sports_hall'))
      return { landUseClass: 'leisure_recreation', confidence: H }
  }

  // --- Explicit land use (high) -----------------------------------------------
  if (landuse) {
    if (landuse === 'residential') return { landUseClass: 'residential', confidence: H }
    if (landuse === 'retail') return { landUseClass: 'retail', confidence: H }
    if (landuse === 'commercial') return { landUseClass: 'commercial', confidence: H }
    if (landuse === 'industrial') return { landUseClass: 'industrial', confidence: H }
    if (inSet(landuse, 'warehouse', 'depot', 'logistics')) return { landUseClass: 'storage_distribution', confidence: H }
    if (inSet(landuse, 'farmland', 'farmyard', 'orchard', 'vineyard', 'allotments', 'greenhouse_horticulture', 'animal_keeping', 'plant_nursery', 'meadow'))
      return { landUseClass: 'agricultural', confidence: H }
    if (inSet(landuse, 'forest', 'grass', 'greenfield', 'village_green', 'flowerbed', 'scrub'))
      return { landUseClass: 'natural', confidence: H }
    if (inSet(landuse, 'reservoir', 'basin', 'water')) return { landUseClass: 'natural', confidence: H }
    if (landuse === 'recreation_ground') return { landUseClass: 'leisure_recreation', confidence: H }
    if (landuse === 'brownfield') return { landUseClass: 'vacant_or_brownfield', confidence: H }
    if (landuse === 'construction') return { landUseClass: 'construction', confidence: H }
    if (inSet(landuse, 'landfill', 'quarry')) return { landUseClass: 'industrial', confidence: H }
    if (landuse === 'railway') return { landUseClass: 'transport', confidence: H }
    if (inSet(landuse, 'garages', 'garage')) return { landUseClass: 'parking', confidence: H }
    if (inSet(landuse, 'cemetery', 'grave_yard', 'religious')) return { landUseClass: 'community', confidence: H }
  }

  // --- Natural / water / infrastructure (high) --------------------------------
  if (natural && inSet(natural, 'wood', 'tree_row', 'scrub', 'heath', 'grassland', 'moor', 'fell', 'water', 'wetland', 'bay', 'beach', 'sand', 'mud'))
    return { landUseClass: 'natural', confidence: H }
  if (t.waterway) return { landUseClass: 'natural', confidence: H }

  if (manMade) {
    if (manMade === 'works') return { landUseClass: 'industrial', confidence: H }
    if (inSet(manMade, 'wastewater_plant', 'water_works', 'water_tower', 'storage_tank', 'pumping_station', 'gasometer', 'reservoir_covered'))
      return { landUseClass: 'utility', confidence: H }
  }
  if (power) {
    if (inSet(power, 'plant', 'substation')) return { landUseClass: 'utility', confidence: H }
    // A generator is utility land use only as an AREA (station/solar farm); as a point it
    // is a rooftop PV panel — noise. Points fall through to unknown.
    if (power === 'generator' && kind !== 'point') return { landUseClass: 'utility', confidence: H }
  }
  if (railway && inSet(railway, 'station', 'rail', 'platform', 'tram_stop', 'halt')) return { landUseClass: 'transport', confidence: H }
  if (t.aeroway || t.aerodrome) return { landUseClass: 'transport', confidence: H }

  // --- Typed building footprint (medium — describes the structure) ------------
  if (building && building !== 'yes' && building !== 'no') {
    if (inSet(building, 'house', 'residential', 'apartments', 'detached', 'semidetached_house', 'terrace', 'bungalow', 'dormitory', 'houseboat', 'static_caravan', 'cabin'))
      return { landUseClass: 'residential', confidence: M }
    if (inSet(building, 'retail', 'supermarket', 'kiosk', 'shop')) return { landUseClass: 'retail', confidence: M }
    if (inSet(building, 'commercial', 'office')) return { landUseClass: 'commercial', confidence: M }
    if (inSet(building, 'industrial', 'factory', 'manufacture')) return { landUseClass: 'industrial', confidence: M }
    if (building === 'warehouse') return { landUseClass: 'storage_distribution', confidence: M }
    if (inSet(building, 'church', 'chapel', 'cathedral', 'mosque', 'temple', 'synagogue', 'religious', 'school', 'college', 'university', 'hospital', 'kindergarten', 'civic', 'public', 'government'))
      return { landUseClass: 'community', confidence: M }
    if (building === 'hotel') return { landUseClass: 'commercial', confidence: M }
    if (inSet(building, 'farm', 'farm_auxiliary', 'barn', 'cowshed', 'stable', 'sty', 'greenhouse', 'slurry_tank'))
      return { landUseClass: 'agricultural', confidence: M }
    if (inSet(building, 'garage', 'garages', 'carport', 'parking')) return { landUseClass: 'parking', confidence: M }
    if (inSet(building, 'train_station', 'transportation', 'hangar')) return { landUseClass: 'transport', confidence: M }
    // a typed-but-unrecognised building → unknown, do not guess
  }

  return null
}

/** A brownfield-register entry is, by definition, previously-developed land under
 *  active consideration for redevelopment — a strong `vacant_or_brownfield` signal. */
export function brownfieldClassification(): SourceClassification {
  return { landUseClass: 'vacant_or_brownfield', confidence: H }
}

/** An existing SiteMatcher store point means actively-occupied commercial premises.
 *  We map it to the broad `retail` class at MEDIUM confidence: it is firm evidence
 *  the parcel is OCCUPIED (not vacant/greenfield), but the store's own brand category
 *  (food vs shop vs services) is a refinement deliberately deferred — documented in
 *  the M5 findings so we never over-state what a store point tells us. */
export function storeClassification(): SourceClassification {
  return { landUseClass: 'retail', confidence: M }
}
