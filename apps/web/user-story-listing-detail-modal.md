# User Story: Enhanced Listing Detail Modal

## Story Information
**Story ID:** LDM-001  
**Epic:** Property Listing Experience  
**Points:** 8  
**Priority:** High  

---

## User Story Statement

**As a** property agent or occupier browsing the commercial directory  
**I want** to view comprehensive listing details in an attractive, full-screen modal that slides up from the bottom  
**So that** I can access all relevant information (company details, contacts, files, FAQs) without losing my search context and return to the exact same search state when I close the modal  

---

## Acceptance Criteria

### AC1: Modal Animation and Behavior
- [ ] **GIVEN** I'm on the search results page  
- [ ] **WHEN** I click on any listing card  
- [ ] **THEN** a modal slides up smoothly from the bottom of the screen  
- [ ] **AND** the modal covers the full screen up to the bottom of the navbar  
- [ ] **AND** the slide-up animation takes 300ms with ease-out easing  
- [ ] **AND** a semi-transparent backdrop appears behind the modal  

### AC2: Modal Closure and State Preservation
- [ ] **GIVEN** the listing modal is open  
- [ ] **WHEN** I close the modal using the 'X' button, ESC key, or backdrop click  
- [ ] **THEN** the modal slides down smoothly (300ms ease-in)  
- [ ] **AND** I return to the search page in the exact same state:  
  - [ ] All applied filters remain active  
  - [ ] Location search terms are preserved  
  - [ ] Map position and zoom level are maintained  
  - [ ] Scroll position on the results list is restored  
  - [ ] Pagination state is preserved  

### AC3: Enhanced Content Display - Company Information
- [ ] **GIVEN** the modal is displaying a listing  
- [ ] **THEN** I can see the following company information in an attractive layout:  
  - [ ] Company name prominently displayed in the header  
  - [ ] Company logo (if available) displayed prominently  
  - [ ] Business sector with styled badge  
  - [ ] Planning use class with styled badge  
  - [ ] Site size requirements clearly formatted  

### AC4: Enhanced Content Display - Contact Information
- [ ] **GIVEN** the modal is displaying contact information  
- [ ] **THEN** I can see:  
  - [ ] Primary contact name and title  
  - [ ] Contact headshot/avatar (if available)  
  - [ ] Additional contacts listed with their headshots  
  - [ ] Clickable phone numbers that open phone app  
  - [ ] Clickable email addresses that open email client with pre-filled subject  
  - [ ] Professional styling for contact cards  

### AC5: Enhanced Content Display - Locations
- [ ] **GIVEN** the modal is displaying location information  
- [ ] **THEN** I can see:  
  - [ ] Preferred locations clearly listed  
  - [ ] Acceptable locations (if any) clearly distinguished  
  - [ ] Nationwide search indicator (if applicable)  
  - [ ] Interactive map showing location pins (if coordinates available)  
  - [ ] Location search scope clearly explained  

### AC6: Enhanced Content Display - FAQs Section
- [ ] **GIVEN** the listing has FAQs  
- [ ] **THEN** I can see:  
  - [ ] FAQ section with expandable/collapsible questions  
  - [ ] Questions displayed in order of importance  
  - [ ] Answers properly formatted with rich text support  
  - [ ] Visual indicators for expanded/collapsed state  

### AC7: Enhanced Content Display - Files and Documents
- [ ] **GIVEN** the listing has associated files  
- [ ] **THEN** I can see:  
  - [ ] Brochure download link with file size and type  
  - [ ] Fit-out examples with thumbnails (if images)  
  - [ ] Site plans with appropriate preview  
  - [ ] File download buttons with clear labels  
  - [ ] File type icons for easy identification  
  - [ ] Loading states during file downloads  

### AC8: Responsive Design - Mobile Behavior
- [ ] **GIVEN** I'm viewing the modal on mobile (< 768px)  
- [ ] **THEN** the modal:  
  - [ ] Slides up from the very bottom of the screen  
  - [ ] Covers the entire viewport except the navbar  
  - [ ] Has touch-friendly spacing and button sizes (min 44px)  
  - [ ] Allows smooth scrolling through content  
  - [ ] Has swipe-down gesture support for closing  

### AC9: Responsive Design - Desktop Behavior
- [ ] **GIVEN** I'm viewing the modal on desktop (≥ 768px)  
- [ ] **THEN** the modal:  
  - [ ] Slides up to center of screen with maximum width of 4xl  
  - [ ] Has rounded corners on all sides  
  - [ ] Shows backdrop blur effect  
  - [ ] Maintains proper aspect ratio and padding  

