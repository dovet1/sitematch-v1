# Gap Analysis - Simple Test Guide
**Easy-to-verify test scenarios with small, manageable numbers**

---

## Test Data Reference

| Fascia | ID | BUA Count | Example BUAs |
|--------|-----|-----------|--------------|
| **Asda PFS** | `a0e7ed99-ad90-59ae-876b-85dfd44bbe16` | **18** | Bristol, Ealing, Cardiff |
| **Little Waitrose** | `ee3e08ec-bb0c-5f85-8e2d-b1bbf275b0e8` | **26** | Bristol, Barnet, Enfield |
| **Waitrose** | `28dfeaee-70b9-559f-bded-04329cf782f2` | **234** | Birmingham, Glasgow, Leeds |

---

## 🎯 Priority Tests (Small Numbers)

### ✅ Test 1: Basic Include (Baseline)
**What:** Include only Asda PFS

**Setup in UI:**
1. Click "Edit" on Include Stores
2. Stores tab → Search "Asda PFS"
3. Check "Asda PFS"
4. Click Apply

**Expected Result:**
- **Matching BUAs: 18**
- Example BUAs visible: Bristol, Ealing, Cardiff, Tower Hamlets

**Console Log Check:**
```
📍 Include filter - GSScodes to include: 18 BUAs
```

**API Test:**
```bash
curl -s -X POST http://localhost:3000/api/public/gaps/find \
  -H "Content-Type: application/json" \
  -d '{"minPop":0,"maxPop":10000000,"includeBrands":["a0e7ed99-ad90-59ae-876b-85dfd44bbe16"]}' \
  | python3 -c "import sys, json; data = json.load(sys.stdin); print(f'✅ Result: {data[\"total\"]} BUAs (Expected: 18)')"
```

---

### ❌ Test 2: Conflict (CRITICAL)
**What:** Include AND Exclude the same fascia

**Setup in UI:**
1. Include Stores → Select "Asda PFS" → Apply
2. Exclude Stores → Select "Asda PFS" → Apply

**Expected Result:**
- **Matching BUAs: 0** ⚠️ MUST BE ZERO
- Map shows no markers
- Sidebar shows "0 results"

**Console Log Check:**
```
📍 Include filter - GSScodes to include: 18 BUAs
🚫 Exclude brands - GSScodes to exclude: 18 BUAs
🚫 Total unique GSScodes to exclude: 18
✅ Results after exclusion: 0 BUAs
```

**API Test:**
```bash
curl -s -X POST http://localhost:3000/api/public/gaps/find \
  -H "Content-Type: application/json" \
  -d '{"minPop":0,"maxPop":10000000,"includeBrands":["a0e7ed99-ad90-59ae-876b-85dfd44bbe16"],"excludeBrands":["a0e7ed99-ad90-59ae-876b-85dfd44bbe16"]}' \
  | python3 -c "import sys, json; data = json.load(sys.stdin); result = data['total']; print(f'{'✅ PASS' if result == 0 else '❌ FAIL'}: {result} BUAs (Expected: 0)')"
```

---

### 🔢 Test 3: Simple Math (Include - Exclude)
**What:** Include Waitrose, Exclude Little Waitrose

**Setup in UI:**
1. Include Stores → Select "Waitrose" → Apply
2. Exclude Stores → Select "Little Waitrose" → Apply

**Expected Result:**
- **Matching BUAs: 234 - 26 = 208** (approximately)
- Shows BUAs with regular Waitrose but NOT Little Waitrose
- Some BUAs might have both, so actual result could be less than 208

**Console Log Check:**
```
📍 Include filter - GSScodes to include: 234 BUAs
🚫 Exclude brands - GSScodes to exclude: 26 BUAs
✅ Results after exclusion: ~208 BUAs (or less if overlap exists)
```

