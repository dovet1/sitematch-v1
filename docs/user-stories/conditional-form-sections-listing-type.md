# Conditional Form Sections Based on Listing Type - Brownfield Addition

## User Story

As an **occupier creating or updating a listing**,
I want **form sections to show/hide dynamically based on my selected listing type (residential vs commercial)**,
So that **I only see relevant fields for my property type and have a more focused, efficient form completion experience**.

## Story Context

**Existing System Integration:**

- Integrates with: Listing Creation/Update Wizard (`listing-wizard.tsx` and all 6 step components)
- Technology: React + TypeScript form wizard with step-by-step validation
- Follows pattern: Existing conditional field rendering based on form state (e.g., logo method selection, location search toggles)
- Touch points: All 6 wizard steps, form validation logic, step progression rules

**Current State Analysis:**

The listing wizard currently has 6 steps:
1. **Company Info** - Company details, listing type selection, contact info, logo, brochure
2. **Requirements** - Sectors, use classes, site size requirements  
3. **Locations** - Target locations or nationwide search
4. **Additional Contacts** - Extra team member contacts
5. **FAQs** - Frequently asked questions
6. **Supporting Documents** - Site plans, fit-out examples

Currently, all sections display regardless of `listingType` selection (`residential` vs `commercial`), making the form less focused for users.

## Acceptance Criteria

**Functional Requirements:**

1. **Dynamic Section Display**: Form sections show/hide immediately when `listingType` changes on Step 1, with smooth transitions
2. **Residential-Specific Sections**: When `listingType` is "residential", show simplified requirements focused on residential property needs
3. **Commercial-Specific Sections**: When `listingType` is "commercial", show full commercial property requirements including sectors, use classes, and industrial specifications
4. **Dynamic Step Numbering**: For residential listings, wizard shows steps 1-5 only (Step 6 is completely hidden and skipped). For commercial listings, all steps 1-6 are shown
5. **Form State Preservation**: Previously entered data is preserved when switching between listing types (not cleared unless field becomes irrelevant)

**Integration Requirements:**

6. Existing wizard step navigation and validation continues to work unchanged
7. New conditional logic follows existing pattern of `watchedValues` state monitoring in step components
8. Integration with wizard progress component maintains current step indication behavior
9. Form validation adapts to only validate visible/relevant fields for selected listing type

**Specific Conditional Display Logic:**

10. **Step 1 (Company Info)**: Always visible for both types, but brochure upload may be commercial-focused
11. **Step 2 (Requirements)**: 
    - **Residential**: Show number of dwellings as a range (min/max) and site acreage as a range (min/max acres)
    - **Commercial**: Keep existing functionality - show full sectors multi-select, complete use classes, detailed site size requirements
12. **Step 3 (Locations)**: Always visible but location search behavior may differ
13. **Step 4 (Additional Contacts)**: Always visible  
14. **Step 5 (FAQs)**: Always visible
15. **Step 6 (Supporting Documents)**: 
    - **Residential**: Hide this step entirely (skip from Step 5 to submission)
    - **Commercial**: Show full industrial/commercial document types (site plans, fit-out examples)

**Quality Requirements:**

16. Form performance remains optimal with conditional rendering
17. Step validation logic properly handles conditional fields
18. Accessibility is maintained with proper ARIA labels for dynamic content
19. No visual glitches during section show/hide transitions

## Technical Notes

**Step 2 Residential Fields Specification:**
- **Number of Dwellings Range**: Two number inputs (min/max) for dwelling count (e.g., 50-100 units)
- **Site Acreage Range**: Two number inputs (min/max) for site size in acres (e.g., 5.0-15.0 acres)
- **Field Validation**: Both ranges should allow min = max for exact requirements, min must be ≤ max
- **UI Layout**: Use similar dual-slider or two-input pattern as existing site size fields

**Integration Approach:**
- Add conditional rendering logic to each step component based on `data.listingType` prop
- Update step validation functions to only validate relevant fields per listing type
- Modify wizard navigation to skip Step 6 entirely for residential listings
- Implement smooth CSS transitions for section show/hide using existing design system classes
- Use React's conditional rendering patterns already established in the codebase

