import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('Upload headshot: Request received');
    const user = await getCurrentUser();
    
    if (!user) {
      console.log('Upload headshot: No user found');
      return NextResponse.json({
        success: false,
        message: 'Unauthorized'
      }, { status: 401 });
    }
    
    console.log('Upload headshot: User found:', user.id, user.user_type);

    // Check if user is a consultant (user_type is now available from getCurrentUser)
    if (user.user_type !== 'Consultant') {
      return NextResponse.json({
        success: false,
        message: 'Access denied. Only consultants can upload headshots.'
      }, { status: 403 });
    }

    const supabase = createServerClient();

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({
        success: false,
        message: 'No file provided'
      }, { status: 400 });
    }

    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'
      }, { status: 400 });
    }

    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      }, { status: 400 });
    }

    // Generate unique filename with user folder structure (required by RLS policies)
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${user.id}/consultant-headshot-${timestamp}.${fileExtension}`;

    console.log('Upload headshot: Generated filename:', fileName);
    console.log('Upload headshot: User ID from getCurrentUser:', user.id);
    
    // Check what auth.uid() returns in Supabase
    const { data: authCheck, error: authError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();
    
    console.log('Upload headshot: Auth check result:', authCheck, authError);

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('headshots')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading headshot to storage:', uploadError);
      return NextResponse.json({
        success: false,
        message: 'Error uploading file'
      }, { status: 500 });
    }
    
    console.log('Upload headshot: File uploaded successfully to storage');

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('headshots')
      .getPublicUrl(uploadData.path);

    // Create file upload record
    const { data: fileRecord, error: fileError } = await supabase
      .from('file_uploads')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_size: file.size,
        file_type: 'headshot',
        mime_type: file.type,
        file_path: uploadData.path,
        bucket_name: 'headshots'
      })
      .select()
      .single();

    if (fileError) {
      console.error('Error creating file record:', fileError);
      // Don't fail the request, just log the error
    } else {
      console.log('Upload headshot: File record created successfully');
    }

    return NextResponse.json({
      success: true,
      data: {
        url: urlData.publicUrl,
        path: uploadData.path,
        file_name: file.name,
        file_size: file.size
      },
      message: 'Headshot uploaded successfully'
    }, { status: 200 });

  } catch (error) {
    console.error('Error in upload-headshot endpoint:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}