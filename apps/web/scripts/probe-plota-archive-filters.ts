/**
 * Three-request probe for whether Plota applies its derived commercial/dwelling filters
 * to pre-2026 archive records. Prints metadata and field presence only, never the key or
 * application content.
 */
import { loadEnvConfig } from '@next/env'
import { PlotaClient, PlotaError } from '../src/lib/planning-intelligence/plota'

loadEnvConfig(process.cwd())

async function main() {
  const apiKey = process.env.PLOTA_API_KEY
  if (!apiKey) throw new Error('PLOTA_API_KEY is not configured')
  const client = new PlotaClient(apiKey)
  const common = {
    council: 'canterbury',
    date_from: '2025-11-01',
    date_to: '2025-11-30',
    limit: '1',
  }
  const probes = [
    { name: 'unfiltered', params: common },
    {
      name: 'commercial_work',
      params: {
        ...common,
        commercial_work: 'new,extension,to-commercial,between,loss,minor',
      },
    },
    { name: 'dwelling_count', params: { ...common, dmin: '1' } },
  ]

  for (const probe of probes) {
    try {
      const { page, usage } = await client.search(probe.params)
      const first = page.data[0]
      console.info(JSON.stringify({
        probe: probe.name,
        rows: page.data.length,
        historicalAvailable: page.meta.historical_available ?? null,
        historicalIncluded: page.meta.historical_included ?? null,
        historicalMore: page.meta.historical_more ?? null,
        historicalNote: page.meta.historical_note ?? null,
        hint: page.meta.hint ?? null,
        firstSource: first?.source ?? null,
        firstHasCommercialWork: first?.commercial_work != null,
        firstHasDwellingCount: first?.dwelling_count != null,
        monthlyRemaining: usage.monthlyRemaining,
      }))
    } catch (error) {
      console.info(JSON.stringify({
        probe: probe.name,
        error: error instanceof PlotaError ? error.message : 'Unexpected probe failure',
        status: error instanceof PlotaError ? error.status : null,
      }))
    }
  }

  // Plota documents standard rate headers "plus monthly counterparts" without naming
  // those counterparts. Print only quota-related response headers so the production
  // reserve reads the provider's actual spelling; no request headers or key are printed.
  const headerResponse = await fetch(
    'https://api.plota.co.uk/v1/applications?nation=england&date_from=2026-09-01&date_to=2026-09-01&limit=1&include_contact=false',
    { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } }
  )
  const quotaHeaders = Object.fromEntries(
    Array.from(headerResponse.headers.entries()).filter(([name]) =>
      /rate|quota|limit|remaining|request/i.test(name)
    )
  )
  console.info(JSON.stringify({ probe: 'quota_headers', status: headerResponse.status, quotaHeaders }))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Archive filter probe failed')
  process.exit(1)
})
