// Big-head stickman rig. A real bone hierarchy (one THREE.Group per bone, limb meshes parented to bones);
// a pose is joint angles (degrees) from poses.js. Faces, hair, hats and held items are layered on top.
import { THREE, P, D, col, dot, seg, stroke, fill, shape, oval, box, circ, line, tube, group, inGroup, parent, text } from './paint.js';
import { POSES } from './poses.js';
import { ITEMS } from './items.js';

export const DIM = { R: 40, spine: 72, neck: 6, upper: 46, fore: 44, thigh: 48, shin: 46, foot: 11 };
export const LW = 5; // body line width
const SKIN = { white: P.white, light: P.skin, tan: P.skin2, brown: P.skin3, dark: P.skin4, green: '#80c080', gray: P.silver, blue: '#a0c0ff' };

// world position of a point given in a bone's local frame
export const at = (man, bone, x, y) => new THREE.Vector3(x, y, 0).applyMatrix4((man.root.updateMatrixWorld(true), man.B[bone].matrixWorld));
export const handOf = (man, k) => at(man, 'fore' + k, 0, -DIM.fore * (man.len['fore' + k] ?? 1));

export function stickman(o) {
  const pose = POSES[o.pose || 'stand'] || POSES.stand, side = pose.view === 'side';
  const s = o.s || 1, facing = o.dir === 'l' ? -1 : 1;
  const root = new THREE.Group(); root.position.set(o.x || 0, o.y || 0, 0); root.scale.set(facing * s, s, 1); root.rotation.z = (pose.rot || 0) * D * facing; parent().add(root);
  const B = { pelvis: root }, len = { ...(pose.len || {}) };
  const bone = (name, par, ox, oy) => { const g = new THREE.Group(); g.position.set(ox, oy, 0); par.add(g); B[name] = g; };
  bone('spine', root, 0, 0); bone('neck', B.spine, 0, DIM.spine * (len.spine ?? 1)); bone('head', B.neck, 0, DIM.neck);
  for (const k of ['L', 'R']) {
    bone('upper' + k, B.spine, 0, DIM.spine * (len.spine ?? 1) - 3); bone('fore' + k, B['upper' + k], 0, -DIM.upper * (len['upper' + k] ?? 1));
    bone('thigh' + k, root, 0, 0); bone('shin' + k, B['thigh' + k], 0, -DIM.thigh * (len['thigh' + k] ?? 1)); bone('foot' + k, B['shin' + k], 0, -DIM.shin * (len['shin' + k] ?? 1));
  }
  for (const [k, v] of Object.entries(pose.a)) if (B[k]) B[k].rotation.z = v * D;
  const man = { root, B, len, pose, side, o, facing, s };
  const ink = col(o.ink || 'black'), lw = LW;
  const limb = (name, l) => seg([0, 0], [0, -l * (len[name] ?? 1)], lw, ink, B[name]);
  const leg = k => { limb('thigh' + k, DIM.thigh); limb('shin' + k, DIM.shin); if (side || pose.feet) limb('foot' + k, DIM.foot); };
  const arm = k => { limb('upper' + k, DIM.upper); limb('fore' + k, DIM.fore); };
  // far side first (side view: R is the far side; front view: draw order R then L doesn't matter)
  if (o.back) inGroup(B.spine, () => ITEMS.backpack?.(o.back));
  // arms hang beside/behind the big head; only poses that touch the face put the near hand over it
  const front = (pose.touch || []).includes('head');
  leg('R'); arm('R'); if (o.hold2) holdItem(man, 'R', o.hold2);
  seg([0, 0], [0, DIM.spine * (len.spine ?? 1)], lw, ink, B.spine); seg([0, 0], [0, DIM.neck], lw, ink, B.neck);
  if (o.wear) inGroup(B.spine, () => ITEMS['wear_' + o.wear]?.(side, o.wearc ? col(o.wearc) : undefined));
  leg('L');
  if (!front) { arm('L'); if (o.hold) holdItem(man, 'L', o.hold); }
  head(man);
  if (front) { arm('L'); if (o.hold) holdItem(man, 'L', o.hold); }
  root.updateMatrixWorld(true);
  return man;
}

