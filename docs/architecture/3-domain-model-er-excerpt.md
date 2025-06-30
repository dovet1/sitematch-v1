# 3. Domain Model (ER excerpt)

```
users (id PK, email, role {occupier|landlord|admin}, org_id FK, created_at)
organisations (id PK, name, type {occupier|landlord|agent}, logo_url)
listings (id PK, org_id FK, title, brochure_url, site_size_min, site_size_max,
          sector_id FK, use_class_id FK, status {draft|pending|approved|archived|deleted},
          created_by FK(users), created_at, updated_at)
listing_locations (id PK, listing_id FK, town, county, lat, lon)
faqs (id PK, listing_id FK, q, a)
media_files (id PK, listing_id FK, url, type {image|pdf})
leads (id PK, email, persona {agent|investor|landlord|vendor}, created_at)
admin_actions (id PK, listing_id FK, admin_id FK(users), action, reason, created_at)
```

*Composite indexes*: `gin(listing_locations geom)` for radius queries; `btree(listings.status, listings.updated_at)` for feeds.

---
