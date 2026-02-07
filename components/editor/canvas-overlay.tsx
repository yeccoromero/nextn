

'use client';

import React from 'react';
import type { BoundingBox, ResizeHandle, MarqueeRect, EditorCanvas, Tool } from '@/types/editor';
import { getRotatedCursor } from '@/lib/editor-utils';

interface CanvasOverlayProps {
  overallBBox: (BoundingBox & { rotation: number; cx: number; cy: number; }) | null;
  marqueeRect: MarqueeRect | null;
  anchorPointCoords: { x: number; y: number; } | null;
  canvas: { zoom: number };
  currentTool: Tool;
}

const renderHandles = (bbox: BoundingBox & { rotation: number, cx: number, cy: number }, zoom: number) => {
    const handleSize = 8 / zoom;
    const h2 = handleSize / 2;
    const { x, y, width, height, rotation } = bbox;
  
    const handles: { position: ResizeHandle, x: number, y: number, cursor: string }[] = [
      { position: 'nw', x: x, y: y, cursor: 'nwse-resize' },
      { position: 'ne', x: x + width, y: y, cursor: 'nesw-resize' },
      { position: 'sw', x: x, y: y + height, cursor: 'nesw-resize' },
      { position: 'se', x: x + width, y: y + height, cursor: 'nwse-resize' },
      { position: 'n', x: x + width / 2, y: y, cursor: 'ns-resize' },
      { position: 's', x: x + width / 2, y: y + height, cursor: 'ns-resize' },
      { position: 'w', x: x, y: y + height / 2, cursor: 'ew-resize' },
      { position: 'e', x: x + width, y: y + height / 2, cursor: 'ew-resize' },
    ];
  
    return (
        <g>
            {handles.map(h => (
              <rect
                key={h.position}
                x={h.x - h2}
                y={h.y - h2}
                width={handleSize}
                height={handleSize}
                fill="hsl(var(--primary))"
                stroke="#fff"
                strokeWidth={1 / zoom}
                style={{ cursor: getRotatedCursor(h.cursor, rotation) }}
                data-handle={h.position}
              />
            ))}
        </g>
    );
};

export const CanvasOverlay = ({
  overallBBox,
  marqueeRect,
  anchorPointCoords,
  canvas,
  currentTool,
}: CanvasOverlayProps) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      <svg width="100%" height="100%" className="overflow-visible">
        <g className="pointer-events-auto">
          {currentTool !== 'pan' && overallBBox && (
            <g transform={overallBBox.rotation !== 0 ? `rotate(${overallBBox.rotation} ${overallBBox.cx} ${overallBBox.cy})` : ''}>
              <rect
                data-role="bbox-move"
                x={overallBBox.x}
                y={overallBBox.y}
                width={overallBBox.width}
                height={overallBBox.height}
                fill="transparent"
                style={{ cursor: 'move' }}
              />
              <rect
                className="pointer-events-none"
                x={overallBBox.x}
                y={overallBBox.y}
                width={overallBBox.width}
                height={overallBBox.height}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={1 / canvas.zoom}
                strokeDasharray={`${4 / canvas.zoom} ${2 / canvas.zoom}`}
                vectorEffect="non-scaling-stroke"
              />
              {renderHandles(overallBBox, canvas.zoom)}
            </g>
          )}
          {currentTool !== 'pan' && marqueeRect && (
              <rect
                  x={marqueeRect.x}
                  y={marqueeRect.y}
                  width={marqueeRect.width}
                  height={marqueeRect.height}
                  fill="hsla(var(--primary) / 0.2)"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1 / canvas.zoom}
                  strokeDasharray={`${4 / canvas.zoom} ${2 / canvas.zoom}`}
                  className="pointer-events-none"
              />
          )}
          {currentTool !== 'pan' && anchorPointCoords && (
              <g className="pointer-events-none">
                  <circle 
                      cx={anchorPointCoords.x} 
                      cy={anchorPointCoords.y} 
                      r={6 / canvas.zoom}
                      fill="hsl(var(--primary))" 
                      stroke="#fff" 
                      strokeWidth={1 / canvas.zoom}
                  />
              </g>
          )}
        </g>
      </svg>
    </div>
  );
};
