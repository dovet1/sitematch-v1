// Client-side fetch wrappers over the existing requirement endpoints.
// v1 introduces no new API routes. Both are public: the requirement directory
// map endpoint (same one the /search "Live requirements" page uses) and the
// approved-only listing detail endpoint. These centralize error handling and
// wire-shape parsing.

import type {
  RequirementLocation,
  RequirementDetail,
} from '../../types/unified-workspace'

// UK-wide bounds. The requirement map endpoint returns the whole eligible set
// (it does not spatially filter server-side), so we fetch once and filter
// client-side by proximity.
const UK_BOUNDS = { north: 60.9, south: 49.8, east: 2.0, west: -8.7 }

// A GeoJSON feature from /api/public/listings/map (getRequirementMapFeatures).
interface RequirementMapFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    id: string
    location_id: string
    company_name: string
    title: string | null
    listing_type: string | null
    place_name: string | null
    formatted_address: string | null
  }
}

export async function fetchRequirementLocations(
  signal?: AbortSignal
): Promise<RequirementLocation[]> {
  const { north, south, east, west } = UK_BOUNDS
  // Use the same public directory-map route as the browse-requirements page so
  // the workspace shows the same requirements (rather than the Plus-gated
  // gapfinder route, which 403s for non-Plus sessions).
  const url = `/api/public/listings/map?north=${north}&south=${south}&east=${east}&west=${west}&clustering=false`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`requirement map failed (${res.status})`)
  // The route returns { geojson: { features }, ... }; the mock fallback returns
  // { results }. Normal operation returns geojson.
  const data = await res.json()
  const features = (data.geojson?.features ?? []) as RequirementMapFeature[]
  return features.map((f) => ({
    id: f.properties.location_id,
    listingId: f.properties.id,
    companyName: f.properties.company_name,
    title: f.properties.title,
    listingType: f.properties.listing_type,
    placeName: f.properties.place_name,
    formattedAddress: f.properties.formatted_address,
    coordinates: { lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] },
  }))
}

export async function fetchRequirementDetail(
  listingId: string,
  signal?: AbortSignal
): Promise<RequirementDetail> {
  const res = await fetch(`/api/public/listings/${listingId}/detailed`, {
    signal,
  })
  if (!res.ok) throw new Error(`listing detail failed (${res.status})`)
  return (await res.json()) as RequirementDetail
}
