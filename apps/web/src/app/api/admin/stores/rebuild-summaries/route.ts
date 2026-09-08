import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/admin-auth'
import type { RebuildResponse } from '@/types/store-import'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

export async function POST(request: NextRequest) {
  try {
    // Require admin auth
    const user = await requireAdmin()
    const supabase = adminClient()

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

    const progress = ((data || []) as Array<{ progress?: string }>)
      .map((row) => row.progress)
      .filter((message): message is string => Boolean(message))

    if (progress.some((message) => message.includes('already in progress'))) {
      return NextResponse.json({
        success: false,
        progress,
        message: 'Rebuild already in progress. Please wait for it to complete.',
        error: 'rebuild_in_progress'
      } as RebuildResponse, { status: 409 })
    }

    // Rebuild completed successfully
    const response: RebuildResponse = {
      success: true,
      progress,
      message: 'BUA summary tables rebuilt successfully'
    }

    console.log('Rebuild completed:', data)
    return NextResponse.json(response)

  } catch (error: any) {
    // Do not report an unknown database outcome as success.
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      console.warn('Rebuild request timed out')
      return NextResponse.json({
        success: false,
        progress: [],
        message: 'The rebuild request timed out. Its final database state is unknown; check the summary timestamps before retrying.',
        error: 'rebuild_timeout'
      } as RebuildResponse, { status: 504 })
    }

    console.error('Rebuild endpoint error:', error)
    return NextResponse.json({
      success: false,
      progress: [],
      error: error.message || 'Failed to rebuild summaries'
    } as RebuildResponse, { status: 500 })
  }
}
