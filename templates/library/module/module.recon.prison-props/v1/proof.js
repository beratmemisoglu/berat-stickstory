// PROOF module.recon.prison-props: a cell corner (bars, bunk, toilet, sink, hanging bulb, a rope), and outside a stretch of
// perimeter wall with razor wire and a guard tower.
// Install as scenes/<name>.js next to library/module.recon.prison-props/ (+ canvas-materials, cloth-drape, relief).
import { shot, THREE } from '../engine.js';
import { part, std } from '../lib/crime.js';
import { guardTower, prisonWall, cellBars, bunkBed, steelToilet, sinkUnit, hangingBulb, rope } from '../library/module.recon.prison-props/index.js';

shot({ trans: 'cut', t0: 0, build(S) {
  S.studio({ near: .05, far: 120, keyI: .8, area: 14 }); S.recon = false;
  S.scene.add(new THREE.HemisphereLight(0xc8c0b4, 0x5a4c40, .6));
  const G = new THREE.Group(); S.scene.add(G);
  part(new THREE.BoxGeometry(6, 2.8, .2), std(0x8e8c88, .9), [0, 1.4, -2.1], null, G, 'cell back wall');
  cellBars(G, { x: -2.9, z0: -.2, z1: -2 });
  const bunk = bunkBed(G, { x0: -1.8, x1: .7, z0: -1.1, z1: -2 });
  const t = steelToilet(G, [1.6, 0, -1.5]), s = sinkUnit(G, [2.6, 0, -1.6]);
  hangingBulb(S, G, [[-2.8, 2.6, -1], [-1, 2.45, -1.1], [.8, 2.6, -1]], [-.4, 2.2, -1.05], { i: 6 });
  rope(G, [[.9, 2.75, -.4], [1, 1.5, -.4], [.95, .3, -.35]], { knot: [.9, 2.7, -.4] });
  prisonWall(S, G, { x0: -9, x1: 9, z: -12, h: 2.45 });
  guardTower(S, G, { pos: [10, 0, -16], ry: .25 });
  S.collide = { bodies: () => [], solids: [...bunk.solids, ...t.solids, ...s.solids] };
  S.post.dof = null; S.post.bloom = .3; S.visibility = false;
  const K = { p: [0, 2.6, 7.5], l: [0, 1.6, -4], fov: 55 }; S.camera([{ t: 0, ...K }, { t: 5, ...K }]);
} });
