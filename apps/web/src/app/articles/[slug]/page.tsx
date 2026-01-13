import { notFound } from 'next/navigation'
import { createArticleService } from '@/lib/articles'
import { ArticleDetail } from '@/components/articles/ArticleDetail'
import { ArticleNewsletterCTA } from '@/components/articles/ArticleNewsletterCTA'

export const dynamic = 'force-dynamic'

interface ArticlePageProps {
  params: { slug: string }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const articleService = createArticleService()
  const article = await articleService.getArticleBySlug(params.slug)

  if (!article) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-white">
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

// Optional: Generate metadata for SEO
export async function generateMetadata({ params }: ArticlePageProps) {
  const articleService = createArticleService()
  const article = await articleService.getArticleBySlug(params.slug)

  if (!article) {
    return { title: 'Article Not Found' }
  }

  return {
    title: `${article.title} | Commercial Property Insights`,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: article.featured_image ? [article.featured_image.url || ''] : [],
    },
  }
}
