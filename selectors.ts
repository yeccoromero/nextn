// @ts-nocheck

import type { RootState, ClipSegment, SvgObject, PropertyId } from "@/types/editor";
import { getLayerClipSafe } from "./group-clip";


// Devuelve el segmento activo de un layer (no propiedad) en t
export function selectActiveLayerSegment(state: RootState, objectId: string, tMs: number): ClipSegment | null {
  const clip = getLayerClipSafe(state, objectId);
  if (!clip || !clip.segments || clip.segments.length === 0) return null;

  // Asume segments no solapados y ordenados
  let lo = 0, hi = clip.segments.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = clip.segments[mid];
    if (tMs < s.startMs) hi = mid - 1;
    else if (tMs >= s.endMs) lo = mid + 1;
    else return { ...s };
  }
  return null;
}

// Para propiedades: podrías tener clips por propiedad; si aún no existen, hereda del layer
export function selectActivePropertySegment(state: RootState, objectId: string, propertyId: PropertyId, tMs: number): ClipSegment | null {
  const rowClip = getLayerClipSafe(state, objectId);
  // Si ya tienes clips por propiedad, reemplaza la línea anterior por getPropertyClipSafe(state, objectId, propertyId)
  if (!rowClip?.segments?.length) return null;
  for (const s of rowClip.segments) {
    if (tMs >= s.startMs && tMs < s.endMs) return { ...s };
  }
  return null;
}

// Mapeo a tiempo local (útil si keyframes están en espacio local)
export function toLocalTime(seg: ClipSegment, tGlobal: number): number {
  const speed = (seg as any).speed ?? 1;
  const inMs = (seg as any).inMs ?? 0;
  return inMs + (tGlobal - seg.startMs) * speed;
}

export function selectVirtualRange(state: RootState) {
  let minStart = 0;
  let maxEnd = state.timeline.durationMs; // fallback
  let hasAny = false;

  for (const id in state.timeline.layers) {
    const lt = state.timeline.layers[id];
    if (!lt) continue;

    const t0 = Math.min(
      lt.startMs ?? 0,
      lt.clip?.segments?.[0]?.startMs ?? Infinity
    );

    let t1 = -Infinity;
    if (lt.clip?.segments?.length) {
      lt.clip.segments.forEach(s => { t1 = Math.max(t1, s.endMs); });
    }
    lt.properties?.forEach(tr => {
      tr.keyframes?.forEach(k => { t1 = Math.max(t1, k.timeMs); });
    });

    if (isFinite(t0)) { minStart = hasAny ? Math.min(minStart, t0) : t0; hasAny = true; }
    if (isFinite(t1)) { maxEnd = Math.max(maxEnd, t1); hasAny = true; }
  }

  if (!hasAny) {
    minStart = 0; maxEnd = state.timeline.durationMs;
  }
  const virtualDuration = Math.max(1, maxEnd - minStart);
  return { minStart, maxEnd, virtualDuration };
}
