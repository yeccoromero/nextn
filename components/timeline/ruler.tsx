'use client';

import React from 'react';
import { useEditor } from '@/context/editor-context';
import { generateTicks } from '@/lib/anim/timeline-ticks';

type RulerProps = {
  height: number;
  panelWidth: number;
  originMs: number;
  msPerPx: number;
};

export default function Ruler({ height, panelWidth, originMs, msPerPx }: RulerProps) {
  const { state } = useEditor();
  const { timeline } = state;
  const { fps } = timeline;

  const ticks = generateTicks(originMs, panelWidth, msPerPx, fps);
  
  if (ticks.length === 0) {
    return <div style={{ height, width: panelWidth, background: 'hsl(var(--background))', borderBottom: '1px solid hsl(var(--border))' }} />;
  }

  return (
    <div
      className="relative w-full select-none"
      style={{
        height,
        width: panelWidth,
        background: 'hsl(var(--background))',
        borderBottom: '1px solid hsl(var(--border))',
        overflow: 'hidden',
      }}
    >
      {ticks.map((t, i) => {
        // Heights based on tick kind
        const tickHeight =
          t.kind === 'major' ? 12 :
          t.kind === 'minor' ? 7 :
          4; // micro

        const alpha =
          t.kind === 'major' ? 0.75 :
          t.kind === 'minor' ? 0.4 :
          0.25;

        const leftTick = Math.round(t.x) + 0.5;

        return (
          <div key={i} className="absolute h-full" style={{ left: leftTick, top: 0 }}>
            {/* The tick line, drawn from the bottom up */}
            <div 
              className="absolute bottom-0 w-px"
              style={{ height: tickHeight, background: `hsla(var(--foreground) / ${alpha})` }} 
            />

            {/* The label, drawn at the top */}
            {t.label && (
              <div
                className="absolute text-[10px] font-mono tabular-nums leading-none whitespace-nowrap pointer-events-none"
                style={{
                  top: '4px',
                  color: `hsla(var(--foreground) / 0.85)`,
                  // Center the label on the tick
                  transform: 'translateX(-50%)',
                }}
              >
                {t.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
