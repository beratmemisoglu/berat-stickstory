// berat Suite engine - Stick stories. 16:9 "What if you..." story videos acted by black-silhouette stick people
// (round heads, white eye and mouth shapes, coloured clothes, coloured rim light) in flat-vector illustrated sets, with
// HUD graphics, hand close-ups, maps and diagrams. A 2.5D cut-out theatre: flat vector cards at real depths seen by a
// long-lens camera (parallax, depth of field), drawn crisp with 4x MSAA, then grain + vignette.
// The look and motion were learned frame by frame from reference videos (experiments/stickstory-style); every character,
// set and graphic here is our own. Read the skill (.claude/skills/stickstory-videos) before writing scenes:
// references/engine_api.md is the API.
import { THREE, SETTINGS, DEFAULTS, LOOK, VERT, FW, FH, W, H, AW, AH, RW, RH, FPS, C, BRAND, E, DEG, clamp, lerp, seg, ease, easeFn, rnd, noise1, fbm1, hash, V3, canvasTex, redraw, fmt, contrast, textOn, shade, mixHex, springStep, stepT,
  Z, mat, rrect, rect, ellipse, circle, ring, capsule, poly, stroke, bez, path, gradient, glow, softShadow, text, stack, group, recolor, box2 } from './lib/core.js';
import { createPost } from './lib/post.js';
import * as RIG from './lib/rig.js';
import * as FACES from './lib/faces.js';
import * as ANIM from './lib/anim.js';
import { Actor, POSES, GESTURES, WALKS } from './lib/anim.js';
import * as CAST from './lib/cast.js';
import { cameraRig, framing } from './lib/camera.js';
import * as PLACES from './lib/places.js';
import * as PROPS from './lib/props.js';
import * as FX from './lib/fx.js';
import * as INFO from './lib/info.js';
import * as UI from './lib/ui.js';
import { issues as checkIssues } from './lib/check.js';
export { THREE, SETTINGS, LOOK, VERT, FW, FH, W, H, AW, AH, RW, RH, FPS, C, BRAND, E, DEG, clamp, lerp, seg, ease, easeFn, rnd, noise1, fbm1, hash, V3, canvasTex, redraw, fmt, contrast, textOn, shade, mixHex, springStep, stepT,
  Z, mat, rrect, rect, ellipse, circle, ring, capsule, poly, stroke, bez, path, gradient, glow, softShadow, text, stack, group, recolor, box2 };
export { RIG, FACES, Actor, POSES, GESTURES, WALKS, CAST, PLACES, PROPS, FX, INFO, UI, framing };
export const PROP_REG = PROPS.REG;          // (the lab's --dump and the skill docs read the registries from here)

export const ENGINE_KIND = 'stickstory';
export const ENGINE_VERSION = 3;            // bump when the Suite ships engine changes (projects get an Update button)
// v3 (2026-10-23, the owner's review of videos 01 + 02): a face change inside a shot crossfades the parts that change over
//   3 frames (no brows / under-eye arcs popping), the field place with a horizon, stool sitting, cast / sling looks,
//   S.handshake close-ups; two-hand close-ups S.handhold / S.fistBump / S.pinkyPromise (= S.handshake kind hold / bump /
//   pinky: two sleeves, one set of fingers, the far hand in the far-limb tone), hugs / group hugs / catches keep the two
//   heads apart (at most a rim of overlap, any framing), a gesture whose release would start in the last 6 frames of the
//   shot holds through the cut
// v2 (2026-10-23, the battle test's video 1): free characters keep their colour in a freeze, S.ring countdowns + a HUD kind,
//   shoulder carries / drag / group hugs / flop sits, S.hand closes and opens on a word, S.tone for a set's own cards,
//   dog + pigeon props, the reference-matched hand inserts and rim from the one-to-one check
export const FONT_FILES = UI.FONT_FILES;
export { DEFAULTS };
export const PREVIEW_SCALE = Math.min(1, Math.max(.25, +globalThis.__CZ_PREVIEW_SCALE || 1));
export const SUITE = { module: null, pick: null, at: null, base: '' };
const F = 1 / FPS;

await (FACES.load?.() ?? null);

