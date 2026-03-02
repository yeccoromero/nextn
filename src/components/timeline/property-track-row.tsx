'use client';

import { useMemo, useRef, memo } from "react";
import { useEditorStore } from "@/store";
import { msToX, pxToMs } from "@/lib/anim/utils";
import type { PropertyId, Keyframe as KeyframeType } from "@/types/editor";
import { Keyframe } from "./keyframe";
import { cn } from "@/lib/utils";

export const PropertyTrackRow = memo(({
  objectId,
  propertyId,
  rowHeight,
  originMs,
  msPerPx,
  onKeyframeContextMenu,
}: {
  objectId: string,
  propertyId: PropertyId,
  rowHeight: number,
  originMs: number,
  msPerPx: number,
  onKeyframeContextMenu?: (e: React.MouseEvent, id: string, objectId: string, propertyId: PropertyId) => void;
}) => {
  const dispatch = useEditorStore(state => state.dispatch);
  const timeline = useEditorStore(state => (state.transientPresent ?? state.present).timeline);
  const objects = useEditorStore(state => (state.transientPresent ?? state.present).objects);
  const layerTrack = timeline.layers[objectId];

  const dragInfoRef = useRef<{
    startX: number;
    originalKeyframes: Array<{ id: string; timeMs: number; objectId: string; propertyId: PropertyId }>;
  } | null>(null);

  const selectedSet = useMemo(
    () => new Set(timeline.selection.keyIds ?? []),
    [timeline.selection.keyIds]
  );

  const tracksToShow = useMemo(() => {
    if (!layerTrack) return [];
    if (propertyId === 'position') {
      return layerTrack.properties.filter(p => p.id === 'position');
    }
    if (propertyId === 'scaleX') {
      return layerTrack.properties.filter(p => p.id === 'scale');
    }
    return layerTrack.properties.filter(p => p.id === propertyId);
  }, [layerTrack, propertyId]);

  if (!tracksToShow.length) return <div style={{ height: rowHeight }} />;

  const handleKeyframePointerDown = (clickedId: string, clickedPropId: PropertyId, e: React.PointerEvent) => {
    // Only handle left-click (button 0) for drag functionality
    // Right-click (button 2) should be handled by context menu
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    if (timeline.playing) {
      dispatch({ type: 'SET_TIMELINE_PLAYING', payload: false });
    }

    const target = e.target as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const isClickedSelected = selectedSet.has(clickedId);
    let effectiveSelection: string[];

    if (e.shiftKey) {
      effectiveSelection = Array.from(new Set([...selectedSet, clickedId]));
      dispatch({ type: 'SELECT_KEYFRAME', payload: { objectId, propertyId: clickedPropId, keyframeId: clickedId, additive: true } });
    } else {
      effectiveSelection = isClickedSelected ? Array.from(selectedSet) : [clickedId];
      if (!isClickedSelected) {
        dispatch({ type: 'SELECT_KEYFRAME', payload: { objectId, propertyId: clickedPropId, keyframeId: clickedId, additive: false } });
      }
    }

    const originalKeyframes: Array<{ id: string; timeMs: number; objectId: string; propertyId: PropertyId }> = [];
    for (const [layerObjectId, layer] of Object.entries(timeline.layers)) {
      if (!layer) continue;
      for (const track of layer.properties) {
        for (const kf of track.keyframes) {
          if (effectiveSelection.includes(kf.id)) {
            originalKeyframes.push({ id: kf.id, timeMs: kf.timeMs, objectId: layerObjectId, propertyId: track.id });
          }
        }
      }
    }

    dragInfoRef.current = {
      startX: e.clientX,
      originalKeyframes,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const drag = dragInfoRef.current;
      if (!drag) return;

      const dx = moveEvent.clientX - drag.startX;
      const rawDeltaMs = dx * msPerPx;

      const step = timeline.ui.snapStepMs ?? 1;
      const dMs = Math.round(rawDeltaMs / step) * step;

      const moves = drag.originalKeyframes.map(kf => ({
        objectId: kf.objectId,
        propertyId: kf.propertyId,
        keyframeId: kf.id,
        timeMs: Math.max(0, kf.timeMs + dMs),
      }));

      dispatch({
        type: 'MOVE_TIMELINE_KEYFRAMES',
        payload: { moves },
        transient: true,
      });
    };

    const handlePointerUp = () => {
      target.releasePointerCapture(e.pointerId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      if (dragInfoRef.current?.originalKeyframes?.length) {
        dispatch({ type: 'COMMIT_DRAG' });
      }
      dragInfoRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleRowPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dispatch({ type: 'SELECT_OBJECT', payload: { id: objectId, shiftKey: e.shiftKey } });

    const el = e.target as HTMLElement;
    // Don't modify selection if clicking on a keyframe
    if (el.closest('[data-keyframe-id]')) return;
  };

  // --- CONNECTORS LOGIC ---
  const connectors = useMemo(() => {
    const lines: React.ReactNode[] = [];

    tracksToShow.forEach(track => {
      // Sort keyframes by time to ensure correct connections
      const sortedKfs = [...track.keyframes].sort((a, b) => a.timeMs - b.timeMs);

      for (let i = 0; i < sortedKfs.length - 1; i++) {
        const kf1 = sortedKfs[i];
        const kf2 = sortedKfs[i + 1];

        // Calculate positions
        const x1 = msToX((layerTrack?.startMs ?? 0) + kf1.timeMs, originMs, msPerPx);
        const x2 = msToX((layerTrack?.startMs ?? 0) + kf2.timeMs, originMs, msPerPx);

        // Skip if outside view (optimization) or if x2 < x1 (shouldn't happen with sort)
        // Simple culling: if both are way left or way right
        // We'll leave it simple for now.

        // Determine color based on selection or track type
        const isSelected = selectedSet.has(kf1.id) && selectedSet.has(kf2.id);
        const strokeColor = isSelected ? "#0ea5e9" : "#6366f1"; // Sky-500 if selected, Indigo-500 if not

        lines.push(
          <line
            key={`conn-${kf1.id}-${kf2.id}`}
            x1={x1}
            y1="50%"
            x2={x2}
            y2="50%"
            stroke={strokeColor}
            strokeWidth={2}
            className="opacity-80 pointer-events-none"
          />
        );
      }
    });
    return lines;
  }, [tracksToShow, layerTrack, originMs, msPerPx, selectedSet]);

  return (
    <div
      className="relative w-full select-none my-0.5" // Removed rounded-md overflow-hidden from container
      style={{ height: rowHeight - 2 }} // Subtract margin
      onPointerDown={handleRowPointerDown}
    >
      <div className="absolute inset-0 bg-zinc-800/40 border border-white/5 rounded-md" />

      {/* Connector Layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
        {connectors}
      </svg>

      {tracksToShow.flatMap(track =>
        track.keyframes.map(kf => {
          const globalTimeMs = (layerTrack?.startMs ?? 0) + kf.timeMs;
          return (
            <Keyframe
              key={kf.id}
              id={kf.id}
              objectId={objectId}
              propertyId={track.id}
              left={msToX(globalTimeMs, originMs, msPerPx)}
              selected={selectedSet.has(kf.id)}
              interpolation={kf.interpolation}
              onPointerDown={(e) => handleKeyframePointerDown(kf.id, track.id, e)}
              onContextMenu={(e) => onKeyframeContextMenu?.(e, kf.id, objectId, track.id)}
            />
          )
        })
      )}
    </div>
  );
});
PropertyTrackRow.displayName = "PropertyTrackRow";
