/** Bounded public-source spot checks for the frozen 40-record evaluation. No AI or database. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { collectCouncilResearchSources } from '../src/lib/planning-intelligence/research-sources'

async function main() {
  const [samplePath, output] = process.argv.slice(2)
  if (!samplePath || !output || existsSync(output)) throw new Error('Supply sample and a new output filename')
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'))
  const results: unknown[] = []
  // Five apparent failures and three plausible commercial schemes; fixed before retrieval.
  for (const index of [2, 8, 19, 25, 28, 16, 24, 30]) {
    const item = sample.selected[index - 1]
    const r = item.record
    const collected = await collectCouncilResearchSources({
      id: r.id, reference: r.lpa_app_no, description: r.description,
      authority: { slug: item.borough, name: r.lpa_name }, links: { council: r.url_planning_app },
    })
    results.push({ index, id: r.id, collected })
    writeFileSync(output, JSON.stringify({ at: new Date().toISOString(), results }, null, 2))
    console.log(`${index} ${r.id}: ${collected.sources.length} sources; ${collected.warnings.join('; ')}`)
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
