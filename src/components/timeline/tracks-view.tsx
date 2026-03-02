'use client';

import { useEditorStore } from "@/store";
import type { Keyframe as KeyframeType, PropertyId, SvgObject, GroupObject, TimelineRow } from "@/types/editor";
import { useRef, useMemo, RefObject } from "react";
import { pxToMs, msToX } from "@/lib/anim/utils";
import { TrackRow } from "./track-row";
import { PropertyTrackRow } from "./property-track-row";
import { EmptyTrackRow } from "./empty-track-row";
import { getCompositeGroupClip, getLayerClipSafe } from "@/lib/anim/group-clip";
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from "@/lib/utils";
import { generateTicks } from '@/lib/anim/timeline-ticks';

const TrackContent = ({
  row,
  panelWidth,
  originMs,
  msPerPx,
  onKeyframeContextMenu,
}: {
  row: TimelineRow,
  panelWidth: number;
  originMs: number;
  msPerPx: number;
  onKeyframeContextMenu?: (e: React.MouseEvent, id: string, objectId: string, propertyId: PropertyId) => void;
}) => {
  const dispatch = useEditorStore(state => state.dispatch);
  const stateCounterpart = useEditorStore(state => state.present);
  const objects = useEditorStore(state => (state.transientPresent ?? state.present).objects);
  const timeline = useEditorStore(state => (state.transientPresent ?? state.present).timeline);
  const { objectId } = row;
  const { durationMs, fps } = timeline;

  const dragInfoRef = useRef<{
    type: 'move' | 'resize-start' | 'resize-end';
    clipId: string;
    startX: number;
    originalSegments: { startMs: number, endMs: number }[];
    lastAppliedMs: number;
  } | null>(null);
  const minLenMs = 100; // consistente con reducer

  const object = objects[objectId];
  if (!object) return <EmptyTrackRow height={row.height} />;

  const displayedClip = useMemo(() => {
    const base = object.type === "group"
      ? getCompositeGroupClip(stateCounterpart, objectId)
      : getLayerClipSafe(stateCounterpart, objectId);
    const startOffset = stateCounterpart.timeline.layers[objectId]?.startMs ?? 0;
    if (!base) return base;
    return {
      ...base,
      segments: base.segments.map(s => ({
        startMs: s.startMs + startOffset,
        endMs: s.endMs + startOffset,
      })),
    };
  }, [stateCounterpart, objectId, object.type]);

  if (!displayedClip?.segments?.length && row.kind === 'header') {
    return <EmptyTrackRow height={row.height} />;
  }

  const containerRef = useRef<HTMLDivElement | null>(null);

  const handlePointerDown = (
    type: 'move' | 'resize-start' | 'resize-end',
    clipId: string,
    e: React.PointerEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (object.locked) return;

    if (timeline.playing) {
      dispatch({ type: 'SET_TIMELINE_PLAYING', payload: false });
    }

    const target = e.target as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const stepMs =
      timeline.ui?.snapStepMs ??
      (1000 / (timeline.fps || fps || 30));
    const doSnap = timeline.ui?.snap ?? true;

    dragInfoRef.current = {
      type,
      clipId,
      startX: e.clientX,
      originalSegments: JSON.parse(JSON.stringify(displayedClip.segments)),
      lastAppliedMs: 0
    };
    document.body.style.cursor =
      type === 'move' ? 'grabbing' : 'ew-resize';

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragInfoRef.current) return;
      moveEvent.preventDefault();

      const { type, clipId, startX, originalSegments } = dragInfoRef.current;
      const dx = moveEvent.clientX - startX;
      const rawDeltaMs = dx * msPerPx;
      const snap = (v: number) => doSnap ? Math.round(v / stepMs) * stepMs : v;
      let wantedDelta = rawDeltaMs;
      let deltaToApply: number;

      if (type === 'move') {
        const origStart = originalSegments[0]?.startMs ?? 0;
        const origEnd = originalSegments[originalSegments.length - 1]?.endMs ?? 0;
        const length = origEnd - origStart;
        const newStart = snap(origStart + wantedDelta);
        const newEnd = newStart + length;
        let clampedStart = Math.max(0, Math.min(newStart, durationMs - length));
        wantedDelta = clampedStart - origStart;
      } else if (type === 'resize-start') {
        const origStart = originalSegments[0]?.startMs ?? 0;
        const origEnd = originalSegments[originalSegments.length - 1]?.endMs ?? 0;
        const newStart = snap(origStart + wantedDelta);
        let clampedStart = Math.max(0, Math.min(newStart, origEnd - minLenMs));
        wantedDelta = clampedStart - origStart;
      } else { // 'resize-end'
        const origStart = originalSegments[0]?.startMs ?? 0;
        const origEnd = originalSegments[originalSegments.length - 1]?.endMs ?? 0;
        const newEnd = snap(origEnd + wantedDelta);
        let clampedEnd = Math.min(durationMs, Math.max(newEnd, origStart + minLenMs));
        wantedDelta = clampedEnd - origEnd;
      }

      deltaToApply = wantedDelta - (dragInfoRef.current?.lastAppliedMs ?? 0);
      if (deltaToApply === 0) return;

      if (type === 'move') {
        // Use SLIDE_LAYER_TRACKS instead of MOVE_CLIP to sync all properties/keyframes
        dispatch({
          type: 'SLIDE_LAYER_TRACKS',
          payload: { objectIds: [clipId], dMs: deltaToApply },
          transient: true
        });
      } else if (type === 'resize-start') {
        dispatch({ type: 'RESIZE_CLIP_START', payload: { clipId, dMs: deltaToApply }, transient: true });
      } else {
        dispatch({ type: 'RESIZE_CLIP_END', payload: { clipId, dMs: deltaToApply }, transient: true });
      }
      if (dragInfoRef.current) {
        dragInfoRef.current.lastAppliedMs = (dragInfoRef.current.lastAppliedMs ?? 0) + deltaToApply;
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (!dragInfoRef.current) return;
      target.releasePointerCapture(e.pointerId);
      dragInfoRef.current = null;
      dispatch({ type: "COMMIT_DRAG" });
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      document.body.style.cursor = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handlePointerDownSlide = (
    layerId: string,
    e: React.PointerEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (object.locked) return;

    if (timeline.playing) {
      dispatch({ type: 'SET_TIMELINE_PLAYING', payload: false });
    }

    const target = e.target as HTMLElement;
    if (target.setPointerCapture) {
      target.setPointerCapture(e.pointerId);
    }

    dragInfoRef.current = {
      type: 'move',
      clipId: layerId,
      startX: e.clientX,
      originalSegments: [],
      lastAppliedMs: 0
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragInfoRef.current) return;
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - dragInfoRef.current.startX;
      const rawDeltaMs = dx * msPerPx;
      const snap = timeline.ui.snap;
      const step = timeline.ui.snapStepMs || (1000 / timeline.fps);
      const dMs = snap ? Math.round(rawDeltaMs / step) * step : rawDeltaMs;

      const deltaToApply = dMs - dragInfoRef.current.lastAppliedMs;
      if (deltaToApply === 0) return;

      dispatch({
        type: 'SLIDE_LAYER_TRACKS',
        payload: { objectIds: [objectId], dMs: deltaToApply },
        transient: true
      });

      if (dragInfoRef.current) {
        dragInfoRef.current.lastAppliedMs += deltaToApply;
      }
    };

    const handlePointerUp = () => {
      if (target.releasePointerCapture) {
        target.releasePointerCapture(e.pointerId);
      }
      dragInfoRef.current = null;
      dispatch({ type: "COMMIT_DRAG" });
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };


  return (
    <div
      ref={containerRef}
      className="relative h-full"
    >
      {row.kind === 'header' && (
        <TrackRow
          layerId={objectId}
          objectId={objectId}
          rowHeight={row.height}
          clip={displayedClip}
          isGroup={object.type === "group"}
          panelWidth={panelWidth}
          originMs={originMs}
          msPerPx={msPerPx}
          onSelect={(id, e) => dispatch({ type: 'SELECT_OBJECT', payload: { id, shiftKey: e.shiftKey } })}
          onBeginDragClip={(id, e) => handlePointerDown('move', id, e)}
          onBeginResizeStart={(id, e) => handlePointerDown('resize-start', id, e)}
          onBeginResizeEnd={(id, e) => handlePointerDown('resize-end', id, e)}
          onBeginSlideTrack={(id, e) => handlePointerDownSlide(id, e)}
        />
      )}
      {row.kind === 'track' && (
        <PropertyTrackRow
          objectId={objectId}
          propertyId={row.propertyId!}
          rowHeight={row.height}
          originMs={originMs}
          msPerPx={msPerPx}
          onKeyframeContextMenu={onKeyframeContextMenu}
        />
      )}
    </div>
  );
};


export default function TracksView({ scrollRef, panelWidth, originMs, msPerPx, onKeyframeContextMenu }: { scrollRef: RefObject<HTMLDivElement>, panelWidth: number, originMs: number, msPerPx: number, onKeyframeContextMenu?: (e: React.MouseEvent, id: string, objectId: string, propertyId: PropertyId) => void }) {
  const timeline = useEditorStore(state => (state.transientPresent ?? state.present).timeline);
  const timelineRows = useEditorStore(state => (state.transientPresent ?? state.present).timelineRows);
  const { durationMs, fps } = timeline;

  const totalWidth = Math.max(panelWidth, durationMs / msPerPx);

  const rowVirtualizer = useVirtualizer({
    count: timelineRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => timelineRows[index].height,
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div
      className="relative"
      style={{ width: totalWidth, height: rowVirtualizer.getTotalSize() }}
    >
      {virtualItems.map((virtualItem) => {
        const row = timelineRows[virtualItem.index];
        if (!row) return null;
        return (
          <div
            key={row.key}
            className="absolute top-0 left-0 w-full"
            style={{
              height: `${row.height}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <TrackContent
              row={row}
              panelWidth={panelWidth}
              originMs={originMs}
              msPerPx={msPerPx}
              onKeyframeContextMenu={onKeyframeContextMenu}
            />
          </div>
        )
      })}

      {/* Global Vertical Grid Lines (Overlay) */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-zinc-950/30" style={{ backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent ${msToX(1000, 0, msPerPx) - 1}px, rgba(255,255,255,0.05) ${msToX(1000, 0, msPerPx)}px)` }}></div>
    </div>
  );
}
