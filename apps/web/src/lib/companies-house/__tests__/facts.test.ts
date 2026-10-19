import {
  accountsTypeLabel,
  factsRowToTradingFacts,
  figuresRefreshMessage,
  formatPounds,
  normaliseCompanyNumber,
  profileToFactsRow,
  rankCandidates,
  scoreCandidate,
  statusLabel,
  suggestionQueries,
} from '../facts'
import type { ChCompanyProfile, ChSearchItem } from '../types'
// Real Companies House responses (public register data), recorded 18 Sep 2026. Search fixtures
// are the merged results of suggestionQueries() for each brand.
import aldiProfile from './fixtures/profile-02321869.json'
import aldiSearch from './fixtures/search-aldi.json'
import mcdonaldsSearch from './fixtures/search-mcdonalds.json'
import greggsSearch from './fixtures/search-greggs.json'
import tkmaxxSearch from './fixtures/search-tkmaxx.json'

describe('normaliseCompanyNumber', () => {
  it('pads numeric and prefixed numbers to 8 characters', () => {
    expect(normaliseCompanyNumber('2321869')).toBe('02321869')
    expect(normaliseCompanyNumber(' sc 501753 ')).toBe('SC501753')
    expect(normaliseCompanyNumber('SC1234')).toBe('SC001234')
    expect(normaliseCompanyNumber('02321869')).toBe('02321869')
  })
  it('rejects anything else', () => {
    expect(normaliseCompanyNumber('ALDI')).toBeNull()
    expect(normaliseCompanyNumber('123456789')).toBeNull()
  })
})

describe('profileToFactsRow', () => {
  const row = profileToFactsRow(aldiProfile as ChCompanyProfile, '2026-09-18T00:00:00.000Z')

  it('reads the register facts', () => {
    expect(row).toMatchObject({
      company_number: '02321869',
      company_name: 'ALDI STORES LIMITED',
      company_status: 'active',
      registered_office: 'Holly Lane, Atherstone, Warwickshire, CV9 2SQ',
      last_accounts_made_up_to: '2024-12-31',
      last_accounts_type: 'group',
      accounts_overdue: false,
    })
  })
  it('never infers figures from the profile — they stay unread', () => {
    expect(row.turnover).toBeNull()
    expect(row.turnover_status).toBe('unread')
    expect(row.net_assets_status).toBe('unread')
  })
})

describe('factsRowToTradingFacts', () => {
  const base = profileToFactsRow(aldiProfile as ChCompanyProfile, '2026-09-18T00:00:00.000Z')

  it('labels the register without judging it', () => {
    const facts = factsRowToTradingFacts(base)
    expect(facts.status).toBe('Active')
    expect(facts.accountsType).toBe('Group accounts')
    expect(facts.turnover).toEqual({ status: 'unread' })
  })
  it('passes filed figures and genuine non-publication through distinctly', () => {
    const facts = factsRowToTradingFacts({
      ...base,
      turnover: 17_900_000_000,
      turnover_status: 'filed',
      net_assets: null,
      net_assets_status: 'not_published',
    })
    expect(facts.turnover).toEqual({ status: 'filed', value: 17_900_000_000 })
    expect(facts.netAssets).toEqual({ status: 'not_published' })
  })
  it('passes extracted figures through with the page they were read from', () => {
    const facts = factsRowToTradingFacts({
      ...base,
      turnover: 8_986_000,
      turnover_status: 'extracted',
      turnover_page: 11,
    })
    expect(facts.turnover).toEqual({ status: 'extracted', value: 8_986_000, page: 11 })
  })
  it('humanises unknown codes and drops the "no type" placeholder', () => {
    expect(statusLabel('voluntary-arrangement')).toBe('Voluntary arrangement')
    expect(statusLabel('some-new-status')).toBe('Some new status')
    expect(accountsTypeLabel('no-accounts-type-available')).toBeNull()
  })
})

