import type { DigestReport } from './types'

/**
 * The weekly email. It carries the same saved summary and deterministic counts the patch card
 * shows, the top linked applications, and links to the frozen report and to preferences.
 */

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]!)
}

function safeUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

export const EMAIL_HIGHLIGHTS = 10

export function renderWeeklyEmail(input: {
  report: DigestReport
  reportUrl: string
  mapUrl: string
  preferencesUrl: string
  unsubscribeUrl: string
}) {
  const { report } = input
  const counts = report.counts
  const summary = report.summary
  const aiUnavailable = report.summaryKind === 'fallback'
  const highlights = report.highlights.slice(0, EMAIL_HIGHLIGHTS)
  const more = report.highlights.length - highlights.length + report.omittedHighlights
  const quiet = report.summaryKind === 'no_changes'

  const statLine = counts
    ? [
        `${counts.newApplications} new`,
        `${counts.decisions} decision${counts.decisions === 1 ? '' : 's'}`,
        counts.approvals ? `${counts.approvals} approved` : null,
        counts.lateDiscoveries ? `${counts.lateDiscoveries} newly found` : null,
        counts.watchedChanges ? `${counts.watchedChanges} watched` : null,
      ].filter(Boolean).join(' · ')
    : ''

  const subject = quiet
    ? `${report.patchName}: no matching planning changes (${report.periodLabel})`
    : `${report.patchName}: ${statLine} (${report.periodLabel})`

  const keyChanges = (summary?.keyChanges ?? []).map((c) => `<li style="margin:0 0 8px">${escapeHtml(c.text)}</li>`).join('')
  const watched = (summary?.watchedChanges ?? []).map((c) => `<li style="margin:0 0 8px">${escapeHtml(c.text)}</li>`).join('')
  const caveats = (summary?.caveats ?? []).map((c) => `<p style="margin:0 0 6px;font-size:12px;color:#6B6B78">${escapeHtml(c)}</p>`).join('')
  const rows = highlights.map((h) => {
    const href = safeUrl(h.sourceUrl)
    return `<tr><td style="padding:14px 0;border-bottom:1px solid #ECEAF3">
      <div style="font-size:12px;font-weight:700;color:#4B23C9">${escapeHtml(h.headline)}</div>
      <div style="margin-top:4px;font-size:14px;font-weight:600;color:#1C1B22">${escapeHtml(h.address || h.reference)}</div>
      <div style="margin-top:3px;font-size:12px;color:#8A8895">${escapeHtml(h.authorityName)} · ${escapeHtml(h.reference)}${h.approximateLocation ? ' · approximate location' : ''}</div>
      ${href ? `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:6px;font-size:12px;color:#6C47FF">Council record</a>` : ''}
    </td></tr>`
  }).join('')

  const html = `<!doctype html><html><body style="margin:0;background:#F6F5FB;font-family:Arial,Helvetica,sans-serif;color:#1C1B22">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="620" style="max-width:620px;width:100%;background:#fff;border:1px solid #ECEAF3;border-radius:16px" cellspacing="0" cellpadding="0">
<tr><td style="padding:26px 28px 8px">
  <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6C47FF">Planning monitor · ${escapeHtml(report.periodLabel)}</div>
  <h1 style="margin:8px 0 4px;font-size:24px;line-height:1.25">${escapeHtml(report.patchName)}</h1>
  ${statLine && !quiet ? `<div style="font-size:14px;color:#6B6B78">${escapeHtml(statLine)}</div>` : ''}
</td></tr>
<tr><td style="padding:14px 28px">
  <div style="padding:16px 18px;border-radius:14px;background:#F3EFFF;border:1px solid #E7DEFF">
    <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6C47FF">${aiUnavailable || quiet ? 'Summary' : 'AI summary'}</div>
    <p style="margin:8px 0 0;font-size:14px;line-height:1.55;color:#2A2833">${escapeHtml(summary?.overview ?? '')}</p>
    ${keyChanges ? `<ul style="margin:12px 0 0;padding-left:18px;font-size:14px;line-height:1.5;color:#2A2833">${keyChanges}</ul>` : ''}
    ${summary?.residentialTheme ? `<p style="margin:10px 0 0;font-size:14px;line-height:1.5"><strong>Residential:</strong> ${escapeHtml(summary.residentialTheme)}</p>` : ''}
    ${summary?.commercialTheme ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.5"><strong>Commercial:</strong> ${escapeHtml(summary.commercialTheme)}</p>` : ''}
  </div>
  ${watched ? `<h2 style="margin:22px 0 6px;font-size:16px">Developments you watch</h2><ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.5">${watched}</ul>` : ''}
  <div style="margin-top:14px">${caveats}</div>
  <a href="${escapeHtml(input.reportUrl)}" style="display:inline-block;margin-top:16px;padding:12px 18px;border-radius:12px;background:#6C47FF;color:#fff;text-decoration:none;font-size:14px;font-weight:700">Open full patch report</a>
  <a href="${escapeHtml(input.mapUrl)}" style="display:inline-block;margin:16px 0 0 10px;font-size:13px;color:#4B23C9">View current map</a>
  ${rows ? `<h2 style="margin:26px 0 0;font-size:16px">Top applications</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>` : ''}
  ${more > 0 ? `<p style="margin:10px 0 0;font-size:13px;color:#6B6B78">${more} more in the full report.</p>` : ''}
</td></tr>
<tr><td style="padding:18px 28px;background:#F6F5FB;border-top:1px solid #ECEAF3;border-radius:0 0 16px 16px;font-size:12px;line-height:1.5;color:#6B6B78">
  Planning data from council records via Plota. Approval is permission, not a completed building. Locations marked approximate are area centres, not exact sites.<br>
  <a href="${escapeHtml(input.preferencesUrl)}" style="color:#4B23C9">Manage preferences</a> · <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#4B23C9">Unsubscribe from this weekly email</a>
</td></tr></table></td></tr></table></body></html>`

  const text = [
    `Planning monitor: ${report.patchName}`,
    report.periodLabel,
    statLine && !quiet ? statLine : null,
    '',
    summary?.overview ?? '',
    ...(summary?.keyChanges ?? []).map((c) => `- ${c.text}`),
    summary?.residentialTheme ? `Residential: ${summary.residentialTheme}` : null,
    summary?.commercialTheme ? `Commercial: ${summary.commercialTheme}` : null,
    ...(summary?.watchedChanges?.length ? ['', 'Developments you watch:', ...summary.watchedChanges.map((c) => `- ${c.text}`)] : []),
    ...(summary?.caveats ?? []),
    '',
    `Open full patch report: ${input.reportUrl}`,
    `View current map: ${input.mapUrl}`,
    '',
    ...highlights.map((h) => `${h.headline} - ${h.address || h.reference} (${h.authorityName} ${h.reference})${h.approximateLocation ? ' [approximate location]' : ''}${safeUrl(h.sourceUrl) ? ` ${safeUrl(h.sourceUrl)}` : ''}`),
    more > 0 ? `${more} more in the full report.` : null,
    '',
    'Approval is permission, not a completed building.',
    `Manage preferences: ${input.preferencesUrl}`,
    `Unsubscribe: ${input.unsubscribeUrl}`,
  ].filter((line) => line !== null).join('\n')

  return { subject, html, text }
}
