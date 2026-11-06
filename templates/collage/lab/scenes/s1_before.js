// I. Before the press: every book copied by hand
import { panel, shot } from '../engine.js';

export const P1 = panel(0, { bg: 'paper', title: 'Before the press' });

// ---- 1: the scribe, close ----
// frame: x -2.4 +- 5.5, y -.6 +- 3.1  -> the monk (x -6.9..-2.3, y -3.5..2.3) sits whole inside it
shot({ at: 0, panel: P1, x: -2.4, y: -.6, zoom: 1.45, drift: .03 });
P1.cutout('monk', { x: -4.6, y: -.6, h: 5.8, at: 0 });

// ---- 2: every book copied by hand ----
shot({ at: 2.2, panel: P1, zoom: 1, drift: .03 });
P1.ransom('EVERY BOOK', { x: 3.3, y: 2.7, size: 1.0, at: 2.2, per: .06 });
const hand = P1.script('copied by hand', { x: 3.4, y: .7, size: 1.0, at: 2.98, dur: 1.15, pen: 'quill', penH: 1.45 });
// the circle waits for the quill to lift away: nothing crosses the pen
P1.mark({ type: 'circle', around: hand, word: 'hand', at: hand.at + hand.dur + .5, dur: .45 });
P1.cutout('manuscript', { x: 5.6, y: -2.05, h: 3.5, rot: 5, at: 2.5, in: 'slide-right' });
P1.tape({ x: 5.35, y: -.3, w: 1.2, rot: -16, at: 2.5 + .45 });
P1.label('one page at a time.', { x: .5, y: -2.9, size: .34, at: 4.3, anchor: 'left' });
