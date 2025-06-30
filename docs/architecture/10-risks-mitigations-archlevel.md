# 10. Risks & Mitigations (Arch‑level)

| Risk                          | Likelihood | Mitigation                                             |
| ----------------------------- | ---------- | ------------------------------------------------------ |
| Supabase free tier limits hit | Medium     | Enable pay‑as‑you‑go after load test                   |
| Mapbox rate limits            | Low        | Cache autocomplete; use static tile CDN                |
| Clustering performance        | Low        | Use `supercluster` lib + PostGIS ST\_Cluster within DB |
| PDF extraction complexity     | Medium     | Postpone to V2; keep manual FAQ input                  |

---

*Prepared by BMAD Architect. Ready for team review & ticket implementation.*
