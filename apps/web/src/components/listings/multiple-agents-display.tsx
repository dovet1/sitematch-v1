'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Users, Building2, MapPin, Plus, Settings } from 'lucide-react';
import { MultipleAgentsManager } from './multiple-agents-manager';
import { AgencyModal } from '@/components/agencies/AgencyModal';

interface Agency {
  id: string;
  name: string;
  contact_email?: string;
  contact_phone?: string;
  logo_url?: string;
  geographic_patch?: string;
  classification?: string;
}

interface ListingAgent {
  id: string;
  listing_id: string;
  agency_id: string;
  added_at: string;
  agency: Agency;
}

interface MultipleAgentsDisplayProps {
  listingId: string;
  agents: ListingAgent[];
  onAgentsUpdated: () => void;
  onCreateAgency?: () => void;
  className?: string;
}

export function MultipleAgentsDisplay({
  listingId,
  agents,
  onAgentsUpdated,
  onCreateAgency,
  className = ''
}: MultipleAgentsDisplayProps) {
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);

  if (agents.length === 0) {
    // Mobile-optimized empty state
    return (
      <div className={`text-center py-6 ${className}`}>
        <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-violet-500" />
        </div>
        <h4 className="font-medium text-gray-900 mb-2 text-sm">No Agencies Added</h4>
        <p className="text-xs text-gray-600 mb-4 leading-relaxed px-2">
          Let everyone know the agencies working on this company's site requirements.
        </p>
        <Button 
          onClick={() => setIsManagerOpen(true)}
          size="sm"
          className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-2"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Agencies
        </Button>

        <MultipleAgentsManager
          listingId={listingId}
          currentAgents={agents}
          isOpen={isManagerOpen}
          onClose={() => setIsManagerOpen(false)}
          onAgentsUpdated={onAgentsUpdated}
          onCreateAgency={onCreateAgency}
        />
      </div>
    );
  }

  // Single agent mobile-optimized view
  if (agents.length === 1) {
    const agent = agents[0];
    return (
      <div className={className}>
        {/* Mobile-optimized single agent card */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="p-4">
            {/* Header with manage button */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-1 rounded-full">
                1 Agent
              </span>
              <Button
                onClick={() => setIsManagerOpen(true)}
                variant="ghost"
                size="sm"
                className="text-violet-600 hover:text-violet-700 hover:bg-violet-50"
              >
                <Settings className="w-4 h-4 mr-1" />
                <span className="text-xs">Manage</span>
              </Button>
            </div>

            <div className="flex items-start gap-3">
              {/* Mobile-sized Agency Logo */}
              <div className="flex-shrink-0">
                {agent.agency.logo_url ? (
                  <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 p-1.5 flex items-center justify-center">
                    <img
                      src={agent.agency.logo_url}
                      alt={`${agent.agency.name} logo`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-violet-500" />
                  </div>
                )}
              </div>
              
              {/* Agency Info - Mobile optimized */}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">
                  {agent.agency.name}
                </h4>
                
                {agent.agency.geographic_patch && (
                  <p className="text-xs text-gray-600 mb-2 flex items-center">
                    <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                    <span className="truncate">{agent.agency.geographic_patch}</span>
                  </p>
                )}
                
                {agent.agency.classification && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-800 mb-2">
                    {agent.agency.classification === 'Both' ? 'Commercial and Residential' : agent.agency.classification}
                  </span>
                )}
                
                {/* Mobile Actions */}
                <div className="flex gap-3 mt-2">
                  <button 
                    onClick={() => setSelectedAgencyId(agent.agency.id)}
                    className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                  >
                    View Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <MultipleAgentsManager
          listingId={listingId}
          currentAgents={agents}
          isOpen={isManagerOpen}
          onClose={() => setIsManagerOpen(false)}
          onAgentsUpdated={onAgentsUpdated}
          onCreateAgency={onCreateAgency}
        />
      </div>
    );
  }

  // Multiple agents mobile-optimized view
  return (
    <div className={className}>
      {/* Header with agent count and manage button */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-violet-600 bg-violet-50 px-3 py-1.5 rounded-full">
          {agents.length} Agents
        </span>
        <Button
          onClick={() => setIsManagerOpen(true)}
          variant="ghost"
          size="sm"
          className="text-violet-600 hover:text-violet-700 hover:bg-violet-50"
        >
          <Settings className="w-4 h-4 mr-1" />
          <span className="text-xs">Manage</span>
        </Button>
      </div>

      <div className="space-y-2">
        {agents.map((agent) => (
          <div key={agent.id} className="bg-white rounded-lg border border-gray-100 p-3">
            <div className="flex items-start gap-3">
              {/* Mobile-optimized logo */}
              {agent.agency.logo_url ? (
                <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 p-1.5 flex items-center justify-center flex-shrink-0">
                  <img
                    src={agent.agency.logo_url}
                    alt={`${agent.agency.name} logo`}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-violet-500" />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">
                      {agent.agency.name}
                    </h4>
                    
                    {/* Mobile-optimized info - stacked vertically */}
                    {agent.agency.geographic_patch && (
                      <p className="text-xs text-gray-600 mb-1 flex items-center">
                        <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{agent.agency.geographic_patch}</span>
                      </p>
                    )}
                    
                    {agent.agency.classification && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-800">
                        {agent.agency.classification === 'Both' ? 'Commercial and Residential' : agent.agency.classification}
                      </span>
                    )}
                  </div>
                  
                  <Button
                    onClick={() => setSelectedAgencyId(agent.agency.id)}
                    variant="ghost"
                    size="sm"
                    className="text-violet-600 hover:text-violet-700 hover:bg-violet-50 ml-2 px-2"
                  >
                    <span className="text-xs">View</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <MultipleAgentsManager
        listingId={listingId}
        currentAgents={agents}
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        onAgentsUpdated={onAgentsUpdated}
        onCreateAgency={onCreateAgency}
      />

      <AgencyModal
        agencyId={selectedAgencyId}
        isOpen={!!selectedAgencyId}
        onClose={() => setSelectedAgencyId(null)}
      />
    </div>
  );
}