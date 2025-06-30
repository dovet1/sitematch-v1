# SiteMatch – Product Backlog & Sprint Plan (MVP)

*Prepared by BMAD PO – v1.1 · 30 June 2025*

---

## 0. Delivery Approach

* **Methodology:** Scrum · two 10‑day sprints → **code‑freeze 21 Jul 2025**.
* **Team velocity:** \~20 story points / sprint (2 full‑stack engineers + 1 UX/dev‑rel).
* **Definition of Done (DoD):**

  1. Acceptance criteria met in staging.
  2. Unit + integration tests ≥ 80 % coverage.
  3. Accessibility audit passes WCAG 2.2 AA.
  4. Security scan (RLS, OWASP ZAP) clean.
  5. Vercel preview & Supabase migrations green; product owner sign‑off.

---

## 1. Epics (derived from PRD v0.3, UX spec v0.2 & Architecture v0.1)

| Epic ID | Name                      | Goal                                                   |
| ------- | ------------------------- | ------------------------------------------------------ |
| **E‑1** | Platform & Infrastructure | Repo scaffolding, Supabase project, CI/CD, Auth, RLS   |
| **E‑2** | Occupier Listing Wizard   | 5‑step form incl. brochure, chips, double‑thumb slider |
| **E‑3** | Public Search & Map       | Search bar + filters, list & map with clustering       |
| **E‑4** | Listing Detail Drawer     | Full‑screen drawer preserving filter state             |
| **E‑5** | Lead Capture & Digest     | Email‑capture modal + daily digest cron                |
| **E‑6** | Occupier Dashboard        | Table with Preview/Edit/Archive/Delete actions         |
| **E‑7** | Admin Moderation          | Approve / Reject / Archive flow & audit trail          |
| **E‑8** | Monitoring & Perf         | Lighthouse budget, Sentry, Logflare, analytics         |

---

## 2. Product Backlog (prioritised)

| ID        | Epic | Title                                    | Acceptance Criteria (summary)                                | Pts | Sprint |
| --------- | ---- | ---------------------------------------- | ------------------------------------------------------------ | --- | ------ |
| **US‑1**  | E‑1  | Mono‑repo & CI/CD scaffold               | Turborepo w/ `/apps/web`, `/supabase`; Vercel preview on PR  | 2   | 1      |
| **US‑2**  | E‑1  | Supabase project initialised             | Postgres, Auth, Storage buckets; env vars committed          | 3   | 1      |
| **US‑3**  | E‑1  | Core DB schema & migrations              | Tables per ERD; Prisma client generated                      | 3   | 1      |
| **US‑4**  | E‑1  | Auth flow & RLS policies                 | Magic‑link sign‑in; public read‑only; tests pass             | 3   | 1      |
| **US‑5**  | E‑2  | Wizard Step 1 – Company & Brochure       | Required fields + ≤ 10 MB PDF upload                         | 3   | 1      |
| **US‑6**  | E‑2  | Wizard Step 2 – Requirement Details      | Locations chip input, sector, use‑class, double‑thumb slider | 5   | 1      |
| **US‑7**  | E‑6  | Occupier Dashboard (table + actions)     | Preview/Edit/Archive/Delete with RLS                         | 1   | 1      |
| **US‑8**  | E‑3  | Public search bar & filters              | Debounced fetch; URL state; nation‑wide toggle               | 5   | 2      |
| **US‑9**  | E‑3  | Map view with clustering & pin‑card sync | Clusters zoom; pin tap ↔ card stack                          | 3   | 2      |
| **US‑10** | E‑4  | Listing Detail Drawer                    | Drawer with brochure preview; close restores state           | 3   | 2      |
| **US‑11** | E‑5  | Email‑capture modal & leads table        | Modal prompts once/30 d; POST to `leads`                     | 2   | 2      |
| **US‑12** | E‑5  | Daily digest email cron                  | Resend job 09:00; unsubscribe link                           | 1   | 2      |
| **US‑13** | E‑7  | Admin Queue table & actions              | Approve / Reject (with reason) / Archive                     | 3   | 2      |
| **US‑14** | E‑8  | Perf budget & monitoring                 | LCP < 2 s; Sentry web vitals; alerts configured              | 2   | 2      |

*Total points:* **Sprint 1 → 20**, **Sprint 2 → 20**

---

## 3. Sprint Schedule & Ceremonies

