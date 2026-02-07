// @ts-nocheck
import { AnimeRuntimeApplyLegacy, easeValueLegacy } from './legacy-runtime';
import { solveCubicBezier, solveSpatialCubic } from './math-core';
import { Matrix3 } from './matrix';
import { interpColor } from '@/lib/color-utils';
import type { ApplyPatch, TimelineSpec, EasingId, Keyframe, SvgObject } from '@/types/editor';
import { rotateAroundWorldPivot, scaleAroundWorldPivot } from '@/lib/geometry';
import { getWorldAnchor } from '@/lib/editor-utils';
import type { RuntimeOptions } from './legacy-runtime';

// Re-export types to maintain API compatibility
export type { ApplyPatch, TimelineSpec, RuntimeOptions } from './legacy-runtime';

const HANDLED_TRANSFORM_PROPS = new Set(['position', 'x', 'y', 'scale', 'scaleX', 'scaleY', 'rotation']);

function getDepth(objectId: string, objects: Record<string, SvgObject>): number {
  let depth = 0;
  let current = objects[objectId];
  while (current?.parentId && objects[current.parentId]) {
    depth++;
    current = objects[current.parentId];
  }
  return depth;
}

/**
 * Calculates the easing value at a normalized time t (0-1).
 * Delegates to V1 Legacy Easing or future advanced easings.
 */
export function easeValue(easing: EasingId | undefined, t: number): number {
  return easeValueLegacy(easing, t);
}

/**
 * Calculates the interpolated value of a property at a specific time.
 * Supports 'linear', 'hold', 'ease', 'bezier', and 'spatial' paths.
 */
