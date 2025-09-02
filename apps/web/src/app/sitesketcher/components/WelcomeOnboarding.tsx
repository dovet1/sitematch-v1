'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  MapPin, 
  Building2, 
  Car, 
  Users, 
  TrendingUp,
  Wrench,
  CheckCircle,
  ArrowRight,
  X,
  Play
} from 'lucide-react';
import { UserProfile } from '@/types/auth';

interface WelcomeOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile?: UserProfile | null;
}

const steps = [
  {
    id: 1,
    title: 'Welcome to SiteSketcher',
    icon: MapPin,
    content: {
      title: 'Assess Commercial Property Feasibility',
      description: 'SiteSketcher helps you quickly evaluate commercial properties through visual site analysis, building placement, and parking assessment.',
      features: [
        'Measure site dimensions with precision',
        'Place building footprints',
        'Analyze parking requirements',
        'Export professional assessments'
      ]
    }
  },
  {
    id: 2,
    title: 'How it works',
    icon: Play,
    content: {
      title: 'Three Simple Steps',
      description: 'Get professional property assessments in minutes.',
      features: [
        '1. Search for your property location',
        '2. Draw building shapes and parking areas',
        '3. Decide site feasibility'
      ]
    }
  },
  {
    id: 3,
    title: 'Using the Tools',
    icon: Wrench,
    content: {
      title: 'Drawing and Editing Shapes',
      description: 'Learn the essential controls to create accurate site plans.',
      features: [
        'Click/tap each point to draw building shapes',
        'Double-click to finish drawing a polygon',
        'Click and drag to rotate selected shapes',
        'Press Delete or tap trash icon to remove shapes',
        'Use parking overlay tools for parking analysis'
      ]
    }
  }
];

// Role-specific welcome messages
const getRoleSpecificContent = (userType?: string) => {
  switch (userType) {
    case 'Commercial Occupier':
      return {
        title: 'Perfect for Space Planning',
        description: 'Assess if properties meet your business requirements for office, retail, or warehouse space.',
        tips: ['Check ceiling heights for warehouse needs', 'Verify parking ratios for employee access', 'Measure loading dock accessibility']
      };
    case 'Developer':
      return {
        title: 'Streamline Site Planning',
        description: 'Quickly evaluate development potential and zoning compliance.',
        tips: ['Calculate maximum building footprint', 'Plan parking to meet zoning requirements', 'Identify site constraints early']
      };
    case 'Consultant':
      return {
        title: 'Enhance Client Presentations',
        description: 'Create compelling visual assessments for your clients.',
        tips: ['Use mobile mode for site visits', 'Export clean reports for presentations', 'Save projects for client review']
      };
    default:
      return {
        title: 'Professional Property Assessment',
        description: 'Everything you need to evaluate commercial property potential.',
        tips: ['Start with property search', 'Use drawing tools for planning', 'Export results for sharing']
      };
  }
};

export default function WelcomeOnboarding({ isOpen, onClose, userProfile }: WelcomeOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const roleContent = getRoleSpecificContent(userProfile?.user_type);

  const currentStepData = steps.find(step => step.id === currentStep);
  const isLastStep = currentStep === steps.length;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (!currentStepData) return null;

  const StepIcon = currentStepData.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleSkip()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="relative">
          
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <StepIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">
                {currentStepData.title}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                Step {currentStep} of {steps.length}
              </DialogDescription>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="flex gap-2 mb-6">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  step.id <= currentStep ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Main content */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {currentStepData.content.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                {currentStepData.content.description}
              </p>
              <ul className="space-y-2">
                {currentStepData.content.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>


          {/* Navigation */}
          <div className="flex justify-between items-center pt-4">
            <Button
              variant="ghost"
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className="text-gray-600"
            >
              Previous
            </Button>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="text-gray-600"
              >
                Skip
              </Button>
              <Button
                onClick={handleNext}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLastStep ? 'Get Started' : 'Next'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}