export type Point = { x: number; y: number };

// Cubic Bezier Solver
// Based on typical implementations (like WebKit/Blink or libraries like bezier-easing)
// Solves x(t) = target_x for t, then returns y(t).
// Since animation progress is time (x-axis), we need y (value progression) given x (time progression).

const NEWTON_ITERATIONS = 4;
const NEWTON_MIN_SLOPE = 0.001;
const SUBDIVISION_PRECISION = 0.0000001;
const SUBDIVISION_MAX_ITERATIONS = 10;

function A(aA1: number, aA2: number) { return 1.0 - 3.0 * aA2 + 3.0 * aA1; }
function B(aA1: number, aA2: number) { return 3.0 * aA2 - 6.0 * aA1; }
function C(aA1: number) { return 3.0 * aA1; }

// Returns x(t) given t, x1, and x2, or y(t) given t, y1, and y2.
function calcBezier(aT: number, aA1: number, aA2: number) {
    return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT;
}

// Returns dx/dt given t, x1, and x2, or dy/dt given t, y1, and y2.
function getSlope(aT: number, aA1: number, aA2: number) {
    return 3.0 * A(aA1, aA2) * aT * aT + 2.0 * B(aA1, aA2) * aT + C(aA1);
}

function binarySubdivide(aX: number, aA: number, aB: number, mX1: number, mX2: number) {
    let currentX, currentT, i = 0;
    do {
        currentT = aA + (aB - aA) / 2.0;
        currentX = calcBezier(currentT, mX1, mX2) - aX;
        if (currentX > 0.0) {
            aB = currentT;
        } else {
            aA = currentT;
        }
    } while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);
    return currentT;
}

function newtonRaphsonIterate(aX: number, aGuessT: number, mX1: number, mX2: number) {
    for (let i = 0; i < NEWTON_ITERATIONS; ++i) {
        const currentSlope = getSlope(aGuessT, mX1, mX2);
        if (currentSlope === 0.0) {
            return aGuessT;
        }
        const currentX = calcBezier(aGuessT, mX1, mX2) - aX;
        aGuessT -= currentX / currentSlope;
    }
    return aGuessT;
}

/**
 * Solves a cubic bezier curve for x (time) to find y (value progression).
 * @param x1 Control Point 1 X (0-1)
 * @param y1 Control Point 1 Y
 * @param x2 Control Point 2 X (0-1)
 * @param y2 Control Point 2 Y
 * @param t Current time progress (0-1)
 */
/**
 * Solves for parametric time t given x on a cubic bezier (0,0) to (1,1).
 * @param x1 Control Point 1 X
 * @param x2 Control Point 2 X
 * @param x Target X position (0-1)
 */
export function solveBezierT(x1: number, x2: number, x: number): number {
    if (x === 0 || x === 1) return x;

    // Linear case optimization
    if (x1 === x && x2 === x) return x;

    // Newton-Raphson iteration
    const slope = getSlope(x, x1, x2);
    if (slope >= NEWTON_MIN_SLOPE) {
        return newtonRaphsonIterate(x, x, x1, x2); // Initial guess = x
    } else if (slope === 0.0) {
        return x;
    } else {
        return binarySubdivide(x, 0.0, 1.0, x1, x2);
    }
}

/**
 * Solves a cubic bezier curve for x (time) to find y (value progression).
 * @param x1 Control Point 1 X (0-1)
 * @param y1 Control Point 1 Y
 * @param x2 Control Point 2 X (0-1)
 * @param y2 Control Point 2 Y
 * @param t Current time progress (0-1)
 */
export function solveCubicBezier(x1: number, y1: number, x2: number, y2: number, t: number): number {
    if (x1 === y1 && x2 === y2) return t; // Linear optimization
    if (t === 0 || t === 1) return t;

    const solvedT = solveBezierT(x1, x2, t);
    return calcBezier(solvedT, y1, y2);
}

/**
 * Solves a spatial Cubic Bezier at parametric time t.
 * Returns the {x, y} coordinate on the curve.
 * P0 = Start Point
 * P1 = Control Point 1 (Start + TangentOut)
 * P2 = Control Point 2 (End + TangentIn)
 * P3 = End Point
 */
export function solveSpatialCubic(
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
    t: number
): Point {
    // B(t) = (1-t)^3*P0 + 3*(1-t)^2*t*P1 + 3*(1-t)*t^2*P2 + t^3*P3
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    const a = mt3;
    const b = 3 * mt2 * t;
    const c = 3 * mt * t2;
    const d = t3;

    return {
        x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
        y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    };
}

/**
 * Returns the value of a 1D cubic Bezier at time t (0-1).
 * @param t Time t (0-1)
 * @param c1 Control point 1 value (e.g. x1 or y1)
 * @param c2 Control point 2 value (e.g. x2 or y2)
 */
export function cubicBezierOneAxis(t: number, c1: number, c2: number): number {
    return calcBezier(t, c1, c2);
}

/**
 * Returns the derivative (slope) of a 1D cubic Bezier at time t (0-1).
 * @param t Time t (0-1)
 * @param c1 Control point 1 value
 * @param c2 Control point 2 value
 */
export function cubicBezierDerivativeOneAxis(t: number, c1: number, c2: number): number {
    return getSlope(t, c1, c2);
}
