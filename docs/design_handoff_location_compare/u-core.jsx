/* GapFinder — Unified Workspace · core
   Mock data + small shared atoms. Reuses SS / SA tokens, Ico, AIco from the
   sitesketcher / siteanalyser cores (identical palette to the homepage system). */

/* ---- Brand palette (logo initials + colour) ---------------------------- */
const U_BRANDS = [
  { name: "Allpress Espresso", initials: "AE", color: "#6F4A2E", sector: "Food & Beverage", stores: 847 },
  { name: "Goodhood",          initials: "GH", color: "#171419", sector: "Retail",          stores: 1240 },
  { name: "ShakeDown",         initials: "SD", color: "#E8B22A", sector: "Food & Beverage", stores: 532 },
  { name: "Card Factory",      initials: "CF", color: "#2A5DD1", sector: "Retail",          stores: 218 },
  { name: "The Entertainer",   initials: "TE", color: "#E0392F", sector: "Retail",          stores: 164 },
  { name: "Knoops",            initials: "K",  color: "#1F1A14", sector: "Food & Beverage", stores: 92 },
  { name: "Pret A Manger",     initials: "P",  color: "#7A1F2E", sector: "Food & Beverage", stores: 460 },
  { name: "Rituals",           initials: "R",  color: "#2C3F2A", sector: "Health & Beauty", stores: 210 },
];
const U_BRAND_BY_NAME = Object.fromEntries(U_BRANDS.map(b => [b.name, b]));

/* ---- Presence-filter taxonomy -----------------------------------------
   Anchor / comparison retailers you filter *against* — “show me towns that
   contain (or lack, or sit within N km of) this category / brand / fascia”.
   Brands carry their individual fascias so agents can target e.g. an
   Asda Local specifically rather than any Asda. */
const U_FILTER_CATEGORIES = ["Grocery", "Convenience", "Food & Beverage", "Retail", "Health & Beauty", "Leisure", "Discount"];
const U_FILTER_BRANDS = [
  { name: "Asda",         cat: "Grocery",         fascias: ["Asda Superstore", "Asda Supermarket", "Asda Local", "Asda Express"] },
  { name: "Tesco",        cat: "Grocery",         fascias: ["Tesco Extra", "Tesco Superstore", "Tesco Metro", "Tesco Express"] },
  { name: "Sainsbury's",  cat: "Grocery",         fascias: ["Sainsbury's Supermarket", "Sainsbury's Local"] },
  { name: "Aldi",         cat: "Discount",        fascias: ["Aldi", "Aldi Local"] },
  { name: "M&S",          cat: "Retail",          fascias: ["M&S", "M&S Foodhall", "M&S Simply Food"] },
  { name: "Greggs",       cat: "Food & Beverage", fascias: ["Greggs"] },
  { name: "Costa",        cat: "Food & Beverage", fascias: ["Costa Coffee", "Costa Express"] },
  { name: "Pret A Manger",cat: "Food & Beverage", fascias: ["Pret A Manger"] },
  { name: "Boots",        cat: "Health & Beauty", fascias: ["Boots", "Boots Pharmacy"] },
  { name: "Primark",      cat: "Retail",          fascias: ["Primark"] },
  { name: "Nando's",      cat: "Leisure",         fascias: ["Nando's"] },
  { name: "The Gym Group",cat: "Leisure",         fascias: ["The Gym Group"] },
];
const U_FILTER_FASCIAS = U_FILTER_BRANDS.flatMap(b => b.fascias.map(f => ({ fascia: f, brand: b.name, cat: b.cat })));
const U_FILTER_OPTIONS = {
  category: U_FILTER_CATEGORIES.map(c => ({ value: c, label: c })),
  brand:    U_FILTER_BRANDS.map(b => ({ value: b.name, label: b.name, sub: b.cat })),
  fascia:   U_FILTER_FASCIAS.map(f => ({ value: f.fascia, label: f.fascia, sub: f.brand })),
};

