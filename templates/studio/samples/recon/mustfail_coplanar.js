// MUSTFAIL: coplanar
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { shot, THREE } from '../engine.js';
import { mesh, box } from '../models.js';

// ---- mustfail: a rug laid 2 mm above the studio floor (two surfaces less than 1 cm apart: they z-fight) ----
shot({ t0: 0, trans: 'cut', build(S) {
  S.studio({ key: [6, 12, 9], area: 6, fog: [30, 90], near: .1, far: 120 });
  const rug = mesh(new THREE.PlaneGeometry(2.4, 1.6), new THREE.MeshStandardMaterial({ color: 0xa9b8c4, roughness: 1 }), [0, .002, 0], [-Math.PI / 2, 0, 0], S.scene); rug.name = 'rug';
  const crate = mesh(box(.6, .6, .6, .03), new THREE.MeshStandardMaterial({ color: 0xcfc9bd, roughness: .9 }), [1.8, .3, -.4], [0, .4, 0], S.scene); crate.name = 'crate';
  S.camera([{ t: 0, p: [0, 3.2, 6], l: [.3, 0, 0], fov: 32 }]);
} });
