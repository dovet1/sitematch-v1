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

export function createRejectionEmail(data: RejectionEmailData): EmailTemplate {
  const reasonText = REJECTION_REASONS[data.rejectionReason];
  const fullReason = data.rejectionReason === 'other' && data.customReason 
    ? data.customReason 
    : reasonText;

  const subject = "SiteMatch Listing Review - Action Required";
  
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
    <h1 style="margin: 0; font-size: 24px;">SiteMatch</h1>
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
    The SiteMatch Team</p>
    
    <div class="footer">
      <p>This email was sent regarding your listing: <strong>${data.listingTitle}</strong></p>
      <p>SiteMatch - Connecting occupiers with the perfect property</p>
    </div>
  </div>
</body>
</html>`;

  const text = `
SiteMatch Listing Review - Action Required

Dear ${data.contactName},

Thank you for submitting your property requirement listing for ${data.companyName}.

After review, we need some adjustments before we can publish your listing:

Reason for Review: ${fullReason}

Please edit your listing at: ${data.listingEditUrl}

Once you've made the necessary updates, our team will review your submission again. Most listings are reviewed within 1-2 business days.

If you have any questions about the feedback provided, please contact our support team.

Best regards,
The SiteMatch Team

This email was sent regarding your listing: ${data.listingTitle}
SiteMatch - Connecting occupiers with the perfect property
`;

  return { subject, html, text };
}

export function createApprovalEmail(data: ApprovalEmailData): EmailTemplate {
  const subject = "Your SiteMatch Listing is Now Live!";
  
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
    
    <p>Great news! Your property requirement listing for <strong>${data.companyName}</strong> has been approved and is now live in the SiteMatch directory.</p>
    
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
    
    <p>Thank you for choosing SiteMatch to help find your perfect property.</p>
    
    <p>Best regards,<br>
    The SiteMatch Team</p>
    
    <div class="footer">
      <p>Listing: <strong>${data.listingTitle}</strong></p>
      <p>SiteMatch - Connecting occupiers with the perfect property</p>
    </div>
  </div>
</body>
</html>`;

  const text = `
Your SiteMatch Listing is Now Live!

Dear ${data.contactName},

Great news! Your property requirement listing for ${data.companyName} has been approved and is now live in the SiteMatch directory.

✅ Your listing is now visible to property professionals
Landlords and agents can now discover your requirements and reach out with suitable opportunities.

View your live listing: ${data.publicListingUrl}

What happens next?
- Property professionals will be able to find your listing through search
- You'll receive email notifications when landlords express interest  
- You can manage your listing anytime through your dashboard

Thank you for choosing SiteMatch to help find your perfect property.

Best regards,
The SiteMatch Team

Listing: ${data.listingTitle}
SiteMatch - Connecting occupiers with the perfect property
`;

  return { subject, html, text };
}

// Email sending utilities
export async function sendRejectionEmail(data: RejectionEmailData) {
  const emailTemplate = createRejectionEmail(data);
  
  // Implementation will use existing Resend service
  const { sendEmail } = await import('./resend');
  
  return sendEmail({
    to: [data.contactName],
    subject: emailTemplate.subject,
    html: emailTemplate.html,
    text: emailTemplate.text
  });
}

export async function sendApprovalEmail(data: ApprovalEmailData) {
  const emailTemplate = createApprovalEmail(data);
  
  const { sendEmail } = await import('./resend');
  
  return sendEmail({
    to: [data.contactName],
    subject: emailTemplate.subject,
    html: emailTemplate.html,
    text: emailTemplate.text
  });
}