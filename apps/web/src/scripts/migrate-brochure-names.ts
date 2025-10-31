/**
 * Migration Script: Rename Brochure Files to Company Names
 *
 * This script renames all brochure files from random names to company-based names.
 * Process:
 * 1. Copy files to new paths in Supabase Storage
 * 2. Update file_uploads table with new paths
 * 3. Keep old files for rollback (delete manually after verification)
 * 4. Log all changes for audit trail
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface BrochureRecord {
  file_id: string
  file_name: string
  file_path: string
  listing_id: string
  company_name: string
}

interface MigrationLog {
  fileId: string
  listingId: string
  companyName: string
  oldPath: string
  newPath: string
  oldName: string
  newName: string
  status: 'success' | 'failed' | 'skipped'
  error?: string
  timestamp: string
}

function sanitizeCompanyName(companyName: string): string {
  return companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100)
}

async function migrateBrochureNames(dryRun: boolean = true) {
  console.log('🚀 Starting brochure file migration...')
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes will be made)' : '⚠️  LIVE MODE (files will be renamed)'}`)
  console.log()

  const migrationLogs: MigrationLog[] = []
  const startTime = Date.now()

  try {
    // 1. Fetch all brochures with their listing info
    console.log('1️⃣ Fetching brochure files from database...')
    const { data: brochures, error: fetchError } = await supabase
      .from('file_uploads')
      .select('id, file_name, file_path, listing_id')
      .eq('file_type', 'brochure')
      .eq('bucket_name', 'brochures')
      .not('file_path', 'is', null)
      .not('listing_id', 'is', null)

    if (fetchError) {
      throw new Error(`Failed to fetch brochures: ${fetchError.message}`)
    }

    // Fetch listings data separately in batches
    const listingIds = Array.from(new Set(brochures.map((b: any) => b.listing_id)))
    const batchSize = 100
    const listings: any[] = []

    for (let i = 0; i < listingIds.length; i += batchSize) {
      const batch = listingIds.slice(i, i + batchSize)
      const { data: batchListings, error: listingsError } = await supabase
        .from('listings')
        .select('id, company_name')
        .in('id', batch)

      if (listingsError) {
        throw new Error(`Failed to fetch listings: ${listingsError.message}`)
      }

      listings.push(...batchListings)
    }

    const listingMap = new Map(listings.map((l: any) => [l.id, l]))

    const brochureRecords: BrochureRecord[] = brochures
      .map((b: any) => {
        const listing = listingMap.get(b.listing_id)
        if (!listing) return null
        return {
          file_id: b.id,
          file_name: b.file_name,
          file_path: b.file_path,
          listing_id: b.listing_id,
          company_name: listing.company_name
        }
      })
      .filter((b): b is BrochureRecord => b !== null)

    console.log(`✅ Found ${brochureRecords.length} brochure files`)
    console.log()

    // 2. Group by listing to handle multiple brochures per listing
    console.log('2️⃣ Grouping brochures by listing...')
    const listingBrochureMap = new Map<string, BrochureRecord[]>()
    brochureRecords.forEach(b => {
      const existing = listingBrochureMap.get(b.listing_id) || []
      listingBrochureMap.set(b.listing_id, [...existing, b])
    })

    console.log(`✅ Processing ${listingBrochureMap.size} listings`)
    console.log()

    // 3. Process each listing's brochures
    console.log('3️⃣ Processing brochure renames...')
    console.log('━'.repeat(120))

    let successCount = 0
    let skippedCount = 0
    let failedCount = 0

    for (const [listingId, brochures] of listingBrochureMap.entries()) {
      const companyName = brochures[0].company_name
      const sanitized = sanitizeCompanyName(companyName)

      for (let i = 0; i < brochures.length; i++) {
        const brochure = brochures[i]
        const fileExtension = brochure.file_name.split('.').pop() || 'pdf'

        // Generate new name
        const proposedName = brochures.length > 1 && i > 0
          ? `${sanitized}-${i + 1}.${fileExtension}`
          : `${sanitized}.${fileExtension}`

        const proposedPath = `${listingId}/${proposedName}`

        // Check if already correctly named
        if (brochure.file_path === proposedPath) {
          console.log(`⏭️  SKIP: ${brochure.file_name} (already correctly named)`)
          migrationLogs.push({
            fileId: brochure.file_id,
            listingId,
            companyName,
            oldPath: brochure.file_path,
            newPath: proposedPath,
            oldName: brochure.file_name,
            newName: proposedName,
            status: 'skipped',
            timestamp: new Date().toISOString()
          })
          skippedCount++
          continue
        }

        try {
          if (!dryRun) {
            // Copy file to new location in storage
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('brochures')
              .download(brochure.file_path)

            if (downloadError) {
              throw new Error(`Download failed: ${downloadError.message}`)
            }

            // Upload to new location
            const { error: uploadError } = await supabase.storage
              .from('brochures')
              .upload(proposedPath, fileData, {
                contentType: 'application/pdf',
                cacheControl: '3600',
                upsert: false // Don't overwrite if exists
              })

            if (uploadError) {
              throw new Error(`Upload failed: ${uploadError.message}`)
            }

            // Update database record
            const { error: updateError } = await supabase
              .from('file_uploads')
              .update({
                file_path: proposedPath,
                file_name: proposedName,
                updated_at: new Date().toISOString()
              })
              .eq('id', brochure.file_id)

            if (updateError) {
              // Try to clean up the uploaded file
              await supabase.storage.from('brochures').remove([proposedPath])
              throw new Error(`Database update failed: ${updateError.message}`)
            }

            console.log(`✅ SUCCESS: ${brochure.file_name} → ${proposedName}`)
          } else {
            console.log(`🔍 DRY RUN: ${brochure.file_name} → ${proposedName}`)
          }

          migrationLogs.push({
            fileId: brochure.file_id,
            listingId,
            companyName,
            oldPath: brochure.file_path,
            newPath: proposedPath,
            oldName: brochure.file_name,
            newName: proposedName,
            status: 'success',
            timestamp: new Date().toISOString()
          })
          successCount++

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.log(`❌ FAILED: ${brochure.file_name} - ${errorMessage}`)

          migrationLogs.push({
            fileId: brochure.file_id,
            listingId,
            companyName,
            oldPath: brochure.file_path,
            newPath: proposedPath,
            oldName: brochure.file_name,
            newName: proposedName,
            status: 'failed',
            error: errorMessage,
            timestamp: new Date().toISOString()
          })
          failedCount++
        }
      }
    }

    console.log('━'.repeat(120))
    console.log()

    // 4. Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log('📊 MIGRATION SUMMARY')
    console.log('━'.repeat(80))
    console.log(`Mode:              ${dryRun ? 'DRY RUN' : 'LIVE'}`)
    console.log(`Total files:       ${brochureRecords.length}`)
    console.log(`✅ Success:        ${successCount}`)
    console.log(`⏭️  Skipped:        ${skippedCount}`)
    console.log(`❌ Failed:         ${failedCount}`)
    console.log(`Duration:          ${duration}s`)
    console.log('━'.repeat(80))
    console.log()

    // 5. Save migration log
    const logFileName = `brochure-migration-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    const logPath = path.join(process.cwd(), logFileName)

    const logData = {
      migrationDate: new Date().toISOString(),
      mode: dryRun ? 'dry-run' : 'live',
      summary: {
        total: brochureRecords.length,
        success: successCount,
        skipped: skippedCount,
        failed: failedCount,
        durationSeconds: parseFloat(duration)
      },
      logs: migrationLogs
    }

    fs.writeFileSync(logPath, JSON.stringify(logData, null, 2))
    console.log(`📄 Migration log saved to: ${logPath}`)
    console.log()

    if (dryRun) {
      console.log('💡 This was a DRY RUN. To perform the actual migration, run:')
      console.log('   node -r esbuild-register src/scripts/migrate-brochure-names.ts --live')
    } else {
      console.log('✅ Migration complete!')
      console.log()
      console.log('⚠️  IMPORTANT: Old files are still in storage for rollback.')
      console.log('   After verifying everything works:')
      console.log('   1. Test your application thoroughly')
      console.log('   2. Run cleanup script to remove old files:')
      console.log('      node -r esbuild-register src/scripts/cleanup-old-brochures.ts')
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const isLiveMode = args.includes('--live')

if (isLiveMode) {
  console.log('⚠️  WARNING: You are about to run the migration in LIVE mode.')
  console.log('   This will rename brochure files in your database and storage.')
  console.log()
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...')
  console.log()

  setTimeout(() => {
    migrateBrochureNames(false).catch(console.error)
  }, 5000)
} else {
  migrateBrochureNames(true).catch(console.error)
}
