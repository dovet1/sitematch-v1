import type { ResearchSource } from './research-sources'
import type { PlanningResearchFloorspace } from './types'

/** Read the explicitly labelled TOTALS in the standard non-residential form table.
 * No dimensions, arithmetic, individual-use rows, or residential tables are inferred.
 */
export function standardFormFloorspace(sources: ResearchSource[]): PlanningResearchFloorspace[] {
  const findings: PlanningResearchFloorspace[] = []
  for (const source of sources) {
    if (source.kind !== 'document') continue
    const start = source.text.search(/All Types of Development:\s*Non-Residential Floorspace/i)
    if (start < 0) continue
    const section = source.text.slice(start).split(/Tradable floor area|Loss or gain of rooms/i)[0]
    const totalsAt = section.search(/\bTotals\b/i)
    if (totalsAt < 0) continue
    const totals = section.slice(totalsAt)
    const labels = [
      ['existing', /Existing gross internal floorspace \(square metres\) \(a\)\s*:?\s*(\d+(?:\.\d+)?)/i],
      ['lost', /Gross internal floorspace to be lost by change of use or demolition \(square metres\) \(b\)\s*:?\s*(\d+(?:\.\d+)?)/i],
      ['proposed', /Total gross new internal floorspace proposed \(including changes of use\) \(square metres\) \(c\)\s*:?\s*(\d+(?:\.\d+)?)/i],
      ['net', /Net additional gross internal floorspace following development \(square metres\) \(d = c - a\)\s*:?\s*(\d+(?:\.\d+)?)/i],
    ] as const
    for (const [scope, pattern] of labels) {
      const match = totals.match(pattern)
      if (!match) continue
      const before = source.text.slice(0, start + totalsAt + (match.index ?? 0))
      const pages = [...before.matchAll(/\[PDF page (\d+)\]/g)]
      findings.push({ scope, sqm: Number(match[1]), measurementBasis: 'gross_internal',
        evidenceSource: 'document', evidenceUrl: source.url, evidenceExcerpt: match[0],
        evidencePage: pages.at(-1)?.[1] ?? null, confidence: 1,
      })
    }
  }
  return findings
}

/** Keep explicitly labelled company applicants separate from operators/developers.
 * Restrict to form pages containing Applicant Details without an Agent Details section.
 */
export function standardFormApplicants(sources: ResearchSource[]) {
  return sources.flatMap(source => {
    if (source.kind !== 'document') return []
    return [...source.text.matchAll(/\[PDF page (\d+)\]([^]*?)(?=\[PDF page \d+\]|$)/g)].flatMap(page => {
      const text = page[2].trim()
      if (!/\bApplicant Details\b/.test(text) || /\bAgent Details\b/.test(text)) return []
      const name = text.match(/Company Name\s+(.+?)\s+Address\b/)?.[1]?.trim()
      if (!name || name.length > 150 || /redacted|not provided|not applicable/i.test(name)) return []
      return [{ name, role: 'applicant' as const, evidenceSource: 'document' as const,
        evidenceUrl: source.url, evidenceExcerpt: text, evidencePage: page[1], confidence: 1 }]
    })
  })
}
