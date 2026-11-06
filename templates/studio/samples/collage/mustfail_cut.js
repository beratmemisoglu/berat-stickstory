// MUSTFAIL: cut
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { panel, shot, loadImages, FRAME } from '../engine.js';

await loadImages({ screwpress: new URL('../assets/img/screwpress.webp', import.meta.url).href });
// ---- mustfail: a cut-out half outside the right edge of the frame (no `bleed`) ----
const P = panel(0, { bg: 'paper', title: 'Cut' });
shot({ at: 0, panel: P, zoom: 1, drift: 0 });
P.cutout('screwpress', { x: FRAME.w / 2 - .4, y: 0, h: 4.5, at: 0 });
P.headline('Half outside', { x: -FRAME.w / 4, y: 0, size: .8, font: 'serif', at: 0 });
