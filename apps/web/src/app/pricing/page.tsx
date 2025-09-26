import { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Check, Zap, Building, Search, Palette, Users } from 'lucide-react'
import Link from 'next/link'
import { StartTrialButton } from '@/components/StartTrialButton'

export const metadata: Metadata = {
  title: 'Pricing - SiteMatcher',
  description: 'Find your perfect property site with our 30-day free trial. £975/year for unlimited access to property listings and premium features.',
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4 bg-blue-100 text-blue-700">
            30-day free trial included
          </Badge>

          <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Find Your Perfect Property Site
          </h1>

          <p className="mb-8 text-xl text-gray-600">
            30-day free trial, then £975/year
          </p>

          <div className="mb-8">
            <StartTrialButton
              size="lg"
              className="mr-4"
              userType="general"
            />
            <Button variant="outline" size="lg">
              Learn More
            </Button>
          </div>

          <p className="text-sm text-gray-500">
            No charge today • Cancel anytime during trial
          </p>
        </div>
      </section>

      {/* Pricing Card */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Card className="relative border-2 border-blue-200 bg-blue-50/30">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <Badge className="bg-blue-600 text-white">Most Popular</Badge>
            </div>

            <CardHeader className="text-center pb-8 pt-8">
              <CardTitle className="text-2xl font-bold">Annual Subscription</CardTitle>
              <CardDescription className="text-base">
                Everything you need to find the perfect property
              </CardDescription>

              <div className="mt-6">
                <span className="text-5xl font-bold text-blue-600">£975</span>
                <span className="text-lg text-gray-500">/year</span>
              </div>

              <div className="mt-2">
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  30-day free trial - no charge today
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3 flex items-center">
                  <Search className="h-5 w-5 mr-2 text-blue-600" />
                  Property Search & Listings
                </h4>
                <ul className="space-y-2 ml-7">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">Unlimited requirement listing views</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">Full search and advanced filtering</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">Direct contact with listing owners</span>
                  </li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3 flex items-center">
                  <Palette className="h-5 w-5 mr-2 text-blue-600" />
                  SiteSketcher Tools
                </h4>
                <ul className="space-y-2 ml-7">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">Advanced visualization tools</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">Property project planning</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">Export and share projects</span>
                  </li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3 flex items-center">
                  <Building className="h-5 w-5 mr-2 text-blue-600" />
                  Agency Features
                </h4>
                <ul className="space-y-2 ml-7">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">Create unlimited agency listings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">Professional property showcase</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">Connect with qualified occupiers</span>
                  </li>
                </ul>
              </div>

              <Separator />

              <div className="text-center">
                <div className="inline-flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-full px-3 py-1">
                  <Check className="h-4 w-4" />
                  Cancel anytime before trial ends
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-6">
              <div className="w-full">
                <StartTrialButton
                  className="w-full"
                  size="lg"
                  userType="general"
                />
                <p className="text-center text-xs text-gray-500 mt-2">
                  You'll add payment details but won't be charged until your trial ends
                </p>
              </div>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-4 py-16 sm:px-6 lg:px-8 bg-gray-50">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>

          <div className="grid gap-8 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Will I be charged during my free trial?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  No. Your 30-day free trial starts immediately with no charge. Your payment method will only be charged £975 after your trial ends, unless you cancel before then.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Why do you need my payment details for a free trial?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  This ensures a seamless experience. If you love the platform, you won't experience any interruption when your trial ends. You're always in control and can cancel anytime.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Can I cancel during my trial?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Yes, you can cancel anytime before your trial ends with no charge. Just visit your account settings or contact us.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What happens when my trial ends?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  If you don't cancel, you'll be charged £975 for your annual subscription and continue with uninterrupted access to all features.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="px-4 py-16 sm:px-6 lg:px-8 bg-blue-600 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to find your perfect property?</h2>
          <p className="text-xl mb-8 text-blue-100">
            Start your free trial today and discover thousands of opportunities.
          </p>

          <StartTrialButton
            size="lg"
            className="bg-white text-blue-600 hover:bg-gray-100"
            userType="general"
          />

          <p className="text-sm text-blue-200 mt-4">
            30 days free • No commitment • Cancel anytime
          </p>
        </div>
      </section>
    </div>
  )
}