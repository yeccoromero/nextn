'use client';

import React from 'react';
import { useEditorStore } from '@/store';
import { generateTicks } from '@/lib/anim/timeline-ticks';

type RulerProps = {
  height: number;
  panelWidth: number;
  originMs: number;
  msPerPx: number;
};

export default function Ruler({ height, panelWidth, originMs, msPerPx }: RulerProps) {
  const fps = useEditorStore(state => (state.transientPresent ?? state.present).timeline.fps);

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
        // Heights based on tick kind - much shorter for a cleaner look
        const tickHeight =
          t.kind === 'major' ? 10 :
            t.kind === 'minor' ? 5 :
              3; // micro

        const alpha =
          t.kind === 'major' ? 0.6 :
            t.kind === 'minor' ? 0.3 :
              0.15;

        const leftTick = Math.round(t.x) + 0.5;

        return (
          <div key={i} className="absolute h-full" style={{ left: leftTick, top: 0 }}>
            {/* The tick line, centered vertically. Hidden for major ticks to keep it clean */}
            {t.kind !== 'major' && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-px"
                style={{ height: tickHeight, background: `hsla(var(--foreground) / ${alpha})` }}
              />
            )}

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
