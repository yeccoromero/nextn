
// src/lib/anim/clip.ts
export type ClipSegment = { startMs: number; endMs: number };
export type Clip = { id: string; segments: ClipSegment[]; selected?: boolean; color?: string; };

export const EMPTY_CLIP: Clip = { id: '', segments: [] };

export function normalizeClip(clip: Clip): Clip {
  if (!clip || !clip.segments?.length) return { ...clip, segments: [] };
  const sorted = [...clip.segments]
    .filter(s => s.endMs > s.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  const merged: ClipSegment[] = [];
  for (const seg of sorted) {
    const last = merged[merged.length - 1];
    if (!last || seg.startMs > last.endMs) {
      merged.push({ ...seg });
    } else {
      last.endMs = Math.max(last.endMs, seg.endMs);
    }
  }
  return { ...clip, segments: merged };
}

export function unionClips(...clips: (Clip | undefined | null)[]): Clip {
  const segments: ClipSegment[] = [];
  for (const c of clips) {
    if (!c?.segments) continue;
    segments.push(...c.segments);
  }
  // This is a simplified union, it doesn't carry over other clip properties like id, selected, etc.
  return normalizeClip({ id: 'union', segments });
}
