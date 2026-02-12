# 🏗️ Architecture Design: Anime.js Integration Strategy (The Easing Sampler Bridge)

**Date:** 2026-02-12
**Status:** Approved for Future Implementation
**Context:** Need to support complex easings (Elastic, Bounce, Spring) that are not possible with standard Cubic Bezier points (`x1, y1, x2, y2`), while maintaining 0-dependency runtime performance.

---

## 🚀 The Problem

The current animation engine is built on **CSS/Web Animations API standard**, which relies on `cubic-bezier(x1, y1, x2, y2)`.
- **Pros:** Lightweight, GPU accelerated, native.
- **Cons:** Cannot represent algorithmic curves like **Elastic**, **Bounce**, or **Spring** because these require multiple segments or math functions, not just two control points.

## 💡 The Solution: Adapter + Sampling Pattern

Instead of importing the heavy `anime.js` library into the final player/runtime, we will use it **only as a calculator** to generate a standard CSS `linear()` function.

### 1. The Concept
The "Sampler Bridge" will:
1.  Take a complex easing request (e.g., `elasticOut(1, 0.5)`).
2.  Run the Anime.js math function **once** to calculate value at $t=0, 0.01, 0.02... 1.0$.
3.  Generate a standard CSS string: `linear(0, 0.05, 0.15 10%, 1.2 50%, 0.9 70%, 1 100%)`.
4.  Save this string in the `EasingPreset`.

### 2. Implementation Plan

#### A. Data Structure Update
Extend `EasingPreset` type in `src/lib/easing-presets.ts`:

```typescript
export interface EasingPreset {
    id: string;
    // ...
    type: 'cubic-bezier' | 'linear-function'; // New capability
    
    // Existing (for simple curves)
    controlPoints?: { x1: number, y1: number, x2: number, y2: number };
    
    // New (for complex curves)
    linearPoints?: number[]; // Array of values [0, 0.1, 1.2, 0.9, 1...]
}
```

#### B. The Adapter Module (`src/lib/adapters/animejs-sampler.ts`)

```typescript
import anime from 'animejs'; // Dev dependency only!

export function sampleComplexEasing(easingName: string, steps = 50): number[] {
    const points: number[] = [];
    const dummyObj = { t: 0 };
    
    // Create a dummy animation to "record" the values
    const anim = anime({
        targets: dummyObj,
        t: 1,
        duration: 1000,
        easing: easingName,
        autoplay: false
    });

    for (let i = 0; i <= steps; i++) {
        const time = i / steps; // 0 to 1
        anim.seek(anim.duration * time);
        points.push(dummyObj.t);
    }
    
    return points;
}

export function generateLinearString(points: number[]): string {
    // Optimizable: Remove redundant collinear points
    return `linear(${points.map(p => p.toFixed(4)).join(', ')})`;
}
```

### 3. Benefits of this Architecture

1.  **Zero Runtime Weight:** The final player does NOT need `anime.js`. It just reads a string `linear(...)` which browsers render natively.
2.  **Universal Compatibility:** Works with Web Animations API (WAAPI) and standard CSS `animation-timing-function`.
3.  **Future Proof:** We can swap `anime.js` for any other math library (GSAP, Motion One) to generate the points without changing the engine.

---

## 📚 References
- [MDN: linear() easing function](https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timing-function/linear)
- [Linear Easing Generator](https://linear-easing-generator.netlify.app/)
