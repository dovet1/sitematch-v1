import {
  brownfieldClassification,
  classifyOsmTags,
  normaliseTags,
  storeClassification,
} from '../land-use-classification'

describe('normaliseTags', () => {
  it('lower-cases keys and values and drops empties', () => {
    expect(normaliseTags({ Landuse: 'Residential', Name: 'X', empty: '', missing: null })).toEqual({
      landuse: 'residential',
      name: 'x',
    })
  })
})

describe('classifyOsmTags — explicit points of use (high)', () => {
  it('a shop is retail', () => {
    expect(classifyOsmTags({ shop: 'supermarket' })).toEqual({ landUseClass: 'retail', confidence: 'high' })
  })
  it('shop=no is ignored', () => {
    expect(classifyOsmTags({ shop: 'no' })).toBeNull()
  })
  it('amenity=pub is pub_bar', () => {
    expect(classifyOsmTags({ amenity: 'pub' })).toEqual({ landUseClass: 'pub_bar', confidence: 'high' })
  })
  it('amenity=fuel is fuel', () => {
    expect(classifyOsmTags({ amenity: 'fuel' })).toEqual({ landUseClass: 'fuel', confidence: 'high' })
  })
  it('amenity=fast_food is food_drink', () => {
    expect(classifyOsmTags({ amenity: 'fast_food' })).toEqual({ landUseClass: 'food_drink', confidence: 'high' })
  })
  it('amenity=parking is parking', () => {
    expect(classifyOsmTags({ amenity: 'parking' })).toEqual({ landUseClass: 'parking', confidence: 'high' })
  })
  it('amenity=school is community', () => {
    expect(classifyOsmTags({ amenity: 'school' })).toEqual({ landUseClass: 'community', confidence: 'high' })
  })
  it('office is commercial', () => {
    expect(classifyOsmTags({ office: 'company' })).toEqual({ landUseClass: 'commercial', confidence: 'high' })
  })
  it('tourism=hotel is commercial', () => {
    expect(classifyOsmTags({ tourism: 'hotel' })).toEqual({ landUseClass: 'commercial', confidence: 'high' })
  })
  it('leisure=park is leisure_recreation', () => {
    expect(classifyOsmTags({ leisure: 'park' })).toEqual({ landUseClass: 'leisure_recreation', confidence: 'high' })
  })
})

describe('classifyOsmTags — explicit land use (high)', () => {
  it.each([
    ['residential', 'residential'],
    ['retail', 'retail'],
    ['commercial', 'commercial'],
    ['industrial', 'industrial'],
    ['warehouse', 'storage_distribution'],
    ['farmland', 'agricultural'],
    ['forest', 'natural'],
    ['brownfield', 'vacant_or_brownfield'],
    ['construction', 'construction'],
    ['quarry', 'industrial'],
    ['railway', 'transport'],
    ['garages', 'parking'],
    ['cemetery', 'community'],
    ['recreation_ground', 'leisure_recreation'],
  ])('landuse=%s → %s', (landuse, expected) => {
    expect(classifyOsmTags({ landuse })).toEqual({ landUseClass: expected, confidence: 'high' })
  })
})

describe('classifyOsmTags — natural / infrastructure (high)', () => {
  it('natural=water is natural', () => {
    expect(classifyOsmTags({ natural: 'water' })).toEqual({ landUseClass: 'natural', confidence: 'high' })
  })
  it('man_made=works is industrial', () => {
    expect(classifyOsmTags({ man_made: 'works' })).toEqual({ landUseClass: 'industrial', confidence: 'high' })
  })
  it('power=substation is utility', () => {
    expect(classifyOsmTags({ power: 'substation' })).toEqual({ landUseClass: 'utility', confidence: 'high' })
  })
  it('power=generator is utility as a polygon (solar farm / station)', () => {
    expect(classifyOsmTags({ power: 'generator' }, 'polygon')).toEqual({ landUseClass: 'utility', confidence: 'high' })
  })
  it('power=generator as a POINT is not classified (rooftop PV noise)', () => {
    expect(classifyOsmTags({ power: 'generator' }, 'point')).toBeNull()
  })
})

describe('classifyOsmTags — typed building footprint (medium)', () => {
  it('building=house is residential (medium)', () => {
    expect(classifyOsmTags({ building: 'house' })).toEqual({ landUseClass: 'residential', confidence: 'medium' })
  })
  it('building=warehouse is storage_distribution (medium)', () => {
    expect(classifyOsmTags({ building: 'warehouse' })).toEqual({ landUseClass: 'storage_distribution', confidence: 'medium' })
  })
  it('building=church is community (medium)', () => {
    expect(classifyOsmTags({ building: 'church' })).toEqual({ landUseClass: 'community', confidence: 'medium' })
  })
})

describe('classifyOsmTags — unknown stays unknown (null, never a class)', () => {
  it('bare building=yes is not classified', () => {
    expect(classifyOsmTags({ building: 'yes' })).toBeNull()
  })
  it('a typed-but-unrecognised building is not guessed', () => {
    expect(classifyOsmTags({ building: 'somethingelse' })).toBeNull()
  })
  it('empty tags are unknown', () => {
    expect(classifyOsmTags({})).toBeNull()
  })
  it('an unrecognised amenity with no other signal is unknown', () => {
    expect(classifyOsmTags({ amenity: 'bench' })).toBeNull()
  })
})

describe('classifyOsmTags — precedence', () => {
  it('an explicit shop beats a residential building tag on the same feature', () => {
    // A shop in a converted house: the USE (shop) wins over the structure (house).
    expect(classifyOsmTags({ shop: 'convenience', building: 'house' })).toEqual({
      landUseClass: 'retail',
      confidence: 'high',
    })
  })
  it('a typed building only applies when no explicit use/landuse is present', () => {
    expect(classifyOsmTags({ landuse: 'residential', building: 'warehouse' })).toEqual({
      landUseClass: 'residential',
      confidence: 'high',
    })
  })
})

describe('brownfield + store classifications', () => {
  it('brownfield register → vacant_or_brownfield (high)', () => {
    expect(brownfieldClassification()).toEqual({ landUseClass: 'vacant_or_brownfield', confidence: 'high' })
  })
  it('store point → retail (medium, deliberately coarse)', () => {
    expect(storeClassification()).toEqual({ landUseClass: 'retail', confidence: 'medium' })
  })
})
