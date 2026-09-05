import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MissingBody, PresentBody } from '../UInspector'
import { SizeFilterControl } from '../SizeFilterControl'
import { bandById, type FloorAreaProfile } from '../../../lib/size-filter'
import type {
  MissingBrand,
  PresentBrand,
  RequirementLocation,
} from '../../../types/unified-workspace'

const mockSetBrandInfoId = jest.fn()

jest.mock('../../../lib/stores/unified-workspace-store', () => ({
  useWorkspaceStore: (selector: (state: any) => unknown) =>
    selector({
      setHoveredBrandId: jest.fn(),
      setBrandInfoId: mockSetBrandInfoId,
    }),
}))

function profile(over: Partial<FloorAreaProfile> = {}): FloorAreaProfile {
  return {
    brandId: 'b',
    fasciaId: null,
    fasciaName: null,
    minSqFt: 900,
    p25SqFt: 1300,
    medianSqFt: 1700,
    p75SqFt: 2200,
    maxSqFt: 3400,
    sampleCount: 300,
    coefficientOfVariation: 0.31,
    ...over,
  }
}

function missingBrand(id: string, name: string): MissingBrand {
  return {
    brandId: id,
    brandName: name,
    categoryName: 'Food & Beverage',
    categoryIds: ['c1'],
    nearestStoreDistance: 14700,
    logoDomain: null,
    logoUrl: null,
    representative: {
      fasciaId: `${id}-f`,
      fasciaName: name,
      brandId: id,
      brandName: name,
      categoryId: 'c1',
      categoryName: 'Food & Beverage',
      logoDomain: null,
      logoUrl: null,
    },
  }
}

function requirement(over: Partial<RequirementLocation> = {}): RequirementLocation {
  return {
    id: 'r1',
    requirementId: 'req-1',
    brandId: 'taco',
    companyName: 'Taco Bell',
    title: null,
    listingType: null,
    siteSizeMin: 1200,
    siteSizeMax: 2500,
    siteAcreageMin: null,
    siteAcreageMax: null,
    dwellingCountMin: null,
    dwellingCountMax: null,
    placeName: null,
    formattedAddress: null,
    companyDomain: null,
    logoUrl: null,
    coordinates: { lng: 0, lat: 0 },
    ...over,
  }
}

// Brands as they'd arrive from the catchment: one that fits the band on its
// requirement, one that fits on its measured estate, one clearly outside, and
// one we have never measured.
const NANDOS = missingBrand('nandos', 'Nando’s')
const RANGE = missingBrand('range', 'The Range')
const ALLEY = missingBrand('alley', 'Alley Cats Pizza')
const TESCO = missingBrand('tesco', 'Tesco')

const PROFILES: Record<string, FloorAreaProfile[]> = {
  nandos: [profile({ brandId: 'nandos', p25SqFt: 3100, p75SqFt: 4700, sampleCount: 210 })],
  range: [
    profile({
      brandId: 'range',
      minSqFt: 20000,
      p25SqFt: 32000,
      medianSqFt: 42000,
      p75SqFt: 55000,
      maxSqFt: 82000,
      sampleCount: 90,
      coefficientOfVariation: 0.36,
    }),
  ],
  taco: [profile({ brandId: 'taco', p25SqFt: 1350, p75SqFt: 2150, sampleCount: 38 })],
  tesco: [
    profile({
      brandId: 'tesco',
      fasciaId: 'f-express',
      fasciaName: 'Tesco Express',
      minSqFt: 2600,
      p25SqFt: 3270,
      medianSqFt: 3950,
      p75SqFt: 4610,
      maxSqFt: 6200,
      sampleCount: 1400,
      coefficientOfVariation: 0.18,
    }),
    profile({
      brandId: 'tesco',
      fasciaId: 'f-extra',
      fasciaName: 'Tesco Extra',
      minSqFt: 82000,
      p25SqFt: 95000,
      medianSqFt: 105000,
      p75SqFt: 118000,
      maxSqFt: 160000,
      sampleCount: 210,
      coefficientOfVariation: 0.22,
    }),
  ],
}

const profilesFor = (brandId: string | null) =>
  brandId ? (PROFILES[brandId] ?? []) : []