// ---------- renderer ----------
THREE.ColorManagement.enabled = true;
export const glCanvas = document.createElement('canvas');
export const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(Math.round(FW * PREVIEW_SCALE), Math.round(FH * PREVIEW_SCALE), false);
renderer.sortObjects = true;
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
  if (best === null || bd > 20) { console.warn('cue miss', word, near); return near; }
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
// shot({ say: 'the clause', | t0 / at, trans, cam, build(S) -> st, update(st, t, S), grade, dof, name, hud })
export const SHOTS = [];
function caller() {
  for (const l of (new Error().stack || '').split('\n')) { if (/\/engine\.js|\/lib\/[\w-]+\.js|\/models\.js/.test(l)) continue;
    const m = l.match(/((?:scenes\/)?[\w.-]+\.js):(\d+):\d+/); if (m && !m[1].startsWith('host')) return { file: m[1], line: +m[2] }; }
  return null;
}
export function shot(def) {
  const src = caller(); def._file = SUITE.module || src?.file || null; def._line = src?.line ?? null;
  if (def.t0 == null) def.t0 = def.at ?? def.t;
  // the cut lands `lead` frames before the clause's first word (camera NOTES 5.3: sentence cuts ~4 frames before the
  // phrase, in the pause; story NOTES: up to 6); mid-sentence cuts on a noun can use lead: 2
  if (def.t0 == null && def.say != null) { const f = sayTime(def.say); if (f) { def.t0 = Math.max(0, f.t - (def.lead ?? 4) * F); def._sayAt = f.t; } else { console.warn(`say miss: "${def.say}" (${def._file}:${def._line}) - the words were not found after the previous shot's`); def.t0 = (SHOTS[SHOTS.length - 1]?.t0 ?? -2) + 2; } }
  if (def.t0 == null) def.t0 = SHOTS.length ? SHOTS[SHOTS.length - 1].t0 + 2 : 0;
  if (!SHOTS.length && def.t0 < .5) def.t0 = 0;
  SHOTS.push(def); return def;
}
let END = 0;
export function finalizeShots(end) {
  SHOTS.sort((a, b) => a.t0 - b.t0); SHOTS.forEach((s, i) => (s.t1 = i + 1 < SHOTS.length ? SHOTS[i + 1].t0 : end)); END = end;
}
export function activeIndex(t) { let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1].t0) i++; return i; }
// transitions (camera study, analysis/camera/NOTES.md): 93 % hard cuts; dissolve = a linear 12-frame crossfade (time /
// place jumps, 3-6 a video), quick = 4 frames (rapid inserts), black = through black (act breaks), flash = a hard cut that
// lands ~1.9x bright and decays over ~10 frames, whiteout = 10 frames ramp to white, 2 white, cut, 11 frames decay.
// 'flash' and 'whiteout' are cuts with a grade (no mix of two shots).
const TRANS = { cut: 0, dissolve: 1, quick: 1, match: 1, whip: 2, 'whip-left': 2, 'whip-right': 2, 'whip-up': 2, 'whip-down': 2, zoom: 3, push: 4, black: 6 };
export const TRANS_DUR = { dissolve: 12, quick: 4, match: 12, whip: 10, 'whip-left': 10, 'whip-right': 10, 'whip-up': 10, 'whip-down': 10, zoom: 9, push: 10, black: 16 };   // frames at 24 fps
export const transOf = s => s.trans ?? 'cut';
const mixed = s => { const ty = transOf(s); return ty !== 'cut' && ty !== 'flash' && ty !== 'whiteout'; };
const durOf = s => s.transDur ?? (TRANS_DUR[transOf(s)] ?? 12) * F;

