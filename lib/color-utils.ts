
// src/lib/color-utils.ts

export type RGBA = { r: number; g: number; b: number; a: number };

// Cache para evitar parsear el mismo color múltiples veces
const cache = new Map<string, RGBA>();

/**
 * Convierte un color CSS a un objeto RGBA.
 * Soporta #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(), rgba().
 */
export function cssToRgbaObj(css: string): RGBA {
  if (cache.has(css)) return cache.get(css)!;

  if (css === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  let m: RegExpMatchArray | null;

  // #rgb(a)
  m = css.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i);
  if (m) {
    const r = parseInt(m[1] + m[1], 16);
    const g = parseInt(m[2] + m[2], 16);
    const b = parseInt(m[3] + m[3], 16);
    const a = m[4] ? parseInt(m[4] + m[4], 16) / 255 : 1;
    const res = { r, g, b, a };
    cache.set(css, res);
    return res;
  }

  // #rrggbb(aa)
  m = css.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i);
  if (m) {
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    const a = m[4] ? parseInt(m[4], 16) / 255 : 1;
    const res = { r, g, b, a };
    cache.set(css, res);
    return res;
  }

  // rgb(a)
  m = css.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,?\s*([\d.]+)?\)/i);
  if (m) {
    const r = parseInt(m[1], 10);
    const g = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);
    const a = m[4] ? parseFloat(m[4]) : 1;
    const res = { r, g, b, a };
    cache.set(css, res);
    return res;
  }

  return { r: 0, g: 0, b: 0, a: 1 }; // Fallback a negro
}

/** Convierte un componente de color sRGB [0,255] a espacio lineal [0,1]. */
export function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Convierte un componente de color lineal [0,1] a sRGB [0,255]. */
export function linearToSrgb(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, c * 255));
}

export function rgbaToCss(rgba: RGBA): string {
    if (rgba.a < 1) {
        return `rgba(${Math.round(rgba.r)}, ${Math.round(rgba.g)}, ${Math.round(rgba.b)}, ${rgba.a.toFixed(3)})`;
    }
    return `#${Math.round(rgba.r).toString(16).padStart(2, '0')}${Math.round(rgba.g).toString(16).padStart(2, '0')}${Math.round(rgba.b).toString(16).padStart(2, '0')}`;
}

export function interpColor(colorA: string, colorB: string, t: number): string {
    const a = cssToRgbaObj(colorA);
    const b = cssToRgbaObj(colorB);

    const al = { r: srgbToLinear(a.r), g: srgbToLinear(a.g), b: srgbToLinear(a.b) };
    const bl = { r: srgbToLinear(b.r), g: srgbToLinear(b.g), b: srgbToLinear(b.b) };

    const r = linearToSrgb(al.r + (bl.r - al.r) * t);
    const g = linearToSrgb(al.g + (bl.g - al.g) * t);
    const blue = linearToSrgb(al.b + (bl.b - al.b) * t);
    const alpha = a.a + (b.a - a.a) * t;

    return rgbaToCss({ r, g, b: blue, a: alpha });
}
