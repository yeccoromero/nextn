
'use client';

import type { SvgObject } from '@/types/editor';

export function getSvgPointFromClient(svg: SVGSVGElement, clientX: number, clientY: number): DOMPoint {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (ctm) {
    return pt.matrixTransform(ctm.inverse());
  }
  return pt;
}

export function hitTestAtPoint(
  clientX: number,
  clientY: number,
  svgElement: SVGSVGElement,
  objects: SvgObject[],
  orderedObjectIds: string[]
): string | null {
  
  const hitCandidates: string[] = [];
  const elementsFromPoint = document.elementsFromPoint(clientX, clientY);

  for (const element of elementsFromPoint) {
      const id = element.getAttribute('data-id');
      if (id && objects.find(o => o.id === id)) {
          hitCandidates.push(id);
      }
  }

  if (hitCandidates.length === 0) return null;
  if (hitCandidates.length === 1) return hitCandidates[0];

  for (const id of orderedObjectIds) {
      if (hitCandidates.includes(id)) {
          return id;
      }
  }

  return null;
}
