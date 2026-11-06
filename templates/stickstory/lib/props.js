// Stick stories PROPS: every object a story needs, drawn in code in the references' flat-vector look (analysis/sets/NOTES.md
// section 4: flat fills, a 0.84x second face, 0.77x thin edge lines, tiny highlights, no black outlines; timeloop's
// storybook look with style: 'outline' | 'silhouette'; time of day with mood: 'day' | 'dusk' | 'night' | 'candle').
// Owned by the prop agent; the drawing kit is lib/props/kit.js, the groups lib/props/*.js.
//
// Contract the engine and the other libraries rely on:
//   REG = { name: { tags, desc, make(o) } }   make(name, o) -> THREE.Group   place(S, name, o) -> the group, added to S
//   propNames(tag?)   propTags()
// A prop is a card standing on y = 0 (origin at its bottom centre; wall things and pendants say so in their desc), facing
// the camera, in metres for a 1.70 m adult. userData (own space, see seatOf / topOf / gripOf for world values):
//   size { w, h }        grips { name: [x, y] } where a hand holds it (+ points { name: [x, y] }: ear, screen, spout...)
//   seat { x, y, z, depth, facing } / seats [...]        top { y, x0, x1, z, front, back }        lie { x0, x1, y, z, head }
//   front: a child Group drawn in front of a sitter / lier     screen: the screen's canvas texture (phones, monitors, TVs)
//   update(t): only on props with moving parts (clocks, blinking lights, spinning wheels)
// Options every prop takes: scale, facing (1 | -1: mirror; text stays readable), mood, style ('flat' | 'outline' |
// 'silhouette'), tint ([hex, k]), color (the main colour), seed, detail ('low' | 'normal' | 'high': close-up detail).
import { THREE } from './core.js';
import { REG as FURNITURE } from './props/furniture.js';
import { REG as HANDHELD } from './props/handheld.js';
import { REG as TECH } from './props/tech.js';
import { REG as HOME } from './props/home.js';
import { REG as STREET } from './props/street.js';
import { layDown } from './props/kit.js';
export { PAL, toneOf, drawScreen, screenTexture, layDown } from './props/kit.js';
export { clockHands } from './props/handheld.js';

export const REG = { ...FURNITURE, ...HANDHELD, ...TECH, ...HOME, ...STREET };
// short names people (and builder Claudes) reach for first
const ALIAS = {
  kitchenChair: ['chair', {}], diningChair: ['chair', {}], swivelChair: ['officeChair', {}], barStool: ['stool', { variant: 'bar' }],
  parkBench: ['bench', { variant: 'park' }], lockerBench: ['bench', { variant: 'locker' }], couch: ['sofa', {}],
  hospitalBed: ['bed', { variant: 'hospital' }], singleBed: ['bed', { variant: 'single' }], kitchenTable: ['table', { variant: 'kitchen' }],
  diningTable: ['table', { variant: 'dining' }], coffeeTable: ['table', { variant: 'coffee' }], officeDesk: ['desk', { variant: 'office' }],
  schoolDesk: ['desk', { variant: 'school' }], bar: ['counter', { variant: 'bar' }], bookshelf: ['shelf', { variant: 'book' }], lamp: ['tableLamp', {}],
  smartphone: ['phone', {}], cellphone: ['phone', {}], computer: ['monitor', {}], screen: ['monitor', {}], notepad: ['notebook', {}], document: ['paper', {}],
  letter: ['envelope', {}], note: ['stickyNote', {}], coffee: ['mug', { steam: true }], police: ['policeCar', {}], bicycle: ['bike', {}],
  streetLight: ['lampPost', {}], trash: ['trashCan', {}], gift: ['giftBox', {}], cash: ['money', {}], photo: ['pictureFrame', {}],
  drawing: ['pictureFrame', { picture: 'drawing', frame: false }], blueprint: ['pictureFrame', { picture: 'blueprint' }], frame: ['pictureFrame', {}],
  wallClock: ['clock', {}], deskClock: ['alarmClock', {}], cabinet: ['wallCabinet', {}], fireHydrant: ['hydrant', {}], trafficCone: ['cone', {}],
  teddyBear: ['teddy', {}], sedan: ['car', {}], motorcycle: ['motorbike', {}],
};
const resolveName = (name, o) => { if (REG[name]) return [name, o]; const a = ALIAS[name]; return a && REG[a[0]] ? [a[0], { ...a[1], ...o }] : [null, o]; };
export const propNames = tag => Object.keys(REG).filter(n => !tag || REG[n].tags?.includes(tag));
export const propTags = () => [...new Set(Object.values(REG).flatMap(r => r.tags || []))].sort();
export const aliases = () => ({ ...ALIAS });

/** build one prop: make('mug', { color: '#c65c46', label: 'MORNING', steam: true }) */
export function make(name, o = {}) {
  const [n, opts] = resolveName(name, o);
  if (!n) { console.warn(`unknown prop "${name}": a box (props: ${propNames().length}, see propNames())`); return make('box', o); }
  const obj = REG[n].make(opts);
  if (o.lying && obj.userData.size && !obj.userData.lying) layDown(obj, o.lying === 'left' ? -1 : 1);
  obj.name = o.name || n; obj.userData.kind = n; obj.userData.pickRoot = true; obj.userData.isProp = true;
  if (o.scale) obj.scale.multiplyScalar(o.scale);
  return obj;
}
const spotOf = (S, at) => typeof at === 'string' ? (S.spots?.[at] ?? (console.warn(`prop: no spot "${at}"`), null)) : at;
/**
 * put a prop in a shot:
 *   S.prop('table', { at: [x, z] })            on the floor at x, depth z   (or [x, y, z]; or a spot name from S.place)
 *   S.prop('mug', { on: table, x: .3 })       standing on another prop's top (x: metres from the top's centre, or u: 0..1 across)
 *   S.prop('clock', { at: [x, y, z] })        wall things: y is the centre / hanging point (see the prop's desc)
 * Also: scale, facing, mood (default S.mood), dz (nudge toward the camera), any make() option.
 */
