// @ts-nocheck

'use client';

import { memo, useRef } from "react";
import { cn } from "@/lib/utils";
import { useEditor } from "@/context/editor-context";
import type { Clip } from "@/types/editor";
import { msToX } from "@/lib/anim/utils";
import { selectActiveLayerSegment } from "@/lib/anim/selectors";

export const TrackRow = memo(({
  rowHeight = 28,
  layerId,
  objectId,
  clip,
  isGroup,
  panelWidth,
  originMs,
  msPerPx,
  onSelect,
  onBeginDragClip,
  onBeginResizeStart,
  onBeginResizeEnd,
  onBeginSlideTrack,
}: {
  rowHeight?: number;
  layerId: string;
  objectId: string;
  clip: Clip;
  isGroup?: boolean;
  panelWidth: number;
  originMs: number;
  msPerPx: number;
  onSelect?: (id: string, e: React.PointerEvent) => void;
  onBeginDragClip?: (id: string, e: React.PointerEvent<HTMLDivElement>) => void;
  onBeginResizeStart?: (id: string, e: React.PointerEvent<HTMLDivElement>) => void;
  onBeginResizeEnd?: (id: string, e: React.PointerEvent<HTMLDivElement>) => void;
  onBeginSlideTrack?: (id: string, e: React.PointerEvent) => void;
}) => {
  const { state, dispatch } = useEditor();
  const { timeline } = state;

  const isActive = !!selectActiveLayerSegment(state, layerId, state.timeline.playheadMs);
  const isLayerSelected = state.selectedObjectIds.includes(objectId);

  const THRESH = 3;
  const startXRef = useRef<number | null>(null);
  const didDragRef = useRef(false);
  const rowRef = useRef<HTMLDivElement | null>(null);

  const clipColor = (clip.selected || isLayerSelected)
    ? "var(--track-teal)"
    : "var(--track-gray)";

  const handleRowPointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    dispatch({ type: 'SELECT_OBJECT', payload: { id: objectId, shiftKey: e.shiftKey } });
    onSelect?.(objectId, e);
  };

  const handleRowPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const targetEl = e.target as HTMLElement;

    if (targetEl.closest('[data-clip-id]') || targetEl.closest('[data-clip-grip]')) return;

    const host = e.currentTarget as HTMLElement;
    startXRef.current = e.clientX;
    didDragRef.current = false;
    host.setPointerCapture(e.pointerId);

    const handleMove = (me: PointerEvent) => {
      if (startXRef.current == null || didDragRef.current) return;
      const dx = me.clientX - startXRef.current;
      if (Math.abs(dx) >= THRESH) {
        didDragRef.current = true;
        onBeginSlideTrack?.(layerId, (me as unknown) as React.PointerEvent);
      }
    };
    const handleUp = () => {
      host.releasePointerCapture(e.pointerId);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      startXRef.current = null;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  return (
    <div
      ref={rowRef}
      data-selected={isLayerSelected ? "true" : "false"}
      aria-selected={isLayerSelected}
      className={cn(
        "relative w-full select-none transition-colors",
        "cursor-default"
      )}
      style={{ height: rowHeight }}
      onPointerDownCapture={handleRowPointerDownCapture}
      onPointerDown={handleRowPointerDown}
    >
      <div className={cn("absolute inset-0 transition-colors pointer-events-none", isLayerSelected ? "bg-primary/10" : "bg-[rgba(34,34,37,0.55)]")} />
      <div className="absolute left-0 right-0 bottom-0 h-px bg-black/40 pointer-events-none" />

      {clip.segments.map((seg, i) => {
        const x = msToX(seg.startMs, originMs, msPerPx);
        const endX = msToX(seg.endMs, originMs, msPerPx);
        const w = Math.max(1, endX - x);

        return (
          <div
            key={i}
            data-clip-id={clip.id}
            onPointerDown={(e) => {
              onBeginDragClip?.(clip.id, e);
            }}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing",
              isGroup ? "rounded-md" : "rounded-sm",
              "border",
              (clip.selected || isLayerSelected) ? "border-white/15 ring-1 ring-white/10" : "border-black/30",
              clip.disabled && "opacity-60"
            )}
            style={{
              left: x,
              width: w,
              height: rowHeight - 8,
              background: clipColor,
            }}
          >
            <div
              data-clip-grip
              data-nomarquee
              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize"
              onPointerDown={(e) => { e.stopPropagation(); onBeginResizeStart?.(clip.id, e); }}
            />
            <div
              data-clip-grip
              data-nomarquee
              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize"
              onPointerDown={(e) => { e.stopPropagation(); onBeginResizeEnd?.(clip.id, e); }}
            />
          </div>
        )
      })}
    </div>
  );
});

TrackRow.displayName = 'TrackRow';
