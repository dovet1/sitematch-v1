import { redirect, notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createArticleService } from '@/lib/articles'
import { FileText } from 'lucide-react'
import { EditArticleForm } from './EditArticleForm'

export const dynamic = 'force-dynamic'

interface EditArticlePageProps {
  params: { id: string }
}

export default async function EditArticlePage({ params }: EditArticlePageProps) {
  await requireAdmin()

  const articleService = createArticleService(true)
  const article = await articleService.getArticleById(params.id)

  if (!article) {
    notFound()
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-8 w-8 text-violet-600" />
        <div>
          <h1 className="text-3xl font-bold">Edit Article</h1>
          <p className="text-muted-foreground">Update article content and settings</p>
        </div>
      </div>

      <EditArticleForm article={article} />
    </div>
  )
}
