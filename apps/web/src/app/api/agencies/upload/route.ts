// =====================================================
// Agency File Upload API - Story 18.2
// Handles logo and headshot uploads for agencies
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    console.log('Agency Upload API: Request received')
    const supabase = createServerClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const fileType = formData.get('type') as string // 'logo' or 'headshot'
    const agencyId = formData.get('agencyId') as string
    const isPrimary = formData.get('is_primary') as string
    const agentEmail = formData.get('agentEmail') as string // For headshot uploads

    if (!file || !fileType || !agencyId) {
      return NextResponse.json({ 
        error: 'Missing required fields: file, type, and agencyId' 
      }, { status: 400 })
    }

    // For headshot uploads, agentEmail is required
    if (fileType === 'headshot' && !agentEmail) {
      return NextResponse.json({ 
        error: 'agentEmail is required for headshot uploads' 
      }, { status: 400 })
    }

    // Validate file type
    if (!['logo', 'headshot'].includes(fileType)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Must be logo or headshot' 
      }, { status: 400 })
    }

    // Check if user has permission to upload files for this agency
    // Allow if user is the creator OR if they're a member
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id, created_by')
      .eq('id', agencyId)
      .single()

    if (agencyError || !agency) {
      return NextResponse.json({ 
        error: 'Agency not found' 
      }, { status: 404 })
    }

    // Check if user is the creator
    const isCreator = agency.created_by === user.id
    
    // Check if user is a member (if not the creator)
    let isMember = false
    if (!isCreator) {
      const { data: membership } = await supabase
        .from('agency_agents')
        .select('user_id, role')
        .eq('agency_id', agencyId)
        .eq('user_id', user.id)
        .single()
      
      isMember = !!membership
    }

    if (!isCreator && !isMember) {
      return NextResponse.json({ 
        error: 'Access denied - you are not authorized to upload files for this agency' 
      }, { status: 403 })
    }

    // Upload file to Supabase Storage
    const fileBuffer = await file.arrayBuffer()
    const fileExtension = file.name.split('.').pop()
    const fileName = `agencies/${agencyId}/${fileType}-${Date.now()}.${fileExtension}`
    
    // Determine bucket based on file type
    const bucketMap = {
      'logo': 'logos',
      'headshot': 'headshots'
    }
    
    const bucket = bucketMap[fileType as keyof typeof bucketMap]
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: true // Allow overwriting
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({ 
        error: `Upload failed: ${uploadError.message}` 
      }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path)

    // Create database record in agency_file_uploads
    const { data: fileRecord, error: dbError } = await supabase
      .from('agency_file_uploads')
      .insert({
        user_id: user.id,
        agency_id: agencyId,
        file_path: uploadData.path,
        file_name: file.name,
        file_size: file.size,
        file_type: fileType,
        mime_type: file.type,
        bucket_name: bucket,
        is_primary: isPrimary === 'true'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database insert error:', dbError)
      // Clean up uploaded file if database insert fails
      await supabase.storage.from(bucket).remove([uploadData.path])
      return NextResponse.json({ 
        error: `Database error: ${dbError.message}` 
      }, { status: 500 })
    }

    // If this is a logo upload, update the agency record
    if (fileType === 'logo') {
      const { error: agencyUpdateError } = await supabase
        .from('agencies')
        .update({ logo_url: urlData.publicUrl })
        .eq('id', agencyId)

      if (agencyUpdateError) {
        console.error('Agency logo URL update error:', agencyUpdateError)
      }
    }

    // If this is a headshot upload, update the agency_agents record
    if (fileType === 'headshot') {
      console.log('📷 Updating agent headshot URL:', {
        agencyId,
        agentEmail,
        uploaderUserId: user.id,
        newUrl: urlData.publicUrl
      });
      
      // Update the specific agent's headshot by email
      const { data: updateData, error: agentUpdateError } = await supabase
        .from('agency_agents')
        .update({ headshot_url: urlData.publicUrl })
        .eq('agency_id', agencyId)
        .eq('email', agentEmail)
        .select();

      if (agentUpdateError) {
        console.error('❌ Agent headshot URL update error:', agentUpdateError)
        // Note: This doesn't fail the upload, just logs the error
      } else if (updateData && updateData.length > 0) {
        console.log('✅ Agent headshot URL updated successfully:', updateData[0]);
      } else {
        console.warn('⚠️ No agent record found to update headshot URL for email:', agentEmail, 'agency:', agencyId);
      }
    }

    return NextResponse.json({
      success: true,
      file: fileRecord,
      url: urlData.publicUrl
    })

  } catch (error) {
    console.error('Unexpected error in agency upload:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}