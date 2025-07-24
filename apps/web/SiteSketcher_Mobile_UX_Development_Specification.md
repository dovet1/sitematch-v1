# SiteSketcher Mobile UX Development Specification

## Overview

This document provides comprehensive technical implementation details for mobile UX improvements to the SiteSketcher tool. The improvements focus on optimizing the touch-first experience, implementing responsive design patterns, and enhancing accessibility for mobile users.

## Current Architecture Analysis

### Current Implementation Structure
- **Main Component**: `/src/app/sitesketcher/page.tsx` - Main orchestration component
- **Map Component**: `/src/app/sitesketcher/components/MapboxMap.tsx` - Mapbox GL JS integration
- **Controls Component**: `/src/app/sitesketcher/components/ResponsiveControls.tsx` - UI controls and measurements
- **Types**: `/src/types/sitesketcher.ts` - TypeScript interfaces
- **Mobile CSS**: `/src/styles/map-mobile.css` - Existing mobile optimizations

### Current Mobile Implementation Status
- Basic responsive design with desktop sidebar → mobile bottom sheet
- Touch target sizing partially implemented (44px for some elements)
- Basic map touch interactions via Mapbox GL JS
- Limited gesture handling for drawing and selection modes

## Phase 1: Critical Mobile Improvements

### 1.1 Bottom Sheet Layout Implementation

#### Technical Requirements

**Component Structure:**
```typescript
// New component: /src/app/sitesketcher/components/MobileBottomSheet.tsx
interface MobileBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  snapPoints: number[]; // [0.2, 0.5, 0.9] - percentages of viewport height
  currentSnapPoint: number;
  onSnapPointChange: (point: number) => void;
  children: React.ReactNode;
}
```

**Implementation Details:**

1. **Touch-Responsive Bottom Sheet**
```typescript
import { useSpring, animated, config } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';

export function MobileBottomSheet({ 
  isOpen, 
  snapPoints, 
  currentSnapPoint, 
  onSnapPointChange,
  children 
}: MobileBottomSheetProps) {
  const [{ y }, api] = useSpring(() => ({ 
    y: isOpen ? snapPoints[currentSnapPoint] * window.innerHeight : window.innerHeight 
  }));

  const bind = useDrag(
    ({ last, velocity: [, vy], direction: [, dy], movement: [, my], cancel, canceled }) => {
      // Gesture handling for smooth dragging
      if (my < -70) cancel();
      
      if (last) {
        const newSnapPoint = findNearestSnapPoint(my, vy, dy);
        onSnapPointChange(newSnapPoint);
        api.start({
          y: snapPoints[newSnapPoint] * window.innerHeight,
          immediate: false,
          config: config.stiff
        });
      } else {
        api.start({ y: my, immediate: true });
      }
    },
    {
      from: () => [0, y.get()],
      bounds: { top: 0, bottom: window.innerHeight },
      rubberband: true
    }
  );

  return (
    <animated.div
      {...bind()}
      style={{
        y,
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        touchAction: 'none'
      }}
      className="bg-white rounded-t-xl shadow-2xl"
    >
      {/* Drag Handle */}
      <div className="flex justify-center py-3">
        <div className="w-12 h-1 bg-gray-300 rounded-full" />
      </div>
      
      <div className="px-4 pb-safe-area-inset-bottom">
        {children}
      </div>
    </animated.div>
  );
}
```

2. **Integration with Main Component**
```typescript
// Update to /src/app/sitesketcher/page.tsx
const [bottomSheetOpen, setBottomSheetOpen] = useState(true);
const [snapPoint, setSnapPoint] = useState(0); // Start collapsed

// Replace mobile controls section
{isMobile && (
  <MobileBottomSheet
    isOpen={bottomSheetOpen}
    onOpenChange={setBottomSheetOpen}
    snapPoints={[0.15, 0.5, 0.85]}
    currentSnapPoint={snapPoint}
    onSnapPointChange={setSnapPoint}
  >
    <ResponsiveControls
      {...controlProps}
      isMobile={true}
      snapPoint={snapPoint}
    />
  </MobileBottomSheet>
)}
```

### 1.2 Enhanced Touch Target Implementation

#### Requirements: Minimum 44px touch targets

**Button Component Enhancement:**
```typescript
// Update /src/app/sitesketcher/components/ResponsiveControls.tsx
const MobileButton = styled(Button)`
  min-height: 44px;
  min-width: 44px;
  padding: 12px;
  font-size: 16px;
  touch-action: manipulation;
  
  &:active {
    transform: scale(0.98);
    transition: transform 0.1s ease;
  }
