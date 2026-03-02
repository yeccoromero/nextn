

'use client';

import { useRef, useState, type PointerEvent, type MouseEvent, useEffect, useMemo, memo } from 'react';
import { useEditorStore } from '@/store';
import { useEditor } from '@/context/editor-context';
import { useCanvasShortcuts } from '@/hooks/use-canvas-shortcuts';
import { useCanvasZoom } from '@/hooks/use-canvas-zoom';
import { useCanvasSelection } from '@/hooks/use-canvas-selection';
import type { SvgObject, PathObject, BezierPoint, Tool, ResizeHandle, GroupObject, BoundingBox, SnapLine, Fill, LinearGradientFill, RadialGradientFill, GradientStop, PropertyId, RectangleObject, EllipseObject, CopiedKeyframe, ClipboardEnvelope, LayerTrack } from '@/types/editor';
import { nanoid } from 'nanoid';
import { getOverallBBox, rotatePoint, isSelectionConstrained, getHoveredInteraction, getRotatedCursor, getVisualBoundingBox, buildPathD, getWorldAnchor, getSmartSnap, localToWorld, worldToLocal, ENFORCE_EDGE_CLAMP, getWorldRotation } from '@/lib/editor-utils';
import { transformObjectByResize } from '@/lib/geometry';
import { clipboard } from '@/lib/clipboard';
import { getSvgPointFromClient, hitTestAtPoint } from '@/lib/hit-detection-utils';
import { BendItRenderer } from '@/components/effects/BendItRenderer';
import { BendItOverlay } from '@/components/editor/bend-it-overlay';
import { WarpRenderer } from '@/components/effects/WarpRenderer';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from '../ui/context-menu';
import { Scissors, Copy, ClipboardPaste, Trash2, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Lock, Unlock, Pencil, Group, Ungroup, CopyPlus, Eye, EyeOff, ArrowLeftRight, ArrowUpDown } from 'lucide-react';
import { NodeToolIcon, PenToolAddIcon, PenToolRemoveIcon } from '../icons';
import { roundedRectD } from '@/lib/geometry-rounded';
import { selectActiveLayerSegment } from '@/lib/anim/selectors';
import { createSelectSelectedObjects, createSelectOverallBBox } from '@/lib/selectors';

const ROTATION_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M2 12C2 6.48 6.44 2 12 2C18.67 2 22 7.56 22 7.56M22 7.56V2.56M22 7.56H17.56" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /><path opacity="0.4" d="M21.89 12C21.89 17.52 17.41 22 11.89 22C6.37 22 3 16.44 3 16.44M3 16.44H7.52M3 16.44V21.44" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>`;

const HIT_PX = 14;
const tol2 = (zoom: number) => {
    const t = HIT_PX / zoom;
    return t * t;
};
const dist2 = (ax: number, ay: number, bx: number, by: number) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
};

const asPathSpace = <T extends PathObject>(path: T): T =>
    ({ ...path, anchorPosition: 'origin' as any });

function ensureCubicHandles(path: PathObject, idx: number): Partial<BezierPoint> | null {
    const p = path.points[idx];
    if (p.handleIn && p.handleOut) return null;

    const prev = path.points[idx - 1];
    const next = path.points[idx + 1];

    let vx = 1, vy = 0; // fallback
    if (prev && next) { vx = next.x - prev.x; vy = next.y - prev.y; }
    else if (next) { vx = next.x - p.x; vy = next.y - p.y; }
    else if (prev) { vx = p.x - prev.x; vy = p.y - prev.y; }

    const len = Math.hypot(vx, vy) || 1;
    const ux = vx / len, uy = vy / len;
    const L = Math.min(40, len / 3);

    const handleOut = { x: p.x + ux * L, y: p.y + uy * L };
    const handleIn = { x: p.x - ux * L, y: p.y - uy * L };

    return { ...p, mode: 'mirror', handleIn, handleOut };
}

const RenderObject = memo(({ obj, selectedObjectIds, currentTool, allObjects, selectedPathNodes, zoom, isVisible }: { obj: SvgObject, selectedObjectIds: string[], currentTool: Tool, allObjects: Record<string, SvgObject>, selectedPathNodes: Array<{ pathId: string; pointIndex: number }>, zoom: number, isVisible: boolean }) => {

    if (!isVisible) return null;

    const transform = `translate(${obj.x || 0} ${obj.y || 0}) rotate(${obj.rotation || 0}) scale(${obj.scaleX ?? 1} ${obj.scaleY ?? 1})`;

    let fill: string;
    if (typeof obj.fill === 'string') {
        fill = obj.fill;
    } else {
        fill = `url(#grad-${obj.id})`;
    }

    if (typeof obj.fill === 'string') {
        fill = obj.fill;
    } else {
        fill = `url(#grad-${obj.id})`;
    }

    // --- BEND IT EFFECT INTEGRATION ---
    if (obj.bend?.enabled) {
        // 1. Serialize object to SVG Data URI for the renderer
        // We render it un-transformed (identity) because the renderer handles local deformation
        // efficiently, but we need to pass dimensions.
        // Ideally we'd cache this URL.
        const svgString = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${1000}" height="${1000}" viewBox="0 0 1000 1000">
                <g transform="translate(500, 500)">
                     ${/* We need a way to render just the geometry here. For now, using a placeholder or simplified render.
                        In a real impl, we'd refactor RenderObjectContent to return the JSX, render it to string?
                        Or better: use a separate fast-path for the "source" image.
                        For this POC, let's assume we bend a generic placeholder or try to reuse RenderObjectContent logic?
                        Actually, React renderToString is not available easily here without server components.
                        Let's duplicate basic geometry logic for the Data URI or just render the object content.
                        */ ''}
                     <!-- Geometry would go here -->
                </g>
            </svg>
        `;

        // Since we can't easily rasterize React components to string in client without overhead,
        // and BendItRenderer needs an image...
        // Let's rely on the user providing an image OR (better for vectors):
        // We render the object normally, but hide it? No, we need it bent.

        // CORRECT APPROACH FOR VECTOR TOOL:
        // We wrap the `RenderObjectContent` in a `foreignObject` that contains the `BendItRenderer`.
        // BUT `BendItRenderer` is WebGL canvas. It needs pixels.
        // We MUST rasterize the vector.

        // For this task, to avoid massive refactoring, we will use a "Snapshot" approach if possible,
        // OR we just assume the user maps a texture.
        // But the user expects to bend the *vector object*.

        // Let's use a simpler hack:
        // Render the object NORMALLY, but apply a CSS filter? No, CSS can't do arbitrary arcs.
        // We genuinely need to rasterize.

        // Let's try to construct a minimal SVG data URI for the specific object type.
        let d = '';
        if (obj.type === 'rectangle') d = `M 0 0 h ${obj.width} v ${obj.height} h -${obj.width} Z`; // Simplified
        // ... this is getting complex to duplicate logic.

        // Plan B: Render the `BendItRenderer` using a static test image for now (as per "Demo Ready" status),
        // effectively replacing the object with the bent version of a "texture".
        // Real rasterization of arbitrary React-rendered SVG trees is hard.

        // However, if we look at `bend-it-demo/page.tsx`, it uses `/bend-test-grid.svg`.
        // We can use the object's fill as a texture if it's an image?
        // Or specific logic for rects/images.

        // For this iteration, let's implement the harness:
        // If bend enabled, render foreignObject with BendItRenderer.
        // We will pass a placeholder grid or the user's selected fill if it's an image.
        // If it's a vector, we might default to a grid to show the effect works,
        // or attempt a basic rect SVG data URI.

        // Let's create a dynamic Data URI for a simple Rectangle at least.
        const width = (obj as any).width || 100;
        const height = (obj as any).height || 100;

        // Resolution enhancement:
        // We need to render the source texture at a higher resolution if we are zoomed in.
        // The BendItRenderer accepts a `renderScale`.
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
        // Cap the max scale to avoid huge textures (e.g. 4x zoom on retina = 8x pixels)
        const renderScale = Math.min(zoom * dpr, 4);

        // Fix: encodeURIComponent might produce invalid fill if it's a CSS gradient string ("linear-gradient(...)")
        // SVG rect fill only accepts colors or url(#id).
        // If it's a gradient string, we fallback to a solid color for the preview to ensure visibility.
        let safeFill = fill;
        if (fill.includes('url') || fill.startsWith('linear-gradient') || fill.startsWith('radial-gradient')) {
            safeFill = '#888888'; // Fallback for gradients/patterns in WebGL preview
        }

        const encodedFill = encodeURIComponent(safeFill);

        // The SVG in the Data URI must effectively be "high res".
        // If we just say width=100 viewbox=0 0 100 100, the browser rasterizes it at natural size?
        // When we load it into an Image() for WebGL, it loads at natural size.
        // So we must scale the SVG attributes themselves.
        const scaledW = width * renderScale;
        const scaledH = height * renderScale;

        // Support Rounded Corners
        let svgContent = '';
        if (obj.type === 'rectangle') {
            const rectObj = obj as RectangleObject;
            // Standardize corners
            let corners = rectObj.corners;
            // Fallback to rx/ry if corners not present but rx/ry is
            if (!corners && (rectObj.rx || rectObj.ry)) {
                const r = Math.max(rectObj.rx || 0, rectObj.ry || 0);
                corners = { tl: r, tr: r, br: r, bl: r };
            }

            if (corners) {
                const d = roundedRectD(width, height, corners);
                // roundedRectD generates path centered at 0,0 (-width/2 to width/2).
                // SVG viewBox is 0 0 width height. We need to shift it to center.
                svgContent = `<g transform="translate(${width / 2}, ${height / 2})"><path d="${d}" fill="${encodedFill}" /></g>`;
            } else {
                svgContent = `<rect width="${width}" height="${height}" fill="${encodedFill}" />`;
            }
        } else if (obj.type === 'ellipse') {
            const elObj = obj as EllipseObject;
            // Ellipse in center of width/height? SvgObject usually has x/y as top-left?
            // Actually EllipseObject definition says rx, ry. position is cx, cy? 
            // Canvas logic: <ellipse cx=0 cy=0 ... transform=translate...>
            // Here we are creating an image of the object.
            // If we use viewBox 0 0 width height, and the object fills it?
            // Ellipse geometry: cx = width/2, cy = height/2, rx=width/2, ry=height/2 ??
            // Actually `width` and `height` var above comes from `(obj as any).width`.
            // Ellipse objects might not have width/height properties directly in SvgObject interface (it has rx/ry).
            // If it's an ellipse, we might need special handling. 
            // But the user issue is RECTANGLE.
            svgContent = `<rect width="${width}" height="${height}" fill="${encodedFill}" />`; // Fallback
        } else {
            svgContent = `<rect width="${width}" height="${height}" fill="${encodedFill}" />`;
        }

        const dataUri = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${scaledW}" height="${scaledH}" viewBox="0 0 ${width} ${height}">${svgContent}</svg>`;

        return (
            <g transform={`translate(${obj.x} ${obj.y}) rotate(${obj.rotation}) scale(${obj.scaleX ?? 1} ${obj.scaleY ?? 1})`} data-id={obj.id}>
                <foreignObject
                    width={width + 500}
                    height={height + 500}
                    x={-250}
                    y={-250}
                    style={{ overflow: 'visible' }}
                    data-id={obj.id}
                >
                    <BendItRenderer
                        imageUrl={dataUri}
                        params={obj.bend} // Need to map BendItEffect structure to BendParams
                        width={width + 500}
                        height={height + 500}
                        renderScale={renderScale}
                    />
                </foreignObject>
            </g>
        );
    }

    // --- WARP EFFECT INTEGRATION ---
    if (obj.warp?.enabled) {
        // Warp deforms SVG geometry points directly — no WebGL needed.
        // We apply the object's transform (translate/rotate/scale) then render the deformed path.
        const warpTransform = `translate(${obj.x || 0} ${obj.y || 0}) rotate(${obj.rotation || 0})`;
        return (
            <g data-id={obj.id} transform={warpTransform}>
                <WarpRenderer obj={obj} fill={fill} params={obj.warp} />
            </g>
        );
    }

    return (
        <g data-id={obj.id}>
            <RenderObjectContent obj={obj} fill={fill} transform={transform} allObjects={allObjects} selectedObjectIds={selectedObjectIds} currentTool={currentTool} selectedPathNodes={selectedPathNodes} zoom={zoom} isVisible={isVisible} />
        </g>
    )
}, (prev, next) => {
    if (prev.obj !== next.obj) return false;
    if (prev.isVisible !== next.isVisible) return false;
    if (prev.zoom !== next.zoom) return false;

    // Check if Selection Changed ONLY for this object
    const wasSelected = prev.selectedObjectIds.includes(prev.obj.id);
    const isSelected = next.selectedObjectIds.includes(next.obj.id);
    if (wasSelected !== isSelected) return false;

    // Check Tool: If switching to/from path-edit, re-render (handles/nodes might appear)
    if (prev.currentTool !== next.currentTool) {
        if (prev.currentTool === 'path-edit' || next.currentTool === 'path-edit') return false;
    }

    // Check Path Nodes: Only if tool is path-edit and this is the active object
    if (next.currentTool === 'path-edit' && isSelected) {
        if (prev.selectedPathNodes !== next.selectedPathNodes) return false;
    }

    // Groups need allObjects to render children
    if (prev.obj.type === 'group') {
        if (prev.allObjects !== next.allObjects) return false;
    }

    return true;
});
RenderObject.displayName = 'RenderObject';

