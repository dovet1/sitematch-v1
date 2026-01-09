import { NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email-templates';

export async function GET() {
  try {
    console.log('🧪 Testing welcome email...');

    const result = await sendWelcomeEmail({
      userName: 'there',
      userEmail: 'doveyt3+1@gmail.com',
      dashboardUrl: 'http://localhost:3000/new-dashboard'
    });

    console.log('Email result:', result);

    return NextResponse.json({
      success: result.success,
      message: result.success ? 'Email sent!' : 'Email failed',
      error: result.error
    });
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
