// Hero frames (Vox collage): three still frames that show the look at a glance (the Style Studio's first visible result).
// Three panels of one front page: the title collage, the "three things" equation on kraft, the scribe's handwriting.
// Static on purpose: every piece is on the paper from frame 0; only the camera whips between the panels.
import { panel, shot, loadImages, FRAME } from '../engine.js';
import { plusSign } from '../models.js';

const IMGS = ['gutenberg', 'metaltype', 'inkball', 'screwpress', 'monk', 'manuscript'];
await loadImages(Object.fromEntries(IMGS.map(k => [k, new URL(`../assets/img/${k}.webp`, import.meta.url).href])));

const V = FRAME.h > FRAME.w;                     // 9:16: panels are 9 x 16
const L = (land, vert) => (V ? vert : land);

// ---- hero 1: the title collage ----
const H1 = panel(0, { bg: 'paper', title: 'Title' });
shot({ at: 0, panel: H1, zoom: 1.02, drift: .02 });
H1.cutout('gutenberg', { x: L(-4.4, 0), y: L(-.2, -.7), h: L(6.8, 7.4), at: 0 });
H1.ransom('THE PRESS', { x: L(-.4, 0), y: L(1.9, 6.1), size: L(1.6, 1.5), anchor: L('left', undefined), at: 0 });
H1.headline('Mainz, c.1440', { x: L(-.25, 0), y: L(-.25, 4.25), size: L(1.05, .95), font: 'blackletter', anchor: L('left', undefined), at: 0 });
H1.label('Johannes Gutenberg', { x: L(-.25, 0), y: L(-1.75, -5.3), size: .34, style: 'black', anchor: L('left', undefined), at: 0 });

// ---- hero 2: three things, one press ----
// (white newsprint, not kraft or parchment: the thin red plus signs measured 1.9:1 / 2.7:1 there, under the 2.8:1 floor)
const H2 = panel(1, { bg: 'white', title: 'Three things' });
shot({ at: 2, panel: H2, zoom: 1.02, drift: .02 });
if (!V) {
  H2.headline('three things, one press', { x: 0, y: 3.15, size: .85, font: 'serif', italic: true, at: 0 });
  H2.cutout('metaltype', { x: -4.24, y: -.4, h: 2.4, at: 0 });
  plusSign(H2, { x: -2.58, y: -.3, at: 0 });
  H2.cutout('inkball', { x: -.65, y: -.3, h: 2.6, rot: -3, at: 0 });
  plusSign(H2, { x: 1.3, y: -.3, at: 0 });
  H2.cutout('screwpress', { x: 3.6, y: .5, h: 4.2, at: 0 });
  H2.label('metal type', { x: -4.24, y: -2.5, size: .3, style: 'black', at: 0 });
  H2.label('oil-based ink', { x: -.65, y: -2.5, size: .3, style: 'black', at: 0 });
  H2.label('screw press', { x: 3.6, y: -2.5, size: .3, style: 'black', at: 0 });
} else {
  // a column: type, ink, press, each named on its right
  H2.cutout('metaltype', { x: -1.0, y: 5.2, h: 2.4, at: 0 });
  plusSign(H2, { x: -1.0, y: 3.25, at: 0 });
  H2.cutout('inkball', { x: -1.0, y: 1.3, h: 2.6, rot: -3, at: 0 });
  plusSign(H2, { x: -1.0, y: -.75, at: 0 });
  H2.cutout('screwpress', { x: -1.0, y: -3.7, h: 4.2, at: 0 });
  H2.label('metal type', { x: 1.0, y: 5.2, size: .3, style: 'black', anchor: 'left', at: 0 });
  H2.label('oil-based ink', { x: 1.0, y: 1.3, size: .3, style: 'black', anchor: 'left', at: 0 });
  H2.label('screw press', { x: 1.0, y: -3.7, size: .3, style: 'black', anchor: 'left', at: 0 });
}

// ---- hero 3: every book copied by hand ----
const H3 = panel(2, { bg: 'paper2', title: 'By hand' });
shot({ at: 4, panel: H3, zoom: 1.02, drift: .02 });
H3.cutout('monk', { x: L(-4.8, -1.2), y: L(-.3, -2.3), h: L(6.2, 6.6), at: 0 });
const hand = H3.script('copied by hand', { x: L(2.4, 0), y: L(.9, 4.7), size: L(1.1, .95), at: 0, dur: .8 });
H3.mark({ type: 'circle', around: hand, word: 'hand', at: 0, dur: .45 });
H3.label('one page at a time', { x: L(1.6, 0), y: L(-1.45, 2.85), size: .34, at: 0 });
H3.cutout('manuscript', { x: L(5.9, 2.85), y: L(-2.7, -4.3), h: L(2.8, 3.0), rot: 4, at: 0 });
