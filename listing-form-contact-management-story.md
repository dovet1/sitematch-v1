# Story: Update Listing Form Contact Management

## Status: Approved

## Story

- As a **listing creator/editor**
- I want **to add contact information without primary/secondary distinctions and specify their coverage areas**
- so that **all contacts are displayed equally on the public listing and users can identify which contact covers their geographic area**

## Acceptance Criteria (ACs)

1. **UI Contact Display Parity**
   - Remove all "Primary Contact" labels/headers from the create/edit listing form UI
   - Display all contacts in a uniform list without hierarchical distinction
   - Maintain backend primary contact designation for data integrity (first contact = primary)

2. **Area Coverage Field**
   - Add "Coverage Area" text input field to each contact section in the form
   - Field label: "Coverage Area" with placeholder text "e.g., The South West"
   - Field should accept free text up to 255 characters
   - Field should be optional

3. **Data Storage**
   - For the first contact (backend primary), store area in the `listings.contact_area` field
   - For additional contacts, store area in the `listing_contacts.contact_area` field
   - Maintain existing contact data structure and relationships

4. **Form Validation**
   - At least one contact must be provided (existing requirement)
   - Area field remains optional for all contacts
   - Existing contact validation rules remain unchanged

## Tasks / Subtasks

- [ ] Update Form UI Components (AC: 1, 2)
  - [ ] Remove "Primary Contact" labels from EnhancedListingModal.tsx
  - [ ] Add "Coverage Area" input field to contact form section
  - [ ] Update contact section styling for uniform appearance
  
- [ ] Update Data Models and API (AC: 3)
  - [ ] Update listing type/interface to include `contact_area` field
  - [ ] Update listing_contact type/interface to include `contact_area` field
  - [ ] Update form submission logic to map area fields correctly
  - [ ] Update API endpoints to handle `contact_area` in both tables
  
- [ ] Update Form State Management (AC: 2, 3)
  - [ ] Add contact_area to form state for each contact
  - [ ] Ensure contact_area persists during form edits
  - [ ] Handle contact_area in form reset/clear operations

- [ ] Testing (AC: 1-4)
  - [ ] Test creating listing with single contact and area
  - [ ] Test creating listing with multiple contacts and areas
  - [ ] Test editing existing listing contacts and areas
  - [ ] Verify data persistence in correct tables

## Dev Notes

**Current Implementation Context:**
- The form is located in `apps/web/src/components/listings/EnhancedListingModal.tsx`
- Database columns `contact_area` have been added to both `listings` and `listing_contacts` tables
- Backend maintains primary contact concept for data integrity
- First contact in the array is treated as primary on backend
- Additional contacts stored in listing_contacts join table

**Key Implementation Points:**
- Keep backend primary contact logic intact
- Only update UI presentation layer
- Ensure backward compatibility with existing listings
- Field name is `contact_area` (not just `area`) in both tables

### Testing

Dev Note: Story Requires the following tests:

- [ ] Unit Tests: (nextToFile: true), coverage requirement: 80%
- [ ] Integration Test: location: next to handler
- [ ] E2E: location: `/e2e/listing-form/contact-management.test.ts`

Manual Test Steps:
- Create a new listing with one contact and verify contact_area saves to listings table
- Create a listing with multiple contacts, verify first contact_area saves to listings table and additional contact_area values save to listing_contacts table
- Edit an existing listing and add/modify contact_area values
- Verify all contacts display without primary/secondary distinction
- Confirm contact_area text displays correctly on public listing view

## Dev Agent Record

### Agent Model Used: {{Agent Model Name/Version}}

### Debug Log References

[[LLM: (Dev Agent) If the debug is logged to during the current story progress, create a table with the debug log and the specific task section in the debug log - do not repeat all the details in the story]]

### Completion Notes List

[[LLM: (Dev Agent) Anything the SM needs to know that deviated from the story that might impact drafting the next story.]]

### File List

[[LLM: (Dev Agent) List every new file created, or existing file modified in a bullet list.]]

### Change Log

[[LLM: (Dev Agent) Track document versions and changes during development that deviate from story dev start]]

| Date | Version | Description | Author |
| :--- | :------ | :---------- | :----- |

## QA Results

[[LLM: QA Agent Results]]