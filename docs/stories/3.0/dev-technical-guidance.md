# Dev Technical Guidance

## Previous Story Dependencies
**Required Completed Stories**:
- **Story 1.0** (Project Bootstrap) - for complete development environment
- **Story 2.0** (User Authentication) - for occupier role authentication and protected routes
- **Story 2.1** (Lead Capture) - for established patterns and database structure

## Data Models

**Core Listings Schema** [Source: architecture/3-domain-model-er-excerpt.md]:
```sql
listings (
  id PK, 
  org_id FK, 
  title, 
  description, 
  sector, 
  use_class, 
  site_size_min, 
  site_size_max, 
  brochure_url, 
  status {draft|pending|approved|rejected}, 
  created_at, 
  updated_at
)

listing_locations (
  id PK, 
  listing_id FK, 
  location_name, 
  location_type {preferred|acceptable}, 
  coordinates
)

faqs (
  id PK, 
  listing_id FK, 
  question, 
  answer, 
  order_index
)

media_files (
  id PK, 
  listing_id FK, 
  file_type {brochure|image}, 
  file_url, 
  file_name, 
  file_size
)
```

## Database Schema Requirements

**Complete Listings Schema SQL**:
```sql
-- Listings table
CREATE TABLE public.listings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES public.organisations(id) NOT NULL,
  title text NOT NULL,
  description text,
  sector text NOT NULL CHECK (sector IN ('retail', 'office', 'industrial', 'leisure', 'mixed')),
  use_class text NOT NULL,
  site_size_min integer, -- square feet
  site_size_max integer, -- square feet
  brochure_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Listing locations table
CREATE TABLE public.listing_locations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  location_name text NOT NULL,
  location_type text NOT NULL CHECK (location_type IN ('preferred', 'acceptable')),
  coordinates jsonb, -- Store lat/lng from Mapbox
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- FAQs table
CREATE TABLE public.faqs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Media files table
CREATE TABLE public.media_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('brochure', 'image')),
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size integer NOT NULL, -- bytes
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Listings
-- Occupiers can only see their own org's listings
CREATE POLICY "Occupiers can view own org listings" ON public.listings
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Occupiers can create listings for their org
CREATE POLICY "Occupiers can create listings" ON public.listings
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.users WHERE id = auth.uid() AND role = 'occupier'
    )
  );

-- Occupiers can update their own org's listings
CREATE POLICY "Occupiers can update own org listings" ON public.listings
  FOR UPDATE USING (
    org_id IN (
      SELECT org_id FROM public.users WHERE id = auth.uid() AND role = 'occupier'
    )
  );

-- Admins can view all listings
CREATE POLICY "Admins can view all listings" ON public.listings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Public can view approved listings
CREATE POLICY "Public can view approved listings" ON public.listings
  FOR SELECT TO anon
  USING (status = 'approved');

-- Similar policies for related tables...
-- (listing_locations, faqs, media_files inherit from listings via foreign key)
```

**Migration File Location**: `/supabase/migrations/005_create_listings_tables.sql`

## Wizard Form Specifications

**Step 1: Company Information** [Source: architecture/1-prd.md]:
- Company Name (text, required)
- Company Description (textarea, optional)
- Brochure Upload (PDF file, required, max 10MB)
- Contact Email (email, pre-filled from auth, read-only)
- Contact Phone (text, optional)

**Step 2: Requirement Details** [Source: architecture/1-prd.md]:
- Listing Title (text, required)
- Sector Selection (radio: retail, office, industrial, leisure, mixed)
- Use Class (text, required)
- Location Search (Mapbox autocomplete, multiple selections)
- Site Size Range (dual slider: min/max square feet)
- Additional Requirements (textarea, optional)

## Mapbox Integration Requirements

**Environment Variables Required**:
- `NEXT_PUBLIC_MAPBOX_TOKEN` - Mapbox public API token for client-side requests