### Sprint 1 (01 Jul – 10 Jul 2025)

| Day    | Ceremony              | Notes                          |
| ------ | --------------------- | ------------------------------ |
| 01 Jul | Sprint Planning       | Confirm scope US‑1 → US‑7      |
| Daily  | Stand‑up (09:30 BST)  | 15 min                         |
| 08 Jul | Mid‑sprint Review     | UX + PM demo Wizard Step 2     |
| 10 Jul | Sprint Review & Retro | Stakeholder demo, retro 30 min |

### Sprint 2 (11 Jul – 21 Jul 2025)

| Day    | Ceremony                      | Notes                    |
| ------ | ----------------------------- | ------------------------ |
| 11 Jul | Planning                      | Pull US‑8 → US‑14        |
| Daily  | Stand‑up                      |                          |
| 18 Jul | Hardening Day                 | Bug bash, perf tuning    |
| 21 Jul | Review, **Code‑freeze 17:00** | Release candidate tagged |

---

## 4. Release Checklist

1. All user stories marked **Done** (DoD).
2. CI pipelines green; production build equals staging.
3. **E2E tests (Cypress)** critical path ≥ 95 % pass.
4. Lighthouse **Performance ≥ 90** (mobile) on Home, Browse, Drawer.
5. WCAG 2.2 AA audit pass via axe‑core + manual SR.
6. Security scan (OWASP ZAP) no High/Medium issues.
7. Database backups verified in Supabase.
8. Resend email domain DKIM/SPF valid.
9. SSL cert active; HTTP→HTTPS redirect enforced.
10. Smoke test on production URL (create listing, browse, drawer).
11. Admin seeds ≥ 5 approved listings.
12. Marketing email & social posts scheduled.
13. Post‑launch retro booked **28 Jul 2025**.

---

*Scope aligned with PRD v0.3, UX Wireframes v0.2 & Architecture v0.1.*

## 6. Design System – “Violet Bloom” Theme

*Adopted from tweakcn tokens supplied by stakeholder (30 Jun 2025).*
A full token set is defined in **`/styles/index.css`** (see extract below). All shadcn/ui + Tailwind components must reference these CSS custom properties.

```css
:root {
  --background: oklch(0.9940 0 0);
  --foreground: oklch(0 0 0);
  --card: oklch(0.9940 0 0);
  --card-foreground: oklch(0 0 0);
  --popover: oklch(0.9911 0 0);
  --popover-foreground: oklch(0 0 0);
  --primary: oklch(0.5393 0.2713 286.7462);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9540 0.0063 255.4755);
  --secondary-foreground: oklch(0.1344 0 0);
  --muted: oklch(0.9702 0 0);
  --muted-foreground: oklch(0.4386 0 0);
  --accent: oklch(0.9393 0.0288 266.3680);
  --accent-foreground: oklch(0.5445 0.1903 259.4848);
  --destructive: oklch(0.6290 0.1902 23.0704);
  --destructive-foreground: oklch(1.0000 0 0);
  /* …additional tokens trimmed for brevity… */
}

.dark {
  --background: oklch(0.2223 0.0060 271.1393);
  --foreground: oklch(0.9551 0 0);
  --card: oklch(0.2568 0.0076 274.6528);
  /* …dark‑mode overrides… */
}
```

### Usage guidelines

| Layer                | Rule                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| **Tokens**           | Import `index.css` globally in `_app.tsx`; Tailwind utilities reference via `[color:var(--primary)]` etc. |
| **Components**       | Extend shadcn/ui `button`, `badge`, `input` variants to consume the theme (e.g., `variant="primary"`).    |
| **Data‑vis**         | Use `--chart‑1 … --chart‑5` for Mapbox cluster and charts.                                                |
| **Radius & shadows** | Respect `--radius‑md` (12 px) for cards/drawers; shadows from token set.                                  |
| **Typography**       | Sans: Plus Jakarta Sans; Serif: Lora; Mono: IBM Plex Mono (already loaded via Google Fonts).              |

> **Accessibility check:** Colour contrast of primary (#6F5AFF approx) vs white passes WCAG AA (4.6 : 1). Maintain > 3 : 1 for text on accent backgrounds.

This section supersedes the earlier placeholder palette. Engineering to integrate tokens in Sprint 1 story **US‑1** (repo scaffold) and **US‑5** (Wizard Step 1 UI).
