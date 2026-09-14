// Inbound boundary validation for /api/public/planning. It fails closed before any database
// read, so a malformed or oversized geometry never reaches the spatial query.

import area from '@turf/area'

export const MAX_REQUEST_AREA_M2 = 5e9 // 5,000 km² — reject outright
export const MAX_INBOUND_VERTICES = 50_000
export const MAX_BODY_BYTES = 1_000_000
export const UK_LON: [number, number] = [-9, 3]
export const UK_LAT: [number, number] = [49, 61]

export type Boundary = GeoJSON.Polygon | GeoJSON.MultiPolygon

function eachRing(geom: Boundary, visit: (ring: number[][]) => void) {
  if (geom.type === 'Polygon') {
    ;(geom.coordinates as number[][][]).forEach(visit)
  } else {
    ;(geom.coordinates as number[][][][]).forEach((poly) => poly.forEach(visit))
  }
}

// Returns an error message, or null when the geometry is acceptable.
export function validateBoundary(geom: unknown): string | null {
  if (!geom || typeof geom !== 'object') return 'Missing boundary geometry'
  const g = geom as { type?: string; coordinates?: unknown }
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') {
    return 'Boundary must be a GeoJSON Polygon or MultiPolygon'
  }
  if (!Array.isArray(g.coordinates)) return 'Boundary has no coordinates'

  let vertices = 0
  let coordsOk = true
  try {
    eachRing(g as Boundary, (ring) => {
      if (!Array.isArray(ring)) throw new Error('bad ring')
      for (const pos of ring) {
        if (!Array.isArray(pos) || pos.length < 2) throw new Error('bad position')
        const [lng, lat] = pos
        if (
          typeof lng !== 'number' ||
          typeof lat !== 'number' ||
          !Number.isFinite(lng) ||
          !Number.isFinite(lat) ||
          lng < UK_LON[0] ||
          lng > UK_LON[1] ||
          lat < UK_LAT[0] ||
          lat > UK_LAT[1]
        ) {
          coordsOk = false
        }
        vertices++
      }
    })
  } catch {
    return 'Boundary coordinates are malformed'
  }
  if (!coordsOk) return 'Boundary coordinates must be finite lon/lat within the UK'
  if (vertices === 0) return 'Boundary has no coordinates'
  if (vertices > MAX_INBOUND_VERTICES) return 'Boundary has too many vertices'
  if (area(geom as Boundary) > MAX_REQUEST_AREA_M2) return 'Boundary area is too large'
  return null
}
