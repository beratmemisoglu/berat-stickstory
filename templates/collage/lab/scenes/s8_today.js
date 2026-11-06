// VIII. Today: printing in three dimensions (Chuck Hull filed the stereolithography patent in 1984)
import { panel, shot, finale, C } from '../engine.js';

export const P8 = panel(4, { bg: 'paper', title: 'Today' });

// ---- 15: today, three dimensions ----
// frame: x -.7 +- 7.3, y +- 4.1
shot({ at: 45.78 - .15, panel: P8, x: -.7, zoom: 1.1 });
P8.stamp('Today', { x: -5.8, y: 3.3, size: .62, color: '#1f55a3', at: 45.78 + .1 });
P8.cutout('printer3d', { x: 1.2, y: -.3, h: 5.6, at: 45.78 - .6 });
// a misregistered print: the red plate sits under the black one on purpose
const red3d = P8.headline('3D', { x: -3.85, y: -.45, size: 3.2, font: 'heavy', color: C.red, anim: 'print', at: 46.92, dur: .45, layer: 0, sfx: false });
P8.headline('3D', { x: -4.05, y: -.25, size: 3.2, font: 'heavy', anim: 'print', at: 46.92 + .06, dur: .45, over: [red3d] });
P8.stamp('1984', { x: -1.5, y: 3.0, size: .66, at: 46.92 + .5 });
P8.label('Chuck Hull files the stereolithography patent', { x: 1.2, y: -3.8, size: .26, style: 'strip', at: 46.92 + .8 });

// ---- 16: homes, engine parts, living tissue ----
shot({ at: 47.78 - .4, panel: P8, zoom: 1 });
P8.label('Homes', { x: 6.0, y: 1.9, size: .36, style: 'black', at: 47.78 });
P8.label('Engine parts', { x: 6.0, y: .2, size: .36, style: 'black', at: 48.46 });
P8.label('Living tissue', { x: 6.0, y: -1.5, size: .36, style: 'black', at: 49.74 });

// ---- 17: the front page ----
finale({ at: 50.94 - .1, title: 'Impressions', kicker: 'A short history of the printing press · 868 – today', edition: 'FIRST EDITION', issue: 'VOL. I · No. 1',
  tag: 'The End', footer: 'From clay to code, the press never stopped.', loopDur: 1.8 });
