# Vectoria Engineering Constitution & Development Rules

This document establishes the architectural standards, coding patterns, and "critical safety rules" for the Vectoria application. All developers and agents contributing to this codebase must adhere to these guidelines to preserve system stability and integrity.

## 1. Core Architecture & Tech Stack

- **Framework**: Next.js 14+ (App Router). Maintain separation between Server Components and Client Components (`'use client'`).
- **Language**: TypeScript. No `any` types unless absolutely unavoidable for external library interop. Strict null checks are enabled.
- **Styling**: Tailwind CSS. Do not use inline styles for static properties. Use `cn()` utility for class merging.
- **State Management**: React Context (`EditorContext`) with `useReducer` and `Immer` for immutable state updates.
- **Icons**: Lucide React.

## 2. State Management (EditorContext)

### 🚩 Reducer Integrity
- **Immer Usage**: All reducer actions must use `produce` (Immer) to ensure immutability.
- **Action Granularity**: Actions should be granular (`UPDATE_OBJECTS`, `ADD_LAYER`) rather than monolithic "SET_STATE" calls.
- **Patching**: For high-frequency updates (like animation playback), use the Patch system (`OBJECTS/UPDATE_FROM_ANIMATION`) to minimize React render cycles.

### 🚩 Copy/Paste & Data Integrity
**Rule: Exact Fidelity**
- **No Magic Offsets**: When cloning, duplicating, or pasting objects, **NEVER** apply automatic coordinate offsets (e.g., `x + 10`) unless explicitly requested by a "Duplicate" command. Copy/Paste must be exact overlay.
- **Keyframe Preservation**: Copied animated objects must retain all keyframe values exactly relative to their start time.

## 3. UI/UX & Interaction Patterns

### 🚩 Overlays & Context Menus
**Rule: Escape the Stack**
- Do **NOT** rely on standard `position: fixed` or `z-index` for menus/modals nested inside the Editor or Timeline.
- **ALWAYS** use **React Portals** (`createPortal(..., document.body)`) for:
  - Context Menus
  - Tooltips
  - Draggable floating panels
- This prevents clipping by parent containers using `backdrop-filter`, `transform`, or `overflow: hidden`.

### 🚩 Pointer Events & Interactions
**Rule: Strict Intent**
- **Explicit Button Checks**: Handlers for destructive or selection actions (Marquee, Drag) MUST check `e.button === 0` (Left Click).
- **Event Bubbling**: Use `e.stopPropagation()` judiciously. For custom Context Menus, implement manual bubbling if needed, or render at the root.

### 🚩 Context Menus
- **Implementation**: Prefer custom, manual implementations over library-based triggers (like Radix `ContextMenuTrigger`) for complex, high-frequency elements like Keyframes or Timeline Tracks. This provides granular control avoiding phantom triggers.

## 4. Animation Engine

### 🚩 Interpolation Logic
**Rule: Trust the Property**
- The runtime engine must handle `interpolation` types explicitely:
  - **Hold**: Step function (value changes only at next keyframe).
  - **Linear**: Constant rate of change.
  - **Ease**: Acceleration/Deceleration (Quad/Cubic).
- Do not default to 'Ease' blindly. Respect the data.

## 5. File Structure & Naming

- **Components**: PascalCase (e.g., `TimelinePanel.tsx`).
- **Hooks**: camelCase with use prefix (e.g., `useEditor.ts`).
- **Utilities**: camelCase (e.g., `geometryUtils.ts`).
- **Colocation**: Keep related sub-components close to their parent feature folder (e.g., `src/components/timeline/`).

## 6. Performance "Golden Rules"

1.  **Hydration**: Use `suppressHydrationWarning` on `<html>` or `<body>` if using aggressive local storage hydration.
2.  **Render Loops**: Avoid `useEffect` for animation loops. Use `requestAnimationFrame` managed centrally or via a dedicated hook.
3.  **Selector Optimization**: When consuming `EditorContext`, select only the necessary slice of state if possible (or memoize components heavily).

---
**Verification Protocol**: Before marking a task complete, verify that:
1.  No new console errors are introduced.
2.  Copy/Paste preserves exact coordinates.
3.  Right-click menus appear above all other UI.
