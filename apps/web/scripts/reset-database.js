#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) {
      process.env[key.trim()] = value.trim()
    }
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function resetDatabase() {
  console.log('🗑️  Starting database reset (keeping users)...')

  try {
    // Delete in order to respect foreign key constraints
    
    // 1. Delete file uploads
    console.log('Deleting file uploads...')
    const { error: filesError } = await supabase
      .from('file_uploads')
      .delete()
      .neq('id', 0) // Delete all
    if (filesError) console.error('Files error:', filesError)

    // 2. Delete listing-related junction tables
    console.log('Deleting listing sectors...')
    const { error: sectorsError } = await supabase
      .from('listing_sectors')
      .delete()
      .neq('id', 0)
    if (sectorsError) console.error('Listing sectors error:', sectorsError)

    console.log('Deleting listing use classes...')
    const { error: useClassesError } = await supabase
      .from('listing_use_classes')
      .delete()
      .neq('id', 0)
    if (useClassesError) console.error('Listing use classes error:', useClassesError)

    // 3. Delete contacts
    console.log('Deleting contacts...')
    const { error: contactsError } = await supabase
      .from('contacts')
      .delete()
      .neq('id', 0)
    if (contactsError) console.error('Contacts error:', contactsError)

    // 4. Delete locations
    console.log('Deleting locations...')
    const { error: locationsError } = await supabase
      .from('locations')
      .delete()
      .neq('id', 0)
    if (locationsError) console.error('Locations error:', locationsError)

    // 5. Delete FAQs
    console.log('Deleting FAQs...')
    const { error: faqsError } = await supabase
      .from('faqs')
      .delete()
      .neq('id', 0)
    if (faqsError) console.error('FAQs error:', faqsError)

    // 6. Delete listings
    console.log('Deleting listings...')
    const { error: listingsError } = await supabase
      .from('listings')
      .delete()
      .neq('id', 0)
    if (listingsError) console.error('Listings error:', listingsError)

    // 7. Delete organizations (but keep users)
    console.log('Deleting organizations...')
    const { error: orgsError } = await supabase
      .from('organisations')
      .delete()
      .neq('id', 0)
    if (orgsError) console.error('Organizations error:', orgsError)

    console.log('✅ Database reset complete!')
    console.log('👤 Users table preserved')
    
    // Show remaining user count
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role')
    
    if (!usersError && users) {
      console.log(`📊 ${users.length} users remaining:`)
      users.forEach(user => {
        console.log(`  - ${user.email} (${user.role})`)
      })
    }

  } catch (error) {
    console.error('❌ Reset failed:', error)
  }
}

// Also clear storage buckets
async function clearStorageBuckets() {
  console.log('🗑️  Clearing storage buckets...')
  
  const buckets = ['logos', 'brochures', 'site-plans', 'fit-outs', 'headshots']
  
  for (const bucket of buckets) {
    try {
      // List all files in bucket
      const { data: files, error: listError } = await supabase.storage
        .from(bucket)
        .list()
      
      if (listError) {
        console.error(`Error listing files in ${bucket}:`, listError)
        continue
      }
      
      if (files && files.length > 0) {
        // Delete all files
        const filePaths = files.map(file => file.name)
        const { error: deleteError } = await supabase.storage
          .from(bucket)
          .remove(filePaths)
        
        if (deleteError) {
          console.error(`Error deleting files from ${bucket}:`, deleteError)
        } else {
          console.log(`✅ Cleared ${files.length} files from ${bucket} bucket`)
        }
      } else {
        console.log(`📁 ${bucket} bucket is already empty`)
      }
    } catch (error) {
      console.error(`Error processing ${bucket} bucket:`, error)
    }
  }
}

async function main() {
  await resetDatabase()
  await clearStorageBuckets()
  console.log('🎉 Complete reset finished!')
}

main()