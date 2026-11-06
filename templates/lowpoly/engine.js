// Toon Studio engine - Low poly shorts. Fast low-poly 3D shorts in the look of the two analysed channels (Low Poly
// Shorts = look 'bright', Loaded Dice = look 'moody'): library models + mocap people, rendered at a low internal resolution,
// scaled up soft, sharpened, bloomed, colour-fringed; a camera that always moves; one narration clause = one shot;
// captions, callouts and game UI drawn on top. 9:16 (1080 x 1920) or 16:9 (1920 x 1080): project.json settings.format.
// Read the skill (.claude/skills/lowpoly-shorts) before writing scenes: references/engine_api.md is the API.
import { THREE, SETTINGS, DEFAULTS, LOOK, MOODY, VERT, FW, FH, W, H, AW, AH, RW, RH, C, BRAND, E, clamp, lerp, seg, ease, rnd, noise1, V3, canvasTex, redraw, pixelText, fmt, contrast, legibleOn, textOn } from './lib/core.js';
import * as A from './lib/assets.js';
import { person, animal, Actor, OUTFITS, SKIN, randomOutfit, clipSpeed } from './lib/actor.js';
import { EXPRESSIONS, loadFaceSheet } from './lib/faces.js';
import { ROSTER, ROLE_DEFAULTS, castId, castInfo, rosterEntries } from './lib/cast.js';
import { cameraRig, subjectBox } from './lib/camera.js';
import { createPost } from './lib/post.js';
import * as UI from './lib/ui.js';
import * as SETS from './lib/sets.js';
import * as KIT from './lib/kit.js';
import { issues as checkIssues, screenRect } from './lib/check.js';
export { THREE, SETTINGS, LOOK, MOODY, VERT, FW, FH, W, H, AW, AH, RW, RH, C, BRAND, E, clamp, lerp, seg, ease, rnd, noise1, V3, canvasTex, redraw, pixelText, fmt, contrast, legibleOn, textOn };
export { ROSTER, ROLE_DEFAULTS, castId, castInfo, rosterEntries };
export { person, animal, Actor, OUTFITS, SKIN, randomOutfit, clipSpeed, EXPRESSIONS, UI, SETS, KIT };
export const { search, find, model, texture, recolor, preload, clip, clipNames, credits } = A;
export const { callout, counter, panel, stamp, arrows, cctv, custom } = UI;
export const liveBar = UI.live;
export const { box, cyl, mat, glow, put, lamp } = SETS;
export const { screen, phone, laptop, crt, monitor, screenWall, bill, cash, moneyCube, chips, card, roulette, slot, led, scoreboard, calendar, bars, lineChart, heart, lungs, stomach, skeleton, sign, ring } = KIT;

export const ENGINE_KIND = 'lowpoly';
export const ENGINE_VERSION = 9;            // bump when the Suite ships engine changes (projects get an Update button)
export const FONT_FILES = UI.FONT_FILES;
export { DEFAULTS };
// the Suite's live preview on a slow computer draws smaller (never exports or stills)
export const PREVIEW_SCALE = Math.min(1, Math.max(.25, +globalThis.__CZ_PREVIEW_SCALE || 1));
export const SUITE = { module: null, pick: null, at: null, base: '' };

