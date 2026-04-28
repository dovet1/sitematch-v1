/**
 * Utilities for building and managing the category → brand → fascia tree structure
 */

import type { Category, Brand, Fascia } from './stores'

export interface CategoryNode {
  category: Category
  children: CategoryNode[]  // Child categories
  brands: BrandNode[]        // Brands with fascias in this category
}

export interface BrandNode {
  brand: Brand
  fascias: Fascia[]  // Fascias belonging to this brand AND category
}

export interface FasciaCategory {
  fascia_id: string
  category_id: string
  is_primary: boolean
}

/**
 * Build a hierarchical tree of categories from a flat list
 * @param categories Flat array of categories
 * @returns Array of root-level category nodes with nested children
 */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  // Create a map of category ID to node
  const categoryMap = new Map<string, CategoryNode>()

  // Initialize all category nodes
  categories.forEach(category => {
    categoryMap.set(category.id, {
      category,
      children: [],
      brands: []
    })
  })

  // Build the tree by linking children to parents
  const rootNodes: CategoryNode[] = []

  categories.forEach(category => {
    const node = categoryMap.get(category.id)!

    if (category.parent_category_id) {
      // This is a child category - add it to its parent's children
      const parent = categoryMap.get(category.parent_category_id)
      if (parent) {
        parent.children.push(node)
      } else {
        // Parent not found - treat as root
        rootNodes.push(node)
      }
    } else {
      // This is a root category
      rootNodes.push(node)
    }
  })

  // Sort children alphabetically at each level
  const sortChildren = (node: CategoryNode) => {
    node.children.sort((a, b) => a.category.name.localeCompare(b.category.name))
    node.children.forEach(sortChildren)
  }

  rootNodes.forEach(sortChildren)
  rootNodes.sort((a, b) => a.category.name.localeCompare(b.category.name))

  return rootNodes
}

/**
 * Organize brands by category using fascia-category mappings
 * Creates a map of category ID to brands that have fascias in that category
 * @param brands All brands with their fascias
 * @param fasciaCategoryMappings Fascia-category relationships
 * @returns Map of category ID to array of brand nodes
 */
export function organizeBrandsByCategory(
  brands: (Brand & { fascias?: Fascia[] })[],
  fasciaCategoryMappings: FasciaCategory[]
): Map<string, BrandNode[]> {
  const categoryBrandsMap = new Map<string, Map<string, BrandNode>>()

  // Build a map of fascia ID to category IDs
  const fasciaCategoriesMap = new Map<string, string[]>()
  fasciaCategoryMappings.forEach(mapping => {
    if (!fasciaCategoriesMap.has(mapping.fascia_id)) {
      fasciaCategoriesMap.set(mapping.fascia_id, [])
    }
    fasciaCategoriesMap.get(mapping.fascia_id)!.push(mapping.category_id)
  })

  // For each brand, organize its fascias by category
  brands.forEach(brand => {
    if (!brand.fascias || brand.fascias.length === 0) return

    brand.fascias.forEach(fascia => {
      const categoryIds = fasciaCategoriesMap.get(fascia.id) || []

      // Add this fascia to each category it belongs to
      categoryIds.forEach(categoryId => {
        // Get or create the brands map for this category
        if (!categoryBrandsMap.has(categoryId)) {
          categoryBrandsMap.set(categoryId, new Map<string, BrandNode>())
        }
        const brandsInCategory = categoryBrandsMap.get(categoryId)!

        // Get or create the brand node for this brand in this category
        if (!brandsInCategory.has(brand.id)) {
          brandsInCategory.set(brand.id, {
            brand,
            fascias: []
          })
        }

        // Add the fascia to this brand node
        brandsInCategory.get(brand.id)!.fascias.push(fascia)
      })
    })
  })

  // Convert the nested maps to the final format
  const result = new Map<string, BrandNode[]>()
  categoryBrandsMap.forEach((brandsMap, categoryId) => {
    const brandNodes = Array.from(brandsMap.values())
    // Sort brands alphabetically
    brandNodes.sort((a, b) => a.brand.name.localeCompare(b.brand.name))
    // Sort fascias within each brand alphabetically
    brandNodes.forEach(node => {
      node.fascias.sort((a, b) => a.name.localeCompare(b.name))
    })
    result.set(categoryId, brandNodes)
  })

  return result
}

/**
 * Attach brand nodes to category nodes in the tree
 * @param tree Array of category nodes
 * @param categoryBrandsMap Map of category ID to brand nodes
 */
