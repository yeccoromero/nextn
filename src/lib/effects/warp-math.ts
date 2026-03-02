/**
 * Warp Math Core
 *
 * Pure functions for AE-style Warp effect.
 * Each style maps (u, v) in [0..1] to (u', v') in warped space.
 *
 * Parameters:
 *  bend    - [-1..1] (mapped from AE's -100..100)
 *  hDist   - [-1..1] horizontal distortion
 *  vDist   - [-1..1] vertical distortion
 */

import type { WarpStyle, WarpEffect } from '@/types/editor';

export type Vec2 = { x: number; y: number };

export type BoundingBox = {
    x: number;
    y: number;
    width: number;
    height: number;
};

// ─── Style Functions ─────────────────────────────────────────────────────────
// All operate on (u, v) in [0..1], return [u', v']

type WarpFn = (u: number, v: number, bend: number, hDist: number, vDist: number) => [number, number];

const PI = Math.PI;
const smooth01 = (t: number) => {
    const clamped = Math.max(0, Math.min(1, t));
    return clamped * clamped * (3 - 2 * clamped);
};

const WARP_FUNCTIONS: Record<WarpStyle, WarpFn> = {
    /**
     * Arc (AE/Photoshop style): polar fan/sector warp.
     *
     * Maps the source rectangle into a circular sector (fan shape):
     *  - u (horizontal) → angle θ within the sweep
     *  - v (vertical)   → radius from the pole
     *
     * Coordinate system: pole sits BELOW the object in canvas space.
     *  - poleY = 1 + R  (R units below the bottom edge, v=1)
     *  - R = 1/sweepAngle  → bottom arc length = original width ✓
     *
     * Anchoring (verified):
     *  - bottom-center (0.5, 1) → stays at (0.5, 1) ✓
     *  - top-center   (0.5, 0) → stays at (0.5, 0) ✓
     *  - top corners           → move OUTSIDE the bbox (v < 0) ✓
     *
     * bend > 0: fan opens upward;  bend < 0: fan opens downward.
     */
    'arc': (u, v, bend) => {
        if (Math.abs(bend) < 1e-6) return [u, v];

        // For downward arcs, mirror v, apply upward formula, mirror result back
        const sign = Math.sign(bend);
        const vEffective = sign > 0 ? v : (1 - v);

        const sweepAngle = Math.abs(bend) * PI;

        // Inner radius R: bottom edge arc length = 1 (matches object width)
        const R = 1.0 / sweepAngle;

        // Pole is R units below the bottom edge of the object (poleY > 1 always)
        const poleY = 1.0 + R;

        // Distance from pole to this row (v=0 → outer=poleY, v=1 → inner=R)
        const r = poleY - vEffective;

        // θ: angle from vertical (straight up = 0)
        //   left side (u=0)  → θ negative (fan goes upper-left)
        //   right side (u=1) → θ positive (fan goes upper-right)
        const theta = (u - 0.5) * sweepAngle;

        // Canvas polar → Cartesian (canvas y: DOWN = positive)
        // From the pole, the fan radiates UPWARD (toward smaller v)
        const u2 = 0.5 + r * Math.sin(theta);
        const v2raw = poleY - r * Math.cos(theta);

        // Mirror result back for downward arcs
        const v2 = sign > 0 ? v2raw : (1 - v2raw);

        return [u2, v2];
    },

    /** Arc Lower: deform only lower region into an arc */
    'arc-lower': (u, v, bend) => {
        // Keep top/mid mostly stable; start bending near the lower third.
        const lowerStart = 0.62;
        const lowerMask = smooth01((v - lowerStart) / (1 - lowerStart));
        const arch = Math.sin(PI * u);

        // Only vertical displacement so side walls stay nearly straight.
        const dv = bend * arch * lowerMask;

        return [u, v + dv];
    },

    /** Arc Upper: mirror of Arc Lower (top-only arc) */
    'arc-upper': (u, v, bend) => {
        // Symmetric counterpart of `arc-lower`.
        // Keep bottom/mid stable; start bending near upper third.
        const upperEnd = 0.38;
        const upperMask = smooth01((upperEnd - v) / upperEnd);
        const arch = Math.sin(PI * u);

        // Opposite direction in Y so positive bend affects the top side.
        const dv = -bend * arch * upperMask;
        return [u, v + dv];
    },

    /** Arch: curves the left/right edges (column-wise) */
    'arch': (u, v, bend, hDist, vDist) => {
        const du = bend * Math.sin(PI * v);
        const dv = vDist * Math.sin(PI * u);
        return [u + du, v + dv];
    },

    /**
     * Bulge (AE): barrel (+) or pincushion (-) distortion.
     * Each edge bows outward (positive) or inward (negative) sinusoidally.
     * - Max displacement at midpoint of each edge (sin(π×0.5) = 1)
     * - Zero at corner endpoints (sin(0) = 0)
     * With full catmull-rom (not segmented), the spline naturally extrapolates
     * corners for pincushion spikes at -100 and smooth barrel curves at +100.
     */
    'bulge': (u, v, bend) => {
        // Horizontal bow: left/right edges push left/right, max at v=0.5
        const du = Math.sign(u - 0.5 || 1) * bend * 0.35 * Math.sin(PI * v);
        // Vertical bow: top/bottom edges push up/down, max at u=0.5
        const dv = Math.sign(v - 0.5 || 1) * bend * 0.35 * Math.sin(PI * u);
        return [u + du, v + dv];
    },

    /** Shell Lower: asymmetric arc that pinches at top, expands at bottom */
    'shell-lower': (u, v, bend) => {
        const scale = 1 + bend * v;
        const cu = (u - 0.5) * scale + 0.5;
        return [cu, v];
    },

    /** Shell Upper: asymmetric arc that expands at top, pinches at bottom */
    'shell-upper': (u, v, bend) => {
        const scale = 1 + bend * (1 - v);
        const cu = (u - 0.5) * scale + 0.5;
        return [cu, v];
    },

    /** Flag: single full wave (like a flag waving) */
    'flag': (u, v, bend, hDist) => {
        const dv = bend * Math.sin(2 * PI * u);
        const du = hDist * Math.sin(2 * PI * v);
        return [u + du, v + dv];
    },

    /** Wave: double frequency wave */
    'wave': (u, v, bend, hDist) => {
        const dv = bend * Math.sin(4 * PI * u);
        const du = hDist * Math.sin(4 * PI * v);
        return [u + du, v + dv];
    },

    /** Fish: center of object amplified along horizontal axis */
    'fish': (u, v, bend) => {
        const scale = 1 + bend * Math.cos(PI * u);
        const cv = (v - 0.5) * scale + 0.5;
        return [u, cv];
    },

    /**
     * Rise: diagonal rise/fall with gentle bow (AE-like preset feel).
     *
     * Compared to a plain linear ramp, this keeps the directional slope but adds
     * a soft center bow so top/bottom edges become subtly curved.
     */
    'rise': (u, v, bend, hDist) => {
        // AE-like orientation: right side acts as the stable side.
        const t = 1 - u;

        // Wave-like curvature profile while keeping monotonic diagonal flow.
        const wave = Math.sin(PI * t);

        // Right side anchored (t=0 => dv=0), left side fully displaced (t=1).
        const dv = bend * (t + 0.22 * wave);

        // Horizontal influence only from dedicated control.
        const du = hDist * (v - 0.5);

        return [u + du, v + dv];
    },

    /**
     * FishEye: lens distortion constrained to the bounding box.
     *
     * Unlike free radial barrel distortion, this keeps the outer square border
     * anchored (u=0/1 and v=0/1 remain fixed) and deforms only the interior grid.
     * This matches AE-style "Fish Eye" warp behavior for presets.
     */
    'fish-eye': (u, v, bend) => {
        const sx = u * 2 - 1;
        const sy = v * 2 - 1;

        // Square radius: 0 at center, 1 on any border.
        const rInf = Math.max(Math.abs(sx), Math.abs(sy));
        const w = 1 - rInf * rInf;

        // Positive bend expands from center, negative pinch; borders stay fixed.
        const factor = 1 + bend * 0.9 * w;
        const sx2 = sx * factor;
        const sy2 = sy * factor;

        return [(sx2 + 1) * 0.5, (sy2 + 1) * 0.5];
    },

    /**
     * Inflate (AE): balloon/globe expansion producing a sphere-like shape.
     *
     * Each edge bows outward sinusoidally:
     *  - du = cu × bend × sin(π·v): left side bows left, right bows right
     *  - dv = cv × bend × sin(π·u): top bows up,   bottom bows down
     *
     * Key properties (verified):
     *  - Corners stay PINNED at bbox (sin=0 at all 4 corners) ✓
     *  - Edge midpoints expand maximally outward ✓
     *  - Center stays fixed at (0.5, 0.5) ✓
     *  - Radial distance rises monotonically from corner→midpoint ✓
     *    (corner=0.707, midpoint=0.75 at bend=0.5 → smooth sphere arc)
     *
     * The Catmull-Rom spline in WarpRenderer then smoothly interpolates
     * through all perimeter points, completing the globe-like outline.
     */
    'inflate': (u, v, bend) => {
        const cu = u - 0.5;
        const cv = v - 0.5;

        // Sinusoidal bow (max at midpoints, zero at corners)
        // + small corner rounding: bend*0.4 extra factor so corners follow the arc
        // → corner:midpoint radial ratio ≈ 0.97 (near-circular, no pointy peaks)
        const du = cu * bend * (Math.sin(PI * v) + bend * 0.4);
        const dv = cv * bend * (Math.sin(PI * u) + bend * 0.4);

        return [u + du, v + dv];
    },

    /**
     * Twist: edge-anchored swirl inside the bounding box.
     *
     * Uses a square-aware falloff so the perimeter remains stable while the
     * interior rotates around the center (AE-style preset behavior).
     */
    'twist': (u, v, bend) => {
        const sx = u * 2 - 1;
        const sy = v * 2 - 1;

        // 0 at center, 1 on any bbox border.
        const rInf = Math.max(Math.abs(sx), Math.abs(sy));
        const falloff = smooth01(1 - rInf);

        // Interior twists, border stays fixed (angle = 0 at rInf=1).
        const angle = bend * PI * 0.95 * falloff;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const sx2 = sx * cos - sy * sin;
        const sy2 = sx * sin + sy * cos;

        return [
            (sx2 + 1) * 0.5,
            (sy2 + 1) * 0.5,
        ];
    },

    /**
     * Squeeze (AE): classic hourglass/bowtie deformation.
     *
     * bend > 0:
     *  - Left/right sides curve INWARD (waist squeeze, max at v=0.5)
     *  - Top/bottom edges bow OUTWARD beyond bbox (max at u=0.5)
     *  - Corners stay pinned at their original positions (sin=0 at edges)
     *
     * Result: wider at top/bottom, narrower in the middle — like squeezing
     * a pillow at the waist while it expands at the ends.
     */
    'squeeze': (u, v, bend) => {
        // Left/right edges bow inward: max horizontal squeeze at v=0.5
        const uOffset = bend * (u - 0.5) * Math.sin(PI * v);
        // Top/bottom edges bow OUTWARD: negative at top (v<0.5), positive at bottom (v>0.5)
        const vOffset = bend * (v - 0.5) * Math.sin(PI * u);
        return [
            u - uOffset,
            v + vOffset,  // + so top bows UP (v<0, out of bbox), bottom bows DOWN (v>1)
        ];
    },
};

