import { displayGeometry, radiusLabel, radiusPatch, validatePatchGeometry, type PatchGeometry } from '../geometry'

const square = (west: number, south: number, size: number): number[][] => [
  [west, south], [west + size, south], [west + size, south + size], [west, south + size], [west, south],
]

describe('validatePatchGeometry', () => {
  it('accepts a closed polygon in the UK', () => {
    const result = validatePatchGeometry({ type: 'Polygon', coordinates: [square(-1.6, 53.78, 0.05)] })
    expect(result.ok).toBe(true)
  })

  it('accepts a polygon with a hole inside its outline', () => {
    const result = validatePatchGeometry({ type: 'Polygon', coordinates: [square(-1.6, 53.78, 0.1), square(-1.57, 53.8, 0.02)] })
    expect(result.ok).toBe(true)
  })

  it('rejects a hole outside its outline', () => {
    const result = validatePatchGeometry({ type: 'Polygon', coordinates: [square(-1.6, 53.78, 0.05), square(-1.3, 53.9, 0.02)] })
    expect(result).toMatchObject({ ok: false })
  })

  it('rejects an unclosed ring', () => {
    const ring = square(-1.6, 53.78, 0.05).slice(0, 4).concat([[-1.6, 53.781]])
    expect(validatePatchGeometry({ type: 'Polygon', coordinates: [ring] })).toMatchObject({ ok: false, error: expect.stringContaining('closed') })
  })

  it('rejects a self-intersecting bow tie', () => {
    const bowTie = [[-1.6, 53.78], [-1.5, 53.88], [-1.5, 53.78], [-1.6, 53.88], [-1.6, 53.78]]
    expect(validatePatchGeometry({ type: 'Polygon', coordinates: [bowTie] })).toMatchObject({ ok: false })
  })

  it('rejects coordinates outside the UK, including swapped lat/lng', () => {
    expect(validatePatchGeometry({ type: 'Polygon', coordinates: [square(53.78, -1.6, 0.05)] })).toMatchObject({ ok: false })
  })

  it('rejects oversized payloads before parsing', () => {
    expect(validatePatchGeometry({}, 3_000_000)).toMatchObject({ ok: false, error: expect.stringContaining('too large') })
  })

  it('takes polygons out of an uploaded FeatureCollection', () => {
    const upload = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [square(-1.6, 53.78, 0.05)] } },
        { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [square(-1.4, 53.78, 0.05)] } },
      ],
    }
    const result = validatePatchGeometry(upload)
    expect(result.ok && result.geometry.type).toBe('MultiPolygon')
  })

  it('refuses points and lines', () => {
    expect(validatePatchGeometry({ type: 'Point', coordinates: [-1.6, 53.8] })).toMatchObject({ ok: false })
  })

  it('refuses a vertex count above the limit', () => {
    const ring: number[][] = []
    for (let i = 0; i < 20_001; i++) {
      const a = (i / 20_001) * 2 * Math.PI
      ring.push([-1.5 + 0.1 * Math.cos(a), 53.8 + 0.1 * Math.sin(a)])
    }
    ring.push([...ring[0]])
    expect(validatePatchGeometry({ type: 'Polygon', coordinates: [ring] })).toMatchObject({ ok: false, error: expect.stringContaining('too many points') })
  })
})

describe('displayGeometry', () => {
  it('leaves light outlines untouched and simplifies heavy ones', () => {
    const light: PatchGeometry = { type: 'Polygon', coordinates: [square(-1.6, 53.78, 0.05)] }
    expect(displayGeometry(light)).toBe(light)
    const ring: number[][] = []
    for (let i = 0; i < 5000; i++) {
      const a = (i / 5000) * 2 * Math.PI
      ring.push([-1.5 + 0.1 * Math.cos(a), 53.8 + 0.1 * Math.sin(a)])
    }
    ring.push([...ring[0]])
    const heavy = displayGeometry({ type: 'Polygon', coordinates: [ring] }) as GeoJSON.Polygon
    expect(heavy.coordinates[0].length).toBeLessThanOrEqual(1500)
  })
})

describe('radiusPatch', () => {
  it('builds a closed, valid circle', () => {
    const result = radiusPatch({ lng: -1.55, lat: 53.8 }, 3000)
    expect(result.ok).toBe(true)
  })

  it('rejects an out-of-range radius', () => {
    expect(radiusPatch({ lng: -1.55, lat: 53.8 }, 100_000).ok).toBe(false)
  })

  it('labels a radius as a radius', () => {
    expect(radiusLabel('Leeds', 4828)).toBe('Leeds · 3.0 mi radius')
  })
})
