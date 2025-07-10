# User Story: New Search Flow with Dedicated Search Page

## Story Details
- **Story ID:** SEARCH-001
- **Priority:** High
- **Estimated Points:** 8
- **Sprint:** TBD

## User Story
**As a** platform user  
**I want to** search for listings through a dedicated search page  
**So that** I have a clear and focused search experience after selecting my search criteria

## Background
Currently, the homepage combines search input, filtering, and results display all on one page. This can be confusing for users as it's not clear when they've initiated a search action. By moving results to a dedicated search page, we create a clearer user journey.

## Acceptance Criteria

### 1. Homepage Modifications
- [x] Location search bar remains visible in the HeroSearch component
- [x] Add "Search Nationwide" button/option prominently next to the location search
- [x] Remove the filter button from the homepage
- [x] Remove the listing grid (ListingGrid component) from the homepage
- [x] Remove the map/list view toggle from the homepage
- [x] Keep the hero section with stats (1,200+ Requirements, etc.)

### 2. Search Initiation
- [x] When user selects a location from autocomplete dropdown:
  - Navigate to `/search?location={locationName}&lat={latitude}&lng={longitude}`
- [x] When user clicks "Search Nationwide" button:
  - Navigate to `/search?nationwide=true`
- [x] Search page opens as a new route (not a modal)
- [x] Browser back button returns to homepage

### 3. Search Page Implementation (`/search`)
- [x] Create new page component at `/apps/web/src/app/search/page.tsx`
- [x] **Sticky Search Header** (remains visible on scroll):
  - LocationSearch component with pre-populated location/nationwide indicator
  - Filter button positioned next to location search
  - Maintains position: `sticky top-0 z-30` with backdrop blur
  - On mobile: Compact view with search icon expanding to full search
- [x] Active filters displayed as badges below sticky header
- [x] **List/Map View Toggle**:
  - Position above results grid (below filters)
  - Preserve existing toggle functionality from homepage
  - Include in URL params: `view=list` or `view=map`
  - Default to list view
- [x] ListingGrid component shows filtered results
- [x] Map view component (when toggled)
- [x] Show loading skeleton during data fetch
- [x] Display "No listings found" message when no results match
- [x] **Mobile Responsive Design**:
  - Search bar: Full width on mobile, inline on desktop
  - Filter button: Icon-only on mobile with count badge
  - Toggle: Prominent position on mobile for easy thumb access
  - Results: Single column on mobile, grid on tablet+
  - Sticky header: Reduced height on mobile to maximize content area

### 4. Technical Requirements
- [x] URL parameters must reflect all search state:
  - `location`, `lat`, `lng` for location-based search
  - `nationwide=true` for nationwide search
  - `sectors[]` for selected sectors
  - `useClasses[]` for selected use classes
  - `minSize`, `maxSize` for size range
  - `companyName` for company search
  - `view` for list/map toggle
- [x] Implement proper data fetching on search page
  - Use existing `/api/public/listings` endpoint
  - Pass URL parameters as query filters
- [x] Maintain filter state in URL for shareable searches
- [x] Ensure smooth navigation between pages
- [x] Preserve all existing component functionality

### 5. Search Page Layout Structure
```
[Sticky Header - remains visible on scroll]
├── Search Bar | Filter Button | (Nationwide indicator if applicable)
└── Active Filter Badges (if any)

[Content Area]
├── Results Summary (e.g., "247 requirements in London")
├── List/Map Toggle (right aligned)
├── Results Display
│   ├── List View: Grid of ListingCards
│   └── Map View: Interactive map with markers
└── Pagination or Load More

[Mobile Layout]
├── Compact sticky header with expandable search
├── Filter button shows count only
├── Toggle buttons stacked/prominent
└── Single column results
```

### 6. User Flow
1. User lands on homepage
2. User either:
   - Types and selects a location from autocomplete
   - Clicks "Search Nationwide" button
3. Browser navigates to `/search` with appropriate parameters
4. Search page loads with results based on selection
5. User can refine search using filters
6. User can toggle between list and map view
7. User can click listing cards to view details in modal
8. Search bar remains accessible during scrolling for new searches

## Dependencies
- Existing components: HeroSearch, LocationSearch, FilterDrawer, ListingGrid, ListingCard
- API endpoint: `/api/public/listings`
- Reference data endpoint: `/api/public/reference-data`

## Definition of Done
- [x] Homepage only shows location search without results
- [x] Search page fully functional with all filtering capabilities
- [x] URL parameters correctly reflect and restore search state
- [x] Smooth navigation between homepage and search page
- [x] All existing features work correctly on new search page
- [x] Responsive design maintained on all screen sizes
- [x] Page performance metrics maintained (< 3s load time)
- [x] Accessibility standards met (WCAG 2.1 AA)
- [x] Unit tests written for new search page logic
- [ ] E2E tests cover the new user flow

## Technical Implementation Details

### Sticky Header Implementation
```tsx
// Desktop: Full search bar visible
<header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b">
  <div className="container mx-auto px-4 py-3">
    <div className="flex gap-4">
      <LocationSearch className="flex-1" />
      <Button variant="outline" onClick={openFilters}>
        <Filter /> Filters {activeCount > 0 && <Badge>{activeCount}</Badge>}
      </Button>
    </div>
    {/* Active filters badges */}
  </div>
</header>

// Mobile: Collapsible search
<header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b md:hidden">
  <div className="flex items-center gap-2 p-3">
    <Button size="sm" onClick={toggleSearch}>
      <Search />
    </Button>
    <span className="text-sm truncate">{location || "Nationwide"}</span>
    <Button size="sm" variant="outline" onClick={openFilters}>
      <Filter /> {activeCount > 0 && <Badge>{activeCount}</Badge>}
    </Button>
  </div>
</header>
```

### Mobile Responsive Breakpoints
- **Mobile** (< 640px): Single column, compact header, bottom sheet filters
- **Tablet** (640px - 1024px): 2-column grid, full header
- **Desktop** (> 1024px): 3-4 column grid, full features

---

## Dev Agent Record

### Completion Notes
- Successfully implemented all acceptance criteria
- Added mobile-responsive design with expandable search on mobile
- Implemented proper URL parameter handling for shareable searches
- Created comprehensive test coverage for search flow
- Maintained existing design system consistency

### File List
- **Modified**: `/apps/web/src/components/search/HeroSearch.tsx` - Added nationwide button, removed filter button, added navigation
- **Modified**: `/apps/web/src/app/page.tsx` - Removed listing grid, map toggle, and filter drawer
- **Created**: `/apps/web/src/app/search/page.tsx` - New search page with sticky header and full functionality
- **Created**: `/apps/web/src/components/search/__tests__/search-flow.test.tsx` - Unit tests for search flow
- **Created**: `/apps/web/src/app/search/__tests__/page.test.tsx` - Unit tests for search page

### Change Log
- Modified HeroSearch interface to make props optional since no longer needs filter handlers
- Added proper TypeScript typing for all search parameters
- Implemented Suspense wrapper for search page to handle SSR properly

## Notes
- Consider implementing search history in future iteration
- May want to add "Recent Searches" on homepage in future
- Monitor user behavior to see if nationwide search needs more prominence
- Sticky header scroll behavior: Consider hiding on scroll down, showing on scroll up for mobile
- Performance: Implement virtual scrolling for large result sets
- E2E tests still needed to complete full DoD