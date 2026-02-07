// src/lib/normalizePath.ts
import type { PathObject, BezierPoint } from '@/types/editor';

export function normalizePath(p: PathObject): PathObject {
  if (!p.points || p.points.length === 0) {
    return { ...p, x: p.x || 0, y: p.y || 0, anchorPosition: 'center' };
  }

  // 1. Collect all absolute coordinates from the path's local points
  const allPoints = p.points.flatMap(pt => {
    const points = [{ x: pt.x, y: pt.y }];
    if (pt.handleIn) points.push({ x: pt.handleIn.x, y: pt.handleIn.y });
    if (pt.handleOut) points.push({ x: pt.handleOut.x, y: pt.handleOut.y });
    return points;
  });

  if (allPoints.length === 0) {
    return { ...p, x: p.x || 0, y: p.y || 0, anchorPosition: 'center' };
  }

  const xs = allPoints.map(pt => pt.x);
  const ys = allPoints.map(pt => pt.y);
  
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  const localCenterX = (minX + maxX) / 2;
  const localCenterY = (minY + maxY) / 2;
  
  const newWorldX = p.x + localCenterX;
  const newWorldY = p.y + localCenterY;

  // 2. Recalculate points relative to the new geometric center
  const newPoints = p.points.map((pt): BezierPoint => ({
    ...pt,
    x: pt.x - localCenterX,
    y: pt.y - localCenterY,
    handleIn: pt.handleIn ? { x: pt.handleIn.x - localCenterX, y: pt.handleIn.y - localCenterY } : null,
    handleOut: pt.handleOut ? { x: pt.handleOut.x - localCenterX, y: pt.handleOut.y - localCenterY } : null,
  }));

  return {
    ...p,
    x: newWorldX,
    y: newWorldY,
    points: newPoints,
    anchorPosition: 'center', // Now it's truly centered
  };
}
