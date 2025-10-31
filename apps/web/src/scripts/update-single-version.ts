/**
 * Test Update: Update ONE listing version
 *
 * This script updates just the Poundstretcher listing version we migrated earlier.
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

const LISTING_ID = 'c42ebc91-cdbf-4f50-9435-cd1a58c22a0d' // Dawat

async function updateSingleVersion(dryRun: boolean = true) {
  console.log('🧪 Testing version update for Dawat listing...')
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN' : '⚠️  LIVE MODE'}\n`)

  try {
    // 1. Get the live version for this listing
    console.log('1️⃣ Finding listing version...')
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('live_version_id, current_version_id')
      .eq('id', LISTING_ID)
      .single()

    if (listingError || !listing) {
      throw new Error('Failed to find listing')
    }

    const versionId = listing.live_version_id || listing.current_version_id

    if (!versionId) {
      console.log('❌ No version found for this listing')
      return
    }

    console.log(`✅ Found version: ${versionId}`)

    // 2. Get the version content
    const { data: version, error: versionError } = await supabase
      .from('listing_versions')
      .select('id, version_number, content')
      .eq('id', versionId)
      .single()

    if (versionError || !version) {
      throw new Error('Failed to fetch version')
    }

    console.log(`   Version number: ${version.version_number}`)
    console.log()

    // 3. Get current brochure file from file_uploads
    console.log('2️⃣ Getting current brochure file path...')
    const { data: currentFile, error: fileError } = await supabase
      .from('file_uploads')
      .select('id, file_path, file_name')
      .eq('listing_id', LISTING_ID)
      .eq('file_type', 'brochure')
      .single()

    if (fileError || !currentFile) {
      throw new Error('Failed to fetch current file')
    }

    console.log(`✅ Current file path: ${currentFile.file_path}`)
    console.log()

    // 4. Parse version content
    const content = typeof version.content === 'string'
      ? JSON.parse(version.content)
      : version.content

    // 5. Find brochure in version
    console.log('3️⃣ Checking version content...')

    if (!content.files || !Array.isArray(content.files)) {
      console.log('❌ No files array in version content')
      return
    }

    const brochure = content.files.find((f: any) =>
      f.file_type === 'brochure' && f.id === currentFile.id
    )

    if (!brochure) {
      console.log('❌ Brochure not found in version')
      return
    }

    console.log(`   Version has brochure: ${brochure.file_name}`)
    console.log(`   Version file_path:    ${brochure.file_path}`)
    console.log()

    // 6. Check if update needed
    if (brochure.file_path === currentFile.file_path) {
      console.log('✅ Version already has correct path! No update needed.')
      return
    }

    console.log('📋 UPDATE PLAN:')
    console.log('━'.repeat(80))
    console.log(`Version ID:       ${version.id}`)
    console.log(`Version number:   ${version.version_number}`)
    console.log(`Brochure ID:      ${currentFile.id}`)
    console.log()
    console.log(`Old path:         ${brochure.file_path}`)
    console.log(`New path:         ${currentFile.file_path}`)
    console.log('━'.repeat(80))
    console.log()

    if (dryRun) {
      console.log('🔍 DRY RUN - No changes will be made.')
      console.log()
      console.log('To update for real:')
      console.log('  npx dotenv -e .env.local -- tsx src/scripts/update-single-version.ts --live')
      return
    }

    // 7. Update the version
    console.log('4️⃣ Updating version...')

    const updatedFiles = content.files.map((file: any) => {
      if (file.id === currentFile.id) {
        return {
          ...file,
          file_path: currentFile.file_path,
          file_name: currentFile.file_name
        }
      }
      return file
    })

    const updatedContent = {
      ...content,
      files: updatedFiles
    }

    const { error: updateError } = await supabase
      .from('listing_versions')
      .update({ content: updatedContent })
      .eq('id', version.id)

    if (updateError) {
      throw new Error(`Update failed: ${updateError.message}`)
    }

    console.log('✅ Version updated successfully!')
    console.log()
    console.log('💡 Now refresh the listing page and check if the brochure shows the new name.')
    console.log('   URL: https://sitematcher.co.uk/search/c42ebc91-cdbf-4f50-9435-cd1a58c22a0d')

  } catch (error) {
    console.error('❌ Update failed:', error)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const isLiveMode = args.includes('--live')

if (isLiveMode) {
  console.log('⚠️  WARNING: You are about to update ONE version in LIVE mode.')
  console.log('   Press Ctrl+C to cancel, or wait 3 seconds to continue...')
  console.log()

  setTimeout(() => {
    updateSingleVersion(false).catch(console.error)
  }, 3000)
} else {
  updateSingleVersion(true).catch(console.error)
}
