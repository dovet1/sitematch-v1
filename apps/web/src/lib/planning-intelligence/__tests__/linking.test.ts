import { buildCouncilLinkProfile, followOnKind, linkCouncilApplications, linksForApplication, lookupKeysFor, normaliseReference, referenceCore, resolverFor, type LinkableApplication } from '../linking'

let sequence = 0
function application(reference: string, description: string, overrides: Partial<LinkableApplication> = {}): LinkableApplication {
  sequence += 1
  return { id: overrides.id ?? `a${sequence}`, reference, description, ...overrides }
}

// A council's reference formats are learned from its own references, so each scenario carries
// enough ordinary applications in the same format for the shape to count.
function council(format: (n: number) => string, applications: LinkableApplication[]): LinkableApplication[] {
  const fillers = Array.from({ length: 6 }, (_, n) => application(format(n + 900), 'Single storey rear extension'))
  return [...applications, ...fillers]
}

// A council that numbers follow-ons off the parent's case number, shown by permissions with
// same-numbered condition submissions, as Glasgow's 25/02808/FUL and 25/02808/DOC01.
function reusingCouncil(format: (n: number) => string, applications: LinkableApplication[], suffixes = ['DOC01']): LinkableApplication[] {
  const pairs = Array.from({ length: 5 }, (_, n) => [
    application(`${format(n + 800)}/FUL`, 'Erection of a house', { postcode: `ZZ${n} 1AA` }),
    ...suffixes.map(suffix => application(`${format(n + 800)}/${suffix}`, 'Follow-on details', { postcode: `ZZ${n} 1AA` })),
  ]).flat()
  return [...applications, ...pairs]
}

const broadland = (n: number) => `2026/${String(n).padStart(4, '0')}`
const westminster = (n: number) => `26/${String(n).padStart(5, '0')}/FULL`

describe('followOnKind', () => {
  it.each([
    ['Variation of condition 2 of 2025/3495 to allow up to 20 users', 'amendment'],
    ['Non material amendment of 2024/3141 - landscaping provision', 'amendment'],
    ['Approval of reserved matters for appearance, landscaping, layout and scale', 'reserved_matters'],
    ['Details reserved by Condition 5 of 2025/0103 - Construction Water Management Plan', 'condition'],
    ['Discharge of conditions 3 and 4 of reserved matters approval 2025/0042', 'condition'],
    ['Details of external materials pursuant to condition 4 of planning permission dated 22/04/2026', 'condition'],
  ])('reads "%s" as %s', (description, kind) => {
    expect(followOnKind({ description, procedure: 'full' })).toBe(kind)
  })

  it('falls back to the procedure when the wording says nothing', () => {
    expect(followOnKind({ description: 'Site layout fire hydrant locations', procedure: 'discharge' })).toBe('condition')
    expect(followOnKind({ description: 'Erection of a warehouse', procedure: 'full' })).toBeNull()
  })
})

