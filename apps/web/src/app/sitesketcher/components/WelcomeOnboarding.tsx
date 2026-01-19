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
  ArrowLeft,
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
  title: 'Tutorial Complete!',
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
    // Reset to welcome screen for next time
    setCurrentStep(0);
    onClose();
  };

  const handleFinish = () => {
    handleClose();
  };

  // Welcome Screen
  if (isWelcomeScreen) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-[700px] h-[90vh] overflow-hidden p-0 bg-gradient-to-br from-violet-50 via-purple-50 to-blue-50 shadow-2xl !border-0 rounded-3xl flex flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>{welcomeScreen.title}</DialogTitle>
          </DialogHeader>

          {/* Fixed Header - doesn't scroll on mobile */}
          <div className="flex-shrink-0 relative px-8 pt-8 pb-6 bg-gradient-to-r from-violet-600 to-purple-700 overflow-hidden">
            {/* Blur circles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
              <div className="absolute -top-20 -right-20 w-[300px] h-[300px] bg-white rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-[250px] h-[250px] bg-purple-300 rounded-full blur-3xl" />
            </div>

            <div className="relative text-center">
              <div className="inline-flex p-4 bg-white/20 backdrop-blur-sm rounded-3xl mb-4">
                <MapPin className="h-12 w-12 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
                {welcomeScreen.title}
              </h1>
              <p className="text-lg text-violet-100 font-semibold">
                {welcomeScreen.subtitle}
              </p>
            </div>
          </div>

          {/* Scrollable Content Area - only scrolls on mobile */}
          <div className="flex-1 overflow-y-auto md:overflow-visible">
            <div className="px-8 py-8 space-y-6">
            <p className="text-lg text-gray-700 font-medium text-center">
              {welcomeScreen.description}
            </p>

            <div className="grid grid-cols-1 gap-4">
              {/* Watch Tutorial - Premium gradient card */}
              <button
                onClick={handleWatchTutorial}
                className="group relative bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-2xl p-6 shadow-2xl hover:shadow-violet-500/50 hover:scale-105 transition-all duration-300 border-0"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <Video className="h-7 w-7 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-xl font-black">Watch Tutorial Video</div>
                    <div className="text-sm text-violet-100 font-medium">Quick overview of SiteSketcher</div>
                  </div>
                  <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              {/* Follow Tutorial - Outlined premium card */}
              <button
                onClick={handleFollowTutorial}
                className="group relative bg-white hover:bg-violet-50 rounded-2xl p-6 shadow-xl hover:shadow-2xl border-4 border-violet-300 hover:border-violet-400 hover:scale-105 transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Play className="h-7 w-7 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-xl font-black text-gray-900">Follow Our Tutorial</div>
                    <div className="text-sm text-gray-600 font-medium">Step-by-step guided tour</div>
                  </div>
                  <ArrowRight className="h-6 w-6 text-violet-600 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              {/* Skip - Ghost style */}
              <button
                onClick={handleSkipTutorial}
                className="group text-left hover:bg-gray-50 rounded-2xl p-6 border-2 border-gray-200 hover:border-gray-300 transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <ArrowRight className="h-7 w-7 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xl font-bold text-gray-900">Skip the Tutorial</div>
                    <div className="text-sm text-gray-500 font-medium">Access it anytime via the Help icon</div>
                  </div>
                </div>
              </button>
            </div>

            {/* Don't show again checkbox - Enhanced */}
            <div className="flex items-center space-x-3 pt-4 border-t-2 border-gray-200">
              <Checkbox
                id="dontShowAgain"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
                className="h-5 w-5"
              />
              <label
                htmlFor="dontShowAgain"
                className="text-base text-gray-700 font-medium cursor-pointer select-none"
              >
                Don't show this tutorial again
              </label>
            </div>
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
        <DialogContent className="sm:max-w-[600px] h-[90vh] overflow-hidden p-0 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 shadow-2xl !border-0 rounded-3xl flex flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>{finalScreen.title}</DialogTitle>
          </DialogHeader>

          {/* Fixed Success Header - doesn't scroll on mobile */}
          <div className="flex-shrink-0 relative px-8 pt-8 pb-6 bg-gradient-to-r from-green-600 to-emerald-600 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
              <div className="absolute -top-20 -right-20 w-[300px] h-[300px] bg-white rounded-full blur-3xl" />
            </div>

            <div className="relative text-center">
              <div className="inline-flex p-4 bg-white/20 backdrop-blur-sm rounded-3xl mb-4">
                <CheckCircle className="h-12 w-12 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white">
                {finalScreen.title}
              </h1>
            </div>
          </div>

          {/* Scrollable Content Area - only scrolls on mobile */}
          <div className="flex-1 overflow-y-auto md:overflow-visible">
            <div className="px-8 py-8 space-y-6">
            <p className="text-lg text-gray-700 font-semibold text-center leading-relaxed">
              You now know the basics of SiteSketcher! Remember, you can access this tutorial anytime by clicking the <strong className="text-green-700">Help</strong> button in the top right corner.
            </p>

            {/* Contact card - Premium style */}
            <Card className="bg-white border-4 border-blue-200 rounded-2xl shadow-xl">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Mail className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-base text-gray-700 font-medium mb-2">
                      Need assistance? We're here to help!
                    </p>
                    <a
                      href="mailto:rob@sitematcher.co.uk"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-bold text-lg transition-colors"
                    >
                      rob@sitematcher.co.uk
                      <ArrowRight className="h-5 w-5" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTA Button */}
            <Button
              onClick={handleFinish}
              className="w-full h-14 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-lg font-black rounded-2xl shadow-2xl hover:shadow-green-500/50 hover:scale-105 transition-all duration-300"
            >
              Start Using SiteSketcher
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            </div>
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
        <DialogContent className="sm:max-w-[1000px] lg:max-w-[1200px] h-[90vh] overflow-hidden p-0 bg-gradient-to-br from-violet-50 via-purple-50 to-blue-50 shadow-2xl !border-0 rounded-3xl flex flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>{currentTutorialStep.title}</DialogTitle>
          </DialogHeader>

          {/* Premium Gradient Header - Fixed on mobile */}
          <div className="flex-shrink-0 relative px-6 md:px-8 pt-6 pb-4 bg-gradient-to-r from-violet-600 to-purple-700">
            {/* Background blur circles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-white rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-purple-300 rounded-full blur-3xl" />
            </div>

            <div className="relative flex items-center gap-3">
              {/* Icon badge */}
              <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-2xl">
                <StepIcon className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-white">
                  {currentTutorialStep.title}
                </h2>
                <p className="text-sm text-violet-100 font-medium">
                  Step {currentStep} of 9
                </p>
              </div>
            </div>

            {/* Progress indicator - redesigned */}
            <div className="relative mt-4 flex gap-1.5">
              {tutorialSteps.map((step) => (
                <div
                  key={step.id}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    step.id < currentStep
                      ? 'bg-white'
                      : step.id === currentStep
                      ? 'bg-white shadow-lg shadow-white/50'
                      : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto md:overflow-visible">
            {/* Two-column content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 p-6 md:p-8">
              {/* Left: Video Player */}
              <div>
                <video
                  key={currentStep}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full rounded-2xl border-4 border-violet-200 shadow-2xl"
                >
                  <source src={`/onboarding-videos/step-${currentStep}.mp4`} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* Right: Instructions & Navigation */}
              <div className="flex flex-col justify-between">
                {/* Instructions Card */}
                <Card className="bg-white/95 backdrop-blur-sm border-3 border-violet-200 rounded-2xl shadow-xl mb-6">
                  <CardContent className="pt-6">
                    {currentTutorialStep.content.description && (
                      <p className="text-gray-600 font-medium mb-4">
                        {currentTutorialStep.content.description}
                      </p>
                    )}
                    <ul className="space-y-3">
                      {currentTutorialStep.content.instructions.map((instruction, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <div className="mt-0.5 flex-shrink-0 w-6 h-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-md">
                            <CheckCircle className="h-4 w-4 text-white" />
                          </div>
                          <span className="text-base text-gray-700 font-medium leading-relaxed">
                            {instruction}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Navigation Buttons */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentStep === 1}
                    className="w-full sm:w-auto border-2 border-violet-300 hover:border-violet-400 hover:bg-violet-50 px-6 py-3 rounded-xl font-bold disabled:opacity-50"
                  >
                    <ArrowLeft className="mr-2 h-5 w-5" />
                    Previous
                  </Button>

                  <div className="flex gap-3 w-full sm:w-auto">
                    <Button
                      variant="ghost"
                      onClick={handleSkipTutorial}
                      className="flex-1 sm:flex-none text-gray-600 hover:bg-gray-100 px-6 py-3 rounded-xl font-bold"
                    >
                      Skip
                    </Button>
                    <Button
                      onClick={handleNext}
                      className="flex-1 sm:flex-none bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-black shadow-lg hover:shadow-violet-500/50 hover:scale-105 transition-all duration-300"
                    >
                      {isLastTutorialStep ? 'Finish' : 'Next'}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
