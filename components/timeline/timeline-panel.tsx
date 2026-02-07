'use client';

import { useRef, useEffect, useState, RefObject } from 'react';
import LayersTree from './layers-tree';
import Ruler from './ruler';
import TracksView from './tracks-view';
import { useEditor } from '@/context/editor-context';
import { getMsPerPx, msToX, pxToMs, BASE_PX_PER_SECOND } from '@/lib/anim/utils';
import { clamp, cn } from '@/lib/utils';
import { formatTime } from './transport';
import { PropertyId } from "@/types/editor";
import { GripVertical } from 'lucide-react';
import { TimelineNavigator } from './timeline-navigator';

const ROW_HEIGHT = 28;
const TOP_SPACER_H = 36;
const RULER_H = 24;
const LAYERS_W = 300;

type MarqueeRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

function Playhead({ panelWidth, leftOffset, originMs, msPerPx }: { panelWidth: number, leftOffset: number, originMs: number, msPerPx: number }) {
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
        <div className="absolute top-0 left-0 -translate-x-1/2 px-1.5 py-0.5 rounded-sm bg-orange-500 text-white text-[10px] font-mono">
            {formatTime(playheadMs, fps)}
        </div>
        <div className="absolute top-[18px] left-0 w-px h-full bg-orange-500" />
    </div>
  );
}
  
const WorkAreaControls = ({ innerWidth, originMs, msPerPx }: { innerWidth: number, originMs: number, msPerPx: number }) => {
    const { state, dispatch } = useEditor();
    const { timeline } = state;
    const { durationMs, playheadMs } = timeline;
    const wa = timeline.workArea ?? { startMs: 0, endMs: durationMs };
  
    const dragRef = useRef<'start' | 'end' | null>(null);
    const startInfo = useRef({ x: 0, startMs: 0, endMs: 0 });
  
    if (innerWidth <= 0 || msPerPx <= 0) return null;
  
    const startX = msToX(wa.startMs, originMs, msPerPx);
    const endX   = msToX(wa.endMs, originMs, msPerPx);
    const barW   = Math.max(1, endX - startX);
  
    const playheadX = msToX(playheadMs, originMs, msPerPx);
    const isPlayheadOnStart = Math.abs(playheadX - startX) < 2;
    const isPlayheadOnEnd = Math.abs(playheadX - endX) < 2;
  
    const onDown = (e: React.PointerEvent<HTMLDivElement>, kind: 'start'|'end') => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      
      dragRef.current = kind;
      startInfo.current = { x: e.clientX, startMs: wa.startMs, endMs: wa.endMs };

      const onMove = (moveEvent: PointerEvent) => {
        if (!dragRef.current) return;
        const dx  = moveEvent.clientX - startInfo.current.x;
        const dMs = dx * msPerPx;
    
        let newStart = startInfo.current.startMs;
        let newEnd   = startInfo.current.endMs;

        if (dragRef.current === 'start') {
            newStart = startInfo.current.startMs + dMs;
        } else {
            newEnd = startInfo.current.endMs + dMs;
        }
        
        if (timeline.ui.snap) {
            const step = timeline.ui.snapStepMs ?? (1000 / timeline.fps);
            if (dragRef.current === 'start') {
                newStart = Math.round(newStart / step) * step;
            } else {
                newEnd = Math.round(newEnd / step) * step;
            }
        }
    
        if (dragRef.current === 'start') {
            newStart = Math.max(0, Math.min(newStart, newEnd - 1));
        } else {
            newEnd = Math.min(durationMs, Math.max(newEnd, newStart + 1));
        }
    
        dispatch({ type: 'SET_WORK_AREA', payload: { startMs: newStart, endMs: newEnd }, transient: true });
      };

      const onUp = (upEvent: PointerEvent) => {
          if (!dragRef.current) return;
          target.releasePointerCapture(e.pointerId);
          dragRef.current = null;
          dispatch({ type: 'COMMIT_DRAG' });
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
      }
      
      target.setPointerCapture(e.pointerId);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    };
  
    return (
      <div className="absolute inset-y-0 z-10 pointer-events-none">
        {/* Barra visible pero sin hit-test */}
        <div
          className="absolute top-0 bottom-0 bg-primary/20 pointer-events-none"
          style={{ left: startX, width: barW }}
        />
  
        {/* Handle inicio */}
        <div
          data-workarea-handle
          className={cn(
            "absolute top-0 bottom-0 -translate-x-1/2 w-2 cursor-ew-resize flex items-center justify-center pointer-events-auto",
            isPlayheadOnStart && "pointer-events-none"
          )}
          style={{ left: startX }}
          onPointerDown={(e) => onDown(e, 'start')}
        >
          <GripVertical className="h-4 w-4 text-primary/80" />
        </div>
  
        {/* Handle fin */}
        <div
          data-workarea-handle
          className={cn(
            "absolute top-0 bottom-0 -translate-x-1/2 w-2 cursor-ew-resize flex items-center justify-center pointer-events-auto",
            isPlayheadOnEnd && "pointer-events-none"
          )}
          style={{ left: endX }}
          onPointerDown={(e) => onDown(e, 'end')}
        >
          <GripVertical className="h-4 w-4 text-primary/80" />
        </div>
      </div>
    );
};

