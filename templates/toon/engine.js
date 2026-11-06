// Toon Studio engine - 3D toon shorts. Original big-headed cartoon characters with painted faces (expression sprites
// made with Google Flow), soft toon shading with ink outlines, dense dressed sets, depth of field and bloom, a camera
// that never quite stops, 5-7 frame dissolves, captions on 3 frames early. 9:16 (1080 x 1920) or 16:9: settings.format.
// The look was learned frame by frame from reference shorts (experiments/toon-style); every character, set and logo
// here is our own. Read the skill (.claude/skills/toon-shorts) before writing scenes: references/engine_api.md is the API.
import { THREE, SETTINGS, DEFAULTS, LOOK, VERT, FW, FH, W, H, AW, AH, RW, RH, C, BRAND, E, clamp, lerp, seg, ease, easeFn, rnd, noise1, fbm1, V3, canvasTex, redraw, fmt, contrast, textOn, shade, mixHex, springStep } from './lib/core.js';
import { createPost } from './lib/post.js';
import { loadFaces, expressions, families, extrasList } from './lib/faces.js';
import { Toon, toonMat, POSE0, LINE } from './lib/rig.js';
import { Actor, POSES, GESTURES, WALKS, poseNames } from './lib/anim.js';
import { CAST, OUTFITS, SKIN, BODY, castIds } from './lib/cast.js';
import { cameraRig, framing, subjectOf } from './lib/camera.js';
import { addOutline, outlineAll, Noodle, lathe, bean, fixNormals } from './lib/geo.js';
import * as SETS from './lib/sets.js';
import * as UI from './lib/ui.js';
import { issues as checkIssues } from './lib/check.js';
import { prop, place, scatter, propNames, propTags, REG as PROP_REG } from './lib/props.js';
import * as FX from './lib/fx.js';
import * as INFO from './lib/info.js';
import * as PLACES from './lib/places.js';
export { prop, propNames, propTags, PROP_REG, FX, INFO, PLACES };
export { THREE, SETTINGS, LOOK, VERT, FW, FH, W, H, AW, AH, RW, RH, C, BRAND, E, clamp, lerp, seg, ease, easeFn, rnd, noise1, fbm1, V3, canvasTex, redraw, fmt, contrast, textOn, shade, mixHex, springStep };
export { Toon, toonMat, POSE0, LINE, Actor, POSES, GESTURES, WALKS, poseNames, CAST, OUTFITS, SKIN, BODY, castIds, expressions, families, extrasList, addOutline, outlineAll, Noodle, lathe, bean, SETS, UI, framing, subjectOf };

export const ENGINE_KIND = 'toon';
export const ENGINE_VERSION = 3;            // bump when the Suite ships engine changes (projects get an Update button)
// v3: live preview speed (docs/PREVIEW_PERF.md): one GPU program for every ink outline (the width was in the program's
//   key: a short compiled ~170 copies of the same shader, one per width, on the first frame of each shot), and the next
//   shots are compiled for the target they really draw into. Exports draw the same.
// v2 (2026-10-18): the project's own characters (settings.characters.custom: { c_xxxx: look }) by id, and as the main one
export const FONT_FILES = UI.FONT_FILES;
export { DEFAULTS };
export const PREVIEW_SCALE = Math.min(1, Math.max(.25, +globalThis.__CZ_PREVIEW_SCALE || 1));
export const SUITE = { module: null, pick: null, at: null, base: '' };
const F = 1 / 30;

await loadFaces();

