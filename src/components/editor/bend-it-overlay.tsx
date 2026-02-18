
import React from 'react';
import type { SvgObject, BendItEffect } from '@/types/editor';
import { getRotatedCursor } from '@/lib/editor-utils';

interface BendItOverlayProps {
    object: SvgObject;
    zoom: number;
}

// Helper to transform a point from "Bend Renderer Space" to "World Space"
const bendToWorld = (point: { x: number, y: number }, obj: SvgObject): { x: number, y: number } => {
    // 1. Convert BendSpace (origin at top-left of padded canvas) to LocalSpace (origin at object top-left)
    // The padding is currently hardcoded to 250 in canvas.tsx
    const PADDING = 250;
    const localX = point.x - PADDING;
    const localY = point.y - PADDING;

    // 2. Apply Object Transform (Scale, Rotate, Translate)
    // Formula:
    // x' = (x * sx * cos A - y * sy * sin A) + tx
    // y' = (x * sx * sin A + y * sy * cos A) + ty

    // Apply transformation relative to object center?
    // No, standard SVG transform origin is usually 0,0 unless specified.
    // The object.x/y is the translation.
    // The rotation is around the anchor point usually, but here we assume center for simplicity if anchor not used?
    // Wait, `RenderObject` uses: `translate(${obj.x} ${obj.y}) rotate(${obj.rotation})`
    // This rotates around (0,0) of the object local space (after translation).
    // So (0,0) local is (obj.x, obj.y) world.

    const cos = Math.cos((obj.rotation || 0) * Math.PI / 180);
    const sin = Math.sin((obj.rotation || 0) * Math.PI / 180);

    // Local point (scaled)
    const lx = localX * (obj.scaleX ?? 1);
    const ly = localY * (obj.scaleY ?? 1);

    // Rotate
    const rx = lx * cos - ly * sin;
    const ry = lx * sin + ly * cos;

    // Translate
    return {
        x: rx + obj.x,
        y: ry + obj.y
    };
};

export const BendItOverlay = ({ object, zoom }: BendItOverlayProps) => {
    if (!object.bend?.enabled) return null;

    const startWorld = bendToWorld(object.bend.start, object);
    const endWorld = bendToWorld(object.bend.end, object);

    const handleSize = 8 / zoom;
    const h2 = handleSize / 2;
    const strokeWidth = 1 / zoom;

    return (
        <g className="pointer-events-none">
            {/* Connecting Line */}
            <line
                x1={startWorld.x}
                y1={startWorld.y}
                x2={endWorld.x}
                y2={endWorld.y}
                stroke="hsl(var(--primary))"
                strokeWidth={strokeWidth}
                strokeDasharray={`${4 / zoom} ${4 / zoom}`}
                opacity={0.6}
            />

            {/* Start Handle */}
            <g transform={`translate(${startWorld.x}, ${startWorld.y})`}>
                <circle
                    r={handleSize / 1.5}
                    fill="transparent"
                    stroke="hsl(var(--primary))"
                    strokeWidth={strokeWidth}
                />
                <circle
                    r={handleSize / 4}
                    fill="hsl(var(--primary))"
                />
                {/* Hit Target (invisible but larger) */}
                <rect
                    x={-handleSize}
                    y={-handleSize}
                    width={handleSize * 2}
                    height={handleSize * 2}
                    fill="transparent"
                    className="pointer-events-auto cursor-move"
                    data-bend-handle="start"
                    data-object-id={object.id}
                />
            </g>

            {/* End Handle */}
            <g transform={`translate(${endWorld.x}, ${endWorld.y})`}>
                <path
                    d={`M -${handleSize / 2} -${handleSize / 2} L ${handleSize / 2} ${handleSize / 2} M -${handleSize / 2} ${handleSize / 2} L ${handleSize / 2} -${handleSize / 2}`}
                    stroke="hsl(var(--primary))"
                    strokeWidth={strokeWidth * 1.5}
                />
                <circle
                    r={handleSize / 1.5}
                    fill="transparent"
                    stroke="hsl(var(--primary))"
                    strokeWidth={strokeWidth}
                />
                {/* Hit Target */}
                <rect
                    x={-handleSize}
                    y={-handleSize}
                    width={handleSize * 2}
                    height={handleSize * 2}
                    fill="transparent"
                    className="pointer-events-auto cursor-move"
                    data-bend-handle="end"
                    data-object-id={object.id}
                />
            </g>
        </g>
    );
};