// ---------- building a shot ----------
export const EVENTS = [];
let COLLECT = false;
/** sound effects on picture events: sfx('whoosh' | 'pop' | 'click' | 'blip' | 'door' | 'step' | 'phone' | 'impact' | ..., t, { gain, pan }) */
export function sfx(type, t, o = {}) { if (!COLLECT || t == null || !isFinite(t)) return; EVENTS.push({ t: +(+t).toFixed(3), type, pan: o.pan ?? .5, gain: o.gain ?? 0, dur: o.dur ?? 0 }); }
function makeS(def) {
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(SETTINGS.camera?.fov ?? 22, RW / RH, .05, 300);
  scene.background = new THREE.Color('#1a1a1f');
  const S = { scene, cam, def, t0: def.t0, t1: def.t1, dur: def.t1 - def.t0, actors: [], props: [], ticks: [], ov: [], hud: [], spots: {}, vert: VERT, C, aspect: RW / RH, THREE };
  S.add = (...objs) => { for (const o of objs) { if (o instanceof Actor) { scene.add(o.root); S.actors.push(o); } else if (o?.isObject3D) { scene.add(o); if (o.userData.pickRoot || o.userData.kind) S.props.push(o); } } return objs[0]; };
  S.tick = f => { S.ticks.push(f); return f; };
  S.over = item => { item.src ??= caller() || { file: def._file, line: def._line }; item.t0 ??= def.t0; S.ov.push(item); return item; };
  S.at = (word, o = {}) => { const near = o.near ?? ((def._sayAt ?? def.t0) + (o.after ?? 0)); return cue(word, near, o.which || 's'); };
  // people: S.char('main' | cast id | 'c_xxxx' | look object, { at: [x, z] | 'spot', facing, pose, face, sit, scale })
  S.char = (id = 'main', o = {}) => { const a = new Actor(S, CAST.resolve(id, SETTINGS), o); S.add(a); return a; };
  // a whole dressed place: S.place('kitchen', { mood: 'night', seed, variant }) -> { spots, bounds, ... }
  // (the place's rim light colour / direction and background are kept on S for the characters: S.rim, S.rimDir)
  S.place = (name, o = {}) => { const r = PLACES.build(S, name, o) || {}; Object.assign(S.spots, r.spots || {}); S.placeName = name; S.placeInfo = r; if (r.bounds) S.bounds = r.bounds;
    if (r.rim !== undefined) S.rim = r.rim; if (r.rimDir) S.rimDir = r.rimDir; if (r.bg) S.bg(r.bg); return r; };
  S.spot = name => S.spots[name] ?? null;
  // props: S.prop('mug', { at: [x, y, z] | 'spot', scale, facing }); held props come from a.hold('phone')
  S.prop = (name, o = {}) => PROPS.place(S, name, o);
  // (effects take a spoken word for at / until like the graphics do: { at: 'crash' } = the time 'crash' is said)
  const wordT = v => typeof v === 'string' ? S.at(v) : v;
  S.fx = (kind, o = {}) => FX.make(S, kind, { ...o, ...(o.at !== undefined ? { at: wordT(o.at) } : {}), ...(o.until !== undefined ? { until: wordT(o.until) } : {}) });
  // full-frame graphics and in-scene graphics: S.info('worldmap', {...}), S.info('terminal', { text }), S.info('pill', { text, at })
  S.info = (kind, o = {}) => INFO.make(S, kind, o);
  // the camera: S.camera('creep' | 'push' | 'pull' | 'pan' | 'truck' | 'crane' | 'follow' | 'static' | 'punch' | 'rack' | 'keys', { on, frame, ... })
  S.camera = (spec, o) => { const sp = typeof spec === 'string' ? { ...(o || {}), kind: spec } : spec; S._cam = cameraRig(S, sp); if (sp.on) S.subject = sp.on; return S._cam; };
  S.focus = (target, o = {}) => { (S._focusKeys ??= []).push({ target, aperture: o.aperture, at: o.at ?? -1e9, dur: o.dur ?? 12 * F }); };
  S.dof = o => { S._dof = { ...(S._dof || {}), ...o }; };
  // 2D overlay items on top of the frame (labels, pills, HUD counters for this shot): S.label / S.pill / S.hudItem
  for (const k of Object.keys(UI.OVERLAYS || {})) S[k] = (...a) => S.over(UI.OVERLAYS[k](S, ...a));
  S.grade = g => { S._grade = g; }; S.flash = (at, dur = 10 * F) => { (S._flashes ??= []).push([at, dur]); };
  // scope mode: the letterbox narrows from 2.0:1 to 2.33:1 for action / "the genius sees it" moments (4 frames in, 5 out).
  // S.scope(from, until) inside a shot, or shot({ scope: true }) for whole shots (a run of scoped shots stays narrow)
  S.scope = (a = def.t0, b = def.t1) => { (S._scope ??= []).push([a, b]); };
  S.sfx = sfx; S.screen = p => projectTo(S, p);
  S.bg = c => { scene.background = new THREE.Color(c); };
  // library helpers: every function in a library's S_HELPERS becomes S.<name>(...) (e.g. anim's crowd, info's split),
  // so libraries extend the scene API without editing this file. Engine names above win.
  for (const lib of [ANIM, PLACES, PROPS, FX, INFO]) for (const [k, f] of Object.entries(lib.S_HELPERS || {})) if (!(k in S) && typeof f === 'function') S[k] = (...a) => f(S, ...a);
  return S;
}
function projectTo(S, p) {
  let w;
  if (p instanceof Actor) w = p.head().add(new THREE.Vector3(0, p.headR * 1.3, 0));
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
    if (!S._cam) { const on = def.on || S.subject || S.actors[0] || S.props[S.props.length - 1];
      if (def.cam && typeof def.cam === 'object' && !Array.isArray(def.cam)) S.camera(def.cam.kind || 'auto', { on, frame: def.frame || 'ms', ...def.cam });
      else S.camera(def.cam || 'auto', { on, frame: def.frame || 'ms' }); }
  } catch (e) { def._S = null; throw e; }
  for (const a of S.actors) a.update(S.t0);
  stepS(S, def, def.t0, def._st);
  return def;
}
function stepS(S, def, t, st) {
  for (const a of S.actors) a.update(t);
  for (const f of S.ticks) f(t, S);
  def.update?.(st, t, S);
  S.scene.traverse(o => { if (o !== S.scene && o.userData.update) o.userData.update(t, S); });
  for (const a of S.actors) a.root.updateMatrixWorld(true);
  S._cam?.(S.cam, t);
  S.cam.updateMatrixWorld(); S.cam.matrixWorldInverse.copy(S.cam.matrixWorld).invert();
  S.lt = t;
}
function step(def, t) { live(def); stepS(def._S, def, t, def._st); return def._S; }
let KEEP = 3;
export const setKeep = n => { KEEP = Math.max(3, n | 0); };
function dispose(def) {
  const S = def._S; if (S) S.scene.traverse(o => { if (!o.isMesh) return; if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose?.(); if (o.material?.userData?.own) { o.material.map?.dispose?.(); o.material.dispose?.(); } });
  def._S = null; def._st = null;
}
function trim(i) { const built = []; SHOTS.forEach((s, k) => { if (s._S) built.push(k); }); built.sort((a, b) => Math.abs(b - i) - Math.abs(a - i)); for (let n = built.length, j = 0; n > KEEP && j < built.length; j++) if (Math.abs(built[j] - i) > 1) { dispose(SHOTS[built[j]]); n--; } }
export function prewarm(t, ahead = 2) {
  const i = activeIndex(t);
  for (let k = i + 1; k <= i + ahead && k < SHOTS.length; k++) if (!SHOTS[k]._S && !SHOTS[k]._warmFail) { try { live(SHOTS[k]); const prev = renderer.getRenderTarget(); renderer.setRenderTarget(POST.rtA); try { renderer.compile(SHOTS[k]._S.scene, SHOTS[k]._S.cam); } finally { renderer.setRenderTarget(prev); } } catch { SHOTS[k]._warmFail = true; continue; } trim(i); return true; }
  return false;
}

