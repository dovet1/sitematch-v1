'use client'

import { Article } from '@/types/articles'
import { cn } from '@/lib/utils'
import { Calendar, User, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

interface ArticleCardProps {
  article: Article
  index?: number
}

export function ArticleCard({ article, index = 0 }: ArticleCardProps) {
  const formattedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : ''

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Link href={`/articles/${article.slug}`}>
        <div
          className={cn(
            'group relative h-full flex flex-col',
            'bg-white rounded-[2rem] overflow-hidden',
            'border-3 border-violet-200',
            'cursor-pointer transition-all duration-500',
            'hover:shadow-2xl hover:border-violet-400 hover:-translate-y-3',
            index % 3 === 1 ? 'md:mt-6' : index % 3 === 2 ? 'md:mt-8' : ''
          )}
        >
          {/* Gradient accent corner */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-300/30 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

          {/* Featured Image */}
          {article.featured_image && (
            <div className="relative w-full aspect-[16/9] bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
              <img
                src={article.featured_image.url}
                alt={article.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading={index < 3 ? 'eager' : 'lazy'}
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 flex flex-col p-7 md:p-8">
            {/* Title */}
            <h3 className="relative font-black text-gray-900 text-xl md:text-2xl mb-4 pb-3">
              {article.title}
              <span className="absolute bottom-0 left-0 w-16 h-1 bg-violet-300 group-hover:w-full transition-all duration-500 rounded-full"></span>
            </h3>

            {/* Excerpt */}
            <p className="body-base text-gray-600 mb-6 line-clamp-3 flex-1">
              {article.excerpt}
            </p>

            {/* Meta */}
            <div className="space-y-3 text-sm text-gray-600 font-semibold mb-5">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-violet-500 flex-shrink-0" />
                <span className="truncate">{article.author_name}</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500 truncate">{article.author_title}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-violet-500 flex-shrink-0" />
                <span>{formattedDate}</span>
              </div>
            </div>

            {/* Read More */}
            <div className="pt-5 border-t-3 border-violet-100 group-hover:border-violet-300 transition-colors duration-300">
              <span className="text-base text-violet-600 font-black flex items-center gap-2">
                Read article
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.article>
  )
}
