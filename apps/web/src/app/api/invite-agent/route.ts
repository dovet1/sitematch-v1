import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/resend'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { email, companyName, listingId } = await request.json()

    if (!email || !listingId) {
      return NextResponse.json({ error: 'Email and listing ID are required' }, { status: 400 })
    }

    // Fetch primary contact and company name from the listing
    const supabase = createServerClient()
    const { data: listingData } = await supabase
      .from('listings')
      .select(`
        company_name,
        listing_contacts!inner(contact_name, is_primary_contact)
      `)
      .eq('id', listingId)
      .eq('listing_contacts.is_primary_contact', true)
      .single()

    const primaryContactName = listingData?.listing_contacts?.[0]?.contact_name || 'A client'
    const actualCompanyName = listingData?.company_name || companyName || 'a company'

    const subject = `${primaryContactName} from ${actualCompanyName} wants you as their agent on SiteMatcher`
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .contact-box { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { color: #6b7280; font-size: 14px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">🏢 Agent Invitation</h1>
    <p style="margin: 5px 0 0 0; opacity: 0.9;">You've been invited to represent a client on SiteMatcher</p>
  </div>
  
  <div class="content">
    <h2 style="color: #1f2937; margin-top: 0;">You've been selected as an agent!</h2>
    
    <p><strong>${primaryContactName}</strong> from <strong>${actualCompanyName}</strong> has invited you to be the associated agent with their site requirements listed on SiteMatcher.</p>
    
    <div class="contact-box">
      <h3 style="margin-top: 0; color: #1f2937;">👤 ${primaryContactName}</h3>
      <h4 style="margin: 5px 0; color: #1f2937;">🏢 ${actualCompanyName}</h4>
      <p>This client has specific site requirements and has chosen you to help them find the perfect property solution.</p>
    </div>
    
    <h3 style="color: #1f2937;">About SiteMatcher</h3>
    <p>SiteMatcher is the UK's leading platform for agents and property professionals to share their site requirements. We help agents like you find sites that perfectly match your clients' specific needs.</p>
    
    <p><strong>Ready to help ${primaryContactName} find their ideal property?</strong></p>
    
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://sitematcher.co.uk'}/agent/onboarding?referrer=${encodeURIComponent(primaryContactName)}&company=${encodeURIComponent(actualCompanyName)}" class="button">Join SiteMatcher as an Agent (2 min signup) →</a>
    
    <div class="footer">
      <p><strong>What happens next?</strong> Complete our quick 2-minute agent registration form to join SiteMatcher for free and start helping ${primaryContactName} with their property search.</p>
      <p><strong>Questions?</strong> Reply to this email and our team will help you get started.</p>
      <p>SiteMatcher - Connecting Property Professionals</p>
    </div>
  </div>
</body>
</html>`

    const text = `
AGENT INVITATION - SITEMATCHER

You've been selected as an agent!

${primaryContactName} from ${actualCompanyName} has invited you to be the associated agent with their site requirements listed on SiteMatcher.

ABOUT YOUR CLIENT:
${primaryContactName} - ${actualCompanyName}
This client has specific site requirements and has chosen you to help them find the perfect property solution.

ABOUT SITEMATCHER:
SiteMatcher is the UK's leading platform for agents and property professionals to share their site requirements. We help agents like you find sites that perfectly match your clients' specific needs.

Ready to help ${primaryContactName} find their ideal property?

Join SiteMatcher as an Agent (2 min signup): ${process.env.NEXT_PUBLIC_APP_URL || 'https://sitematcher.co.uk'}/agent/onboarding?referrer=${encodeURIComponent(primaryContactName)}&company=${encodeURIComponent(actualCompanyName)}

WHAT HAPPENS NEXT?
Complete our quick 2-minute agent registration form to join SiteMatcher for free and start helping ${primaryContactName} with their property search.

Questions? Reply to this email and our team will help you get started.

SiteMatcher - Connecting Property Professionals
`

    await sendEmail({
      to: [email],
      subject,
      html,
      text
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending agent invitation:', error)
    return NextResponse.json(
      { error: 'Failed to send invitation' }, 
      { status: 500 }
    )
  }
}