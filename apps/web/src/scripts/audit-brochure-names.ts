/**
 * Audit Script: Analyze Brochure File Names
 *
 * This script analyzes all brochure files in the database and reports:
 * - Total brochures
 * - Listings with/without brochures
 * - Duplicate company names
 * - Files that need renaming
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface BrochureRecord {
  file_id: string
  file_name: string
  file_path: string
  file_size: number
  listing_id: string
  company_name: string
  listing_title: string
  listing_status: string
  created_at: string
}

interface CompanyDuplicateRecord {
  company_name: string
  listing_count: number
  brochure_count: number
  listing_ids: string[]
}

function sanitizeCompanyName(companyName: string): string {
  return companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100) // Limit length
}

async function auditBrochures() {
  console.log('🔍 Starting brochure audit...\n')

  // 1. Get all brochure files
  console.log('1️⃣ Fetching all brochure files...')
  const { data: brochures, error: brochuresError } = await supabase
    .from('file_uploads')
    .select('id, file_name, file_path, file_size, listing_id, created_at')
    .eq('file_type', 'brochure')
    .eq('bucket_name', 'brochures')
    .not('listing_id', 'is', null)
    .order('created_at', { ascending: false })

  if (brochuresError) {
    console.error('❌ Error fetching brochures:', brochuresError)
    return
  }

  console.log(`   Found ${brochures.length} brochure files`)

  // Get all unique listing IDs
  const listingIds = Array.from(new Set(brochures.map((b: any) => b.listing_id)))
  console.log(`   Fetching data for ${listingIds.length} listings...`)

  // Get all listings data in batches (to avoid URL length limits)
  const batchSize = 100
  const listings: any[] = []

  for (let i = 0; i < listingIds.length; i += batchSize) {
    const batch = listingIds.slice(i, i + batchSize)
    const { data: batchListings, error: listingsError } = await supabase
      .from('listings')
      .select('id, company_name, title, status')
      .in('id', batch)

    if (listingsError) {
      console.error('❌ Error fetching listings:', listingsError)
      return
    }

    listings.push(...batchListings)
    process.stdout.write(`\r   Fetched ${listings.length}/${listingIds.length} listings...`)
  }
  console.log(' ✅')

  // Create a map for quick lookup
  const listingMap = new Map(listings.map((l: any) => [l.id, l]))

  const brochureRecords: BrochureRecord[] = brochures
    .map((b: any) => {
      const listing = listingMap.get(b.listing_id)
      if (!listing) return null

      return {
        file_id: b.id,
        file_name: b.file_name,
        file_path: b.file_path,
        file_size: b.file_size,
        listing_id: b.listing_id,
        company_name: listing.company_name,
        listing_title: listing.title,
        listing_status: listing.status,
        created_at: b.created_at
      }
    })
    .filter((b): b is BrochureRecord => b !== null)

  console.log(`✅ Found ${brochureRecords.length} brochure files with listing data\n`)

  // 2. Check for duplicate company names
  console.log('2️⃣ Checking for duplicate company names...')

  // Build duplicate companies list from the listings we already have
  const companyMap = new Map<string, string[]>()
  listings.forEach((l: any) => {
    const existing = companyMap.get(l.company_name) || []
    companyMap.set(l.company_name, [...existing, l.id])
  })

  const duplicateCompanies = Array.from(companyMap.entries())
    .filter(([_, ids]) => ids.length > 1)
    .map(([name, ids]) => ({
      company_name: name,
      listing_count: ids.length,
      listing_ids: ids
    }))

  console.log(`✅ Found ${duplicateCompanies.length} companies with multiple listings\n`)

  // 3. Analyze brochures by listing
  console.log('3️⃣ Analyzing brochures per listing...')
  const listingBrochureMap = new Map<string, BrochureRecord[]>()
  brochureRecords.forEach(b => {
    const existing = listingBrochureMap.get(b.listing_id) || []
    listingBrochureMap.set(b.listing_id, [...existing, b])
  })

  const listingsWithMultipleBrochures = Array.from(listingBrochureMap.entries())
    .filter(([_, brochures]) => brochures.length > 1)

  console.log(`✅ ${listingsWithMultipleBrochures.length} listings have multiple brochures\n`)

  // 4. Generate proposed new names
  console.log('4️⃣ Generating proposed new names...\n')
  console.log('━'.repeat(120))
  console.log(`${'Current File Name'.padEnd(50)} | ${'Proposed New Name'.padEnd(50)} | Status`)
  console.log('━'.repeat(120))

  const renameProposals: Array<{
    fileId: string
    listingId: string
    companyName: string
    currentPath: string
    currentName: string
    proposedName: string
    proposedPath: string
    needsRename: boolean
  }> = []

  listingBrochureMap.forEach((brochures, listingId) => {
    const companyName = brochures[0].company_name
    const sanitized = sanitizeCompanyName(companyName)

    brochures.forEach((brochure, index) => {
      const fileExtension = brochure.file_name.split('.').pop() || 'pdf'
      const baseName = sanitized
      const proposedName = brochures.length > 1 && index > 0
        ? `${baseName}-${index + 1}.${fileExtension}`
        : `${baseName}.${fileExtension}`

      // Proposed path keeps the listing folder structure
      const proposedPath = `${listingId}/${proposedName}`

      const needsRename = brochure.file_name !== proposedName

      renameProposals.push({
        fileId: brochure.file_id,
        listingId,
        companyName,
        currentPath: brochure.file_path,
        currentName: brochure.file_name,
        proposedName,
        proposedPath,
        needsRename
      })

      const statusIcon = needsRename ? '🔄' : '✓'
      console.log(
        `${brochure.file_name.padEnd(50)} | ${proposedName.padEnd(50)} | ${statusIcon}`
      )
    })
  })

  console.log('━'.repeat(120))
  console.log()

  // 5. Summary statistics
  console.log('📊 SUMMARY STATISTICS')
  console.log('━'.repeat(80))
  console.log(`Total brochure files:              ${brochureRecords.length}`)
  console.log(`Files that need renaming:          ${renameProposals.filter(p => p.needsRename).length}`)
  console.log(`Files already correctly named:     ${renameProposals.filter(p => !p.needsRename).length}`)
  console.log(`Listings with brochures:           ${listingBrochureMap.size}`)
  console.log(`Listings with multiple brochures:  ${listingsWithMultipleBrochures.length}`)
  console.log(`Companies with duplicate names:    ${duplicateCompanies.length}`)
  console.log('━'.repeat(80))
  console.log()

  // 6. Show problematic cases
  if (duplicateCompanies.length > 0) {
    console.log('⚠️  COMPANIES WITH MULTIPLE LISTINGS:')
    console.log('━'.repeat(80))
    duplicateCompanies.slice(0, 10).forEach((dup: any) => {
      console.log(`  ${dup.company_name}: ${dup.listing_count} listings`)
    })
    if (duplicateCompanies.length > 10) {
      console.log(`  ... and ${duplicateCompanies.length - 10} more`)
    }
    console.log('━'.repeat(80))
    console.log('Note: Each listing has its own folder, so duplicates are handled naturally.')
    console.log()
  }

  // 7. Save detailed report to JSON
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalBrochures: brochureRecords.length,
      needsRename: renameProposals.filter(p => p.needsRename).length,
      alreadyCorrect: renameProposals.filter(p => !p.needsRename).length,
      listingsWithBrochures: listingBrochureMap.size,
      duplicateCompanies: duplicateCompanies.length
    },
    renameProposals,
    duplicateCompanies
  }

  const fs = await import('fs')
  const path = await import('path')
  const reportPath = path.join(process.cwd(), 'brochure-audit-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(`✅ Detailed report saved to: ${reportPath}`)
  console.log()
  console.log('Next steps:')
  console.log('  1. Review the report above')
  console.log('  2. Run the migration script: npm run migrate:brochure-names')
  console.log('  3. Or use: node -r esbuild-register src/scripts/migrate-brochure-names.ts')
}

auditBrochures().catch(console.error)
