type Listener = () => void;

interface MeasurementPreviewState {
  lastMeasurementPoint: [number, number] | null;
  currentCursorPosition: [number, number] | null;
}

class MeasurementPreviewStore {
  private state: MeasurementPreviewState = {
    lastMeasurementPoint: null,
    currentCursorPosition: null,
  };
  private listeners = new Set<Listener>();

  // Stable bound methods for useSyncExternalStore (prevents resubscribe churn)
  getState = () => this.state;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setState(partial: Partial<MeasurementPreviewState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener());
  }

  clear() {
    this.state = {
      lastMeasurementPoint: null,
      currentCursorPosition: null,
    };
    this.listeners.forEach((listener) => listener());
  }
}

export const measurementPreviewStore = new MeasurementPreviewStore();
