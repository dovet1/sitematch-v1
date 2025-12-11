'use client';

import { useState } from 'react';
import { MapPin, Edit3, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SiteMapPreview } from './SiteMapPreview';
import { toast } from 'sonner';

interface SiteHeaderSectionProps {
  siteId: string;
  name: string;
  address: string;
  description?: string;
  location?: { lat: number; lng: number };
  onUpdate?: () => void;
}

export function SiteHeaderSection({
  siteId,
  name: initialName,
  address,
  description: initialDescription,
  location,
  onUpdate
}: SiteHeaderSectionProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription || '');
  const [saving, setSaving] = useState(false);

  const handleSaveName = async () => {
    if (!name.trim()) {
      toast.error('Site name cannot be empty');
      setName(initialName);
      setIsEditingName(false);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/sites/${siteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      });

      if (!response.ok) throw new Error('Failed to update name');

      toast.success('Site name updated');
      setIsEditingName(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error updating name:', error);
      toast.error('Failed to update name');
      setName(initialName);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDescription = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/sites/${siteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() || null })
      });

      if (!response.ok) throw new Error('Failed to update description');

      toast.success('Description updated');
      setIsEditingDescription(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error updating description:', error);
      toast.error('Failed to update description');
      setDescription(initialDescription || '');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelName = () => {
    setName(initialName);
    setIsEditingName(false);
  };

  const handleCancelDescription = () => {
    setDescription(initialDescription || '');
    setIsEditingDescription(false);
  };

  return (
    <div className="space-y-6">
      {/* Site Name */}
      <div className="flex items-start gap-3">
        {isEditingName ? (
          <div className="flex-1 flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') handleCancelName();
              }}
              className="text-3xl font-black border-3 border-violet-300 rounded-2xl"
              autoFocus
              disabled={saving}
            />
            <Button
              size="sm"
              onClick={handleSaveName}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white rounded-xl"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelName}
              disabled={saving}
              className="border-2 rounded-xl"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex-1 group">
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 flex items-center gap-3">
              {name}
              <button
                onClick={() => setIsEditingName(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-violet-50 rounded-xl"
              >
                <Edit3 className="h-5 w-5 text-violet-600" />
              </button>
            </h1>
          </div>
        )}
      </div>

      {/* Address and Map Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Address */}
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-gray-700">
            <MapPin className="h-5 w-5 mt-1 text-violet-600 flex-shrink-0" />
            <p className="text-lg font-bold">{address}</p>
          </div>

          {/* Description */}
          <div className="bg-gray-50 rounded-2xl border-2 border-gray-200 p-4">
            {isEditingDescription ? (
              <div className="space-y-2">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleCancelDescription();
                  }}
                  placeholder="Add a description for this site..."
                  className="min-h-[100px] border-2 border-violet-300 rounded-xl resize-none"
                  autoFocus
                  disabled={saving}
                  maxLength={500}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{description.length}/500</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveDescription}
                      disabled={saving}
                      className="bg-green-600 hover:bg-green-700 text-white rounded-xl"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelDescription}
                      disabled={saving}
                      className="border-2 rounded-xl"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setIsEditingDescription(true)}
                className="cursor-pointer hover:bg-gray-100 rounded-xl p-2 -m-2 transition-colors group"
              >
                {description ? (
                  <p className="text-gray-700 text-sm whitespace-pre-wrap">{description}</p>
                ) : (
                  <p className="text-gray-400 text-sm italic">Click to add a description...</p>
                )}
                <Edit3 className="h-4 w-4 text-violet-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
        </div>

        {/* Map Preview */}
        {location && (
          <SiteMapPreview
            latitude={location.lat}
            longitude={location.lng}
            siteName={name}
            className="h-[250px] lg:h-full"
          />
        )}
      </div>
    </div>
  );
}
