// VII. The copy: Carlson's first xerographic copy (1938), the laser printer (Xerox PARC, 1969)
import { panel, shot, C } from '../engine.js';

export const P7 = panel(5, { bg: 'white', title: 'The copy' });

// ---- 13: the photocopier ----
// frame: x -1.35 +- 6.7, y .4 +- 3.75
shot({ at: 41.66 - .15, panel: P7, x: -1.35, y: .4, zoom: 1.2 });
P7.cutout('photocopier', { x: -5.2, y: -1.2, h: 4.2, at: 41.66 - .6 });
P7.stamp('1938', { x: -6.5, y: 2.3, size: .66, at: 41.98 });
P7.headline('10-22-38 ASTORIA.', { x: -3.9, y: 3.3, size: .55, font: 'typewriter', anim: 'type', at: 41.98 + .25, dur: .7, anchor: 'left', bg: '#fbf9f2' });
P7.label("Chester Carlson's first xerographic copy", { x: -3.9, y: 2.55, size: .24, style: 'black', anchor: 'left', at: 41.98 + .9 });

// ---- 14: the laser printer, a press on every desk ----
shot({ at: 43.14 - .4, panel: P7, zoom: 1 });
P7.cutout('laserprinter', { x: 4.3, y: -.5, h: 3.2, at: 43.14 });
P7.stamp('1969', { x: 6.6, y: 1.8, size: .66, at: 43.14 + .3 });
P7.label('Laser printer · Xerox PARC', { x: 4.3, y: -2.5, size: .27, style: 'black', at: 43.46 + .2 });
P7.script('a press on every desk', { x: .4, y: -3.45, size: .8, at: 44.24, dur: 1.0, color: C.red });
