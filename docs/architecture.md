# SiteMatch – Architecture Specification (MVP)

*Version 0.1 – 30 June 2025*

---

## 1. Overview

SiteMatch MVP will be delivered as a **serverless full‑stack application** combining a Next.js front‑end with a Supabase back‑end (Postgres, Auth, Storage, Edge Functions).  All services are **multi‑tenant** but scoped to the UK & Ireland market.

![High‑level diagram](link-to-lucid-or-figma-diagram)

**Key tenets**

* **Speed to market ≤ 3 weeks** → heavy use of managed services (Supabase, Vercel, Resend, Mapbox).
* **Single repo, mono‑repo** (Turborepo): `/apps/web` (Next.js) + `/packages/db` (Prisma schema) + `/supabase` (migrations & edge functions).
* **Security first**: Supabase RLS + row‑level tenant isolation; public read‑only search via limited service role; admin actions guarded by JWT role claims.

---

## 2. Tech Stack

| Layer        | Technology                                                               | Rationale                                           |
| ------------ | ------------------------------------------------------------------------ | --------------------------------------------------- |
| Front‑end    | Next.js 14 (App Router), React 18, shadcn/ui, TailwindCSS, Framer Motion | Fast DX, SSR/ISR, component library matches UX spec |
| Auth         | Supabase Auth (magic‑link + OAuth)                                       | Built‑in Postgres auth tables, serverless           |
| Database     | Supabase Postgres 16                                                     | SQL + RLS; free tier OK for MVP                     |
| File storage | Supabase Storage (S3‑compatible)                                         | Brochures, images                                   |
| Search       | Postgres **pg\_trgm** + PostGIS + Supabase Vector (future)               | Text & geo search without external service          |
| Mapping      | Mapbox GL JS + Places API                                                | Autocomplete & interactive map                      |
| Email        | Resend (transactional)                                                   | Magic links, alerts, admin notifications            |
| Hosting      | Vercel (web) + Supabase (db/functions)                                   | CI/CD & previews                                    |
| Monitoring   | Vercel Analytics, Supabase Logs, Sentry                                  | Error & perf insights                               |

---

## 3. Domain Model (ER excerpt)

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

## 4. API Surface

### 4.1 Public Anonymous (Service‑role, read‑only)

* `GET /rpc/search_listings` – parameters: `lat? lon? radius? nationwide? sector_ids[]? size_min? size_max? use_class_ids[]? company? page?`
* `GET /listings/:id` – full detail for drawer

### 4.2 Authenticated Occupier

* `POST /listings` – create draft (Step 1)
* `PUT /listings/:id` – update any step
* `POST /listings/:id/publish` – mark pending
* `POST /media/upload_signed_url` – obtain signed S3 URL (images, brochure)

### 4.3 Admin

* `PATCH /admin/listings/:id` – edit
* `POST /admin/listings/:id/approve`
* `POST /admin/listings/:id/reject`

*Implementation*: Next.js Route Handlers proxy to `@supabase/edge-runtime` client using service and user JWTs.

---

## 5. Security & RLS

| Table              | Policy                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| listings           | Occupier can `select/update` rows where `org_id = current_setting('request.jwt.org_id')`; public can `select` only `status='approved'`; admin full access |
| listing\_locations | Same as listings                                                                                                                                          |
| leads              | `insert` allowed for anon; `select` restricted to admin                                                                                                   |

Supabase **row‑level security** and **JWT custom claims** ensure minimal surface area.

---

## 6. Key Edge Functions / Cron

| Function             | Trigger                         | Purpose                                             |
| -------------------- | ------------------------------- | --------------------------------------------------- |
| `email_alerts`       | `cron '* * * * *'` (every hour) | Send new/updated listing notifications to Pro users |
| `expire_listings`    | daily 02:00                     | Auto‑archive listings > 90 days old                 |
| `parse_brochure_pdf` | storage `object_created`        | Extract text & auto‑fill FAQ suggestions (future)   |

---

## 7. Deployment Pipeline

1. PR merge → Vercel preview; Supabase migration via **supabase db push**.
2. Main → production; Vercel promotes build, runs smoke test.
3. Supabase edge functions auto‑deploy; Slack webhook on success/fail.

Environment variables managed via Vercel & Supabase dashboards (secrets synced using Turborepo pipeline).

---

## 8. Monitoring & Observability

* **Frontend**: Sentry (error) + Vercel Analytics (performance, Web Vitals).
* **Backend**: Supabase Logs, pg\_stat\_statements, Logflare integration.
* **Alerts**: PagerDuty on HTTP 5xx spike, cron job failures.

---

## 9. Sprint Technical Breakdown (10‑day ×2)

| Story                             | Effort | Sprint |
| --------------------------------- | ------ | ------ |
| Repo scaffolding, CI/CD           | 2 pts  | 1      |
| DB schema & RLS                   | 3 pts  | 1      |
| Auth flow (magic link)            | 2 pts  | 1      |
| Listing Wizard FE                 | 5 pts  | 1‑2    |
| Browse/Search page + filters      | 5 pts  | 1‑2    |
| Map view & clustering             | 3 pts  | 2      |
| Listing drawer                    | 3 pts  | 2      |
| Email‑capture modal & leads table | 2 pts  | 2      |
| Admin dashboard CRUD              | 3 pts  | 2      |
| Cron email alerts                 | 2 pts  | 2      |

Velocity assumed **20 pts / sprint** (2 devs).

---

## 10. Risks & Mitigations (Arch‑level)

| Risk                          | Likelihood | Mitigation                                             |
| ----------------------------- | ---------- | ------------------------------------------------------ |
| Supabase free tier limits hit | Medium     | Enable pay‑as‑you‑go after load test                   |
| Mapbox rate limits            | Low        | Cache autocomplete; use static tile CDN                |
| Clustering performance        | Low        | Use `supercluster` lib + PostGIS ST\_Cluster within DB |
| PDF extraction complexity     | Medium     | Postpone to V2; keep manual FAQ input                  |

---

*Prepared by BMAD Architect. Ready for team review & ticket implementation.*