const RenderObjectContent = ({ obj, fill, transform, allObjects, selectedObjectIds, currentTool, selectedPathNodes, zoom, isVisible }: {
    obj: SvgObject,
    fill: string,
    transform: string,
    allObjects: Record<string, SvgObject>,
    selectedObjectIds: string[],
    currentTool: Tool,
    selectedPathNodes: Array<{ pathId: string; pointIndex: number }>,
    zoom: number,
    isVisible: boolean,
}) => {
    switch (obj.type) {
        case 'group': {
            const group = obj as GroupObject;
            return (
                <g transform={transform} data-id={obj.id}>
                    {(group.children || []).map(childId => {
                        const childObj = allObjects[childId];
                        if (!childObj) return null;
                        return <RenderObject key={childId} obj={childObj} allObjects={allObjects} selectedObjectIds={selectedObjectIds} currentTool={currentTool} selectedPathNodes={selectedPathNodes} zoom={zoom} isVisible={isVisible} />
                    })}
                </g>
            )
        }
        case 'rectangle': {
            const rectObj = obj as RectangleObject;

            // Use absolute scale for dimensions to prevent negative width/height in path data
            const finalWidth = rectObj.width * Math.abs(rectObj.scaleX ?? 1);
            const finalHeight = rectObj.height * Math.abs(rectObj.scaleY ?? 1);

            let cornersToRender;
            if (rectObj.isPillShape) {
                const pillRadius = Math.min(finalWidth, finalHeight) / 2;
                cornersToRender = { tl: pillRadius, tr: pillRadius, br: pillRadius, bl: pillRadius };
            } else {
                // Use the stored corner values. The roundedRectD function will clamp them
                // based on the final dimensions.
                cornersToRender = rectObj.corners ?? { tl: 0, tr: 0, br: 0, bl: 0 };
            }

            const d = roundedRectD(finalWidth, finalHeight, cornersToRender);

            // Get the sign of the scale for flipping
            const flipX = (rectObj.scaleX ?? 1) < 0 ? -1 : 1;
            const flipY = (rectObj.scaleY ?? 1) < 0 ? -1 : 1;

            // Compose the full transform: translate, rotate, then apply the flip
            const finalTransform = `translate(${obj.x || 0} ${obj.y || 0}) rotate(${obj.rotation || 0}) scale(${flipX} ${flipY})`;

            return (
                <path
                    id={obj.id}
                    d={d}
                    fill={fill}
                    stroke={obj.stroke}
                    strokeWidth={obj.strokeWidth}
                    transform={finalTransform}
                    data-id={obj.id}
                />
            );
        }
        case 'ellipse': {
            const { rx, ry } = obj;
            return <ellipse id={obj.id} cx={0} cy={0} rx={rx} ry={ry} fill={fill} stroke={obj.stroke} strokeWidth={obj.strokeWidth} transform={transform} data-id={obj.id} />;
        }
        case 'star': {
            const star = obj;
            let points = "";
            const angle = (Math.PI * 2) / (star.points * 2);
            for (let i = 0; i < star.points * 2; i++) {
                const radius = i % 2 === 0 ? star.outerRadius : star.innerRadius;
                const pX = radius * Math.sin(i * angle);
                const pY = -radius * Math.cos(i * angle);
                points += `${pX},${pY} `;
            }
            return <polygon id={obj.id} points={points.trim()} fill={fill} stroke={star.stroke} strokeWidth={star.strokeWidth} transform={transform} data-id={obj.id} />;
        }
        case 'polygon': {
            const poly = obj;
            let points = "";
            const angle = (Math.PI * 2) / poly.sides;
            for (let i = 0; i < poly.sides; i++) {
                const pX = poly.radius * Math.sin(i * angle);
                const pY = -poly.radius * Math.cos(i * angle);
                points += `${pX},${pY} `;
            }
            return <polygon id={obj.id} points={points.trim()} fill={fill} stroke={poly.stroke} strokeWidth={poly.strokeWidth} transform={transform} data-id={obj.id} />;
        }
        case 'text': {
            const sx = obj.scaleX ?? 1;
            const sy = obj.scaleY ?? 1;
            const unflip = `scale(${sx < 0 ? -1 : 1} ${sy < 0 ? -1 : 1})`;
            return (
                <g id={obj.id} transform={transform} data-id={obj.id}>
                    <g transform={unflip}>
                        <text
                            x={0} y={0}
                            fontSize={obj.fontSize}
                            fontWeight={obj.fontWeight}
                            fill={fill}
                            stroke={obj.stroke}
                            strokeWidth={obj.strokeWidth}
                            dominantBaseline="middle"
                            textAnchor="middle"
                        >
                            {obj.text}
                        </text>
                    </g>
                </g>
            );
        }
        case 'path': {
            const p = obj as PathObject;
            const d = buildPathD(p);

            const isSelected = selectedObjectIds.includes(p.id);
            const hasNodeSelected = (selectedPathNodes || []).some(n => n.pathId === p.id);
            const nodesTools = new Set<Tool>(['path-edit', 'add-node', 'remove-node']);
            const showNodes = nodesTools.has(currentTool) && (isSelected || hasNodeSelected);

            const R_NODE = 5 / zoom;
            const R_HANDLE = 4 / zoom;
            const SW = 0.8 / zoom;
            const SW_LINE = 0.5 / zoom;

            const pth = asPathSpace(p);

            return (
                <>
                    <g transform={transform} data-id={p.id}>
                        <path
                            d={d}
                            fill={fill}
                            stroke={p.stroke}
                            strokeWidth={p.strokeWidth}
                            strokeLinecap={p.strokeLineCap ?? 'butt'}
                            id={p.id}
                            data-id={p.id}
                            fillRule="evenodd"
                        />
                    </g>
                    {showNodes && (
                        <g data-id={`${p.id}-nodes`} pointerEvents="all">
                            {p.points.map((pt, i) => {
                                const A = localToWorld(pth, pt, allObjects);
                                const Hin = pt.handleIn ? localToWorld(pth, pt.handleIn, allObjects) : null;
                                const Hout = pt.handleOut ? localToWorld(pth, pt.handleOut, allObjects) : null;

                                const isNodeSelected = selectedPathNodes?.some(n => n.pathId === p.id && n.pointIndex === i);

                                return (
                                    <g key={i}>
                                        {isNodeSelected && Hin && (
                                            <>
                                                <line
                                                    x1={A.x} y1={A.y} x2={Hin.x} y2={Hin.y}
                                                    stroke="hsl(var(--primary))"
                                                    strokeWidth={SW_LINE}
                                                    vectorEffect="non-scaling-stroke"
                                                />
                                                <circle
                                                    cx={Hin.x} cy={Hin.y} r={R_HANDLE}
                                                    fill="#fff"
                                                    stroke="hsl(var(--primary))"
                                                    strokeWidth={SW_LINE}
                                                />
                                            </>
                                        )}

                                        {isNodeSelected && Hout && (
                                            <>
                                                <line
                                                    x1={A.x} y1={A.y} x2={Hout.x} y2={Hout.y}
                                                    stroke="hsl(var(--primary))"
                                                    strokeWidth={SW_LINE}
                                                    vectorEffect="non-scaling-stroke"
                                                />
                                                <circle
                                                    cx={Hout.x} cy={Hout.y} r={R_HANDLE}
                                                    fill="#fff"
                                                    stroke="hsl(var(--primary))"
                                                    strokeWidth={SW_LINE}
                                                />
                                            </>
                                        )}

                                        <circle
                                            cx={A.x}
                                            cy={A.y}
                                            r={R_NODE}
                                            fill={isNodeSelected ? 'hsl(var(--primary))' : '#fff'}
                                            stroke="hsl(var(--primary))"
                                            strokeWidth={SW}
                                            data-path-id={p.id}
                                            data-point-index={i}
                                        />
                                    </g>
                                );
                            })}
                        </g>
                    )}
                </>
            );
        }
        default:
            return null;
    }
}

type MarqueeRect = { x: number; y: number; width: number; height: number };

