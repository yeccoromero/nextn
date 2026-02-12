
import { solveBezierT, cubicBezierOneAxis, cubicBezierDerivativeOneAxis } from '../src/lib/anim/math-core';

console.log("Testing solveBezierT precision on steep curve...");
// Steep curve example: P1(0.9, 0), P2(0.1, 1) - fast acceleration then deceleration?
// Or ease-in-out: 0.42, 0, 0.58, 1

const x1 = 0.9, y1 = 0.0;
const x2 = 0.1, y2 = 1.0;

// Test at t=0.5 (should be x=0.5 for symmetric curve)
const tTarget = 0.5;
const xTarget = cubicBezierOneAxis(tTarget, x1, x2);
const solvedT = solveBezierT(x1, x2, xTarget);

console.log(`Target T: ${tTarget}`);
console.log(`Calculated X at T: ${xTarget}`);
console.log(`Solved T from X: ${solvedT}`);
console.log(`Error: ${Math.abs(solvedT - tTarget)}`);

// Test random points
for (let i = 0; i < 5; i++) {
    const t = Math.random();
    const x = cubicBezierOneAxis(t, x1, x2);
    const sT = solveBezierT(x1, x2, x);
    const err = Math.abs(sT - t);
    console.log(`T: ${t.toFixed(4)} -> X: ${x.toFixed(4)} -> Solved T: ${sT.toFixed(4)} (Err: ${err.toExponential(4)})`);
}
