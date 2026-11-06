// The shot language (token-cheap: a 60 s video is ~150 short lines). Grammar, one statement per line:
//   title THE LAKE'S THING       chapter header on every following shot (title - : none)
//   cast ali skin=tan hat=pith   a named character with default looks (any stickman key)
//   > narration for this shot    starts a new shot; the text is spoken while it is on screen
//   set field                    backdrop (sets.js)
//   card "August 21st, 1986" c=red     white frame with one big text (a date / number card)
//   <cast|man> <pos> k=v ...     a stickman: pose= e= look= dir=l size=S|M|L|XL s= hat= hair= skin= hold= hold2= wear= beard= glasses=1 on=rock|chair|log
//   <prop> <pos> k=v ...         a prop from props.js: s= c= flip=1 rot= text="..." len=
//   text "words" <pos> c= size=  a coloured label
//   photo <pos> img=name s= text="Lake Nyos"   a framed real photo (web_image) with a caption; set=sea instead of img= frames a mini backdrop
//   @word <any line above>       appears only once "word" is spoken in this shot (a beat)
// <pos>: L CL C CR R (on the ground) | x | x,y  (percent of the frame, y from the bottom)
import { THREE, P, W, H, col, inGroup, group, text, box, rect, shape, oval, circ, seg, image, rnd } from './paint.js';
import * as SPR from './sprites.js';
import { stickman, DIM, at, handOf } from './rig.js';
import { POSES } from './poses.js';
import { PROPS } from './props.js';
import { SETS } from './sets.js';

const NAMED = { L: 18, CL: 33, C: 50, CR: 67, R: 82, LL: 8, RR: 92 };
const SIZE = { XS: .45, S: .65, M: 1, L: 1.3 };
const MAN_KEYS = new Set(['desc', 'pose', 'e', 'look', 'dir', 'size', 's', 'hat', 'hair', 'hairc', 'skin', 'hold', 'hold2', 'wear', 'wearc', 'beard', 'glasses', 'on', 'back', 'ink', 'x', 'y', 'rot']);

