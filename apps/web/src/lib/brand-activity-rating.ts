import { z } from 'zod'

// Suggests an acquisition-signal rating (-5..+5) for a brand activity article
// (brand_activity.signal_rating). Only ever a suggestion: the admin sees the rating and the
// reason before saving, and a saved suggestion is marked signal_rated_by = 'model' unless the
// admin changed it.

export const BRAND_ACTIVITY_RATING_MODEL = 'anthropic/claude-haiku-4.5'
const FETCH_TIMEOUT_MS = 8_000
const MODEL_TIMEOUT_MS = 30_000
const MAX_ARTICLE_BYTES = 400_000
const MAX_ARTICLE_CHARS = 6_000

export const RATING_RUBRIC = [
  'You rate UK retail and leisure news for commercial property agents.',
  'Given one article about a brand, rate how strong a signal it is that the brand is acquiring new UK stores right now, from -5 to +5.',
  '+5: an explicit, near-term roll-out of many stores (e.g. "30 stores in the next two months", a funded national expansion).',
  '+3 to +4: a stated expansion programme or several openings/signings, or a named target number of stores.',
  '+1 to +2: a single store opening or signing, or a general positive trading update.',
  '0: neutral or unrelated to the UK estate (results with no estate news, product launches, people moves).',
  '-1 to -2: a single closure, a relocation that shrinks the estate, or a pause in openings.',
  '-3 to -4: several closures, a CVA or restructuring that closes stores, profit warnings with estate cuts.',
  '-5: administration, liquidation or closing all stores.',
  'Judge only what the article says. Reply with the rating and one short sentence of reason that names the evidence.',
].join(' ')

const ratingSchema = z.object({
  rating: z.number().int().min(-5).max(5),
  reason: z.string().trim().min(1),
}).strict()

export type RatingSuggestion = z.infer<typeof ratingSchema> & { model: string; readArticle: boolean }

const ratingJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['rating', 'reason'],
  properties: {
    rating: { type: 'integer', minimum: -5, maximum: 5 },
    reason: { type: 'string' },
  },
}

// The article fetch runs from our server on an admin-supplied URL, so private and local hosts
// are refused rather than fetched.
export function isFetchableUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false
  // IP literals (v4 or v6) are never news sites.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':') || host.startsWith('[')) return false
  return host.includes('.')
}

export function articleText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ARTICLE_CHARS)
}

async function fetchArticle(url: string): Promise<string | null> {
  try {
    // Redirects are followed by hand so every hop passes the same host check.
    let current = url
    for (let hop = 0; hop < 4; hop++) {
      if (!isFetchableUrl(current)) return null
      const res = await fetch(current, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteMatcherBot/1.0)' },
      })
      const next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
      if (next) {
        current = new URL(next, current).toString()
        continue
      }
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return null
      const html = (await res.text()).slice(0, MAX_ARTICLE_BYTES)
      const text = articleText(html)
      return text.length >= 200 ? text : null
    }
    return null
  } catch {
    return null
  }
}

export async function suggestRating(
  input: { brandName: string; kind: string; headline: string; url: string | null; date: string | null },
  options: { apiKey: string; model?: string }
): Promise<RatingSuggestion> {
  const article = input.url ? await fetchArticle(input.url) : null
  const model = options.model ?? process.env.OPENROUTER_BRAND_ACTIVITY_MODEL ?? BRAND_ACTIVITY_RATING_MODEL
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://thecommercialdirectory.co.uk',
      'X-Title': 'SiteMatcher Brand Activity Rating',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 200,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'brand_activity_rating', strict: true, schema: ratingJsonSchema },
      },
      messages: [
        { role: 'system', content: RATING_RUBRIC },
        {
          role: 'user',
          content: JSON.stringify({
            brand: input.brandName,
            kind: input.kind,
            date: input.date,
            headline: input.headline,
            // Without the article the rating rests on the headline alone; the admin is told.
            articleText: article,
          }),
        },
      ],
    }),
  })
  const body = (await res.json().catch(() => ({}))) as {
    model?: string
    choices?: Array<{ message?: { content?: string | null } }>
    error?: { message?: string }
  }
  if (!res.ok) throw new Error(body.error?.message ?? `OpenRouter request failed (${res.status})`)
  let parsed: unknown = null
  try {
    parsed = JSON.parse(body.choices?.[0]?.message?.content ?? '')
  } catch {
    parsed = null
  }
  const result = ratingSchema.safeParse(parsed)
  if (!result.success) throw new Error('The model did not return a rating')
  return { ...result.data, model: body.model ?? model, readArticle: article != null }
}
