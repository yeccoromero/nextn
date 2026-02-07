# Professional UI Plan: The Graph Editor

**Goal**: Implement a "Speed Graph" (Time-Curve Editor) to visualize and edit the Cubic Bezier interpolation enabled in the Runtime.

## 1. Concept: The "Graph Mode"
Instead of trying to squeeze curves into the tiny timeline tracks, we will build a dedicated **Graph Editor Panel**.
- **Toggle**: A button in the Timeline toolbar to switch between "Dope Sheet" (current view) and "Graph Editor".
- **Selection**: The Graph Editor only shows curves for the *currently selected properties*.

## 2. Visualization Logic
We are editing `cubic-bezier(x1, y1, x2, y2)`. This translates to a **Value Graph**:
- **X-Axis**: Time (ms).
- **Y-Axis**: Progression (0% to 100% of the value change).

### Speed Graph vs Value Graph
- **True Speed Graph**: Shows velocity. Complex to implement (requires derivative calculus).
- **Value Graph (Curve)**: Shows the actual bezier curve. This is what After Effects "Value Graph" does and what CSS `cubic-bezier` represents. **We will build this first.**

## 3. UI Components

### A. `GraphTrack`
- Renders the curve using SVG `<path>`.
- The curve is drawn between Keyframe A and Keyframe B.
- Path data `d`: `M 0,0 C cp1.x,cp1.y cp2.x,cp2.y 1,1` (scaled to screen coordinates).

### B. `BezierHandle`
- Interactive SVG circles connected to the keyframe by a line.
- **Left Handle**: `cp1` of the incoming curve (affects entrance).
- **Right Handle**: `cp2` of the outgoing curve (affects exit).

### C. `GraphOverlay`
- An SVG overlay on top of the timeline track area.
- Handles zoom/pan (syncs with Timeline ruler).

## 4. Implementation Logic

### Interaction: Dragging Handles
1.  User clicks a Handle.
2.  `onDrag`:
    - Calculate delta `dx, dy` in pixels.
    - Convert pixels to **Normalized Time/Value (0-1)**.
    - `x` = `(mouseX - keyframeX) / segmentWidth`
    - `y` = `(mouseY - keyframeY) / segmentHeight`
3.  **Constraint**: `x` must be clamped between 0 and 1 (standard Bezier limitation).

### Data Update
- Update `keyframe.controlPoints: { x1, y1, x2, y2 }` in the Reducer.
- The Runtime (Phase 1) automatically picks this up.

## 5. Roadmap

### Phase 1: The "Mini-Editor" (Popover) - **RECOMMENDED START**
Instead of a full timeline replacement, create a **Popover/Dialog** when right-clicking a keyframe -> "Edit Easing".
- **Pros**: Much faster to build. High value immediately.
- **UI**: A fixed 200x200 editor showing just that one segment's curve.
- **Reference**: Similar to Chrome DevTools Easing Editor or Webflow.

### Phase 2: Full Timeline Graph View
- The industry-standard "Toggle View".
- Renders curves directly in the timeline tracks.
- Complex layout changes required.

## 6. Technical Stack
- **SVG** for drawing curves.
- **Radix UI Popover** (if choosing Phase 1).
- **Existing `timeline-panel.tsx`** context for zoom/pan.
