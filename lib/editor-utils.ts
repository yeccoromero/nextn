
'use client';

import type { SvgObject, StarObject, PolygonObject, RectangleObject, EllipseObject, TextObject, BoundingBox, AnchorPosition, Layer, ResizeHandle, BezierPoint, PathObject, GroupObject, SnapLine, Fill, LinearGradientFill, RadialGradientFill, GradientStop } from '@/types/editor';
import { scaleAroundWorldPivot } from './geometry';


// === Edge clamp config ===
export const ENFORCE_EDGE_CLAMP = true; // true = también guarda el offset clampeado; false = solo UI/drag
export const clamp01 = (t:number) => Math.max(0, Math.min(1, t));

/**
 * Calcula el inset a pixeles y su versión normalizada en [0..1] según la longitud del brazo.
 * - Usa el radio visual/halo para evitar solapes con la handle.
 * - Limita edgeInset a 0.45 para no colapsar el tramo útil en brazos muy cortos.
 */
export function getLinearInset(
  start: {x:number;y:number},
  end: {x:number;y:number},
  zoom: number
) {
  const handleR = 5 / zoom;       // ojo: que coincida con tu render (handleRadius)
  const halo    = 2 / zoom;       // margen visual extra (stroke/halo)
  const extra   = 4 / zoom;       // colchón UX
  const insetPx = handleR * 1.2 + halo + extra; // puedes ajustar estos factores fino

  const dx = end.x - start.x, dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;

  // Conversión a espacio [0..1]
  let edgeInset = insetPx / len;
  if (!Number.isFinite(edgeInset)) edgeInset = 0;
  edgeInset = Math.min(0.45, Math.max(0, edgeInset)); // no reduzcas el tramo útil por debajo de 10%

  return { insetPx, edgeInset, ux, uy, len, dx, dy };
}

function getCubicBezierExtrema(p0: number, p1: number, p2: number, p3: number) {
    const t_values = [];
    const a = 3 * p3 - 9 * p2 + 9 * p1 - 3 * p0;
    const b = 6 * p0 - 12 * p1 + 6 * p2;
    const c = 3 * p1 - 3 * p0;

    if (Math.abs(a) < 1e-8) { // Linear equation
        if (Math.abs(b) > 1e-8) {
            const t = -c / b;
            if (t > 0 && t < 1) t_values.push(t);
        }
    } else { // Quadratic equation
        const delta = b * b - 4 * a * c;
        if (delta >= 0) {
            const sqrt_delta = Math.sqrt(delta);
            const t1 = (-b + sqrt_delta) / (2 * a);
            const t2 = (-b - sqrt_delta) / (2 * a);
            if (t1 > 0 && t1 < 1) t_values.push(t1);
            if (t2 > 0 && t2 < 1) t_values.push(t2);
        }
    }
    return t_values;
}

