'use client';

import { cn } from "@/lib/utils";
import React from "react";
import type { InterpolationType, PropertyId } from "@/types/editor";

interface KeyframeProps {
  id: string;
  objectId: string;
  propertyId: PropertyId;
  left: number;
  selected?: boolean;
  interpolation?: InterpolationType;
  onPointerDown?: (e: React.PointerEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function Keyframe({
  id,
  objectId,
  propertyId,
  left,
  selected,
  interpolation = 'linear',
  onPointerDown,
  onContextMenu
}: KeyframeProps) {
  // Industry standard shapes: Linear=Diamond, Hold=Square, Ease(Bezier)=Hourglass
  const isBezier = interpolation === 'ease' || interpolation === 'bezier';
  const isHold = interpolation === 'hold';
  const isLinear = !isBezier && !isHold;

  const shapeClass = isHold
    ? 'rounded-none w-3.5 h-3.5' // Square
    : isBezier
      ? 'rounded-none w-3.5 h-3.5' // Hourglass (clip-path)
      : 'transform rotate-45 w-3 h-3'; // Diamond

  const hourglassStyle = isBezier ? {
    clipPath: 'polygon(50% 0%, 100% 0%, 50% 50%, 100% 100%, 0% 100%, 50% 50%, 0% 0%)'
  } : {};

  return (
    <div
      data-nomarquee
      data-keyframe-id={id}
      data-object-id={objectId}
      data-property-id={propertyId}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer transition-all duration-150",
        shapeClass,
        selected ? 'bg-primary border-2 border-primary-foreground scale-110' : 'bg-muted-foreground/70 border border-background hover:scale-105'
      )}
      style={{ left: `${left}px`, ...hourglassStyle }}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e);
      }}
    />
  );
}