export function attachBrandsToTree(
  tree: CategoryNode[],
  categoryBrandsMap: Map<string, BrandNode[]>
): void {
  const attachToNode = (node: CategoryNode) => {
    // Attach brands to this category
    node.brands = categoryBrandsMap.get(node.category.id) || []

    // Recursively attach to children
    node.children.forEach(attachToNode)
  }

  tree.forEach(attachToNode)
}

/**
 * Filter the category tree by a search query
 * Searches category names, brand names, and fascia names
 * Returns a new tree containing only matching nodes and their ancestors
 * @param tree The category tree to filter
 * @param query Search query (case-insensitive)
 * @returns Filtered tree
 */
export function filterTree(tree: CategoryNode[], query: string): CategoryNode[] {
  if (!query || query.trim() === '') {
    return tree
  }

  const lowerQuery = query.toLowerCase().trim()

  const filterNode = (node: CategoryNode): CategoryNode | null => {
    // Check if category name matches
    const categoryMatches = node.category.name.toLowerCase().includes(lowerQuery)

    // Filter brands and fascias
    const filteredBrands = node.brands
      .map(brandNode => {
        // Check if brand name matches
        const brandMatches = brandNode.brand.name.toLowerCase().includes(lowerQuery)

        // Filter fascias
        const filteredFascias = brandNode.fascias.filter(fascia =>
          fascia.name.toLowerCase().includes(lowerQuery)
        )

        // Include brand if it matches OR has matching fascias
        if (brandMatches || filteredFascias.length > 0) {
          return {
            ...brandNode,
            fascias: brandMatches ? brandNode.fascias : filteredFascias
          }
        }
        return null
      })
      .filter((b): b is BrandNode => b !== null)

    // Recursively filter children
    const filteredChildren = node.children
      .map(filterNode)
      .filter((n): n is CategoryNode => n !== null)

    // Include node if category matches OR has matching brands OR has matching children
    if (categoryMatches || filteredBrands.length > 0 || filteredChildren.length > 0) {
      return {
        ...node,
        brands: filteredBrands,
        children: filteredChildren
      }
    }

    return null
  }

  return tree.map(filterNode).filter((n): n is CategoryNode => n !== null)
}

/**
 * Get all fascia IDs in a category and its descendants
 * @param categoryId The category ID
 * @param tree The category tree
 * @returns Array of fascia IDs
 */
export function getAllFasciaIdsInCategory(
  categoryId: string,
  tree: CategoryNode[]
): string[] {
  const fasciaIds = new Set<string>()

  const collectFromNode = (node: CategoryNode) => {
    if (node.category.id === categoryId) {
      // This is the target category - collect all fascia IDs
      node.brands.forEach(brandNode => {
        brandNode.fascias.forEach(fascia => {
          fasciaIds.add(fascia.id)
        })
      })

      // Also collect from all descendants
      const collectFromDescendants = (n: CategoryNode) => {
        n.brands.forEach(brandNode => {
          brandNode.fascias.forEach(fascia => {
            fasciaIds.add(fascia.id)
          })
        })
        n.children.forEach(collectFromDescendants)
      }
      node.children.forEach(collectFromDescendants)

      return true
    }

    // Check children
    return node.children.some(collectFromNode)
  }

  tree.some(collectFromNode)

  return Array.from(fasciaIds)
}

/**
 * Get all brand IDs that have fascias in a category
 * @param categoryId The category ID
 * @param tree The category tree
 * @returns Array of brand IDs
 */
export function getAllBrandIdsInCategory(
  categoryId: string,
  tree: CategoryNode[]
): string[] {
  const brandIds = new Set<string>()

  const collectFromNode = (node: CategoryNode) => {
    if (node.category.id === categoryId) {
      node.brands.forEach(brandNode => {
        brandIds.add(brandNode.brand.id)
      })
      return true
    }
    return node.children.some(collectFromNode)
  }

  tree.some(collectFromNode)

  return Array.from(brandIds)
}

/**
 * Count total items in the tree
 * @param tree The category tree
 * @returns Object with counts of categories, brands, and fascias
 */
export function countTreeItems(tree: CategoryNode[]): {
  categories: number
  brands: number
  fascias: number
} {
  let categories = 0
  const brandIds = new Set<string>()
  const fasciaIds = new Set<string>()

  const countNode = (node: CategoryNode) => {
    categories++
    node.brands.forEach(brandNode => {
      brandIds.add(brandNode.brand.id)
      brandNode.fascias.forEach(fascia => {
        fasciaIds.add(fascia.id)
      })
    })
    node.children.forEach(countNode)
  }

  tree.forEach(countNode)

  return {
    categories,
    brands: brandIds.size,
    fascias: fasciaIds.size
  }
}
