// =====================================================
// Email Templates - Story 5.0
// Rejection and moderation notification templates
// =====================================================

import { REJECTION_REASONS, type RejectionReason } from '@/types/listings';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface RejectionEmailData {
  contactName: string;
  companyName: string;
  rejectionReason: RejectionReason;
  customReason?: string;
  listingEditUrl: string;
  listingTitle: string;
}

interface ApprovalEmailData {
  contactName: string;
  companyName: string;
  listingTitle: string;
  publicListingUrl: string;
}

interface SubmissionEmailData {
  contactName: string;
  companyName: string;
  listingTitle: string;
  dashboardUrl: string;
  previewUrl: string;
}

interface WelcomeEmailData {
  userName: string;
  userEmail: string;
  dashboardUrl: string;
}

export function createRejectionEmail(data: RejectionEmailData): EmailTemplate {
  const reasonText = REJECTION_REASONS[data.rejectionReason];
  const fullReason = data.rejectionReason === 'other' && data.customReason 
    ? data.customReason 
    : reasonText;

  const subject = "SiteMatcher Listing Review - Action Required";
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .reason-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { color: #6b7280; font-size: 14px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">SiteMatcher</h1>
    <p style="margin: 5px 0 0 0; opacity: 0.9;">Property Requirements Directory</p>
  </div>
  
  <div class="content">
    <h2 style="color: #1f2937; margin-top: 0;">Action Required for Your Listing</h2>
    
    <p>Dear ${data.contactName},</p>
    
    <p>Thank you for submitting your property requirement listing for <strong>${data.companyName}</strong>.</p>
    
    <p>After review, we need some adjustments before we can publish your listing:</p>
    
    <div class="reason-box">
      <strong>Reason for Review:</strong><br>
      ${fullReason}
    </div>
    
    <p>To resubmit your listing with the requested changes:</p>
    
    <a href="${data.listingEditUrl}" class="button">Edit Your Listing</a>
    
    <p>Once you've made the necessary updates, our team will review your submission again. Most listings are reviewed within 1-2 business days.</p>
    
    <p>If you have any questions about the feedback provided, please don't hesitate to contact our support team.</p>
    
    <p>Best regards,<br>
    The SiteMatcher Team</p>
    
    <div class="footer">
      <p>This email was sent regarding your listing: <strong>${data.listingTitle}</strong></p>
      <p>SiteMatcher - Connecting occupiers with the perfect property</p>
    </div>
  </div>
</body>
</html>`;

  const text = `
SiteMatcher Listing Review - Action Required

Dear ${data.contactName},

Thank you for submitting your property requirement listing for ${data.companyName}.

After review, we need some adjustments before we can publish your listing:

Reason for Review: ${fullReason}

Please edit your listing at: ${data.listingEditUrl}

Once you've made the necessary updates, our team will review your submission again. Most listings are reviewed within 1-2 business days.

If you have any questions about the feedback provided, please contact our support team.

Best regards,
The SiteMatcher Team

This email was sent regarding your listing: ${data.listingTitle}
SiteMatcher - Connecting occupiers with the perfect property
`;

  return { subject, html, text };
}

export function createApprovalEmail(data: ApprovalEmailData): EmailTemplate {
  const subject = "Your SiteMatcher Listing is Now Live!";
  
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
    .success-box { background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { color: #6b7280; font-size: 14px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">🎉 Congratulations!</h1>
    <p style="margin: 5px 0 0 0; opacity: 0.9;">Your listing is now live</p>
  </div>
  
  <div class="content">
    <h2 style="color: #1f2937; margin-top: 0;">Your Listing Has Been Approved</h2>
    
    <p>Dear ${data.contactName},</p>
    
    <p>Great news! Your property requirement listing for <strong>${data.companyName}</strong> has been approved and is now live in the SiteMatcher directory.</p>
    
    <div class="success-box">
      <strong>✅ Your listing is now visible to property professionals</strong><br>
      Landlords and agents can now discover your requirements and reach out with suitable opportunities.
    </div>
    
    <a href="${data.publicListingUrl}" class="button">View Your Live Listing</a>
    
    <p><strong>What happens next?</strong></p>
    <ul>
      <li>Property professionals will be able to find your listing through search</li>
      <li>You'll receive email notifications when landlords express interest</li>
      <li>You can manage your listing anytime through your dashboard</li>
    </ul>
    
    <p>Thank you for choosing SiteMatcher to help find your perfect property.</p>
    
    <p>Best regards,<br>
    The SiteMatcher Team</p>
    
    <div class="footer">
      <p>Listing: <strong>${data.listingTitle}</strong></p>
      <p>SiteMatcher - Connecting occupiers with the perfect property</p>
    </div>
  </div>
</body>
</html>`;

  const text = `
Your SiteMatcher Listing is Now Live!

Dear ${data.contactName},

Great news! Your property requirement listing for ${data.companyName} has been approved and is now live in the SiteMatcher directory.

✅ Your listing is now visible to property professionals
Landlords and agents can now discover your requirements and reach out with suitable opportunities.

View your live listing: ${data.publicListingUrl}

What happens next?
- Property professionals will be able to find your listing through search
- You'll receive email notifications when landlords express interest  
- You can manage your listing anytime through your dashboard

Thank you for choosing SiteMatcher to help find your perfect property.

Best regards,
The SiteMatcher Team

Listing: ${data.listingTitle}
SiteMatcher - Connecting occupiers with the perfect property
`;

  return { subject, html, text };
}

export function createSubmissionEmail(data: SubmissionEmailData): EmailTemplate {
  const subject = "Submission Received - Your SiteMatcher Listing is Under Review";
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); color: white; padding: 30px 20px; border-radius: 12px 12px 0 0; text-align: center; position: relative; overflow: hidden; }
    .header::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); animation: shimmer 3s infinite; }
    .content { background: #f9fafb; padding: 40px 30px; border-radius: 0 0 12px 12px; }
    .celebration { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0; }
    .timeline { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #8b5cf6; }
    .timeline-item { display: flex; align-items: flex-start; margin: 15px 0; }
    .timeline-icon { width: 24px; height: 24px; border-radius: 50%; background: #8b5cf6; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; margin-right: 15px; flex-shrink: 0; }
    .timeline-icon.completed { background: #10b981; }
    .timeline-icon.current { background: #f59e0b; animation: pulse 2s infinite; }
    .button { display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px 5px; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3); }
    .button.secondary { background: transparent; color: #8b5cf6; border: 2px solid #8b5cf6; box-shadow: none; }
    .footer { color: #6b7280; font-size: 14px; margin-top: 30px; text-align: center; }
    @keyframes shimmer { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(180deg); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 28px; position: relative; z-index: 1;">🎉 Submission Successful!</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; position: relative; z-index: 1;">Your listing is now under review</p>
  </div>
  
  <div class="content">
    <div class="celebration">
      <h2 style="margin: 0 0 10px 0; font-size: 20px;">✨ Thank you, ${data.contactName}!</h2>
      <p style="margin: 0; opacity: 0.95;">Your property requirement for <strong>${data.companyName}</strong> has been successfully submitted.</p>
    </div>
    
    <h3 style="color: #1f2937; margin: 30px 0 20px 0; font-size: 18px;">What happens next?</h3>
    
    <div class="timeline">
      <div class="timeline-item">
        <div class="timeline-icon completed">✓</div>
        <div>
          <strong>Submission Received</strong><br>
          <span style="color: #6b7280; font-size: 14px;">Your listing is safely in our system - completed just now!</span>
        </div>
      </div>
      
      <div class="timeline-item">
        <div class="timeline-icon current">⏳</div>
        <div>
          <strong>Under Review</strong><br>
          <span style="color: #6b7280; font-size: 14px;">Our team is reviewing your listing for completeness (24-48 hours)</span>
        </div>
      </div>
      
      <div class="timeline-item">
        <div class="timeline-icon">📧</div>
        <div>
          <strong>Approval Notification</strong><br>
          <span style="color: #6b7280; font-size: 14px;">We'll email you once your listing is approved and live</span>
        </div>
      </div>
      
      <div class="timeline-item">
        <div class="timeline-icon">🚀</div>
        <div>
          <strong>Go Live!</strong><br>
          <span style="color: #6b7280; font-size: 14px;">Your listing becomes visible to property professionals</span>
        </div>
      </div>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.dashboardUrl}" class="button">View Your Dashboard</a>
      <a href="${data.previewUrl}" class="button secondary">Preview Your Listing</a>
    </div>
    
    <div style="background: #eff6ff; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #3b82f6;">
      <h4 style="color: #1e40af; margin: 0 0 10px 0;">💡 Pro Tip</h4>
      <p style="margin: 0; color: #1e40af; font-size: 14px;">While you wait for approval, consider adding more details to your listing or preparing additional documents. You can edit your listing anytime from your dashboard!</p>
    </div>
    
    <p>If you have any questions about your submission or need to make changes, don't hesitate to contact our support team.</p>
    
    <p>Best regards,<br>
    The SiteMatcher Team</p>
    
    <div class="footer">
      <p><strong>Listing:</strong> ${data.listingTitle}</p>
      <p>SiteMatcher - Connecting occupiers with the perfect property</p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">This email was sent because you submitted a property requirement listing on SiteMatcher.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `
🎉 Submission Successful!

Dear ${data.contactName},

Thank you! Your property requirement for ${data.companyName} has been successfully submitted and is now under review.

WHAT HAPPENS NEXT:

✓ Submission Received (Completed)
  Your listing is safely in our system

⏳ Under Review (Next 24-48 hours)
  Our team is reviewing your listing for completeness

📧 Approval Notification
  We'll email you once your listing is approved and live

🚀 Go Live!
  Your listing becomes visible to property professionals

QUICK ACTIONS:
• View your dashboard: ${data.dashboardUrl}
• Preview your listing: ${data.previewUrl}

💡 Pro Tip: While you wait, consider adding more details to your listing or preparing additional documents. You can edit anytime from your dashboard!

If you have any questions about your submission or need to make changes, contact our support team.

Best regards,
The SiteMatcher Team

Listing: ${data.listingTitle}
SiteMatcher - Connecting occupiers with the perfect property
`;

  return { subject, html, text };
}

// Email sending utilities
export async function sendRejectionEmail(data: RejectionEmailData & { contactEmail?: string }) {
  const emailTemplate = createRejectionEmail(data);
  
  // Implementation will use existing Resend service
  const { sendEmail } = await import('./resend');
  
  // Use contactEmail if provided, fallback to contactName for backward compatibility
  const emailAddress = data.contactEmail || data.contactName;
  
  return sendEmail({
    to: [emailAddress],
    subject: emailTemplate.subject,
    html: emailTemplate.html,
    text: emailTemplate.text
  });
}

export async function sendApprovalEmail(data: ApprovalEmailData & { contactEmail?: string }) {
  const emailTemplate = createApprovalEmail(data);
  
  const { sendEmail } = await import('./resend');
  
  // Use contactEmail if provided, fallback to contactName for backward compatibility
  const emailAddress = data.contactEmail || data.contactName;
  
  return sendEmail({
    to: [emailAddress],
    subject: emailTemplate.subject,
    html: emailTemplate.html,
    text: emailTemplate.text
  });
}

export async function sendSubmissionEmail(data: SubmissionEmailData & { contactEmail?: string }) {
  const emailTemplate = createSubmissionEmail(data);

  const { sendEmail } = await import('./resend');

  // Use contactEmail if provided, fallback to contactName for backward compatibility
  const emailAddress = data.contactEmail || data.contactName;

  return sendEmail({
    to: [emailAddress],
    subject: emailTemplate.subject,
    html: emailTemplate.html,
    text: emailTemplate.text
  });
}

// =====================================================
// Welcome Email
// =====================================================

export function createWelcomeEmail(data: WelcomeEmailData): EmailTemplate {
  const subject = "Welcome to SiteMatcher!";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); color: white; padding: 30px 20px; border-radius: 12px 12px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 40px 30px; border-radius: 0 0 12px 12px; }
    .welcome-box { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0; }
    .feature-list { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .feature-item { display: flex; align-items: start; margin: 15px 0; }
    .feature-icon { width: 30px; height: 30px; border-radius: 50%; background: #eff6ff; color: #3b82f6; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0; }
    .button { display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px 5px; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3); }
    .footer { color: #6b7280; font-size: 14px; margin-top: 30px; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 28px;">Welcome to SiteMatcher! 🎉</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Your property search journey starts here</p>
  </div>

  <div class="content">
    <div class="welcome-box">
      <h2 style="margin: 0 0 10px 0; font-size: 20px;">Hello!</h2>
      <p style="margin: 0; opacity: 0.95;">Thank you for joining SiteMatcher. We're here to help you find the perfect property for your business.</p>
    </div>

    <h3 style="color: #1f2937; margin: 30px 0 20px 0; font-size: 18px;">What you can do with SiteMatcher:</h3>

    <div class="feature-list">
      <div class="feature-item">
        <div class="feature-icon">1</div>
        <div>
          <strong style="color: #1f2937;">Post Your Requirements</strong><br>
          <span style="color: #6b7280; font-size: 14px;">Create a detailed listing of your property requirements and let landlords come to you</span>
        </div>
      </div>

      <div class="feature-item">
        <div class="feature-icon">2</div>
        <div>
          <strong style="color: #1f2937;">Browse Available Properties</strong><br>
          <span style="color: #6b7280; font-size: 14px;">Search our directory of properties and requirements from other occupiers</span>
        </div>
      </div>

      <div class="feature-item">
        <div class="feature-icon">3</div>
        <div>
          <strong style="color: #1f2937;">Save Your Searches</strong><br>
          <span style="color: #6b7280; font-size: 14px;">Set up saved searches and get notified when new properties match your criteria</span>
        </div>
      </div>

      <div class="feature-item">
        <div class="feature-icon">4</div>
        <div>
          <strong style="color: #1f2937;">Manage Your Dashboard</strong><br>
          <span style="color: #6b7280; font-size: 14px;">Track your listings, saved searches, and site analysis all in one place</span>
        </div>
      </div>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.dashboardUrl}" class="button">Go to Your Dashboard</a>
    </div>

    <div style="background: #eff6ff; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #3b82f6;">
      <h4 style="color: #1e40af; margin: 0 0 10px 0;">💡 Getting Started</h4>
      <p style="margin: 0; color: #1e40af; font-size: 14px;">Ready to find your perfect property? Head to your dashboard to create your first listing or set up a saved search. Our team reviews all listings within 24-48 hours.</p>
    </div>

    <p style="margin-top: 30px;">If you have any questions, we're here to help!</p>

    <p>Best regards,<br>
    The SiteMatcher Team</p>

    <div class="footer">
      <p>SiteMatcher - Connecting occupiers with the perfect property</p>
      <p style="margin-top: 15px;">
        Need help? Contact us at <a href="mailto:rob@sitematcher.co.uk" style="color: #8b5cf6;">rob@sitematcher.co.uk</a>
      </p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">This email was sent because you created an account on SiteMatcher.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `
Welcome to SiteMatcher! 🎉

Hello!

Thank you for joining SiteMatcher. We're here to help you find the perfect property for your business.

WHAT YOU CAN DO WITH SITEMATCHER:

1. Post Your Requirements
   Create a detailed listing of your property requirements and let landlords come to you

2. Browse Available Properties
   Search our directory of properties and requirements from other occupiers

3. Save Your Searches
   Set up saved searches and get notified when new properties match your criteria

4. Manage Your Dashboard
   Track your listings, saved searches, and site analysis all in one place

Go to Your Dashboard: ${data.dashboardUrl}

💡 Getting Started
Ready to find your perfect property? Head to your dashboard to create your first listing or set up a saved search. Our team reviews all listings within 24-48 hours.

If you have any questions, we're here to help!

Best regards,
The SiteMatcher Team

SiteMatcher - Connecting occupiers with the perfect property
Need help? Contact us at rob@sitematcher.co.uk

This email was sent because you created an account on SiteMatcher.
`;

  return { subject, html, text };
}

export async function sendWelcomeEmail(data: WelcomeEmailData) {
  const emailTemplate = createWelcomeEmail(data);
  const { sendEmail } = await import('./resend');

  return sendEmail({
    to: [data.userEmail],
    subject: emailTemplate.subject,
    html: emailTemplate.html,
    text: emailTemplate.text
  });
}

// =====================================================
// Saved Search Notification Email
// =====================================================

interface SavedSearchMatch {
  company_name: string;
  listing_type: string;
  listing_id: string;
  created_at: string;
}

interface SavedSearchNotificationData {
  searches: Array<{
    name: string;
    matches: SavedSearchMatch[];
  }>;
  totalMatches: number;
  siteUrl: string;
}

export function generateSavedSearchNotificationEmail(data: SavedSearchNotificationData): { html: string; text: string } {
  const { searches, totalMatches, siteUrl } = data;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Requirements Match Your Saved Searches</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <!-- Header -->
  <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">
      ${totalMatches} New Requirement${totalMatches === 1 ? '' : 's'} 🎯
    </h1>
    <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">
      ${totalMatches === 1 ? 'A requirement matches' : 'Requirements match'} your saved searches
    </p>
  </div>

  <!-- Intro -->
  <p style="font-size: 16px; margin-bottom: 25px;">
    Great news! We found ${totalMatches} new requirement${totalMatches === 1 ? '' : 's'} that ${totalMatches === 1 ? 'matches' : 'match'} your saved search criteria.
  </p>

  <!-- Searches and Matches -->
  ${searches.map(search => `
    <div style="background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <h2 style="color: #7c3aed; font-size: 18px; font-weight: bold; margin: 0 0 15px 0;">
        📍 ${search.name}
      </h2>

      ${search.matches.map(match => `
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <h3 style="font-size: 16px; font-weight: 600; margin: 0; color: #111827;">
              ${match.company_name}
            </h3>
            <span style="background: #ddd6fe; color: #6b21a8; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
              ${match.listing_type}
            </span>
          </div>
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 12px 0;">
            Posted ${new Date(match.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <a href="${siteUrl}/search?listingId=${match.listing_id}" style="display: inline-block; background: #7c3aed; color: white; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            View Requirement →
          </a>
        </div>
      `).join('')}
    </div>
  `).join('')}

  <!-- CTA -->
  <div style="text-align: center; margin: 30px 0;">
    <a href="${siteUrl}/new-dashboard?tab=searches" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
      View All Saved Searches
    </a>
  </div>

  <!-- Footer -->
  <div style="border-top: 2px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
    <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">
      You're receiving this because you have email notifications enabled for your saved searches.
    </p>
    <p style="color: #6b7280; font-size: 13px; margin: 0;">
      <a href="${siteUrl}/new-dashboard?tab=searches" style="color: #7c3aed; text-decoration: none;">Manage your notification preferences</a>
    </p>
  </div>

</body>
</html>
  `;

  const text = `
New Requirements Match Your Saved Searches

${totalMatches} new requirement${totalMatches === 1 ? '' : 's'} ${totalMatches === 1 ? 'matches' : 'match'} your saved searches!

${searches.map(search => `
${search.name}
${'='.repeat(search.name.length)}

${search.matches.map(match => `
- ${match.company_name} (${match.listing_type})
  Posted: ${new Date(match.created_at).toLocaleDateString('en-GB')}
  View: ${siteUrl}/search?listingId=${match.listing_id}
`).join('\n')}
`).join('\n')}

View all your saved searches: ${siteUrl}/new-dashboard?tab=searches

---
You're receiving this because you have email notifications enabled for your saved searches.
Manage your preferences: ${siteUrl}/new-dashboard?tab=searches
  `.trim();

  return { html, text };
}