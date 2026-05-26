# SiteSketcher v2 - Quick Start Guide

**For developers joining the project**

---

## 🚀 Get Started in 5 Minutes

### 1. Prerequisites

```bash
# Ensure you have the Mapbox token
echo $NEXT_PUBLIC_MAPBOX_TOKEN

# Install dependencies (Zustand already in package.json)
npm install
```

### 2. Run the App

```bash
npm run dev
```

Navigate to: `http://localhost:3000/sitesketcher-v2`

### 3. Test the Core Features

**Draw a Polygon:**
1. Click the "Polygon" tool button (square icon) or press `P`
2. Select a color from the palette
3. Click on the map to place points (auto-snaps to 90°)
4. Double-click to finish

**Edit Properties:**
1. Click the polygon to select it
2. Right panel opens with properties
3. Change name, color, height
4. Toggle 3D view to see height extrusion

**Save (Pro users only):**
1. Click "Save" button in top-right
2. Enter sketch name when prompted
3. Click "Saved" in bottom rail to see all sketches

---

## 📁 Key Files to Know

### Entry Point
```
apps/web/src/app/sitesketcher-v2/page.tsx
```

### State Management
```
apps/web/src/lib/sitesketcher-v2/state-manager.ts
```
- Zustand store
- All CRUD operations
- Undo/redo logic
- Sketch metadata

### Type Definitions
```
apps/web/src/types/sitesketcher-v2.ts
```
- Polygon, ParkingBlock, CadImage interfaces
- Tool, MapStyle, Units types

### Map Integration
```
apps/web/src/lib/sitesketcher-v2/mapbox-integration.ts
apps/web/src/lib/sitesketcher-v2/PolygonMode.ts
```
- Mapbox GL JS setup
- Custom Draw mode with 90° snap
- 3D layer sync

### API Routes
```
apps/web/src/app/api/sitesketcher-v2/sketches/route.ts
apps/web/src/app/api/sitesketcher-v2/sketches/[id]/route.ts
```
- CRUD operations
- Tier enforcement
- Pro access checks

---

## 🧩 Component Architecture

```
sitesketcher-v2/
├── page.tsx (Main route)
├── unsupported/page.tsx (Mobile gate)
└── components/
    ├── primitives/ (7 components)
    │   ├── Button.tsx
    │   ├── Input.tsx
    │   ├── Toggle.tsx
    │   └── ...
    ├── shell/ (6 components)
    │   ├── TopBar.tsx (Save button, undo/redo)
    │   ├── LeftRail.tsx (Tool buttons)
    │   ├── LeftPanel.tsx (Tool panels container)
    │   ├── RightInspector.tsx (Property editor)
    │   ├── StatusBar.tsx (Object counts)
    │   └── FloatingMapControls.tsx (2D/3D, units)
    ├── map/
    │   └── MapCanvas.tsx (Mapbox + Draw)
    ├── tools/
    │   └── PolygonToolPanel.tsx (Color picker)
    ├── inspectors/
    │   └── PolygonInspector.tsx (Edit properties)
    └── panels/
        ├── LayersPanel.tsx (List all polygons)
        └── SavedSketchesPanel.tsx (Load/delete sketches)
```

---

## 🎨 Design Tokens

Located in: `apps/web/src/styles/sitesketcher-v2-tokens.css`

**Colors:**
- `--sm-bg`: #FAF7F2 (cream background)
- `--sm-surface`: #FFFFFF (panels)
- `--sm-ink`: #1A1A1A (text)
- `--sm-violet`: #7033FF (primary)
- `--sm-border`: #E8E4DC (borders)

**Polygon Colors (6):**
- Violet, Teal, Amber, Crimson, Emerald, Slate

**Typography:**
- Sans: Inter
- Mono: JetBrains Mono

---

## 🔧 Common Tasks

### Add a New Tool

1. **Add tool type:**
```typescript
// types/sitesketcher-v2.ts
export type Tool = 'select' | 'polygon' | 'parking' | 'YOUR_TOOL';
```

2. **Add button to LeftRail:**
```typescript
// components/shell/LeftRail.tsx
{ id: 'YOUR_TOOL', icon: YourIcon, label: 'Your Tool', shortcut: 'Y' }
```

3. **Create tool panel:**
```typescript
// components/tools/YourToolPanel.tsx
export function YourToolPanel() { /* ... */ }
```

4. **Wire up in LeftPanel:**
```typescript
// components/shell/LeftPanel.tsx
case 'YOUR_TOOL':
  return <YourToolPanel />;
```

### Add a New Property to Polygons

