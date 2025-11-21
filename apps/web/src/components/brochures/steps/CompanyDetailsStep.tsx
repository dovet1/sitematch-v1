'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogoSelector } from '../LogoSelector';
import type { BrochureFormData, LogoSource } from '@/types/brochure';

interface CompanyDetailsStepProps {
  formData: BrochureFormData;
  onFormDataChange: (data: Partial<BrochureFormData>) => void;
}

export function CompanyDetailsStep({ formData, onFormDataChange }: CompanyDetailsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Company & Agent Details</h2>
        <p className="text-sm text-gray-500 mt-1">
          Enter the occupier's company information and agent contact details
        </p>
      </div>

      {/* Company Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-900 border-b border-gray-200 pb-2">
          Company Information
        </h3>

        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name *</Label>
          <Input
            id="companyName"
            value={formData.companyName}
            onChange={(e) => onFormDataChange({ companyName: e.target.value })}
            placeholder="e.g., Acme Corp"
          />
        </div>

        <LogoSelector
          label="Company Logo"
          logoSource={formData.companyLogoSource}
          logoUrl={formData.companyLogoUrl}
          companyDomain={formData.companyDomain || ''}
          onLogoSourceChange={(source: LogoSource) => onFormDataChange({ companyLogoSource: source })}
          onLogoUrlChange={(url: string) => onFormDataChange({ companyLogoUrl: url })}
          onCompanyDomainChange={(domain: string) => onFormDataChange({ companyDomain: domain })}
        />
      </div>

      {/* Agent Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-900 border-b border-gray-200 pb-2">
          Agent Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="agentName">Agent Name *</Label>
            <Input
              id="agentName"
              value={formData.agentName}
              onChange={(e) => onFormDataChange({ agentName: e.target.value })}
              placeholder="e.g., Jane Smith"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentCompany">Agent Company *</Label>
            <Input
              id="agentCompany"
              value={formData.agentCompany}
              onChange={(e) => onFormDataChange({ agentCompany: e.target.value })}
              placeholder="e.g., Smith & Partners"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="agentEmail">Agent Email *</Label>
            <Input
              id="agentEmail"
              type="email"
              value={formData.agentEmail}
              onChange={(e) => onFormDataChange({ agentEmail: e.target.value })}
              placeholder="jane@smithpartners.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentPhone">Agent Phone</Label>
            <Input
              id="agentPhone"
              type="tel"
              value={formData.agentPhone}
              onChange={(e) => onFormDataChange({ agentPhone: e.target.value })}
              placeholder="+44 20 1234 5678"
            />
          </div>
        </div>

        <LogoSelector
          label="Agent Logo"
          logoSource={formData.agentLogoSource}
          logoUrl={formData.agentLogoUrl}
          companyDomain={formData.agentDomain || ''}
          onLogoSourceChange={(source: LogoSource) => onFormDataChange({ agentLogoSource: source })}
          onLogoUrlChange={(url: string) => onFormDataChange({ agentLogoUrl: url })}
          onCompanyDomainChange={(domain: string) => onFormDataChange({ agentDomain: domain })}
        />
      </div>
    </div>
  );
}