**API Test:**
```bash
curl -s -X POST http://localhost:3000/api/public/gaps/find \
  -H "Content-Type: application/json" \
  -d '{"minPop":0,"maxPop":10000000,"includeBrands":["28dfeaee-70b9-559f-bded-04329cf782f2"],"excludeBrands":["ee3e08ec-bb0c-5f85-8e2d-b1bbf275b0e8"]}' \
  | python3 -c "import sys, json; data = json.load(sys.stdin); print(f'Result: {data[\"total\"]} BUAs (Expected: ~208 or less due to overlap)')"
```

---

### 🔢 Test 4: Reverse Math (Small - Large)
**What:** Include Little Waitrose, Exclude regular Waitrose

**Setup in UI:**
1. Include Stores → Select "Little Waitrose" → Apply
2. Exclude Stores → Select "Waitrose" → Apply

**Expected Result:**
- **Matching BUAs: 26 - X = ?** (depends on overlap)
- Shows BUAs with ONLY Little Waitrose (no regular Waitrose)
- If all Little Waitrose locations also have regular Waitrose → Result = 0

**Console Log Check:**
```
📍 Include filter - GSScodes to include: 26 BUAs
🚫 Exclude brands - GSScodes to exclude: 234 BUAs
✅ Results after exclusion: X BUAs
```

**API Test:**
```bash
curl -s -X POST http://localhost:3000/api/public/gaps/find \
  -H "Content-Type: application/json" \
  -d '{"minPop":0,"maxPop":10000000,"includeBrands":["ee3e08ec-bb0c-5f85-8e2d-b1bbf275b0e8"],"excludeBrands":["28dfeaee-70b9-559f-bded-04329cf782f2"]}' \
  | python3 -c "import sys, json; data = json.load(sys.stdin); print(f'Result: {data[\"total\"]} BUAs'); print('Example:', ', '.join([b['name'] for b in data['results'][:5]]))"
```

---

## 📊 Verification Table

After running tests, fill in actual results:

| Test | Include | Exclude | Expected | Actual | Pass? |
|------|---------|---------|----------|--------|-------|
| 1 | Asda PFS | - | 18 | ___ | ☐ |
| 2 | Asda PFS | Asda PFS | **0** | ___ | ☐ |
| 3 | Waitrose | Little Waitrose | ~208 | ___ | ☐ |
| 4 | Little Waitrose | Waitrose | ? | ___ | ☐ |

---

## 🔍 Manual Verification Steps

### Step 1: Verify Test 2 (Most Critical)
1. Open the Gap Analysis page
2. Set Include: Asda PFS
3. Set Exclude: Asda PFS
4. **Look at the counter** → Should say "0 results" or "Matching BUAs: 0"
5. **Look at the map** → Should have NO markers
6. **Check console** → Should see "✅ Results after exclusion: 0 BUAs"

**If you see 18 results instead of 0, the bug is NOT fixed.**

---

### Step 2: Verify Specific BUAs

Pick a small fascia (Asda PFS with only 18 BUAs):

1. **Include Asda PFS** → Note which BUAs appear (e.g., Bristol, Ealing)
2. **Click on "Bristol"** in the list → Map should highlight Bristol
3. **Now add Exclude: Asda PFS** → Bristol should disappear from list
4. **Check counter** → Should drop from 18 to 0

---

### Step 3: Verify the Math

**Include Waitrose (234) + Exclude Little Waitrose (26):**

1. Include only Waitrose → Counter shows 234
2. Add Exclude Little Waitrose → Counter should drop
3. Calculate: `234 - (number of BUAs with Little Waitrose) = result`
4. If result is ~208, logic is correct
5. If result is still 234, exclude filter not working

---

## 🧮 Quick Math Test (One-Liner)

Run all three tests at once:

