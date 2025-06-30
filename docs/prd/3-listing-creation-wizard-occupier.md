# 3. Listing Creation Wizard (Occupier)

Multi‑step flow implemented with React Hook Form.

## 3.1 Required fieldsfileciteturn4file0L19-L28

1. **Company name**
2. **Requirements brochure (PDF)**
3. ≥ 1 **contact** (name, title, phone, email)

## 3.2 Optional fields (all **dropdown / controlled** except sliders & uploads)fileciteturn4file0L31-L44

| Field                  | Input Type                                                                                                                                                                                                                | Notes |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Company logo           | file‑upload                                                                                                                                                                                                               |       |
| **Locations**          | **search‑as‑you‑type input** (Mapbox Places autocomplete for UK & Ireland towns/cities) with selected items rendered as removable **chips** (see screenshot); multi‑add supported; **“Nationwide”** toggle disables chips |       |
| **Sector**             | dropdown – *Retail / Food & Beverage / Leisure / Industrial & Logistics / Office / Healthcare / Automotive / Roadside / Other*                                                                                            |       |
| **Planning Use Class** | dropdown – *E(a) Retail, E(b) Café/Restaurant, E(g)(i) Office, E(g)(iii) Light Industrial, B2 General Industrial, B8 Storage/Distribution, C1 Hotel, Sui Generis (Drive‑thru, Petrol, Cinema, Casino, etc.)*              |       |
| **Site Size**          | double‑thumb **slider** (min + max sq ft)                                                                                                                                                                                 |       |
| FAQs                   | accordion rich‑text                                                                                                                                                                                                       |       |
| Site / Store plan      | doc/PDF uploads                                                                                                                                                                                                           |       |
| Example fit‑outs       | image/video gallery                                                                                                                                                                                                       |       |

Validation: all required fields block progression; optional fields clearly labelled.

---
