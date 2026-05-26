'use client';

import { Button } from '../primitives/Button';
import { X, Sparkles, Check } from 'lucide-react';

interface UpgradeModalProps {
  reason: 'save' | 'polygon_limit' | 'cad_upload' | 'parking_limit';
  onClose: () => void;
  onUpgrade?: () => void;
}

export function UpgradeModal({ reason, onClose, onUpgrade }: UpgradeModalProps) {
  const messages = {
    save: {
      title: 'Save & Load Requires Pro',
      description: 'Upgrade to Pro to save your sketches and access them anytime.',
    },
    polygon_limit: {
      title: 'Polygon Limit Reached',
      description: 'Free users are limited to 1 polygon. Upgrade to Pro for unlimited polygons and parking blocks.',
    },
    cad_upload: {
      title: 'CAD Upload Requires Pro',
      description: 'Upgrade to Pro to overlay CAD images and site plans on your sketches.',
    },
    parking_limit: {
      title: 'Parking Limit Reached',
      description: 'Free users are limited to 1 parking block. Upgrade to Pro for unlimited parking blocks.',
    },
  };

  const message = messages[reason];

  const features = [
    'Unlimited polygons and parking blocks',
    'Save and load sketches',
    'CAD overlay with calibration',
    'Export to PNG, PDF, and CSV',
    '3D visualization mode',
    'Edge distance and area labels',
  ];

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      // Default: navigate to billing page
      window.location.href = '/settings/billing';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-sm-surface border border-sm-border rounded-lg shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between p-4 border-b border-sm-border">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sm-violet/10 rounded">
              <Sparkles className="w-5 h-5 text-sm-violet" />
            </div>
            <h2 className="text-lg font-semibold text-sm-ink">{message.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-sm-bg rounded transition-colors"
          >
            <X className="w-5 h-5 text-sm-ink/60" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-sm-ink/70">{message.description}</p>

          <div>
            <h3 className="text-sm font-semibold text-sm-ink mb-3">Pro Features</h3>
            <div className="space-y-2">
              {features.map((feature) => (
                <div key={feature} className="flex items-start gap-2">
                  <div className="mt-0.5">
                    <Check className="w-4 h-4 text-sm-violet" />
                  </div>
                  <span className="text-sm text-sm-ink/70">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-sm-violet-tint-soft border border-sm-violet/20 rounded-lg">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-bold text-sm-ink">£12</span>
              <span className="text-sm text-sm-ink/60">per month</span>
            </div>
            <p className="text-xs text-sm-ink/60">
              Cancel anytime. No long-term commitment.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-sm-border">
          <Button variant="ghost" onClick={onClose}>
            Maybe Later
          </Button>
          <Button onClick={handleUpgrade}>
            <Sparkles className="w-4 h-4 mr-1.5" />
            Upgrade to Pro
          </Button>
        </div>
      </div>
    </div>
  );
}
