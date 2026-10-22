// Reads turnover and net assets from accounts Companies House holds only as a PDF (scanned or
// paper filings, with no iXBRL tags). A vision model reads the pages; nothing it returns is kept
// unless it passes the checks in acceptScannedFigures and is then found again, at the same value,
// on the page it was cited from (confirmScannedFigures). Figures read this way are stored as
// 'extracted', never 'filed', and carry the PDF page they were read from.

import { PDFDocument } from 'pdf-lib'
import { z } from 'zod'
import { normaliseCompanyNumber } from './facts'

// Gemini reads PDFs natively and is deterministic at temperature 0 (see
// planning-intelligence/openrouter.ts). Flash rather than flash-lite: the pages are scans, and a
// misread digit is worse here than a few pence more per filing.
export const SCANNED_ACCOUNTS_MODEL = 'google/gemini-2.5-flash'
// Larger filings are left unread rather than paid for: they are long group reports, and the model
// is more likely to take a figure from the wrong statement.
export const MAX_SCANNED_PAGES = 80
const MAX_ATTEMPTS = 2
const TIMEOUT_MS = 90_000

const SYSTEM = `You read UK statutory accounts filed at Companies House. The PDF is a scan.
Report figures exactly as printed, for the CURRENT financial year only (never the comparative column).
- turnover: the "Turnover" or "Revenue" line of the profit and loss account / income statement. For a
  charity, whose accounts have a statement of financial activities instead, the "Total income" line
  (total of all funds). null if the accounts contain neither.
- net_assets: the "Net assets" or "Net liabilities" total on the balance sheet. Net liabilities are negative.
- total_equity: the total of "Capital and reserves" (also called shareholders' funds, total equity or
  shareholder's deficit) on the same balance sheet. A deficit is negative.
- Where both consolidated (group) and company-only statements are present, use the consolidated ones.
- Figures in brackets are negative. Report the number as printed, without scaling; give the scale in units
  ("pounds" when the heading is £, "thousands" for £'000 or £k, "millions" for £m).
- *_page is the 1-based position of the page within the PDF, not the number printed on the page.
- period_end is the balance sheet date as YYYY-MM-DD. registered_number is the company number printed
  on the balance sheet or cover, or null.
Use null for anything you cannot read with certainty. Never estimate or compute a figure.`

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'registered_number', 'period_end', 'units', 'turnover', 'turnover_page',
    'net_assets', 'net_assets_page', 'total_equity',
  ],
  properties: {
    registered_number: { type: ['string', 'null'] },
    period_end: { type: ['string', 'null'] },
    units: { type: ['string', 'null'], enum: ['pounds', 'thousands', 'millions', null] },
    turnover: { type: ['number', 'null'] },
    turnover_page: { type: ['integer', 'null'] },
    net_assets: { type: ['number', 'null'] },
    net_assets_page: { type: ['integer', 'null'] },
    total_equity: { type: ['number', 'null'] },
  },
}

const readingSchema = z.object({
  registered_number: z.string().nullable(),
  period_end: z.string().nullable(),
  units: z.enum(['pounds', 'thousands', 'millions']).nullable(),
  turnover: z.number().nullable(),
  turnover_page: z.number().int().nullable(),
  net_assets: z.number().nullable(),
  net_assets_page: z.number().int().nullable(),
  total_equity: z.number().nullable(),
})

export type ScannedReading = z.infer<typeof readingSchema>

export interface ScannedFigures {
  turnover: number | null
  turnoverPage: number | null
  netAssets: number | null
  netAssetsPage: number | null
}

const SCALE = { pounds: 1, thousands: 1_000, millions: 1_000_000 } as const

const validPage = (page: number | null, pages: number): page is number =>
  page != null && page >= 1 && page <= pages

// The checks a model reading must pass before any figure is kept. The whole reading is rejected
// when it is for another period or another company. Each figure is then kept only with a page it
// can be checked against; net assets additionally only when the balance sheet agrees with itself.
export function acceptScannedFigures(
  reading: ScannedReading,
  expected: { companyNumber: string; madeUpTo: string; pages: number }
): ScannedFigures {
  const none: ScannedFigures = { turnover: null, turnoverPage: null, netAssets: null, netAssetsPage: null }
  if (reading.period_end !== expected.madeUpTo) return none
  if (reading.registered_number != null && normaliseCompanyNumber(reading.registered_number) !== expected.companyNumber) {
    return none
  }
  if (!reading.units) return none
  const scale = SCALE[reading.units]

  const turnoverOk =
    reading.turnover != null && reading.turnover >= 0 && validPage(reading.turnover_page, expected.pages)
  const netAssetsOk =
    reading.net_assets != null &&
    reading.total_equity != null &&
    reading.net_assets === reading.total_equity &&
    validPage(reading.net_assets_page, expected.pages)

  return {
    turnover: turnoverOk ? Math.round(reading.turnover! * scale) : null,
    turnoverPage: turnoverOk ? reading.turnover_page : null,
    netAssets: netAssetsOk ? Math.round(reading.net_assets! * scale) : null,
    netAssetsPage: netAssetsOk ? reading.net_assets_page : null,
  }
}

// The model sometimes cites the number printed on a page instead of the page's position in the
// PDF (IKEA, 6 Oct 2026: printed 21, PDF 23), which the range check above cannot catch. So each
// cited page is cut out and read again on its own: a figure is kept only when it is found on its
// own page, at the same value. A figure whose page is wrong is dropped, never kept with a wrong page.
const CONFIRM_SYSTEM = `This page was cut from UK statutory accounts filed at Companies House. It is a scan.
Read figures exactly as printed, for the CURRENT financial year only (never the comparative column), and only
from this page:
- turnover: the "Turnover" or "Revenue" line of a profit and loss account / income statement on this page.
- net_assets: the "Net assets" or "Net liabilities" total of a balance sheet on this page. Net liabilities are negative.
- Where both consolidated (group) and company-only columns or statements are shown, use the consolidated ones.
- Figures in brackets are negative. Report the number as printed, without scaling; give the scale in units
  ("pounds" for £, "thousands" for £'000 or £k, "millions" for £m).
Use null for a figure that is not on this page, or that you cannot read with certainty.`

