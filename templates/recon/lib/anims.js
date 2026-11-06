// Character animation library (3D reconstruction, lib/anims.js): every clip a figure can play, by name or by tag.
//
//   await loadAnims(['Talking On Phone', 'Idle_Loop'])   // or 'all' | 'builtin' | 'user'; loads the files those clips live in
//   animClip(name, skeletonRoot, { inPlace })             // THREE.AnimationClip fitted to THAT figure's skeleton (or null)
//   findAnims('phone') / findAnims({ tag: 'sit', loop: true })   // catalog entries, best match first
//   animInfo(name)  ANIMS  (the catalog)   animSpeed(name, skeletonRoot)  (m/s of a travelling clip, 0 in place)
//
// Two kinds of clips:
//  - built-in (CC0, shipped with the app): the character library's mocap packs (Quaternius UAL 1 + 2, the authored
//    gestures, KayKit) on the library's UE5-style skeleton (root, pelvis, spine_01-03, neck_01, Head, clavicle/upperarm/
//    lowerarm/hand_l/r, fingers, thigh/calf/foot/ball_l/r). Served at <project>/__lib/animations/*.glb.
//  - the user's own (Settings > Media > Character animations): Mixamo FBX files (or humanoid GLB/GLTF) the user downloaded
//    with their own account, converted by the app into <workspace>/assets/animations/<slug>.glb (the skeleton and its
//    animation only, no mesh) and served at <project>/__anims/. Mixamo clips are never shipped with the app.
// <project>/__anims/catalog.json is the merged catalog { builtin: [...], user: [...] } (anims3d.ts); without it (the
// experiments folder) the built-in packs are catalogued from their clip names.
//
// Retargeting (user clips): bone names are mapped onto the UE5 names (mixamorig:Hips -> pelvis, Spine/Spine1/Spine2 ->
// spine_01-03, LeftArm -> upperarm_l, LeftHandIndex1 -> index_01_l, ...); every mapped bone gets the source bone's
// world-space rotation change since its rest pose, applied to the target bone's rest pose after the two rest poses are
// lined up bone by bone (T-pose vs A-pose arms, different bone axes). The hips translation is scaled by the leg length
// ratio (feet stay on the floor, strides fit the legs). In place (default): a travelling clip's straight-line drift is
// removed (its sway kept) and its speed is reported (clip.userData.speed, animSpeed) so walkAt can move the figure.
// Deterministic: the clip is baked on a fixed frame grid; the same clip at the same time is the same pose.
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const VENDOR = new URL('../vendor/', import.meta.url).href;
const BASE = globalThis.__CZ_FIG_BASE || (/\/(lib|__figview)\/anims\.js/.test(import.meta.url) ? new URL('../', import.meta.url).href : new URL('./', import.meta.url).href);
const LIBB = () => globalThis.__CZ_FIG_LIB || new URL('__lib/', BASE).href;
const ANIMB = () => globalThis.__CZ_ANIMS_URL || new URL('__anims/', BASE).href;

