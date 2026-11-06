// 1. Before the press: every book copied by hand
import { panel, shot } from '../engine.js';

export const P1 = panel(0, { bg: 'paper', title: 'By hand' });

// ---- 1: the scribe, close ----
shot({ at: 0, panel: P1, x: -2.6, y: -.3, zoom: 1.35 });
P1.cutout('scribe', { x: -4.4, y: -.4, h: 6, at: 0 });

// ---- 2: the idea ----
shot({ at: 2, panel: P1, zoom: 1 });
const h1 = P1.headline('Every book,', { x: 3.2, y: 2.1, size: 1.05, at: 2.2 });
P1.headline('copied by hand', { x: 3.2, y: .7, size: 1.05, at: 2.7 });
P1.mark({ type: 'underline', x: 3.2, y: -.05, w: 5.6, at: 3.6, dur: .5 });
P1.label('one page at a time', { x: 3.2, y: -1.3, size: .36, at: 4.2 });
void h1;
