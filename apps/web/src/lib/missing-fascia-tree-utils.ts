/**
 * Utilities for building the missing fascia tree structure
 * Creates a Category > Brand > Fascia hierarchy from flat MissingFasciaInfo array
 */

import type { MissingFasciaInfo } from './stores'

export interface MissingFasciaLeafNode {
  fasciaId: string
  fasciaName: string
  nearestStoreDistance?: number  // meters
  nearestStoreName?: string
  nearestStoreTown?: string
}

export interface MissingFasciaBrandNode {
  brandId: string
  brandName: string
  fascias: MissingFasciaLeafNode[]
}

export interface MissingFasciaCategoryNode {
  categoryId: string
  categoryName: string
  isUncategorized?: boolean  // Flag for synthetic "Uncategorized" node
  brands: MissingFasciaBrandNode[]
  // Note: No nested children - this creates flat category list
}

/**
 * Build a hierarchical tree of missing fascias grouped by category and brand
 * @param missingFascias Flat array of missing fascia information
 * @returns Array of category nodes with nested brands and fascias
 */
export function buildMissingFasciasTree(
  missingFascias: MissingFasciaInfo[]
): MissingFasciaCategoryNode[] {
  // Step 1: Group by category
  const categoryMap = new Map<string, MissingFasciaInfo[]>()

  missingFascias.forEach(fascia => {
    const categoryId = fascia.categoryId || 'uncategorized'
    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, [])
    }
    categoryMap.get(categoryId)!.push(fascia)
  })

  // Step 2: Build category nodes
  const categoryNodes: MissingFasciaCategoryNode[] = []

  categoryMap.forEach((fasciasInCategory, categoryId) => {
    // Step 3: Group by brand within this category
    const brandMap = new Map<string, MissingFasciaInfo[]>()

    fasciasInCategory.forEach(fascia => {
      if (!brandMap.has(fascia.brandId)) {
        brandMap.set(fascia.brandId, [])
      }
      brandMap.get(fascia.brandId)!.push(fascia)
    })

    // Step 4: Build brand nodes
    const brandNodes: MissingFasciaBrandNode[] = []

    brandMap.forEach((fasciasInBrand, brandId) => {
      // Step 5: Map to MissingFasciaLeafNode (preserve nearest-store data per fascia)
      const fasciaLeaves: MissingFasciaLeafNode[] = fasciasInBrand.map(f => ({
        fasciaId: f.fasciaId,
        fasciaName: f.fasciaName,
        nearestStoreDistance: f.nearestStoreDistance,
        nearestStoreName: f.nearestStoreName,
        nearestStoreTown: f.nearestStoreTown,
      }))

      // Sort fascias alphabetically
      fasciaLeaves.sort((a, b) => a.fasciaName.localeCompare(b.fasciaName))

      brandNodes.push({
        brandId,
        brandName: fasciasInBrand[0].brandName, // All fascias in this group have same brand name
        fascias: fasciaLeaves,
      })
    })

    // Sort brands alphabetically
    brandNodes.sort((a, b) => a.brandName.localeCompare(b.brandName))

    // Create category node
    const isUncategorized = categoryId === 'uncategorized'
    categoryNodes.push({
      categoryId,
      categoryName: isUncategorized
        ? 'Uncategorized'
        : fasciasInCategory[0].categoryName || 'Unknown',
      isUncategorized,
      brands: brandNodes,
    })
  })

  // Step 6: Sort categories with explicit comparator
  // "Uncategorized" always last, others alphabetically
  categoryNodes.sort((a, b) => {
    if (a.isUncategorized) return 1
    if (b.isUncategorized) return -1
    return a.categoryName.localeCompare(b.categoryName)
  })

  return categoryNodes
}
