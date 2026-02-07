
'use client';

import { useMemo, useRef } from "react";
import { useEditor } from "@/context/editor-context";
import { msToX, pxToMs } from "@/lib/anim/utils";
import type { PropertyId, Keyframe as KeyframeType } from "@/types/editor";
import { Keyframe } from "./keyframe";

export function PropertyTrackRow({ 
  objectId, 
  propertyId,
  rowHeight,
  originMs,
  msPerPx,
} : { 
  objectId: string, 
  propertyId: PropertyId, 
  rowHeight: number,
  originMs: number,
  msPerPx: number
}) {
  const { state, dispatch } = useEditor();
  const { timeline, objects } = state;
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
    e.preventDefault();
    e.stopPropagation();
    
    if (state.timeline.playing) {
      dispatch({ type: 'SET_TIMELINE_PLAYING', payload: false });
    }
  
    const target = e.target as HTMLElement;
    target.setPointerCapture(e.pointerId);
  
    const isClickedSelected = selectedSet.has(clickedId);
    let effectiveSelection: string[];
  
    if (e.shiftKey) {
      effectiveSelection = Array.from(new Set([...selectedSet, clickedId]));
      dispatch({ type: 'SELECT_KEYFRAME', payload: { objectId, propertyId: clickedPropId, keyframeId: clickedId, additive: true }});
    } else {
      effectiveSelection = isClickedSelected ? Array.from(selectedSet) : [clickedId];
      if (!isClickedSelected) {
        dispatch({ type: 'SELECT_KEYFRAME', payload: { objectId, propertyId: clickedPropId, keyframeId: clickedId, additive: false }});
      }
    }
  
    const originalKeyframes: Array<{ id: string; timeMs: number; objectId: string; propertyId: PropertyId }> = [];
    for (const [layerObjectId, layer] of Object.entries(state.timeline.layers)) {
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
  
      const step = state.timeline.ui.snapStepMs ?? 1;
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
    if (el.closest('[data-keyframe-id]')) return;
  };

  return (
    <div
      className="relative w-full select-none"
      style={{ height: rowHeight }}
      onPointerDown={handleRowPointerDown}
    >
      <div className="absolute inset-0 bg-background/50" />
      <div className="absolute left-0 right-0 bottom-0 h-px bg-black/40" />

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
              onPointerDown={(e) => handleKeyframePointerDown(kf.id, track.id, e)}
            />
          )
        })
      )}
    </div>
  );
}
