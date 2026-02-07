export function roundedRectD(
  w: number,
  h: number,
  r: { tl: number; tr: number; br: number; bl: number }
) {
  const x = -w / 2, y = -h / 2;
  const maxR = Math.min(Math.abs(w), Math.abs(h)) / 2;
  const c = {
    tl: Math.max(0, Math.min(r.tl, maxR)),
    tr: Math.max(0, Math.min(r.tr, maxR)),
    br: Math.max(0, Math.min(r.br, maxR)),
    bl: Math.max(0, Math.min(r.bl, maxR)),
  };
  return [
    `M ${x + c.tl} ${y}`,
    `H ${x + w - c.tr}`,
    `A ${c.tr} ${c.tr} 0 0 1 ${x + w} ${y + c.tr}`,
    `V ${y + h - c.br}`,
    `A ${c.br} ${c.br} 0 0 1 ${x + w - c.br} ${y + h}`,
    `H ${x + c.bl}`,
    `A ${c.bl} ${c.bl} 0 0 1 ${x} ${y + h - c.bl}`,
    `V ${y + c.tl}`,
    `A ${c.tl} ${c.tl} 0 0 1 ${x + c.tl} ${y}`,
    'Z',
  ].join(' ');
}
