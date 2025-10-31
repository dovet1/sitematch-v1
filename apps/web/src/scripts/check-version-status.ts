import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const LISTING_ID = '7045625c-d73c-400e-adc3-d05a661c8135'

async function checkVersion() {
  const { data: version } = await supabase
    .from('listing_versions')
    .select('id, version_number, status, is_live')
    .eq('id', '745c191e-6fca-4077-a309-05823569f894')
    .single()

  console.log('Version details:')
  console.log('  version_number:', version.version_number)
  console.log('  status:', version.status)
  console.log('  is_live:', version.is_live)
  console.log()

  if (version.status !== 'approved') {
    console.log('❌ Version is NOT approved!')
    console.log('   API needs status = "approved"')
  } else {
    console.log('✅ Version is approved')
  }

  if (!version.is_live) {
    console.log('❌ Version is_live = false')
    console.log('   API will try this version second (after is_live=true versions)')
  } else {
    console.log('✅ Version is_live = true')
  }
}

checkVersion()
