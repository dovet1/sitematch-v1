# 3. Listing Creation Wizard (Occupier)

Multi‑step flow implemented with React Hook Form. **Organization is auto-created** from company information during wizard submission for streamlined onboarding.

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

## 3.3 Organization Auto-Creation

**Streamlined Onboarding**: When an occupier submits their first listing, the system automatically:

1. **Creates organization** from company name provided in wizard
2. **Handles duplicate names** by appending numbers (e.g., "Acme Corp (2)")  
3. **Assigns user** to newly created organization
4. **Associates listing** with the organization

This eliminates the need for separate organization setup, reducing friction and improving conversion rates.

**Error Handling**: If organization creation fails, the entire listing submission fails to maintain data integrity.

---