### AC10: Accessibility and Keyboard Navigation
- [ ] **GIVEN** I'm using keyboard navigation  
- [ ] **THEN** I can:  
  - [ ] Tab through all interactive elements in logical order  
  - [ ] Close modal with ESC key  
  - [ ] Focus returns to the triggering listing card when modal closes  
  - [ ] Screen reader announces modal open/close states  
  - [ ] All content is properly labeled for screen readers  

### AC11: Performance and Loading States
- [ ] **GIVEN** I open a listing modal  
- [ ] **THEN**:  
  - [ ] Modal opens immediately with skeleton/loading state  
  - [ ] Content loads progressively (company info first, then details)  
  - [ ] Images lazy load when visible  
  - [ ] Error states are handled gracefully with retry options  
  - [ ] Modal close is instant regardless of loading state  

### AC12: State Management
- [ ] **GIVEN** I'm interacting with the application  
- [ ] **THEN**:  
  - [ ] Modal state is managed separately from search state  
  - [ ] Opening modal doesn't trigger new API calls for search results  
  - [ ] Modal content is cached for the session  
  - [ ] Browser back button closes modal (but doesn't change search state)  
  - [ ] Deep linking to modal+search state works correctly  

---

## Technical Implementation Details

### Component Architecture
```typescript
// Enhanced ListingModal component structure
interface ListingModalProps {
  listingId: string | null;
  isOpen: boolean;
  onClose: () => void;
  searchState?: SearchFilters; // For state preservation
  scrollPosition?: number; // For scroll restoration
}

interface ListingModalContent {
  // Core company information
  company: {
    name: string;
    logo_url?: string;
    sector: string;
    use_class: string;
    site_size: string;
  };
  
  // Enhanced contact information  
  contacts: {
    primary: ContactDetails;
    additional: ContactDetails[];
  };
  
  // Location requirements
  locations: {
    preferred: Location[];
    acceptable: Location[];
    is_nationwide: boolean;
  };
  
  // FAQs with ordering
  faqs: FAQ[];
  
  // File attachments
  files: {
    brochures: FileAttachment[];
    fit_outs: FileAttachment[];
    site_plans: FileAttachment[];
  };
}
```

### API Endpoints Required
- `GET /api/public/listings/{id}/detailed` - Enhanced endpoint with all related data
- `GET /api/public/listings/{id}/contacts` - Contact information with avatars
- `GET /api/public/listings/{id}/files` - File metadata and download URLs

### State Management Implementation
```typescript
// Search page state preservation
interface SearchPageState {
  filters: SearchFilters;
  scrollPosition: number;
  mapState: MapViewState;
  pagination: PaginationState;
}

// Modal state management
const useListingModal = () => {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    listingId: null,
    previousScrollPosition: 0,
    searchState: null
  });
  
  const openModal = (listingId: string) => {
    setModalState({
      isOpen: true,
      listingId,
      previousScrollPosition: window.scrollY,
      searchState: getCurrentSearchState()
    });
  };
  
  const closeModal = () => {
    // Restore previous state
    restoreSearchState(modalState.searchState);
    window.scrollTo(0, modalState.previousScrollPosition);
    setModalState({ isOpen: false, listingId: null, ... });
  };
};
```

### Animation Implementation
```css
/* Modal animations using CSS transitions */
.modal-backdrop {
  transition: opacity 300ms ease-out;
}

.modal-container {
  transition: transform 300ms ease-out;
  transform: translateY(100%); /* Start position */
}

.modal-container.open {
  transform: translateY(0); /* End position */
}

/* Mobile-specific animations */
@media (max-width: 768px) {
  .modal-container {
    bottom: 0;
    top: var(--navbar-height);
    border-radius: 16px 16px 0 0;
  }
}

/* Desktop-specific styling */
@media (min-width: 768px) {
  .modal-container {
    max-width: 56rem; /* 4xl */
    margin: auto;
    border-radius: 16px;
  }
}
```

---

## Design Specifications

### Layout Structure
```
┌─────────────────────────────────────────┐
│ Header: [Logo] Company Name        [×]  │
├─────────────────────────────────────────┤
│ Content Area (scrollable):              │
│                                         │
│ • Company Overview Section              │
│   - Logo, Sector, Use Class, Size      │
│                                         │
│ • Contact Information Cards            │
│   - Primary + Additional contacts      │
│   - Headshots, titles, contact methods │
│                                         │
│ • Location Requirements                 │
│   - Preferred/Acceptable locations     │
│   - Interactive map (if applicable)    │
│                                         │
│ • FAQs (Expandable)                     │
│   - Question/Answer pairs              │
│                                         │
│ • Files & Documents                     │
│   - Download links with previews       │
│                                         │
│ • Action Buttons                        │
│   - Contact, Save, Share               │
└─────────────────────────────────────────┘
```

### Visual Design Requirements
- **Header**: Sticky header with company branding and close button
- **Spacing**: Consistent 24px padding on desktop, 16px on mobile
- **Typography**: Follow existing design system (heading-4 for sections, body-base for content)
- **Colors**: Primary brand colors with appropriate contrast ratios
- **Shadows**: Elevated shadow for modal container
- **Borders**: Subtle borders between sections
- **Interactive Elements**: Hover states, focus indicators, loading states

### File Handling Specifications
```typescript
interface FileAttachment {
  id: string;
  type: 'brochure' | 'fit_out' | 'site_plan';
  name: string;
  size: number;
  url: string;
  thumbnail_url?: string; // For images
  mime_type: string;
}

// File display requirements
- PDF files: Show PDF icon + filename + size
- Images: Show thumbnail + filename + size  
- Other files: Show appropriate icon + filename + size
- All files: Download on click, loading state during download
- File size: Display in human-readable format (KB, MB)
```

---

## Mobile Considerations

### Touch Interactions
- **Swipe down**: Close modal gesture
- **Touch targets**: Minimum 44px for all interactive elements
- **Scroll behavior**: Smooth scrolling, momentum preservation
- **Viewport**: Full screen minus navbar height

### Performance Optimizations
- **Lazy loading**: Images and non-critical content
- **Progressive enhancement**: Core content loads first
- **Touch optimization**: Prevent zoom on form inputs
- **Network awareness**: Reduce image quality on slow connections

---

## Definition of Done

### Development Checklist
- [ ] Component implements all acceptance criteria
- [ ] TypeScript interfaces defined and implemented
- [ ] Unit tests written with >90% coverage
- [ ] Integration tests for modal state management
- [ ] Accessibility audit passed (WCAG 2.1 AA)
- [ ] Performance audit passed (Core Web Vitals)
- [ ] Cross-browser testing completed (Chrome, Firefox, Safari)
- [ ] Mobile device testing on iOS and Android
- [ ] Code review completed and approved
- [ ] Documentation updated

### QA Testing Requirements
- [ ] Manual testing on all supported devices and browsers
- [ ] Accessibility testing with screen readers
- [ ] Performance testing with slow network conditions
- [ ] Usability testing with target users
- [ ] Visual regression testing
- [ ] API integration testing

### Deployment Requirements
- [ ] Feature flag implemented for gradual rollout
- [ ] Analytics tracking implemented
- [ ] Error monitoring configured
- [ ] Performance monitoring configured
- [ ] Rollback plan documented

---

## Success Metrics

### User Experience Metrics
- **Modal Open Rate**: % of listing cards that are clicked
- **Time in Modal**: Average time users spend viewing listing details
- **Return to Search**: % of users who successfully return to search with preserved state
- **Contact Engagement**: % of users who contact companies from modal

### Technical Performance Metrics
- **Modal Load Time**: < 200ms to display loading state, < 1s for full content
- **Animation Performance**: 60fps during slide animations
- **State Preservation**: 100% accuracy in restoring search state
- **Error Rate**: < 1% API failures for listing detail requests

### Accessibility Metrics
- **Keyboard Navigation**: 100% of functionality accessible via keyboard
- **Screen Reader Compatibility**: All content properly announced
- **Color Contrast**: All text meets WCAG AA standards (4.5:1 ratio)

---

## Dependencies and Risks

### Technical Dependencies
- Enhanced API endpoints for listing details with related data
- Image optimization service for contact headshots and file thumbnails
- File storage service for document downloads
- Analytics service for tracking modal interactions

### Potential Risks
- **Performance**: Large listing details could slow modal loading
- **State Management**: Complex search state preservation could introduce bugs
- **File Handling**: Large file downloads could impact user experience
- **Browser Compatibility**: Animation support varies across browsers

### Mitigation Strategies
- Implement progressive loading and caching
- Thoroughly test state management with automated tests
- Add file size warnings and compression
- Provide CSS fallbacks for unsupported animation features