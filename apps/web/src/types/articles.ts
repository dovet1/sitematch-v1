export interface Article {
  id: string
  slug: string
  title: string
  excerpt: string
  body: string // Markdown
  author_name: string
  author_title: string
  status: 'draft' | 'published' | 'archived'
  published_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  article_images?: ArticleImage[]
  featured_image?: ArticleImage | null
}

export interface ArticleImage {
  id: string
  article_id: string
  file_path: string
  file_name: string
  file_size: number
  mime_type: string
  bucket_name: string
  caption: string | null
  display_order: number
  is_featured: boolean
  created_at: string
  url?: string // Enriched field
}

export interface CreateArticleData {
  title: string
  slug?: string // Optional, will be auto-generated if not provided
  excerpt: string
  body: string
  author_name: string
  author_title: string
  status: 'draft' | 'published' | 'archived'
  published_at?: string | null
}

export interface UpdateArticleData {
  title?: string
  slug?: string
  excerpt?: string
  body?: string
  author_name?: string
  author_title?: string
  status?: 'draft' | 'published' | 'archived'
  published_at?: string | null
}
