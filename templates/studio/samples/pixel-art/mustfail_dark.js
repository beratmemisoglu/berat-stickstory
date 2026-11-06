// MUSTFAIL: DARK
// A deliberate mistake: the Studio's frame check must report it (this engine has no layoutIssues, so the app judges the
// stills: mean luma < 0.10 and the brightest 2 % < 0.35). If it ever passes here, the check is broken (never fix this file).
import { THREE, shot, C, box, rect, W, H } from '../engine.js';

// ---- mustfail: a "moody" black wash over a dim night street: the mood was made by underexposing, not by light ----
shot({ t0: 0, cut: true, build(S) {
  S.bg = C.bg; S.sky = [C.bg, C.navy];
  S.scene.add(box(30, .1, 30, [C.bg, C.navy, C.navy], [0, -.05, 0]));
  const st = { blocks: [] };
  for (let i = 0; i < 5; i++) { const h = 1.2 + (i % 3) * .5, b = box(1.2, h, 1, ['navy', 'plum', 'dark'][i % 3], [(i - 2) * 1.6, h / 2, -1.5]); S.scene.add(b); st.blocks.push(b); }
  for (let i = 0; i < 3; i++) S.scene.add(box(.14, .16, .02, [C.orange, C.yellow, C.yellow], [(i * 2 - 2) * 1.6, .7, -.99]));
  return st;
}, update(st, t, S) { S.cam.position.set(0, 2, 6); S.cam.lookAt(0, 1, -1.5); },
draw() { rect(0, 0, W, H, '#000000', .66); } });
