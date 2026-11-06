// PROOF module.any.haze-beam: three haze cones under three lamps in a dark room (strength .15 / .3 / .5: the café used
// .15 with lit surroundings; alone in the dark a cone needs more to read).
// Install as scenes/<name>.js next to library/module.any.haze-beam/.
import { shot, THREE } from '../engine.js';
import { part, std } from '../lib/crime.js';
import { hazeCone } from '../library/module.any.haze-beam/index.js';

shot({ trans: 'cut', t0: 0, build(S) {
  S.studio({ near: .05, far: 40, keyI: .15, area: 6 }); S.recon = false;
  S.scene.background = new THREE.Color(0x0c0d10);
  part(new THREE.BoxGeometry(8, 3.2, .2), std(0x2a2422, .9), [0, 1.6, -1.6], null, S.scene, 'back wall');
  [-2.2, 0, 2.2].forEach((x, i) => { const k = [.15, .3, .5][i];
    part(new THREE.SphereGeometry(.06, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe2b8, toneMapped: false }), [x, 2.2, 0], null, S.scene, 'bulb').userData.noContact = true;
    S.scene.add(hazeCone([x, 2.2, 0], 0, { r: .18, k }));
    const sp = new THREE.SpotLight(0xffe8dc, 25, 6, .6, .7, 1.6); sp.position.set(x, 2.2, 0); sp.target.position.set(x, 0, 0); S.scene.add(sp, sp.target); });
  S.post.dof = null; S.post.bloom = .3; S.visibility = false;
  const K = { p: [0, 1.3, 5.6], l: [0, 1.1, 0], fov: 50 }; S.camera([{ t: 0, ...K }, { t: 5, ...K }]);
} });
