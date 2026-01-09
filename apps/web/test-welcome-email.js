// Test script to verify welcome email works
// Run with: node test-welcome-email.js

async function testWelcomeEmail() {
  // Import the email function
  const { sendWelcomeEmail } = require('./src/lib/email-templates.ts');

  try {
    const result = await sendWelcomeEmail({
      userName: 'there',
      userEmail: 'test@example.com', // Replace with your test email
      dashboardUrl: 'http://localhost:3000/new-dashboard'
    });

    console.log('Email result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

testWelcomeEmail();
