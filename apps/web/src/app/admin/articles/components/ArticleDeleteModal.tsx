'use client'

import { useState } from 'react'
import { Article } from '@/types/articles'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { deleteArticleAction } from '@/lib/actions/articles'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface ArticleDeleteModalProps {
  article: Article
  onClose: () => void
}

export function ArticleDeleteModal({ article, onClose }: ArticleDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    setIsDeleting(true)

    try {
      const result = await deleteArticleAction(article.id)

      if (result.success) {
        toast.success('Article deleted successfully')
        router.refresh()
        onClose()
      } else {
        toast.error(result.error || 'Failed to delete article')
      }
    } catch (error) {
      toast.error('Failed to delete article')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Article</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this article? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-lg bg-gray-50 p-4">
            <h3 className="font-semibold text-gray-900">{article.title}</h3>
            <p className="text-sm text-gray-600 mt-1">By {article.author_name}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete Article'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
