# Listing Flow Redesign - Immediate Creation with Progressive Enhancement Product Requirements Document (PRD)

## Goals and Background Context

### Goals

- Transform the multi-step wizard flow into an immediate listing creation experience that shows users their listing after step 1
- Implement progressive enhancement where users can complete their listing sections directly on the listing detail page
- Provide auto-save functionality for all listing updates to minimize data loss
- Create a more intuitive and LinkedIn-like experience where users see their work immediately and can enhance it progressively
- Maintain all existing functionality while improving user experience and reducing abandonment

### Background Context

The current listing creation system uses a traditional 6-step wizard approach where users must complete all steps before seeing their final listing. This creates friction and potential abandonment points, especially for users who want to quickly create a basic listing and enhance it later. Modern platforms like LinkedIn allow users to create profiles quickly and then progressively enhance them with additional information.

The existing system has robust infrastructure including draft listings, auto-save, file uploads, and comprehensive validation. The challenge is to restructure the user experience while leveraging this existing foundation to create a more engaging and user-friendly creation flow.

### Change Log

| Date | Version | Description | Author |
| :--- | :------ | :---------- | :----- |
| 2025-01-04 | 1.0 | Initial PRD creation for listing flow redesign | Sarah (PO) |
| 2025-01-04 | 1.1 | Added FR10 (add/edit capabilities), FR11 (admin approval logic), FR12 (wizard access) | Sarah (PO) |
| 2025-01-04 | 1.2 | Added FR13 (listing preview) and Story 4.4 for preview functionality | Sarah (PO) |

## Requirements

### Functional

- FR1: Users must be able to create a basic listing with just step 1 information (company name, listing type, primary contact)
- FR2: After step 1 completion, users must immediately see their listing detail page populated with entered information
- FR3: Each section on the listing detail page must show either populated content or an empty state with "Add information" prompts
- FR4: Users must be able to edit any section directly on the listing detail page without returning to wizard steps
- FR5: All changes made on the listing detail page must auto-save within 2 seconds
- FR6: Users must be able to submit their listing for admin review at any point after initial creation
- FR7: The system must maintain all existing functionality including file uploads, multiple contacts, FAQs, and location selection
- FR8: The listing must maintain draft status until explicitly submitted for review
- FR9: Loading screens must be shown during listing creation and major operations
- FR10: Users must be able to add/edit information in each section. For example in the contacts section, the user should be able to add a new contact or edit an existing one directly in the listing detail view
- FR11: Admin approval logic: If a user has already submitted a listing for review and the reviewer has not approved/rejected it yet, the admin will only see the most recently submitted version of the draft listing. Making edits to an already approved listing will not remove the existing version of the listing that is live on the site and the live version will only be updated once the admin has approved a new version of the listing
- FR12: Users must be able to access the traditional step-by-step wizard if they prefer that approach
- FR13: Users must be able to preview how their listing will appear to potential inquirers before submitting for review 

### Non Functional

- NFR1: Page load times for the listing detail page must not exceed 2 seconds
- NFR2: Auto-save operations must not interfere with user typing or form interactions
- NFR3: The system must handle concurrent edits if multiple browser tabs are open
- NFR4: All existing security and authorization patterns must be maintained
- NFR5: The system must be fully responsive and work on mobile devices
- NFR6: Database performance must not degrade with the new editing patterns
- NFR7: All existing accessibility standards (WCAG 2.1 AA) must be maintained

## User Interface Design Goals

### Overall UX Vision

Create a modern, progressive enhancement experience similar to LinkedIn profile creation where users see immediate results and can continuously improve their listing. The interface should feel seamless and encourage completion through visual progress indicators and contextual prompts.

### Key Interaction Paradigms

- **Immediate Gratification**: Users see their listing populated immediately after basic information entry
- **Progressive Enhancement**: Empty states guide users to add more information section by section
- **In-Place Editing**: All sections can be edited directly without modal dialogs or separate pages
- **Auto-Save Feedback**: Clear visual indicators show when changes are being saved
- **Flexible Flow**: Users can complete sections in any order based on their preferences

### Core Screens and Views

