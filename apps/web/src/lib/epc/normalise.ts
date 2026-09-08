/**
 * Address normalisation, ported from `scripts/epc/matchlib.py`.
 *
 * The Python matcher runs quarterly over the whole estate; this runs per store as
 * they are imported. They must agree exactly, or the same shop gets a different
 * answer depending on which one reached it first — and the difference would show up
 * as a floor area silently changing after a quarterly run, which is the hardest kind
 * of bug to notice.
 *
 * The certificate side of the matching no longer needs any of this: migration
 * 20260909000000 stores each certificate's tokens, units, numbers and house numbers
 * as extracted by the Python functions at load time. What remains here is the store
 * side, where the input is our own address data and cannot be precomputed.
 *
 * Every function below mirrors one in matchlib.py, including its quirks. Do not
 * "improve" one without changing the other: `normalise.test.ts` asserts byte-identical
 * output against the Python across the entire store estate, which is the only reason
 * this file can be trusted.
 */

// Street-type abbreviations, so "HIGH STREET" and "HIGH ST" are one thing.
const SUFFIX: Record<string, string> = {
  ROAD: 'RD', STREET: 'ST', AVENUE: 'AVE', DRIVE: 'DR', LANE: 'LN', CLOSE: 'CL',
  SQUARE: 'SQ', PLACE: 'PL', CRESCENT: 'CRES', PARADE: 'PDE', TERRACE: 'TER',
  CENTRE: 'CTR', CENTER: 'CTR', GARDENS: 'GDNS', PARKWAY: 'PKWY', NORTH: 'N',
  SOUTH: 'S', EAST: 'E', WEST: 'W', SAINT: 'ST', GREAT: 'GT',
}

// Words that appear in so many addresses they carry no evidence. Dropping them stops
// "RETAIL PARK" from scoring as agreement between two unrelated retail parks.
const NOISE = new Set([
  'LTD', 'LIMITED', 'PLC', 'LLP', 'UK', 'GB', 'GMBH', 'THE', 'UNIT', 'UNITS', 'AND',
  'STORES', 'STORE', 'PART', 'GROUND', 'FIRST', 'SECOND', 'FLOOR', 'OF', 'AT', 'CO',
  'PREMISES', 'SHOP', 'BUILDING', 'RETAIL', 'PARK', 'LEVEL', 'BLOCK',
])

const PC_RE = /\b[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}\b/g

/** matchlib._clean — the order of these operations is load-bearing. */
export function clean(...parts: (string | null | undefined)[]): string {
  const s = parts.filter(Boolean).join(' ')
  return s.toUpperCase().replace(/&/g, ' AND ').replace(/'/g, '').replace(/\s+/g, ' ').trim()
}

/** matchlib.norm_tokens */
export function normTokens(...parts: (string | null | undefined)[]): string[] {
  const s = clean(...parts).replace(/[^A-Z0-9 ]+/g, ' ')
  return s
    .split(' ')
    .filter((x) => x !== '')
    .map((x) => SUFFIX[x] ?? x)
    .filter((t) => !NOISE.has(t))
}

/** matchlib.units — "UNIT 4", "UNITS 4/5", "U 12A", or a bare letter. */
export function units(...parts: (string | null | undefined)[]): Set<string> {
  const txt = clean(...parts)
  const out = new Set<string>()
  const re = /\b(?:UNITS?|U)\s*([0-9]{1,4}[A-Z]?(?:\s*\/\s*[0-9]{1,4}[A-Z]?)*|[A-Z])\b/g
  for (const m of txt.matchAll(re)) {
    for (const x of m[1].split('/')) {
      const v = x.trim()
      if (v) out.add(v)
    }
  }
  return out
}

/** matchlib.numbers — every digit present, plus ranges expanded. Liberal on purpose:
 *  this feeds compatible(), which uses it to REJECT candidates, so over-collecting
 *  costs a rejected match and under-collecting accepts a wrong premises. */
export function numbers(...parts: (string | null | undefined)[]): Set<string> {
  const raw = clean(...parts)
  const out = new Set<string>()
  for (const m of raw.matchAll(/\b(\d{1,4})\s*[-/]\s*(\d{1,4})\b/g)) {
    const a = parseInt(m[1], 10)
    const b = parseInt(m[2], 10)
    if (b - a > 0 && b - a <= 200) {
      for (let n = a; n <= b; n++) out.add(String(n))
    }
  }
  for (const t of raw.replace(/[^A-Z0-9 ]/g, ' ').split(' ')) {
    if (t !== '' && /^\d+$/.test(t) && t.length <= 4) out.add(t)
  }
  return out
}

const LEAD = /^\s*(\d{1,4})(?:\s*[-/]\s*(\d{1,4}))?\b/
const AFTER = /\b(?:UNITS?|U|NO|NOS|BLOCK|SUITE|PLOT)\.?\s*(\d{1,4})(?:\s*[-/]\s*(\d{1,4}))?\b/g

function span(a: string, b: string | undefined, out: Set<string>): void {
  if (b !== undefined && parseInt(b, 10) - parseInt(a, 10) > 0 && parseInt(b, 10) - parseInt(a, 10) <= 200) {
    for (let n = parseInt(a, 10); n <= parseInt(b, 10); n++) out.add(String(n))
    return
  }
  out.add(a)
  if (b !== undefined) out.add(b)
}

/**
 * matchlib.house_numbers — strict, unlike numbers(). A digit counts only when it
 * leads a comma-separated component or follows UNIT/NO/BLOCK/SUITE/PLOT.
 *
 * This is the difference that matters: "Junction 1 Retail Park" carries a 1 that is
 * part of a name, and treating it as a street number once matched a McDonald's to a
 * 9,672 m2 retail park. corroboration() is strict acceptance; numbers() is liberal
 * rejection. They are not interchangeable.
 */
export function houseNumbers(...parts: (string | null | undefined)[]): Set<string> {
  const out = new Set<string>()
  for (const part of parts) {
    if (!part) continue
    for (const chunk of clean(part).split(/[,;]/)) {
      const lead = LEAD.exec(chunk.trim())
      if (lead) span(lead[1], lead[2], out)
      for (const m of chunk.matchAll(AFTER)) span(m[1], m[2], out)
    }
  }
  return out
}

export interface StoreAddress {
  address_line_1?: string | null
  address_line_2?: string | null
  town?: string | null
  county?: string | null
}

/** matchlib.store_addr_parts — the postcode is stripped because address_line_1
 *  sometimes carries the town and postcode inline, which inflated the match
 *  denominator and rejected genuine matches until it was removed. */
export function storeAddrParts(s: StoreAddress): string[] {
  return [s.address_line_1, s.address_line_2]
    .filter(Boolean)
    .map((x) => clean(x).replace(PC_RE, ' '))
}

/** matchlib.store_tokens — town and county are dropped, since a certificate at the
 *  same postcode is in the same town by construction and agreement there is not
 *  evidence. Falls back to the undropped tokens rather than returning nothing. */
export function storeTokens(s: StoreAddress): string[] {
  const drop = new Set([...normTokens(s.town), ...normTokens(s.county)])
  const toks = normTokens(...storeAddrParts(s))
  const kept = toks.filter((t) => !drop.has(t))
  return kept.length > 0 ? kept : toks
}
