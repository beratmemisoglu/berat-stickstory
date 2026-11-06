// 2. Movable type and the press
import { panel, shot } from '../engine.js';

export const P2 = panel(1, { bg: 'paper2', title: 'Movable type' });

// ---- 3: the type ----
shot({ at: 6.5, panel: P2, x: -2.2, y: .2, zoom: 1.3 });
P2.cutout('type', { x: -3.6, y: .9, h: 3.4, at: 6.0 });
P2.headline('Movable type', { x: -3.6, y: -2.2, size: .9, at: 7.4 });

// ---- 4: the press ----
shot({ at: 9.4, panel: P2, zoom: 1 });
P2.cutout('press', { x: 4.2, y: -.2, h: 6.2, at: 9.6 });
P2.label('Mainz, around 1450', { x: 4.2, y: -3.75, size: .34, style: 'strip', at: 10.6 });
