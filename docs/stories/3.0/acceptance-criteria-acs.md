# Acceptance Criteria (ACs)

1. **Database Schema Implementation**: Create complete listings database schema with proper relationships and RLS policies
2. **Multi-Step Wizard UI**: Implement 2-step listing creation wizard with progress indication and navigation
3. **Company Information Step**: Capture occupier company details and mandatory PDF brochure upload
4. **Requirement Details Step**: Capture location preferences, sector, use class, and site size requirements
5. **Location Search Integration**: Integrate Mapbox Places API for UK/Ireland location search and selection
6. **File Upload System**: Implement secure PDF brochure upload to Supabase Storage with validation
7. **Form State Management**: Robust form handling with validation, error states, and data persistence between steps
8. **Admin Workflow Integration**: New listings created in "pending" status for admin approval before going live
9. **Occupier Dashboard Access**: Authenticated occupiers can access listing creation from protected route
10. **Responsive Design**: Wizard works seamlessly across desktop, tablet, and mobile devices
