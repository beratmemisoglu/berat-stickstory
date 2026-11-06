// Sample (Vox collage): a 20 s explainer on the narration (how print spread, 1440-1500), on ONE front page.
// Three panels, the camera opens close on each hero cut-out and opens up as the pieces land on their words; the finale
// pulls back to the whole front page and pushes back into the first frame (the video loops).
// The cut-outs are the shipped lab engravings (assets/img/*.webp); a project's own come from make_image (project.json "images").
import { panel, shot, finale, cue, loadImages, FRAME } from '../engine.js';
import { plusSign } from '../models.js';

const IMGS = ['monk', 'quill', 'manuscript', 'gutenberg', 'metaltype', 'inkball', 'screwpress', 'europe', 'books'];
await loadImages(Object.fromEntries(IMGS.map(k => [k, new URL(`../assets/img/${k}.webp`, import.meta.url).href])));

const V = FRAME.h > FRAME.w;                     // 9:16: panels are 9 x 16
const L = (land, vert) => (V ? vert : land);

// ======== I. By hand ========
export const P1 = panel(0, { bg: 'paper', title: 'By hand' });

// ---- the scribe, close ----
// frame (16:9): x -1.85 +- 6.15, y +- 3.46 (drift: +- 5.97, +- 3.36) · (9:16): x +- 3.46, y -.9 +- 6.15
shot({ at: 0, panel: P1, x: L(-1.85, 0), y: L(0, -.9), zoom: 1.3, drift: .03 });
P1.cutout('monk', { x: L(-4.6, -.9), y: L(-.25, -3.6), h: L(5.5, 5.6), at: 0 });
P1.ransom('EVERY BOOK', { x: L(-1.5, 0), y: L(2.1, 3.9), size: L(1.0, 1.05), anchor: L('left', undefined), at: cue('every', 1.06), per: .06 });

// ---- copied by hand ----
// frame: the whole panel (zoom 1.02 keeps the panel's torn edge out of the frame)
shot({ at: cue('copied', 2.2) - .3, panel: P1, zoom: 1.02, drift: .03 });
const hand = P1.script('copied by hand', { x: L(-1.5, 0), y: L(0, 1.6), size: L(1.05, .9), anchor: L('left', undefined), at: cue('copied', 2.2), dur: .75, pen: 'quill', penH: L(1.5, 1.3) });
P1.cutout('manuscript', { x: L(5.6, 2.85), y: L(-2.7, -5.0), h: L(2.8, 2.6), rot: 4, at: cue('hand', 2.96), in: 'slide-right' });
// the circle waits for the quill to lift away: nothing crosses the pen
P1.mark({ type: 'circle', around: hand, word: 'hand', at: hand.at + hand.dur + .5, dur: .4 });

// ======== II. Mainz ========
export const P2 = panel(1, { bg: 'paper2', title: 'Mainz' });

// ---- Gutenberg, close ----
// frame (16:9): x -.85 +- 7.14, y .1 +- 4.02 · (9:16): x +- 3.75, y 1.33 +- 6.67 (both stay inside the panel, drift included)
shot({ at: cue('Johannes', 4.42) - .12, panel: P2, x: L(-.85, 0), y: L(.1, 1.33), zoom: L(1.12, 1.2) });
P2.cutout('gutenberg', { x: L(-5.1, 0), y: L(0, 1.5), h: L(5.8, 5.4), at: 3.6 });
P2.headline('Mainz, c.1440', { x: L(1.8, 0), y: L(2.95, 5.5), size: L(1.0, .8), font: 'blackletter', anim: 'type', at: cue('Johannes', 4.42) - .1, dur: .6 });
P2.label('Johannes Gutenberg', { x: L(1.8, 0), y: L(1.55, -2.0), size: L(.32, .3), style: 'black', at: cue('Gutenberg', 4.8) });

