import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import type { RebuildResponse } from '@/types/store-import'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes (may timeout but rebuild continues on Supabase)

export async function POST(request: NextRequest) {
  try {
    // Require admin auth
    const user = await requireAdmin()
    const supabase = await createServerClient()

    console.log('Starting BUA summary rebuild...')

    // Call the rebuild function with user ID
    const { data, error } = await supabase.rpc('rebuild_all_bua_summaries', {
      p_user_id: user.id
    })

    if (error) {
      // Check if this is a concurrency error (rebuild already running)
      if (error.message?.includes('already in progress')) {
        return NextResponse.json({
          success: false,
          progress: [],
          message: 'Rebuild already in progress. Please wait for it to complete.',
          error: 'rebuild_in_progress'
        } as RebuildResponse, { status: 409 })
      }

      console.error('Rebuild error:', error)
      return NextResponse.json({
        success: false,
        progress: [],
        error: error.message
      } as RebuildResponse, { status: 500 })
    }

    // Rebuild completed successfully
    const response: RebuildResponse = {
      success: true,
      progress: data || [],
      message: 'BUA summary tables rebuilt successfully'
    }

    console.log('Rebuild completed:', data)
    return NextResponse.json(response)

  } catch (error: any) {
    // This might be a timeout error - rebuild may still be running on Supabase
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      console.warn('Rebuild request timed out (rebuild may still be running on Supabase)')
      return NextResponse.json({
        success: true, // Not false - rebuild is likely still running
        progress: [],
        message: 'Rebuild started successfully. This may take 5-10 minutes. The rebuild continues on the database server even though this request timed out. Check the Gap Analysis tool in a few minutes to verify the update.'
      } as RebuildResponse)
    }

    console.error('Rebuild endpoint error:', error)
    return NextResponse.json({
      success: false,
      progress: [],
      error: error.message || 'Failed to rebuild summaries'
    } as RebuildResponse, { status: 500 })
  }
}
