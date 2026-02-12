# 🦅 Squad Project Plan

## 🗺️ Master Roadmap
1.  **Framework Upgrade (v0.4.0 Baseline)**
    *   [x] **Establish Baseline**: Version bump & cleanup.
    *   [ ] **Next Feature**: [To Be Defined by User]

## 🚀 Current Trajectory
**Objective**: Clean slate for new feature cycle.
**Focus**: Definition & Architecture.

## 🦅 Squad Workflow Protocol
Detailed technical workflow is defined in [WORKFLOW.md](./WORKFLOW.md).

1.  **🕵️‍♂️ Pro User Usage**: exploration & "feel" check.
2.  **📝 Auditor**: Risk definition & report.
3.  **⚙️ Engine/Core**: Stabilization & Logic fixes.
4.  **🎨 Frontend**: UX Polish & "Habit" preservation.

## 🟢 Squad Status
| Role | Agent | Status |
| :--- | :--- | :--- |
| **Pro User** | Antigravity | **Waiting** |
| **Auditor** | Antigravity | **Waiting** |
| **Engine** | Antigravity | **Waiting** |
| **Frontend** | Antigravity | **Waiting** |

## 📜 Engineering Log (elog)

### [2026-02-07] Graph Editor Stabilization Cycle
**Summary**: Resolved critical usability issues in the Graph Editor preventing professional use.

#### 1. Value Graph Handles Fix
- **Issue**: Bezier handles were invisible in "Value" mode.
- **Root Cause**:
    1.  Strict interpolation checks ignored implicit/default bezier curves.
    2.  Variable scope collision (`outHandleScreenY` declared twice) caused render failures.
- **Fix**:
    - Implemented dedicated Value Mode render block.
    - Relaxed curve detection logic.
    - Renamed variables to avoid collisions.
- **Result**: Handles are visible and interactive.

#### 2. Toolbar Interaction Fix
- **Issue**: "Speed", "Value", and "Presets" buttons were unclickable.
- **Root Cause**: Parent `TimelinePanel` captured all pointer events for marquee selection, blocking children.
- **Fix**: Added `data-nomarquee` to toolbar container; updated parent logic to respect this attribute.
- **Result**: Buttons function correctly.

#### 3. Tangent Modes & Marquee
- **Implemented**: "Smooth" (Continuous) vs "Broken" tangent modes.
- **Implemented**: Marquee selection for keyframes.
- **Implemented**: Numeric inputs for handle influence/value.

### [2026-02-07] Phase 5: Polish & Fixes
**Summary**: Fixed critical Clipboard data loss and standardized Graph Editor UI.

#### 1. Clipboard Interpolation Fix
- **Issue**: Copying keyframes lost Ease/Bezier data (pasted as "Linear").
- **Fix**: Updated `CopiedKeyframe` schema and `PASTE_OBJECTS` reducer to persist `interpolation`, `tangentMode`, and control points. Refactored `upsertKeyframe` helper.
- **Result**: Keyframe copy/paste now preserves all animation data 1:1.

#### 2. Graph Editor Component Standard
- **Issue**: Toolbar used raw HTML buttons/inputs, inconsistent with Design System.
- **Fix**: Refactored `GraphEditorPanel` to use `Button`, `Input`, and `Popover` from `@/components/ui`.
- **Result**: Consistent "Pro Motion" aesthetic.
