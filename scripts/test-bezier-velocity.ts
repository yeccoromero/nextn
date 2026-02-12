
import { solveBezierT, cubicBezierDerivativeOneAxis } from '../src/lib/anim/math-core';

console.log("Testing velocity stability on steep curve...");
// Steep curve: P1(0.9, 0), P2(0.1, 1) - this has very low dx at ends?
// Let's try P1(0.1, 0), P2(0.1, 1) -> extreme acceleration?
// Or P1(1, 0), P2(0, 1) -> Backwards? No, X must be monotonic 0-1 for time.
// Easing: 0.9, 0, 0.1, 1 is a very steep ease-in-out.
// Time goes 0->1.
// x(t) = bezier(t, 0.9, 0.1)
// dx/dt at t=0.5: 
// x(0.5) = 0.5.
// dx/dt = 3*(1-t)^2*(x1-x0) + 6*(1-t)*t*(x2-x1) + 3*t^2*(x3-x2)
// x0=0, x1=0.9, x2=0.1, x3=1
// this curve has "slow-fast-slow" time progression?
// x1=0.9 means it stays near 0 for a long t, then rushes to 1.
// This means LOW dx/dt at middle? No.
// Let's use the ease from the screenshot 0.16, 1, 0.3, 1 (approx from visual)

const x1 = 0.8, y1 = 0.0;
const x2 = 0.2, y2 = 1.0;
// This is a steep ease-in-out.

for (let i = 0; i <= 20; i++) {
    const xProgress = i / 20; // Time on timeline

    // 1. Solve for t
    const t = solveBezierT(x1, x2, xProgress);

    // 2. Calculate derivatives
    const dx = cubicBezierDerivativeOneAxis(t, x1, x2);
    const dy = cubicBezierDerivativeOneAxis(t, y1, y2);

    // 3. Vel
    const vel = dx === 0 ? 0 : dy / dx;

    console.log(`Time: ${xProgress.toFixed(2)} -> t: ${t.toFixed(4)} -> dx: ${dx.toFixed(4)} -> dy: ${dy.toFixed(4)} -> Vel: ${vel.toFixed(4)}`);
}
