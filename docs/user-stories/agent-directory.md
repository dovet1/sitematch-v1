# User Story: Agent Directory Page (Phase 1 - Mobile-First)

## Epic
Platform Enhancement - Professional Services Directory

## Story Title
**As a** logged-in user  
**I want** to view a mobile-optimized directory of consultant agents with their associated listings  
**So that** I can discover and connect with professional consultants and their services through intuitive mobile interactions

## Background & Context
The platform needs an agent directory feature to showcase consultant users and their listings. This enhances the platform's value proposition by creating a professional network where users can discover consultants and their expertise through their listed properties. Phase 1 focuses on a mobile-first approach with enhanced touch interactions and progressive disclosure.

**Important**: Only consultants who have completed their professional profiles (via the dashboard profile completion card) will appear in the agent directory. This ensures high-quality, complete profiles and creates an opt-in system where motivated consultants showcase their services.

## Acceptance Criteria

### AC1: Mobile-Optimized Authentication & Access Control
- **Given** I am not logged in
- **When** I try to access the agent directory page
- **Then** I should see the AuthWall component (same as search page)
- **And** I should be redirected to the agent directory after successful authentication

### AC2: Navigation Integration
- **Given** I am viewing any page with the main header
- **When** I look at the navigation
- **Then** I should see "Find Consultants" link between "Post Requirement" and authentication section
- **And** the link should be accessible in both desktop and mobile hamburger menu
- **And** clicking should navigate to `/agents` route

### AC3: Mobile Card-Based Directory Display
- **Given** I am logged in on mobile
- **When** I navigate to the agent directory page
- **Then** I should see consultant profiles in mobile-optimized card format
- **And** only consultants with completed profiles (profile_completed = true) should be displayed
- **And** each card should be minimum 44px height with proper touch spacing
- **And** cards should display: profile photo, full name, company, job title, specializations, contact icons, listing count
- **And** I should be able to scroll through consultants with momentum scrolling

### AC4: Enhanced Mobile Touch Interactions
- **Given** I am viewing consultant cards on mobile
- **When** I swipe right on a card
- **Then** it should reveal a call action with the consultant's phone number and call icon
- **And** tapping should initiate a phone call with haptic feedback
- **When** I swipe left on a card
- **Then** it should reveal an email action with the consultant's professional email
- **And** tapping should open email client with pre-filled recipient
- **And** both swipe actions should auto-reset after 3 seconds if no action taken

### AC5: Pull-to-Refresh & Infinite Scroll
- **Given** I am viewing the agent directory on mobile
- **When** I pull down from the top
- **Then** the directory should refresh with updated consultant data
- **And** show a native-style refresh indicator
- **When** I scroll to the bottom
- **Then** more consultants should load automatically (20 per page)
- **And** show a loading indicator while fetching
- **And** handle end-of-results gracefully

### AC6: Bottom Sheet Consultant Details
- **Given** I tap on a consultant card
- **When** the detail view opens
- **Then** it should slide up as a bottom sheet modal with 300ms animation
- **And** show expanded profile information including:
  - Professional headshot (if provided)
  - Full name and job title
  - Company name and logo (if provided)
  - Professional bio (if provided)
  - Specializations and service areas
  - Years of experience
  - Contact information (phone, email, website, LinkedIn)
- **And** include prominent contact buttons (call, email, website) with haptic feedback
- **And** support swipe-down-to-close gesture
- **And** provide smooth backdrop dismissal

### AC7: Progressive Disclosure for Listings
- **Given** I am viewing consultant details with listings
- **When** the consultant has listings
- **Then** I should see listings as horizontally scrolling cards (280px wide)
- **And** each listing card should show: title, sector, status badge with color coding
- **And** I should be able to swipe through listings smoothly
- **And** tap any listing to view full details
- **When** the consultant has no listings
- **Then** I should see "No listings available" message

### AC8: Sticky Search & Filter Interface
- **Given** I am browsing the agent directory
- **When** I scroll through consultants
- **Then** the search/filter bar should remain sticky at the top
- **And** I should be able to search by name, company, specialization, or service area
- **And** apply filters by:
  - Specializations (Office, Retail, Industrial, etc.)
  - Service areas (geographic locations)
  - Years of experience ranges
  - Has active listings
- **And** clear all filters with single tap
- **And** see filter results update in real-time

### AC9: Floating Action Button
- **Given** I am viewing the agent directory
- **When** I want to quickly access actions
- **Then** I should see a floating action button (FAB) in bottom right
- **And** tapping should reveal quick actions: search, filter, contact support
- **And** the FAB should remain accessible while scrolling
- **And** include subtle shadow and scale animation on press

### AC10: Performance & Loading States
- **Given** the agent directory page is loading
- **When** data is being fetched
- **Then** I should see skeleton loading screens (not spinners)
- **And** images should load progressively with lazy loading
- **And** the page should handle empty states gracefully
- **And** error states should provide retry options
- **And** initial load should complete within 3 seconds

### AC11: Responsive Design Optimization
- **Given** I am using different screen sizes
- **When** I access the agent directory
- **Then** the layout should be optimized for mobile-first (320px+)
- **And** scale appropriately for tablet (768px+) and desktop (1024px+)
- **And** maintain consistent touch targets and spacing
- **And** ensure text remains readable across all devices

