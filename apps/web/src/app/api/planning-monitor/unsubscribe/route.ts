import { NextRequest, NextResponse } from 'next/server'
import { createPlanningAdminClient } from '@/lib/planning-intelligence/db'
import { verifyUnsubscribeToken } from '@/lib/planning-monitor/signing'

export const dynamic = 'force-dynamic'

/**
 * Signed one-click unsubscribe for one weekly subscription. Works signed out (mail clients call it
 * directly). It disables future emails only: the patch, its map and its reports are untouched.
 */
async function unsubscribe(token: string | null) {
  const subscriptionId = token ? verifyUnsubscribeToken(token) : null
  if (!subscriptionId) return false
  const { error } = await createPlanningAdminClient()
    .from('planning_monitor_subscriptions')
    .update({ email_enabled: false, unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', subscriptionId)
  if (error) throw error
  return true
}

function page(title: string, body: string, status = 200, extraHtml = '') {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#F6F5FB;color:#1C1B22">
<main style="max-width:480px;margin:12vh auto;padding:28px;background:#fff;border:1px solid #ECEAF3;border-radius:16px">
<h1 style="margin:0 0 10px;font-size:20px">${title}</h1><p style="margin:0;line-height:1.55;color:#6B6B78">${body}</p>${extraHtml}
</main></body></html>`
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}

// GET shows a confirmation button rather than acting, so link scanners that prefetch URLs cannot unsubscribe people.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token || !verifyUnsubscribeToken(token)) return page('Link not recognised', 'This unsubscribe link is invalid. You can change email settings from your patch in SiteMatcher.', 400)
  const action = `/api/planning-monitor/unsubscribe?token=${encodeURIComponent(token)}`
  return page(
    'Stop this weekly email?',
    'You will stop receiving the weekly briefing for this patch. Your patch and past reports stay available.',
    200,
    `<form method="post" action="${action.replace(/"/g, '&quot;')}" style="margin-top:18px"><button type="submit" style="padding:11px 18px;border:0;border-radius:12px;background:#6C47FF;color:#fff;font-weight:700;font-size:14px;cursor:pointer">Unsubscribe</button></form>`
  )
}

// POST is the RFC 8058 one-click endpoint and the confirmation form's target.
export async function POST(request: NextRequest) {
  try {
    const ok = await unsubscribe(request.nextUrl.searchParams.get('token'))
    if (!ok) return page('Link not recognised', 'This unsubscribe link is invalid.', 400)
    return page('Unsubscribed', 'You will no longer receive the weekly briefing for this patch. You can turn it back on from the patch’s notification settings.')
  } catch (error) {
    console.error('[planning-monitor] unsubscribe failed', error)
    return page('Something went wrong', 'We could not update your preference. Please try again.', 500)
  }
}
