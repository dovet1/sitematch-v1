import {
  pointInGeometry,
  isInCatchment,
  haversineMeters,
  circleGeometry,
  geometryBounds,
} from '../geo'

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

describe('geometryBounds', () => {
  it('returns the bbox of a Polygon (holes included in the walk)', () => {
    expect(geometryBounds(squareWithHole)).toEqual([0, 0, 1, 1])
  })

  it('returns the combined bbox of a MultiPolygon', () => {
    expect(geometryBounds(twoSquares)).toEqual([0, 0, 11, 11])
  })

  it('handles negative longitudes', () => {
    const poly: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-2.5, 53.2],
          [-1.5, 53.2],
          [-1.5, 53.9],
          [-2.5, 53.9],
          [-2.5, 53.2],
        ],
      ],
    }
    expect(geometryBounds(poly)).toEqual([-2.5, 53.2, -1.5, 53.9])
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

  describe('circleGeometry', () => {
    it('returns a closed ring with steps+1 vertices', () => {
      const poly = circleGeometry(-1.5, 53.8, 5, 72)
      expect(poly.type).toBe('Polygon')
      const ring = poly.coordinates[0]
      expect(ring).toHaveLength(73)
      expect(ring[0]).toEqual(ring[ring.length - 1])
    })

    it('places every vertex approximately radiusKm from the centre', () => {
      const lng = -1.5
      const lat = 53.8
      const radiusKm = 5
      const ring = circleGeometry(lng, lat, radiusKm).coordinates[0]
      for (const [vLng, vLat] of ring) {
        const dMeters = haversineMeters(lat, lng, vLat, vLng)
        // ~1% tolerance for the equirectangular approximation used by the util.
        expect(dMeters).toBeGreaterThan(radiusKm * 1000 * 0.99)
        expect(dMeters).toBeLessThan(radiusKm * 1000 * 1.01)
      }
    })
  })
})
