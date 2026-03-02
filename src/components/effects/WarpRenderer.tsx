'use client';

import React, { useMemo } from 'react';
import type { SvgObject, WarpEffect, RectangleObject, PathObject } from '@/types/editor';
import { applyWarp, type Vec2, type BoundingBox } from '@/lib/effects/warp-math';
import { buildPathD } from '@/lib/editor-utils';
import { roundedRectD } from '@/lib/geometry-rounded';

interface WarpRendererProps {
    obj: SvgObject;
    fill: string;
    params: WarpEffect;
}

/**
 * Renders an SVG object with AE-style Warp deformation applied to its geometry.
 * Unlike BendItRenderer (WebGL), this operates directly on SVG path points.
 */
export function WarpRenderer({ obj, fill, params }: WarpRendererProps) {
    const deformedPath = useMemo(() => {
        return computeWarpedPath(obj, params);
    }, [obj, params]);

    if (!deformedPath) return null;

    return (
        <path
            d={deformedPath}
            fill={fill}
            stroke={obj.stroke}
            strokeWidth={obj.strokeWidth}
            strokeLinecap={(obj as any).strokeLineCap ?? 'butt'}
            fillRule="evenodd"
            data-id={obj.id}
        />
    );
}

// ─── Geometry Extraction ─────────────────────────────────────────────────────

/**
 * Extracts points from an SVG object and returns its bounding box in local space.
 * `cornerIndices` marks where corners are — the spline will hard-break there
 * instead of smoothing across the junction (prevents arc artifacts at corners).
 */
function getObjectGeometry(obj: SvgObject): {
    points: Vec2[];
    bounds: BoundingBox;
    type: 'polygon' | 'path';
    cornerIndices?: number[]; // hard-corner indices → L command, not C
} | null {
    switch (obj.type) {
        case 'rectangle': {
            const rect = obj as RectangleObject;
            const w = rect.width * Math.abs(rect.scaleX ?? 1);
            const h = rect.height * Math.abs(rect.scaleY ?? 1);
            const segs = 32;
            const pts = sampleRectPoints(w, h, segs);
            // Corner indices: start of each side
            const cornerIndices = [0, segs, segs * 2, segs * 3];
            return {
                points: pts,
                bounds: { x: -w / 2, y: -h / 2, width: w, height: h },
                type: 'polygon',
                cornerIndices,
            };
        }

        case 'ellipse': {
            const { rx, ry } = obj as any;
            const pts = sampleEllipsePoints(rx, ry, 64);
            // Ellipse is fully smooth — no corners
            return {
                points: pts,
                bounds: { x: -rx, y: -ry, width: rx * 2, height: ry * 2 },
                type: 'polygon',
            };
        }

        case 'star':
        case 'polygon': {
            const polyPts = getStarOrPolyPoints(obj);
            if (!polyPts.length) return null;
            const bounds = computeBounds(polyPts);
            // Each vertex is a hard corner for star/polygon
            const cornerIndices = polyPts.map((_, i) => i);
            return { points: polyPts, bounds, type: 'polygon', cornerIndices };
        }

        case 'path': {
            const pObj = obj as PathObject;
            const pts = pObj.points.map(p => ({ x: p.x, y: p.y }));
            if (!pts.length) return null;
            const bounds = computeBounds(pts);
            return { points: pts, bounds, type: 'path' };
        }

        default:
            return null;
    }
}

/**
 * Styles that deform all 4 sides symmetrically.
 * These need a FULL closed catmull-rom so corner extrapolation works naturally:
 * - barrel (+) → smooth curves
 * - pincushion (-) → natural spike extrapolation at corners
 */
const FULL_SPLINE_STYLES = new Set([
    'inflate', 'fish-eye', 'twist', 'fish',
]);

/**
 * Computes the warped SVG path `d` string for the given object.
 */
function computeWarpedPath(obj: SvgObject, params: WarpEffect): string | null {
    const geo = getObjectGeometry(obj);
    if (!geo) return null;

    const warped = applyWarp(geo.points, geo.bounds, params);
    if (!warped.length) return null;

    // Symmetric styles (bulge, inflate…): full closed spline — no hard corners
    // The catmull-rom naturally extrapolates corner "spikes" for pincushion (-bend)
    if (FULL_SPLINE_STYLES.has(params.style) || !geo.cornerIndices) {
        return catmullRomPath(warped, true);
    }

    // Directional styles (arc, flag, wave…): segmented spline
    // Uses L at corners to prevent curvature bleeding from curved to straight sides
    return segmentedCatmullRomPath(warped, geo.cornerIndices);
}

// ─── Sampling helpers ─────────────────────────────────────────────────────────