export default function TimelinePanel() {
  const rulerContainerRef = useRef<HTMLDivElement>(null);
  const layersScrollRef = useRef<HTMLDivElement>(null);
  const localTracksContainerRef = useRef<HTMLDivElement>(null);
  
  const { state, dispatch } = useEditor();
  const scrubRef = useRef(false);
  const [panelWidth, setPanelWidth] = useState(0);
  const [originMs, setOriginMs] = useState(0);
  
  const zoomInteractionRef = useRef<{ tCursor: number, xCursorPx: number } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const marqueeStartRef = useRef<{ x: number, y: number } | null>(null);

  function linkScroll(
    srcRef: React.RefObject<HTMLDivElement>,
    dstRef: React.RefObject<HTMLDivElement>,
    opts?: { horiz?: boolean; vert?: boolean }
  ) {
    let syncing = false;
    let raf = 0;
  
    const onScroll = () => {
      if (syncing) return;
      const src = srcRef.current, dst = dstRef.current;
      if (!src || !dst) return;
  
      syncing = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (opts?.vert !== false && dst.scrollTop !== src.scrollTop) {
          dst.scrollTop = src.scrollTop;
        }
        if (opts?.horiz !== false && dst.scrollLeft !== src.scrollLeft) {
          dst.scrollLeft = src.scrollLeft;
        }
        syncing = false;
      });
    };
  
    const el = srcRef.current;
    el?.addEventListener('scroll', onScroll, { passive: true });
    return () => el?.removeEventListener('scroll', onScroll);
  }
  
  if (!state) {
    return (
        <div className="p-4 text-sm text-muted-foreground">Loading Timeline...</div>
    );
  }
  const { timeline } = state;
  const msPerPx = getMsPerPx(timeline.ui.zoom);
  const contentWidthPx = Math.max(panelWidth, timeline.durationMs / msPerPx);
  
  useEffect(() => {
    const un1 = linkScroll(localTracksContainerRef, layersScrollRef, { horiz: false, vert: true });
    const un2 = linkScroll(layersScrollRef, localTracksContainerRef, { horiz: false, vert: true });
    const un3 = linkScroll(localTracksContainerRef, rulerContainerRef, { horiz: true, vert: false });
    return () => { un1(); un2(); un3(); };
  }, []);

  useEffect(() => {
    if (!panelWidth) return;

    const durationMs = timeline.durationMs;
    const zoomFit =
      (1000 * panelWidth) / (BASE_PX_PER_SECOND * Math.max(1, durationMs));

    const clamped = clamp(zoomFit, 0.05, 50);

    if (clamped !== timeline.ui.zoom) {
      dispatch({ type: "SET_TIMELINE_ZOOM", payload: clamped });
    }

    const el = localTracksContainerRef.current;
    if (el) el.scrollLeft = 0;

    setOriginMs(0);

    if (timeline.playheadMs > durationMs) {
      dispatch({ type: "SET_TIMELINE_PLAYHEAD", payload: durationMs, transient: true });
      dispatch({ type: "COMMIT_DRAG" });
    }
  }, [timeline.durationMs, panelWidth, dispatch]);
  
  useEffect(() => {
    const container = localTracksContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        const rect = container.getBoundingClientRect();
        const xCursorPx = e.clientX - rect.left;

        const oldZoom = timeline.ui.zoom;
        const oldMsPerPx = getMsPerPx(oldZoom);
        const currentOriginMs = container.scrollLeft * oldMsPerPx;
        const tCursor = pxToMs(xCursorPx, currentOriginMs, oldMsPerPx);

        const zoomFactor = 1.1;
        const newZoom = e.deltaY < 0 ? oldZoom * zoomFactor : oldZoom / zoomFactor;
        const clampedZoom = clamp(newZoom, 0.05, 50);

        if (clampedZoom === oldZoom) return;

        zoomInteractionRef.current = { tCursor, xCursorPx };

        dispatch({ type: 'SET_TIMELINE_ZOOM', payload: clampedZoom });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, [timeline.ui.zoom, dispatch]);
  
  useEffect(() => {
    const container = localTracksContainerRef.current;
    const interaction = zoomInteractionRef.current;
    
    if (container && interaction) {
      const { tCursor, xCursorPx } = interaction;
      const newMsPerPx = getMsPerPx(timeline.ui.zoom);
      
      const newScrollLeft = (tCursor / newMsPerPx) - xCursorPx;
      
      container.scrollLeft = newScrollLeft;
      
      zoomInteractionRef.current = null;
    }
  }, [timeline.ui.zoom]);

  useEffect(() => {
    const rulerContainer = rulerContainerRef.current;
    if (!rulerContainer) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        setPanelWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(rulerContainer);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const container = localTracksContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
        const newOriginMs = container.scrollLeft * msPerPx;
        setOriginMs(newOriginMs);
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [msPerPx]);

  const updatePlayheadFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!rulerContainerRef.current) return;
    const rect = rulerContainerRef.current.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, panelWidth);
    let timeMs = pxToMs(x, originMs, msPerPx);

    if (state.timeline.ui.snap) {
        const { snapStepMs, fps } = state.timeline.ui;
        const step = snapStepMs ?? 1000 / fps;
        timeMs = Math.round(timeMs / step) * step;
    }
    
    dispatch({ type: 'SET_TIMELINE_PLAYHEAD', payload: timeMs, transient: true });
  };

  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-workarea-handle]')) return;
  
    if (e.altKey) {
      if (timeline.workArea) {
        dispatch({ type: 'SET_WORK_AREA', payload: null });
      } else {
        const rect = e.currentTarget.getBoundingClientRect();
        const startMs = pxToMs(e.clientX - rect.left, originMs, msPerPx);
        dispatch({ type: 'SET_WORK_AREA', payload: { startMs, endMs: startMs } });
      }
      return;
    }
  
    dispatch({ type: 'SET_TIMELINE_PLAYING', payload: false });
    scrubRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updatePlayheadFromEvent(e);
  };
  
  const handleRulerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubRef.current) return;
    updatePlayheadFromEvent(e);
  };
  
  const handleRulerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubRef.current) return;
    scrubRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dispatch({ type: 'COMMIT_DRAG' });
  };
  
  const handleRulerPointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrubRef.current) {
        handleRulerPointerUp(e);
    }
  };

    const handleTracksPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!(e.buttons & 1)) return;
      const el = e.target as HTMLElement;
      if (el.closest('[data-nomarquee]')) return;
      if (!e.shiftKey) dispatch({ type: 'CLEAR_KEYFRAME_SELECTION' });
    
      const container = e.currentTarget;
      const cRect = container.getBoundingClientRect();
      const scrollX = container.scrollLeft;
      const scrollY = container.scrollTop;
    
      marqueeStartRef.current = {
        x: e.clientX - cRect.left + scrollX,
        y: e.clientY - cRect.top + scrollY,
      };
    
      container.setPointerCapture(e.pointerId);
      setMarqueeRect({ x: marqueeStartRef.current.x, y: marqueeStartRef.current.y, width: 0, height: 0 });
    };

    const handleTracksPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!marqueeStartRef.current) return;
      const container = e.currentTarget;
      const cRect = container.getBoundingClientRect();
      const scrollX = container.scrollLeft;
      const scrollY = container.scrollTop;
    
      const x = e.clientX - cRect.left + scrollX;
      const y = e.clientY - cRect.top + scrollY;
    
      const { x: sx, y: sy } = marqueeStartRef.current;
      setMarqueeRect({ x: Math.min(x, sx), y: Math.min(y, sy), width: Math.abs(x - sx), height: Math.abs(y - sy) });
    };

    const handleTracksPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      container.releasePointerCapture(e.pointerId);
    
      const rectLocal = marqueeRect;
      setMarqueeRect(null);
      marqueeStartRef.current = null;
      if (!rectLocal || rectLocal.width < 5 || rectLocal.height < 5) return;
    
      const cRect = container.getBoundingClientRect();
      const scrollX = container.scrollLeft;
      const scrollY = container.scrollTop;
    
      const selRectAbs = {
        left: rectLocal.x - scrollX + cRect.left,
        top: rectLocal.y - scrollY + cRect.top,
        right: rectLocal.x - scrollX + cRect.left + rectLocal.width,
        bottom: rectLocal.y - scrollY + cRect.top + rectLocal.height,
      };
    
      const selected: { objectId: string; propertyId: PropertyId; keyframeId: string }[] = [];
      container.querySelectorAll('[data-keyframe-id]').forEach((node) => {
        const r = (node as HTMLElement).getBoundingClientRect();
        const overlap = !(r.right < selRectAbs.left || r.left > selRectAbs.right || r.bottom < selRectAbs.top || r.top > selRectAbs.bottom);
        if (overlap) {
          const el = node as HTMLElement;
          const keyframeId = el.dataset.keyframeId!;
          const objectId = el.dataset.objectId!;
          const propertyId = el.dataset.propertyId as PropertyId;
          selected.push({ keyframeId, objectId, propertyId });
        }
      });
    
      dispatch({ type: 'SELECT_KEYFRAMES_IN_RECT', payload: { keys: selected, additive: e.shiftKey } });
    };
    
    const handleBoundsChange = ({ startMs, endMs }: { startMs: number, endMs: number }) => {
        const newViewDuration = endMs - startMs;
        if (newViewDuration <= 0) return;

        const newMsPerPx = newViewDuration / panelWidth;
        const newZoom = 1000 / (BASE_PX_PER_SECOND * newMsPerPx);
        
        const newScrollLeft = startMs / newMsPerPx;
        
        dispatch({ type: 'SET_TIMELINE_ZOOM', payload: newZoom });

        const el = localTracksContainerRef.current;
        if (el) {
          el.scrollLeft = newScrollLeft;
        }
    };


  return (
    <div
      className="
        grid h-full w-full
        [grid-template-columns:var(--layers)_1fr]
        [grid-template-rows:var(--top)_var(--ruler)_1fr]
      "
      style={{
        // @ts-ignore
        '--layers': `${LAYERS_W}px`,
        '--top': `${TOP_SPACER_H}px`,
        '--ruler': `${RULER_H}px`,
      }}
    >
      {/* Fila 1 (Top spacer) */}
      <div className="col-[1] row-[1] border-r bg-background/70 flex items-center px-2 text-xs text-muted-foreground">
        Layers
      </div>
      <div className="col-[2] row-[1] bg-background/70 flex items-center justify-end px-3 gap-2">
        <TimelineNavigator 
            durationMs={timeline.durationMs}
            viewStartMs={originMs}
            viewEndMs={originMs + panelWidth * msPerPx}
            onBoundsChange={handleBoundsChange}
        />
      </div>

      {/* Fila 2 (Ruler) */}
      <div className="col-[1] row-[2] border-r bg-background/70" />
      <div 
        ref={rulerContainerRef}
        data-ruler
        className="col-[2] row-[2] relative overflow-x-hidden overflow-y-hidden bg-background/70 cursor-ew-resize hide-scrollbar"
        onPointerDown={handleRulerPointerDown}
        onPointerMove={handleRulerPointerMove}
        onPointerUp={handleRulerPointerUp}
        onPointerLeave={handleRulerPointerLeave}
      >
        <div className="relative h-full" style={{ width: contentWidthPx }}>
            <Ruler height={RULER_H} panelWidth={panelWidth} originMs={originMs} msPerPx={msPerPx} />
            <WorkAreaControls innerWidth={contentWidthPx} originMs={originMs} msPerPx={msPerPx} />
        </div>
      </div>

      {/* Fila 3 (Contenido) */}
      <div ref={layersScrollRef} className="col-[1] row-[3] overflow-y-auto overflow-x-hidden border-r bg-background relative hide-scrollbar">
          <LayersTree scrollRef={layersScrollRef} />
      </div>
      <div
          ref={localTracksContainerRef}
          className="col-[2] row-[3] overflow-auto relative touch-none hide-scrollbar"
          onPointerDown={handleTracksPointerDown}
          onPointerMove={handleTracksPointerMove}
          onPointerUp={handleTracksPointerUp}
      >
          <TracksView scrollRef={localTracksContainerRef} panelWidth={panelWidth} originMs={originMs} msPerPx={msPerPx} />
           {marqueeRect && (
          <div
            className="absolute border border-primary bg-primary/20 pointer-events-none z-30"
            style={{
              left: marqueeRect.x,
              top: marqueeRect.y,
              width: marqueeRect.width,
              height: marqueeRect.height,
            }}
          />
        )}
      </div>
      
      {rulerContainerRef.current && (
        <Playhead panelWidth={panelWidth} leftOffset={rulerContainerRef.current.getBoundingClientRect().left} originMs={originMs} msPerPx={msPerPx} />
      )}
    </div>
  );
}
