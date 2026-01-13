'use client'

import { useState } from 'react'
import { Article, CreateArticleData } from '@/types/articles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Save, Eye } from 'lucide-react'
import { ImageUploadSection } from './ImageUploadSection'

interface ArticleFormProps {
  article?: Article
  onSubmit: (data: CreateArticleData) => Promise<void>
  onCancel: () => void
}

export function ArticleForm({ article, onSubmit, onCancel }: ArticleFormProps) {
  // Format date for input field (YYYY-MM-DD)
  const formatDateForInput = (dateString: string | null) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toISOString().split('T')[0]
  }

  const [formData, setFormData] = useState({
    title: article?.title || '',
    slug: article?.slug || '',
    excerpt: article?.excerpt || '',
    body: article?.body || '',
    author_name: article?.author_name || '',
    author_title: article?.author_title || '',
    status: article?.status || 'draft',
    published_at: article?.published_at ? formatDateForInput(article.published_at) : '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [autoSlug, setAutoSlug] = useState(!article)

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: autoSlug ? generateSlug(title) : prev.slug
    }))
  }

  const handleSubmit = async (e: React.FormEvent, status?: 'draft' | 'published') => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Convert the date string to ISO format if it exists
      const published_at = formData.published_at
        ? new Date(formData.published_at).toISOString()
        : null

      await onSubmit({
        ...formData,
        status: status || formData.status as any,
        published_at
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-6">
      {/* Title & Slug */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Article Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Enter article title"
              required
              className="text-lg font-semibold"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="slug">URL Slug *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAutoSlug(!autoSlug)
                  if (!autoSlug) {
                    setFormData(prev => ({ ...prev, slug: generateSlug(prev.title) }))
                  }
                }}
              >
                {autoSlug ? '🔒 Auto' : '✏️ Manual'}
              </Button>
            </div>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              placeholder="article-url-slug"
              required
              disabled={autoSlug}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              URL: /articles/{formData.slug || 'article-url-slug'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Excerpt */}
      <Card>
        <CardContent className="pt-6 space-y-2">
          <Label htmlFor="excerpt">Excerpt *</Label>
          <Textarea
            id="excerpt"
            value={formData.excerpt}
            onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
            placeholder="A brief summary of the article (2-3 sentences)"
            required
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            {formData.excerpt.length} characters (recommended: 120-200)
          </p>
        </CardContent>
      </Card>

      {/* Author & Date */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="author_name">Author Name *</Label>
              <Input
                id="author_name"
                value={formData.author_name}
                onChange={(e) => setFormData(prev => ({ ...prev, author_name: e.target.value }))}
                placeholder="John Smith"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author_title">Author Title *</Label>
              <Input
                id="author_title"
                value={formData.author_title}
                onChange={(e) => setFormData(prev => ({ ...prev, author_title: e.target.value }))}
                placeholder="Senior Property Analyst"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="published_at">Published Date</Label>
            <Input
              id="published_at"
              type="date"
              value={formData.published_at}
              onChange={(e) => setFormData(prev => ({ ...prev, published_at: e.target.value }))}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use the current date when publishing. This date will be displayed on the article.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Article Body */}
      <Card>
        <CardContent className="pt-6 space-y-2">
          <Label htmlFor="body">Article Body (Markdown) *</Label>
          <Textarea
            id="body"
            value={formData.body}
            onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
            placeholder="Write your article content here using Markdown formatting...&#10;&#10;## Heading 2&#10;### Heading 3&#10;&#10;Regular paragraph text.&#10;&#10;**Bold text** and *italic text*&#10;&#10;- Bullet point 1&#10;- Bullet point 2"
            required
            rows={20}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Supports Markdown: ## Headings, **bold**, *italic*, [links](url), lists, etc.
          </p>
        </CardContent>
      </Card>

      {/* Images */}
      {article && (
        <Card>
          <CardContent className="pt-6">
            <ImageUploadSection articleId={article.id} images={article.article_images || []} />
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-4 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <div className="flex gap-3">
          {article && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => window.open(`/admin/articles/${article.id}/preview`, '_blank')}
              disabled={isSubmitting}
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={(e) => handleSubmit(e, 'draft')}
            disabled={isSubmitting}
          >
            <Save className="w-4 h-4 mr-2" />
            Save as Draft
          </Button>
          <Button
            type="button"
            onClick={(e) => handleSubmit(e, 'published')}
            disabled={isSubmitting}
          >
            <Eye className="w-4 h-4 mr-2" />
            Publish Article
          </Button>
        </div>
      </div>
    </form>
  )
}