- **Step 1 Creation Form**: Streamlined first step with clear "Create Listing" call-to-action
- **Loading/Creation Screen**: Engaging loading experience during listing creation
- **Listing Detail Page**: Main hub showing all listing sections with editing capabilities
- **Section Edit Overlays**: In-line editing for each section type (contacts, FAQs, documents, etc.)
- **Progress Dashboard**: Visual representation of listing completion status
- **Listing Preview Interface**: Public-facing view of the listing for user review
- **Submit for Review Interface**: Clear pathway to submit completed listing

### Accessibility: WCAG 2.1 AA

All interfaces must maintain existing accessibility standards with proper ARIA labels, keyboard navigation, and screen reader support for the new editing paradigms.

### Branding

Must follow existing SiteMatch branding patterns including the violet-bloom design system, consistent typography, and existing interaction patterns.

### Target Device and Platforms

Web Responsive (Desktop, Tablet, Mobile) with optimized mobile experience for on-the-go listing updates.

## Technical Assumptions

### Repository Structure: Monorepo

Continue using the existing Next.js monorepo structure under `apps/web/` with shared components and utilities.

### Service Architecture

Leverage existing Next.js with Supabase backend architecture. New functionality will integrate with existing patterns including:
- Server actions for data mutations
- Client-side state management with React
- Supabase real-time subscriptions for auto-save
- Existing file upload infrastructure

### Testing Requirements

- Unit tests for new components and utilities
- Integration tests for auto-save functionality
- E2E tests for the complete new user flow
- Regression tests to ensure existing functionality remains intact

### Additional Technical Assumptions and Requests

- Utilize existing TypeScript definitions and extend as needed
- Leverage existing Supabase database schema with minimal additions
- Integrate with existing authentication and authorization patterns
- Use existing UI component library and design system
- Implement real-time updates using Supabase subscriptions
- Maintain existing file upload and processing pipelines

## Epics

- Epic 1: Foundation & Immediate Creation Experience - Establish the core immediate listing creation flow after step 1
- Epic 2: Progressive Enhancement Interface - Create the listing detail page with editable sections and empty states
- Epic 3: Auto-Save & Real-Time Updates - Implement seamless auto-save functionality across all sections
- Epic 4: Advanced Section Management - Enable complex section editing, preview functionality, and complete feature set including files, contacts, and FAQs

## Epic 1: Foundation & Immediate Creation Experience

Transform the existing step 1 wizard into an immediate listing creation experience that creates a draft listing and shows users their populated listing detail page. This epic establishes the core flow change while maintaining all existing functionality.

### Story 1.1: Streamlined Step 1 with Immediate Creation

As an occupier user,
I want to complete step 1 and immediately see my listing created and displayed,
so that I get instant gratification and can see my progress immediately.

#### Acceptance Criteria

1. Step 1 form maintains all existing fields (company name, listing type, primary contact, logo options, brochure, property page link)
2. "Continue to Step 2" button is replaced with "Create My Listing" primary action button
3. Clicking "Create My Listing" shows a loading screen with progress indicators
4. A draft listing is created in the database with step 1 information
5. User is redirected to the new listing detail page showing populated information
6. Loading screen includes engaging copy about creating the listing
7. Error handling provides clear feedback if creation fails
8. All existing validation rules for step 1 remain in place

### Story 1.2: Basic Listing Detail Page Display

As an occupier user,
I want to see my newly created listing with all the information I entered displayed properly,
so that I can immediately see the result of my work and understand what my listing looks like.

#### Acceptance Criteria

1. Listing detail page displays company name, listing type, and primary contact information
2. Logo is displayed using existing Clearbit or uploaded image patterns
3. Brochure files are displayed with download links if uploaded
4. Property page link is displayed as a clickable link if provided
5. All sections not yet completed show empty state placeholders
6. Page includes a "Submit for Review" button prominently displayed
7. Page is fully responsive and follows existing design patterns
8. Loading states are shown while fetching listing data

### Story 1.3: Basic Empty States for Incomplete Sections

As an occupier user,
I want to see clear prompts for sections I haven't completed yet,
so that I understand what else I can add to improve my listing.

