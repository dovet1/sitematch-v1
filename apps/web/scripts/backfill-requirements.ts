/**
 * Backfill the `requirements` tables from all approved `listings`.
 *
 * For each status='approved' listing it builds a normalized seed (sourced from the live
 * version content, falling back to base tables — see lib/requirement-seed.ts), resolves
 * brand_id via a case-insensitive brands.name = company_name match, and calls the
 * atomic + idempotent `upsert_requirement_from_seed` RPC. Safe to re-run.
 *
 * Usage: npx tsx scripts/backfill-requirements.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (loaded from .env.local).
 */

import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { listingToRequirementSeed } from '../src/lib/requirement-seed'

loadEnvConfig(process.cwd())

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PAGE_SIZE = 500

async function fetchApprovedListingIds(): Promise<string[]> {
  const ids: string[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('listings')
      .select('id')
      .eq('status', 'approved')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const page = data || []
    ids.push(...page.map((r: { id: string }) => r.id))
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return ids
}

async function buildBrandLookup(): Promise<Map<string, string>> {
  const lookup = new Map<string, string>()
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('brands')
      .select('id, name')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const page = data || []
    for (const b of page as { id: string; name: string }[]) {
      if (b.name) lookup.set(b.name.trim().toLowerCase(), b.id)
    }
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return lookup
}

async function main() {
  console.log('Loading approved listings…')
  const listingIds = await fetchApprovedListingIds()
  console.log(`Found ${listingIds.length} approved listings`)

  const brandLookup = await buildBrandLookup()
  console.log(`Loaded ${brandLookup.size} brands for matching`)

  let processed = 0
  let unmatched = 0
  let failed = 0
  const unmatchedNames = new Set<string>()

  for (const listingId of listingIds) {
    try {
      const seed = await listingToRequirementSeed(supabase, listingId)
      if (!seed) {
        console.warn(`  skip ${listingId}: no listing row`)
        continue
      }

      const brandId = seed.company_name
        ? brandLookup.get(seed.company_name.trim().toLowerCase()) ?? null
        : null
      seed.brand_id = brandId
      if (!brandId) {
        unmatched += 1
        if (seed.company_name) unmatchedNames.add(seed.company_name)
      }

      const { error } = await supabase.rpc('upsert_requirement_from_seed', { seed })
      if (error) throw error
      processed += 1
    } catch (err) {
      failed += 1
      console.error(`  FAILED ${listingId}:`, err instanceof Error ? err.message : err)
    }
  }

  console.log('\n--- Backfill complete ---')
  console.log(`Processed: ${processed}`)
  console.log(`Failed:    ${failed}`)
  console.log(`Unmatched brand (brand_id NULL): ${unmatched}`)
  if (unmatchedNames.size > 0) {
    console.log('\nDistinct unmatched company names (review list):')
    for (const name of Array.from(unmatchedNames).sort()) console.log(`  - ${name}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill crashed:', err)
    process.exit(1)
  })
