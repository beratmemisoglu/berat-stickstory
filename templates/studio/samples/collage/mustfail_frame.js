// MUSTFAIL: frame
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { panel, shot, loadImages, FRAME } from '../engine.js';

await loadImages({ inkball: new URL('../assets/img/inkball.webp', import.meta.url).href });
// ---- mustfail: a close framing pushed past the panel's left edge (zoom 1.3 allows x within +-1.85; this asks for -4) ----
const P = panel(0, { bg: 'paper', title: 'Frame' });
shot({ at: 0, panel: P, x: -FRAME.w / 4, y: 0, zoom: 1.3, drift: 0 });
P.cutout('inkball', { x: -FRAME.w / 4, y: 0, h: 2.6, at: 0 });
