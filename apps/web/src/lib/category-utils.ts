import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Expands category IDs to include all descendant categories using the
 * get_category_descendants SQL function.
 *
 * This is needed because categories have a hierarchical structure, and when
 * users select a parent category (e.g., "Supermarkets"), we need to include
 * all child categories (e.g., "Tesco", "Sainsbury's", etc.).
 */
export async function expandCategoryHierarchy(
  categoryIds: string[],
  supabase: SupabaseClient
): Promise<string[]> {
  if (!categoryIds || categoryIds.length === 0) return []

  // Call SQL function to expand hierarchy
  const { data, error } = await supabase.rpc('get_category_descendants', {
    input_ids: categoryIds
  })

  if (error) {
    console.error('Failed to expand category hierarchy:', error)
    return categoryIds // Fallback to original IDs
  }

  return data || categoryIds
}
