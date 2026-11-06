// PROOF module.any.relief: a 6 x 3 m earth face (relief), its closed backing volume .3 m behind (a solid for S.collide),
// stones seated on the face with surf(), a lumpy lip along its top edge, a lumpy block below.
// Install as scenes/<name>.js next to library/module.any.relief/ (+ module.recon.canvas-materials for the soil).
import { shot, THREE } from '../engine.js';
import { part, std } from '../lib/crime.js';
import { reliefFaces, backing, lumpyLip, lumpyBox } from '../library/module.any.relief/index.js';
import { perMetre, looseSoil } from '../library/module.recon.canvas-materials/index.js';

shot({ trans: 'cut', t0: 0, build(S) {
  S.studio({ near: .05, far: 60, keyI: .6, area: 8, floor: false }); S.recon = false;
  S.scene.add(new THREE.HemisphereLight(0xc8c0b4, 0x5a4c40, .4));
  const rake = new THREE.DirectionalLight(0xffd0a0, 3); rake.position.set(-9, 5, 4); rake.target.position.set(0, 0, 0); rake.castShadow = true; rake.shadow.mapSize.set(2048, 2048); S.scene.add(rake, rake.target);
  const G = new THREE.Group(); S.scene.add(G); const soil = perMetre(looseSoil(), { color: 0xc8d0e8, rough: 1 });
  const R = reliefFaces(G); R.face(-3, 3, -1.5, 1.5, 0, 1, .5, soil, { name: 'earth face' });
  const b = backing(6, 3, 2, std(0x1a140f, 1)); b.position.set(0, 0, 0); G.add(b);
  for (let i = 0; i < 12; i++) { const x = -2.6 + (i % 6) * 1.05, y = i < 6 ? .6 : -.7, r = .06 + (i % 3) * .04; const s = part(new THREE.DodecahedronGeometry(r, 0), std(0x6e665d, .85), [x, y, R.surf(x, y) + r * .15], [i, i * .7, 0], G, 'stone'); s.userData.noContact = true; }
  const lip = part(lumpyLip(6, .11, 41), soil, [0, 1.55, .02], [0, 0, Math.PI / 2], G, 'lip'); lip.userData.noContact = true;
  part(lumpyBox(1.2, .5, .8, 3, .05), soil, [0, -1.75, .6], null, G, 'lumpy block').userData.noContact = true;
  S.post.dof = null; S.visibility = false;
  const K = { p: [1.5, .4, 6.5], l: [0, -.1, 0], fov: 45 }; S.camera([{ t: 0, ...K }, { t: 5, ...K }]);
} });
