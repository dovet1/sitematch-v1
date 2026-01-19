'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MapPin,
  Search,
  Square,
  Edit3,
  List,
  Car,
  Settings,
  Box,
  Save,
  FolderOpen,
  CheckCircle,
  ArrowRight,
  Play,
  Video,
  Mail
} from 'lucide-react';
import { UserProfile } from '@/types/auth';

interface WelcomeOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile?: UserProfile | null;
  onOpenTutorial?: () => void;
  onDontShowAgain?: (dontShow: boolean) => void;
}

// Step 0: Initial welcome screen
const welcomeScreen = {
  id: 0,
  title: 'Welcome to SiteSketcher!',
  subtitle: 'Assess site suitability by creating a quick sketch',
  description: 'We recommend spending a few minutes learning how to use SiteSketcher before using it.',
  isWelcome: true
};

// Steps 1-9: Tutorial steps
const tutorialSteps = [
  {
    id: 1,
    title: 'Step 1 - Navigate to a site',
    icon: Search,
    content: {
      title: 'Step 1 - Navigate to a site',
      description: 'You can do this by either:',
      instructions: [
        'Typing in an address in the search bar or',
        'By dragging the map to the desired location in \'Select\' mode'
      ]
    }
  },
  {
    id: 2,
    title: 'Step 2 - Draw shapes on the map',
    icon: Square,
    content: {
      title: 'Step 2 - Draw shapes on the map',
      description: '',
      instructions: [
        'Select \'Draw\' mode',
        'Click on the map to add the first corner of the shape',
        'Click on the map to add all further corners',
        'Double click your final corner to complete the shape',
        'You can add multiple shapes to represent site boundaries, buildings etc.',
        'To add a rectangle shape, click \'Add Rectangle\' and enter dimensions',
        'To delete a shape, find the relevant polygon in the \'Measurements\' dropdown and click the delete icon'
      ]
    }
  },
  {
    id: 3,
    title: 'Step 3 - Editing shapes',
    icon: Edit3,
    content: {
      title: 'Step 3 - Editing shapes',
      description: '',
      instructions: [
        'Toggle to \'Select\' mode and click on the shape you want to edit',
        'Move the shape by clicking and dragging it to a new area',
        'Rotate a shape by using the rotation handles',
        'Adjust the location of a shape\'s corner by clicking on the corner point and dragging it to the new location'
      ]
    }
  },
  {
    id: 4,
    title: 'Step 4 - Managing shapes',
    icon: List,
    content: {
      title: 'Step 4 - Managing shapes',
      description: '',
      instructions: [
        'Find all your drawn shapes under \'Measurements\' with their internal areas',
        'You can toggle between imperial and metric measurements',
        'You can turn side lengths on or off'
      ]
    }
  },
  {
    id: 5,
    title: 'Step 5 - Add parking',
    icon: Car,
    content: {
      title: 'Step 5 - Add parking',
      description: '',
      instructions: [
        'Go to \'Parking Overlays\' in the side navigation',
        'Add the number of spaces needed',
        'Select single or double layer',
        'Select the parking space dimensions',
        'Click \'Add Parking Overlay\' and the parking spaces will be added inside your first drawn polygon',
        'You can add multiple parking overlays'
      ]
    }
  },
  {
    id: 6,
    title: 'Step 6 - Manage Parking',
    icon: Settings,
    content: {
      title: 'Step 6 - Manage Parking',
      description: '',
      instructions: [
        'Toggle to \'Select\' mode and click on the parking shape you want to edit',
        'Move the parking shape by clicking and dragging it to a new area',
        'Rotate a parking shape by using the rotation handles',
        'To delete a parking spaces shape, go to \'Parking Overlays\' in the side navigation and click the delete icon next to the parking shape you want to delete'
      ]
    }
  },
  {
    id: 7,
    title: 'Step 7 - 3D Mode',
    icon: Box,
    content: {
      title: 'Step 7 - 3D Mode',
      description: '',
      instructions: [
        'Turn on 3D mode by going to \'Default Settings\' and toggling the view mode',
        'Go to \'Measurements\' and click on a polygon to adjust the height of the shape'
      ]
    }
  },
  {
    id: 8,
    title: 'Step 8 - Saving a sketch',
    icon: Save,
    content: {
      title: 'Step 8 - Saving a sketch',
      description: '',
      instructions: [
        'Click on the menu icon in the top right of the screen',
        'Click \'Save as\' and add a sketch name',
        'You can optionally add a sketch description',
        'As you change a sketch, click \'Save\' from the same menu to save your progress'
      ]
    }
  },
  {
    id: 9,
    title: 'Step 9 - Opening a saved sketch',
    icon: FolderOpen,
    content: {
      title: 'Step 9 - Opening a saved sketch',
      description: '',
      instructions: [
        'Click on the menu icon in the top right of the screen',
        'Click \'Open\' and select a sketch',
        'Alternatively, find all your saved sketches, analyses, searches etc. in your dashboard'
      ]
    }
  }
];

// Step 10: Final screen
const finalScreen = {
  id: 10,
  title: 'You\'re All Set!',
  isFinal: true
};

