"use client";

import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface TimelineNavigatorProps {
    durationMs: number;
    viewStartMs: number;
    viewEndMs: number;
    onBoundsChange: (bounds: { startMs: number, endMs: number }) => void;
}

export function TimelineNavigator({
    durationMs,
    viewStartMs,
    viewEndMs,
    onBoundsChange,
}: TimelineNavigatorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState<false | 'start' | 'end' | 'bar'>(false);
    const dragStartRef = useRef({ x: 0, startMs: 0, endMs: 0 });

    const handlePointerDown = (
        e: React.PointerEvent<HTMLDivElement>,
        dragType: 'start' | 'end' | 'bar'
    ) => {
        if (!containerRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        
        setIsDragging(dragType);
        dragStartRef.current = {
            x: e.clientX,
            startMs: viewStartMs,
            endMs: viewEndMs,
        };

        const containerRect = containerRef.current.getBoundingClientRect();
        
        const handlePointerMove = (moveEvent: PointerEvent) => {
            const dx = moveEvent.clientX - dragStartRef.current.x;
            const dMs = (dx / containerRect.width) * durationMs;

            let newStart = dragStartRef.current.startMs;
            let newEnd = dragStartRef.current.endMs;

            if (dragType === 'bar') {
                newStart += dMs;
                newEnd += dMs;
            } else if (dragType === 'start') {
                newStart += dMs;
            } else if (dragType === 'end') {
                newEnd += dMs;
            }

            // Clamp values
            if (newEnd < newStart) {
                if (dragType === 'start') newStart = newEnd;
                else newEnd = newStart;
            }
            
            const viewDuration = newEnd - newStart;
            if (newStart < 0) {
                newStart = 0;
                if (dragType === 'bar') newEnd = viewDuration;
            }
            if (newEnd > durationMs) {
                newEnd = durationMs;
                if (dragType === 'bar') newStart = durationMs - viewDuration;
            }
            
            newStart = Math.max(0, newStart);
            newEnd = Math.min(durationMs, newEnd);

            onBoundsChange({ startMs: newStart, endMs: newEnd });
        };
        
        const handlePointerUp = () => {
            setIsDragging(false);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
    };
    
    if (durationMs <= 0) return null;

    const leftPercent = (viewStartMs / durationMs) * 100;
    const widthPercent = ((viewEndMs - viewStartMs) / durationMs) * 100;

    return (
        <div
            ref={containerRef}
            className="w-full h-4 bg-muted/50 rounded-sm relative cursor-pointer"
        >
            <div
                className="absolute h-full bg-primary/40 border border-primary/80 rounded-sm cursor-grab active:cursor-grabbing"
                style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                }}
                onPointerDown={(e) => handlePointerDown(e, 'bar')}
            >
                <div 
                    className="absolute left-0 top-0 bottom-0 -translate-x-1/2 w-2 cursor-ew-resize flex items-center justify-center"
                    onPointerDown={(e) => handlePointerDown(e, 'start')}
                />
                <div 
                    className="absolute right-0 top-0 bottom-0 translate-x-1/2 w-2 cursor-ew-resize flex items-center justify-center"
                    onPointerDown={(e) => handlePointerDown(e, 'end')}
                />
            </div>
        </div>
    );
}

