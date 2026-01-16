import { NextRequest, NextResponse } from 'next/server'
import { createArticleService } from '@/lib/articles'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const articleService = await createArticleService(true)

    const image = await articleService.addArticleImage((await params).id, {
      file_path: body.file_path,
      file_name: body.file_name,
      file_size: body.file_size,
      mime_type: body.mime_type,
      caption: body.caption || null,
      display_order: body.display_order || 0,
      is_featured: body.is_featured || false,
    })

    return NextResponse.json({ success: true, image })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add image' },
      { status: 500 }
    )
  }
}
