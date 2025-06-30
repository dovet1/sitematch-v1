# 4. API Surface

## 4.1 Public Anonymous (Service‑role, read‑only)

* `GET /rpc/search_listings` – parameters: `lat? lon? radius? nationwide? sector_ids[]? size_min? size_max? use_class_ids[]? company? page?`
* `GET /listings/:id` – full detail for drawer

## 4.2 Authenticated Occupier

* `POST /listings` – create draft (Step 1)
* `PUT /listings/:id` – update any step
* `POST /listings/:id/publish` – mark pending
* `POST /media/upload_signed_url` – obtain signed S3 URL (images, brochure)

## 4.3 Admin

* `PATCH /admin/listings/:id` – edit
* `POST /admin/listings/:id/approve`
* `POST /admin/listings/:id/reject`

*Implementation*: Next.js Route Handlers proxy to `@supabase/edge-runtime` client using service and user JWTs.

---
