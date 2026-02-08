# Professional Animation Runtime: Incremental & Protected Strategy

This document outlines the roadmap to upgrade the Vectoria animation engine to "Professional Grade" while **strictly preserving the stability of the current version**.

## 🛡️ Zero-Regression Strategy (The "Safety Net")

To protect the current working system ("V1"), we will use a **Parallel Runtime Architecture**.

### 1. The "Runtime Adapter" Pattern
Instead of modifying the existing `runtime.ts` directly, we will create a router:
```typescript
function getValueAtTime(...) {
  if (featureFlags.enableProRuntime && object.useAdvancedMath) {
    return advancedRuntime.getValue(...); // New Logic
  }
  return legacyRuntime.getValue(...); // Current (Protected) Logic
}
```
**Benefit**: The current code remains 100% untouched and active by default. New features are "Opt-In" per object or per project.

### 2. Snapshot Testing
Before writing new code, we will record the output of the current engine for complex animations.
- **Rule**: Any build that changes the numeric output of existing standard animations by >0.0001 is rejected.

---

## 📈 Incremental Implementation Roadmap

### Phase 0: Protection & Isolation (Current Priority)
**Goal**: Lock in current behavior.
- [ ] Refactor current `getValueAtTime` into `legacy-runtime.ts`.
- [ ] Create `runtime-dispatcher.ts` that defaults to Legacy.
- [ ] **Deliverable**: No visible change, but architecture is ready for extension.

### Phase 1: The "Cubic Bezier" Extension
**Goal**: Add custom curves without breaking Linear/Ease.
- [ ] Add `bezier` to the `InterpolationType` union type (TypeScript).
- [ ] In `runtime-dispatcher.ts`:
  - If `interpolation === 'bezier'`, function call `solveCubicBezier(t)`.
  - Else, pass to `legacy-runtime.ts`.
- **Protection**: Old keyframes (Linear/Hold/Ease) never hit the new code path.

### Phase 2: Spatial Paths (Opt-in)
**Goal**: Curved motion paths.
- [ ] Add `isSpatial: boolean` flag to Motion Paths.
- [ ] If false (default), use current X/Y interpolation.
- [ ] If true, use new `getPointAtLength` logic.

### Phase 3: The Matrix Core (Deep Architecture)
**Goal**: Fixing parenting transforms.
- [ ] Create a separate `TransformMatrix` class.
- [ ] Keep using simple `x + parent.x` for existing projects.
- [ ] Use Matrix math **only** for new projects with "Pro Mode" enabled.

---

## 🏗️ Technical Specifications for New Modules

### 1. `math-core.ts`
Pure functions only, no side effects.
- `solveCubic(p1, p2, t)`
- `mixColor(c1, c2, t)`

### 2. `property-registry.ts`
Defines how to interpolate specific types, allowing us to add new types (like 'Path' or 'Color') without touching the main loop.
```typescript
const interpolators = {
  number: interpolateNumber,
  color: interpolateColor, // New
  path: interpolatePath,   // New
};
```

## Summary for Developers
1. **Never delete old logic.** Move it to `legacy-runtime.ts`.
2. **New features must be strictly opt-in** via flags or new property types.
3. **If in doubt, fallback to V1 behavior.**
