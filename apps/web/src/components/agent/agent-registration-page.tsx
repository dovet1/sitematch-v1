'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, User, Building2, Mail, Phone, MapPin, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export function AgentRegistrationPage() {
  const searchParams = useSearchParams();
  const referrer = searchParams.get('referrer');
  const company = searchParams.get('company');

  const [formData, setFormData] = useState({
    agentName: '',
    agencyName: '',
    email: '',
    phone: '',
    location: '',
    experience: '',
    specialization: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsSubmitting(false);
    setIsComplete(true);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-emerald-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to SiteMatcher!</h1>
            <p className="text-lg text-gray-600">
              Your agent registration is complete. You can now help {referrer} from {company} find their perfect property.
            </p>
          </div>

          <Card className="border-0 shadow-xl bg-gradient-to-br from-white via-gray-50/50 to-white">
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                <h2 className="text-xl font-semibold text-gray-900">What's Next?</h2>
                <div className="space-y-4">
                  <div className="flex items-start space-x-4 text-left">
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-violet-100 to-violet-200 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-violet-600 text-sm font-semibold">1</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Check Your Email</h4>
                      <p className="text-gray-600">We've sent your login credentials and detailed next steps to your inbox</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4 text-left">
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-blue-600 text-sm font-semibold">2</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Access Client Requirements</h4>
                      <p className="text-gray-600">View {referrer}'s specific site requirements through your agent dashboard</p>\n                    </div>
                  </div>
                  <div className="flex items-start space-x-4 text-left">
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-emerald-600 text-sm font-semibold">3</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Start Property Matching</h4>
                      <p className="text-gray-600">Begin finding perfect property matches for {referrer} and grow your client base</p>
                    </div>
                  </div>
                </div>
                
                <Button className="w-full mt-8 bg-gradient-to-r from-violet-600 to-emerald-600 hover:from-violet-700 hover:to-emerald-700 text-white text-lg py-6 rounded-2xl shadow-lg">
                  Go to Agent Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-blue-50 to-emerald-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* Back Link */}
        <div className="mb-8">
          <Link 
            href={`/agent/onboarding${referrer && company ? `?referrer=${encodeURIComponent(referrer)}&company=${encodeURIComponent(company)}` : ''}`}
            className="inline-flex items-center gap-2 text-violet-600 hover:text-violet-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Overview
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-violet-500 to-emerald-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Agent Profile</h1>
          {referrer && company && (
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-r from-blue-500 to-violet-500 rounded-full p-[1px] shadow-lg">
                <div className="bg-white rounded-full px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center">
                      <Building2 className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm">
                      <span className="font-semibold text-gray-900">{referrer}</span>
                      <span className="text-gray-600"> from </span>
                      <span className="font-semibold text-gray-900">{company}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <p className="text-lg text-gray-600">
            Just 2 minutes to join the UK's premier property network and start helping {referrer || 'clients'} find perfect properties.
          </p>
        </div>

        {/* Registration Form */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-white via-gray-50/50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-xl">
              <User className="w-6 h-6 text-violet-600" />
              <span>Professional Details</span>
            </CardTitle>
            <CardDescription className="text-base">
              Tell us about yourself so we can match you with the right opportunities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="agentName" className="text-base font-medium text-gray-700">
                    Your Full Name *
                  </Label>
                  <Input
                    id="agentName"
                    value={formData.agentName}
                    onChange={(e) => handleInputChange('agentName', e.target.value)}
                    placeholder="John Smith"
                    className="h-12 text-base"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agencyName" className="text-base font-medium text-gray-700">
                    Agency/Company Name *
                  </Label>
                  <Input
                    id="agencyName"
                    value={formData.agencyName}
                    onChange={(e) => handleInputChange('agencyName', e.target.value)}
                    placeholder="Smith Property Services"
                    className="h-12 text-base"
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-base font-medium text-gray-700">
                    Professional Email Address *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="john@smithproperty.co.uk"
                    className="h-12 text-base"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-base font-medium text-gray-700">
                    Phone Number *
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="020 7123 4567"
                    className="h-12 text-base"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="text-base font-medium text-gray-700">
                  Primary Coverage Areas *
                </Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="London, Birmingham, Manchester..."
                  className="h-12 text-base"
                  required
                />
                <p className="text-sm text-gray-500">List the main areas where you operate</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialization" className="text-base font-medium text-gray-700">
                  Property Specializations
                </Label>
                <Input
                  id="specialization"
                  value={formData.specialization}
                  onChange={(e) => handleInputChange('specialization', e.target.value)}
                  placeholder="Industrial, Retail, Office, Mixed Use..."
                  className="h-12 text-base"
                />
                <p className="text-sm text-gray-500">What types of properties do you specialize in? (Optional)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="experience" className="text-base font-medium text-gray-700">
                  Professional Background
                </Label>
                <Textarea
                  id="experience"
                  value={formData.experience}
                  onChange={(e) => handleInputChange('experience', e.target.value)}
                  placeholder="Tell us about your property experience, notable achievements, or what makes you stand out as an agent..."
                  rows={4}
                  className="text-base"
                />
                <p className="text-sm text-gray-500">Help clients understand your expertise (Optional but recommended)</p>
              </div>

              <div className="pt-4">
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-violet-600 to-emerald-600 hover:from-violet-700 hover:to-emerald-700 text-white text-lg py-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />
                      Creating Your Profile...
                    </>
                  ) : (
                    <>
                      Join SiteMatcher Free
                      <CheckCircle2 className="w-5 h-5 ml-3" />
                    </>
                  )}
                </Button>
                
                <div className="flex items-center justify-center gap-6 mt-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>No setup fees</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>No monthly costs</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Start immediately</span>
                  </div>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}