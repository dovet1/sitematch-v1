import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createArticleService } from '@/lib/articles'
import { ArticleDetail } from '@/components/articles/ArticleDetail'
import { ArticleNewsletterCTA } from '@/components/articles/ArticleNewsletterCTA'
import { PreviewBanner } from './PreviewBanner'

export const dynamic = 'force-dynamic'

interface PreviewArticlePageProps {
  params: Promise<{ id: string }>
}

export default async function PreviewArticlePage({ params }: PreviewArticlePageProps) {
  await requireAdmin()

  const { id } = await params

  const articleService = await createArticleService(true)
  const article = await articleService.getArticleById(id)

  if (!article) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Preview Banner */}
      <PreviewBanner />

      {/* Article Content */}
      <ArticleDetail article={article} />

      {/* Newsletter CTA - Bottom */}
      <section className="bg-gradient-to-b from-white via-indigo-50 to-violet-50 py-16 md:py-24">
        <div className="container mx-auto px-6">
          <ArticleNewsletterCTA />
        </div>
      </section>
    </div>
  )
}
