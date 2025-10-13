import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized'
      }, { status: 401 });
    }

    // Check if user is a consultant (user_type is now available from getCurrentUser)
    if (user.user_type !== 'Consultant') {
      return NextResponse.json({
        success: false,
        message: 'Access denied. Only consultants can upload logos.'
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
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    const maxSize = 2 * 1024 * 1024; // 2MB

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, WebP, and SVG images are allowed.'
      }, { status: 400 });
    }

    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        message: 'File too large. Maximum size is 2MB.'
      }, { status: 400 });
    }

    // Generate unique filename with user folder structure (required by RLS policies)
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${user.id}/consultant-logo-${timestamp}.${fileExtension}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('logos')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading logo:', uploadError);
      return NextResponse.json({
        success: false,
        message: 'Error uploading file'
      }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('logos')
      .getPublicUrl(uploadData.path);

    // Create file upload record
    const { data: fileRecord, error: fileError } = await supabase
      .from('file_uploads')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_size: file.size,
        file_type: 'logo',
        mime_type: file.type,
        file_path: uploadData.path,
        bucket_name: 'logos'
      })
      .select()
      .single();

    if (fileError) {
      console.error('Error creating file record:', fileError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      data: {
        url: urlData.publicUrl,
        path: uploadData.path,
        file_name: file.name,
        file_size: file.size
      },
      message: 'Logo uploaded successfully'
    }, { status: 200 });

  } catch (error) {
    console.error('Error in upload-logo endpoint:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}