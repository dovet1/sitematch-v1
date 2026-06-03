# Gap Analysis Filter System - Comprehensive Test Plan

## Overview
This document provides test scenarios to validate the Include/Exclude filter logic for the Gap Analysis tool.

---

## Test Scenarios

### 1. Basic Include Filters

#### Test 1.1: Include Single Fascia
**Setup:**
- Include: Asda PFS
- Exclude: None

**Expected Result:**
- Should return 18 BUAs
- All BUAs should have at least one Asda PFS store
- Console logs should show:
  - `📍 Include filter - GSScodes to include: 18 BUAs`

**Validation:**
```bash
# API Test
curl -X POST http://localhost:3000/api/public/gaps/find \
  -H "Content-Type: application/json" \
  -d '{"minPop":0,"maxPop":10000000,"includeBrands":["a0e7ed99-ad90-59ae-876b-85dfd44bbe16"]}'
```

#### Test 1.2: Include Multiple Fascias (Same Brand)
**Setup:**
- Include: Tesco + Tesco Express
- Exclude: None

**Expected Result:**
- Should return BUAs that have EITHER Tesco OR Tesco Express (union)
- Console should show total unique BUAs

**Validation:**
```bash
# Get Tesco IDs first
curl -s 'http://localhost:3000/api/public/fascias/search?q=Tesco&limit=5'

# Then test with both IDs
curl -X POST http://localhost:3000/api/public/gaps/find \
  -H "Content-Type: application/json" \
  -d '{"minPop":0,"maxPop":10000000,"includeBrands":["277a03fc-0a6b-56e7-9102-4dff43461324","91a16d23-3b0f-5618-90a7-2a150029caee"]}'
```

#### Test 1.3: Include Category
**Setup:**
- Include: Supermarkets category
- Exclude: None

**Expected Result:**
- Should return BUAs with any supermarket fascia
- Console shows category filter applied

**Manual Test:**
1. Open Include modal
2. Go to Categories tab
3. Select "Supermarkets"
4. Verify BUAs appear on map
5. Check console for include filter logs

---

### 2. Basic Exclude Filters

#### Test 2.1: Exclude Single Fascia
**Setup:**
- Include: None (all BUAs)
- Exclude: Asda PFS

**Expected Result:**
- Should return ALL BUAs except those with Asda PFS
- Total BUAs = (all BUAs in population range) - 18
- Console should show:
  - `🚫 Exclude brands - GSScodes to exclude: 18 BUAs`
  - `✅ Results after exclusion: X BUAs`

**Validation:**
```bash
curl -X POST http://localhost:3000/api/public/gaps/find \
  -H "Content-Type: application/json" \
  -d '{"minPop":0,"maxPop":10000000,"excludeBrands":["a0e7ed99-ad90-59ae-876b-85dfd44bbe16"]}'
```

#### Test 2.2: Exclude Multiple Fascias
**Setup:**
- Include: None
- Exclude: Asda PFS + Asda Express

**Expected Result:**
- Should exclude BUAs that have EITHER Asda PFS OR Asda Express
- Uses Set to avoid double-counting overlaps
- Console shows total unique exclusions

---

### 3. Conflict Scenarios (Include + Exclude Same Item)

#### Test 3.1: Same Fascia in Both Filters
**Setup:**
- Include: Asda PFS
- Exclude: Asda PFS

**Expected Result:**
- **Should return 0 BUAs** (empty set)
- Logic: First includes 18 BUAs, then excludes those same 18 BUAs
- Console should show:
  - `📍 Include filter - GSScodes to include: 18 BUAs`
  - `🚫 Exclude brands - GSScodes to exclude: 18 BUAs`
  - `🚫 Total unique GSScodes to exclude: 18`
  - `✅ Results after exclusion: 0 BUAs`

**Validation:**
```bash
curl -X POST http://localhost:3000/api/public/gaps/find \
  -H "Content-Type: application/json" \
  -d '{"minPop":0,"maxPop":10000000,"includeBrands":["a0e7ed99-ad90-59ae-876b-85dfd44bbe16"],"excludeBrands":["a0e7ed99-ad90-59ae-876b-85dfd44bbe16"]}'
```

**Expected JSON Response:**
```json
{
  "results": [],
  "total": 0
}
```

---

### 4. Real-World Use Cases

