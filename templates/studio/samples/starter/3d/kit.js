// Starter kit (3D): every element alone, on light and on dark, one second each (the Kit stage). Solids are framed by
// their size; HUD elements (label, card, counter, badge) are centred on the frame. An element joins a scene only after its
// two frames here look right and check_layout says Clean.
import { C, box, sphere, cyl, label, card, counter } from '../engine.js';
import { kitGallery } from '../lib/kit.js';
import { badge, table } from '../models.js';

kitGallery([
  { name: 'box', build: () => box(null, 1, 1, 1, C.accent, { ry: .5 }) },
  { name: 'sphere', build: () => sphere(null, .5, C.accent2) },
  { name: 'cyl', build: () => cyl(null, .4, 1.2, C.good) },
  { name: 'table', build: () => table(null, { w: 1.6, d: .9 }) },
  { name: 'label', build: () => label(null, 'A label', { size: 64 }) },
  { name: 'card', build: () => card(null, { title: 'A card', body: 'A title and a body that wraps inside it.' }) },
  { name: 'counter', build: () => counter(null, { from: 0, to: 2048, at: 0, dur: .01, size: 160, color: C.accent }) },
  { name: 'badge', build: () => badge(null, { r: 120, label: 7 }) },
], { t0: 0, each: 1 });
