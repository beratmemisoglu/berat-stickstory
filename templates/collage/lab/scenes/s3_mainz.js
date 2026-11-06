// III. Mainz: Gutenberg puts it all together
import { panel, shot } from '../engine.js';
import { plusSign } from '../models.js';

export const P3 = panel(2, { bg: 'paper', title: 'Mainz' });

// ---- 5: Mainz, c.1440 ----
// frame: x -.9 +- 7.1, y .1 +- 4.0 (stays inside the panel's left edge)
shot({ at: 16.52 - .2, panel: P3, x: -.85, y: .1, zoom: 1.12 });
P3.cutout('gutenberg', { x: -5.1, y: 0, h: 5.8, at: 16.52 - .7 });
P3.headline('Mainz, c.1440', { x: 1.8, y: 3.15, size: 1.0, font: 'blackletter', anim: 'type', at: 17.42 - .1, dur: .6 });
P3.label('Johannes Gutenberg', { x: -5.1, y: -3.4, size: .32, style: 'black', at: 18.46 });

// ---- 6: metal type + oil-based ink + a screw press ----
shot({ at: 20.5 - .4, panel: P3, zoom: 1, drift: 0 });
P3.cutout('metaltype', { x: -.9, y: .3, h: 2.1, at: 20.5 });
P3.label('metal type', { x: -.9, y: -1.15, size: .3, style: 'plain', at: 20.5 + .25 });
plusSign(P3, { x: .72, y: .35, at: 21.28 - .15 });
P3.cutout('inkball', { x: 2.6, y: .35, h: 2.3, rot: -3, at: 21.28 });
P3.label('oil-based ink', { x: 2.6, y: -1.15, size: .3, style: 'plain', at: 21.28 + .25 });
plusSign(P3, { x: 4.35, y: .35, at: 22.6 - .15 });
P3.cutout('screwpress', { x: 6.2, y: -.1, h: 3.8, at: 22.6 });
P3.label('screw press', { x: 6.2, y: -2.4, size: .3, style: 'plain', at: 22.6 + .25 });