function holdItem(man, k, name) {
  // the item is a child of the figure's root, so it moves with the figure when the scene plants it on the ground
  const it = ITEMS[name]; if (!it) return;
  man.root.updateMatrixWorld(true);
  const hw = handOf(man, k), ew = at(man, 'fore' + k, 0, 0), h = man.root.worldToLocal(hw.clone()), e = man.root.worldToLocal(ew.clone());
  const g = new THREE.Group(); man.root.add(g); g.position.set(h.x, h.y, 0);
  if (it.mode === 'along') g.rotation.z = Math.atan2(h.y - e.y, h.x - e.x) - Math.PI / 2;
  else g.rotation.z = -(man.pose.rot || 0) * D;
  inGroup(g, () => it.draw());
  dot(0, 0, LW * .8, 'black', g); // the hand over the grip
}

// ---------- head, face, hair, hats ----------
function head(man) {
  const { B, o, side } = man, R = DIM.R, h = B.head, skin = col(SKIN[o.skin] || o.skin || P.white);
  inGroup(h, () => {
    if (o.hair) HAIR[o.hair]?.(R, side, col(o.hairc || 'black'), 'back');
    if (o.hat && HATS_BACK[o.hat]) HATS_BACK[o.hat](R, side);
    dot(0, R, R + 2.5, 'black'); dot(0, R, R - 1.5, skin);
    if (o.hair) HAIR[o.hair]?.(R, side, col(o.hairc || 'black'), 'front');
    face(R, side, o.e || 'neutral', o.look || '', o);
    if (o.beard) beard(R, side, col(o.hairc || 'black'), o.beard);
    if (o.glasses) glasses(R, side);
    if (o.hat) HATS[o.hat]?.(R, side);
  });
}

