
'use client';

import { cn } from "@/lib/utils";
import React from "react";
import type { PropertyId } from "@/types/editor";

interface KeyframeProps {
  id: string;
  objectId: string;
  propertyId: PropertyId;
  left: number;
  selected?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}

export function Keyframe({ id, objectId, propertyId, left, selected, onPointerDown }: KeyframeProps) {
  return (
    <div
      data-nomarquee
      data-keyframe-id={id}
      data-object-id={objectId}
      data-property-id={propertyId}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 transform rotate-45 cursor-pointer",
        selected ? 'bg-primary border border-primary-foreground' : 'bg-muted-foreground/50 border border-background'
      )}
      style={{ left: `${left}px` }}
      onPointerDown={onPointerDown}
    />
  );
}
