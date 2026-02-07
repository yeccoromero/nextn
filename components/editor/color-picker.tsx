// @ts-nocheck
'use client';

import { cn } from "@/lib/utils";
import { HexColorPicker } from 'react-colorful';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Fill, GradientStop, LinearGradientFill, RadialGradientFill } from '@/types/editor';
import { SliderInput } from './slider-input';
import { nanoid } from 'nanoid';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Trash2, Plus } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { coerceNumber } from "@/lib/utils";


interface ColorPickerProps {
  color: Fill;
  onChange: (color: Fill) => void;
  onCommit?: () => void;
  className?: string;
}

const PRESET_COLORS = [
  '#FF4136', '#FF851B', '#FFDC00', '#2ECC40', '#0074D9', '#B10DC9',
  '#F012BE', '#DDDDDD', '#AAAAAA', '#FFFFFF', '#111111', 'transparent'
];

const StopColorPicker = ({ color, onChange, onCommit }: { color: string, onChange: (c: string) => void, onCommit?: () => void }) => {
  const isTransparent = color === 'transparent';

  return (
    <div className="p-2 bg-popover rounded-md w-64 space-y-4">
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((preset) => (
          <Button
            key={preset}
            type="button"
            variant="outline"
            size="icon"
            className="h-6 w-6 rounded-full p-0 border-2"
            onClick={() => {
              onChange(preset);
              onCommit?.();
            }}
          >
            <div
              className="h-full w-full rounded-full border border-white/20 bg-cover bg-center"
              style={{
                backgroundColor: preset === 'transparent' ? '#ffffff' : preset,
                backgroundImage: preset === 'transparent'
                  ? `url('data:image/svg+xml;utf8,<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 8H8V16H0V8Z" fill="%23E0E0E0"/><path d="M8 0H16V8H8V0Z" fill="%23E0E0E0"/><path d="M8 8H16V16H8V8Z" fill="white"/><path d="M0 0H8V8H0V0Z" fill="white"/></svg>')`
                  : 'none'
              }}
            />
          </Button>
        ))}
      </div>
      <HexColorPicker color={isTransparent ? '#000000' : color} onChange={onChange} onMouseUp={onCommit} style={{ width: '100%' }} />
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">#</span>
        <Input
          value={isTransparent ? '' : color.replace('#', '')}
          onChange={(e) => onChange(`#${e.target.value}`)}
          onBlur={onCommit}
          onFocus={(e) => e.target.select()}
          className="w-full h-8 uppercase tracking-wider"
          maxLength={7}
          placeholder="Hex"
        />
      </div>
    </div>
  )
}


const hexToRgba = (hex: string, alpha: number = 1) => {
  if (!hex || hex === 'transparent') return `rgba(0,0,0,0)`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const hexToRgbaValues = (hex: string): { r: number, g: number, b: number } => {
  if (!hex || hex.length !== 7 || hex === 'transparent') return { r: 0, g: 0, b: 0 };
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  } catch (e) {
    return { r: 0, g: 0, b: 0 };
  }
};