// ---------- renderer ----------
THREE.ColorManagement.enabled = true;
export const glCanvas = document.createElement('canvas');
export const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(Math.round(FW * PREVIEW_SCALE), Math.round(FH * PREVIEW_SCALE), false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
export const outCanvas = glCanvas;
const POST = createPost(renderer);
const ovCanvas = document.createElement('canvas'); ovCanvas.width = FW; ovCanvas.height = FH; const ov = ovCanvas.getContext('2d');
const ovTex = new THREE.CanvasTexture(ovCanvas); ovTex.colorSpace = THREE.NoColorSpace; ovTex.minFilter = THREE.LinearFilter; ovTex.generateMipmaps = false; ovTex.flipY = true;

// ---------- timeline / cues ----------
let WORDS = [];
const norm = s => String(s).toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}']/gu, '');
export async function loadTimeline(url) {
  const P = await (await fetch(url)).json();
  WORDS = P.flatMap(p => p.words.map(w => ({ ...w, n: norm(w.w) })));
  CAPS = null;
}
export const words = () => WORDS;
/** time the spoken word(s) start (which = 'e': end) nearest to `near` seconds */
export function cue(word, near, which = 's') {
  const parts = String(word).split(' ').map(norm); if (!parts.some(Boolean)) { console.warn('cue miss', word, near); return near; }
  let best = null, bd = 1e9;
  for (let i = 0; i < WORDS.length; i++) { if (!parts.every((p, k) => WORDS[i + k] && WORDS[i + k].n.startsWith(p))) continue;
    const d = Math.abs(WORDS[i].s - near); if (d < bd) { bd = d; best = which === 's' ? WORDS[i].s : WORDS[i + parts.length - 1].e; } }
  if (best === null && parts.length === 1 && parts[0]) for (let i = 0; i < WORDS.length; i++) { let s = '', k = i; while (k < WORDS.length && s.length < parts[0].length) s += WORDS[k++].n;
    if (!s.startsWith(parts[0])) continue; const d = Math.abs(WORDS[i].s - near); if (d < bd) { bd = d; best = which === 's' ? WORDS[i].s : WORDS[k - 1].e; } }
  if (best === null || bd > 12) { console.warn('cue miss', word, near); return near; }
  return best;
}
let SAY_FROM = 0;
function sayTime(phrase) {
  const parts = String(phrase).split(/\s+/).map(norm).filter(Boolean).slice(0, 4); if (!parts.length) return null;
  for (let i = SAY_FROM; i < WORDS.length; i++) if (parts.every((p, k) => WORDS[i + k] && WORDS[i + k].n === p)) { SAY_FROM = i + 1; return { t: WORDS[i].s, i }; }
  for (let i = SAY_FROM; i < WORDS.length; i++) if (parts.every((p, k) => WORDS[i + k] && WORDS[i + k].n.startsWith(p))) { SAY_FROM = i + 1; return { t: WORDS[i].s, i }; }
  return null;
}
export const IMG = {};
export async function loadImages(map) { await Promise.all(Object.entries(map).map(([k, src]) => new Promise(res => { const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => res(); im.src = src; }))); }
const TEXC = new Map();
/** an image of the project (project.json "images" key or a path under assets/) as a texture */
export function image(key, o = {}) {
  const src = IMG[key] ? IMG[key].src : key; if (TEXC.has(src)) return TEXC.get(src);
  const t = new THREE.TextureLoader().load(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...o.repeat); }
  TEXC.set(src, t); return t;
}

// ---------- shots ----------
// shot({ say: 'the clause', | t0 / at, trans, cam, build(S) -> st, update(st, t, S), grade, dof, name })
export const SHOTS = [];
function caller() {
  for (const l of (new Error().stack || '').split('\n')) { if (/\/engine\.js|\/lib\/[\w-]+\.js|\/models\.js/.test(l)) continue;
    const m = l.match(/((?:scenes\/)?[\w.-]+\.js):(\d+):\d+/); if (m && !m[1].startsWith('host')) return { file: m[1], line: +m[2] }; }
  return null;
}
export function shot(def) {
  const src = caller(); def._file = SUITE.module || src?.file || null; def._line = src?.line ?? null;
  if (def.t0 == null) def.t0 = def.at ?? def.t;
  if (def.t0 == null && def.say != null) { const f = sayTime(def.say); if (f) { def.t0 = Math.max(0, f.t - .1); def._sayAt = f.t; } else { console.warn(`say miss: "${def.say}" (${def._file}:${def._line}) - the words were not found after the previous shot's`); def.t0 = (SHOTS[SHOTS.length - 1]?.t0 ?? -2) + 2; } }
  if (def.t0 == null) def.t0 = SHOTS.length ? SHOTS[SHOTS.length - 1].t0 + 2 : 0;
  if (!SHOTS.length && def.t0 < .5) def.t0 = 0;
  SHOTS.push(def); return def;
}
/** loop: the last shot returns to the opening composition (the opening's build + camera, ending where the video began) */
export function loopShot(def = {}) { return shot({ ...def, _loop: true }); }
let END = 0;
export function finalizeShots(end) {
  SHOTS.sort((a, b) => a.t0 - b.t0); SHOTS.forEach((s, i) => (s.t1 = i + 1 < SHOTS.length ? SHOTS[i + 1].t0 : end)); END = end;
  for (const s of SHOTS) if (s._loop && SHOTS[0] !== s) { const f = SHOTS[0]; s.build ??= f.build; s.update ??= f.update; s.cam ??= f.cam; s.grade ??= f.grade; s._loopOf = f; }
}
export function activeIndex(t) { let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1].t0) i++; return i; }
// measured: shots join with 4-7 frame dissolves (median 6); hard cuts only for action jumps; whips 12 frames
const TRANS = { cut: 0, dissolve: 1, match: 1, whip: 2, 'whip-left': 2, 'whip-right': 2, 'whip-up': 2, 'whip-down': 2, zoom: 3, push: 4, flash: 5, black: 6 };
export const transOf = s => s.trans ?? (SHOTS.indexOf(s) > 0 ? 'dissolve' : 'cut');
const durOf = s => s.transDur ?? ({ dissolve: 6 * F, match: 7 * F, whip: 12 * F, 'whip-left': 12 * F, 'whip-right': 12 * F, 'whip-up': 12 * F, 'whip-down': 12 * F, zoom: 9 * F, push: 10 * F, flash: 4 * F, black: 16 * F }[transOf(s)] ?? 6 * F);

