import { fireEvent, render, screen } from '@testing-library/react';
import { SaveModal } from '../SaveModal';

const baseProps = {
  currentName: 'High Street Development',
  currentDescription: '',
  objectCount: {
    polygons: 2,
    parkingBlocks: 1,
    cadImages: 1,
  },
  onSave: jest.fn(),
  onCancel: jest.fn(),
};

describe('SaveModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mentions CAD images in the save summary when CAD is on the map', () => {
    render(<SaveModal {...baseProps} />);

    expect(screen.getByText('Objects in Sketch')).toBeInTheDocument();
    expect(screen.getByText('• 2 polygons')).toBeInTheDocument();
    expect(screen.getByText('• 1 parking block')).toBeInTheDocument();
    expect(screen.getByText('• 1 CAD image')).toBeInTheDocument();
  });

  it('uses the plural CAD image label for multiple CADs', () => {
    render(
      <SaveModal
        {...baseProps}
        objectCount={{
          polygons: 0,
          parkingBlocks: 0,
          cadImages: 2,
        }}
      />
    );

    expect(screen.getByText('• 2 CAD images')).toBeInTheDocument();
  });

  it('submits the trimmed sketch name and optional description', () => {
    render(<SaveModal {...baseProps} currentName="  High Street  " currentDescription="  Draft  " />);

    fireEvent.click(screen.getByRole('button', { name: 'Save Sketch' }));

    expect(baseProps.onSave).toHaveBeenCalledWith({
      name: 'High Street',
      description: 'Draft',
    });
  });
});
