/** @jest-environment node */
import { PDFDocument } from 'pdf-lib'
import {
  acceptScannedFigures,
  confirmScannedFigures,
  extractPages,
  readScannedAccounts,
  readScannedFigures,
  type ScannedReading,
} from '../scanned-accounts'

// What gemini-2.5-flash read from BoyleSports (UK) Limited's scanned accounts for the year to
// 29 December 2024 (filed 4 Dec 2025, 24 pages), checked against the pages by eye on 29 Sep 2026.
const boyle: ScannedReading = {
  registered_number: '04386537',
  period_end: '2024-12-29',
  units: 'thousands',
  turnover: 8986,
  turnover_page: 11,
  net_assets: -3461,
  net_assets_page: 12,
  total_equity: -3461,
}
const expected = { companyNumber: '04386537', madeUpTo: '2024-12-29', pages: 24 }

describe('acceptScannedFigures', () => {
  it('scales the figures and keeps their pages', () => {
    expect(acceptScannedFigures(boyle, expected)).toEqual({
      turnover: 8_986_000,
      turnoverPage: 11,
      netAssets: -3_461_000,
      netAssetsPage: 12,
    })
  })
  it('rejects a reading for another period or another company', () => {
    const none = { turnover: null, turnoverPage: null, netAssets: null, netAssetsPage: null }
    expect(acceptScannedFigures({ ...boyle, period_end: '2023-12-31' }, expected)).toEqual(none)
    expect(acceptScannedFigures({ ...boyle, registered_number: '04386538' }, expected)).toEqual(none)
    expect(acceptScannedFigures({ ...boyle, units: null }, expected)).toEqual(none)
  })
  it('accepts a printed company number without its leading zero', () => {
    expect(acceptScannedFigures({ ...boyle, registered_number: '4386537' }, expected).turnover).toBe(8_986_000)
  })
  it('keeps net assets only when the balance sheet agrees with itself', () => {
    const r = acceptScannedFigures({ ...boyle, total_equity: -3416 }, expected)
    expect(r.netAssets).toBeNull()
    expect(r.turnover).toBe(8_986_000)
    expect(acceptScannedFigures({ ...boyle, total_equity: null }, expected).netAssets).toBeNull()
  })
  it('drops a figure without a page in the document, and a negative turnover', () => {
    expect(acceptScannedFigures({ ...boyle, turnover_page: 25 }, expected).turnover).toBeNull()
    expect(acceptScannedFigures({ ...boyle, turnover_page: null }, expected).turnover).toBeNull()
    expect(acceptScannedFigures({ ...boyle, turnover: -1 }, expected).turnover).toBeNull()
  })
})

describe('confirmScannedFigures', () => {
  const figures = { turnover: 8_986_000, turnoverPage: 11, netAssets: -3_461_000, netAssetsPage: 12 }

  it('keeps each figure found again on its own page', () => {
    const readings = new Map([
      [11, { units: 'thousands' as const, turnover: 8986, net_assets: null }],
      [12, { units: 'thousands' as const, turnover: null, net_assets: -3461 }],
    ])
    expect(confirmScannedFigures(figures, readings)).toEqual(figures)
  })
  it('drops a figure whose cited page does not show it (a printed page number given as the PDF page)', () => {
    const readings = new Map([
      [11, { units: null, turnover: null, net_assets: null }],
      [12, { units: 'thousands' as const, turnover: null, net_assets: -3461 }],
    ])
    expect(confirmScannedFigures(figures, readings)).toEqual({ ...figures, turnover: null, turnoverPage: null })
  })
  it('drops figures with swapped page citations', () => {
    const readings = new Map([
      [11, { units: 'thousands' as const, turnover: null, net_assets: -3461 }],
      [12, { units: 'thousands' as const, turnover: 8986, net_assets: null }],
    ])
    expect(confirmScannedFigures(figures, readings)).toEqual({
      turnover: null, turnoverPage: null, netAssets: null, netAssetsPage: null,
    })
  })
  it('drops a figure read differently on its page, or when the page could not be read', () => {
    const readings = new Map([
      [11, { units: 'thousands' as const, turnover: 8968, net_assets: null }],
      [12, null],
    ])
    expect(confirmScannedFigures(figures, readings)).toEqual({
      turnover: null, turnoverPage: null, netAssets: null, netAssetsPage: null,
    })
  })
})

describe('extractPages', () => {
  it('cuts out the given 1-based pages', async () => {
    const doc = await PDFDocument.create()
    ;[100, 200, 300].forEach((w) => doc.addPage([w, 500]))
    const cut = await PDFDocument.load(await extractPages(Buffer.from(await doc.save()), [3]))
    expect(cut.getPageCount()).toBe(1)
    expect(cut.getPage(0).getWidth()).toBe(300)
  })
})

describe('readScannedAccounts', () => {
  const reply = (content: string | undefined, status = 200) =>
    ({ ok: status < 400, status, json: async () => ({ choices: [{ message: { content } }] }) }) as Response
  const originalFetch = global.fetch
  afterEach(() => { global.fetch = originalFetch })

  it('retries once when the reply is off-schema', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(reply('{"turnover": "8,986"}'))
      .mockResolvedValueOnce(reply('```json\n' + JSON.stringify(boyle) + '\n```'))
    global.fetch = fetchMock as unknown as typeof fetch
    await expect(readScannedAccounts(Buffer.from('%PDF'), 'key')).resolves.toEqual(boyle)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('returns null after two off-schema replies, and throws on a provider error', async () => {
    global.fetch = jest.fn().mockResolvedValue(reply('not json')) as unknown as typeof fetch
    await expect(readScannedAccounts(Buffer.from('%PDF'), 'key')).resolves.toBeNull()
    global.fetch = jest.fn().mockResolvedValue(reply(undefined, 502)) as unknown as typeof fetch
    await expect(readScannedAccounts(Buffer.from('%PDF'), 'key')).rejects.toThrow('502')
  })
})

describe('readScannedFigures', () => {
  const reply = (content: unknown) =>
    ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }) }) as Response
  const originalFetch = global.fetch
  afterEach(() => { global.fetch = originalFetch })

  it('reads the whole filing, then confirms each cited page on its own', async () => {
    const doc = await PDFDocument.create()
    for (let i = 0; i < 24; i++) doc.addPage([100, 100])
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(reply(boyle))
      .mockResolvedValueOnce(reply({ units: 'thousands', turnover: 8986, net_assets: null }))
      .mockResolvedValueOnce(reply({ units: null, turnover: null, net_assets: null }))
    global.fetch = fetchMock as unknown as typeof fetch
    await expect(readScannedFigures(Buffer.from(await doc.save()), expected, 'key')).resolves.toEqual({
      turnover: 8_986_000, turnoverPage: 11, netAssets: null, netAssetsPage: null,
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
