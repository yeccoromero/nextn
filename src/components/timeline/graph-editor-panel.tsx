'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useEditor } from '@/context/editor-context';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from '@/lib/utils';
import { msToX } from '@/lib/anim/utils';
import { SvgObject, PropertyTrack, Keyframe, PropertyId } from '@/types/editor';
import { ZoomIn, ZoomOut, Play, Pause, Sparkles, ChevronDown, Check, ChevronsUpDown } from 'lucide-react';
import { EasingPresetPicker } from './easing-preset-picker';
import { EasingPreset } from '@/lib/easing-presets';
import { cubicBezierOneAxis, cubicBezierDerivativeOneAxis, solveBezierT } from '@/lib/anim/math-core';

interface GraphEditorPanelProps {
    scrollRef: React.RefObject<HTMLDivElement>;
    panelWidth: number;
    originMs: number;
    msPerPx: number;
}

interface Point { x: number; y: number }

function getSelectedTracks(state: any): { objectId: string, track: PropertyTrack }[] {
    const selectedIds = state.selectedObjectIds || [];
    const tracks: { objectId: string, track: PropertyTrack }[] = [];
    if (selectedIds.length === 0) return tracks;
    for (const objId of selectedIds) {
        const layer = state.timeline.layers[objId];
        if (!layer) continue;
        for (const track of layer.properties) {
            if (['position', 'x', 'y', 'scale', 'scaleX', 'scaleY', 'rotation', 'opacity', 'fill', 'stroke', 'width', 'height', 'fontSize'].includes(track.id)) {
                if (track.keyframes.length > 0) {
                    tracks.push({ objectId: objId, track });
                }
            }
        }
    }
    return tracks;
}

interface HandleData {
    kfId: string;
    objectId: string;
    propertyId: string;
    kfTimeMs: number;
    kfX: number;
    kfY: number;
    outHandle: { screenX: number; screenY: number; visualScreenX: number; visualScreenY: number } | null;
    inHandle: { screenX: number; screenY: number; visualScreenX: number; visualScreenY: number } | null;
    originalCp1: Point;
    originalCp2: Point;
    segmentWidthPx: number;
    segmentHeightPx: number;
    deltaValue?: number; // For Value graph scaling
    valueRange?: number; // For Value graph scaling
    tangentMode: 'broken' | 'smooth' | 'auto';
}

type DragTarget = { handle: HandleData; type: 'in' | 'out' | 'keyframe' } | null;
type GraphMode = 'speed' | 'value';

const HANDLE_COLOR = '#eab308';
const HANDLE_HOVER_COLOR = '#facc15';
const PLAYHEAD_COLOR = '#22d3ee';