#### Acceptance Criteria

1. Requirement Details section shows "Add your property requirements" empty state
2. Locations section shows "Add your preferred locations" empty state
3. Additional Contacts section shows "Add team members" empty state
4. FAQs section shows "Add frequently asked questions" empty state
5. Supporting Documents section shows "Add site plans and fit-out examples" empty state
6. Each empty state includes a clear "Add Information" button
7. Empty states include brief descriptions of what information goes in each section
8. Visual design matches existing SiteMatch patterns

## Epic 2: Progressive Enhancement Interface

Create comprehensive editable sections on the listing detail page that allow users to complete their listing without returning to the wizard. Each section should provide intuitive editing capabilities with proper validation and user feedback.

### Story 2.1: Requirement Details Section Editing

As an occupier user,
I want to add and edit my property requirements directly on the listing detail page,
so that I can complete this section without navigating away.

#### Acceptance Criteria

1. Empty state shows "Add your property requirements" with descriptive text
2. "Add Information" button opens in-line editing interface
3. Editing interface includes sectors multi-select with existing options
4. Editing interface includes use classes multi-select with existing options
5. Site size range inputs with min/max sliders (for commercial)
6. Residential-specific fields (dwelling count, site acreage) when listing type is residential
7. "Save" and "Cancel" buttons with proper state management
8. Changes are validated using existing business rules
9. Successfully saved information is displayed in read mode with "Edit" option

### Story 2.2: Locations Section Management

As an occupier user,
I want to add and manage my preferred locations directly on the listing detail page,
so that I can specify where I'm looking for properties.

#### Acceptance Criteria

1. Empty state shows "Add your preferred locations" with location search preview
2. "Add Information" button opens location management interface
3. Interface includes nationwide toggle option
4. When not nationwide, includes location search using existing Mapbox integration
5. Selected locations are displayed with remove options
6. Location search follows existing UX patterns and validation
7. Changes are saved immediately upon selection/removal
8. Proper error handling for location search failures

### Story 2.3: Additional Contacts Section Management

As an occupier user,
I want to add and edit team members and contacts directly on the listing detail page,
so that I can showcase my team and update their information without complex navigation.

#### Acceptance Criteria

1. Empty state shows "Add team members" with contact preview
2. "Add Information" button opens contact addition interface
3. Each contact form includes all existing fields (name, title, email, phone, area)
4. Headshot upload functionality using existing file upload patterns
5. Multiple contacts can be added with individual edit/remove options
6. Each existing contact displays an "Edit" button for in-place editing
7. Contact validation follows existing business rules
8. Contacts are displayed in a visually appealing grid layout
9. Primary contact (from step 1) is clearly distinguished from additional contacts
10. Changes to existing contacts auto-save following the same patterns as new additions

### Story 2.4: FAQs Section Management

As an occupier user,
I want to add frequently asked questions directly on the listing detail page,
so that I can provide helpful information to potential inquirers.

#### Acceptance Criteria

1. Empty state shows "Add frequently asked questions" with FAQ preview
2. "Add Information" button opens FAQ creation interface
3. Each FAQ includes question and answer text areas with character limits
4. FAQs can be reordered using drag-and-drop or up/down buttons
5. Individual FAQs can be edited or removed
6. FAQ validation ensures both question and answer are provided
7. FAQs are displayed in an accordion or expandable format
8. Display order is maintained and saved properly

## Epic 3: Auto-Save & Real-Time Updates

Implement seamless auto-save functionality that ensures users never lose their work while providing clear feedback about save status. This epic focuses on the technical infrastructure for real-time updates and conflict resolution.

### Story 3.1: Auto-Save Infrastructure

As an occupier user,
I want my changes to be automatically saved as I work,
so that I never lose my progress even if I accidentally close the browser.

#### Acceptance Criteria

1. All form changes trigger auto-save after 2 seconds of inactivity
2. Auto-save uses existing draft listing infrastructure
3. Save status indicator shows "Saving...", "Saved", or "Save failed" states
4. Failed saves retry automatically with exponential backoff
5. Users receive clear error messages for persistent save failures
6. Auto-save works for all section types (text, files, selections)
7. Performance monitoring ensures auto-save doesn't impact user experience
8. Save operations are debounced to prevent excessive API calls