// ---- metal type + oil-based ink + a screw press ----
shot({ at: cue('together', 6.32) + .3, panel: P2, zoom: 1.02, drift: 0 });
const row = L({ y: -1.2, lab: -3.3, mt: [-.9, 2.0], ink: [2.6, 2.2], pr: [6.0, -.8, 3.6], p1: .73, p2: 4.13, ls: .3 },
              { y: -4.6, lab: -6.2, mt: [-3.15, 1.8], ink: [-.55, 1.9], pr: [2.55, -4.1, 2.8], p1: -1.95, p2: .9, ls: .26 });
const tMetal = cue('metal', 7.02), tInk = cue('oil-based', 7.78), tPress = cue('screw', 9.3);
P2.cutout('metaltype', { x: row.mt[0], y: row.y, h: row.mt[1], at: tMetal });
P2.label('metal type', { x: row.mt[0], y: row.lab, size: row.ls, style: 'plain', at: tMetal + .25 });
plusSign(P2, { x: row.p1, y: row.y, at: tInk - .15 });
P2.cutout('inkball', { x: row.ink[0], y: row.y + .05, h: row.ink[1], rot: -3, at: tInk });
P2.label('oil-based ink', { x: row.ink[0], y: row.lab, size: row.ls, style: 'plain', at: tInk + .25 });
plusSign(P2, { x: row.p2, y: row.y, at: tPress - .15 });
P2.cutout('screwpress', { x: row.pr[0], y: row.pr[1], h: row.pr[2], at: tPress });
P2.label('screw press', { x: row.pr[0], y: row.lab, size: row.ls, style: 'plain', at: tPress + .25 });

// ======== III. The spread ========
// 16:9: the map fills the panel (1344 px wide on a 1920 px frame: 1.4x, inside the 1.5x limit); 9:16: the map is a print on paper
export const P3 = panel(2, { bg: L('europe', 'paper'), title: 'The spread' });
const map = L({ cx: 0, cy: 0, w: 16 }, { cx: 0, cy: 3.2, w: 8 });
if (V) P3.photo('europe', { x: map.cx, y: map.cy, w: map.w, at: 9.9 });
const M = (px, py) => [map.cx + (px / 1344 - .5) * map.w, map.cy + (.5 - py / 752) * map.w * 752 / 1344];

// ---- by 1500: presses across Europe, twenty million books ----
// (zoom 1.02: the finale's pull-back starts as an erf ramp, and its first hundredths already lean towards the whole page)
shot({ at: cue('By', 10.38) + .02, panel: P3, zoom: 1.02, drift: L(0, .03) });
const t1500 = cue('1500', 10.76);
P3.stamp('By 1500', { x: L(-3.6, 0), y: L(3.45, 6.6), size: .7, rot: 0, box: false, backing: !V, at: t1500 });
const cities = [[560, 342], [535, 315], [545, 380], [540, 405], [620, 350], [610, 385], [500, 310], [480, 305], [530, 285], [440, 365], [480, 430], [570, 460], [640, 470],
  [620, 505], [660, 560], [650, 305], [680, 340], [720, 400], [780, 420], [800, 330], [620, 265], [400, 300], [385, 295], [400, 520], [330, 560], [290, 550], [230, 590], [140, 570]];
P3.dots(cities.map(([x, y]) => M(x, y)), { at: cue('presses', 11.14), stagger: .045, r: L(.12, .085), layer: 1 });
P3.cutout('books', { x: L(1.4, 0), y: L(-2.6, -5.0), h: L(2.9, 3.8), at: cue('printed', 12.66) });
P3.counter({ from: 0, to: 20000000, suffixEnd: '+', x: L(5.2, 0), y: L(-2.85, -.9), size: .8, at: cue('twenty', 13.04) - .3, countDur: 1.3 });
P3.label('books printed in Europe', { x: L(5.2, 0), y: L(-3.95, -2.25), size: L(.27, .3), style: 'black', at: cue('books', 13.8) });

// ---- the front page ----
finale({ at: cue('Ideas', 14.5) + .1, title: 'The Daily Impression', kicker: 'How print spread across Europe · 1440 – 1500', loopDur: 1.6 });
