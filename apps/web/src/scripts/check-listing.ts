import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkListing() {
  const listingId = 'cfa1220a-ed11-47ca-8b73-606eb89ef88a'

  const { data: listing, error } = await supabase
    .from('listings')
    .select('id, company_name, status')
    .eq('id', listingId)
    .single()

  console.log('Listing lookup result:')
  console.log('Error:', error)
  console.log('Data:', listing)
}

checkListing()
