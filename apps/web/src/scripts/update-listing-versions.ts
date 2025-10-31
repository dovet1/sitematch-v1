/**
 * Update Listing Versions After Migration
 *
 * This script updates the listing_versions table to reflect the new brochure file paths.
 * Run this AFTER migrating brochure file names.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function updateListingVersions(dryRun: boolean = true) {
  console.log('🔄 Updating listing versions with new brochure paths...')
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN' : '⚠️  LIVE MODE'}\n`)

  try {
    // 1. Get all listing versions with brochures
    console.log('1️⃣ Fetching listing versions...')
    const { data: versions, error: versionsError } = await supabase
      .from('listing_versions')
      .select('id, listing_id, content, version_number, status')

    if (versionsError) {
      throw new Error(`Failed to fetch versions: ${versionsError.message}`)
    }

    console.log(`✅ Found ${versions.length} versions`)

    // 2. Get current file paths from file_uploads
    console.log('2️⃣ Fetching current file paths...')
    const { data: files, error: filesError } = await supabase
      .from('file_uploads')
      .select('id, listing_id, file_path, file_name, file_size, file_type')
      .eq('file_type', 'brochure')

    if (filesError) {
      throw new Error(`Failed to fetch files: ${filesError.message}`)
    }

    console.log(`✅ Found ${files.length} brochure files`)

    // Build a map of listing_id -> brochures
    const listingFilesMap = new Map<string, any[]>()
    files.forEach(file => {
      if (!file.listing_id) return
      const existing = listingFilesMap.get(file.listing_id) || []
      listingFilesMap.set(file.listing_id, [...existing, file])
    })

    // 3. Update versions
    console.log('3️⃣ Updating versions...\n')

    let updatedCount = 0
    let skippedCount = 0
    let unchangedCount = 0

    for (const version of versions) {
      const content = typeof version.content === 'string'
        ? JSON.parse(version.content)
        : version.content

      // Check if version has files (they're stored as an array, not files.brochures)
      if (!content.files || !Array.isArray(content.files) || content.files.length === 0) {
        skippedCount++
        continue
      }

      // Find brochure files in the array
      const brochureFiles = content.files.filter((f: any) => f.file_type === 'brochure')
      if (brochureFiles.length === 0) {
        skippedCount++
        continue
      }

      // Get current brochures for this listing
      const currentBrochures = listingFilesMap.get(version.listing_id) || []

      if (currentBrochures.length === 0) {
        skippedCount++
        continue
      }

      // Update brochure paths in the version
      let hasChanges = false
      const updatedFiles = content.files.map((file: any) => {
        if (file.file_type !== 'brochure') return file

        // Find matching current brochure by ID
        const currentBrochure = currentBrochures.find((f: any) => f.id === file.id)

        if (currentBrochure && currentBrochure.file_path !== file.file_path) {
          hasChanges = true
          console.log(`📝 Version ${version.id} (v${version.version_number}):`)
          console.log(`   Old: ${file.file_path}`)
          console.log(`   New: ${currentBrochure.file_path}`)

          return {
            ...file,
            file_path: currentBrochure.file_path,
            file_name: currentBrochure.file_name
          }
        }

        return file
      })

      if (!hasChanges) {
        unchangedCount++
        continue
      }

      // Update the version content
      const updatedContent = {
        ...content,
        files: updatedFiles
      }

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from('listing_versions')
          .update({ content: updatedContent })
          .eq('id', version.id)

        if (updateError) {
          console.error(`   ❌ Failed to update: ${updateError.message}`)
          continue
        }
      }

      updatedCount++
    }

    console.log()
    console.log('📊 SUMMARY')
    console.log('━'.repeat(80))
    console.log(`Total versions:        ${versions.length}`)
    console.log(`Updated:               ${updatedCount}`)
    console.log(`Unchanged:             ${unchangedCount}`)
    console.log(`Skipped (no brochures):${skippedCount}`)
    console.log('━'.repeat(80))
    console.log()

    if (dryRun) {
      console.log('💡 This was a DRY RUN. To update for real:')
      console.log('   npx dotenv -e .env.local -- tsx src/scripts/update-listing-versions.ts --live')
    } else {
      console.log('✅ Listing versions updated!')
      console.log('   The API should now return correct file paths.')
    }

  } catch (error) {
    console.error('❌ Update failed:', error)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const isLiveMode = args.includes('--live')

if (isLiveMode) {
  console.log('⚠️  WARNING: You are about to update listing versions in LIVE mode.')
  console.log('   Press Ctrl+C to cancel, or wait 3 seconds to continue...')
  console.log()

  setTimeout(() => {
    updateListingVersions(false).catch(console.error)
  }, 3000)
} else {
  updateListingVersions(true).catch(console.error)
}
