import { NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email-templates';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userEmail, dashboardUrl } = body;

    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log('📧 API: Sending welcome email to:', userEmail);

    const result = await sendWelcomeEmail({
      userName: 'there',
      userEmail,
      dashboardUrl: dashboardUrl || 'https://sitematcher.co.uk/new-dashboard'
    });

    console.log('📧 API: Email result:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('📧 API: Welcome email error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
