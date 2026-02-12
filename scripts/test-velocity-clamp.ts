
import { solveBezierT, cubicBezierDerivativeOneAxis } from '../src/lib/anim/math-core';

console.log("Testing CLAMPED velocity stability...");

const x1 = 0.8, y1 = 0.0;
const x2 = 0.2, y2 = 1.0;

// We suspect dx is very small.
const EPSILON = 0.0001;

for (let i = 0; i <= 20; i++) {
    const xProgress = i / 20;
    const t = solveBezierT(x1, x2, xProgress);

    const dx = cubicBezierDerivativeOneAxis(t, x1, x2);
    const dy = cubicBezierDerivativeOneAxis(t, y1, y2);

    // Original Logic
    const velOriginal = dx === 0 ? 0 : dy / dx;

    // Clamped Logic
    const dxClamped = Math.abs(dx) < EPSILON ? (dx >= 0 ? EPSILON : -EPSILON) : dx;
    const velClamped = dy / dxClamped;

    console.log(`t: ${t.toFixed(4)} -> dx: ${dx.toFixed(6)} -> Org: ${velOriginal.toFixed(2)} | Clamped: ${velClamped.toFixed(2)}`);
}