describe('linkCouncilApplications', () => {
  it('gathers follow-ons of a permission we do not hold into one family, like Broadland Business Park', () => {
    const members = [
      application('2026/0994', 'Details for condition 9 - Travel Plan of permission 2024/3141', { procedure: 'discharge' }),
      application('2026/1998', 'Discharge of condition 14- PFS delivery times, of existing application 2024/3141.', { procedure: 'discharge' }),
      application('2026/2156', 'Details for condition 24 of 2024/3141 - (24) Site Layout Fire Hydrant Locations', { procedure: 'discharge' }),
      application('2026/2652', 'Non material amendment of 2024/3141 - minor amendments to mezzanine sizes', { procedure: 'amendment' }),
    ]
    const { links, families } = linkCouncilApplications(council(broadland, members))

    expect(links.filter(link => link.strength === 'strong').map(link => link.kind).sort())
      .toEqual(['amendment', 'condition', 'condition', 'condition'])
    expect(families).toHaveLength(1)
    expect(families[0]).toMatchObject({ rootId: null, missingParentReferences: ['2024/3141'] })
    expect(families[0].applicationIds.sort()).toEqual(members.map(member => member.id).sort())
  })

  it('links to a stored parent and does not mistake a date for a reference', () => {
    const parent = application('2026/0443', 'Alterations including removal of existing dormer extensions', { procedure: 'full' })
    const child = application('2026/2482',
      'Details of external materials pursuant to condition 4 of planning permission dated 22/04/2026 ref. 2026/0443', { procedure: 'full' })
    const { links, families } = linkCouncilApplications(council(broadland, [parent, child]))

    expect(links).toEqual([expect.objectContaining({ childId: child.id, parentId: parent.id, kind: 'condition', strength: 'strong' })])
    expect(families).toEqual([expect.objectContaining({ rootId: parent.id, missingParentReferences: [] })])
  })

  it('keeps an incidental mention as a weak link that joins nothing', () => {
    const neighbour = application('2025/1234', 'Erection of 12 dwellings', { procedure: 'full' })
    const child = application('2026/0101', 'Details of condition 3 for land adjacent to the site approved under 2025/1234')
    const { links, families } = linkCouncilApplications(council(broadland, [neighbour, child]))

    expect(links).toEqual([expect.objectContaining({ kind: 'cited', strength: 'weak', parentId: neighbour.id })])
    expect(families).toEqual([])
  })

  it('does not link an application that merely names another reference', () => {
    const other = application('2025/1234', 'Erection of 12 dwellings', { procedure: 'full' })
    const child = application('2026/0101', 'Erection of a single dwelling. See 2025/1234 for access arrangements', { procedure: 'full' })
    const { links, families } = linkCouncilApplications(council(broadland, [other, child]))

    expect(links.every(link => link.strength === 'weak')).toBe(true)
    expect(families).toEqual([])
  })

  it('treats a consent filed alongside a planning application as a companion', () => {
    const shopfront = application('26/07649/FULL', 'Replacement of shopfront. (Linked with 26/07650/ADV)', { procedure: 'full' })
    const signs = application('26/07650/ADV', 'Display of internally illuminated fascia and hanging signs', { procedure: 'advert-consent' })
    const { links, families } = linkCouncilApplications(council(westminster, [shopfront, signs, application('26/00001/ADV', 'Sign'),
      application('26/00002/ADV', 'Sign'), application('26/00003/ADV', 'Sign')]))

    expect(links).toContainEqual(expect.objectContaining({ childId: shopfront.id, parentId: signs.id, kind: 'companion', strength: 'strong' }))
    expect(families).toEqual([expect.objectContaining({ applicationIds: expect.arrayContaining([shopfront.id, signs.id]) })])
  })

  it('never reads use classes or appeal references as citations', () => {
    const child = application('2026/0200',
      'Details of condition 2 following appeal APP/L2630/W/25/3361234: change of use from B2/B8 to E(g)', { procedure: 'discharge' })
    expect(linkCouncilApplications(council(broadland, [child])).links).toEqual([])
  })

  it('groups follow-ons that carry their parent case number, as Glasgow numbers them', () => {
    const site = { postcode: 'G1 1AA' }
    const principal = application('25/02808/FUL', 'Erection of student accommodation', { procedure: 'full', ...site })
    const variation = application('25/02808/NMV01', 'Changes to window positions', { procedure: 'amendment', ...site })
    const discharge = application('25/02808/DOC01', 'Contaminated land report', { procedure: 'discharge', ...site })
    const glasgow = (n: number) => `25/${String(n).padStart(5, '0')}`
    const { links, families } = linkCouncilApplications(reusingCouncil(glasgow, [principal, variation, discharge], ['DOC01', 'NMV01']))

    expect(links.filter(link => [variation.id, discharge.id].includes(link.childId))
      .map(link => [link.childId, link.parentId, link.kind, link.source, link.strength])).toEqual([
      [variation.id, principal.id, 'amendment', 'reference_core', 'strong'],
      [discharge.id, principal.id, 'condition', 'reference_core', 'strong'],
    ])
    expect(families).toContainEqual(expect.objectContaining({ rootId: principal.id, applicationIds: expect.arrayContaining([variation.id, discharge.id]) }))
  })

  it('does not treat a condition submission\'s own running number as its parent, as Leeds numbers them', () => {
    const leeds = (n: number) => `26/${String(n).padStart(5, '0')}/FU`
    const discharge = application('26/01686/COND',
      'Consent, agreement or approval required by condition 7 (Sample Panel) of Planning Application 24/03592/FU', { procedure: 'discharge' })
    const { links, families } = linkCouncilApplications(council(leeds, [discharge]))

    expect(links).toEqual([expect.objectContaining({ source: 'cited_reference', parentReference: '24/03592/FU', strength: 'strong' })])
    expect(families).toEqual([expect.objectContaining({ missingParentReferences: ['24/03592/FU'] })])
  })

  it('links once to a parent quoted in another format, as Gateshead does', () => {
    const discharge = application('25/01202/DOC1', 'Discharge of condition 3 (Cycles) of planning application DC/25/01202/FUL.', { procedure: 'discharge' })
    const { links, families } = linkCouncilApplications([discharge])
    expect(links).toEqual([expect.objectContaining({ source: 'cited_reference', parentReference: 'DC/25/01202/FUL', strength: 'strong' })])
    expect(families).toEqual([expect.objectContaining({ applicationIds: [discharge.id], missingParentReferences: ['DC/25/01202/FUL'] })])
  })

  it('keeps a case-number link when the description quotes only the bare number', () => {
    const discharge = application('25/01202/DOC1', 'Discharge of condition 3 (Cycles) relating to 25/01202', { procedure: 'discharge' })
    const { families } = linkCouncilApplications(reusingCouncil(n => `25/${String(n).padStart(5, '0')}`, [discharge]))
    expect(families).toContainEqual(expect.objectContaining({ applicationIds: [discharge.id], missingParentReferences: ['25/01202'] }))
  })

  it('ignores case numbers at a council that numbers follow-ons independently, even with a same-numbered sibling', () => {
    const bath = (n: number) => `26/${String(n).padStart(5, '0')}`
    const others = Array.from({ length: 5 }, (_, n) => application(`${bath(n + 700)}/COND`,
      `Discharge of conditions 3 and 4 of application 24/0${n}104/FUL`, { procedure: 'discharge' }))
    const variation = application('26/02245/VAR', '26/02245/VAR - Variation of conditions 10 and 15 (Plans List)', { procedure: 'amendment', postcode: 'BA1 1AA' })
    const sibling = application('26/02245/LBC', 'Listed building consent for works', { procedure: 'listed-building', postcode: 'BA1 1AA' })
    const { links } = linkCouncilApplications(council(n => `${bath(n)}/FUL`, [...others, variation, sibling]))
    expect(links.filter(link => link.source === 'reference_core')).toEqual([])
  })

  it('measures reuse per suffix family, as Cambridge reuses condition and amendment-notice numbers but not section 73 numbers', () => {
    const cambridge = (n: number) => `25/${String(n).padStart(5, '0')}`
    const variations = Array.from({ length: 5 }, (_, n) => application(`${cambridge(n + 600)}/S73`,
      `S73 to vary condition 2 of ref: 24/0${n}259/FUL`, { procedure: 'amendment' }))
    const variation = application('26/01408/S73', 'S73 to vary condition 2 (approved drawings)', { procedure: 'amendment', postcode: 'CB1 1AA' })
    const variationSibling = application('26/01408/COND', 'Drainage details', { procedure: 'discharge', postcode: 'CB1 1AA' })
    const { links } = linkCouncilApplications(reusingCouncil(cambridge, [...variations, variation, variationSibling], ['DOC01', 'NMA1']))
    expect(links.filter(link => link.childId === variation.id && link.source === 'reference_core')).toEqual([])
  })

  it('ignores another authority\'s hyphenated reference and strips a glued "ref." label', () => {
    const consultation = application('RU.26/0735', 'Details of speed reduction measures submitted pursuant to condition 4, determined by Surrey County Council under their ref SCCRef-2026-0086', { procedure: 'discharge' })
    const thurrock = application('26/00878/CONDC', 'Approval of details reserved by condition no. 4 of planning permission ref.25/00552/FUL (Redevelopment)', { procedure: 'discharge' })
    expect(linkCouncilApplications([consultation]).links).toEqual([])
    expect(linkCouncilApplications([thurrock]).links).toEqual([expect.objectContaining({ parentReference: '25/00552/FUL', strength: 'strong' })])
  })

  it('never resolves a cited permission to a sibling condition submission', () => {
    const oxford = (n: number) => `26/${String(n).padStart(5, '0')}/FUL`
    const earlier = application('24/01333/CND2', 'Details submitted in compliance with condition 4 of planning permission 24/01333/FUL', { procedure: 'discharge' })
    const later = application('24/01333/CND', 'Details submitted in compliance with condition 3 (Materials) of planning permission 24/01333/FUL.', { procedure: 'discharge' })
    const { links, families } = linkCouncilApplications(council(oxford, [earlier, later]))

    expect(links.filter(link => link.source === 'cited_reference').map(link => link.parentId)).toEqual([null, null])
    expect(families).toHaveLength(1)
    expect(families[0]).toMatchObject({ rootId: null, missingParentReferences: ['24/01333/FUL'] })
    expect(families[0].applicationIds.sort()).toEqual([earlier.id, later.id].sort())
  })

  it.each([
    ['a connecting "on"', 'Discharge of Conditions 16, 17 and 19 on 2025/0917 (LEMP)'],
    ['a decision notice', 'Submission of details to discharge Condition 3 in respect of Decision Notice 2025/0917 dated 07.08.2025.'],
    ['a written-out date before the reference', 'Variation of condition 1 of planning permission dated 28th March 2024 (RN:2025/0917) for the erection of a side extension'],
    ['an appeal permission', 'Details pursuant to condition 7 of appeal permission 2025/0917. Demolition of garage'],
  ])('links a follow-on to its parent through %s', (_case, description) => {
    const child = application('2026/0300', description)
    const { links } = linkCouncilApplications(council(broadland, [child]))
    expect(links).toEqual([expect.objectContaining({ parentReference: '2025/0917', strength: 'strong' })])
  })

  it('reads references with no separator in the council\'s own format, as Ealing writes them', () => {
    const ealing = (n: number) => `26${String(n).padStart(4, '0')}FUL`
    const child = application('253616CND', 'Details of opening hours pursuant to condition 4 of planning permission 244424FUL dated 16/01/2025', { procedure: 'discharge' })
    const { links } = linkCouncilApplications(council(ealing, [child, application('250001CND', 'Details'), application('250002CND', 'Details'), application('250003CND', 'Details')]))
    expect(links).toEqual([expect.objectContaining({ parentReference: '244424FUL', strength: 'strong' })])
  })

  it('accepts an older reference format only when it is named as the parent of a follow-on', () => {
    const richmond = (n: number) => `PA26/${String(n).padStart(4, '0')}`
    const variation = application('PA26/1518', 'Variation of Condition 2 of planning permission 24/2692/VRC dated 21 January 2025 to alter windows', { procedure: 'amendment' })
    const mention = application('PA26/1600', 'Erection of a garage in the style of 24/2692/VRC nearby', { procedure: 'full' })
    const { links } = linkCouncilApplications(council(richmond, [variation, mention]))
    expect(links).toEqual([expect.objectContaining({ childId: variation.id, parentReference: '24/2692/VRC', kind: 'amendment', strength: 'strong' })])
  })

  it('reads case numbers with a trailing sequence or the year last', () => {
    expect(referenceCore('22/01714/DOC/8')).toEqual({ core: '22/01714', suffix: 'DOC' })
    expect(referenceCore('S/2903/14/COND50B')).toEqual({ core: 'S/2903/14', suffix: 'COND50B' })
    expect(referenceCore('26/AP/1549')).toBeNull()
  })

  it('does not join a shared case number across different sites', () => {
    const principal = application('25/02808/FUL', 'Erection of student accommodation', { postcode: 'G1 1AA' })
    const discharge = application('25/02808/DOC01', 'Contaminated land report', { postcode: 'G4 9ZZ' })
    const { links, families } = linkCouncilApplications(reusingCouncil(n => `25/${String(n).padStart(5, '0')}`, [principal, discharge]))
    expect(links.filter(link => link.childId === discharge.id)).toEqual([expect.objectContaining({ strength: 'weak' })])
    expect(families.some(family => family.applicationIds.includes(discharge.id))).toBe(false)
  })

  it('leaves tree works, glued running numbers and ambiguous suffixes alone', () => {
    const trees = [application('25/07794/TPO', 'Fell one sycamore'), application('25/07794/TCA', 'Crown reduce two limes')]
    const glued = [application('26/00023FULL', 'Rear extension'), application('26/00154FULL', 'Loft conversion')]
    const garage = [application('21/01234/FUL', 'New house'), application('21/01234/DET', 'Erection of a garage')]
    expect(referenceCore('26/00023FULL')).toBeNull()
    expect(linkCouncilApplications([...trees, ...glued, ...garage]).links).toEqual([])
  })

  it('follows a chain of amendments back to one family', () => {
    const amendment = application('2026/1630', 'Non material amendment of 2023/3727 - Addition of additional wording within condition 12', { procedure: 'amendment' })
    const discharge = application('2026/1825', 'Discharge of condition of Condition 12 of 2023/3727 (wording as amended by 2026/1630) - Scheme', { procedure: 'discharge' })
    const { families } = linkCouncilApplications(council(broadland, [amendment, discharge]))

    expect(families).toHaveLength(1)
    expect(families[0]).toMatchObject({ rootId: null, missingParentReferences: ['2023/3727'] })
    expect(families[0].applicationIds.sort()).toEqual([amendment.id, discharge.id].sort())
  })

  it('links a new application identically from only the stored applications its keys point to', () => {
    // Ingestion loads only candidates matching a page's cited references and case numbers, not the
    // whole council; the links must be the same as the national report computes from everything.
    const site = { postcode: 'G1 1AA' }
    const applications = reusingCouncil((n: number) => `25/${String(n).padStart(5, '0')}`, [
      application('25/02808/FUL', 'Erection of student accommodation', { procedure: 'full', ...site }),
      application('25/02808/NMV01', 'Changes to window positions', { procedure: 'amendment', ...site }),
      application('25/02808/DOC01', 'Contaminated land report', { procedure: 'discharge', ...site }),
      application('25/03000/DOC01', 'Discharge of condition 4 of planning permission 25/02808/FUL', { procedure: 'discharge' }),
      application('25/03001/FUL', 'Erection of a house. See 25/02808/FUL for access', { procedure: 'full' }),
    ], ['DOC01', 'NMV01'])
    const profile = buildCouncilLinkProfile(applications)
    const everything = resolverFor(applications)
    for (const candidate of applications) {
      const keys = lookupKeysFor(candidate, profile)
      const subset = applications.filter(other => other.id === candidate.id
        || keys.references.includes(normaliseReference(other.reference))
        || keys.cores.includes(referenceCore(other.reference)?.core ?? ''))
      expect(linksForApplication(candidate, profile, resolverFor(subset))).toEqual(linksForApplication(candidate, profile, everything))
    }
  })
})
