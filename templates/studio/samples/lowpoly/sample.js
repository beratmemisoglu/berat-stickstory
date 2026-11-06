// Low poly shorts - Studio sample (~20 s): "Cows have best friends." One clause = one shot, the camera always moves,
// every element lands on its word. Library cows + the main character (role 'main') on the farm set, the kit's heart.
import { shot, preload, heart, THREE, VERT, E, seg } from '../engine.js';
import { SET_NEEDS, PERSON_NEEDS } from '../lib/scan.js';
import { HERO } from '../models.js';

// everything this file uses from the library, loaded before the first frame (a Studio view may not be project.json's scenes)
await preload([...SET_NEEDS.farm, ...PERSON_NEEDS, 'animal.q.cow', 'anim.ual2', 'anim.kaykit_ue']);

const COW = 'animal.q.cow';
const box = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
/** the nature pack's teal leaves and salmon bark read as a broken palette: natural greens and wood brown (own copies).
 *  The farm set's procedural barn is taken out: its roof prism renders as a sideways black slab from every angle. */
function naturalColours(S) {
  const barn = S.scene.getObjectByName('barn'); if (barn) barn.parent.remove(barn);
  const to = { leafsGreen: 0x4c8a2e, grass: 0x5a9a34, woodBark: 0x7a5434, wood: 0x9a6a40, woodDark: 0x6e4a2c, leafsFall: 0xe8781c };
  S.scene.traverse(o => { if (!o.isMesh || Array.isArray(o.material) || !to[o.material?.name]) return; const m = o.material.clone(); m.color.set(to[m.name]); o.material = m; });
}
/** the kit heart, 3x, floating over a cow: grows in at `at`, beats faster from `fast` on (`rate` x the resting rate) */
function floatingHeart(S, p, at, o = {}) {
  const h = heart(), g = new THREE.Group(); g.add(h); g.position.set(...p); g.name = 'heart';
  g.userData.airborne = true; g.userData.noCheck = true; S.add(g);
  S.tick(t => { const k = E.outBack(seg(t, at, at + .35), 1.6), ph = t + (o.fast != null ? Math.max(0, t - o.fast) * ((o.rate ?? 2.2) - 1) : 0);
    if (o.over) { const r = o.over.root; g.position.set(r.position.x + Math.sin(r.rotation.y) * .5, p[1], r.position.z + Math.cos(r.rotation.y) * .5); }
    g.scale.setScalar(Math.max(.001, 3 * k)); g.visible = t >= at; g.rotation.y = Math.sin(t * .8) * .35; h.userData.beat(ph); });
  return g;
}

// ---- 1: the hook - two cows side by side ----
shot({ say: 'Cows have best', set: 'farm', build(S) {
  naturalColours(S);
  const daisy = S.animal(COW, { name: 'Daisy', at: [-.55, 0, -1.6], ry: .45, clip: 'Idle' });
  const clover = S.animal(COW, { name: 'Clover', at: [.7, 0, -3.1], ry: -.35, clip: 'Idle_2' });
  S.callout('best friends', { on: [.05, 2.35, -2.3], at: S.at('best'), style: 'pixel', color: 'yellow' });
  S.camera('push', { on: box(-1.4, 0, -4.4, 1.6, 1.7, -.4), yaw: 8, fill: VERT ? 1.15 : .74 });
  return { daisy, clover };
} });

// ---- 2: she walks over to the one she picked ----
shot({ say: 'On a farm', set: 'farm', build(S) {
  naturalColours(S);
  const daisy = S.animal(COW, { name: 'Daisy', at: [-3.4, 0, -2.9], ry: 1.7, clip: 'Eating' });
  const clover = S.animal(COW, { name: 'Clover', at: [.6, 0, -2.7], ry: -.3, clip: 'Idle_Headlow' });
  for (const [x, z, ry, c] of [[2.4, -8.6, -.9, 'Eating'], [-1.8, -9.4, .6, 'Idle'], [.4, -11.8, 2.2, 'Eating']]) S.animal(COW, { at: [x, 0, z], ry, clip: c, phase: x * .1 + .3 });
  daisy.walk([[-1.6, -2.3]], { at: S.at('cow') - .3, clip: 'Walk', pace: 1 });
  S.callout('buddy', { on: clover, at: S.at('buddy'), style: 'label' });
  S.camera('push', { on: box(-3.0, 0, -3.8, 1.6, 1.7, -.4), yaw: -8, fill: VERT ? 1.05 : .7 });
  return { daisy, clover };
} });

