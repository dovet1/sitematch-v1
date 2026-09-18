/** Seeds Companies House suggestions for brands with no confirmed company, for admin review on
 * the brand's "Companies House" tab. Writes only brand_company_suggestions; links nothing.
 *
 * Run from apps/web:
 *   ../../node_modules/.bin/tsx scripts/suggest-brand-companies.ts            # brands with no link and no suggestions
 *   ../../node_modules/.bin/tsx scripts/suggest-brand-companies.ts --all      # re-suggest every unlinked brand
 *   ../../node_modules/.bin/tsx scripts/suggest-brand-companies.ts --limit 20
 *
 * Each brand costs 5 searches; the pacing keeps a run under CH's 600 requests / 5 minutes.
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

const PER_BRAND_MS = 2_700

async function main() {
  const { suggestCompaniesForBrand } = await import('../src/lib/companies-house/service')
  const args = process.argv.slice(2)
  const all = args.includes('--all')
  const limitArg = args.indexOf('--limit')
  const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const [brands, links, suggested] = await Promise.all([
    db.from('brands').select('id, name').order('name'),
    db.from('brand_companies').select('brand_id'),
    db.from('brand_company_suggestions').select('brand_id'),
  ])
  for (const r of [brands, links, suggested]) if (r.error) throw r.error
  const linked = new Set((links.data ?? []).map((r) => r.brand_id))
  const hasSuggestions = new Set((suggested.data ?? []).map((r) => r.brand_id))
  const todo = (brands.data ?? [])
    .filter((b) => !linked.has(b.id) && (all || !hasSuggestions.has(b.id)))
    .slice(0, limit)

  console.log(`${todo.length} brands to suggest for (~${Math.ceil((todo.length * PER_BRAND_MS) / 60_000)} min)`)
  let done = 0
  for (const brand of todo) {
    const started = Date.now()
    try {
      const rows = await suggestCompaniesForBrand(db, brand)
      const top = rows[0]
      console.log(
        `${String(++done).padStart(4)} ${brand.name.padEnd(32)} ${top ? `${top.company_number} ${top.company_name} (${top.score})` : '— no candidates'}`
      )
    } catch (e) {
      console.error(`     ${brand.name}: ${e instanceof Error ? e.message : e}`)
    }
    await new Promise((r) => setTimeout(r, Math.max(0, PER_BRAND_MS - (Date.now() - started))))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