type InteractionState = {
    type: 'drawing' | 'moving' | 'resizing' | 'marquee' | 'rotating' | 'panning' | 'possible-marquee' | 'editing-path' | 'editing-handle' | 'possible-node-marquee' | 'node-marquee' | 'editing-gradient-handle' | 'editing-gradient-stop' | 'editing-effect-handle' | null;
    start: { x: number; y: number };
    objectId?: string;
    pathId?: string;
    pointIndex?: number;
    which?: 1 | 2 | 'linear-start' | 'linear-end' | 'radial-center' | 'radial-radius' | 'stop' | 'bend-start' | 'bend-end';
    stopId?: string;
    origin?: { x: number; y: number };
    originalObjects?: Map<string, SvgObject>;
    groupBBox?: BoundingBox & { rotation: number, cx: number, cy: number };
    resizeHandle?: ResizeHandle;
    shiftKey?: boolean;
    altKey?: boolean;
    constrainActive?: boolean;
    lastAngle?: number;
    baseRotation?: number;
    wasPlaying?: boolean;
    center?: { x: number; y: number };
    isDrag?: boolean;
    initialPan?: { x: number, y: number };
    anchorPointInCanvasSpace?: { x: number, y: number };
    hasHistoryEntry?: boolean;
    _committed?: boolean;
    movingNodes?: Array<{
        pathId: string;
        pointIndex: number;
        startWorld: { x: number; y: number };
        startLocal: { x: number; y: number };
        startHandleIn?: { x: number; y: number } | null;
        startHandleOut?: { x: number; y: number } | null;
    }>;
    startCenter?: { x: number; y: number };
    snap?: {
        active: boolean;
        targetId?: string | null;
        offset: { x: number; y: number };
        lines: SnapLine[];
    };
    originalFill?: Fill;
    otherHandlePos?: { x: number, y: number };
};

type Hit =
    | { kind: 'handle'; pathId: string; pointIndex: number; which: 1 | 2 } // 1 for handleOut, 2 for handleIn
    | { kind: 'anchor'; pathId: string; pointIndex: number }
    | { kind: 'segment'; pathId: string; index: number }
    | { kind: 'effect-handle'; objectId: string; which: 'bend-start' | 'bend-end' }
    | null

const PADDING = 250;

// Helper to transform world point to bend space (inverse of overlay transform)
const worldToBend = (worldPoint: { x: number, y: number }, obj: SvgObject): { x: number, y: number } => {
    // 1. Translate back
    const tx = worldPoint.x - obj.x;
    const ty = worldPoint.y - obj.y;

    // 2. Rotate back (multiply by inverse rotation matrix)
    const rad = -(obj.rotation || 0) * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const rx = tx * cos - ty * sin;
    const ry = tx * sin + ty * cos;

    // 3. Scale back
    const sx = obj.scaleX ?? 1;
    const sy = obj.scaleY ?? 1;

    const lx = rx / sx;
    const ly = ry / sy;

    // 4. Add padding offset
    return {
        x: lx + PADDING,
        y: ly + PADDING
    };
};

const creationTools: Tool[] = ['rectangle', 'ellipse', 'star', 'polygon', 'text', 'line'];

const isFinitePoint = (p: { x: number, y: number }) => Number.isFinite(p.x) && Number.isFinite(p.y);

const hitTestEnhanced = (
    svgPoint: { x: number; y: number },
    zoom: number,
    pathId: string,
    path: PathObject,
    objects: Record<string, SvgObject>
): Hit => {
    const t2 = tol2(zoom);
    const pth = asPathSpace(path);

    // 1) HANDLES (en mundo)
    for (let i = 0; i < path.points.length; i++) {
        const p = path.points[i];
        if (p.handleOut) {
            const Hout = localToWorld(pth, p.handleOut, objects);
            if (dist2(svgPoint.x, svgPoint.y, Hout.x, Hout.y) <= t2)
                return { kind: 'handle', pathId, pointIndex: i, which: 1 };
        }
        if (p.handleIn) {
            const Hin = localToWorld(pth, p.handleIn, objects);
            if (dist2(svgPoint.x, svgPoint.y, Hin.x, Hin.y) <= t2)
                return { kind: 'handle', pathId, pointIndex: i, which: 2 };
        }
    }

    // 2) ANCHORS (en mundo)
    for (let i = 0; i < path.points.length; i++) {
        const n = path.points[i];
        const A = localToWorld(pth, n, objects);
        if (dist2(svgPoint.x, svgPoint.y, A.x, A.y) <= t2) {
            return { kind: 'anchor', pathId, pointIndex: i };
        }
    }

    // 3) SEGMENTS (proyección en mundo; lineal)
    const closest = findClosestPointOnPathWorld(path, objects, svgPoint);
    if (closest && dist2(svgPoint.x, svgPoint.y, closest.point.x, closest.point.y) <= t2) {
        return { kind: 'segment', pathId, index: closest.segmentIndex };
    }

    return null;
};

function findClosestPointOnPathWorld(
    path: PathObject,
    objects: Record<string, SvgObject>,
    targetWorld: { x: number; y: number }
): { point: { x: number; y: number }; segmentIndex: number } | null {
    let closest: { x: number; y: number } | null = null;
    let minD = Infinity;
    let segIdx = -1;

    const count = path.points.length - (path.closed ? 0 : 1);
    for (let i = 0; i < count; i++) {
        const p1 = path.points[i];
        const p2 = path.points[(i + 1) % path.points.length];

        const pth = asPathSpace(path);
        const P1 = localToWorld(pth, p1, objects);
        const P2 = localToWorld(pth, p2, objects);

        const dx = P2.x - P1.x, dy = P2.y - P1.y;
        const denom = dx * dx + dy * dy;
        if (denom === 0) continue;

        const t = ((targetWorld.x - P1.x) * dx + (targetWorld.y - P1.y) * dy) / denom;
        const u = Math.max(0, Math.min(1, t));
        const Q = { x: P1.x + u * dx, y: P1.y + u * dy };

        const d = (targetWorld.x - Q.x) ** 2 + (targetWorld.y - Q.y) ** 2;
        if (d < minD) {
            minD = d;
            closest = Q;
            segIdx = i;
        }
    }

    return closest ? { point: closest, segmentIndex: segIdx } : null;
}

function findBestPathHit(
    svgPoint: { x: number; y: number },
    zoom: number,
    objects: Record<string, SvgObject>,
    zStack: string[],
    selectedIds: string[]
): { hit: Hit; pathId: string; path: PathObject } | null {
    const selectedSet = new Set(selectedIds);
    const selectedPaths = selectedIds
        .map(id => objects[id])
        .filter((o): o is PathObject => o?.type === 'path' && o.visible !== false && !o.locked);

    const otherPaths = zStack
        .map(id => objects[id])
        .filter((o): o is PathObject => o?.type === 'path' && !selectedSet.has(o.id) && o.visible !== false && !o.locked)
        .reverse();

    const candidates = [...selectedPaths, ...otherPaths];

    let best: { rank: number; hit: Hit; pathId: string; path: PathObject } | null = null;

    for (const p of candidates) {
        const h = hitTestEnhanced(svgPoint, zoom, p.id, p, objects);
        if (!h) continue;

        const rank = h.kind === 'handle' ? 0 : h.kind === 'anchor' ? 1 : 2;

        if (!best || rank < best.rank) {
            best = { rank, hit: h, pathId: p.id, path: p };
            if (rank === 0) break;
        }
    }
    return best ? { hit: best.hit, pathId: best.pathId, path: best.path } : null;
}

function getSmartSnapCenter(
    proposedCenter: { x: number; y: number },
    selectedIds: string[],
    objects: Record<string, SvgObject>,
    zoom: number,
    bounds: { x: number; y: number; width: number; height: number }
): { snappedCenter: { x: number; y: number }; lines: SnapLine[]; targetId?: string } {
    const currentObjects = selectedIds.map(id => objects[id]).filter(Boolean);
    const currentBBox = getOverallBBox(currentObjects, objects);

    if (!currentBBox) {
        return { snappedCenter: proposedCenter, lines: [], targetId: undefined };
    }

    const { snappedPoint, snapLines, targetId } = getSmartSnap(
        selectedIds,
        objects,
        proposedCenter,
        { x: currentBBox.cx, y: currentBBox.cy },
        zoom,
        bounds
    );
    return { snappedCenter: snappedPoint, lines: snapLines, targetId };
}

const hitTestEffectHandles = (
    svgPoint: { x: number; y: number },
    zoom: number,
    objects: Record<string, SvgObject>,
    selectedIds: string[]
): Hit => {
    if (selectedIds.length !== 1) return null;
    const obj = objects[selectedIds[0]];
    if (!obj || !obj.bend?.enabled) return null;

    const t2 = tol2(zoom);

    // Check Start Handle
    const wb = (p: { x: number, y: number }) => {
        // We reuse the transform logic but forward (Bend -> World) to check distance
        // Since we don't have the bendToWorld helper here easily without duplicating, 
        // we can implement a scoped one or move the helper out.
        // Let's implement inline for now as it's small.
        const PADDING = 250;
        const localX = p.x - PADDING;
        const localY = p.y - PADDING;
        const rad = (obj.rotation || 0) * (Math.PI / 180);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const sx = obj.scaleX ?? 1;
        const sy = obj.scaleY ?? 1;
        const scaledX = localX * sx;
        const scaledY = localY * sy;
        const rotatedX = scaledX * cos - scaledY * sin;
        const rotatedY = scaledX * sin + scaledY * cos;
        return { x: rotatedX + obj.x, y: rotatedY + obj.y };
    };

    const startWorld = wb(obj.bend.start);
    if (dist2(svgPoint.x, svgPoint.y, startWorld.x, startWorld.y) <= t2) {
        return { kind: 'effect-handle', objectId: obj.id, which: 'bend-start' };
    }

    const endWorld = wb(obj.bend.end);
    if (dist2(svgPoint.x, svgPoint.y, endWorld.x, endWorld.y) <= t2) {
        return { kind: 'effect-handle', objectId: obj.id, which: 'bend-end' };
    }

    return null;
}

