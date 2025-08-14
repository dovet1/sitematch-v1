import { Suspense } from 'react';
import { AgentRegistrationPage } from '@/components/agent/agent-registration-page';

export default function AgentRegister() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AgentRegistrationPage />
    </Suspense>
  );
}

export const metadata = {
  title: 'Agent Registration - SiteMatcher',
  description: 'Complete your agent registration to start helping clients find their perfect properties',
};