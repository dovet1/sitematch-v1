import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// PATCH /api/user/preferences — save UI preferences on the signed-in account (user_metadata),
// so they follow the user across devices. Only known keys are accepted.
export async function PATCH(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const value = (body as { dont_show_mode_chooser?: unknown } | null)?.dont_show_mode_chooser
  if (typeof value !== 'boolean') {
    return NextResponse.json({ error: 'dont_show_mode_chooser must be a boolean' }, { status: 400 })
  }

  // updateUser merges `data` into the existing user_metadata rather than replacing it.
  const { error } = await supabase.auth.updateUser({ data: { dont_show_mode_chooser: value } })
  if (error) {
    console.error('Error saving user preferences:', error)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
  return NextResponse.json({ dont_show_mode_chooser: value })
}
