// MUSTFAIL: floating
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { shot, THREE } from '../engine.js';
import { mesh, box } from '../models.js';

// ---- mustfail: a crate hanging 70 cm in the air next to one that rests on the floor ----
shot({ t0: 0, trans: 'cut', build(S) {
  S.studio({ key: [6, 12, 9], area: 6, fog: [30, 90], near: .1, far: 120 });
  const mat = new THREE.MeshStandardMaterial({ color: 0xcfc9bd, roughness: .9 });
  const rest = mesh(box(.8, .8, .8, .03), mat, [-1, .4, 0], [0, .3, 0], S.scene); rest.name = 'crate on the floor';
  const hang = mesh(box(.8, .8, .8, .03), mat, [1, 1.1, 0], [0, -.2, 0], S.scene); hang.name = 'crate in the air';
  S.camera([{ t: 0, p: [0, 2.2, 6.5], l: [0, .7, 0], fov: 32 }]);
} });
