/**
 * One-record OpenRouter smoke test. Uses synthetic public-planning-style text and prints
 * no environment values. Run from apps/web with:
 *   npm run smoke:planning-llm
 */
import { loadEnvConfig } from '@next/env'
import { classifyWithOpenRouter } from '../src/lib/planning-intelligence/openrouter'

loadEnvConfig(process.cwd())

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured')
  const result = await classifyWithOpenRouter({
    id: 'synthetic-smoke-test',
    reference: 'TEST/2026/001',
    authority: { slug: 'test-council', name: 'Test Council' },
    address: 'Former office site, Example Road, Teston',
    description:
      'Demolition of existing offices and construction of a mixed-use scheme comprising 24 dwellings and 650 sqm of Class E commercial floorspace. No occupier is named.',
    procedure: 'full',
    dwelling_count: 24,
    commercial: true,
    commercial_work: 'new',
    commercial_use_class: 'E',
    floorspace_sqm: 650,
    stage: 'pending',
  }, { apiKey })

  console.info(JSON.stringify({
    ok: true,
    model: result.model,
    relevance: result.classification.relevance,
    createsCommercialSpace: result.classification.commercialSpace.creates,
    useClasses: result.classification.commercialSpace.useClasses,
    dwellings: result.classification.dwellings.count,
    dwellingBasis: result.classification.dwellings.basis,
    observations: result.classification.observations.length,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'OpenRouter smoke test failed')
  process.exit(1)
})