function tokens(line) { const out = []; const re = /(\w+)="([^"]*)"|"([^"]*)"|(\S+)/g; let m; while ((m = re.exec(line))) out.push(m[1] ? `${m[1]}=${m[2]}` : m[3] !== undefined ? { str: m[3] } : m[4]); return out; }

// ctx carries the cast and the chapter title from one scene file to the next (scenes load in project.json order)
export const newContext = () => ({ cast: { man: {} }, title: '' });
export function parseScript(src, ctx = newContext()) {
  const sc = { cast: ctx.cast, shots: [], title: '' };
  let shot = null, title = ctx.title;
  src.split(/\r?\n/).forEach((raw, ln) => {
    let line = raw.replace(/\s+#.*$/, '').trim(); if (!line || line.startsWith('#')) return;
    if (line.startsWith('>')) { shot = { say: line.slice(1).trim(), set: null, items: [], beats: [], title, errors: [], line: ln + 1 }; sc.shots.push(shot); return; }
    const t = tokens(line);
    if (t[0] === 'title') { title = line.slice(5).trim(); if (title === '-') title = ''; if (shot && !shot.items.length && !shot.set) shot.title = title; return; }
    if (t[0] === 'cast') { sc.cast[t[1]] = kv(t.slice(2)); return; }
    if (!shot) return;
    let beat = 0;
    if (typeof t[0] === 'string' && t[0].startsWith('@')) { const w = t.shift().slice(1).toLowerCase(); let i = shot.beats.findIndex(b => b.word === w); if (i < 0) { shot.beats.push({ word: w }); i = shot.beats.length - 1; } beat = i + 1; }
    const head = t[0];
    const L = ln + 1;
    if (head === 'set') { if (!SETS[t[1]]) shot.errors.push(`line ${ln + 1}: unknown set "${t[1]}"`); shot.set = t[1]; return; }
    if (head === 'card') { shot.set = shot.set || 'white'; shot.items.push({ kind: 'text', str: t[1]?.str ?? '', pos: ['50', '55'], o: { size: 54, c: 'accent', ...kv(t.slice(2)) }, beat, line: L }); return; }
    if (head === 'text') { const { pos, o } = posKv(t.slice(2)); shot.items.push({ kind: 'text', str: t[1]?.str ?? '', pos, o, beat, line: L }); return; }
    if (head === 'photo') { const { pos, o } = posKv(t.slice(1)); shot.items.push({ kind: 'photo', pos, o, beat, line: L }); return; }
    if (sc.cast[head]) { const { pos, o } = posKv(t.slice(1)); for (const k of Object.keys(o)) if (!MAN_KEYS.has(k)) shot.errors.push(`line ${ln + 1}: unknown character key "${k}"`); const merged = { ...sc.cast[head], ...o };
      if (merged.pose && !POSES[merged.pose]) shot.errors.push(`line ${ln + 1}: unknown pose "${merged.pose}"`); shot.items.push({ kind: 'man', pos, o: merged, cast: head, beat, line: L }); return; }
    if (PROPS[head]) { const { pos, o } = posKv(t.slice(1)); shot.items.push({ kind: 'prop', name: head, pos, o, beat, line: L }); return; }
    shot.errors.push(`line ${ln + 1}: unknown "${head}"`);
  });
  for (const s of sc.shots) if (!s.set) s.set = 'white';
  ctx.title = title;
  return sc;
}
function kv(list) { const o = {}; for (const x of list) { if (typeof x !== 'string') continue; const i = x.indexOf('='); if (i > 0) o[x.slice(0, i)] = x.slice(i + 1); } return o; }
function posKv(list) { const pos = []; const rest = []; for (const x of list) (typeof x === 'string' && !x.includes('=') && pos.length < 1 ? pos : rest).push(typeof x === 'string' && !x.includes('=') && pos.length < 1 ? x : x); return { pos: pos.length ? String(pos[0]).split(',') : [], o: kv(rest) }; }
const num = (v, d) => v === undefined || v === '' ? d : +v;
function xy(pos, o, gy) {
  let x = 50, y = null;
  if (pos.length) { x = NAMED[pos[0]] ?? +pos[0]; if (pos[1] !== undefined && pos[1] !== '') y = +pos[1]; }
  if (o.x !== undefined) x = +o.x; if (o.y !== undefined) y = +o.y;
  return [x / 100 * W, y === null ? gy : y / 100 * H, y === null];
}

// web photos (IMG from the engine's loadImages) and the "More details" setting
let PHOTOS = {}, DETAIL = false; const PHOTO_TEX = new Map();
export function setPhotos(map) { PHOTOS = map || {}; }
export function setDetail(on) { DETAIL = !!on; }
const OUTDOOR = new Set(['field', 'plains', 'desert', 'snow', 'mountains', 'forest', 'jungle', 'village', 'town', 'beach', 'storm', 'arena', 'volcanic']);
function dress(set, gy) {                                    // More details: a little extra life in the backdrop, seeded per shot
  if (!OUTDOOR.has(set)) return;
  if (set !== 'storm' && set !== 'volcanic') for (let i = 0; i < 2; i++) PROPS.cloud.draw({ x: 80 + rnd() * 800, y: 400 + rnd() * 90, s: .45 + rnd() * .3 });
  if (set !== 'storm') for (let i = 0; i < 3; i++) PROPS.bird.draw({ x: 120 + rnd() * 700, y: 360 + rnd() * 120, s: .6 + rnd() * .4 });
  const ground = set === 'desert' || set === 'beach' ? ['rock', 'rock'] : set === 'snow' ? ['rock', 'pine'] : ['bush', 'rock', 'stump'];
  for (let i = 0; i < 3; i++) { const n = ground[i % ground.length]; PROPS[n].draw({ x: 40 + rnd() * 880, y: Math.max(8, gy - 40 - rnd() * 40), s: n === 'pine' ? .4 : .32 + rnd() * .2 }); }
}
// returns one { item, g } per drawn element (the engine turns them into click boxes with the element's script line)
export function drawShot(sc, shot, beat, root) {
  const drawn = [];
  inGroup(root, () => {
    const gy = SETS[shot.set]?.() ?? 60;
    if (DETAIL) dress(shot.set, gy);
    for (const it of shot.items) { if (it.beat > beat) continue; try { drawn.push({ item: it, g: group(0, 0, 1, 1, 0, () => drawItem(it, gy)) }); } catch (e) { console.error(`line ${it.line}: ${e.message}`); } }
    if (shot.title) drawn.push({ item: { kind: 'text', str: shot.title, line: shot._line ?? shot.line }, g: group(0, 0, 1, 1, 0, () =>   // clickable too
      text(shot.title.toUpperCase(), W / 2, H - 20, { size: 24, bold: false, color: 'black', outline: shot.set === 'night' || shot.set === 'space' || shot.set === 'underwater' || shot.set === 'cave' ? 'white' : null })) });
  });
  return drawn;
}

function drawItem(it, gy) {
  const o = it.o;
  if (it.kind === 'text') { const [x, y, ground] = xy(it.pos, o, gy); text(it.str, x, ground ? H * .82 : y, { size: num(o.size, 40), color: col(o.c || 'accent'), outline: o.outline === 'none' ? null : o.outline || undefined, rot: num(o.rot, 0) }); return; }
  if (it.kind === 'photo') { const [x, y0, ground] = xy(it.pos, o, gy), s = num(o.s, o.img ? .5 : .38), w = W * s, h = H * s, y = ground ? H * .55 : y0;
    const im = o.img && PHOTOS[o.img];
    if (im) { let tex = PHOTO_TEX.get(o.img); if (!tex) { tex = new THREE.Texture(im); tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true; PHOTO_TEX.set(o.img, tex); }
      const ia = (im.naturalWidth || im.width) / (im.naturalHeight || im.height), fa = w / h;   // cover the frame, centred
      if (ia > fa) { tex.repeat.set(fa / ia, 1); tex.offset.set((1 - fa / ia) / 2, 0); } else { tex.repeat.set(1, ia / fa); tex.offset.set(0, (1 - ia / fa) / 2); }
      rect(x - w / 2, y - h / 2, w, h, P.black); image(tex, x, y - h / 2, w, h); }
    else if (o.img) { rect(x - w / 2, y - h / 2, w, h, P.silver); text('?', x, y, { size: 60, color: 'gray', outline: null }); console.warn(`photo img=${o.img}: no such image (make it with web_image first)`); }
    else group(x - w / 2, y - h / 2, s, s, 0, () => { SETS[o.set || 'field']?.(); if (o.prop && PROPS[o.prop]) PROPS[o.prop].draw({ x: W / 2, y: 140, s: 1.4 }); });
    for (const [a, b, c, d] of [[-10, -10, w + 20, 12], [-10, h - 2, w + 20, 12], [-10, -10, 12, h + 20], [w - 2, -10, 12, h + 20]]) rect(x - w / 2 + a, y - h / 2 + b, c, d, P.white);
    for (const [a, b, c, d] of [[-12, -12, w + 24, 3], [-12, h + 9, w + 24, 3], [-12, -12, 3, h + 24], [w + 9, -12, 3, h + 24]]) rect(x - w / 2 + a, y - h / 2 + b, c, d, P.black);
    if (o.text) text(o.text, x, y + h / 2 - 24, { size: 26, color: col(o.c || 'accent') }); return; }
  if (it.kind === 'prop' && SPR.has(it.name) && drawAnimal(it, gy)) return;
  if (it.kind === 'prop') { const p = PROPS[it.name]; const [x, y, ground] = xy(it.pos, o, gy); p.draw({ ...o, x, y: ground && p.float ? H * .6 : y, s: num(o.s, 1), c: o.c, flip: o.flip === '1', rot: num(o.rot, 0), text: o.text, len: num(o.len, undefined), r: num(o.r, undefined), size: num(o.size, undefined) }); return; }
  if (it.kind === 'man') { if (!(SPR.has(it.cast) && drawSpriteMan(it, gy))) drawMan(o, it.pos, gy); }
}

// ---- sprite figures (lib/sprites) ----
const ANIMAL_H = { emu: 230, goat: 150, mammoth: 300, horse: 220, cow: 170, dog: 110 };
function drawAnimal(it, gy) {
  const o = it.o, k = o.v || (o.run ? 'run' : o.helmet ? 'helmet' : o.crown ? 'crown' : (it.name === 'goat' && o.rot) ? 'dance' : o.e || 'stand');
  const p = SPR.pick(it.name, k); if (!p) return false;
  const [x, y] = xy(it.pos, o, gy), s = num(o.s, 1) * (k === 'dance' ? 1.3 : 1), h = (ANIMAL_H[it.name] || 200) * s, w = h * p.w / p.h;
  image(p.tex, x, y - 4 * s, w, h, o.flip === '1', it.name === 'goat' && o.rot ? 0 : num(o.rot, 0));
  return true;
}
function drawSpriteMan(it, gy) {
  const o = it.o, xl = o.size === 'XL', p = SPR.pick(it.cast, SPR.keyOf(o.pose || 'stand', o.e || 'neutral', o.hold, o.hold2, xl)); if (!p) return false;
  const s = num(o.s, xl ? 2.5 : SIZE[o.size] ?? 1); const [x, y, ground] = xy(it.pos, o, gy);
  const side = POSES[o.pose || 'stand']?.view === 'side', flip = side && o.dir === 'l';
  if (xl) { const h = H * .8 * s / 2.5, w = h * p.w / p.h; image(p.tex, x, 0, w, h, false); return true; }
  const h = SPR.heightOf(p, s), w = h * p.w / p.h;
  image(p.tex, x, ground ? y - 3 * s : y, w, h, flip);
  return true;
}

function drawMan(o, pos, gy) {
  const pose = POSES[o.pose || 'stand'] || POSES.stand, xl = o.size === 'XL';
  const s = num(o.s, xl ? 2.5 : SIZE[o.size] ?? 1);
  let [x, y, ground] = xy(pos, o, gy);
  const look = { ...o, s, glasses: o.glasses === '1', x, y };
  if (xl) { look.y = H * .54 - (DIM.spine + DIM.neck + DIM.R) * s; const m = stickman(look); return m; }
  if (!ground) { return stickman(look); }
  if (pose.plant === 'seat') {
    const m = stickman({ ...look, y: 0 }); const lo = lowest(m, 'feet'), h = -lo; m.root.position.y = gy + h - 2; m.root.updateMatrixWorld(true);
    // seat under the pelvis (drawn behind the figure)
    const seat = o.on || 'rock', top = gy + h - 4, sw = 34 * s;
    const sx = x - (pose.view === 'side' ? 6 * s * (o.dir === 'l' ? -1 : 1) : 0);
    if (seat !== 'none') { const g = m.root.parent; const idx = g.children.indexOf(m.root); const tmp = []; // draw seat then move it before the man
      const before = g.children.length;
      if (seat === 'chair') { box(sx - sw, top - 8 * s, sw * 2, 8 * s, P.lbrown, 3, 0); seg([sx - sw + 4, gy], [sx - sw + 4, top - 8 * s], 5, P.brown); seg([sx + sw - 4, gy], [sx + sw - 4, top - 8 * s], 5, P.brown); }
      else if (seat === 'log') { box(sx - sw * 1.3, gy, sw * 2.6, top - gy, P.brown, 3, .6); oval(sx + sw * 1.3, (gy + top) / 2, 8 * s, (top - gy) / 2, P.tan, 3); }
      else shape([[sx - sw * 1.3, gy], [sx - sw * 1.2, top - 6], [sx - sw * .4, top + 2], [sx + sw * .6, top + 1], [sx + sw * 1.25, top - 8], [sx + sw * 1.3, gy]], P.gray, 3, 1);
      const added = g.children.splice(before); g.children.splice(idx, 0, ...added); let r = 0; g.traverse(c => { if (c.isMesh) c.renderOrder = r++; }); }
    return m;
  }
  const m = stickman({ ...look, y: 0 });
  const lo = lowest(m, pose.plant === 'lie' ? 'all' : 'feet'); m.root.position.y = gy - lo + 2.5; m.root.updateMatrixWorld(true);
  return m;
}
export function lowest(m, mode) {
  let lo = Infinity; const L = (b, y) => lo = Math.min(lo, at(m, b, 0, y).y);
  for (const k of ['L', 'R']) { L('foot' + k, 0); L('foot' + k, -DIM.foot); L('shin' + k, 0); if (mode === 'all') { L('fore' + k, -DIM.fore); L('upper' + k, 0); } }
  if (mode === 'all') { L('head', 0); const c = at(m, 'head', 0, DIM.R); lo = Math.min(lo, c.y - DIM.R * m.s); L('spine', 0); }
  return lo;
}