### Story 3.2: Real-Time Status Updates

As an occupier user,
I want to see real-time feedback about my listing's save status,
so that I have confidence my work is being preserved.

#### Acceptance Criteria

1. Global save status indicator is visible at all times
2. Status indicator shows different states: idle, saving, saved, error
3. Timestamp shows when listing was last saved successfully
4. Error states provide actionable feedback and retry options
5. Status indicator uses existing design system components
6. Mobile-optimized status display that doesn't interfere with editing
7. Status persists across page refreshes using localStorage backup
8. Clear visual feedback for users with slow connections

### Story 3.3: Conflict Resolution for Multiple Tabs

As an occupier user,
I want the system to handle gracefully if I have multiple browser tabs open with the same listing,
so that I don't accidentally overwrite my own work.

#### Acceptance Criteria

1. System detects when the same listing is open in multiple tabs
2. Warning message appears when potential conflicts are detected
3. Users can choose to continue editing or refresh to get latest changes
4. Last-write-wins strategy with user confirmation for conflicts
5. Supabase real-time subscriptions notify tabs of external changes
6. Graceful handling of network interruptions and reconnections
7. Clear messaging about which tab has the most recent changes
8. Option to merge changes when possible

## Epic 4: Advanced Section Management

Implement sophisticated editing capabilities for complex sections including file uploads, document management, and advanced form handling. This epic completes the feature set by enabling full wizard functionality within the detail page interface.

### Story 4.1: Supporting Documents Section Management

As an occupier user,
I want to upload and manage site plans and fit-out examples directly on the listing detail page,
so that I can showcase my property requirements visually.

#### Acceptance Criteria

1. Empty state shows "Add site plans and fit-out examples" with upload preview
2. "Add Information" button opens file upload interface
3. Separate upload areas for site plans and fit-out files
4. File upload uses existing Supabase storage infrastructure
5. Uploaded files display with preview thumbnails and remove options
6. File type and size validation using existing rules
7. Upload progress indicators and error handling
8. Files are properly categorized and stored in correct storage buckets
9. Commercial vs residential file requirements are respected

### Story 4.2: Enhanced Submit for Review Flow with Version Management

As an occupier user,
I want to submit my listing for admin review with clear understanding of completeness and version management,
so that I can get my listing published efficiently while understanding how edits affect live listings.

#### Acceptance Criteria

1. "Submit for Review" button is prominently displayed and always accessible
2. Clicking submit shows a completion summary modal
3. Modal displays which sections are complete vs incomplete
4. Users can submit with incomplete sections (with warnings)
5. Submission confirmation includes next steps and timeline expectations
6. Listing status changes from draft to pending after successful submission
7. Email notification is sent to user confirming submission
8. Users can continue editing even after submission (with status change to draft again)
9. When editing an already approved/live listing, users see clear messaging that changes create a new version for review
10. Live listings remain unchanged until admin approves the new version
11. Admin sees only the most recent submitted version when multiple submissions exist
12. Version history tracking allows rollback if needed

### Story 4.3: Legacy Wizard Access Option (FR12)

As an occupier user,
I want the option to use the traditional step-by-step wizard if I prefer that approach,
so that I can choose the creation method that works best for me.

#### Acceptance Criteria

1. "Use Step-by-Step Guide" link is available on the listing detail page
2. Link redirects to traditional wizard with current listing data pre-populated
3. Users can switch between approaches seamlessly
4. Wizard completion redirects back to listing detail page
5. All existing wizard functionality remains intact and tested
6. Clear labeling distinguishes between "Quick Create" and "Step-by-Step" options
7. User preference can be remembered for future listing creations
8. Both flows result in identical listing data structure

### Story 4.4: Listing Preview Functionality (FR13)

As an occupier user,
I want to preview how my listing will appear to potential inquirers,
so that I can see the public view and make improvements before submitting for review.

#### Acceptance Criteria