// ---------------------------------------------------------------------------------------------------------------------
// names and tags
// ---------------------------------------------------------------------------------------------------------------------
export const PACKS = {
  ual1: { file: 'animations/ual1.glb', credit: 'Universal Animation Library by Quaternius (quaternius.com), CC0' },
  ual2: { file: 'animations/ual2.glb', credit: 'Universal Animation Library 2 by Quaternius (quaternius.com), CC0' },
  gestures: { file: 'animations/gestures.glb', credit: 'Gestures built on the Universal Animation Library by Quaternius, CC0' },
  kaykit: { file: 'animations/kaykit_ue.glb', credit: 'KayKit Character Animations by Kay Lousberg (kaylousberg.com), CC0' },
};
const words = n => ' ' + String(n).replace(/^(KK|G)_/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').toLowerCase().trim() + ' ';
const TAG_RULES = [
  ['idle', /\bidle\b|\bbreath|\bwait/], ['walk', /\bwalk|\bstroll|\bstrut|\bstep/], ['run', /\brun|\bsprint|\bjog/],
  ['sit', /\bsit(?!.?ups?)|\bseated|\bchair|\bsitting/], ['talk', /\btalk|\bconvers|\bspeak|\bargu|\bexplain|\bchat|\byell|\bshout/],
  ['phone', /phone|\bmobile\b/], ['point', /\bpoint/], ['carry', /\bcarry|\bhold [abc]\b|\bholding|\bbox\b/],
  ['pick-up', /\bpick ?up|\bgrab|\bharvest|\bgather|\bpick\b/], ['type', /\btyping|\btype\b|\bkeyboard|\bcomputer/],
  ['fight', /\bpunch|\bkick|\bfight|\bboxing|\bjab\b|\bhook\b|\bcross\b|\bsword|\bmelee|\battack|\bblock|\bdodge|\bcombo|\bbrawl|\bslash|\bstab|\bshield/],
  ['fall', /\bfall|\bdeath|\bdie\b|\bdying|\bknock|\bcollapse|\btrip\b/], ['dance', /\bdanc|\bsamba|\bsalsa|\bhip ?hop|\btwerk|\bmacarena|\bbreakdance|\bthriller|\bshuffl/],
  ['gesture', /\bpoint|\bshrug|\bfacepalm|\bwav(e|ing)|\bclap|\byes\b|\bno\b|\bnod|\bthumbs?\b|\bsalute|\bbow\b|\bcheer|\bhands on head|\bbeckon|\bgesture|\bfold arms/],
  ['wave', /\bwav(e|ing)/], ['cheer', /\bcheer|\bcelebrat|\bvictory|\bclap/], ['shrug', /\bshrug/], ['facepalm', /\bfacepalm/],
  ['think', /\bthink|\bponder|\bthought|\bidle no\b/], ['yes', /\byes\b|\bnod/], ['no', /\bno\b|\bhead ?shake/], ['fold-arms', /\bfold arms|\bcrossed arms|\barms crossed/],
  ['hands-on-head', /\bhands on head/], ['hands-up', /\bhands up|\bsurrender|\bhold up overhead/],
  ['react', /\bhit\b|\breact|\bknock|\bshock|\bsurpris|\bscared|\bflinch|\bstagger/], ['hit', /\bhit\b|\bimpact/], ['death', /\bdeath|\bdie\b|\bdying|\bdead\b/],
  ['lie', /\blie\b|\blying|\blay\b|\bsleep/], ['crouch', /\bcrouch|\bkneel|\bsquat/], ['kneel', /\bkneel/], ['sneak', /\bsneak|\bcrouch fwd|\btiptoe/],
  ['jump', /\bjump|\bleap|\bhop\b/], ['climb', /\bclimb/], ['swim', /\bswim/], ['drive', /\bdriv|\bsteer/],
  ['push', /\bpush(?! ?ups?)/], ['pull', /\bpull/], ['throw', /\bthrow|\btoss/], ['eat', /\beat|\bdrink|\bconsum/],
  ['work', /\bwork|\bfix|\brepair|\bhammer|\bsaw|\bdig|\bfarm|\bchop|\bwater|\bplant|\blockpick|\buse item|\binteract|\bbuild/],
  ['gun', /\bpistol|\brifle|\bgun|\bshoot|\baim\b|\breload/], ['exercise', /\bpush ?ups?|\bsit ?ups?|\bexercis|\bstretch|\bjumping jacks/],
  ['get-up', /\bstand ?up|\bget ?up|\blay to idle|\bgetting up|\bsitting exit/], ['sit-down', /\bsit (chair |floor )?down|\bsitting enter|\bsit down/],
  ['injured', /\binjur|\blimp|\bwounded|\bhurt/], ['zombie', /\bzombie/], ['scared', /\bscare|\bfear|\bterrif|\bcower/], ['angry', /\bangry|\brage\b|\bfurious|\bmad\b/],
  ['sad', /\bsad\b|\bcry|\bdepress/], ['look', /\blook|\bsearch|\bscan/], ['door', /\bdoor|\bopen/], ['crawl', /\bcrawl/], ['turn', /\bturn/], ['roll', /\broll\b|\bdive\b/], ['slide', /\bslide/],
];
/** Tags guessed from a clip's name (the importer adds what the motion shows: travel, which hands are busy). */
export function guessTags(name) {
  const w = words(name), out = [];
  for (const [t, rx] of TAG_RULES) if (rx.test(w)) out.push(t);
  if (!out.length) out.push('other');
  return out;
}
/** Which hands a clip keeps busy: 'none' | 'left' | 'right' | 'both' (props, hand IK). */
export function handsOf(name) {
  const w = words(name);
  if (/\btyping|\bkeyboard|\bclap|\bcarry|\bhold|\bpush|\blockpick|\bdig|\bhammer|\bsaw|\bworking|\bdriv|\bpick ?up|\bharvest|\bchop|\bhands on head|\bhands up|\bcrawl|\bswim|\brail\b|\bfold arms|\bfixing|\bchest open|\bclimb|\bwatering|\bplant|\bpray|\bboxing/.test(w)) return 'both';
  if (/\bshield/.test(w)) return 'left';
  if (/phone|\bpoint|\bwav(e|ing)|\bfacepalm|\bthrow|\bpistol|\bsword|\bconsum|\bdrink|\binteract|\buse item|\bdoor|\blantern|\btorch|\bspell|\bpunch|\bjab|\bhook|\bcross\b|\bsalute|\bmelee|\bthrust prop/.test(w)) return 'right';
  return 'none';
}
const slug = n => String(n).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'clip';

// ---------------------------------------------------------------------------------------------------------------------
// the catalog
// ---------------------------------------------------------------------------------------------------------------------
export const ANIMS = [];                 // every entry: { name, id, source, kind: 'builtin'|'user', tags, loop, inPlace, duration, hands, suits, file, ... }
const BY = new Map();                    // lower-case name / id -> entry
const SRC = new Map();                   // entry name -> { builtin: AnimationClip } | { scene, clip, info }
let catalogP = null, PREP = null;
const index = e => { BY.set(e.name.toLowerCase(), e); if (e.id) BY.set(String(e.id).toLowerCase(), e); };
async function fetchJson(u) { try { const r = await fetch(u, { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch { return null; } }
function addEntries(list, kind) {
  for (const e of list || []) { if (!e?.name || BY.has(e.name.toLowerCase())) continue; const x = { kind, ...e, id: e.id ?? slug(e.name) }; ANIMS.push(x); index(x); }
}
/** Loads the catalog (built-in + the user's imported clips). Idempotent; loadAnims calls it. */
export function loadCatalog() {
  return catalogP ??= (async () => {
    const j = await fetchJson(ANIMB() + 'catalog.json');
    if (j && Array.isArray(j.builtin)) { addEntries(j.builtin, 'builtin'); addEntries(j.user, 'user'); return ANIMS; }
    // no server catalog, but the built-in catalog file next to lib/ (the experiments folder, the QA harness): its entries
    const b = await fetchJson(new URL('assets/anims/builtin.json', BASE).href); if (b && Array.isArray(b.entries)) addEntries(b.entries, 'builtin');
    // no server catalog: the built-in packs, catalogued from their clips (names, durations, guessed tags)
    for (const [pack, p] of Object.entries(PACKS)) {
      const g = await loadGltf(LIBB() + p.file).catch(() => null); if (!g) continue;
      addEntries(g.animations.filter(c => c.name !== 'A_TPose').map(c => builtinEntry(c.name, c.duration, pack)), 'builtin');
      for (const c of g.animations) if (!SRC.has(c.name)) SRC.set(c.name, { builtin: c });
    }
    return ANIMS;
  })();
}
export function builtinEntry(name, duration, pack, extra = {}) {
  const loop = /_Loop$/.test(name);
  return { name, id: name, kind: 'builtin', source: pack, licence: 'CC0-1.0', credit: PACKS[pack]?.credit, file: PACKS[pack]?.file, tags: guessTags(name), loop, inPlace: true,
    duration: +(+duration).toFixed(3), hands: handsOf(name), suits: extra.use || words(name).trim(), ...extra };
}
/** A clip's QA verdict on a body: 'verified' | 'ok' | 'broken' | null (not checked: the user's own imports). */
export const qualityOf = (e, body) => (e && body && e.qualityBy?.[body]) || e?.quality || null;
/** The catalog entry of a clip: exact name, its id (slug) or any case. */
export function animInfo(name) { if (name == null) return null; return BY.get(String(name).toLowerCase()) ?? BY.get(slug(name)) ?? null; }
export const hasAnim = name => { const e = animInfo(name); return !!(e && SRC.has(e.name)); };
export const animNames = () => ANIMS.map(e => e.name);
/**
 * findAnims('phone') | findAnims('talking on phone') | findAnims({ tag: 'sit', loop: true, kind: 'user', hands: 'none', inPlace: true, query })
 * -> catalog entries, best match first (tags count most, then words of the name, then what it suits). The user's own
 * clips rank above the built-in ones on a tie (they were added for a reason).
 * QA (builtin.json quality, references/animations.md): a clip marked 'broken' is never returned unless { allowBroken: true };
 * { verified: true } returns only 'verified' ones; { body: 'female' } judges by that body's own verdict (qualityBy).
 * Verified ones rank first on a tie.
 */
export function findAnims(q = {}, o = {}) {
  const opt = typeof q === 'string' ? { query: q, ...o } : { ...q, ...o };
  const terms = String(opt.query ?? '').toLowerCase().split(/[\s,]+/).filter(Boolean), tags = [].concat(opt.tag ?? opt.tags ?? []).map(t => String(t).toLowerCase());
  const out = [];
  for (const e of ANIMS) {
    if (opt.kind && e.kind !== opt.kind) continue; if (opt.loop != null && !!e.loop !== !!opt.loop) continue;
    if (opt.inPlace != null && !!e.inPlace !== !!opt.inPlace) continue; if (opt.hands && e.hands !== opt.hands) continue;
    if (tags.length && !tags.every(t => e.tags?.includes(t))) continue;
    const q = qualityOf(e, opt.body); if (q === 'broken' && !opt.allowBroken) continue; if (opt.verified && q !== 'verified') continue;
    let s = tags.length ? 10 : 0; const nm = words(e.name), su = String(e.suits ?? '').toLowerCase();
    for (const t of terms) { const sg = t.replace(/s$/, ''); if (e.tags?.includes(t) || e.tags?.includes(sg)) s += 6; if (nm.includes(' ' + sg)) s += 4; else if (nm.includes(sg)) s += 2; if (su.includes(sg)) s += 1; }
    if (terms.length && s === 0) continue;
    if (e.name.toLowerCase() === String(opt.query ?? '').toLowerCase()) s += 50;
    out.push([s + (e.kind === 'user' ? .5 : 0) + (q === 'verified' ? .25 : 0), e]);
  }
  return out.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name)).map(x => x[1]);
}

// ---------------------------------------------------------------------------------------------------------------------
// loading
// ---------------------------------------------------------------------------------------------------------------------
const gltfP = new Map();
function loadGltf(url) { if (!gltfP.has(url)) gltfP.set(url, new GLTFLoader().loadAsync(url).catch(e => { gltfP.delete(url); throw e; })); return gltfP.get(url); }
async function prep() { if (!PREP) { const m = await import(LIBB() + 'tools/anim-runtime.js'); PREP ??= m.prepareClip; } return PREP; }
/**
 * figures.js hands in the built-in clips it already loaded (name -> AnimationClip) and the library's prepareClip, so the
 * packs are not loaded twice.
 */
export function registerBuiltinClips(clips, prepareClip) {
  for (const [n, c] of Object.entries(clips || {})) if (c && !SRC.has(n)) SRC.set(n, { builtin: c });
  if (prepareClip) PREP ??= prepareClip;
}
/**
 * loadAnims(names | 'all' | 'builtin' | 'user'): the catalog, then the files the named clips live in (each file once).
 * Unknown names are reported in the returned { missing }. Await it before the scenes build (top-level await).
 */
export async function loadAnims(names = 'all') {
  await loadCatalog();
  const list = names === 'all' ? ANIMS.slice() : names === 'builtin' || names === 'user' ? ANIMS.filter(e => e.kind === names)
    : [].concat(names).map(n => animInfo(n) ?? { missing: n });
  const missing = list.filter(e => e.missing).map(e => e.missing), need = list.filter(e => !e.missing && !SRC.has(e.name));
  if (need.some(e => e.kind === 'builtin')) await prep();
  const files = new Map(); for (const e of need) { const u = e.kind === 'builtin' ? LIBB() + e.file : ANIMB() + e.file; if (!files.has(u)) files.set(u, []); files.get(u).push(e); }
  await Promise.all([...files].map(async ([u, es]) => {
    let g; try { g = await loadGltf(u); } catch (err) { console.warn(`animations: ${u.split('/').pop()} does not load (${err.message})`); for (const e of es) missing.push(e.name); return; }
    if (es[0].kind === 'builtin') { for (const c of g.animations) if (!SRC.has(c.name)) SRC.set(c.name, { builtin: c }); return; }
    for (const e of es) { const c = g.animations.find(a => a.name === (e.clip ?? e.name)) ?? g.animations[0]; if (c) SRC.set(e.name, { scene: g.scene, clip: c, entry: e }); else missing.push(e.name); }
  }));
  if (missing.length) console.warn('animations not found: ' + missing.join(', '));
  return { loaded: list.filter(e => !e.missing && SRC.has(e.name)).map(e => e.name), missing };
}

// ---------------------------------------------------------------------------------------------------------------------
// bone mapping (any humanoid naming -> the UE5 names of the library skeleton)
// ---------------------------------------------------------------------------------------------------------------------
const UE = ['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'spine_04', 'spine_05', 'neck_01', 'neck_02', 'Head'];
for (const s of ['l', 'r']) { for (const b of ['clavicle', 'upperarm', 'lowerarm', 'hand', 'thigh', 'calf', 'foot', 'ball', 'ball_leaf']) UE.push(`${b}_${s}`);
  for (const f of ['thumb', 'index', 'middle', 'ring', 'pinky']) for (const k of ['01', '02', '03', '04_leaf']) UE.push(`${f}_${k}_${s}`); }
const UESET = new Set(UE), UELOW = new Map(UE.map(n => [n.toLowerCase(), n]));
const LIMB = { shoulder: 'clavicle', arm: 'upperarm', upperarm: 'upperarm', forearm: 'lowerarm', lowerarm: 'lowerarm', hand: 'hand', upleg: 'thigh', upperleg: 'thigh', thigh: 'thigh',
  leg: 'calf', lowerleg: 'calf', calf: 'calf', foot: 'foot', toebase: 'ball', toes: 'ball', toe: 'ball', toe_end: 'ball_leaf', toeend: 'ball_leaf', ball: 'ball' };
const TRUNK = { hips: 'pelvis', pelvis: 'pelvis', spine: 'spine_01', spine1: 'spine_02', spine2: 'spine_03', chest: 'spine_02', upperchest: 'spine_03', neck: 'neck_01', head: 'Head' };
/** The UE5 bone name a source bone stands for (mixamorig:LeftForeArm -> lowerarm_l), or null. */
export function ueName(name) {
  if (!name) return null; if (UESET.has(name)) return name;
  const low = String(name).toLowerCase(); if (UELOW.has(low)) return UELOW.get(low);
  let n = String(name).replace(/^.*[:|]/, '').replace(/^mixamorig\d*_?/i, '').replace(/^(bip0?1|def|j_bip_[clr])[_ ]?/i, '');
  if (TRUNK[n.toLowerCase()]) return TRUNK[n.toLowerCase()];
  let side = null; const m = /^(left|right)[_ ]?(.*)$/i.exec(n) || /^(.*?)[_.](l|r|left|right)$/i.exec(n);
  if (m) { if (/^(left|right)$/i.test(m[1])) { side = m[1][0].toLowerCase(); n = m[2]; } else { side = m[2][0].toLowerCase(); n = m[1]; } }
  if (!side) return null;
  const f = /^(?:hand)?(thumb|index|middle|ring|pinky)[_ ]?(\d)$/i.exec(n);
  if (f) { const k = +f[2]; return k >= 1 && k <= 3 ? `${f[1].toLowerCase()}_0${k}_${side}` : k === 4 ? `${f[1].toLowerCase()}_04_leaf_${side}` : null; }
  const b = LIMB[n.toLowerCase().replace(/[\s_]/g, '')] ?? LIMB[n.toLowerCase()];
  return b ? `${b}_${side}` : null;
}
const LEAF = n => /_leaf_|^root$/.test(n);
// the child each bone points at (rest-pose alignment) and the across-axis that fixes its roll
const DIR = { pelvis: 'spine_01', spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', neck_01: 'Head' };
for (const s of ['l', 'r']) { Object.assign(DIR, { [`clavicle_${s}`]: `upperarm_${s}`, [`upperarm_${s}`]: `lowerarm_${s}`, [`lowerarm_${s}`]: `hand_${s}`, [`hand_${s}`]: `middle_01_${s}`,
  [`thigh_${s}`]: `calf_${s}`, [`calf_${s}`]: `foot_${s}`, [`foot_${s}`]: `ball_${s}`, [`ball_${s}`]: `ball_leaf_${s}` });
  for (const f of ['thumb', 'index', 'middle', 'ring', 'pinky']) Object.assign(DIR, { [`${f}_01_${s}`]: `${f}_02_${s}`, [`${f}_02_${s}`]: `${f}_03_${s}`, [`${f}_03_${s}`]: `${f}_04_leaf_${s}` }); }
const ACROSS = { pelvis: ['thigh_l', 'thigh_r'], spine_01: ['thigh_l', 'thigh_r'], spine_02: ['upperarm_l', 'upperarm_r'], spine_03: ['upperarm_l', 'upperarm_r'], neck_01: ['upperarm_l', 'upperarm_r'],
  hand_l: ['index_01_l', 'pinky_01_l'], hand_r: ['index_01_r', 'pinky_01_r'] };

// ---------------------------------------------------------------------------------------------------------------------
// skeletons: rest pose in the space of the skeleton's parent ("P space")
// ---------------------------------------------------------------------------------------------------------------------
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const posOf = M => new THREE.Vector3().setFromMatrixPosition(M), rotOf = M => { const q = new THREE.Quaternion(); M.decompose(_v, q, _s); return q; };
function preorder(top) { const out = []; const rec = o => { out.push(o); for (const c of o.children) rec(c); }; rec(top); return out; }
/** A source skeleton (a converted clip's scene): its hips and every node below, mapped, with rest matrices in P space. */
const SRIG = new WeakMap();
function sourceRig(scene) {
  if (SRIG.has(scene)) return SRIG.get(scene);
  let hips = null; scene.traverse(o => { if (!hips && ueName(o.name) === 'pelvis') hips = o; });
  if (!hips) throw new Error('no hips bone (not a humanoid skeleton)');
  const nodes = preorder(hips), map = new Map(), rest = new Map();
  for (const o of nodes) { const u = ueName(o.name); if (u && !map.has(u)) map.set(u, o);
    o.updateMatrix(); rest.set(o, o === hips ? o.matrix.clone() : rest.get(o.parent).clone().multiply(o.matrix)); }
  const r = { hips, nodes, map, rest, restQ: new Map(nodes.map(o => [o, o.quaternion.clone()])), restP: new Map(nodes.map(o => [o, o.position.clone()])) };
  SRIG.set(scene, r); return r;
}
const toRest = S => { for (const o of S.nodes) { o.quaternion.copy(S.restQ.get(o)); o.position.copy(S.restP.get(o)); } };
/**
 * A target skeleton (a figure): its bones (the skinned body's skeleton) and their rest (bind) matrices in the space of the
 * top bone's parent, read from the bind matrices (the figure may already be posed). Cached per skeleton.
 */
const TGT = new WeakMap();
function targetRig(root) {
  // (never an uploaded character's mesh riding the figure, lib/customchar.js: its skeleton lists the figure's bones once per
  // bone of theirs, its inverse binds are theirs)
  let mesh = null; root.traverse(o => { if (o.isSkinnedMesh && o.skeleton && !o.userData?.customChar && (!mesh || o.skeleton.bones.length > mesh.skeleton.bones.length) && o.skeleton.bones.some(b => ueName(b.name) === 'pelvis')) mesh = o; });
  const key = mesh?.skeleton ?? root; if (TGT.has(key)) return TGT.get(key);
  const byName = new Map(); let bones;
  if (mesh) bones = mesh.skeleton.bones; else { bones = []; root.traverse(o => { if (ueName(o.name)) bones.push(o); }); }
  const set = new Set(bones); let top = bones.find(b => !set.has(b.parent)) ?? bones[0];
  while (set.has(top.parent)) top = top.parent;
  const P = top.parent; const world = new Map();
  if (mesh) {
    root.updateMatrixWorld(true);
    // P's matrix at bind time: the mesh's bind matrix times P relative to the mesh (neither moves with the bones)
    const Pb = mesh.bindMatrix.clone().multiply(mesh.matrixWorld.clone().invert().multiply(P ? P.matrixWorld : new THREE.Matrix4())), Pbi = Pb.clone().invert();
    mesh.skeleton.bones.forEach((b, i) => world.set(b, Pbi.clone().multiply(mesh.skeleton.boneInverses[i].clone().invert())));
  }
  const nodes = preorder(top).filter(o => set.has(o) || o === top);
  for (const o of nodes) if (!world.has(o)) { o.updateMatrix(); world.set(o, (world.get(o.parent) ?? new THREE.Matrix4()).clone().multiply(o.matrix)); }
  const map = new Map(); for (const o of nodes) { const u = ueName(o.name); if (u && !map.has(u)) map.set(u, o); byName.set(o.name, o); }
  const restLocal = new Map(nodes.map(o => [o, world.has(o.parent) ? world.get(o.parent).clone().invert().multiply(world.get(o)) : world.get(o).clone()]));
  // (+ every joint's rest position: an uploaded character's proportions re-shape the figure's skeleton, lib/customchar.js v21)
  const sig = nodes.map(o => o.name + rotOf(world.get(o)).toArray().map(v => v.toFixed(3)).join(',') + '@' + posOf(world.get(o)).toArray().map(v => v.toFixed(3)).join(',')).join('|') + '|' + posOf(world.get(map.get('pelvis') ?? top)).toArray().map(v => v.toFixed(4)).join(',');
  const r = { mesh, top, nodes, map, world, restLocal, sig: hash(sig) };
  TGT.set(key, r); return r;
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
// frame of a rest pose: up = feet -> head, across = right thigh -> left thigh, forward = across x up
function frameOf(pos) {
  const P = n => pos(n); const feet = P('foot_l').add(P('foot_r')).multiplyScalar(.5), up = P('Head').sub(feet).normalize();
  const ac = P('thigh_l').sub(P('thigh_r')); ac.addScaledVector(up, -ac.dot(up)).normalize(); const fw = new THREE.Vector3().crossVectors(ac, up).normalize();
  return { up, ac, fw, m: new THREE.Matrix4().makeBasis(ac, up, fw) };
}
const legLen = pos => ['l', 'r'].reduce((s, k) => s + pos(`thigh_${k}`).distanceTo(pos(`calf_${k}`)) + pos(`calf_${k}`).distanceTo(pos(`foot_${k}`)), 0) / 2;
// the two skeletons' frames differ by a whole-axis turn (Y-up vs Z-up, facing +Z vs -Y) plus the small lean differences of
// their proportions: snap to the whole-axis turn when it is within 25 degrees (a 2 degree lean would tilt the whole body)
function snapAxes(M) {
  const e = M.elements, cols = [0, 1, 2].map(c => new THREE.Vector3(e[c * 4], e[c * 4 + 1], e[c * 4 + 2]));
  const snap = v => { const a = [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)], i = a.indexOf(Math.max(...a)), r = new THREE.Vector3(); r.setComponent(i, Math.sign(v.getComponent(i))); return r; };
  const S = cols.map(snap), m = new THREE.Matrix4().makeBasis(S[0], S[1], S[2]);
  if (Math.abs(m.determinant() - 1) > 1e-6) return M;
  return rotOf(m).angleTo(rotOf(M)) < 25 * Math.PI / 180 ? m : M;
}
const axisOf = v => { const a = [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)], i = a.indexOf(Math.max(...a)), r = new THREE.Vector3(); r.setComponent(i, Math.sign(v.getComponent(i))); return a[i] > .9 ? r : v.clone().normalize(); };
const sstep = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
// two-bone IK on world rotations: the upper and lower arm turn so the wrist reaches Tg, the elbow stays in its bend
// plane; the hand keeps its world rotation (Wq of the hand is not touched)
function twoBone(Wq, U, L, S, E, W, Tg) {
  const a = E.distanceTo(S), b = W.distanceTo(E); if (a < 1e-6 || b < 1e-6) return false;
  const dv = Tg.clone().sub(S); let dist = dv.length(); if (dist < 1e-6) return false;
  dist = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-4, dist)); const dir = dv.normalize();
  const sw = W.clone().sub(S); let bend = E.clone().sub(S); bend.addScaledVector(sw.clone().normalize(), -bend.dot(sw.clone().normalize()));
  bend.addScaledVector(dir, -bend.dot(dir)); if (bend.lengthSq() < 1e-10) return false; bend.normalize();
  const cosA = (a * a + dist * dist - b * b) / (2 * a * dist), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const E2 = S.clone().addScaledVector(dir, a * cosA).addScaledVector(bend, a * sinA), T2 = S.clone().addScaledVector(dir, dist);
  const q1 = new THREE.Quaternion().setFromUnitVectors(E.clone().sub(S).normalize(), E2.clone().sub(S).normalize());
  const f0 = W.clone().sub(E).applyQuaternion(q1).normalize(), q2 = new THREE.Quaternion().setFromUnitVectors(f0, T2.clone().sub(E2).normalize());
  Wq.set(U, q1.clone().multiply(Wq.get(U))); Wq.set(L, q2.multiply(q1).multiply(Wq.get(L)));
  return true;
}
function basis(p, s) { const a = p.clone().normalize(), b = s.clone().addScaledVector(a, -s.dot(a)).normalize(), c = new THREE.Vector3().crossVectors(a, b); return new THREE.Matrix4().makeBasis(a, b, c); }

// ---------------------------------------------------------------------------------------------------------------------
// sampling a source clip (no mixer: the tracks' own interpolants, so every time gives one exact pose)
// ---------------------------------------------------------------------------------------------------------------------
function sampler(rig, clip) {
  const byNode = new Map(); for (const o of rig.nodes) byNode.set(o.name, o);
  const tr = []; for (const t of clip.tracks) { const [nn, prop] = t.name.split('.'); const o = byNode.get(nn) ?? byNode.get(THREE.PropertyBinding.sanitizeNodeName(nn)); if (!o) continue;
    if (prop === 'quaternion' || (prop === 'position' && o === rig.hips)) tr.push({ o, prop, it: t.createInterpolant() }); }
  return t => { toRest(rig);
    for (const x of tr) { const v = x.it.evaluate(t); if (x.prop === 'quaternion') x.o.quaternion.fromArray(v).normalize(); else x.o.position.fromArray(v); } };
}
function fpsOf(clip) { let n = 0; for (const t of clip.tracks) n = Math.max(n, t.times.length); return Math.min(60, Math.max(15, Math.round((n - 1) / Math.max(clip.duration, 1e-3)) || 30)); }

// ---------------------------------------------------------------------------------------------------------------------
// retargeting
// ---------------------------------------------------------------------------------------------------------------------
const RT = new Map();
/**
 * retarget(srcScene, srcClip, targetRoot, { inPlace = true, name, fps }) -> AnimationClip for the target's bones.
 * clip.userData = { loop, inPlace, speed (target P units / s of the removed travel), travel: [x, z] direction }.
 */
export function retarget(srcScene, clip, targetRoot, o = {}) {
  const S = sourceRig(srcScene), T = targetRig(targetRoot);
  const need = ['pelvis', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r', 'Head'];
  for (const n of need) { if (!S.map.has(n)) throw new Error(`the clip's skeleton has no ${n} bone`); if (!T.map.has(n)) throw new Error(`the figure's skeleton has no ${n} bone`); }
  const sPos = n => posOf(S.rest.get(S.map.get(n))), tPos = n => posOf(T.world.get(T.map.get(n)));
  const fs = frameOf(sPos), ft = frameOf(tPos);
  const R = snapAxes(ft.m.clone().multiply(fs.m.clone().transpose())), Rq = rotOf(R), Rqi = Rq.clone().invert();
  const ratio = legLen(tPos) / legLen(sPos);
  // per mapped bone: C = S0^-1 R^-1 A T0, A lines the target's rest bone up with the source's (direction + roll)
  const A = new Map(), C = new Map(), pairs = [], SB = new Map();
  for (const tb of T.nodes) {
    const u = ueName(tb.name); const sb = u && S.map.get(u);
    let a = null;
    const d = DIR[u]; if (u && sb && d && S.map.has(d) && T.map.has(d)) {
      const ps = sPos(d).sub(sPos(u)).applyQuaternion(Rq), pt = tPos(d).sub(tPos(u));
      if (ps.lengthSq() > 1e-10 && pt.lengthSq() > 1e-10) {
        const ac = ACROSS[u]; if (ac && ac.every(n => S.map.has(n) && T.map.has(n))) {
          const ss = sPos(ac[0]).sub(sPos(ac[1])).applyQuaternion(Rq), st = tPos(ac[0]).sub(tPos(ac[1]));
          a = rotOf(basis(ps, ss).multiply(basis(pt, st).transpose()));
        } else a = new THREE.Quaternion().setFromUnitVectors(pt.normalize(), ps.normalize());
      }
    }
    if (!a) { let p = tb.parent; while (p && !A.has(p)) p = p.parent; a = p ? A.get(p).clone() : new THREE.Quaternion(); }
    A.set(tb, a);
    if (sb && !LEAF(u)) { const S0 = rotOf(S.rest.get(sb)), T0 = rotOf(T.world.get(tb)); C.set(tb, S0.invert().multiply(Rqi).multiply(a).multiply(T0)); pairs.push([tb, sb]); SB.set(tb, sb); }
  }
  // bake
  const dur = clip.duration > 0 ? clip.duration : 1 / 30, fps = o.fps ?? fpsOf(clip), n = Math.max(2, Math.round(dur * fps) + 1);
  const times = new Float32Array(n); for (let i = 0; i < n; i++) times[i] = Math.min(dur, i / fps);
  const set = sampler(S, clip), Wq = new Map(), sWq = new Map(), out = new Map(pairs.map(([tb]) => [tb, new Float32Array(n * 4)]));
  const hipsRestS = posOf(S.rest.get(S.hips)), pelvisT = T.map.get('pelvis'), hipsRestT = posOf(T.world.get(pelvisT));
  const pv = new Float32Array(n * 3), hp = [];
  const parentRestInv = T.world.has(pelvisT.parent) ? T.world.get(pelvisT.parent).clone().invert() : new THREE.Matrix4();
  let pelvisParentMoves = false; for (let p = pelvisT.parent; p && T.world.has(p); p = p.parent) if (C.has(p)) pelvisParentMoves = true;
  const tmp = new THREE.Quaternion(), parentQ = tb => Wq.get(tb.parent) ?? (tb === T.top ? new THREE.Quaternion() : rotOf(T.world.get(tb.parent) ?? new THREE.Matrix4()));
  // hand-to-head contact (phone at the ear, facepalm, hands on head): bone directions alone put the hand where the source's
  // proportions put it; when a source hand is near its head, a two-bone arm IK puts the target hand at the same place
  // relative to the target's head (scaled), blended in by closeness
  const sLeg = legLen(sPos), tLoc = new Map(T.nodes.map(o => [o, posOf(T.restLocal.get(o))])), sLoc = new Map(S.nodes.map(o => [o, o === S.hips ? null : S.restP.get(o)]));
  const contact = o.contact !== false && ['Head'].every(b => S.map.has(b) && T.map.has(b)) ? ['l', 'r'].filter(k => ['upperarm', 'lowerarm', 'hand'].every(b => S.map.has(`${b}_${k}`) && T.map.has(`${b}_${k}`))) : [];
  const ikStats = { frames: 0 };
  for (let i = 0; i < n; i++) {
    set(times[i]);
    for (const s of S.nodes) sWq.set(s, s === S.hips ? s.quaternion.clone() : sWq.get(s.parent).clone().multiply(s.quaternion));
    for (const tb of T.nodes) Wq.set(tb, C.has(tb) ? Rq.clone().multiply(sWq.get(SB.get(tb))).multiply(C.get(tb)) : parentQ(tb).clone().multiply(rotOf(T.restLocal.get(tb))));
    const hipOff = S.hips.position.clone().sub(hipsRestS).applyQuaternion(Rq).multiplyScalar(ratio); hp.push(hipOff);
    if (contact.length) {
      const sp = new Map(), tp = new Map();
      for (const s of S.nodes) sp.set(s, s === S.hips ? s.position.clone() : sp.get(s.parent).clone().add(sLoc.get(s).clone().applyQuaternion(sWq.get(s.parent))));
      const fk = () => { for (const tb of T.nodes) tp.set(tb, tb === pelvisT ? hipsRestT.clone().add(hipOff) : tp.has(tb.parent) ? tp.get(tb.parent).clone().add(tLoc.get(tb).clone().applyQuaternion(Wq.get(tb.parent))) : posOf(T.world.get(tb))); };
      fk();
      for (const k of contact) {
        const sh = sp.get(S.map.get(`hand_${k}`)), sH = sp.get(S.map.get('Head')), d = sh.distanceTo(sH) / sLeg;
        const w = d <= .28 ? 1 : d >= .4 ? 0 : sstep((.4 - d) / .12); if (w <= 0) continue;
        const U = T.map.get(`upperarm_${k}`), L = T.map.get(`lowerarm_${k}`), Hd = T.map.get(`hand_${k}`);
        const want = tp.get(T.map.get('Head')).clone().add(sh.clone().sub(sH).applyQuaternion(Rq).multiplyScalar(ratio));
        const Sp = tp.get(U), Ep = tp.get(L), Wp = tp.get(Hd), Tg = Wp.clone().lerp(want, w);
        if (twoBone(Wq, U, L, Sp, Ep, Wp, Tg)) { ikStats.frames++; fk(); }
      }
    }
    for (const [tb] of pairs) { tmp.copy(parentQ(tb)).invert().multiply(Wq.get(tb)).normalize(); const a = out.get(tb); if (i > 0) { const k = (i - 1) * 4; if (a[k] * tmp.x + a[k + 1] * tmp.y + a[k + 2] * tmp.z + a[k + 3] * tmp.w < 0) tmp.set(-tmp.x, -tmp.y, -tmp.z, -tmp.w); } tmp.toArray(a, i * 4); }
  }
  toRest(S);
  // hips translation: the target's rest hips + the scaled source offset; in place = the straight-line travel removed
  const up = axisOf(ft.up), flat = v => v.clone().addScaledVector(up, -v.dot(up));
  const travel = flat(hp[n - 1]).sub(flat(hp[0])), dist = travel.length(), moves = dist > .25 * hipsRestT.distanceTo(new THREE.Vector3(hipsRestT.x, 0, hipsRestT.z)) ;
  const inPlace = o.inPlace !== false;
  for (let i = 0; i < n; i++) {
    const v = hp[i].clone(); if (inPlace && moves) v.addScaledVector(travel, -(times[i] / dur));
    const p = hipsRestT.clone().add(v); if (!pelvisParentMoves) p.applyMatrix4(parentRestInv); p.toArray(pv, i * 3);
  }
  const tracks = [];
  for (const [tb] of pairs) tracks.push(new THREE.QuaternionKeyframeTrack(`${tb.name}.quaternion`, times, out.get(tb)));
  tracks.push(new THREE.VectorKeyframeTrack(`${pelvisT.name}.position`, times, pv));
  const c = new THREE.AnimationClip(o.name ?? clip.name, dur, tracks);
  c.userData = { inPlace, travels: moves, speed: moves ? dist / dur : 0, travel: moves ? [travel.x / dist, travel.z / dist] : [0, 0], retargeted: true, bones: pairs.length, contactFrames: ikStats.frames };
  return c;
}
/**
 * cleanClip(clip, loop): the clip as figures play it (cached; the same input gives the same output, deterministic):
 *  - a one-shot whose LAST key snaps to another pose (KayKit lie / floor-sit clips end on their rest pose: a 100-120 deg
 *    pelvis / thigh jump in the final 1/30 s) loses that key; the clip ends on the key before.
 *  - a loop whose last pose is off its first (G_Typing_Standing_Loop, G_Clap_Loop, G_Thrust_Prop_Loop: 3-4 cm at the
 *    hands) is blended: over its last quarter (at most 0.4 s) every key moves toward the start pose, smootherstep weighted,
 *    so the wrap is continuous.
 * Measured by the animqa harness (experiments/recon-style/src/stories/animqa, references/animations.md).
 */
const CLEAN = new Map();
export function cleanClip(c, loop = /_Loop$/.test(c?.name ?? '')) {
  if (!c) return c; const key = c.uuid + '|' + !!loop; if (CLEAN.has(key)) return CLEAN.get(key);
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), ang = (t, i, j) => qa.fromArray(t.values, i * 4).angleTo(qb.fromArray(t.values, j * 4)) * 180 / Math.PI;
  let out = c;
  if (!loop) { let cut = Infinity;
    for (const t of c.tracks) { const n = t.times.length; if (n < 4 || !t.name.endsWith('.quaternion')) continue; const a = ang(t, n - 1, n - 2), b = ang(t, n - 2, n - 3);
      if (a > 40 && a > 6 * Math.max(b, 1) && t.times[n - 1] >= c.duration - 1e-4) cut = Math.min(cut, t.times[n - 2]); }
    if (Number.isFinite(cut) && cut > 0) out = new THREE.AnimationClip(c.name, cut, c.tracks.map(t => { const n = t.times.length; let k = n; while (k > 1 && t.times[k - 1] > cut + 1e-5) k--;
      const tr = t.clone(); tr.times = t.times.slice(0, k); tr.values = t.values.slice(0, k * t.getValueSize()); return tr; }));
  } else {
    // a loop with root motion left in its hips track (KK_Sneak_Loop: the pelvis walks 26 cm forward, then jumps back at the
    // seam): the straight-line drift is taken out of the horizontal axes (the vertical one = the largest mean value) so it
    // plays in place and walkAt's speed is the planted foot's
    const tracks0 = c.tracks.map(t => { if (!/\.position$/.test(t.name) || !/^(root|pelvis)\./.test(t.name)) return t; const n = t.times.length; if (n < 3) return t;
      const v = t.values, mean = [0, 1, 2].map(k => { let s = 0; for (let i = 0; i < n; i++) s += Math.abs(v[i * 3 + k]); return s / n; }), up = mean.indexOf(Math.max(...mean));
      const dr = [0, 1, 2].map(k => k === up ? 0 : v[(n - 1) * 3 + k] - v[k]); if (Math.hypot(...dr) < .02) return t;
      const tr = t.clone(), d = c.duration || 1; for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) tr.values[i * 3 + k] -= dr[k] * (t.times[i] / d); return tr; });
    if (tracks0.some((t, i) => t !== c.tracks[i])) c = out = new THREE.AnimationClip(c.name, c.duration, tracks0);
    const smoother = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (u * (u * 6 - 15) + 10), d = c.duration, w = Math.min(.4, d / 4);
    let need = false; for (const t of c.tracks) { const n = t.times.length; if (n < 3 || t.times[n - 1] < d - 1e-4 || t.times[0] > 1e-4) continue;
      if (t.name.endsWith('.quaternion') ? ang(t, n - 1, 0) > .75 : Math.hypot(...[0, 1, 2].map(k => t.values[(n - 1) * 3 + k] - t.values[k])) > .004) need = true; }
    if (need) out = new THREE.AnimationClip(c.name, d, c.tracks.map(t => { const n = t.times.length, tr = t.clone(); if (n < 3 || t.times[n - 1] < d - 1e-4 || t.times[0] > 1e-4) return tr;
      const v = tr.values, sz = t.getValueSize();
      if (t.name.endsWith('.quaternion')) { const first = new THREE.Quaternion().fromArray(v, 0), last = new THREE.Quaternion().fromArray(v, (n - 1) * 4); if (first.dot(last) < 0) first.set(-first.x, -first.y, -first.z, -first.w);
        const err = first.clone().multiply(last.clone().invert()), I = new THREE.Quaternion(), q = new THREE.Quaternion(), e = new THREE.Quaternion();
        for (let i = 0; i < n; i++) { const k = smoother((t.times[i] - (d - w)) / w); if (k <= 0) continue; e.copy(I).slerp(err, k); q.fromArray(v, i * 4).premultiply(e).normalize().toArray(v, i * 4); } }
      else for (let i = 0; i < n; i++) { const k = smoother((t.times[i] - (d - w)) / w); if (k <= 0) continue; for (let j = 0; j < sz; j++) v[i * sz + j] += k * (v[j] - v[(n - 1) * sz + j]); }
      return tr; }));
  }
  CLEAN.set(key, out); return out;
}
/** A clip by catalog name, fitted to this figure's skeleton (built-in: the library's prepareClip; user: retarget). */
const warned = new Set(), BPREP = new WeakMap();
export function animClip(name, root, o = {}) {
  const e = animInfo(name), s = e && SRC.get(e.name);
  if (!s) { const k = String(name); if (!warned.has(k)) { warned.add(k); console.warn(e ? `animation "${e.name}" is not loaded: await loadAnims(['${e.name}']) first` : `no animation "${name}" (findAnims() lists them)`); } return null; }
  if (qualityOf(e, o.body) === 'broken' && !o.allowBroken) { const k = 'broken|' + e.name; if (!warned.has(k)) { warned.add(k); console.warn(`animation "${e.name}" is marked broken (${e.notes || 'references/animations.md'}): not used (animClip(name, root, { allowBroken: true }) forces it)`); } return null; }
  if (s.builtin) {
    if (!PREP) { if (!warned.has('prep')) { warned.add('prep'); console.warn('animations: await loadAnims() before animClip (the built-in clips need the library runtime)'); } return null; }
    let m = BPREP.get(root); if (!m) BPREP.set(root, m = new Map()); if (m.has(e.name)) return m.get(e.name);
    const c = PREP(THREE, cleanClip(s.builtin, !!e.loop || /_Loop$/.test(e.name)), root); c.userData = { loop: !!e.loop, inPlace: true, speed: 0, travels: false, builtin: true, quality: e.quality ?? null }; m.set(e.name, c); return c;
  }
  const T = targetRig(root), inPlace = o.inPlace ?? true, key = `${T.sig}|${e.name}|${inPlace}`;
  let c = RT.get(key);
  if (!c) { c = retarget(s.scene, s.clip, root, { inPlace, name: e.name }); c.userData.loop = !!e.loop; c.userData.source = e.source; RT.set(key, c); }
  return c;
}
/** Ground speed (world m/s) of a travelling clip on this figure (in place clips: 0). */
export function animSpeed(name, root) {
  const c = animClip(name, root); if (!c?.userData?.speed) return 0;
  const T = targetRig(root), P = T.top.parent; if (!P) return c.userData.speed; P.updateMatrixWorld(true);
  return c.userData.speed * new THREE.Vector3().setFromMatrixScale(P.matrixWorld).y;
}