// everything the scenes name in the library is loaded before the first frame (lib/scan.js)
await A.preloadProject();
await loadFaceSheet(A.LIB, A.entry);                 // the generated expression sheet (library face.sheet1)

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
  // a cue in a language written without spaces may span several timed words: they are joined until they hold it
  if (best === null && parts.length === 1 && parts[0]) for (let i = 0; i < WORDS.length; i++) { let s = '', k = i; while (k < WORDS.length && s.length < parts[0].length) s += WORDS[k++].n;
    if (!s.startsWith(parts[0])) continue; const d = Math.abs(WORDS[i].s - near); if (d < bd) { bd = d; best = which === 's' ? WORDS[i].s : WORDS[k - 1].e; } }
  if (best === null || bd > 12) { console.warn('cue miss', word, near); return near; }
  return best;
}
// say: shots timed by the clause they show. The words are found in order, each after the previous shot's.
let SAY_FROM = 0;
function sayTime(phrase) {
  const parts = String(phrase).split(/\s+/).map(norm).filter(Boolean).slice(0, 4); if (!parts.length) return null;
  for (let i = SAY_FROM; i < WORDS.length; i++) if (parts.every((p, k) => WORDS[i + k] && WORDS[i + k].n === p)) { SAY_FROM = i + 1; return { t: WORDS[i].s, i }; }
  for (let i = SAY_FROM; i < WORDS.length; i++) if (parts.every((p, k) => WORDS[i + k] && WORDS[i + k].n.startsWith(p))) { SAY_FROM = i + 1; return { t: WORDS[i].s, i }; }
  return null;
}
export const IMG = {};
export async function loadImages(map) { await Promise.all(Object.entries(map).map(([k, src]) => new Promise(res => { const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => res(); im.src = src; }))); }

// ---------- shots ----------
// shot({ say: 'the clause', | t0 / at, set, cam, trans, cap, grade, split, build(S) -> st, update(st, t, S), name })
export const SHOTS = [];
function caller() {
  for (const l of (new Error().stack || '').split('\n')) { if (/\/engine\.js|\/lib\/[\w-]+\.js|\/models\.js/.test(l)) continue;
    const m = l.match(/((?:scenes\/)?[\w.-]+\.js):(\d+):\d+/); if (m && !m[1].startsWith('host')) return { file: m[1], line: +m[2] }; }
  return null;
}
export function shot(def) {
  const src = caller(); def._file = SUITE.module || src?.file || null; def._line = src?.line ?? null;
  if (def.t0 == null) def.t0 = def.at ?? def.t;
  if (def.t0 == null && def.say != null) { const f = sayTime(def.say); if (f) { def.t0 = Math.max(0, f.t - .06); def._sayAt = f.t; } else { console.warn(`say miss: "${def.say}" (${def._file}:${def._line}) - the words were not found after the previous shot's`); def.t0 = (SHOTS[SHOTS.length - 1]?.t0 ?? -2) + 2; } }
  if (def.t0 == null) def.t0 = SHOTS.length ? SHOTS[SHOTS.length - 1].t0 + 2 : 0;
  if (!SHOTS.length && def.t0 < .5) def.t0 = 0;
  SHOTS.push(def); return def;
}
/** loop: the last shot returns to the opening composition (the opening shot's build + camera, timed to end on it) */
export function loopShot(def = {}) { return shot({ ...def, _loop: true }); }
let END = 0;
export function finalizeShots(end) {
  SHOTS.sort((a, b) => a.t0 - b.t0); SHOTS.forEach((s, i) => (s.t1 = i + 1 < SHOTS.length ? SHOTS[i + 1].t0 : end)); END = end;
  for (const s of SHOTS) if (s._loop && SHOTS[0] !== s) { const f = SHOTS[0]; s.build ??= f.build; s.update ??= f.update; s.cam ??= f.cam; s.set ??= f.set; s.grade ??= f.grade; s._loopOf = f; }
}
export function activeIndex(t) { let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1].t0) i++; return i; }
const TRANS = { cut: 0, push: 1, 'push-up': 1, 'push-down': 1, 'push-left': 1, 'push-right': 1, blinds: 2, flash: 3, mosaic: 4, black: 5, dissolve: 6, ghost: 6 };
export const transOf = s => s.trans ?? 'cut';
const durOf = s => s.transDur ?? ({ flash: .12, mosaic: .5, black: .5, dissolve: .5, ghost: .7 }[transOf(s)] ?? +(SETTINGS.transitions?.duration ?? .36));

