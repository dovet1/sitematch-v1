# 4. Public Directory & Search

## 4.1 Filters & Search Bar

* **Location search (Mapbox Places)** – type postcode/address → geocode → return listings where the entered point lies inside any stored listing location polygon **OR** include listings flagged “Nationwide”.
* **Sector** (multi‑select dropdown)
* **Site Size** (min / max sq ft numeric inputs)
* **Company Name** (text search)
* **Planning Use Class** (multi‑select dropdown)

\*(Nationwide tab replicates incumbent behaviour for requirements that are location‑agnostic.)\*fileciteturn4file0L92-L96

## 4.2 Results UI

* Listings feed (cards) + optional map view (pins omit Nationwide).
* **Infinite scroll** or “Load more”, ordered *newest › oldest* by default.

## 4.3 Listing Detail Drawer

* Clicking a card opens **full‑screen modal/drawer** containing: brochure preview, image gallery, video player, contact cards (tap‑to‑email/call), and metadata chips.
* **Close (X)** returns user to the previous results state (filters, scroll position, map zoom) via React Router history + state preservation hook.

---
