// 4. Faster every century
import { panel, shot } from '../engine.js';

export const P4 = panel(3, { bg: 'paper2', title: 'Faster' });

// ---- 6: pages pile up ----
shot({ at: 19.5, panel: P4, x: 1, y: .3, zoom: 1.25 });
P4.cutout('pages', { x: 3.6, y: .1, h: 4.4, at: 19.0 });
const h = P4.headline('Faster every century', { x: -.8, y: 3.0, size: .85, at: 20.3 });

// ---- 7: the printer ----
shot({ at: 22.2, panel: P4, zoom: 1 });
P4.cutout('printer', { x: -3.4, y: -1.3, h: 3.8, at: 22.5 });
P4.mark({ type: 'circle', around: h, word: 'Faster', at: 23.6, dur: .5 });
P4.label('pages per minute', { x: 3.6, y: -2.6, size: .34, style: 'strip', at: 24.0 });
