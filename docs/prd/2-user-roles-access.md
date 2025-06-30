# 2. User Roles & Access

| Role                                 | Auth Required?          | Core Capabilities                                                                                  |
| ------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------- |
| Occupier                             | **Yes** (Supabase Auth) | Create, edit & publish listings; view own dashboard/status                                         |
| Landlord / Agent / Investor / Vendor | **No** (public)         | Browse & filter listings; open listing drawer; optional **newsletter pop‑up** to join mailing list |
| Admin                                | **Yes**                 | Review queue; approve/reject listings & leave notes                                                |

## 2.1 Landlord Email Capture

* First page‑view triggers a **modal** requesting:
  `email` (validated)
  `"What best describes you?"` → radio buttons: **Agent / Investor / Landlord / Vendor**.
* Accept → store in `public.leads` and subscribe to marketing newsletter.
* Decline → continue browsing anonymously.
* Re‑prompt only after 30 days (localStorage flag).

---
