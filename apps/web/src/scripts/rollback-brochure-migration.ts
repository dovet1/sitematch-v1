/**
 * Rollback Script: Restore Original Brochure File Names
 *
 * This script rolls back the brochure migration using the migration log.
 * It will:
 * 1. Read the migration log file
 * 2. Copy files back to their original paths
 * 3. Update database records
 * 4. Clean up new files
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

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

interface MigrationLogFile {
  migrationDate: string
  mode: string
  summary: {
    total: number
    success: number
    skipped: number
    failed: number
    durationSeconds: number
  }
  logs: MigrationLog[]
}

async function rollbackMigration(logFilePath: string, dryRun: boolean = true) {
  console.log('🔄 Starting brochure migration rollback...')
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN' : '⚠️  LIVE MODE'}`)
  console.log()

  try {
    // 1. Read migration log
    console.log('1️⃣ Reading migration log...')
    const logContent = fs.readFileSync(logFilePath, 'utf-8')
    const migrationLog: MigrationLogFile = JSON.parse(logContent)

    console.log(`✅ Loaded log from ${migrationLog.migrationDate}`)
    console.log(`   Original migration: ${migrationLog.mode}`)
    console.log(`   Files to rollback: ${migrationLog.summary.success}`)
    console.log()

    // 2. Filter only successful migrations to rollback
    const toRollback = migrationLog.logs.filter(log => log.status === 'success')

    if (toRollback.length === 0) {
      console.log('ℹ️  No successful migrations found to rollback')
      return
    }

    console.log('2️⃣ Rolling back file changes...')
    console.log('━'.repeat(120))

    let successCount = 0
    let failedCount = 0
    const rollbackLogs: Array<MigrationLog & { rollbackStatus: string }> = []

    for (const log of toRollback) {
      try {
        if (!dryRun) {
          // Check if old file still exists
          const { data: oldFileExists } = await supabase.storage
            .from('brochures')
            .download(log.oldPath)

          if (!oldFileExists) {
            throw new Error('Original file no longer exists in storage')
          }

          // Update database record back to original
          const { error: updateError } = await supabase
            .from('file_uploads')
            .update({
              file_path: log.oldPath,
              file_name: log.oldName,
              updated_at: new Date().toISOString()
            })
            .eq('id', log.fileId)

          if (updateError) {
            throw new Error(`Database update failed: ${updateError.message}`)
          }

          // Remove the new file
          await supabase.storage
            .from('brochures')
            .remove([log.newPath])

          console.log(`✅ RESTORED: ${log.newName} → ${log.oldName}`)
        } else {
          console.log(`🔍 DRY RUN: ${log.newName} → ${log.oldName}`)
        }

        rollbackLogs.push({ ...log, rollbackStatus: 'success' })
        successCount++

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.log(`❌ FAILED: ${log.newName} - ${errorMessage}`)

        rollbackLogs.push({ ...log, rollbackStatus: `failed: ${errorMessage}` })
        failedCount++
      }
    }

    console.log('━'.repeat(120))
    console.log()

    // 3. Summary
    console.log('📊 ROLLBACK SUMMARY')
    console.log('━'.repeat(80))
    console.log(`Mode:              ${dryRun ? 'DRY RUN' : 'LIVE'}`)
    console.log(`Files to rollback: ${toRollback.length}`)
    console.log(`✅ Success:        ${successCount}`)
    console.log(`❌ Failed:         ${failedCount}`)
    console.log('━'.repeat(80))
    console.log()

    // 4. Save rollback log
    if (!dryRun) {
      const rollbackLogFileName = `brochure-rollback-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      const rollbackLogPath = path.join(process.cwd(), rollbackLogFileName)

      const rollbackLogData = {
        rollbackDate: new Date().toISOString(),
        originalMigrationDate: migrationLog.migrationDate,
        summary: {
          attempted: toRollback.length,
          success: successCount,
          failed: failedCount
        },
        logs: rollbackLogs
      }

      fs.writeFileSync(rollbackLogPath, JSON.stringify(rollbackLogData, null, 2))
      console.log(`📄 Rollback log saved to: ${rollbackLogPath}`)
      console.log()
    }

    if (dryRun) {
      console.log('💡 This was a DRY RUN. To perform the actual rollback, run:')
      console.log(`   node -r esbuild-register src/scripts/rollback-brochure-migration.ts "${logFilePath}" --live`)
    } else {
      console.log('✅ Rollback complete!')
      console.log()
      console.log('ℹ️  Your brochure files have been restored to their original names.')
    }

  } catch (error) {
    console.error('❌ Rollback failed:', error)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)

if (args.length === 0) {
  console.error('❌ Error: Migration log file path required')
  console.log()
  console.log('Usage:')
  console.log('  Dry run:  node -r esbuild-register src/scripts/rollback-brochure-migration.ts <log-file-path>')
  console.log('  Live:     node -r esbuild-register src/scripts/rollback-brochure-migration.ts <log-file-path> --live')
  console.log()
  console.log('Example:')
  console.log('  node -r esbuild-register src/scripts/rollback-brochure-migration.ts ./brochure-migration-log-2025-01-15.json --live')
  process.exit(1)
}

const logFilePath = args[0]
const isLiveMode = args.includes('--live')

if (!fs.existsSync(logFilePath)) {
  console.error(`❌ Error: Log file not found: ${logFilePath}`)
  process.exit(1)
}

if (isLiveMode) {
  console.log('⚠️  WARNING: You are about to rollback the migration in LIVE mode.')
  console.log('   This will restore original brochure file names.')
  console.log()
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...')
  console.log()

  setTimeout(() => {
    rollbackMigration(logFilePath, false).catch(console.error)
  }, 5000)
} else {
  rollbackMigration(logFilePath, true).catch(console.error)
}
