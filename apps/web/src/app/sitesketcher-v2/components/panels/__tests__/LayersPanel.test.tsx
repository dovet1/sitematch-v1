import { render, screen } from '@testing-library/react';
import { LayersPanel } from '../LayersPanel';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import type { CadImage, ParkingBlock, Polygon } from '@/types/sitesketcher-v2';

jest.mock('@/lib/sitesketcher-v2/state-manager', () => ({
  useSketchStore: jest.fn(),
}));

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

type MockSketchState = {
  polygons: Polygon[];
  parkingBlocks: ParkingBlock[];
  cadImages: CadImage[];
  selectedId: string | null;
  setSelectedId: jest.Mock;
  focusMap: jest.Mock;
  deletePolygon: jest.Mock;
  deleteParkingBlock: jest.Mock;
};

function setMockState(updates: Partial<MockSketchState> = {}) {
  const mockState: MockSketchState = {
    polygons: [],
    parkingBlocks: [],
    cadImages: [],
    selectedId: null,
    setSelectedId: jest.fn(),
    focusMap: jest.fn(),
    deletePolygon: jest.fn(),
    deleteParkingBlock: jest.fn(),
    ...updates,
  };

  (useSketchStore as unknown as jest.Mock).mockReturnValue(mockState);
}

describe('LayersPanel', () => {
  beforeEach(() => {
    setMockState();
  });

  it('shows the total parking spaces next to the parking section title', () => {
    setMockState({
      parkingBlocks: [
        sampleParkingBlock,
        {
          ...sampleParkingBlock,
          id: 'parking-2',
          name: 'Parking B',
          spaces: 24,
        },
      ],
    });

    render(<LayersPanel />);

    expect(screen.getByText('Parking (2) · 34 spaces')).toBeInTheDocument();
    expect(screen.getByText('10 spaces')).toBeInTheDocument();
    expect(screen.getByText('24 spaces')).toBeInTheDocument();
  });

  it('uses the singular parking space label for one total space', () => {
    setMockState({
      parkingBlocks: [
        {
          ...sampleParkingBlock,
          spaces: 1,
        },
      ],
    });

    render(<LayersPanel />);

    expect(screen.getByText('Parking (1) · 1 space')).toBeInTheDocument();
    expect(screen.getByText('1 space')).toBeInTheDocument();
  });
});
