import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface NewsletterSubscriptionResult {
  success: boolean;
  error?: string;
}

export interface EmailRequest {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function subscribeToNewsletter(
  email: string, 
  persona: string
): Promise<NewsletterSubscriptionResult> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured - skipping newsletter subscription');
      return { success: true }; // Don't fail the lead capture
    }

    if (!process.env.RESEND_AUDIENCE_ID) {
      console.warn('RESEND_AUDIENCE_ID not configured - skipping newsletter subscription');
      return { success: true }; // Don't fail the lead capture
    }

    await resend.contacts.create({
      email,
      audienceId: process.env.RESEND_AUDIENCE_ID,
    });

    return { success: true };
  } catch (error) {
    console.error('Newsletter subscription failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function sendEmail(request: EmailRequest): Promise<EmailResult> {
  try {
    console.log(`📧 RESEND: Attempting to send email to ${request.to} with subject: ${request.subject}`);
    
    if (!process.env.RESEND_API_KEY) {
      console.warn('📧 RESEND: RESEND_API_KEY not configured - skipping email sending');
      return { success: true }; // Don't fail the operation
    }

    console.log(`📧 RESEND: API key found, sending email...`);
    const result = await resend.emails.send({
      from: 'SiteMatch <onboarding@resend.dev>',
      to: request.to,
      subject: request.subject,
      html: request.html,
      text: request.text,
    });

    console.log(`📧 RESEND: Email result:`, result);
    
    // Check if Resend returned an error
    if (result.error) {
      console.error(`📧 RESEND: API returned error:`, result.error);
      return {
        success: false,
        error: result.error.message || 'Resend API error'
      };
    }
    
    return { 
      success: true, 
      id: result.data?.id 
    };
  } catch (error) {
    console.error('📧 RESEND: Email sending failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}