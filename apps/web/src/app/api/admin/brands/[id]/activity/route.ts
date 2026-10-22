import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser, adminClient, adminError } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const KINDS = ['opening', 'closure', 'news'] as const
const RATED_BY = ['admin', 'model'] as const
const COLUMNS =
  'id, kind, event_date, is_upcoming, headline, url, signal_rating, signal_reason, signal_rated_by'

function validateRating(body: Record<string, unknown>): string | null {
  const r = body.signal_rating
  if (typeof r !== 'number' || !Number.isInteger(r) || r < -5 || r > 5) {
    return 'signal_rating must be a whole number from -5 to 5'
  }
  if (body.signal_rated_by != null && !RATED_BY.includes(body.signal_rated_by as (typeof RATED_BY)[number])) {
    return "signal_rated_by must be 'admin' or 'model'"
  }
  return null
}

function ratingFields(body: Record<string, unknown>) {
  return {
    signal_rating: body.signal_rating as number,
    signal_reason: typeof body.signal_reason === 'string' && body.signal_reason.trim() ? body.signal_reason.trim() : null,
    // A suggestion the admin left untouched stays marked as the model's.
    signal_rated_by: body.signal_rated_by === 'model' ? 'model' : 'admin',
  }
}

function validate(body: Record<string, unknown>): string | null {
  if (!KINDS.includes(body.kind as (typeof KINDS)[number])) {
    return "kind must be 'opening', 'closure' or 'news'"
  }
  if (typeof body.headline !== 'string' || !body.headline.trim()) {
    return 'headline is required'
  }
  if (typeof body.event_date !== 'string' || Number.isNaN(new Date(body.event_date).getTime())) {
    return 'event_date must be a valid date'
  }
  return validateRating(body)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error

    const { id } = await params
    const supabase = adminClient()
    const { data, error } = await supabase
      .from('brand_activity')
      .select(COLUMNS)
      .eq('brand_id', id)
      .order('event_date', { ascending: false })
    if (error) throw error

    return NextResponse.json({ activity: data || [] })
  } catch (error) {
    return adminError('Error fetching brand activity', error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error

    const { id } = await params
    const body = await request.json()
    const invalid = validate(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const supabase = adminClient()
    const { data, error } = await supabase
      .from('brand_activity')
      .insert({
        brand_id: id,
        kind: body.kind,
        event_date: body.event_date,
        is_upcoming: Boolean(body.is_upcoming),
        headline: body.headline.trim(),
        url: body.url || null,
        ...ratingFields(body),
      })
      .select(COLUMNS)
      .single()
    if (error) throw error

    return NextResponse.json({ event: data })
  } catch (error) {
    return adminError('Error creating brand activity', error)
  }
}

// Re-rate an existing article. Only the rating fields can change here.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error

    const { id } = await params
    const body = await request.json()
    if (typeof body.event_id !== 'string') {
      return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
    }
    const invalid = validateRating(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const supabase = adminClient()
    const { data, error } = await supabase
      .from('brand_activity')
      .update(ratingFields(body))
      .eq('id', body.event_id)
      .eq('brand_id', id)
      .select(COLUMNS)
      .single()
    if (error) throw error

    return NextResponse.json({ event: data })
  } catch (error) {
    return adminError('Error rating brand activity', error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error

    const { id } = await params
    const eventId = request.nextUrl.searchParams.get('event_id')
    if (!eventId) return NextResponse.json({ error: 'event_id is required' }, { status: 400 })

    const supabase = adminClient()
    // Scoped to brand_id as well as id so a stale client cannot delete another brand's row.
    const { error } = await supabase
      .from('brand_activity')
      .delete()
      .eq('id', eventId)
      .eq('brand_id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return adminError('Error deleting brand activity', error)
  }
}
