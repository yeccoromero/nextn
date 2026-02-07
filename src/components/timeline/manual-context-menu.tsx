// @ts-nocheck
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditor } from '@/context/editor-context';
import type { InterpolationType, PropertyId } from '@/types/editor';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';
import { BezierEditor } from './bezier-editor';

interface Props {
    x: number;
    y: number;
    keyframeId: string;
    objectId: string;
    propertyId: PropertyId;
    onClose: () => void;
}

export function ManualContextMenu({ x, y, keyframeId, objectId, propertyId, onClose }: Props) {
    const { state, dispatch } = useEditor();
    const ref = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);
    const [editingCurve, setEditingCurve] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Close on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            // Check if click is actually outside
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        };
        // Close on escape
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        // Use capture for mousedown to ensure we catch it before others might stopPropagation
        window.addEventListener('mousedown', handleClick, true);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('mousedown', handleClick, true);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const getKeysToUpdate = () => {
        const selectedKeyIds = state.timeline.selection?.keyIds ?? [];
        const isTargetSelected = selectedKeyIds.includes(keyframeId);

        let keysToUpdate: { objectId: string; propertyId: PropertyId; keyframeId: string }[] = [];

        if (isTargetSelected) {
            // Find all selected keyframes across all layers
            for (const [layerId, layer] of Object.entries(state.timeline.layers)) {
                if (!layer || !layer.properties) continue;
                for (const track of layer.properties) {
                    for (const kf of track.keyframes) {
                        if (selectedKeyIds.includes(kf.id)) {
                            keysToUpdate.push({ objectId: layerId, propertyId: track.id, keyframeId: kf.id });
                        }
                    }
                }
            }
        } else {
            // Just the target
            keysToUpdate.push({ objectId, propertyId, keyframeId });
        }
        return keysToUpdate;
    };

    const handleSetInterpolation = (type: InterpolationType) => {
        const keys = getKeysToUpdate();
        keys.forEach(k => {
            dispatch({
                type: 'SET_KEYFRAME_INTERPOLATION',
                payload: { objectId: k.objectId, propertyId: k.propertyId, keyframeId: k.keyframeId, interpolationType: type },
            });
        });
        onClose();
    };

    const handleDelete = () => {
        const keys = getKeysToUpdate();
        keys.forEach(k => {
            dispatch({
                type: 'DELETE_KEYFRAME',
                payload: { objectId: k.objectId, propertyId: k.propertyId, keyframeId: k.keyframeId },
            });
        });
        onClose();
    };

    const handleEditCurve = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingCurve(true);
    };

    if (!mounted) return null;

    if (editingCurve) {
        // Find current values
        const layer = state.timeline.layers[objectId];
        const track = layer?.properties.find(p => p.id === propertyId);
        const kf = track?.keyframes.find(k => k.id === keyframeId);
        const currentCP = kf?.controlPoints;

        return createPortal(
            <BezierEditor
                className="fixed z-[100001] shadow-2xl"
                style={{ left: x, top: y }}
                value={currentCP}
                onClose={() => { setEditingCurve(false); onClose(); }}
                onChange={(cp) => {
                    dispatch({
                        type: 'UPDATE_KEYFRAME_CONTROL_POINTS',
                        payload: { objectId, propertyId, keyframeId, controlPoints: cp }
                    });
                }}
            />,
            document.body
        );
    }

    return createPortal(
        <div
            ref={ref}
            className={cn(
                "fixed z-[100000] w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
                "flex flex-col gap-0.5"
            )}
            style={{
                left: Math.min(x, window.innerWidth - 220), // Prevent right overflow
                top: Math.min(y, window.innerHeight - 250),  // Prevent bottom overflow
                pointerEvents: 'auto',
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
        >
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground select-none">
                Interpolation
            </div>

            <button
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground gap-2 w-full text-left"
                onClick={handleEditCurve}
            >
                <div className="w-4 h-4 flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 12 12" className="text-current">
                        <path d="M1 11 C 3 11, 4 4, 11 1" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                </div>
                Edit Curve...
            </button>

            <div className="h-px my-1 bg-border" />

            <button
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground gap-2 w-full text-left"
                onClick={() => handleSetInterpolation('linear')}
            >
                <span className="w-2 h-2 bg-current transform rotate-45 pointer-events-none" />
                Linear
            </button>

            <button
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground gap-2 w-full text-left"
                onClick={() => handleSetInterpolation('hold')}
            >
                <span className="w-2 h-2 bg-current rounded-none pointer-events-none" />
                Hold
            </button>

            <button
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground gap-2 w-full text-left"
                onClick={() => handleSetInterpolation('ease')}
            >
                <span className="w-2 h-2 bg-current pointer-events-none" style={{ clipPath: 'polygon(50% 0%, 100% 0%, 50% 50%, 100% 100%, 0% 100%, 50% 50%, 0% 0%)' }} />
                Ease
            </button>

            <div className="h-px my-1 bg-border" />

            <button
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-destructive hover:text-destructive-foreground gap-2 w-full text-left text-destructive"
                onClick={handleDelete}
            >
                <Trash2 className="w-3 h-3" />
                Delete Selected
            </button>
        </div>,
        document.body
    );
}