/* ---- Built-up areas (opportunity candidates) --------------------------- */
/* x / y are % positions on the UK map canvas. */
const U_BUAS = [
  { id: "manchester", name: "Manchester", region: "ENGLAND", x: 38, y: 43, pop: 470405, households: 211900, affluence: 47.8, gap: "High", missing: 12, stores: 36, reqLocal: 5, reqNation: 9, traffic: 88 },
  { id: "birmingham", name: "Birmingham", region: "ENGLAND", x: 42, y: 57, pop: 1121375, households: 433100, affluence: 44.2, gap: "High", missing: 9, stores: 58, reqLocal: 7, reqNation: 9, traffic: 92 },
  { id: "glasgow",    name: "Glasgow",    region: "SCOTLAND", x: 33, y: 30, pop: 612444, households: 285000, affluence: 42.6, gap: "Med", missing: 14, stores: 41, reqLocal: 3, reqNation: 9, traffic: 79 },
  { id: "leeds",      name: "Leeds",      region: "ENGLAND", x: 41, y: 37, pop: 504713, households: 224300, affluence: 49.1, gap: "High", missing: 8, stores: 33, reqLocal: 4, reqNation: 9, traffic: 81 },
  { id: "sheffield",  name: "Sheffield",  region: "ENGLAND", x: 42, y: 42, pop: 500535, households: 230400, affluence: 46.3, gap: "Med", missing: 11, stores: 28, reqLocal: 2, reqNation: 9, traffic: 70 },
  { id: "liverpool",  name: "Liverpool",  region: "ENGLAND", x: 36, y: 44, pop: 506565, households: 233100, affluence: 43.9, gap: "Med", missing: 10, stores: 31, reqLocal: 4, reqNation: 9, traffic: 76 },
  { id: "bristol",    name: "Bristol",    region: "ENGLAND", x: 36, y: 65, pop: 425215, households: 196400, affluence: 55.4, gap: "High", missing: 7, stores: 27, reqLocal: 6, reqNation: 9, traffic: 74 },
  { id: "edinburgh",  name: "Edinburgh",  region: "SCOTLAND", x: 37, y: 24, pop: 458492, households: 233200, affluence: 58.2, gap: "Med", missing: 9, stores: 35, reqLocal: 5, reqNation: 9, traffic: 72 },
  { id: "leicester",  name: "Leicester",  region: "ENGLAND", x: 44, y: 53, pop: 406580, households: 158900, affluence: 41.7, gap: "Low", missing: 13, stores: 22, reqLocal: 1, reqNation: 9, traffic: 64 },
  { id: "cardiff",    name: "Cardiff",    region: "WALES",    x: 35, y: 67, pop: 335145, households: 148600, affluence: 50.3, gap: "Med", missing: 10, stores: 24, reqLocal: 3, reqNation: 9, traffic: 68 },
  { id: "coventry",   name: "Coventry",   region: "ENGLAND", x: 43, y: 55, pop: 352911, households: 137200, affluence: 43.1, gap: "Low", missing: 12, stores: 19, reqLocal: 2, reqNation: 9, traffic: 60 },
  { id: "croydon",    name: "Croydon",    region: "ENGLAND", x: 46, y: 73, pop: 377211, households: 152800, affluence: 52.0, gap: "Med", missing: 8, stores: 26, reqLocal: 4, reqNation: 9, traffic: 83 },
];
const U_BUA_BY_ID = Object.fromEntries(U_BUAS.map(b => [b.id, b]));