### AC12: Empty State Handling
- **Given** there are no consultants with completed profiles
- **When** I access the agent directory
- **Then** I should see an empty state message: "No consultants available yet"
- **And** include explanatory text: "Consultants will appear here once they complete their profiles"
- **And** provide a "Learn More" link about the consultant directory feature
- **Given** I am a consultant user viewing an empty directory
- **When** I see the empty state
- **Then** I should see an additional message: "Are you a consultant? Complete your profile to be listed here"
- **And** include a link to my dashboard to complete my profile

## Technical Requirements

### Database Queries
```sql
-- Optimized consultant directory query (only completed profiles)
SELECT 
  u.id, u.email, u.created_at,
  cp.full_name, cp.job_title, cp.company_name, cp.professional_bio,
  cp.phone_number, cp.company_website, cp.linkedin_url,
  cp.headshot_url, cp.company_logo_url, cp.years_experience,
  cp.specializations, cp.service_areas, cp.primary_services,
  COUNT(l.id) as listing_count,
  COUNT(CASE WHEN l.status = 'approved' THEN 1 END) as approved_count
FROM users u
INNER JOIN consultant_profiles cp ON u.id = cp.user_id
LEFT JOIN listings l ON u.id = l.created_by
WHERE u.user_type = 'Consultant' 
  AND cp.profile_completed = true
GROUP BY u.id, cp.id
ORDER BY approved_count DESC, cp.created_at DESC
LIMIT 20 OFFSET ?;

-- Individual consultant detail query
SELECT 
  u.id, u.email, u.created_at,
  cp.full_name, cp.job_title, cp.company_name, cp.professional_bio,
  cp.phone_number, cp.company_website, cp.linkedin_url,
  cp.headshot_url, cp.company_logo_url, cp.years_experience,
  cp.specializations, cp.service_areas, cp.primary_services
FROM users u
INNER JOIN consultant_profiles cp ON u.id = cp.user_id
WHERE u.id = ? AND cp.profile_completed = true;
```

### Route Structure
- `/agents` - Main directory page
- `/agents/[id]` - Individual consultant detail pages

### Component Architecture
```typescript
AgentDirectoryPage
  ├── MobileSearchBar (sticky)
  ├── ConsultantCardList (infinite scroll)
  ├── PullToRefresh wrapper
  └── FloatingActionButton

ConsultantCard
  ├── SwipeableCard container
  ├── ContactRevealActions
  └── CardContent

ConsultantDetailModal
  ├── BottomSheet container
  ├── DragHandle
  ├── ConsultantProfile
  └── HorizontalListingScroll
```

### Mobile-Specific Libraries
- `react-spring` - Smooth animations
- `react-use-gesture` - Swipe gestures
- `react-intersection-observer` - Infinite scroll
- `react-draggable` - Bottom sheet interactions

### Authentication Pattern
- Follow same pattern as search page:
  - Client-side auth check using `useAuth()` hook
  - Display `AuthWall` component for unauthenticated users
  - Show full directory for authenticated users

### Performance Optimizations
- Lazy loading for consultant images
- React Query for data caching (5-minute stale time)
- Virtualization for large consultant lists
- Progressive image loading
- Skeleton screens for loading states

## Definition of Done

### Core Functionality
- [ ] `/agents` route accessible with authentication protection
- [ ] "Find Consultants" link added to main navigation
- [ ] Mobile-optimized card layout for consultant profiles
- [ ] All consultants (user_type = 'Consultant') displayed with pagination
- [ ] Consultant profiles show required information

### Mobile Interactions
- [ ] Swipe gestures implemented for call/email actions
- [ ] Pull-to-refresh functionality working
- [ ] Infinite scroll with loading states
- [ ] Bottom sheet modal for consultant details
- [ ] Floating action button with quick actions
- [ ] Haptic feedback for touch interactions

### Technical Implementation
- [ ] Responsive design for mobile, tablet, and desktop
- [ ] Loading states and error handling implemented
- [ ] SEO meta tags and accessibility features
- [ ] Database queries optimized for performance
- [ ] Component unit tests written
- [ ] Integration tests for data fetching
- [ ] Performance testing with large datasets

### Quality Assurance
- [ ] Cross-browser testing (Safari, Chrome, Firefox)
- [ ] iOS and Android mobile testing
- [ ] Accessibility compliance (WCAG 2.1 AA)
- [ ] Performance benchmarks met (< 3s initial load)
- [ ] Usability testing completed

## Dependencies
- **Consultant profile completion feature** (prerequisite - must be implemented first)
- Existing user authentication system
- Users table with user_type field
- Consultant_profiles table with completed profiles
- Listings table with created_by relationship
- AuthWall component
- useAuth hook and AuthContext
- Header component for navigation integration
- Image upload system for profile photos and logos

## Priority
**High** - Core platform feature for professional networking

## Estimate
**13 Story Points** (Large - requires new page, mobile interactions, API integration, and comprehensive testing)

## Success Metrics
- **< 3 seconds** time to first consultant display
- **> 80%** mobile user engagement (vs desktop)
- **< 2 taps** average path to contact consultant
- **> 90%** swipe gesture success rate
- **< 1 second** response time for card interactions

## Future Enhancements (Phase 2)
- Advanced filtering and sorting options (by experience, ratings, etc.)
- In-platform messaging system
- Consultant ratings and reviews from clients
- Location-based recommendations and mapping
- Verification badges and trust signals
- Portfolio/case study integration
- Integration with professional networks (LinkedIn, etc.)
- Analytics for consultant profile views and engagement