
import { useEffect, useCallback, useRef } from "react";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable;
}

// snap al frame más cercano para evitar drift
function snapToFrameMs(timeMs: number, fps: number) {
  if (fps === 0) return timeMs;
  const msPerFrame = 1000 / fps;
  return Math.round(timeMs / msPerFrame) * msPerFrame;
}

function stepFramesFromMs(currentMs: number, deltaFrames: number, fps: number) {
  if (fps === 0) return currentMs;
  const msPerFrame = 1000 / fps;
  const curFrame = Math.round(currentMs / msPerFrame);
  return (curFrame + deltaFrames) * msPerFrame;
}

type UseAeKeyboardNudgeOpts = {
  fps: number;
  getTimeMs: () => number;
  setTimeMs: (ms: number) => void;
  getDurationMs: () => number;
  isPlaying?: () => boolean;
  setPlaying?: (p: boolean) => void;
};

export function useAeKeyboardNudge({
  fps,
  getTimeMs,
  setTimeMs,
  getDurationMs,
  isPlaying,
  setPlaying,
}: UseAeKeyboardNudgeOpts) {
  const lastAt = useRef(0);

  const applyMs = useCallback(
    (nextMs: number) => {
      const duration = getDurationMs();
      const clamped = clamp(nextMs, 0, duration);
      const snapped = snapToFrameMs(clamped, fps);
      setTimeMs(snapped);
    },
    [fps, getDurationMs, setTimeMs]
  );

  const pauseIfPlaying = useCallback(() => {
    if (isPlaying?.() && setPlaying) setPlaying(false);
  }, [isPlaying, setPlaying]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      const isArrow = e.key === "ArrowLeft" || e.key === "ArrowRight";
      if (!isArrow) return;
      
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      if (!isCtrlOrCmd && !isShift) {
        return;
      }

      e.preventDefault();

      // throttle repeats
      const now = performance.now();
      if (e.repeat && now - lastAt.current < 30) return;
      lastAt.current = now;

      pauseIfPlaying();

      const dir = e.key === "ArrowRight" ? +1 : -1;
      const cur = getTimeMs();

      if (isShift) {
        // 10 frames
        const next = stepFramesFromMs(cur, dir * 10, fps);
        applyMs(next);
        return;
      }

      if (isCtrlOrCmd) {
        // 1 frame
        const next = stepFramesFromMs(cur, dir * 1, fps);
        applyMs(next);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyMs, fps, getTimeMs, pauseIfPlaying]);
}
