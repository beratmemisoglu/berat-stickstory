// PROOF module.recon.ground-cover: grass tufts and stones on a frosty top, and a cut face below with gravel, stones and
// roots seated on its relief. Install as scenes/<name>.js next to library/module.recon.ground-cover/ (+ relief,
// canvas-materials).
import { shot, THREE } from '../engine.js';
import { part, std } from '../lib/crime.js';
import { grassTufts, stones, faceGravel, faceStones, roots } from '../library/module.recon.ground-cover/index.js';
import { reliefFaces } from '../library/module.any.relief/index.js';
import { tiled, perMetre, frostTop, looseSoil } from '../library/module.recon.canvas-materials/index.js';

shot({ trans: 'cut', t0: 0, build(S) {
  S.studio({ near: .05, far: 60, keyI: .6, area: 8, floor: false }); S.recon = false;
  S.scene.add(new THREE.HemisphereLight(0x8aa0c8, 0x2a2018, .7));
  const sun = new THREE.DirectionalLight(0xffe0c0, 2.4); sun.position.set(-6, 6, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); S.scene.add(sun);
  const G = new THREE.Group(); S.scene.add(G);
  const top = part(new THREE.BoxGeometry(8, .3, 5), [std(0x1a140f), std(0x1a140f), tiled(frostTop(), 8, 5, { color: 0xd4dae4 }), std(0x1a140f), std(0x1a140f), std(0x1a140f)], [0, -.15, -2.5], null, G, 'top'); top.userData.ground = true;
  grassTufts(G, [[-2, -1.5, .5, 4, .5], [1, -2.5, .6, 4, .6], [2.8, -1, .3, 3, .4]]);
  stones(G, 40, [-3.5, 3.5, -4.5, -.4], { seed: 2, color: 0x6a6660 });
  const R = reliefFaces(G); R.face(-4, 4, -3.3, -.3, .02, 1, .45, perMetre(looseSoil(), { color: 0xc8d0e8, rough: 1 }), { name: 'cut face' });
  part(new THREE.BoxGeometry(8, 3, 4), std(0x1a140f, 1), [0, -1.8, -2.4], null, G, 'earth mass').castShadow = false;
  faceGravel(G, R.surf, { n: 250, x0: -3.8, x1: 3.8, y0: -3.1, y1: -.5 });
  faceStones(G, R.surf, [[-2.5, -1.2, .14], [-.4, -2.2, .1], [1.8, -1.6, .16], [3, -2.6, .08]]);
  roots(G, R.surf, [[-3, -.35, -.4, 1.2], [-1.2, -.35, .3, 1.4], [1.5, -.35, -.2, 1]], { floor: -3.2 });
  S.post.dof = null; S.visibility = false;
  const K = { p: [0, 1.6, 7.5], l: [0, -1, -1], fov: 50 }; S.camera([{ t: 0, ...K }, { t: 5, ...K }]);
} });
