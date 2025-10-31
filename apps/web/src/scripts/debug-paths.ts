import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugPaths() {
  const { data } = await supabase
    .from('file_uploads')
    .select('id, file_name, file_path, listing_id')
    .eq('file_type', 'brochure')
    .limit(10)

  console.log('First 10 brochure file paths:')
  console.log('━'.repeat(80))

  data?.forEach((file, i) => {
    console.log(`\n${i + 1}. ${file.file_name}`)
    console.log(`   Path: ${file.file_path}`)
    console.log(`   Listing ID: ${file.listing_id}`)

    // Check patterns
    const hasTemp = file.file_path?.includes('temp_')
    const hasTimestamp = /\/\d{13,}-/.test(file.file_path || '')
    console.log(`   Has temp_: ${hasTemp}, Has timestamp: ${hasTimestamp}`)
    console.log(`   Should migrate: ${hasTemp || hasTimestamp}`)
  })
}

debugPaths()
