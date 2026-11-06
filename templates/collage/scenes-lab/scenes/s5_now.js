// 5. Today: everyone prints
import { panel, shot } from '../engine.js';

export const P5 = panel(4, { bg: 'paper', title: 'Today' });

// ---- 8: the phone ----
shot({ at: 26, panel: P5, x: -1.6, zoom: 1.2 });
P5.cutout('phone', { x: -3.4, y: 0, h: 6.2, at: 25.6 });
P5.headline('Now everyone', { x: 3.0, y: 1.3, size: 1.05, at: 26.8 });
P5.headline('is a printer', { x: 3.0, y: -.1, size: 1.05, at: 27.4 });

// ---- 9: hold ----
shot({ at: 29, panel: P5, zoom: 1 });
P5.label('the press, in your pocket', { x: 3.0, y: -1.5, size: .36, at: 29.4 });
