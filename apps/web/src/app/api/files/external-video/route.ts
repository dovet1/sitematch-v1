import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { detectVideoProvider, extractYouTubeId, extractVimeoId, validateVideoUrl } from '@/types/uploads'

export const dynamic = 'force-dynamic';

/**
 * Add external video URL to listing
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url, listingId, name, caption, displayOrder } = await request.json()

    // Validate URL
    const validation = validateVideoUrl(url)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid video URL' },
        { status: 400 }
      )
    }

    // Detect provider and extract ID
    const provider = detectVideoProvider(url)
    if (!provider) {
      return NextResponse.json(
        { error: 'Unsupported video provider' },
        { status: 400 }
      )
    }

    const videoId = provider === 'youtube'
      ? extractYouTubeId(url)
      : extractVimeoId(url)

    if (!videoId) {
      return NextResponse.json(
        { error: 'Could not extract video ID' },
        { status: 400 }
      )
    }

    // Create file record
    const fileInsertData: any = {
      user_id: user.id,
      file_name: name || `${provider} Video`,
      file_size: 0,
      file_type: 'video',
      mime_type: 'video/external',
      external_url: url,
      video_provider: provider,
      is_primary: false,
      display_order: displayOrder || 0,
      caption: caption || null
    }

    if (listingId && listingId !== 'undefined') {
      fileInsertData.listing_id = listingId
    }

    const { data: fileRecord, error: dbError } = await supabase
      .from('file_uploads')
      .insert(fileInsertData)
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      file: fileRecord
    })

  } catch (error) {
    console.error('External video API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add external video' },
      { status: 500 }
    )
  }
}
