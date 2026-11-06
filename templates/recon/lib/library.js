// Downloaded models (free licences, credited in src/assets/models/CREDITS.json and in the video description).
// story.json "models": { key: "assets/models/<story>/file.glb" } are loaded before the scenes run.
// model(key, o) returns a fresh clone, restyled for the reconstruction look and normalised in size:
//   o.size: target length of the longest side (m), or o.height / o.length (x) / o.width (z) for one axis
//   o.base: 'bottom' (default: origin at the bottom centre, so it stands on y = 0) | 'center'
//   o.look: 'tone' (default: clay, brightness of the original colour kept so parts stay readable) | 'clay' (one colour) | 'orig'
//   o.tint: clay colour, o.dark: darkest tone for 'tone'
//   o.upright: rotate the model's symmetry axis (body of revolution) onto +y, narrow end up
import { THREE, C, ROOT, loadImages, selectable } from '../engine.js';
const rel = u => /^(\.\.\/|\/|https?:|data:|blob:)/.test(u) ? u : ROOT + u;
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

export const MODELS = {}, TEXTURES = {};
export async function loadModels(map) {
  const L = new GLTFLoader();
  await Promise.all(Object.entries(map).map(async ([k, url]) => { const g = await L.loadAsync(rel(url)); MODELS[k] = g; }));
}
// story.json "textures": { key: path } - preloaded so the first frame never renders an empty (black) texture.
// A key ending in '@data' is a data map (no sRGB): displacement, bump, roughness.
export async function loadTextures(map) {
  const L = new THREE.TextureLoader();
  await Promise.all(Object.entries(map).map(async ([k, url]) => { const t = await L.loadAsync(rel(url)); const data = k.endsWith('@data');
    if (!data) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; TEXTURES[data ? k.slice(0, -5) : k] = t; }));
}
// symmetry axis of a body of revolution (capsule, cone, can), searched within 50 deg of +y: seen down its true axis the
// silhouette is a disc, so all 18 projected widths are equal; any tilt makes it an oval. Score = (max - min) / mean width.
// (Failed first on the CM scan: smallest-variance PCA - 3.9 m wide x 3.1 m tall spreads almost equally; per-sector radius
// symmetry - the open docking tunnel breaks it; smallest footprint - a squat body is as wide from the side as from above.)
// Returned pointing to the narrow end.
function symAxis(obj) {
  const pts = [], v = new THREE.Vector3(); obj.updateMatrixWorld(true);
  obj.traverse(m => { if (!m.isMesh) return; const p = m.geometry.attributes.position, st = Math.max(1, Math.floor(p.count / 3000));
    for (let i = 0; i < p.count; i += st) pts.push(v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).clone()); });
  const basis = a => { const u = Math.abs(a.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), e1 = u.clone().cross(a).normalize(); return [e1, a.clone().cross(e1)]; };
  const widths = (a, sel) => { const [e1, e2] = basis(a), W = [];
    for (let k = 0; k < 18; k++) { const ang = k / 18 * Math.PI, dx = Math.cos(ang), dy = Math.sin(ang); let mn = Infinity, mx = -Infinity;
      for (const p of (sel || pts)) { const s = p.dot(e1) * dx + p.dot(e2) * dy; mn = Math.min(mn, s); mx = Math.max(mx, s); } W.push(mx - mn); }
    return W; };
  const foot = (a, sel) => Math.max(...widths(a, sel));
  const roundness = a => { const W = widths(a); return (Math.max(...W) - Math.min(...W)) / (W.reduce((x, y) => x + y) / W.length); };
  let best = null; const tryA = a => { const sc = roundness(a); if (!best || sc < best.sc) best = { a: a.clone(), sc }; };
  for (let t = 0; t <= 50; t += 2) for (let f = 0; f < 360; f += t ? 4 : 360) { const T = t * Math.PI / 180, F = f * Math.PI / 180; tryA(new THREE.Vector3(Math.sin(T) * Math.cos(F), Math.cos(T), Math.sin(T) * Math.sin(F))); }
  const a0 = best.a.clone(); for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) tryA(a0.clone().add(new THREE.Vector3(dx * .006, 0, dz * .006)).normalize());
  const a = best.a, H = pts.map(p => p.dot(a)), lo = Math.min(...H), hi = Math.max(...H);
  const wTop = foot(a, pts.filter((p, i) => H[i] > hi - (hi - lo) * .25)), wBot = foot(a, pts.filter((p, i) => H[i] < lo + (hi - lo) * .25));
  return wTop < wBot ? a : a.negate();
}
// distance from `from` along `dir` to the first surface of obj (e.g. the docking port on an axis, past antennas off-axis)
export function hitAlong(obj, from, dir) { obj.updateMatrixWorld(true); const r = new THREE.Raycaster(from, dir.clone().normalize()); const h = r.intersectObject(obj, true)[0]; return h ? h.distance : null; }
const lum = c => .2126 * c.r + .7152 * c.g + .0722 * c.b;
const cache = new Map();
function restyle(m, o) {
  if (o.look === 'orig') return m;
  const src = Array.isArray(m) ? m[0] : m, base = new THREE.Color(o.tint ?? C.clay), dark = new THREE.Color(o.dark ?? 0x6d7177);
  let L = src.color ? lum(src.color) : .8; if (src.map && L > .95) L = .8;           // textured parts: the map carries the colour; assume a mid tone
  const key = `${o.look}|${base.getHex()}|${dark.getHex()}|${Math.round(L * 20)}|${!!src.transparent}`;
  if (cache.has(key)) return cache.get(key);
  const col = o.look === 'clay' ? base : dark.clone().lerp(base, Math.min(1, Math.pow(L, .6) * 1.15));
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: .85, metalness: 0, transparent: !!src.transparent && src.opacity < .9, opacity: src.opacity ?? 1, side: src.side ?? THREE.FrontSide });
  cache.set(key, mat); return mat;
}
export function model(key, o = {}) {
  const g = MODELS[key]; if (!g) throw new Error('model not loaded: ' + key);
  const inner = g.scene.clone(true), outer = new THREE.Group(); outer.add(inner);
  inner.traverse(m => { if (!m.isMesh) return; m.material = Array.isArray(m.material) ? m.material.map(x => restyle(x, o)) : restyle(m.material, o); m.castShadow = m.receiveShadow = true; });
  // o.upright: stand a scan whose symmetry axis is tilted in its file (the CM scan is ~24 deg off) - the axis goes to +y
  if (o.upright) { const ax = symAxis(inner); inner.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(ax, new THREE.Vector3(0, 1, 0))); }
  inner.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(inner, true), s = b.getSize(new THREE.Vector3());   // precise: a rotated mesh's loose box is inflated
  const k = o.height ? o.height / s.y : o.length ? o.length / s.x : o.width ? o.width / s.z : o.size ? o.size / Math.max(s.x, s.y, s.z) : 1;
  inner.scale.multiplyScalar(k); const c = b.getCenter(new THREE.Vector3()).multiplyScalar(k);
  inner.position.set(-c.x, o.base === 'center' ? -c.y : -b.min.y * k, -c.z);
  outer.userData.size = s.multiplyScalar(k); outer.userData.gltf = g;
  selectable(outer, o.name ?? key, 'model');                // a click on any part selects the whole model (o.name: its editor name)
  if (o.parent) o.parent.add(outer);
  return outer;
}

