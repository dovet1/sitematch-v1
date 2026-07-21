import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser, adminClient, adminError } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const KINDS = ['opening', 'closure'] as const

function validate(body: Record<string, unknown>): string | null {
  if (!KINDS.includes(body.kind as (typeof KINDS)[number])) {
    return "kind must be 'opening' or 'closure'"
  }
  if (typeof body.headline !== 'string' || !body.headline.trim()) {
    return 'headline is required'
  }
  if (typeof body.event_date !== 'string' || Number.isNaN(new Date(body.event_date).getTime())) {
    return 'event_date must be a valid date'
  }
  return null
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
      .select('id, kind, event_date, is_upcoming, headline, url')
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
      })
      .select('id, kind, event_date, is_upcoming, headline, url')
      .single()
    if (error) throw error

    return NextResponse.json({ event: data })
  } catch (error) {
    return adminError('Error creating brand activity', error)
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
