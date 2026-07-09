/* GapFinder — Unified Workspace · CAD plan library
   To-scale store floorplans the user can drop onto a parcel in Sketch Site.
   Each plan draws as a technical line schematic in a 100×120 local box,
   reused at thumbnail size (library cards) and large (map overlay).

   The catalogue scales to 100+ plans: a handful of reusable format
   archetypes (the line drawings) are instanced across many real stores,
   each instance carrying its own provenance — which store it was surveyed
   from and the year (e.g. "Swindon South, 2018"). */

const CAD_TEAL = "#0F9488";

/* --- shared drawing primitives (local coords, 100×120 box) ------------- */
const _wall = (x, y, w, h, s, sw = 1.4) => <rect x={x} y={y} width={w} height={h} fill="none" stroke={s} strokeWidth={sw}/>;
const _ln = (x1, y1, x2, y2, s, sw = 0.7) => <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={s} strokeWidth={sw}/>;
const _swing = (x, y, r, a0, a1, s) => {
  const p = (a) => [x + r * Math.cos(a * Math.PI / 180), y + r * Math.sin(a * Math.PI / 180)];
  const [sx, sy] = p(a0), [ex, ey] = p(a1);
  return <path d={`M${x} ${y} L${sx} ${sy} A${r} ${r} 0 0 1 ${ex} ${ey} Z`} fill="none" stroke={s} strokeWidth={0.6}/>;
};

/* --- format archetypes: the reusable line schematics -------------------- */
const _drawKiosk = (s) => (<g>
  {_wall(28, 36, 44, 48, s)}
  {_wall(28, 36, 44, 12, s, 1)}
  {_ln(40, 48, 40, 84, s)}
  {_ln(31, 40, 37, 40, s)}{_ln(31, 44, 37, 44, s)}
  <circle cx={50} cy={58} r={2.4} fill="none" stroke={s} strokeWidth={0.7}/>
  <circle cx={50} cy={68} r={2.4} fill="none" stroke={s} strokeWidth={0.7}/>
  <circle cx={50} cy={78} r={2.4} fill="none" stroke={s} strokeWidth={0.7}/>
  {_swing(62, 84, 9, 180, 270, s)}
</g>);

const _drawHighstreet = (s) => (<g>
  {_wall(34, 8, 32, 104, s)}
  {_ln(34, 12, 66, 12, s, 1.2)}{_ln(38, 8, 38, 12, s)}{_ln(50, 8, 50, 12, s)}{_ln(62, 8, 62, 12, s)}
  {_ln(34, 78, 66, 78, s, 1)}
  {_wall(34, 78, 18, 34, s, 1)}
  {_wall(52, 96, 14, 16, s, 1)}
  {_wall(56, 18, 8, 5, s, 1)}
  {_swing(46, 12, 8, 90, 180, s)}
</g>);

const _drawMidbox = (s) => (<g>
  {_wall(10, 26, 80, 68, s)}
  {_ln(72, 26, 72, 94, s, 1)}
  {_ln(72, 50, 90, 50, s, 0.7)}{_ln(72, 72, 90, 72, s, 0.7)}
  {_wall(14, 30, 14, 22, s, 1)}
  {_ln(21, 30, 21, 52, s, 0.6)}
  {_wall(14, 80, 24, 8, s, 1)}
  {_ln(40, 26, 40, 94, s, 0.4)}{_ln(56, 26, 56, 94, s, 0.4)}
  {_swing(50, 94, 9, 270, 360, s)}{_swing(62, 94, 9, 180, 270, s)}
</g>);

const _drawDrivethru = (s) => (<g>
  {_wall(20, 20, 44, 60, s)}
  {_ln(20, 52, 64, 52, s, 1)}
  {_wall(24, 24, 16, 10, s, 1)}
  <path d="M64 30 A 24 24 0 0 1 64 78" fill="none" stroke={s} strokeWidth={1} strokeDasharray="3 2.5"/>
  <path d="M80 30 A 8 8 0 0 1 80 78" fill="none" stroke={s} strokeWidth={0.7} strokeDasharray="3 2.5"/>
  {_ln(64, 56, 64, 66, s, 1.6)}
  {_swing(34, 80, 8, 0, 90, s)}
</g>);

const _drawCorner = (s) => (<g>
  <path d="M22 24 H78 V58 H52 V96 H22 Z" fill="none" stroke={s} strokeWidth={1.4}/>
  {_wall(26, 28, 30, 8, s, 1)}
  {[[34,72],[44,72],[34,86],[44,86]].map((p,i)=><rect key={i} x={p[0]-3} y={p[1]-3} width={6} height={6} fill="none" stroke={s} strokeWidth={0.6}/>)}
  {[[64,46],[70,46]].map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={2.4} fill="none" stroke={s} strokeWidth={0.6}/>)}
  {_wall(66, 24, 12, 12, s, 0.8)}
  {_swing(31, 96, 7, 270, 360, s)}
