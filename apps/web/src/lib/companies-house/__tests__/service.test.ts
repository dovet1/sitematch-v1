/** @jest-environment node */
import { refreshCompanyFactsWithOutcome } from '../service'
import * as client from '../client'
import * as scanned from '../scanned-accounts'
import type { ChCompanyProfile } from '../types'

jest.mock('../client')
jest.mock('../scanned-accounts', () => ({
  ...jest.requireActual('../scanned-accounts'),
  readScannedFigures: jest.fn(),
}))

const mocked = jest.mocked(client)
const readScannedFigures = jest.mocked(scanned.readScannedFigures)

const profile: ChCompanyProfile = {
  company_number: '04386537',
  company_name: 'BOYLESPORTS (UK) LIMITED',
  accounts: { last_accounts: { made_up_to: '2024-12-29', type: 'full' } },
}
const stored = {
  turnover: 8_986_000, turnover_status: 'extracted', turnover_page: 11,
  net_assets: -3_461_000, net_assets_status: 'extracted', net_assets_page: 12,
  figures_model: 'google/gemini-2.5-flash', figures_period_end: '2024-12-29',
}

// A minimal stand-in for the two company_facts calls refresh makes.
function fakeDb(existing: object | null) {
  const upserts: Record<string, unknown>[] = []
  const db = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }),
      upsert: async (row: Record<string, unknown>) => {
        upserts.push(row)
        return { error: null }
      },
    }),
  }
  return { db: db as never, upserts }
}

beforeEach(() => {
  jest.resetAllMocks()
  mocked.getCompanyProfile.mockResolvedValue(profile)
  mocked.getAccountsFilings.mockResolvedValue([
    { type: 'AA', description_values: { made_up_date: '2024-12-29' }, links: { document_metadata: 'https://document-api.company-information.service.gov.uk/document/x' } },
  ])
  mocked.getDocumentMetadata.mockResolvedValue({ pages: 24, resources: { 'application/pdf': {} } })
  mocked.getDocumentBytes.mockResolvedValue(Buffer.from('%PDF'))
})

describe('refreshCompanyFactsWithOutcome', () => {
  it("keeps a co-operative society's figures from the FCA register, even on a re-read", async () => {
    // A society has no accounts at Companies House: the profile carries no accounts date.
    mocked.getCompanyProfile.mockResolvedValue({ company_number: 'IP10143R', company_name: 'CENTRAL ENGLAND CO-OPERATIVE LIMITED' })
    const register = {
      ...stored, turnover: 828_643_000, turnover_page: 20, net_assets: 101_240_000, net_assets_page: 22,
      figures_model: 'manual', figures_period_end: '2026-01-24', figures_source: 'fca_mutuals',
    }
    const { db, upserts } = fakeDb(register)
    const r = await refreshCompanyFactsWithOutcome(db, 'IP10143R', { rereadFigures: true })
    expect(r.outcome).toEqual({ kind: 'kept' })
    expect(upserts[0]).toMatchObject({ turnover: 828_643_000, net_assets: 101_240_000, figures_period_end: '2026-01-24' })
    expect(mocked.getAccountsFilings).not.toHaveBeenCalled()
  })
  it('keeps an already-read period without reading again, unless asked to', async () => {
    const { db } = fakeDb(stored)
    const r = await refreshCompanyFactsWithOutcome(db, '04386537')
    expect(r.outcome).toEqual({ kind: 'kept' })
    expect(r.facts.turnover).toBe(8_986_000)
    expect(mocked.getAccountsFilings).not.toHaveBeenCalled()
  })

  it('on a re-read, replaces a figure that was read and keeps one that was not', async () => {
    readScannedFigures.mockResolvedValue({ turnover: 9_000_000, turnoverPage: 10, netAssets: null, netAssetsPage: null })
    const { db, upserts } = fakeDb(stored)
    const r = await refreshCompanyFactsWithOutcome(db, '04386537', { rereadFigures: true })
    expect(r.outcome.kind).toBe('read')
    expect(upserts[0]).toMatchObject({
      turnover: 9_000_000, turnover_status: 'extracted', turnover_page: 10,
      net_assets: -3_461_000, net_assets_status: 'extracted', net_assets_page: 12,
      figures_model: 'google/gemini-2.5-flash', figures_period_end: '2024-12-29',
    })
    expect(r.previous?.turnover).toBe(8_986_000)
  })

  it('on a failed re-read, keeps every stored figure and reports the error', async () => {
    readScannedFigures.mockRejectedValue(new Error('OpenRouter request failed (502)'))
    const { db, upserts } = fakeDb(stored)
    const r = await refreshCompanyFactsWithOutcome(db, '04386537', { rereadFigures: true })
    expect(r.outcome).toEqual({ kind: 'failed', error: 'OpenRouter request failed (502)' })
    expect(upserts[0]).toMatchObject({ turnover: 8_986_000, net_assets: -3_461_000, turnover_page: 11 })
  })

  it('drops the page and model when a figure is replaced from electronic accounts', async () => {
    mocked.getDocumentMetadata.mockResolvedValue({ pages: 24, resources: { 'application/xhtml+xml': {} } })
    mocked.getDocumentContent.mockResolvedValue(`
      <xbrli:context id="d"><xbrli:period><xbrli:startDate>2024-01-01</xbrli:startDate><xbrli:endDate>2024-12-29</xbrli:endDate></xbrli:period></xbrli:context>
      <xbrli:context id="i"><xbrli:period><xbrli:instant>2024-12-29</xbrli:instant></xbrli:period></xbrli:context>
      <ix:nonFraction name="core:TurnoverRevenue" contextRef="d" unitRef="GBP" decimals="0">8,986,000</ix:nonFraction>
      <ix:nonFraction name="core:NetAssetsLiabilities" contextRef="i" unitRef="GBP" decimals="0" sign="-">3,461,000</ix:nonFraction>`)
    const { db, upserts } = fakeDb(stored)
    await refreshCompanyFactsWithOutcome(db, '04386537', { rereadFigures: true })
    expect(upserts[0]).toMatchObject({
      turnover_status: 'filed', turnover_page: null, net_assets_status: 'filed', net_assets_page: null, figures_model: null,
    })
  })
})
