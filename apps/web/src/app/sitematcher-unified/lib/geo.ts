// Shared geo helpers for the unified workspace.

// Great-circle distance in metres between two [lat, lon] points.
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Ray-casting test for a [lng,lat] point against a single ring.
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// A polygon = outer ring minus holes; test against outer, exclude holes.
function pointInPolygonRings(lng: number, lat: number, rings: number[][][]): boolean {
  if (rings.length === 0) return false
  if (!pointInRing(lng, lat, rings[0])) return false
  for (let h = 1; h < rings.length; h++) {
    if (pointInRing(lng, lat, rings[h])) return false
  }
  return true
}

// Point-in-polygon for GeoJSON Polygon / MultiPolygon geometries.
export function pointInGeometry(
  lng: number,
  lat: number,
  geom: GeoJSON.Geometry
): boolean {
  if (geom.type === 'Polygon') {
    return pointInPolygonRings(lng, lat, geom.coordinates as number[][][])
  }
  if (geom.type === 'MultiPolygon') {
    return (geom.coordinates as number[][][][]).some((poly) =>
      pointInPolygonRings(lng, lat, poly)
    )
  }
  return false
}

// True when a location falls inside the active catchment: the isochrone polygon
// when supplied (drive/walk), otherwise a straight-line radius circle (distance).
export function isInCatchment(
  center: { lat: number; lon: number },
  lng: number,
  lat: number,
  radiusKm: number,
  isochrone: GeoJSON.Geometry | null
): boolean {
  if (isochrone) return pointInGeometry(lng, lat, isochrone)
  return haversineMeters(center.lat, center.lon, lat, lng) <= radiusKm * 1000
}