export function place(S, name, o = {}) {
  const at = spotOf(S, o.at);
  const opts = { ...o };
  if (opts.mood == null && S?.mood) opts.mood = S.mood;
  if (opts.facing == null && at && !Array.isArray(at) && at.facing != null) opts.facing = at.facing < 0 ? -1 : 1;
  const obj = typeof name === 'string' ? make(name, opts) : name;
  if (o.on) {
    const host = typeof o.on === 'string' ? S.props?.find(p => p.name === o.on || p.userData.kind === o.on) : o.on;
    const tp = host ? topOf(host) : null;
    if (tp) { const x = o.u != null ? tp.x0 + (tp.x1 - tp.x0) * o.u : (tp.x0 + tp.x1) / 2 + (o.x ?? 0);
      obj.position.set(x, tp.y + (o.dy ?? 0), tp.z + .004 + (o.dz ?? 0)); }
    else console.warn(`prop ${obj.name}: on: has no top`);
  } else if (Array.isArray(at)) {
    if (at.length === 2) obj.position.set(at[0], o.y ?? 0, at[1]); else obj.position.set(at[0], at[1] ?? 0, at[2] ?? 0);
    obj.position.z += o.dz ?? 0;
  } else if (at) { obj.position.set(at.x ?? 0, o.y ?? (at.kind === 'counter' || at.kind === 'table' ? at.topY ?? at.y ?? 0 : at.y ?? 0), (at.z ?? 0) + (o.dz ?? 0)); }
  if (o.rot) obj.rotation.z = o.rot;
  S.add(obj); (S.props ??= []).includes(obj) || S.props.push(obj);
  return obj;
}
// ---- world values of a placed prop (for the animation agent: sit, lie, put down, pick up) ----
const W = (obj, x, y, z = 0) => { obj.updateMatrixWorld(true); return new THREE.Vector3(x, y, z).applyMatrix4(obj.matrixWorld); };
/** a seat in world space: { x, y, z, depth, facing } (i: which seat of a sofa / bench; default userData.seat) */
export function seatOf(obj, i) {
  const s = i == null ? obj.userData.seat ?? obj.userData.seats?.[0] : obj.userData.seats?.[i] ?? obj.userData.seat; if (!s) return null;
  const p = W(obj, s.x, s.y, s.z ?? 0), k = obj.scale.y;
  // stool: no back (the sitter's facing wins); rung: the foot rung's world height (a stool too high for flat feet)
  return { x: p.x, y: p.y, z: p.z, depth: (s.depth ?? .4) * k, facing: (s.facing ?? 1) * Math.sign(obj.scale.x || 1),
    ...(s.stool ? { stool: true } : {}), ...(Number.isFinite(s.rung) ? { rung: W(obj, s.x, s.rung, s.z ?? 0).y } : {}) };
}
/** the top surface in world space: { y, x0, x1, z, front, back } */
export function topOf(obj) {
  const t = obj.userData.top; if (!t) return null;
  const a = W(obj, t.x0, t.y, t.z ?? 0), b = W(obj, t.x1, t.y, t.z ?? 0), k = obj.scale.y;
  return { y: a.y, x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z: a.z, front: obj.position.y + (t.front ?? t.y) * k, back: obj.position.y + (t.back ?? t.y) * k };
}
/** where someone lies on it in world space: { x0 (head end), x1, y, z, head } */
export function lieOf(obj) {
  const l = obj.userData.lie; if (!l) return null;
  const a = W(obj, l.x0, l.y, l.z ?? 0), b = W(obj, l.x1, l.y, l.z ?? 0);
  return { x0: a.x, x1: b.x, y: a.y, z: a.z, head: l.head, raised: l.raised ?? 0 };
}
/**
 * scene helpers (engine.js turns them into S.<name>(...)):
 *   S.seatOf(chair, i?)  S.topOf(table)  S.lieOf(bed)  S.gripOf(prop, 'hand')   world values (see above)
 *   S.dress([[name, o], ...])   place several props in one call; returns them in order
 */
export const S_HELPERS = {
  seatOf: (S, obj, i) => seatOf(obj, i), topOf: (S, obj) => topOf(obj), lieOf: (S, obj) => lieOf(obj), gripOf: (S, obj, n, local) => gripOf(obj, n, local),
  dress: (S, list) => list.map(it => Array.isArray(it) ? place(S, it[0], it[1] || {}) : place(S, it, {})),
};
/** a grip / point in world space (Vector3), or in the prop's own space with local = true */
export function gripOf(obj, name = 'hand', local = false) {
  const g = obj.userData.grips?.[name] ?? obj.userData.points?.[name] ?? obj.userData.grips?.hand ?? Object.values(obj.userData.grips || {})[0];
  if (!g) return null;
  return local ? new THREE.Vector3(g[0], g[1], 0) : W(obj, g[0], g[1], .01);
}
