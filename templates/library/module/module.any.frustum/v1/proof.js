// PROOF module.any.frustum: an open tub (DoubleSide, wider at the top) next to the failure it replaces - a 4-sided
// CylinderGeometry turned pi/4 then scaled non-uniformly, which shears into a diamond.
// Install as scenes/<name>.js next to library/module.any.frustum/.
// The tub stands 1 cm above the studio floor: its DoubleSide bottom exactly at y = 0 z-fights with it (check_layout FLICKER).
import { shot, THREE } from '../engine.js';
import { part, std } from '../lib/crime.js';
import { frustum } from '../library/module.any.frustum/index.js';

shot({ trans: 'cut', t0: 0, build(S) {
  S.studio({ near: .05, far: 40, keyI: 1, area: 4 }); S.recon = false;
  S.scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1));
  part(frustum(1.5, .95, 1.15, .65, .6), std(0x8a7a6e, .7, { metalness: .4, side: THREE.DoubleSide }), [-1.1, .01, 0], null, S.scene, 'tub (frustum)');
  const bad = part(new THREE.CylinderGeometry(.62, .45, .6, 4, 1, true), std(0x6e5a50, .7, { side: THREE.DoubleSide }), [1.1, .3, 0], [0, Math.PI / 4, 0], S.scene, 'sheared tub (the failure)'); bad.scale.set(1.4, 1, .8);
  S.post.dof = null; S.visibility = false;
  const K = { p: [0, 2.4, 4.2], l: [0, .2, 0], fov: 45 }; S.camera([{ t: 0, ...K }, { t: 5, ...K }]);
} });
