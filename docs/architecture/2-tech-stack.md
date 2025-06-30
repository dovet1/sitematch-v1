# 2. Tech Stack

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