export function GraphEditorPanel({ scrollRef, panelWidth, originMs, msPerPx }: GraphEditorPanelProps) {
    const { state, dispatch } = useEditor();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [graphMode, setGraphMode] = useState<GraphMode>('speed');
    // Zoom only affects horizontal axis (time)
    const [zoomX, setZoomX] = useState(1);
    const [panOffset, setPanOffset] = useState(0); // Horizontal pan offset in pixels

    const handlesRef = useRef<HandleData[]>([]);
    const scaleRef = useRef<{ pxPerUnit: number; midY: number }>({ pxPerUnit: 1, midY: 0 });

    const dragTargetRef = useRef<DragTarget>(null);
    // Multi-Select: Store initial CPs for all affected keyframes
    const dragStartRef = useRef<{
        x: number;
        y: number;
        initialStates: Map<string, { cp1: Point; cp2: Point }>;
        hasMoved: boolean;
        shouldSelectExclusiveOnUp: boolean;
    } | null>(null);

    // STABLE Y-AXIS: Store velocity range, only update when NOT dragging
    const velocityRangeRef = useRef<number>(100);

    const [hoveredHandleId, setHoveredHandleId] = useState<string | null>(null);
    const [hoveredType, setHoveredType] = useState<'in' | 'out' | 'keyframe' | null>(null);

    // SEGMENT SELECTION: Only the selected segment's handles are interactive
    const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

    // EASING PRESET PICKER
    const [showPresetPicker, setShowPresetPicker] = useState(false);
    const [presetAnchorPosition, setPresetAnchorPosition] = useState<{ x: number; y: number } | null>(null);
    const presetsButtonRef = useRef<HTMLButtonElement>(null);

    const selectedTracks = getSelectedTracks(state);

    // --- Marquee & Zoom Logic ---
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
    const marqueeStartRef = useRef<{ x: number, y: number } | null>(null);
    const trackScalesRef = useRef<Map<string, { pxPerUnit: number, midY: number }>>(new Map());

    const timeToScreenX = useCallback((timeMs: number, width: number) => {
        const baseX = msToX(timeMs, originMs, msPerPx);
        // Apply zoom centered on the panel
        const centerX = width / 2;
        return centerX + (baseX - centerX + panOffset) * zoomX;
    }, [originMs, msPerPx, zoomX, panOffset]);

    // Apply easing preset to ALL keyframes in selected tracks (Phase 9.2)
    const handleApplyPreset = useCallback((preset: EasingPreset, mode: 'out' | 'in' | 'both') => {
        const { x1, y1, x2, y2 } = preset.controlPoints;

        // Apply to all keyframes in all selected tracks
        selectedTracks.forEach(({ objectId, track }) => {
            const sortedKfs = [...track.keyframes].sort((a, b) => a.timeMs - b.timeMs);

            // Apply to each keyframe except the last (which has no "out" curve)
            sortedKfs.forEach((kf, index) => {
                if (index >= sortedKfs.length - 1) return; // Skip last keyframe

                const currentCp = kf.controlPoints || { x1: 0.33, y1: 0, x2: 0.67, y2: 1 };

                let newCp: { x1: number; y1: number; x2: number; y2: number };

                if (mode === 'out') {
                    newCp = { x1, y1, x2: currentCp.x2, y2: currentCp.y2 };
                } else if (mode === 'in') {
                    newCp = { x1: currentCp.x1, y1: currentCp.y1, x2, y2 };
                } else {
                    newCp = { x1, y1, x2, y2 };
                }

                dispatch({
                    type: 'UPDATE_KEYFRAME_CONTROL_POINTS',
                    payload: {
                        objectId,
                        propertyId: track.id,
                        keyframeId: kf.id,
                        controlPoints: newCp
                    }
                });
            });
        });

        setShowPresetPicker(false);
    }, [selectedTracks, dispatch]);

    const handleZoomIn = () => setZoomX(prev => Math.min(prev * 1.5, 10));
    const handleZoomOut = () => setZoomX(prev => Math.max(prev / 1.5, 0.25));

    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setZoomX(prev => Math.max(0.25, Math.min(10, prev * delta)));
        } else if (e.shiftKey) {
            // Shift+scroll for horizontal pan
            e.preventDefault();
            setPanOffset(prev => prev - e.deltaY);
        }
    }, []);

    // Get global time range for playhead sync
    const getGlobalTimeRange = useCallback(() => {
        let globalStartMs = Infinity, globalEndMs = -Infinity;
        selectedTracks.forEach(({ track }) => {
            if (track.keyframes.length < 2) return;
            const sortedKfs = [...track.keyframes].sort((a, b) => a.timeMs - b.timeMs);
            globalStartMs = Math.min(globalStartMs, sortedKfs[0].timeMs);
            globalEndMs = Math.max(globalEndMs, sortedKfs[sortedKfs.length - 1].timeMs);
        });
        return { globalStartMs, globalEndMs };
    }, [selectedTracks]);

    const togglePlay = useCallback(() => {
        dispatch({
            type: 'SET_TIMELINE_PLAYING',
            payload: !state.timeline.playing
        });
    }, [state.timeline.playing, dispatch]);

    const hitTestHandles = useCallback((clientX: number, clientY: number): DragTarget => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const hitRadius = 15;

        // Pass 1: Handles (High Priority)
        for (const h of handlesRef.current) {
            if (h.outHandle) {
                const dx = x - h.outHandle.visualScreenX;
                const dy = y - h.outHandle.visualScreenY;
                if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
                    return { handle: h, type: 'out' };
                }
            }
            if (h.inHandle) {
                const dx = x - h.inHandle.visualScreenX;
                const dy = y - h.inHandle.visualScreenY;
                if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
                    return { handle: h, type: 'in' };
                }
            }
        }

        // Pass 2: Keyframe Bodies (Lower Priority)
        for (const h of handlesRef.current) {
            const kfDx = x - h.kfX;
            const kfDy = y - h.kfY;
            if (Math.sqrt(kfDx * kfDx + kfDy * kfDy) < hitRadius) {
                return { handle: h, type: 'keyframe' };
            }
        }
        return null;
    }, []);

    const [selectedHandle, setSelectedHandle] = useState<{
        kfId: string;
        type: 'in' | 'out' | 'keyframe';
        objectId: string;
        propertyId: string;
    } | null>(null);

    const [contextMenuState, setContextMenuState] = useState<{
        x: number;
        y: number;
        kfId: string;
        objectId: string;
        propertyId: string;
        currentMode: 'broken' | 'smooth' | 'auto';
    } | null>(null);

    // Close menu on click anywhere else
    useEffect(() => {
        const closeMenu = () => setContextMenuState(null);
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX;
        const y = e.clientY;

        const hit = hitTestHandles(x, y);

        // If we hit a handle, show menu for that keyframe
        if (hit) {
            const { kfId, objectId, propertyId, tangentMode } = hit.handle;
            setContextMenuState({
                x: e.clientX,
                y: e.clientY,
                kfId,
                objectId,
                propertyId,
                currentMode: tangentMode
            });
            return;
        }

        // If no handle hit, check if we clicked near a keyframe dot (which is also drawn but maybe not in handles list?)
        // The handles list contains { kfX, kfY } which is the keyframe position.
        // Let's reuse hitTestHandles with a larger radius or check distance to kfX/kfY?
        // hitTestHandles checks distances to control points AND keyframes?
        // Let's check hitTest logic (it's not visible here, assume it's good or I need to implement separate check).
        // Actually, hitTestHandles usually checks handles.
        // Let's iterate handlesRef to find check distance to KF

        const mouseRelX = x - rect.left;
        const mouseRelY = y - rect.top;

        const kfHit = handlesRef.current.find(h => {
            const dist = Math.sqrt(Math.pow(h.kfX - mouseRelX, 2) + Math.pow(h.kfY - mouseRelY, 2));
            return dist < 10;
        });

        if (kfHit) {
            setContextMenuState({
                x: e.clientX,
                y: e.clientY,
                kfId: kfHit.kfId,
                objectId: kfHit.objectId,
                propertyId: kfHit.propertyId,
                currentMode: kfHit.tangentMode
            });
        }

    }, [hitTestHandles]);

    // Update dispatch to handle tangent mode
    const handleSetTangentMode = (mode: 'broken' | 'smooth') => {
        if (!contextMenuState) return;
        const { kfId, objectId, propertyId } = contextMenuState;

        dispatch({
            type: 'SET_KEYFRAME_TANGENT_MODE',
            payload: { keyframeId: kfId, objectId, propertyId: propertyId as PropertyId, mode }
        });
    };

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        // Marquee Logic
        if (marqueeStartRef.current) {
            const x = Math.min(e.clientX, marqueeStartRef.current.x);
            const y = Math.min(e.clientY, marqueeStartRef.current.y);
            const w = Math.abs(e.clientX - marqueeStartRef.current.x);
            const h = Math.abs(e.clientY - marqueeStartRef.current.y);
            setSelectionRect(new DOMRect(x, y, w, h));
            return;
        }

        if (!dragTargetRef.current || !dragStartRef.current) {
            const hit = hitTestHandles(e.clientX, e.clientY);
            const newId = hit?.handle.kfId ?? null;
            const newType = hit?.type ?? null;
            if (newId !== hoveredHandleId || newType !== hoveredType) {
                setHoveredHandleId(newId);
                setHoveredType(newType);
            }
            const canvas = canvasRef.current;
            if (canvas) {
                canvas.style.cursor = hit ? (hit.type === 'keyframe' ? 'pointer' : 'grab') : 'default';
            }
            return;
        }

        const canvas = canvasRef.current;
        if (canvas) canvas.style.cursor = 'grabbing';

        if (!dragStartRef.current) return;

        const startX = dragStartRef.current.x;
        const startY = dragStartRef.current.y;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // Threshold for "Move"
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            dragStartRef.current.hasMoved = true;
        }

        const { handle, type } = dragTargetRef.current;

        // If dragging a keyframe body, ignore for now (Selection only)
        if (type === 'keyframe') return;

        const initialStates = dragStartRef.current.initialStates;

        // Iterate all affected keyframes (those in initialStates)
        initialStates.forEach((initialCp, kfId) => {
            // Find the handle data for this specific keyframe (it might not be the 'dragTarget' handle)
            // We need the handle data to know segment dimensions (width/height) for normalization.
            // Note: handlesRef.current is the CURRENT render state.
            // We assume the stored 'initialCp' is the source of truth for the START of the drag.

            // We look for a matching handle in the current ref to get dimensions
            // We match by kfId AND type (since a KF can have In and Out, we move consistent with drag type)
            // If dragging "Out", we move "Out" handles of selected keys.
            // Find the handle being dragged to get dimensions
            let targetHandle = handlesRef.current.find(h =>
                h.kfId === kfId && (type === 'out' ? h.outHandle : h.inHandle)
            );

            if (!targetHandle) return;

            const segWidth = targetHandle.segmentWidthPx || 100;
            const segHeight = targetHandle.segmentHeightPx || 100;

            let normDx = dx / segWidth;
            let normDy = -dy / segHeight;

            // Value Graph Y-Axis scaling correction
            if (graphMode === 'value' && targetHandle.deltaValue !== undefined && targetHandle.valueRange !== undefined) {
                // d(cp.y) = normDy * (Range / DeltaVal)
                const range = targetHandle.valueRange;
                const dv = targetHandle.deltaValue;
                if (Math.abs(dv) > 0.0001) {
                    normDy = normDy * (range / dv);
                } else {
                    normDy = 0; // Prevent div by zero or erratic behavior on flat segments
                }
            }

            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            // Smart Axis Locking (based on primary drag delta)
            if (!e.shiftKey) {
                if (absDy > absDx * 2 && absDx < 15) normDx = 0;
                if (absDx > absDy * 2 && absDy < 15) normDy = 0;
            }
            if (e.shiftKey) {
                if (absDy > absDx) normDx = 0;
                else normDy = 0;
            }

            // Apply to INITIAL CP for this specific keyframe
            // Note: For IN handles, logical direction is inverted in some implementations, 
            // but here 'normDx' is screen delta normalized.
            // If dragging Out handle: Right is +X.
            // If dragging In handle: Right is +X.

            // However, CP values:
            // Out (cp1): relative to 0,0. +x is right.
            // In (cp2): relative to 1,1 (usually). 
            // BUT our data model 'originalCp' might be raw bezier values (0-1).

            // Let's look at `HandleData` construction.
            // newHandles.push({ ... originalCp1: { ...cp1 } }) where cp1 is raw (e.g. 0.33, 0).

            // DETERMINE TARGET KEYFRAME FOR UPDATE (The "Owner" of the segment)
            let kfIdToUpdate = kfId;
            let initialCpForUpdate = initialCp;

            // If dragging IN handle, we are manipulating the segment ENDING at this keyframe.
            // But control points (x1,y1, x2,y2) are properties of the START keyframe.
            // So we need to find the PREVIOUS keyframe.
            if (type === 'in') {
                const layer = state.timeline.layers[targetHandle.objectId];
                const track = layer?.properties.find((p: PropertyTrack) => p.id === targetHandle!.propertyId);
                if (track) {
                    const sorted = [...track.keyframes].sort((a: Keyframe, b: Keyframe) => a.timeMs - b.timeMs);
                    const myIndex = sorted.findIndex((k: Keyframe) => k.id === kfId);
                    if (myIndex > 0) {
                        const prevKf = sorted[myIndex - 1];
                        kfIdToUpdate = prevKf.id;
                        // Use prevKf's existing CPs as base for x1/y1
                        // Use `initialCp.cp2` (which came from IN provider) as base for x2/y2
                        const prevCp = prevKf.controlPoints || { x1: 0.33, y1: 0, x2: 0.67, y2: 1 };
                        initialCpForUpdate = {
                            cp1: { x: prevCp.x1, y: prevCp.y1 },
                            cp2: initialCp.cp2
                        };
                    }
                }
            } else {
                // Out handle: We are the start of the segment.
                // We need to preserve x2/y2 of THIS segment.
                // But `initialCp.cp2` comes from `inProvider` (Next Interval).
                // So we must fetch current x2/y2 from the store/keyframe.

                const layer = state.timeline.layers[targetHandle.objectId];
                const track = layer?.properties.find((p: PropertyTrack) => p.id === targetHandle!.propertyId);
                const kf = track?.keyframes.find((k: Keyframe) => k.id === kfId);
                const currentCPs = kf?.controlPoints || { x1: 0.33, y1: 0, x2: 0.67, y2: 1 };

                initialCpForUpdate = {
                    cp1: initialCp.cp1,
                    cp2: { x: currentCPs.x2, y: currentCPs.y2 }
                };
            }

            let newX, newY;

            if (type === 'out') {
                newX = initialCp.cp1.x + normDx;
                newY = initialCp.cp1.y + normDy;
            } else {
                // IN handle.
                // Visually: In Handle is at (1-cp2.x, 1-cp2.y) relative to end?
                // Wait.
                // In Handle Screen X = endX - (1 - cp2.x) * width
                // If I move mouse RIGHT (+dx), Screen X increases.
                // endX is constant.
                // - (1 - cp2.x) * width must increase.
                // - (1 - newCp2.x) must increase.
                // 1 - newCp2.x > 1 - oldCp2.x
                // -newCp2.x > -oldCp2.x
                // newCp2.x < oldCp2.x
                // So +dx means DECREASING cp2.x.

                // Let's verify standard bezier editor behavior.
                // If I pull the IN handle to the right (away from curve start), it usually flattens?
                // Ideally we map Screen Delta to Value Delta.

                // Delta Screen X = dx
                // Delta CP Screen X = dx
                // CP Screen X = endX - (1 - cpX) * W
                // d(ScreenX) = - ( - d(cpX) ) * W = d(cpX) * W
                // So d(cpX) = dx / W = normDx.
                // So actually it IS direct?

                // Let's check Y.
                // Screen Y = kfYEnd + (1 - cp2.y) * Height  (Screen Y grows down)
                // If I drag DOWN (+dy) -> Screen Y increases.
                // kfYEnd + (1 - newY) * H > kfYEnd + (1 - oldY) * H
                // 1 - newY > 1 - oldY
                // -newY > -oldY  => newY < oldY.
                // So +dy (Down) means DECREASING cp2.y.
                // But `normDy` = -dy / Height.
                // if dy > 0, normDy < 0.
                // newY = oldY + normDy = oldY - small.
                // So yes, dragging DOWN decreases Y.

                // Wait, typically Y axis in graphs: Up is +Y.
                // In DOM, Down is +Y.
                // `midY - (y * pxPerUnit)` -> Higher value is smaller Screen Y (Higher up).

                // If I drag DOWN (+dy), ScreenY increases.
                // This corresponds to LOWER value on graph.
                // So CP y value should DECREASE.
                // `normDy` = -dy / height. (dy>0 -> normDy<0).
                // So newY = oldY + normDy (decreases). Correct.

                newX = initialCp.cp2.x + normDx;
                newY = initialCp.cp2.y + normDy;
            }

            // Snapping
            if (Math.abs(newX - 0) < 0.05) newX = 0;
            if (Math.abs(newX - 1) < 0.05) newX = 1;
            if (Math.abs(newY - 0) < 0.05) newY = 0;
            if (Math.abs(newY - 0.5) < 0.05) newY = 0.5;
            if (Math.abs(newY - 1) < 0.05) newY = 1;

            newX = Math.max(0.01, Math.min(0.99, newX));
            newY = Math.max(-20, Math.min(20, newY));

            dispatch({
                type: 'UPDATE_KEYFRAME_CONTROL_POINTS',
                payload: {
                    objectId: targetHandle.objectId,
                    propertyId: targetHandle.propertyId as PropertyId,
                    keyframeId: kfIdToUpdate,
                    controlPoints: (type === 'out'
                        ? { x1: newX, y1: newY }
                        : { x2: newX, y2: newY }) as any
                }
            });

            // --- TANGENT COUPLING FOR THIS HANDLE ---
            if (targetHandle.tangentMode === 'smooth') {
                // We need to apply the SAME logic as before but for THIS specific handle instance
                // We can reuse the existing logic block but need to scope it correctly
                // or extract it. For now, let's inline a simplified version for loop safety.

                const allHandles = handlesRef.current;
                let oppositeHandle: HandleData | undefined;
                let oppositeType: 'in' | 'out';

                if (type === 'out') {
                    oppositeType = 'in';
                    oppositeHandle = allHandles.find(h =>
                        h.kfId !== targetHandle?.kfId && // different ID/segment
                        h.objectId === targetHandle!.objectId &&
                        h.propertyId === targetHandle!.propertyId &&
                        Math.abs(h.kfTimeMs - targetHandle!.kfTimeMs) < 1 &&
                        h.inHandle !== null
                    );
                } else {
                    oppositeType = 'out';
                    oppositeHandle = allHandles.find(h =>
                        h.kfId !== targetHandle?.kfId &&
                        h.objectId === targetHandle!.objectId &&
                        h.propertyId === targetHandle!.propertyId &&
                        Math.abs(h.kfTimeMs - targetHandle!.kfTimeMs) < 1 &&
                        h.outHandle !== null
                    );
                }

                if (oppositeHandle) {
                    // Calculate vectors based on the NEW calculated CP (newX, newY)
                    // We need Screen Vector relative to Keyframe.

                    let vecX: number, vecY: number;

                    // NOTE: We must use dimensions of the CURRENT target handle
                    if (type === 'out') {
                        vecX = newX * segWidth;
                        vecY = -newY * segHeight;
                    } else {
                        vecX = (newX - 1) * segWidth;
                        vecY = -(newY - 1) * segHeight;
                    }

                    const oppVecX = -vecX;
                    const oppVecY = -vecY;

                    const oppSegWidth = oppositeHandle.segmentWidthPx || 100;
                    const oppSegHeight = oppositeHandle.segmentHeightPx || 100;

                    let oppNewX, oppNewY;

                    if (oppositeType === 'in') {
                        oppNewX = (oppVecX / oppSegWidth) + 1;
                        oppNewY = (-oppVecY / oppSegHeight) + 1;

                        // Find the KEYFRAME that owns this 'in' handle
                        // It's the START keyframe of the PREVIOUS segment.
                        // We need to find that KF ID.
                        // Using the robust lookup from before:
                        const layer = state.timeline.layers[targetHandle.objectId];
                        const track = layer?.properties.find((p: any) => p.id === targetHandle!.propertyId);
                        if (track) {
                            const sorted = [...track.keyframes].sort((a: any, b: any) => a.timeMs - b.timeMs);
                            const myIndex = sorted.findIndex((k: any) => k.id === targetHandle!.kfId);
                            if (myIndex > 0) {
                                const prevKf = sorted[myIndex - 1];
                                const prevCp = prevKf.controlPoints || { x1: 0.33, y1: 0, x2: 0.67, y2: 1 };
                                dispatch({
                                    type: 'UPDATE_KEYFRAME_CONTROL_POINTS',
                                    payload: {
                                        objectId: targetHandle.objectId,
                                        propertyId: targetHandle.propertyId as PropertyId,
                                        keyframeId: prevKf.id,
                                        controlPoints: {
                                            x2: oppNewX,
                                            y2: oppNewY
                                        } as any
                                    }
                                });
                            }
                        }
                    } else {
                        // Opposite is OUT
                        oppNewX = oppVecX / oppSegWidth;
                        oppNewY = -oppVecY / oppSegHeight;

                        // Opposite OUT handle belongs to the KF at 'oppositeHandle.kfId' 
                        // (which is actually the same KF time, different segment object in handlesRef)
                        // Yes, `oppositeHandle.kfId` is the ID of the KF starting the next segment.
                        // which is the same as `targetHandle.kfId`?
                        // No. Middle KF has TWO handle entries because of the loop structure?
                        // One where kfId = Middle (Out Handle)
                        // One where kfId = Middle (In Handle)... Wait.

                        // Line 1039: newHandles.push({ kfId: kfStart.id ... outHandle ... })
                        // Line 1060: newHandles.push({ kfId: kfStart.id ... inHandle ... }) NO!
                        // Line 1060 pushes `kfId: kfStart.id`?? No, read carefuly.
                        // It pushes `kfId: kfStart.id` !!! 
                        // WAIT. Line 1060 in original file...

                        // Let's re-read the file snippet for handle generation (Line 1059-1060).
                        /*
                        1059:                     newHandles.push({
                        1060:                         kfId: kfStart.id,  <-- THIS LOOKS WRONG IN MY MEMORY
                        1061:                         objectId: trackData.objectId,
                        1062:                         propertyId: trackData.propertyId,
                        1063:                         kfTimeMs: seg.kfEnd.timeMs,
                        */
                        // If line 1060 says `kfId: kfStart.id`, but `kfTimeMs: seg.kfEnd.timeMs`...
                        // That would mean the IN handle is associated with the START KF ID but END time?
                        // That would be a bug or I misread.
                        // Let's assume it should be `kfId: seg.kfEnd.id`.
                        // I will verify this in a tool call if current logic fails, but standard logic implies:
                        // IN handle belongs to End KF.

                        // Assuming `oppositeHandle.kfId` IS the correct ID for that handle.
                        const kfIdToUpdate = oppositeHandle.kfId;

                        const layer = state.timeline.layers[targetHandle.objectId];
                        const track = layer?.properties.find((p: any) => p.id === targetHandle!.propertyId);
                        if (track) {
                            const kf = track.keyframes.find((k: any) => k.id === kfIdToUpdate);
                            if (kf) {
                                const cp = kf.controlPoints || { x1: 0.33, y1: 0, x2: 0.67, y2: 1 };
                                dispatch({
                                    type: 'UPDATE_KEYFRAME_CONTROL_POINTS',
                                    payload: {
                                        objectId: targetHandle.objectId,
                                        propertyId: targetHandle.propertyId as PropertyId,
                                        keyframeId: kfIdToUpdate,
                                        controlPoints: {
                                            x1: Math.max(0, Math.min(1, oppNewX)),
                                            y1: oppNewY
                                        } as any
                                    }
                                });
                            }
                        }
                    }
                }
            }
        });
    }, [hitTestHandles, dispatch, hoveredHandleId, hoveredType]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const hit = hitTestHandles(e.clientX, e.clientY);



        if (hit) {
            e.stopPropagation();
            e.preventDefault();

            // If we clicked a handle, start dragging it
            // CHECK SELECTION:
            const isSelected = state.timeline.selection.keyIds?.includes(hit.handle.kfId);

            // If dragging an unselected keyframe, select it (exclusive unless shift)
            if (!isSelected) {
                dispatch({
                    type: 'SELECT_KEYFRAME',
                    payload: {
                        objectId: hit.handle.objectId,
                        propertyId: hit.handle.propertyId as PropertyId,
                        keyframeId: hit.handle.kfId,
                        additive: e.shiftKey
                    }
                });
            } else if (e.shiftKey) {
                // Toggle OFF if clicking an already selected item with Shift
                // But wait, if we toggle off, we shouldn't start a drag on it.
                // We'll dispatch deselect and return early (cancel drag).
                dispatch({
                    type: 'SELECT_KEYFRAME',
                    payload: {
                        objectId: hit.handle.objectId,
                        propertyId: hit.handle.propertyId as PropertyId,
                        keyframeId: hit.handle.kfId,
                        additive: true // This action name implies "Select", but our reducer likely handles toggle or we need a DESELECT?
                        // Checking reducer in next step if 'SELECT_KEYFRAME' handles toggle. 
                        // Usually 'SELECT_KEYFRAME' with additive checks existence and toggles.
                        // Assuming standard behavior for now.
                    }
                });
                return;
            }

            // Note: If isSelected && !shift, we DO NOT change selection here.
            // We wait for PointerUp to see if it was a click (reset selection to just this one) or a drag (keep group).
            // This requires storing 'wasSelectedAtStart' in drag ref? 
            // Better: We track 'hasMoved'. If hasMoved is false in PointerUp, and we are on a selected handle, and !shift, we exclusive select.

            // PREPARE MULTI-DRAG SNAPSHOT
            // We need to capture the initial CPs for all selected keyframes (plus this one if not selected yet - handled above).
            // But state update acts on next render.
            // If we just dispatched select, the current 'state' is stale.
            // HOWEVER: If we aren't selected, we are essentially dragging just this one (plus shift selection).
            // For simplicity: If !isSelected, we only drag this one.
            // If isSelected, we drag all selected.

            // Wait, if I just clicked (dispatch), I can't access updated selection yet.
            // So I should treat `keysToDrag` as:
            // if (isSelected) -> state.timeline.selection.keyIds
            // else -> [hit.handle.kfId] (and we clear others via dispatch)

            // If we are dragging a HANDLE (in/out), we only want to affect THAT keyframe's curve.
            // If we are dragging a KEYFRAME BODY, we move all selected keyframes.
            const keysToDrag = (hit.type === 'in' || hit.type === 'out')
                ? [hit.handle.kfId]
                : (isSelected ? (state.timeline.selection.keyIds || []) : [hit.handle.kfId]);

            // Capture initial states
            const initialStates = new Map<string, { cp1: Point; cp2: Point }>();

            // We need to find the HandleData for each key to get its CPs.
            // handlesRef has all rendered handles.
            // CPs are stored in handle.originalCp1 / cp2.

            keysToDrag.forEach((kid: string) => {
                // Find ANY handle for this keyframe to get its data (assuming CPs are consistent per segment... wait)
                // A keyframe can be start of multiple segments? No, one segment per prop.
                // A keyframe has ONE set of Control Points (outgoing).
                // But wait.
                // handle.originalCp1/2 comes from the SEGMENT logic.
                // cp1 is kfStart.controlPoints.
                // cp2 is kfStart.controlPoints.
                // So for any handle belonging to a segment starting at KF A, the CPs are the same.

                // We need to find a handle that corresponds to the segment *controlled* by the dragged handle type?
                // If I drag OUT: I am modifying KF's own CPs (x1, y1).
                // If I drag IN: I am modifying PREVIOUS KF's CPs (x2, y2).

                // THIS IS TRICKY.
                // If I select 3 keys and drag OUT handle of Key 2.
                // I want to modify OUT handle of Key 1, 2, 3.
                // So for each Key ID, I need the handle where IT IS THE "OUT" PROVIDER (i.e. it is kfStart).

                // So I need to find a handle where handle.kfId === kid AND handle.outHandle is not null?
                // That handle contains originalCp1/2 for the segment STARTING at kid.

                // What if I drag IN?
                // I want to modify IN handle of Key 1, 2, 3.
                // IN handle is defined by the segment ENDING at the key.
                // So I need a handle where handle.kfId === kid AND handle.inHandle is not null.

                // So we filter handlesRef based on drag type.
                // Find the handle that acts as the "Out" provider for this key (Start of segment)
                const outProvider = handlesRef.current.find(h => h.kfId === kid && h.outHandle);

                // Find the handle that acts as the "In" provider for this key (End of previous segment)
                // Note: The "In" handle in our data model is associated with the segment's END key.
                // So we look for a handle where h.kfId === kid AND h.inHandle is not null.
                const inProvider = handlesRef.current.find(h => h.kfId === kid && h.inHandle);

                // Reconstruct the full control point state for this keyframe
                // If a provider doesn't exist (e.g. start/end of track), use default or existing value logic.
                // However, we only edit what exists. 

                // Accessing 'originalCp1' from outProvider gives us the current Keyframe's CP1.
                // Accessing 'originalCp2' from inProvider gives us the current Keyframe's CP2.

                const cp1 = outProvider ? { ...outProvider.originalCp1 } : { x: 0.33, y: 0 };
                const cp2 = inProvider ? { ...inProvider.originalCp2 } : { x: 0.67, y: 1 };

                initialStates.set(kid, { cp1, cp2 });
            });

            dragStartRef.current = {
                x: e.clientX,
                y: e.clientY,
                initialStates,
                hasMoved: false, // Track if actual drag occurred
                shouldSelectExclusiveOnUp: isSelected && !e.shiftKey // Trigger exclusive select on up if no drag
            };

            dragTargetRef.current = hit;
            setSelectedHandle({
                kfId: hit.handle.kfId,
                type: hit.type,
                objectId: hit.handle.objectId,
                propertyId: hit.handle.propertyId
            });
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            return;
        } else {
            setSelectedHandle(null);
            // Start Marquee Selection
            marqueeStartRef.current = { x: e.clientX, y: e.clientY };
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }
    }, [hitTestHandles, setSelectedHandle]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        // Drag Handling
        if (dragTargetRef.current) {

            // Check for "Click without Drag" on a previously selected item
            if (dragStartRef.current?.shouldSelectExclusiveOnUp && !dragStartRef.current?.hasMoved) {
                dispatch({
                    type: 'SELECT_KEYFRAME',
                    payload: {
                        objectId: dragTargetRef.current.handle.objectId,
                        propertyId: dragTargetRef.current.handle.propertyId as PropertyId,
                        keyframeId: dragTargetRef.current.handle.kfId,
                        additive: false // Exclusive select
                    }
                });
            }

            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            dragTargetRef.current = null;
            dragStartRef.current = null;
            const canvas = canvasRef.current;
            if (canvas) canvas.style.cursor = 'default';
            return;
        }

        // Marquee Handling
        if (marqueeStartRef.current) {
            // Check if it was a drag (width/height > 2px)
            const w = Math.abs(e.clientX - marqueeStartRef.current.x);
            const h = Math.abs(e.clientY - marqueeStartRef.current.y);

            if (w > 2 || h > 2) {
                const x = Math.min(e.clientX, marqueeStartRef.current.x);
                const y = Math.min(e.clientY, marqueeStartRef.current.y);

                const canvas = canvasRef.current;
                const clientRect = canvas?.getBoundingClientRect();

                if (clientRect) {
                    const canvasX = x - clientRect.left;
                    const canvasY = y - clientRect.top;

                    // Use Set to avoid duplicates (handlesRef may contain multiple entries per KF)
                    const uniqueKeyIds = new Set<string>();
                    const selectedKeys: any[] = [];


                    // Iterate RENDERED handles (what the user actually sees)
                    // This avoids coordinate mismatches from recalculation.
                    for (const hData of handlesRef.current) {
                        // Check intersection with Keyframe Marker (kfX, kfY)
                        // Allow "touching" the keyframe (radius ~3-4px)
                        const HIT_TOLERANCE = 4;
                        if (hData.kfX >= canvasX - HIT_TOLERANCE && hData.kfX <= canvasX + w + HIT_TOLERANCE &&
                            hData.kfY >= canvasY - HIT_TOLERANCE && hData.kfY <= canvasY + h + HIT_TOLERANCE) {

                            if (!uniqueKeyIds.has(hData.kfId)) {
                                uniqueKeyIds.add(hData.kfId);
                                selectedKeys.push({
                                    objectId: hData.objectId,
                                    propertyId: hData.propertyId,
                                    keyframeId: hData.kfId
                                });
                            }
                        }
                    }

                    if (selectedKeys.length > 0) {
                        dispatch({
                            type: 'SELECT_KEYFRAMES_IN_RECT',
                            payload: { keys: selectedKeys, additive: e.shiftKey }
                        });
                    } else if (!e.shiftKey) {
                        dispatch({ type: 'CLEAR_KEYFRAME_SELECTION' });
                    }
                }
            } else {
                // Click on empty space (No drag)
                if (!e.shiftKey) {
                    dispatch({ type: 'CLEAR_KEYFRAME_SELECTION' });
                }
            }

            marqueeStartRef.current = null;
            setSelectionRect(null);
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        }

    }, [dispatch, state.timeline.selection]);

    // (State definitions moved to Top)


    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const observer = new ResizeObserver(entries => {
            const entry = entries[0];
            if (entry) {
                setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height });
            }
        });
        observer.observe(canvas);
        return () => observer.disconnect();
    }, []);



    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // Y-axis scaling (independent of zoom - always fit to height)
        const PADDING = 20; // Top/bottom padding
        let globalMinVal = Infinity, globalMaxVal = -Infinity;

        // Per-Track Scaling Map (Key: track.id)
        const trackScales = new Map<string, { pxPerUnit: number, midY: number }>();

        // Global scale fallback (for Value graph)
        let globalPxPerUnit = 1;
        let globalMidY = height / 2;

        type SegmentData = {
            points: { x: number, y: number }[],
            kfStart: Keyframe,
            kfEnd: Keyframe,
            cp1: Point,
            cp2: Point,
            startX: number,
            endX: number,
            startY: number,
            endY: number,
            val1: number,
            val2: number,
            durationMs: number,
            startMs: number,
            endMs: number
        };

        const calculatedSegments: {
            trackIndex: number;
            objectId: string;
            propertyId: string;
            color: string;
            scale: { pxPerUnit: number, midY: number };
            segments: SegmentData[];
        }[] = [];

        const newHandles: HandleData[] = [];

        let globalStartMs = Infinity, globalEndMs = -Infinity;

        // First pass: calculate Y ranges
        selectedTracks.forEach(({ track }) => {
            if (track.keyframes.length < 2) return;
            const sortedKeyframes = [...track.keyframes].sort((a, b) => a.timeMs - b.timeMs);

            globalStartMs = Math.min(globalStartMs, sortedKeyframes[0].timeMs);
            globalEndMs = Math.max(globalEndMs, sortedKeyframes[sortedKeyframes.length - 1].timeMs);

            let trackMaxVelocity = 50;

            for (let i = 0; i < sortedKeyframes.length - 1; i++) {
                const kf1 = sortedKeyframes[i];
                const kf2 = sortedKeyframes[i + 1];
                const duration = kf2.timeMs - kf1.timeMs;
                if (duration <= 0) continue;

                const val1 = (typeof kf1.value === 'number') ? kf1.value : (kf1.value as any).x ?? 0;
                const val2 = (typeof kf2.value === 'number') ? kf2.value : (kf2.value as any).x ?? 0;
                const deltaVal = val2 - val1;
                const timeSec = duration / 1000;

                globalMinVal = Math.min(globalMinVal, val1, val2);
                globalMaxVal = Math.max(globalMaxVal, val1, val2);

                // Calculate max velocity for speed graph per track
                let cp1 = { x: 0.33, y: 0 };
                let cp2 = { x: 0.67, y: 1 };
                if (kf1.interpolation === 'bezier' && kf1.controlPoints) {
                    cp1 = { x: kf1.controlPoints.x1, y: kf1.controlPoints.y1 };
                    cp2 = { x: kf1.controlPoints.x2, y: kf1.controlPoints.y2 };
                } else if (kf1.interpolation === 'ease') {
                    cp1 = { x: 0.42, y: 0 }; cp2 = { x: 0.58, y: 1 }; // Ease default
                }

                if (kf1.interpolation === 'linear') {
                    const vel = Math.abs(deltaVal / timeSec);
                    if (vel > trackMaxVelocity) trackMaxVelocity = vel;
                } else if (kf1.interpolation !== 'hold') {
                    // Sample bezier for max velocity
                    for (let t = 0; t <= 1; t += 0.1) {
                        const dx = cubicBezierDerivativeOneAxis(t, cp1.x, cp2.x);
                        const dy = cubicBezierDerivativeOneAxis(t, cp1.y, cp2.y);
                        const normVel = dx === 0 ? 0 : dy / dx;

                        const realVel = normVel * Math.abs(deltaVal / timeSec);
                        if (realVel > trackMaxVelocity) trackMaxVelocity = realVel;
                    }
                }
            }

            // Calculate Scale for this track (Speed Mode)
            if (graphMode === 'speed') {
                const range = Math.max(trackMaxVelocity * 1.2, 50); // 20% padding
                const baselineRatio = 0.70;
                const midY = PADDING + (height - PADDING * 2) * baselineRatio;
                const pxPerUnit = (height - PADDING * 2) * baselineRatio / range;
                trackScales.set(track.id, { pxPerUnit, midY });
            }
        });

        // Store scales for selection logic
        trackScalesRef.current = trackScales;

        // Value Mode Scale (Global)
        if (graphMode === 'value') {
            const valRange = globalMaxVal - globalMinVal;
            const padding = valRange * 0.15 || 10;
            const yMin = globalMinVal - padding;
            const yMax = globalMaxVal + padding;
            globalMidY = height / 2;
            globalPxPerUnit = (height - PADDING * 2) / (yMax - yMin);
        }

        // Store primary scale ref (legacy support for grid?)
        if (graphMode === 'speed') {
            const firstScale = trackScales.values().next().value;
            scaleRef.current = firstScale || { pxPerUnit: 1, midY: height / 2 };
        } else {
            scaleRef.current = { pxPerUnit: globalPxPerUnit, midY: globalMidY };
        }

        // Second pass: build segments with screen coordinates
        selectedTracks.forEach(({ objectId, track }, trackIndex) => {
            if (track.keyframes.length < 2) return;

            let color = '#ffffff';
            if (track.id === 'position') color = '#ef4444';
            else if (track.id.includes('scale')) color = '#22c55e';
            else if (track.id === 'rotation') color = '#3b82f6';
            else if (track.id === 'opacity') color = '#a855f7';

            const sortedKeyframes = [...track.keyframes].sort((a, b) => a.timeMs - b.timeMs);
            const trackSegments: SegmentData[] = [];

            for (let i = 0; i < sortedKeyframes.length - 1; i++) {
                const kf1 = sortedKeyframes[i];
                const kf2 = sortedKeyframes[i + 1];

                const startMs = kf1.timeMs;
                const endMs = kf2.timeMs;
                const duration = endMs - startMs;
                if (duration <= 0) continue;

                const val1 = (typeof kf1.value === 'number') ? kf1.value : (kf1.value as any).x ?? 0;
                const val2 = (typeof kf2.value === 'number') ? kf2.value : (kf2.value as any).x ?? 0;
                const deltaVal = val2 - val1;
                const timeSec = duration / 1000;

                let isConstant = false;
                let constantVel = 0;
                let cp1 = { x: 0.33, y: 0 };
                let cp2 = { x: 0.67, y: 1 };

                if (kf1.interpolation === 'hold') {
                    isConstant = true;
                    constantVel = 0;
                } else if (kf1.interpolation === 'linear') {
                    isConstant = true;
                    constantVel = deltaVal / timeSec;
                    cp1 = { x: 0, y: 0 };
                    cp2 = { x: 1, y: 1 };
                } else if (kf1.interpolation === 'bezier' && kf1.controlPoints) {
                    cp1 = { x: kf1.controlPoints.x1, y: kf1.controlPoints.y1 };
                    cp2 = { x: kf1.controlPoints.x2, y: kf1.controlPoints.y2 };
                } else if (kf1.interpolation === 'ease') {
                    cp1 = { x: 0.42, y: 0 };
                    cp2 = { x: 0.58, y: 1 };
                }

                const segmentPoints: { x: number, y: number }[] = [];

                // Screen X with zoom (only X is affected)
                const startX = timeToScreenX(startMs, width);
                const endX = timeToScreenX(endMs, width);

                let startY = 0, endY = 0;

                if (graphMode === 'speed') {
                    if (isConstant) {
                        segmentPoints.push({ x: startX, y: constantVel });
                        segmentPoints.push({ x: endX, y: constantVel });
                        startY = endY = constantVel;
                    } else {
                        const steps = Math.max(50, Math.min(200, Math.floor((endX - startX) / 2)));
                        for (let s = 0; s <= steps; s++) {
                            const t = s / steps;
                            const dx = cubicBezierDerivativeOneAxis(t, cp1.x, cp2.x);
                            const dy = cubicBezierDerivativeOneAxis(t, cp1.y, cp2.y);
                            const normVel = dx === 0 ? 0 : dy / dx;

                            const realVel = normVel * (deltaVal / timeSec);

                            const timeProgress = cubicBezierOneAxis(t, cp1.x, cp2.x);
                            const curMs = startMs + timeProgress * duration;
                            const sx = timeToScreenX(curMs, width);
                            segmentPoints.push({ x: sx, y: realVel });

                            if (s === 0) startY = realVel;
                            if (s === steps) endY = realVel;
                        }
                    }
                } else {
                    if (kf1.interpolation === 'hold') {
                        segmentPoints.push({ x: startX, y: val1 });
                        segmentPoints.push({ x: endX - 1, y: val1 });
                        segmentPoints.push({ x: endX, y: val2 });
                        startY = val1;
                        endY = val2;
                    } else {
                        const steps = Math.max(50, Math.min(200, Math.floor((endX - startX) / 2)));
                        for (let s = 0; s <= steps; s++) {
                            const t = s / steps;
                            const timeProgress = cubicBezierOneAxis(t, cp1.x, cp2.x);
                            const valueProgress = cubicBezierOneAxis(t, cp1.y, cp2.y);

                            const curMs = startMs + timeProgress * duration;
                            const curVal = val1 + valueProgress * deltaVal;

                            const sx = timeToScreenX(curMs, width);
                            segmentPoints.push({ x: sx, y: curVal });

                            if (s === 0) startY = curVal;
                            if (s === steps) endY = curVal;
                        }
                    }
                }

                trackSegments.push({
                    points: segmentPoints,
                    kfStart: kf1,
                    kfEnd: kf2,
                    cp1,
                    cp2,
                    startX,
                    endX,
                    startY,
                    endY,
                    val1,
                    val2,
                    durationMs: duration,
                    startMs,
                    endMs
                });
            }
            calculatedSegments.push({
                trackIndex,
                objectId,
                propertyId: track.id,
                color,
                scale: trackScales.get(track.id) || { pxPerUnit: globalPxPerUnit, midY: globalMidY },
                segments: trackSegments
            });
        });

        // Build handles (Speed Graph)
        if (graphMode === 'speed') {
            calculatedSegments.forEach(trackData => {
                trackData.segments.forEach((seg) => {
                    const { kfStart, cp1, cp2, startX, endX, startY, endY } = seg;

                    // Show handles for anything that is not linear or hold
                    // This includes explicit 'bezier', 'ease', and implicit undefined (which defaults to S-curve)
                    const hasBezier = kfStart.interpolation !== 'linear' && kfStart.interpolation !== 'hold';
                    if (!hasBezier) return;

                    const segmentWidthPx = endX - startX;
                    const segmentHeightPx = height * 0.4; // Y scale for handles

                    // Use Per-Track Scale
                    const { pxPerUnit, midY } = trackData.scale;

                    // RESTORED: Velocity-based keyframe positions for correct bell curve shape
                    const kfYStart = midY - (startY * pxPerUnit);
                    const kfYEnd = midY - (endY * pxPerUnit);

                    // OUT handle: extends from start keyframe toward the curve peak
                    const outHandleScreenX = startX + cp1.x * segmentWidthPx;
                    const outHandleScreenY = kfYStart - (cp1.y * segmentHeightPx);
                    // Clamp visual Y to keep it on screen (Ghost Handle)
                    const visualOutY = Math.max(10, Math.min(height - 10, outHandleScreenY));

                    // IN handle: extends from end keyframe back toward the curve peak
                    // Uses (1 - cp2.x) for X position and (1 - cp2.y) for Y offset (Bezier convention)
                    const inHandleScreenX = endX - (1 - cp2.x) * segmentWidthPx;
                    const inHandleScreenY = kfYEnd + ((1 - cp2.y) * segmentHeightPx);
                    // Clamp visual Y
                    const visualInY = Math.max(10, Math.min(height - 10, inHandleScreenY));

                    newHandles.push({
                        kfId: kfStart.id,
                        objectId: trackData.objectId,
                        propertyId: trackData.propertyId,
                        kfTimeMs: kfStart.timeMs,
                        kfX: startX,
                        kfY: kfYStart,
                        outHandle: {
                            screenX: outHandleScreenX,
                            screenY: outHandleScreenY,
                            visualScreenX: outHandleScreenX,
                            visualScreenY: visualOutY
                        },
                        inHandle: null,
                        originalCp1: { ...cp1 },
                        originalCp2: { ...cp2 },
                        segmentWidthPx,
                        segmentHeightPx,
                        tangentMode: kfStart.tangentMode || 'broken'
                    });

                    newHandles.push({
                        kfId: seg.kfEnd.id,
                        objectId: trackData.objectId,
                        propertyId: trackData.propertyId,
                        kfTimeMs: seg.kfEnd.timeMs,
                        kfX: endX,
                        kfY: kfYEnd,
                        outHandle: null,
                        inHandle: {
                            screenX: inHandleScreenX,
                            screenY: inHandleScreenY,
                            visualScreenX: inHandleScreenX,
                            visualScreenY: visualInY
                        },
                        originalCp1: { ...cp1 },
                        originalCp2: { ...cp2 },
                        segmentWidthPx,
                        segmentHeightPx,
                        tangentMode: seg.kfEnd.tangentMode || 'broken'
                    });
                });
            });
        } else if (graphMode === 'value') {
            const valRange = globalMaxVal - globalMinVal;
            const padding = valRange * 0.15 || 10;
            const vMin = globalMinVal - padding;
            const vMax = globalMaxVal + padding;
            const PADDING = 20;
            const contentHeight = height - PADDING * 2;

            calculatedSegments.forEach(trackData => {
                trackData.segments.forEach(seg => {
                    const { kfStart, cp1, cp2, startX, endX, val1, val2, startMs, durationMs } = seg;

                    // Show handles for anything that is not linear or hold.
                    // This includes explicit 'bezier', 'ease', and implicit undefined (which defaults to S-curve).
                    const hasBezier = kfStart.interpolation !== 'linear' && kfStart.interpolation !== 'hold';
                    if (!hasBezier) return;

                    const segmentWidthPx = endX - startX;
                    const deltaVal = val2 - val1;

                    // Calculate P1 (Out Handle)
                    const p1Time = startMs + cp1.x * durationMs;
                    const p1Val = val1 + cp1.y * deltaVal;

                    const valOutX = timeToScreenX(p1Time, width);
                    const valOutY = PADDING + ((vMax - p1Val) / (vMax - vMin)) * contentHeight;

                    // Calculate P2 (In Handle)
                    const p2Time = startMs + cp2.x * durationMs;
                    const p2Val = val1 + cp2.y * deltaVal;

                    const valInX = timeToScreenX(p2Time, width);
                    const valInY = PADDING + ((vMax - p2Val) / (vMax - vMin)) * contentHeight;


                    newHandles.push({
                        kfId: kfStart.id,
                        objectId: trackData.objectId,
                        propertyId: trackData.propertyId,
                        kfTimeMs: kfStart.timeMs,
                        kfX: startX,
                        kfY: PADDING + ((vMax - val1) / (vMax - vMin)) * contentHeight,
                        outHandle: {
                            screenX: valOutX,
                            screenY: valOutY,
                            visualScreenX: valOutX,
                            visualScreenY: valOutY
                        },
                        inHandle: null,
                        originalCp1: { ...cp1 },
                        originalCp2: { ...cp2 },
                        segmentWidthPx,
                        segmentHeightPx: contentHeight, // Approximate for drag norm
                        deltaValue: deltaVal,
                        valueRange: valRange,
                        tangentMode: kfStart.tangentMode || 'broken'
                    });

                    newHandles.push({
                        kfId: seg.kfEnd.id,
                        objectId: trackData.objectId,
                        propertyId: trackData.propertyId,
                        kfTimeMs: seg.kfEnd.timeMs,
                        kfX: endX,
                        kfY: PADDING + ((vMax - val2) / (vMax - vMin)) * contentHeight,
                        outHandle: null,
                        inHandle: {
                            screenX: valInX,
                            screenY: valInY,
                            visualScreenX: valInX,
                            visualScreenY: valInY
                        },
                        originalCp1: { ...cp1 },
                        originalCp2: { ...cp2 },
                        segmentWidthPx,
                        segmentHeightPx: contentHeight,
                        deltaValue: deltaVal,
                        valueRange: valRange,
                        tangentMode: seg.kfEnd.tangentMode || 'broken'
                    });
                });
            });
        }


        handlesRef.current = newHandles;



        // --- DRAWING ---
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        // Grid
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1;
        ctx.beginPath();

        // Vertical grid (time) - affected by zoom
        const baseStepMs = 1000; // 1 second intervals
        const effectiveMsPerPx = msPerPx / zoomX;
        const stepPx = baseStepMs / effectiveMsPerPx;

        // Find first visible grid line
        const visibleStartMs = originMs - (panOffset * effectiveMsPerPx);
        const firstGridMs = Math.floor(visibleStartMs / baseStepMs) * baseStepMs;

        for (let ms = firstGridMs; ; ms += baseStepMs) {
            const x = timeToScreenX(ms, width);
            if (x > width) break;
            if (x >= 0) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            }
        }

        // Horizontal grid (value/velocity) - NOT affected by zoom
        const { pxPerUnit, midY } = scaleRef.current;

        if (graphMode === 'speed') {
            // Derive grid range from scale
            // midY is baseline. Top is PADDING.
            const gridMaxVelocity = (midY - PADDING) / (pxPerUnit || 1);
            const vStep = gridMaxVelocity / 2;

            for (let v = -gridMaxVelocity; v <= gridMaxVelocity; v += vStep) {
                const y = midY - (v * pxPerUnit);
                if (y >= 0 && y <= height) {
                    ctx.moveTo(0, y);
                    ctx.lineTo(width, y);
                }
            }
            ctx.stroke();

            // Labels
            ctx.fillStyle = '#555';
            ctx.font = '10px monospace';
            for (let v = -gridMaxVelocity; v <= gridMaxVelocity; v += vStep) {
                const y = midY - (v * pxPerUnit);
                if (y >= 10 && y <= height - 5) {
                    ctx.fillText(`${v.toFixed(0)}`, 5, y - 2);
                }
            }

            // Zero line (stronger)
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, midY);
            ctx.lineTo(width, midY);
            ctx.stroke();
        } else {
            const valRange = globalMaxVal - globalMinVal;
            const padding = valRange * 0.15 || 10;
            const yMin = globalMinVal - padding;
            const yMax = globalMaxVal + padding;

            const vStep = valRange / 4;
            for (let v = yMin; v <= yMax; v += vStep) {
                const y = PADDING + ((yMax - v) / (yMax - yMin)) * (height - PADDING * 2);
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }
            ctx.stroke();

            ctx.fillStyle = '#555';
            ctx.font = '10px monospace';
            for (let v = yMin; v <= yMax; v += vStep) {
                const y = PADDING + ((yMax - v) / (yMax - yMin)) * (height - PADDING * 2);
                ctx.fillText(`${v.toFixed(0)}`, 5, y - 2);
            }
        }

        if (selectedTracks.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '14px Inter, sans-serif';
            ctx.fillText("Select an object to view its Graph", width / 2 - 100, height / 2 - 20);
            return;
        }

        // Draw Curves
        calculatedSegments.forEach(trackData => {
            ctx.strokeStyle = trackData.color;
            ctx.lineWidth = 2;

            const { pxPerUnit, midY } = trackData.scale;

            // Re-calc bounds for Value mode (since local vars are gone)
            const valRange = globalMaxVal - globalMinVal;
            const padding = valRange * 0.15 || 10;
            const vMin = globalMinVal - padding;
            const vMax = globalMaxVal + padding;
            const PADDING = 20;

            trackData.segments.forEach((seg, i) => {
                ctx.beginPath();
                let isFirst = true;
                seg.points.forEach((pt) => {
                    let y: number;
                    if (graphMode === 'speed') {
                        y = midY - (pt.y * pxPerUnit);
                    } else {
                        y = PADDING + ((vMax - pt.y) / (vMax - vMin)) * (height - PADDING * 2);
                    }
                    // Clamp to visible area
                    y = Math.max(-10, Math.min(height + 10, y));

                    if (isFirst) {
                        ctx.moveTo(pt.x, y);
                        isFirst = false;
                    } else {
                        ctx.lineTo(pt.x, y);
                    }
                });
                ctx.stroke();

                // Velocity step
                if (graphMode === 'speed' && i > 0) {
                    const prevSeg = trackData.segments[i - 1];
                    const prevPt = prevSeg.points[prevSeg.points.length - 1];
                    const currPt = seg.points[0];
                    ctx.beginPath();
                    ctx.setLineDash([2, 2]);
                    ctx.globalAlpha = 0.5;
                    ctx.moveTo(prevPt.x, midY - (prevPt.y * pxPerUnit));
                    ctx.lineTo(currPt.x, midY - (currPt.y * pxPerUnit));
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.globalAlpha = 1.0;
                }
            });

            // Keyframe dots (Value graph)
            if (graphMode === 'value') {
                trackData.segments.forEach((seg, i) => {
                    const y1 = PADDING + ((vMax - seg.val1) / (vMax - vMin)) * (height - PADDING * 2);
                    ctx.fillStyle = trackData.color;
                    ctx.fillRect(seg.startX - 4, y1 - 4, 8, 8);

                    if (i === trackData.segments.length - 1) {
                        const y2 = PADDING + ((vMax - seg.val2) / (vMax - vMin)) * (height - PADDING * 2);
                        ctx.fillRect(seg.endX - 4, y2 - 4, 8, 8);
                    }
                });
            }
        });

        // Draw playhead
        // Draw playhead
        if (calculatedSegments.length > 0 && globalEndMs > globalStartMs) {
            const currentMs = state.timeline.playheadMs;
            const playheadX = timeToScreenX(currentMs, width);

            // Vertical playhead line
            ctx.beginPath();
            ctx.strokeStyle = PLAYHEAD_COLOR;
            ctx.globalAlpha = 0.6;
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1;
            ctx.moveTo(playheadX, 0);
            ctx.lineTo(playheadX, height);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;

            // Ball on each curve
            calculatedSegments.forEach(trackData => {
                const { pxPerUnit, midY } = trackData.scale;

                const valRange = globalMaxVal - globalMinVal;
                const padding = valRange * 0.15 || 10;
                const vMin = globalMinVal - padding;
                const vMax = globalMaxVal + padding;
                const PADDING = 20;

                for (const seg of trackData.segments) {
                    if (currentMs >= seg.startMs && currentMs <= seg.endMs) {
                        const segProgress = (currentMs - seg.startMs) / seg.durationMs;
                        const { cp1, cp2, val1, val2 } = seg;
                        const deltaVal = val2 - val1;
                        const timeSec = seg.durationMs / 1000;

                        let ballY: number;

                        if (seg.kfStart.interpolation === 'hold') {
                            if (graphMode === 'speed') {
                                ballY = midY;
                            } else {
                                ballY = PADDING + ((vMax - val1) / (vMax - vMin)) * (height - PADDING * 2);
                            }
                        } else if (seg.kfStart.interpolation === 'linear') {
                            if (graphMode === 'speed') {
                                const vel = deltaVal / timeSec;
                                ballY = midY - (vel * pxPerUnit);
                            } else {
                                const curVal = val1 + segProgress * deltaVal;
                                ballY = PADDING + ((vMax - curVal) / (vMax - vMin)) * (height - PADDING * 2);
                            }
                        } else {
                            // CUBIC INTERPOLATION
                            // Correctly solve for Parametric T given Linear Time X
                            const solvedT = solveBezierT(cp1.x, cp2.x, segProgress);

                            if (graphMode === 'speed') {
                                // Velocity = dy/dx = (dy/dt) / (dx/dt)
                                const dx = cubicBezierDerivativeOneAxis(solvedT, cp1.x, cp2.x);
                                const dy = cubicBezierDerivativeOneAxis(solvedT, cp1.y, cp2.y);
                                const normVel = dx === 0 ? 0 : dy / dx;

                                const realVel = normVel * (deltaVal / timeSec);
                                ballY = midY - (realVel * pxPerUnit);
                            } else {
                                // Value = y(t)
                                const valueProgress = cubicBezierOneAxis(solvedT, cp1.y, cp2.y);
                                const curVal = val1 + valueProgress * deltaVal;
                                ballY = PADDING + ((vMax - curVal) / (vMax - vMin)) * (height - PADDING * 2);
                            }
                        }

                        // Draw ball
                        ctx.beginPath();
                        ctx.arc(playheadX, ballY, 7, 0, Math.PI * 2);
                        ctx.fillStyle = PLAYHEAD_COLOR;
                        ctx.fill();
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 2;
                        ctx.stroke();

                        break;
                    }
                }
            });
        }

        // Draw Handles (Speed Graph)
        if (graphMode === 'speed') {
            // Sort handles to draw hovered/dragged ones LAST (on top)
            const sortedHandles = [...newHandles].sort((a, b) => {
                const isHoveredA = (hoveredHandleId === a.kfId && (hoveredType === 'out' ? a.outHandle : a.inHandle)) ||
                    (dragTargetRef.current?.handle.kfId === a.kfId);
                const isHoveredB = (hoveredHandleId === b.kfId && (hoveredType === 'out' ? b.outHandle : b.inHandle)) ||
                    (dragTargetRef.current?.handle.kfId === b.kfId);
                if (isHoveredA && !isHoveredB) return 1;
                if (!isHoveredA && isHoveredB) return -1;
                return 0;
            });

            sortedHandles.forEach(h => {
                const isHoveredOut = hoveredHandleId === h.kfId && hoveredType === 'out' && h.outHandle;
                const isHoveredIn = hoveredHandleId === h.kfId && hoveredType === 'in' && h.inHandle;

                // Check if this specific handle is the drag target
                const isDragging = dragTargetRef.current?.handle.kfId === h.kfId &&
                    (dragTargetRef.current?.type === 'out' ? h.outHandle : h.inHandle);

                // KEYFRAME SELECTION STATE
                const isKeyframeSelected = state.timeline.selection.keyIds?.includes(h.kfId);

                // VISUAL STATES
                // Top Priority: Dragging
                // Second: Hovered
                // Third: Selected

                let handleOpacity = 0.5; // Slightly more visible by default
                let handleSize = 4;      // Larger default
                let lineWidth = 1;
                let strokeColor = '#666';
                let fillColor = '#666';

                // Base style for selected keyframe handles
                if (isKeyframeSelected) {
                    handleOpacity = 0.9;
                    handleSize = 6;      // Larger selected
                    lineWidth = 1.5;
                    strokeColor = '#fff';
                    fillColor = '#fff';
                }

                // Hover overrides
                if (isHoveredIn || isHoveredOut) {
                    handleOpacity = 1.0;
                    handleSize = 7;      // Larger hover
                    strokeColor = '#fff';
                    fillColor = '#fff';
                }

                // Specific handle highlighting logic
                // If Keyframe is selected, both handles are "active" visually, 
                // but we might want to highlight specifically the In or Out if they are being manipulated?
                // For now, if Keyframe is selected, show both handles strong.

                ctx.globalAlpha = handleOpacity;
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = lineWidth;
                ctx.fillStyle = fillColor;

                // OUT Handle
                if (h.outHandle) {
                    const isSpecificSelected = isKeyframeSelected; // Both handles light up

                    ctx.beginPath();
                    ctx.moveTo(h.kfX, h.kfY);
                    ctx.lineTo(h.outHandle.visualScreenX, h.outHandle.visualScreenY);
                    ctx.stroke();

                    ctx.beginPath();
                    if (h.tangentMode === 'broken') {
                        ctx.rect(h.outHandle.visualScreenX - handleSize, h.outHandle.visualScreenY - handleSize, handleSize * 2, handleSize * 2);
                    } else {
                        ctx.arc(h.outHandle.visualScreenX, h.outHandle.visualScreenY, handleSize, 0, Math.PI * 2);
                    }
                    ctx.fill();

                    // Extra ring for selection
                    if (isSpecificSelected) {
                        ctx.strokeStyle = '#3b82f6'; // Blue highlight
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        // Restore
                        ctx.strokeStyle = strokeColor;
                        ctx.lineWidth = lineWidth;
                    }
                }

                // IN Handle
                if (h.inHandle) {
                    const isSpecificSelected = isKeyframeSelected;

                    ctx.beginPath();
                    ctx.moveTo(h.kfX, h.kfY);
                    ctx.lineTo(h.inHandle.visualScreenX, h.inHandle.visualScreenY);
                    ctx.stroke();

                    ctx.beginPath();
                    if (h.tangentMode === 'broken') {
                        ctx.rect(h.inHandle.visualScreenX - handleSize, h.inHandle.visualScreenY - handleSize, handleSize * 2, handleSize * 2);
                    } else {
                        ctx.arc(h.inHandle.visualScreenX, h.inHandle.visualScreenY, handleSize, 0, Math.PI * 2);
                    }
                    ctx.fill();

                    // Extra ring for selection
                    if (isSpecificSelected) {
                        ctx.strokeStyle = '#3b82f6';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        // Restore
                        ctx.strokeStyle = strokeColor;
                        ctx.lineWidth = lineWidth;
                    }
                }

                ctx.globalAlpha = 1.0;

                // Keyframe marker
                // Always draw this to ensure we know where the handle originates
                ctx.beginPath();
                ctx.fillStyle = isKeyframeSelected ? '#3b82f6' : '#888';
                ctx.rect(h.kfX - 3, h.kfY - 3, 6, 6);
                ctx.fill();
                if (isKeyframeSelected) {
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            });
        }

    }, [panelWidth, originMs, msPerPx, selectedTracks, hoveredHandleId, hoveredType, graphMode, zoomX, panOffset, state.timeline.playing, state.timeline.playheadMs, timeToScreenX, canvasSize]);

    return (
        <div className="relative w-full h-full bg-[#1a1a1a] overflow-hidden">
            {/* Controls - blocked from marquee */}
            <div className="absolute top-2 right-2 flex gap-1 z-20" data-nomarquee>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomOut}
                    className="h-7 w-7 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700/50"
                    title="Zoom Out (Ctrl+Scroll)"
                >
                    <ZoomOut size={14} />
                </Button>
                <span className="px-2 py-1 text-xs font-mono text-zinc-400 bg-zinc-800/50 rounded min-w-[50px] flex items-center justify-center border border-white/5">
                    {(zoomX * 100).toFixed(0)}%
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomIn}
                    className="h-7 w-7 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700/50"
                    title="Zoom In (Ctrl+Scroll)"
                >
                    <ZoomIn size={14} />
                </Button>

                <div className="w-px bg-white/10 mx-1" />

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={togglePlay}
                    className={cn(
                        "h-7 w-7 transition-colors",
                        state.timeline.playing
                            ? "bg-cyan-500 text-black hover:bg-cyan-400"
                            : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700/50"
                    )}
                    title="Preview Animation"
                >
                    {state.timeline.playing ? <Pause size={14} /> : <Play size={14} />}
                </Button>

                <div className="w-px bg-white/10 mx-1" />

                <Button
                    variant={graphMode === 'speed' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setGraphMode('speed')}
                    className={cn(
                        "h-7 px-2 text-xs font-medium",
                        graphMode === 'speed'
                            ? "bg-yellow-500 text-black hover:bg-yellow-400"
                            : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700/50"
                    )}
                >
                    Speed
                </Button>
                <Button
                    variant={graphMode === 'value' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setGraphMode('value')}
                    className={cn(
                        "h-7 px-2 text-xs font-medium",
                        graphMode === 'value'
                            ? "bg-yellow-500 text-black hover:bg-yellow-400"
                            : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700/50"
                    )}
                >
                    Value
                </Button>

                <div className="w-px bg-white/10 mx-1" />

                {/* Numeric Inputs for Selected Handle */}
                {selectedHandle && (
                    <>
                        <div className="flex items-center gap-1 bg-zinc-800/50 rounded px-1.5 py-0.5 border border-white/10">
                            <span className="text-[10px] text-zinc-500 font-mono">X</span>
                            <Input
                                type="number"
                                step="0.01"
                                className="w-12 h-5 p-0 bg-transparent text-xs font-mono text-zinc-200 border-none outline-none text-right focus-visible:ring-0 placeholder:text-zinc-600"
                                placeholder="Infl"
                                onKeyDown={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (isNaN(val)) return;

                                    const handle = handlesRef.current.find(h =>
                                        h.kfId === selectedHandle.kfId &&
                                        (selectedHandle.type === 'out' ? h.outHandle : h.inHandle)
                                    );
                                    if (!handle) return;

                                    let newControlPoints;
                                    if (selectedHandle.type === 'out') {
                                        newControlPoints = {
                                            x1: val,
                                            y1: handle.originalCp1.y,
                                            x2: handle.originalCp2.x,
                                            y2: handle.originalCp2.y
                                        };
                                    } else {
                                        newControlPoints = {
                                            x1: handle.originalCp1.x,
                                            y1: handle.originalCp1.y,
                                            x2: val,
                                            y2: handle.originalCp2.y
                                        };
                                    }

                                    dispatch({
                                        type: 'UPDATE_KEYFRAME_CONTROL_POINTS',
                                        payload: {
                                            objectId: selectedHandle.objectId,
                                            propertyId: selectedHandle.propertyId as PropertyId,
                                            keyframeId: selectedHandle.kfId,
                                            controlPoints: newControlPoints
                                        }
                                    });
                                }}
                            />
                        </div>
                        <div className="flex items-center gap-1 bg-zinc-800/50 rounded px-1.5 py-0.5 border border-white/10">
                            <span className="text-[10px] text-zinc-500 font-mono">Y</span>
                            <Input
                                type="number"
                                step="0.01"
                                className="w-12 h-5 p-0 bg-transparent text-xs font-mono text-zinc-200 border-none outline-none text-right focus-visible:ring-0"
                                onKeyDown={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (isNaN(val)) return;

                                    const handle = handlesRef.current.find(h =>
                                        h.kfId === selectedHandle.kfId &&
                                        (selectedHandle.type === 'out' ? h.outHandle : h.inHandle)
                                    );
                                    if (!handle) return;

                                    let newControlPoints;
                                    if (selectedHandle.type === 'out') {
                                        newControlPoints = {
                                            x1: handle.originalCp1.x,
                                            y1: val,
                                            x2: handle.originalCp2.x,
                                            y2: handle.originalCp2.y
                                        };
                                    } else {
                                        newControlPoints = {
                                            x1: handle.originalCp1.x,
                                            y1: handle.originalCp1.y,
                                            x2: handle.originalCp2.x,
                                            y2: val
                                        };
                                    }

                                    dispatch({
                                        type: 'UPDATE_KEYFRAME_CONTROL_POINTS',
                                        payload: {
                                            objectId: selectedHandle.objectId,
                                            propertyId: selectedHandle.propertyId as PropertyId,
                                            keyframeId: selectedHandle.kfId,
                                            controlPoints: newControlPoints
                                        }
                                    });
                                }}
                            />
                        </div>
                        <div className="w-px bg-white/10 mx-1" />
                    </>
                )}

                <Popover open={showPresetPicker} onOpenChange={setShowPresetPicker}>
                    <PopoverTrigger asChild>
                        <Button
                            variant={showPresetPicker ? 'default' : 'ghost'}
                            size="sm"
                            className={cn(
                                "h-7 px-2 text-xs font-medium gap-1",
                                showPresetPicker
                                    ? "bg-amber-500 text-black hover:bg-amber-400"
                                    : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700/50"
                            )}
                            title="Easing Presets Library"
                        >
                            <Sparkles size={12} />
                            Presets
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[420px] p-0 border-none bg-transparent shadow-none" side="top" align="end" sideOffset={8}>
                        <EasingPresetPicker
                            onApply={handleApplyPreset}
                            onClose={() => setShowPresetPicker(false)}
                            selectedKeyframeCount={selectedTracks.reduce((sum, t) => sum + Math.max(0, t.track.keyframes.length - 1), 0)}
                        />
                    </PopoverContent>
                </Popover>
            </div>

            {/* Legend */}
            {selectedTracks.length > 0 && (
                <div className="absolute top-2 left-2 text-xs font-mono text-white/50 pointer-events-none flex flex-col gap-1 bg-black/70 p-1.5 rounded z-10">
                    <span className="text-white/70 font-bold mb-0.5">
                        {graphMode === 'speed' ? 'Speed Graph' : 'Value Graph'}
                    </span>
                    {selectedTracks.map((t, i) => {
                        let color = '#fff';
                        if (t.track.id === 'position') color = '#ef4444';
                        else if (t.track.id.includes('scale')) color = '#22c55e';
                        else if (t.track.id === 'rotation') color = '#3b82f6';
                        else if (t.track.id === 'opacity') color = '#a855f7';
                        return (
                            <span key={i} style={{ color }}>
                                ■ {t.track.id}
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Instructions */}
            <div className="absolute bottom-2 left-2 text-[10px] text-zinc-600 pointer-events-none z-10">
                Shift: Lock Axis | Ctrl+Scroll: Zoom | Shift+Scroll: Pan
            </div>

            <canvas
                ref={canvasRef}
                className="w-full h-full block touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onContextMenu={handleContextMenu}
                onPointerLeave={handlePointerUp}
                onWheel={handleWheel}
            />
            {contextMenuState && createPortal(
                <div
                    className="fixed z-[99999] w-32 bg-popover text-popover-foreground border rounded-md shadow-md p-1 flex flex-col gap-1"
                    style={{
                        left: Math.min(contextMenuState.x, window.innerWidth - 130), // Prevent right overflow
                        top: Math.min(contextMenuState.y, window.innerHeight - 100)  // Prevent bottom overflow
                    }}
                    onMouseDown={e => e.stopPropagation()}
                >
                    <div className="px-2 py-1 text-xs font-semibold opacity-50">Tangent Mode</div>
                    <button
                        className={cn("px-2 py-1.5 text-sm text-left hover:bg-accent rounded-sm", contextMenuState.currentMode === 'broken' && "bg-accent/50")}
                        onClick={() => handleSetTangentMode('broken')}
                    >
                        Broken
                    </button>
                    <button
                        className={cn("px-2 py-1.5 text-sm text-left hover:bg-accent rounded-sm", contextMenuState.currentMode === 'smooth' && "bg-accent/50")}
                        onClick={() => handleSetTangentMode('smooth')}
                    >
                        Smooth
                    </button>
                </div>,
                document.body
            )}
            {/* Marquee Overlay */}
            {selectionRect && (
                <div style={{
                    position: 'fixed', // DOMRect from state is typically Client Rect (Screen). 
                    // However, setSelectionRect usage with clientX/Y creates Client Coordinates.
                    // If the container has `transform`, `fixed` is safer for screen coords, OR `absolute` if we calculated relative to container.
                    // We used `e.clientX`. So these are viewport coordinates. 
                    // `fixed` is correct for viewport coordinates.
                    left: selectionRect.x,
                    top: selectionRect.y,
                    width: selectionRect.width,
                    height: selectionRect.height,
                    border: '1px solid rgba(0, 120, 255, 0.8)',
                    backgroundColor: 'rgba(0, 120, 255, 0.25)',
                    pointerEvents: 'none',
                    zIndex: 9999
                }} />
            )}
        </div>
    );
}

