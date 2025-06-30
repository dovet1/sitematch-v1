# SiteMatch – UX Wireframe Specification (MVP)

*Version 0.2 – 30 June 2025*

---

## 0. Principles

* **Mobile‑first responsive** (375 px base → adaptive desktop grid)
* **Clarity over decoration** – neutral palette until brand finalised; rely on typography & white‑space.
* **Shadcn/ui + Tailwind** components only – keeps build velocity high.
* **F‑shaped reading** pattern on desktop list views.
* **Keyboard & screen‑reader** accessible from day 1.

---

## 1. Public Browse / Search

### 1.1 Header (sticky)

| Zone       | Elements                                                 | Notes                                                   |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------- |
| **Left**   | SiteMatch logo (text for MVP)                            | Links back to `/`                                       |
| **Centre** | 🔍 **Search bar** *(shadcn Input with left MapPin icon)* | Placeholder: "Town / postcode or select Nationwide"     |
| **Right**  | **Filters** button (ghost on mobile, inline on desktop)  | Opens Slide‑over on mobile; shows Pill group on desktop |

### 1.2 Filters Panel / Bar

| Filter                | Type (shadcn)                | Behaviour                                                                                  |
| --------------------- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| Location              | integrated in main search    | Mapbox autocomplete; chip output below bar                                                 |
| Sector                | Multi‑select `SelectPopover` | Checklist inside popover                                                                   |
| **Site Size**         | **Double‑thumb `Slider`**    | Range selector, min = 0, max = 1 000 000 sq ft, step = 1 000; displays live min/max badges |
| Planning Use Class    | Multi‑select                 | Same as Sector                                                                             |
| Company Name          | `Input`                      | Debounced text search                                                                      |
| **Nationwide toggle** | `Switch`                     | Disables location chips                                                                    |

### 1.3 Results Area

* **Layout desktop:** 3‑column Masonry (card width \~360 px, gap‑4).
* **Layout mobile:** 1‑column list, infinite scroll.
* **Card anatomy:** logo avatar · **company name** · sector badge(s) · key meta chips (size, use class, locations) · CTA "View details →". *(Removed headline requirement text)*
* **Map toggle:** Button group "List | Map".

  * Map shows **pins**; when **≥ 2 listings share the same lat/lon** we render a **cluster badge** with count.
  * Clicking a single pin opens the corresponding listing card in a pop‑over (mobile bottom‑sheet, desktop sidecard).
  * Clicking a cluster zooms in or opens a stack view of all cards in that location for quick swipe selection.

---

## 2. Email‑Capture Modal (Landlords / Guests)

| Element      | Spec                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Trigger      | `useEffect` on first mount if no `lead_flag` in `localStorage`                                  |
| Dialog       | shadcn `Dialog` centre‑screen (max‑w‑sm)                                                        |
| Fields       | Email (`Input` with validation) · **Radio group** "Agent / Investor / Landlord / Vendor"        |
| CTA          | **Primary** "Subscribe & Continue" · **Secondary** "Skip for now"                               |
| After submit | POST to `public.leads`; set `lead_flag=true` in localStorage; toast "Thanks – check your inbox" |

---

## 3. Listing Detail Drawer (Full‑screen)

| Section       | Layout                                                                    |
| ------------- | ------------------------------------------------------------------------- |
| Hero carousel | Brochure PDF preview (iframe) + image thumbnails (`Tabs + AspectRatio`)   |
| Meta          | Grid‑2: left summary chips; right contact card(s) with mailto/tel buttons |
| Tabs          | **Summary / Gallery / FAQs / Files**                                      |
| Close         | `X` icon top‑right; uses `useNavigate(-1)` to preserve search state       |

---

## 4. Occupier Portal

### 4.1 Dashboard

* Table of listings: **columns → Company | Sector | Status pill | Last updated | Actions**.
* **Row actions:** `Preview`, `Edit`, `Archive`, `Delete` (shadcn `DropdownMenu`).
* Button **“New Listing”** opens Wizard.

### 4.2 Listing Creation Wizard

| Step | Title & Components                                                                                            | Validation                          |
| ---- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1    | **Company, Contacts & Brochure** – Inputs, contact repeater (`FieldArray`), **Brochure upload (PDF ≤ 10 MB)** | required fields & file size         |
| 2    | **Requirement Details** – Locations chip input, Sector select, **Site Size slider**, Use Class select         | ≥ 1 location *or* Nationwide toggle |
| 3    | **Gallery & Logo** – drag‑drop image grid, logo upload                                                        | optional                            |
| 4    | **FAQs** – dynamic accordion to add Q\&A pairs                                                                | optional                            |
| 5    | **Review & Publish** – Read‑only summary, **Back** / **Publish** buttons                                      | Final form isValid                  |

Progress indicator: `Steps` component (horizontal on desktop, vertical mobile).

---

## 5. Admin Review & Management

| Screen                | Elements                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Queue Table**       | columns: Company · Sector · Submitted · Status · **Admin Actions** (`Preview`, `Edit`, `Archive`, `Delete`) |
| **Preview Drawer**    | same as public drawer + Admin notes textarea                                                                |
| **Decision workflow** | Approve → status Approved; Reject → modal "Add rejection reason" (rich‑text)                                |

> **Global note:** Admin edits go live immediately; archived listings are hidden from search but retained for audit; deleted listings hard‑delete the record and media from storage.

---

## 6. Interaction Details

* **Search debounce:** 300 ms.
* **Infinite scroll threshold:** fetch next page when 80 % scroll.
* **Pin‑to‑card sync:** hover (desktop) or tap (mobile) pin → highlights respective card; card hover → bounces pin.
* **Animations:** Framer Motion fade‑in cards, slide‑over filters.
* **Loading states:** Skeleton cards, shimmer list.

---

## 7. Assets

* Placeholder logo SVG provided in Figma.
* Chip icon uses lucide `MapPin`.
* Modal close icon uses lucide `X`.

---

## 8. Next Steps

1. Convert spec to low‑fidelity wireframes (Figma frames, \~12‑15 screens).
2. Conduct quick hallway test with 3 internal users for flow clarity.
3. Hand Figma to Front‑end devs with component annotations.

---

*Prepared by BMAD UX Expert. Feedback welcome.*
