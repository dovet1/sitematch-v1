/**
 * Test Migration: Rename ONE brochure file
 *
 * This script lets you test the migration with just one file first.
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

function sanitizeCompanyName(companyName: string): string {
  return companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100)
}

async function migrateOneBrochure(dryRun: boolean = true) {
  console.log('🧪 Testing migration with ONE file...')
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN' : '⚠️  LIVE MODE'}\n`)

  try {
    // 1. Get ONE unmigrated brochure file
    console.log('1️⃣ Finding an unmigrated brochure file...')
    const { data: brochures, error: fetchError } = await supabase
      .from('file_uploads')
      .select('id, file_name, file_path, listing_id')
      .eq('file_type', 'brochure')
      .eq('bucket_name', 'brochures')
      .not('file_path', 'is', null)
      .not('listing_id', 'is', null)
      .limit(50) // Get multiple to filter for unmigrated ones

    if (fetchError) {
      throw new Error(`Failed to fetch brochure: ${fetchError.message}`)
    }

    if (!brochures || brochures.length === 0) {
      console.log('No brochures found!')
      return
    }

    // Filter out already-migrated files (those that don't have temp_ prefix or timestamps)
    const unmigratedBrochures = brochures.filter(b => {
      // Already migrated files have pattern: {uuid}/{sanitized-name}.pdf
      // Unmigrated files have pattern: temp_{uuid}/{timestamp}-{original-name}.pdf
      const path = b.file_path || ''

      // Check if it's a temp file (unmigrated) or has timestamp pattern
      return path.includes('temp_') || /\/\d{13,}-/.test(path)
    })

    if (unmigratedBrochures.length === 0) {
      console.log('No unmigrated brochures found! All files may already be migrated.')
      return
    }

    // 2. Find a file with a valid listing
    console.log('2️⃣ Finding a file with valid listing...')
    let brochure: any = null
    let listing: any = null

    for (const candidate of unmigratedBrochures) {
      const { data: candidateListing, error: listingError } = await supabase
        .from('listings')
        .select('id, company_name')
        .eq('id', candidate.listing_id)
        .single()

      if (!listingError && candidateListing) {
        brochure = candidate
        listing = candidateListing
        break
      } else {
        console.log(`   ⚠️  Skipping ${candidate.file_name} (listing not found - may be deleted)`)
      }
    }

    if (!brochure || !listing) {
      console.log('❌ No unmigrated brochures with valid listings found!')
      return
    }

    console.log(`✅ Found: ${brochure.file_name}`)
    console.log(`✅ Company: ${listing.company_name}`)
    console.log()

    // 3. Generate new name
    const fileExtension = brochure.file_name.split('.').pop() || 'pdf'
    const sanitized = sanitizeCompanyName(listing.company_name)
    const newFileName = `${sanitized}.${fileExtension}`
    const newPath = `${brochure.listing_id}/${newFileName}`

    console.log('📋 MIGRATION PLAN:')
    console.log('━'.repeat(80))
    console.log(`File ID:      ${brochure.id}`)
    console.log(`Listing ID:   ${brochure.listing_id}`)
    console.log(`Company:      ${listing.company_name}`)
    console.log()
    console.log(`Current name: ${brochure.file_name}`)
    console.log(`Current path: ${brochure.file_path}`)
    console.log()
    console.log(`New name:     ${newFileName}`)
    console.log(`New path:     ${newPath}`)
    console.log('━'.repeat(80))
    console.log()

    // Check if already correctly named
    if (brochure.file_path === newPath) {
      console.log('✅ File is already correctly named! No changes needed.')
      return
    }

    if (dryRun) {
      console.log('🔍 DRY RUN - No changes will be made.')
      console.log()
      console.log('To run for real:')
      console.log('  npx dotenv -e .env.local -- tsx src/scripts/migrate-single-brochure.ts --live')
      return
    }

    // 4. Perform migration
    console.log('4️⃣ Starting migration...')

    // Download file
    console.log('   Downloading file...')
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('brochures')
      .download(brochure.file_path)

    if (downloadError) {
      throw new Error(`Download failed: ${downloadError.message}`)
    }
    console.log('   ✅ Downloaded')

    // Upload to new location
    console.log('   Uploading with new name...')
    const { error: uploadError } = await supabase.storage
      .from('brochures')
      .upload(newPath, fileData, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }
    console.log('   ✅ Uploaded')

    // Update database
    console.log('   Updating database...')
    const { error: updateError } = await supabase
      .from('file_uploads')
      .update({
        file_path: newPath,
        file_name: newFileName,
        updated_at: new Date().toISOString()
      })
      .eq('id', brochure.id)

    if (updateError) {
      // Try to clean up the uploaded file
      await supabase.storage.from('brochures').remove([newPath])
      throw new Error(`Database update failed: ${updateError.message}`)
    }
    console.log('   ✅ Database updated')
    console.log()

    console.log('✅ SUCCESS! File has been renamed.')
    console.log()
    console.log('📝 Summary:')
    console.log(`   Old file is still at: ${brochure.file_path}`)
    console.log(`   New file is now at:   ${newPath}`)
    console.log(`   Database points to:   ${newPath}`)
    console.log()
    console.log('💡 Test your app to make sure the brochure is accessible.')
    console.log('   If everything works, you can delete the old file or run the full migration.')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const isLiveMode = args.includes('--live')

if (isLiveMode) {
  console.log('⚠️  WARNING: You are about to migrate ONE file in LIVE mode.')
  console.log('   Press Ctrl+C to cancel, or wait 3 seconds to continue...')
  console.log()

  setTimeout(() => {
    migrateOneBrochure(false).catch(console.error)
  }, 3000)
} else {
  migrateOneBrochure(true).catch(console.error)
}
