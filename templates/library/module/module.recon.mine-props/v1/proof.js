// PROOF module.recon.mine-props: a drifting track with a loaded cart on it, a cage lamp on a post, a hose, two cables,
// dirt piles, a planted shovel and a floor lantern on a dirt floor.
// Install as scenes/<name>.js next to library/module.recon.mine-props/ (+ canvas-materials, frustum, metric-box).
import { shot, THREE } from '../engine.js';
import { part, std } from '../lib/crime.js';
import { tiled, dirtFloor } from '../library/module.recon.canvas-materials/index.js';
import { cageLamp, railTrack, mineCart, airHose, cables, dirtPile, shovel, plantShovel, floorLantern } from '../library/module.recon.mine-props/index.js';

shot({ trans: 'cut', t0: 0, build(S) {
  S.studio({ near: .05, far: 40, keyI: .3, area: 6, floor: false }); S.recon = false;
  S.scene.add(new THREE.HemisphereLight(0x8a90a0, 0x2a2018, .5));
  const G = new THREE.Group(); S.scene.add(G);
  const fl = part(new THREE.BoxGeometry(9, .2, 4), tiled(dirtFloor(), 9, 4, { color: 0xd0c0ac }), [0, -.1, -.5], null, G, 'floor'); fl.userData.ground = true;
  part(new THREE.BoxGeometry(9, 3, .1), std(0x3a2c22, .9), [0, 1.5, -2.55], null, G, 'back lining');
  const zAt = x => -.6 + .03 * x, T = railTrack(G, { x0: -4, x1: 4, y: 0, zAt });
  const C = mineCart(G, { x: -1.2, y: T.railTop, z: zAt(-1.2), ry: -T.angle });
  part(new THREE.BoxGeometry(.2, 2.6, .18), std(0x2e2620, .85), [1.8, 1.3, -2.4], null, G, 'post');
  cageLamp(S, G, [1.8, 1.9, -2.08], { floorY: 0 });
  airHose(G, [[-4, 2.2, -2.3], [-1, 2.1, -2.2], [1, 2.3, -2.25], [2.2, 1.6, -2.1], [2.4, .9, -2.0]]);
  cables(G, { x0: -4, x1: 4, y: 2.5, z: -2.35 });
  dirtPile(G, [3.2, 0, -1.5], [.75, .5, 1.0]); dirtPile(G, [-3.2, 0, .6], [.5, .18, .35]);
  const sh = shovel(G); plantShovel(sh, { x: 2.2, z: .4, ry: -2.2, reach: .8, back: .6 });
  floorLantern(S, G, [.4, 0, -1.9]);
  S.collide = { bodies: () => [], solids: C.solids };
  S.post.dof = null; S.post.bloom = .4; S.visibility = false;
  const K = { p: [0, 2.6, 6.4], l: [0, .7, -.8], fov: 50 }; S.camera([{ t: 0, ...K }, { t: 5, ...K }]);
} });
