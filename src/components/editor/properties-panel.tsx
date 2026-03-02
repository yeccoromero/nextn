

'use client';

import { useEditor } from '@/context/editor-context';
import { useEditorStore } from '@/store';
import type { SvgObject, RectangleObject, EllipseObject, StarObject, TextObject, PolygonObject, AnchorPosition, AlignmentType, PathObject, Fill, LinearGradientFill, RadialGradientFill, GradientStop, PropertyId, KeyValue, BendItEffect, WarpEffect } from '@/types/editor';
import { LayoutGrid, Link as LinkIcon, Link2Off, Timer, Diamond, Sparkles } from 'lucide-react';
import { BendItControls } from '@/components/effects/BendItControls';
import { WarpControls } from '@/components/effects/WarpControls';
import { degToRad } from '@/lib/effects/bend-math';
import { defaultWarpEffect } from '@/lib/effects/warp-math';
import { Button } from '../ui/button';
import { cn } from "@/lib/utils";
import { getOverallBBox, getWorldAnchor, getOrientedBBox } from '@/lib/editor-utils';
import { scaleAroundWorldPivot } from '@/lib/geometry';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMemo, useState, useRef, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ColorPicker } from './color-picker';
import { AnchorPointSelector } from './anchor-point-selector';
import { AlignToolbar } from './align-toolbar';
import { Eye, EyeOff } from 'lucide-react';
import { FourCornersIcon, CornerTopLeft, CornerTopRight, CornerBottomLeft, CornerBottomRight, FilledDiamond } from '../icons';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { SliderInput } from './slider-input';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Input } from '../ui/input';
import { createSelectSelectedObjects, createSelectOverallBBox } from '@/lib/selectors';

const PRESET_SIZES = [
  { name: 'Custom', width: 0, height: 0 },
  { name: '500x500', width: 500, height: 500 },
  { name: '1000x1000', width: 1000, height: 1000 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1080x1920', width: 1080, height: 1920 },
];

const MIXED = '__MIXED__';

const isLinear = (f: any): f is LinearGradientFill => f?.type === 'linear-gradient';
const isRadial = (f: any): f is RadialGradientFill => f?.type === 'radial-gradient';
function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }
function normStops(stops?: GradientStop[]): GradientStop[] {
  if (!Array.isArray(stops) || stops.length === 0) {
    return [{ id: 's1', offset: 0, color: '#000' }, { id: 's2', offset: 1, color: '#fff' }];
  }
  return [...stops]
    .map(s => ({ ...s, offset: clamp01(Number.isFinite(s.offset) ? s.offset : 0) }))
    .sort((a, b) => a.offset - b.offset);
}
function ensurePoint(p: { x?: number; y?: number } | undefined, fallback: { x: number; y: number }) {
  return {
    x: Number.isFinite(p?.x) ? (p!.x as number) : fallback.x,
    y: Number.isFinite(p?.y) ? (p!.y as number) : fallback.y,
  };
}
function getGradientCss(fill?: Fill): string | undefined {
  if (!fill) return undefined;
  if (typeof fill === 'string') return fill;

  if (isLinear(fill)) {
    const p1 = ensurePoint(fill.start, { x: 0, y: 50 });
    const p2 = ensurePoint(fill.end, { x: 100, y: 50 });
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const angle = (Math.atan2(-dy, dx) * 180) / Math.PI;
    const stops = normStops(fill.stops)
      .map(s => `${s.color} ${Math.round(s.offset * 100)}%`)
      .join(', ');
    return `linear-gradient(${angle + 90}deg, ${stops})`;
  }

  if (isRadial(fill)) {
    const stops = normStops(fill.stops)
      .map(s => `${s.color} ${Math.round(s.offset * 100)}%`)
      .join(', ');
    return `radial-gradient(circle at ${fill.cx * 100}% ${fill.cy * 100}%, ${stops})`;
  }
  return undefined;
}

const useAvailableHeight = (timelineHeight: number = 200) => {
  const [availableHeight, setAvailableHeight] = useState('100vh');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const topOffset = rect.top;
        const calculatedHeight = viewportHeight - topOffset - timelineHeight;
        setAvailableHeight(`${Math.max(200, calculatedHeight)}px`);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [timelineHeight]);

  return { containerRef, availableHeight };
};

