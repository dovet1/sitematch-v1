import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkPoundstretcher() {
  // Check all Poundstretcher files
  const { data: files } = await supabase
    .from('file_uploads')
    .select('id, file_name, file_path, listing_id, created_at, updated_at')
    .ilike('file_name', '%poundstretcher%')

  console.log('All Poundstretcher files:')
  console.log('━'.repeat(80))
  files?.forEach((file, i) => {
    console.log(`\n${i + 1}. ${file.file_name}`)
    console.log(`   ID: ${file.id}`)
    console.log(`   Path: ${file.file_path}`)
    console.log(`   Listing ID: ${file.listing_id}`)
    console.log(`   Created: ${file.created_at}`)
    console.log(`   Updated: ${file.updated_at}`)
  })

  // Check the listing
  const { data: listing } = await supabase
    .from('listings')
    .select('id, company_name')
    .eq('id', '7045625c-d73c-400e-adc3-d05a661c8135')
    .single()

  console.log('\n\nPoundstretcher Listing:')
  console.log('━'.repeat(80))
  console.log(`ID: ${listing?.id}`)
  console.log(`Company: ${listing?.company_name}`)

  // Check files for this listing
  const { data: listingFiles } = await supabase
    .from('file_uploads')
    .select('id, file_name, file_path, file_type')
    .eq('listing_id', '7045625c-d73c-400e-adc3-d05a661c8135')

  console.log('\n\nAll files for this listing:')
  console.log('━'.repeat(80))
  listingFiles?.forEach((file, i) => {
    console.log(`\n${i + 1}. ${file.file_name} (${file.file_type})`)
    console.log(`   ID: ${file.id}`)
    console.log(`   Path: ${file.file_path}`)
  })
}

checkPoundstretcher()
