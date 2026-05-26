'use client';

import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { Tool } from '@/types/sitesketcher-v2';
import { clsx } from 'clsx';
import {
  MousePointer2,
  Pentagon,
  Car,
  FileImage,
  Ruler,
  Layers,
  FolderOpen,
} from 'lucide-react';

interface ToolButton {
  id: Tool | 'layers' | 'saved';
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
}

const TOOLS: ToolButton[] = [
  {
    id: 'select',
    icon: <MousePointer2 className="w-5 h-5" />,
    label: 'Select',
    shortcut: 'V',
  },
  {
    id: 'polygon',
    icon: <Pentagon className="w-5 h-5" />,
    label: 'Polygon',
    shortcut: 'P',
  },
  {
    id: 'parking',
    icon: <Car className="w-5 h-5" />,
    label: 'Parking',
    shortcut: 'K',
  },
  {
    id: 'cad',
    icon: <FileImage className="w-5 h-5" />,
    label: 'CAD',
    shortcut: 'C',
  },
  {
    id: 'measure',
    icon: <Ruler className="w-5 h-5" />,
    label: 'Measure',
    shortcut: 'M',
  },
];

const BOTTOM_TOOLS: ToolButton[] = [
  {
    id: 'layers',
    icon: <Layers className="w-5 h-5" />,
    label: 'Layers',
  },
  {
    id: 'saved',
    icon: <FolderOpen className="w-5 h-5" />,
    label: 'Saved',
  },
];

export function LeftRail() {
  const { activeTool, activePanel, setActiveTool, setActivePanel } = useSketchStore();

  const handleToolClick = (toolId: Tool | 'layers' | 'saved') => {
    if (toolId === 'layers' || toolId === 'saved') {
      setActivePanel(toolId);
      return;
    }
    setActiveTool(toolId);
  };

  return (
    <div className="w-16 bg-sm-surface border-r border-sm-border flex flex-col items-center py-3 flex-shrink-0">
      {/* Tool buttons */}
      <div className="flex flex-col gap-1">
        {TOOLS.map((tool) => (
          <ToolButtonComponent
            key={tool.id}
            tool={tool}
            isActive={activeTool === tool.id}
            onClick={() => handleToolClick(tool.id)}
          />
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom tools */}
      <div className="flex flex-col gap-1">
        {BOTTOM_TOOLS.map((tool) => (
          <ToolButtonComponent
            key={tool.id}
            tool={tool}
            isActive={activePanel === tool.id}
            onClick={() => handleToolClick(tool.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface ToolButtonComponentProps {
  tool: ToolButton;
  isActive: boolean;
  onClick: () => void;
}

function ToolButtonComponent({ tool, isActive, onClick }: ToolButtonComponentProps) {
  return (
    <button
      onClick={onClick}
      title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
      className={clsx(
        'w-12 h-12 flex items-center justify-center rounded-lg transition-all',
        'hover:bg-sm-bg focus-ring',
        isActive
          ? 'bg-sm-violet text-white shadow-sm'
          : 'text-sm-ink hover:text-sm-ink'
      )}
    >
      {tool.icon}
    </button>
  );
}