**Existing Pattern Reference:**
- Follow the logo method conditional display pattern in `step1-company-info.tsx` (lines 180-240) where Clearbit vs Upload options show different form sections
- Use the same `watchedValues` monitoring approach for real-time updates
- Apply existing form validation patterns from `wizard-utils.ts` `validateStep()` function

**Key Constraints:**
- Must maintain backward compatibility with existing form data structure
- Cannot break existing step navigation or auto-save functionality  
- Should follow existing mobile-first responsive design patterns
- Must preserve form state during listing type changes where fields remain relevant

**Implementation Details:**
- Create utility function `getVisibleSectionsForListingType(listingType)` to centralize conditional logic
- Add new fields to wizard types: `dwellingCountMin`, `dwellingCountMax`, `siteAcreageMin`, `siteAcreageMax`
- Update Step 2 component to conditionally render residential vs commercial fields
- Modify wizard navigation logic to skip Step 6 for residential listings
- Update validation schemas to be conditional based on listing type
- Add transition animations using existing design system CSS classes
- Update wizard progress descriptions to reflect current visible sections

## Definition of Done

- [ ] Functional requirements met - sections show/hide based on listing type selection
- [ ] Integration requirements verified - existing wizard functionality unchanged
- [ ] Conditional display logic works correctly for both residential and commercial types
- [ ] Form validation adapts properly to visible fields only
- [ ] Existing step navigation, auto-save, and progress tracking work unchanged
- [ ] Code follows existing conditional rendering patterns from logo method selection
- [ ] Tests updated to cover conditional section display scenarios
- [ ] Mobile and desktop responsive behavior maintained
- [ ] No performance regression in form rendering or interaction

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk**: Breaking existing form validation or step progression logic when sections are hidden
- **Mitigation**: Implement conditional validation carefully, test all step transition scenarios
- **Rollback**: Feature flag or simple removal of conditional logic to restore original behavior

**Compatibility Verification:**

- [ ] No breaking changes to existing wizard data structure or props interfaces
- [ ] Form auto-save functionality works with conditional sections
- [ ] Existing form validation and error handling patterns maintained
- [ ] Mobile responsive design preserved across all conditional states
- [ ] Performance impact is negligible (conditional rendering is lightweight)

## Implementation Tasks Breakdown

**Phase 1 - Core Functionality (Priority: High)**
1. **Add New Residential Fields to TypeScript Types** - Update `RequirementDetailsData` interface with dwelling count and acreage range fields
2. **Create Utility Function for Visible Steps** - Add `getVisibleStepsForListingType()` to handle step visibility logic
3. **Update Step 2 for Conditional Rendering** - Add residential fields and hide commercial fields conditionally
4. **Modify Wizard Progress Component** - Update progress to show 5 steps for residential, 6 for commercial
5. **Update Wizard Navigation Logic** - Modify navigation to skip Step 6 for residential listings

**Phase 2 - Enhancement & Polish (Priority: Medium)**
6. **Update Validation Logic** - Add conditional validation for new residential fields
7. **Add CSS Transitions** - Implement smooth show/hide transitions
8. **Update Form Submission Logic** - Handle conditional steps in submission process

**Phase 3 - Testing & Quality (Priority: Low)**
9. **Update Existing Tests** - Modify tests to cover conditional behavior
10. **Add New Tests for Residential Fields** - Create comprehensive test coverage

## Validation Checklist

**Scope Validation:**

- [x] Enhancement broken down into specific, actionable tasks
- [x] Integration approach follows established conditional rendering patterns
- [x] No architecture changes required - purely UI conditional logic
- [x] Existing validation and state management patterns can be extended directly

**Clarity Check:**

- [x] Conditional display requirements are clearly specified for each step
- [x] Integration points with existing wizard components are well-defined
- [x] Success criteria include both functional behavior and technical integration
- [x] Implementation tasks provide clear development roadmap
- [x] Rollback approach is straightforward (remove conditional logic)