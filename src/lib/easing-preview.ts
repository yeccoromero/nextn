/**
 * Easing Preview Generator
 * Generates SVG paths for visualizing easing curves
 */

import { EasingPreset, getCategoryColor } from './easing-presets';

/**
 * Generate an SVG path string for a cubic bezier curve
 * The path goes from bottom-left (0,size) to top-right (size,0)
 */
export function generateEasingSVGPath(
    controlPoints: { x1: number; y1: number; x2: number; y2: number },
    size: number = 40
): string {
    const { x1, y1, x2, y2 } = controlPoints;

    // Start at bottom-left, end at top-right
    // SVG Y is inverted (0 is top), so we flip y values
    const startX = 0;
    const startY = size;
    const endX = size;
    const endY = 0;

    const cp1x = x1 * size;
    const cp1y = (1 - y1) * size;
    const cp2x = x2 * size;
    const cp2y = (1 - y2) * size;

    return `M ${startX} ${startY} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${endX} ${endY}`;
}

/**
 * Generate a complete SVG element as a string
 */
export function generateEasingSVG(
    preset: EasingPreset,
    size: number = 40,
    options?: {
        strokeColor?: string;
        strokeWidth?: number;
        backgroundColor?: string;
        showGrid?: boolean;
    }
): string {
    const {
        strokeColor = getCategoryColor(preset.category),
        strokeWidth = 2,
        backgroundColor = 'transparent',
        showGrid = false,
    } = options || {};

    const path = generateEasingSVGPath(preset.controlPoints, size);

    const gridLines = showGrid ? `
    <line x1="0" y1="${size / 2}" x2="${size}" y2="${size / 2}" stroke="#333" stroke-width="0.5" stroke-dasharray="2,2"/>
    <line x1="${size / 2}" y1="0" x2="${size / 2}" y2="${size}" stroke="#333" stroke-width="0.5" stroke-dasharray="2,2"/>
  ` : '';

    return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${backgroundColor}" rx="4"/>
      ${gridLines}
      <path d="${path}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
      <circle cx="0" cy="${size}" r="2" fill="${strokeColor}"/>
      <circle cx="${size}" cy="0" r="2" fill="${strokeColor}"/>
    </svg>
  `.trim();
}

/**
 * React component props for EasingThumbnail
 */
export interface EasingThumbnailProps {
    preset: EasingPreset;
    size?: number;
    selected?: boolean;
    hovered?: boolean;
    onClick?: () => void;
    onDoubleClick?: () => void;
}

/**
 * Sample points along the bezier curve for animation preview
 * Returns array of {t, value} where t is 0-1 time and value is 0-1 progress
 */
export function sampleBezierCurve(
    controlPoints: { x1: number; y1: number; x2: number; y2: number },
    numSamples: number = 60
): { t: number; value: number }[] {
    const samples: { t: number; value: number }[] = [];

    for (let i = 0; i <= numSamples; i++) {
        const t = i / numSamples;
        const value = cubicBezierValue(t, controlPoints);
        samples.push({ t, value });
    }

    return samples;
}

/**
 * Calculate the Y value of a cubic bezier at a given X (time)
 * Uses Newton-Raphson iteration to find the parameter t for a given x
 */
function cubicBezierValue(
    x: number,
    cp: { x1: number; y1: number; x2: number; y2: number }
): number {
    // Find t for the given x using Newton-Raphson
    let t = x;
    for (let i = 0; i < 8; i++) {
        const currentX = bezierComponent(t, cp.x1, cp.x2);
        const dx = currentX - x;
        if (Math.abs(dx) < 0.001) break;

        const derivative = bezierDerivative(t, cp.x1, cp.x2);
        if (derivative === 0) break;

        t -= dx / derivative;
        t = Math.max(0, Math.min(1, t));
    }

    // Calculate y at found t
    return bezierComponent(t, cp.y1, cp.y2);
}

/**
 * Calculate a single component (x or y) of a cubic bezier at parameter t
 * B(t) = 3(1-t)²t·p1 + 3(1-t)t²·p2 + t³
 */
function bezierComponent(t: number, p1: number, p2: number): number {
    const mt = 1 - t;
    return 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t;
}

/**
 * Derivative of bezier component for Newton-Raphson
 */
function bezierDerivative(t: number, p1: number, p2: number): number {
    const mt = 1 - t;
    return 3 * mt * mt * p1 + 6 * mt * t * (p2 - p1) + 3 * t * t * (1 - p2);
}
