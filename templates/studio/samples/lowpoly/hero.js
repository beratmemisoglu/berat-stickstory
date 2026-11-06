// Low poly shorts - Studio hero: three shots that show the style at its best (Bright look): the cast on a lit set with an
// in-scene pixel label, a wide-lens face close-up, a void explainer with one object and its label.
import { shot, preload, heart, THREE, VERT } from '../engine.js';
import { SET_NEEDS, PERSON_NEEDS } from '../lib/scan.js';
import { HERO } from '../models.js';

await preload([...SET_NEEDS.farm, ...PERSON_NEEDS, 'animal.q.cow', 'anim.ual2', 'anim.kaykit_ue']);

const COW = 'animal.q.cow';
/** the nature pack's teal leaves and salmon bark read as a broken palette: natural greens and wood brown (own copies).
 *  The farm set's procedural barn is taken out: its roof prism renders as a sideways black slab from every angle. */
function naturalColours(S) {
  const barn = S.scene.getObjectByName('barn'); if (barn) barn.parent.remove(barn);
  const to = { leafsGreen: 0x4c8a2e, grass: 0x5a9a34, woodBark: 0x7a5434, wood: 0x9a6a40, woodDark: 0x6e4a2c, leafsFall: 0xe8781c };
  S.scene.traverse(o => { if (!o.isMesh || Array.isArray(o.material) || !to[o.material?.name]) return; const m = o.material.clone(); m.color.set(to[m.name]); o.material = m; });
}

// ---- 1: the cast on the farm, a pixel label in the scene ----
shot({ t0: 0, set: 'farm', build(S) {
  naturalColours(S);
  const you = S.person({ ...HERO, name: 'the farmer', outfit: 'worker', face: 'grin', at: [-.1, 0, -1.1], ry: .3 });
  you.do('Idle_FoldArms_Loop', 0);
  const daisy = S.animal(COW, { name: 'Daisy', at: VERT ? [1.0, 0, -3.8] : [1.0, 0, -2.6], ry: -.5, clip: 'Idle' });
  const clover = S.animal(COW, { name: 'Clover', at: VERT ? [-1.1, 0, -4.8] : [-1.3, 0, -3.6], ry: .7, clip: 'Eating' });
  S.callout('best friends', { on: VERT ? [-.1, 2.5, -1.1] : [.1, 2.45, -2.6], at: .35, style: 'pixel', color: 'yellow' });
  if (VERT) S.camera('push', { on: you, yaw: -14, fill: .52 });
  else S.camera('push', { on: new THREE.Box3(new THREE.Vector3(-2.2, 0, -4.8), new THREE.Vector3(2.0, 1.9, -.6)), yaw: 10, fill: .82 });
  return { you, daisy, clover };
} });

// ---- 2: the wide-lens face close-up ----
shot({ t0: 2, set: 'farm', build(S) {
  naturalColours(S);
  const you = S.person({ ...HERO, name: 'the farmer', outfit: 'worker', face: 'happy', at: [0, 0, -1.4], ry: .2 });
  you.do('Idle_Talking_Loop', 1.6);
  S.animal(COW, { name: 'Daisy', at: [-1.6, 0, -4.2], ry: .9, clip: 'Idle_2' });
  S.camera('face', { on: you, side: 18, fill: VERT ? .3 : .42 });
  return { you };
} });

// ---- 3: the void explainer: one object, one label ----
shot({ t0: 4, set: 'void-teal', build(S) {
  const h = heart(), g = new THREE.Group(); g.add(h); g.name = 'heart'; g.position.set(0, .05, 0); S.add(g);
  S.tick(t => { g.scale.setScalar(4.5); g.rotation.y = Math.sin(t * .9) * .5; h.userData.beat(t * 1.3); });
  S.callout('heart rate', { on: [0, 1.3, 0], at: 4.25, style: 'pixel', color: 'yellow' });
  S.camera('orbit', { on: g, fill: VERT ? .42 : .55, speed: 10 });
  return { heart: g };
} });
