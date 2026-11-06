// MUSTFAIL: through
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { shot, THREE } from '../engine.js';
import { mesh, box } from '../models.js';

// ---- mustfail: a small crate pushed halfway into a big one (two solids in the same space) ----
shot({ t0: 0, trans: 'cut', build(S) {
  S.studio({ key: [6, 12, 9], area: 6, fog: [30, 90], near: .1, far: 120 });
  const mat = new THREE.MeshStandardMaterial({ color: 0xcfc9bd, roughness: .9 });
  const big = mesh(box(1.4, 1.2, 1.2, .03), mat, [0, .6, 0], [0, 0, 0], S.scene); big.name = 'big crate';
  const small = mesh(box(.6, .6, .6, .03), new THREE.MeshStandardMaterial({ color: 0x9fb6d8, roughness: .9 }), [.75, .3, .1], [0, 0, 0], S.scene); small.name = 'small crate';
  S.camera([{ t: 0, p: [2.6, 2.4, 5.6], l: [.2, .6, 0], fov: 32 }]);
} });