// ---------- animated characters (rigged glTF + clips; e.g. the CC0 Quaternius mannequin) ----------
// actor(key, { height, tint, dark, look, parent }) -> { group, root, bone(name), clips, pose(clip, time, weight?) , apply() }
// Deterministic: nothing advances on its own; each frame call a.pose('Swim_Fwd_Loop', t) (optionally several with weights
// that sum to 1, for blends) and then a.apply(). Clip time loops for *_Loop clips, clamps otherwise.
import * as SkeletonUtils from '../vendor/jsm/utils/SkeletonUtils.js';
export function actor(key, o = {}) {
  const g = MODELS[key]; if (!g) throw new Error('model not loaded: ' + key);
  const root = SkeletonUtils.clone(g.scene), outer = new THREE.Group(); outer.add(root);
  const skinned = [];
  root.traverse(m => { if (!m.isMesh) return; m.material = restyle(m.material, o); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; if (m.isSkinnedMesh) skinned.push(m); });
  root.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(root, true), s = b.getSize(new THREE.Vector3());
  const k = (o.height ?? s.y) / s.y; root.scale.multiplyScalar(k);
  const mixer = new THREE.AnimationMixer(root), acts = {};
  for (const c of g.animations) { const a = mixer.clipAction(c); a.play(); a.weight = 0; a.enabled = true; acts[c.name] = { a, c }; }
  let pend = [];
  const api = { group: outer, root, clips: Object.keys(acts), height: s.y * k, duration: n => acts[n].c.duration,
    bone: n => root.getObjectByName(n),
    pose(name, t, w = 1) { if (!acts[name]) throw new Error('no clip ' + name + ' in ' + key); pend.push([name, t, w]); return api; },
    apply() { for (const n in acts) acts[n].a.weight = 0;
      for (const [n, t, w] of pend) { const { a, c } = acts[n], d = c.duration; a.weight = w; a.time = /_Loop$/.test(n) ? ((t % d) + d) % d : Math.max(0, Math.min(d - 1e-3, t)); }
      mixer.update(0); pend = []; root.updateMatrixWorld(true);
      for (const m of skinned) m.boundingSphere = m.boundingBox = null;   // clicks (raycasts) and boxes follow the pose
      return api; } };
  selectable(outer, o.name ?? key, 'person'); outer.userData.api = api;   // a click selects the whole actor, as the st entry holding it
  if (o.parent) o.parent.add(outer);
  return api;
}
// clipSpeed(a, clip): ground speed (m/s, in the actor's own scale) at which an in-place walk clip must be translated so the
// planted foot does not slide: the median backward speed of the lower foot, sampled over one loop (rule: feet slide 0).
export function clipSpeed(a, clip, feet = ['foot_l', 'foot_r']) {
  const d = MODELS_DUR(a, clip), N = 120, V = [], p = new THREE.Vector3();
  const pos = []; for (let i = 0; i <= N; i++) { a.pose(clip, d * i / N).apply(); pos.push(feet.map(f => a.bone(f).getWorldPosition(p.clone()))); }
  for (let i = 0; i < N; i++) { const k = pos[i][0].y < pos[i][1].y ? 0 : 1; V.push(-(pos[i + 1][k].z - pos[i][k].z) / (d / N)); }
  V.sort((x, y) => x - y); return V[Math.floor(V.length / 2)];
}
const MODELS_DUR = (a, clip) => a.duration(clip);

// setup({ region, models, textures, sequences }): everything a film loads before its scenes build (call with top-level
// await at the top of the first scene file). region: assets/map/<region> (tools/bake_region.py); models / textures as
// above; sequences: [[prefix, n, dir]] real footage as numbered jpgs (IMG[prefix + '_f' + i]) for footage() cards.
export async function setup(o = {}) {
  if (o.region) { const W = await import('./world.js'); await W.loadWorld(ROOT, o.region); }
  if (o.models) await loadModels(o.models);
  if (o.textures) await loadTextures(o.textures);
  const imgs = {}; for (const [k, n, dir] of o.sequences || []) for (let i = 0; i < n; i++) imgs[k + '_f' + i] = rel(`${dir}/${String(i + 1).padStart(3, '0')}.jpg`);
  if (o.images) for (const [k, f] of Object.entries(o.images)) imgs[k] = rel(f);
  if (Object.keys(imgs).length) await loadImages(imgs);
}
