'use client';

import React from 'react';
import { useEditor } from '@/context/editor-context';
import { msToX } from '@/lib/anim/utils';
import { formatTime } from './transport';

const TOP_SPACER_H = 36;

export function Playhead({
    panelWidth,
    leftOffset,
    originMs,
    msPerPx,
    onPointerDown,
    onPointerMove,
    onPointerUp,
}: {
    panelWidth: number;
    leftOffset: number;
    originMs: number;
    msPerPx: number;
    onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
    onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
    onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
}) {
    const { state } = useEditor();
    const { timeline } = state;
    const { playheadMs, fps } = timeline;

    if (panelWidth <= 0 || msPerPx <= 0) return null;

    const x = msToX(playheadMs, originMs, msPerPx);

    // Only render if visible
    if (x < 0 || x > panelWidth) return null;

    const left = Math.round(leftOffset + x) + 0.5;

    return (
        <div
            className="pointer-events-none fixed top-0 bottom-0 z-50"
            style={{ left, top: TOP_SPACER_H }}
            data-nomarquee
        >
            {/* Time badge at the top */}
            <div
                className="absolute top-0 left-0 -translate-x-1/2 px-1.5 py-0.5 rounded-sm bg-blue-500 text-white text-[10px] font-mono shadow-md shadow-blue-500/20"
                style={{ pointerEvents: onPointerDown ? 'auto' : 'none', cursor: onPointerDown ? 'ew-resize' : 'default' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
            >
                {formatTime(playheadMs, fps)}
            </div>
            {/* Vertical blue line */}
            <div className="absolute top-[18px] left-0 w-px h-full bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.5)]" />
        </div>
    );
}
