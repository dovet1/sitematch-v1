'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Save, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier';
import { UpgradeBanner } from '@/components/UpgradeBanner';

interface Site {
  id: string;
  name: string;
  address: string;
}

interface SaveAnalysisModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  analysisData: {
    location: { lat: number; lng: number };
    location_name: string;
    measurement_mode: string;
    measurement_value: number;
    selected_lsoa_codes: string[];
    demographics_data: any;
    national_averages: any;
    isochrone_geometry?: any;
  } | null;
  linkedSiteId?: string | null;
}

export function SaveAnalysisModal({
  open,
  onClose,
  onSuccess,
  analysisData,
  linkedSiteId,
}: SaveAnalysisModalProps) {
  const { isPro, isFreeTier } = useSubscriptionTier();

  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [name, setName] = useState('');
  const [saveOption, setSaveOption] = useState<'standalone' | 'existing' | 'new'>('standalone');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);

  useEffect(() => {
    if (open && !isPro) {
      setShowUpgradeBanner(true);
    }

    if (open && isPro) {
      fetchSites();
      // Auto-generate name based on location and measurement
      if (analysisData) {
        const { location_name, measurement_mode, measurement_value } = analysisData;
        let measurementText = '';
        if (measurement_mode === 'distance') {
          measurementText = `${measurement_value} mile${measurement_value !== 1 ? 's' : ''}`;
        } else if (measurement_mode === 'drive_time') {
          measurementText = `${measurement_value} min drive`;
        } else {
          measurementText = `${measurement_value} min walk`;
        }
        setName(`${location_name} - ${measurementText}`);
      }

      // If linkedSiteId is provided, auto-select it
      if (linkedSiteId) {
        setSaveOption('existing');
        setSelectedSiteId(linkedSiteId);
      }
    }
  }, [open, isPro, analysisData, linkedSiteId]);

  const fetchSites = async () => {
    setLoadingSites(true);
    try {
      const response = await fetch('/api/sites');
      if (!response.ok) throw new Error('Failed to fetch sites');

      const data = await response.json();
      setSites(data.sites || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
      toast.error('Failed to load sites');
    } finally {
      setLoadingSites(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!analysisData) {
      toast.error('No analysis data to save');
      return;
    }

    if (!name.trim()) {
      toast.error('Analysis name is required');
      return;
    }

    if (saveOption === 'existing' && !selectedSiteId) {
      toast.error('Please select a site');
      return;
    }

    setLoading(true);

    try {
      // Determine the site_id to use
      const siteId = saveOption === 'standalone' ? 'standalone' : selectedSiteId;

      const payload = {
        name: name.trim(),
        lng: analysisData.location.lng,
        lat: analysisData.location.lat,
        location_name: analysisData.location_name,
        measurement_mode: analysisData.measurement_mode,
        measurement_value: analysisData.measurement_value,
        selected_lsoa_codes: analysisData.selected_lsoa_codes,
        demographics_data: analysisData.demographics_data,
        national_averages: analysisData.national_averages,
        isochrone_geometry: analysisData.isochrone_geometry,
      };

      const response = await fetch(`/api/sites/${siteId}/analyses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save analysis');
      }

      toast.success('Analysis saved successfully!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error saving analysis:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save analysis');
    } finally {
      setLoading(false);
    }
  };

  // Show upgrade banner for free users
  if (showUpgradeBanner && isFreeTier) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <UpgradeBanner
            title="Save Your Demographic Analyses"
            features={[
              'Save unlimited demographic analyses',
              'Attach analyses to sites',
              'Access historical demographic data',
              'Export analysis reports',
              'Access all requirement listings',
              'Pro access to all tools',
            ]}
            context="general"
            onDismiss={onClose}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black flex items-center gap-2">
            <Save className="h-6 w-6 text-violet-600" />
            Save Analysis
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Analysis Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-bold text-gray-700">
              Analysis Name *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Central London - 2 mile radius"
              className="border-2 border-gray-200 focus:border-violet-500 rounded-xl"
              required
            />
          </div>

          {/* Save Options */}
          <div className="space-y-3">
            <Label className="text-sm font-bold text-gray-700">Save To</Label>
            <RadioGroup value={saveOption} onValueChange={(value: any) => setSaveOption(value)}>
              <div className="flex items-center space-x-2 p-4 rounded-xl border-2 border-gray-200 hover:border-violet-300 transition-colors cursor-pointer">
                <RadioGroupItem value="standalone" id="standalone" />
                <Label htmlFor="standalone" className="flex-1 cursor-pointer font-medium">
                  Save independently (not attached to a site)
                </Label>
              </div>

              {sites.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 p-4 rounded-xl border-2 border-gray-200 hover:border-violet-300 transition-colors cursor-pointer">
                    <RadioGroupItem value="existing" id="existing" />
                    <Label htmlFor="existing" className="flex-1 cursor-pointer font-medium">
                      Attach to existing site
                    </Label>
                  </div>

                  {saveOption === 'existing' && (
                    <div className="ml-6 space-y-2">
                      {loadingSites ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading sites...
                        </div>
                      ) : (
                        <RadioGroup value={selectedSiteId} onValueChange={setSelectedSiteId}>
                          {sites.map((site) => (
                            <div
                              key={site.id}
                              className="flex items-center space-x-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                            >
                              <RadioGroupItem value={site.id} id={`site-${site.id}`} />
                              <Label htmlFor={`site-${site.id}`} className="flex-1 cursor-pointer">
                                <div className="font-medium text-sm">{site.name}</div>
                                <div className="text-xs text-gray-500">{site.address}</div>
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      )}
                    </div>
                  )}
                </div>
              )}
            </RadioGroup>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="w-full sm:flex-1 border-2 border-gray-200 hover:bg-gray-50 font-bold rounded-xl"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full sm:flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold rounded-xl"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Analysis
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
