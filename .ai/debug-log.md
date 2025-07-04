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