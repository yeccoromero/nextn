'use client';

export type TickKind = 'major' | 'minor' | 'micro';
export type Tick = { x: number; kind: TickKind; timeMs: number; label?: string };

// This finds the "best" subdivision for a given FPS for minor ticks.
// e.g., for 30fps, it will find that subdividing into 6 parts (step of 5 frames) is good.
function getSmartMinorStep(fps: number): number {
    const subdividers = [6, 5, 4, 10, 3, 2];
    for (const div of subdividers) {
        if (fps > div && fps % div === 0) {
            return fps / div;
        }
    }
    // Fallback for weird FPS values like 29.97
    const roundedFps = Math.round(fps);
    for (const div of subdividers) {
        if (roundedFps > div && roundedFps % div === 0) {
            return roundedFps / div;
        }
    }

    return Math.floor(fps / 5) || 1;
}

export function generateTicks(originMs: number, panelWidth: number, msPerPx: number, fps: number): Tick[] {
  const visibleMs = panelWidth * msPerPx;
  if (visibleMs <= 0 || panelWidth <= 0 || msPerPx <= 0) return [];

  const msPerFrame = 1000 / Math.max(1, fps);
  const pxPerFrame = msPerFrame / msPerPx;
  
  // 1. Determine visibility of different tick levels based on zoom
  const smartMinorStep = getSmartMinorStep(fps);
  const showMinorTicks = (smartMinorStep * pxPerFrame) >= 10;
  const showMinorLabels = (smartMinorStep * pxPerFrame) >= 25;
  const showMicroTicks = pxPerFrame >= 5;

  const ticks: Tick[] = [];
  const startMs = originMs;
  const endMs = originMs + visibleMs;
  
  const firstFrame = Math.floor(startMs / msPerFrame);
  const lastFrame = Math.ceil(endMs / msPerFrame);
  
  let lastLabelX = -Infinity;
  const minLabelGapPx = 40;

  for (let f = firstFrame; f <= lastFrame; f++) {
    const timeMs = f * msPerFrame;
    const x = (timeMs - originMs) / msPerPx;
    
    if (x < -1 || x > panelWidth + 1) continue;

    // Use a tolerance for floating point issues with msPerFrame
    const isSecondBoundary = Math.abs(timeMs % 1000) < msPerFrame / 2 || f === 0;

    // Major Ticks: Every second
    if (isSecondBoundary) {
      const sec = Math.round(timeMs / 1000);
      let label: string | undefined = undefined;
      if (x > lastLabelX + minLabelGapPx) {
          label = `${sec}s`;
          lastLabelX = x;
      }
      ticks.push({ x, timeMs, kind: 'major', label });
      continue;
    }

    // Minor Ticks: At smart intervals (e.g., every 5f for 30fps)
    if (showMinorTicks && f % smartMinorStep === 0) {
      let label: string | undefined = undefined;
      const frameInSecond = f % fps;
      if (showMinorLabels && x > lastLabelX + minLabelGapPx) {
        label = `${frameInSecond}f`;
        lastLabelX = x;
      }
      ticks.push({ x, timeMs, kind: 'minor', label });
      continue;
    }

    // Micro Ticks: For every single frame
    if (showMicroTicks) {
      ticks.push({ x, timeMs, kind: 'micro' });
    }
  }

  return ticks;
}
