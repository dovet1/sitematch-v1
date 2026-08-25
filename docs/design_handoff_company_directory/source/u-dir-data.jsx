/* GapFinder — Unified Workspace · Directory data
   A connected graph of three entity types:
     · Brands (occupiers)        — who is expanding, their estate + requirement
     · In-house expansion teams  — the people at a brand who acquire sites
     · Agents (agency reps)      — retained surveyors acting for one or more brands
   Brands hold agentIds; agents are reached from brands (and vice-versa) so the
   user can click through Brand → Agent → other Brands and back. */

/* ---- Agents (agency reps) --------------------------------------------- */
const U_DIR_AGENTS = [
  { id: "ag-savills",  name: "Olivia Grant",   firm: "Savills",               role: "Director, Retail Agency",  initials: "OG", color: "#1F3A5F", region: "National",        focus: "Leisure & F&B",      email: "olivia.grant@savills.com",   phone: "+44 20 7499 8644" },
  { id: "ag-cbre",     name: "James Whitcombe", firm: "CBRE",                 role: "Senior Acquisitions Surveyor", initials: "JW", color: "#0B6E4F", region: "National",     focus: "QSR & food-to-go",   email: "james.whitcombe@cbre.com",   phone: "+44 20 7182 2000" },
  { id: "ag-cushwake", name: "Marcus Reid",     firm: "Cushman & Wakefield",  role: "Partner, Retail",          initials: "MR", color: "#8A1538", region: "Midlands & North", focus: "Restaurants & leisure", email: "marcus.reid@cushwake.com",  phone: "+44 161 235 7666" },
  { id: "ag-colliers", name: "Devon Clarke",    firm: "Colliers",             role: "Associate Director",       initials: "DC", color: "#C2410C", region: "South & London",   focus: "Health & beauty",    email: "devon.clarke@colliers.com",  phone: "+44 20 7935 4499" },
  { id: "ag-stance",   name: "Rina Alvi",       firm: "Stance Retail",        role: "Acquiring Agent",          initials: "RA", color: "#4B2E83", region: "London & South East", focus: "Independents & premium F&B", email: "rina@stance.london",  phone: "+44 20 7946 0813" },
  { id: "ag-avison",   name: "Priya Nandra",    firm: "Avison Young",         role: "Senior Surveyor",          initials: "PN", color: "#0F766E", region: "National",         focus: "F&B roll-outs",      email: "priya.nandra@avisonyoung.com", phone: "+44 20 7911 2000" },
];
const U_DIR_AGENT_BY_ID = Object.fromEntries(U_DIR_AGENTS.map(a => [a.id, a]));

/* ---- Brands (occupiers) ------------------------------------------------ */
/* team: in-house expansion staff · agentIds: retained agents ·
   estate: { count, top:[{city, n}] } · requirement: null when not on file. */