export function getValueAtTime<T>(keyframes: Keyframe[] | undefined, timeMs: number, defaultValue: T, isSpatial?: boolean): T {
  if (!keyframes || keyframes.length === 0) return defaultValue;

  const first = keyframes[0];
  if (timeMs <= first.timeMs) return first.value as T;

  const last = keyframes[keyframes.length - 1];
  if (timeMs >= last.timeMs) return last.value as T;

  // Binary search to find the correct segment
  let low = 0;
  let high = keyframes.length - 1;
  let segmentStartIndex = 0;

  while (low <= high) {
    const mid = Math.floor(low + (high - low) / 2);
    if (keyframes[mid].timeMs <= timeMs) {
      segmentStartIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const a = keyframes[segmentStartIndex];
  const b = keyframes[segmentStartIndex + 1];

  if (!a || !b) return defaultValue;

  const segmentDuration = b.timeMs - a.timeMs;
  if (segmentDuration <= 0) return a.value as T;

  // Handle HOLD interpolation
  if (a.interpolation === 'hold') {
    return a.value as T;
  }

  const t = (timeMs - a.timeMs) / segmentDuration;
  let k = t;

  // Handle TEMPORAL Interpolation (Time warping)
  if (a.interpolation === 'bezier' && a.controlPoints) {
    k = solveCubicBezier(a.controlPoints.x1, a.controlPoints.y1, a.controlPoints.x2, a.controlPoints.y2, t);
  }
  else if (a.interpolation === 'ease') {
    k = easeValueLegacy(a.easing || 'inOutQuad', t);
  }
  else {
    k = t;
  }

  // Handle SPATIAL Interpolation override for Vector types
  if (isSpatial && a.spatialTangentOut && b.spatialTangentIn) {
    const valA = a.value as { x: number, y: number };
    const valB = b.value as { x: number, y: number };
    // P0 = A, P1 = A + TangentOut, P2 = B + TangentIn, P3 = B
    const p1 = { x: valA.x + a.spatialTangentOut.x, y: valA.y + a.spatialTangentOut.y };
    const p2 = { x: valB.x + b.spatialTangentIn.x, y: valB.y + b.spatialTangentIn.y };

    const spatialPoint = solveSpatialCubic(valA, p1, p2, valB, k);
    return spatialPoint as T;
  }

  // Color interpolation
  if (typeof a.value === 'string' && typeof b.value === 'string') {
    return interpColor(a.value, b.value, k) as T;
  }

  // Number interpolation
  if (typeof a.value === 'number' && typeof b.value === 'number') {
    return (a.value + (b.value - a.value) * k) as T;
  }

  // Vector ({x, y}) interpolation (Linear Fallback)
  const isPointA = typeof a.value === 'object' && a.value !== null && typeof (a.value as any).x === 'number' && typeof (a.value as any).y === 'number';
  const isPointB = typeof b.value === 'object' && b.value !== null && typeof (b.value as any).x === 'number' && typeof (b.value as any).y === 'number';

  if (isPointA && isPointB) {
    const valA = a.value as { x: number, y: number };
    const valB = b.value as { x: number, y: number };
    return {
      x: valA.x + (valB.x - valA.x) * k,
      y: valA.y + (valB.y - valA.y) * k
    } as T;
  }

  return a.value as T;
}

/**
 * Main Animation Engine Class.
 * Extends V1 Legacy Runtime but overrides updateFrame to pass isSpatial flag.
 */
export class AnimeRuntimeApply extends AnimeRuntimeApplyLegacy {
  constructor(opts: RuntimeOptions) {
    super(opts);
  }

  // --- Phase 3: Matrix Logic (Prototype) ---
  // Calculates World Matrix for an object state
  // This is not used by the legacy renderer yet but is ready for the "Pro Switch"
  private calculateWorldMatrix(obj: SvgObject, objects: Record<string, SvgObject>): Matrix3 {
    let current = obj;
    const chain: SvgObject[] = [current];
    while (current.parentId && objects[current.parentId]) {
      current = objects[current.parentId];
      chain.unshift(current);
    }

    const m = Matrix3.identity();
    for (const item of chain) {
      // Anchor handling is crucial. Usually: Translate(x,y) * Rotate(r) * Scale(s) * Translate(-anchor)
      // Vectoria uses 'anchorPosition' which defines where (0,0) is relative to the box.
      // For now, assuming standard center-pivot relative transform as placeholder.
      m.translate(item.x, item.y);
      m.rotate((item.rotation || 0) * Math.PI / 180);
      m.scale(item.scaleX ?? 1, item.scaleY ?? 1);
    }
    return m;
  }

  override updateFrame(timeMs: number) {
    // ... (Standard V2 logic same as Phase 2)

    // We access super properties via 'any' cast because they are private in the parent class
    // In a real-world scenario, we would change visibility in legacy-runtime.ts to protected.
    // However, since we are duplicating the entire loop to inject 'isSpatial', we don't strictly need access to parent state
    // if we maintain our own state or read from the spec again.
    // The only state is 'lastDisplayTime', which we can set.

    const spec = (this as any).spec as TimelineSpec;
    if (!spec) return;

    (this as any).lastDisplayTime = timeMs;
    const opts = this.opts;

    opts.onUpdate?.({
      currentTimeMs: timeMs,
      durationMs: spec.durationMs,
      progress: (this as any).workArea
        ? (timeMs - (this as any).workArea.startMs) / ((this as any).workArea.endMs - (this as any).workArea.startMs || 1)
        : (timeMs / (spec.durationMs || 1)),
    });

    const objects = opts.getObjects();
    const batch: ApplyPatch[] = [];

    const animatedObjectIds = new Set<string>();
    const tracksByObject: Record<string, Record<string, any>> = {};
    for (const track of spec.tracks) {
      animatedObjectIds.add(track.objectId);
      if (!tracksByObject[track.objectId]) tracksByObject[track.objectId] = {};
      tracksByObject[track.objectId][track.propertyId] = track;
    }

    if (animatedObjectIds.size === 0) {
      return;
    }

    const animatedSnapshot: Record<string, Partial<SvgObject>> = {};
    animatedObjectIds.forEach(objId => {
      const obj = objects[objId];
      if (!obj) return;
      const snapshot = animatedSnapshot[objId] ?? (animatedSnapshot[objId] = {});
      const objTracks = tracksByObject[objId] ?? {};
      for (const propId in objTracks) {
        const track = objTracks[propId];
        const timeForTrack = timeMs - (track.startMs || 0);

        let defaultValue: any = (obj as any)[propId];
        if (propId === 'position' && defaultValue === undefined) {
          defaultValue = { x: obj.x ?? 0, y: obj.y ?? 0 };
        } else if (propId === 'scale' && defaultValue === undefined) {
          defaultValue = { x: obj.scaleX ?? 1, y: obj.scaleY ?? 1 };
        }

        // --- INJECTION POINT FOR SPATIAL INTERPOLATION ---

        const isSpatial = (track as any).isSpatial;
        (snapshot as any)[propId] = getValueAtTime(track.keyframes, timeForTrack, defaultValue, isSpatial);

        // -------------------------------------------------
      }
    });

    const frameObjects: Record<string, SvgObject> = {};
    const orderedObjectIds = Array.from(animatedObjectIds).sort((a, b) => getDepth(a, objects) - getDepth(b, objects));

    for (const objectId of orderedObjectIds) {
      const obj = objects[objectId];
      if (!obj) continue;

      const base = animatedSnapshot[objectId]!;

      const objectsPrime = { ...objects, ...frameObjects };
      // const parentFrame = obj.parentId ? objectsPrime[obj.parentId] : null;

      let state: SvgObject = { ...obj };
      let patch: Partial<SvgObject> = {};

      const objTracks = tracksByObject[objectId] ?? {};

      // --- Start of transform calculations ---

      // 1. Scale (`scale` has precedence over `scaleX`/`scaleY`)
      const scaleProp = objTracks.scale ? 'scale' : (objTracks.scaleX || objTracks.scaleY ? 'scaleX/Y' : null);
      if (scaleProp) {
        const targetScaleX = scaleProp === 'scale' ? (base.scale as { x: number, y: number }).x : (objTracks.scaleX ? base.scaleX as number : state.scaleX ?? 1);
        const targetScaleY = scaleProp === 'scale' ? (base.scale as { x: number, y: number }).y : (objTracks.scaleY ? base.scaleY as number : state.scaleY ?? 1);
        const pivotWorld = getWorldAnchor(state, objectsPrime);
        const sUpdates = scaleAroundWorldPivot(state, targetScaleX, targetScaleY, pivotWorld, objectsPrime);
        patch = { ...patch, ...sUpdates };
        state = { ...state, ...sUpdates };
      }

      // 2. Rotation
      if (objTracks.rotation) {
        const targetRot = (base.rotation ?? state.rotation ?? 0) as number;
        const pivotWorld = getWorldAnchor(state, objectsPrime); // uses updated state from scale
        const rUpdates = rotateAroundWorldPivot(state, targetRot, pivotWorld, objectsPrime);
        patch = { ...patch, ...rUpdates };
        state = { ...state, ...rUpdates }; // Update state for subsequent calculations
      }

      // 3. Position (`position` track has precedence)
      if (objTracks.position) {
        const posLocal = base.position as { x: number; y: number };
        (patch as SvgObject).x = posLocal.x;
        (patch as SvgObject).y = posLocal.y;
      } else {
        // legacy support (optional)
        if (objTracks.x) (patch as SvgObject).x = (base as any).x as number;
        if (objTracks.y) (patch as SvgObject).y = (base as any).y as number;
      }

      // --- End of transform calculations ---

      // 4. Other animatable properties
      for (const propId in objTracks) {
        if (!HANDLED_TRANSFORM_PROPS.has(propId)) {
          (patch as any)[propId] = (base as any)[propId];
        }
      }

      frameObjects[objectId] = { ...state, ...patch };

      if (Object.keys(patch).length) {
        batch.push({ objectId, patch });
      }
    }

    if (batch.length > 0) this.opts.apply(batch);
  }
}
