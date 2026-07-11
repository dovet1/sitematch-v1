import { pointInGeometry, isInCatchment, haversineMeters } from '../geo'

// A unit square (lng/lat 0..1) with an inner hole (0.4..0.6).
const squareWithHole: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
    [
      [0.4, 0.4],
      [0.6, 0.4],
      [0.6, 0.6],
      [0.4, 0.6],
      [0.4, 0.4],
    ],
  ],
}

const twoSquares: GeoJSON.MultiPolygon = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
    [
      [
        [10, 10],
        [11, 10],
        [11, 11],
        [10, 11],
        [10, 10],
      ],
    ],
  ],
}

describe('pointInGeometry', () => {
  it('returns true for a point inside a Polygon', () => {
    expect(pointInGeometry(0.2, 0.2, squareWithHole)).toBe(true)
  })

  it('returns false for a point outside a Polygon', () => {
    expect(pointInGeometry(5, 5, squareWithHole)).toBe(false)
  })

  it('returns false for a point inside a hole', () => {
    expect(pointInGeometry(0.5, 0.5, squareWithHole)).toBe(false)
  })

  it('returns true when the point is in either sub-polygon of a MultiPolygon', () => {
    expect(pointInGeometry(0.5, 0.5, twoSquares)).toBe(true)
    expect(pointInGeometry(10.5, 10.5, twoSquares)).toBe(true)
    expect(pointInGeometry(5, 5, twoSquares)).toBe(false)
  })

  it('returns false for non-polygon geometries', () => {
    const point: GeoJSON.Point = { type: 'Point', coordinates: [0, 0] }
    expect(pointInGeometry(0, 0, point)).toBe(false)
  })
})

describe('isInCatchment', () => {
  // London-ish centre.
  const center = { lat: 51.5, lon: -0.12 }

  describe('radius fallback (no isochrone)', () => {
    it('returns true for a location within the radius', () => {
      // ~1km north of centre, radius 5km.
      const near = { lng: -0.12, lat: 51.509 }
      expect(haversineMeters(center.lat, center.lon, near.lat, near.lng)).toBeLessThan(5000)
      expect(isInCatchment(center, near.lng, near.lat, 5, null)).toBe(true)
    })

    it('returns false for a location just outside the radius', () => {
      // ~11km north of centre, radius 5km.
      const far = { lng: -0.12, lat: 51.6 }
      expect(haversineMeters(center.lat, center.lon, far.lat, far.lng)).toBeGreaterThan(5000)
      expect(isInCatchment(center, far.lng, far.lat, 5, null)).toBe(false)
    })
  })

  describe('polygon path (isochrone supplied)', () => {
    // A polygon well away from `center`, so radius would never include it.
    const polygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [10, 10],
          [11, 10],
          [11, 11],
          [10, 11],
          [10, 10],
        ],
      ],
    }

    it('includes a location inside the polygon even far beyond the radius', () => {
      const inside = { lng: 10.5, lat: 10.5 }
      // Radius=1km would exclude it; the polygon overrides.
      expect(isInCatchment(center, inside.lng, inside.lat, 1, polygon)).toBe(true)
    })

    it('excludes a location outside the polygon even if within the radius', () => {
      // Right on top of centre — within any radius, but outside the far polygon.
      const atCentre = { lng: center.lon, lat: center.lat }
      expect(isInCatchment(center, atCentre.lng, atCentre.lat, 50, polygon)).toBe(false)
    })
  })
})