function getPointOnCubicBezier(p0: number, p1: number, p2: number, p3: number, t: number) {
    const mt = 1 - t;
    return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

export const isSelectionConstrained = (
  objects: Record<string, SvgObject>,
  ids: string[]
): boolean => {
    if (ids.length === 0) return false;
    // Un grupo solo se considera restringido si el propio objeto de grupo tiene la bandera.
    // Los hijos se ignoran para esta comprobación a nivel de grupo.
    if (ids.length === 1 && objects[ids[0]]?.type === 'group') {
      return !!objects[ids[0]].isConstrained;
    }
    return ids.every(id => objects[id]?.isConstrained);
}

export const rotatePoint = (point: {x: number, y: number}, center: {x: number, y: number}, angle: number) => {
    if (angle == null || !Number.isFinite(angle)) angle = 0;
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const nx = (cos * (point.x - center.x)) - (sin * (point.y - center.y)) + center.x;
    const ny = (sin * (point.x - center.x)) + (cos * (point.y - center.y)) + center.y;
    return { x: nx, y: ny };
};

export const getObjectCenter = (obj: SvgObject): { x: number, y: number } => {
    return { x: obj.x, y: obj.y };
};

export const getLocalCorners = (obj: SvgObject, objects: Record<string, SvgObject>): {x: number, y: number}[] => {
    switch (obj.type) {
        case 'rectangle': {
            const { width, height } = obj;
            return [ {x: -width/2, y: -height/2}, {x: width/2, y: -height/2}, {x: width/2, y: height/2}, {x: -width/2, y: height/2} ];
        }
        case 'ellipse': {
            const { rx, ry } = obj;
            return [ {x: -rx, y: -ry}, {x: rx, y: -ry}, {x: rx, y: ry}, {x: -rx, y: ry} ];
        }
        case 'star': {
            const star = obj as StarObject;
            const points: {x: number, y: number}[] = [];
            const angleStep = (Math.PI * 2) / (star.points * 2);
            for (let i = 0; i < star.points * 2; i++) {
              const radius = i % 2 === 0 ? star.outerRadius : star.innerRadius;
              const angle = i * angleStep;
              points.push({ x: radius * Math.sin(angle), y: -radius * Math.cos(angle) });
            }
            return points;
        }
        case 'polygon': {
            const poly = obj as PolygonObject;
            const points: {x: number, y: number}[] = [];
            const angleStep = (Math.PI * 2) / poly.sides;
            for (let i = 0; i < poly.sides; i++) {
                const angle = i * angleStep;
                points.push({ x: poly.radius * Math.sin(angle), y: -poly.radius * Math.cos(angle) });
            }
            return points;
        }
        case 'text': {
             const width = obj.text.length * (obj.fontSize * 0.6); // Approximation
             const height = obj.fontSize * 1.2;
             return [ {x: -width/2, y: -height/2}, {x: width/2, y: -height/2}, {x: width/2, y: height/2}, {x: -width/2, y: height/2} ];
        }
        case 'path': {
            const path = obj as PathObject;
            if (!path.points || path.points.length === 0) return [];
        
            const allPoints = path.points.flatMap(p => [{ x: p.x, y: p.y }]);
        
            const extrema: {x:number, y:number}[] = [];
            for (let i = 0; i < path.points.length - (path.closed ? 0 : 1); i++) {
                const p0 = path.points[i];
                const p1 = path.points[(i + 1) % path.points.length];
                const c1 = p0.handleOut ?? p0;
                const c2 = p1.handleIn ?? p1;
        
                const tx = getCubicBezierExtrema(p0.x, c1.x, c2.x, p1.x);
                const ty = getCubicBezierExtrema(p0.y, c1.y, c2.y, p1.y);
        
                tx.forEach(t => extrema.push({ 
                    x: getPointOnCubicBezier(p0.x, c1.x, c2.x, p1.x, t), 
                    y: getPointOnCubicBezier(p0.y, c1.y, c2.y, p1.y, t) 
                }));
                ty.forEach(t => extrema.push({ 
                    x: getPointOnCubicBezier(p0.x, c1.x, c2.x, p1.x, t), 
                    y: getPointOnCubicBezier(p0.y, c1.y, c2.y, p1.y, t) 
                }));
            }
            return [...allPoints, ...extrema];
        }
        case 'group': {
             const group = obj as GroupObject;
             const children = group.children.map((id: string) => objects[id]).filter(Boolean);
             if (children.length === 0) return [{x:0, y:0}];
             const corners = children.flatMap((child: SvgObject) => {
                const childCorners = getLocalCorners(child, objects);
                return childCorners.map(c => localToWorld(child, c, objects));
             });
             return corners.map(c => worldToLocal(group, c, objects));
        }
        default:
            return [];
    }
}

export const getVisualBoundingBox = (obj: SvgObject, objects: Record<string, SvgObject>): BoundingBox => {
    const localCorners = getLocalCorners(obj, objects);
    if(localCorners.length === 0) return { x: obj.x, y: obj.y, width: 0, height: 0};

    const transformedCorners = localCorners.map(p => localToWorld(obj, p, objects));

    const xs = transformedCorners.map(p => p.x);
    const ys = transformedCorners.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
};

export const getOrientedBoundingBox = (obj: SvgObject, objects: Record<string, SvgObject>) => {
  const local = getLocalCorners(obj, objects);
  if (local.length === 0) {
    const worldPos = localToWorld(obj, {x: 0, y: 0}, objects);
    const worldRot = getWorldRotation(obj, objects);
    return { x: worldPos.x, y: worldPos.y, width: 0, height: 0, rotation: worldRot, cx: worldPos.x, cy: worldPos.y };
  }

  const { minX, maxX, minY, maxY } = getLocalAabb(obj, objects);
  
  const worldScale = getWorldScale(obj, objects);
  const sx = Math.abs(worldScale.x ?? 1);
  const sy = Math.abs(worldScale.y ?? 1);

  const width  = (maxX - minX) * sx;
  const height = (maxY - minY) * sy;

  const worldPos = localToWorld(obj, {x: (minX+maxX)/2, y: (minY+maxY)/2}, objects);
  const worldRot = getWorldRotation(obj, objects);
  
  const cx = worldPos.x;
  const cy = worldPos.y;

  return { x: cx - width / 2, y: cy - height / 2, width, height, rotation: worldRot, cx, cy };
};

export const getOverallBBox = (selectedObjects: SvgObject[], objects: Record<string, SvgObject>) => {
      if (selectedObjects.length === 0) return null;

      if (selectedObjects.length === 1) {
        const obj = selectedObjects[0];
        return getOrientedBoundingBox(obj, objects);
      }

      const bboxes = selectedObjects.map(obj => {
          const corners = getLocalCorners(obj, objects).map(p => localToWorld(obj, p, objects));
          if(corners.length === 0) return {x: obj.x, y: obj.y, width: 0, height: 0};
          const xs = corners.map(p => p.x);
          const ys = corners.map(p => p.y);
          const minX = Math.min(...xs);
          const minY = Math.min(...ys);
          const maxX = Math.max(...xs);
          const maxY = Math.max(...ys);
          return { x: minX, y: minY, width: maxX-minX, height: maxY-minY };
      });
      
      const xMin = Math.min(...bboxes.map(b => b.x));
      const yMin = Math.min(...bboxes.map(b => b.y));
      const xMax = Math.max(...bboxes.map(b => b.x + b.width));
      const yMax = Math.max(...bboxes.map(b => b.y + b.height));
      const width = xMax - xMin;
      const height = yMax - yMin;
      
      const cx = xMin + width/2;
      const cy = yMin + height/2;

      return { x: xMin, y: yMin, width, height, rotation: 0, cx, cy };
}

export const getRotatedCursor = (cursor: string, angle: number): string => {
    const normalizedAngle = (angle % 360 + 360) % 360;
    const cursors: { [key: string]: string[] } = {
        'ns-resize': ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'],
        'ew-resize': ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'],
        'nesw-resize': ['nesw-resize', 'ew-resize', 'nwse-resize', 'ns-resize'],
        'nwse-resize': ['nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize'],
    };
    const cursorSet = cursors[cursor];
    if (!cursorSet) return cursor;
    const segment = Math.floor((normalizedAngle + 22.5) / 45) % 8;
    if (cursor === 'ns-resize' || cursor === 'ew-resize') return cursorSet[Math.floor(segment / 2)];
    const diagonalSegment = Math.floor(normalizedAngle / 45) % 8;
    return cursorSet[Math.round(diagonalSegment / 2) % 4];
};

export const getHoveredInteraction = (
    mousePoint: { x: number; y: number },
    bbox: (BoundingBox & { rotation: number; cx: number; cy: number }) | null,
    zoom: number,
    isEditingGradient: boolean,
    singleSelected: SvgObject | null,
    objects: Record<string, SvgObject>
): { type: 'resize'; cursor: string; handle: ResizeHandle } | { type: 'rotate'; cursor: string } | { type: 'move' } | null => {
    
    if (!bbox) return null;

    if (isEditingGradient) {
        const fill = singleSelected?.fill;
        if (fill && typeof fill === 'object' && fill.type === 'linear-gradient') {
            const startHandlePos = localToWorld(singleSelected!, fill.start, objects);
            const endHandlePos = localToWorld(singleSelected!, fill.end, objects);
            const distToStart = Math.hypot(mousePoint.x - startHandlePos.x, mousePoint.y - startHandlePos.y);
            const distToEnd = Math.hypot(mousePoint.x - endHandlePos.x, mousePoint.y - endHandlePos.y);
            const tolerance = 10 / zoom;
            if (distToStart < tolerance) return { type: 'resize', handle: 'linear-start' as any, cursor: 'move' };
            if (distToEnd < tolerance) return { type: 'resize', handle: 'linear-end' as any, cursor: 'move' };
        }
        return null;
    }
    
    const { width, height, rotation, cx, cy } = bbox;
    const handleSize = 8 / zoom;
    const halfHandle = handleSize / 2;
    const unrotatedBbox = { x: cx - width / 2, y: cy - height / 2, width, height };
    
    const handles: { position: ResizeHandle, x: number, y: number, cursor: string }[] = [
      { position: 'nw', x: unrotatedBbox.x, y: unrotatedBbox.y, cursor: 'nwse-resize' },
      { position: 'ne', x: unrotatedBbox.x + width, y: unrotatedBbox.y, cursor: 'nesw-resize' },
      { position: 'sw', x: unrotatedBbox.x, y: unrotatedBbox.y + height, cursor: 'nesw-resize' },
      { position: 'se', x: unrotatedBbox.x + width, y: unrotatedBbox.y + height, cursor: 'nwse-resize' },
      { position: 'n', x: unrotatedBbox.x + width / 2, y: unrotatedBbox.y, cursor: 'ns-resize' },
      { position: 's', x: unrotatedBbox.x + width / 2, y: unrotatedBbox.y + height, cursor: 'ns-resize' },
      { position: 'w', x: unrotatedBbox.x, y: unrotatedBbox.y + height / 2, cursor: 'ew-resize' },
      { position: 'e', x: unrotatedBbox.x + width, y: unrotatedBbox.y + height / 2, cursor: 'ew-resize' },
    ];
    
    const center = { x: cx, y: cy };
    const unrotatedMousePoint = rotatePoint(mousePoint, center, -rotation);

    for (const h of handles) {
        if (
            unrotatedMousePoint.x >= h.x - halfHandle && unrotatedMousePoint.x <= h.x + halfHandle &&
            unrotatedMousePoint.y >= h.y - halfHandle && unrotatedMousePoint.y <= h.y + halfHandle
        ) {
            return { type: 'resize', handle: h.position, cursor: h.cursor };
        }
    }

    const tolerance = 20 / zoom;
    for (const corner of handles.filter(h => h.position.length === 2)) {
        const dx = unrotatedMousePoint.x - corner.x;
        const dy = unrotatedMousePoint.y - corner.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist > halfHandle && dist <= tolerance) {
            const isOutside = unrotatedMousePoint.x < unrotatedBbox.x || unrotatedMousePoint.x > unrotatedBbox.x + width || unrotatedMousePoint.y < unrotatedBbox.y || unrotatedMousePoint.y > unrotatedBbox.y + height;
            if (isOutside) {
                const ROTATION_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M2 12C2 6.48 6.44 2 12 2C18.67 2 22 7.56 22 7.56M22 7.56V2.56M22 7.56H17.56" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /><path opacity="0.4" d="M21.89 12C21.89 17.52 17.41 22 11.89 22C6.37 22 3 16.44 3 16.44M3 16.44H7.52M3 16.44V21.44" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
                return { type: 'rotate', cursor: `url('data:image/svg+xml;base64,${btoa(ROTATION_CURSOR_SVG)}') 11 11, auto` };
            }
        }
    }
    
    if (unrotatedMousePoint.x >= unrotatedBbox.x && unrotatedMousePoint.x <= unrotatedBbox.x + width && unrotatedMousePoint.y >= unrotatedBbox.y && unrotatedMousePoint.y <= unrotatedBbox.y + height) {
        return { type: 'move' };
    }

    return null;
};

