# Population Filter Logic - <5k BUAs

## Overview

BUAs with population < 5,000 are now displayed as "<5k" instead of showing exact numbers. To ensure consistent UX, the population filter treats all BUAs with `pop < 5000` specially:

**When minimum population is set between 0-4,999**: All BUAs with pop < 5000 are included, regardless of the exact minimum value.

**When minimum population is set to 5,000 or higher**: Normal filtering applies.

## Implementation

### 1. Database RPC Function

**File**: [drop-and-recreate-bua-function.sql](scripts/drop-and-recreate-bua-function.sql#L24-L31)

```sql
WHERE (
  -- If min_pop < 5000, treat all BUAs with pop < 5000 as having pop = 0
  -- This ensures they're included regardless of the min_pop value (as long as it's < 5000)
  (p_min_pop < 5000 AND COALESCE(b.pop_final, b.pop) < 5000)
  OR
  -- For BUAs with pop >= 5000, apply normal filtering
  (COALESCE(b.pop_final, b.pop) BETWEEN p_min_pop AND p_max_pop)
)
```

### 2. Tileset Export SQL

**File**: [export-bua-tileset.sql](scripts/export-bua-tileset.sql#L21-L28)

Same logic as RPC function above.

### 3. Client-Side Map Filtering

**File**: [BUAMap.tsx](apps/web/src/components/buas/BUAMap.tsx#L228-L240)

```typescript
const pop = ['coalesce', ['get', 'pop_final'], ['get', 'pop']]
const filterConditions: any[] = [
  'all',
  // If minPopulation < 5000, include all BUAs with pop < 5000
  // Otherwise apply normal min population filter
  minPopulation < 5000
    ? ['any',
        ['<', pop, 5000],
        ['>=', pop, minPopulation]
      ]
    : ['>=', pop, minPopulation],
  ['<=', pop, maxPopulation]
]
```

### 4. Service Layer

**File**: [stores-service.ts](apps/web/src/lib/stores-service.ts#L158-L177)

The `findGaps` method now always uses the RPC function for consistent filtering logic:

```typescript
async findGaps(filters: {...}): Promise<{ results: any[], total: number }> {
  // Always use RPC function for consistent population filtering logic
  // (RPC handles the special case where minPop < 5000 includes all BUAs with pop < 5000)
  const { gsscodes: allMatchingGsscodes, total } = await this.getFilteredGssCodes(filters)

  // Fetch detailed BUA data for top 1,000
  const { data, error } = await this.supabase
    .from('built_up_areas')
    .select('gsscode, name, pop, pop_final, pop_official, pop_band, centroid_lat, centroid_lon')
    .in('gsscode', allMatchingGsscodes.slice(0, 1000))
    .order('pop_final', { ascending: false, nullsLast: true })

  return { results: data || [], total }
}
```

## Examples

### Example 1: Min Population = 0

- **Filter**: `minPop = 0, maxPop = 1,500,000`
- **Result**: All BUAs shown (including those with pop < 5000)
- **Display**: BUAs with pop < 5000 show as "<5k"

### Example 2: Min Population = 2,500

- **Filter**: `minPop = 2500, maxPop = 1,500,000`
- **Result**: All BUAs shown (including those with pop < 5000)
- **Reason**: Since minPop < 5000, the filter includes all BUAs with pop < 5000
- **Display**: BUAs with pop < 5000 show as "<5k"

### Example 3: Min Population = 5,000

- **Filter**: `minPop = 5000, maxPop = 1,500,000`
- **Result**: Only BUAs with pop >= 5000 shown
- **Reason**: Now using normal filtering logic
- **Display**: All populations show as formatted numbers (e.g., "5,234" or "12K")

### Example 4: Min Population = 10,000

- **Filter**: `minPop = 10000, maxPop = 1,500,000`
- **Result**: Only BUAs with pop >= 10,000 shown
- **Reason**: Normal filtering
- **Display**: Formatted numbers (e.g., "10K", "250K", "1.2M")

## Rationale

Since all BUAs with `pop_final < 5000` are displayed identically as "<5k", it doesn't make sense to filter them by exact population values. Users can't distinguish between a BUA with population 1,000 vs 4,500 from the UI.

By treating all <5k BUAs as a single group that's either included (when minPop < 5000) or excluded (when minPop >= 5000), we provide a more intuitive user experience.

## Testing

To verify the implementation:

1. Set min population to 0 → Should see all BUAs including "<5k" ones
2. Set min population to 2,500 → Should still see all BUAs including "<5k" ones
3. Set min population to 4,999 → Should still see all BUAs including "<5k" ones
4. Set min population to 5,000 → Should see only BUAs with pop >= 5,000 (no "<5k" BUAs)
5. Set min population to 10,000 → Should see only BUAs with pop >= 10,000

## Deployment

After deploying the updated RPC function to Supabase, the filtering logic will work consistently across:
- Map display (Mapbox client-side filtering)
- Results panel (sidebar list)
- API responses
- Total count indicators
