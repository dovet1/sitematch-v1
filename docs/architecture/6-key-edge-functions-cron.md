# 6. Key Edge Functions / Cron

| Function             | Trigger                         | Purpose                                             |
| -------------------- | ------------------------------- | --------------------------------------------------- |
| `auto_create_org`    | listing submission              | Auto-create organization with duplicate handling     |
| `email_alerts`       | `cron '* * * * *'` (every hour) | Send new/updated listing notifications to Pro users |
| `expire_listings`    | daily 02:00                     | Auto‑archive listings > 90 days old                 |
| `parse_brochure_pdf` | storage `object_created`        | Extract text & auto‑fill FAQ suggestions (future)   |

---
