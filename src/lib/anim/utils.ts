
import { clamp } from '../utils';

// The number of pixels that represent one second at zoom level 1.
export const BASE_PX_PER_SECOND = 100;

/**
 * Calculates how many milliseconds are represented by a single pixel at a given zoom level.
 * @param zoom The current zoom level (1 = 100%).
 * @returns The number of milliseconds per pixel.
 */
export function getMsPerPx(zoom: number): number {
  if (zoom <= 0) return Infinity;
  return 1000 / (BASE_PX_PER_SECOND * zoom);
}

/**
 * Converts a time in milliseconds to a horizontal pixel coordinate.
 * @param timeMs The time in milliseconds to convert.
 * @param originMs The time in milliseconds at the left edge of the viewport.
 * @param msPerPx The number of milliseconds per pixel.
 * @returns The x-coordinate in pixels.
 */
export const msToX = (
  timeMs: number,
  originMs: number,
  msPerPx: number,
) => {
  if (msPerPx <= 0) return 0;
  return (timeMs - originMs) / msPerPx;
};

/**
 * Converts a horizontal pixel coordinate to a time in milliseconds.
 * @param xPx The x-coordinate in pixels to convert.
 * @param originMs The time in milliseconds at the left edge of the viewport.
 * @param msPerPx The number of milliseconds per pixel.
 * @returns The time in milliseconds.
 */
export const pxToMs = (
  xPx: number,
  originMs: number,
  msPerPx: number,
) => {
  return originMs + xPx * msPerPx;
};

/**
 * Formats a time in milliseconds to a string HH:MM:SS:FF or SS:FF depending on requirements.
 * Here we provide a simple implementation M:SS.ff
 */
export function formatTime(timeMs: number): string {
  const totalSeconds = Math.max(0, timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor((totalSeconds % 1) * 100);

  const mStr = minutes > 0 ? `${minutes}:` : '';
  const sStr = minutes > 0 ? seconds.toString().padStart(2, '0') : seconds.toString();
  const msStr = milliseconds.toString().padStart(2, '0');

  return `${mStr}${sStr}.${msStr}`;
}