`;
```

**Map Controls Enhancement:**
```typescript
// Update MapboxMap.tsx floating controls
const FloatingModeToggle = ({ drawingMode, onModeToggle }: Props) => (
  <button
    onClick={onModeToggle}
    className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg
               min-w-12 min-h-12 p-3 hover:bg-gray-50 transition-colors
               active:scale-95 touch-manipulation"
    style={{ minWidth: '48px', minHeight: '48px' }}
    title={drawingMode === 'draw' ? 'Switch to Select Mode' : 'Switch to Draw Mode'}
  >
    {/* Icon content */}
  </button>
);
```

**CSS Updates:**
```css
/* Add to /src/styles/map-mobile.css */
@media (max-width: 768px) {
  /* Ensure all interactive elements meet 44px minimum */
  .sitesketcher-button,
  .mobile-control-button,
  .floating-control {
    min-width: 44px !important;
    min-height: 44px !important;
    padding: 8px !important;
    border-radius: 8px;
    touch-action: manipulation;
  }
  
  /* Active state feedback */
  .sitesketcher-button:active,
  .mobile-control-button:active {
    transform: scale(0.98);
    transition: transform 0.1s ease;
    background-color: rgba(0, 0, 0, 0.05);
  }
  
  /* Increase spacing between touch targets */
  .mobile-control-group > * + * {
    margin-top: 12px;
  }
}
```

### 1.3 Gesture Conflict Resolution

#### Current Issues:
- Map pan conflicts with drawing gestures
- Zoom conflicts with polygon manipulation
- Mode switching not optimized for touch

#### Solution Implementation:

1. **Enhanced Drawing State Management**
```typescript
// Update MapboxMap.tsx
interface TouchState {
  isDrawing: boolean;
  isPanning: boolean;
  isManipulating: boolean;
  lastTouchCount: number;
  gestureStartTime: number;
}

const [touchState, setTouchState] = useState<TouchState>({
  isDrawing: false,
  isPanning: false,
  isManipulating: false,
  lastTouchCount: 0,
  gestureStartTime: 0
});

// Enhanced gesture detection
const handleTouchStart = useCallback((e: TouchEvent) => {
  const touchCount = e.touches.length;
  const now = Date.now();
  
  setTouchState(prev => ({
    ...prev,
    lastTouchCount: touchCount,
    gestureStartTime: now
  }));
  
  if (drawingMode === 'draw' && touchCount === 1) {
    // Single touch in draw mode = drawing intent
    setTouchState(prev => ({ ...prev, isDrawing: true }));
    // Disable map interactions temporarily
    map.dragPan.disable();
    map.scrollZoom.disable();
  } else if (touchCount === 2) {
    // Two finger gesture = map interaction intent
    setTouchState(prev => ({ ...prev, isPanning: true }));
  }
}, [drawingMode, map]);

const handleTouchEnd = useCallback((e: TouchEvent) => {
  const touchCount = e.touches.length;
  const duration = Date.now() - touchState.gestureStartTime;
  
  if (touchCount === 0) {
    // All touches ended - reset drawing state
    setTimeout(() => {
      setTouchState({
        isDrawing: false,
        isPanning: false,
        isManipulating: false,
        lastTouchCount: 0,
        gestureStartTime: 0
      });
      
      // Re-enable map interactions
      if (drawingMode === 'draw') {
        map.dragPan.enable();
        map.scrollZoom.enable();
      }
    }, 100); // Small delay to prevent conflicts
  }
}, [touchState.gestureStartTime, drawingMode, map]);
```

2. **Mode-Specific Gesture Handling**
```typescript
// Drawing mode optimizations
useEffect(() => {
  if (!mapRef.current) return;
  
  const map = mapRef.current;
  
  if (drawingMode === 'draw') {
    // Optimize for drawing
    map.dragPan.disable();
    map.touchZoomRotate.disable();
    map.doubleClickZoom.disable();
    
    // Custom single-touch drawing handler
    map.on('touchstart', handleDrawingTouchStart);
    map.on('touchmove', handleDrawingTouchMove);
    map.on('touchend', handleDrawingTouchEnd);
  } else {
    // Optimize for selection/manipulation
    map.dragPan.enable();
    map.touchZoomRotate.enable();
    map.doubleClickZoom.enable();
    
    map.off('touchstart', handleDrawingTouchStart);
    map.off('touchmove', handleDrawingTouchMove);
    map.off('touchend', handleDrawingTouchEnd);
  }
  
  return () => {
    map.off('touchstart', handleDrawingTouchStart);
    map.off('touchmove', handleDrawingTouchMove);
    map.off('touchend', handleDrawingTouchEnd);
  };
}, [drawingMode]);
```