const CONFIRM_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['units', 'turnover', 'net_assets'],
  properties: {
    units: { type: ['string', 'null'], enum: ['pounds', 'thousands', 'millions', null] },
    turnover: { type: ['number', 'null'] },
    net_assets: { type: ['number', 'null'] },
  },
}

const confirmSchema = z.object({
  units: z.enum(['pounds', 'thousands', 'millions']).nullable(),
  turnover: z.number().nullable(),
  net_assets: z.number().nullable(),
})

export type ConfirmReading = z.infer<typeof confirmSchema>

// Keep each figure only when the reading of its own cited page gives the same value. Readings are
// keyed by page, so a figure confirmed on the other figure's page (swapped citations) is dropped.
export function confirmScannedFigures(
  figures: ScannedFigures,
  readings: Map<number, ConfirmReading | null>
): ScannedFigures {
  const same = (value: number | null, page: number | null, pick: (r: ConfirmReading) => number | null) => {
    const r = page != null ? readings.get(page) : null
    if (value == null || !r?.units) return false
    const read = pick(r)
    return read != null && Math.round(read * SCALE[r.units]) === value
  }
  const turnoverOk = same(figures.turnover, figures.turnoverPage, (r) => r.turnover)
  const netAssetsOk = same(figures.netAssets, figures.netAssetsPage, (r) => r.net_assets)
  return {
    turnover: turnoverOk ? figures.turnover : null,
    turnoverPage: turnoverOk ? figures.turnoverPage : null,
    netAssets: netAssetsOk ? figures.netAssets : null,
    netAssetsPage: netAssetsOk ? figures.netAssetsPage : null,
  }
}

// A new PDF holding only the given 1-based pages, in order.
export async function extractPages(pdf: Buffer, pages: number[]): Promise<Buffer> {
  const source = await PDFDocument.load(pdf, { ignoreEncryption: true })
  const out = await PDFDocument.create()
  const copied = await out.copyPages(source, pages.map((p) => p - 1))
  copied.forEach((page) => out.addPage(page))
  return Buffer.from(await out.save())
}

interface OpenRouterBody {
  choices?: { message?: { content?: string } }[]
  error?: { message?: string }
}

// One model call over a PDF. Throws on transport or provider failure (the caller retries next
// refresh); returns null when the model answers but never in the required shape.
async function callModel<T>(
  pdf: Buffer,
  apiKey: string | undefined,
  prompt: { system: string; user: string; schemaName: string; jsonSchema: unknown; parse: z.ZodType<T> }
): Promise<T | null> {
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured')
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://thecommercialdirectory.co.uk',
        'X-Title': 'Commercial Directory Companies House Accounts',
      },
      body: JSON.stringify({
        model: SCANNED_ACCOUNTS_MODEL,
        temperature: 0,
        max_tokens: 1_000,
        response_format: {
          type: 'json_schema',
          json_schema: { name: prompt.schemaName, strict: true, schema: prompt.jsonSchema },
        },
        plugins: [{ id: 'file-parser', pdf: { engine: 'native' } }],
        messages: [
          { role: 'system', content: prompt.system },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt.user },
              {
                type: 'file',
                file: { filename: 'accounts.pdf', file_data: `data:application/pdf;base64,${pdf.toString('base64')}` },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const body = (await res.json()) as OpenRouterBody
    if (!res.ok) throw new Error(body.error?.message ?? `OpenRouter request failed (${res.status})`)
    const content = body.choices?.[0]?.message?.content
    if (!content) continue
    try {
      const parsed = prompt.parse.safeParse(JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, '')))
      if (parsed.success) return parsed.data
    } catch {
      // malformed JSON: try again
    }
  }
  return null
}

// The first reading: the figures, their period and the pages they were read from.
export function readScannedAccounts(pdf: Buffer, apiKey = process.env.OPENROUTER_API_KEY): Promise<ScannedReading | null> {
  return callModel(pdf, apiKey, {
    system: SYSTEM,
    user: 'Read the figures from these accounts.',
    schemaName: 'accounts_figures',
    jsonSchema: JSON_SCHEMA,
    parse: readingSchema,
  })
}

// Read, check, then confirm each figure on its cited page. null when the first reading never came
// back in shape; otherwise the figures that survived (possibly none).
export async function readScannedFigures(
  pdf: Buffer,
  expected: { companyNumber: string; madeUpTo: string; pages: number },
  apiKey = process.env.OPENROUTER_API_KEY
): Promise<ScannedFigures | null> {
  const reading = await readScannedAccounts(pdf, apiKey)
  if (!reading) return null
  const accepted = acceptScannedFigures(reading, expected)
  const pages = Array.from(
    new Set([accepted.turnoverPage, accepted.netAssetsPage].filter((p): p is number => p != null))
  ).sort((a, b) => a - b)
  if (pages.length === 0) return accepted
  const readings = new Map<number, ConfirmReading | null>()
  for (const page of pages) {
    readings.set(
      page,
      await callModel(await extractPages(pdf, [page]), apiKey, {
        system: CONFIRM_SYSTEM,
        user: 'Read the figures from this page.',
        schemaName: 'accounts_page_figures',
        jsonSchema: CONFIRM_JSON_SCHEMA,
        parse: confirmSchema,
      })
    )
  }
  return confirmScannedFigures(accepted, readings)
}
