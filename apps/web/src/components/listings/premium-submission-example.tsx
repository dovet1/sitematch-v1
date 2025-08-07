// =====================================================
// Premium Submission Integration Example
// Shows how to integrate the premium submission flow
// =====================================================

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PremiumSubmissionFlow, PremiumSubmitButton } from './premium-submission-flow';
import { Send, Sparkles } from 'lucide-react';

// =====================================================
// EXAMPLE INTEGRATION
// =====================================================

interface ExampleFormData {
  companyName: string;
  description: string;
  requirements: string;
}

export function PremiumSubmissionExample() {
  const [formData, setFormData] = useState<ExampleFormData>({
    companyName: '',
    description: '',
    requirements: ''
  });

  // Simulate API submission
  const submitListing = async (data: ExampleFormData): Promise<{ id: string; company_name: string }> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate potential error (uncomment to test error state)
    // if (Math.random() > 0.8) throw new Error('Submission failed due to network error');
    
    return {
      id: `listing_${Date.now()}`,
      company_name: data.companyName
    };
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <PremiumSubmissionFlow
        submitFunction={submitListing}
        onSubmissionComplete={(listingId) => {
          console.log('✅ Submission completed:', listingId);
        }}
        onError={(error) => {
          console.error('❌ Submission failed:', error);
          alert(`Submission failed: ${error.message}`);
        }}
      >
        {(handleSubmit) => (
          <Card className="shadow-lg border-0 bg-white/95 backdrop-blur-sm">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full mb-4">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Submit Your Property Requirement
                </h2>
                <p className="text-gray-600">
                  Experience our premium submission flow
                </p>
              </div>

              <form 
                className="space-y-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit(formData);
                }}
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-colors"
                    placeholder="Enter your company name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-colors resize-none"
                    placeholder="Describe your business and requirements"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Property Requirements
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={formData.requirements}
                    onChange={(e) => setFormData(prev => ({ ...prev, requirements: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-colors resize-none"
                    placeholder="Specify your property requirements"
                  />
                </div>

                <div className="pt-4">
                  <PremiumSubmitButton
                    onSubmit={() => handleSubmit(formData)}
                    className="w-full"
                    disabled={!formData.companyName || !formData.description || !formData.requirements}
                  >
                    <Send className="w-5 h-5 mr-2" />
                    Submit for Review
                  </PremiumSubmitButton>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </PremiumSubmissionFlow>
    </div>
  );
}

// =====================================================
// SIMPLE INTEGRATION FOR EXISTING FORMS
// =====================================================

interface SimpleSubmissionProps {
  onSubmit: () => Promise<{ id: string; company_name: string }>;
  children?: React.ReactNode;
  className?: string;
}

export function SimpleSubmissionWrapper({
  onSubmit,
  children,
  className
}: SimpleSubmissionProps) {
  return (
    <div className={className}>
      <PremiumSubmissionFlow
        submitFunction={onSubmit}
        onSubmissionComplete={(listingId) => {
          console.log('Submission completed:', listingId);
        }}
      >
        {(handleSubmit) => (
          <div>
            {children}
            <PremiumSubmitButton
              onSubmit={() => handleSubmit({})}
              className="w-full mt-6"
            >
              <Send className="w-4 h-4 mr-2" />
              Submit for Review
            </PremiumSubmitButton>
          </div>
        )}
      </PremiumSubmissionFlow>
    </div>
  );
}