### 1.4 Visual Feedback Enhancement

#### Implementation:

1. **Touch Feedback System**
```typescript
// New component: /src/app/sitesketcher/components/TouchFeedback.tsx
interface TouchRippleProps {
  x: number;
  y: number;
  visible: boolean;
  onComplete: () => void;
}

export const TouchRipple: React.FC<TouchRippleProps> = ({ x, y, visible, onComplete }) => {
  const [scale, setScale] = useState(0);
  
  useEffect(() => {
    if (visible) {
      setScale(1);
      const timer = setTimeout(() => {
        setScale(0);
        onComplete();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible, onComplete]);
  
  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{
        left: x - 20,
        top: y - 20,
        transform: `scale(${scale})`,
        transition: 'transform 0.3s ease-out',
        width: 40,
        height: 40,
        borderRadius: '50%',
        backgroundColor: 'rgba(59, 130, 246, 0.3)',
        border: '2px solid rgba(59, 130, 246, 0.6)'
      }}
    />
  );
};

// Integration in MapboxMap.tsx
const [touchFeedback, setTouchFeedback] = useState<{x: number, y: number, visible: boolean}[]>([]);

const addTouchFeedback = (x: number, y: number) => {
  const id = Date.now();
  setTouchFeedback(prev => [...prev, { x, y, visible: true }]);
  
  setTimeout(() => {
    setTouchFeedback(prev => prev.filter(feedback => feedback.x !== x || feedback.y !== y));
  }, 300);
};
```

2. **Drawing State Indicators**
```css
/* Visual indicators for drawing states */
.map-container.drawing-mode {
  cursor: crosshair;
}

.map-container.drawing-mode::before {
  content: 'Drawing Mode - Tap to add points';
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(59, 130, 246, 0.9);
  color: white;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  z-index: 10;
  animation: fadeIn 0.3s ease;
}

.map-container.select-mode::before {
  content: 'Select Mode - Tap polygon to select';
  /* Similar styling */
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

### 1.5 Performance Optimizations

#### Debounced Updates:
```typescript
// Optimized update handlers
const debouncedPolygonUpdate = useMemo(
  () => debounce((polygon: MapboxDrawPolygon) => {
    onPolygonUpdate(polygon);
  }, 150),
  [onPolygonUpdate]
);

const throttledGestureHandler = useMemo(
  () => throttle((event: TouchEvent) => {
    handleGestureMovement(event);
  }, 16), // 60fps
  [handleGestureMovement]
);
```

## Phase 2: Enhanced Mobile Features

### 2.1 Advanced Gesture Recognition

#### Multi-touch Polygon Manipulation:
```typescript
// Enhanced polygon manipulation
interface MultiTouchState {
  initialDistance: number;
  initialAngle: number;
  initialCenter: [number, number];
  touches: Touch[];
}

const handleMultiTouchManipulation = useCallback((e: TouchEvent) => {
  if (e.touches.length === 2 && selectedPolygonId) {
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    
    const distance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + 
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
    
    const angle = Math.atan2(
      touch2.clientY - touch1.clientY,
      touch2.clientX - touch1.clientX
    );
    
    const center: [number, number] = [
      (touch1.clientX + touch2.clientX) / 2,
      (touch1.clientY + touch2.clientY) / 2
    ];
    
    // Apply scaling and rotation to selected polygon
    transformPolygon(selectedPolygonId, { distance, angle, center });
  }
}, [selectedPolygonId, transformPolygon]);
```

### 2.2 Voice Commands Integration

#### Basic Implementation:
```typescript
// New hook: /src/hooks/useVoiceCommands.ts
export const useVoiceCommands = (onCommand: (command: string) => void) => {
  const [isListening, setIsListening] = useState(false);
  const recognition = useRef<SpeechRecognition | null>(null);
  
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition.current = new SpeechRecognition();
      
      recognition.current.continuous = false;
      recognition.current.interimResults = false;
      recognition.current.lang = 'en-US';
      
      recognition.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        onCommand(transcript);
      };
    }
  }, [onCommand]);
  
  const startListening = () => {
    if (recognition.current) {
      recognition.current.start();
      setIsListening(true);
    }
  };
  
  const stopListening = () => {
    if (recognition.current) {
      recognition.current.stop();
      setIsListening(false);
    }
  };
  
  return { isListening, startListening, stopListening };
};