export function buildPathD(path: PathObject): string {
    if (!path || !path.points || path.points.length === 0) return '';
    
    const pts = path.points;
    const fmt = (n: number) => n ? +n.toFixed(3) : 0;
    
    let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
    if (pts.length === 1) return d;
    
    const segCount = path.closed ? pts.length : pts.length - 1;

    for (let i = 0; i < segCount; i++) {
        const p0 = pts[i];
        const p1 = pts[(i + 1) % pts.length];

        if (!p0 || !p1) continue;

        const c1 = p0.handleOut ?? p0;
        const c2 = p1.handleIn ?? p1;

        const isLine = !p0.handleOut && !p1.handleIn;

        if (isLine) {
            d += ` L ${fmt(p1.x)} ${fmt(p1.y)}`;
        } else {
            d += ` C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(p1.x)} ${fmt(p1.y)}`;
        }
    }

    if (path.closed) d += ' Z';
    return d;
}

export const getLocalAabb = (obj: SvgObject, objects: Record<string, SvgObject>) => {
  const pts = getLocalCorners(obj, objects);
  if (pts.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
  return {minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys)};
};

export function getLocalAnchor(obj: SvgObject, anchor: AnchorPosition, objects: Record<string, SvgObject>): {x:number, y:number} {
  if (anchor === 'origin') return { x: 0, y: 0 };
  const {minX,maxX,minY,maxY} = getLocalAabb(obj, objects);
  const mx = (minX+maxX)/2, my = (minY+maxY)/2;
  const mapX = anchor.includes('left') ? minX : anchor.includes('right') ? maxX : mx;
  const mapY = anchor.includes('top')  ? minY : anchor.includes('bottom')? maxY : my;
  return { x: mapX, y: mapY };
}

