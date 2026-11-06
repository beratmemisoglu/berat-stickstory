// VI. Mass print: rotary presses and linotype, newspapers by the million
import { panel, shot, C } from '../engine.js';

export const P6 = panel(6, { bg: 'kraft', title: 'Mass print' });

// ---- 11: rotary presses and linotype ----
// frame: x -1 +- 7.0, y -.6 +- 3.9
shot({ at: 37.64 - .15, panel: P6, x: -1, y: -.6, zoom: 1.15 });
P6.cutout('rotary', { x: .3, y: -1.2, h: 3.9, at: 37.64 - .6 });
P6.stamp('1843', { x: -1.4, y: 1.35, size: .66, at: 37.82, backing: true });
P6.label('Rotary press · millions of pages a day', { x: .3, y: -3.45, size: .28, style: 'black', at: 37.82 + .3 });
P6.cutout('linotype', { x: -5.7, y: -1.1, h: 4.5, at: 38.46 });
P6.stamp('1886', { x: -6.1, y: 1.85, size: .66, at: 38.46 + .3, backing: true });
P6.label('Linotype · a line of hot metal at once', { x: -7.3, y: -4.05, size: .22, style: 'strip', anchor: 'left', at: 38.46 + .5 });

// ---- 12: by the million ----
shot({ at: 39.64 - .3, panel: P6, zoom: 1 });
P6.cutout('newsboy', { x: 6.4, y: -1.0, h: 5.2, at: 39.64, in: 'slide-right' });
P6.headline('BY THE MILLION', { x: .2, y: 3.2, size: 1.35, font: 'anton', color: C.ink, anim: 'print', at: 40.52 - .1, dur: .45, spacing: .02 });
P6.stamp('Extra!', { x: 4.9, y: 2.05, size: .62, at: 40.52 + .35, backing: true });
