// Reminder sent before a trial converts (Stripe's customer.subscription.trial_will_end, which
// fires three days before the trial ends). The trial flow promises it: "We'll email you a
// reminder before your trial ends."

export interface TrialEndingEmailInput {
  trialEnd: Date
  // Pence, as on the Stripe price, and the price's interval.
  amount: number | null
  interval: 'month' | 'year' | null
  manageUrl: string
}

function money(pence: number): string {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function trialEndingEmail({ trialEnd, amount, interval, manageUrl }: TrialEndingEmailInput) {
  const date = trialEnd.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const charge =
    amount != null
      ? `${money(amount)}${interval === 'year' ? ' for the year' : interval === 'month' ? ' for the month' : ''}`
      : 'your first payment'
  const subject = `Your SiteMatcher trial ends on ${trialEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`
  const text = [
    'Hello,',
    '',
    `Your free SiteMatcher trial ends on ${date}. On that day we'll take ${charge} using the card you added.`,
    '',
    `If you'd like to keep using Brand Matcher and the rest of SiteMatcher, you don't need to do anything.`,
    `If you don't want to continue, cancel before then and you won't be charged: ${manageUrl}`,
    '',
    'The SiteMatcher team',
  ].join('\n')
  const html = `<!doctype html>
<html><body style="margin:0;background:#FBFAF7;font-family:Inter,Arial,sans-serif;color:#171419">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <div style="font-size:20px;font-weight:600;color:#7033FF">SiteMatcher</div>
    <div style="margin-top:24px;background:#fff;border:1px solid #E8E4DC;border-radius:18px;padding:28px">
      <h1 style="margin:0;font-size:22px;line-height:1.2;font-weight:600;letter-spacing:-.02em">Your free trial ends on ${date}.</h1>
      <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#4A4451">On that day we'll take ${charge} using the card you added.</p>
      <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#4A4451">To keep using Brand Matcher and the rest of SiteMatcher, you don't need to do anything. If you don't want to continue, cancel before then and you won't be charged.</p>
      <a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#7033FF;color:#fff;text-decoration:none;font-size:15px;font-weight:500;padding:12px 20px;border-radius:10px">Manage your plan</a>
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:#7C7588">You're receiving this because you started a SiteMatcher trial.</p>
  </div>
</body></html>`
  return { subject, text, html }
}
