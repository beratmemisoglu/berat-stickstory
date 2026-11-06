// IV. The spread: 20 million books by 1500, and ideas nobody could stop
import { panel, shot } from '../engine.js';

export const P4 = panel(3, { bg: 'europe', title: 'The spread' });
// map pixel (1344 x 752 image) -> panel units
const M = (px, py) => [(px / 1344 - .5) * 16, (.5 - py / 752) * 9];

// ---- 7: by 1500 ----
shot({ at: 26.02 - .2, panel: P4, zoom: 1, drift: 0 });
// on a busy map every word sits on its own paper
P4.stamp('By 1500', { x: -3.6, y: 3.45, size: .7, at: 26.18, backing: true });
const mainz = M(560, 342);
P4.dots([mainz], { at: 26.18 + .3, r: .2, layer: 1 });
P4.label('Mainz', { x: mainz[0], y: mainz[1] + .6, size: .26, style: 'strip', at: 26.18 + .45, out: 'fade', outAt: 27.18 - .1, outDur: .3 });
const cities = [[535, 315], [545, 380], [540, 405], [620, 350], [610, 385], [500, 310], [480, 305], [530, 285], [440, 365], [480, 430], [570, 460], [640, 470],
  [620, 505], [660, 560], [700, 585], [650, 305], [680, 340], [720, 400], [780, 420], [800, 330], [620, 265], [400, 300], [385, 295], [400, 520], [330, 560], [290, 550], [230, 590], [140, 570]];
P4.dots(cities.map(([x, y]) => M(x, y)), { at: 27.18, stagger: .05, r: .12, layer: 1 });
P4.label('presses in ~270 cities', { x: 5.2, y: 3.75, size: .28, style: 'strip', at: 27.18 + .6 });
P4.cutout('books', { x: 1.4, y: -2.6, h: 2.9, at: 28.82 });
P4.counter({ from: 0, to: 20000000, suffixEnd: '+', x: 5.2, y: -2.85, size: .8, at: 28.06 - .3, countDur: 1.3 });
P4.label('books printed in Europe', { x: 5.2, y: -3.95, size: .27, style: 'black', at: 28.82 });

// ---- 8: ideas nobody could stop ----
P4.scatter('leaflet', { n: 10, at: 29.76, dur: 1.9, spread: .9, h: 1.1, from: [-9.5, 1], to: [9.5, -.5] });
P4.stamp('Banned', { x: -5.6, y: .35, size: 1.0, at: 31.76, backing: true });
