// The low-poly asset library in the page: ONE merged index (the app's seed library + the user's own finds), loaded
// before the first frame for everything the scenes name (lib/scan.js), cloned per shot, scaled to real size, credited.
// Served by the Suite at <project>/__lib/ (index.json = the merged index; files: the user's library first, then the seed).
import { THREE, MOODY } from './core.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from '../vendor/jsm/utils/SkeletonUtils.js';
import { scanIds, resolveRef, resolveExact, searchEntries, creditsText, SET_NEEDS, PERSON_NEEDS } from './scan.js';
export { SkeletonUtils, SET_NEEDS };

export const LIB = new URL('../__lib/', import.meta.url).href;
export const ROOT = new URL('../', import.meta.url).href;
export let ENTRIES = [];
const BY_ID = new Map();
const GLTF = new Map(), TEX = new Map(), PENDING = new Map();
export const USED = new Set();                       // every id loaded for this video (credits)
let indexP = null;
export function loadIndex() {
  return indexP ??= fetch(LIB + 'index.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : { entries: [] }).then(j => {
    ENTRIES = j.entries || []; BY_ID.clear(); for (const e of ENTRIES) BY_ID.set(e.id, e); return ENTRIES;
  }).catch(e => { console.warn('asset library not reachable: ' + e.message); ENTRIES = []; return ENTRIES; });
}
export const entry = id => BY_ID.get(id);
/** search('slot machine', { kind: 'prop', tags: ['casino'] }) -> index entries, best first */
export const search = (query, o = {}) => searchEntries({ query, ...o }, ENTRIES);
/** an index entry from an id ('char.base_m_grey' or 'base_m_grey'), a name or search words */
export function find(ref, kind) {
  if (ref && typeof ref === 'object' && ref.id) return ref;
  const e = resolveRef(String(ref), ENTRIES, BY_ID, kind);
  if (!e) throw new Error(`Nothing in the asset library for "${ref}"${kind ? ` (${kind})` : ''}: search it with the lowpoly_asset tool, or build it from the kit.`);
  return e;
}
const loader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
function prepTexture(t, nearest) {
  t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = !nearest; t.anisotropy = 1;
  t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.minFilter = nearest ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
  return t;
}
/** Load (once) every id given. Each lands in the cache; build() code then gets clones synchronously. */
export async function preload(ids) {
  await loadIndex();
  const list = [...new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean))].map(r => { try { return find(r); } catch (e) { console.warn(e.message); return null; } }).filter(e => e && e.file);
  await Promise.all(list.map(e => {
    if (GLTF.has(e.id) || TEX.has(e.id)) return null;
    if (PENDING.has(e.id)) return PENDING.get(e.id);
    const url = LIB + e.file;
    const p = (e.kind === 'texture' ? texLoader.loadAsync(url).then(t => { TEX.set(e.id, prepTexture(t, !MOODY && !/sky/.test(e.id))); })
      : loader.loadAsync(url).then(g => { GLTF.set(e.id, g); g.scene.traverse(o => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (m.map) prepTexture(m.map, !MOODY); m.metalness = 0; } } }); }))
      .then(() => { USED.add(e.id); }).catch(err => console.warn(`asset ${e.id} failed to load: ${err.message}`));
    PENDING.set(e.id, p); return p;
  }));
}
/** Scan the project's scene code (and models.js) and preload everything it names. Called by the engine before any scene. */
export async function preloadProject() {
  await loadIndex();
  let pj = {}; try { pj = await (await fetch(ROOT + 'project.json', { cache: 'no-store' })).json(); } catch { /* standalone */ }
  const files = [...(pj.scenes || []).map(s => `scenes/${s}.js`), 'models.js'];
  const sources = await Promise.all(files.map(f => fetch(ROOT + f, { cache: 'no-store' }).then(r => r.ok ? r.text() : '').catch(() => '')));
  const ids = scanIds(sources, ENTRIES);
  await preload(ids);
  return ids;
}
export function gltf(ref) {
  const e = find(ref);
  const g = GLTF.get(e.id);
  if (!g) throw new Error(`asset "${e.id}" is not loaded: write its id as a plain string in the scene file (the engine preloads every id it finds), or await preload('${e.id}') at the top of the scene file`);
  USED.add(e.id);
  return { g, e };
}
export function texture(ref, { repeat = null } = {}) {
  const e = find(ref, 'texture'), t = TEX.get(e.id);
  if (!t) throw new Error(`texture "${e.id}" is not loaded: name it as a plain string in the scene file`);
  USED.add(e.id);
  if (!repeat) return t;
  const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(...(Array.isArray(repeat) ? repeat : [repeat, repeat])); c.needsUpdate = true; return c;
}
const isSkinned = o => { let s = false; o.traverse(x => { if (x.isSkinnedMesh) s = true; }); return s; };
/** A fresh copy of a library model: skeletons cloned properly, shadows on, its real size (o.size: longest side, o.height,
 *  o.width, o.length) or the declared size_m; origin at the bottom centre, front +Z (library conventions). */
