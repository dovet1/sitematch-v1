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
    const db = adminClient()
    const developmentUpdate: Record<string, unknown> = {
      review_state: review.decision,
      updated_at: new Date().toISOString(),
    }
    if (review.relevance !== undefined) developmentUpdate.relevance = review.relevance
    if (review.summary !== undefined) developmentUpdate.summary = review.summary
    const { error: developmentError } = await db
      .from('developments')
      .update(developmentUpdate)
      .eq('id', review.developmentId)
    if (developmentError) throw developmentError

    for (const signal of review.brandSignals ?? []) {
      const update: Record<string, unknown> = { review_state: signal.reviewState, updated_at: new Date().toISOString() }
      if ('brandId' in signal) update.brand_id = signal.brandId ?? null
      if (signal.role) update.role = signal.role
      const { error } = await db.from('development_brand_signals')
        .update(update).eq('id', signal.id).eq('development_id', review.developmentId)
      if (error) throw error
    }
    for (const observation of review.observations ?? []) {
      const update: Record<string, unknown> = { review_state: observation.reviewState }
      if (observation.scope !== undefined) update.scope = observation.scope
      if (observation.value !== undefined) update.value = observation.value
      if (observation.confidence !== undefined) update.confidence = observation.confidence
      const { error } = await db.from('development_observations')
        .update(update).eq('id', observation.id).eq('development_id', review.developmentId)
      if (error) throw error
    }

    // Application review state mirrors the Development decision. This is useful for the
    // evaluation export and prevents a reviewed item returning to the queue.
    const { data: links, error: linksError } = await db
      .from('development_applications')
      .select('planning_application_id')
      .eq('development_id', review.developmentId)
    if (linksError) throw linksError
    const applicationIds = (links ?? []).map((row) => row.planning_application_id as string)
    if (applicationIds.length > 0) {
      const { error } = await db.from('planning_applications')
        .update({ review_state: review.decision }).in('id', applicationIds)
      if (error) throw error
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return adminError('Error saving planning review', error)
  }
}

