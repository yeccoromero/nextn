// @ts-nocheck

'use client';

import type { SvgObject, ResizeHandle, EllipseObject, BoundingBox, PathObject, BezierPoint, StarObject, PolygonObject, GroupObject, RectangleObject } from "@/types/editor";
import { getObjectCenter, rotatePoint, RS_apply, localToWorld, getLocalAnchor, worldToLocal, getWorldRotation, getWorldScale, getOrientedBBox, getOppositeHandle, getHandlePosition } from "./editor-utils";

export interface Point {
  x: number;
  y: number;
}

export interface ResizeParams {
  object: SvgObject;
  handle: ResizeHandle;
  anchor: Point;
  delta: Point;
  modifiers: { shift: boolean; alt: boolean; ctrl: boolean };
  minSize?: number;
  isGroup: boolean;
  groupBBox?: BoundingBox & { cx: number; cy: number, rotation: number };
  objects: Record<string, SvgObject>;
}


// === CORE: escalar (o espejar) un objeto alrededor de un pivote EN MUNDO ===
// Moved to editor-utils.ts to avoid circular dependency
import { scaleAroundWorldPivot } from "./editor-utils";
export { scaleAroundWorldPivot };


export function transformObjectByResize(params: ResizeParams): Partial<SvgObject> {
  const { object: orig, handle, anchor: pivotWorld, modifiers, isGroup, groupBBox, objects } = params;
  let { delta } = params;
  const { shift } = modifiers;

  const bbox = isGroup && groupBBox ? groupBBox : getOrientedBBox(orig, objects);
  if (!bbox) return {};

  const center = { x: bbox.cx, y: bbox.cy };
  const unrotatedDelta = rotatePoint(delta, { x: 0, y: 0 }, -bbox.rotation);
  const origScaleX = orig.scaleX ?? 1;
  const origScaleY = orig.scaleY ?? 1;

  const h0 = getHandlePosition(bbox, handle);
  const h0Unrotated = rotatePoint(h0, center, -bbox.rotation);

  const pUnrotated = rotatePoint(pivotWorld, center, -bbox.rotation);

  const h1 = { x: h0Unrotated.x + unrotatedDelta.x, y: h0Unrotated.y + unrotatedDelta.y };

  const EPS = 1e-7;
  const denX = h0Unrotated.x - pUnrotated.x;
  const denY = h0Unrotated.y - pUnrotated.y;

  let kx = Math.abs(denX) > EPS ? (h1.x - pUnrotated.x) / denX : 1;
  let ky = Math.abs(denY) > EPS ? (h1.y - pUnrotated.y) / denY : 1;

  if (handle.length === 1) { // Edge handles
    if (handle === 'n' || handle === 's') kx = 1;
    if (handle === 'e' || handle === 'w') ky = 1;
  }

  if (shift) {
    const ar = (bbox.width > EPS ? bbox.width : 1) / (bbox.height > EPS ? bbox.height : 1);
    const akx = Math.abs(kx);
    const aky = Math.abs(ky);

    if (handle.length === 2) { // Corner handle
      if (akx * ar > aky) {
        ky = Math.sign(ky) * akx;
      } else {
        kx = Math.sign(kx) * aky;
      }
    } else { // Edge handle
      if (handle === 'n' || handle === 's') {
        kx = Math.sign(kx) * aky;
      } else { // 'e' or 'w'
        ky = Math.sign(ky) * akx;
      }
    }
  }

  const newScaleX = origScaleX * kx;
  const newScaleY = origScaleY * ky;

  if (!pivotWorld) return {};

  const updates = scaleAroundWorldPivot(orig, newScaleX, newScaleY, pivotWorld, objects);

  return updates;
}


export function rotateAroundWorldPivot(
  obj: SvgObject,
  newRotation: number,                 // ABSOLUTO (grados)
  pivotWorld: { x: number; y: number },
  objects: Record<string, SvgObject>
): Partial<SvgObject> {
  const parent = obj.parentId ? objects[obj.parentId] : null;
  const P_parent = parent ? worldToLocal(parent, pivotWorld, objects) : pivotWorld;

  // Pivote en local
  const pLocal = worldToLocal(obj, pivotWorld, objects);

  // Vector S(p) con escala ABSOLUTA actual (no cambia en rotación)
  const sX = obj.scaleX ?? 1, sY = obj.scaleY ?? 1;
  const px = pLocal.x * sX, py = pLocal.y * sY;

  // R(new) • [px,py]
  const th = (newRotation || 0) * Math.PI / 180;
  const c = Math.cos(th), s = Math.sin(th);
  const Rp = { x: px * c - py * s, y: px * s + py * c };

  // nueva traslación local (coords del padre)
  const newX = P_parent.x - Rp.x;
  const newY = P_parent.y - Rp.y;

  return { x: newX, y: newY, rotation: newRotation };
}


