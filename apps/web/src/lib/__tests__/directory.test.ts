import { toTargets, toTargetNames, toInHouseContacts, toAgentContacts, formatCategory } from '../directory-transforms'

// requirement_locations.coordinates is untyped jsonb. Getting the [lng, lat] vs {lat, lng}
// distinction wrong plots UK targets off the coast of Africa rather than failing loudly,
// so these cases matter more than they look.
describe('toTargets', () => {
  const row = (coordinates: unknown, id = 't1') => ({
    id,
    place_name: 'Manchester',
    formatted_address: null,
    coordinates,
  })

  it('reads the array form as [lng, lat], not [lat, lng]', () => {
    // Manchester is lat 53.48, lng -2.24. If the order were flipped this would be
    // lat -2.24 / lng 53.48 — in Somalia.
    expect(toTargets([row([-2.24, 53.48])])).toEqual([
      { id: 't1', name: 'Manchester', lat: 53.48, lon: -2.24 },
    ])
  })

  it('reads the object form', () => {
    expect(toTargets([row({ lat: 53.48, lng: -2.24 })])).toEqual([
      { id: 't1', name: 'Manchester', lat: 53.48, lon: -2.24 },
    ])
  })

  it('reads a JSON-encoded string', () => {
    expect(toTargets([row('{"lat":53.48,"lng":-2.24}')])).toEqual([
      { id: 't1', name: 'Manchester', lat: 53.48, lon: -2.24 },
    ])
  })

  it('drops malformed and out-of-range coordinates instead of plotting them', () => {
    const rows = [
      row(null, 'a'),
      row('not json', 'b'),
      row([1], 'c'), // wrong arity
      row({ lat: 'x', lng: 2 }, 'd'), // wrong types
      row({ lat: 200, lng: 2 }, 'e'), // out of range
      row([-2.24, 53.48], 'keep'),
    ]
    const out = toTargets(rows)
    expect(out.map((t) => t.id)).toEqual(['keep'])
  })

  it('falls back to formatted_address when place_name is missing', () => {
    expect(
      toTargets([
        { id: 't1', place_name: null, formatted_address: 'Leeds, UK', coordinates: [-1.55, 53.8] },
      ])[0].name
    ).toBe('Leeds, UK')
  })

  it('handles a null row set', () => {
    expect(toTargets(null)).toEqual([])
    expect(toTargetNames(null)).toEqual([])
  })

  // The count pill counts what toTargets returns, so an unplottable row must not inflate it.
  it('never reports more targets than it plots', () => {
    const rows = [row([-2.24, 53.48], 'ok'), row('garbage', 'bad')]
    expect(toTargets(rows)).toHaveLength(1)
  })
})

describe('toTargetNames', () => {
  it('keeps names for rows whose coordinates are unusable', () => {
    // A target with no usable coordinates should still appear as a chip even though it
    // cannot be plotted — the name is the useful part.
    const names = toTargetNames([
      { id: 'a', place_name: 'Cardiff', formatted_address: null, coordinates: 'garbage' },
    ])
    expect(names).toEqual(['Cardiff'])
  })

  it('drops rows with neither a name nor an address', () => {
    expect(
      toTargetNames([{ id: 'a', place_name: null, formatted_address: null, coordinates: null }])
    ).toEqual([])
  })
})

describe('toInHouseContacts', () => {
  const base = {
    contact_title: null,
    contact_org: null,
    contact_email: null,
    contact_phone: null,
    linkedin_url: null,
  }

  // Agency-kind rows are rendered from brand_agents instead; including them here would
  // double-render a contact that has been promoted to a directory agent.
  it('excludes agency-kind rows and keeps null-kind ones', () => {
    const out = toInHouseContacts([
      { ...base, id: '1', contact_name: 'In House', contact_kind: 'in-house' },
      { ...base, id: '2', contact_name: 'Agency Person', contact_kind: 'agency' },
      { ...base, id: '3', contact_name: 'Unspecified', contact_kind: null },
    ])
    expect(out.map((c) => c.name)).toEqual(['In House', 'Unspecified'])
    expect(out.every((c) => c.kind === 'in-house')).toBe(true)
  })
})

describe('toAgentContacts', () => {
  const agent = (id: string, name: string) => ({
    id,
    name,
    title: 'Director',
    email: null,
    phone: null,
    linkedin_url: null,
    directory_agencies: { id: 'ag1', name: 'Savills' },
  })

  it('orders by display_order and builds the "acting for" role line', () => {
    const out = toAgentContacts(
      [
        { role_note: null, display_order: 2, directory_agents: agent('b', 'Second') },
        { role_note: null, display_order: 1, directory_agents: agent('a', 'First') },
      ],
      "Nando's"
    )
    expect(out.map((c) => c.name)).toEqual(['First', 'Second'])
    expect(out[0].title).toBe("Director · acting for Nando's")
    expect(out[0].org).toBe('Savills')
    expect(out[0].kind).toBe('agent')
    expect(out[0].agentId).toBe('a')
  })

  it('lets role_note override the generated role line', () => {
    const out = toAgentContacts(
      [{ role_note: 'Retail parks only', display_order: 0, directory_agents: agent('a', 'A') }],
      "Nando's"
    )
    expect(out[0].title).toBe('Retail parks only')
  })

  it('skips rows whose agent join came back null', () => {
    expect(
      toAgentContacts([{ role_note: null, display_order: 0, directory_agents: null }], 'X')
    ).toEqual([])
  })
})

describe('formatCategory', () => {
  it('renders parent · child', () => {
    expect(formatCategory('Chicken', 'Restaurants')).toBe('Restaurants · Chicken')
  })
  it('renders the child alone when there is no parent', () => {
    expect(formatCategory('Chicken', null)).toBe('Chicken')
  })
  it('is null when there is no child', () => {
    expect(formatCategory(null, 'Restaurants')).toBeNull()
  })
})