/* ---- Stores trading near the focus area (Manchester) ------------------- */
/* mx / my are % positions on the local (zoomed) map. */
const U_STORES = [
  { id: "s1", brand: "Allpress Espresso", mx: 44, my: 40, dist: "0.4 km", addr: "12 Tib Street, M4 1LX",
    occupier: { format: "Coffee bar", openedYear: 2021, units: 9, fascia: "Allpress Espresso UK" },
    agents: [{ name: "Maya Okafor", role: "Head of Expansion", org: "Allpress UK", email: "maya.okafor@allpress.co.uk", phone: "+44 7700 900142" },
             { name: "Stance Retail", role: "Acquiring agent", email: "deals@stance.london", phone: "+44 20 7946 0813" }] },
  { id: "s2", brand: "Goodhood", mx: 52, my: 47, dist: "0.7 km", addr: "8 Spring Gardens, M2 1EA",
    occupier: { format: "Lifestyle store", openedYear: 2019, units: 14, fascia: "Goodhood Ltd" },
    agents: [{ name: "Tom Bridgeford", role: "Property Director", org: "Goodhood", email: "tom@goodhood.co", phone: "+44 7700 900287" }] },
  { id: "s3", brand: "ShakeDown", mx: 40, my: 54, dist: "1.1 km", addr: "55 Oldham St, M1 1JR",
    occupier: { format: "QSR / dessert", openedYear: 2022, units: 7, fascia: "ShakeDown Group" },
    agents: [{ name: "Priya Nandra", role: "Roll-out Manager", org: "ShakeDown", email: "priya@shakedown.com", phone: "+44 7700 900471" }] },
  { id: "s4", brand: "Card Factory", mx: 58, my: 38, dist: "1.4 km", addr: "Arndale Centre, M4 3AQ",
    occupier: { format: "Greeting cards", openedYear: 2017, units: 3, fascia: "Card Factory plc" },
    agents: [{ name: "Estate Team", role: "Acquisitions", org: "Card Factory", email: "property@cardfactory.co.uk", phone: "+44 1924 839 200" }] },
  { id: "s5", brand: "Pret A Manger", mx: 49, my: 33, dist: "1.6 km", addr: "King Street, M2 4LQ",
    occupier: { format: "Coffee / food-to-go", openedYear: 2018, units: 5, fascia: "Pret A Manger" },
    agents: [{ name: "James Whitcombe", role: "Acquisitions Surveyor", org: "CBRE (for Pret)", email: "james.whitcombe@cbre.com", phone: "+44 20 7182 2000" }] },
  { id: "s6", brand: "Knoops", mx: 60, my: 55, dist: "2.2 km", addr: "Deansgate, M3 4LY",
    occupier: { format: "Chocolate bar", openedYear: 2023, units: 4, fascia: "Knoops" },
    agents: [{ name: "Cassia Reed", role: "Expansion Lead", org: "Knoops", email: "cassia@knoops.co.uk", phone: "+44 7700 900663" }] },
  { id: "s7", brand: "The Entertainer", mx: 33, my: 46, dist: "2.7 km", addr: "Trafford Centre, M17 8AA",
    occupier: { format: "Toys", openedYear: 2016, units: 6, fascia: "The Entertainer (TEAL)" },
    agents: [{ name: "Acquisitions Desk", role: "Property", org: "The Entertainer", email: "sites@thetoyshop.com", phone: "+44 1494 459 459" }] },
  { id: "s8", brand: "Rituals", mx: 47, my: 60, dist: "3.1 km", addr: "St Ann's Square, M2 7HA",
    occupier: { format: "Cosmetics", openedYear: 2020, units: 8, fascia: "Rituals Cosmetics" },
    agents: [{ name: "Lena Friis", role: "Country Expansion", org: "Rituals UK", email: "lfriis@rituals.com", phone: "+44 20 3608 1100" }] },
  { id: "s9",  brand: "Goodhood",     mx: 28, my: 58, dist: "3.6 km", addr: "Chorlton, M21 9PN", occupier: { format: "Lifestyle store", openedYear: 2021, units: 14, fascia: "Goodhood Ltd" }, agents: [{ name: "Tom Bridgeford", role: "Property Director", org: "Goodhood", email: "tom@goodhood.co", phone: "+44 7700 900287" }] },
  { id: "s10", brand: "ShakeDown",    mx: 66, my: 44, dist: "3.9 km", addr: "Ancoats, M4 6DE", occupier: { format: "QSR / dessert", openedYear: 2022, units: 7, fascia: "ShakeDown Group" }, agents: [{ name: "Priya Nandra", role: "Roll-out Manager", org: "ShakeDown", email: "priya@shakedown.com", phone: "+44 7700 900471" }] },
  { id: "s11", brand: "Card Factory", mx: 24, my: 38, dist: "4.4 km", addr: "Salford, M3 6AB", occupier: { format: "Greeting cards", openedYear: 2017, units: 3, fascia: "Card Factory plc" }, agents: [{ name: "Estate Team", role: "Acquisitions", org: "Card Factory", email: "property@cardfactory.co.uk", phone: "+44 1924 839 200" }] },
  { id: "s12", brand: "Pret A Manger",mx: 70, my: 62, dist: "4.8 km", addr: "MediaCity, M50 2EQ", occupier: { format: "Coffee / food-to-go", openedYear: 2018, units: 5, fascia: "Pret A Manger" }, agents: [{ name: "James Whitcombe", role: "Acquisitions Surveyor", org: "CBRE (for Pret)", email: "james.whitcombe@cbre.com", phone: "+44 20 7182 2000" }] },
];