export function RS_apply(obj: SvgObject, p: {x:number;y:number}, sx: number, sy: number) {
  const a = (obj.rotation || 0) * Math.PI / 180;
  const c = Math.cos(a), s = Math.sin(a);
  const x = p.x * sx, y = p.y * sy;
  return { x: x*c - y*s, y: x*s + y*c };
}

export function localToWorld(obj: SvgObject | null, p: {x:number;y:number}, objects: Record<string, SvgObject>): {x:number, y:number} {
    let point = { ...p };
    let current: SvgObject | undefined | null = obj;
    while(current) {
        const sx = current.scaleX ?? 1;
        const sy = current.scaleY ?? 1;

        // 1. Scale
        point = { x: point.x * sx, y: point.y * sy };
        
        // 2. Rotate
        const angleRad = (current.rotation || 0) * Math.PI / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        point = {
            x: point.x * cos - point.y * sin,
            y: point.x * sin + point.y * cos
        };

        // 3. Translate
        point = {
            x: point.x + current.x,
            y: point.y + current.y,
        };
        
        current = current.parentId ? objects[current.parentId] : undefined;
    }

    return point;
}

export function worldToLocal(parent: SvgObject | null, p: {x:number;y:number}, objects: Record<string, SvgObject>): {x:number, y:number} {
    
    const hierarchy: SvgObject[] = [];
    let current: SvgObject | undefined | null = parent;
    while(current) {
        hierarchy.unshift(current);
        current = current.parentId ? objects[current.parentId] : undefined;
    }

    let point = { ...p };
    for(const ancestor of hierarchy) {
        // 1. Inverse Translate
        const dx = point.x - ancestor.x;
        const dy = point.y - ancestor.y;
        
        // 2. Inverse Rotate
        const angleRad = -(ancestor.rotation || 0) * Math.PI / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        const rotatedP = {
            x: dx * cos - dy * sin,
            y: dx * sin + dy * cos
        };
        
        // 3. Inverse Scale
        const sx = ancestor.scaleX ?? 1;
        const sy = ancestor.scaleY ?? 1;

        if (Math.abs(sx) < 1e-6 || Math.abs(sy) < 1e-6) {
             point = { x: 0, y: 0 };
             break;
        }

        point = {
            x: rotatedP.x / sx,
            y: rotatedP.y / sy
        };
    }
    return point;
}


