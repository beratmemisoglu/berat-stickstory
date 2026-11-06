// PROOF module.recon.cafe-props: every prop once - a table with two bentwood chairs and a cup, a pendant with its haze
// cone, a wall sconce, the booth (no people), an espresso machine on a counter block, a duffel.
// Install as scenes/<name>.js next to library/module.recon.cafe-props/ (+ canvas-materials, haze-beam).
import { shot, THREE } from '../engine.js';
import { part, std } from '../lib/crime.js';
import { bentwoodChair, cafeTable, pendant, sconce, cupSaucer, duffel, booth, espressoMachine } from '../library/module.recon.cafe-props/index.js';

shot({ trans: 'cut', t0: 0, build(S) {
  S.studio({ near: .05, far: 40, keyI: .5, area: 5 }); S.recon = false;
  S.scene.add(new THREE.HemisphereLight(0xb8c0d0, 0x3a3436, .5));
  const G = new THREE.Group(); S.scene.add(G);
  part(new THREE.BoxGeometry(7, 3, .2), std(0x5a3a30, .9), [0, 1.5, -2.1], null, G, 'back wall');
  const T = cafeTable(G, [-1.6, 0, -.6]); bentwoodChair(G, [-1.6, 0, .05], Math.PI); bentwoodChair(G, [-2.25, 0, -.6], Math.PI / 2);
  cupSaucer(T.g, [0, .76, 0], .4);
  pendant(S, G, [-1.6, 1.9, -.6], { ceil: 3, cone: 9, r: .2 });
  sconce(S, G, [.2, 1.9, -2.0], 0);
  const Bt = booth(S, G, { pos: [1.4, 0, -.9], rot: 0, scale: 1 });
  part(new THREE.BoxGeometry(1, 1, .6), std(0x3a2a20, .7), [-.2, .5, -1.6], null, G, 'counter');
  espressoMachine(G, [-.2, 1, -1.6], 1);
  duffel(G, [.2, 0, .4], .8);
  S.collide = { bodies: () => [], solids: [...T.solids, ...Bt.solids] };
  S.post.dof = null; S.post.bloom = .3; S.visibility = false;
  const K = { p: [0, 2.2, 5.6], l: [0, .8, -.6], fov: 50 }; S.camera([{ t: 0, ...K }, { t: 5, ...K }]);
} });
