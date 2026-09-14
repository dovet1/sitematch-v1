import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminClient, adminError, requireAdminUser } from '@/lib/admin-auth'
import {
  FACT_KEYS,
  adminFactValue,
  chosenFactValue,
  reopenedFactState,
  type FactRow,
} from '@/lib/planning-intelligence/facts'

export const dynamic = 'force-dynamic'

const OPEN_STATES = ['not_found_after_research', 'conflicting']
const FACT_COLUMNS = 'development_id,fact,state,reason,value,findings,attempts,decided_by,decided_at,admin_note,updated_at'

/**
 * The completion queue: schemes whose research has ended, in any outcome, with at least one fact
 * still missing or conflicting and not yet decided by an admin. Distinct from the classification
 * review queue, which checks the cheap model's assessment.
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error
    const requested = Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10)
    const limit = Math.max(1, Math.min(Number.isFinite(requested) ? requested : 20, 50))
    const db = adminClient()
    // 'decided' lists schemes with admin decisions, newest first, so a decision can be checked or
    // reopened after its scheme has left the open queue.
    const view = request.nextUrl.searchParams.get('view') === 'decided' ? 'decided' : 'open'

    const openQuery = db.from('development_facts').select('development_id,updated_at')
    const { data: open, error: openError } = await (view === 'decided'
      ? openQuery.not('decided_by', 'is', null).order('decided_at', { ascending: false })
      : openQuery.in('state', OPEN_STATES).is('decided_by', null).order('updated_at', { ascending: false }))
      .limit(500)
    if (openError) throw openError
    const ids = [...new Set((open ?? []).map(row => row.development_id as string))].slice(0, limit)
    if (ids.length === 0) return NextResponse.json({ developments: [] })

    const [developments, facts, links] = await Promise.all([
      db.from('developments')
        .select('id,canonical_name,site_address,postcode,summary,relevance,research_state,research_outcome,research_finished_at,research_attempts')
        .in('id', ids),
      db.from('development_facts').select(FACT_COLUMNS).in('development_id', ids),
      db.from('development_applications')
        .select('development_id,role,planning_applications(id,reference,authority_name,description,stage,date_received,links)')
        .in('development_id', ids),
    ])
    if (developments.error) throw developments.error
    if (facts.error) throw facts.error
    if (links.error) throw links.error

    // Research may still be running on a development that has open facts from an earlier attempt.
    const finished = (developments.data ?? []).filter(d => d.research_state === 'complete')
    const order = new Map(ids.map((id, index) => [id, index]))
    return NextResponse.json({
      developments: finished
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
        .map(development => ({
          ...development,
          facts: FACT_KEYS.map(fact => (facts.data ?? []).find(row => row.development_id === development.id && row.fact === fact)
            ?? { development_id: development.id, fact, state: 'not_checked', reason: null, value: null, findings: [], attempts: [], decided_by: null, decided_at: null, admin_note: null, updated_at: null }),
          // The scheme's own application first, then its amendments and paperwork oldest first.
          applications: (links.data ?? []).filter(row => row.development_id === development.id)
            .sort((a, b) => Number(!['primary', 'principal'].includes(a.role)) - Number(!['primary', 'principal'].includes(b.role))
              || String((a.planning_applications as { date_received?: string } | null)?.date_received ?? '').localeCompare(String((b.planning_applications as { date_received?: string } | null)?.date_received ?? ''))),
        })),
    })
  } catch (error) {
    return adminError('Error loading the planning completion queue', error)
  }
}

const sourceSchema = z.object({
  url: z.string().url().max(2000).nullable(),
  excerpt: z.string().trim().max(4000).nullable(),
  page: z.string().trim().max(40).nullable(),
}).strict()

const actionSchema = z.object({
  developmentId: z.string().uuid(),
  fact: z.enum(FACT_KEYS),
  expectedUpdatedAt: z.string().datetime({ offset: true }).nullable().optional(),
  note: z.string().trim().max(2000).optional(),
}).strict()

const bodySchema = z.discriminatedUnion('action', [
  actionSchema.extend({
    action: z.literal('add'),
    names: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
    useClasses: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    area: z.object({
      value: z.number().finite(),
      unit: z.enum(['sqm', 'sqft', 'hectares', 'acres']),
      extent: z.enum(['whole_development', 'building', 'unit', 'phase', 'unspecified']),
      basis: z.enum(['gross_internal', 'net_internal', 'gross_external', 'unspecified']),
    }).strict().optional(),
    source: sourceSchema,
  }),
  actionSchema.extend({ action: z.literal('choose'), findingKey: z.string().min(1).max(64) }),
  actionSchema.extend({ action: z.literal('unavailable') }),
  actionSchema.extend({ action: z.literal('not_applicable') }),
  actionSchema.extend({ action: z.literal('reopen') }),
])

export async function POST(request: NextRequest) {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid fact update', details: parsed.error.flatten() }, { status: 400 })
    }
    const body = parsed.data
    const reviewerId = gate.user!.id
    const db = adminClient()
    const at = new Date().toISOString()

    let value: unknown = null
    let finding: unknown = null
    let rejectKeys: string[] = []
    try {
      if (body.action === 'add') {
        ({ value, finding } = adminFactValue({
          fact: body.fact, names: body.names, useClasses: body.useClasses, area: body.area, source: body.source,
        }, reviewerId, at))
      } else if (body.action === 'choose') {
        const { data: row, error } = await db.from('development_facts').select('fact,findings')
          .eq('development_id', body.developmentId).eq('fact', body.fact).single()
        if (error) throw error
        ;({ value, rejectKeys } = chosenFactValue(row as Pick<FactRow, 'fact' | 'findings'>, body.findingKey))
      }
    } catch (validation) {
      if (validation instanceof Error && !('code' in validation)) {
        return NextResponse.json({ error: validation.message }, { status: 400 })
      }
      throw validation
    }

    const { data, error } = await db.rpc('planning_complete_development_fact', {
      p_development_id: body.developmentId,
      p_fact: body.fact,
      p_action: body.action,
      p_reviewer_id: reviewerId,
      p_value: value,
      p_finding: finding,
      p_reject_keys: rejectKeys,
      p_note: body.note ?? null,
      p_expected_updated_at: body.expectedUpdatedAt ?? null,
    })
    if (error?.code === 'PT409') return NextResponse.json({ error: 'This fact changed. Reload before saving.' }, { status: 409 })
    if (error?.code === '22023') return NextResponse.json({ error: error.message }, { status: 400 })
    if (error?.code === 'PGRST202') return NextResponse.json({ error: 'The facts database update has not been applied yet.' }, { status: 503 })
    if (error) throw error

    if (body.action === 'reopen') {
      const reopened = data as FactRow
      const machine = reopenedFactState(reopened)
      // The row is no longer admin-decided, so this machine write sets its state; findings are unioned
      // with the stored row, so nothing is lost.
      const { error: restoreError } = await db.rpc('planning_record_development_facts', {
        p_development_id: body.developmentId,
        p_rows: [{ fact: body.fact, ...machine, findings: [], attempts: reopened.attempts }],
      })
      if (restoreError) throw restoreError
      return NextResponse.json({ success: true, fact: { ...reopened, ...machine } })
    }
    return NextResponse.json({ success: true, fact: data })
  } catch (error) {
    return adminError('Error saving the planning fact', error)
  }
}