export function getWorldAnchor(obj: SvgObject, objects: Record<string, SvgObject>): {x:number, y:number} {
    const aLocal = getLocalAnchor(obj, obj.anchorPosition, objects);
    return localToWorld(obj, aLocal, objects);
}

export function getWorldRotation(obj: SvgObject, objects: Record<string, SvgObject>): number {
    let totalRotation = obj.rotation || 0;
    let current: SvgObject | undefined | null = obj;
    while (current?.parentId && objects[current.parentId]) {
        current = objects[current.parentId];
        totalRotation += current.rotation || 0;
    }
    return totalRotation;
}

export function getWorldScale(obj: SvgObject, objects: Record<string, SvgObject>): {x: number, y: number} {
    let totalScale = { x: obj.scaleX ?? 1, y: obj.scaleY ?? 1 };
    let current = obj;
    while (current.parentId && objects[current.parentId]) {
        current = objects[current.parentId];
        totalScale.x *= current.scaleX ?? 1;
        totalScale.y *= current.scaleY ?? 1;
    }
    return totalScale;
}

export function flipObjectAroundAnchor(
  obj: SvgObject,
  axis: 'x' | 'y',
  objects: Record<string, SvgObject>
): Partial<SvgObject> {
  const sX0 = obj.scaleX ?? 1;
  const sY0 = obj.scaleY ?? 1;
  const sX1 = axis === 'x' ? -sX0 : sX0;
  const sY1 = axis === 'y' ? -sY0 : sY0;

  const aLocal = getLocalAnchor(obj, obj.anchorPosition, objects);
  const pivotWorld = localToWorld(obj, aLocal, objects);

  const updates = scaleAroundWorldPivot(obj, sX1, sY1, pivotWorld, objects);
  
  if (obj.type === 'path') {
    return updates;
  }
  
  return updates;
}


