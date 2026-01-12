import { createArticleService } from '@/lib/articles'
import { ArticleCard } from '@/components/articles/ArticleCard'
import { ArticleNewsletterCTA } from '@/components/articles/ArticleNewsletterCTA'

export const dynamic = 'force-dynamic'

export default async function ArticlesPage() {
  const articleService = createArticleService()
  const articles = await articleService.getPublishedArticles()

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-indigo-50 to-violet-50">
      {/* Header */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="heading-1 mb-6">Articles</h1>
            <p className="body-large text-gray-600">
              Expert analysis, market trends, and case studies for commercial property professionals
            </p>
          </div>
        </div>
      </section>

      {/* Articles Grid */}
      <section className="pb-16 md:pb-24">
        <div className="container mx-auto px-6">
          {articles.length === 0 ? (
            <div className="text-center py-16">
              <p className="body-large text-gray-500">No articles published yet. Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {articles.map((article, index) => (
                <ArticleCard key={article.id} article={article} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="pb-16 md:pb-24">
        <div className="container mx-auto px-6">
          <ArticleNewsletterCTA />
        </div>
      </section>
    </div>
  )
}
