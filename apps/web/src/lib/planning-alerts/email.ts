import { createPlanningAlertToken } from './signing'
import { monthKey } from './period'
import type { PlanningAlertApplication, PlanningAlertDigest } from './types'

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]!)
}

function applicationRows(applications: PlanningAlertApplication[]): string {
  if (applications.length === 0) {
    return '<tr><td style="padding:18px 0;color:#667085;font-size:14px">No matching applications this month.</td></tr>'
  }
  return applications.map((application) => `
    <tr><td style="padding:16px 0;border-bottom:1px solid #eaecf0">
      <div style="font-size:12px;font-weight:700;color:#6941c6;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(application.reference)}</div>
      <div style="margin-top:5px;font-size:15px;font-weight:700;color:#101828">${escapeHtml(application.address)}</div>
      <div style="margin-top:5px;font-size:13px;line-height:1.55;color:#475467">${escapeHtml(application.description)}</div>
      ${application.nearestStore ? `<div style="margin-top:8px;font-size:12px;color:#667085">${application.nearestStore.distanceKm.toFixed(1)} km from ${escapeHtml(application.nearestStore.name)}</div>` : ''}
    </td></tr>`).join('')
}

export function createMonthlyPlanningAlertEmail(
  digest: PlanningAlertDigest,
  siteUrl: string,
  reportUrlOverride?: string
) {
  const reportUrl = reportUrlOverride ?? (() => {
    const token = createPlanningAlertToken(digest.subscriptionId)
    return `${siteUrl.replace(/\/$/, '')}/planning-alerts/${token}?month=${monthKey(digest.period)}`
  })()
  const total = digest.nearStoreApplications.length + digest.patchApplications.length
  const providerNote = digest.provider === 'mock'
    ? 'Demonstration data modelled on the PlanNexus response format.'
    : 'Planning data provided by PlanNexus.'
  const html = `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:Arial,sans-serif;color:#101828">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="620" style="max-width:620px;width:100%;background:#fff;border:1px solid #e4e7ec;border-radius:16px;overflow:hidden" cellspacing="0" cellpadding="0">
        <tr><td style="padding:30px 32px;background:#201547;color:#fff">
          <div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#d6ccff">SiteMatcher planning intelligence</div>
          <h1 style="margin:10px 0 6px;font-size:27px;line-height:1.2">${escapeHtml(digest.period.label)} planning activity</h1>
          <div style="font-size:14px;color:#e7e2ff">${escapeHtml(digest.brand.name)} · ${total} relevant application${total === 1 ? '' : 's'}</div>
        </td></tr>
        <tr><td style="padding:28px 32px">
          <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#344054">Your monthly view covers ${digest.stores.length} stores, a ${digest.radiusKm} km radius around each store, and the wider ${escapeHtml(digest.patch.name)} patch.</p>
          ${digest.summary ? `<div style="margin-bottom:24px;padding:16px;border-radius:10px;background:#f4f1ff;color:#34236f;font-size:14px;line-height:1.6">${escapeHtml(digest.summary)}</div>` : ''}
          <a href="${escapeHtml(reportUrl)}" style="display:inline-block;padding:13px 20px;border-radius:9px;background:#6941c6;color:#fff;text-decoration:none;font-size:14px;font-weight:700">Open estate map and full report</a>
          <h2 style="margin:30px 0 0;font-size:18px">Within ${digest.radiusKm} km of a store <span style="color:#667085;font-weight:400">(${digest.nearStoreApplications.length})</span></h2>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${applicationRows(digest.nearStoreApplications)}</table>
          <h2 style="margin:30px 0 0;font-size:18px">Elsewhere in your patch <span style="color:#667085;font-weight:400">(${digest.patchApplications.length})</span></h2>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${applicationRows(digest.patchApplications)}</table>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #eaecf0;font-size:12px;line-height:1.5;color:#667085">${providerNote} Distances are straight-line measurements. You are receiving this because monthly planning alerts are enabled for your SiteMatcher account.</td></tr>
      </table>
    </td></tr></table></body></html>`

  const text = `${digest.period.label} planning activity for ${digest.brand.name}\n\n${total} relevant applications: ${digest.nearStoreApplications.length} within ${digest.radiusKm} km of a store and ${digest.patchApplications.length} elsewhere in ${digest.patch.name}.\n\nOpen the estate map and full report: ${reportUrl}\n\n${providerNote}`
  return { subject: `${digest.brand.name}: ${total} planning updates for ${digest.period.label}`, html, text, reportUrl }
}

export async function sendMonthlyPlanningAlert(digest: PlanningAlertDigest, siteUrl: string) {
  const email = createMonthlyPlanningAlertEmail(digest, siteUrl)
  const { sendEmail } = await import('@/lib/resend')
  return sendEmail({ to: [digest.recipient.email], subject: email.subject, html: email.html, text: email.text })
}
