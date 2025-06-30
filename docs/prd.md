# SiteMatch – MVP Product Requirements Document (PRD)

*Version 0.3 – 30 June 2025*

---

## 1. Purpose & Vision

SiteMatch is a responsive web directory where **commercial occupiers** in the UK & Ireland publish rich, standardised “site‑wanted” briefs and **landlords/agents** browse them instantly. It replaces scattered PDFs and phone calls with a single, live, searchable source of demand.

**Launch target:** 21 July 2025 (3‑week build)

---

## 2. User Roles & Access

| Role                                 | Auth Required?          | Core Capabilities                                                                                  |
| ------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------- |
| Occupier                             | **Yes** (Supabase Auth) | Create, edit & publish listings; view own dashboard/status                                         |
| Landlord / Agent / Investor / Vendor | **No** (public)         | Browse & filter listings; open listing drawer; optional **newsletter pop‑up** to join mailing list |
| Admin                                | **Yes**                 | Review queue; approve/reject listings & leave notes                                                |

### 2.1 Landlord Email Capture

* First page‑view triggers a **modal** requesting:
  `email` (validated)
  `"What best describes you?"` → radio buttons: **Agent / Investor / Landlord / Vendor**.
* Accept → store in `public.leads` and subscribe to marketing newsletter.
* Decline → continue browsing anonymously.
* Re‑prompt only after 30 days (localStorage flag).

---

## 3. Listing Creation Wizard (Occupier)

Multi‑step flow implemented with React Hook Form.

### 3.1 Required fieldsfileciteturn4file0L19-L28

1. **Company name**
2. **Requirements brochure (PDF)**
3. ≥ 1 **contact** (name, title, phone, email)

### 3.2 Optional fields (all **dropdown / controlled** except sliders & uploads)fileciteturn4file0L31-L44

| Field                  | Input Type                                                                                                                                                                                                                | Notes |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Company logo           | file‑upload                                                                                                                                                                                                               |       |
| **Locations**          | **search‑as‑you‑type input** (Mapbox Places autocomplete for UK & Ireland towns/cities) with selected items rendered as removable **chips** (see screenshot); multi‑add supported; **“Nationwide”** toggle disables chips |       |
| **Sector**             | dropdown – *Retail / Food & Beverage / Leisure / Industrial & Logistics / Office / Healthcare / Automotive / Roadside / Other*                                                                                            |       |
| **Planning Use Class** | dropdown – *E(a) Retail, E(b) Café/Restaurant, E(g)(i) Office, E(g)(iii) Light Industrial, B2 General Industrial, B8 Storage/Distribution, C1 Hotel, Sui Generis (Drive‑thru, Petrol, Cinema, Casino, etc.)*              |       |
| **Site Size**          | double‑thumb **slider** (min + max sq ft)                                                                                                                                                                                 |       |
| FAQs                   | accordion rich‑text                                                                                                                                                                                                       |       |
| Site / Store plan      | doc/PDF uploads                                                                                                                                                                                                           |       |
| Example fit‑outs       | image/video gallery                                                                                                                                                                                                       |       |

Validation: all required fields block progression; optional fields clearly labelled.

---

## 4. Public Directory & Search

### 4.1 Filters & Search Bar

* **Location search (Mapbox Places)** – type postcode/address → geocode → return listings where the entered point lies inside any stored listing location polygon **OR** include listings flagged “Nationwide”.
* **Sector** (multi‑select dropdown)
* **Site Size** (min / max sq ft numeric inputs)
* **Company Name** (text search)
* **Planning Use Class** (multi‑select dropdown)

\*(Nationwide tab replicates incumbent behaviour for requirements that are location‑agnostic.)\*fileciteturn4file0L92-L96

### 4.2 Results UI

* Listings feed (cards) + optional map view (pins omit Nationwide).
* **Infinite scroll** or “Load more”, ordered *newest › oldest* by default.

### 4.3 Listing Detail Drawer

* Clicking a card opens **full‑screen modal/drawer** containing: brochure preview, image gallery, video player, contact cards (tap‑to‑email/call), and metadata chips.
* **Close (X)** returns user to the previous results state (filters, scroll position, map zoom) via React Router history + state preservation hook.

---

## 5. Admin & Moderation

| State            | Trigger                                                  | Notes |
| ---------------- | -------------------------------------------------------- | ----- |
| Draft            | Occupier saves but not published                         |       |
| Pending Approval | Occupier presses **Publish**                             |       |
| Approved         | Admin accepts                                            |       |
| Rejected         | Admin rejects with rich‑text notes (emailed to occupier) |       |
| Deleted          | Soft‑delete (30‑day restore)                             |       |

Edits to an *Approved* listing revert status to **Pending**.

---

## 6. Non‑Functional Requirements

* **Performance:** first contentful paint < 2 s on 3G.
* **Accessibility:** WCAG 2.2 AA across forms and modals.
* **Security:** listings & files stored in Supabase bucket with row‑level security; brochure PDFs virus‑scanned.
* **SEO:** server‑side rendered listing pages (Next.js app‑router).
* **Analytics:** Mixpanel events → browse, filter, open\_listing, submit\_brief, modal\_subscribe.

---

## 7. Tech Stack (agreed)

| Layer         | Selection                    | Reason                                 |
| ------------- | ---------------------------- | -------------------------------------- |
| Front‑end     | **Next.js 14 (App Router)**  | Framework familiarity, SSR SEO         |
| Auth & DB     | **Supabase (Postgres)**      | Free tier fits MVP, RLS, storage API   |
| Styling       | **Tailwind CSS + shadcn/ui** | Rapid, accessible component primitives |
| Map / Geocode | **Mapbox GL JS**             | Autocomplete + polygon checks          |
| Deployment    | **Vercel** (preview)         | Fast CI, edge functions                |

---

## 8. Success Metrics (MVP window)

1. ≥ 50 occupier briefs live by **launch**.
2. ≥ 300 landlord / agent email sign‑ups via pop‑up in first 30 days.
3. Mean time from occupier submission to admin approval < 12 h.
4. Page load (Largest Contentful Paint) < 2 s on 3G (lab).

---

## 9. Open Questions & Next Steps

1. Confirm copy & legal text for email capture consent.
2. Finalise brand palette / fonts for Tailwind theme.
3. Decide whether paid tiers (alerts/API) are in scope post‑MVP.

---

*Prepared by BMAD PM. Please review and highlight any further edits before we lock scope for Sprint 1.*
