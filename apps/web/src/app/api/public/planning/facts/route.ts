import { NextRequest, NextResponse } from 'next/server'
import { createPlanningAdminClient } from '@/lib/planning-intelligence/db'
import { publicFacts, type FactRow } from '@/lib/planning-intelligence/facts'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A scheme's researched and reviewed facts for the planning modal. Only the published projection
 * leaves the server: values, states and completing sources, never context findings such as an
 * applicant's name, and nothing for a scheme no one has looked at.
 */
export async function GET(request: NextRequest) {
  const developmentId = request.nextUrl.searchParams.get('developmentId') ?? ''
  if (!UUID.test(developmentId)) return NextResponse.json({ error: 'A development id is required' }, { status: 400 })
  try {
    const { data, error } = await createPlanningAdminClient()
      .from('development_facts')
      .select('fact,state,value,findings,decided_by')
      .eq('development_id', developmentId)
    // Before the facts migration is applied the table does not exist; the modal simply shows none.
    if (error?.code === '42P01' || error?.code === 'PGRST205') return NextResponse.json({ facts: [] })
    if (error) throw error
    return NextResponse.json({ facts: publicFacts((data ?? []) as Array<Pick<FactRow, 'fact' | 'state' | 'value' | 'findings' | 'decided_by'>>) })
  } catch (error) {
    console.error('[planning-facts] Read failed', error)
    return NextResponse.json({ error: 'Scheme facts are unavailable' }, { status: 500 })
  }
}
