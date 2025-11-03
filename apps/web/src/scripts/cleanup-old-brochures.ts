/**
 * Cleanup Script: Remove Old Brochure Files After Migration
 *
 * This script removes the old brochure files after verifying the migration was successful.
 * Run this ONLY after:
 * 1. Migration has been completed
 * 2. Application has been tested
 * 3. You've verified all brochures are accessible
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

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

interface MigrationLog {
  fileId: string
  oldPath: string
  newPath: string
  status: 'success' | 'failed' | 'skipped'
}

interface MigrationLogFile {
  migrationDate: string
  mode: string
  logs: MigrationLog[]
}

async function cleanupOldFiles(logFilePath: string, dryRun: boolean = true) {
  console.log('🧹 Starting cleanup of old brochure files...')
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN' : '⚠️  LIVE MODE (files will be deleted)'}`)
  console.log()

  try {
    // 1. Read migration log
    console.log('1️⃣ Reading migration log...')
    const logContent = fs.readFileSync(logFilePath, 'utf-8')
    const migrationLog: MigrationLogFile = JSON.parse(logContent)

    if (migrationLog.mode !== 'live') {
      console.error('❌ Error: This log is from a dry-run migration.')
      console.log('   Only cleanup logs from actual (live) migrations.')
      process.exit(1)
    }

    console.log(`✅ Loaded log from ${migrationLog.migrationDate}`)
    console.log()

    // 2. Get successful migrations only
    const successfulMigrations = migrationLog.logs.filter(
      log => log.status === 'success' && log.oldPath !== log.newPath
    )

    if (successfulMigrations.length === 0) {
      console.log('ℹ️  No old files to clean up')
      return
    }

    console.log(`2️⃣ Found ${successfulMigrations.length} old files to remove`)
    console.log()

    // 3. Verify new files exist before deleting old ones
    console.log('3️⃣ Verifying new files exist...')
    const verificationsNeeded = successfulMigrations.map(async log => {
      try {
        const { error } = await supabase.storage
          .from('brochures')
          .download(log.newPath)

        if (error) {
          return { path: log.newPath, exists: false, error: error.message }
        }
        return { path: log.newPath, exists: true }
      } catch (error) {
        return {
          path: log.newPath,
          exists: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    const verificationResults = await Promise.all(verificationsNeeded)
    const missingFiles = verificationResults.filter(r => !r.exists)

    if (missingFiles.length > 0) {
      console.error('❌ ERROR: Some new files are missing!')
      console.log('   The following files cannot be found:')
      missingFiles.forEach(f => {
        console.log(`   - ${f.path} (${f.error})`)
      })
      console.log()
      console.log('⚠️  ABORTING: Do not delete old files when new files are missing.')
      console.log('   You may need to rollback the migration.')
      process.exit(1)
    }

    console.log(`✅ All ${successfulMigrations.length} new files verified`)
    console.log()

    // 4. Delete old files
    console.log('4️⃣ Removing old files...')
    console.log('━'.repeat(120))

    let successCount = 0
    let failedCount = 0
    const deletionResults: Array<{ path: string; status: string }> = []

    for (const log of successfulMigrations) {
      try {
        if (!dryRun) {
          const { error } = await supabase.storage
            .from('brochures')
            .remove([log.oldPath])

          if (error) {
            throw new Error(error.message)
          }

          console.log(`🗑️  DELETED: ${log.oldPath}`)
        } else {
          console.log(`🔍 DRY RUN: Would delete ${log.oldPath}`)
        }

        deletionResults.push({ path: log.oldPath, status: 'success' })
        successCount++

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.log(`❌ FAILED: ${log.oldPath} - ${errorMessage}`)

        deletionResults.push({ path: log.oldPath, status: `failed: ${errorMessage}` })
        failedCount++
      }
    }

    console.log('━'.repeat(120))
    console.log()

    // 5. Summary
    console.log('📊 CLEANUP SUMMARY')
    console.log('━'.repeat(80))
    console.log(`Mode:              ${dryRun ? 'DRY RUN' : 'LIVE'}`)
    console.log(`Old files:         ${successfulMigrations.length}`)
    console.log(`✅ Deleted:        ${successCount}`)
    console.log(`❌ Failed:         ${failedCount}`)
    console.log('━'.repeat(80))
    console.log()

    if (dryRun) {
      console.log('💡 This was a DRY RUN. To perform the actual cleanup, run:')
      console.log(`   node -r esbuild-register src/scripts/cleanup-old-brochures.ts "${logFilePath}" --live`)
    } else {
      console.log('✅ Cleanup complete!')
      console.log()
      console.log('ℹ️  Old brochure files have been removed from storage.')
      console.log('   Your migration is now finalized.')
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)

if (args.length === 0) {
  console.error('❌ Error: Migration log file path required')
  console.log()
  console.log('Usage:')
  console.log('  Dry run:  node -r esbuild-register src/scripts/cleanup-old-brochures.ts <log-file-path>')
  console.log('  Live:     node -r esbuild-register src/scripts/cleanup-old-brochures.ts <log-file-path> --live')
  console.log()
  console.log('Example:')
  console.log('  node -r esbuild-register src/scripts/cleanup-old-brochures.ts ./brochure-migration-log-2025-01-15.json --live')
  console.log()
  console.log('⚠️  WARNING: Only run this AFTER verifying your migration was successful!')
  process.exit(1)
}

const logFilePath = args[0]
const isLiveMode = args.includes('--live')

if (!fs.existsSync(logFilePath)) {
  console.error(`❌ Error: Log file not found: ${logFilePath}`)
  process.exit(1)
}

if (isLiveMode) {
  console.log('⚠️  WARNING: You are about to permanently delete old brochure files.')
  console.log('   This action cannot be undone!')
  console.log()
  console.log('   Make sure you have:')
  console.log('   ✓ Tested the application with new file names')
  console.log('   ✓ Verified all brochures are accessible')
  console.log('   ✓ Kept a backup of the migration log')
  console.log()
  console.log('   Press Ctrl+C to cancel, or wait 10 seconds to continue...')
  console.log()

  setTimeout(() => {
    cleanupOldFiles(logFilePath, false).catch(console.error)
  }, 10000)
} else {
  cleanupOldFiles(logFilePath, true).catch(console.error)
}
