'use client';

import { useState, useEffect } from 'react';
import { OverviewTab } from './overview-tab';
import { RequirementsTab } from './requirements-tab';
import { SavedSearchesTab } from '@/components/saved-searches/saved-searches-tab';
import { ToolsTab } from './tools-tab';
import { AgencyTab } from './agency-tab';
import { SitesTab } from './sites-tab';
import { OutputsTab } from './outputs-tab';

interface DashboardClientProps {
  userId: string;
  userEmail: string;
}

type TabType = 'overview' | 'requirements' | 'searches' | 'sites' | 'outputs' | 'tools' | 'agency';

export default function DashboardClient({ userId, userEmail }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  useEffect(() => {
    const handleTabChange = (event: CustomEvent<TabType>) => {
      setActiveTab(event.detail);
    };

    window.addEventListener('dashboard-tab-change', handleTabChange as EventListener);
    return () => {
      window.removeEventListener('dashboard-tab-change', handleTabChange as EventListener);
    };
  }, []);

  return (
    <>
      {activeTab === 'overview' && <OverviewTab userId={userId} />}
      {activeTab === 'requirements' && <RequirementsTab userId={userId} />}
      {activeTab === 'agency' && <AgencyTab userId={userId} />}
      {activeTab === 'searches' && <SavedSearchesTab userId={userId} />}
      {activeTab === 'sites' && <SitesTab userId={userId} />}
      {activeTab === 'outputs' && <OutputsTab userId={userId} />}
      {activeTab === 'tools' && <ToolsTab />}
    </>
  );
}