// Usage in main component
const handleVoiceCommand = (command: string) => {
  if (command.includes('draw')) {
    setState(prev => ({ ...prev, drawingMode: 'draw' }));
  } else if (command.includes('select')) {
    setState(prev => ({ ...prev, drawingMode: 'select' }));
  } else if (command.includes('clear')) {
    handleClearAll();
  }
  // Add more commands as needed
};
```

### 2.3 Haptic Feedback

#### Implementation:
```typescript
// Utility function for haptic feedback
const triggerHapticFeedback = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = {
      light: 10,
      medium: 20,
      heavy: 50
    };
    navigator.vibrate(patterns[type]);
  }
};

// Integration in touch handlers
const handlePolygonVertexTouch = (vertex: number) => {
  triggerHapticFeedback('light');
  // Handle vertex selection
};

const handlePolygonComplete = () => {
  triggerHapticFeedback('medium');
  // Handle completion
};
```

## Responsive Design Specifications

### Breakpoint Strategy:
```css
/* Mobile breakpoints */
:root {
  --mobile-sm: 320px;
  --mobile-md: 375px;
  --mobile-lg: 414px;
  --tablet-sm: 768px;
  --tablet-lg: 1024px;
}

/* Base mobile styles */
@media (max-width: 767px) {
  .sitesketcher-container {
    padding: 0;
    height: 100vh;
    overflow: hidden;
  }
  
  .map-container {
    height: calc(100vh - 120px); /* Account for bottom sheet minimum */
  }
  
  /* Typography scaling */
  .measurement-text {
    font-size: clamp(12px, 3.5vw, 16px);
  }
  
  .control-label {
    font-size: clamp(10px, 3vw, 14px);
  }
}

/* Small mobile (iPhone SE) */
@media (max-width: 375px) {
  .bottom-sheet-content {
    padding: 12px;
  }
  
  .control-grid {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
}

/* Large mobile (iPhone Pro Max) */
@media (max-width: 428px) and (min-width: 376px) {
  .control-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
}

/* Landscape mobile */
@media (max-height: 500px) and (orientation: landscape) {
  .bottom-sheet-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    max-height: 80vh;
    overflow-y: auto;
  }
}
```

## Accessibility Requirements

### WCAG 2.1 AA Compliance:

1. **Keyboard Navigation:**
```typescript
// Enhanced keyboard support
const handleKeyDown = useCallback((e: KeyboardEvent) => {
  switch (e.key) {
    case 'Tab':
      // Focus management for modal/sheet
      e.preventDefault();
      focusNextElement();
      break;
    case 'Escape':
      // Close bottom sheet or exit drawing mode
      if (bottomSheetOpen) {
        setBottomSheetOpen(false);
      } else if (drawingMode === 'draw') {
        setDrawingMode('select');
      }
      break;
    case 'Enter':
    case ' ':
      // Activate focused element
      if (focusedElement) {
        e.preventDefault();
        focusedElement.click();
      }
      break;
    case 'ArrowUp':
    case 'ArrowDown':
      // Navigate through polygon list
      e.preventDefault();
      navigatePolygonList(e.key === 'ArrowUp' ? -1 : 1);
      break;
  }
}, [bottomSheetOpen, drawingMode, focusedElement]);
```

2. **Screen Reader Support:**
```typescript
// ARIA labels and descriptions
const getAriaLabel = (mode: DrawingMode, polygonCount: number) => {
  return `SiteSketcher in ${mode} mode. ${polygonCount} polygon${polygonCount !== 1 ? 's' : ''} drawn.`;
};

const getMeasurementAnnouncement = (measurement: AreaMeasurement, unit: MeasurementUnit) => {
  const area = unit === 'metric' ? measurement.squareMeters : measurement.squareFeet;
  const unitLabel = unit === 'metric' ? 'square meters' : 'square feet';
  return `Polygon area: ${area.toFixed(2)} ${unitLabel}`;
};

// Live region for announcements
<div 
  role="status" 
  aria-live="polite" 
  className="sr-only"
>
  {announcement}
</div>
```

3. **Color and Contrast:**
```css
/* High contrast mode support */
@media (prefers-contrast: high) {
  .polygon-stroke {
    stroke-width: 3px;
    stroke: #000000;
  }
  
  .measurement-text {
    background: #ffffff;
    color: #000000;
    border: 2px solid #000000;
  }
}

