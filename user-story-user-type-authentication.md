# Story {{EpicNum}}.{{StoryNum}}: Add User Type Classification and Authentication Requirements

## Status: Draft

## Story

- As a platform administrator
- I want to classify users by their business type and require authentication to view search results
- so that we can better understand our user base and ensure only registered users can access our commercial property data

## Acceptance Criteria (ACs)

1. A new `user_type` column is added to the users table that stores one of the following values: "Commercial Occupier", "Housebuilder", "Consultant", "Agent", "Landlord/Vendor", "Developer", "Government", "Other"
2. The sign-up flow displays a required field with the question "Which best describes you?" with the 8 user type options as a dropdown or radio button selection
3. Users must be authenticated (logged in) to access the search page and view search results
4. Unauthenticated users attempting to access search are redirected to the login page with a message indicating authentication is required
5. All new user types have the same permissions and capabilities as the existing occupier role
6. Existing users without a user_type are prompted to select their type on next login
7. The user_type field is required for new registrations and cannot be left empty
8. User type selection is stored in the database upon successful registration

## Tasks / Subtasks

- [ ] Task 1: Database Migration (AC: 1, 5, 6)
  - [ ] Create migration to add `user_type` column to users table
  - [ ] Set column as nullable initially to handle existing users
  - [ ] Add enum constraint for valid user type values
  - [ ] Create migration to update existing users with "Commercial Occupier" as default if they have occupier role
  
- [ ] Task 2: Update User Model and Authentication (AC: 1, 5)
  - [ ] Update User model/entity to include user_type field
  - [ ] Update user registration DTO/schema to include user_type
  - [ ] Ensure all user types inherit same permissions as occupier role
  
- [ ] Task 3: Modify Sign-up Flow UI (AC: 2, 7, 8)
  - [ ] Add "Which best describes you?" field to registration form
  - [ ] Implement dropdown/radio button with 8 user type options
  - [ ] Add client-side validation to ensure selection is made
  - [ ] Update form submission to include user_type
  
- [ ] Task 4: Implement Authentication Requirements for Search (AC: 3, 4)
  - [ ] Add authentication middleware/guard to search routes
  - [ ] Implement redirect logic for unauthenticated users
  - [ ] Add informative message about authentication requirement
  - [ ] Update search page access controls
  
- [ ] Task 5: Handle Existing Users (AC: 6)
  - [ ] Create interstitial page/modal for user type selection
  - [ ] Add logic to check if logged-in user has null user_type
  - [ ] Force user type selection before allowing access to main application
  - [ ] Update user record with selected type

- [ ] Task 6: Testing (AC: All)
  - [ ] Write unit tests for user model changes
  - [ ] Write integration tests for registration flow
  - [ ] Write e2e tests for authentication requirements
  - [ ] Test migration rollback scenarios

## Dev Notes

### Database Schema Changes
- Table: `users`
- New Column: `user_type` 
- Type: VARCHAR/ENUM
- Allowed Values: ['Commercial Occupier', 'Housebuilder', 'Consultant', 'Agent', 'Landlord/Vendor', 'Developer', 'Government', 'Other']
- Initially nullable to handle existing users, then NOT NULL after migration

### UI/UX Requirements
- Registration form field placement: After email/password fields, before any optional fields
- Field type: Dropdown select or radio buttons (designer preference)
- Field label: "Which best describes you?"
- Helper text: "This helps us provide you with relevant content"
- Error message: "Please select your user type"

### Authentication Flow
- Unauthenticated users hitting search routes should receive 401 status
- Frontend should catch 401 and redirect to login with returnUrl parameter
- Login page should display message: "Please sign in to access search results"
- After successful login, redirect back to originally requested page

### Permissions Model
- All user types should have identical permissions to existing occupier role
- No need to create separate permission sets per user type at this time
- Future stories may differentiate capabilities by user type

### Testing

Dev Note: Story Requires the following tests:

- [ ] Jest Unit Tests: (nextToFile: true), coverage requirement: 80%
- [ ] Jest with in memory db Integration Test: location: next to handler files
- [ ] Cypress E2E: location: `/e2e/user-type-auth/user-type-selection.test.ts`

Manual Test Steps:
- Register new user and verify user type field appears and is required
- Verify all 8 user type options are available in dropdown
- Attempt to access search page without authentication and verify redirect to login
- Login as existing user without user_type and verify prompt to select type
- Verify user can access search after authentication
- Test that selected user type is saved to database correctly

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