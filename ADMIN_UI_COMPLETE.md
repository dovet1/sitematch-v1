# Admin UI for Store Shapes - Complete! 🎉

## What Was Built

I've created a **complete admin interface** for uploading and processing DXF files. No more command-line scripts needed!

### New Features

1. **Admin Web UI** - Upload DXF files through your browser
2. **Automatic Processing Pipeline** - Converts, optimizes, and inserts in one click
3. **Real-time Progress** - Visual feedback for each processing step
4. **Metadata Support** - Automatic scale factor calculation and storage

---

## How to Access

### 1. Navigate to Admin Dashboard
```
http://localhost:3000/admin
```

### 2. Click "Store Shapes Upload"
You'll see a new button in the Quick Actions section.

### 3. Upload & Process
The admin page at `/admin/store-shapes` provides:
- File upload (DXF files only)
- Form fields for shape details
- Real-time processing status
- Success confirmation

---

## Usage Guide

### Step-by-Step

1. **Prepare Your DXF File**
   - Export DWG to DXF using ODA File Converter
   - Format: ASCII DXF 2018 (recommended)

2. **Open Admin Page**
   - Go to `/admin/store-shapes`
   - Click "Choose File" and select your DXF

3. **Fill in Details**
   - **Shape Name**: Display name (e.g., "Lidl Store #123")
   - **Company**: Company name (e.g., "Lidl", "Tesco")
   - **Target Width**: How wide on map in meters (e.g., 60)
   - **Description**: Optional details

4. **Click "Process & Upload"**
   - The system will:
     ✓ Upload the file
     ✓ Convert DXF → GeoJSON
     ✓ Optimize coordinates
     ✓ Insert to database with metadata

5. **Done!**
   - Shape immediately available in SiteSketcher
   - Proper scale automatically applied

---

## Files Created

### Frontend
- **Page:** `apps/web/src/app/admin/store-shapes/page.tsx`
  - Full-featured admin UI with form validation
  - Real-time progress indicators
  - Error handling and success messages

### Backend APIs
1. **Upload:** `apps/web/src/app/api/admin/store-shapes/upload/route.ts`
   - Accepts DXF files via multipart/form-data
   - Saves to `store-dwg-files/` directory
   - Returns unique filename

2. **Convert:** `apps/web/src/app/api/admin/store-shapes/convert/route.ts`
   - Runs Python conversion script
   - Extracts metadata (units, scale factor)
   - Returns GeoJSON and metadata files

3. **Optimize:** `apps/web/src/app/api/admin/store-shapes/optimize/route.ts`
   - Runs Node.js optimization script
   - Simplifies coordinates
   - Preserves metadata through pipeline

4. **Insert:** `apps/web/src/app/api/admin/store-shapes/insert/route.ts`
   - Reads optimized GeoJSON and metadata
   - Inserts to `store_shapes` table via Supabase
   - Returns created record

### Navigation
- **Updated:** `apps/web/src/app/admin/page.tsx`
  - Added "Store Shapes Upload" button

---

## Technical Details

### Processing Pipeline

```
User uploads DXF file
     ↓
1. Upload API
   - Saves file to disk
   - Returns filename
     ↓
2. Convert API
   - Runs: python3 scripts/convert-dwg-to-geojson.py
   - Extracts: $INSUNITS metadata
   - Calculates: scale_factor
   - Outputs: .raw.geojson + .raw.metadata.json
     ↓
3. Optimize API
   - Runs: node scripts/optimize-store-shape.js
   - Simplifies: coordinates
   - Outputs: .optimized.geojson + .optimized.metadata.json
     ↓
4. Insert API
   - Reads: GeoJSON + metadata
   - Inserts: to store_shapes table
   - Returns: created record with ID
```

### File Flow

```
Input:  my-store.dxf
  ↓
Upload: 1234567890_my-store.dxf
  ↓
Convert:
  - 1234567890_my-store.raw.geojson
  - 1234567890_my-store.raw.metadata.json
  ↓
Optimize:
  - 1234567890_my-store.optimized.geojson
  - 1234567890_my-store.optimized.pretty.geojson
  - 1234567890_my-store.optimized.metadata.json
  ↓
Database:
  store_shapes table with metadata JSONB
```

### Metadata Stored in Database

