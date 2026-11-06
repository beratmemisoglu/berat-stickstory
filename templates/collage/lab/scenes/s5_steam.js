// V. Steam: The Times, 29 November 1814, 1,100 sheets an hour
import { panel, shot, C } from '../engine.js';
import { gauge } from '../models.js';

export const P5 = panel(7, { bg: 'paper', title: 'Steam' });

// ---- 9: steam arrived, 1,100 sheets an hour ----
// one framing for the whole chapter: x +- 7.7, y .1 +- 4.3; everything is laid out to sit inside it
shot({ at: 33.6 - .2, panel: P5, y: .1, zoom: 1.04, drift: .02 });
P5.newspaper({ x: -.2, y: 1.4, w: 9, name: 'The Morning Impression', date: 'LONDON, TUESDAY, NOVEMBER 29, 1814', headline: 'STEAM!', sub: 'A machine that prints 1,100 sheets an hour', at: 33.6 - .7 });
P5.stamp('1814', { x: 5.9, y: 2.8, size: .7, at: 33.72 });
P5.cutout('steampress', { x: 4.6, y: -2.7, h: 2.6, at: 34.68 });
P5.cutout('gear', { x: 6.9, y: -3.5, h: .9, at: 34.68 + .2, spin: -1.2 });
gauge(P5, { x: -4.9, y: -2.85, size: 2.6, max: 1200, to: 1100, unit: 'sheets / hour', at: 35.44 - .25, dur: 1.2 });
P5.counter({ from: 0, to: 1100, x: -1.4, y: -3.0, size: .7, at: 35.44, countDur: 1.1, color: C.red });
