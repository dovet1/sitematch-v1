'use client'

import { useState } from 'react'
import { Article } from '@/types/articles'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Edit, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { ArticleDeleteModal } from './ArticleDeleteModal'

interface ArticleListProps {
  articles: Article[]
}

export function ArticleList({ articles }: ArticleListProps) {
  const [search, setSearch] = useState('')
  const [deleteArticle, setDeleteArticle] = useState<Article | null>(null)

  const filteredArticles = articles.filter((article) =>
    article.title.toLowerCase().includes(search.toLowerCase()) ||
    article.author_name.toLowerCase().includes(search.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-600">Published</Badge>
      case 'draft':
        return <Badge className="bg-yellow-600">Draft</Badge>
      case 'archived':
        return <Badge className="bg-gray-600">Archived</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <>
      <div className="space-y-4">
        {/* Search */}
        <div className="flex gap-4">
          <Input
            placeholder="Search articles by title or author..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Table */}
        {filteredArticles.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {search ? 'No articles found matching your search.' : 'No articles yet.'}
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredArticles.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell className="font-medium max-w-md">
                      <Link
                        href={`/admin/articles/${article.id}/edit`}
                        className="hover:underline text-violet-600"
                      >
                        {article.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{article.author_name}</div>
                        <div className="text-muted-foreground">{article.author_title}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(article.status)}</TableCell>
                    <TableCell>{formatDate(article.published_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <Link href={`/admin/articles/${article.id}/edit`}>
                            <Edit className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteArticle(article)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteArticle && (
        <ArticleDeleteModal
          article={deleteArticle}
          onClose={() => setDeleteArticle(null)}
        />
      )}
    </>
  )
}