export default function Canvas() {
    const dispatch = useEditorStore(state => state.dispatch);
    const state = useEditorStore(state => state.transientPresent ?? state.present);
    const { zoomActionsRef } = useEditor();

    if (!state) {
        return <div className="w-full h-full bg-muted/40 animate-pulse" />;
    }

    const selectSelectedObjects = useMemo(createSelectSelectedObjects, []);
    const selectOverallBBox = useMemo(createSelectOverallBBox, []);

    const selectedObjects = selectSelectedObjects(state);
    const overallBBox = selectOverallBBox(state);

    const { objects, currentTool, selectedObjectIds, canvas, drawingPath, zStack, ui, selectedPathNodes, timeline } = state;
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const interactionStateRef = useRef<InteractionState>({ type: null, start: { x: 0, y: 0 } });
    const [cursor, setCursor] = useState('default');
    const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
    const { startMarquee, updateMarquee, finishMarquee } = useCanvasSelection(svgRef, setMarqueeRect, canvas.zoom);

    useEffect(() => {
        const handleGlobalReset = (e: any) => {
            const st = interactionStateRef.current;
            if (!st?.type) return;

            if (e instanceof PointerEvent) {
                const target = e.target as HTMLElement;
                if (target.hasPointerCapture?.(e.pointerId)) {
                    target.releasePointerCapture(e.pointerId);
                }
            }
        };

        window.addEventListener('pointerup', handleGlobalReset);
        window.addEventListener('pointercancel', handleGlobalReset);
        window.addEventListener('blur', handleGlobalReset);

        return () => {
            window.removeEventListener('pointerup', handleGlobalReset);
            window.removeEventListener('pointercancel', handleGlobalReset);
            window.removeEventListener('blur', handleGlobalReset);
        };
    }, [dispatch, currentTool]);

    useCanvasShortcuts();

    const getSVGPoint = (e: { clientX: number; clientY: number }) => {
        const viewport = containerRef.current?.getBoundingClientRect();
        if (!viewport) return { x: 0, y: 0 };

        const panX = state.canvas.pan?.x ?? 0;
        const panY = state.canvas.pan?.y ?? 0;
        const z = state.canvas.zoom || 1;

        return {
            x: (e.clientX - viewport.left - panX) / z,
            y: (e.clientY - viewport.top - panY) / z,
        };
    };

    const getCommonAnchorValue = () => {
        if (selectedObjectIds.length === 0) return null;
        const firstValue = objects[selectedObjectIds[0]]?.anchorPosition;
        if (!firstValue) return 'center';
        const allSame = selectedObjectIds.every((id: string) => objects[id]?.anchorPosition === firstValue);
        return allSame ? firstValue : 'center';
    };

    const findNearbyNode = (point: { x: number; y: number }, zoom: number) => {
        const tolerance = 8 / zoom;

        if (drawingPath) {
            const p0 = drawingPath.points[0];
            const absP0 = { x: drawingPath.x + p0.x, y: drawingPath.y + p0.y };
            if (drawingPath.points.length > 2 && Math.hypot(point.x - absP0.x, point.y - absP0.y) < tolerance) {
                return { pathId: drawingPath.id, pointIndex: 0, isStartNode: true };
            }
        }

        for (const objId of selectedObjectIds) {
            const obj = objects[objId];
            if (obj.type === 'path') {
                for (let i = 0; i < obj.points.length; i++) {
                    const node = obj.points[i];
                    const nodeInCanvas = { x: node.x + obj.x, y: node.y + obj.y };
                    if (Math.hypot(point.x - nodeInCanvas.x, point.y - nodeInCanvas.y) < tolerance) {
                        return { pathId: objId, pointIndex: i, isStartNode: false };
                    }
                }
            }
        }
        return null;
    };

    const handleDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
        if (timeline.playing) {
            dispatch({ type: 'SET_TIMELINE_PLAYING', payload: false });
        }
        if (ui.isEditingGradient) return;
        const svgPoint = getSVGPoint(e);
        const svg = svgRef.current;
        if (!svg) return;

        if (currentTool === 'pen') {
            dispatch({ type: 'FINISH_DRAWING_PATH', payload: { closed: false } });
            return;
        }

        let hitId = hitTestAtPoint(e.clientX, e.clientY, svg, Object.values(objects), [...(zStack || [])].reverse());

        if (!hitId) {
            const best = findBestPathHit(svgPoint, canvas.zoom, objects, zStack, state.selectedObjectIds);
            if (best?.hit?.kind === 'anchor') {
                const ensured = ensureCubicHandles(best.path, best.hit.pointIndex);
                if (ensured) {
                    dispatch({ type: 'UPDATE_PATH_POINT', payload: { pathId: best.pathId, pointIndex: best.hit.pointIndex, newPoint: ensured } });
                } else {
                    const point = best.path.points[best.hit.pointIndex];
                    dispatch({ type: 'UPDATE_PATH_POINT', payload: { pathId: best.pathId, pointIndex: best.hit.pointIndex, newPoint: { ...point, handleIn: null, handleOut: null, mode: 'corner' } } });
                }
                return;
            }
        }

        if (hitId && objects[hitId]?.type === 'path') {
            const pathId = hitId;
            const path = objects[pathId] as PathObject;
            const hit = hitTestEnhanced(svgPoint, canvas.zoom, pathId, path, objects);

            if (hit?.kind === 'anchor') {
                const ensured = ensureCubicHandles(path, hit.pointIndex);
                if (ensured) {
                    dispatch({
                        type: 'UPDATE_PATH_POINT',
                        payload: {
                            pathId,
                            pointIndex: hit.pointIndex,
                            newPoint: ensured
                        }
                    });
                } else {
                    const point = path.points[hit.pointIndex];
                    dispatch({
                        type: 'UPDATE_PATH_POINT',
                        payload: {
                            pathId,
                            pointIndex: hit.pointIndex,
                            newPoint: { ...point, handleIn: null, handleOut: null, mode: 'corner' }
                        }
                    });
                }
            } else if (hit?.kind === 'segment') {
                const closest = findClosestPointOnPathWorld(path, objects, svgPoint);
                if (!closest) return;

                const localP = worldToLocal(asPathSpace(path), closest.point, objects);
                dispatch({
                    type: 'ADD_PATH_NODE',
                    payload: {
                        pathId,
                        segmentIndex: hit.index,
                        point: localP,
                    }
                });
                return;
            }
        } else if (hitId && objects[hitId]) {
            if (objects[hitId].type === 'path' && !ui.isEditingGradient) {
                dispatch({ type: 'SET_TOOL', payload: 'path-edit' });
            } else {
                dispatch({ type: 'SET_TOOL', payload: 'select' });
            }
        }
    };

    const handleCommit = (propertyId: PropertyId, startValue?: any) => {
        const batchId = nanoid();
        const historyMeta = { groupId: batchId };

        dispatch({ type: 'COMMIT_DRAG', meta: { history: historyMeta } });

        const objectId = selectedObjectIds[0];
        let dispatchedKeyframe = false;

        if (objectId) {
            const layerTrack = timeline.layers?.[objectId];
            if (layerTrack?.properties?.some((p: { id: PropertyId }) => p.id === propertyId)) {
                const safeStart = (startValue && typeof startValue === 'string') ? startValue : undefined;
                dispatch({
                    type: 'ADD_KEYFRAME_TO_PROPERTY',
                    payload: { objectId, propertyId, timeMs: timeline.playheadMs, startValue: safeStart },
                    meta: { history: historyMeta }
                });
                dispatchedKeyframe = true;
            }
        }

        dispatch({ type: 'HISTORY_COMMIT_BATCH', payload: { groupId: batchId } });
    };

    const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
        if (ui.isDraggingLayer) return;

        // A pan action shouldn't pause playback.
        const isPan = e.button === 1;

        if (timeline.playing && !isPan) {
            dispatch({ type: 'SET_TIMELINE_PLAYING', payload: false });
        }

        const svg = svgRef.current;
        if (!svg) return;

        if ((currentTool as string) === 'pan' || (e.button === 1 && (currentTool as string) !== 'pan')) {
            interactionStateRef.current = {
                type: 'panning',
                start: { x: e.clientX, y: e.clientY },
                initialPan: { x: canvas.pan?.x || 0, y: canvas.pan?.y || 0 },
                hasHistoryEntry: false,
            };
            setCursor('grabbing');
            return;
        }

        const svgPoint = getSVGPoint(e);

        if (currentTool === 'add-node' || currentTool === 'remove-node') {
            const best = findBestPathHit(svgPoint, canvas.zoom, objects, zStack, state.selectedObjectIds);
            if (!best) return;

            const isSelected = selectedObjectIds.includes(best.pathId);

            if (!isSelected) {
                dispatch({ type: 'SELECT_OBJECT', payload: { id: best.pathId, shiftKey: false } });
                return;
            }

            if (currentTool === 'add-node' && best.hit && best.hit.kind === 'segment') {
                const { pathId, path } = best;
                const closest = findClosestPointOnPathWorld(path, objects, svgPoint);
                if (closest) {
                    const localP = worldToLocal(asPathSpace(path), closest.point, objects);
                    dispatch({
                        type: 'ADD_PATH_NODE',
                        payload: { pathId, segmentIndex: best.hit.index, point: localP }
                    });
                    dispatch({ type: 'COMMIT_DRAG' });
                }
            } else if (currentTool === 'remove-node' && best.hit && best.hit.kind === 'anchor') {
                dispatch({
                    type: 'REMOVE_PATH_NODE',
                    payload: { pathId: best.pathId, pointIndex: best.hit.pointIndex }
                });
                dispatch({ type: 'COMMIT_DRAG' });
            }
            return;
        }

        const effectHit = hitTestEffectHandles(svgPoint, canvas.zoom, objects, selectedObjectIds);
        if (effectHit && effectHit.kind === 'effect-handle') {
            e.currentTarget.setPointerCapture(e.pointerId);
            interactionStateRef.current = {
                type: 'editing-effect-handle',
                start: svgPoint,
                objectId: effectHit.objectId,
                which: effectHit.which as any,
                hasHistoryEntry: false
            };
            return;
        }

        const hoveredInteraction = getHoveredInteraction(
            svgPoint,
            overallBBox,
            canvas.zoom,
            ui.isEditingGradient,
            selectedObjectIds.length === 1 ? objects[selectedObjectIds[0]] : null,
            objects
        );

        if (hoveredInteraction) {
            e.currentTarget.setPointerCapture(e.pointerId);

            const commonAnchor = getCommonAnchorValue();
            let anchorPointCoords: { x: number; y: number; } | null = null;
            if (overallBBox && commonAnchor && selectedObjects.length > 0) {
                if (selectedObjects.length === 1) {
                    anchorPointCoords = getWorldAnchor(selectedObjects[0], objects);
                } else {
                    anchorPointCoords = { x: overallBBox.cx, y: overallBBox.cy };
                }
            }

            const selectionLock = isSelectionConstrained(state.objects, selectedObjectIds);

            switch (hoveredInteraction.type) {
                case 'resize':
                    interactionStateRef.current = {
                        type: 'resizing',
                        start: svgPoint,
                        resizeHandle: hoveredInteraction.handle,
                        originalObjects: new Map(selectedObjects.map(obj => [obj.id, { ...obj }])),
                        groupBBox: overallBBox!,
                        shiftKey: e.shiftKey,
                        altKey: e.altKey,
                        constrainActive: state.constrainTransform || selectionLock,
                        anchorPointInCanvasSpace: anchorPointCoords!,
                        hasHistoryEntry: false,
                    };
                    return;
                case 'rotate':
                    dispatch({ type: 'SET_TIMELINE_PLAYING', payload: false });
                    interactionStateRef.current = {
                        type: 'rotating',
                        start: svgPoint,
                        center: anchorPointCoords!,
                        originalObjects: new Map(selectedObjects.map(obj => [obj.id, { ...obj }])),
                        baseRotation: selectedObjects[0].rotation ?? 0,
                        shiftKey: e.shiftKey,
                        constrainActive: state.constrainTransform || selectionLock,
                        hasHistoryEntry: false,
                        wasPlaying: timeline.playing,
                    }
                    return;
                case 'move':
                    const startBBox = getOverallBBox(selectedObjects, objects);
                    interactionStateRef.current = {
                        type: 'moving',
                        start: svgPoint,
                        originalObjects: new Map(selectedObjects.map(obj => [obj.id, { ...obj }])),
                        shiftKey: e.shiftKey,
                        constrainActive: state.constrainTransform || selectionLock,
                        hasHistoryEntry: false,
                        startCenter: startBBox ? { x: startBBox.cx, y: startBBox.cy } : undefined,
                        snap: { active: false, targetId: null, offset: { x: 0, y: 0 }, lines: [] },
                    };
                    return;
            }
        }

        if (ui.isEditingGradient && overallBBox) {
            const inside =
                svgPoint.x >= overallBBox.x &&
                svgPoint.x <= overallBBox.x + overallBBox.width &&
                svgPoint.y >= overallBBox.y &&
                svgPoint.y <= overallBBox.y + overallBBox.height;

            if (!inside) {
                dispatch({ type: 'SET_EDITING_GRADIENT', payload: false });
            }
        }

        if (ui.isEditingGradient) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if (currentTool === 'path-edit' && !ui.isEditingGradient) {
            const best = findBestPathHit(svgPoint, canvas.zoom, objects, zStack, state.selectedObjectIds);

            if (best) {
                const { hit, pathId, path } = best;

                e.currentTarget.setPointerCapture(e.pointerId);
                e.preventDefault();
                e.stopPropagation();

                if (hit?.kind === 'handle') {
                    const h = hit as Extract<typeof hit, { kind: 'handle' }>;
                    dispatch({ type: 'SELECT_PATH_NODE', payload: { pathId, pointIndex: h.pointIndex }, additive: true });
                    const p0 = path.points[h.pointIndex];
                    const originWorld = localToWorld(asPathSpace(path), p0, objects);
                    interactionStateRef.current = {
                        type: 'editing-handle',
                        pathId,
                        pointIndex: h.pointIndex,
                        which: h.which,
                        start: svgPoint,
                        origin: originWorld,
                        hasHistoryEntry: false,
                    };
                    return;
                }

                if (hit?.kind === 'anchor') {
                    const h = hit as Extract<typeof hit, { kind: 'anchor' }>;
                    const additive = e.metaKey || e.ctrlKey || e.shiftKey;
                    const alreadySelected = (state.selectedPathNodes || []).some(
                        n => n.pathId === pathId && n.pointIndex === h.pointIndex
                    );

                    let selectionAfterClick: Array<{ pathId: string; pointIndex: number }>;
                    if (additive) {
                        selectionAfterClick = alreadySelected
                            ? (state.selectedPathNodes || []).filter(n => !(n.pathId === pathId && n.pointIndex === h.pointIndex))
                            : [...(state.selectedPathNodes || []), { pathId, pointIndex: h.pointIndex }];
                    } else {
                        selectionAfterClick =
                            alreadySelected && (state.selectedPathNodes?.length ?? 0) > 0
                                ? [...state.selectedPathNodes!]
                                : [{ pathId, pointIndex: h.pointIndex }];
                    }

                    dispatch({ type: 'SET_SELECTED_PATH_NODES', payload: { nodes: selectionAfterClick } });

                    const movingNodes = selectionAfterClick.map(n => {
                        const pObj = objects[n.pathId] as PathObject;
                        const pth = asPathSpace(pObj);
                        const pt = pObj.points[n.pointIndex];
                        return {
                            ...n,
                            startWorld: localToWorld(pth, pt, objects),
                            startLocal: { x: pt.x, y: pt.y },
                            startHandleIn: pt.handleIn ? { ...pt.handleIn } : null,
                            startHandleOut: pt.handleOut ? { ...pt.handleOut } : null,
                        };
                    });

                    interactionStateRef.current = {
                        type: 'editing-path',
                        start: svgPoint,
                        movingNodes,
                        hasHistoryEntry: false,
                    };
                    return;
                }

                if (hit?.kind === 'segment') {
                    dispatch({ type: 'SELECT_OBJECT', payload: { id: pathId, shiftKey: e.shiftKey } });
                    return;
                }
            }

            let hitId = hitTestAtPoint(e.clientX, e.clientY, svg, Object.values(objects), [...(zStack || [])].reverse());

            if (!hitId) {
                dispatch({ type: 'CLEAR_SELECTION' });
                dispatch({ type: 'CLEAR_SELECTED_PATH_NODES' });
                interactionStateRef.current = {
                    type: 'possible-node-marquee',
                    start: { x: (e as any).nativeEvent.offsetX, y: (e as any).nativeEvent.offsetY },
                    shiftKey: e.shiftKey,
                    hasHistoryEntry: false,
                };
            }
            return;
        }

        if (currentTool === 'pen') {
            if (!drawingPath) {
                dispatch({ type: 'START_DRAWING_PATH', payload: { point: svgPoint } });
            } else {
                const nearbyNode = findNearbyNode(svgPoint, canvas.zoom);
                if (nearbyNode?.isStartNode) {
                    dispatch({ type: 'FINISH_DRAWING_PATH', payload: { closed: true } });
                    return;
                }
                dispatch({ type: 'UPDATE_DRAWING_PATH', payload: { point: svgPoint } });
            }
            return;
        }


        if (currentTool === 'select') {
            const pickOrder = [...(zStack || [])].reverse();
            let hitId = hitTestAtPoint(e.clientX, e.clientY, svg, Object.values(objects), pickOrder);

            if (hitId) {
                let isLockedInHierarchy = false;
                let tempCurrent: SvgObject | undefined = objects[hitId];
                while (tempCurrent) {
                    if (tempCurrent.locked) {
                        isLockedInHierarchy = true;
                        break;
                    }
                    tempCurrent = tempCurrent.parentId ? objects[tempCurrent.parentId] : undefined;
                }

                if (isLockedInHierarchy) {
                    return;
                }

                let current = objects[hitId];
                let topLevelObject = current;

                while (current && current.parentId) {
                    const parent = objects[current.parentId];
                    if (parent) {
                        topLevelObject = parent;
                        current = parent;
                    } else {
                        break;
                    }
                }
                hitId = topLevelObject.id;

                const isSelected = selectedObjectIds.includes(hitId);

                if (isSelected && objects[hitId].type === 'path' && !ui.isEditingGradient) {
                    dispatch({ type: 'SET_TOOL', payload: 'path-edit' });
                    return;
                }

                if (!isSelected) {
                    dispatch({ type: 'SELECT_OBJECT', payload: { id: hitId, shiftKey: e.shiftKey } });
                }

                const currentSelection = e.shiftKey ? [...state.selectedObjectIds, hitId].filter((v, i, a) => a.indexOf(v) === i) : [hitId];
                const originalObjectsArr = currentSelection.map(id => state.objects[id]).filter(Boolean);
                const selectionLock = isSelectionConstrained(state.objects, currentSelection);
                const startBBox = getOverallBBox(originalObjectsArr, objects);

                interactionStateRef.current = {
                    type: 'moving',
                    start: svgPoint,
                    originalObjects: new Map(originalObjectsArr.map(obj => [obj.id, { ...obj }])),
                    shiftKey: e.shiftKey,
                    constrainActive: state.constrainTransform || selectionLock,
                    hasHistoryEntry: false,
                    startCenter: startBBox ? { x: startBBox.cx, y: startBBox.cy } : undefined,
                    snap: { active: false, targetId: null, offset: { x: 0, y: 0 }, lines: [] },
                };
                return;
            }

            if (!e.shiftKey) {
                dispatch({ type: 'CLEAR_SELECTION' });
            }
            interactionStateRef.current = {
                type: 'possible-marquee',
                start: { x: (e as any).nativeEvent.offsetX, y: (e as any).nativeEvent.offsetY }
            };
            return;
        }

        if (creationTools.includes(currentTool)) {
            const newObjectId = nanoid();
            const commonProps = {
                id: newObjectId,
                layerId: newObjectId,
                name: currentTool.charAt(0).toUpperCase() + currentTool.slice(1),
                x: svgPoint.x,
                y: svgPoint.y,
                fill: '#cccccc',
                stroke: '#333333',
                strokeWidth: 1,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                isConstrained: false,
                anchorPosition: 'center' as const,
                visible: true, locked: false, parentId: null,
            };
            let newObject: SvgObject;

            switch (currentTool) {
                case 'rectangle':
                    newObject = { ...commonProps, type: 'rectangle', width: 0, height: 0, corners: { tl: 0, tr: 0, br: 0, bl: 0 }, cornersLinked: true };
                    break;
                case 'ellipse':
                    newObject = { ...commonProps, type: 'ellipse', rx: 0, ry: 0 };
                    break;
                case 'star':
                    newObject = { ...commonProps, type: 'star', points: 5, outerRadius: 0, innerRadius: 0 };
                    break;
                case 'polygon':
                    newObject = { ...commonProps, type: 'polygon', sides: 6, radius: 0 };
                    break;
                case 'text':
                    newObject = { ...commonProps, type: 'text', text: "Hello", fontSize: 48, fontWeight: 'normal' };
                    dispatch({ type: 'ADD_OBJECT', payload: newObject });
                    dispatch({ type: 'SELECT_OBJECT', payload: { id: newObject.id, shiftKey: false } });
                    dispatch({ type: 'SET_TOOL', payload: 'select' });
                    dispatch({ type: 'COMMIT_DRAG' });
                    return;
                case 'line':
                    newObject = { ...commonProps, type: 'path', isLine: true, points: [{ x: 0, y: 0, mode: 'corner' }, { x: 0, y: 0, mode: 'corner' }], closed: false, anchorPosition: 'origin', strokeLineCap: 'butt' };
                    break;
                default: return;
            }

            dispatch({ type: 'ADD_OBJECT', payload: newObject, transient: true });
            dispatch({ type: 'SELECT_OBJECT', payload: { id: newObjectId, shiftKey: false }, transient: true });
            const originalObjects = new Map<string, SvgObject>();
            originalObjects.set(newObjectId, newObject);
            interactionStateRef.current = {
                type: 'drawing',
                start: svgPoint,
                objectId: newObjectId,
                originalObjects: originalObjects,
                shiftKey: e.shiftKey,
                hasHistoryEntry: false,
                isDrag: false
            };
        }
    };

    const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
        if (ui.isDraggingLayer) return;

        const interactionState = interactionStateRef.current;
        let svgPoint = getSVGPoint(e);

        if (interactionState.type === 'panning') {
            if (!interactionState.initialPan) return;
            const dx = e.clientX - interactionState.start.x;
            const dy = e.clientY - interactionState.start.y;
            dispatch({
                type: 'UPDATE_CANVAS',
                payload: {
                    pan: {
                        x: interactionState.initialPan.x + dx,
                        y: interactionState.initialPan.y + dy
                    }
                },
                transient: true
            });
            interactionState.hasHistoryEntry = true;
            return;
        }


        if (!interactionState.type) {
            // Check effect handles (Cursor only)
            const effectHit = hitTestEffectHandles(svgPoint, canvas.zoom, objects, selectedObjectIds);
            if (effectHit && effectHit.kind === 'effect-handle') {
                setCursor('grab');
                return;
            }

            if (currentTool === 'pan') {
                setCursor('grab');
                return;
            }
            if (currentTool === 'pen' || currentTool === 'path-edit' || currentTool === 'add-node' || currentTool === 'remove-node') {
                const best = findBestPathHit(svgPoint, canvas.zoom, objects, zStack, selectedObjectIds);
                if (best?.hit?.kind === 'segment' && currentTool === 'add-node') {
                    setCursor('crosshair'); // Placeholder for add icon
                } else if (best?.hit?.kind === 'anchor' && currentTool === 'remove-node') {
                    setCursor('crosshair'); // Placeholder for remove icon
                }
                else {
                    setCursor('default');
                }
                return;
            }
            if (creationTools.includes(currentTool)) {
                setCursor('crosshair');
                return;
            }

            let newCursor = 'default';

            if (overallBBox) {
                const hoveredInteraction = getHoveredInteraction(
                    svgPoint,
                    overallBBox,
                    canvas.zoom,
                    ui.isEditingGradient,
                    selectedObjectIds.length === 1 ? objects[selectedObjectIds[0]] : null,
                    objects
                );
                if (hoveredInteraction) {
                    switch (hoveredInteraction.type) {
                        case 'resize':
                            newCursor = getRotatedCursor(hoveredInteraction.cursor, overallBBox.rotation);
                            break;
                        case 'rotate':
                            newCursor = `url('data:image/svg+xml;base64,${btoa(ROTATION_CURSOR_SVG)}') 11 11, auto`;
                            break;
                        case 'move':
                            newCursor = 'move';
                            break;
                    }
                }
            }

            if (cursor !== newCursor) {
                setCursor(newCursor);
            }
        }


        if (!interactionState.type) return;

        if (interactionState.type === 'possible-marquee' || interactionState.type === 'possible-node-marquee') {
            const { start } = interactionState;
            const dx = (e as any).nativeEvent.offsetX - start.x;
            const dy = (e as any).nativeEvent.offsetY - start.y;
            if (Math.hypot(dx, dy) > 5) {
                interactionStateRef.current.type = interactionState.type === 'possible-marquee' ? 'marquee' : 'node-marquee';
            } else {
                return;
            }
        }

        if (interactionState.type === 'marquee' || interactionState.type === 'node-marquee') {
            const { start } = interactionState;
            const currentX = (e as any).nativeEvent.offsetX;
            const currentY = (e as any).nativeEvent.offsetY;
            const marqueeX = Math.min(start.x, currentX);
            const marqueeY = Math.min(start.y, currentY);
            const marqueeWidth = Math.abs(currentX - start.x);
            const marqueeHeight = Math.abs(currentY - start.y);
            setMarqueeRect({ x: marqueeX, y: marqueeY, width: marqueeWidth, height: marqueeHeight });
            return;
        }

        const dx = svgPoint.x - interactionState.start.x;
        const dy = svgPoint.y - interactionState.start.y;

        if ((interactionState.type === 'drawing' || interactionState.type === 'moving') && !interactionState.isDrag) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 5) {
                interactionState.isDrag = true;
            }
        }

        const liveShift = e.shiftKey;
        const liveToggle = state.constrainTransform;
        const liveSelLock = isSelectionConstrained(state.objects, selectedObjectIds);

        const shouldConstrain = liveShift || liveToggle || liveSelLock || interactionState.shiftKey || interactionState.constrainActive;


        switch (interactionState.type) {
            case 'editing-handle': {
                const { pathId, pointIndex, which } = interactionState;
                if (pathId == null || pointIndex == null || which == null) break;

                const path = objects[pathId] as PathObject;
                const pth = asPathSpace(path);
                const curLocal = worldToLocal(pth, svgPoint, objects);

                if (!isFinitePoint(curLocal)) break;

                const p0 = path.points[pointIndex];
                let { handleIn, handleOut } = p0;

                if (which === 1) handleOut = { x: curLocal.x, y: curLocal.y };
                else handleIn = { x: curLocal.x, y: curLocal.y };

                let mode = p0.mode ?? 'free';
                if (e.altKey) mode = 'free';

                if (mode === 'mirror' && handleOut && handleIn) {
                    const vx = p0.x - (which === 1 ? handleOut.x : handleIn.x);
                    const vy = p0.y - (which === 1 ? handleOut.y : handleIn.y);
                    if (which === 1) {
                        if (handleIn) handleIn = { x: p0.x + vx, y: p0.y + vy };
                    }
                    else {
                        if (handleOut) handleOut = { x: p0.x + vx, y: p0.y + vy };
                    }
                } else if (mode === 'aligned' && handleOut && handleIn) {
                    const ox = (which === 1 ? handleOut.x : handleIn.x) - p0.x;
                    const oy = (which === 1 ? handleOut.y : handleIn.y) - p0.y;
                    const len = Math.hypot(ox, oy) || 1;
                    const ux = ox / len, uy = oy / len;
                    const other = (which === 1 ? handleIn : handleOut);
                    if (other) {
                        const otherLen = Math.hypot(other.x - p0.x, other.y - p0.y);
                        if (which === 1) handleIn = { x: p0.x - ux * otherLen, y: p0.y - uy * otherLen };
                        else handleOut = { x: p0.x - ux * otherLen, y: p0.y - uy * otherLen };
                    }
                }

                dispatch({
                    type: 'UPDATE_PATH_POINT',
                    payload: { pathId, pointIndex, newPoint: { ...p0, handleIn, handleOut } },
                    transient: true
                });
                interactionState.hasHistoryEntry = true;
                break;
            }
            case 'editing-path': {
                const st = interactionState;
                const nodes = st.movingNodes || [];
                if (!nodes.length) break;

                const dWx = svgPoint.x - st.start.x;
                const dWy = svgPoint.y - st.start.y;

                for (const mn of nodes) {
                    const path = objects[mn.pathId] as PathObject;
                    const pth = asPathSpace(path);

                    const newWorld = { x: mn.startWorld.x + dWx, y: mn.startWorld.y + dWy };
                    const newLocal = worldToLocal(pth, newWorld, objects);
                    if (!isFinitePoint(newLocal)) continue;

                    const ddx = newLocal.x - mn.startLocal.x;
                    const ddy = newLocal.y - mn.startLocal.y;

                    const old = path.points[mn.pointIndex];

                    dispatch({
                        type: 'UPDATE_PATH_POINT',
                        payload: {
                            pathId: mn.pathId,
                            pointIndex: mn.pointIndex,
                            newPoint: {
                                ...old,
                                x: newLocal.x,
                                y: newLocal.y,
                                handleIn: mn.startHandleIn
                                    ? { x: mn.startHandleIn.x + ddx, y: mn.startHandleIn.y + ddy }
                                    : null,
                                handleOut: mn.startHandleOut
                                    ? { x: mn.startHandleOut.x + ddx, y: mn.startHandleOut.y + ddy }
                                    : null,
                            },
                        },
                        transient: true,
                    });
                }

                interactionState.hasHistoryEntry = true;
                break;
            }
            case 'drawing': {
                const st = interactionState;
                if (!st.objectId || !st.originalObjects) return;

                const obj = st.originalObjects.get(st.objectId);
                if (!obj) return;

                let updates: Partial<SvgObject> = {};
                const { shiftKey } = st;

                if (obj.type === 'path' && obj.isLine) {
                    updates = {
                        points: [
                            { x: 0, y: 0, mode: 'corner' },
                            { x: dx, y: dy, mode: 'corner' }
                        ]
                    };
                } else {
                    let width = dx;
                    let height = dy;

                    if (shiftKey) {
                        const max_dim = Math.max(Math.abs(width), Math.abs(height));
                        width = max_dim * Math.sign(width || 1);
                        height = max_dim * Math.sign(height || 1);
                    }

                    switch (obj.type) {
                        case 'rectangle':
                            updates = { width: width, height: height, x: st.start.x + width / 2, y: st.start.y + height / 2 };
                            break;
                        case 'ellipse':
                            updates = { rx: width / 2, ry: height / 2, x: st.start.x + width / 2, y: st.start.y + height / 2 };
                            break;
                        case 'star':
                            const radiusS = Math.hypot(dx, dy);
                            updates = { outerRadius: radiusS, innerRadius: radiusS / 2, x: st.start.x, y: st.start.y };
                            break;
                        case 'polygon':
                            const radiusP = Math.hypot(dx, dy);
                            updates = { radius: radiusP, x: st.start.x, y: st.start.y };
                            break;
                    }
                }
                dispatch({ type: 'UPDATE_OBJECTS', payload: { ids: [st.objectId], updates }, transient: true });
                st.hasHistoryEntry = true;
                break;
            }
            case 'moving': {
                const st = interactionStateRef.current;
                if (!st.originalObjects || !st.startCenter) break;

                // 1) delta crudo desde el inicio del drag
                const rawDx = svgPoint.x - st.start.x;
                const rawDy = svgPoint.y - st.start.y;

                // 2) centro propuesto del grupo (sin snap)
                const proposedCenter = { x: st.startCenter.x + rawDx, y: st.startCenter.y + rawDy };

                // 3) Histeresis
                const ENTER = 6 / canvas.zoom;
                const EXIT = 10 / canvas.zoom;

                // 4) Calcula snap sugerido
                const { snappedCenter, lines, targetId } = getSmartSnapCenter(
                    proposedCenter,
                    selectedObjectIds,
                    objects,
                    canvas.zoom,
                    { x: 0, y: 0, width: canvas.width, height: canvas.height }
                );

                // 5) Decide enganchar, mantener o soltar
                let snapActive = st.snap?.active ?? false;
                let snapOffset = st.snap?.offset ?? { x: 0, y: 0 };
                let snapTarget = st.snap?.targetId ?? null;

                const distToSnap = Math.hypot(snappedCenter.x - proposedCenter.x, snappedCenter.y - proposedCenter.y);

                if (!snapActive) {
                    // Entrar si estamos dentro del umbral
                    if (distToSnap <= ENTER) {
                        snapActive = true;
                        snapTarget = targetId ?? 'center'; // algún id estable
                        // offset para continuidad = (propuesto - snapped) -> restarlo preserva posición visual
                        snapOffset = { x: proposedCenter.x - snappedCenter.x, y: proposedCenter.y - snappedCenter.y };
                    }
                } else {
                    // Mantener mientras no salgamos del umbral de salida respecto AL MISMO objetivo
                    if (targetId === snapTarget && distToSnap <= EXIT) {
                        // stay snapped
                    } else {
                        // soltar
                        snapActive = false;
                        snapTarget = null;
                        snapOffset = { x: 0, y: 0 };
                    }
                }

                // 6) Centro final (con continuidad si está activo)
                let finalCenter = proposedCenter;
                if (snapActive) {
                    finalCenter = { x: proposedCenter.x - snapOffset.x, y: proposedCenter.y - snapOffset.y };
                }

                // 7) Delta final a aplicar a cada objeto respecto a su posición ORIGINAL
                const finalDx = finalCenter.x - st.startCenter.x;
                const finalDy = finalCenter.y - st.startCenter.y;

                // (Opcional) bloqueo de eje cuando constrain está activo
                const lock = st.constrainActive || e.shiftKey || state.constrainTransform;
                const mx = lock ? (Math.abs(finalDx) >= Math.abs(finalDy) ? finalDx : 0) : finalDx;
                const my = lock ? (Math.abs(finalDy) > Math.abs(finalDx) ? finalDy : 0) : finalDy;

                // 8) Aplicar
                for (const id of Array.from(st.originalObjects.keys())) {
                    const orig = st.originalObjects.get(id)!;
                    const upd: Partial<SvgObject> = {};
                    if ('x' in orig) upd.x = orig.x + mx;
                    if ('y' in orig) upd.y = orig.y + my;
                    dispatch({ type: 'UPDATE_OBJECTS', payload: { ids: [id], updates: upd }, transient: true });
                }

                // 9) UI de guías
                const snapLines = snapActive ? lines : [];
                interactionStateRef.current.snap = { active: snapActive, targetId: snapTarget, offset: snapOffset, lines: snapLines };
                dispatch({ type: 'SET_SNAP_LINES', payload: snapLines, transient: true });

                st.hasHistoryEntry = true;
                break;
            }
            case 'resizing': {
                const { originalObjects, groupBBox, resizeHandle, anchorPointInCanvasSpace } = interactionState;
                if (!originalObjects || !groupBBox || !resizeHandle || !anchorPointInCanvasSpace) return;

                const isGroup = originalObjects.size > 1 || Array.from(originalObjects.values()).some(o => o.type === 'group');
                const delta = { x: dx, y: dy };
                const modifiers = {
                    shift: !!shouldConstrain,
                    alt: e.altKey,
                    ctrl: e.metaKey || e.ctrlKey,
                };

                originalObjects.forEach((orig, id) => {
                    const updates = transformObjectByResize({
                        object: orig,
                        handle: resizeHandle,
                        anchor: anchorPointInCanvasSpace,
                        delta,
                        modifiers,
                        isGroup,
                        groupBBox,
                        objects: state.objects,
                    });
                    dispatch({ type: 'UPDATE_OBJECTS', payload: { ids: [id], updates }, transient: true });
                });
                interactionState.hasHistoryEntry = true;
                break;
            }
            case 'rotating': {
                const { center, baseRotation, constrainActive, originalObjects } = interactionState;
                if (!center || baseRotation === undefined || !originalObjects) return;

                const startAngle = Math.atan2(interactionState.start.y - center.y, interactionState.start.x - center.x) * (180 / Math.PI);
                const currentAngle = Math.atan2(svgPoint.y - center.y, svgPoint.x - center.x) * (180 / Math.PI);

                let angleDiff = currentAngle - startAngle;

                const firstObject = Array.from(originalObjects.values())[0];
                if (!firstObject) return;

                let newRotation = (baseRotation ?? 0) + angleDiff;

                if (constrainActive) {
                    newRotation = Math.round(newRotation / 15) * 15;
                }

                dispatch({
                    type: 'ROTATE_OBJECTS',
                    payload: { ids: selectedObjectIds, angle: newRotation, center },
                    transient: true
                });
                interactionState.hasHistoryEntry = true;
                break;
            }
            case 'editing-effect-handle': {
                const { objectId, which } = interactionState;
                if (!objectId) return;
                const obj = objects[objectId];
                if (!obj || !obj.bend?.enabled) return;

                // Convert current mouse position to Bend Space
                const newBendPoint = worldToBend(svgPoint, obj);

                const newBend = { ...obj.bend };
                if (which === 'bend-start') {
                    newBend.start = newBendPoint;
                } else if (which === 'bend-end') {
                    newBend.end = newBendPoint;
                }

                dispatch({
                    type: 'UPDATE_OBJECTS',
                    payload: { ids: [objectId], updates: { bend: newBend } },
                    transient: true
                });
                interactionState.hasHistoryEntry = true;
                break;
            }
        }
    };

    const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
        const interactionState = interactionStateRef.current;

        if (interactionState.type === 'node-marquee' && marqueeRect) {
            const { pan, zoom } = canvas;
            const rect = {
                x: (marqueeRect.x - (pan?.x || 0)) / zoom,
                y: (marqueeRect.y - (pan?.y || 0)) / zoom,
                width: marqueeRect.width / zoom,
                height: marqueeRect.height / zoom,
            };

            const inRect = (p: { x: number; y: number }) =>
                p.x >= rect.x &&
                p.x <= rect.x + rect.width &&
                p.y >= rect.y &&
                p.y <= rect.y + rect.height;

            const hits: Array<{ pathId: string; pointIndex: number }> = [];
            const paths = Object.values(objects).filter(
                (o): o is PathObject => o?.type === 'path' && o.visible !== false && !o.locked
            );

            for (const p of paths) {
                const pth = asPathSpace(p);
                for (let i = 0; i < p.points.length; i++) {
                    const n = p.points[i];
                    const world = localToWorld(pth, n, objects);
                    if (inRect(world)) {
                        hits.push({ pathId: p.id, pointIndex: i });
                    }
                }
            }

            if (interactionState.shiftKey) {
                const merged = [...(state.selectedPathNodes || []), ...hits];
                const dedup = Array.from(new Set(merged.map(n => `${n.pathId}:${n.pointIndex}`)))
                    .map(k => {
                        const [pathId, idx] = k.split(':');
                        return { pathId, pointIndex: Number(idx) };
                    });
                dispatch({ type: 'SET_SELECTED_PATH_NODES', payload: { nodes: dedup } });
            } else {
                dispatch({ type: 'SET_SELECTED_PATH_NODES', payload: { nodes: hits } });
            }

            setMarqueeRect(null);
            dispatch({ type: 'COMMIT_DRAG' });
        } else if (interactionState.type === 'marquee' && marqueeRect) {
            const { pan, zoom } = canvas;
            const marqueeInCanvasSpace = {
                x: (marqueeRect.x - (pan?.x || 0)) / zoom,
                y: (marqueeRect.y - (pan?.y || 0)) / zoom,
                width: marqueeRect.width / zoom,
                height: marqueeRect.height / zoom
            };

            const selectedIds = Object.values(objects)
                .filter(obj => {
                    if (!obj.visible) return false;
                    const objBBox = getVisualBoundingBox(obj, objects);
                    return (
                        marqueeInCanvasSpace.x < objBBox.x + objBBox.width &&
                        marqueeInCanvasSpace.x + marqueeInCanvasSpace.width > objBBox.x &&
                        marqueeInCanvasSpace.y < objBBox.y + objBBox.height &&
                        marqueeInCanvasSpace.y + marqueeInCanvasSpace.height > objBBox.y
                    );
                })
                .map(obj => obj.id);

            if (selectedIds.length > 0) {
                dispatch({ type: 'SELECT_MULTIPLE_OBJECTS', payload: { ids: selectedIds, shiftKey: e.shiftKey } });
            }
        }

        if (interactionState.type === 'drawing') {
            if (!interactionState.isDrag) {
                const id = interactionState.objectId!;
                const original = interactionState.originalObjects?.get(id);

                if (original) {
                    if (original.type === 'rectangle') {
                        dispatch({
                            type: 'UPDATE_OBJECTS',
                            payload: {
                                ids: [id],
                                updates: { width: 100, height: 100, x: original.x, y: original.y }
                            }
                        });
                    } else if (original.type === 'ellipse') {
                        dispatch({
                            type: 'UPDATE_OBJECTS',
                            payload: {
                                ids: [id],
                                updates: { rx: 50, ry: 50, x: original.x, y: original.y }
                            }
                        });
                    }
                }
            }
            dispatch({ type: 'COMMIT_DRAG' });
            dispatch({ type: 'SET_TOOL', payload: 'select' });
            interactionStateRef.current._committed = true;
        }

        if (interactionState.hasHistoryEntry && !interactionState._committed) {
            if (interactionState.type === 'rotating') {
                handleCommit('rotation', interactionState.baseRotation);
            } else if (interactionState.type === 'moving') {
                handleCommit('position', interactionState.startCenter);
            } else if (interactionState.type === 'resizing') {
                handleCommit('scale', { x: 1, y: 1 });
            } else {
                dispatch({ type: 'COMMIT_DRAG' });
            }
            interactionStateRef.current._committed = true;

            if (interactionState.wasPlaying) {
                dispatch({ type: 'SET_TIMELINE_PLAYING', payload: true });
            }
        }

        dispatch({ type: 'SET_SNAP_LINES', payload: [], transient: true });
        setMarqueeRect(null);
        interactionStateRef.current = { type: null, start: { x: 0, y: 0 } };
    };

    const handlePointerLeave = (e: PointerEvent<HTMLDivElement>) => {
        const interactionState = interactionStateRef.current;
        if (interactionState.type) {
            handlePointerUp(e);
        }
    }

    // Zoom and Scroll Logic
    useCanvasZoom(containerRef, zoomActionsRef);

    const commonAnchor = getCommonAnchorValue();
    let anchorPointCoords: { x: number; y: number; } | null = null;
    if (overallBBox && commonAnchor && selectedObjects.length > 0) {
        if (selectedObjects.length === 1) {
            anchorPointCoords = getWorldAnchor(selectedObjects[0], objects);
        } else {
            anchorPointCoords = { x: overallBBox.cx, y: overallBBox.cy };
        }
    }

    const renderHandles = (bbox: BoundingBox & { rotation: number, cx: number, cy: number }) => {
        const handleSize = 8;
        const h2 = handleSize / 2;
        const { cx, cy, width, height } = bbox;

        const unrotatedBbox = {
            x: cx - width / 2,
            y: cy - height / 2,
        };

        const handles: { position: ResizeHandle, x: number, y: number, cursor: string }[] = [
            { position: 'nw', x: unrotatedBbox.x, y: unrotatedBbox.y, cursor: 'nwse-resize' },
            { position: 'ne', x: unrotatedBbox.x + width, y: unrotatedBbox.y, cursor: 'nesw-resize' },
            { position: 'sw', x: unrotatedBbox.x, y: unrotatedBbox.y + height, cursor: 'nesw-resize' },
            { position: 'se', x: unrotatedBbox.x + width, y: unrotatedBbox.y + height, cursor: 'nwse-resize' },
            { position: 'n', x: unrotatedBbox.x + width / 2, y: unrotatedBbox.y, cursor: 'ns-resize' },
            { position: 's', x: unrotatedBbox.x + width / 2, y: unrotatedBbox.y + height, cursor: 'ns-resize' },
            { position: 'w', x: unrotatedBbox.x, y: unrotatedBbox.y + height / 2, cursor: 'ew-resize' },
            { position: 'e', x: unrotatedBbox.x + width, y: unrotatedBbox.y + height / 2, cursor: 'ew-resize' },
        ];

        return (
            <g>
                {handles.map(h => (
                    <rect
                        key={h.position}
                        x={h.x - h2}
                        y={h.y - h2}
                        width={handleSize}
                        height={handleSize}
                        fill="hsl(var(--primary))"
                        stroke="#fff"
                        strokeWidth={1 / canvas.zoom}
                        className="cursor-[--cursor]"
                        style={{ '--cursor': getRotatedCursor(h.cursor, bbox.rotation) } as React.CSSProperties}
                        data-handle={h.position}
                    />
                ))}
            </g>
        );
    };

    const canGroup = selectedObjectIds.length >= 2;
    const canUngroup = selectedObjectIds.some(id => objects[id]?.type === 'group');

    const getCommonBooleanValue = (property: 'visible' | 'locked'): boolean => {
        if (selectedObjectIds.length === 0) return property === 'visible'; // Default values
        const firstValue = objects[selectedObjectIds[0]]?.[property] ?? (property === 'visible');
        return selectedObjectIds.every(id => (objects[id]?.[property] ?? (property === 'visible')) === firstValue) ? firstValue : false;
    };

    const isSelectionLocked = getCommonBooleanValue('locked');
    const isSelectionVisible = getCommonBooleanValue('visible');
    const showSelectionUI = currentTool !== 'pan' && currentTool !== 'path-edit' && currentTool !== 'add-node' && currentTool !== 'remove-node';

    const rootObjects = zStack.map(id => objects[id]).filter(obj => obj && !obj.parentId);

    const gradientDefs = Object.values(objects).map(obj => {
        if (typeof obj.fill === 'object' && obj.fill) {
            if (obj.fill.type === 'linear-gradient') {
                const grad = obj.fill as LinearGradientFill;
                return (
                    <linearGradient id={`grad-${obj.id}`} key={`grad-${obj.id}`} x1="0%" y1="0%" x2="100%" y2="0%" gradientTransform={`rotate(${grad.angle})`}>
                        {grad.stops.map(stop => <stop key={stop.id} offset={`${stop.offset * 100}%`} stopColor={stop.color} stopOpacity={stop.opacity ?? 1} />)}
                    </linearGradient>
                );
            }
            if (obj.fill.type === 'radial-gradient') {
                const grad = obj.fill as RadialGradientFill;
                return (
                    <radialGradient id={`grad-${obj.id}`} key={`grad-${obj.id}`} cx={grad.cx} cy={grad.cy} r={grad.r}>
                        {grad.stops.map(stop => <stop key={stop.id} offset={`${stop.offset * 100}%`} stopColor={stop.color} stopOpacity={stop.opacity ?? 1} />)}
                    </radialGradient>
                );
            }
        }
        return null;
    });

    const isObjectVisible = (obj: SvgObject, timeMs: number): boolean => {
        if (obj.visible === false) return false;

        const seg = selectActiveLayerSegment(state, obj.id, timeMs);

        let parentVisible = true;
        if (obj.parentId) {
            const parent = objects[obj.parentId];
            if (parent) {
                parentVisible = isObjectVisible(parent, timeMs);
            } else {
                parentVisible = false;
            }
        }
        return !!seg && parentVisible;
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    ref={containerRef}
                    className="w-full h-full bg-canvas overflow-hidden"
                    onPointerLeave={handlePointerLeave}
                >
                    <div
                        id="selection-overlay"
                        className="absolute inset-0 z-10"
                        style={{ cursor, pointerEvents: ui.isDraggingLayer ? 'none' : 'auto' }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onDoubleClick={handleDoubleClick}
                    >
                        {marqueeRect && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: marqueeRect.x,
                                    top: marqueeRect.y,
                                    width: marqueeRect.width,
                                    height: marqueeRect.height,
                                    border: `1px dashed hsl(var(--primary))`,
                                    backgroundColor: `hsla(var(--primary) / 0.2)`,
                                    pointerEvents: 'none',
                                }}
                            />
                        )}
                    </div>

                    <div
                        className="relative"
                        style={{
                            width: canvas.width,
                            height: canvas.height,
                            transformOrigin: 'top left',
                            transform: `translate(${canvas.pan?.x || 0}px, ${canvas.pan?.y || 0}px) scale(${canvas.zoom})`,
                        }}
                    >
                        <svg
                            ref={svgRef}
                            width={canvas.width}
                            height={canvas.height}
                            className="absolute top-0 left-0"
                            style={{ overflow: 'visible' }}
                            viewBox={`0 0 ${canvas.width} ${canvas.height}`}
                        >
                            <defs>
                                {gradientDefs}
                                <pattern id="dot-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                                    <rect width="20" height="20" fill="#F4F6F8" />
                                    <circle cx="1" cy="1" r="1" fill="#DAE2E8" />
                                </pattern>
                                <clipPath id="canvas-clip">
                                    <rect x="0" y="0" width={canvas.width} height={canvas.height} />
                                </clipPath>
                            </defs>

                            <g id="artboard-group">
                                <rect
                                    id="artboard-bg-transparent"
                                    x="0"
                                    y="0"
                                    width={canvas.width}
                                    height={canvas.height}
                                    fill="url(#dot-grid)"
                                    className="shadow-lg"
                                    visibility={canvas.background === 'transparent' ? 'visible' : 'hidden'}
                                />
                                <rect
                                    id="artboard-bg-color"
                                    x="0"
                                    y="0"
                                    width={canvas.width}
                                    height={canvas.height}
                                    fill={canvas.background}
                                    className="shadow-lg"
                                    visibility={canvas.background === 'transparent' ? 'hidden' : 'visible'}
                                />

                                <g id="visual-layer" clipPath="url(#canvas-clip)">
                                    {rootObjects.map(obj => (
                                        <RenderObject
                                            key={`${obj.id}-visual`}
                                            obj={obj}
                                            selectedObjectIds={selectedObjectIds}
                                            currentTool={currentTool}
                                            allObjects={objects}
                                            selectedPathNodes={selectedPathNodes}
                                            zoom={canvas.zoom}
                                            isVisible={isObjectVisible(obj, timeline.playheadMs)}
                                        />
                                    ))}
                                    {drawingPath && (
                                        <g>
                                            <path
                                                d={buildPathD({
                                                    ...drawingPath,
                                                    points: drawingPath.points.map(p => ({
                                                        ...p,
                                                        x: p.x + drawingPath.x,
                                                        y: p.y + drawingPath.y
                                                    })),
                                                    x: 0,
                                                    y: 0
                                                })}
                                                fill="none"
                                                stroke={drawingPath.stroke}
                                                strokeWidth={drawingPath.strokeWidth}
                                            />
                                            {drawingPath.points.map((p, i) => (
                                                <circle key={i} cx={p.x + drawingPath.x} cy={p.y + drawingPath.y} r="3" fill="blue" />
                                            ))}
                                        </g>
                                    )}
                                </g>

                                <g id="selection-ui-layer">
                                    {(interactionStateRef.current?.snap?.lines || []).map((line, i) => (
                                        <line
                                            key={i}
                                            x1={line.x1}
                                            y1={line.y1}
                                            x2={line.x2}
                                            y2={line.y2}
                                            stroke="hsl(var(--primary))"
                                            strokeWidth={1 / canvas.zoom}
                                            vectorEffect="non-scaling-stroke"
                                        />
                                    ))}
                                    {showSelectionUI && overallBBox && (
                                        <g transform={overallBBox.rotation !== 0 ? `rotate(${overallBBox.rotation} ${overallBBox.cx} ${overallBBox.cy})` : ''}>
                                            <rect
                                                className="pointer-events-none"
                                                x={overallBBox.x}
                                                y={overallBBox.y}
                                                width={overallBBox.width}
                                                height={overallBBox.height}
                                                fill="none"
                                                stroke="hsl(var(--primary))"
                                                strokeWidth={1 / canvas.zoom}
                                                strokeDasharray={`${4 / canvas.zoom} ${2 / canvas.zoom}`}
                                                vectorEffect="non-scaling-stroke"
                                            />
                                            {renderHandles(overallBBox)}
                                        </g>
                                    )}

                                    {showSelectionUI && anchorPointCoords && (
                                        <g className="pointer-events-none">
                                            <circle
                                                cx={anchorPointCoords.x}
                                                cy={anchorPointCoords.y}
                                                r={6 / canvas.zoom}
                                                fill="hsl(var(--primary))"
                                                stroke="#fff"
                                                strokeWidth={1 / canvas.zoom}
                                            />
                                        </g>
                                    )}
                                    {selectedObjects.length === 1 && <BendItOverlay object={selectedObjects[0]} zoom={canvas.zoom} />}
                                </g>
                            </g>
                        </svg>
                    </div>
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem onSelect={() => dispatch({ type: 'CUT_SELECTION' })}
                    disabled={selectedObjectIds.length === 0 || isSelectionLocked}
                >
                    <Scissors className="mr-2 h-4 w-4" /> Cut <ContextMenuShortcut>⌘+X</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => dispatch({ type: 'COPY_SELECTION' })} disabled={selectedObjectIds.length === 0}>
                    <Copy className="mr-2 h-4 w-4" /> Copy <ContextMenuShortcut>⌘+C</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => dispatch({ type: 'PASTE_OBJECTS' })} disabled={clipboard.isEmpty()}>
                    <ClipboardPaste className="mr-2 h-4 w-4" /> Paste <ContextMenuShortcut>⌘+V</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => dispatch({ type: 'DUPLICATE_SELECTED_OBJECTS' })} disabled={selectedObjectIds.length === 0}>
                    <CopyPlus className="mr-2 h-4 w-4" /> Duplicate <ContextMenuShortcut>⌘+D</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => dispatch({ type: 'START_RENAME_LAYER', payload: { id: selectedObjectIds[0] } })} disabled={selectedObjectIds.length !== 1}>
                    <Pencil className="mr-2 h-4 w-4" /> Rename
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => dispatch({ type: 'DELETE_SELECTED' })} disabled={selectedObjectIds.length === 0 || isSelectionLocked}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete <ContextMenuShortcut>Supr</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuSub>
                    <ContextMenuSubTrigger disabled={selectedObjectIds.length === 0 || isSelectionLocked}>Order</ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                        <ContextMenuItem onSelect={() => dispatch({ type: 'BRING_FORWARD', payload: { ids: selectedObjectIds } })}>
                            <ArrowUp className="mr-2 h-4 w-4" /> Bring Forward
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => dispatch({ type: 'SEND_BACKWARDS', payload: { ids: selectedObjectIds } })}>
                            <ArrowDown className="mr-2 h-4 w-4" /> Send Backward
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => dispatch({ type: 'BRING_TO_FRONT', payload: { ids: selectedObjectIds } })}>
                            <ChevronsUp className="mr-2 h-4 w-4" /> Bring to Front
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => dispatch({ type: 'SEND_TO_BACK', payload: { ids: selectedObjectIds } })}>
                            <ChevronsDown className="mr-2 h-4 w-4" /> Send to Back
                        </ContextMenuItem>
                    </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSub>
                    <ContextMenuSubTrigger disabled={selectedObjectIds.length === 0 || isSelectionLocked}>Flip</ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                        <ContextMenuItem onSelect={() => dispatch({ type: 'TOGGLE_FLIP', payload: { ids: selectedObjectIds, axis: 'x' } })}>
                            <ArrowLeftRight className="mr-2 h-4 w-4" /> Flip Horizontal
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => dispatch({ type: 'TOGGLE_FLIP', payload: { ids: selectedObjectIds, axis: 'y' } })}>
                            <ArrowUpDown className="mr-2 h-4 w-4" /> Flip Vertical
                        </ContextMenuItem>
                    </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => dispatch({ type: 'GROUP_OBJECTS' })} disabled={!canGroup || isSelectionLocked}>
                    <Group className="mr-2 h-4 w-4" /> Group <ContextMenuShortcut>⌘+G</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => dispatch({ type: 'UNGROUP_OBJECTS' })} disabled={!canUngroup || isSelectionLocked}>
                    <Ungroup className="mr-2 h-4 w-4" /> Ungroup <ContextMenuShortcut>⌘+Shift+G</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => dispatch({ type: 'TOGGLE_LOCK', payload: { ids: selectedObjectIds } })} disabled={selectedObjectIds.length === 0}>
                    {isSelectionLocked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                    {isSelectionLocked ? 'Unlock' : 'Lock'}
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => dispatch({ type: 'TOGGLE_VISIBILITY', payload: { ids: selectedObjectIds } })} disabled={selectedObjectIds.length === 0}>
                    {isSelectionVisible ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {isSelectionVisible ? 'Hide' : 'Show'}
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu >
    );
}


