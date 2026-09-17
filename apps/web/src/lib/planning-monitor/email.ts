import type { DigestReport } from './types'
import { groupHighlights, highlightMeta, weekRangeLabel } from './digest-groups'

/**
 * The weekly email. It mirrors the in-app weekly panel: the same counters, the same saved summary
 * (shortened), and the same grouping, capped at the first few rows of each group, with links to
 * the week in SiteMatcher and to preferences.
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

/** Rows shown per group; the rest are in the app. */
export const EMAIL_ROWS_PER_GROUP = 3

const MONO = `'JetBrains Mono',Menlo,Consolas,monospace`

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
  const quiet = report.summaryKind === 'no_changes'
  const range = weekRangeLabel(report.periodStart, report.periodEnd)
  const newCount = counts?.newApplications ?? 0
  const decisions = counts?.decisions ?? 0
  const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`

  const headline = quiet
    ? `Nothing new in ${report.patchName} this week`
    : `${plural(newCount, 'new application', 'new applications')} in ${report.patchName}`
  const subject = quiet
    ? `${report.patchName}: nothing new (${range})`
    : `${headline}${decisions ? ` · ${plural(decisions, 'decision', 'decisions')}` : ''} (${range})`

  const counter = (label: string, value: number, sub: string, bg: string, border: string, color: string) => `
    <td width="33%" valign="top" style="padding:0 4px">
      <div style="padding:12px 12px;border-radius:12px;background:${bg};border:1px solid ${border}">
        <div style="font-family:${MONO};font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:${color}">${escapeHtml(label)}</div>
        <div style="margin-top:4px;font-size:22px;font-weight:700;color:#171419">${value.toLocaleString('en-GB')}</div>
        <div style="margin-top:2px;font-size:12px;color:#57534E">${escapeHtml(sub)}</div>
      </div>
    </td>`
  const counters = counts && counts.newResidential != null && !quiet
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 -4px"><tr>
        ${counter('Residential', counts.newResidential, `${(counts.newResidentialDwellings ?? 0).toLocaleString('en-GB')} dwellings`, '#F7F4FF', '#E3DEFA', '#5421CC')}
        ${counter('Commercial', counts.newCommercial ?? 0, 'new applications', '#F0FAF8', '#D6F0EC', '#0B7D72')}
        ${counter('Decided', decisions, `${counts.approvals} approved`, '#FDEEE3', '#F7DCC7', '#B4531A')}
      </tr></table>`
    : ''

  const caveats = (summary?.caveats ?? []).map((c) => `<p style="margin:0 0 6px;font-size:12px;color:#8A857D">${escapeHtml(c)}</p>`).join('')
  const groups = groupHighlights(report.highlights)
  const groupHtml = groups.map((group) => {
    const shown = group.items.slice(0, EMAIL_ROWS_PER_GROUP)
    const rows = shown.map((h) => {
      const href = safeUrl(h.sourceUrl)
      const title = escapeHtml(h.address || h.reference)
      return `<tr><td style="padding:12px 14px;border:1px solid #EDEBE7;border-radius:12px;background:#fff">
        <div style="font-size:14.5px;font-weight:600;color:#171419">${href ? `<a href="${escapeHtml(href)}" style="color:#171419;text-decoration:none">${title}</a>` : title}</div>
        <div style="margin-top:3px;font-family:${MONO};font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;color:#8A857D">${escapeHtml(h.categories ? highlightMeta(h) : `${h.headline} · ${h.authorityName}`)}${h.approximateLocation ? ' · approx. location' : ''}</div>
      </td></tr><tr><td style="height:8px"></td></tr>`
    }).join('')
    const more = group.items.length - shown.length
    return `<div style="margin:22px 0 8px;font-family:${MONO};font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8A857D">${escapeHtml(group.label)} · ${group.items.length}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>
      ${more > 0 ? `<a href="${escapeHtml(input.reportUrl)}" style="font-size:13px;font-weight:700;color:#7033FF;text-decoration:none">Show ${more} more ${escapeHtml(group.label.toLowerCase())}</a>` : ''}`
  }).join('')
  const omitted = report.omittedHighlights

  const html = `<!doctype html><html><body style="margin:0;background:#FBFAF8;font-family:Inter,Arial,Helvetica,sans-serif;color:#171419">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="600" style="max-width:600px;width:100%;background:#fff;border:1px solid #EDEBE7;border-radius:18px" cellspacing="0" cellpadding="0">
<tr><td style="padding:26px 28px 6px">
  <div style="font-size:17px;font-weight:700;letter-spacing:-.02em;color:#7033FF">SiteMatcher</div>
  <div style="margin-top:22px;font-family:${MONO};font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#7033FF">Weekly summary · ${escapeHtml(report.patchName)}</div>
  <h1 style="margin:6px 0 4px;font-size:20px;line-height:1.3;font-weight:700;letter-spacing:-.01em">${escapeHtml(headline)}</h1>
  <div style="font-family:${MONO};font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8A857D">${escapeHtml(range)}</div>
</td></tr>
<tr><td style="padding:16px 28px 8px">
  ${counters}
  <div style="margin-top:14px;padding:15px 16px;border-radius:14px;background:#F7F4FF;border:1px solid #E3DEFA">
    <div style="font-family:${MONO};font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#7033FF">${aiUnavailable || quiet ? 'Summary of this week' : '✦ AI summary of this week'}</div>
    <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#2A2833">${escapeHtml(summary?.overview ?? '')}</p>
  </div>
  <div style="margin-top:12px">${caveats}</div>
  ${groupHtml}
  ${omitted > 0 ? `<p style="margin:10px 0 0;font-size:12.5px;color:#8A857D">${omitted} further changes are counted above but not listed.</p>` : ''}
  <a href="${escapeHtml(input.reportUrl)}" style="display:inline-block;margin:22px 0 6px;padding:12px 18px;border-radius:10px;background:#7033FF;color:#fff;text-decoration:none;font-size:14px;font-weight:700">${quiet ? 'Open the week in SiteMatcher' : `Open all ${(report.highlights.length + omitted).toLocaleString('en-GB')} in SiteMatcher`}</a>
</td></tr>
<tr><td style="padding:18px 28px;background:#FBFAF8;border-top:1px solid #EDEBE7;border-radius:0 0 18px 18px;font-size:12px;line-height:1.55;color:#8A857D">
  You're receiving this because weekly email is on for your patch <strong style="color:#57534E">${escapeHtml(report.patchName)}</strong> in SiteMatcher. Planning data comes from council records via Plota. Approval is permission, not a completed building; approximate locations are area centres.<br>
  <a href="${escapeHtml(input.preferencesUrl)}" style="color:#5421CC">Change frequency</a> · <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#5421CC">Turn off</a>
</td></tr></table></td></tr></table></body></html>`

  const text = [
    `Weekly summary: ${report.patchName}`,
    headline,
    range,
    counts && counts.newResidential != null && !quiet
      ? `Residential ${counts.newResidential} (${counts.newResidentialDwellings ?? 0} dwellings) · Commercial ${counts.newCommercial ?? 0} · Decided ${decisions}`
      : null,
    '',
    summary?.overview ?? '',
    ...(summary?.caveats ?? []),
    ...groups.flatMap((group) => [
      '',
      `${group.label.toUpperCase()} · ${group.items.length}`,
      ...group.items.slice(0, EMAIL_ROWS_PER_GROUP).map((h) => {
        const href = safeUrl(h.sourceUrl)
        return `- ${h.address || h.reference} (${h.categories ? highlightMeta(h) : `${h.headline} · ${h.authorityName}`})${h.approximateLocation ? ' [approximate location]' : ''}${href ? ` ${href}` : ''}`
      }),
      group.items.length > EMAIL_ROWS_PER_GROUP ? `  ${group.items.length - EMAIL_ROWS_PER_GROUP} more in SiteMatcher` : null,
    ]),
    '',
    `Open in SiteMatcher: ${input.reportUrl}`,
    '',
    'Approval is permission, not a completed building.',
    `Change frequency: ${input.preferencesUrl}`,
    `Turn off: ${input.unsubscribeUrl}`,
  ].filter((line) => line !== null).join('\n')

  return { subject, html, text }
}
