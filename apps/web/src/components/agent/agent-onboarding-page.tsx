'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AuthChoiceModal } from '@/components/auth/auth-choice-modal';
import { useAuth } from '@/contexts/auth-context';
import { CheckCircle2, Building2, ArrowRight, Star, Users, Target, TrendingUp, Shield, Clock } from 'lucide-react';

export function AgentOnboardingPage() {
  const searchParams = useSearchParams();
  const referrer = searchParams.get('referrer');
  const company = searchParams.get('company');
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-emerald-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-blue-600/10 to-emerald-600/10" />
        <div className="relative max-w-4xl mx-auto px-4 pt-16 pb-12">
          {/* Personal Invitation Badge */}
          {referrer && company && (
            <div className="flex justify-center mb-8">
              <div className="bg-gradient-to-r from-blue-500 to-violet-500 rounded-full p-[1px] shadow-lg">
                <div className="bg-white rounded-full px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-gray-900">{referrer}</span>
                      <span className="text-gray-600"> from </span>
                      <span className="font-semibold text-gray-900">{company}</span>
                      <span className="text-gray-600"> invited you</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Headline */}
          <div className="text-center mb-12">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-violet-500 to-emerald-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
              <Star className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Join the UK's
              <span className="bg-gradient-to-r from-violet-600 to-emerald-600 bg-clip-text text-transparent"> Premier</span>
              <br />Property Network
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-8">
              SiteMatcher connects property professionals like you with exclusive client requirements.
            </p>
            
            {/* Early CTA */}
            <div className="flex justify-center">
              {user && !loading ? (
                <Link href="/agents/add">
                  <Button className="bg-gradient-to-r from-violet-600 to-emerald-600 hover:from-violet-700 hover:to-emerald-700 text-white font-semibold text-lg px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300">
                    Create Your Agent Profile
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              ) : (
                <AuthChoiceModal
                  redirectTo="/agents/add"
                  title="Join SiteMatcher as an Agent"
                  description="Sign up or sign in to create your agent profile and start connecting with property professionals"
                >
                  <Button className="bg-gradient-to-r from-violet-600 to-emerald-600 hover:from-violet-700 hover:to-emerald-700 text-white font-semibold text-lg px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300">
                    Create Your Agent Profile
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </AuthChoiceModal>
              )}
            </div>
          </div>

          {/* Key Value Props */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-gradient-to-br from-violet-50 via-white to-violet-50/30 rounded-2xl border border-violet-100 p-6 text-center shadow-sm">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-bold text-violet-600 mb-2">1,000+</div>
              <p className="text-gray-700 font-medium">Live Property Requirements</p>
              <p className="text-sm text-gray-500 mt-1">Ready for your expertise</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50/30 rounded-2xl border border-blue-100 p-6 text-center shadow-sm">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-2">£0</div>
              <p className="text-gray-700 font-medium">Setup & Monthly Fees</p>
              <p className="text-sm text-gray-500 mt-1">Completely free profile</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 rounded-2xl border border-emerald-100 p-6 text-center shadow-sm">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-bold text-emerald-600 mb-2">2 Min</div>
              <p className="text-gray-700 font-medium">Quick Profile Setup</p>
              <p className="text-sm text-gray-500 mt-1">Increase reach rapidly</p>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {/* Benefit 1 */}
          <div className="bg-gradient-to-br from-violet-50 via-white to-violet-50/30 rounded-2xl border border-violet-100 p-6 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center mb-4 shadow-sm">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Show People Who You Represent</h3>
            <p className="text-gray-600 leading-relaxed">
              Display your client portfolio and showcase the companies you're working with to build credibility and attract new opportunities.
            </p>
          </div>

          {/* Benefit 2 */}
          <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50/30 rounded-2xl border border-blue-100 p-6 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-sm">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Be Visible Where Property Professionals Are</h3>
            <p className="text-gray-600 leading-relaxed">
              Join the UK's premier property network where occupiers, developers, and agents connect to create successful property deals.
            </p>
          </div>

          {/* Benefit 3 */}
          <div className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 rounded-2xl border border-emerald-100 p-6 shadow-sm hover:shadow-lg transition-all duration-300 md:col-span-2 lg:col-span-1">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mb-4 shadow-sm">
              <Star className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Add Your Client's Site Requirements to Hear About the Best Sites First</h3>
            <p className="text-gray-600 leading-relaxed">
              Post your client's property requirements and get notified first when matching sites become available, giving you the competitive edge.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-white via-gray-50/50 to-white mb-12">
          <CardHeader className="text-center pb-8">
            <CardTitle className="text-2xl text-gray-900 mb-4">How SiteMatcher Works for You</CardTitle>
            <CardDescription className="text-lg text-gray-600">
              SiteMatcher connects occupiers with agents through site requirement listings
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-violet-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-violet-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">List Client Requirements</h4>
                <p className="text-gray-600 text-sm">Post your client's site requirements on behalf of occupiers looking for properties</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-blue-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Get Better Site Leads</h4>
                <p className="text-gray-600 text-sm">Receive targeted property matches and leads from our network of property professionals</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-emerald-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Advertise Your Services</h4>
                <p className="text-gray-600 text-sm">Feature on our Agents page to attract new clients who need professional representation</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="text-center">
          <div className="bg-gradient-to-br from-violet-600 via-blue-600 to-emerald-600 rounded-3xl p-8 text-white shadow-2xl">
            <h2 className="text-3xl font-bold mb-4">
              Ready to {referrer ? `Join ${referrer}` : 'Start Earning'}?
            </h2>
            <p className="text-xl text-violet-100 mb-8 max-w-2xl mx-auto">
              Join hundreds of successful agents on SiteMatcher
            </p>
            
            {user && !loading ? (
              <Link href="/agents/add">
                <Button className="bg-white text-violet-600 hover:bg-gray-50 font-semibold text-lg px-12 py-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300">
                  Create Your Agent Profile
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            ) : (
              <AuthChoiceModal
                redirectTo="/agents/add"
                title="Join SiteMatcher as an Agent"
                description="Sign up or sign in to create your agent profile and start connecting with property professionals"
              >
                <Button className="bg-white text-violet-600 hover:bg-gray-50 font-semibold text-lg px-12 py-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300">
                  Create Your Agent Profile
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </AuthChoiceModal>
            )}
            
            <div className="flex items-center justify-center gap-4 mt-6 text-violet-100">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm">2-minute setup</span>
              </div>
              <div className="w-1 h-1 bg-violet-300 rounded-full" />
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm">Completely free</span>
              </div>
              <div className="w-1 h-1 bg-violet-300 rounded-full" />
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm">Start immediately</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}