/* ---- Brands MISSING from the focus area -------------------------------- */
/* The headline of a gap opportunity: who *isn't* here but should be. */
const U_MISSING = [
  { name: "Gail's",        initials: "G",  color: "#3A2F26", sector: "Food & Beverage", fit: "Strong", ukStores: 140, nearest: "Leeds · 71 km", lastOpened: "18 Jun 2026 · Harrogate", note: "Premium bakery chain expanding fast across northern city centres; affluence and footfall here match its top-decile catchments.", demand: "Actively acquiring — 20+ sites signed in 2025." },
  { name: "Five Guys",     initials: "5G", color: "#C8102E", sector: "Food & Beverage", fit: "Strong", ukStores: 170, nearest: "Trafford Centre · 9 km", lastOpened: "2 May 2026 · Sheffield", note: "Present in the region but absent from the city core. High daytime and evening footfall supports a flagship QSR unit.", demand: "Open to prime pitches of 3,000–4,500 sq ft." },
  { name: "Wagamama",      initials: "W",  color: "#E4002B", sector: "Food & Beverage", fit: "Strong", ukStores: 165, nearest: "Leeds · 71 km", lastOpened: "29 Apr 2026 · Nottingham", note: "No presence within the built-up area despite a dense student and young-professional population that indexes highly for the brand.", demand: "Nationwide requirement live on the market." },
  { name: "Lush",          initials: "L",  color: "#1A1A1A", sector: "Health & Beauty", fit: "Strong", ukStores: 100, nearest: "Liverpool · 55 km", lastOpened: "11 Mar 2026 · Chester", note: "Handmade cosmetics retailer with a young, values-led shopper base well represented in this catchment.", demand: "Selective — flagship high-street pitches only." },
  { name: "Sweaty Betty",  initials: "SB", color: "#E5308A", sector: "Retail",          fit: "Good",   ukStores: 65,  nearest: "Leeds · 71 km", lastOpened: "24 Feb 2026 · York", note: "Premium activewear brand targeting affluent female shoppers; the area's affluence score sits above its acquisition threshold.", demand: "Growing UK estate; 5–8 openings a year." },
  { name: "Joe & The Juice",initials: "J", color: "#111111", sector: "Food & Beverage",fit: "Good",   ukStores: 55,  nearest: "Manchester Airport · 14 km", lastOpened: "7 Apr 2026 · Leeds", note: "Health-focused juice and coffee bar suited to commuter and office footfall around the core.", demand: "Targeting transport hubs and prime retail." },
  { name: "Itsu",          initials: "it", color: "#E30613", sector: "Food & Beverage", fit: "Good",   ukStores: 80,  nearest: "Birmingham · 130 km", lastOpened: "19 Mar 2026 · Birmingham", note: "Asian-inspired food-to-go with strong lunchtime demand; no unit within the built-up area today.", demand: "Expanding beyond London and the South East." },
  { name: "Honest Burgers",initials: "HB", color: "#2B2B2B", sector: "Food & Beverage", fit: "Good",   ukStores: 45,  nearest: "Liverpool · 55 km", lastOpened: "31 Jan 2026 · Liverpool", note: "Better-burger operator that clusters in food-led neighbourhoods matching the local dining scene.", demand: "Roughly 6 new sites a year, city-centre led." },
  { name: "LEON",          initials: "Le", color: "#E8A200", sector: "Food & Beverage", fit: "Moderate",ukStores: 75,  nearest: "Leeds · 71 km", lastOpened: "12 Dec 2025 · Leeds", note: "Naturally-fast-food brand indexing well against the area's commuter and student mix.", demand: "Selective roll-out following ownership change." },
  { name: "Boots",         initials: "B",  color: "#004990", sector: "Health & Beauty", fit: "Moderate",ukStores: 1900,nearest: "0.9 km (edge of area)", lastOpened: "5 Nov 2025 · Stockport", note: "Present nearby but not within the defined core pitch; a gap for a convenience-format pharmacy.", demand: "Estate largely settled; opportunistic only." },
  { name: "Pure",          initials: "Pu", color: "#5B8A3A", sector: "Food & Beverage", fit: "Moderate",ukStores: 30,  nearest: "London · 260 km", lastOpened: "22 Apr 2026 · London EC2", note: "Healthy food-to-go chain, currently concentrated in London — a first Northern pitch.", demand: "Early-stage regional expansion." },
  { name: "Crosstown",     initials: "Cx", color: "#151515", sector: "Food & Beverage", fit: "Moderate",ukStores: 20,  nearest: "London · 260 km", lastOpened: "14 Feb 2026 · London SE1", note: "Artisan doughnut and coffee brand; a destination unit for a food-led scheme.", demand: "Boutique roll-out, high-footfall pitches." },
];

