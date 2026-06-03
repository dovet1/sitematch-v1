import { fireEvent, render, screen } from '@testing-library/react';
import { NewSketchConfirmModal } from '../NewSketchConfirmModal';

const baseProps = {
  sketchName: 'High Street Development',
  objectCount: {
    polygons: 2,
    parkingBlocks: 1,
    cadImages: 0,
  },
  onCancel: jest.fn(),
  onStartNew: jest.fn(),
  onSaveAndStart: jest.fn(),
};

describe('NewSketchConfirmModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('confirms a clean saved sketch without offering save actions', () => {
    render(<NewSketchConfirmModal {...baseProps} mode="saved-clean" />);

    expect(screen.getByText('Start a new sketch?')).toBeInTheDocument();
    expect(screen.getByText(/will stay saved/i)).toBeInTheDocument();
    expect(screen.queryByText('Save and start new')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start new sketch' }));

    expect(baseProps.onStartNew).toHaveBeenCalledTimes(1);
    expect(baseProps.onSaveAndStart).not.toHaveBeenCalled();
  });

  it('offers save and discard choices for a dirty saved sketch', () => {
    render(<NewSketchConfirmModal {...baseProps} mode="saved-dirty" />);

    expect(screen.getByText('Save changes before starting a new sketch?')).toBeInTheDocument();
    expect(screen.getByText(/most recent edits have not finished saving yet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save and start new' }));
    expect(baseProps.onSaveAndStart).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Start without saving' }));
    expect(baseProps.onStartNew).toHaveBeenCalledTimes(1);
  });

  it('warns when the current sketch has never been saved', () => {
    render(<NewSketchConfirmModal {...baseProps} mode="unsaved" />);

    expect(screen.getByText(/has not been saved yet/i)).toBeInTheDocument();
    expect(screen.queryByText('Save and start new')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start new sketch' }));
    expect(baseProps.onStartNew).toHaveBeenCalledTimes(1);
  });
});