const U_DIR_BRANDS = [
  {
    id: "nandos", name: "Nando's", initials: "N", color: "#C4161C", sector: "Leisure · Restaurants",
    website: "nandos.co.uk", ukStores: 472, hq: "London (Putney)", since: 1992, lastOpened: "2 Jul 2026 · Sheffield Meadowhall",
    about: "Flame-grilled PERi-PERi chicken group. Steady UK roll-out focused on retail parks, dominant schemes and strong high streets with extraction and covered seating.",
    team: [
      { name: "Sam Okonkwo",  role: "Head of UK Expansion",  email: "sam.okonkwo@nandos.co.uk",   phone: "+44 20 8875 3000" },
      { name: "Leah Bright",  role: "Acquisitions Manager",  email: "leah.bright@nandos.co.uk",   phone: "+44 20 8875 3014" },
      { name: "Tomas Vidal",  role: "Property Surveyor",     email: "tomas.vidal@nandos.co.uk",   phone: "+44 20 8875 3027" },
    ],
    agentIds: ["ag-savills", "ag-cushwake"],
    estate: { count: 472, top: [["London", 96], ["Manchester", 18], ["Birmingham", 21], ["Leeds", 12], ["Glasgow", 14], ["Bristol", 9]] },
    requirement: {
      status: "Actively acquiring", size: "3,500 – 5,500 sq ft", sizeSeen: "4,200 sq ft", sizeSeenBasis: "18 stores opened 2024–25", useClass: "Sui Generis (restaurant)", listing: "Leasehold — 15yr",
      verified: "3 days ago", brochure: true,
      locations: ["Manchester city centre", "Leeds", "Liverpool ONE", "Cardiff", "Edinburgh"],
      summary: "Prominent leisure and retail-park pitches with extraction, external seating and strong evening footfall. Minimum 5m frontage; open to drive-thru on edge-of-town parks.",
    },
  },
  {
    id: "gails", name: "Gail's Bakery", initials: "G", color: "#3B2A1A", sector: "Food & Beverage · Bakery",
    website: "gailsbread.co.uk", ukStores: 140, hq: "London", since: 2005, lastOpened: "24 Jun 2026 · Harrogate",
    about: "Premium neighbourhood bakery expanding quickly through affluent city and commuter locations.",
    team: [
      { name: "Harriet Vane",  role: "Acquisitions Manager", email: "harriet@gailsbread.co.uk", phone: "+44 7700 900155" },
      { name: "Oscar Reed",    role: "Property Director",     email: "oscar@gailsbread.co.uk",   phone: "+44 7700 900161" },
    ],
    agentIds: ["ag-stance", "ag-cbre"],
    estate: { count: 140, top: [["London", 78], ["Oxford", 6], ["Brighton", 5], ["Bristol", 7], ["Leeds", 4]] },
    requirement: {
      status: "Actively acquiring", size: "1,200 – 2,500 sq ft", sizeSeen: "1,650 sq ft", sizeSeenBasis: "22 stores opened 2024–25", useClass: "E (Commercial)", listing: "Leasehold",
      verified: "4 days ago", brochure: true,
      locations: ["Manchester — Didsbury / Altrincham", "Edinburgh", "Bristol Clifton"],
      summary: "Ground-floor units with 5m+ frontage near affluent residential and commuter footfall. A1/A3 history preferred.",
    },
  },
  {
    id: "fiveguys", name: "Five Guys", initials: "5G", color: "#C8102E", sector: "Food & Beverage · QSR",
    website: "fiveguys.co.uk", ukStores: 170, hq: "London", since: 2013, lastOpened: "11 Jun 2026 · Nottingham",
    about: "American better-burger chain targeting prime retail and leisure schemes with a strong evening economy.",
    team: [
      { name: "Marcus Bell", role: "UK Development Director", email: "mbell@fiveguys.co.uk", phone: "+44 7700 900334" },
    ],
    agentIds: ["ag-cbre"],
    estate: { count: 170, top: [["London", 44], ["Manchester", 6], ["Birmingham", 8], ["Sheffield", 4], ["Glasgow", 5]] },
    requirement: {
      status: "Actively acquiring", size: "3,000 – 4,500 sq ft", sizeSeen: "3,700 sq ft", sizeSeenBasis: "11 stores opened 2024–25", useClass: "Sui Generis", listing: "Leasehold",
      verified: "1 week ago", brochure: true,
      locations: ["Manchester Arndale", "Trafford Centre", "Leeds"],
      summary: "Prominent retail and leisure schemes with strong evening economy. Extraction and 15-year terms required.",
    },
  },
  {
    id: "pret", name: "Pret A Manger", initials: "P", color: "#7A1F2E", sector: "Food & Beverage · Coffee",
    website: "pret.com", ukStores: 460, hq: "London", since: 1986, lastOpened: "19 May 2026 · Leeds Trinity",
    about: "Coffee and food-to-go operator concentrating on transport hubs, office cores and high-footfall high streets.",
    team: [
      { name: "Elena Rossi",  role: "Head of Property",       email: "elena.rossi@pret.com",   phone: "+44 20 7827 6300" },
      { name: "Daniel Okoro", role: "Acquisitions Surveyor",  email: "daniel.okoro@pret.com",  phone: "+44 20 7827 6318" },
    ],
    agentIds: ["ag-cbre"],
    estate: { count: 460, top: [["London", 240], ["Manchester", 10], ["Birmingham", 12], ["Leeds", 7], ["Edinburgh", 6]] },
    requirement: {
      status: "Selective", size: "1,000 – 2,200 sq ft", sizeSeen: "1,500 sq ft", sizeSeenBasis: "14 stores opened 2024–25", useClass: "E (Commercial)", listing: "Leasehold",
      verified: "3 weeks ago", brochure: false,
      locations: ["Regional transport hubs", "Manchester", "Birmingham"],
      summary: "Commuter and office-dense catchments. Ground floor with servicing; strong weekday footfall essential.",
    },
  },
  {
    id: "itsu", name: "Itsu", initials: "it", color: "#E30613", sector: "Food & Beverage · Asian-inspired",
    website: "itsu.com", ukStores: 80, hq: "London", since: 1997, lastOpened: "28 Jun 2026 · Manchester Piccadilly",
    about: "Asian-inspired food-to-go brand expanding beyond London and the South East into major regional cities.",
    team: [
      { name: "Roland Pike", role: "Head of Property", email: "rpike@itsu.com", phone: "+44 20 7836 5500" },
    ],
    agentIds: ["ag-cbre", "ag-avison"],
    estate: { count: 80, top: [["London", 58], ["Birmingham", 3], ["Reading", 2], ["Manchester", 1]] },
    requirement: {
      status: "Actively acquiring", size: "1,500 – 2,800 sq ft", sizeSeen: "2,100 sq ft", sizeSeenBasis: "9 stores opened 2024–25", useClass: "E (Commercial)", listing: "Leasehold",
      verified: "5 days ago", brochure: true,
      locations: ["Nationwide — all major UK cities"],
      summary: "Transport hubs, retail schemes and high streets with 8m+ frontage in all major UK conurbations.",
    },
  },
  {
    id: "sweatybetty", name: "Sweaty Betty", initials: "SB", color: "#C24A6B", sector: "Retail · Activewear",
    website: "sweatybetty.com", ukStores: 65, hq: "London", since: 1998, lastOpened: "14 Apr 2026 · Bath",
    about: "Premium activewear brand targeting affluent female shoppers on prime high streets and dominant schemes.",
    team: [
      { name: "Devon Clarke", role: "Property (in-house)", email: "property@sweatybetty.com", phone: "+44 20 3326 1100" },
    ],
    agentIds: ["ag-colliers", "ag-savills"],
    estate: { count: 65, top: [["London", 30], ["Manchester", 3], ["Leeds", 2], ["Edinburgh", 2], ["Bath", 2]] },
    requirement: {
      status: "Growing", size: "1,500 – 2,200 sq ft", sizeSeen: "1,850 sq ft", sizeSeenBasis: "6 stores opened 2024–25", useClass: "E (Commercial)", listing: "Leasehold",
      verified: "2 weeks ago", brochure: false,
      locations: ["King Street, Manchester", "Spinningfields", "Leeds Victoria"],
      summary: "Premium positions adjacent to complementary lifestyle and beauty brands. 5–8 openings a year.",
    },
  },
  {
    id: "lush", name: "Lush", initials: "L", color: "#1A1A1A", sector: "Health & Beauty · Cosmetics",
    website: "lush.co.uk", ukStores: 100, hq: "Poole", since: 1995, lastOpened: "3 Mar 2026 · Cardiff",
    about: "Handmade cosmetics retailer with a young, values-led shopper base; selective flagship-only expansion.",
    team: [
      { name: "Bea Holloway", role: "Retail Property Lead", email: "property@lush.co.uk", phone: "+44 1202 668 545" },
    ],
    agentIds: ["ag-colliers"],
    estate: { count: 100, top: [["London", 28], ["Manchester", 4], ["Liverpool", 3], ["Glasgow", 4], ["Cardiff", 2]] },
    requirement: {
      status: "Selective", size: "1,000 – 2,000 sq ft", sizeSeen: "1,400 sq ft", sizeSeenBasis: "5 stores opened 2024–25", useClass: "E (Commercial)", listing: "Leasehold",
      verified: "2 weeks ago", brochure: true,
      locations: ["Nationwide — prime pedestrianised pitches"],
      summary: "Prime pedestrianised positions in all UK cities and major towns. Strong corner units preferred.",
    },
  },
  {
    id: "wagamama", name: "Wagamama", initials: "W", color: "#E4002B", sector: "Leisure · Restaurants",
    website: "wagamama.com", ukStores: 165, hq: "London", since: 1992, lastOpened: "9 Jun 2026 · Bristol Cabot Circus",
    about: "Pan-Asian restaurant group open to city centres, dominant schemes and leisure-led retail parks.",
    team: [
      { name: "Sana Iqbal",  role: "Head of Acquisitions", email: "sana.iqbal@wagamama.com", phone: "+44 20 7009 3620" },
      { name: "George Hale", role: "Property Manager",      email: "george.hale@wagamama.com", phone: "+44 20 7009 3641" },
    ],
    agentIds: ["ag-savills", "ag-avison"],
    estate: { count: 165, top: [["London", 62], ["Manchester", 5], ["Birmingham", 6], ["Bristol", 4], ["Leeds", 4]] },
    requirement: {
      status: "Actively acquiring", size: "3,500 – 5,000 sq ft", sizeSeen: "4,100 sq ft", sizeSeenBasis: "8 stores opened 2024–25", useClass: "Sui Generis", listing: "Leasehold",
      verified: "3 weeks ago", brochure: false,
      locations: ["Nationwide — cities & retail parks"],
      summary: "City centres, dominant schemes and leisure-led retail parks. Extraction essential.",
    },
  },
  {
    id: "knoops", name: "Knoops", initials: "K", color: "#1F1A14", sector: "Food & Beverage · Chocolate",
    website: "knoops.co.uk", ukStores: 24, hq: "Rye", since: 2013, lastOpened: "21 May 2026 · Cambridge",
    about: "Craft hot-chocolate bar; early-stage roll-out into destination food-led schemes and affluent towns.",
    team: [
      { name: "Cassia Reed", role: "Expansion Lead", email: "cassia@knoops.co.uk", phone: "+44 7700 900663" },
    ],
    agentIds: ["ag-stance"],
    estate: { count: 24, top: [["London", 11], ["Oxford", 2], ["Cambridge", 2], ["Bath", 1], ["Brighton", 2]] },
    requirement: null, // no requirement on file
  },
  {
    id: "thegym", name: "The Gym Group", initials: "TG", color: "#111827", sector: "Leisure · Fitness",
    website: "thegymgroup.com", ukStores: 240, hq: "London", since: 2007, lastOpened: "17 Jun 2026 · Leeds City",
    about: "Low-cost 24-hour gym operator taking large first-floor and basement units in urban and edge-of-town locations.",
    team: [
      { name: "Nadia Fischer", role: "Head of Estates", email: "nadia.fischer@thegymgroup.com", phone: "+44 20 3319 7100" },
    ],
    agentIds: ["ag-cushwake"],
    estate: { count: 240, top: [["London", 52], ["Manchester", 8], ["Birmingham", 9], ["Leeds", 5], ["Glasgow", 6]] },
    requirement: null, // no requirement on file
  },
];
const U_DIR_BRAND_BY_ID = Object.fromEntries(U_DIR_BRANDS.map(b => [b.id, b]));

/* ---- Cross-links ------------------------------------------------------- */
/* Brands an agent represents */
const dirAgentBrands = (agentId) => U_DIR_BRANDS.filter(b => (b.agentIds || []).includes(agentId));
/* Agents acting for a brand */
const dirBrandAgents = (brand) => (brand.agentIds || []).map(id => U_DIR_AGENT_BY_ID[id]).filter(Boolean);
/* Flattened in-house team directory, each row tagged with its brand */
const U_DIR_TEAM = U_DIR_BRANDS.flatMap(b =>
  (b.team || []).map((p, i) => ({ ...p, id: `${b.id}-t${i}`, brandId: b.id, brandName: b.name, color: b.color, initials: p.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() }))
);

Object.assign(window, {
  U_DIR_AGENTS, U_DIR_AGENT_BY_ID, U_DIR_BRANDS, U_DIR_BRAND_BY_ID, U_DIR_TEAM,
  dirAgentBrands, dirBrandAgents,
});