/* ---- Live requirements (occupier demand) ------------------------------- */
/* scope: "local" (targets this area) | "nationwide" (open to all locations) */
const U_REQS = [
  { id: "r1", brand: "Gail's Bakery", initials: "GB", color: "#3B2A1A", sector: "Food & Beverage", useClass: "E (Commercial)", size: "1,200 – 2,500 sq ft", listing: "Leasehold", scope: "local", mx: 50, my: 36, verified: "4 days ago", brochure: true, nearest: "Leeds · 71 km", lastOpened: "18 Jun 2026 · Harrogate", ukStores: 140,
    locations: ["Manchester city centre", "Didsbury", "Altrincham"], summary: "Seeking ground-floor units with frontage 5m+ near affluent residential and commuter footfall. A1/A3 history preferred.",
    contact: { name: "Harriet Vane", role: "Acquisitions Manager", org: "Gail's", email: "harriet@gailsbread.co.uk", phone: "+44 7700 900155" } },
  { id: "r2", brand: "Five Guys", initials: "5G", color: "#E0392F", sector: "Food & Beverage", useClass: "Sui Generis", size: "3,000 – 4,500 sq ft", listing: "Leasehold", scope: "local", mx: 56, my: 50, verified: "1 week ago", brochure: true, nearest: "Trafford Centre · 9 km", lastOpened: "2 May 2026 · Sheffield", ukStores: 170,
    agent: { name: "Olivia Grant", role: "Retained agent", org: "CBRE", email: "olivia.grant@cbre.com", phone: "+44 20 7182 2000" },
    locations: ["Manchester Arndale", "Trafford Centre"], summary: "Prominent retail and leisure schemes, strong evening economy. Extraction and 15-year terms required.",
    contact: { name: "Marcus Bell", role: "UK Development", org: "Five Guys", email: "mbell@fiveguys.co.uk", phone: "+44 7700 900334" } },
  { id: "r3", brand: "Sweaty Betty", initials: "SB", color: "#C24A6B", sector: "Retail", useClass: "E (Commercial)", size: "1,500 – 2,200 sq ft", listing: "Leasehold", scope: "local", mx: 43, my: 47, verified: "2 weeks ago", brochure: false, nearest: "Leeds · 71 km", lastOpened: "24 Feb 2026 · York", ukStores: 65,
    agent: { name: "James Whitfield", role: "Acquisitions agent", org: "Savills", email: "jwhitfield@savills.com", phone: "+44 20 7499 8644" },
    locations: ["King Street, Manchester", "Spinningfields"], summary: "Premium high-street and scheme positions adjacent to complementary lifestyle and beauty brands.",
    contact: { name: "Devon Clarke", role: "Property", org: "Sweaty Betty", email: "property@sweatybetty.com", phone: "+44 20 3326 1100" } },
  { id: "r4", brand: "Pure", initials: "PU", color: "#1F8A5B", sector: "Food & Beverage", useClass: "E (Commercial)", size: "800 – 1,400 sq ft", listing: "Leasehold", scope: "local", mx: 62, my: 41, verified: "3 weeks ago", brochure: true, nearest: "London · 260 km", lastOpened: "22 Apr 2026 · London EC2", ukStores: 30,
    locations: ["Spinningfields", "NOMA"], summary: "Office-dense catchments with weekday lunch footfall. Ground floor, 3-phase power.",
    contact: { name: "Aisha Rahman", role: "Estates", org: "Pure", email: "aisha@pure.co.uk", phone: "+44 7700 900912" } },
  { id: "r5", brand: "Crosstown", initials: "CT", color: "#2B2B6B", sector: "Food & Beverage", useClass: "E (Commercial)", size: "600 – 1,000 sq ft", listing: "Leasehold", scope: "local", mx: 37, my: 39, verified: "1 month ago", brochure: false, nearest: "London · 260 km", lastOpened: "14 Feb 2026 · London SE1", ukStores: 20,
    locations: ["Northern Quarter"], summary: "Independent-feel pitches with high footfall and outdoor seating potential.",
    contact: { name: "Theo Marsh", role: "Founder", org: "Crosstown", email: "theo@crosstown.co.uk", phone: "+44 7700 900508" } },
  /* nationwide — open to all locations */
  { id: "r6", brand: "Itsu", initials: "IT", color: "#E11D48", sector: "Food & Beverage", useClass: "E (Commercial)", size: "1,500 – 2,800 sq ft", listing: "Leasehold", scope: "nationwide", verified: "5 days ago", brochure: true,
    locations: ["Nationwide — all major UK cities"], summary: "Actively acquiring across all major UK conurbations. Transport hubs, retail schemes and high streets with 8m+ frontage.",
    contact: { name: "Roland Pike", role: "Head of Property", org: "Itsu", email: "rpike@itsu.com", phone: "+44 20 7836 5500" } },
  { id: "r7", brand: "Lush", initials: "LU", color: "#1B1B1B", sector: "Health & Beauty", useClass: "E (Commercial)", size: "1,000 – 2,000 sq ft", listing: "Leasehold", scope: "nationwide", verified: "2 weeks ago", brochure: true,
    locations: ["Nationwide — prime retail"], summary: "Prime pedestrianised positions in all UK cities and major towns. Strong corner units preferred.",
    contact: { name: "Bea Holloway", role: "Retail Property", org: "Lush", email: "property@lush.co.uk", phone: "+44 1202 668 545" } },
  { id: "r8", brand: "Wagamama", initials: "WG", color: "#C0152B", sector: "Food & Beverage", useClass: "Sui Generis", size: "3,500 – 5,000 sq ft", listing: "Leasehold", scope: "nationwide", verified: "3 weeks ago", brochure: false,
    locations: ["Nationwide — cities & retail parks"], summary: "Open to all locations: city centres, dominant schemes and leisure-led retail parks. Extraction essential.",
    contact: { name: "Sana Iqbal", role: "Acquisitions", org: "Wagamama", email: "sana.iqbal@wagamama.com", phone: "+44 20 7009 3620" } },
];

