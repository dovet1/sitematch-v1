'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createArticleService } from '@/lib/articles'
import { getCurrentUser } from '@/lib/auth'
import { CreateArticleData, UpdateArticleData } from '@/types/articles'

export async function createArticleAction(data: CreateArticleData): Promise<{ success: boolean; error?: string; articleId?: string }> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Admin access required' }
    }

    const articleService = await createArticleService(true)
    const article = await articleService.createArticle(data, currentUser.id)

    revalidatePath('/admin/articles')
    revalidatePath('/articles')

    return { success: true, articleId: article.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create article' }
  }
}

export async function updateArticleAction(
  id: string,
  data: UpdateArticleData
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Admin access required' }
    }

    const articleService = await createArticleService(true)
    await articleService.updateArticle(id, data, currentUser.id)

    revalidatePath('/admin/articles')
    revalidatePath('/articles')
    revalidatePath(`/articles/${data.slug}`)

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update article' }
  }
}

export async function deleteArticleAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Admin access required' }
    }

    const articleService = await createArticleService(true)
    await articleService.deleteArticle(id)

    revalidatePath('/admin/articles')
    revalidatePath('/articles')

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete article' }
  }
}

export async function updateArticleImageAction(
  imageId: string,
  updates: { caption?: string; display_order?: number; is_featured?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Admin access required' }
    }

    const articleService = await createArticleService(true)
    await articleService.updateArticleImage(imageId, updates)

    revalidatePath('/admin/articles')

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update image' }
  }
}

export async function deleteArticleImageAction(imageId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Admin access required' }
    }

    const articleService = await createArticleService(true)
    await articleService.deleteArticleImage(imageId)

    revalidatePath('/admin/articles')

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete image' }
  }
}