1. **Update type:**
```typescript
// types/sitesketcher-v2.ts
export interface Polygon {
  // ...existing
  yourNewProperty: string;
}
```

2. **Update state manager:**
```typescript
// lib/sitesketcher-v2/state-manager.ts
addPolygon: (polygon) => {
  // Ensure new property has default
}
```

3. **Update inspector:**
```typescript
// components/inspectors/PolygonInspector.tsx
<Input
  value={polygon.yourNewProperty}
  onChange={(val) => updatePolygon(polygonId, { yourNewProperty: val })}
/>
```

### Add Tier Enforcement

Already implemented! Check:
```typescript
// lib/subscription-utils.ts
export async function hasProAccess(userId: string): Promise<boolean>

// API routes
const isPro = await hasProAccess(user.id);
if (!isPro) {
  return NextResponse.json(
    { error: 'Pro subscription required' },
    { status: 403 }
  );
}
```

---

## 🐛 Debugging Tips

### Map not loading?
```typescript
// Check Mapbox token
console.log(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

// Check browser console for errors
// MapCanvas.tsx has error handling
```

### Polygon not saving?
```typescript
// Check network tab for API responses
// Check user subscription tier in database
// Verify Pro access

// Server logs will show:
// "Pro subscription required to save"
```

### 90° snap not working?
```typescript
// Snap happens in PolygonMode.ts
// Uses screen-space projection:
const snapped = snapTo90Degrees(map, lastPoint, currentPoint);

// Check if map ref is passed correctly
```

### State not persisting?
```typescript
// Check getSketchData() output
const data = useSketchStore.getState().getSketchData();
console.log(data);

// Verify version field is set to 2
```

---

## 🧪 Testing

### Manual Test Checklist

```bash
# Basic drawing
[ ] Click Polygon tool
[ ] Draw polygon (auto-snaps to 90°)
[ ] Double-click to finish
[ ] Polygon appears with name "Plot A"

# Editing
[ ] Click polygon to select
[ ] Edit name in inspector
[ ] Change color
[ ] Adjust height
[ ] Toggle 3D view
[ ] See changes reflected

# Save/Load (Pro)
[ ] Click Save button
[ ] Enter name
[ ] Sketch saved
[ ] Click Saved panel
[ ] See sketch in list
[ ] Click to load
[ ] State restored

# Tier enforcement (Free)
[ ] Draw 2nd polygon
[ ] Click Save
[ ] See error: "Pro subscription required"
```

### Unit Tests (Future)

```typescript
// Example test structure
describe('PolygonUtils', () => {
  it('snaps to nearest 90 degrees', () => {
    const result = snapTo90Degrees(map, [0, 0], [1, 0.5]);
    expect(result[1]).toBe(0); // Snapped to horizontal
  });
});
```

---

## 📚 Resources

**Documentation:**
- `SITESKETCHER_V2_PROGRESS.md` - Full implementation log
- `SITESKETCHER_V2_SUMMARY.md` - Executive summary
- This file - Quick start

**External:**
- [Mapbox GL JS Docs](https://docs.mapbox.com/mapbox-gl-js/)
- [Mapbox Draw Docs](https://github.com/mapbox/mapbox-gl-draw)
- [Zustand Docs](https://docs.pmnd.rs/zustand)
- [Turf.js Docs](https://turfjs.org/)

**Codebase:**
- Existing v1: `apps/web/src/app/sitesketcher/*`
- Subscription system: `apps/web/src/lib/subscription.ts`
- Auth: `apps/web/src/lib/auth.ts`

---

## 💬 Common Questions

**Q: Why screen-space for 90° snap?**
A: Lng/lat is spherical, causing distortion at UK latitudes. Screen-space (pixels) is Cartesian, giving accurate 90° angles.

**Q: Why separate v2 route instead of upgrading v1?**
A: Complete rebuild with different UX. v1 users unaffected. Data isolated via JSONB filtering.

**Q: Why Zustand instead of Redux?**
A: Simpler API, no provider boilerplate, built-in devtools, perfect for single-page app.

**Q: Why not auto-save?**
A: Could be added! Just need debounce logic:
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    if (isDirty && sketchId) {
      handleSave();
    }
  }, 1000);
  return () => clearTimeout(timer);
}, [isDirty, polygons, /* ... */]);
```

**Q: How to add keyboard shortcuts?**
A: Add event listener in main page or shell component:
```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'v') setActiveTool('select');
    if (e.key === 'p') setActiveTool('polygon');
    // ...
  };
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

---

**Need Help?** Check the inline comments in source files - they're extensive!

**Ready to Build?** Start with Phase 4 remaining items or Phase 5 CAD upload!
