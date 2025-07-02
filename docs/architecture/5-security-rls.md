# 5. Security & RLS

| Table              | Policy                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| listings           | Occupier can `select/update` rows where `org_id = current_setting('request.jwt.org_id')`; public can `select` only `status='approved'`; admin full access |
| listing\_locations | Same as listings                                                                                                                                          |
| organisations        | Users can `insert` for auto-creation; `select/update` where `id = current_setting('request.jwt.org_id')`; admin full access                               |
| organization\_audit  | `insert` allowed for authenticated users; `select` restricted to admin and org members                                                                     |
| leads              | `insert` allowed for anon; `select` restricted to admin                                                                                                   |

Supabase **row‑level security** and **JWT custom claims** ensure minimal surface area.

---
