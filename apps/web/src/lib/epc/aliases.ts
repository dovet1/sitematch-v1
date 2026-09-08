import { normTokens } from './normalise'

/**
 * Brand aliases, ported from `scripts/epc/build_config.py`.
 *
 * Derived from the database rather than read from the committed `brand_config.json`,
 * for one reason: a brand created by a CSV import this morning is not in that file, and
 * would silently get no brand signal at all — the strongest evidence the matcher has.
 * Deriving means new brands behave like old ones from the first run.
 *
 * Nothing is invented here. An alias is the brand's own name, plus each of its fascia
 * trading names, exactly as build_config.py builds them.
 */

/**
 * An alias is normalised by the SAME function that normalises the certificate text it
 * will be compared against. That sounds too obvious to state, and it was not true until
 * 2026-09-07: build_config.py used a local normaliser that folded no street suffixes and
 * carried a shorter noise list, so any alias containing a token matchlib folds or drops
 * could never match anything.
 *
 * Nine aliases were dead and four brands had no working alias at all — Pets at Home
 * (matchlib drops AT), Dunnes Stores (drops STORES), Rocks Lane (LANE→LN), Blank Street
 * Coffee (STREET→ST). Pets at Home is a substantial estate that was matching on address
 * text alone, with no brand signal at all.
 *
 * One token is dropped beyond what matchlib removes. "The Co-operative Group" and "The
 * Gym Group" trade as Co-op and The Gym; "Group" is a corporate suffix that never reaches
 * a shopfront or a certificate. It is removed from the ALIAS side only, which is safe and
 * strictly more permissive — an alias matches as a contiguous run of tokens inside the
 * certificate text, so a shorter alias still matches longer text, never the reverse.
 *
 * Measured while making this change: without the trim, normalising aliases with matchlib
 * cost The Co-operative Group its bare OPERATIVE alias — 2,384 stores — to gain four
 * small brands a working one, totalling 56. A fix that was a net loss by a factor of
 * fifty, and one that only showed up because the store counts were checked.
 */
const ALIAS_ONLY_NOISE = new Set(['GROUP'])

export function normAlias(s: string | null | undefined): string[] {
  const toks = normTokens(s)
  const trimmed = toks.filter((t) => !ALIAS_ONLY_NOISE.has(t))
  // Never let the trim empty an alias outright — a brand actually called "Group" keeps it.
  return trimmed.length > 0 ? trimmed : toks
}

/**
 * The 23 hand-listed ambiguous aliases from brand_config.json.
 *
 * These are ordinary English that occurs in address text. A dictionary test over-flags
 * (Iceland, Subway and KFC are dictionary words but perfectly distinctive) and a
 * frequency test conflates a common word with an incomplete estate, so the list is
 * curated. An ambiguous alias may corroborate a match but may not carry one alone.
 *
 * Held in code rather than read from JSON because scripts/epc/README.md asks that it be
 * "reviewed, not extended silently" — which is easier when it is visible in a diff.
 *
 * These are the NORMALISED forms and must be regenerated whenever normalisation changes:
 * the 2026-09-07 fix moved BLANK|STREET|COFFEE to BLANK|ST|COFFEE and TONI|AND|GUY to
 * TONI|GUY, and had they not been updated both brands would have silently lost their
 * ambiguous protection and started carrying matches alone. build_config.py holds the
 * same list as plain words and re-normalises on every build for exactly this reason.
 */
export const AMBIGUOUS_ALIASES = new Set([
  'BLANK|ST|COFFEE', 'BOOM|BATTLE|BAR', 'BYRON', 'CENTRA', 'COFFEE|HOUSE', 'COOK',
  'EE', 'ENTERTAINER', 'ESCAPE|HUNT', 'FREE|PEOPLE', 'GRAVITY', 'GYM', 'HOP', 'NEXT',
  'ODYSSEY', 'PURE', 'RANGE', 'REVOLUTION', 'SIX', 'SUPERBOWL', 'THREE', 'TONI|GUY',
  'ZONE',
])