// ---------- frame ----------
function dofOf(S, t) {
  // the aperture follows the shot size (camera.js apertureFor: background blur grows as the camera comes closer)
  const base = { focus: S._focus ?? 8, aperture: S._dof?.aperture ?? S._apAuto ?? .1, on: S._dof?.on !== false && S.def.dof !== false, radius: S._dof?.radius ?? 14, amount: S._dof?.amount ?? 1 };
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
  for (let j = 1; j < SHOTS.length; j++) { const s = SHOTS[j], ty = transOf(s); if (!mixed(s)) continue; const D = durOf(s);
    const a = s.t0 - D / 2; if (t >= a && t < a + D) return { A: SHOTS[j - 1], B: s, k: (t - a) / D, type: ty }; }
  return null;
}
function gradeOf(S, t) {
  const g = typeof S._grade === 'function' ? S._grade(t) : S._grade || {};
  const out = { ...g };
  if (typeof S.def.grade === 'object') Object.assign(out, S.def.grade);
  // S.flash(at): ~1.9x luminance decaying with a ~6-frame time constant (an impact, a realisation)
  let fl = 0; for (const [at, d] of S._flashes || []) if (t >= at && t < at + d * 1.6) fl = Math.max(fl, .55 * Math.exp(-(t - at) / (d * .6)));
  // flash / whiteout cuts: the new shot lands bright and decays; a whiteout ramps the outgoing shot to white first
  const i = SHOTS.indexOf(S.def), ty = transOf(S.def), next = SHOTS[i + 1];
  if ((ty === 'flash' || ty === 'whiteout') && t >= S.def.t0) fl = Math.max(fl, (ty === 'whiteout' ? 1 : .55) * Math.exp(-Math.max(0, t - S.def.t0 - (ty === 'whiteout' ? F : 0)) / ((ty === 'whiteout' ? 4.5 : 6) * F)));
  if (next && transOf(next) === 'whiteout' && t < next.t0) fl = Math.max(fl, E.inQuad(seg(t, next.t0 - 12 * F, next.t0 - 2 * F)));
  out.flash = Math.max(out.flash || 0, Math.min(1, fl));
  return out;
}
// ---------- the letterbox (2.0:1 in a 16:9 frame; scope mode 2.33:1) ----------
export const BAR = SETTINGS.letterbox === false || VERT ? 0 : Math.round((FH - FW / 2) / 2);            // 60 px at 1080
export const SCOPE_BAR = SETTINGS.letterbox === false || VERT ? 0 : Math.round((FH - FW / 2.33) / 2);   // 128 px at 1080
function scopeK(S, t) {
  let k = 0;
  for (const [a, b] of S._scope || []) k = Math.max(k, Math.min(E.inOutSine(seg(t, a, a + 4 * F)), 1 - E.inOutSine(seg(t, b - 5 * F, b))));
  const i = SHOTS.indexOf(S.def);
  if (S.def.scope) { let a = i, b = i; while (a > 0 && SHOTS[a - 1].scope) a--; while (b + 1 < SHOTS.length && SHOTS[b + 1].scope) b++;
    const ta = SHOTS[a].t0, tb = SHOTS[b].t1 ?? END; k = Math.max(k, Math.min(E.inOutSine(seg(t, ta, ta + 4 * F)), 1 - E.inOutSine(seg(t, tb - 5 * F, tb)))); }
  return k;
}
export const barAt = (S, t) => S ? lerp(BAR, SCOPE_BAR, scopeK(S, t)) : BAR;
export function compose(t) {
  const i = activeIndex(t); trim(i);
  if (!SHOTS.length) { renderer.setRenderTarget(null); renderer.setClearColor(0, 1); renderer.clear(); return outCanvas; }
  const tr = transitionAt(t); let S, grade;
  if (tr) {
    const SA = renderShot(tr.A, t, POST.rtA, POST.rtDA), SB = renderShot(tr.B, t, POST.rtB, POST.rtDB);
    const dir = { whip: [1, 0], 'whip-left': [1, 0], 'whip-right': [-1, 0], 'whip-up': [0, -1], 'whip-down': [0, 1], push: [0, 1] }[tr.type] || [1, 0];
    POST.mix(POST.rtDA, POST.rtDB, tr.k, TRANS[tr.type] ?? 1, POST.rtMix, dir);
    S = tr.k < .5 ? SA : SB; grade = gradeOf(S, t);
    if (tr.type === 'flash') grade.flash = Math.max(grade.flash || 0, .8 * Math.max(0, 1 - Math.abs(tr.k - .5) * 3));
  } else { S = renderShot(SHOTS[i], t, POST.rtA, POST.rtMix); grade = gradeOf(S, t); }
  overlay(S, t);
  if (SUITE.pick) return outCanvas;
  POST.finish(POST.rtMix, grade, ovTex, t);
  return outCanvas;
}
// ---------- overlay: HUD, labels, captions ----------
let CAPS = null;
function overlay(S, t) {
  ov.setTransform(1, 0, 0, 1, 0, 0); ov.clearRect(0, 0, FW, FH);
  S._ovBoxes = [];
  const bar = barAt(S, t); S._bar = bar;
  if (bar > 0 && S.def.letterbox !== false) { ov.fillStyle = '#000'; ov.fillRect(0, 0, FW, bar); ov.fillRect(0, FH - bar, FW, bar); }
  const items = [...S.ov, ...UI.globalHud(S, t)];
  for (const it of items) {
    if (t < (it.t0 ?? -1e9) - .001) continue; if (it.t1 != null && t > it.t1) continue;
    ov.save(); try { it.draw(ov, t, S); } catch (e) { console.warn('overlay: ' + e.message); } ov.restore();
    if (it.box) S._ovBoxes.push({ what: it.what + (it.text ? ` "${String(it.text).slice(0, 30)}"` : ''), box: it.box, src: it.src });
    if (SUITE.pick && it.box) SUITE.pick.push({ kind: it.what || 'overlay', text: typeof it.text === 'string' ? it.text : null, key: null, x: it.box.x, y: it.box.y, w: it.box.w, h: it.box.h, alpha: 1, src: it.src || null });
    it.box = null;
  }
  S._capBox = null;
  if (SETTINGS.captions?.on === true && WORDS.length && S.def.captions !== false && UI.chunkWords) {
    CAPS ??= UI.chunkWords(WORDS);
    const c = CAPS.find(c => t >= c.s && t < c.until);
    if (c) { const b = UI.drawCaption(ov, c); S._capBox = b; if (SUITE.pick) SUITE.pick.push({ kind: 'caption', text: c.text, key: null, ...b, alpha: 1, src: null }); }
  }
  ovTex.needsUpdate = true;
}
export function captionAt(t) { if (SETTINGS.captions?.on !== true || !WORDS.length || !UI.chunkWords) return null; CAPS ??= UI.chunkWords(WORDS); return CAPS.find(c => t >= c.s && t < c.until) || null; }

