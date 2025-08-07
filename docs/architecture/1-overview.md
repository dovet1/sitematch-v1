# 1. Overview

SiteMatcher MVP will be delivered as a **serverless full‑stack application** combining a Next.js front‑end with a Supabase back‑end (Postgres, Auth, Storage, Edge Functions).  All services are **multi‑tenant** but scoped to the UK & Ireland market.

![High‑level diagram](link-to-lucid-or-figma-diagram)

**Key tenets**

* **Speed to market ≤ 3 weeks** → heavy use of managed services (Supabase, Vercel, Resend, Mapbox).
* **Single repo, mono‑repo** (Turborepo): `/apps/web` (Next.js) + `/packages/db` (Prisma schema) + `/supabase` (migrations & edge functions).
* **Security first**: Supabase RLS + row‑level tenant isolation; public read‑only search via limited service role; admin actions guarded by JWT role claims.

---