function renderMissing(bandId: string | null) {
  return render(
    <MissingBody
      loading={false}
      missing={[NANDOS, RANGE, ALLEY, TESCO]}
      requirements={[requirement()]}
      areaName="Luton"
      band={bandById(bandId as never)}
      profilesFor={profilesFor}
      onOpenReq={jest.fn()}
      onOpenBrand={jest.fn()}
    />
  )
}

describe('Missing Brands panel — no band selected', () => {
  it('keeps the requirement-first order and shows sizes without filtering', () => {
    renderMissing(null)
    const names = screen
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
      .filter((t) => t.length > 0)
    expect(names[0]).toContain('Taco Bell')
    expect(screen.getByText('Alley Cats Pizza')).toBeInTheDocument()
    // Observed sizes are still shown, quietly.
    expect(screen.getAllByTitle('Gross internal area').length).toBeGreaterThan(0)
    // No grouping until the user asks a size question.
    expect(screen.queryByText('Size not on record')).not.toBeInTheDocument()
  })

  it('invites the user to set a size', () => {
    renderMissing(null)
    expect(
      screen.getByText(/Set a size to match your unit/)
    ).toBeInTheDocument()
  })
})

describe('Missing Brands panel — a band selected', () => {
  it('leads with the stated requirement, then the fitting estates', () => {
    renderMissing('3-10')
    const cards = screen.getAllByRole('button')
    const text = cards.map((c) => c.textContent ?? '')
    const taco = text.findIndex((t) => t.includes('Taco Bell'))
    const nandos = text.findIndex((t) => t.includes('Nando'))
    // Taco Bell's 1,200–2,500 requirement is a near miss for 3,000–10,000;
    // Nando's fits outright, so it leads.
    expect(nandos).toBeLessThan(taco)
    expect(text[taco]).toContain('Near your size band')
  })

  it('keeps a requirement and its measured estate as separate claims', () => {
    renderMissing('1-3')
    const card = screen.getByText('Taco Bell').closest('button') as HTMLElement
    expect(within(card).getByText(/1,200-2,500 sq ft/)).toBeInTheDocument()
    expect(within(card).getByText('Estate today')).toBeInTheDocument()
    expect(within(card).getByTitle('Gross internal area')).toBeInTheDocument()
  })

  it('never hides a brand whose size is unknown, and says so in its own words', () => {
    renderMissing('3-10')
    expect(screen.getByText('Size not on record')).toBeInTheDocument()
    expect(
      screen.getByText(/that's different from not fitting/)
    ).toBeInTheDocument()
    expect(screen.getByText('Alley Cats Pizza')).toBeInTheDocument()
  })

  it('demotes rather than deletes a brand that clearly does not fit', async () => {
    renderMissing('1-3')
    // Collapsed by default — the header is there, the row is not.
    expect(screen.getByText('Outside 1,000–3,000 sq ft')).toBeInTheDocument()
    expect(screen.queryByText('The Range')).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('Outside 1,000–3,000 sq ft'))
    expect(screen.getByText('The Range')).toBeInTheDocument()
  })

  it('shows only the matching format for a multi-format brand', () => {
    renderMissing('3-10')
    const card = screen.getByText('Tesco').closest('button') as HTMLElement
    expect(within(card).getByText('Matching format')).toBeInTheDocument()
    expect(within(card).getByText('Tesco Express')).toBeInTheDocument()
    expect(within(card).queryByText('Tesco Extra')).not.toBeInTheDocument()
  })

  it('lists every format when no band narrows them', () => {
    renderMissing(null)
    const card = screen.getByText('Tesco').closest('button') as HTMLElement
    expect(
      within(card).getByText(/Trades across formats · filter by size to narrow/)
    ).toBeInTheDocument()
    expect(within(card).getByText('Tesco Extra')).toBeInTheDocument()
  })

  it('states the measurement basis without a tooltip', () => {
    renderMissing('3-10')
    expect(screen.getByText(/gross internal area \(GIA\)/)).toBeInTheDocument()
  })

  it('does not print a confidence number anywhere', () => {
    const { container } = renderMissing('3-10')
    expect(container.textContent).not.toMatch(/\d+%\s*(confidence|match)/i)
    expect(container.textContent).toMatch(/1,400 stores · tight/)
  })

  it('offers the near-miss and unknown groups rather than a dead end', () => {
    render(
      <MissingBody
        loading={false}
        missing={[ALLEY]}
        requirements={[]}
        areaName="Luton"
        band={bandById('50+')}
        profilesFor={profilesFor}
        onOpenReq={jest.fn()}
        onOpenBrand={jest.fn()}
      />
    )
    expect(
      screen.getByText(/No known-size brands fit 50,000\+ sq ft/)
    ).toBeInTheDocument()
    expect(screen.getByText(/Absence isn't a no/)).toBeInTheDocument()
    expect(screen.getByText('Alley Cats Pizza')).toBeInTheDocument()
  })
})

describe('Present Brands panel', () => {
  const ALDI: PresentBrand = {
    brandId: 'aldi',
    brandName: 'Aldi',
    storeCount: 2,
    town: 'Luton',
    categoryIds: ['c2'],
    categoryName: 'Grocery',
    logoDomain: null,
    logoUrl: null,
  }
  const BANNATYNE: PresentBrand = {
    brandId: 'bannatyne',
    brandName: 'Bannatyne',
    storeCount: 1,
    town: 'Luton',
    categoryIds: ['c3'],
    categoryName: 'Health & Fitness',
    logoDomain: null,
    logoUrl: null,
  }
  const presentProfiles = (brandId: string | null) =>
    brandId === 'aldi'
      ? [
          profile({
            brandId: 'aldi',
            minSqFt: 12000,
            p25SqFt: 15500,
            medianSqFt: 17500,
            p75SqFt: 19500,
            maxSqFt: 24000,
            sampleCount: 1078,
            coefficientOfVariation: 0.15,
          }),
        ]
      : []

  it('confirms which local format fits, and keeps unmeasured brands visible', () => {
    render(
      <PresentBody
        loading={false}
        present={[ALDI, BANNATYNE]}
        band={bandById('10-50')}
        profilesFor={presentProfiles}
      />
    )
    expect(screen.getByText('Aldi')).toBeInTheDocument()
    expect(screen.getByText('15,500–19,500')).toBeInTheDocument()
    expect(screen.getByText('1,078 stores · tight')).toBeInTheDocument()
    expect(screen.getByText('Size not on record')).toBeInTheDocument()
    expect(screen.getByText('Bannatyne')).toBeInTheDocument()
  })
})

describe('Size control', () => {
  const counts = { u1: 3, '1-3': 12, '3-10': 27, '10-50': 8, '50+': 0 } as const

  it('reads as unset until a band is chosen', () => {
    render(
      <SizeFilterControl
        selected={null}
        fitCounts={counts}
        unknownCount={69}
        onChange={jest.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /Size/ })).toBeInTheDocument()
  })

  it('shows live fit counts and how many brands have no size at all', async () => {
    render(
      <SizeFilterControl
        selected={null}
        fitCounts={counts}
        unknownCount={69}
        onChange={jest.fn()}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /Size/ }))
    expect(screen.getByText('Match my unit size')).toBeInTheDocument()
    expect(screen.getByText('27 brands fit')).toBeInTheDocument()
    expect(screen.getByText('69 brands have no size on record')).toBeInTheDocument()
  })

  it('selects a band and closes', async () => {
    const onChange = jest.fn()
    render(
      <SizeFilterControl
        selected={null}
        fitCounts={counts}
        unknownCount={69}
        onChange={onChange}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /Size/ }))
    await userEvent.click(screen.getByText('3,000 – 10,000 sq ft'))
    expect(onChange).toHaveBeenCalledWith('3-10')
    expect(screen.queryByText('Match my unit size')).not.toBeInTheDocument()
  })

  it('labels the trigger with the active band and clears back to none', async () => {
    const onChange = jest.fn()
    render(
      <SizeFilterControl
        selected="3-10"
        fitCounts={counts}
        unknownCount={69}
        onChange={onChange}
      />
    )
    const trigger = screen.getByRole('button', { name: /3,000–10,000/ })
    await userEvent.click(trigger)
    await userEvent.click(screen.getByText('Clear'))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