// ---------------------------------------------------------------------------------------------------------------------
// the importer (runs in the app's hidden converter window): FBX / GLB / GLTF -> GLB with the skeleton + its animation
// ---------------------------------------------------------------------------------------------------------------------
/**
 * convertAnimFile(arrayBuffer, fileName) -> [{ name, glb: ArrayBuffer, info }] (one per animation in the file).
 * info: { duration, fps, bones, mapped, loop, inPlace, travel (m/s on a 1.8 m person), hands, tags, source, skeleton }
 */
export async function convertAnimFile(buf, fileName) {
  const ext = String(fileName).toLowerCase().split('.').pop(), base = String(fileName).split(/[\\/]/).pop().replace(/\.[^.]+$/, '').trim() || 'Clip';
  let scene, clips;
  if (ext === 'fbx') {
    const { FBXLoader } = await import(VENDOR + 'jsm/loaders/FBXLoader.js');
    const g = new FBXLoader().parse(buf, ''); scene = g; clips = g.animations;
  } else if (ext === 'glb' || ext === 'gltf') {
    const g = await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej)); scene = g.scene; clips = g.animations;
  } else throw new Error('Not an animation file (FBX, GLB or GLTF).');
  clips = (clips || []).filter(c => c.tracks.length && c.duration > 0);
  if (!clips.length) throw new Error('The file has no animation in it (in Mixamo, download it as FBX with a motion, not only the character).');
  let hips = null; scene.traverse(o => { if (!hips && ueName(o.name) === 'pelvis') hips = o; });
  if (!hips) throw new Error('No humanoid skeleton found (no hips bone). Mixamo characters and UE5-style skeletons work.');
  // a clean copy of the skeleton in its REST pose (the hips and its bones, FBX duplicates of a bone under itself dropped,
  // no meshes). The nodes of an FBX hold whatever frame it was saved on, so the rest comes from: the skin's bind pose
  // (a file with the character), else FBX joint orients with the rotation zeroed (Mixamo's T-pose, files without skin),
  // else the nodes as they are (glTF nodes are the rest pose).
  scene.updateMatrixWorld(true);
  const bindW = new Map(); scene.traverse(o => { if (o.isSkinnedMesh) o.skeleton.bones.forEach((b, i) => { if (b.name && !bindW.has(b.name)) bindW.set(b.name, o.skeleton.boneInverses[i].clone().invert()); }); });
  const P0 = hips.parent ? hips.parent.matrixWorld.clone() : new THREE.Matrix4();
  const eul = d => new THREE.Quaternion().setFromEuler(new THREE.Euler(...d.map(x => x * Math.PI / 180), 'ZYX'));
  let grounded = false;
  const rest = (n, o) => {
    const pb = n === hips ? P0 : bindW.get(n.parent?.name), b = bindW.get(n.name);
    if (b && pb) { new THREE.Matrix4().copy(pb).invert().multiply(b).decompose(o.position, o.quaternion, o.scale); return; }
    const td = n.userData?.transformData;
    if (td && ext === 'fbx') { o.quaternion.copy(td.preRotation ? eul(td.preRotation) : new THREE.Quaternion()); if (td.postRotation) o.quaternion.multiply(eul(td.postRotation).invert());
      o.position.fromArray(td.translation ?? [0, 0, 0]); o.scale.set(1, 1, 1); if (n === hips) grounded = true; return; }
    o.position.copy(n.position); o.quaternion.copy(n.quaternion); o.scale.copy(n.scale);
  };
  const keep = new Set();
  const copy = n => { const o = new THREE.Object3D(); o.name = n.name; rest(n, o); keep.add(n.name);
    for (const c of n.children) { if (c.isMesh || c.isLight || c.isCamera || keep.has(c.name) || !c.name) continue; o.add(copy(c)); } return o; };
  const root = new THREE.Object3D(); root.name = 'AnimSkeleton'; const h = copy(hips); root.add(h);
  if (grounded) {   // no bind pose: stand the T-pose on the floor (y = 0) with the hips over the origin
    h.position.set(0, 0, 0); root.updateMatrixWorld(true); let minY = Infinity;
    h.traverse(o => { if (/^(foot|ball)/.test(ueName(o.name) ?? '')) minY = Math.min(minY, o.getWorldPosition(new THREE.Vector3()).y); });
    if (Number.isFinite(minY)) h.position.y = -minY;
  }
  const mapped = new Set(); root.traverse(o => { const u = ueName(o.name); if (u) mapped.add(u); });
  for (const n of ['thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r', 'spine_01', 'Head', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r'])
    if (!mapped.has(n)) throw new Error(`The skeleton has no ${n} bone it can be matched to (bones named like Mixamo's or Unreal's work).`);
  const mixamo = /mixamo/i.test(hips.name) || clips.some(c => /mixamo/i.test(c.name));
  const { GLTFExporter } = await import(VENDOR + 'jsm/exporters/GLTFExporter.js');
  const out = [];
  for (const [k, c0] of clips.entries()) {
    const tracks = c0.tracks.filter(t => { const [nn, prop] = t.name.split('.'); return keep.has(nn) && (prop === 'quaternion' || (prop === 'position' && nn === hips.name)); });
    const name = clips.length === 1 ? base : `${base} - ${/^(mixamo\.com|take \d+|armature\|.*|animation)$/i.test(c0.name) ? k + 1 : c0.name}`;
    const clip = new THREE.AnimationClip(name, c0.duration, tracks.map(t => t.clone())).optimize();
    const info = analyse(root, clip, name);
    const glb = await new GLTFExporter().parseAsync(root, { binary: true, trs: true, animations: [clip], onlyVisible: false });
    out.push({ name, glb, info: { ...info, source: mixamo ? 'mixamo' : ext, skeleton: mixamo ? 'mixamo' : 'humanoid', bones: keep.size, mapped: mapped.size } });
  }
  return out;
}
// what the motion shows: loop (first pose = last pose), travel, which hand is busy
function analyse(scene, clip, name) {
  const S = sourceRig(scene), set = sampler(S, clip), dur = clip.duration, fps = fpsOf(clip);
  const pose = t => { set(t); scene.updateMatrixWorld(true); const P = {}; for (const n of ['pelvis', 'Head', 'hand_l', 'hand_r']) P[n] = S.map.get(n)?.getWorldPosition(new THREE.Vector3());
    return { q: S.nodes.map(o => o.getWorldQuaternion(new THREE.Quaternion())), p: n => P[n] }; };
  const a = pose(0), b = pose(dur);
  let maxAng = 0; a.q.forEach((q, i) => { if (S.map.has(ueName(S.nodes[i].name))) maxAng = Math.max(maxAng, q.angleTo(b.q[i]) * 180 / Math.PI); });
  const sP = n => posOf(S.rest.get(S.map.get(n))), leg = legLen(sP), scale = .9 / leg;   // metres on a 1.8 m person (legs ~0.9 m)
  const f = frameOf(sP), flat = v => v.clone().addScaledVector(f.up, -v.dot(f.up));
  const travel = flat(b.p('pelvis')).sub(flat(a.p('pelvis'))).length() * scale, dy = Math.abs(b.p('pelvis').sub(a.p('pelvis')).dot(f.up)) * scale;
  const loop = maxAng < 14 && dy < .06 && dur > .3;
  const tags = guessTags(name); let hands = handsOf(name);
  // hands: a hand that spends most of the clip near the head (phone) or far from the hips (holding something up)
  const N = Math.min(60, Math.max(8, Math.round(dur * 4))); let nl = 0, nr = 0, raised = { l: 0, r: 0 };
  for (let i = 0; i <= N; i++) { const s = pose(dur * i / N), hd = s.p('Head'), hl = s.p('hand_l'), hr = s.p('hand_r'), pe = s.p('pelvis');
    if (hd && hl && hr) { if (hl.distanceTo(hd) * scale < .25) nl++; if (hr.distanceTo(hd) * scale < .25) nr++;
      for (const [k, v] of [['l', hl], ['r', hr]]) if (v.clone().sub(pe).dot(f.up) * scale > .25) raised[k]++; } }
  const nearL = nl > N * .4, nearR = nr > N * .4;
  if (nearL || nearR) { if (!tags.includes('phone') && /talk|call|phone/i.test(name)) tags.push('phone'); hands = nearL && nearR ? 'both' : nearL ? 'left' : 'right'; }
  else if (hands === 'none' && (raised.l > N * .5 || raised.r > N * .5)) hands = raised.l > N * .5 && raised.r > N * .5 ? 'both' : raised.l > N * .5 ? 'left' : 'right';
  toRest(S); scene.updateMatrixWorld(true);
  const inPlace = travel < .3;
  if (!inPlace && !tags.includes('travel')) tags.push('travel');
  return { duration: +dur.toFixed(3), fps, loop, inPlace, travel: inPlace ? 0 : +(travel / dur).toFixed(3), hands, tags, loopError: +maxAng.toFixed(1) };
}