export default function WelcomeOnboarding({
  isOpen,
  onClose,
  userProfile,
  onOpenTutorial,
  onDontShowAgain
}: WelcomeOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Determine which screen we're showing
  const isWelcomeScreen = currentStep === 0;
  const isFinalScreen = currentStep === 10;
  const isTutorialStep = currentStep >= 1 && currentStep <= 9;

  const currentTutorialStep = tutorialSteps.find(step => step.id === currentStep);
  const isLastTutorialStep = currentStep === 9;

  const handleWatchTutorial = () => {
    if (onOpenTutorial) {
      onOpenTutorial();
    }
    handleClose();
  };

  const handleFollowTutorial = () => {
    setCurrentStep(1); // Start step 1
  };

  const handleSkipTutorial = () => {
    handleClose();
  };

  const handleNext = () => {
    if (currentStep === 9) {
      // Go to final screen
      setCurrentStep(10);
    } else if (currentStep < 9) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleClose = () => {
    // Save "don't show again" preference if checked
    if (dontShowAgain && onDontShowAgain) {
      onDontShowAgain(true);
    }
    onClose();
  };

  const handleFinish = () => {
    handleClose();
  };

  // Welcome Screen
  if (isWelcomeScreen) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-violet-100 rounded-lg">
                <MapPin className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">
                  {welcomeScreen.title}
                </DialogTitle>
                <DialogDescription className="text-base text-gray-600 mt-1">
                  {welcomeScreen.subtitle}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <p className="text-gray-700 text-base">
              {welcomeScreen.description}
            </p>

            <div className="grid grid-cols-1 gap-3">
              {/* Watch Tutorial */}
              <Button
                onClick={handleWatchTutorial}
                className="w-full h-auto py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
              >
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">Watch Tutorial Video</div>
                    <div className="text-xs text-violet-100">Quick overview of SiteSketcher</div>
                  </div>
                </div>
              </Button>

              {/* Follow Tutorial */}
              <Button
                onClick={handleFollowTutorial}
                variant="outline"
                className="w-full h-auto py-4 border-2 border-violet-400 hover:bg-violet-50"
              >
                <div className="flex items-center gap-3">
                  <Play className="h-5 w-5 text-violet-600" />
                  <div className="text-left">
                    <div className="font-semibold text-violet-700">Follow Our Tutorial</div>
                    <div className="text-xs text-gray-600">Step-by-step guided tour</div>
                  </div>
                </div>
              </Button>

              {/* Skip Tutorial */}
              <Button
                onClick={handleSkipTutorial}
                variant="ghost"
                className="w-full h-auto py-4 text-gray-600 hover:bg-gray-100"
              >
                <div className="flex items-center gap-3">
                  <ArrowRight className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">Skip the Tutorial</div>
                    <div className="text-xs text-gray-500">Access it anytime via the Help icon</div>
                  </div>
                </div>
              </Button>
            </div>

            {/* Don't show again checkbox */}
            <div className="flex items-center space-x-2 pt-4 border-t">
              <Checkbox
                id="dontShowAgain"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <label
                htmlFor="dontShowAgain"
                className="text-sm text-gray-700 cursor-pointer select-none"
              >
                Don't show this tutorial again
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Final Screen
  if (isFinalScreen) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">
                  {finalScreen.title}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <p className="text-gray-700 text-base">
              You now know the basics of SiteSketcher! Remember, you can access this tutorial anytime by clicking the <strong>Help</strong> button in the top right corner.
            </p>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-700">
                      Need assistance? Contact us at{' '}
                      <a
                        href="mailto:rob@sitematcher.co.uk"
                        className="text-blue-600 hover:text-blue-700 font-semibold underline"
                      >
                        rob@sitematcher.co.uk
                      </a>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleFinish}
              className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
            >
              Start Using SiteSketcher
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Tutorial Steps (1-9)
  if (isTutorialStep && currentTutorialStep) {
    const StepIcon = currentTutorialStep.icon;

    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-violet-100 rounded-lg">
                <StepIcon className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">
                  {currentTutorialStep.title}
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600">
                  Step {currentStep} of 9
                </DialogDescription>
              </div>
            </div>

            {/* Progress indicator */}
            <div className="flex gap-2 mb-6">
              {tutorialSteps.map((step) => (
                <div
                  key={step.id}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    step.id <= currentStep ? 'bg-violet-600' : 'bg-gray-200'
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
                  {currentTutorialStep.content.title}
                </CardTitle>
              </CardHeader>

              {/* Video demonstration */}
              <div className="px-6 pb-4">
                <video
                  key={currentStep}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full rounded-lg border border-gray-200"
                  style={{ maxWidth: '550px' }}
                >
                  <source src={`/onboarding-videos/step-${currentStep}.mp4`} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>

              <CardContent>
                <p className="text-gray-600 mb-4">
                  {currentTutorialStep.content.description}
                </p>
                <ul className="space-y-2">
                  {currentTutorialStep.content.instructions.map((instruction, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{instruction}</span>
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
                  onClick={handleSkipTutorial}
                  className="text-gray-600"
                >
                  Skip
                </Button>
                <Button
                  onClick={handleNext}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {isLastTutorialStep ? 'Finish' : 'Next'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
