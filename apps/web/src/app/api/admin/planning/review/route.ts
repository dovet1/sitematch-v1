import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient, adminError, requireAdminUser } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  developmentId: z.string().uuid(),
  decision: z.enum(['approved', 'corrected', 'rejected']),
  relevance: z.enum(['high', 'medium', 'low']).optional(),
  summary: z.string().max(4000).optional(),
  brandSignals: z.array(z.object({
    id: z.string().uuid(),
    reviewState: z.enum(['approved', 'corrected', 'rejected']),
    brandId: z.string().uuid().nullable().optional(),
    role: z.enum([
      'proposed_occupier', 'proposed_operator', 'applicant_developer',
      'existing_occupier', 'former_occupier', 'neighbouring_occupier',
      'referenced_only', 'unclear',
    ]).optional(),
  }).strict()).max(100).optional(),
  observations: z.array(z.object({
    id: z.string().uuid(),
    reviewState: z.enum(['approved', 'corrected', 'rejected']),
    scope: z.enum(['existing', 'proposed', 'lost', 'net', 'stated_unspecified']).optional(),
    value: z.number().nonnegative().optional(),
    confidence: z.number().min(0).max(1).optional(),
  }).strict()).max(100).optional(),
}).strict()

export async function GET(request: NextRequest) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error
    const requested = Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '25', 10)
    const limit = Math.max(1, Math.min(Number.isFinite(requested) ? requested : 25, 100))
    const db = adminClient()

    const { data: developments, error } = await db
      .from('developments')
      .select('*')
      .eq('review_state', 'pending')
      .order('relevance', { ascending: true, nullsFirst: false })
      .order('last_seen_at', { ascending: false })
      .limit(limit)
    if (error) throw error

    const ids = (developments ?? []).map((row) => row.id as string)
    if (ids.length === 0) return NextResponse.json({ developments: [] })

    const [{ data: applicationLinks, error: appError }, { data: signals, error: signalError }, { data: observations, error: observationError }] = await Promise.all([
      db.from('development_applications')
        .select('development_id,role,relationship_source,planning_applications(*)')
        .in('development_id', ids),
      db.from('development_brand_signals').select('*').in('development_id', ids),
      db.from('development_observations').select('*').in('development_id', ids),
    ])
    if (appError) throw appError
    if (signalError) throw signalError
    if (observationError) throw observationError

    return NextResponse.json({
      developments: (developments ?? []).map((development) => ({
        ...development,
        applications: (applicationLinks ?? []).filter((row) => row.development_id === development.id),
        brandSignals: (signals ?? []).filter((row) => row.development_id === development.id),
        observations: (observations ?? []).filter((row) => row.development_id === development.id),
      })),
    })
  } catch (error) {
    return adminError('Error loading planning review queue', error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error
    const parsed = updateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid review', details: parsed.error.flatten() }, { status: 400 })
    }
    const review = parsed.data

    // One call, one transaction, one row lock. This used to be five or more separate writes
    // that touched neither the research queue nor any audit trail, so a correction from high
    // to low returned 200 and left the record queued for a paid research pass, and nothing
    // recorded that a person had disagreed with the model.
    const { data, error } = await adminClient().rpc('apply_planning_review', {
      p_development_id: review.developmentId,
      p_reviewer_id: gate.user!.id,
      p_decision: review.decision,
      p_relevance: review.relevance ?? null,
      p_summary: review.summary ?? null,
      p_brand_signals: review.brandSignals ?? [],
      p_observations: review.observations ?? [],
    })
    if (error) throw error

    // Returned so the caller can see what happened to the queue rather than having to guess:
    // a correction that leaves research `processing` has not stopped a call already in
    // flight, and that is worth showing a reviewer.
    return NextResponse.json({ success: true, ...(data as Record<string, unknown>) })
  } catch (error) {
    return adminError('Error saving planning review', error)
  }
}