/* ---- Brand universe for location comparison ----------------------------
   A fixed pool of retail/F&B brands with a rough "prevalence" (how commonly
   each trades in a UK catchment). uPointBrands() splits the pool into brands
   PRESENT vs MISSING at any dropped point, deterministically from its
   coordinates — so the same point always reads the same, and two points can be
   diffed brand-by-brand. */
const U_COMPARE_BRANDS = [
  { name: "Boots",           initials: "B",  color: "#004990", sector: "Health & Beauty", p: 0.82 },
  { name: "Greggs",          initials: "G",  color: "#00693C", sector: "Food & Beverage", p: 0.88 },
  { name: "Costa Coffee",    initials: "Co", color: "#6A1A41", sector: "Food & Beverage", p: 0.85 },
  { name: "Pret A Manger",   initials: "P",  color: "#7A1F2E", sector: "Food & Beverage", p: 0.62 },
  { name: "Card Factory",    initials: "CF", color: "#2A5DD1", sector: "Retail",          p: 0.70 },
  { name: "The Entertainer", initials: "TE", color: "#E0392F", sector: "Retail",          p: 0.50 },
  { name: "Rituals",         initials: "R",  color: "#2C3F2A", sector: "Health & Beauty", p: 0.50 },
  { name: "Five Guys",       initials: "5G", color: "#C8102E", sector: "Food & Beverage", p: 0.50 },
  { name: "Wagamama",        initials: "W",  color: "#E4002B", sector: "Food & Beverage", p: 0.46 },
  { name: "Lush",            initials: "L",  color: "#1A1A1A", sector: "Health & Beauty", p: 0.55 },
  { name: "Gail's",          initials: "GB", color: "#3A2F26", sector: "Food & Beverage", p: 0.40 },
  { name: "Sweaty Betty",    initials: "SB", color: "#C24A6B", sector: "Retail",          p: 0.36 },
  { name: "Joe & The Juice", initials: "J",  color: "#111111", sector: "Food & Beverage", p: 0.33 },
  { name: "Itsu",            initials: "it", color: "#E30613", sector: "Food & Beverage", p: 0.38 },
  { name: "Honest Burgers",  initials: "HB", color: "#2B2B2B", sector: "Food & Beverage", p: 0.32 },
  { name: "LEON",            initials: "Le", color: "#E8A200", sector: "Food & Beverage", p: 0.38 },
  { name: "Allpress Espresso",initials:"AE", color: "#6F4A2E", sector: "Food & Beverage", p: 0.30 },
  { name: "Goodhood",        initials: "GH", color: "#171419", sector: "Retail",          p: 0.24 },
  { name: "Knoops",          initials: "K",  color: "#1F1A14", sector: "Food & Beverage", p: 0.28 },
  { name: "Pure",            initials: "Pu", color: "#5B8A3A", sector: "Food & Beverage", p: 0.20 },
  { name: "Crosstown",       initials: "Cx", color: "#151515", sector: "Food & Beverage", p: 0.16 },
];
function uHashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
/* Deterministic present/missing split for a point, keyed on its map coords. */
function uPointBrands(area) {
  const bx = Math.round((area.x || 0) * 100), by = Math.round((area.y || 0) * 100);
  const base = (Math.imul(bx, 2654435761) ^ Math.imul(by, 40503) ^ 0x9e3779b9) >>> 0;
  const present = [], missing = [];
  U_COMPARE_BRANDS.forEach(b => {
    const r = ((uHashStr(b.name) ^ base ^ Math.imul(b.name.length, 2246822519)) >>> 0) / 4294967296;
    (r < b.p ? present : missing).push(b);
  });
  return { present, missing };
}