/* Color blindness considerations */
.polygon-fill {
  fill: hsl(220, 90%, 56%); /* Blue base */
}

.polygon-fill.selected {
  fill: hsl(45, 100%, 51%); /* High contrast yellow */
}

/* Focus indicators */
.focusable:focus {
  outline: 3px solid hsl(220, 90%, 56%);
  outline-offset: 2px;
}
```

## Touch Interaction Patterns

### Standard Gestures:

1. **Single Tap:** Point placement (draw mode) / Selection (select mode)
2. **Long Press:** Context menu / Polygon selection
3. **Pan:** Map navigation (when not drawing)
4. **Pinch:** Zoom in/out
5. **Two-finger rotation:** Map rotation
6. **Swipe up/down:** Bottom sheet manipulation

### Custom Gestures:

```typescript
// Gesture recognition patterns
const gesturePatterns = {
  doubleTap: {
    maxDelay: 300,
    action: 'complete-polygon'
  },
  longPress: {
    minDuration: 500,
    action: 'show-context-menu'
  },
  swipeUp: {
    minDistance: 50,
    maxTime: 300,
    action: 'expand-bottom-sheet'
  },
  pinchScale: {
    minScale: 0.5,
    maxScale: 3.0,
    action: 'scale-polygon'
  }
};
```

## Testing Criteria

### Functional Tests:

1. **Drawing Flow:**
   - [ ] Single tap adds polygon vertex
   - [ ] Double tap completes polygon
   - [ ] Long press shows context menu
   - [ ] Measurements update in real-time

2. **Selection Flow:**
   - [ ] Tap selects polygon
   - [ ] Tap outside deselects
   - [ ] Selected polygon shows manipulation handles
   - [ ] Multi-touch manipulation works

3. **Bottom Sheet:**
   - [ ] Swipe gestures work smoothly
   - [ ] Snap points function correctly
   - [ ] Content scrolls when needed
   - [ ] Performance remains smooth during interaction

### Performance Tests:

```typescript
// Performance monitoring
const measurePerformance = () => {
  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry) => {
      if (entry.entryType === 'measure') {
        console.log(`${entry.name}: ${entry.duration}ms`);
      }
    });
  });
  
  observer.observe({ entryTypes: ['measure'] });
  
  // Measure drawing performance
  performance.mark('drawing-start');
  // ... drawing operation
  performance.mark('drawing-end');
  performance.measure('drawing-operation', 'drawing-start', 'drawing-end');
};
```

### Device Testing Matrix:

| Device | Screen Size | OS | Browser | Test Priority |
|--------|-------------|-------|---------|---------------|
| iPhone SE | 375x667 | iOS 15+ | Safari | High |
| iPhone 12 | 390x844 | iOS 15+ | Safari | High |
| iPhone 14 Pro | 393x852 | iOS 16+ | Safari | High |
| Samsung Galaxy S21 | 384x854 | Android 11+ | Chrome | High |
| iPad Air | 820x1180 | iOS 15+ | Safari | Medium |
| Pixel 6 | 411x823 | Android 12+ | Chrome | Medium |

## Implementation Phases

### Phase 1 (Week 1-2): Critical Features
1. ✅ Bottom sheet implementation
2. ✅ Touch target optimization
3. ✅ Basic gesture handling
4. ✅ Visual feedback system

### Phase 2 (Week 3-4): Enhanced Features
1. Advanced gesture recognition
2. Performance optimizations
3. Accessibility improvements
4. Testing and refinement

### Phase 3 (Week 5-6): Polish and Testing
1. Cross-device testing
2. Performance tuning
3. Bug fixes and edge cases
4. Documentation updates

## Code Examples and Snippets

### Complete Bottom Sheet Implementation:

```typescript
// /src/app/sitesketcher/components/MobileBottomSheet.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSpring, animated, config } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  snapPoints?: number[];
  initialSnapPoint?: number;
  children: React.ReactNode;
  className?: string;
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onOpenChange,
  snapPoints = [0.15, 0.5, 0.9],
  initialSnapPoint = 0,
  children,
  className = ''
}) => {
  const [currentSnapPoint, setCurrentSnapPoint] = useState(initialSnapPoint);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const snapHeights = snapPoints.map(point => window.innerHeight * (1 - point));
  
  const [{ y }, api] = useSpring(() => ({
    y: isOpen ? snapHeights[currentSnapPoint] : window.innerHeight,
    config: config.stiff
  }));
  
  const findNearestSnapPoint = useCallback((position: number, velocity: number) => {
    const currentHeight = window.innerHeight - position;
    const currentPercentage = currentHeight / window.innerHeight;
    
    // Find nearest snap point considering velocity
    let nearestIndex = 0;
    let minDistance = Math.abs(snapPoints[0] - currentPercentage);
    
    for (let i = 1; i < snapPoints.length; i++) {
      const distance = Math.abs(snapPoints[i] - currentPercentage);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }
    
    // Adjust for velocity
    if (Math.abs(velocity) > 500) {
      if (velocity > 0 && nearestIndex < snapPoints.length - 1) {
        nearestIndex += 1;
      } else if (velocity < 0 && nearestIndex > 0) {
        nearestIndex -= 1;
      }
    }
    
    return nearestIndex;
  }, [snapPoints]);
  
  const bind = useDrag(
    ({ last, velocity: [, vy], direction: [, dy], movement: [, my], cancel }) => {
      if (my < -70) cancel();
      
      if (last) {
        const newSnapPoint = findNearestSnapPoint(
          window.innerHeight - my - snapHeights[currentSnapPoint],
          vy
        );
        
        setCurrentSnapPoint(newSnapPoint);
        api.start({
          y: snapHeights[newSnapPoint],
          immediate: false
        });
        
        if (newSnapPoint === snapPoints.length - 1 && !isOpen) {
          onOpenChange(true);
        }
      } else {
        api.start({
          y: snapHeights[currentSnapPoint] + my,
          immediate: true
        });
      }
    },
    {
      from: () => [0, y.get()],
      bounds: { top: snapHeights[snapPoints.length - 1], bottom: window.innerHeight },
      rubberband: true
    }
  );
  
  useEffect(() => {
    if (isOpen) {
      api.start({ y: snapHeights[currentSnapPoint] });
    } else {
      api.start({ y: window.innerHeight });
    }
  }, [isOpen, currentSnapPoint, api, snapHeights]);
  
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => onOpenChange(false)}
        />
      )}
      
      {/* Bottom Sheet */}
      <animated.div
        ref={containerRef}
        {...bind()}
        style={{
          y,
          position: 'fixed',
          left: 0,
          right: 0,
          height: '100vh',
          zIndex: 50,
          touchAction: 'none'
        }}
        className={`bg-white rounded-t-xl shadow-2xl ${className}`}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>
        
        {/* Content */}
        <div className="px-4 pb-safe-area-inset-bottom overflow-hidden">
          <div className="h-full overflow-y-auto">
            {children}
          </div>
        </div>
      </animated.div>
    </>
  );
};
```

### Enhanced Responsive Controls:

```typescript
// Update to /src/app/sitesketcher/components/ResponsiveControls.tsx
export function ResponsiveControls({ ...props, isMobile, snapPoint }: ResponsiveControlsProps) {
  // Mobile-specific rendering based on snap point
  const renderMobileContent = () => {
    switch(snapPoint) {
      case 0: // Collapsed
        return (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">
                {polygons.length} polygon{polygons.length !== 1 ? 's' : ''}
              </span>
              {measurement && (
                <span className="text-xs text-gray-500">
                  {formatArea(
                    measurementUnit === 'metric' ? measurement.squareMeters : measurement.squareFeet,
                    measurementUnit
                  )}
                </span>
              )}
            </div>
            <ModeToggleButton />
          </div>
        );
      
      case 1: // Half expanded
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Controls</h3>
              <ModeToggleButton />
            </div>
            <QuickMeasurements />
          </div>
        );
      
      case 2: // Fully expanded
        return <FullControlPanel />;
      
      default:
        return <FullControlPanel />;
    }
  };
  
  if (isMobile) {
    return renderMobileContent();
  }
  
  return <DesktopLayout />;
}
```

## Conclusion

This specification provides a comprehensive roadmap for implementing mobile UX improvements to the SiteSketcher tool. The phased approach ensures critical functionality is delivered first, while the detailed code examples and technical requirements provide clear implementation guidance.

Key success metrics:
- Touch target compliance: 100% of interactive elements ≥ 44px
- Gesture recognition accuracy: ≥ 95%
- Bottom sheet performance: 60fps during interactions
- Accessibility: WCAG 2.1 AA compliance
- Cross-device compatibility: Support for iOS 15+, Android 11+

The implementation should prioritize user experience while maintaining the existing functionality and ensuring backwards compatibility with desktop usage patterns.