export function getOppositeHandle(handle: ResizeHandle): ResizeHandle {
    const opposites: Record<ResizeHandle, ResizeHandle> = {
        n: 's', s: 'n', e: 'w', w: 'e',
        ne: 'sw', nw: 'se', se: 'nw', sw: 'ne'
    };
    return opposites[handle];
}

export function getHandlePosition(bbox: BoundingBox & { rotation: number, cx: number, cy: number }, handle: ResizeHandle): {x: number, y: number} {
    const { width, height, rotation, cx, cy } = bbox;
    const unrotatedBbox = { x: cx - width / 2, y: cy - height / 2 };

    let point: {x: number, y: number};

    switch (handle) {
        case 'nw': point = { x: unrotatedBbox.x, y: unrotatedBbox.y }; break;
        case 'ne': point = { x: unrotatedBbox.x + width, y: unrotatedBbox.y }; break;
        case 'sw': point = { x: unrotatedBbox.x, y: unrotatedBbox.y + height }; break;
        case 'se': point = { x: unrotatedBbox.x + width, y: unrotatedBbox.y + height }; break;
        case 'n':  point = { x: unrotatedBbox.x + width / 2, y: unrotatedBbox.y }; break;
        case 's':  point = { x: unrotatedBbox.x + width / 2, y: unrotatedBbox.y + height }; break;
        case 'w':  point = { x: unrotatedBbox.x, y: unrotatedBbox.y + height / 2 }; break;
        case 'e':  point = { x: unrotatedBbox.x + width, y: unrotatedBbox.y + height / 2 }; break;
        default:   point = { x: cx, y: cy };
    }

    if (rotation !== 0) {
        return rotatePoint(point, { x: cx, y: cy }, rotation);
    }
    return point;
}