// ---------- building a shot ----------
export const EVENTS = [];
let COLLECT = false;
/** sound effects on picture events (sfx('whoosh' | 'pop' | 'impact' | 'thud' | 'click' | 'ding' | 'swish' | 'splash' | ...)), t, { gain, pan }) */
export function sfx(type, t, o = {}) { if (!COLLECT || t == null || !isFinite(t)) return; EVENTS.push({ t: +(+t).toFixed(3), type, pan: o.pan ?? .5, gain: o.gain ?? 0, dur: o.dur ?? 0 }); }
function makeS(def) {
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, RW / RH, .05, 400);
  scene.background = new THREE.Color('#2a2622');
  const L = def._loopOf;
  const S = { scene, cam, def, t0: L ? L.t0 : def.t0, t1: L ? L.t1 : def.t1, dur: def.t1 - def.t0, actors: [], props: [], ticks: [], ov: [], spots: {}, vert: VERT, C, aspect: RW / RH, THREE };
  S.add = (...objs) => { for (const o of objs) { if (o instanceof Actor) { scene.add(o.root); S.actors.push(o); } else if (o?.isObject3D) { scene.add(o); if (o.userData.pickRoot || o.userData.kind) S.props.push(o); } } return objs[0]; };
  S.tick = f => { S.ticks.push(f); return f; };
  S.over = item => { item.src ??= caller() || { file: def._file, line: def._line }; item.t0 ??= def.t0; S.ov.push(item); return item; };
  // (a loop shot replays the opening's build in the opening's own times: its cues are the opening's words)
  S.at = (word, o = {}) => { const near = o.near ?? ((L ? L._sayAt ?? L.t0 : def._sayAt ?? def.t0) + (o.after ?? 0)); return cue(word, near, o.which || 's'); };
  // people: S.char('milo' | 'main' | 'c_xxxx' | spec, { at: [x, z], ry, outfit, face, pose, look: {...overrides} })
  // 'c_xxxx': one of the project's own characters (settings.characters.custom, made in New project: random or described)
  S.char = (id = 'main', o = {}) => {
    const main = SETTINGS.characters?.main, OWN = SETTINGS.characters?.custom || {};
    let spec = id === 'main' ? (main && (CAST[main] || OWN[main]) ? main : 'milo') : id;
    if (typeof spec === 'string' && OWN[spec] && !CAST[spec]) spec = { ...OWN[spec], id: spec };
    else if (typeof spec === 'string' && !CAST[spec]) { console.warn('unknown character ' + spec + ' (lib/cast.js or settings.characters.custom): using milo'); spec = 'milo'; }
    const look = { ...(o.look || {}), ...(o.outfit ? { outfit: o.outfit } : {}), ...(o.scale ? { scale: o.scale } : {}) };
    const a = new Actor(S, spec, { ...o, look }); a.place(o.at?.[0] ?? 0, o.at?.[1] ?? 0, o.ry ?? 0, o.y ?? 0);
    if (o.pose) a.stand(o.pose); if (o.face) a.face(o.face, -1e3);
    S.add(a); return a;
  };
  S.light = (k, o) => SETS.light(S, k, o); S.sky = (k, o) => SETS.sky(S, k, o); S.fog = (c, n, f) => SETS.fog(S, c, n, f);
  S.floor = o => SETS.floor(S, o); S.room = o => SETS.room(S, o);
  // props: S.prop('chair', { at: [x, z], ry, on: table }) ; S.scatter(['rock', 'bush'], [x0, z0, x1, z1], n, { seed })
  S.prop = (name, o = {}) => place(S, name, o); S.scatter = (names, area, n, o) => scatter(S, names, area, n, o);
  // effects and in-world information: S.fx('rain', {...}), S.info('sign', { text })
  S.fx = (kind, o = {}) => FX.make(S, kind, o); S.info = (kind, o = {}) => INFO.make(S, kind, o);
  // a whole dressed place (floor, walls / terrain, sky, light, dressing, practicals): S.place('kitchen', { seed, mood }) -> { spots, ... }
  S.place = (name, o = {}) => { const r = PLACES.build(S, name, o) || {}; Object.assign(S.spots, r.spots || {}); S.placeName = name; return r; };
  // the camera: S.camera('creep' | 'push' | 'reveal' | 'pull' | 'orbit' | 'pan' | 'crane' | 'track' | 'follow' | 'static', { on, frame, react, into, ... })
  // | S.camera('keys', { keys }) | S.camera('fly', { path, look }). A reaction punch-in is the `react` OPTION, not a kind.
  S.camera = (spec, o) => { const sp = typeof spec === 'string' ? { ...(o || {}), kind: spec } : spec; S._cam = cameraRig(S, sp); if (sp.on) S.subject = sp.on; return S._cam; };
  // depth of field: S.focus(target | metres, { aperture, at, dur }) pulls focus (rack focus) at time `at`
  S.focus = (target, o = {}) => { (S._focusKeys ??= []).push({ target, aperture: o.aperture, at: o.at ?? -1e9, dur: o.dur ?? 10 * F }); };
  S.dof = o => { S._dof = { ...(S._dof || {}), ...o }; };
  // overlays (sparingly): S.label('text', { at: () => S.screen(obj) }), S.arrow({ from, to }) (no stamps / red verdict marks: banned)
  for (const k of ['label', 'arrow']) S[k] = (...a) => S.over(UI[k](...a));
  S.grade = g => { S._grade = g; }; S.flash = (at, dur = .3) => { (S._flashes ??= []).push([at, dur]); };
  S.sfx = sfx; S.screen = p => projectTo(S, p);
  return S;
}
function projectTo(S, p) {
  let w;
  if (p instanceof Actor) w = p.head().add(new THREE.Vector3(0, p.toon.B.head * 1.2, 0));
  else if (p?.isVector3) w = p.clone(); else if (Array.isArray(p)) w = new THREE.Vector3(p[0], p[1] ?? 0, p[2] ?? 0);
  else if (p?.isObject3D) { const b = new THREE.Box3().setFromObject(p); w = b.getCenter(new THREE.Vector3()); } else w = new THREE.Vector3();
  const c = w.clone().applyMatrix4(S.cam.matrixWorldInverse), q = w.clone().project(S.cam);
  return [(q.x + 1) / 2 * FW, (1 - q.y) / 2 * FH, c.z < -S.cam.near];
}
function live(def) {
  if (def._S) return def;
  const S = makeS(def);
  def._S = S;
  try {
    def._st = (def.build ? def.build(S) : null) || {};
    fixNormals(S.scene);                       // zero-length normals -> NaN pixels -> black squares in the blurs
    if (!S._lights?.length) SETS.light(S, 'studio');
    if (!S._cam) { const on = def.on || S.subject || S.actors[0] || S.props[S.props.length - 1];
      // shot({ cam: 'push' }) or shot({ cam: { kind, ...options } }): the subject and framing default either way
      if (def.cam && typeof def.cam === 'object' && !Array.isArray(def.cam)) S.camera(def.cam.kind || 'creep', { on, frame: def.frame || 'ms', ...def.cam });
      else S.camera(def.cam || 'creep', { on, frame: def.frame || 'ms' }); }
  } catch (e) { def._S = null; throw e; }
  for (const a of S.actors) a.update(S.t0);
  stepS(S, def, def.t0, def._st);
  return def;
}
function stepS(S, def, t, st) {
  const lt = def._loopOf ? t - def.t1 + def._loopOf.t0 : t;
  for (const a of S.actors) a.update(lt);
  for (const f of S.ticks) f(lt, S);
  def.update?.(st, lt, S);
  S.scene.traverse(o => { if (o !== S.scene && o.userData.update) o.userData.update(lt, S); });
  for (const a of S.actors) a.root.updateMatrixWorld(true);
  S._cam?.(S.cam, lt);
  if (S.bounds && def.camInside !== false) { const B = S.bounds, p = S.cam.position, m = .2; p.x = clamp(p.x, B.x0 + m, B.x1 - m); if (B.h) p.y = Math.min(p.y, B.h - .1); p.z = Math.max(p.z, B.z0 + m); }
  S.cam.updateMatrixWorld(); S.cam.matrixWorldInverse.copy(S.cam.matrixWorld).invert();
  S.lt = lt;
}
function step(def, t) { live(def); stepS(def._S, def, t, def._st); return def._S; }
let KEEP = 3;
export const setKeep = n => { KEEP = Math.max(3, n | 0); };
function dispose(def) {
  const S = def._S; if (S) S.scene.traverse(o => { if (o.isMesh && !o.userData.isOutline && o.geometry && !o.geometry.userData?.shared) o.geometry.dispose?.(); });
  def._S = null; def._st = null;
}
function trim(i) { const built = []; SHOTS.forEach((s, k) => { if (s._S) built.push(k); }); built.sort((a, b) => Math.abs(b - i) - Math.abs(a - i)); for (let n = built.length, j = 0; n > KEEP && j < built.length; j++) if (Math.abs(built[j] - i) > 1) { dispose(SHOTS[built[j]]); n--; } }
export function prewarm(t, ahead = 2) {
  const i = activeIndex(t);
  // (compiled for the render target the shot really draws into: a shader's variant depends on it, and compiling for the
  // screen left the real one to compile on the shot's first frame - the stall when playing into it. The GPU driver
  // compiles them in parallel while the current shot plays.)
  for (let k = i + 1; k <= i + ahead && k < SHOTS.length; k++) if (!SHOTS[k]._S && !SHOTS[k]._warmFail) { try { live(SHOTS[k]); const prev = renderer.getRenderTarget(); renderer.setRenderTarget(POST.rtA); try { renderer.compile(SHOTS[k]._S.scene, SHOTS[k]._S.cam); } finally { renderer.setRenderTarget(prev); } } catch { SHOTS[k]._warmFail = true; continue; } trim(i); return true; }
  return false;
}

