// Kit (Vox collage): the style's pieces, one per panel, each on the paper it usually sits on. The camera whips from
// panel to panel across one front page; every piece lands just as the camera arrives and is settled mid-shot.
import { panel, shot, loadImages, FRAME } from '../engine.js';
import { gauge } from '../models.js';

const IMGS = ['monk', 'quill', 'europe'];
await loadImages(Object.fromEntries(IMGS.map(k => [k, new URL(`../assets/img/${k}.webp`, import.meta.url).href])));

const V = FRAME.h > FRAME.w;                     // 9:16: panels are 9 x 16
const L = (land, vert) => (V ? vert : land);

// ---- cut-out: an engraving with a hand-cut sticker border and a soft shadow ----
const K1 = panel(0, { bg: 'paper', title: 'Cut-out' });
shot({ at: 0, panel: K1, zoom: 1.02, drift: .02 });
K1.cutout('monk', { x: 0, y: -.1, h: L(6.6, 7.2), at: 0 });

// ---- ransom letters, dropped one by one ----
const K2 = panel(1, { bg: 'paper2', title: 'Ransom' });
shot({ at: 2, panel: K2, zoom: 1.02, drift: .02 });
K2.ransom('EXTRA', { x: 0, y: 0, size: L(2.2, 1.6), at: 2 - .2, per: .06 });

// ---- headlines: blackletter typed, poster type printed ----
const K3 = panel(2, { bg: 'parchment', title: 'Headlines' });
shot({ at: 4, panel: K3, zoom: 1.02, drift: .02 });
K3.headline('Mainz, c.1440', { x: 0, y: L(1.2, 1.6), size: L(1.5, .95), font: 'blackletter', anim: 'type', at: 4 - .3, dur: .55 });
K3.headline('BY THE MILLION', { x: 0, y: L(-1.3, -1.0), size: L(1.3, .82), font: 'anton', anim: 'print', at: 4 + .05, dur: .45, spacing: .02 });

// ---- handwriting: a quill writes, then a marker circle around one word ----
const K4 = panel(3, { bg: 'paper', title: 'Handwriting' });
shot({ at: 6, panel: K4, zoom: 1.02, drift: .02 });
const hand = K4.script('copied by hand', { x: 0, y: L(.2, .3), size: L(1.4, .95), at: 6.25, dur: .8, pen: 'quill', penH: L(1.9, 1.4) });
K4.mark({ type: 'circle', around: hand, word: 'hand', at: hand.at + hand.dur + .5, dur: .4 });

// ---- labels: typed strip, black tape, plain type (on kraft) ----
const K5 = panel(4, { bg: 'kraft', title: 'Labels' });
shot({ at: 10, panel: K5, zoom: 1.02, drift: .02 });
K5.label('MAINZ, 1455.', { x: 0, y: L(1.5, 1.6), size: L(.5, .4), style: 'typewriter', at: 10 - .3, dur: .6 });
K5.label('Johannes Gutenberg', { x: 0, y: 0, size: L(.5, .4), style: 'black', at: 10 - .1 });
K5.label('one page at a time', { x: 0, y: L(-1.5, -1.6), size: L(.5, .4), style: 'strip', at: 10 + .05 });

// ---- an inked date: unboxed, level ----
const K6 = panel(5, { bg: 'paper', title: 'Date' });
shot({ at: 12, panel: K6, zoom: 1.02, drift: .02 });
K6.stamp('1455', { x: 0, y: 0, size: L(2.4, 1.8), rot: 0, box: false, at: 12 - .1 });

// ---- a counter on a torn card ----
const K7 = panel(6, { bg: 'white', title: 'Counter' });
shot({ at: 14, panel: K7, zoom: 1.02, drift: .02 });
K7.counter({ from: 0, to: 20000000, suffixEnd: '+', x: 0, y: 0, size: L(1.6, .95), at: 14 - .5, countDur: 1.2 });

// ---- a newspaper page ----
const K8 = panel(7, { bg: 'paper2', title: 'Newspaper' });
shot({ at: 16, panel: K8, zoom: 1.02, drift: .02 });
K8.newspaper({ x: 0, y: 0, w: L(10.5, 7.8), name: 'The Daily Impression', date: 'FIRST EDITION', headline: 'EXTRA!', sub: 'Twenty million books by 1500', at: 16 - .3 });

// ---- pins on a map ----
const K9 = panel(8, { bg: L('europe', 'paper'), title: 'Map pins' });
shot({ at: 18, panel: K9, zoom: 1.02, drift: .02 });
const map = L({ w: 16 }, { w: 8.2 });
if (V) K9.photo('europe', { x: 0, y: 0, w: map.w, at: 0 });
const M = (px, py) => [(px / 1344 - .5) * map.w, (.5 - py / 752) * map.w * 752 / 1344];
K9.dots([[560, 342], [535, 315], [545, 380], [620, 350], [500, 310], [440, 365], [570, 460], [660, 560], [720, 400], [800, 330], [400, 300], [330, 560], [230, 590]].map(([x, y]) => M(x, y)),
  { at: 18 - .3, stagger: .05, r: L(.16, .1), layer: 1 });

// ---- a dial (models.js gauge) ----
const K10 = panel(9, { bg: 'paper', title: 'Gauge' });
shot({ at: 20, panel: K10, zoom: 1.02, drift: .02 });
gauge(K10, { x: 0, y: 0, size: L(4.6, 4.4), max: 1200, to: 1100, unit: 'sheets / hour', at: 20 - .2, dur: 1.0 });