1. "Preview Listing" button is prominently displayed on the listing detail page
2. Preview opens in a new tab or modal showing the public-facing listing view
3. Preview displays all completed sections exactly as they would appear to inquirers
4. Empty/incomplete sections are handled gracefully in preview (hidden or shown as "Coming soon")
5. Preview includes all visual elements: logos, images, contact information, FAQs, documents
6. Preview is responsive and shows how the listing appears on different devices
7. Preview includes a clear "Return to Edit" or "Close Preview" option
8. Preview reflects real-time changes (if user makes edits, preview updates accordingly)
9. Preview shows the listing in the context of the actual public listing page layout

### Story 4.5: Mobile-Optimized Progressive Enhancement

As an occupier user,
I want to create and enhance my listings effectively on mobile devices,
so that I can work on my listings while traveling or away from my desktop.

#### Acceptance Criteria

1. All section editing interfaces are optimized for mobile touch interfaces
2. File uploads work properly on mobile devices with camera access
3. Auto-save functionality works reliably on mobile networks
4. Form inputs are appropriately sized for mobile keyboards
5. Navigation between sections is intuitive on small screens
6. Loading states are optimized for mobile performance
7. Offline capability allows viewing (read-only) when network is unavailable
8. Mobile-specific validation and error messaging

## Checklist Results Report

### Validation Summary: CONDITIONAL APPROVAL (85% Ready)

**Project Type**: Brownfield with UI/UX components
**Critical Issues**: 2 minor issues requiring attention
**Overall Assessment**: Exceptionally well-structured PRD with comprehensive requirements and user stories

**Critical Issues to Address:**
1. **Database Schema Evolution**: Version management system (FR11) requires database migration strategy for version tracking
2. **Preview Dependencies**: Story 4.4 preview functionality may depend on public listing page architecture - needs clarification

**Strengths:**
- Comprehensive existing system analysis and integration planning
- Excellent version management and rollback strategy (FR11)
- Well-sequenced epics with clear value delivery
- Strong brownfield risk management approach
- All 13 functional requirements properly addressed in stories

**Recommendation**: Address the two critical issues, then proceed to architecture phase. The PRD provides excellent foundation for development.

## Next Steps

### Design Architect Prompt

"Please create a comprehensive UI/UX architecture for the listing flow redesign based on the attached PRD (docs/prd-listing-flow-redesign.md). 

**Key Focus Areas:**
- User experience flow from streamlined Step 1 → immediate listing creation → progressive enhancement
- Listing detail page with editable sections and empty states (Stories 2.1-2.4)
- In-place editing patterns for all section types (contacts, FAQs, documents, requirements)
- Preview functionality integration (Story 4.4)
- Auto-save visual feedback and status indicators (Epic 3)
- Mobile-optimized progressive enhancement patterns

**Critical Design Considerations:**
- Integration with existing violet-bloom design system
- WCAG 2.1 AA accessibility compliance
- Version management UI for live vs draft listings (FR11)
- Real-time save status and conflict resolution interfaces

Please provide wireframes, interaction flows, and component specifications that align with existing SiteMatch patterns."

### Technical Architect Prompt  

"Please create a detailed technical architecture for implementing the listing flow redesign based on the attached PRD (docs/prd-listing-flow-redesign.md).

**Integration Requirements:**
- Existing Next.js/Supabase infrastructure (analyzed in PRD)
- Current wizard system, draft listings, and file upload patterns
- Existing authentication, validation, and database schemas

**Key Technical Challenges:**
1. **Database Schema Evolution**: Design version management system (FR11) with migration strategy
2. **Auto-Save Architecture**: Real-time updates with conflict resolution (Epic 3)
3. **Progressive Enhancement**: Section-based editing with immediate persistence
4. **Preview System**: Clarify dependencies on public listing page architecture

**Deliverables Needed:**
- Database schema modifications and migration plan
- API endpoint design for auto-save and section management
- Component architecture for editable sections
- Real-time update system using Supabase subscriptions
- Version management and rollback mechanisms

Address the two critical issues identified in the validation report while maintaining full backward compatibility."