/** Generates a dense perimeter of a rectangle centered at origin */
function sampleRectPoints(w: number, h: number, segsPerSide: number): Vec2[] {
    const pts: Vec2[] = [];
    const hw = w / 2;
    const hh = h / 2;

    // Top edge: left to right
    for (let i = 0; i <= segsPerSide; i++) {
        pts.push({ x: -hw + (w * i) / segsPerSide, y: -hh });
    }
    // Right edge: top to bottom
    for (let i = 1; i <= segsPerSide; i++) {
        pts.push({ x: hw, y: -hh + (h * i) / segsPerSide });
    }
    // Bottom edge: right to left
    for (let i = 1; i <= segsPerSide; i++) {
        pts.push({ x: hw - (w * i) / segsPerSide, y: hh });
    }
    // Left edge: bottom to top
    for (let i = 1; i < segsPerSide; i++) {
        pts.push({ x: -hw, y: hh - (h * i) / segsPerSide });
    }

    return pts;
}

/** Generates ellipse perimeter points */
function sampleEllipsePoints(rx: number, ry: number, segments: number): Vec2[] {
    const pts: Vec2[] = [];
    for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        pts.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry });
    }
    return pts;
}

/** Gets vertices for star/polygon objects */
function getStarOrPolyPoints(obj: SvgObject): Vec2[] {
    if (obj.type === 'star') {
        const star = obj as any;
        const pts: Vec2[] = [];
        const angle = (Math.PI * 2) / (star.points * 2);
        for (let i = 0; i < star.points * 2; i++) {
            const radius = i % 2 === 0 ? star.outerRadius : star.innerRadius;
            pts.push({
                x: radius * Math.sin(i * angle),
                y: -radius * Math.cos(i * angle),
            });
        }
        return pts;
    }

    if (obj.type === 'polygon') {
        const poly = obj as any;
        const pts: Vec2[] = [];
        const angle = (Math.PI * 2) / poly.sides;
        for (let i = 0; i < poly.sides; i++) {
            pts.push({
                x: poly.radius * Math.sin(i * angle),
                y: -poly.radius * Math.cos(i * angle),
            });
        }
        return pts;
    }

    return [];
}

/** Computes AABB bounding box for a set of points */
function computeBounds(pts: Vec2[]): BoundingBox {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Segmented Catmull-Rom path — applies the spline per-segment only.
 * At `cornerIndices`, a hard L command is used instead of a bezier,
 * preventing curvature from "bleeding" across shape corners.
 * This fixes arc/flag/etc. artifacts at rectangle corners.
 */
function segmentedCatmullRomPath(pts: Vec2[], cornerIndices: number[]): string {
    const n = pts.length;
    if (n === 0) return '';

    // Build set of corner indices for O(1) lookup
    const corners = new Set(cornerIndices);

    let d = `M ${pts[0].x} ${pts[0].y}`;

    for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;

        if (corners.has(next)) {
            // Hard corner: straight line to corner point, then M for next segment
            d += ` L ${pts[next].x} ${pts[next].y}`;
        } else {
            // Within a segment: Catmull-Rom cubic bezier
            // Neighbours: wrap within the SAME segment only
            const prev = i === 0 || corners.has(i) ? i : (i - 1 + n) % n;
            const nextNext = corners.has((next + 1) % n) ? next : (next + 1) % n;

            const p0 = pts[prev];
            const p1 = pts[i];
            const p2 = pts[next];
            const p3 = pts[nextNext];

            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;

            d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
        }
    }

    return d + ' Z';
}

/**
 * Converts an array of Vec2 to a Catmull-Rom spline SVG path.
 * Much smoother than straight L segments — avoids the "polygon" look.
 *
 * Each segment between P[i] and P[i+1] becomes a cubic bezier
 * using the standard Catmull-Rom -> cubic bezier conversion:
 *   CP1 = P[i]   + (P[i+1] - P[i-1]) / 6
 *   CP2 = P[i+1] - (P[i+2] - P[i])   / 6
 */
function catmullRomPath(pts: Vec2[], closed = true): string {
    const n = pts.length;
    if (n === 0) return '';
    if (n === 1) return `M ${pts[0].x} ${pts[0].y}`;
    if (n === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}${closed ? ' Z' : ''}`;

    const p = (i: number): Vec2 => pts[((i % n) + n) % n];

    let d = `M ${p(0).x} ${p(0).y}`;

    const count = closed ? n : n - 1;

    for (let i = 0; i < count; i++) {
        const p0 = p(i - 1);
        const p1 = p(i);
        const p2 = p(i + 1);
        const p3 = p(i + 2);

        // Control point 1 (leaving p1)
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        // Control point 2 (arriving at p2)
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
    }

    if (closed) d += ' Z';
    return d;
}

/** Converts an array of Vec2 to an SVG path `d` string (straight lines, kept for reference) */
function pointsToPath(pts: Vec2[], closed = true): string {
    if (!pts.length) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
        d += ` L ${pts[i].x} ${pts[i].y}`;
    }
    if (closed) d += ' Z';
    return d;
}
