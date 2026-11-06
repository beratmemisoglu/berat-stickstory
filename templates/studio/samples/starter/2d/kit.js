// Starter kit (2D): every element alone, on light and on dark, one second each (the Kit stage). An element joins a scene
// only after its two frames here look right and check_layout says Clean.
import { C, rect, rrect, circle, line, arrow, text, label, tag, title, counter, card } from '../engine.js';
import { kitGallery } from '../lib/kit.js';
import { badge } from '../models.js';

kitGallery([
  { name: 'rect', build: () => rect(null, 420, 260, C.accent) },
  { name: 'rrect', build: () => rrect(null, 420, 260, 36, C.accent2) },
  { name: 'circle', build: () => circle(null, 150, C.good) },
  { name: 'line', build: () => line(null, -260, -80, 260, 80, 12, C.accent) },
  { name: 'arrow', build: () => arrow(null, -260, 0, 260, 0, 12, C.accent2) },
  { name: 'text', build: () => text(null, 'Plain text', { size: 96, color: C.accent }) },
  { name: 'label', build: () => label(null, 'A label', { size: 64 }) },
  { name: 'tag', build: () => tag(null, 'a tag', { size: 64 }) },
  { name: 'title', build: () => title(null, 'A title\non two lines', { y: 0, color: C.accent }) },
  { name: 'counter', build: () => counter(null, { from: 0, to: 2048, at: 0, dur: .01, size: 160, color: C.accent }) },
  { name: 'card', build: () => card(null, { title: 'A card', body: 'A title and a body that wraps inside it.' }) },
  { name: 'badge', build: () => badge(null, { r: 120, label: 7 }) },
], { t0: 0, each: 1 });
