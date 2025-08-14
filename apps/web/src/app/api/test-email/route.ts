// =====================================================
// Email Test Endpoint - Debugging Email System
// Tests if Resend integration is working
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/resend'
import { 
  createAgencyInvitationEmail,
  createAgencyStatusEmail,
  sendAgencyInvitationEmail,
  sendAgencyStatusEmail 
} from '@/lib/email-templates'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { testType = 'basic', email } = body

    if (!email) {
      return NextResponse.json({ 
        error: 'Email address required',
        hint: 'Send POST with { "email": "your@email.com", "testType": "basic" }'
      }, { status: 400 })
    }

    console.log('🧪 TEST EMAIL: Starting test with:', { testType, email })
    
    // Check if API key exists
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY is not configured in environment variables')
      return NextResponse.json({ 
        error: 'RESEND_API_KEY not configured',
        solution: 'Add RESEND_API_KEY to your .env.local file',
        docs: 'https://resend.com/docs/send-with-nextjs'
      }, { status: 500 })
    }

    console.log('✅ RESEND_API_KEY found:', process.env.RESEND_API_KEY.substring(0, 10) + '...')

    let result;

    switch (testType) {
      case 'basic':
        // Test basic email sending
        console.log('📧 Sending basic test email...')
        result = await sendEmail({
          to: [email],
          subject: '🧪 SiteMatcher Email Test - Basic',
          html: `
            <h1>Email System Test</h1>
            <p>This is a test email from SiteMatcher.</p>
            <p>If you're receiving this, the email system is working!</p>
            <hr>
            <p><small>Test performed at: ${new Date().toISOString()}</small></p>
          `,
          text: 'Email System Test - If you\'re receiving this, the email system is working!'
        })
        break

      case 'agency-invitation':
        // Test agency invitation template
        console.log('📧 Sending agency invitation test email...')
        result = await sendAgencyInvitationEmail({
          recipientName: 'Test User',
          recipientEmail: email,
          agencyName: 'Test Agency Co.',
          inviterName: 'John Admin',
          role: 'member',
          acceptUrl: 'http://localhost:3000/agents/invite/test-token',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
        break

      case 'agency-approval':
        // Test agency approval template
        console.log('📧 Sending agency approval test email...')
        result = await sendAgencyStatusEmail({
          contactName: 'Test Agency Owner',
          contactEmail: email,
          agencyName: 'Test Agency Co.',
          status: 'approved',
          dashboardUrl: 'http://localhost:3000/agents/dashboard'
        })
        break

      case 'agency-rejection':
        // Test agency rejection template
        console.log('📧 Sending agency rejection test email...')
        result = await sendAgencyStatusEmail({
          contactName: 'Test Agency Owner',
          contactEmail: email,
          agencyName: 'Test Agency Co.',
          status: 'rejected',
          adminNotes: 'This is a test rejection. Please update your agency information and resubmit.',
          dashboardUrl: 'http://localhost:3000/agents/dashboard'
        })
        break

      case 'all':
        // Send all test emails
        console.log('📧 Sending all test emails...')
        const results = []
        
        // Basic test
        results.push({
          type: 'basic',
          result: await sendEmail({
            to: [email],
            subject: '🧪 Test 1/4: Basic Email',
            html: '<h1>Test 1: Basic Email</h1><p>This tests basic email functionality.</p>',
            text: 'Test 1: Basic Email - This tests basic email functionality.'
          })
        })

        // Wait a bit between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Invitation test
        results.push({
          type: 'invitation',
          result: await sendAgencyInvitationEmail({
            recipientName: 'Test User',
            recipientEmail: email,
            agencyName: 'Test Agency',
            inviterName: 'Admin User',
            role: 'member',
            acceptUrl: 'http://localhost:3000/test',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          })
        })

        await new Promise(resolve => setTimeout(resolve, 1000))

        // Approval test
        results.push({
          type: 'approval',
          result: await sendAgencyStatusEmail({
            contactName: 'Test Owner',
            contactEmail: email,
            agencyName: 'Test Agency',
            status: 'approved',
            dashboardUrl: 'http://localhost:3000/agents/dashboard'
          })
        })

        await new Promise(resolve => setTimeout(resolve, 1000))

        // Rejection test
        results.push({
          type: 'rejection',
          result: await sendAgencyStatusEmail({
            contactName: 'Test Owner',
            contactEmail: email,
            agencyName: 'Test Agency',
            status: 'rejected',
            adminNotes: 'Test rejection feedback',
            dashboardUrl: 'http://localhost:3000/agents/dashboard'
          })
        })

        return NextResponse.json({
          success: true,
          message: `Attempted to send ${results.length} test emails`,
          results,
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json({ 
          error: 'Invalid test type',
          validTypes: ['basic', 'agency-invitation', 'agency-approval', 'agency-rejection', 'all']
        }, { status: 400 })
    }

    console.log('📧 Email send result:', result)

    if (result?.success) {
      return NextResponse.json({
        success: true,
        message: `Test email sent successfully to ${email}`,
        emailId: result.id,
        testType,
        timestamp: new Date().toISOString()
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result?.error || 'Failed to send email',
        testType,
        troubleshooting: {
          checkEnvVars: 'Ensure RESEND_API_KEY is set in .env.local',
          checkApiKey: 'Verify your Resend API key is valid at https://resend.com/api-keys',
          checkDomain: 'For production, verify your domain is configured in Resend',
          checkLogs: 'Check server console for detailed error messages'
        }
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ TEST EMAIL ERROR:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

// GET endpoint to show usage instructions
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test-email',
    method: 'POST',
    description: 'Test email sending functionality',
    usage: {
      basic: {
        description: 'Send a basic test email',
        body: {
          email: 'your@email.com',
          testType: 'basic'
        }
      },
      templates: {
        description: 'Test specific email templates',
        validTypes: [
          'basic',
          'agency-invitation',
          'agency-approval', 
          'agency-rejection',
          'all'
        ],
        body: {
          email: 'your@email.com',
          testType: 'agency-invitation'
        }
      }
    },
    troubleshooting: {
      step1: 'Check if RESEND_API_KEY is in .env.local',
      step2: 'Get API key from https://resend.com',
      step3: 'Test with: curl -X POST http://localhost:3000/api/test-email -H "Content-Type: application/json" -d \'{"email":"your@email.com","testType":"basic"}\''
    }
  })
}