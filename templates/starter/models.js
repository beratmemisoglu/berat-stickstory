// Starter models: the style's own composite elements live here, each made with registerElement so it is tagged (kind,
// role) for the checks and shows up in EL. Build them from the engine's elements, prove each ALONE with kitShot
// (lib/kit.js) on light and dark, and only then use it in scenes. Two examples, one per dimension:
import { registerElement, in2d, in3d, group, circle, text, box, C, textOn, DIM } from './engine.js';

// badge(p, 'A', { r, fill, x, y }): a round marker with a letter or number (2D; on a 3D shot it goes on the HUD)
export const badge = registerElement('badge', (p, { r = 60, fill = C.accent, x = 0, y = 0, label = '' } = {}) => {
  const g = group(in2d(p, 'badge'), x, y);
  circle(g, r, fill);
  if (label) text(g, String(label), { size: Math.round(r * .9), color: textOn(fill) });
  g.userData.bg = fill;                                            // the plate its text reads against (contrast check)
  return g;
});

// table(p, { w, d, h, color, x, z }): a top on four legs, standing on y (3D only). The legs carry the top, so nothing floats.
export const table = DIM === '3d' ? registerElement('table', (p, { w = 1.4, d = .8, h = .75, top = .05, color = C.surface, legs = C.muted, x = 0, y = 0, z = 0 } = {}) => {
  const g = group(in3d(p, 'table'), x, y, z), lx = w / 2 - .08, lz = d / 2 - .08;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, .06, h - top, .06, legs, { x: sx * lx, z: sz * lz });
  box(g, w, top, d, color, { y: h - top });
  return g;
}) : null;