export function model(ref, o = {}) {
  const { g, e } = gltf(ref);
  const root = isSkinned(g.scene) ? SkeletonUtils.clone(g.scene) : g.scene.clone(true);
  root.traverse(x => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; if (x.material?.transparent && x.material.opacity > .95) x.material.transparent = false; } });
  const wrap = new THREE.Group(); wrap.add(root); wrap.name = o.name || e.name; wrap.userData.libId = e.id; wrap.userData.kind = o.kind || e.kind; wrap.userData.pickRoot = true;
  if (o.size || o.height || o.width || o.length) {
    const b = new THREE.Box3().setFromObject(root), s = b.getSize(new THREE.Vector3());
    const k = o.height ? o.height / s.y : o.width ? o.width / s.x : o.length ? o.length / s.z : o.size / Math.max(s.x, s.y, s.z);
    root.scale.multiplyScalar(k);
  }
  if (o.tint) recolor(wrap, o.tint, o.tintMix ?? .6);
  wrap.userData.animations = g.animations || [];
  return wrap;
}
/** Tint every material of an object toward a colour (k: 0 none .. 1 flat colour). Materials are cloned (shared cache intact). */
export function recolor(obj, color, k = .6) {
  const c = new THREE.Color(color);
  obj.traverse(x => { if (!x.isMesh) return; const ms = Array.isArray(x.material) ? x.material : [x.material];
    const nm = ms.map(m => { const n = m.clone(); n.color = n.color.clone().lerp(c, k); if (n.map && k > .85) n.map = null; return n; }); x.material = Array.isArray(x.material) ? nm : nm[0]; });
  return obj;
}
/** Clip by name from the library's animation files (anim.ual1, anim.ual2, anim.kaykit_ue, anim.gestures ...). */
export function clip(name) {
  for (const id of ['anim.ual1', 'anim.gestures', 'anim.ual2', 'anim.kaykit_ue', 'anim.ual1_rm', 'anim.ual2_rm', ...ENTRIES.filter(e => e.kind === 'animation').map(e => e.id)]) {
    const g = GLTF.get(id); const c = g?.animations.find(a => a.name === name); if (c) { USED.add(id); return c; }
  }
  const owner = ENTRIES.find(e => e.kind === 'animation' && (e.animations || []).some(a => (a.name || a) === name));
  throw new Error(owner ? `clip "${name}" is in ${owner.id}, which is not loaded: write '${name}' as a plain string in the scene file` : `no clip named "${name}" in the library (see the skill's references/motion.md for the list)`);
}
export function clipNames() { return ENTRIES.filter(e => e.kind === 'animation').flatMap(e => (e.animations || []).map(a => a.name || a)); }
export const credits = () => creditsText([...USED], ENTRIES);
export { scanIds, resolveExact, PERSON_NEEDS };
