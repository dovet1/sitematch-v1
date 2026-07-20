/**
 * @jest-environment node
 */

/**
 * Opt-in integration test against the real PlanIt API.
 *
 * Runs in the node environment (not the project default jsdom) because it
 * needs a real global `fetch` and undici's streaming stack.
 *
 * Excluded from CI and from the default run: it makes real network calls to a
 * small, free, donation-funded service and takes tens of seconds. Run with:
 *
 *   PLANIT_LIVE=1 npx jest planit.live
 *
 * This exists because every other test in this directory mocks `fetch`, which
 * is exactly why the tab could be uniformly broken in production while the
 * suite stayed green. The bug it guards against: PlanIt's spatial (bbox) query
 * times out at 45s over any built-up area, so a dense location returned zero
 * applications with a truncation warning at every single location.
 */

const LIVE = process.env.PLANIT_LIVE === '1'
const describeLive = LIVE ? describe : describe.skip

// Real network + PlanIt's own latency, plus a retry budget.
jest.setTimeout(180_000)

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

// Central London — the previously-failing case. Small enough to be a realistic
// "assess this area" request, dense enough to have broken the old bbox path.
const CENTRAL_LONDON = rect(-0.14, 51.498, -0.115, 51.517)
// Rural Derbyshire — the control that always worked, guarding against a
// regression that only shows up where the old path happened to succeed.
const RURAL_DERBYSHIRE = rect(-1.6, 53.0, -1.55, 53.04)

describeLive('PlanIt integration (live network)', () => {
  // Imported lazily so the module's caches are fresh per run.
  const loadModule = () => {
    let mod: typeof import('../planit')
    jest.isolateModules(() => {
      mod = require('../planit')
    })
    return mod!
  }

  it('returns a complete, untruncated result for a dense urban area', async () => {
    const { fetchPlanningApplications } = loadModule()
    const result = await fetchPlanningApplications(CENTRAL_LONDON)

    // The whole point of the fix: no truncation warning in a city centre.
    expect(result.truncationReason).toBeNull()
    expect(result.truncated).toBe(false)
    // Every returned application must actually sit inside the boundary.
    for (const app of result.applications) {
      expect(app.lng).toBeGreaterThanOrEqual(-0.14)
      expect(app.lng).toBeLessThanOrEqual(-0.115)
      expect(app.lat).toBeGreaterThanOrEqual(51.498)
      expect(app.lat).toBeLessThanOrEqual(51.517)
    }
  })

  it('returns an untruncated result for a rural area (no regression)', async () => {
    const { fetchPlanningApplications } = loadModule()
    const result = await fetchPlanningApplications(RURAL_DERBYSHIRE)
    expect(result.truncationReason).toBeNull()
    expect(result.truncated).toBe(false)
  })

  it('resolves real planning authorities for a London boundary', async () => {
    const { fetchAuthorities } = loadModule()
    const { authorities } = await fetchAuthorities(CENTRAL_LONDON)

    expect(authorities.length).toBeGreaterThan(0)
    for (const authority of authorities) {
      expect(Number.isFinite(authority.id)).toBe(true)
      expect(authority.name).toBeTruthy()
    }
  })

  it('serves a repeated lookup from cache without new upstream calls', async () => {
    const { fetchPlanningApplications } = loadModule()
    const real = globalThis.fetch
    let calls = 0
    globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
      calls++
      return real(...args)
    }) as typeof fetch
    try {
      await fetchPlanningApplications(RURAL_DERBYSHIRE)
      const afterFirst = calls
      await fetchPlanningApplications(RURAL_DERBYSHIRE)
      expect(calls).toBe(afterFirst)
    } finally {
      globalThis.fetch = real
    }
  })
})

// Keeps the file a valid module when the suite is skipped.
export {}
