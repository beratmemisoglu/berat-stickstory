// MUSTFAIL: BLANK
// A deliberate mistake: the Studio's frame check must report it (this engine has no layoutIssues, so the app judges the
// stills: the shot's middle frame is one flat colour). If it ever passes here, the check is broken (never fix this file).
import { shot, C, box } from '../engine.js';

// ---- mustfail: the subject was built behind the camera, under a sky of one colour: the frame shows nothing ----
shot({ t0: 0, cut: true, build(S) {
  S.bg = C.bg; S.sky = [C.bg, C.bg]; S.shadows = false;
  const st = { crate: box(1, 1, 1, 'orange', [0, .5, 12]) }; S.scene.add(st.crate);
  return st;
}, update(st, t, S) { S.cam.position.set(0, 1.5, 6); S.cam.lookAt(0, 4, -10); } });