// ---------- building a shot ----------
export const EVENTS = [];
let COLLECT = false;
/** sound effects on picture events: sfx('whoosh' | 'impact' | 'thud' | 'cash' | 'coin' | 'chime' | 'win' | 'click' | 'beep' | 'pop' | 'swish' | 'crowd' | 'cheer' | 'gasp' | 'heartbeat' | 'alarm' | 'explosion' | 'honk' | 'glass' | 'slot' | 'roulette' | 'cards' | 'chips' | 'typing' | 'phone' | 'camera' | 'stamp' | 'bell', t, { gain dB, pan 0..1 }) */
export function sfx(type, t, o = {}) { if (!COLLECT || t == null || !isFinite(t)) return; EVENTS.push({ t: +(+t).toFixed(3), type, pan: o.pan ?? .5, gain: o.gain ?? 0, dur: o.dur ?? 0 }); }
function makeS(def, pane = 0) {
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, RW / RH, .05, 400);
  scene.background = new THREE.Color(MOODY ? 0x05060a : 0xbcd2e8);
  // a loop shot is built like the opening shot and runs in the opening's own times (it ends where the video began)
  const L = def._loopOf;
  const S = { scene, cam, def, t0: L ? L.t0 : def.t0, t1: L ? L.t1 : def.t1, dur: def.t1 - def.t0, actors: [], props: [], ticks: [], ov: [], spots: {}, pane, look: LOOK, moody: MOODY, vert: VERT, C };
  S.add = (...objs) => { for (const o of objs) { if (o instanceof Actor) { scene.add(o.root); S.actors.push(o); } else if (o?.isObject3D) { scene.add(o); if (o.userData.libId || o.userData.pickRoot) S.props.push(o); } } return objs[0]; };
  S.tick = f => { S.ticks.push(f); return f; };
  S.over = item => { item.src ??= caller() || { file: def._file, line: def._line }; S.ov.push(item); return item; };
  S.at = (word, o = {}) => { const near = o.near ?? (def._sayAt ?? def.t0) + (o.after ?? 0); return cue(word, near, o.which || 's'); };   // a word of this shot's clause
  // people and things
  S.person = (o = {}) => { const a = person(o); if (o.at) a.at(...[].concat(o.at)); if (o.spot && S.spots[o.spot]) { const [x, z, ry] = S.spots[o.spot]; a.at(x, 0, z, ry); } if (o.face && typeof o.face !== 'string') a.face(o.face); S.add(a); return a; };
  S.animal = (ref, o = {}) => { const a = animal(ref, o); if (o.at) a.at(...[].concat(o.at)); S.add(a); return a; };
  S.prop = (ref, o = {}) => { const m = A.model(ref, o); if (o.at) m.position.set(...(o.at.length === 2 ? [o.at[0], o.y ?? 0, o.at[1]] : o.at)); if (o.ry != null) m.rotation.y = o.ry; if (o.y != null && o.at?.length === 2) m.position.y = o.y; S.add(m); return m; };
  S.set = (name, o = {}) => { const r = SETS.buildSet(S, name, o); Object.assign(S.spots, r.spots); S.setName = name; return r; };
  S.room = o => SETS.room(S, o); S.floor = o => SETS.floor(S, o); S.light = (k, o) => SETS.light(S, k, o); S.sky = k => SETS.sky(S, k); S.fog = k => SETS.fog(S, k);
  S.lamp = (p, o) => SETS.lamp(S, p, o); S.crowd = o => { const list = KIT.crowd(S, o); return list; };
  S.bills = o => KIT.bills(S, { at: S.t0, ...o }); S.sting = (text, o = {}) => KIT.sting(S, text, { at: def._sayAt ?? def.t0, ...o });
  S.ring = (target, o = {}) => { const b = subjectBox(target), c = b.getCenter(new THREE.Vector3()), r = KIT.ring(o.r ?? Math.max(.45, (b.max.x - b.min.x) * .7), o); r.position.set(c.x, .015, c.z); S.scene.add(r); return r; };
  // the camera: S.camera('push', { on: actor }) | S.camera([{ t, p, l, fov, roll }])
  S.camera = (spec, o) => { S._cam = cameraRig(S, typeof spec === 'string' ? { ...(o || {}), kind: spec } : spec); if (o?.on || spec?.on) S.subject = o?.on || spec.on; if (spec?.kind === 'pov' || o?.from) S.pov = o?.from || spec.from; return S._cam; };
  // overlays (2D): S.callout('+$500', { on: actor, at, color: 'green' }) ...
  for (const k of ['callout', 'counter', 'panel', 'stamp', 'arrows', 'cctv', 'live', 'custom']) S[k] = (...a) => { const item = UI[k](...a); item.t0 ??= def.t0; return S.over(item); };
  // look of this shot: grade { sat, tint, bright, contrast, grey, vignette } or a function of t; flash(at, dur)
  S.grade = g => { S._grade = g; }; S.flash = (at, dur = .35) => { (S._flashes ??= []).push([at, dur]); sfx('swish', at, { gain: -10 }); };
  // environment drops to black around who stays (keep: [actor, ...]) at `at` (0.3 s), e.g. into a symbolic void
  S.drop = (at, keep = [], o = {}) => { S._drop = { at, keep: new Set(keep.flatMap(k => k instanceof Actor ? [k.root] : [k])), dur: o.dur ?? .3, color: new THREE.Color(o.color ?? 0x000000) }; };
  S.sfx = sfx; S.screen = p => projectTo(S, p);
  return S;
}
// a point / object / actor -> [x, y] frame pixels and whether it is in front of the camera
function projectTo(S, p) {
  let w;
  if (p instanceof Actor) w = p.head().add(new THREE.Vector3(0, .3, 0));
  else if (p?.isVector3) w = p.clone(); else if (Array.isArray(p)) w = new THREE.Vector3(p[0], p[1] ?? 0, p[2] ?? 0);
  else if (p?.isObject3D) { const b = new THREE.Box3().setFromObject(p); w = b.getCenter(new THREE.Vector3()); w.y = b.max.y + .1; } else w = new THREE.Vector3();
  const c = w.clone().applyMatrix4(S.cam.matrixWorldInverse), q = w.clone().project(S.cam);
  return [(q.x + 1) / 2 * FW, (1 - q.y) / 2 * FH, c.z < -S.cam.near];
}
function live(def) {
  if (def._S) return def;
  const S = makeS(def);
  def._S = S;
  try {
    if (def.set) S.set(def.set, def.setOpts || {});
    def._st = (def.build ? def.build(S) : null) || {};
    if (!S._lights?.length && !def.set) SETS.light(S);                // nothing lit: the look's light
    if (!S._cam) S.camera(def.cam || 'push', { on: def.on || S.subject || S.actors[0] || S.props[S.props.length - 1] });
    else if (def.cam && typeof def.cam !== 'string' && !Array.isArray(def.cam)) S.camera(def.cam.kind || 'push', def.cam);
    if (def.split && def.buildB) {                                     // a split screen: pane B is a second scene
      const B = makeS(def, 1); def._SB = B; if (def.setB) B.set(def.setB); def._stB = def.buildB(B) || {}; if (!B._lights?.length && !def.setB) SETS.light(B);
      if (!B._cam) B.camera(def.camB || 'push', { on: B.actors[0] || B.props[B.props.length - 1] });
    }
  } catch (e) { def._S = null; throw e; }
  for (const a of S.actors) a.update(S.t0);
  // one step at the shot's start: the camera fixes its framing on the first frame it draws, so a shot first drawn mid-way (a
  // seek, a still, check_layout) framed differently from the export, which draws it from the start (check: determinism)
  stepS(S, def, def.t0, def._st); if (def._SB) stepS(def._SB, def, def.t0, def._stB);
  if (PS1.snap || PS1.affine) psx(S.scene);
  return def;
}
// PS1 strict toggles (off by default): vertex snapping (wobble) and affine texture warp, injected into every material
const PS1 = { snap: !!SETTINGS.ps1?.snap, affine: !!SETTINGS.ps1?.affine };
function psx(root) {
  root.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { if (!m || m.userData.psx) continue; m.userData.psx = true; const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => { prev?.call(m, sh, r);
      if (PS1.snap) sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n{ vec2 g = vec2(${(RW / 2).toFixed(1)}, ${(RH / 2).toFixed(1)}); gl_Position.xy = floor(gl_Position.xy / gl_Position.w * g + .5) / g * gl_Position.w; }`);
      if (PS1.affine && /vMapUv/.test(sh.vertexShader)) { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vAffW;').replace('#include <project_vertex>', '#include <project_vertex>\nvAffW = gl_Position.w; vMapUv *= gl_Position.w;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAffW;').replace('#include <map_fragment>', '{ vec2 vMapUv = vMapUv / vAffW;\n#include <map_fragment>\n}'); } };
    const key = m.customProgramCacheKey?.bind(m); m.customProgramCacheKey = () => (key ? key() : '') + `|psx${PS1.snap}${PS1.affine}`; m.needsUpdate = true; } });
}
function stepS(S, def, t, st) {
  const lt = def._loopOf ? t - def.t1 + def._loopOf.t0 : t;           // a loop shot replays the opening's own times, ending where it began
  for (const a of S.actors) a.update(lt);
  for (const a of S.actors) a.root.updateMatrixWorld(true);         // (head() / boneAt() read world matrices: fresh ones for cameras and ticks)
  for (const f of S.ticks) f(lt, S);
  def.update?.(st, lt, S);
  for (const p of S.props) p.userData.update?.(lt);
  S.scene.traverse(o => { if (o !== S.scene && o.userData.update && !S.props.includes(o)) o.userData.update(lt); });
  S._cam?.(S.cam, lt);
  if (S.bounds && S.def.camInside !== false) {      // a room's camera stays in the room (and keeps aiming where it aimed)
    const B = S.bounds, p = S.cam.position, m = .25, aim = p.clone().add(S.cam.getWorldDirection(new THREE.Vector3()).multiplyScalar(3)), q = p.clone();
    p.x = clamp(p.x, B.x0 + m, B.x1 - m); p.z = clamp(p.z, B.z0 + m, B.z1 - m); if (B.h) p.y = Math.min(p.y, B.h - .15);
    if (!p.equals(q)) {                               // closer than the framing wanted: a wider lens keeps the subject in
      const c = S.subject ? subjectBox(S.subject).getCenter(new THREE.Vector3()) : aim, d0 = q.distanceTo(c), d1 = Math.max(.3, p.distanceTo(c));
      S.cam.lookAt(S.subject ? c.clone().lerp(aim, .3) : aim);
      if (d1 < d0) { S.cam.fov = Math.min(84, 2 * Math.atan(Math.tan(S.cam.fov * Math.PI / 360) * d0 / d1) * 180 / Math.PI); S.cam.updateProjectionMatrix(); }
    }
  }
  S.cam.updateMatrixWorld(); S.cam.matrixWorldInverse.copy(S.cam.matrixWorld).invert();
  if (S._keyFollow && S._key && S.subject) keyOn(S);
  if (S._drop) dropAt(S, lt);
  S.lt = lt;
}
// moody key light: a warm spot above and to the side of the camera, on the subject (never a silhouette)
function keyOn(S) {
  const b = subjectBox(S.subject), c = b.getCenter(new THREE.Vector3()), d = S.cam.position.clone().sub(c); d.y = 0; d.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), .6);
  S._key.position.copy(c).addScaledVector(d, 2.2).add(new THREE.Vector3(0, 2.4, 0)); S._key.target.position.copy(c); S._key.target.updateMatrixWorld();
}
function dropAt(S, t) {
  const d = S._drop, k = E.inOut(seg(t, d.at, d.at + d.dur));
  S.scene.traverse(o => { if (!o.isMesh && !o.isPoints && !o.isLight) return; let kept = false; for (let x = o; x; x = x.parent) if (d.keep.has(x)) { kept = true; break; }
    if (kept) return; if (o.isLight) { o.userData.i0 ??= o.intensity; o.intensity = o.userData.i0 * (1 - k * .6); return; } o.visible = k < .98 && (o.userData.v0 ??= o.visible); });
  if (S.scene.background?.isColor) { S.scene.userData.bg0 ??= S.scene.background.clone(); S.scene.background.copy(S.scene.userData.bg0).lerp(d.color, k); }
  else if (k > .5) S.scene.background = d.color.clone();
}
function step(def, t) {
  live(def); stepS(def._S, def, t, def._st);
  if (def._SB) stepS(def._SB, def, t, def._stB);
  return def._S;
}
let KEEP = 3;
export const setKeep = n => { KEEP = Math.max(3, n | 0); };
function dispose(def) {
  for (const S of [def._S, def._SB]) { if (!S) continue; S.scene.traverse(o => { if (o.isSkinnedMesh) return; o.geometry?.dispose?.(); }); }
  def._S = null; def._SB = null; def._st = null; def._stB = null; def._floatSeen = false; def._flatSeen = false; def._wornSeen = false; def._thinSeen = false;
}
function trim(i) { const built = []; SHOTS.forEach((s, k) => { if (s._S) built.push(k); }); built.sort((a, b) => Math.abs(b - i) - Math.abs(a - i)); for (let n = built.length, j = 0; n > KEEP && j < built.length; j++) if (Math.abs(built[j] - i) > 1) { dispose(SHOTS[built[j]]); n--; } }
export function prewarm(t, ahead = 2) {
  const i = activeIndex(t);
  for (let k = i + 1; k <= i + ahead && k < SHOTS.length; k++) if (!SHOTS[k]._S && !SHOTS[k]._warmFail) { try { live(SHOTS[k]); renderer.compile(SHOTS[k]._S.scene, SHOTS[k]._S.cam); } catch { SHOTS[k]._warmFail = true; continue; } trim(i); return true; }
  return false;
}

// ---------- frame ----------
function renderShot(def, t, target) {
  const S = step(def, t);
  if (def._SB) {
    renderer.setRenderTarget(POST.rtP1); renderer.setClearColor(0, 1); renderer.clear(); renderer.render(S.scene, S.cam);
    renderer.setRenderTarget(POST.rtP2); renderer.clear(); renderer.render(def._SB.scene, def._SB.cam);
    POST.mix(POST.rtP1, POST.rtP2, 0, { h: 7, v: 8, diag: 9 }[def.split] ?? 7, target);
  } else { renderer.setRenderTarget(target); renderer.setClearColor(0, 1); renderer.clear(); renderer.render(S.scene, S.cam); }
  return S;
}
function transitionAt(t) {
  for (let j = 1; j < SHOTS.length; j++) { const s = SHOTS[j], ty = transOf(s); if (ty === 'cut') continue; const D = durOf(s);
    const a = ty === 'flash' ? s.t0 - D / 2 : s.t0 - D / 2; if (t >= a && t < a + D) return { A: SHOTS[j - 1], B: s, k: (t - a) / D, type: ty }; }
  return null;
}
function gradeOf(S, t) {
  const g = typeof S._grade === 'function' ? S._grade(t) : S._grade || {};
  const out = { ...g };
  if (S.def.grade === 'grey' || g === 'grey') out.grey = 1;
  else if (typeof S.def.grade === 'object') Object.assign(out, S.def.grade);
  // a flash peaks at 70% white (a full-white frame reads as a broken render / strobes on phones)
  let fl = 0; for (const [at, d] of S._flashes || []) if (t >= at && t < at + d) fl = Math.max(fl, .7 * (1 - (t - at) / d));
  out.flash = Math.max(out.flash || 0, fl);
  return out;
}
export function compose(t) {
  const i = activeIndex(t); trim(i);
  if (!SHOTS.length) { renderer.setRenderTarget(null); renderer.setClearColor(0, 1); renderer.clear(); return outCanvas; }
  const tr = transitionAt(t); let S, grade;
  if (tr) {
    const SA = renderShot(tr.A, t, POST.rtA), SB = renderShot(tr.B, t, POST.rtB);
    const dir = { 'push-up': [0, 1], push: [0, 1], 'push-down': [0, -1], 'push-left': [1, 0], 'push-right': [-1, 0] }[tr.type] || [0, 1];
    POST.mix(POST.rtA, POST.rtB, tr.k, TRANS[tr.type] ?? 6, POST.rtMix, dir);
    S = tr.k < .5 ? SA : SB; grade = gradeOf(S, t);
    if (tr.type === 'flash') grade.flash = Math.max(grade.flash || 0, .7 * Math.max(0, 1 - Math.abs(tr.k - .5) * 3));   // (<= 70% white, ~2-3 frames)
  } else { S = renderShot(SHOTS[i], t, POST.rtMix); grade = gradeOf(S, t); }
  overlay(S, t);
  if (SUITE.pick) return outCanvas;
  POST.finish(POST.rtMix, grade, ovTex, t);
  return outCanvas;
}
// ---------- overlay: callouts, UI, captions ----------
let CAPS = null;
function overlay(S, t) {
  ov.setTransform(1, 0, 0, 1, 0, 0); ov.clearRect(0, 0, FW, FH);
  const lt = S.lt ?? t; S._ovBoxes = [];
  for (const it of S.ov) {
    if (lt < it.t0 - .001 && t < it.t0 - .001) continue; if (it.t1 != null && lt > it.t1 + .3) continue;
    ov.save(); try { it.draw(ov, lt, 1, S); } catch (e) { console.warn('overlay: ' + e.message); } ov.restore();
    if (it.box) S._ovBoxes.push({ what: it.what + (it.text ? ` "${String(it.text).slice(0, 30)}"` : ''), box: it.box, src: it.src, age: lt - (it.t0 ?? -1e9), text: typeof it.text === 'string' });
    if (SUITE.pick && it.box) SUITE.pick.push({ kind: it.what || 'overlay', text: typeof it.text === 'string' ? it.text : null, key: null, x: it.box.x, y: it.box.y, w: it.box.w, h: it.box.h, alpha: 1, src: it.src || null });
    it.box = null;
  }
  S._capBox = null;
  if (SETTINGS.captions?.on !== false && WORDS.length && S.def.captions !== false) {
    CAPS ??= UI.chunkWords(WORDS);
    const c = CAPS.find(c => t >= c.s - .02 && t < c.until);
    if (c) { const b = UI.drawCaption(ov, c); S._capBox = b; if (SUITE.pick) SUITE.pick.push({ kind: 'caption', text: c.text, key: null, ...b, alpha: 1, src: null }); }
  }
  ovTex.needsUpdate = true;
}
export function captionAt(t) { if (SETTINGS.captions?.on === false || !WORDS.length) return null; CAPS ??= UI.chunkWords(WORDS); return CAPS.find(c => t >= c.s - .02 && t < c.until) || null; }

// ---------- export (WebCodecs H.264, streamed to /append/<name>) ----------
export async function exportVideo({ name = 'video', fps = 30, from = 0, to, bitrate = 16e6, onProgress } = {}) {
  const chunks = []; let bytes = 0, first = true, err = null;
  const enc = new VideoEncoder({ output: c => { const b = new Uint8Array(c.byteLength); c.copyTo(b); chunks.push(b); bytes += b.length; }, error: e => err = e });
  let cfg = { codec: 'avc1.640032', width: FW, height: FH, bitrate, framerate: fps, latencyMode: 'quality', avc: { format: 'annexb' } };
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
  for (const s of SHOTS.slice(1)) { const ty = transOf(s); if (ty !== 'cut') EVENTS.push({ t: +(s.t0 - durOf(s) / 2).toFixed(3), type: ty === 'flash' ? 'impact' : ty === 'mosaic' ? 'glitch' : 'whoosh', pan: .5, gain: -8, dur: 0 }); }
  for (const s of SHOTS) { const c = typeof s.cam === 'string' ? s.cam : s.cam?.kind; if (c === 'pull') EVENTS.push({ t: +(s.t0 + .35).toFixed(3), type: 'whoosh', pan: .5, gain: -10, dur: 0 }); }
  const seen = new Set(), list = [];
  for (const e of EVENTS.slice().sort((a, b) => a.t - b.t)) { const k = e.type + Math.round(e.t * 20); if (seen.has(k)) continue; seen.add(k); list.push(e); }
  return { shots, hits: [], cards: [], sfx: list.filter(e => e.t >= 0 && e.t <= end + 1), style: 'lowpoly' };
}
// ---------- the layout / clipping check (check_layout) ----------
export function checkTimes() {
  const ts = [];
  // every 0.5 s (it was 1.2 s: a briefcase swinging through a leg between two checks went unseen); ~25 ms a frame, so a
  // 40 s short checks in ~3 s. For motion, pass times every 0.2 s (references/sop.md G4).
  SHOTS.forEach(s => { const D = transOf(s) === 'cut' ? 0 : durOf(s) / 2, a = s.t0 + D + .12, b = (s.t1 ?? END) - .12; if (b > a) { ts.push(a, (a + b) / 2, b); for (let x = a + .5; x < b - .25; x += .5) ts.push(x); } });
  const seen = new Set(); return ts.filter(t => t >= 0 && t <= END && !transitionAt(t)).map(t => +t.toFixed(2)).sort((a, b) => a - b).filter(t => { const k = Math.round(t * 5); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 400);
}
export function layoutIssues(t) {
  const i = activeIndex(t), def = SHOTS[i]; if (!def || transitionAt(t)) return [];
  compose(t);
  const S = def._S, where = `(${def._file}:${def._line})`;
  const out = checkIssues(S, def, t, where, tt => step(def, tt));
  if (def._SB) out.push(...checkIssues(def._SB, def, t, where + ' [split B]', null));
  for (const e of A.ENTRIES.length ? [] : [1]) out.push({ t, type: 'library', what: 'asset library', detail: 'the asset library could not be read (index.json): library models will not load.' });
  return out;
}
// ---------- picking (the editor's click to select) ----------
export function PICKABLE(o) { if (!o.isMesh || o.userData.noPick || o.userData.ground) return false; const m = Array.isArray(o.material) ? o.material[0] : o.material; return !(m?.transparent && (m.opacity ?? 1) < .5); }
export function pickTarget(hit, S, st) {
  let o = hit.object, root = null, actor = null;
  for (let x = o; x && !x.isScene; x = x.parent) { if (x.userData.actor) { actor = x.userData.actor; root = x; break; } if (x.userData.pickRoot) root = x; }
  root ??= o; root.updateMatrixWorld(true);
  const key = Object.entries(st || {}).find(([, v]) => v === actor || v === root || v?.root === root)?.[0];
  return { object: root, key: key ? `st.${key}` : null, kind: actor ? (actor.animal ? 'animal' : 'person') : root.userData.kind || null, name: actor ? actor.name || actor.entry.name : root.name || null, box: actor ? actor.box() : new THREE.Box3().setFromObject(root) };
}
// the colour names scenes use (the host shows a clicked surface's colour by name)
export { screenRect };
export const libraryCredits = () => A.credits();
