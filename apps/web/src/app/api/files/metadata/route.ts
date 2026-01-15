import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get metadata from request
    const metadata = await request.json()
    const {
      file_path,
      file_name,
      file_size,
      file_type,
      mime_type,
      bucket_name,
      listing_id,
      is_primary,
      display_order,
      caption,
      external_url,
      video_provider
    } = metadata

    // Validate required fields
    // For videos with external URLs, file_path is not required
    if (file_type === 'video' && external_url) {
      if (!file_name || !file_type || !external_url || !video_provider) {
        return NextResponse.json(
          { error: 'Missing required fields for external video' },
          { status: 400 }
        )
      }
    } else {
      if (!file_path || !file_name || !file_type || !bucket_name) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        )
      }
    }

    // Create file record in database
    const fileInsertData: any = {
      user_id: user.id,
      file_name,
      file_size: file_size || 0,
      file_type,
      is_primary: is_primary || false,
      display_order: display_order || 0,
      caption: caption || null
    }

    // Handle external videos vs direct uploads
    if (file_type === 'video' && external_url) {
      fileInsertData.external_url = external_url
      fileInsertData.video_provider = video_provider
      fileInsertData.mime_type = 'video/external'
    } else {
      fileInsertData.file_path = file_path
      fileInsertData.bucket_name = bucket_name
      fileInsertData.mime_type = mime_type || 'application/octet-stream'
    }

    // Add listing_id if provided
    if (listing_id && listing_id !== 'undefined') {
      fileInsertData.listing_id = listing_id
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
    console.error('Metadata API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save metadata' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get file ID from URL
    const url = new URL(request.url)
    const fileId = url.pathname.split('/').pop()

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID required' },
        { status: 400 }
      )
    }

    // Delete file metadata (with RLS check)
    const { error: deleteError } = await supabase
      .from('file_uploads')
      .delete()
      .eq('id', fileId)
      .eq('user_id', user.id) // Ensure user owns the file

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return NextResponse.json(
        { error: `Delete failed: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete metadata API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 }
    )
  }
}