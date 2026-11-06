// 3. The spread: millions of books
import { panel, shot } from '../engine.js';

export const P3 = panel(2, { bg: 'paper', title: 'The spread' });

// ---- 5: the world ----
shot({ at: 13, panel: P3, zoom: 1 });
P3.cutout('globe', { x: -3.8, y: 0, h: 6.4, at: 12.6 });
P3.dots([[-5.2, 1.2], [-4.4, .6], [-3.1, 1.7], [-2.6, -.4], [-4.9, -1.2], [-3.4, -2.0], [-2.1, .9]], { at: 14.0, stagger: .12, r: .18 });
P3.counter({ from: 0, to: 20000000, x: 3.6, y: 1.0, size: 1.1, at: 14.6, countDur: 1.6, card: false });
P3.label('books printed by 1500', { x: 3.6, y: -.6, size: .38, at: 16.4 });
