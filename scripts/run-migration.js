#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = 'https://***REMOVED***.supabase.co'
const serviceRoleKey = '***REMOVED***'

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

async function runMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/003_fix_rls_policies.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('Running RLS policy migration...')
    console.log('Migration content:')
    console.log(migrationSQL)
    
    // Split into individual commands and execute each
    const commands = migrationSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'))
    
    for (const command of commands) {
      if (command.trim()) {
        console.log(`\nExecuting: ${command.substring(0, 50)}...`)
        
        // Use a more raw approach - direct to the Postgres connection
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            sql: command + ';'
          })
        })
        
        if (!response.ok) {
          console.error('❌ Failed:', await response.text())
        } else {
          console.log('✅ Success')
        }
      }
    }
    
    console.log('\n🎉 Migration completed!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.log('\n💡 Try running it manually via Supabase Dashboard SQL editor instead')
  }
}

runMigration()