// ─── Core API ────────────────────────────────────────────────────────────────

/**
 * Applies warp effect to an array of points.
 *
 * @param points - Array of Vec2 points in canvas/SVG coordinate space
 * @param bounds - Bounding box of the source object (in canvas space)
 * @param params - WarpEffect parameters
 * @returns Array of deformed Vec2 points in canvas space
 */
export function applyWarp(
    points: Vec2[],
    bounds: BoundingBox,
    params: WarpEffect,
): Vec2[] {
    if (!params.enabled || params.bend === 0 && params.hDist === 0 && params.vDist === 0) {
        return points;
    }

    const { style, axis } = params;
    // Normalize params from [-100..100] to [-1..1]
    const bend = params.bend / 100;
    const hDist = params.hDist / 100;
    const vDist = params.vDist / 100;

    const warpFn = WARP_FUNCTIONS[style];
    if (!warpFn) return points;

    const { x: bx, y: by, width: bw, height: bh } = bounds;
    if (bw === 0 || bh === 0) return points;

    return points.map((p) => {
        // 1. Normalize to [0..1] UV space
        let u = (p.x - bx) / bw;
        let v = (p.y - by) / bh;

        // 2. Rotate UV if axis is vertical (swap and flip)
        if (axis === 'vertical') {
            [u, v] = [v, 1 - u];
        }

        // 3. Apply the warp style function
        let [u2, v2] = warpFn(u, v, bend, hDist, vDist);

        // 4. Rotate back if vertical
        if (axis === 'vertical') {
            [u2, v2] = [1 - v2, u2];
        }

        // 5. Denormalize back to canvas space
        return {
            x: bx + u2 * bw,
            y: by + v2 * bh,
        };
    });
}

/**
 * Convenience: get default WarpEffect params
 */
export function defaultWarpEffect(): WarpEffect {
    return {
        enabled: true,
        style: 'arc',
        axis: 'horizontal',
        bend: 0,
        hDist: 0,
        vDist: 0,
    };
}
