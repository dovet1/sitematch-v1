import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface NewsletterSubscriptionResult {
  success: boolean;
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