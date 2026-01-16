import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { createArticleService } from '@/lib/articles'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const articleId = formData.get('articleId') as string

    if (!file || !articleId) {
      return NextResponse.json({ error: 'Missing file or articleId' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Upload file to Supabase Storage
    const fileBuffer = await file.arrayBuffer()
    const fileName = `${currentUser.id}/${Date.now()}-${file.name}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('article-images')
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('article-images')
      .getPublicUrl(uploadData.path)

    // Get current article images to determine display order
    const articleService = await createArticleService(true)
    const article = await articleService.getArticleById(articleId)
    const currentImageCount = article?.article_images?.length || 0

    // Add to article_images table
    const imageData = await articleService.addArticleImage(articleId, {
      file_path: uploadData.path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      display_order: currentImageCount,
      is_featured: currentImageCount === 0, // First image is featured
    })

    return NextResponse.json({
      success: true,
      image: {
        id: imageData.id,
        name: file.name,
        url: urlData.publicUrl,
        path: uploadData.path,
        size: file.size,
        mimeType: file.type,
      }
    })

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
