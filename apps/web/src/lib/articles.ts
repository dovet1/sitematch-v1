import { createServerClient, createAdminClient } from '@/lib/supabase'
import { Article, ArticleImage, CreateArticleData, UpdateArticleData } from '@/types/articles'

export class ArticleService {
  private supabase: any

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient
  }

  // Generate URL-friendly slug from title
  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  // Get all published articles (public)
  async getPublishedArticles(): Promise<Article[]> {
    const { data, error } = await this.supabase
      .from('articles')
      .select(`
        *,
        article_images (
          id,
          file_path,
          file_name,
          caption,
          display_order,
          is_featured,
          bucket_name,
          mime_type,
          file_size
        )
      `)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to get published articles: ${error.message}`)
    }

    return this.enrichArticlesWithImageUrls(data || [])
  }

  // Get single article by slug (public)
  async getArticleBySlug(slug: string): Promise<Article | null> {
    const { data, error } = await this.supabase
      .from('articles')
      .select(`
        *,
        article_images (
          id,
          file_path,
          file_name,
          caption,
          display_order,
          is_featured,
          bucket_name,
          mime_type,
          file_size
        )
      `)
      .eq('slug', slug)
      .eq('status', 'published')
      .single()

    if (error || !data) {
      return null
    }

    return this.enrichArticleWithImageUrls(data)
  }

  // Get all articles (admin only)
  async getAllArticles(): Promise<Article[]> {
    const { data, error } = await this.supabase
      .from('articles')
      .select(`
        *,
        article_images (
          id,
          file_path,
          file_name,
          caption,
          display_order,
          is_featured,
          bucket_name,
          mime_type,
          file_size
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to get articles: ${error.message}`)
    }

    return this.enrichArticlesWithImageUrls(data || [])
  }

  // Get article by ID (admin only)
  async getArticleById(id: string): Promise<Article | null> {
    const { data, error } = await this.supabase
      .from('articles')
      .select(`
        *,
        article_images (
          id,
          file_path,
          file_name,
          caption,
          display_order,
          is_featured,
          bucket_name,
          mime_type,
          file_size
        )
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      return null
    }

    return this.enrichArticleWithImageUrls(data)
  }

  // Create new article (admin only)
  async createArticle(articleData: CreateArticleData, userId: string): Promise<Article> {
    const slug = articleData.slug || this.generateSlug(articleData.title)

    const { data, error } = await this.supabase
      .from('articles')
      .insert({
        ...articleData,
        slug,
        created_by: userId,
        updated_by: userId,
        published_at: articleData.status === 'published' ? new Date().toISOString() : null
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create article: ${error.message}`)
    }

    return data
  }

  // Update article (admin only)
  async updateArticle(id: string, updates: UpdateArticleData, userId: string): Promise<Article> {
    const updateData: any = {
      ...updates,
      updated_by: userId
    }

    // Set published_at when publishing
    if (updates.status === 'published' && updates.published_at === undefined) {
      const { data: current } = await this.supabase
        .from('articles')
        .select('published_at')
        .eq('id', id)
        .single()

      if (!current?.published_at) {
        updateData.published_at = new Date().toISOString()
      }
    }

    const { data, error } = await this.supabase
      .from('articles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update article: ${error.message}`)
    }

    return data
  }

  // Delete article (admin only)
  async deleteArticle(id: string): Promise<void> {
    // Get all images for cleanup
    const { data: images } = await this.supabase
      .from('article_images')
      .select('bucket_name, file_path')
      .eq('article_id', id)

    // Delete article (cascade will delete article_images records)
    const { error } = await this.supabase
      .from('articles')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete article: ${error.message}`)
    }

    // Clean up storage files
    if (images && images.length > 0) {
      const filePaths = images.map((img: ArticleImage) => img.file_path)
      await this.supabase.storage
        .from('article-images')
        .remove(filePaths)
    }
  }

  // Add image to article
  async addArticleImage(
    articleId: string,
    imageData: {
      file_path: string
      file_name: string
      file_size: number
      mime_type: string
      caption?: string
      display_order: number
      is_featured?: boolean
    }
  ): Promise<ArticleImage> {
    const { data, error } = await this.supabase
      .from('article_images')
      .insert({
        article_id: articleId,
        ...imageData
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to add article image: ${error.message}`)
    }

    return data
  }

  // Delete image
  async deleteArticleImage(imageId: string): Promise<void> {
    // Get image details for storage cleanup
    const { data: image } = await this.supabase
      .from('article_images')
      .select('bucket_name, file_path')
      .eq('id', imageId)
      .single()

    // Delete database record
    const { error } = await this.supabase
      .from('article_images')
      .delete()
      .eq('id', imageId)

    if (error) {
      throw new Error(`Failed to delete article image: ${error.message}`)
    }

    // Clean up storage
    if (image) {
      await this.supabase.storage
        .from(image.bucket_name)
        .remove([image.file_path])
    }
  }

  // Update image metadata
  async updateArticleImage(
    imageId: string,
    updates: {
      caption?: string
      display_order?: number
      is_featured?: boolean
    }
  ): Promise<ArticleImage> {
    const { data, error } = await this.supabase
      .from('article_images')
      .update(updates)
      .eq('id', imageId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update article image: ${error.message}`)
    }

    return data
  }

  // Helper: Enrich articles with full image URLs
  private enrichArticlesWithImageUrls(articles: any[]): Article[] {
    return articles.map(article => this.enrichArticleWithImageUrls(article))
  }

  private enrichArticleWithImageUrls(article: any): Article {
    const images = (article.article_images || [])
      .sort((a: any, b: any) => a.display_order - b.display_order)
      .map((img: any) => ({
        ...img,
        url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${img.bucket_name}/${img.file_path}`
      }))

    return {
      ...article,
      article_images: images,
      featured_image: images.find((img: any) => img.is_featured) || images[0] || null
    }
  }
}

export async function createArticleService(useAdmin = false) {
  const supabaseClient = useAdmin ? createAdminClient() : await createServerClient()
  return new ArticleService(supabaseClient)
}