// ---- 3: grazing side by side ----
shot({ say: 'and grazes right', set: 'farm', build(S) {
  naturalColours(S);
  const daisy = S.animal(COW, { name: 'Daisy', at: [-.7, 0, -2.2], ry: .15, clip: 'Eating' });
  const clover = S.animal(COW, { name: 'Clover', at: [.7, 0, -2.5], ry: .05, clip: 'Eating', phase: .45 });
  if (VERT) S.camera('push', { on: box(-1.2, 0, -3.9, 1.2, 1.6, -.8), yaw: 32, fill: 1.1, drift: .18 });
  else S.camera('low', { on: box(-1.2, 0, -3.9, 1.2, 1.6, -.8), yaw: -24, fill: .7, drift: .18 });
  return { daisy, clover };
} });

// ---- 4: split up by the fence - her heart speeds up ----
shot({ say: 'Split them up', set: 'farm', build(S) {
  naturalColours(S);
  const daisy = S.animal(COW, { name: 'Daisy', at: [-.3, 0, -4.1], ry: .2, clip: 'Idle_Headlow' });
  const clover = S.animal(COW, { name: 'Clover', at: [.5, 0, -9.0], ry: 1.5, clip: 'Eating' });
  const h = floatingHeart(S, [-.3, 1.8, -4.5], S.at('heart'), { fast: S.at('faster'), rate: 2.4 });
  S.callout('heart rate', { on: h, at: S.at('heart') + .15, style: 'pixel', color: 'red', dy: -45 });
  S.camera('push', { on: box(-1.3, 0, -5.4, .9, 2.7, -2.8), yaw: -10, fill: VERT ? .95 : .8, push: .07 });
  return { daisy, clover };
} });

// ---- 5: back together - she calms down ----
shot({ say: 'Put them back', set: 'farm', build(S) {
  naturalColours(S);
  const daisy = S.animal(COW, { name: 'Daisy', at: [-3.0, 0, -4.7], ry: 1.0, clip: 'Idle' });
  const clover = S.animal(COW, { name: 'Clover', at: [.5, 0, -2.6], ry: 0, clip: 'Idle_2' });
  daisy.walk([[-1.0, -3.5], [-1.0, -2.3]], { at: S.t0 + .1, clip: 'Walk', pace: 1 });
  const h = floatingHeart(S, [-1.0, 1.85, -1.6], S.at('calms') - .2, { over: daisy });
  S.callout('calm', { on: h, at: S.at('calms'), style: 'pixel', color: 'green', dy: -45 });
  S.camera('drift', { on: box(-3.0, 0, -4.8, 1.4, 2.7, -1.2), yaw: 16, fill: VERT ? 1.0 : .8, speed: -.22 });
  return { daisy, clover };
} });

// ---- 6: the farmer and a calm herd ----
shot({ say: 'A calm herd', set: 'farm', build(S) {
  naturalColours(S);
  const you = S.person({ ...HERO, name: 'the farmer', outfit: 'worker', face: 'happy', at: [.3, 0, -4.6], ry: .1 });
  you.do('KK_Wave', S.at('happy') - .2);
  for (const [x, z, ry, c] of [[-1.3, -8.6, .7, 'Eating'], [1.6, -9.8, -.6, 'Idle'], [-.2, -12.4, 2.4, 'Eating']]) S.animal(COW, { at: [x, 0, z], ry, clip: c, phase: z * -.07 });
  S.camera('push', { on: you, yaw: 6, fill: VERT ? .55 : .6, push: .05 });
  return { you };
} });