**Places API Integration Pattern**:
```typescript
// /apps/web/src/lib/mapbox.ts
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export async function searchLocations(query: string) {
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
    `access_token=${MAPBOX_TOKEN}&` +
    `country=GB,IE&` +
    `types=place,locality,neighborhood&` +
    `limit=5`
  );
  return response.json();
}

export interface LocationResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  place_type: string[];
}
```

## File Upload System Requirements

**Supabase Storage Configuration**:
```sql
-- Create storage bucket for brochures
INSERT INTO storage.buckets (id, name, public) VALUES ('brochures', 'brochures', false);

-- Storage policies
CREATE POLICY "Authenticated users can upload brochures" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brochures');

CREATE POLICY "Users can view own org brochures" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'brochures');
```

**File Upload Utility Pattern**:
```typescript
// /apps/web/src/lib/file-upload.ts
export async function uploadBrochure(file: File, listingId: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${listingId}/brochure.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from('brochures')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });
    
  if (error) throw error;
  return data.path;
}
```

## Component Architecture

**Wizard Component Structure**:
```
ListingWizard (container)
├── WizardProgress (step indicator)
├── Step1CompanyInfo
│   ├── CompanyDetailsForm
│   └── BrochureUpload
└── Step2RequirementDetails
    ├── ListingDetailsForm
    ├── LocationSearch
    └── SizeRangeSlider
```

## API Specifications

**Listing Creation Endpoint**:
- **POST** `/api/listings` - Create new listing
- Request body: Complete listing data with file upload handling
- Response: `{ success: boolean, listingId?: string, error?: string }`

**File Upload Endpoint**:
- **POST** `/api/listings/upload` - Handle brochure upload
- Multipart form data with file validation
- Response: `{ success: boolean, fileUrl?: string, error?: string }`

## File Locations

Based on project structure [Source: source-tree.md]:
- **Database Migration**: `/supabase/migrations/005_create_listings_tables.sql`
- **Storage Policies**: `/supabase/migrations/006_storage_policies.sql`
- **Wizard Component**: `/apps/web/src/components/listings/listing-wizard.tsx`
- **Wizard Steps**: `/apps/web/src/components/listings/steps/`
- **Location Search**: `/apps/web/src/components/listings/location-search.tsx`
- **File Upload**: `/apps/web/src/components/listings/brochure-upload.tsx`
- **API Routes**: `/apps/web/src/app/api/listings/`
- **Protected Page**: `/apps/web/src/app/occupier/create-listing/page.tsx`
- **Utilities**: `/apps/web/src/lib/listings.ts`
- **Types**: `/apps/web/src/types/listings.ts`
- **Mapbox Utils**: `/apps/web/src/lib/mapbox.ts`

## Testing Requirements

**Testing Strategy** [Source: architecture/coding-standards.md]:
- **Jest** for unit testing wizard logic and validation
- **Playwright** for E2E testing complete wizard flow
- **File upload testing** with mock files and error scenarios
- **API integration testing** with database operations

## Technical Constraints

- **Occupier Role Access**: Only authenticated occupiers can create listings
- **Organization Scoping**: Listings belong to occupier's organization
- **File Size Limits**: PDF uploads limited to 10MB
- **Geographic Scope**: Location search limited to UK and Ireland
- **Admin Approval**: All listings start in "pending" status
- **Row Level Security**: Proper RLS policies for multi-tenant data access

## Testing

Dev Note: Story Requires the following tests:

- [ ] Jest Unit Tests: (nextToFile: true), coverage requirement: 80%
- [ ] Jest Integration Tests: location: `/apps/web/src/app/api/listings/route.test.ts`
- [ ] Playwright E2E: location: `/e2e/listing-creation.spec.ts`
- [ ] File Upload Tests: location: `/e2e/file-upload.spec.ts`

Manual Test Steps:
- Login as occupier and access create listing page
- Complete Step 1 with company info and brochure upload
- Navigate to Step 2 and complete requirement details
- Test location search with various UK/Ireland locations
- Submit complete wizard and verify listing created in "pending" status
- Test form validation and error handling
- Test wizard navigation (back/forward between steps)
- Verify file upload size limits and format validation