```json
{
  "source_filename": "my-store.dxf",
  "source_units": "Millimeters",
  "insunits_code": 4,
  "scale_factor": 3.6111536144560183e-09,
  "conversion_method": "metadata",
  "target_width_meters": 60.0,
  "bbox": {
    "width": 149256.1,
    "height": 75291.97,
    "width_meters": 149.26,
    "height_meters": 75.29
  },
  "geojson_feature_count": 7,
  "optimized_feature_count": 7,
  "optimization_tolerance": 0.000001,
  "coordinate_reduction_percent": "0.0"
}
```

---

## Testing

### Test the Upload Flow

1. **Start Dev Server**
   ```bash
   npm run dev
   ```

2. **Navigate to Admin**
   ```
   http://localhost:3000/admin/store-shapes
   ```

3. **Upload Test File**
   - Use: `store-dwg-files/lidl_site.dxf`
   - Name: "Test Lidl Site"
   - Company: "Lidl"
   - Target Width: 60
   - Click "Process & Upload"

4. **Watch Progress**
   - Each step shows real-time status
   - Green checkmarks indicate success
   - Any errors show detailed messages

5. **Verify in SiteSketcher**
   - Go to `/sitesketcher`
   - Open "Store Shapes" section
   - Your shape should appear in the list
   - Click to place on map
   - Should appear at correct scale (~60m)

---

## Error Handling

The UI handles these scenarios:

1. **Wrong File Type**
   - Shows error if not .dxf
   - Prevents upload

2. **Missing Required Fields**
   - Validates before submission
   - Shows which fields are required

3. **Conversion Failure**
   - DXF parsing errors
   - Invalid unit metadata
   - Shows Python error output

4. **Optimization Failure**
   - Invalid GeoJSON
   - Shows Node.js error output

5. **Database Errors**
   - Connection issues
   - Constraint violations
   - Shows Supabase error message

---

## UI Features

### Form Validation
- Required fields marked with *
- File type validation
- Numeric validation for target width

### Progress Tracking
- 4-step visual progress bar
- Status icons for each step:
  - ⏳ Pending (gray)
  - 🔄 Processing (blue spinner)
  - ✓ Complete (green check)
  - ✗ Error (red X)

### Success State
- Shows created shape details
- Displays ID, name, company
- Shows scale factor
- "Upload Another" button

### Help Text
- "How It Works" card explains the pipeline
- Tooltips for target width
- Examples in descriptions

---

## Advantages Over CLI

### Before (CLI)
```bash
# Step 1: Upload file manually
cp ~/Downloads/store.dxf store-dwg-files/

# Step 2: Convert
python3 scripts/convert-dwg-to-geojson.py store-dwg-files/store.dxf --target-width 60

# Step 3: Optimize
node scripts/optimize-store-shape.js store-dwg-files/store.raw.geojson store-dwg-files/store.optimized.geojson

# Step 4: Insert
python3 scripts/insert-store-shape-with-metadata.py \
  store-dwg-files/store.optimized.geojson \
  --name "Store Name" \
  --company "Company" \
  --metadata store-dwg-files/store.optimized.metadata.json
```

### Now (Web UI)
1. Go to `/admin/store-shapes`
2. Upload file
3. Fill form
4. Click button
5. Done! ✨

---

## Future Enhancements

Possible additions:

1. **List View**
   - Show all uploaded shapes
   - Edit/delete functionality
   - Preview thumbnails

2. **Bulk Upload**
   - Upload multiple DXF files
   - Batch processing

3. **Preview Before Insert**
   - Show GeoJSON on map preview
   - Verify scale before saving

4. **File Management**
   - Clean up old files
   - Storage usage stats

5. **Conversion Settings**
   - Custom tolerance for optimization
   - Layer filtering options

---

## Troubleshooting

### "Module not found" errors
**Solution:** Install dependencies
```bash
pip3 install ezdxf requests
npm install
```

### "Permission denied" errors
**Solution:** Make scripts executable
```bash
chmod +x scripts/convert-dwg-to-geojson.py
chmod +x scripts/insert-store-shape-with-metadata.py
```

### "Supabase configuration missing"
**Solution:** Check environment variables in `apps/web/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Database errors
**Solution:** Ensure migration was run
```bash
# Check if metadata column exists
# Run: supabase/migrations/038_add_store_shapes_metadata.sql
```

---

## Complete! 🎉

You now have a **fully functional admin UI** for managing store shapes:

✅ Browser-based upload (no CLI needed)
✅ Automatic conversion & optimization
✅ Real-time progress feedback
✅ Metadata preservation
✅ Database integration
✅ Error handling
✅ Navigation from admin dashboard

**Ready to use!** Just navigate to `/admin/store-shapes` and start uploading.
