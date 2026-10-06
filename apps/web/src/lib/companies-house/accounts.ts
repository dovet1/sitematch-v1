// Reads turnover and net assets from an accounts filing in inline XBRL (iXBRL), the format
// Companies House serves for electronically filed accounts. Only tagged facts are read: a
// figure that appears in the text but carries no tag is left for a person, never guessed.
//
// A fact counts for the year when its context has no dimensions (the whole company, not a
// segment or a column of the reserves note) and its period ends on the accounts date.

export interface AccountsFigures {
  periodEnd: string | null
  turnover: number | null
  netAssets: number | null
}

interface Context {
  dimensional: boolean
  endDate: string | null
  instant: string | null
}

const TURNOVER = ['TurnoverRevenue', 'Revenue']
// Net assets on the balance sheet; total equity is the same figure where no net-assets line is tagged.
const NET_ASSETS = ['NetAssetsLiabilities', 'Equity']

function contexts(xhtml: string): Map<string, Context> {
  const out = new Map<string, Context>()
  const re = /<(?:[\w-]+:)?context\b[^>]*\bid\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:[\w-]+:)?context>/gi
  for (const m of xhtml.matchAll(re)) {
    const body = m[2]
    const date = (tag: string) =>
      body.match(new RegExp(`<(?:[\\w-]+:)?${tag}>\\s*(\\d{4}-\\d{2}-\\d{2})`, 'i'))?.[1] ?? null
    out.set(m[1], {
      dimensional: /<(?:[\w-]+:)?(segment|scenario)\b/i.test(body),
      endDate: date('endDate'),
      instant: date('instant'),
    })
  }
  return out
}

interface Fact {
  local: string
  contextRef: string
  value: number
}

function attr(attrs: string, name: string): string | null {
  return attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? null
}

// ixt number formats: numdotdecimal "1,234.5", numcommadecimal "1.234,5", zerodash / fixed-zero "-".
export function parseIxNumber(text: string, format: string | null): number | null {
  const f = (format ?? '').toLowerCase()
  const t = text.replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;|\s/g, '')
  if (/zerodash|fixed-zero|nocontent/.test(f) || /^[-–—]$/.test(t)) return 0
  let digits = t.replace(/[^0-9.,]/g, '')
  if (/numcommadecimal|num-comma-decimal/.test(f)) digits = digits.replace(/\./g, '').replace(',', '.')
  else digits = digits.replace(/,/g, '')
  if (!/\d/.test(digits)) return null
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
}

function facts(xhtml: string): Fact[] {
  const out: Fact[] = []
  // Innermost-first is not needed: nested nonFraction elements are vanishingly rare in CH filings.
  for (const m of xhtml.matchAll(/<(?:[\w-]+:)?nonFraction\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?nonFraction>/gi)) {
    const attrs = m[1]
    const name = attr(attrs, 'name')
    const contextRef = attr(attrs, 'contextRef')
    if (!name || !contextRef) continue
    const raw = parseIxNumber(m[2], attr(attrs, 'format'))
    if (raw == null) continue
    const scale = Number(attr(attrs, 'scale') ?? 0) || 0
    const sign = attr(attrs, 'sign') === '-' ? -1 : 1
    out.push({ local: name.split(':').pop()!, contextRef, value: sign * raw * 10 ** scale })
  }
  return out
}

// periodEnd: the accounts date from the filing history (YYYY-MM-DD). Without it, the latest
// period end among the tagged figures is taken.
export function parseIxbrlFigures(xhtml: string, periodEnd?: string | null): AccountsFigures {
  const ctx = contexts(xhtml)
  const all = facts(xhtml)
  const plain = (f: Fact) => {
    const c = ctx.get(f.contextRef)
    return c && !c.dimensional ? c : null
  }

  let end = periodEnd ?? null
  if (!end) {
    const ends = all
      .filter((f) => TURNOVER.includes(f.local) || NET_ASSETS.includes(f.local))
      .map((f) => plain(f)?.endDate ?? plain(f)?.instant)
      .filter((d): d is string => !!d)
      .sort()
    end = ends[ends.length - 1] ?? null
  }
  if (!end) return { periodEnd: null, turnover: null, netAssets: null }

  const pick = (names: string[], period: 'duration' | 'instant'): number | null => {
    for (const name of names) {
      const hit = all.find((f) => {
        if (f.local !== name) return false
        const c = plain(f)
        return !!c && (period === 'duration' ? c.endDate === end : c.instant === end)
      })
      if (hit) return hit.value
    }
    return null
  }

  return { periodEnd: end, turnover: pick(TURNOVER, 'duration'), netAssets: pick(NET_ASSETS, 'instant') }
}
