# Debug Property Page Link Issue

## Testing Steps

1. **Open the create listing wizard** at `http://localhost:3001/occupier/create-listing`

2. **Fill out Step 1 form** with the following test data:
   - Company Name: "Test Company"
   - Contact details (all required fields)
   - **Property Page Link**: `https://example.com/test-property`

3. **Check browser console** for these debug messages:
   ```
   Step1 updating with propertyPageLink: https://example.com/test-property
   🔍 DEBUG: Preparing enhancedListingData with propertyPageLink: https://example.com/test-property
   🔍 DEBUG: Processing property_page_link: https://example.com/test-property
   🔍 DEBUG: Added property_page_link to insertData: https://example.com/test-property
   🔍 DEBUG: Final insert data: {...}
   🔍 DEBUG: property_page_link in insertData: https://example.com/test-property
   ```

4. **Complete the wizard** and submit the listing

5. **Check database** to see if `property_page_link` column contains the value

## Potential Issues to Check

### 1. Form Registration Issue
- Check if `propertyPageLink` is properly registered with react-hook-form
- Verify the field name matches between form registration and wizard types

### 2. Data Mapping Issue
- Verify `formData.propertyPageLink` is correctly mapped to `property_page_link` in submission

### 3. Database Constraint Issue
- The regex constraint might be invalid: `'^https?://[^\s/$.?#].[^\s]*::text'`
- Should be: `'^https?://[^\s/$.?#].[^\s]*$'` (without `::text`)

### 4. Null/Empty Value Handling
- Check if empty string `""` is being treated differently than `null`
- Verify the condition `if (data.property_page_link)` works correctly

## Quick Fix

If the issue is the database constraint, run this SQL:

```sql
ALTER TABLE public.listings 
DROP CONSTRAINT IF EXISTS listings_property_page_link_format;

ALTER TABLE public.listings 
ADD CONSTRAINT listings_property_page_link_format 
CHECK (
  property_page_link IS NULL 
  OR property_page_link ~* '^https?://[^\s/$.?#].[^\s]*$'
);
```

## Expected Console Output

When working correctly, you should see:
1. Form input captured in Step 1
2. Data passed through wizard submission
3. Field added to database insert data
4. Successful database insertion with the field value