// ---------- frame ----------
function dofOf(S, t) {
  const base = { focus: S._focus ?? 5, aperture: S._dof?.aperture ?? .12, on: S._dof?.on !== false && S.def.dof !== false, radius: S._dof?.radius ?? 16, amount: S._dof?.amount ?? 1 };
  // rack focus keys: S.focus(target, { at, dur })
  const keys = S._focusKeys || []; let f = base.focus, ap = base.aperture;
  const dist = tg => typeof tg === 'number' ? tg : S.cam.position.distanceTo(tg instanceof Actor ? tg.head() : tg?.isObject3D ? new THREE.Box3().setFromObject(tg).getCenter(new THREE.Vector3()) : V3(tg));
  for (const k of keys) { if (S.lt < k.at) break; const d = dist(k.target), u = E.inOutCubic(seg(S.lt, k.at, k.at + k.dur)); f = lerp(f, d, k.at < -1e8 ? 1 : u); if (k.aperture != null) ap = lerp(ap, k.aperture, k.at < -1e8 ? 1 : u); }
  base.focus = f; base.aperture = ap;
  return base;
}
function renderShot(def, t, rt, rtD) {
  const S = step(def, t);
  renderer.setRenderTarget(rt); renderer.setClearColor(0, 1); renderer.clear(); renderer.render(S.scene, S.cam);
  POST.dof(rt, S.cam, dofOf(S, t), rtD);
  return S;
}
function transitionAt(t) {
  for (let j = 1; j < SHOTS.length; j++) { const s = SHOTS[j], ty = transOf(s); if (ty === 'cut') continue; const D = durOf(s);
    const a = s.t0 - D / 2; if (t >= a && t < a + D) return { A: SHOTS[j - 1], B: s, k: (t - a) / D, type: ty }; }
  return null;
}
function gradeOf(S, t) {
  const g = typeof S._grade === 'function' ? S._grade(t) : S._grade || {};
  const out = { ...g };
  if (typeof S.def.grade === 'object') Object.assign(out, S.def.grade);
  let fl = 0; for (const [at, d] of S._flashes || []) if (t >= at && t < at + d) fl = Math.max(fl, .7 * (1 - (t - at) / d));
  out.flash = Math.max(out.flash || 0, fl);
  return out;
}
export function compose(t) {
  const i = activeIndex(t); trim(i);
  if (!SHOTS.length) { renderer.setRenderTarget(null); renderer.setClearColor(0, 1); renderer.clear(); return outCanvas; }
  const tr = transitionAt(t); let S, grade;
  if (tr) {
    const SA = renderShot(tr.A, t, POST.rtA, POST.rtDA), SB = renderShot(tr.B, t, POST.rtB, POST.rtDB);
    const dir = { whip: [1, 0], 'whip-left': [1, 0], 'whip-right': [-1, 0], 'whip-up': [0, -1], 'whip-down': [0, 1], push: [0, 1] }[tr.type] || [1, 0];
    POST.mix(POST.rtDA, POST.rtDB, tr.k, TRANS[tr.type] ?? 1, POST.rtMix, dir);
    S = tr.k < .5 ? SA : SB; grade = gradeOf(S, t);
    if (tr.type === 'flash') grade.flash = Math.max(grade.flash || 0, .7 * Math.max(0, 1 - Math.abs(tr.k - .5) * 3));
  } else { S = renderShot(SHOTS[i], t, POST.rtA, POST.rtMix); grade = gradeOf(S, t); }
  overlay(S, t);
  if (SUITE.pick) return outCanvas;
  POST.finish(POST.rtMix, grade, ovTex, t);
  return outCanvas;
}
// ---------- overlay: marks and captions ----------
let CAPS = null;
function overlay(S, t) {
  ov.setTransform(1, 0, 0, 1, 0, 0); ov.clearRect(0, 0, FW, FH);
  const lt = S.lt ?? t; S._ovBoxes = [];
  for (const it of S.ov) {
    if (lt < it.t0 - .001) continue; if (it.t1 != null && lt > it.t1) continue;
    ov.save(); try { it.draw(ov, lt, S); } catch (e) { console.warn('overlay: ' + e.message); } ov.restore();
    if (it.box) S._ovBoxes.push({ what: it.what + (it.text ? ` "${String(it.text).slice(0, 30)}"` : ''), box: it.box, src: it.src });
    if (SUITE.pick && it.box) SUITE.pick.push({ kind: it.what || 'overlay', text: typeof it.text === 'string' ? it.text : null, key: null, x: it.box.x, y: it.box.y, w: it.box.w, h: it.box.h, alpha: 1, src: it.src || null });
    it.box = null;
  }
  S._capBox = null;
  if (SETTINGS.captions?.on !== false && WORDS.length && S.def.captions !== false) {
    CAPS ??= UI.chunkWords(WORDS);
    const c = CAPS.find(c => t >= c.s && t < c.until);
    if (c) { const b = UI.drawCaption(ov, c); S._capBox = b; if (SUITE.pick) SUITE.pick.push({ kind: 'caption', text: c.text, key: null, ...b, alpha: 1, src: null }); }
  }
  ovTex.needsUpdate = true;
}
export function captionAt(t) { if (SETTINGS.captions?.on === false || !WORDS.length) return null; CAPS ??= UI.chunkWords(WORDS); return CAPS.find(c => t >= c.s && t < c.until) || null; }

