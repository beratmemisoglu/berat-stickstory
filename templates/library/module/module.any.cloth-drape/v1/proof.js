// PROOF module.any.cloth-drape: a lumpy mattress on a block, a blanket laid on it and falling over the front edge, a
// crumpled heap and a pillow. Install as scenes/<name>.js next to library/module.any.cloth-drape/ (+ module.any.relief).
// The bed stands 1 cm above the studio floor (a bottom exactly at y = 0 z-fights with it: check_layout FLICKER).
import { shot, THREE } from '../engine.js';
import { part, std } from '../lib/crime.js';
import { drape, heap, lumpyBox } from '../library/module.any.cloth-drape/index.js';

shot({ trans: 'cut', t0: 0, build(S) {
  S.studio({ near: .05, far: 30, keyI: 1.2, area: 4 }); S.recon = false;
  S.scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, .8));
  const cloth = std(0x6a5f52, .95, { side: THREE.DoubleSide }), mat = std(0x7e7a72, .9);
  part(new THREE.BoxGeometry(2, .42, .9), std(0x3b3833, .5, { metalness: .6 }), [0, .22, 0], null, S.scene, 'bed base');
  part(lumpyBox(1.94, .09, .86, 3, .012), mat, [0, .475, 0], null, S.scene, 'mattress');
  part(drape(1.25, 1.35, .45, 3, .2, .4), cloth, [.35, .525, 0], null, S.scene, 'blanket').userData.noContact = true;
  part(heap(.36, .09, .26, 5), cloth, [.6, .5, -.1], [0, .3, 0], S.scene, 'heap').userData.noContact = true;
  part(lumpyBox(.42, .16, .34, 11, .03), mat, [-.7, .58, 0], null, S.scene, 'pillow').userData.noContact = true;
  S.post.dof = null; S.visibility = false;
  const K = { p: [.4, 1.5, 2.8], l: [0, .4, 0], fov: 45 }; S.camera([{ t: 0, ...K }, { t: 5, ...K }]);
} });
