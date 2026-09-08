import {
  profileEligibility,
  profilePublication,
  PROFILE_MIN_SAMPLE,
} from '../profile-eligibility'

const row = (over: Partial<Parameters<typeof profileEligibility>[0]> = {}) => ({
  confidence: 'high',
  floor_area_m2: 120,
  size_plausibility: 'plausible',
  ...over,
})

describe('profileEligibility', () => {
  it('counts a high-confidence row carrying an area', () => {
    const r = profileEligibility(row())
    expect(r.counts).toBe(true)
    expect(r.reason).toBeNull()
  })

  it('reports a store that has never been matched', () => {
    const r = profileEligibility(null)
    expect(r.counts).toBe(false)
    expect(r.reason).toBe('never-matched')
  })

  it.each(['medium', 'low', 'none'])('excludes confidence=%s', (confidence) => {
    const r = profileEligibility(row({ confidence }))
    expect(r.counts).toBe(false)
    expect(r.reason).toBe('low-confidence')
    expect(r.headline).toContain(confidence)
  })

  // The demotion rule rewrites confidence to 'low' as well as setting size_plausibility,
  // so both fields describe a demoted row. Reporting it as merely low-confidence would
  // hide that the matcher found a certificate and then rejected its area.
  it('reports a demoted row as demoted, not as low confidence', () => {
    const r = profileEligibility(row({ confidence: 'low', size_plausibility: 'implausible' }))
    expect(r.reason).toBe('demoted')
  })

  it('excludes a high-confidence row with no area', () => {
    const r = profileEligibility(row({ floor_area_m2: null }))
    expect(r.counts).toBe(false)
    expect(r.reason).toBe('no-area')
  })
})

describe('profilePublication', () => {
  it('publishes at the floor', () => {
    expect(profilePublication(PROFILE_MIN_SAMPLE, 'fascia').published).toBe(true)
  })

  it('does not publish below it', () => {
    const r = profilePublication(PROFILE_MIN_SAMPLE - 1, 'fascia')
    expect(r.published).toBe(false)
    expect(r.detail).toContain('individual measured shops')
  })

  it('singularises one shop', () => {
    expect(profilePublication(1, 'brand').detail).toContain('1 measured shop —')
  })
})