export function findClosestPointOnPath(path: PathObject, targetPoint: { x: number; y: number }): { point: { x: number; y: number }; segmentIndex: number } | null {
    let closestPoint: { x: number; y: number } | null = null;
    let minDistance = Infinity;
    let segmentIndex = -1;

    for (let i = 0; i < path.points.length - (path.closed ? 0 : 1); i++) {
        const p1 = path.points[i];
        const p2 = path.points[(i + 1) % path.points.length];
        
        const p1World = { x: p1.x + path.x, y: p1.y + path.y };
        const p2World = { x: p2.x + path.x, y: p2.y + path.y };

        const dx = p2World.x - p1World.x;
        const dy = p2World.y - p1World.y;

        if (dx === 0 && dy === 0) continue;

        const t = ((targetPoint.x - p1World.x) * dx + (targetPoint.y - p1World.y) * dy) / (dx * dx + dy * dy);
        const clampedT = Math.max(0, Math.min(1, t));

        const closest = {
            x: p1World.x + clampedT * dx,
            y: p1World.y + clampedT * dy,
        };
        
        const distance = Math.hypot(targetPoint.x - closest.x, targetPoint.y - closest.y);

        if (distance < minDistance) {
            minDistance = distance;
            closestPoint = closest;
            segmentIndex = i;
        }
    }
    
    if (closestPoint) {
        return { point: closestPoint, segmentIndex };
    }
    
    return null;
}

export function getSmartSnap(
  movingObjectIds: string[],
  allObjects: Record<string, SvgObject>,
  mousePoint: { x: number; y: number },
  startPoint: { x: number; y: number },
  zoom: number,
  canvas: { x: number; y: number; width: number; height: number },
  activeSnapLines?: SnapLine[]
): { snappedPoint: { x: number; y: number }; snapLines: SnapLine[], targetId?: string } {
  if (movingObjectIds.some(id => allObjects[id]?.type === 'path')) {
    return { snappedPoint: mousePoint, snapLines: [], targetId: undefined };
  }

  const movingBBox = getOverallBBox(movingObjectIds.map(id => allObjects[id]), allObjects);
  if (!movingBBox) return { snappedPoint: mousePoint, snapLines: [], targetId: undefined };

  const canvasCx = canvas.x + canvas.width / 2;
  const canvasCy = canvas.y + canvas.height / 2;
  
  const dx = mousePoint.x - startPoint.x;
  const dy = mousePoint.y - startPoint.y;
  const targetCx = movingBBox.cx + dx;
  const targetCy = movingBBox.cy + dy;

  const snapThreshold = 8 / zoom;
  
  let snapX = false;
  let snapY = false;

  if (Math.abs(targetCx - canvasCx) < snapThreshold) snapX = true;
  if (Math.abs(targetCy - canvasCy) < snapThreshold) snapY = true;

  const snappedPoint = {
    x: snapX ? mousePoint.x - (targetCx - canvasCx) : mousePoint.x,
    y: snapY ? mousePoint.y - (targetCy - canvasCy) : mousePoint.y,
  };

  const newSnapLines: SnapLine[] = [];
  if (snapX) {
    newSnapLines.push({ x1: canvasCx, y1: canvas.y, x2: canvasCx, y2: canvas.y + canvas.height });
  }
  if (snapY) {
    newSnapLines.push({ x1: canvas.x, y1: canvasCy, x2: canvas.x + canvas.width, y2: canvasCy });
  }

  return { snappedPoint, snapLines: newSnapLines, targetId: 'canvas-center' };
}

// === Util: leer transformaciones mundiales del objeto ===
export function getWorldTransform(obj: SvgObject, objects: Record<string, SvgObject>) {
  const pos = localToWorld(obj, { x: 0, y: 0 }, objects);         // centro en mundo
  const rot = getWorldRotation(obj, objects);                      // suma de rotaciones
  const sc = getWorldScale(obj, objects);                          // producto de escalas
  return { pos, rot, sc };
}

// === Util: llevar una POSE mundial al sistema local de un "parent" (o a root si parent=null) ===
function toLocalOf(
  parent: SvgObject | null,
  world: { pos: {x:number;y:number}; rot: number; sc: {x:number;y:number} },
  objects: Record<string, SvgObject>
) {
  if (!parent) {
    // sin padre → local == mundo
    return {
      x: world.pos.x,
      y: world.pos.y,
      rotation: world.rot,
      scaleX: world.sc.x,
      scaleY: world.sc.y,
    };
  }

  // posición: mundo → local del parent
  const pLocal = worldToLocal(parent, world.pos, objects);

  // rotación: resta la rotación mundial del parent
  const parentWorldRot = getWorldRotation(parent, objects);
  const rotation = world.rot - parentWorldRot;

  // escala: divide por la escala mundial del parent (componente a componente)
  const parentWorldScale = getWorldScale(parent, objects);
  const safe = (v: number) => (Math.abs(v) < 1e-9 ? (v < 0 ? -1e-9 : 1e-9) : v);
  const scaleX = world.sc.x / safe(parentWorldScale.x);
  const scaleY = world.sc.y / safe(parentWorldScale.y);

  return { x: pLocal.x, y: pLocal.y, rotation, scaleX, scaleY };
}

