import { fireEvent, render, screen } from '@testing-library/react';
import { LeftPanel } from '../LeftPanel';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import type { CadImage, CadInstance, ParkingBlock, Polygon } from '@/types/sitesketcher-v2';

jest.mock('@/lib/sitesketcher-v2/state-manager', () => ({
  useSketchStore: jest.fn(),
}));

jest.mock('../../tools/PolygonToolPanel', () => ({
  PolygonToolPanel: () => <div>Polygon tool content</div>,
}));

jest.mock('../../tools/ParkingToolPanel', () => ({
  ParkingToolPanel: () => <div>Parking tool content</div>,
}));

jest.mock('../../tools/CadToolPanel', () => ({
  CadToolPanel: () => <div>CAD tool content</div>,
}));

jest.mock('../../tools/MeasureToolPanel', () => ({
  MeasureToolPanel: () => <div>Measure tool content</div>,
}));

jest.mock('../../panels/LayersPanel', () => ({
  LayersPanel: () => <div>Layers panel content</div>,
}));

jest.mock('../../panels/SavedSketchesPanel', () => ({
  SavedSketchesPanel: () => <div>Saved sketches content</div>,
}));

const samplePolygon: Polygon = {
  id: 'polygon-1',
  name: 'Plot A',
  colorIndex: 0,
  points: [
    [-0.1, 51.5],
    [-0.09, 51.5],
    [-0.09, 51.51],
  ],
  rotation: 0,
  height: 3,
  showDistances: true,
  showArea: true,
  createdAt: 1,
  updatedAt: 1,
};

const sampleParkingBlock: ParkingBlock = {
  id: 'parking-1',
  name: 'Parking A',
  spaces: 10,
  layout: 'single',
  stallSize: 'standard',
  anchor: [-0.1, 51.5],
  rotation: 0,
  createdAt: 1,
  updatedAt: 1,
};

const sampleCadImage: CadImage = {
  id: 'cad-1',
  fileName: 'site-plan.png',
  url: 'https://example.com/site-plan.png',
  storagePath: 'test/site-plan.png',
  metresPerPixel: 1,
  anchor: [-0.1, 51.5],
  rotation: 0,
  opacity: 1,
  imageWidthPx: 100,
  imageHeightPx: 100,
  createdAt: 1,
  updatedAt: 1,
};

const sampleCadInstance: CadInstance = {
  id: 'cad-instance-1',
  savedCadId: 'saved-cad-1',
  anchor: [-0.1, 51.5],
  rotation: 0,
  opacity: 1,
  locked: false,
  createdAt: 1,
  updatedAt: 1,
};

type MockSketchState = {
  activeTool: 'select' | 'polygon' | 'parking' | 'cad' | 'measure';
  activePanel: 'layers' | 'saved' | null;
  polygons: Polygon[];
  parkingBlocks: ParkingBlock[];
  cadImages: CadImage[];
  cadInstances: CadInstance[];
  selectedPolygonColorIndex: number;
  setActiveTool: jest.Mock;
  setActivePanel: jest.Mock;
  setSelectedPolygonColorIndex: jest.Mock;
};

let mockState: MockSketchState;

function setMockState(updates: Partial<MockSketchState> = {}) {
  mockState = {
    activeTool: 'select',
    activePanel: null,
    polygons: [],
    parkingBlocks: [],
    cadImages: [],
    cadInstances: [],
    selectedPolygonColorIndex: 0,
    setActiveTool: jest.fn((tool: MockSketchState['activeTool']) => {
      mockState = { ...mockState, activeTool: tool, activePanel: null };
    }),
    setActivePanel: jest.fn((panel: MockSketchState['activePanel']) => {
      mockState = { ...mockState, activePanel: panel, activeTool: 'select' };
    }),
    setSelectedPolygonColorIndex: jest.fn((index: number) => {
      mockState = { ...mockState, selectedPolygonColorIndex: index };
    }),
    ...updates,
  };

  (useSketchStore as unknown as jest.Mock).mockImplementation(() => mockState);
}

describe('LeftPanel', () => {
  beforeEach(() => {
    setMockState();
  });

  it('shows the select empty state when the sketch has no objects', () => {
    render(<LeftPanel />);

    expect(screen.getByText('Start sketching')).toBeInTheDocument();
    expect(
      screen.getByText('Pick a tool on the left, then click on the map to drop your first point.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /draw a polygon/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add parking/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload cad/i })).toBeInTheDocument();
    expect(screen.getByText(/search a postcode.*fly there first/i)).toBeInTheDocument();
  });

  it('switches to the selected tool panel from the empty state actions', () => {
    const { rerender } = render(<LeftPanel />);

    fireEvent.click(screen.getByRole('button', { name: /draw a polygon/i }));
    rerender(<LeftPanel />);
    expect(screen.getByText('Draw Polygon')).toBeInTheDocument();
    expect(screen.getByText('Polygon tool content')).toBeInTheDocument();

    setMockState();
    rerender(<LeftPanel />);
    fireEvent.click(screen.getByRole('button', { name: /add parking/i }));
    rerender(<LeftPanel />);
    expect(screen.getByText('Add Parking')).toBeInTheDocument();
    expect(screen.getByText('Parking tool content')).toBeInTheDocument();

    setMockState();
    rerender(<LeftPanel />);
    fireEvent.click(screen.getByRole('button', { name: /upload cad/i }));
    rerender(<LeftPanel />);
    expect(screen.getByText('CAD Overlay')).toBeInTheDocument();
    expect(screen.getByText('CAD tool content')).toBeInTheDocument();
  });

  it('hides the select empty state once any sketch object exists', () => {
    const { rerender, container } = render(<LeftPanel />);

    setMockState({ polygons: [samplePolygon] });
    rerender(<LeftPanel />);
    expect(screen.queryByText('Start sketching')).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();

    setMockState({ parkingBlocks: [sampleParkingBlock] });
    rerender(<LeftPanel />);
    expect(screen.queryByText('Start sketching')).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();

    setMockState({ cadImages: [sampleCadImage] });
    rerender(<LeftPanel />);
    expect(screen.queryByText('Start sketching')).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();

    setMockState({ cadInstances: [sampleCadInstance] });
    rerender(<LeftPanel />);
    expect(screen.queryByText('Start sketching')).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('shows explicit panels over the empty state', () => {
    const { rerender } = render(<LeftPanel />);

    setMockState({ activePanel: 'layers' });
    rerender(<LeftPanel />);
    expect(screen.getByText('Layers')).toBeInTheDocument();
    expect(screen.getByText('Layers panel content')).toBeInTheDocument();
    expect(screen.queryByText('Start sketching')).not.toBeInTheDocument();

    setMockState({ activePanel: 'saved' });
    rerender(<LeftPanel />);
    expect(screen.getByText('Saved Sketches')).toBeInTheDocument();
    expect(screen.getByText('Saved sketches content')).toBeInTheDocument();
    expect(screen.queryByText('Start sketching')).not.toBeInTheDocument();
  });
});
