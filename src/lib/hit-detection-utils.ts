
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

    // Check for Pixel Perfect Hit Test
    // If the element (or its child?) is a canvas with data-pixel-test
    if (element instanceof HTMLCanvasElement && element.getAttribute('data-pixel-test') === 'true') {
      const gl = element.getContext('webgl2');
      if (gl) {
        const rect = element.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Canvas resolution vs Client resolution
        // element.width is internal buffer size
        // rect.width is layout size
        const scaleX = element.width / rect.width;
        const scaleY = element.height / rect.height;

        const pixelX = Math.floor(x * scaleX);
        // WebGL y is usually bottom-up, but here we configured it? 
        // readPixels is bottom-up.
        // Our shader flips Y: v_uv.y = 1.0 - v_uv.y;
        // But DOM clientY is top-down.
        // If we click at top (y=0), that's canvas row 0?
        // WebGL texture 0,0 is usually bottom-left.
        // Let's assume standard DOM-to-GL mapping for now: 
        // GL Y = height - DOM Y - 1
        const pixelY = Math.floor((rect.height - y) * scaleY);
        // Wait, if CSS is top-down, and GL is bottom-up...

        const pixel = new Uint8Array(4);
        gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

        // Alpha check (threshold 10/255)
        if (pixel[3] < 10) {
          continue; // Transparent -> Pass through
        }
      }
    } else if (element.tagName === 'foreignObject') {
      // If we hit the foreignObject wrapper, we might need to check its canvas child?
      // Usually elementsFromPoint returns the deepest element, which IS the canvas.
      // But if pointer-events is on foreignObject?
      // Let's check if there is a canvas inside?
      const canvas = element.querySelector('canvas[data-pixel-test]');
      if (canvas) {
        // Same logic...
        const gl = (canvas as HTMLCanvasElement).getContext('webgl2');
        if (gl) {
          const rect = canvas.getBoundingClientRect();
          const x = clientX - rect.left;
          const y = clientY - rect.top;
          const scaleX = (canvas as HTMLCanvasElement).width / rect.width;
          const scaleY = (canvas as HTMLCanvasElement).height / rect.height;
          const pixelX = Math.floor(x * scaleX);
          const pixelY = Math.floor((rect.height - y) * scaleY);

          const pixel = new Uint8Array(4);
          gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          if (pixel[3] < 10) continue;
        }
      }
    }


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
