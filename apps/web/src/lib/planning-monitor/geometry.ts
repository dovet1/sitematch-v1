import area from '@turf/area'
import booleanValid from '@turf/boolean-valid'
import simplify from '@turf/simplify'
import { UK_LAT, UK_LON } from '@/app/api/public/planning/boundary'
import { circleGeometry, pointInGeometry } from '@/app/sitematcher-unified/lib/geo'

/**
 * Patch geometry intake. A patch is saved exactly as the user supplied it; a simplified copy is
 * kept separately for drawing. The database re-checks validity with PostGIS on save, so these
 * checks exist to give a clear message early, not as the only line of defence.
 */

export type PatchGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon
export type PatchSource = 'drawn' | 'uploaded' | 'boundary' | 'radius'

export const MAX_PATCH_BYTES = 2_000_000
export const MAX_PATCH_VERTICES = 20_000
/** Large enough for a regional patch (South East England is about 19,000 km²). */
export const MAX_PATCH_AREA_M2 = 30_000e6
export const MIN_PATCH_AREA_M2 = 10_000
export const DISPLAY_VERTEX_TARGET = 1_500
export const MIN_RADIUS_METERS = 250
export const MAX_RADIUS_METERS = 50_000

export type PatchGeometryResult =
  | { ok: true; geometry: PatchGeometry; display: PatchGeometry; vertices: number; areaM2: number }
  | { ok: false; error: string }

function polygonsOf(value: unknown): number[][][][] | string {
  if (!value || typeof value !== 'object') return 'No geometry was supplied'
  const node = value as { type?: string; coordinates?: unknown; geometry?: unknown; features?: unknown; geometries?: unknown }
  switch (node.type) {
    case 'Polygon':
      return Array.isArray(node.coordinates) ? [node.coordinates as number[][][]] : 'The polygon has no coordinates'
    case 'MultiPolygon':
      return Array.isArray(node.coordinates) ? (node.coordinates as number[][][][]) : 'The multipolygon has no coordinates'
    case 'Feature':
      return polygonsOf(node.geometry)
    case 'FeatureCollection':
    case 'GeometryCollection': {
      const items = (node.type === 'FeatureCollection' ? node.features : node.geometries) as unknown[]
      if (!Array.isArray(items) || items.length === 0) return 'The file contains no shapes'
      const all: number[][][][] = []
      for (const item of items) {
        const polygons = polygonsOf(item)
        if (typeof polygons === 'string') return polygons
        all.push(...polygons)
      }
      return all
    }
    default:
      return 'Only Polygon or MultiPolygon areas can be used as a patch'
  }
}

function checkRings(polygons: number[][][][]): { vertices: number } | string {
  let vertices = 0
  if (polygons.length === 0) return 'The area has no polygons'
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || polygon.length === 0) return 'A polygon has no rings'
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) return 'Each ring needs at least three distinct points'
      for (const position of ring) {
        if (!Array.isArray(position) || position.length < 2) return 'The area has a malformed coordinate'
        const [lng, lat] = position
        if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lng) || !Number.isFinite(lat)) {
          return 'The area has a malformed coordinate'
        }
        if (lng < UK_LON[0] || lng > UK_LON[1] || lat < UK_LAT[0] || lat > UK_LAT[1]) {
          return 'The area must lie within the UK (longitude/latitude, WGS84)'
        }
        vertices++
      }
      const first = ring[0]
      const last = ring[ring.length - 1]
      if (first[0] !== last[0] || first[1] !== last[1]) return 'Each ring must be closed (first and last points equal)'
    }
  }
  return { vertices }
}

function countVertices(geometry: PatchGeometry): number {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.reduce((sum, polygon) => sum + polygon.reduce((n, ring) => n + ring.length, 0), 0)
}

/** Validate an untrusted drawing, upload or boundary. `byteLength` is the size of the original payload, when known. */
export function validatePatchGeometry(input: unknown, byteLength?: number): PatchGeometryResult {
  if (byteLength != null && byteLength > MAX_PATCH_BYTES) return { ok: false, error: 'The area file is too large (2 MB limit)' }
  const polygons = polygonsOf(input)
  if (typeof polygons === 'string') return { ok: false, error: polygons }
  const rings = checkRings(polygons)
  if (typeof rings === 'string') return { ok: false, error: rings }
  if (rings.vertices > MAX_PATCH_VERTICES) {
    return { ok: false, error: `The area has too many points (${rings.vertices.toLocaleString('en-GB')}; limit ${MAX_PATCH_VERTICES.toLocaleString('en-GB')})` }
  }

  const geometry: PatchGeometry =
    polygons.length === 1 ? { type: 'Polygon', coordinates: polygons[0] } : { type: 'MultiPolygon', coordinates: polygons }

  // Self-intersections, holes outside their shell and overlapping parts all fail here.
  let valid = false
  try {
    valid = booleanValid(geometry)
  } catch {
    valid = false
  }
  // boolean-valid does not test hole containment; a hole must lie within its own outline.
  const holesInside = polygons.every(([shell, ...holes]) =>
    holes.every((hole) => hole.every(([lng, lat]) => pointInGeometry(lng, lat, { type: 'Polygon', coordinates: [shell] })))
  )
  if (!valid || !holesInside) {
    return { ok: false, error: 'The area is not a valid shape: check for crossing edges or holes outside the outline' }
  }

  const areaM2 = area(geometry)
  if (areaM2 < MIN_PATCH_AREA_M2) return { ok: false, error: 'The area is too small to monitor (minimum 1 hectare)' }
  if (areaM2 > MAX_PATCH_AREA_M2) return { ok: false, error: 'The area is too large (maximum 30,000 km²)' }

  return { ok: true, geometry, display: displayGeometry(geometry, rings.vertices), vertices: rings.vertices, areaM2 }
}

/** A lighter copy for the map. Never used for matching. */
export function displayGeometry(geometry: PatchGeometry, vertices = countVertices(geometry)): PatchGeometry {
  if (vertices <= DISPLAY_VERTEX_TARGET) return geometry
  // Tolerance in degrees; grow it until the outline is light enough to draw.
  for (const tolerance of [0.0001, 0.0003, 0.001, 0.003]) {
    const simplified = simplify(geometry, { tolerance, highQuality: false }) as PatchGeometry
    if (countVertices(simplified) <= DISPLAY_VERTEX_TARGET) return simplified
  }
  return simplify(geometry, { tolerance: 0.01, highQuality: false }) as PatchGeometry
}

/** A town or postcode point becomes an explicit radius patch, labelled as such, never as a boundary. */
export function radiusPatch(center: { lng: number; lat: number }, radiusMeters: number): PatchGeometryResult {
  if (!Number.isFinite(radiusMeters) || radiusMeters < MIN_RADIUS_METERS || radiusMeters > MAX_RADIUS_METERS) {
    return { ok: false, error: `Choose a radius between ${MIN_RADIUS_METERS} m and ${MAX_RADIUS_METERS / 1000} km` }
  }
  const circle = circleGeometry(center.lng, center.lat, radiusMeters / 1000)
  // The generated ring ends at sin(2π), which is not exactly zero; close it exactly.
  const ring = circle.coordinates[0]
  ring[ring.length - 1] = [...ring[0]]
  return validatePatchGeometry(circle)
}

export function radiusLabel(placeName: string, radiusMeters: number): string {
  const miles = radiusMeters / 1609.344
  return `${placeName} · ${miles >= 1 ? `${miles.toFixed(miles < 10 ? 1 : 0)} mi` : `${Math.round(radiusMeters)} m`} radius`
}