// ---------- export (WebCodecs H.264, streamed to /append/<name>) ----------
export async function exportVideo({ name = 'video', fps = 30, from = 0, to, bitrate = 16e6, onProgress } = {}) {
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
  return { shots, hits: [], cards: [], sfx: list.filter(e => e.t >= 0 && e.t <= end + 1), style: 'stickstory' };
}
// ---------- the layout check (check_layout) ----------
export function checkTimes() {
  const ts = [];
  SHOTS.forEach(s => { const D = transOf(s) === 'cut' ? 0 : durOf(s) / 2, a = s.t0 + D + .1, b = (s.t1 ?? END) - .1; if (b > a) { ts.push(a, (a + b) / 2, b); for (let x = a + .6; x < b - .3; x += .6) ts.push(x); } });
  const seen = new Set(); return ts.filter(t => t >= 0 && t <= END && !transitionAt(t)).map(t => +t.toFixed(2)).sort((a, b) => a - b).filter(t => { const k = Math.round(t * 5); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 600);
}
export function layoutIssues(t) {
  const i = activeIndex(t), def = SHOTS[i]; if (!def || transitionAt(t)) return [];
  compose(t);
  const S = def._S, where = `(${def._file}:${def._line})`;
  return checkIssues(S, def, t, where, { renderer, POST, overlayBoxes: S._ovBoxes });
}
// ---------- picking (the editor's click to select) ----------
export function PICKABLE(o) { if (!o.isMesh || o.userData.noPick || o.userData.ground) return false; const m = Array.isArray(o.material) ? o.material[0] : o.material; return !(m?.transparent && (m.opacity ?? 1) < .5 && !m.map); }
export function pickTarget(hit, S, st) {
  let o = hit.object, root = null, actor = null;
  for (let x = o; x && !x.isScene; x = x.parent) { if (x.userData.actor) { actor = x.userData.actor; root = x; break; } if (x.userData.pickRoot) root = x; }
  root ??= o; root.updateMatrixWorld(true);
  const key = Object.entries(st || {}).find(([, v]) => v === actor || v === root || v?.root === root)?.[0];
  return { object: root, key: key ? `st.${key}` : null, kind: actor ? 'character' : root.userData.kind || null, name: actor ? actor.name : root.name || null, box: actor ? actor.box() : new THREE.Box3().setFromObject(root) };
}
