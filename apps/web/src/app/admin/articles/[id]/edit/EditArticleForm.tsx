'use client'

import { useRouter } from 'next/navigation'
import { ArticleForm } from '../../components/ArticleForm'
import { updateArticleAction } from '@/lib/actions/articles'
import { Article, CreateArticleData } from '@/types/articles'
import { toast } from 'sonner'

interface EditArticleFormProps {
  article: Article
}

export function EditArticleForm({ article }: EditArticleFormProps) {
  const router = useRouter()

  const handleSubmit = async (data: CreateArticleData) => {
    try {
      const result = await updateArticleAction(article.id, data)

      if (result.success) {
        toast.success('Article updated successfully')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to update article')
      }
    } catch (error) {
      toast.error('Failed to update article')
    }
  }

  const handleCancel = () => {
    router.push('/admin/articles')
  }

  return <ArticleForm article={article} onSubmit={handleSubmit} onCancel={handleCancel} />
}
