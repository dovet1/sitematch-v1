import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic';

// Configure route segment to handle larger file uploads
export const runtime = 'nodejs' // Use Node.js runtime
export const maxDuration = 30 // 30 seconds timeout

export async function POST(request: NextRequest) {
  try {
    console.log('Upload API: Request received')
    const supabase = createServerClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const fileType = formData.get('type') as string
    const listingId = formData.get('listingId') as string
    const isPrimary = formData.get('is_primary') as string
    

    if (!file || !fileType) {
      return NextResponse.json({ error: 'Missing file or type' }, { status: 400 })
    }

    // Upload file to Supabase Storage - use listing_id for folder structure if available
    const fileBuffer = await file.arrayBuffer()
    const folderName = listingId && listingId !== 'undefined' ? listingId : user.id
    const fileName = `${folderName}/${Date.now()}-${file.name}`
    
    // Determine bucket based on file type
    const bucketMap = {
      'logo': 'logos',
      'brochure': 'brochures',
      'sitePlan': 'site-plans',
      'fitOut': 'fit-outs',
      'headshot': 'headshots',
      'articleImage': 'article-images'
    }
    
    const bucket = bucketMap[fileType as keyof typeof bucketMap] || 'brochures'
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path)

    // Create database record
    const fileInsertData: any = {
      user_id: user.id,
      file_path: uploadData.path,
      file_name: file.name,
      file_size: file.size,
      file_type: fileType,
      mime_type: file.type,
      bucket_name: bucket,
      is_primary: isPrimary === 'true' // Convert string to boolean
    };

    // Add listing_id if provided (for draft listing association)
    if (listingId && listingId !== 'undefined') {
      fileInsertData.listing_id = listingId;
    }

    const { data: fileRecord, error: dbError } = await supabase
      .from('file_uploads')
      .insert(fileInsertData)
      .select()
      .single()

    if (dbError) {
      // Clean up uploaded file if database insert fails
      await supabase.storage.from(bucket).remove([uploadData.path])
      return NextResponse.json({ error: `Database error: ${dbError.message}` }, { status: 500 })
    }

    console.log('File upload completed successfully:', {
      fileId: fileRecord.id,
      fileName: file.name,
      userId: user.id
    })

    // Return success with file info
    return NextResponse.json({
      success: true,
      file: {
        id: fileRecord.id,
        name: file.name,
        url: urlData.publicUrl,
        path: uploadData.path,
        type: fileType,
        size: file.size,
        mimeType: file.type,
        uploadedAt: new Date()
      }
    })

  } catch (error) {
    console.error('Upload API error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Upload failed' 
    }, { status: 500 })
  }
}