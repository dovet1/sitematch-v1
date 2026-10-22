import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Stores per call: 4,000 took 4.2s, so 3,000 stays well inside PostgREST's 8-second statement cap.
const STORES_PER_CALL = 3000
// A full pass is about 21 calls; this stops a broken cursor from looping until the timeout.
const MAX_CALLS = 200

/**
 * Rebuilds brand_store_spacing: how far apart each brand's stores usually are, which Brand
 * Matcher uses to stop rewarding distance once a site is outside the area a brand trades in
 * (migration 20261103000000). refresh_brand_store_spacing() works through brands in id order
 * and returns the last brand it did, or null once every brand is done.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase service credentials are not configured' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  let after: string | null = null
  let calls = 0
  while (calls < MAX_CALLS) {
    const { data, error } = await supabase.rpc('refresh_brand_store_spacing', {
      p_after: after,
      p_max_stores: STORES_PER_CALL,
    })
    calls++
    if (error) {
      console.error(`[brand-store-spacing] Failed after brand ${after ?? '(start)'}`, error)
      return NextResponse.json({ success: false, calls, after, error: error.message }, { status: 500 })
    }
    if (data == null) return NextResponse.json({ success: true, calls })
    after = data as string
  }
  return NextResponse.json({ success: false, calls, after, error: 'Too many calls' }, { status: 500 })
}