```bash
echo "Test 1: Include Asda PFS only" && \
curl -s -X POST http://localhost:3000/api/public/gaps/find -H "Content-Type: application/json" -d '{"minPop":0,"maxPop":10000000,"includeBrands":["a0e7ed99-ad90-59ae-876b-85dfd44bbe16"]}' | python3 -c "import sys, json; data = json.load(sys.stdin); print(f'   Result: {data[\"total\"]} (Expected: 18)\n')" && \
echo "Test 2: Include AND Exclude Asda PFS (CONFLICT)" && \
curl -s -X POST http://localhost:3000/api/public/gaps/find -H "Content-Type: application/json" -d '{"minPop":0,"maxPop":10000000,"includeBrands":["a0e7ed99-ad90-59ae-876b-85dfd44bbe16"],"excludeBrands":["a0e7ed99-ad90-59ae-876b-85dfd44bbe16"]}' | python3 -c "import sys, json; data = json.load(sys.stdin); result = data['total']; print(f'   Result: {result} (Expected: 0) {'✅ PASS' if result == 0 else '❌ FAIL'}\n')" && \
echo "Test 3: Include Waitrose, Exclude Little Waitrose" && \
curl -s -X POST http://localhost:3000/api/public/gaps/find -H "Content-Type: application/json" -d '{"minPop":0,"maxPop":10000000,"includeBrands":["28dfeaee-70b9-559f-bded-04329cf782f2"],"excludeBrands":["ee3e08ec-bb0c-5f85-8e2d-b1bbf275b0e8"]}' | python3 -c "import sys, json; data = json.load(sys.stdin); print(f'   Result: {data[\"total\"]} (Expected: ~208 or less)')"
```

---

## 📌 Red Flags (Signs of Bugs)

| What You See | What It Means | Bug? |
|--------------|---------------|------|
| Test 2 returns **18 BUAs** instead of 0 | Exclude filter not working | ❌ YES |
| Test 2 returns **0 BUAs** | Working correctly | ✅ NO |
| Test 3 returns **234 BUAs** (same as include) | Exclude filter ignored | ❌ YES |
| Test 3 returns **~208 BUAs** | Exclude filter working | ✅ NO |
| Console shows no exclude logs | Filter not reaching backend | ❌ YES |
| Console shows exclude logs but wrong result | Backend logic issue | ❌ YES |

---

## 🎓 Understanding the Results

### Why might Test 4 return 0?
If every BUA with "Little Waitrose" **also** has "Waitrose", then:
- Include finds 26 BUAs
- Exclude removes all 26 (because they all have Waitrose too)
- Result = 0

**This is correct behavior!** It reflects real-world data where chains co-locate stores.

### What if numbers don't add up perfectly?
**Example:** Include Waitrose (234) - Exclude Little Waitrose (26) = 215 (not 208)

This means:
- 26 BUAs have Little Waitrose
- But only 19 of those 26 **also** have regular Waitrose
- So we exclude 19, not 26
- 234 - 19 = 215 ✅ Correct!

---

## 📝 Test Checklist

Run tests in this order:

- [ ] **Test 1** - Baseline (should be 18)
- [ ] **Test 2** - Conflict (MUST be 0)
- [ ] **Test 3** - Subtraction (~208)
- [ ] **Test 4** - Reverse check
- [ ] Check console logs for all tests
- [ ] Verify in UI (not just API)
- [ ] Test brand selection (click parent checkbox)
- [ ] Test indeterminate state (select some child fascias)
- [ ] Test search functionality
- [ ] Test Clear All button

**If Test 2 fails (returns 18 instead of 0), stop and investigate immediately.**

---

## 🔧 Troubleshooting

### If Test 2 returns 18 instead of 0:

1. **Check browser console** for the request payload
   - Should show both `includeBrands` AND `excludeBrands` with same ID
2. **Check server logs** for filter operations
   - Should see both include and exclude logs
3. **Check the response** in Network tab
   - Should be `{"total": 0, "results": []}`

### If exclude filter seems ignored:

1. Open Network tab → Find `/api/public/gaps/find` request
2. Check Request Payload → `excludeBrands` should be present
3. Check Console → Look for `🚫 Exclude brands` log
4. If log is missing, backend isn't receiving the filter

---

## ✅ Success Criteria

All tests pass when:
- ✅ Test 1 returns exactly **18 BUAs**
- ✅ Test 2 returns exactly **0 BUAs** (critical)
- ✅ Test 3 returns approximately **208 BUAs** (±50 is acceptable due to overlaps)
- ✅ Console logs show all filter operations
- ✅ UI counter matches API response
- ✅ Map markers update correctly
