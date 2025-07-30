# Debug Log

This file tracks development agent failures and debugging information.

## Log Format

```
[TIMESTAMP] [AGENT] [LEVEL] Message
```

## Entries

| Task | File | Change | Reverted? |
|------|------|--------|-----------|
| Fix form jittering | step1-company-info.tsx | Added debouncing, memoization, specific field watching | Partial |
| Fix form jittering | image-upload.tsx | Fixed infinite loops in useEffect and useCallback | No |
| Fix input blocking | step1-company-info.tsx | Removed debouncing, kept memoization, restored normal form flow | No |
| Fix company name jittering | step1-company-info.tsx | Fixed File serialization issue, proper field watching, setValue loops | No |
| Fix all input jittering | step1-company-info.tsx | Advanced debouncing with refs, proper File handling, duplicate prevention | No |
| Fix email default and placeholders | step1-company-info.tsx | Removed email auto-fill, fixed placeholder styling | No |
| Enhance moderation review display | ListingReview.tsx | Removed title/description, fixed location display, enhanced file previews | No |
| Fix missing data on moderation page | admin.ts | Enhanced getListingById to fetch contacts and files from correct tables | No |
| Add debug info to moderation page | ListingReview.tsx | Added debug section to show all raw listing data | No |
| Fix FAQ saving during listing creation | create-listing/page.tsx | Added calls to addFAQsToDraftListing, addContactsToDraftListing, addLocationsToDraftListing | No |
| Fix FAQ field name mapping | create-listing/page.tsx | Fixed displayOrder -> display_order mapping for database schema | No |
| Fix company name saving | draft-listings.ts, create-listing/page.tsx | Added company_name field to finalizeDraftListing and pass actual company name | No |
| Fix nationwide location saving | draft-listings.ts, create-listing/page.tsx, ListingReview.tsx | Added is_nationwide field saving and enhanced location display | No |
| Fix headshot upload missing URLs | step1-company-info.tsx, step4-additional-contacts.tsx | Added file upload to /api/upload to get URLs for headshots | No |
| Fix is_nationwide schema error | draft-listings.ts, create-listing/page.tsx, ListingReview.tsx | Removed is_nationwide field, determine nationwide by lack of locations | No |
| Implement mobile UX for SiteSketcher | Multiple files | Added MobileBottomSheet, TouchOptimizedButton, gesture handling, visual feedback | No |
| Fix map to show all listing_locations | map/route.ts, useMapClustering.ts | Modified API to return one pin per location, updated clustering to handle location_id | No |
| Display company logos as map pins | MapMarker.tsx | Modified single listing pins to show company logo with fallback to initials | No |
| Fix map measurements | MapboxMap.tsx | Update map annotations to use polygon-specific settings | No |
| Fix desktop layout | ResponsiveControls.tsx | Improve button layout for desktop sidebar | No |
| Fix toggle precedence logic | MapboxMap.tsx, ResponsiveControls.tsx, page.tsx | Fixed individual settings to always override global defaults | No |