#### Test 4.1: Include One Fascia, Exclude Related Fascia
**Scenario:** Find BUAs with regular Tesco but NOT Tesco Express

**Setup:**
- Include: Tesco (277a03fc-0a6b-56e7-9102-4dff43461324)
- Exclude: Tesco Express (91a16d23-3b0f-5618-90a7-2a150029caee)

**Expected Result:**
- **Based on data:** May return 0 BUAs if all regular Tesco locations also have Tesco Express
- This is correct behavior reflecting real-world data
- Console should clearly show:
  - Include: 461 BUAs
  - Exclude: 737 BUAs
  - Result after filtering

**Validation:**
```bash
curl -X POST http://localhost:3000/api/public/gaps/find \
  -H "Content-Type: application/json" \
  -d '{"minPop":0,"maxPop":10000000,"includeBrands":["277a03fc-0a6b-56e7-9102-4dff43461324"],"excludeBrands":["91a16d23-3b0f-5618-90a7-2a150029caee"]}'
```

#### Test 4.2: Include Express, Exclude Regular
**Scenario:** Find BUAs with ONLY Tesco Express (no regular Tesco)

**Setup:**
- Include: Tesco Express (91a16d23-3b0f-5618-90a7-2a150029caee)
- Exclude: Tesco (277a03fc-0a6b-56e7-9102-4dff43461324)

**Expected Result:**
- Should return 276 BUAs (737 - 461 = 276)
- These are BUAs with Tesco Express but no regular Tesco
- Console should show filtered results

**Validation:**
```bash
curl -X POST http://localhost:3000/api/public/gaps/find \
  -H "Content-Type: application/json" \
  -d '{"minPop":0,"maxPop":10000000,"includeBrands":["91a16d23-3b0f-5618-90a7-2a150029caee"],"excludeBrands":["277a03fc-0a6b-56e7-9102-4dff43461324"]}'
```

#### Test 4.3: Multiple Brands, Exclude Competitor
**Scenario:** Find BUAs with Tesco OR Sainsbury's but NOT Asda

**Setup:**
- Include: Tesco Express + Sainsbury's
- Exclude: Asda PFS

