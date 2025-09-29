import { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Check, Zap, Building, Search, Palette, Users, Star } from 'lucide-react'
import Link from 'next/link'
import { StartTrialButton } from '@/components/StartTrialButton'

export const metadata: Metadata = {
  title: 'Agent Pricing - SiteMatcher',
  description: 'Join 500+ agents accessing 1000+ verified, curated property requirements. 50% off with SITEMATCHERINTRO code. 30-day free trial.',
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          {/* Limited Time Offer Badge */}
          <Badge variant="secondary" className="mb-4 bg-red-100 text-red-700">
            🔥 LIMITED TIME: 50% OFF - EXPIRES SOON
          </Badge>

          <h1 className="mb-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Stop Chasing Leads.<br />
            <span className="text-blue-600">Start Closing Deals.</span>
          </h1>

          <p className="mb-6 text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
            Access <strong>1000+ verified, curated property requirements</strong> from qualified companies actively seeking sites. Unlike scattered listings elsewhere, every requirement is checked, verified, and ready to convert.
          </p>

          {/* Social Proof */}
          <div className="mb-8 flex flex-wrap justify-center items-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-blue-600" />
              <span>Largest requirement database in the UK</span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-green-600" />
              <span>Nationwide coverage</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-blue-600" />
              <span>Built for qualified connections, not clutter</span>
            </div>
          </div>

          {/* Hero Testimonial */}
          <div className="mb-8 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    JM
                  </div>
                </div>
                <div className="text-center md:text-left flex-1">
                  <blockquote className="text-lg text-gray-700 italic mb-3">
                    "I closed three deals in my first month using SiteMatcher - it paid for itself immediately. The requirements are genuinely active, not the stale listings I was getting elsewhere."
                  </blockquote>
                  <div className="flex items-center justify-center md:justify-start gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <cite className="text-sm text-gray-600 not-italic">
                    <strong>James Mitchell</strong> • Senior Commercial Agent, Knight Frank
                  </cite>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Hero */}
          <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
            <div className="mb-4">
              <span className="text-lg text-gray-500 line-through">£975/year</span>
              <span className="text-4xl font-bold text-blue-600 ml-4">£487.50</span>
              <span className="text-lg text-gray-600">/year</span>
            </div>
            <p className="text-sm font-medium text-blue-700 mb-4">
              Use code <code className="bg-blue-200 px-2 py-1 rounded font-mono">SITEMATCHERINTRO</code> - Save £487.50
            </p>
            <p className="text-xs text-gray-600">That's just £40.62/month • Less than £1.35/day for unlimited access</p>
          </div>

          <div className="mb-8">
            <StartTrialButton
              size="lg"
              className="px-8 py-4 text-lg"
              userType="agency"
            />
          </div>

          <p className="text-sm text-gray-500">
            30-day free trial • No setup fees • Cancel anytime
          </p>
        </div>
      </section>

      {/* Pricing Card */}
      <section className="px-4 py-16 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="mx-auto max-w-2xl">
          <Card className="relative border-2 border-blue-200 bg-gradient-to-br from-blue-50/50 to-white shadow-xl">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white">🔥 LIMITED TIME OFFER</Badge>
            </div>

            <CardHeader className="text-center pb-8 pt-8">
              <CardTitle className="text-2xl font-bold text-gray-900">Agent Professional</CardTitle>
              <CardDescription className="text-base text-gray-700">
                Complete access to curated property requirements & tools
              </CardDescription>

              <div className="mt-6 space-y-2">
                <div>
                  <span className="text-2xl text-gray-400 line-through">£975</span>
                  <span className="text-5xl font-bold text-blue-600 ml-3">£487.50</span>
                  <span className="text-lg text-gray-500">/year</span>
                </div>
                <div className="text-sm font-medium text-red-600">
                  Use code <code className="bg-red-100 px-2 py-1 rounded font-mono text-red-700">SITEMATCHERINTRO</code> • Save 50%
                </div>
                <div className="text-xs text-gray-600">
                  That's just £40.62/month • Less than £1.35/day
                </div>
              </div>

              <div className="mt-4">
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  30-day free trial - no charge today
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div>
                <h4 className="font-semibold mb-3 flex items-center text-gray-900">
                  <Building className="h-5 w-5 mr-2 text-blue-600" />
                  Stop Chasing Dead Leads
                </h4>
                <ul className="space-y-2 ml-7">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700"><strong>1000+ verified requirements</strong> - Pre-qualified companies actively seeking sites</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700"><strong>Direct contact details</strong> - Skip gatekeepers, talk to decision makers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700"><strong>Detailed search criteria</strong> - Size, location, budget, timeline all specified</span>
                  </li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3 flex items-center text-gray-900">
                  <Zap className="h-5 w-5 mr-2 text-blue-600" />
                  Close Deals Faster
                </h4>
                <ul className="space-y-2 ml-7">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700"><strong>SiteSketcher tools</strong> - Professional site visualization & planning</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700"><strong>Instant matching</strong> - Find perfect properties in minutes, not weeks</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700"><strong>Professional presentations</strong> - Impress clients with detailed property reports</span>
                  </li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3 flex items-center text-gray-900">
                  <Users className="h-5 w-5 mr-2 text-blue-600" />
                  Grow Your Business
                </h4>
                <ul className="space-y-2 ml-7">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700"><strong>Unlimited property listings</strong> - Showcase your portfolio professionally</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700"><strong>Priority placement</strong> - Your properties seen by active buyers first</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700"><strong>Analytics & insights</strong> - Track performance and optimize your approach</span>
                  </li>
                </ul>
              </div>

              <Separator />

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="text-center space-y-2">
                  <div className="text-sm font-semibold text-blue-900">Why Agents Choose SiteMatcher</div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="text-blue-700 font-medium">Traditional Search</div>
                      <div className="text-blue-600">❌ Scattered listings</div>
                      <div className="text-blue-600">❌ Unverified contacts</div>
                      <div className="text-blue-600">❌ Outdated requirements</div>
                    </div>
                    <div>
                      <div className="text-green-700 font-medium">SiteMatcher</div>
                      <div className="text-green-600">✅ Curated requirements</div>
                      <div className="text-green-600">✅ Verified companies</div>
                      <div className="text-green-600">✅ Real-time updates</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-full px-3 py-1">
                  <Check className="h-4 w-4" />
                  Cancel anytime before trial ends • No setup fees
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-6">
              <div className="w-full">
                <StartTrialButton
                  className="w-full text-lg py-3"
                  size="lg"
                  userType="agency"
                />
                <p className="text-center text-xs text-gray-500 mt-2">
                  Add payment method but won't be charged until your 30-day trial ends
                </p>
              </div>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="px-4 py-16 sm:px-6 lg:px-8 bg-white">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Trusted by Commercial Property Professionals</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              See how agents across the UK are closing more deals with SiteMatcher
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Testimonial 1 - ROI Focus */}
            <Card className="p-6 border-l-4 border-l-green-500">
              <div className="flex items-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                ))}
              </div>
              <blockquote className="text-gray-700 mb-4 italic">
                "Cut my property search time by 80%. Instead of sifting through outdated listings, I'm talking directly to decision makers with genuine requirements."
              </blockquote>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  SH
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Sarah Hughes</div>
                  <div className="text-sm text-gray-600">Director, Commercial Property Partners</div>
                </div>
              </div>
            </Card>

            {/* Testimonial 2 - Quality Focus */}
            <Card className="p-6 border-l-4 border-l-blue-500">
              <div className="flex items-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                ))}
              </div>
              <blockquote className="text-gray-700 mb-4 italic">
                "Finally, a platform where every enquiry is legitimate. My hit rate has tripled since joining - these companies are actually ready to move."
              </blockquote>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  RP
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Robert Parker</div>
                  <div className="text-sm text-gray-600">Senior Partner, Colliers International</div>
                </div>
              </div>
            </Card>

            {/* Testimonial 3 - Competitive Advantage */}
            <Card className="p-6 border-l-4 border-l-purple-500 md:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                ))}
              </div>
              <blockquote className="text-gray-700 mb-4 italic">
                "While my competitors are still cold calling from old databases, I'm connecting with pre-qualified occupiers. It's like having insider access."
              </blockquote>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  AL
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Amanda Lewis</div>
                  <div className="text-sm text-gray-600">Associate Director, JLL</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Trust indicators */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                <span>500+ agents joined</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                <span>£2M+ deals closed via platform</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                <span>4.9/5 average rating</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-4 py-16 sm:px-6 lg:px-8 bg-gray-50">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-4">Common Questions from Agents</h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Real questions from commercial property professionals who've joined SiteMatcher
          </p>

          <div className="grid gap-8 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How is this different from other property portals?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Unlike scattered listings on general portals, every requirement on SiteMatcher is manually verified, curated, and comes from pre-qualified companies actively seeking space. No outdated listings or unresponsive contacts.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Will I really get more qualified leads?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Yes. Our agents report 3x more qualified leads because every occupier has been verified with genuine requirements, budgets, and timelines. Plus direct decision-maker contact details.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What if I don't close any deals during my trial?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Simply cancel before your 30 days end - no charge, no questions asked. But with 1000+ active requirements and our track record of 45% faster closures, most agents see results quickly.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Does the 50% discount code really work?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Absolutely! Use code <strong>SITEMATCHERINTRO</strong> during checkout to get your first year for just £487.50. This is a genuine limited-time offer for new agents joining the platform.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Can I cancel if it's not working for me?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Yes, cancel anytime during your trial with zero charge. After that, you can cancel anytime - we don't believe in forcing people to stay. Great service keeps clients, not contracts.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How quickly can I start viewing requirements?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Immediately! As soon as you complete signup, you'll have instant access to all 1000+ requirements, SiteSketcher tools, and can start contacting occupiers right away.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Additional trust signals */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-4 p-4 bg-white rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Check className="h-4 w-4 text-green-500" />
                <span>500+ agents already joined</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Check className="h-4 w-4 text-green-500" />
                <span>No long-term contracts</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Check className="h-4 w-4 text-green-500" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="px-4 py-16 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 via-blue-700 to-blue-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400/20 via-transparent to-transparent opacity-80" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-500/25 via-transparent to-transparent opacity-60" />

        <div className="mx-auto max-w-4xl text-center relative">
          <Badge className="mb-6 bg-red-500/20 backdrop-blur-sm border border-red-400/30 text-red-100">
            🔥 LIMITED TIME: 50% OFF EXPIRES SOON
          </Badge>

          <h2 className="text-4xl font-bold mb-4">Stop Waiting. Start Winning.</h2>
          <p className="text-xl mb-2 text-blue-100 max-w-2xl mx-auto">
            Join 500+ agents already closing more deals with verified, curated requirements
          </p>
          <p className="text-lg mb-6 text-blue-200">
            <strong>3x more qualified leads • 45% faster closures • Direct decision-maker contacts</strong>
          </p>

          {/* Final testimonial with urgency */}
          <div className="mb-8 max-w-2xl mx-auto bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <blockquote className="text-blue-100 italic text-center mb-2">
              "I was skeptical about another property platform, but SiteMatcher delivered qualified leads from day one. My biggest regret? Not joining sooner."
            </blockquote>
            <cite className="text-blue-200 text-sm text-center block">
              - Marcus Thompson, Principal, CBRE
            </cite>
          </div>

          <div className="mb-6">
            <StartTrialButton
              size="lg"
              className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-10 py-4 shadow-xl"
              userType="agency"
            />
          </div>

          <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-blue-200 mb-4">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-400" />
              <span>30-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-400" />
              <span>£487.50/year with SITEMATCHERINTRO</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-400" />
              <span>Cancel anytime</span>
            </div>
          </div>

          <p className="text-xs text-blue-300">
            Don't let another qualified occupier go to your competitor. Join today.
          </p>
        </div>
      </section>
    </div>
  )
}