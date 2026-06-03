type Listener = () => void;

interface PreviewState {
  lastPlacedPoint: [number, number] | null;
  currentCursorPosition: [number, number] | null;
  rawCursorPosition: [number, number] | null;
  snappedCursorPosition: [number, number] | null;
  isSnapping: boolean;
}

class PolygonPreviewStore {
  private state: PreviewState = {
    lastPlacedPoint: null,
    currentCursorPosition: null,
    rawCursorPosition: null,
    snappedCursorPosition: null,
    isSnapping: false,
  };
  private listeners = new Set<Listener>();

  // Stable bound methods for useSyncExternalStore (prevents resubscribe churn)
  getState = () => this.state;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setState(partial: Partial<PreviewState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener());
  }

  clear() {
    this.state = {
      lastPlacedPoint: null,
      currentCursorPosition: null,
      rawCursorPosition: null,
      snappedCursorPosition: null,
      isSnapping: false,
    };
    this.listeners.forEach((listener) => listener());
  }
}

export const polygonPreviewStore = new PolygonPreviewStore();