// === Reparentizar un objeto preservando su pose mundial ===
export function reparentPreservingWorld(
  objId: string,
  newParentId: string | null | undefined,
  objects: Record<string, SvgObject>
): void {
  const obj = objects[objId];
  if (!obj) return;

  const oldParentId = obj.parentId;

  // 1) Lee la pose mundial actual del objeto
  const world = getWorldTransform(obj, objects);

  // 2) Define el nuevo padre (null => root / canvas)
  const newParent = newParentId ? objects[newParentId] : null;

  // 3) Convierte la pose mundial a coordenadas locales del nuevo padre
  const local = toLocalOf(newParent, world, objects);

  // 4) Aplica la nueva pose local y cambia el parentId
  obj.x = local.x;
  obj.y = local.y;
  obj.rotation = local.rotation;
  obj.scaleX = local.scaleX;
  obj.scaleY = local.scaleY;
  obj.parentId = newParentId || undefined;

  // 5) Limpia la referencia en el padre antiguo
  if (oldParentId) {
    const oldParent = objects[oldParentId] as GroupObject;
    if (oldParent && oldParent.children) {
        oldParent.children = oldParent.children.filter(id => id !== objId);
    }
  }

  // 6) Añade la referencia en el nuevo padre
  if (newParentId) {
      const parentAsGroup = objects[newParentId] as GroupObject;
      if (parentAsGroup.children) {
        if (!parentAsGroup.children.includes(objId)) {
            parentAsGroup.children.push(objId);
        }
      }
  }
}

// helper local
const dedupe = (arr: string[]) => {
  const seen = new Set<string>();
  return arr.filter(id => (seen.has(id) ? false : (seen.add(id), true)));
};

// === Desagrupar: mover hijos al padre del grupo manteniéndolos visualmente ===
export function ungroup(
  groupId: string,
  objects: Record<string, SvgObject>,
  zStackRef: { zStack: string[] }
): { removedGroup: boolean; movedChildren: string[] } {
  const group = objects[groupId] as GroupObject | undefined;
  if (!group || group.type !== 'group') {
    return { removedGroup: false, movedChildren: [] };
  }

  const targetParentId = group.parentId ?? undefined;
  const movedChildrenIds: string[] = [];
  const childrenToMove = [...group.children];

  // 1) Reparent preservando pose mundial
  for (const childId of childrenToMove) {
    const child = objects[childId];
    if (!child) continue;
    reparentPreservingWorld(childId, targetParentId, objects);
    movedChildrenIds.push(childId);
  }

  // 2) Limpiar el grupo
  group.children = [];

  // 3) Reconstruir zStack SIN duplicados:
  //    - eliminar cualquier ocurrencia previa de hijos y del propio grupo
  //    - insertar a los hijos en el lugar del grupo (si existía), respetando su orden previo
  const snapshot = zStackRef.zStack.slice();
  const groupIndexInZ = snapshot.indexOf(groupId);
  const cleaned = snapshot.filter(id => id !== groupId && !childrenToMove.includes(id));
  const childrenInZOrder = childrenToMove
    .slice()
    .sort((a, b) => snapshot.indexOf(a) - snapshot.indexOf(b));

  const insertAt = groupIndexInZ === -1 ? cleaned.length : groupIndexInZ;
  const before = cleaned.slice(0, insertAt);
  const after  = cleaned.slice(insertAt);
  zStackRef.zStack = dedupe([...before, ...childrenInZOrder, ...after]);

  // 4) Eliminar el objeto grupo y su capa de timeline sobrante (si existiese)
  delete objects[groupId];

  return { removedGroup: true, movedChildren: movedChildrenIds };
}
