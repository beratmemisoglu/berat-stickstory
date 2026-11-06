// PROOF module.recon.canvas-materials: every preset as a 1.6 x 1.6 m swatch (metric boxes, so each shows its real scale).
// Install as scenes/<name>.js next to library/module.recon.canvas-materials/ (+ module.any.metric-box).
import { shot, THREE } from '../engine.js';
import { part } from '../lib/crime.js';
import * as CM from '../library/module.recon.canvas-materials/index.js';
import { metricBox } from '../library/module.any.metric-box/index.js';

shot({ trans: 'cut', t0: 0, build(S) {
  S.studio({ near: .05, far: 80, keyI: 1, area: 10, floor: false }); S.recon = false;
  S.scene.background = new THREE.Color(0x202326);
  S.scene.add(new THREE.HemisphereLight(0xffffff, 0x505050, 1.3));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-4, 6, 8); S.scene.add(key);
  const sets = [['brick', CM.brick({ soot: .5, grime: .55 })], ['coping', CM.coping()], ['castConcrete', CM.castConcrete('#5e6166', { drips: 30 })], ['boardConcrete', CM.boardConcrete({ seams: true, ties: true })],
    ['panelConcrete', CM.panelConcrete()], ['planks', CM.planks()], ['furnitureWood', CM.furnitureWood()], ['weatheredWood', CM.weatheredWood()], ['liningBoards', CM.liningBoards()], ['deckBoards', CM.deckBoards()],
    ['leather', CM.leather(true)], ['earthClods', CM.earthClods()], ['rootSoil', CM.rootSoil()], ['strataSoil', CM.strataSoil()], ['looseSoil', CM.looseSoil()], ['rockFace', CM.rockFace()],
    ['frostTop', CM.frostTop()], ['gravelRoad', CM.gravelRoad()], ['dirtFloor', CM.dirtFloor()], ['rivetedSteel', CM.rivetedSteel()]];
  // swatches on a display board (they are samples, not things in a scene: noContact)
  sets.forEach(([name, set], i) => { const c = i % 5, r = Math.floor(i / 5); part(metricBox(1.6, 1.6, .1), CM.perMetre(set), [(c - 2) * 1.8, (1.5 - r) * 1.8, 0], null, S.scene, name).userData.noContact = true; });
  const menu = CM.chalkMenu(); part(new THREE.PlaneGeometry(3.2, 1.25), new THREE.MeshStandardMaterial({ map: menu, emissive: 0xffffff, emissiveMap: menu, emissiveIntensity: .3 }), [0, -4.4, 0], null, S.scene, 'chalk menu');
  S.post.dof = null; S.visibility = false;
  const K = { p: [0, -.45, 9.6], l: [0, -.45, 0], fov: 50 }; S.camera([{ t: 0, ...K }, { t: 5, ...K }]);
} });
