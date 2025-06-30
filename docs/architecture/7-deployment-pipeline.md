# 7. Deployment Pipeline

1. PR merge → Vercel preview; Supabase migration via **supabase db push**.
2. Main → production; Vercel promotes build, runs smoke test.
3. Supabase edge functions auto‑deploy; Slack webhook on success/fail.

Environment variables managed via Vercel & Supabase dashboards (secrets synced using Turborepo pipeline).

---
