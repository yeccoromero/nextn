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
  // Industry standard shapes:
  // Linear = Diamond
  // Hold = Square
  // Ease (Standard/InOut) = Hourglass
  // Ease In = Left Arrow (Incoming)
  // Ease Out = Right Arrow (Outgoing)
  // Bezier (Auto) = Circle

  const isBezier = interpolation === 'bezier';
  const isHold = interpolation === 'hold';
  const isEase = interpolation === 'ease';
  const isEaseIn = interpolation === 'ease-in';
  const isEaseOut = interpolation === 'ease-out';
  const isLinear = interpolation === 'linear' || (!isBezier && !isHold && !isEase && !isEaseIn && !isEaseOut); // Default

  // SVG Paths
  const internalSize = 12; // Coordinate space (keep existing paths working)
  const displaySize = 13; // Reduced by ~10% (14 -> 13)
  const center = internalSize / 2;

  // Selection Style
  // Base (Unselected): Pure White
  // Selected (Accent): Sky-500 (#0ea5e9)
  const isSelected = !!selected;

  // Colors
  const activeColor = '#0ea5e9'; // Sky-500
  const inactiveColor = '#ffffff'; // White

  const fillColor = isHold
    ? '#f59e0b' // Keep Amber for Hold
    : isSelected
      ? activeColor
      : inactiveColor;

  return (
    <div
      data-nomarquee
      data-keyframe-id={id}
      data-object-id={objectId}
      data-property-id={propertyId}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer transition-transform duration-200 ease-out",
        isSelected
          ? 'scale-125 z-20 drop-shadow-[0_0_10px_rgba(14,165,233,0.8)]' // Bright Blue Glow on selection (Reduced scale to 125%)
          : 'hover:scale-110 z-10 hover:drop-shadow-sm'
      )}
      style={{ left: `${left}px`, width: displaySize, height: displaySize }}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e);
      }}
    >
      <svg width={displaySize} height={displaySize} viewBox={`0 0 ${internalSize} ${internalSize}`} className="overflow-visible">
        {/* Modern Rounded Shapes with larger fill area (1.5px padding) */}

        {isHold && (
          // Rounded Square for Hold
          // Reduced to 8x8 to balance with Diamond/Triangles
          <rect x="2" y="2" width="8" height="8" rx="2" fill={fillColor} />
        )}

        {isLinear && (
          // Rounded Diamond for Linear
          <rect x="2" y="2" width="8" height="8" rx="1.5" transform={`rotate(45 ${center} ${center})`} fill={fillColor} />
        )}

        {isBezier && (
          // Circle for Auto Bezier
          <circle cx={center} cy={center} r={4.5} fill={fillColor} />
        )}

        {isEase && (
          // Hourglass for Ease (In + Out)
          // Reverted to Vertical Hourglass (as per user request "no cambiar")
          // Top Triangle (pointing down) + Bottom Triangle (pointing up)
          <path
            d="M2 2 L10 2 L6 6 L2 2 Z M2 10 L10 10 L6 6 L2 10 Z"
            fill={fillColor}
            stroke={fillColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )}

        {isEaseIn && (
          // Ease IN: "Linear In, Bezier Out" (Bullet Right)
          // Left side: Diamond (Linear). Right side: Round (Bezier).
          // Shape: <)
          <path
            d="M2 6 L6 2 L10 2 C12 2 12 10 10 10 L6 10 Z"
            fill={fillColor}
            stroke={fillColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )}

        {isEaseOut && (
          // Ease OUT: "Bezier In, Linear Out" (Bullet Left)
          // Left side: Round (Bezier). Right side: Diamond (Linear).
          // Shape: (>
          <path
            d="M10 6 L6 10 L2 10 C0 10 0 2 2 2 L6 2 Z"
            fill={fillColor}
            stroke={fillColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
}
