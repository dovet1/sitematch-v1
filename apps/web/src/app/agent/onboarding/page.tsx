import { Suspense } from 'react';
import { AgentOnboardingPage } from '@/components/agent/agent-onboarding-page';

export default function AgentOnboarding() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AgentOnboardingPage />
    </Suspense>
  );
}

export const metadata = {
  title: 'Join as an Agent - SiteMatcher',
  description: 'Join SiteMatcher as a property agent and help clients find their perfect sites',
};