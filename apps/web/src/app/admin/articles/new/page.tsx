'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText } from 'lucide-react'
import { ArticleForm } from '../components/ArticleForm'
import { createArticleAction } from '@/lib/actions/articles'
import { CreateArticleData } from '@/types/articles'
import { toast } from 'sonner'

export default function NewArticlePage() {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)

  const handleSubmit = async (data: CreateArticleData) => {
    setIsCreating(true)

    try {
      const result = await createArticleAction(data)

      if (result.success && result.articleId) {
        toast.success('Article created successfully')
        router.push(`/admin/articles/${result.articleId}/edit`)
      } else {
        toast.error(result.error || 'Failed to create article')
      }
    } catch (error) {
      toast.error('Failed to create article')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCancel = () => {
    router.push('/admin/articles')
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-8 w-8 text-violet-600" />
        <div>
          <h1 className="text-3xl font-bold">Create New Article</h1>
          <p className="text-muted-foreground">Write and publish a new blog article</p>
        </div>
      </div>

      <ArticleForm onSubmit={handleSubmit} onCancel={handleCancel} />
    </div>
  )
}
