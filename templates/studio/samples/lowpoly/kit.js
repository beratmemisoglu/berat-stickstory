// Low poly shorts - Studio kit: the style's elements one at a time, each on its usual ground (2 s a shot):
// the main character, a library animal, a named set, the kit heart (void), a kit chart (grid void), a kit sign, the
// number callout, the pixel label, the engine's own captions, the game-UI panel.
import { shot, preload, heart, bars, sign, THREE, VERT } from '../engine.js';
import { SET_NEEDS, PERSON_NEEDS } from '../lib/scan.js';
import { HERO } from '../models.js';

await preload([...SET_NEEDS.farm, ...SET_NEEDS.park, ...PERSON_NEEDS, 'animal.q.cow', 'anim.ual2', 'anim.kaykit_ue', 'prop.surv.bucket', 'prop.nature.crop_pumpkin']);

const COW = 'animal.q.cow';
const B = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
const M = c => new THREE.MeshStandardMaterial({ color: c, roughness: .9 });
/** the nature pack's teal leaves and salmon bark read as a broken palette: natural greens and wood brown (own copies).
 *  The farm set's procedural barn is taken out: its roof prism renders as a sideways black slab from every angle. */
function naturalColours(S) {
  const barn = S.scene.getObjectByName('barn'); if (barn) barn.parent.remove(barn);
  const to = { leafsGreen: 0x4c8a2e, grass: 0x5a9a34, woodBark: 0x7a5434, wood: 0x9a6a40, woodDark: 0x6e4a2c, leafsFall: 0xe8781c };
  S.scene.traverse(o => { if (!o.isMesh || Array.isArray(o.material) || !to[o.material?.name]) return; const m = o.material.clone(); m.color.set(to[m.name]); o.material = m; });
}

// ---- 1: the main character (the user's pick in Look > Main character) ----
shot({ t0: 0, set: 'studio', captions: false, build(S) {
  const you = S.person({ ...HERO, face: 'happy' }); you.do('KK_Wave', .3);
  S.camera('orbit', { on: you, fill: .78, speed: 10, yaw: -10 });
  return { you };
} });

// ---- 2: a library animal with its own clips ----
shot({ t0: 2, set: 'void-purple', captions: false, build(S) {
  const cow = S.animal(COW, { name: 'cow', ry: .6, clip: 'Eating' });
  S.camera('orbit', { on: cow, fill: VERT ? .58 : .72, speed: 12 });
  return { cow };
} });

// ---- 3: a named set (the farm: library trees, fence, pumpkins, sky, haze) ----
shot({ t0: 4, set: 'farm', captions: false, build(S) {
  naturalColours(S);
  S.camera('drift', { on: B(-3, 0, -9, 3, 2.5, -4), yaw: -10, fill: VERT ? 1.1 : .75, speed: .3 });
  S.wide = true;
  return {};
} });

// ---- 4: the kit heart on the red void ----
shot({ t0: 6, set: 'void-teal', captions: false, build(S) {
  const h = heart(), g = new THREE.Group(); g.add(h); g.name = 'heart'; S.add(g);
  S.tick(t => { g.scale.setScalar(4.5); g.rotation.y = t * .5; h.userData.beat(t * 2); });
  S.camera('push', { on: g, fill: VERT ? .4 : .6 });
  return { heart: g };
} });

// ---- 5: a kit chart on the grid void (on a low plinth: zero-height bars on the floor would z-fight) ----
shot({ t0: 8, set: 'void-grid', captions: false, build(S) {
  const plinth = S.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, .08, .9), M(0x1c3440))); plinth.position.y = .04; plinth.name = 'plinth';
  const c = bars([3, 6, 11], { at: 8.2, dur: .7, h: 1.8, colors: ['#36e24a', '#ffd21a', '#e8231d'] }); c.position.y = .09; S.add(c);
  S.camera('orbit', { on: B(-1.2, 0, -.45, 1.2, 1.9, .45), fill: VERT ? .45 : .7, speed: 8, yaw: -12 });
  return { chart: c, plinth };
} });

// ---- 6: a kit sign in the world (on its own post) ----
shot({ t0: 10, set: 'farm', captions: false, build(S) {
  naturalColours(S);
  const g = new THREE.Group(); g.name = 'milk sign'; g.userData.pickRoot = true; g.position.set(0, 0, -5.4);
  const post = new THREE.Mesh(new THREE.BoxGeometry(.1, 1.0, .1), M(0x6b4a2e)); post.position.set(0, .5, -.09); post.castShadow = true; g.add(post);
  const s = sign('FRESH MILK', { w: 1.5, h: .55, bg: '#1f5a8a', size: .42 }); s.position.set(0, 1.25, 0); g.add(s);
  S.add(g);
  const pail = S.prop('prop.surv.bucket', { at: [.8, -4.9], height: .4 });
  S.camera('push', { on: VERT ? B(-.8, 0, -5.6, .9, 1.6, -4.6) : B(-1, 0, -5.6, 1.1, 1.6, -4.6), yaw: -10, fill: VERT ? .75 : .7 });
  return { sign: g, pail };
} });

// ---- 7: the number callout (heavy number, outline + drop shadow) ----
shot({ t0: 12, set: 'farm', captions: false, build(S) {
  naturalColours(S);
  const cow = S.animal(COW, { name: 'cow', at: [0, 0, -2], ry: .5, clip: 'Idle' });
  S.callout('1', { on: cow, at: 12.25, color: 'yellow', sub: 'BEST FRIEND', dy: -60 });
  S.camera('push', { on: cow, yaw: 30, fill: VERT ? .5 : .62 });
  return { cow };
} });

// ---- 8: the pixel label on a prop ----
shot({ t0: 14, set: 'farm', captions: false, build(S) {
  const p = S.prop('prop.nature.crop_pumpkin', { at: [0, -1.5] });
  naturalColours(S);
  S.callout('pumpkin', { on: p, at: 14.2, style: 'pixel', color: 'green', dy: -40 });
  S.camera('insert', { on: p, fill: VERT ? .35 : .45, yaw: 20 });
  return { pumpkin: p };
} });

// ---- 9: the engine's captions (from the narration) on a moving shot ----
shot({ t0: 16, set: 'farm', build(S) {
  naturalColours(S);
  const a = S.animal(COW, { name: 'Daisy', at: [-.7, 0, -2.2], ry: .3, clip: 'Eating' });
  const b = S.animal(COW, { name: 'Clover', at: [.7, 0, -2.6], ry: -.1, clip: 'Idle_2' });
  S.camera('drift', { on: B(-1.3, 0, -3.9, 1.3, 1.6, -.8), yaw: -20, fill: VERT ? 1.1 : .72, speed: .18 });
  return { a, b };
} });

// ---- 10: the game-UI panel over a set ----
shot({ t0: 18, set: 'park', captions: false, build(S) {
  naturalColours(S);
  const you = S.person({ ...HERO, at: [VERT ? 0 : -.8, 0, 0], ry: .3 }); you.do('Idle_Talking_Loop', 18);
  S.panel({ title: 'CALM', sub: 'heart rate down', x: VERT ? 540 : 790, y: VERT ? 300 : 470, w: 560, h: 300, color: '#2186e8', at: 18.25 });
  S.camera('push', { on: you, yaw: -15, fill: VERT ? .5 : .78 });
  return { you };
} });