export interface BrandRow { id: string; name: string }
export interface FasciaRow { id: string; name: string; brand_id: string | null }

export interface AliasIndex {
  /** brand_id -> its alias phrases, as pipe-joined token strings. */
  aliases: Map<string, Set<string>>
  /** brand_id -> the brand ids that may never be its rivals. */
  family: Map<string, Set<string>>
  /** alias phrase -> every brand claiming it. */
  owners: Map<string, Set<string>>
  /** first token -> the phrases starting with it, so scanning is not O(all phrases). */
  byFirst: Map<string, string[]>
}

export function buildAliasIndex(brands: BrandRow[], fascias: FasciaRow[]): AliasIndex {
  const byBrand = new Map<string, FasciaRow[]>()
  for (const f of fascias) {
    if (!f.brand_id) continue
    const list = byBrand.get(f.brand_id)
    if (list) list.push(f)
    else byBrand.set(f.brand_id, [f])
  }

  const aliases = new Map<string, Set<string>>()
  for (const b of brands) {
    const phrases = new Set<string>()
    const own = normAlias(b.name).join('|')
    if (own) phrases.add(own)
    for (const f of byBrand.get(b.id) ?? []) {
      const p = normAlias(f.name).join('|')
      if (p) phrases.add(p)
    }
    if (phrases.size > 0) aliases.set(b.id, phrases)
  }

  // Operator families: brands sharing a fascia trading name are never rivals. Sixteen
  // distinct co-operative societies all trade as "The Co-operative Food", and without
  // this every Co-op match would be rejected as somebody else's certificate.
  const byFasciaName = new Map<string, Set<string>>()
  for (const f of fascias) {
    if (!f.brand_id || !aliases.has(f.brand_id)) continue
    const key = normAlias(f.name).join('|')
    if (!key) continue
    const set = byFasciaName.get(key) ?? new Set<string>()
    set.add(f.brand_id)
    byFasciaName.set(key, set)
  }
  const family = new Map<string, Set<string>>()
  for (const id of Array.from(aliases.keys())) family.set(id, new Set([id]))
  for (const members of Array.from(byFasciaName.values())) {
    if (members.size < 2) continue
    const union = new Set<string>()
    for (const m of Array.from(members)) for (const x of Array.from(family.get(m) ?? [m])) union.add(x)
    for (const m of Array.from(members)) family.set(m, union)
  }

  const owners = new Map<string, Set<string>>()
  for (const [bid, ps] of Array.from(aliases)) {
    for (const p of Array.from(ps)) {
      const set = owners.get(p) ?? new Set<string>()
      set.add(bid)
      owners.set(p, set)
    }
  }

  const byFirst = new Map<string, string[]>()
  for (const p of Array.from(owners.keys())) {
    const head = p.split('|')[0]
    const list = byFirst.get(head)
    if (list) list.push(p)
    else byFirst.set(head, [p])
  }

  return { aliases, family, owners, byFirst }
}

/**
 * matchall.py:phrases_on — which alias phrases appear in this token sequence.
 *
 * Indexed by first token, as the Python is. Scanning all ~300 phrases at every token
 * position would be run for every candidate certificate of every store in the batch,
 * and there can be hundreds of candidates at a busy postcode.
 */
export function phrasesOn(tokens: string[], byFirst: Map<string, string[]>): Set<string> {
  const found = new Set<string>()
  for (let i = 0; i < tokens.length; i++) {
    for (const phrase of byFirst.get(tokens[i]) ?? []) {
      const parts = phrase.split('|')
      if (parts.length > tokens.length - i) continue
      let ok = true
      for (let j = 1; j < parts.length; j++) {
        if (tokens[i + j] !== parts[j]) { ok = false; break }
      }
      if (ok) found.add(phrase)
    }
  }
  return found
}
