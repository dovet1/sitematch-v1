import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser, adminClient, adminError } from '@/lib/admin-auth'
import { suggestRating } from '@/lib/brand-activity-rating'

export const dynamic = 'force-dynamic'

// A model's suggested acquisition-signal rating for an article. Nothing is saved: the admin
// reviews the rating and reason in the Activity tab and saves it with the article.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY is not configured' }, { status: 503 })

    const { id } = await params
    const body = await request.json()
    if (typeof body.headline !== 'string' || !body.headline.trim()) {
      return NextResponse.json({ error: 'headline is required' }, { status: 400 })
    }

    const { data: brand, error } = await adminClient().from('brands').select('name').eq('id', id).single()
    if (error) throw error

    const suggestion = await suggestRating(
      {
        brandName: brand.name,
        kind: typeof body.kind === 'string' ? body.kind : 'news',
        headline: body.headline.trim(),
        url: typeof body.url === 'string' && body.url.trim() ? body.url.trim() : null,
        date: typeof body.event_date === 'string' && body.event_date ? body.event_date : null,
      },
      { apiKey }
    )
    return NextResponse.json({ suggestion })
  } catch (error) {
    return adminError('Error suggesting a rating', error)
  }
}
