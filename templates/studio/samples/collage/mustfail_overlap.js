// MUSTFAIL: overlap
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { panel, shot, loadImages, FRAME } from '../engine.js';

await loadImages({ gutenberg: new URL('../assets/img/gutenberg.webp', import.meta.url).href });
const V = FRAME.h > FRAME.w;
// ---- mustfail: a black tape caption laid across the middle of the cut-out it names (no `over`) ----
const P = panel(0, { bg: 'paper', title: 'Overlap' });
shot({ at: 0, panel: P, zoom: 1, drift: 0 });
P.cutout('gutenberg', { x: 0, y: 0, h: V ? 6 : 5.6, at: 0 });
P.label('Johannes Gutenberg', { x: 0, y: .2, size: .4, style: 'black', at: 0 });
