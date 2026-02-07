import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function coerceNumber(
  v: unknown,
  fallback = 0,
  { min = -Infinity, max = Infinity }: { min?: number; max?: number } = {}
) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : (typeof v === 'number' ? v : NaN);
  return clamp(Number.isFinite(n) ? n : fallback, min, max);
}