// expressions: neutral talk smile happy shock scared worried angry sad smug confused dead sleep think yell
function face(R, side, e, look, o) {
  const E = side ? [[R * .45, R * 1.18]] : [[-R * .36, R * 1.16], [R * .36, R * 1.16]];
  const er = R * (e === 'shock' || e === 'scared' ? .34 : .29);
  const lk = { l: [-1, 0], r: [1, 0], u: [0, 1], d: [0, -1], '': side ? [1, 0] : [0, 0] }[look] || [0, 0];
  const pr = e === 'shock' || e === 'scared' ? er * .32 : er * .45;
  for (const [x, y] of E) {
    if (e === 'dead') { stroke([[x - er * .8, y - er * .8], [x + er * .8, y + er * .8]], 3); stroke([[x - er * .8, y + er * .8], [x + er * .8, y - er * .8]], 3); continue; }
    if (e === 'happy' || e === 'sleep') { stroke(circ(x, y - er * .3, er * .8, er * .7, 8, e === 'sleep' ? 200 : 20, e === 'sleep' ? 340 : 160), 3, 'black'); continue; }
    dot(x, y, er + 2, 'black'); dot(x, y, er - .5, 'white');
    dot(x + lk[0] * er * .45, y + lk[1] * er * .45, pr, 'black');
    if (e === 'smug' || e === 'think') fill([[x - er - 2, y + er * .1], [x + er + 2, y + er * .1], [x + er + 2, y + er + 3], [x - er - 2, y + er + 3]], 'white'), stroke([[x - er, y + er * .1], [x + er, y + er * .1]], 3);
  }
  // brows
  const brow = (x, y, tilt, i) => { const s = side ? 1 : (i ? 1 : -1), b = er * 1.05; stroke([[x - b, y + er * 1.45 + (s < 0 ? tilt : -tilt) * er], [x + b, y + er * 1.45 + (s < 0 ? -tilt : tilt) * er]], 3); };
  const T = { angry: .5, worried: -.45, sad: -.5, scared: -.4, confused: 0, think: .15, yell: .4, smug: 0 }[e];
  if (T !== undefined) E.forEach(([x, y], i) => e === 'confused' && i === 0 ? stroke([[x - er, y + er * 1.9], [x + er, y + er * 1.5]], 3) : brow(x, y, T, i));
  // mouth
  const mx = side ? R * .62 : 0, my = R * .52;
  const openMouth = (w, h) => { const q = circ(mx, my, w, h, 22); fill(q, P.maroon); stroke(q, 3, 'black', true); fill(circ(mx + (side ? 1 : 0), my - h * .45, w * .62, h * .38, 14, 180, 360).concat([[mx - w * .6, my - h * .4]]), P.pink); };
  if (e === 'talk' || e === 'yell') openMouth(R * (e === 'yell' ? .32 : .24), R * (e === 'yell' ? .28 : .2));
  else if (e === 'shock' || e === 'scared') openMouth(R * .24, R * .32);
  else if (e === 'smile') stroke(circ(mx, my + R * .12, R * .28, R * .2, 10, 200, 340), 3);
  else if (e === 'happy') { const q = circ(mx, my + R * .1, R * .3, R * .26, 16, 180, 360); fill(q, P.maroon); stroke(q.concat([q[0]]), 3); }
  else if (e === 'sad' || e === 'angry') stroke(circ(mx, my - R * .12, R * .24, R * .16, 10, 20, 160), 3);
  else if (e === 'worried' || e === 'confused') stroke([[mx - R * .22, my], [mx - R * .08, my + R * .06], [mx + R * .08, my - R * .04], [mx + R * .22, my + R * .04]], 3);
  else if (e === 'smug') stroke([[mx - R * .2, my + R * .02], [mx + R * .12, my], [mx + R * .24, my + R * .1]], 3);
  else if (e === 'dead' || e === 'sleep' || e === 'think' || e === 'neutral') stroke([[mx - R * .16, my], [mx + R * .16, my]], 3);
  if (e === 'scared' || e === 'worried') { const sx = side ? -R * .55 : R * .75; fill([[sx, R * 1.75], [sx - 6, R * 1.45], [sx + 6, R * 1.45]], P.blue); dot(sx, R * 1.43, 6, P.blue); }
}
function beard(R, side, c, kind) {
  if (kind === 'stache') { const y = R * .74; fill(circ(side ? R * .55 : 0, y, R * .32, R * .1, 16), c); return; }
  const q = side ? [[R * .9, R * .6], [R * .5, -R * .45], [-R * .2, R * .1], [R * .2, R * .45]] : circ(0, R * .25, R * .78, R * .72, 24, 195, 345);
  shape(side ? q : q.concat([[R * .55, R * .5], [R * .25, R * .32], [-R * .25, R * .32], [-R * .55, R * .5]]), c, 2, .6);
  const mx = side ? R * .62 : 0; stroke([[mx - R * .15, R * .52], [mx + R * .15, R * .52]], 3, 'white');
}
function glasses(R, side) {
  const E = side ? [[R * .45, R * 1.18]] : [[-R * .36, R * 1.16], [R * .36, R * 1.16]];
  E.forEach(([x, y]) => stroke(circ(x, y, R * .32, R * .26, 20), 3, 'black', true));
  if (!side) stroke([[-R * .05, R * 1.2], [R * .05, R * 1.2]], 3);
}
const HAIR = {
  spiky: (R, side, c, layer) => { if (layer !== 'front') return; for (const a of side ? [100, 125, 150] : [60, 80, 100, 120]) { const t = a * D; seg([Math.cos(t) * R, R + Math.sin(t) * R], [Math.cos(t) * (R + 12), R + Math.sin(t) * (R + 12)], 3, c); } },
  tuft: (R, side, c, layer) => { if (layer === 'front') for (const a of [85, 100]) { const t = (a + (side ? 20 : 0)) * D; seg([Math.cos(t) * R, R + Math.sin(t) * R], [Math.cos(t) * (R + 10), R + Math.sin(t) * (R + 13)], 3, c); } },
  long: (R, side, c, layer) => {
    if (layer === 'back') { fill(side ? [[-R * 1.05, R * 1.3], [R * .2, R * 2.05], [-R * .1, -R * .55], [-R * 1.15, -R * .4]] : [[-R * 1.12, R * 1.2], [R * 1.12, R * 1.2], [R * 1.2, -R * .45], [-R * 1.2, -R * .45]], c); return; }
    fill(circ(side ? -R * .12 : 0, R * 1.12, R * 1.06, R * .98, 24, side ? 70 : 15, side ? 200 : 165).concat(side ? [[-R * .4, R * 1.2]] : [[R * .3, R * 1.55], [-R * .3, R * 1.55]]), c);
  },
  bun: (R, side, c, layer) => { if (layer !== 'front') return; dot(side ? -R * .55 : 0, R * 2.15, R * .38, c); fill(circ(0, R * 1.1, R * 1.03, R * .98, 22, side ? 80 : 25, side ? 190 : 155), c); },
  bald: () => {},
  cap: (R, side, c, layer) => { if (layer === 'front') fill(circ(0, R * 1.05, R * 1.03, R, 24, side ? 70 : 20, side ? 200 : 160), c); },
};
const HATS = {
  pith: (R) => { oval(0, R * 1.62, R * 1.35, R * .22, P.tan, 2.5); shape(circ(0, R * 1.68, R * .95, R * .75, 20, 0, 180), P.tan, 2.5, .5); stroke([[-R * .9, R * 1.75], [R * .9, R * 1.75]], 2.5, P.lbrown); },
  fisher: (R) => { shape([[-R * 1.45, R * 1.35], [R * 1.45, R * 1.35], [R * .85, R * 1.75], [-R * .85, R * 1.75]], P.yellow, 2.5, .5); shape(circ(0, R * 1.72, R * .88, R * .72, 20, 0, 180), P.yellow, 2.5, .5); },
  viking: (R) => { tube([[-R * .8, R * 1.7], [-R * 1.3, R * 2.1], [-R * 1.2, R * 2.6]], 6, P.white); tube([[R * .8, R * 1.7], [R * 1.3, R * 2.1], [R * 1.2, R * 2.6]], 6, P.white); shape(circ(0, R * 1.45, R * 1.05, R * .95, 22, 0, 180), P.silver, 3, .5); stroke([[-R * 1.05, R * 1.45], [R * 1.05, R * 1.45]], 5, P.gray); },
  crown: (R) => shape([[-R * .8, R * 1.75], [R * .8, R * 1.75], [R * .9, R * 2.45], [R * .45, R * 2.05], [0, R * 2.55], [-R * .45, R * 2.05], [-R * .9, R * 2.45]], P.gold, 2.5, .4),
  cowboy: (R) => { shape([[-R * 1.6, R * 1.55], [-R * .9, R * 1.75], [R * .9, R * 1.75], [R * 1.6, R * 1.55], [R * 1.2, R * 1.8], [-R * 1.2, R * 1.8]], P.lbrown, 2.5, .3); shape([[-R * .8, R * 1.75], [-R * .7, R * 2.45], [0, R * 2.3], [R * .7, R * 2.45], [R * .8, R * 1.75]], P.lbrown, 2.5, .4); stroke([[-R * .78, R * 1.9], [R * .78, R * 1.9]], 4, P.brown); },
  top: (R) => { box(-R * 1.25, R * 1.62, R * 2.5, R * .2, 'black', 0, 0); box(-R * .75, R * 1.7, R * 1.5, R * 1.2, 'black', 0, 0); box(-R * .75, R * 1.78, R * 1.5, R * .2, P.red, 0, 0); },
  wizard: (R) => { shape([[-R * 1.4, R * 1.55], [R * 1.4, R * 1.55], [R * .2, R * 3.3]], P.navy, 3, .6); dot(-R * .2, R * 2.1, 4, P.yellow); dot(R * .3, R * 2.5, 3, P.yellow); },
  helmet: (R) => { shape(circ(0, R * 1.3, R * 1.12, R * 1.05, 22, 0, 180), P.silver, 3, .4); stroke([[-R * 1.2, R * 1.3], [R * 1.2, R * 1.3]], 5, P.gray); },
  conquistador: (R) => { shape([[-R * 1.4, R * 1.5], [R * 1.4, R * 1.5], [R * .9, R * 1.75], [-R * .9, R * 1.75]], P.silver, 2.5, .3); shape(circ(0, R * 1.7, R * .9, R * .75, 20, 0, 180).concat([[R * .3, R * 2.6], [-R * .1, R * 2.5]]), P.silver, 2.5, .3); dot(R * .5, R * 2.55, 7, P.red); },
  feather: (R) => { stroke([[-R * 1.02, R * 1.35], [R * 1.02, R * 1.35]], 7, P.red); shape([[R * .55, R * 1.45], [R * 1.0, R * 2.6], [R * .75, R * 2.55]], P.white, 2, .3); },
  cap: (R, side) => { shape(circ(0, R * 1.5, R * 1.02, R * .75, 22, 0, 180), P.blue, 2.5, .4); shape([[R * .3, R * 1.48], [R * 1.75, R * 1.42], [R * 1.6, R * 1.6], [R * .3, R * 1.62]], P.blue, 2.5, .2); },
  hood: (R) => { stroke(circ(0, R, R * 1.02, R * 1.02, 24, -30, 210), 9, P.brown); stroke(circ(0, R, R * 1.18, R * 1.2, 24, -30, 210), 3, 'black'); },
  chef: (R) => { box(-R * .7, R * 1.65, R * 1.4, R * .5, 'white', 2.5, .3); oval(-R * .4, R * 2.35, R * .45, R * .4, 'white', 2.5); oval(R * .4, R * 2.35, R * .45, R * .4, 'white', 2.5); oval(0, R * 2.55, R * .5, R * .42, 'white', 2.5); },
  hardhat: (R) => { shape(circ(0, R * 1.55, R * 1.0, R * .82, 22, 0, 180), P.yellow, 2.5, .4); stroke([[-R * 1.25, R * 1.55], [R * 1.25, R * 1.55]], 5, P.gold); },
  mitre: (R) => { shape([[-R * .75, R * 1.62], [R * .75, R * 1.62], [R * .6, R * 2.5], [0, R * 3.05], [-R * .6, R * 2.5]], P.white, 3, .4); seg([0, R * 1.9], [0, R * 2.6], 4, P.gold); seg([-R * .2, R * 2.35], [R * .2, R * 2.35], 4, P.gold); },
  turban: (R) => { shape(circ(0, R * 1.62, R * 1.12, R * .62, 26, -15, 195), P.white, 3, .5); stroke([[-R * .9, R * 1.6], [R * .5, R * 2.05]], 2, P.silver); stroke([[-R * .7, R * 1.85], [R * .8, R * 1.7]], 2, P.silver); dot(0, R * 1.78, 5, P.red); },
  laurel: (R) => { for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const t = (150 - i * 22) * D; oval(s * Math.cos(t) * R * 1.02, R + Math.sin(t) * R * 1.02, 7, 4, P.green, 1.5); } },
};
// hats with a part behind the head (drawn before the head circle)
const HATS_BACK = { hood: (R) => shape(circ(0, R * .95, R * 1.3, R * 1.32, 28, -50, 230).concat([[R * .8, -R * .55], [-R * .8, -R * .55]]), P.brown, 3, .5) };
export const HAT_NAMES = Object.keys(HATS), HAIR_NAMES = Object.keys(HAIR), SKIN_NAMES = Object.keys(SKIN);
export const EXPRESSIONS = ['neutral', 'talk', 'smile', 'happy', 'shock', 'scared', 'worried', 'angry', 'sad', 'smug', 'confused', 'dead', 'sleep', 'think', 'yell'];