// — Helpers for timecode format HH:MM:SS ——————————————————————
function msToTimecode(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

function timecodeToMs(tc: string): number | null {
  // Accept H:MM:SS, MM:SS, or plain seconds
  const parts = tc.trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000;
  if (parts.length === 2) return ((parts[0] * 60) + parts[1]) * 1000;
  if (parts.length === 1) return parts[0] * 1000;
  return null;
}

interface TimecodeFieldProps {
  durationMs: number;
  fps: number;
  onDurationChange: (ms: number) => void;
  onFpsChange: (fps: number) => void;
}

const TimecodeField = ({ durationMs, fps, onDurationChange, onFpsChange }: TimecodeFieldProps) => {
  const [tcValue, setTcValue] = useState(() => msToTimecode(durationMs));
  const [fpsValue, setFpsValue] = useState(() => String(fps));
  const [tcFocused, setTcFocused] = useState(false);
  const [fpsFocused, setFpsFocused] = useState(false);

  // Sync from outside when not editing
  useEffect(() => { if (!tcFocused) setTcValue(msToTimecode(durationMs)); }, [durationMs, tcFocused]);
  useEffect(() => { if (!fpsFocused) setFpsValue(String(fps)); }, [fps, fpsFocused]);

  const commitTimecode = () => {
    const ms = timecodeToMs(tcValue);
    if (ms !== null && ms >= 1000) {
      onDurationChange(ms);
      setTcValue(msToTimecode(ms));
    } else {
      setTcValue(msToTimecode(durationMs)); // revert
    }
    setTcFocused(false);
  };

  const commitFps = () => {
    const n = parseInt(fpsValue, 10);
    if (!isNaN(n) && n >= 1 && n <= 120) {
      onFpsChange(n);
    } else {
      setFpsValue(String(fps)); // revert
    }
    setFpsFocused(false);
  };

  return (
    <div className="flex h-10 w-full rounded-md border border-input bg-transparent items-center min-w-0 overflow-hidden">
      {/* Duration */}
      <div className="flex items-center gap-2 px-3 min-w-0 flex-1">
        <Timer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={tcValue}
          className="bg-transparent border-none outline-none text-sm font-mono tracking-wider w-full text-foreground min-w-0"
          placeholder="00:00:00"
          onFocus={() => setTcFocused(true)}
          onBlur={commitTimecode}
          onChange={(e) => setTcValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
      </div>
      {/* Divider */}
      <div className="h-5 w-px bg-border shrink-0" />
      {/* FPS */}
      <div className="flex items-center gap-1.5 px-3 shrink-0">
        <span className="text-xs font-medium text-muted-foreground">FPS</span>
        <input
          type="text"
          value={fpsValue}
          className="bg-transparent border-none outline-none text-sm font-mono tracking-wider w-8 text-foreground text-right"
          onFocus={() => setFpsFocused(true)}
          onBlur={commitFps}
          onChange={(e) => setFpsValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
      </div>
    </div>
  );
};

const SceneProperties = () => {

  const canvas = useEditorStore(state => state.present.canvas);
  const timeline = useEditorStore(state => (state.transientPresent ?? state.present).timeline);
  const dispatch = useEditorStore(state => state.dispatch);

  const [lastSolidColor, setLastSolidColor] = useState(() => canvas.background === 'transparent' ? '#FFFFFF' : canvas.background);

  const handleCanvasPropertyChange = (prop: 'width' | 'height', value: number) => {
    if (!canvas.isConstrained) {
      dispatch({ type: 'UPDATE_CANVAS', payload: { [prop]: value } });
      return;
    }

    const aspectRatio = canvas.width / canvas.height;
    if (prop === 'width') {
      dispatch({ type: 'UPDATE_CANVAS', payload: { width: value, height: value / aspectRatio } });
    } else {
      dispatch({ type: 'UPDATE_CANVAS', payload: { height: value, width: value * aspectRatio } });
    }
  };

  const handleBackgroundChange = (color: string | Fill) => {
    if (color !== 'transparent' && typeof color === 'string') {
      setLastSolidColor(color);
    }
    dispatch({ type: 'UPDATE_CANVAS', payload: { background: color as any } });
  }

  const handlePresetChange = (value: string) => {
    const [w, h] = value.split('x').map(Number);
    if (w > 0 && h > 0) {
      dispatch({ type: 'UPDATE_CANVAS', payload: { width: w, height: h } });
    }
  };

  const toggleTransparency = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canvas.background === 'transparent') {
      handleBackgroundChange(lastSolidColor);
    } else {
      handleBackgroundChange('transparent');
    }
  };

  const isTransparent = canvas.background === 'transparent';

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 p-4 border-b">
        <div className="flex items-center gap-2 text-xs font-bold">
          <LayoutGrid className="h-4 w-4" />
          Scene
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain hide-scrollbar">
        <div className="p-4 space-y-4">
          <Select onValueChange={handlePresetChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a preset..." />
            </SelectTrigger>
            <SelectContent>
              {PRESET_SIZES.map(s => <SelectItem key={s.name} value={`${s.width}x${s.height}`}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex items-end gap-2">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1 items-center w-full min-w-0">
              <SliderInput
                tooltip="Width"
                prefix="W"
                id="width"
                name="width"
                value={Math.round(canvas.width)}
                onChange={(v) => handleCanvasPropertyChange('width', v)}
                min={100}
                max={4000}
                onCommit={() => dispatch({ type: 'COMMIT_DRAG' })}
              />
              <SliderInput
                tooltip="Height"
                prefix="H"
                id="height"
                name="height"
                value={Math.round(canvas.height)}
                onChange={(v) => handleCanvasPropertyChange('height', v)}
                min={100}
                max={4000}
                onCommit={() => dispatch({ type: 'COMMIT_DRAG' })}
              />
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8 text-muted-foreground hover:text-foreground shrink-0", canvas.isConstrained && "text-primary hover:text-primary")}
                onClick={() => dispatch({ type: 'TOGGLE_CANVAS_CONSTRAINED' })}
              >
                {canvas.isConstrained ? <LinkIcon className="h-4 w-4" /> : <Link2Off className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold mb-2">Background</p>
            <Popover>
              <PopoverTrigger asChild>
                <div className="relative flex items-center h-10 w-full rounded-md border border-input bg-transparent text-sm px-2 cursor-pointer">
                  <div
                    className="h-6 w-6 shrink-0 rounded-sm border bg-cover bg-center"
                    style={{
                      backgroundColor: isTransparent ? undefined : canvas.background,
                      backgroundImage: isTransparent
                        ? `url('data:image/svg+xml;utf8,<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 8H8V16H0V8Z" fill="%23E0E0E0"/><path d="M8 0H16V8H8V0Z" fill="%23E0E0E0"/><path d="M8 8H16V16H8V8Z" fill="white"/><path d="M0 0H8V8H0V0Z" fill="white"/></svg>')`
                        : 'none'
                    }}
                  />
                  <span className="ml-2 truncate">{isTransparent ? 'Transparent' : canvas.background}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto shrink-0" onClick={toggleTransparency}>
                    {isTransparent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border-none">
                <ColorPicker
                  color={isTransparent ? lastSolidColor : canvas.background}
                  onChange={handleBackgroundChange}
                  onCommit={() => dispatch({ type: 'COMMIT_DRAG' })}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <p className="text-xs font-bold mb-2">Time</p>
            <TimecodeField
              durationMs={timeline.durationMs}
              fps={timeline.fps}
              onDurationChange={(ms) => { dispatch({ type: 'SET_TIMELINE_DURATION', payload: ms }); dispatch({ type: 'COMMIT_DRAG' }); }}
              onFpsChange={(fps) => { dispatch({ type: 'SET_TIMELINE_FPS', payload: fps }); dispatch({ type: 'COMMIT_DRAG' }); }}
            />
          </div>

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
};

const ObjectProperties = () => {
  const selectedObjectIds = useEditorStore(state => state.present.selectedObjectIds);
  const objects = useEditorStore(state => (state.transientPresent ?? state.present).objects);
  const canvas = useEditorStore(state => state.present.canvas);
  const timeline = useEditorStore(state => (state.transientPresent ?? state.present).timeline);
  const dispatch = useEditorStore(state => state.dispatch);

  const stateForSelectors = useEditorStore(state => state.present);
  const selectSelectedObjects = useMemo(createSelectSelectedObjects, []);
  const selectOverallBBox = useMemo(createSelectOverallBBox, []);

  const selectedObjects = selectSelectedObjects({ ...stateForSelectors, selectedObjectIds, objects });
  const overallBBox = selectOverallBBox({ ...stateForSelectors, selectedObjectIds, objects });
  const firstObject = selectedObjects[0];
  const [isCornersExpanded, setIsCornersExpanded] = useState(false);

  const startFillRef = useRef<string | Fill | null>(null);
  const startStrokeRef = useRef<string | Fill | null>(null);

  const getCommonValue = <K extends keyof SvgObject>(property: K): SvgObject[K] | typeof MIXED => {
    if (selectedObjects.length === 0) return MIXED;
    const firstValue = selectedObjects[0][property];
    const allSame = selectedObjects.every(obj => JSON.stringify(obj[property]) === JSON.stringify(firstValue));
    return allSame ? firstValue : MIXED;
  };

  const getCommonNumberValue = <K extends keyof SvgObject>(property: K): number | typeof MIXED => {
    const value = getCommonValue(property);
    return typeof value === 'number' ? value : MIXED;
  };

  const getCommonBooleanValue = <K extends keyof SvgObject>(property: K): boolean | typeof MIXED => {
    const value = getCommonValue(property);
    return typeof value === 'boolean' ? value : MIXED;
  };

  const handlePropertyChange = (updates: Partial<SvgObject>) => {
    dispatch({
      type: 'UPDATE_OBJECTS',
      payload: { ids: selectedObjectIds, updates },
      transient: true
    });
  };

  const handleCommit = (propertyId: PropertyId, startValue?: any) => {
    dispatch({ type: 'COMMIT_DRAG' });

    const objectId = selectedObjectIds[0];
    if (!objectId) return;

    const layerTrack = timeline.layers?.[objectId];
    if (!layerTrack?.properties?.some(p => p.id === propertyId)) {
      return;
    }

    const safeStart = (startValue && typeof startValue === 'string') ? startValue : undefined;

    dispatch({
      type: 'ADD_KEYFRAME_TO_PROPERTY',
      payload: { objectId, propertyId, timeMs: timeline.playheadMs, startValue: safeStart }
    });
  };

  const fillValue = getCommonValue('fill');
  const strokeValue = getCommonValue('stroke');

  const [internalFill, setInternalFill] = useState('');
  const [internalStroke, setInternalStroke] = useState('');

  useEffect(() => {
    if (typeof fillValue === 'string') {
      setInternalFill(fillValue === 'transparent' ? 'transparent' : fillValue.toUpperCase());
    } else {
      setInternalFill('Gradient');
    }
  }, [fillValue]);

  useEffect(() => {
    if (typeof strokeValue === 'string') {
      setInternalStroke(strokeValue === 'transparent' ? 'transparent' : strokeValue.toUpperCase());
    } else {
      setInternalStroke('Gradient');
    }
  }, [strokeValue]);

  const onFillChange = (color: string | Fill) => {
    if (startFillRef.current === null) {
      startFillRef.current = fillValue === MIXED ? null : fillValue;
    }
    handlePropertyChange({ fill: color });
  };
  const onFillCommit = () => {
    handleCommit('fill', startFillRef.current ?? undefined);
    startFillRef.current = null;
  };

  const onStrokeChange = (color: string | Fill) => {
    if (startStrokeRef.current === null) {
      startStrokeRef.current = strokeValue === MIXED ? null : strokeValue;
    }
    handlePropertyChange({ stroke: color as any });
  };
  const onStrokeCommit = () => {
    handleCommit('stroke', startStrokeRef.current ?? undefined);
    startStrokeRef.current = null;
  };

  const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>, prop: 'fill' | 'stroke') => {
    const val = e.target.value;
    if (prop === 'fill') setInternalFill(val);
    else setInternalStroke(val);
  }

  const handleColorInputBlur = (prop: 'fill' | 'stroke') => {
    const value = prop === 'fill' ? internalFill : internalStroke;
    const originalValue = prop === 'fill' ? fillValue : strokeValue;
    const setter = prop === 'fill' ? onFillChange : onStrokeChange;
    const committer = prop === 'fill' ? onFillCommit : onStrokeCommit;

    if (value.match(/^#([0-9a-f]{3}){1,2}$/i) || value === 'transparent') {
      setter(value);
      committer();
    } else {
      if (typeof originalValue === 'string') {
        if (prop === 'fill') setInternalFill(originalValue);
        else setInternalStroke(originalValue);
      }
    }
  }

  const handleColorInputFocus = (prop: 'fill' | 'stroke') => {
    const ref = prop === 'fill' ? startFillRef : startStrokeRef;
    const val = prop === 'fill' ? fillValue : strokeValue;
    ref.current = val === MIXED ? null : val;
  }

  const handleDimensionChange = (prop: 'width' | 'height', value: number) => {
    const bbox = overallBBox;
    if (!bbox || (prop === 'width' && !bbox.width) || (prop === 'height' && !bbox.height)) return;

    const pivotWorld = { x: bbox.cx, y: bbox.cy };

    const isX = prop === 'width';
    const currentValue = isX ? bbox.width : bbox.height;

    if (Math.abs(currentValue) < 1e-6) return;

    const scaleFactor = value / currentValue;

    const constrained = getCommonBooleanValue('isConstrained') === true;

    selectedObjectIds.forEach(id => {
      const obj = objects[id];
      if (!obj || obj.locked) return;

      const currentScaleX = obj.scaleX ?? 1;
      const currentScaleY = obj.scaleY ?? 1;

      let newScaleX = currentScaleX;
      let newScaleY = currentScaleY;

      if (constrained) {
        newScaleX *= scaleFactor;
        newScaleY *= scaleFactor;
      } else {
        if (isX) {
          newScaleX *= scaleFactor;
        } else {
          newScaleY *= scaleFactor;
        }
      }

      const updates = scaleAroundWorldPivot(obj, newScaleX, newScaleY, pivotWorld, objects);

      dispatch({
        type: 'UPDATE_OBJECTS',
        payload: { ids: [id], updates },
        transient: true
      });
    });
  };

  const handleScaleChange = (scaleFactor: number, isX: boolean, isY: boolean) => {
    const overallBBox = selectOverallBBox({ ...stateForSelectors, selectedObjectIds, objects });
    if (!overallBBox) return;

    let center: { x: number; y: number };

    if (selectedObjects.length === 1 && selectedObjects[0]) {
      center = getWorldAnchor(selectedObjects[0], objects);
    } else {
      center = { x: overallBBox.cx, y: overallBBox.cy };
    }

    const constrained = getCommonBooleanValue('isConstrained') === true;

    selectedObjectIds.forEach(id => {
      const obj = objects[id];
      if (!obj || obj.locked) return;

      const currentScaleX = obj.scaleX ?? 1;
      const currentScaleY = obj.scaleY ?? 1;

      let newScaleX = currentScaleX;
      let newScaleY = currentScaleY;

      if (constrained) {
        newScaleX *= scaleFactor;
        newScaleY *= scaleFactor;
      } else {
        if (isX) {
          newScaleX *= scaleFactor;
        }
        if (isY) {
          newScaleY *= scaleFactor;
        }
      }

      const updates = scaleAroundWorldPivot(obj, newScaleX, newScaleY, center, objects);

      dispatch({
        type: 'UPDATE_OBJECTS',
        payload: { ids: [id], updates },
        transient: true
      });
    });
  };

  const handleRotationChange = (angle: number) => {
    const overallBBox = selectOverallBBox({ ...stateForSelectors, selectedObjectIds, objects });
    if (!overallBBox) return;

    let center: { x: number; y: number };

    if (selectedObjects.length === 1 && selectedObjects[0]) {
      center = getWorldAnchor(selectedObjects[0], objects);
    } else {
      center = { x: overallBBox.cx, y: overallBBox.cy };
    }

    dispatch({
      type: 'ROTATE_OBJECTS',
      payload: { ids: selectedObjectIds, angle, center },
      transient: true
    });
  }

  const getDimensionValue = (prop: 'width' | 'height'): number | typeof MIXED => {
    if (selectedObjects.length === 0) return MIXED;

    if (!overallBBox) return MIXED;

    return Math.round(overallBBox[prop]);
  };

  const getPositionValue = (prop: 'x' | 'y'): number | typeof MIXED => {
    if (selectedObjects.length === 0) return MIXED;
    if (!overallBBox) return MIXED;

    if (selectedObjects.length > 1) {
      return Math.round(overallBBox[prop]);
    }

    if (firstObject?.type === 'path') {
      return Math.round(overallBBox[prop]);
    }

    const value = getCommonNumberValue(prop);
    return value === MIXED ? MIXED : Math.round(value);
  }

  const renderCorners = () => {
    const isAllRects = selectedObjects.every(obj => obj.type === 'rectangle');
    if (!isAllRects || !firstObject) return null;

    const rect = firstObject as RectangleObject;
    const corners = getCommonValue('corners' as any) as RectangleObject['corners'] | typeof MIXED;
    const isLinked = getCommonBooleanValue('cornersLinked' as any) !== false;

    const rectWidth = ('width' in rect) ? rect.width : 0;
    const rectHeight = ('height' in rect) ? rect.height : 0;

    // Calculate max radius based on the scaled dimensions
    const scaledWidth = Math.abs((rectWidth ?? 0) * (rect.scaleX ?? 1));
    const scaledHeight = Math.abs((rectHeight ?? 0) * (rect.scaleY ?? 1));
    const maxR = Math.min(scaledWidth, scaledHeight) / 2;

    const effectiveRadius = rect.isPillShape ? maxR : corners === MIXED ? 0 : corners?.tl ?? 0;

    const handleSingleCornerChange = (v: number) => {
      const R = Math.max(0, Math.min(v, maxR));
      const isPill = R >= maxR;
      handlePropertyChange({
        corners: { tl: R, tr: R, br: R, bl: R },
        cornersLinked: true,
        isPillShape: isPill,
      } as any);
    };

    const handleIndividualCornerChange = (corner: keyof NonNullable<RectangleObject['corners']>, v: number) => {
      const R = Math.max(0, Math.min(v, maxR));
      const currentCorners = corners === MIXED ? { tl: 0, tr: 0, br: 0, bl: 0 } : corners || { tl: 0, tr: 0, br: 0, bl: 0 };
      const newCorners = { ...currentCorners, [corner]: R };

      handlePropertyChange({ corners: newCorners, isPillShape: false } as any);
    };

    const onPrefixClick = () => {
      setIsCornersExpanded(true);
      handlePropertyChange({ cornersLinked: false } as any);
    };

    return (
      <div className="space-y-2">
        {!isCornersExpanded ? (
          <div className="h-8">
            <SliderInput
              variant="compact"
              tooltip="Corner Radius" prefix={<FourCornersIcon className="h-4 w-4" />}
              id="corners" name="corners"
              value={effectiveRadius}
              onChange={handleSingleCornerChange}
              onCommit={(startValue) => handleCommit("corners", startValue)}
              min={0} max={maxR}
              onPrefixClick={onPrefixClick}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button variant={"ghost"} size="icon" className="h-10 w-10 shrink-0" onClick={() => setIsCornersExpanded(false)}>
              <FourCornersIcon className="h-5 w-5" />
            </Button>
            <div className="grid grid-cols-2 gap-1 w-full">
              <SliderInput variant="icon" tooltip="Top Left" prefix={<CornerTopLeft />} value={(corners as any)?.tl ?? 0} onChange={v => handleIndividualCornerChange('tl', v)} onCommit={(startValue) => handleCommit("corners", startValue)} min={0} max={maxR} />
              <SliderInput variant="icon" tooltip="Top Right" prefix={<CornerTopRight />} value={(corners as any)?.tr ?? 0} onChange={v => handleIndividualCornerChange('tr', v)} onCommit={(startValue) => handleCommit("corners", startValue)} min={0} max={maxR} />
              <SliderInput variant="icon" tooltip="Bottom Left" prefix={<CornerBottomLeft />} value={(corners as any)?.bl ?? 0} onChange={v => handleIndividualCornerChange('bl', v)} onCommit={(startValue) => handleCommit("corners", startValue)} min={0} max={maxR} />
              <SliderInput variant="icon" tooltip="Bottom Right" prefix={<CornerBottomRight />} value={(corners as any)?.br ?? 0} onChange={v => handleIndividualCornerChange('br', v)} onCommit={(startValue) => handleCommit("corners", startValue)} min={0} max={maxR} />
            </div>
          </div>
        )}
      </div>
    );
  };

  function CapIcon({ type }: { type: 'butt' | 'round' | 'square' }) {
    return (
      <svg width="28" height="18" viewBox="0 0 28 18">
        <line
          x1="4" y1="9" x2="24" y2="9"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap={type}
        />
      </svg>
    );
  }

  const renderPathProperties = () => {
    const targetPaths = useMemo(() => {
      return selectedObjectIds
        .map(id => objects[id])
        .filter((o): o is PathObject => o?.type === 'path' && !o.locked && o.visible !== false && !o.closed);
    }, [objects, selectedObjectIds]);

    if (targetPaths.length === 0) return null;

    const first = targetPaths[0]?.strokeLineCap ?? 'butt';
    const allSame = targetPaths.every(p => (p.strokeLineCap ?? 'butt') === (first ?? 'butt'));
    const value: 'butt' | 'round' | 'square' | undefined = allSame ? first : undefined;

    const onChange = (v: string) => {
      if (!v) return;
      const cap = v as 'butt' | 'round' | 'square';
      dispatch({
        type: 'UPDATE_OBJECTS',
        payload: {
          ids: targetPaths.map(p => p.id),
          updates: { strokeLineCap: cap } as Partial<SvgObject>,
        },
      });
      handleCommit("strokeLineCap");
    };

    return (
      <div className="space-y-2">
        <div>
          <p className="text-xs font-bold mb-2">Ends</p>
          <ToggleGroup
            type="single"
            value={value}
            onValueChange={onChange}
            className="w-full grid grid-cols-3 gap-2"
          >
            <ToggleGroupItem value="butt" aria-label="Butt cap" className="h-10">
              <CapIcon type="butt" />
            </ToggleGroupItem>
            <ToggleGroupItem value="round" aria-label="Round cap" className="h-10">
              <CapIcon type="round" />
            </ToggleGroupItem>
            <ToggleGroupItem value="square" aria-label="Square cap" className="h-10">
              <CapIcon type="square" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        {!value && (
          <p className="text-[10px] text-muted-foreground">
            (Mixed values)
          </p>
        )}
      </div>
    )
  }

  const rotationValue = selectedObjects.length === 1 ? firstObject?.rotation || 0 : getCommonNumberValue('rotation');
  const xValue = getPositionValue('x');
  const yValue = getPositionValue('y');

  const objectPropsUI = useMemo(() => {
    const constrainedValue = getCommonBooleanValue('isConstrained');
    const widthValue = getDimensionValue('width');
    const heightValue = getDimensionValue('height');


    const handleToggleConstrained = () => {
      dispatch({ type: 'TOGGLE_CONSTRAINED', payload: { ids: selectedObjectIds } })
    }

    return (
      <>
        <div className="flex items-end gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1 items-center w-full min-w-0">
            <SliderInput
              tooltip="Width" prefix="W" id="width" name="width"
              value={widthValue === MIXED ? '' : widthValue}
              placeholder={widthValue === MIXED ? 'mixed' : undefined}
              onChange={(v) => handleDimensionChange('width', v)}
              onCommit={(startValue) => handleCommit('scale', startValue)}
              min={1} max={canvas.width * 2}
            />
            <SliderInput
              tooltip="Height" prefix="H" id="height" name="height"
              value={heightValue === MIXED ? '' : heightValue}
              placeholder={heightValue === MIXED ? 'mixed' : undefined}
              onChange={(v) => handleDimensionChange('height', v)}
              onCommit={(startValue) => handleCommit('scale', startValue)}
              min={1} max={canvas.height * 2}
            />
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 text-muted-foreground hover:text-foreground shrink-0",
                constrainedValue === true && "text-primary hover:text-primary",
                constrainedValue === MIXED && "text-muted-foreground/70"
              )}
              onClick={handleToggleConstrained}
              title={constrainedValue === MIXED ? 'Mixed values' : 'Toggle aspect ratio lock'}
            >
              {constrainedValue !== false ? <LinkIcon className="h-4 w-4" /> : <Link2Off className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {renderCorners()}
        <SliderInput
          tooltip="Rotation" prefix="R" id="rotation" name="rotation"
          value={rotationValue === MIXED ? '' : Math.round(rotationValue)}
          placeholder={rotationValue === MIXED ? 'mixed' : undefined}
          onChange={handleRotationChange}
          onCommit={(startValue) => handleCommit("rotation", startValue)}
          min={-3600} max={3600}
        />
      </>
    )
  }, [selectedObjects, overallBBox, canvas.width, canvas.height, rotationValue, isCornersExpanded]);

  const handleAlign = (type: AlignmentType) => {
    dispatch({ type: 'ALIGN_OBJECTS', payload: { type } });
    dispatch({ type: 'COMMIT_DRAG' });
  };

  let fillImage: string | undefined;

  if (fillValue === MIXED) {
    fillImage = 'conic-gradient(from 180deg at 50% 50%, #ff0000, #ff00ff, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)';
  } else if (typeof fillValue === 'string') {
    fillImage = fillValue === 'transparent' ? `url('data:image/svg+xml;utf8,<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 8H8V16H0V8Z" fill="%23E0E0E0"/><path d="M8 0H16V8H8V0Z" fill="%23E0E0E0"/><path d="M8 8H16V16H8V8Z" fill="white"/><path d="M0 0H8V8H0V0Z" fill="white"/></svg>')` : 'none';
  } else {
    fillImage = getGradientCss(fillValue);
  }

  let strokeImage: string | undefined;
  if (strokeValue === MIXED) {
    strokeImage = 'conic-gradient(from 180deg at 50% 50%, #ff0000, #ff00ff, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)';
  } else if (typeof strokeValue === 'string') {
    strokeImage = strokeValue === 'transparent' ? `url('data:image/svg+xml;utf8,<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 8H8V16H0V8Z" fill="%23E0E0E0"/><path d="M8 0H16V8H8V0Z" fill="%23E0E0E0"/><path d="M8 8H16V16H8V8Z" fill="white"/><path d="M0 0H8V8H0V0Z" fill="white"/></svg>')` : 'none';
  } else {
    strokeImage = undefined;
  }

  const onFillClick = () => {
    if (typeof fillValue === 'object' && fillValue !== null) {
      dispatch({ type: 'SET_EDITING_GRADIENT', payload: true });
    }
  }

  const isPropertyAnimated = (propId: PropertyId) => {
    if (selectedObjectIds.length !== 1) return false;
    const objectId = selectedObjectIds[0];
    const layerTrack = timeline.layers?.[objectId];
    return !!layerTrack?.properties?.some(p => p.id === propId);
  };

  const togglePropertyAnimation = (propId: PropertyId) => {
    if (selectedObjectIds.length !== 1) return;
    const object = objects[selectedObjectIds[0]];
    if (!object || object.locked) return;
    dispatch({
      type: 'TOGGLE_PROPERTY_ANIMATION',
      payload: { objectId: selectedObjectIds[0], propertyId: propId }
    });
  };


  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 p-4 border-b">
        <div className="text-xs font-bold truncate">
          {selectedObjects.length > 1 ? `${selectedObjects.length} Objects Selected` : `${firstObject?.type || 'Object'} Properties`}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain hide-scrollbar">
        <div className="p-4 space-y-4">
          <AlignToolbar onAlign={handleAlign} />
          <div className="grid gap-4 min-w-0 [grid-template-columns:minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className="text-xs font-bold mb-2">Transform</p>
              <div className="space-y-2">
                <SliderInput
                  tooltip="Position X" prefix="X" id="x" name="x"
                  value={xValue === MIXED ? '' : xValue}
                  placeholder={xValue === MIXED ? 'mixed' : undefined}
                  onChange={(v) => handlePropertyChange({ x: v })}
                  onCommit={(startValue) => handleCommit("position", startValue)}
                  min={-canvas.width} max={canvas.width * 2}
                />
                <SliderInput
                  tooltip="Position Y" prefix="Y" id="y" name="y"
                  value={yValue === MIXED ? '' : yValue}
                  placeholder={yValue === MIXED ? 'mixed' : undefined}
                  onChange={(v) => handlePropertyChange({ y: v })}
                  onCommit={(startValue) => handleCommit("position", startValue)}
                  min={-canvas.height} max={canvas.height * 2}
                />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold mb-2">Anchor Point</p>
              <AnchorPointSelector
                value={getCommonValue('anchorPosition') === MIXED ? 'center' : getCommonValue('anchorPosition') as AnchorPosition}
                onChange={(pos) => dispatch({ type: 'SET_ANCHOR_POSITION', payload: pos })}
              />
            </div>
          </div>

          {objectPropsUI}

          <div className="space-y-2">
            <p className="text-xs font-bold">Appearance</p>
            <div className="grid grid-cols-1 gap-2 items-center">
              <div>
                <div className="relative flex items-center h-10 w-full rounded-md border border-input bg-transparent text-sm px-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="h-6 w-6 shrink-0 rounded-sm border cursor-pointer bg-cover bg-center" style={{
                        backgroundColor: typeof fillValue === 'string' && fillValue !== 'transparent' ? fillValue : undefined,
                        backgroundImage: fillImage,
                      }} onClick={onFillClick} />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-none">
                      <ColorPicker
                        color={fillValue === MIXED ? '#cccccc' : (fillValue || 'transparent')}
                        onChange={onFillChange}
                        onCommit={onFillCommit}
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    value={internalFill}
                    onChange={(e) => handleColorInputChange(e, 'fill')}
                    onFocus={() => handleColorInputFocus('fill')}
                    onBlur={() => handleColorInputBlur('fill')}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    className="w-full h-full text-xs bg-transparent border-0 shadow-none focus-visible:ring-0 p-0 pr-2 ml-2"
                    placeholder={fillValue === MIXED ? 'Mixed' : (typeof fillValue !== 'string' ? (fillValue?.type || 'Gradient') : '')}
                    readOnly={typeof fillValue !== 'string'}
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); togglePropertyAnimation('fill'); }}
                          className={cn("h-8 w-8 shrink-0 text-muted-foreground", isPropertyAnimated('fill') && "text-primary")}
                        >
                          {isPropertyAnimated('fill') ? <FilledDiamond className="fill-current text-primary" /> : <Diamond className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isPropertyAnimated('fill') ? 'Remove animation' : 'Animate property'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <div>
                <div className="relative flex items-center h-10 w-full rounded-md border border-input bg-transparent text-sm px-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="h-6 w-6 shrink-0 rounded-sm border cursor-pointer bg-cover bg-center" style={{
                        backgroundColor: typeof strokeValue === 'string' && strokeValue !== 'transparent' ? strokeValue : undefined,
                        backgroundImage: strokeImage,
                      }} />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-none">
                      <ColorPicker
                        color={strokeValue === MIXED ? '#cccccc' : (strokeValue || 'transparent')}
                        onChange={onStrokeChange}
                        onCommit={onStrokeCommit}
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    value={internalStroke}
                    onChange={(e) => handleColorInputChange(e, 'stroke')}
                    onFocus={() => handleColorInputFocus('stroke')}
                    onBlur={() => handleColorInputBlur('stroke')}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    className="w-full h-full text-xs bg-transparent border-0 shadow-none focus-visible:ring-0 p-0 pr-2 ml-2"
                    placeholder={strokeValue === MIXED ? 'Mixed' : (typeof strokeValue !== 'string' ? 'Gradient' : '')}
                    readOnly={typeof strokeValue !== 'string'}
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); togglePropertyAnimation('stroke'); }}
                          className={cn("h-8 w-8 shrink-0 text-muted-foreground", isPropertyAnimated('stroke') && "text-primary")}
                        >
                          {isPropertyAnimated('stroke') ? <FilledDiamond className="fill-current text-primary" /> : <Diamond className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isPropertyAnimated('stroke') ? 'Remove animation' : 'Animate property'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
            <SliderInput
              tooltip="Stroke Width" prefix="S" id="strokeWidth" name="strokeWidth"
              value={getCommonNumberValue('strokeWidth') === MIXED ? '' : getCommonNumberValue('strokeWidth')}
              placeholder={getCommonNumberValue('strokeWidth') === MIXED ? 'mixed' : undefined}
              onChange={(v) => handlePropertyChange({ strokeWidth: v })}
              onCommit={(startValue) => handleCommit("strokeWidth", startValue)}
              min={0} max={50}
            />
          </div>
          {(() => {
            if (selectedObjects.length !== 1 || !firstObject) return null;
            const hasBend = !!firstObject.bend?.enabled;

            const toggleBend = () => {
              if (hasBend) {
                handlePropertyChange({ bend: { ...firstObject.bend!, enabled: false } });
              } else {
                const defaultBend: BendItEffect = {
                  enabled: true,
                  start: {
                    x: firstObject.x || 0,
                    y: (firstObject.y || 0) + (('height' in firstObject) ? (firstObject.height as number) : 100) / 2
                  },
                  end: {
                    x: (firstObject.x || 0) + (('width' in firstObject) ? (firstObject.width as number) : 100),
                    y: (firstObject.y || 0) + (('height' in firstObject) ? (firstObject.height as number) : 100) / 2
                  },
                  theta: degToRad(45),
                  prestart: 'static',
                  postEnd: 'extended'
                };
                // Merge existing if present (to keep params) or use default
                const newBend = firstObject.bend ? { ...firstObject.bend, enabled: true } : defaultBend;
                handlePropertyChange({ bend: newBend });
              }
            };

            const bendEffect = hasBend ? firstObject.bend : null;

            return (
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold flex items-center gap-2">
                    <Sparkles className="h-3 w-3" />
                    Effects
                  </p>
                  <Button variant={hasBend ? "secondary" : "ghost"} size="sm" className="h-6 text-[10px]" onClick={toggleBend}>
                    {hasBend ? "Bend It On" : "Add Bend It"}
                  </Button>
                </div>
                {bendEffect && (
                  <BendItControls
                    params={bendEffect}
                    onChange={(newParams) => {
                      handlePropertyChange({ bend: { ...bendEffect, ...newParams } });
                    }}
                    onCommit={(specificPropId) => {
                      // mapping generic commit to specific prop id if passed
                      // if nothing passed, we might fallback or handle differently
                      if (specificPropId) handleCommit(specificPropId as any);
                    }}
                    isAnimated={isPropertyAnimated}
                    onToggleAnimation={togglePropertyAnimation}
                  />
                )}
              </div>
            );
          })()}
          {/* === WARP EFFECT === */}
          {(() => {
            if (selectedObjects.length !== 1 || !firstObject) return null;
            const hasWarp = !!firstObject.warp?.enabled;

            const toggleWarp = () => {
              if (hasWarp) {
                handlePropertyChange({ warp: { ...firstObject.warp!, enabled: false } });
              } else {
                const newWarp = firstObject.warp ? { ...firstObject.warp, enabled: true } : defaultWarpEffect();
                handlePropertyChange({ warp: newWarp });
              }
            };

            const warpEffect = hasWarp ? firstObject.warp! : null;

            return (
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold flex items-center gap-2">
                    <Sparkles className="h-3 w-3" />
                    Warp
                  </p>
                  <Button variant={hasWarp ? "secondary" : "ghost"} size="sm" className="h-6 text-[10px]" onClick={toggleWarp}>
                    {hasWarp ? "Warp On" : "Add Warp"}
                  </Button>
                </div>
                {warpEffect && (
                  <WarpControls
                    params={warpEffect}
                    onChange={(newParams) => {
                      handlePropertyChange({ warp: { ...warpEffect, ...newParams } });
                    }}
                    onCommit={(specificPropId) => {
                      if (specificPropId) handleCommit(specificPropId as any);
                    }}
                    isAnimated={isPropertyAnimated}
                    onToggleAnimation={togglePropertyAnimation}
                  />
                )}
              </div>
            );
          })()}
          {renderPathProperties()}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
};

export default function PropertiesPanel() {
  const { state } = useEditor();
  const { containerRef, availableHeight } = useAvailableHeight(200);

  if (!state) {
    return (
      <div
        ref={containerRef}
        className="flex flex-col min-h-0"
        style={{ height: availableHeight }}
      >
        <div className="p-4 border-b flex items-center justify-between shrink-0">
          <h3 className="font-bold">Properties</h3>
        </div>
        <div className="p-4 text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }
  const { selectedObjectIds } = state;

  return (
    <div
      ref={containerRef}
      className="flex flex-col min-h-0"
      style={{ height: availableHeight }}
    >
      <div className="p-4 border-b flex items-center justify-between shrink-0">
        <h3 className="font-bold">Properties</h3>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {selectedObjectIds.length === 0 ? <SceneProperties /> : <ObjectProperties />}
      </div>
    </div>
  );
}