// ---------- export (WebCodecs H.264, streamed to /append/<name>) ----------
export async function exportVideo({ name = 'video', fps = 30, from = 0, to, bitrate = 20e6, onProgress } = {}) {
  const chunks = []; let bytes = 0, first = true, err = null;
  const enc = new VideoEncoder({ output: c => { const b = new Uint8Array(c.byteLength); c.copyTo(b); chunks.push(b); bytes += b.length; }, error: e => err = e });
  let cfg = { codec: 'avc1.640033', width: FW, height: FH, bitrate, framerate: fps, latencyMode: 'quality', avc: { format: 'annexb' } };
  for (const hw of ['prefer-hardware', 'no-preference', 'prefer-software']) { const c = { ...cfg, hardwareAcceleration: hw }; if ((await VideoEncoder.isConfigSupported(c)).supported) { cfg = c; break; } }
  enc.configure(cfg);
  const flush = async force => { if (!chunks.length || (!force && bytes < 8e6)) return; const blob = new Blob(chunks); chunks.length = 0; bytes = 0;
    await fetch(`${SUITE.base}/append/${name}${first ? '?reset=1' : ''}`, { method: 'POST', body: blob }); first = false; };
  const n = Math.round((to - from) * fps), t0 = performance.now();
  for (let f = 0; f < n; f++) {
    if (err) throw err;
    compose(from + f / fps);
    const vf = new VideoFrame(outCanvas, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps) });
    enc.encode(vf, { keyFrame: f % (fps * 2) === 0 }); vf.close();
    while (enc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 1));
    if (f % 30 === 0) { await flush(false); onProgress?.(f, n, (performance.now() - t0) / 1000); }
  }
  await enc.flush(); await flush(true); enc.close();
  const secs = (performance.now() - t0) / 1000;
  return { frames: n, seconds: +secs.toFixed(1), fps: +(n / secs).toFixed(1), realtime: +((to - from) / secs).toFixed(2) };
}
// ---------- sound events: build every shot once and collect what it scheduled ----------
export async function collectEvents(end) {
  SHOTS.forEach(dispose); EVENTS.length = 0; COLLECT = true;
  try { for (const s of SHOTS) { try { live(s); } catch (e) { console.warn(`sound events: ${s._file}:${s._line}: ${e.message}`); } dispose(s); await new Promise(r => setTimeout(r, 0)); } } finally { COLLECT = false; }
  const shots = SHOTS.map(s => ({ t0: +s.t0.toFixed(3), trans: transOf(s), cut: transOf(s) === 'cut', chapter: false, name: s.name || '' }));
  for (const s of SHOTS.slice(1)) { const ty = transOf(s); if (ty.startsWith('whip') || ty === 'zoom') EVENTS.push({ t: +(s.t0 - durOf(s) / 2).toFixed(3), type: 'whoosh', pan: .5, gain: -8, dur: 0 }); }
  const seen = new Set(), list = [];
  for (const e of EVENTS.slice().sort((a, b) => a.t - b.t)) { const k = e.type + Math.round(e.t * 20); if (seen.has(k)) continue; seen.add(k); list.push(e); }
  return { shots, hits: [], cards: [], sfx: list.filter(e => e.t >= 0 && e.t <= end + 1), style: 'toon' };
}
// ---------- the layout check (check_layout) ----------
export function checkTimes() {
  const ts = [];
  SHOTS.forEach(s => { const D = transOf(s) === 'cut' ? 0 : durOf(s) / 2, a = s.t0 + D + .1, b = (s.t1 ?? END) - .1; if (b > a) { ts.push(a, (a + b) / 2, b); for (let x = a + .5; x < b - .25; x += .5) ts.push(x); } });
  const seen = new Set(); return ts.filter(t => t >= 0 && t <= END && !transitionAt(t)).map(t => +t.toFixed(2)).sort((a, b) => a - b).filter(t => { const k = Math.round(t * 5); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 400);
}
export function layoutIssues(t) {
  const i = activeIndex(t), def = SHOTS[i]; if (!def || transitionAt(t)) return [];
  compose(t);
  const S = def._S, where = `(${def._file}:${def._line})`;
  return checkIssues(S, def, t, where, { renderer, POST, captionBox: S._capBox });
}
// ---------- picking (the editor's click to select) ----------
export function PICKABLE(o) { if (!o.isMesh || o.userData.noPick || o.userData.ground || o.userData.isOutline) return false; const m = Array.isArray(o.material) ? o.material[0] : o.material; return !(m?.transparent && (m.opacity ?? 1) < .5); }
export function pickTarget(hit, S, st) {
  let o = hit.object, root = null, actor = null;
  for (let x = o; x && !x.isScene; x = x.parent) { if (x.userData.actor) { actor = x.userData.actor; root = x; break; } if (x.userData.pickRoot) root = x; }
  root ??= o; root.updateMatrixWorld(true);
  const key = Object.entries(st || {}).find(([, v]) => v === actor || v === root || v?.root === root)?.[0];
  return { object: root, key: key ? `st.${key}` : null, kind: actor ? 'character' : root.userData.kind || null, name: actor ? actor.name : root.name || null, box: actor ? actor.box() : new THREE.Box3().setFromObject(root) };
}