</g>);

const _drawContainer = (s) => (<g>
  {_wall(40, 22, 20, 76, s)}
  {[30,40,50,60,70,80].map((y,i)=><line key={i} x1={40} y1={y} x2={60} y2={y} stroke={s} strokeWidth={0.35}/>)}
  {_ln(40, 30, 40, 50, s, 1.8)}
  {_swing(45, 98, 6, 180, 270, s)}{_swing(55, 98, 6, 270, 360, s)}
</g>);

const CAD_FORMATS = {
  kiosk:      { format: "Kiosk",               gia: 38,  dims: "6.2 × 6.1 m",            draw: _drawKiosk },
  highstreet: { format: "High-street unit",    gia: 142, dims: "6.4 × 22 m",            draw: _drawHighstreet },
  midbox:     { format: "Retail-park mid-box", gia: 464, dims: "20 × 23 m",             draw: _drawMidbox },
  drivethru:  { format: "Drive-thru",          gia: 208, dims: "12 × 17 m",             draw: _drawDrivethru },
  corner:     { format: "Corner café",         gia: 96,  dims: "L-plan · 11 m frontage", draw: _drawCorner },
  container:  { format: "Container pop-up",    gia: 28,  dims: "2.4 × 12 m",            draw: _drawContainer },
};

/* --- provenance pools: real-ish UK stores the surveys came from --------- */
const _STORES = [
  "Swindon South", "Reading Oracle", "Leeds Trinity", "Bristol Cabot", "Manchester Arndale",
  "Glasgow Buchanan", "Cardiff Queen St", "Nottingham Victoria", "Brighton North", "Sheffield Meadowhall",
  "Liverpool One", "Newcastle Eldon", "Norwich Chapelfield", "Exeter Princesshay", "York Coppergate",
  "Bath SouthGate", "Cambridge Grand", "Oxford Westgate", "Derby Intu", "Plymouth Drake",
  "Southampton WestQuay", "Milton Keynes", "Watford Atria", "Kingston Bentall", "Guildford Friary",
  "Chelmsford Bond St", "Leicester Highcross", "Edinburgh St James", "Aberdeen Union Sq", "Belfast Victoria",
];
const _YEARS = [2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025];

/* brand → which formats that brand actually rolls out */
const _BRAND_ROLLOUT = [
  { brand: "Knoops",         formats: ["kiosk", "corner"] },
  { brand: "Goodhood",       formats: ["highstreet", "corner"] },
  { brand: "ShakeDown",      formats: ["midbox", "container"] },
  { brand: "Allpress",       formats: ["drivethru", "kiosk", "corner"] },
  { brand: "Pophams",        formats: ["corner", "kiosk"] },
  { brand: "Pret A Manger",  formats: ["highstreet", "kiosk"] },
  { brand: "Rituals",        formats: ["highstreet", "midbox"] },
  { brand: "The Entertainer",formats: ["midbox"] },
];

/* --- the catalogue: instanced across brands × stores (100+) ------------- */
const _slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const CAD_LIBRARY = (() => {
  const out = [];
  let n = 0;
  _BRAND_ROLLOUT.forEach((br, bi) => {
    _STORES.forEach((store, si) => {
      // each store gets one of the brand's formats, rotated for variety
      const key = br.formats[(si + bi) % br.formats.length];
      const base = CAD_FORMATS[key];
      const year = _YEARS[(si * 3 + bi * 5) % _YEARS.length];
      out.push({
        id: `${_slug(br.brand)}-${_slug(store)}-${year}`,
        brand: br.brand,
        archetype: key,
        format: base.format,
        gia: base.gia,
        dims: base.dims,
        source: store,
        year,
        draw: base.draw,
      });
      n++;
    });
  });
  return out;
})();

const CAD_BY_ID = Object.fromEntries(CAD_LIBRARY.map(p => [p.id, p]));

/* thumbnail / overlay renderer — pass a plan or id */
const CADPlanSVG = ({ plan, width = 100, height = 120, stroke = CAD_TEAL }) => {
  const p = typeof plan === "string" ? CAD_BY_ID[plan] : plan;
  if (!p) return null;
  return (
    <svg width={width} height={height} viewBox="0 0 100 120" style={{ display: "block" }}>
      {p.draw(stroke)}
    </svg>
  );
};

Object.assign(window, { CAD_LIBRARY, CAD_BY_ID, CADPlanSVG, CAD_TEAL, CAD_FORMATS });
