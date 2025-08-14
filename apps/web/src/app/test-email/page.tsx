'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle2, AlertCircle, Mail, Loader2 } from 'lucide-react'

export default function TestEmailPage() {
  const [email, setEmail] = useState('')
  const [testType, setTestType] = useState('basic')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleTest = async () => {
    if (!email) {
      alert('Please enter an email address')
      return
    }

    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          testType
        })
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: 'Network error: ' + (error instanceof Error ? error.message : 'Unknown error')
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <Mail className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Email System Test</h1>
            <p className="text-gray-600 mt-2">
              Test if SiteMatcher's email system is working correctly
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Your Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-sm text-gray-500">
                Enter your actual email - you'll receive the test email here
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="testType">Test Type</Label>
              <Select value={testType} onValueChange={setTestType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic Email Test</SelectItem>
                  <SelectItem value="agency-invitation">Agency Invitation Template</SelectItem>
                  <SelectItem value="agency-approval">Agency Approval Template</SelectItem>
                  <SelectItem value="agency-rejection">Agency Rejection Template</SelectItem>
                  <SelectItem value="all">All Templates (4 emails)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleTest} 
              disabled={isLoading || !email}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending Test Email...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Test Email
                </>
              )}
            </Button>

            {result && (
              <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription>
                  {result.success ? (
                    <div className="space-y-2">
                      <p className="font-medium text-green-800">✅ Email sent successfully!</p>
                      <p className="text-sm text-green-700">
                        Check your email inbox (and spam folder). 
                        {result.emailId && ` Email ID: ${result.emailId}`}
                      </p>
                      {testType === 'all' && result.results && (
                        <div className="mt-3">
                          <p className="font-medium text-green-700 mb-2">Test Results:</p>
                          <ul className="space-y-1">
                            {result.results.map((r: any, i: number) => (
                              <li key={i} className="text-sm text-green-600">
                                {r.type}: {r.result?.success ? '✅ Success' : '❌ Failed'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="font-medium text-red-800">❌ Email failed to send</p>
                      <p className="text-sm text-red-700">{result.error}</p>
                      {result.troubleshooting && (
                        <div className="mt-3">
                          <p className="font-medium text-red-700 mb-2">Troubleshooting:</p>
                          <ul className="text-xs text-red-600 space-y-1">
                            <li>• {result.troubleshooting.checkEnvVars}</li>
                            <li>• {result.troubleshooting.checkApiKey}</li>
                            <li>• {result.troubleshooting.checkDomain}</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">💡 What This Tests</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Resend API integration is working</li>
                <li>• Environment variables are configured</li>
                <li>• Email templates render correctly</li>
                <li>• Network connectivity to email service</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}