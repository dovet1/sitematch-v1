# Tasks / Subtasks

- [ ] Task 0: Database Schema Implementation (AC: 1, 8)
  - [ ] Create `listings` table with all required fields and constraints
  - [ ] Create `listing_locations` table for multi-location support
  - [ ] Create `faqs` table for listing-specific Q&A
  - [ ] Create `media_files` table for brochure and image management
  - [ ] Implement RLS policies for organization-scoped access
  - [ ] Create Supabase migration file (005_create_listings_tables.sql)
  - [ ] Verify table creation and relationships in Supabase dashboard

- [ ] Task 1: File Upload System Setup (AC: 6)
  - [ ] Configure Supabase Storage bucket for brochure uploads
  - [ ] Implement storage security policies for authenticated uploads
  - [ ] Create file upload utility functions with validation
  - [ ] Add PDF mime type validation and file size limits
  - [ ] Test file upload flow with error handling

- [ ] Task 2: Mapbox Integration Setup (AC: 5)
  - [ ] Configure Mapbox Places API integration
  - [ ] Create location search utility functions
  - [ ] Implement location autocomplete component
  - [ ] Add UK/Ireland geographic boundary filtering
  - [ ] Test location search and selection flow

- [ ] Task 3: Create Listing Wizard Components (AC: 2, 3, 4)
  - [ ] Build ListingWizard container component with step management
  - [ ] Create Step 1: Company Information form with brochure upload
  - [ ] Create Step 2: Requirement Details form with location search
  - [ ] Implement wizard navigation with progress indicator
  - [ ] Style components according to project TailwindCSS standards

- [ ] Task 4: Form State Management (AC: 7)
  - [ ] Implement React Hook Form for multi-step wizard
  - [ ] Add comprehensive form validation rules
  - [ ] Implement data persistence between wizard steps
  - [ ] Handle form errors and loading states
  - [ ] Add form auto-save functionality (localStorage backup)

- [ ] Task 5: Listing Creation API (AC: 1, 8)
  - [ ] Build Next.js route handler at `/api/listings`
  - [ ] Integrate with Supabase to insert listing data
  - [ ] Implement file upload processing and storage
  - [ ] Set listings to "pending" status for admin approval
  - [ ] Add proper validation and error responses

- [ ] Task 6: Protected Route Implementation (AC: 9)
  - [ ] Create `/occupier/create-listing` protected route
  - [ ] Implement occupier role-based access control
  - [ ] Add authentication guards and redirects
  - [ ] Create occupier dashboard navigation
  - [ ] Handle unauthorized access scenarios

- [ ] Task 7: Responsive Design Implementation (AC: 10)
  - [ ] Optimize wizard layout for mobile devices
  - [ ] Implement responsive file upload component
  - [ ] Test wizard flow across different screen sizes
  - [ ] Ensure touch-friendly navigation and form inputs
  - [ ] Verify accessibility standards compliance

- [ ] Task 8: Integration Testing & Error Handling
  - [ ] Unit tests for listing creation logic and validation
  - [ ] Integration tests for API endpoints with database
  - [ ] E2E tests for complete wizard flow including file upload
  - [ ] Error scenario testing (network failures, validation errors)
  - [ ] Performance testing for large file uploads
