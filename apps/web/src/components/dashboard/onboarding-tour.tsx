'use client';

import { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS, EVENTS } from 'react-joyride';
import { toast } from 'sonner';

interface OnboardingTourProps {
  userId: string;
  onComplete?: () => void;
  forceStart?: boolean;
}

export function OnboardingTour({ userId, onComplete, forceStart = false }: OnboardingTourProps) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration errors by only rendering on client
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (forceStart) {
      // Manually triggered - start immediately
      setRun(true);
      setStepIndex(0);
      return;
    }

    // Check if user has completed onboarding
    const checkOnboarding = async () => {
      try {
        const response = await fetch('/api/user/onboarding');
        if (response.ok) {
          const data = await response.json();
          if (!data.completed) {
            // Start tour after short delay
            setTimeout(() => {
              setRun(true);
            }, 1000);
          }
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      }
    };

    checkOnboarding();
  }, [forceStart, mounted]);

  const steps: Step[] = [
    {
      target: 'body',
      content: (
        <div className="space-y-3">
          <h3 className="text-xl font-black text-gray-900">Welcome to Your SiteMatcher Dashboard! 🎉</h3>
          <p className="text-gray-700">
            This is your central hub for everything SiteMatcher. Manage your listings, analyse potential sites with our tools, save searches and manage your account - all in one place.
          </p>
          <p className="text-sm text-gray-600">
            Let's take a quick tour to show you around.
          </p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="directories"]',
      content: (
        <div className="space-y-2">
          <h3 className="text-lg font-black text-gray-900">Access Public Directories</h3>
          <p className="text-gray-700">
            Quickly access the Requirement Directory to browse all available property requirements, or explore the Agency Directory to find property agencies.
          </p>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="requirements"]',
      content: (
        <div className="space-y-2">
          <h3 className="text-lg font-black text-gray-900">Manage Your Requirements</h3>
          <p className="text-gray-700">
            This is where you manage all your requirement listings. Create, edit, and track the status of your property requirements from draft to approved.
          </p>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="sites"]',
      content: (
        <div className="space-y-2">
          <h3 className="text-lg font-black text-gray-900">Assess and Organize Sites</h3>
          <p className="text-gray-700">
            Add sites you're assessing and aggregate information about them. Link saved searches, sketches, and demographic analyses to each site to build comprehensive site reports.
          </p>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="searches"]',
      content: (
        <div className="space-y-2">
          <h3 className="text-lg font-black text-gray-900">Automate Your Search</h3>
          <p className="text-gray-700">
            Define the kinds of requirements you're interested in and be notified automatically when relevant requirements are added. Save time by letting SiteMatcher find matches for you.
          </p>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="tools"]',
      content: (
        <div className="space-y-2">
          <h3 className="text-lg font-black text-gray-900">Powerful Site Analysis Tools</h3>
          <p className="text-gray-700">
            Access SiteSketcher to draw and measure site boundaries, and SiteAnalyser to explore store demographics and traffic data for any UK location.
          </p>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="account"]',
      content: (
        <div className="space-y-2">
          <h3 className="text-lg font-black text-gray-900">Manage Your Account</h3>
          <p className="text-gray-700">
            Access your subscription settings, manage your account, and log out from here.
          </p>
        </div>
      ),
      placement: 'top',
      disableBeacon: true,
    },
  ];

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { status, type, index } = data;

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      // Update step index
      setStepIndex(index + (type === EVENTS.STEP_AFTER ? 1 : 0));
    }

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);

      // Mark onboarding as completed
      try {
        await fetch('/api/user/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skipped: status === STATUS.SKIPPED }),
        });

        if (status === STATUS.FINISHED) {
          toast.success('🎉 Tour complete! You\'re ready to go.');
        }

        onComplete?.();
      } catch (error) {
        console.error('Error marking onboarding complete:', error);
      }
    }
  };

  // Don't render on server to avoid hydration errors
  if (!mounted) {
    return null;
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      disableScrolling={false}
      spotlightClicks={false}
      disableOverlayClose
      styles={{
        options: {
          primaryColor: '#7c3aed',
          backgroundColor: '#ffffff',
          textColor: '#1f2937',
          borderRadius: 12,
          zIndex: 10000,
        },
        buttonNext: {
          background: 'linear-gradient(to right, #7c3aed, #9333ea)',
          borderRadius: '8px',
          padding: '10px 20px',
          fontWeight: 700,
          fontSize: '14px',
        },
        buttonBack: {
          color: '#7c3aed',
          fontWeight: 600,
          marginRight: '8px',
        },
        buttonSkip: {
          color: '#6b7280',
          fontWeight: 500,
        },
        tooltip: {
          borderRadius: '12px',
          padding: '20px',
        },
        tooltipContent: {
          padding: '0',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip Tour',
      }}
    />
  );
}
