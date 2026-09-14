import { validateBoundary } from '../boundary'

function rect(
  minLon: number,
  minLat: number,
  maxLon: number,
  maxLat: number
): GeoJSON.Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ],
    ],
  }
}

// A many-vertex ellipse (degree-space circle, lat-corrected) around a centre.
function circleOf(
  cx: number,
  cy: number,
  radiusDeg: number,
  points: number
): GeoJSON.Polygon {
  const ring: [number, number][] = []
  const lonScale = 1 / Math.cos((cy * Math.PI) / 180)
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * 2 * Math.PI
    ring.push([cx + radiusDeg * lonScale * Math.cos(t), cy + radiusDeg * Math.sin(t)])
  }
  return { type: 'Polygon', coordinates: [ring] }
}

const SMALL = rect(-1.6, 53.0, -1.55, 53.04)

describe('validateBoundary', () => {
  it('rejects non-polygon geometry types', () => {
    expect(
      validateBoundary({ type: 'LineString', coordinates: [[0, 51], [1, 51]] })
    ).toMatch(/Polygon/)
    expect(validateBoundary({ type: 'Point', coordinates: [0, 51] })).toMatch(
      /Polygon/
    )
    expect(validateBoundary(null)).toBeTruthy()
    expect(validateBoundary('boundary')).toBeTruthy()
  })

  it('rejects non-finite and out-of-UK coordinates', () => {
    const nan = rect(-1.6, 53.0, -1.55, 53.04)
    nan.coordinates[0][1][0] = NaN
    expect(validateBoundary(nan)).toMatch(/finite/)

    expect(validateBoundary(rect(10, 53, 10.1, 53.1))).toMatch(/within the UK/)
    expect(validateBoundary(rect(-1.6, 30, -1.55, 30.1))).toMatch(/within the UK/)
  })

  it('rejects a polygon with too many vertices', () => {
    expect(validateBoundary(circleOf(-1.5, 53.5, 0.01, 50_001))).toMatch(
      /too many vertices/
    )
  })

  it('rejects an oversized area but accepts a small polygon', () => {
    // ~10° × 10° inside UK bounds — far over MAX_REQUEST_AREA_M2.
    expect(validateBoundary(rect(-8, 50, 2, 60))).toMatch(/area is too large/)
    expect(validateBoundary(SMALL)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Upstream error classification
// ---------------------------------------------------------------------------