const interpolateColor = (color1: string, color2: string, factor: number): string => {
  if (factor <= 0) return color1;
  if (factor >= 1) return color2;

  const c1 = hexToRgbaValues(color1);
  const c2 = hexToRgbaValues(color2);

  const r = Math.round(c1.r + factor * (c2.r - c1.r));
  const g = Math.round(c1.g + factor * (c2.g - c1.g));
  const b = Math.round(c1.b + factor * (c2.b - c1.b));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

export const ColorPicker = ({ color, onChange, onCommit, className }: ColorPickerProps) => {
  const fillType = typeof color === 'string' ? 'solid' : color?.type;
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const gradientBarRef = useRef<HTMLDivElement>(null);
  const dragInfoRef = useRef<{ isDragging: boolean; startX: number; startTime: number; aStopWasDragged: boolean; }>({ isDragging: false, startX: 0, startTime: 0, aStopWasDragged: false });
  const barGestureRef = useRef({ down: false, startX: 0, moved: false, startedOnStop: false });


  const [popoverState, setPopoverState] = useState<{ open: boolean, targetId: string | null }>({ open: false, targetId: null });

  useEffect(() => {
    if (typeof color !== 'string' && color?.stops?.length) {
      const currentActiveIsValid = color.stops.some(s => s.id === activeStopId);
      if (!currentActiveIsValid) {
        setActiveStopId(color.stops[0].id);
      }
    } else {
      setActiveStopId(null);
    }
  }, [color, activeStopId]);

  const solidColor = typeof color === 'string' ? color : '#000000';
  const isTransparent = solidColor === 'transparent';

  const handleTabChange = (newType: string) => {
    if (newType === 'solid') {
      onChange('#cccccc');
    } else if (newType === 'linear-gradient') {
      const newStops = [
        { id: nanoid(), color: '#ffffff', offset: 0, opacity: 1 },
        { id: nanoid(), color: '#000000', offset: 1, opacity: 1 },
      ];
      onChange({
        type: 'linear-gradient',
        stops: newStops,
        start: { x: 0, y: -50 },
        end: { x: 0, y: 50 },
      });
      setActiveStopId(newStops[0].id);
    } else if (newType === 'radial-gradient') {
      const newStops = [
        { id: nanoid(), color: '#ffffff', offset: 0, opacity: 1 },
        { id: nanoid(), color: '#000000', offset: 1, opacity: 1 },
      ];
      onChange({
        type: 'radial-gradient',
        cx: 0.5, cy: 0.5, r: 0.5,
        stops: newStops,
      });
      setActiveStopId(newStops[0].id);
    }
    onCommit?.();
  };

  const handleGradientChange = (updates: Partial<LinearGradientFill> | Partial<RadialGradientFill>) => {
    if (typeof color !== 'string' && color) {
      onChange({ ...color, ...updates });
    }
  };

  const handleStopChange = (stopId: string, updates: Partial<GradientStop>, doCommit?: boolean) => {
    if (typeof color !== 'string' && color) {
      const newStops = color.stops.map(s => s.id === stopId ? { ...s, ...updates } : s);
      const sortedStops = [...newStops].sort((a, b) => a.offset - b.offset);
      onChange({ ...color, stops: sortedStops });
      if (doCommit) {
        onCommit?.();
      }
    }
  };

  const addStopAtOffset = (offset: number) => {
    if (typeof color === 'string' || !color) return;
    const sorted = [...color.stops].sort((a, b) => a.offset - b.offset);
    let left = sorted[0], right = sorted[sorted.length - 1];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (offset >= sorted[i].offset && offset <= sorted[i + 1].offset) {
        left = sorted[i]; right = sorted[i + 1]; break;
      }
    }
    const t = (right.offset - left.offset) === 0 ? 0 : (offset - left.offset) / (right.offset - left.offset);
    const newColor = interpolateColor(left.color, right.color, t);
    const newStop: GradientStop = { id: nanoid(), color: newColor, offset, opacity: 1 };
    const newStops = [...color.stops, newStop].sort((a, b) => a.offset - b.offset);
    onChange({ ...color, stops: newStops });
    setActiveStopId(newStop.id);
    onCommit?.();
  };

  const onBarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const startedOnStop = !!(e.target as HTMLElement).closest('[data-stop-button]');
    barGestureRef.current = {
      down: true,
      startX: e.clientX,
      moved: false,
      startedOnStop,
    };
  };

  const onBarPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = barGestureRef.current;
    if (!g.down) return;
    if (!g.moved && Math.abs(e.clientX - g.startX) > 3) g.moved = true;
  };

  const onBarPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = barGestureRef.current;
    if (!g.down) return;

    barGestureRef.current.down = false;

    if (g.startedOnStop || g.moved) return;

    if (!gradientBarRef.current) return;
    const rect = gradientBarRef.current.getBoundingClientRect();
    const withinX = e.clientX >= rect.left && e.clientX <= rect.right;
    const withinY = e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!withinX || !withinY) return;

    const offset = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    addStopAtOffset(offset);
  };


  const removeStop = (stopId: string) => {
    if (typeof color !== 'string' && color && color.stops.length > 2) {
      const newStops = color.stops.filter(s => s.id !== stopId);
      onChange({ ...color, stops: newStops });
      if (activeStopId === stopId) {
        setActiveStopId(newStops[0]?.id || null);
      }
      onCommit?.();
    }
  }

  const getGradientCss = (gradient: LinearGradientFill | RadialGradientFill | null) => {
    if (!gradient || !gradient.stops || gradient.stops.length === 0) return 'transparent';
    const sortedStops = [...gradient.stops].sort((a, b) => a.offset - b.offset);
    const stopsString = sortedStops
      .map(s => `${hexToRgba(s.color, s.opacity ?? 1)} ${s.offset * 100}%`)
      .join(', ');

    return `linear-gradient(to right, ${stopsString})`;
  }

  const handleStopPointerDown = (e: React.PointerEvent<HTMLButtonElement>, stopId: string) => {
    e.preventDefault();
    e.stopPropagation();
    barGestureRef.current.down = false;

    const target = e.target as HTMLElement;
    target.setPointerCapture(e.pointerId);

    setActiveStopId(stopId);
    dragInfoRef.current = { isDragging: false, startX: e.clientX, startTime: Date.now(), aStopWasDragged: false };

    const bar = gradientBarRef.current;
    if (!bar) return;

    const barRect = bar.getBoundingClientRect();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - dragInfoRef.current.startX;
      if (!dragInfoRef.current.isDragging && Math.abs(dx) > 3) {
        dragInfoRef.current.isDragging = true;
        dragInfoRef.current.aStopWasDragged = true;
        setPopoverState({ open: false, targetId: null });
      }

      if (dragInfoRef.current.isDragging) {
        let newOffset = (moveEvent.clientX - barRect.left) / barRect.width;
        newOffset = Math.max(0, Math.min(1, newOffset));
        handleStopChange(stopId, { offset: newOffset });
      }
    };

    const handlePointerUp = () => {
      target.releasePointerCapture(e.pointerId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      if (dragInfoRef.current.aStopWasDragged) {
        onCommit?.();
      } else {
        if (Date.now() - dragInfoRef.current.startTime < 200) {
          setPopoverState({ open: true, targetId: stopId });
        }
      }

      setTimeout(() => {
        dragInfoRef.current.isDragging = false;
        dragInfoRef.current.aStopWasDragged = false;
      }, 0);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const linearGradient = fillType === 'linear-gradient' ? (color as LinearGradientFill) : null;
  const radialGradient = fillType === 'radial-gradient' ? (color as RadialGradientFill) : null;
  const activeStop = activeStopId && typeof color !== 'string' && color ? color.stops.find(s => s.id === activeStopId) : null;

  const renderGradientEditor = (gradient: LinearGradientFill | RadialGradientFill) => {
    if (!gradient || !gradient.stops) return null;
    const currentOffset = coerceNumber(activeStop?.offset, 0, { min: 0, max: 1 });
    const currentOpacity = coerceNumber(activeStop?.opacity, 1, { min: 0, max: 1 });

    return (
      <div className="p-2 space-y-4">
        {gradient.type === 'linear-gradient' && (
          <SliderInput prefix="A" tooltip="Angle" value={(gradient as LinearGradientFill).angle ?? 0} onChange={v => handleGradientChange({ angle: v })} onCommit={onCommit} min={0} max={360} />
        )}
        {gradient.type === 'radial-gradient' && (
          <div className="grid grid-cols-2 gap-2">
            <SliderInput prefix="CX" tooltip="Center X" value={gradient.cx * 100} onChange={v => handleGradientChange({ cx: v / 100 })} onCommit={onCommit} min={-50} max={150} />
            <SliderInput prefix="CY" tooltip="Center Y" value={gradient.cy * 100} onChange={v => handleGradientChange({ cy: v / 100 })} onCommit={onCommit} min={-50} max={150} />
            <SliderInput prefix="R" tooltip="Radius" value={gradient.r * 100} onChange={v => handleGradientChange({ r: v / 100 })} onCommit={onCommit} min={0} max={200} />
          </div>
        )}
        <div
          ref={gradientBarRef}
          className="relative h-6 rounded-md border border-input cursor-pointer"
          style={{ backgroundImage: getGradientCss(gradient) }}
          onPointerDown={onBarPointerDown}
          onPointerMove={onBarPointerMove}
          onPointerUp={onBarPointerUp}
        >
          {gradient.stops.map(stop => (
            <Popover key={`${stop.id}-popover`} open={popoverState.open && popoverState.targetId === stop.id} onOpenChange={(open) => {
              if (dragInfoRef.current.aStopWasDragged || dragInfoRef.current.isDragging) return;
              setPopoverState({ open, targetId: open ? stop.id : null });
            }}>
              <PopoverTrigger asChild>
                <button
                  key={stop.id}
                  data-stop-button="true"
                  type="button"
                  className={cn(
                    "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 focus:outline-none focus:ring-2 ring-offset-2 ring-ring cursor-pointer",
                    activeStopId === stop.id ? "border-primary ring-2" : "border-background"
                  )}
                  style={{ left: `${stop.offset * 100}%`, backgroundColor: stop.color }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    handleStopPointerDown(e, stop.id);
                  }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border-none" align="center" side="bottom">
                <StopColorPicker
                  color={stop.color}
                  onChange={(c) => handleStopChange(stop.id, { color: c })}
                  onCommit={onCommit}
                />
              </PopoverContent>
            </Popover>
          ))}
        </div>

        <div className={cn("space-y-4 p-2 border rounded-md transition-opacity", !activeStop && "opacity-50 pointer-events-none")}>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <div
                    className="h-5 w-5 rounded-sm border"
                    style={{ backgroundColor: activeStop?.color ?? 'transparent' }}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border-none" align="start" side="bottom">
                <StopColorPicker
                  color={activeStop?.color || '#000000'}
                  onChange={(c) => activeStop && handleStopChange(activeStop.id, { color: c })}
                  onCommit={onCommit}
                />
              </PopoverContent>
            </Popover>
            <Input
              value={activeStop?.color.replace('#', '') ?? ''}
              onChange={e => activeStop && handleStopChange(activeStop.id, { color: `#${e.target.value}` })}
              onChange={e => activeStop && handleStopChange(activeStop.id, { color: `#${e.target.value}` })}
              onBlur={() => onCommit && onCommit()}
              onFocus={(e) => e.target.select()}
              className="w-full h-8"
              disabled={!activeStop}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => activeStop && removeStop(activeStop.id)} disabled={!activeStop || gradient.stops.length <= 2}>
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
          <SliderInput prefix="O" tooltip="Opacity" value={currentOpacity * 100} onChange={v => activeStop && handleStopChange(activeStop.id, { opacity: v / 100 })} onCommit={onCommit} min={0} max={100} disabled={!activeStop} />
          <SliderInput prefix="P" tooltip="Position" value={currentOffset * 100} onChange={v => activeStop && handleStopChange(activeStop.id, { offset: v / 100 })} onCommit={onCommit} min={0} max={100} disabled={!activeStop} />
        </div>
      </div>
    )
  }

  return (
    <div className={cn("p-2 bg-popover rounded-md border-border shadow-2xl", className)}>
      <Tabs defaultValue={fillType || 'solid'} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="solid">Solid</TabsTrigger>
          <TabsTrigger value="linear-gradient">Linear</TabsTrigger>
          <TabsTrigger value="radial-gradient">Radial</TabsTrigger>
        </TabsList>
        <TabsContent value="solid">
          <div className="p-2 space-y-4">
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 rounded-full p-0 border-2"
                  onClick={() => {
                    onChange(preset);
                    if (onCommit) onCommit();
                  }}
                >
                  <div
                    className="h-full w-full rounded-full border border-white/20 bg-cover bg-center"
                    style={{
                      backgroundColor: preset === 'transparent' ? '#ffffff' : preset,
                      backgroundImage: preset === 'transparent'
                        ? `url('data:image/svg+xml;utf8,<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 8H8V16H0V8Z" fill="%23E0E0E0"/><path d="M8 0H16V8H8V0Z" fill="%23E0E0E0"/><path d="M8 8H16V16H8V8Z" fill="white"/><path d="M0 0H8V8H0V0Z" fill="white"/></svg>')`
                        : 'none'
                    }}
                  />
                </Button>
              ))}
            </div>
            <HexColorPicker
              color={isTransparent ? '#000000' : solidColor}
              onChange={onChange}
              onMouseUp={onCommit}
              style={{ width: '100%' }}
            />
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">#</span>
              <Input
                value={isTransparent ? '' : solidColor.replace('#', '')}
                onChange={(e) => onChange(`#${e.target.value}`)}
                onBlur={() => onCommit && onCommit()}
                onFocus={(e) => e.target.select()}
                className="w-full h-8 uppercase tracking-wider"
                maxLength={7}
                placeholder="Hex"
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="linear-gradient">
          {linearGradient && renderGradientEditor(linearGradient)}
        </TabsContent>
        <TabsContent value="radial-gradient">
          {radialGradient && renderGradientEditor(radialGradient)}
        </TabsContent>
      </Tabs>
    </div>
  );
};
