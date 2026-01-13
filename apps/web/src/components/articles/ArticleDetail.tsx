'use client'

import { Article } from '@/types/articles'
import { Calendar, User } from 'lucide-react'
import { MarkdownRenderer } from './MarkdownRenderer'
import { ArticleImageGallery } from './ArticleImageGallery'
import { ArticleTopNewsletter } from './ArticleTopNewsletter'

interface ArticleDetailProps {
  article: Article
}

export function ArticleDetail({ article }: ArticleDetailProps) {
  const formattedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : ''

  const images = article.article_images || []
  const nonFeaturedImages = images.filter(img => !img.is_featured)

  return (
    <article className="py-12 md:py-16">
      <div className="container mx-auto px-6 max-w-4xl">
        {/* Header */}
        <header className="mb-10">
          <h1 className="heading-1 mb-6">{article.title}</h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 md:gap-6 text-base text-gray-600 font-semibold border-l-4 border-violet-400 pl-6">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-violet-500" />
              <div>
                <span className="text-gray-900">{article.author_name}</span>
                <span className="text-gray-400 mx-2">•</span>
                <span className="text-gray-500">{article.author_title}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-violet-500" />
              <span>{formattedDate}</span>
            </div>
          </div>
        </header>

        {/* Newsletter Signup */}
        <ArticleTopNewsletter />

        {/* Featured Image */}
        {article.featured_image && (
          <div className="mb-12">
            <div className="relative w-full h-[500px] rounded-[2rem] overflow-hidden bg-white flex items-center justify-center">
              <img
                src={article.featured_image.url}
                alt={article.title}
                className="max-w-full max-h-full object-contain"
              />
            </div>
            {article.featured_image.caption && (
              <p className="text-sm text-gray-500 italic mt-3 text-center">
                {article.featured_image.caption}
              </p>
            )}
          </div>
        )}

        {/* Article Body */}
        <div className="prose prose-lg max-w-none mb-12">
          <MarkdownRenderer content={article.body} />
        </div>

        {/* Additional Images Gallery */}
        {nonFeaturedImages.length > 0 && (
          <div className="mb-12">
            <ArticleImageGallery images={nonFeaturedImages} />
          </div>
        )}
      </div>
    </article>
  )
}
