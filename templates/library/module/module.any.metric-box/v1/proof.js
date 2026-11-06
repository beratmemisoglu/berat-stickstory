// PROOF module.any.metric-box: the same brick texture on a plain BoxGeometry (stretched: one tile per face) and on a
// metricBox (one tile per 2 m x 3 m on every face), plus two diagonal rails merged into ONE mesh (no COPLANAR pair).
// Install as scenes/<name>.js next to library/module.any.metric-box/ (+ module.recon.canvas-materials for the texture).
// Everything stands 1 cm above the studio floor: bottoms exactly at y = 0 z-fight with it (check_layout FLICKER).
import { shot, THREE } from '../engine.js';
import { part, std } from '../lib/crime.js';
import { metricBox, merged } from '../library/module.any.metric-box/index.js';
import { tiled, perMetre, brick } from '../library/module.recon.canvas-materials/index.js';

shot({ trans: 'cut', t0: 0, build(S) {
  S.studio({ near: .05, far: 80, keyI: 1.2, area: 10 }); S.recon = false;
  S.scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.2));
  const set = brick({ soot: .3, grime: .3 });
  part(new THREE.BoxGeometry(6, 2.4, .4), tiled(set, 1, 1, { repeat: [1, 1] }), [-3.4, 1.21, 0], null, S.scene, 'stretched box');
  part(metricBox(6, 2.4, .4), perMetre(set), [3.4, 1.21, 0], null, S.scene, 'metric box');
  const rails = merged([-1, 1].map(s => new THREE.BoxGeometry(5, .1, .12).translate(0, 0, s * .35)));
  part(rails, std(0x4a4440, .45, { metalness: .7 }), [0, .06, 2], [0, .3, 0], S.scene, 'rails (one mesh)');
  S.post.dof = null; S.visibility = false;
  const K = { p: [0, 3.2, 11], l: [0, 1, 0], fov: 50 }; S.camera([{ t: 0, ...K }, { t: 5, ...K }]);
} });
