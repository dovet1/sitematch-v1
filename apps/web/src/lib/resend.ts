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
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured - skipping email sending');
      return { success: true }; // Don't fail the operation
    }

    const result = await resend.emails.send({
      from: 'SiteMatch <notifications@sitematch.com>',
      to: request.to,
      subject: request.subject,
      html: request.html,
      text: request.text,
    });

    return { 
      success: true, 
      id: result.data?.id 
    };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}