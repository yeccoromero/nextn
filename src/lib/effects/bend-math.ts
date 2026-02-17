/**
 * Bend It — Math Core
 * 
 * Pure math functions for CC Bend It arc deformation.
 * Uses circular arc model: Start→End defines axis, Bend (θ) defines curvature.
 * 
 * CSS Bezier reference (ease defaults):
 *   ease:     (0.25, 0.1, 0.25, 1.0)
 *   ease-in:  (0.42, 0, 1.0, 1.0)
 *   ease-out: (0, 0, 0.58, 1.0)
 */

export type Vec2 = { x: number; y: number };

export type BendParams = {
    start: Vec2;
    end: Vec2;
    /** Bend angle in radians. Positive = one direction, negative = opposite. */
    theta: number;
    /** What to render before Start point */
    prestart: 'none' | 'static' | 'bend' | 'mirror';
    /** What to render after End point */
    postEnd: 'legal' | 'extended';
};

const EPS = 1e-6;

/** Perpendicular (90° CCW rotation) */
function perp(v: Vec2): Vec2 {
    return { x: -v.y, y: v.x };
}

function dot(a: Vec2, b: Vec2): number {
    return a.x * b.x + a.y * b.y;
}

function sub(a: Vec2, b: Vec2): Vec2 {
    return { x: a.x - b.x, y: a.y - b.y };
}

function add(a: Vec2, b: Vec2): Vec2 {
    return { x: a.x + b.x, y: a.y + b.y };
}

function scale(v: Vec2, s: number): Vec2 {
    return { x: v.x * s, y: v.y * s };
}

function length(v: Vec2): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
}

function normalize(v: Vec2): Vec2 {
    const len = length(v);
    if (len < EPS) return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
}

/**
 * Forward bend: maps a point P from source space to bent space.
 * 
 * Model:
 *   d = End - Start, L = |d|, t = d/L (tangent), n = perp(t) (normal)
 *   u = dot(P - Start, t)  → distance along axis
 *   v = dot(P - Start, n)  → perpendicular offset
 *   R = L / θ              → arc radius
 *   φ = (u / L) · θ        → local angle on arc
 *   base(u) = S + t·(R·sin φ) + n·(R·(1 - cos φ))
 *   n'(φ) = (-sin φ)·t + (cos φ)·n
 *   P' = base(u) + v·n'(φ)
 */
export function bendPoint(P: Vec2, params: BendParams): Vec2 | null {
    const { start: S, end: E, theta, prestart, postEnd } = params;

    const d = sub(E, S);
    const L = length(d);
    if (L < EPS) return P; // Degenerate axis

    const t = normalize(d);
    const n = perp(t);

    const PS = sub(P, S);
    let u = dot(PS, t);
    const v = dot(PS, n);

    // --- Region handling ---
    // Before Start
    if (u < 0) {
        switch (prestart) {
            case 'none': return null;        // Don't render
            case 'static': return P;         // No deformation
            case 'mirror': u = -u; break;    // Reflect into bent region
            case 'bend': break;              // Continue bending (allow negative u)
        }
    }

    // After End
    if (u > L) {
        switch (postEnd) {
            case 'legal': return null;       // Don't render
            case 'extended': break;          // Continue
        }
    }

    // Near-zero bend → no deformation
    if (Math.abs(theta) < EPS) return P;

    const R = L / theta;
    const phi = (u / L) * theta;

    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    // Base point on arc
    const base = add(
        S,
        add(
            scale(t, R * sinPhi),
            scale(n, R * (1 - cosPhi))
        )
    );

    // Rotated normal (perpendicular to tangent at φ)
    const nPrime: Vec2 = {
        x: -sinPhi * t.x + cosPhi * n.x,
        y: -sinPhi * t.y + cosPhi * n.y,
    };

    // Final bent point
    return add(base, scale(nPrime, v));
}

/**
 * Inverse bend: maps a point from bent space back to source space.
 * Used by the shader (dest→src mapping) to avoid holes in the output.
 * 
 * The inverse is computed by applying the bend with negated theta.
 * This is an approximation that works well for most bend values.
 */
export function inverseBend(P: Vec2, params: BendParams): Vec2 | null {
    return bendPoint(P, {
        ...params,
        theta: -params.theta,
    });
}

/**
 * Converts degrees to radians.
 */
export function degToRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

/**
 * Converts radians to degrees.
 */
export function radToDeg(radians: number): number {
    return (radians * 180) / Math.PI;
}

/**
 * Validates that bend parameters are numerically safe.
 * Returns true if parameters are valid for rendering.
 */
export function isBendValid(params: BendParams): boolean {
    const d = sub(params.end, params.start);
    const L = length(d);
    return L > EPS && isFinite(params.theta);
}

/**
 * Computes the bounding box of the bent region for viewport fitting.
 * Samples points along the bend arc to approximate bounds.
 */
export function getBendBounds(
    sourceWidth: number,
    sourceHeight: number,
    params: BendParams,
    samples = 64
): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    // Sample corners and edge points
    for (let i = 0; i <= samples; i++) {
        const u = (i / samples) * sourceWidth;
        for (const vOffset of [0, sourceHeight]) {
            const P: Vec2 = { x: u, y: vOffset };
            const bent = bendPoint(P, params);
            if (bent) {
                minX = Math.min(minX, bent.x);
                minY = Math.min(minY, bent.y);
                maxX = Math.max(maxX, bent.x);
                maxY = Math.max(maxY, bent.y);
            }
        }
    }

    return { minX, minY, maxX, maxY };
}