/* ---- Saved opportunities & sketches ------------------------------------ */
const U_SAVED = [
  { id: "sv1", name: "Manchester — NQ corner", area: "Manchester", updated: "2h ago", schemes: 3, kind: "sketch" },
  { id: "sv2", name: "Bristol — Cabot fringe", area: "Bristol", updated: "Yesterday", schemes: 1, kind: "sketch" },
  { id: "sv4", name: "Leeds — South Bank plot", area: "Leeds", updated: "2 days ago", schemes: 2, kind: "sketch" },
  { id: "sv5", name: "Glasgow — retail park fit", area: "Glasgow", updated: "Last week", schemes: 1, kind: "sketch" },
  { id: "sv3", name: "Leeds gap shortlist", area: "Leeds", updated: "3 days ago", schemes: 0, kind: "area" },
];

/* ===== Small shared atoms ============================================== */

/* Mono kicker / eyebrow */
const UKicker = ({ children, color, style = {} }) => (
  <span style={{
    fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 1.4,
    textTransform: "uppercase", color: color || SS.ink3, fontWeight: 600, ...style,
  }}>{children}</span>
);

/* Brand logo chip (initials on colour) */
const UBrandLogo = ({ brand, size = 32, radius = 7 }) => {
  const b = typeof brand === "string" ? (U_BRAND_BY_NAME[brand] || { initials: brand.slice(0, 2).toUpperCase(), color: SS.ink }) : brand;
  return (
    <span style={{
      width: size, height: size, borderRadius: radius, background: b.color, color: "#fff",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Inter", fontWeight: 700, fontSize: size * 0.38, letterSpacing: -0.3, flexShrink: 0,
    }}>{b.initials}</span>
  );
};

