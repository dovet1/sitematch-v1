'use client';

import { POLYGON_COLORS } from '@/lib/sitesketcher-v2/constants';

interface PolygonToolPanelProps {
  selectedColorIndex: number;
  onColorChange: (index: number) => void;
}

export function PolygonToolPanel({
  selectedColorIndex,
  onColorChange,
}: PolygonToolPanelProps) {
  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-xs text-sm-ink/60 mb-4">
          Click to place points. Hold Shift to snap edges to 90° angles.
          Double-click or press Enter to finish.
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-sm-ink block mb-2">
          Color
        </label>
        <div className="grid grid-cols-3 gap-2">
          {POLYGON_COLORS.map((color, index) => (
            <button
              key={color.label}
              onClick={() => onColorChange(index)}
              className={`
                flex items-center gap-2 p-2 rounded border-2 transition-all
                ${
                  selectedColorIndex === index
                    ? 'border-sm-violet bg-sm-violet/5'
                    : 'border-sm-border hover:border-sm-violet/40'
                }
              `}
              title={color.label}
            >
              <div
                className="w-4 h-4 rounded border-2"
                style={{
                  backgroundColor: color.fill,
                  borderColor: color.stroke,
                }}
              />
              <span className="text-xs text-sm-ink">{color.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-sm-border">
        <h4 className="text-xs font-medium text-sm-ink mb-2">Shortcuts</h4>
        <ul className="space-y-1 text-xs text-sm-ink/60">
          <li>
            <kbd className="px-1.5 py-0.5 bg-sm-bg border border-sm-border rounded font-mono text-[10px]">
              Shift
            </kbd>{' '}
            Snap edge to 90°
          </li>
          <li>
            <kbd className="px-1.5 py-0.5 bg-sm-bg border border-sm-border rounded font-mono text-[10px]">
              V
            </kbd>{' '}
            Switch to select tool
          </li>
          <li>
            <kbd className="px-1.5 py-0.5 bg-sm-bg border border-sm-border rounded font-mono text-[10px]">
              Esc
            </kbd>{' '}
            Cancel drawing
          </li>
          <li>
            <kbd className="px-1.5 py-0.5 bg-sm-bg border border-sm-border rounded font-mono text-[10px]">
              Enter
            </kbd>{' '}
            Finish polygon
          </li>
        </ul>
      </div>
    </div>
  );
}