describe('suggestions', () => {
  const top = (brand: string, items: unknown) =>
    rankCandidates(brand, items as ChSearchItem[])[0]?.item.company_number

  it('searches operating-company variants of the brand', () => {
    expect(suggestionQueries('Aldi')).toEqual([
      'Aldi', 'Aldi stores', 'Aldi retail', 'Aldi restaurants', 'Aldi UK',
    ])
  })
  it('puts the UK trading company first on real search results', () => {
    expect(top('Aldi', aldiSearch)).toBe('02321869') // ALDI STORES LIMITED
    expect(top("McDonald's", mcdonaldsSearch)).toBe('01002769') // MCDONALD'S RESTAURANTS LIMITED
    expect(top('Greggs', greggsSearch)).toBe('00502851') // GREGGS PLC
    expect(top('TK Maxx', tkmaxxSearch)).toBe('02774693') // TK MAXX (unlimited)
  })
  it('dedupes results merged across queries', () => {
    const ranked = rankCandidates('Aldi', [...aldiSearch, ...aldiSearch] as ChSearchItem[], 20)
    const numbers = ranked.map((c) => c.item.company_number)
    expect(new Set(numbers).size).toBe(numbers.length)
  })
  it('penalises unrelated businesses, holding vehicles, dissolved and overseas entities', () => {
    const item = (title: string, over: Partial<ChSearchItem> = {}): ChSearchItem => ({
      company_number: '00000001', title, company_status: 'active', company_type: 'ltd', ...over,
    })
    const trading = scoreCandidate('Aldi', item('ALDI STORES LIMITED'))
    expect(scoreCandidate('Aldi', item('ALDI PLUMBING AND HEATING LTD'))).toBeLessThan(trading)
    expect(scoreCandidate('Aldi', item('ALDI HOLDINGS LIMITED'))).toBeLessThan(trading)
    expect(scoreCandidate('Aldi', item('ALDI STORES LIMITED', { company_status: 'dissolved' }))).toBeLessThan(trading)
    expect(scoreCandidate('Aldi', item('ALDI GMBH', { company_type: 'oversea-company' }))).toBeLessThan(trading)
    expect(scoreCandidate('Aldi', item('TESCO STORES LIMITED'))).toBe(0)
  })
  it('only credits a name match when the brand leads the company name', () => {
    const item = (title: string): ChSearchItem => ({
      company_number: '00000001', title, company_status: 'active', company_type: 'ltd',
    })
    expect(scoreCandidate('Activate', item('RETAIL ACTIVATE LIMITED'))).toBeLessThan(
      scoreCandidate('Activate', item('ACTIVATE LIMITED'))
    )
    expect(scoreCandidate('Activate', item('RETAIL ACTIVATE LIMITED'))).toBeLessThan(
      scoreCandidate('Activate', item('ACTIVATE RETAIL LIMITED'))
    )
    expect(scoreCandidate('B&M', item('B & M RETAIL LIMITED'))).toBeGreaterThan(
      scoreCandidate('B&M', item('UK CONTRACTS B&M LTD'))
    )
  })
})

describe('figuresRefreshMessage', () => {
  const previous = {
    turnover: 8_986_000, turnover_status: 'extracted' as const, turnover_page: 11,
    net_assets: null, net_assets_status: 'unread' as const, net_assets_page: null,
  }

  it('says what was read, from where, and what it replaced', () => {
    expect(
      figuresRefreshMessage(
        {
          kind: 'read',
          figures: {
            turnover: 9_000_000, turnover_status: 'extracted', turnover_page: 11,
            net_assets: -3_461_000, net_assets_status: 'filed',
          },
        },
        previous,
        '2024-12-29'
      )
    ).toEqual([
      'Turnover: £9,000,000 from scanned accounts, PDF p. 11 (was £8,986,000).',
      'Net assets: -£3,461,000 from the electronic accounts.',
    ])
  })
  it('says when a figure was not found and what was kept', () => {
    expect(figuresRefreshMessage({ kind: 'read', figures: {} }, previous, '2024-12-29')).toEqual([
      'Turnover: not found in the accounts to 2024-12-29; kept £8,986,000.',
      'Net assets: not found in the accounts to 2024-12-29; kept not read.',
    ])
  })
  it('reports failures and unreadable filings without implying figures changed', () => {
    expect(figuresRefreshMessage({ kind: 'failed', error: 'timeout' }, null, '2024-12-29')[0]).toBe(
      'Reading the accounts to 2024-12-29 failed: timeout. Figures unchanged; try again.'
    )
    expect(figuresRefreshMessage({ kind: 'unreadable' }, null, null)[0]).toMatch(/^Could not read the latest accounts/)
  })
  it('formats exact pounds', () => {
    expect(formatPounds(-3_461_000)).toBe('-£3,461,000')
    expect(formatPounds(2)).toBe('£2')
  })
})
