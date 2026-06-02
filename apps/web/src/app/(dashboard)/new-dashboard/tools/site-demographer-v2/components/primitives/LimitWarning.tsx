'use client';

import { AlertCircle, Lock } from 'lucide-react';

interface LimitWarningProps {
  feature: 'polygon' | 'parking' | 'measurement' | 'cad';
  current: number;
  max: number;
  reached: boolean;
  onUpgrade?: () => void;
}

const featureLabels = {
  polygon: 'polygons',
  parking: 'parking blocks',
  measurement: 'measurement segments',
  cad: 'CAD images',
};

export function LimitWarning({ feature, current, max, reached, onUpgrade }: LimitWarningProps) {
  const label = featureLabels[feature];
  const Icon = reached ? Lock : AlertCircle;

  return (
    <div className="rounded-lg border border-[rgba(112,51,255,0.2)] bg-[#F5F1FF] p-3 mb-3">
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 text-[#7033FF] mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#171419] leading-relaxed">
            {reached ? (
              <>
                You've used <span className="font-[600]">{current} of {max}</span> {label}.
                <br />
                Upgrade to Pro for unlimited {label}.
              </>
            ) : (
              <>
                Approaching limit: <span className="font-[600]">{current} of {max}</span> {label} used.
              </>
            )}
          </p>
          {onUpgrade && reached && (
            <button
              onClick={onUpgrade}
              className="mt-2 text-xs font-[600] text-[#7033FF] hover:text-[#5421CC] transition-colors"
            >
              Upgrade Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