**Expected Result:**
- Shows gap analysis for Asda in areas where competitors exist
- Result = (Tesco Express BUAs ∪ Sainsbury's BUAs) - Asda PFS BUAs

**Manual Test:**
1. Open Include modal → Stores tab
2. Search "Tesco", select "Tesco Express"
3. Search "Sainsbury", select relevant fascias
4. Open Exclude modal → Stores tab
5. Search "Asda", select "Asda PFS"
6. Verify map shows correct BUAs
7. Check console logs for set operations

---

### 5. Category Filters

#### Test 5.1: Include Category, Exclude Specific Brand
**Scenario:** Find BUAs with supermarkets but NOT Tesco

**Setup:**
- Include: Supermarkets category
- Exclude: All Tesco fascias

**Expected Result:**
- Shows BUAs with supermarkets (Asda, Sainsbury's, Morrisons, etc.) but no Tesco
- Good for competitive analysis

#### Test 5.2: Include Multiple Categories
**Scenario:** Find BUAs with either supermarkets OR convenience stores

**Setup:**
- Include: Supermarkets + Convenience Stores categories
- Exclude: None

**Expected Result:**
- Union of both categories
- Console shows total unique BUAs

---

### 6. Brand/Fascia Hierarchy Testing

#### Test 6.1: Select Entire Brand (Parent Checkbox)
**Scenario:** Click the "Asda" brand checkbox (not individual fascias)

**Expected Result:**
- Should select ALL Asda fascias:
  - Asda Express
  - Asda Living
  - Asda PFS
  - Asda Supercentre
  - Asda Supermarket
  - Asda Superstore
- Brand checkbox shows checked state
- All child fascias show checked state
- Console logs all fascia IDs in the filter

**Validation:**
1. Open Include modal
2. Expand "Asda" brand
3. Click the parent "Asda" checkbox
4. Verify all child fascias are selected
5. Check console for array of 6 fascia IDs

#### Test 6.2: Partial Selection (Indeterminate State)
**Scenario:** Select only some fascias from a brand

**Expected Result:**
- Brand checkbox shows indeterminate state (minus icon)
- Only selected fascias are in the filter
- Clicking brand checkbox again should select remaining fascias

**Validation:**
1. Open Include modal
2. Expand "Asda" brand
3. Select only "Asda Express" and "Asda PFS"
4. Verify brand checkbox shows minus icon (indeterminate)
5. Check console shows only 2 fascia IDs
6. Click brand checkbox → should now select all 6 fascias

#### Test 6.3: Deselect All from Full Selection
**Scenario:** Click brand checkbox when all fascias are selected

**Expected Result:**
- All fascias should deselect
- Brand checkbox shows unchecked state
- Filter should be empty for that brand

---

### 7. Population Range Integration

#### Test 7.1: Filters + Population Range
**Setup:**
- Include: Tesco Express
- Population: 50,000 - 200,000
- Exclude: None

**Expected Result:**
- Should only show BUAs with:
  - Tesco Express stores
  - Population between 50k-200k
- Console shows both filters applied

#### Test 7.2: Narrow Population Range with Conflicts
**Setup:**
- Include: Asda PFS
- Exclude: Asda PFS
- Population: 0 - 1,500,000

**Expected Result:**
- Should return 0 BUAs (conflict overrides population filter)

---

### 8. UI State and Persistence

#### Test 8.1: Filter Chips in Sidebar
**Expected Behavior:**
- Sidebar shows selected filter counts:
  - "Include Stores: 1 fascia"
  - "Exclude Stores: 2 fascias"
- Clicking "Edit" button opens modal with selections intact

#### Test 8.2: Modal State Persistence
**Scenario:** Open modal, make selections, close without Apply

**Expected Result:**
- Selections should be retained in modal
- Map should NOT update until "Apply" is clicked

#### Test 8.3: Clear All Button
**Expected Result:**
- Clears all selections in current modal only
- Doesn't affect other modals (Include vs Exclude vs Proximity)
- Map updates after Apply

---

### 9. Search Functionality

#### Test 9.1: Search Brands/Fascias
**Setup:**
1. Open Include modal → Stores tab
2. Type "tesco" in search

**Expected Result:**
- Shows only Tesco-related brands
- Hierarchy preserved (Tesco brand → child fascias)
- Search is case-insensitive
- Clears when search box is cleared

#### Test 9.2: Search Categories
**Setup:**
1. Open Include modal → Categories tab
2. Type "super" in search

**Expected Result:**
- Shows "Supermarkets" category
- Other categories hidden

---

### 10. Error Handling and Edge Cases

#### Test 10.1: No Results
**Setup:**
- Include: Very specific fascia with limited presence
- Exclude: Common fascia
- Very narrow population range

**Expected Result:**
- Map shows no markers
- Sidebar shows "0 results"
- No console errors

#### Test 10.2: API Timeout/Error
**Setup:**
- Simulate slow network (Chrome DevTools → Network → Throttling)

**Expected Result:**
- Loading state shows in UI
- Error message if timeout
- No broken state

#### Test 10.3: Invalid Fascia ID
**Setup:**
- Manually call API with fake UUID

**Expected Result:**
- Should return 0 results (no BUAs match)
- No server error

---

## Automated Test Suite

### Unit Tests (Recommended)

```typescript
// tests/gap-analysis.test.ts

describe('Gap Analysis Filter Logic', () => {
  it('should return 0 BUAs when same fascia is included and excluded', async () => {
    const result = await findGaps({
      minPop: 0,
      maxPop: 10000000,
      includeBrands: ['asda-pfs-id'],
      excludeBrands: ['asda-pfs-id']
    })
    expect(result.length).toBe(0)
  })

  it('should exclude BUAs with Tesco from Tesco Express results', async () => {
    const expressOnly = await findGaps({
      minPop: 0,
      maxPop: 10000000,
      includeBrands: ['tesco-express-id'],
      excludeBrands: ['tesco-regular-id']
    })
    expect(expressOnly.length).toBeGreaterThan(0)

    // Verify no BUA has regular Tesco
    expressOnly.forEach(bua => {
      expect(bua.has_regular_tesco).toBe(false)
    })
  })
})
```

---

## Database Validation Queries

### Check BUA Store Presence Data

```sql
-- Find how many BUAs have Asda PFS
SELECT COUNT(DISTINCT bua_gsscode)
FROM bua_store_presence
WHERE fascia_id = 'a0e7ed99-ad90-59ae-876b-85dfd44bbe16';
-- Should return 18

-- Find BUAs with both Tesco and Tesco Express
SELECT bua_gsscode, COUNT(*) as fascia_count
FROM bua_store_presence
WHERE fascia_id IN (
  '277a03fc-0a6b-56e7-9102-4dff43461324',  -- Tesco
  '91a16d23-3b0f-5618-90a7-2a150029caee'   -- Tesco Express
)
GROUP BY bua_gsscode
HAVING COUNT(*) = 2;
-- Shows BUAs with BOTH fascias

-- Verify filter logic for exclude
SELECT bua_gsscode
FROM bua_store_presence
WHERE fascia_id = '277a03fc-0a6b-56e7-9102-4dff43461324'  -- Tesco
  AND bua_gsscode NOT IN (
    SELECT bua_gsscode
    FROM bua_store_presence
    WHERE fascia_id = '91a16d23-3b0f-5618-90a7-2a150029caee'  -- Tesco Express
  );
-- Should return 0 if all Tesco BUAs also have Tesco Express
```

---

## Performance Tests

### Test 10K: Large Fascia Set
**Setup:**
- Include: 10+ fascias from multiple brands
- Exclude: 5+ fascias

**Expected Result:**
- Query completes in < 5 seconds
- Console logs show Set operations handling overlaps efficiently
- No memory issues in browser

### Test 10L: All BUAs (No Filters)
**Setup:**
- No include filters
- No exclude filters
- Population: 0 - 10,000,000

**Expected Result:**
- Returns up to 1000 BUAs (query limit)
- Ordered by population descending
- Map renders without lag

---

## Regression Tests (After Any Changes)

1. **Test 3.1** (conflict scenario) - Must always return 0
2. **Test 4.2** (Tesco Express only) - Should return ~276 BUAs
3. **Test 6.1** (brand selection) - All child fascias selected
4. **Test 6.2** (indeterminate state) - Minus icon shows correctly

---

## Manual QA Checklist

- [ ] Include modal opens/closes correctly
- [ ] Exclude modal opens/closes correctly
- [ ] Proximity modal opens/closes correctly
- [ ] All tabs switch without errors
- [ ] Search box filters results instantly
- [ ] Checkboxes respond to clicks
- [ ] Indeterminate state shows minus icon
- [ ] Brand expansion/collapse works
- [ ] Selected items show in sidebar badges
- [ ] "Clear All" button works
- [ ] "Apply" button closes modal and updates map
- [ ] "Cancel" button closes modal without changes
- [ ] Console logs show all filter operations
- [ ] No React errors in console
- [ ] Map markers update after Apply
- [ ] BUA list updates with correct names
- [ ] Population slider works with filters

---

## Console Log Monitoring

When testing, watch for these logs in sequence:

```
🔍 Gap Analysis Filters: {
  "minPop": 0,
  "maxPop": 1500000,
  "includeBrands": ["a0e7ed99-ad90-59ae-876b-85dfd44bbe16"],
  "excludeBrands": ["a0e7ed99-ad90-59ae-876b-85dfd44bbe16"]
}

📍 Include filter - GSScodes to include: 18 BUAs
🚫 Exclude brands - GSScodes to exclude: 18 BUAs
🚫 Total unique GSScodes to exclude: 18
✅ Results after exclusion: 0 BUAs
```

Any deviation from this pattern indicates a bug.

---

## Known Good Test Results

Save these as baseline references:

| Test | Include | Exclude | Expected Count |
|------|---------|---------|----------------|
| 1.1 | Asda PFS | None | 18 |
| 3.1 | Asda PFS | Asda PFS | 0 |
| 4.2 | Tesco Express | Tesco | ~276 |
| 2.1 | None | Asda PFS | All - 18 |

---

## Test Execution Order

1. **Start with Test 1.1** (simplest include)
2. **Then Test 2.1** (simplest exclude)
3. **Then Test 3.1** (conflict scenario - critical)
4. **Then Test 4.1, 4.2** (real-world cases)
5. **Then Test 6.x** (hierarchy/UI behavior)
6. **Then Test 7.x** (integration with other filters)
7. **Finally Test 10.x** (edge cases)

If any test fails, stop and investigate before proceeding.