/* Gap-strength pill */
const UGapPill = ({ level }) => {
  const map = { High: { bg: SS.violetTintSoft, fg: SS.violetDeep, dot: SS.violet },
                Med:  { bg: "#FEF3C7", fg: "#92400E", dot: "#D97706" },
                Low:  { bg: SS.bg, fg: SS.ink3, dot: SS.ink4 } };
  const c = map[level] || map.Low;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 999,
      background: c.bg, color: c.fg, fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 700,
      letterSpacing: 0.4, textTransform: "uppercase" }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: c.dot }}/> {level} gap
    </span>
  );
};

/* Verified chip (green) */
const UVerified = ({ when }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "Inter", fontSize: 11.5, color: "#15803D", fontWeight: 500 }}>
    <span style={{ width: 6, height: 6, borderRadius: 999, background: "#15803D" }}/> Verified {when}
  </span>
);

/* Section header with kicker + rule */
const USecHd = ({ children, style = {} }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 16px 8px", ...style }}>
    <UKicker>{children}</UKicker>
    <span style={{ flex: 1, height: 1, background: SS.borderSoft }}/>
  </div>
);

/* Compact metric tile */
const Metric = ({ label, value, unit, accent }) => (
  <div style={{ padding: 11, borderRadius: 9, background: SS.bg, border: `1px solid ${SS.borderSoft}` }}>
    <div style={{ fontFamily: "Inter", fontSize: 11, color: SS.ink3, fontWeight: 500 }}>{label}</div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
      <span style={{ fontFamily: "Inter", fontSize: 22, fontWeight: 600, color: accent || SS.ink, letterSpacing: -0.5 }}>{value}</span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: SS.ink3 }}>{unit}</span>
    </div>
  </div>
);

Object.assign(window, {
  U_BRANDS, U_BRAND_BY_NAME, U_BUAS, U_BUA_BY_ID, U_STORES, U_MISSING, U_REQS, U_SAVED,
  U_COMPARE_BRANDS, uPointBrands,
  U_FILTER_CATEGORIES, U_FILTER_BRANDS, U_FILTER_FASCIAS, U_FILTER_OPTIONS,
  UKicker, UBrandLogo, UGapPill, UVerified, USecHd, Metric,
});
