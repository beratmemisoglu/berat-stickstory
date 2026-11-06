// Your own characters (recon engine, lib/customchar.js in a project; the app's src/main/chars3d.ts runs the importer).
// A rigged humanoid the user uploads (FBX / GLB / GLTF with everything embedded / VRM) is converted ONCE, in the app's
// hidden window (convertCharFile): a clean GLB with the model's own meshes, skin and materials, bones renamed safe, the
// bind pose baked standing on y = 0, facing +Z, at a real height (1.5 - 2.0 m) + mapping.json (our UE5 bone -> theirs).
// In a scene its body rides a figure's skeleton (every clip, act, handTo and hold of lib/figures.js keeps working):
//   await loadCustomChar('my-hero')                         the model + mapping (top-level await in a scene file)
//   customBody('my-hero', f.root, { mat?, hide?, proportions? }) -> { meshes, height, map, fit, moved }: the visible
//                                                              SkinnedMesh(es) bound onto the figure's skeleton; the
//                                                              mannequin's own meshes hidden
//   renderSheet(id) (the app's test sheet), convertCharFile(buf, name, { mapping }) (the importer),
//   proportionCheck(f) (QA: segment lengths + the file's own bind pose reproduced through the figure's skeleton)
// Bind: every bone of theirs follows one of ours (its mapped bone, else its nearest mapped ancestor). At the figure's rest
// pose their limbs are first turned to point like ours (A-pose -> the figure's rest, shortest arc per bone, top-down), so a
// clip that lifts our arm by 30 degrees lifts theirs by 30 degrees (rest-relative). v21 (OWN PROPORTIONS): then the
// figure's skeleton takes THEIR joints (our bones move, our rest rotations stay): their neck, shoulders, arms, legs and
// clothes keep the file's lengths and skin exactly, and the figure's hands are their hands (contacts, holds, IK). Before
// v21 their joints were moved onto ours instead (proportions 'figure': the mesh stretched to the mannequin's skeleton).
// Files: <workspace>/characters3d/<id>/ served at <project>/__chars3d/<id>/ (and /fv/__chars3d/ for the app's preview).
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const VENDOR = new URL('../vendor/', import.meta.url).href;
const BASE = globalThis.__CZ_FIG_BASE || (/\/(lib|__figview)\/customchar\.js/.test(import.meta.url) ? new URL('../', import.meta.url).href : new URL('./', import.meta.url).href);
const CHARB = () => globalThis.__CZ_CHARS3D_URL || new URL('__chars3d/', BASE).href;
export const CHAR_ID = /^[a-z0-9][a-z0-9-]{0,47}$/;

// ---------------------------------------------------------------------------------------------------------------------
// our skeleton (lib/figures.js: the UE5-style skeleton every clip drives)
// ---------------------------------------------------------------------------------------------------------------------
export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
export const OUR_BONES = (() => { const a = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head'];
  for (const s of ['l', 'r']) { for (const b of ['clavicle', 'upperarm', 'lowerarm', 'hand', 'thigh', 'calf', 'foot', 'ball']) a.push(`${b}_${s}`);
    for (const f of FINGERS) for (const k of ['01', '02', '03']) a.push(`${f}_${k}_${s}`); }
  return a; })();
export const REQUIRED = ['pelvis', 'Head', 'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r', 'thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r'];
// the joint(s) each bone points at, first one both skeletons have (the rest-pose fit). Limbs only: the trunk's short
// segments (pelvis -> spine, clavicles) differ between rigs by where the joints sit, not by pose - turning them tilts the hips.
const AIM = {};
for (const s of ['l', 'r']) { Object.assign(AIM, { [`upperarm_${s}`]: [`lowerarm_${s}`], [`lowerarm_${s}`]: [`hand_${s}`], [`hand_${s}`]: [`middle_01_${s}`, `ring_01_${s}`, `index_01_${s}`],
  [`thigh_${s}`]: [`calf_${s}`], [`calf_${s}`]: [`foot_${s}`], [`foot_${s}`]: [`ball_${s}`] });
  for (const f of FINGERS) Object.assign(AIM, { [`${f}_01_${s}`]: [`${f}_02_${s}`], [`${f}_02_${s}`]: [`${f}_03_${s}`] }); }
// the bones under each of ours (parent chain): hierarchy checks of a mapping
const PARENT = { spine_01: 'pelvis', spine_02: 'spine_01', spine_03: 'spine_02', neck_01: 'spine_03', Head: 'neck_01' };
for (const s of ['l', 'r']) { Object.assign(PARENT, { [`clavicle_${s}`]: 'spine_03', [`upperarm_${s}`]: `clavicle_${s}`, [`lowerarm_${s}`]: `upperarm_${s}`, [`hand_${s}`]: `lowerarm_${s}`,
  [`thigh_${s}`]: 'pelvis', [`calf_${s}`]: `thigh_${s}`, [`foot_${s}`]: `calf_${s}`, [`ball_${s}`]: `foot_${s}` });
  for (const f of FINGERS) Object.assign(PARENT, { [`${f}_01_${s}`]: `hand_${s}`, [`${f}_02_${s}`]: `${f}_01_${s}`, [`${f}_03_${s}`]: `${f}_02_${s}` }); }

// ---------------------------------------------------------------------------------------------------------------------
// bone names -> ours (Mixamo, UE4/UE5, Unity Humanoid / VRoid, Rigify / Blender metarig, CC / iClone, Daz, 3ds Max Biped)
// ---------------------------------------------------------------------------------------------------------------------
const PREFIX = /^(?:mixamorig\d*[_:]?|cc_base_|def[-_.]|org[-_.]|mch[-_.]|j_bip_|j_|bip0*1[ _]|bip[ _]|valvebiped\.bip01_|b_|bn_|jnt_|bone_|rig_|sk_)/i;
/** What a bone name stands for: { base: our bone base | 'hips' | 'spine' | 'neck' | 'head', side: 'l'|'r'|null, seg, extra } */
export function classify(raw) {
  let n = String(raw || '').replace(/^.*[:|]/, '');
  for (let k = 0; k < 3 && PREFIX.test(n); k++) n = n.replace(PREFIX, '');
  let side = null;
  if (/left/i.test(n)) { side = 'l'; n = n.replace(/left/i, ' '); }
  else if (/right/i.test(n)) { side = 'r'; n = n.replace(/right/i, ' '); }
  else if (/^[lLrR](?=[A-Z][a-z])/.test(n)) { side = n[0].toLowerCase(); n = n.slice(1); }          // Daz: lShldrBend
  else { const t = n.split(/[\s_.\-]+/).filter(Boolean), i = t.findIndex(x => /^[lr]$/i.test(x));
    if (i >= 0) { side = t[i].toLowerCase(); t.splice(i, 1); n = t.join('_'); }
    else if (/[a-z0-9][LR]$/.test(n)) { side = n.slice(-1).toLowerCase(); n = n.slice(0, -1); } }   // Rigify after sanitising: upper_armL, f_index01L
  let tok = n.split(/[\s_.\-]+/).filter(Boolean); if (tok.length > 1 && /^c$/i.test(tok[0])) tok = tok.slice(1);   // VRoid J_Bip_C_Hips
  const core = tok.join('').toLowerCase(), letters = core.replace(/\d+/g, ''), num = (/(\d+)\D*$/.exec(core) || [])[1];
  const out = (base, o = {}) => ({ base, side, seg: o.seg ?? null, extra: !!o.extra });
  if (!core) return out(null);
  if (/(end|nub|tip|leaf|top|null|ik|pole|target|ctrl|helper|socket|attach|weapon|prop)$/.test(letters) && !/^(head|spine|neck)$/.test(letters)) return out(null, { extra: true });
  // fingers
  const bip = /finger(\d)(\d)?/.exec(core); if (bip && side) { const f = FINGERS[+bip[1]]; return f ? out(f, { seg: bip[2] != null ? +bip[2] + 1 : 1 }) : out(null); }
  const fm = /(thumb|index|middle|mid|ring|pinky|pinkie|little)/.exec(letters);
  if (fm && side) { const f = { mid: 'middle', pinkie: 'pinky', little: 'pinky' }[fm[1]] ?? fm[1];
    let seg = /metacarpal|palm|meta/.test(letters) ? 0 : /proximal/.test(letters) ? 1 : /intermediate/.test(letters) ? 2 : /distal/.test(letters) ? 3 : num != null ? +num : 1;
    if (/vrm1thumb/.test(letters)) seg++;
    return seg >= 1 && seg <= 3 ? out(f, { seg }) : out(f, { extra: true }); }
  if (/twist|roll|share|helper|corrective|bulge|adjust/.test(letters) && !/neck/.test(letters)) return out(null, { extra: true });
  if (!side) {
    if (/^(hips?|pelvis|cog|hipsroot)$/.test(letters)) return out('hips');
    if (/(upperchest|chest|spine|abdomen|waist|torso|ribcage|^back$|^body$)/.test(letters)) return out('spine');
    if (/neck/.test(letters)) return out('neck');
    if (/^head$/.test(letters)) return out('head');
    return out(null);
  }
  const extra = num != null && +num > 0 && /\.\d{3}$/.test(raw);   // Rigify DEF-upper_arm.L.001: a second segment (twist)
  const limb = /(clavicle|collar|shoulder)/.test(letters) && !/shldr/.test(letters) ? 'clavicle'
    : /(forearm|lowerarm|elbow|loarm)/.test(letters) ? 'lowerarm'
    : /(upperarm|uparm|shldr|^arm$|armupper)/.test(letters) ? 'upperarm'
    : /^(hand|wrist)$/.test(letters) ? 'hand'
    : /(upleg|upperleg|thigh|legupper)/.test(letters) ? 'thigh'
    : /(lowerleg|calf|shin|knee|^leg$|loleg)/.test(letters) ? 'calf'
    : /(metatarsal)/.test(letters) ? null
    : /^(foot|ankle)$/.test(letters) ? 'foot'
    : /(toebase|^toes?$|^ball$|toe)/.test(letters) ? 'ball' : null;
  return out(limb, { extra: extra && limb !== 'ball' });
}

// ---------------------------------------------------------------------------------------------------------------------
// a mapping from a bone list: names first, the structure (hierarchy + positions) for what names don't tell
// bones: [{ name, parent (index | -1), pos: [x, y, z] (bind, any space), weighted }]
// ---------------------------------------------------------------------------------------------------------------------
function treeOf(bones) {
  const kids = bones.map(() => []), depth = bones.map(() => 0);
  bones.forEach((b, i) => { if (b.parent >= 0) kids[b.parent].push(i); });
  const order = []; const rec = i => { order.push(i); for (const c of kids[i]) { depth[c] = depth[i] + 1; rec(c); } };
  bones.forEach((b, i) => { if (b.parent < 0) rec(i); });
  const size = bones.map(() => 1); for (const i of order.slice().reverse()) if (bones[i].parent >= 0) size[bones[i].parent] += size[i];
  const isDesc = (a, anc) => { for (let p = a; p >= 0; p = bones[p].parent) if (p === anc) return true; return false; };
  const path = (from, to) => { const out = []; for (let p = bones[to].parent; p >= 0 && p !== from; p = bones[p].parent) out.unshift(p); return out; };   // bones strictly between
  const lca = list => { list = list.filter(i => i >= 0); if (!list.length) return -1; let a = list[0]; for (const b of list.slice(1)) { while (a >= 0 && !isDesc(b, a)) a = bones[a].parent; } return a; };
  return { kids, depth, order, size, isDesc, path, lca };
}
const V = p => new THREE.Vector3(...p);
/** autoMap(bones, { vrm }) -> { map: { ours: index }, source: 'names'|'structure'|'vrm', missing: [...], problems: [...] } */
export function autoMap(bones, o = {}) {
  const T = treeOf(bones), map = {}, cls = bones.map(b => classify(b.name));
  const pick = (list) => list.sort((a, b) => (bones[b].weighted ? 1 : 0) - (bones[a].weighted ? 1 : 0) || T.depth[a] - T.depth[b])[0] ?? -1;
  let source = 'names';
  if (o.vrm && Object.keys(o.vrm).length) { Object.assign(map, o.vrm); source = 'vrm'; }
  else {
    for (const s of ['l', 'r']) {
      for (const b of ['clavicle', 'upperarm', 'lowerarm', 'hand', 'thigh', 'calf', 'foot', 'ball']) { const i = pick(bones.map((_, k) => k).filter(k => cls[k].base === b && cls[k].side === s && !cls[k].extra)); if (i >= 0) map[`${b}_${s}`] = i; }
      for (const f of FINGERS) for (const g of [1, 2, 3]) { const i = pick(bones.map((_, k) => k).filter(k => cls[k].base === f && cls[k].side === s && cls[k].seg === g && !cls[k].extra)); if (i >= 0) map[`${f}_0${g}_${s}`] = i; }
    }
    const hips = pick(bones.map((_, k) => k).filter(k => cls[k].base === 'hips')), head = pick(bones.map((_, k) => k).filter(k => cls[k].base === 'head'));
    if (hips >= 0) map.pelvis = hips; if (head >= 0) map.Head = head;
  }
  // structure: what names did not give (or a rig with no readable names at all)
  if (!REQUIRED.every(n => map[n] != null) && source !== 'vrm') { if (structural(bones, T, map, cls)) source = Object.keys(map).length > 6 && source === 'names' ? 'names+structure' : 'structure'; }
  // the trunk from the hierarchy: pelvis = where the legs and the spine meet, the spine = pelvis .. the arms' hub
  if (map.thigh_l != null && map.thigh_r != null) {
    const legs = T.lca([map.thigh_l, map.thigh_r]);
    if (map.pelvis == null || !T.isDesc(map.thigh_l, map.pelvis)) map.pelvis = legs;
    const armA = map.clavicle_l ?? map.upperarm_l, armB = map.clavicle_r ?? map.upperarm_r;
    if (source !== 'vrm' && armA != null && armB != null) {
      const hub = T.lca([armA, armB]);
      if (hub >= 0 && map.pelvis >= 0 && T.isDesc(hub, map.pelvis)) {
        // CC / Daz: the hips bone above both the leg hub and the spine (Hip -> Pelvis + Waist): the pelvis is their meeting point
        const top = T.lca([map.pelvis, hub]); if (top >= 0 && top !== map.pelvis) map.pelvis = top;
        const chain = hub === map.pelvis ? [] : [...T.path(map.pelvis, hub), hub];
        for (const k of ['spine_01', 'spine_02', 'spine_03']) delete map[k];
        const n = chain.length;
        if (n === 1) map.spine_02 = chain[0];
        else if (n === 2) { map.spine_01 = chain[0]; map.spine_03 = chain[1]; }
        else if (n >= 3) { map.spine_01 = chain[0]; map.spine_02 = chain[Math.round((n - 1) / 2)]; map.spine_03 = chain[n - 1]; }
        // neck + head: the chain from the hub to the head (named), else the hub's longest branch that is no arm
        if (map.Head == null || !T.isDesc(map.Head, hub)) {
          const arms = [armA, armB]; let c = T.kids[hub].filter(k => !arms.some(a => a === k || T.isDesc(a, k))).sort((a, b) => T.size[b] - T.size[a])[0], line = [];
          while (c != null) { if (!cls[c].extra) line.push(c); const next = T.kids[c].filter(k => !cls[k].extra || T.kids[k].length).sort((a, b) => T.size[b] - T.size[a])[0]; c = next; if (line.length > 6) break; }
          // the head: a bone named head on that line, else the last one before the face / end bones
          const named = line.find(k => cls[k].base === 'head');
          if (named != null) map.Head = named;
          else if (line.length) { let h = line[line.length - 1]; for (let i = 1; i < line.length; i++) if (T.kids[line[i]].length !== 1) { h = line[i]; break; } map.Head = h; }
        }
        if (map.Head != null && T.isDesc(map.Head, hub)) { const neck = T.path(hub, map.Head); delete map.neck_01; if (neck.length) map.neck_01 = neck[0]; }
      }
    }
  }
  const problems = checkMap(bones, map, T);
  const missing = REQUIRED.filter(n => map[n] == null);
  return { map, source, missing, problems };
}
// hierarchy-only fallback: hips = the bone the legs and the spine branch from, the arms branch from the chest, the hand
// has the fingers. Sides from positions (the toes point forward, left = up x forward).
function structural(bones, T, map, cls) {
  const big = i => T.kids[i].filter(k => T.size[k] >= 3);
  let hips = -1, legRoots = null, spineRoot = -1;
  for (const i of T.order) {
    const b = big(i);
    if (b.length >= 3) { const s = b.slice().sort((x, y) => T.size[y] - T.size[x]); hips = i; spineRoot = s[0]; legRoots = s.slice(1, 3); break; }
    if (b.length === 2) { const [x, y] = b.slice().sort((p, q) => T.size[q] - T.size[p]), by = big(y);   // CC: Hip -> Waist (spine) + Pelvis (-> two legs)
      if (by.length === 2 && Math.abs(T.size[by[0]] - T.size[by[1]]) <= 2) { hips = i; spineRoot = x; legRoots = by; break; } }
  }
  if (hips < 0) return false;
  const main = i => { const out = [i]; let c = i; while (T.kids[c].length) { c = T.kids[c].slice().sort((a, b) => T.size[b] - T.size[a])[0]; out.push(c); } return out; };
  const legs = legRoots.map(main).filter(l => l.length >= 3);
  // chest hub: walking up the spine, the first bone with two big branches (the arms)
  let hub = spineRoot; while (hub >= 0 && big(hub).length < 2) hub = T.kids[hub].slice().sort((a, b) => T.size[b] - T.size[a])[0] ?? -1;
  if (hub < 0 || legs.length < 2) return false;
  const armRoots = big(hub).sort((a, b) => T.size[b] - T.size[a]).slice(0, 2);
  const arms = armRoots.map(r => { const out = [r]; let c = r; while (T.kids[c].length && big(c).length < 3) { c = T.kids[c].slice().sort((a, b) => T.size[b] - T.size[a])[0]; out.push(c); } return out; });
  const P = i => V(bones[i].pos);
  // sides: up = hub - hips, forward = the toes (foot -> ball) or +Z, left = up x forward
  const up = P(hub).sub(P(hips)).normalize(); let fw = new THREE.Vector3();
  for (const l of legs) if (l.length >= 4) fw.add(P(l[3]).sub(P(l[2])));
  fw.addScaledVector(up, -fw.dot(up)); if (fw.lengthSq() < 1e-8) fw.set(0, 0, 1).addScaledVector(up, -up.z); fw.normalize();
  const left = new THREE.Vector3().crossVectors(up, fw), sideOf = i => P(i).sub(P(hips)).dot(left) > 0 ? 'l' : 'r';
  const put = (k, i) => { if (map[k] == null && i != null && i >= 0) map[k] = i; };
  put('pelvis', hips);
  for (const l of legs) { const s = sideOf(l[1]); put(`thigh_${s}`, l[0]); put(`calf_${s}`, l[1]); put(`foot_${s}`, l[2]); if (l.length >= 5 || (l.length === 4 && T.kids[l[3]].length)) put(`ball_${s}`, l[3]); }
  for (const a of arms) { const s = sideOf(a[a.length - 1]); const n = a.length;
    if (n >= 4) { put(`clavicle_${s}`, a[0]); put(`upperarm_${s}`, a[1]); put(`lowerarm_${s}`, a[n - 2]); put(`hand_${s}`, a[n - 1]); }
    else if (n === 3) { put(`upperarm_${s}`, a[0]); put(`lowerarm_${s}`, a[1]); put(`hand_${s}`, a[2]); } }
  return true;
}
/** Problems of a mapping (empty = it holds): every required bone, each one below the one it hangs from, left on the left. */
export function checkMap(bones, map, T = treeOf(bones)) {
  const out = [];
  for (const n of REQUIRED) if (map[n] == null || !bones[map[n]]) out.push(`no bone for ${n}`);
  const seen = new Map();
  for (const [ours, i] of Object.entries(map)) { if (!bones[i]) continue; if (seen.has(i)) out.push(`${bones[i].name} is used for both ${seen.get(i)} and ${ours}`); seen.set(i, ours);
    let p = PARENT[ours]; while (p && map[p] == null) p = PARENT[p];
    if (p && map[p] != null && bones[map[p]] && !T.isDesc(i, map[p])) out.push(`${bones[i].name} (${ours}) is not below ${bones[map[p]].name} (${p})`); }
  const P = n => map[n] != null && bones[map[n]] ? V(bones[map[n]].pos) : null;
  const tl = P('thigh_l'), tr = P('thigh_r'), hd = P('Head'), pl = P('pelvis'), hl = P('hand_l'), hr = P('hand_r');
  if (tl && tr && hd && pl && hl && hr) {   // left hand and left thigh on the same side of the body
    const up = hd.clone().sub(pl).normalize(), ac = tl.clone().sub(tr); ac.addScaledVector(up, -ac.dot(up));
    if (hl.clone().sub(hr).dot(ac) < 0) out.push('the left arm and the left leg are on opposite sides');
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// the importer (the app's hidden window): file -> clean GLB + mapping
// ---------------------------------------------------------------------------------------------------------------------
const VRM_BONES = { hips: 'pelvis', spine: 'spine_01', chest: 'spine_02', upperChest: 'spine_03', neck: 'neck_01', head: 'Head' };
for (const [S, s] of [['left', 'l'], ['right', 'r']]) { Object.assign(VRM_BONES, { [`${S}Shoulder`]: `clavicle_${s}`, [`${S}UpperArm`]: `upperarm_${s}`, [`${S}LowerArm`]: `lowerarm_${s}`, [`${S}Hand`]: `hand_${s}`,
  [`${S}UpperLeg`]: `thigh_${s}`, [`${S}LowerLeg`]: `calf_${s}`, [`${S}Foot`]: `foot_${s}`, [`${S}Toes`]: `ball_${s}` });
  for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Little']) { const o = f === 'Little' ? 'pinky' : f.toLowerCase();
    Object.assign(VRM_BONES, { [`${S}${f}Proximal`]: `${o}_01_${s}`, [`${S}${f}Intermediate`]: `${o}_02_${s}`, [`${S}${f}Distal`]: `${o}_03_${s}` }); } }
function vrmHumanoid(gltf) {
  const ext = gltf?.parser?.json?.extensions; if (!ext) return null;
  const hb = ext.VRMC_vrm?.humanoid?.humanBones, v0 = ext.VRM?.humanoid?.humanBones; let list = null;
  if (hb && typeof hb === 'object') list = Object.entries(hb).map(([bone, x]) => ({ bone, node: x?.node }));
  else if (Array.isArray(v0)) list = v0.map(x => ({ bone: x.bone, node: x.node }));
  if (!list) return null;
  const v1 = !!hb, byNode = new Map(); gltf.scene.traverse(o => { const a = gltf.parser.associations.get(o); if (a?.nodes != null) byNode.set(a.nodes, o); });
  const out = {};
  for (const { bone, node } of list) { let ours = VRM_BONES[bone];
    if (v1 && /Thumb/.test(bone)) ours = { Metacarpal: '01', Proximal: '02', Distal: '03' }[bone.replace(/^(left|right)Thumb/, '')] ? `thumb_${{ Metacarpal: '01', Proximal: '02', Distal: '03' }[bone.replace(/^(left|right)Thumb/, '')]}_${bone.startsWith('left') ? 'l' : 'r'}` : null;
    const o = byNode.get(node); if (ours && o) out[ours] = o; }
  if (out.spine_02 && !out.spine_03) { out.spine_03 = out.spine_02; delete out.spine_02; }   // chest without an upper chest: the top of the spine
  return out;
}
const rotOf = M => { const q = new THREE.Quaternion(); M.decompose(new THREE.Vector3(), q, new THREE.Vector3()); return q; };
function snapAxes(M) {   // a whole-axis turn when within 25 degrees (A-pose leans would tilt the whole body)
  const e = M.elements, cols = [0, 1, 2].map(c => new THREE.Vector3(e[c * 4], e[c * 4 + 1], e[c * 4 + 2]));
  const snap = v => { const a = [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)], i = a.indexOf(Math.max(...a)), r = new THREE.Vector3(); r.setComponent(i, Math.sign(v.getComponent(i))); return r; };
  const S = cols.map(snap), m = new THREE.Matrix4().makeBasis(S[0], S[1], S[2]);
  if (Math.abs(m.determinant() - 1) > 1e-6) return M;
  return rotOf(m).angleTo(rotOf(M)) < 25 * Math.PI / 180 ? m : M;
}
// the frame of a standing skeleton: across = right -> left thigh, up = feet -> head, forward = across x up
function frameM(P) {
  const feet = P('foot_l').add(P('foot_r')).multiplyScalar(.5), up = P('Head').sub(feet).normalize();
  const ac = P('thigh_l').sub(P('thigh_r')); ac.addScaledVector(up, -ac.dot(up)).normalize(); const fw = new THREE.Vector3().crossVectors(ac, up).normalize();
  return new THREE.Matrix4().makeBasis(ac, up, fw);
}
async function waitTextures(root, ms = 6000) {
  const tex = new Set(); root.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material || [])) for (const k of Object.keys(m)) if (m[k]?.isTexture) tex.add(m[k]); });
  const ok = t => { const i = t.image; return !!i && ((i.width > 0 && i.height > 0 && (i.complete !== false)) || i instanceof ImageBitmap); };
  const t0 = performance.now(); while ([...tex].some(t => !ok(t)) && performance.now() - t0 < ms) await new Promise(r => setTimeout(r, 100));
  return { all: tex.size, ok: [...tex].filter(ok).length, isOk: ok };
}
function cleanMat(m, texOk) {
  const keep = t => t?.isTexture && texOk(t) ? t : null;
  if (m.isMeshStandardMaterial) { const c = m.clone(); for (const k of Object.keys(c)) if (c[k]?.isTexture && !keep(c[k])) c[k] = null; return c; }
  const s = new THREE.MeshStandardMaterial({ name: m.name, color: m.color ? m.color.clone() : new THREE.Color(0xcccccc), map: keep(m.map), normalMap: keep(m.normalMap), emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0),
    emissiveMap: keep(m.emissiveMap), alphaMap: keep(m.alphaMap), transparent: !!m.transparent, opacity: m.opacity ?? 1, alphaTest: m.alphaTest ?? 0, side: m.side ?? THREE.FrontSide,
    roughness: m.shininess != null ? Math.min(1, Math.max(.25, 1 - Math.sqrt(m.shininess / 100) * .6)) : .7, metalness: 0 });
  if (m.vertexColors) s.vertexColors = true; return s;
}
const TOO_MANY = 250;
/**
 * convertCharFile(arrayBuffer, fileName, { mapping?: { ours: theirName } }) ->
 *   { status: 'ok', glb, mapping, info } | { status: 'needs-mapping', mapping, info } (bones listed, nothing exported)
 * mapping.json: { version, source, map: { ours: theirs }, bones: [{ name, parent, pos, weighted }], missing, problems }
 */
export async function convertCharFile(buf, fileName, o = {}) {
  const ext = String(fileName).toLowerCase().split('.').pop();
  let scene, gltf = null;
  try {
    if (ext === 'fbx') { const { FBXLoader } = await import(VENDOR + 'jsm/loaders/FBXLoader.js'); scene = new FBXLoader().parse(buf, ''); }
    else if (ext === 'glb' || ext === 'gltf' || ext === 'vrm') { gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej)); scene = gltf.scene; }
    else throw new Error('Not a character file (FBX, GLB, GLTF or VRM).');
  } catch (e) {
    const m = String(e?.message || e);
    if (/draco|meshopt|KHR_draco|EXT_meshopt/i.test(m)) throw new Error('This GLB is compressed (Draco / Meshopt). Export it again without compression.');
    if (/Unknown format|Invalid typed array|magic|Unexpected token|JSON|offset is out of bounds|Cannot read/i.test(m) || ext === 'fbx') throw new Error(`The file could not be read as ${ext.toUpperCase()} (${m.split('\n')[0].slice(0, 120)}).`);
    throw new Error(`The file could not be read: ${m.split('\n')[0].slice(0, 160)}`);
  }
  if (!scene) throw new Error('The file has no scene in it.');
  scene.updateMatrixWorld(true);
  const tw = await waitTextures(scene);
  const skinned = [], statics = []; scene.traverse(x => { if (x.isSkinnedMesh && x.skeleton?.bones?.length) skinned.push(x); else if (x.isMesh && !x.isSkinnedMesh) statics.push(x); });
  if (!skinned.length) throw new Error('This model has no skeleton (it is not rigged). Rig it first: Mixamo\'s free auto-rigger rigs a still character in a minute.');
  const prim = skinned.slice().sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
  // bind matrices of every bone in the primary mesh's bind space
  const bind = new Map(), X = new Map();
  prim.skeleton.bones.forEach((b, i) => bind.set(b, prim.skeleton.boneInverses[i].clone().invert()));
  X.set(prim, new THREE.Matrix4());
  for (const m of skinned) { if (m === prim) continue; let x = null;
    m.skeleton.bones.forEach((b, i) => { if (!x && bind.has(b)) x = bind.get(b).clone().multiply(m.skeleton.boneInverses[i]); });
    x ??= new THREE.Matrix4(); X.set(m, x);
    m.skeleton.bones.forEach((b, i) => { if (!bind.has(b)) bind.set(b, x.clone().multiply(m.skeleton.boneInverses[i].clone().invert())); }); }
  // + bones around the skinned ones (end bones below, unskinned bones above): from the hierarchy
  const skinBones = new Set(bind.keys());
  for (const b of skinBones) { let c = b; while (c.parent && c.parent.isBone && !bind.has(c.parent)) {
    c.updateMatrix(); bind.set(c.parent, bind.get(c).clone().multiply(c.matrix.clone().invert())); c = c.parent; } }
  const addKids = b => { for (const c of b.children) if (c.isBone && !bind.has(c)) { c.updateMatrix(); bind.set(c, bind.get(b).clone().multiply(c.matrix)); addKids(c); } };
  for (const b of [...bind.keys()]) addKids(b);
  // FBX files hold some bones twice (a copy under the bone itself, named the same; glTF then calls it name_1): one bone
  const isDup = b => { const p = b.parent; if (!p || !bind.has(p) || !p.name) return false; return b.name === p.name || (b.name.startsWith(p.name + '_') && /^_\d+$/.test(b.name.slice(p.name.length))); };
  const canon = b => { while (b && isDup(b)) b = b.parent; return b; };
  const all = [...bind.keys()].filter(b => !isDup(b)), set = new Set(all), parentOf = b => { let p = b.parent; while (p && !set.has(p)) p = p.parent; return p; };
  if (all.length > TOO_MANY * 2) throw new Error(`The skeleton has ${all.length} bones: too many for a character (a whole scene?).`);
  // names: safe for animation bindings and unique
  const used = new Set(), nameOf = new Map();
  for (const b of all) { let n = THREE.PropertyBinding.sanitizeNodeName(b.name || '') || 'bone', k = 2; const base = n; while (used.has(n)) n = `${base}_${k++}`; used.add(n); nameOf.set(b, n); }
  // which bones move vertices
  const weighted = new Set(); for (const m of skinned) { const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight; if (!si || !sw) continue;
    for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > .01) weighted.add(canon(m.skeleton.bones[si.getComponent(i, k)])); }
  const idx = new Map(all.map((b, i) => [b, i])); for (const b of bind.keys()) if (!idx.has(b) && idx.has(canon(b))) idx.set(b, idx.get(canon(b)));
  const blist = all.map(b => ({ name: nameOf.get(b), parent: parentOf(b) ? idx.get(parentOf(b)) : -1, pos: new THREE.Vector3().setFromMatrixPosition(bind.get(b)).toArray().map(v => +v.toFixed(5)), weighted: weighted.has(b) }));
  // the mapping: given (the user's / Claude's), the VRM's own, else found
  let res;
  if (o.mapping && typeof o.mapping === 'object') {
    const byName = new Map(blist.map((b, i) => [b.name, i])), map = {};
    for (const [ours, theirs] of Object.entries(o.mapping)) { if (!OUR_BONES.includes(ours) || theirs == null || theirs === '') continue; const i = byName.get(String(theirs)) ?? byName.get(THREE.PropertyBinding.sanitizeNodeName(String(theirs)));
      if (i == null) throw new Error(`The mapping names a bone the model does not have: ${theirs}`); map[ours] = i; }
    res = { map, source: 'user', missing: REQUIRED.filter(n => map[n] == null), problems: checkMap(blist, map) };
  } else {
    let vrm = null; const hv = gltf && vrmHumanoid(gltf);
    if (hv) { vrm = {}; for (const [ours, ob] of Object.entries(hv)) if (idx.has(ob)) vrm[ours] = idx.get(ob); }
    res = autoMap(blist, { vrm });
  }
  const names = Object.fromEntries(Object.entries(res.map).filter(([, i]) => i != null && i >= 0).map(([k, i]) => [k, blist[i].name]));
  const rig = gltf && vrmHumanoid(gltf) ? 'VRM' : /mixamorig/i.test(all.map(b => b.name).join(' ')) ? 'Mixamo' : /^CC_Base_/m.test(all.map(b => b.name).join('\n')) ? 'Character Creator'
    : all.some(b => /^DEF-/.test(b.name)) ? 'Rigify' : all.some(b => /^(spine_0\d|upperarm_l)$/.test(b.name)) ? 'Unreal' : all.some(b => /^Bip0*1/.test(b.name)) ? '3ds Max Biped'
    : all.some(b => /^[lr](Shldr|Thigh|Forearm)/.test(b.name)) ? 'Daz' : all.some(b => /^J_Bip_/.test(b.name)) ? 'VRoid' : 'humanoid';
  const mapping = { version: 1, source: res.source, rig, map: names, bones: blist, missing: res.missing, problems: res.problems };
  const counts = { bones: all.length, meshes: skinned.length + statics.length, verts: skinned.reduce((s, m) => s + m.geometry.attributes.position.count, 0), textures: tw.all, texturesLoaded: tw.ok };
  if (res.missing.length || res.problems.length) return { status: 'needs-mapping', mapping, info: { ...counts, rig } };
  // ---- normalise: facing +Z, up +Y, feet on y = 0, pelvis over the origin, a real height ----
  const P = n => new THREE.Vector3().setFromMatrixPosition(bind.get(all[res.map[n]]));
  const R = snapAxes(frameM(P).transpose()), vtx = new THREE.Vector3(); let minY = Infinity, maxY = -Infinity;
  const vb = new Map();   // mesh -> matrix to the (rotated) bind space
  for (const m of skinned) vb.set(m, R.clone().multiply(X.get(m)).multiply(m.bindMatrix));
  for (const m of skinned) { const p = m.geometry.attributes.position, M = vb.get(m); for (let i = 0; i < p.count; i += 3) { vtx.fromBufferAttribute(p, i).applyMatrix4(M); minY = Math.min(minY, vtx.y); maxY = Math.max(maxY, vtx.y); } }
  const raw = maxY - minY; if (!(raw > 0)) throw new Error('The character has no size (its vertices could not be read).');
  let s = 1; for (const k of [1, .01, .001, .0254, 1 / 12 * .3048, 100]) if (raw * k >= 1.2 && raw * k <= 2.4) { s = k; break; }
  if (!(raw * s >= 1.2 && raw * s <= 2.4)) s = 1.75 / raw;
  let height = raw * s; if (height < 1.5 || height > 2.0) { const h2 = Math.min(2, Math.max(1.5, height)); s *= h2 / height; height = h2; }
  const pel = P('pelvis').applyMatrix4(R).multiplyScalar(s);
  const A = new THREE.Matrix4().makeTranslation(-pel.x, -minY * s, -pel.z).multiply(new THREE.Matrix4().makeScale(s, s, s)).multiply(R);
  // clean bones: rotation + position only (no scale), in the normalised space
  const NW = new Map(); for (const b of all) { const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); A.clone().multiply(bind.get(b)).decompose(p, q, sc); NW.set(b, new THREE.Matrix4().compose(p, q.normalize(), new THREE.Vector3(1, 1, 1))); }
  const nb = new Map(); for (const b of all) { const B = new THREE.Bone(); B.name = nameOf.get(b); nb.set(b, B); }
  const root = new THREE.Group(); root.name = 'CustomCharacter';
  for (const b of all) { const B = nb.get(b), p = parentOf(b), L = p ? NW.get(p).clone().invert().multiply(NW.get(b)) : NW.get(b).clone(); L.decompose(B.position, B.quaternion, B.scale); B.scale.set(1, 1, 1); (p ? nb.get(p) : root).add(B); }
  const bonesArr = all.map(b => nb.get(b)), inverses = all.map(b => NW.get(b).clone().invert()), skel = new THREE.Skeleton(bonesArr, inverses);
  const matCache = new Map(), mat = m => Array.isArray(m) ? m.map(mat) : (matCache.get(m) ?? (matCache.set(m, cleanMat(m, tw.isOk)), matCache.get(m)));
  const made = [];
  const finish = (g, src, name) => { g.morphAttributes = {}; g.morphTargetsRelative = false; g.deleteAttribute('tangent'); g.computeBoundingBox(); g.computeBoundingSphere();
    const sm = new THREE.SkinnedMesh(g, mat(src.material)); sm.name = name || 'body'; sm.bind(skel, new THREE.Matrix4()); sm.castShadow = sm.receiveShadow = true; root.add(sm); made.push(sm); };
  const TS = new THREE.Matrix4().makeTranslation(-pel.x, -minY * s, -pel.z).multiply(new THREE.Matrix4().makeScale(s, s, s));   // (A = TS R; vb already holds R)
  for (const m of skinned) {
    const g = m.geometry.clone(); g.applyMatrix4(TS.clone().multiply(vb.get(m)));
    const si = g.attributes.skinIndex; if (si) { const arr = new Uint16Array(si.count * 4); for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) arr[i * 4 + k] = idx.get(m.skeleton.bones[si.getComponent(i, k)]) ?? 0; g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(arr, 4)); }
    finish(g, m, nameOf.get(m) || m.name);
  }
  // still meshes: glasses, hats under a bone ride that bone; loose ones the nearest bone
  for (const m of statics) {
    if (!m.visible || !m.geometry?.attributes?.position) continue;
    let b = m.parent; while (b && !set.has(b)) b = b.parent;
    const g = m.geometry.clone(); let M;
    if (b) M = R.clone().multiply(bind.get(b)).multiply(b.matrixWorld.clone().invert()).multiply(m.matrixWorld);
    else { M = R.clone().multiply(m.matrixWorld); g.computeBoundingSphere(); const c = g.boundingSphere.center.clone().applyMatrix4(m.matrixWorld); let bd = Infinity; for (const x of all) { const d = new THREE.Vector3().setFromMatrixPosition(bind.get(x)).distanceTo(c); if (d < bd) { bd = d; b = x; } } }
    g.applyMatrix4(TS.clone().multiply(M));
    const n = g.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), bi = idx.get(b) ?? 0; for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    finish(g, m, m.name || 'part');
  }
  root.updateMatrixWorld(true);
  const { GLTFExporter } = await import(VENDOR + 'jsm/exporters/GLTFExporter.js');
  let glb;
  try { glb = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: false, maxTextureSize: 2048 }); }
  catch (e) { for (const m of made) for (const mm of [].concat(m.material)) for (const k of Object.keys(mm)) if (mm[k]?.isTexture) mm[k] = null;   // a texture the exporter can't read: without textures
    glb = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: false }); counts.texturesLoaded = 0; }
  return { status: 'ok', glb, mapping, info: { ...counts, rig, height: +height.toFixed(3), unitScale: s } };
}

// ---------------------------------------------------------------------------------------------------------------------
// in a scene: load + bind onto a figure's skeleton
// ---------------------------------------------------------------------------------------------------------------------
const CACHE = new Map(), LOADING = new Map(); let REV = 0;   // (rev: one number per load: caches keyed by a character id know a re-import)
/** await loadCustomChar(id): the character's model + mapping (cached; { fresh: true } reloads after a re-import). */
export async function loadCustomChar(id, o = {}) {
  id = String(id || '').replace(/^custom:/, ''); if (!CHAR_ID.test(id)) throw new Error(`not a character id: ${id}`);
  if (!o.fresh && CACHE.has(id)) return CACHE.get(id);
  if (!o.fresh && LOADING.has(id)) return LOADING.get(id);
  const base = CHARB() + id + '/', bust = o.fresh ? '?t=' + Date.now() : '';
  const p = (async () => {
    const [g, mapping, meta] = await Promise.all([new GLTFLoader().loadAsync(base + 'model.glb' + bust), fetch(base + 'mapping.json' + bust, { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch(base + 'meta.json' + bust, { cache: 'no-store' }).then(r => r.ok ? r.json() : {})]);
    if (!mapping?.map) throw new Error(`character ${id}: no bone mapping (map its bones in the app first)`);
    const C = { id, scene: g.scene, mapping, meta: meta || {}, height: +meta?.height || 1.75, rev: ++REV }; CACHE.set(id, C); return C;
  })();
  LOADING.set(id, p); try { return await p; } finally { LOADING.delete(id); }
}
export const customCharLoaded = id => CACHE.has(String(id || '').replace(/^custom:/, ''));
export function customCharInfo(id) { const C = CACHE.get(String(id || '').replace(/^custom:/, '')); return C ? { id: C.id, name: C.meta.name, height: C.height, rig: C.mapping.rig, map: { ...C.mapping.map }, rev: C.rev } : null; }

// the figure's skinned body (the skeleton with 'pelvis') and its bones' rest in its bind space
function figureSkin(root) { let fig = null; root.traverse(m => { if (m.isSkinnedMesh && !m.userData.customChar && m.skeleton?.bones.some(b => b.name === 'pelvis') && (!fig || m.geometry.attributes.position.count > fig.geometry.attributes.position.count)) fig = m; }); return fig; }
const HB = new WeakMap();
function bindHeight(fig) {   // the figure's body height (feet .. top of the head) in its bind space
  if (HB.has(fig.geometry)) return HB.get(fig.geometry);
  const p = fig.geometry.attributes.position, v = new THREE.Vector3(); let a = Infinity, b = -Infinity;
  for (let i = 0; i < p.count; i += 2) { v.fromBufferAttribute(p, i).applyMatrix4(fig.bindMatrix); a = Math.min(a, v.y); b = Math.max(b, v.y); }
  const r = { min: a, max: b, h: b - a }; HB.set(fig.geometry, r); return r;
}
/**
 * customBody(id, figureRoot, o) -> { meshes, height, map, fit }: the custom character's SkinnedMesh(es) bound onto the
 * figure's skeleton (added next to its body), the figure's own meshes hidden (layer 31; o.hide false keeps them).
 * o.mat(isJoint, ownMaterial) -> a material: the project's finish instead of the model's own materials (o.mat null = own).
 */
export function customBody(id, figureRoot, o = {}) {
  id = String(id || '').replace(/^custom:/, '');
  const C = CACHE.get(id); if (!C) throw new Error(`custom character "${id}" is not loaded: await loadCustomChar('${id}') first`);
  const fig = figureSkin(figureRoot); if (!fig) throw new Error('customBody: no figure skeleton (a skinned body with a pelvis bone) under that object');
  const FR = new Map(fig.skeleton.bones.map((b, i) => [b.name, { bone: b, rest: fig.skeleton.boneInverses[i].clone().invert(), inv: fig.skeleton.boneInverses[i] }]));
  const fpos = n => FR.has(n) ? new THREE.Vector3().setFromMatrixPosition(FR.get(n).rest) : null;
  // their model in the figure's bind space: the figure's facing and up, its height, feet on its feet
  const Fp = n => fpos(n) ?? new THREE.Vector3();
  const MF = snapAxes(frameM(Fp)), hb = bindHeight(fig), k = hb.h / C.height, pf = Fp('pelvis');
  const PM = new THREE.Matrix4().makeTranslation(pf.x, hb.min, pf.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(rotOf(MF))).multiply(new THREE.Matrix4().makeScale(k, k, k));
  // their bones (one skeleton for every mesh of the clean model)
  let src = null; C.scene.traverse(m => { if (!src && m.isSkinnedMesh) src = m; });
  if (!src) throw new Error(`character ${id}: no skinned mesh in model.glb`);
  const SB = src.skeleton.bones, Bb = SB.map((b, i) => PM.clone().multiply(src.skeleton.boneInverses[i].clone().invert()));   // bind matrices in the figure's bind space
  const iOf = new Map(SB.map((b, i) => [b.name, i])), ours = new Map();   // their index -> our bone name
  for (const [o2, t] of Object.entries(C.mapping.map || {})) if (iOf.has(t) && FR.has(o2)) ours.set(iOf.get(t), o2);
  const bpos = i => new THREE.Vector3().setFromMatrixPosition(Bb[i]);
  // 1. rest fit: their mapped limbs turned to point like ours, top-down (each turn carries the bones below)
  const isB = new Set(SB), parentI = i => { let p = SB[i].parent; while (p && !isB.has(p)) p = p.parent; return p ? iOf.get(p.name) : -1; };
  const order = []; const seen = new Set(); const visit = i => { if (seen.has(i)) return; const p = parentI(i); if (p >= 0) visit(p); seen.add(i); order.push(i); }; SB.forEach((_, i) => visit(i));
  const D = new Map(), fit = {}, theirOf = n => { for (const [i, o2] of ours) if (o2 === n) return i; return -1; };
  const descOf = (i, anc) => { for (let p = i; p >= 0; p = parentI(p)) if (p === anc) return true; return false; };
  for (const i of order) {
    const p = parentI(i); let Di = p >= 0 ? D.get(p).clone() : new THREE.Matrix4();
    const n = ours.get(i);
    if (n && AIM[n]) {
      const tgt = AIM[n].find(t => FR.has(t) && theirOf(t) >= 0 && descOf(theirOf(t), i));
      if (tgt) { const j = theirOf(tgt), a = bpos(i).applyMatrix4(Di), c = bpos(j).applyMatrix4(Di), dc = c.sub(a), df = fpos(tgt).sub(fpos(n));
        if (dc.lengthSq() > 1e-12 && df.lengthSq() > 1e-12) { const q = new THREE.Quaternion().setFromUnitVectors(dc.normalize(), df.normalize()); fit[n] = +(2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180 / Math.PI).toFixed(1);
          Di = new THREE.Matrix4().makeTranslation(a.x, a.y, a.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(new THREE.Matrix4().makeTranslation(-a.x, -a.y, -a.z)).multiply(Di); } }
    }
    D.set(i, Di);
  }
  // 2. OWN PROPORTIONS (engine v21): the figure's skeleton takes THEIR joints, not the other way round. Each of our mapped
  // bones moves onto their (rest-fitted) joint; our unmapped bones keep their offsets (or sit on the line between their
  // mapped neighbours, spine_02 between spine_01 and spine_03). Our rest ROTATIONS stay, so every clip's rotations mean what
  // they always meant (rest-relative), and clips move no joint but the pelvis (its translation scaled by the new hip height,
  // anim-runtime prepareClip / anims.js retarget). Their skin then rides with nothing moved: the neck, shoulders, hips and
  // clothes stay exactly as in their file. (Before v21 their joints were moved onto the mannequin's: a member's neck was
  // stretched to twice its length, shirts sheared over the shoulders and clipped.) o.proportions 'figure': the old way.
  const moved = {};
  if (o.proportions !== 'figure') ownProportions(fig, figureRoot, FR, new Map([...ours].map(([i, n]) => [n, bpos(i).applyMatrix4(D.get(i) ?? new THREE.Matrix4())])), moved, C.height / hb.h);
  // 3. each of their bones follows its mapped bone or its nearest mapped ancestor (mapped joints are on ours: v21 moved ours
  // onto theirs, so the snap below is zero; with proportions 'figure' it moves theirs onto ours)
  const follow = i => { for (let p = i; p >= 0; p = parentI(p)) if (ours.has(p)) return p; return -1; };
  const pelI = theirOf('pelvis');
  const bones = [], inverses = [];
  SB.forEach((b, i) => {
    let m = follow(i); if (m < 0) m = pelI;
    const n = ours.get(m) ?? 'pelvis', F = FR.get(n), Dm = D.get(m) ?? new THREE.Matrix4(), pm = bpos(m).applyMatrix4(Dm), snap = fpos(n).sub(pm);
    const Bpp = new THREE.Matrix4().makeTranslation(snap.x, snap.y, snap.z).multiply(D.get(i) ?? Dm).multiply(Bb[i]);   // re-posed + snapped
    bones.push(F.bone); inverses.push(F.inv.clone().multiply(Bpp).multiply(Bb[i].clone().invert()));
  });
  const skel = new THREE.Skeleton(bones, inverses), made = [];
  C.scene.traverse(m => { if (!m.isSkinnedMesh) return;
    // (every mesh of the clean model uses the same bones in the same order)
    const own = m.material, mat = typeof o.mat === 'function' ? (Array.isArray(own) ? own.map(x => o.mat(/joint/i.test(x.name || ''), x)) : o.mat(/joint/i.test(own?.name || ''), own)) : own;
    const s = new THREE.SkinnedMesh(m.geometry, mat); s.name = `${o.name ?? C.meta.name ?? id} ${m.name || 'body'}`; s.bindMode = fig.bindMode;
    s.bind(skel, PM.clone().multiply(m.bindMatrix)); s.castShadow = s.receiveShadow = true; s.frustumCulled = false; s.userData.customChar = id; made.push(s); });
  const hidden = [];
  if (o.hide !== false) figureRoot.traverse(x => { if (x.isMesh && !x.userData.customChar) { x.layers.set(31); hidden.push(x); } });
  for (const s of made) fig.parent.add(s);
  return { meshes: made, height: C.height, map: { ...C.mapping.map }, fit, hidden, moved, proportions: o.proportions === 'figure' ? 'figure' : 'own' };
}
// the figure's skeleton re-proportioned (customBody step 2): want = our bone name -> its new rest position (bind space);
// FR (name -> { bone, rest, inv }) is updated in place; the figure's own (hidden) skins get matching inverse binds (new
// arrays: cloned skeletons share the source's); moved[name] = how far the joint moved (mm in the character's units)
function ownProportions(fig, figureRoot, FR, want, moved, toModel = 1) {
  const fb = fig.skeleton.bones, inSk = new Set(fb); let top = fb.find(b => b.name === 'pelvis') ?? fb[0]; while (top.parent && inSk.has(top.parent)) top = top.parent;
  const pre = []; (function rec(b) { pre.push(b); for (const c of b.children) if (inSk.has(c)) rec(c); })(top);
  const oldP = b => new THREE.Vector3().setFromMatrixPosition(FR.get(b.name).rest), NP = new Map();
  // the nearest mapped bone below an unmapped one (by depth; the neck first: spine_03's line goes up the neck)
  const below = b => { let best = null, bd = Infinity; const rec = (x, d) => { for (const c of x.children) { if (!inSk.has(c)) continue;
    if (want.has(c.name)) { if (d < bd || (d === bd && /^neck/.test(c.name))) { best = c; bd = d; } } else rec(c, d + 1); } }; rec(b, 1); return best; };
  for (const b of pre) {
    const p = inSk.has(b.parent) ? b.parent : null; let pos;
    if (want.has(b.name)) pos = want.get(b.name).clone();
    else if (!p) pos = oldP(b);
    else { let anc = p; while (anc && inSk.has(anc) && !want.has(anc.name)) anc = anc.parent;
      const B = below(b);
      if (B && anc && want.has(anc.name)) { const a0 = oldP(anc), b0 = oldP(b), c0 = oldP(B), l1 = b0.distanceTo(a0), l2 = c0.distanceTo(b0); pos = NP.get(anc).clone().lerp(want.get(B.name), l1 + l2 > 1e-9 ? l1 / (l1 + l2) : .5); }
      else pos = NP.get(p).clone().add(oldP(b).sub(oldP(p))); }   // (the parent's rest rotation is unchanged: the same offset)
    NP.set(b, pos);
  }
  const NR = new Map(pre.map(b => [b, FR.get(b.name).rest.clone().setPosition(NP.get(b))]));
  for (const b of pre) { const d = NP.get(b).distanceTo(oldP(b)) * toModel * 1000; if (d > .05) moved[b.name] = +d.toFixed(1);
    if (inSk.has(b.parent)) b.position.setFromMatrixPosition(NR.get(b.parent).clone().invert().multiply(NR.get(b))); }
  const done = new Set();
  figureRoot.traverse(m => { if (!m.isSkinnedMesh || m.userData.customChar || done.has(m.skeleton) || !m.skeleton?.bones.some(b => NR.has(b))) return; done.add(m.skeleton);
    m.skeleton.boneInverses = m.skeleton.bones.map((b, i) => NR.has(b) ? NR.get(b).clone().invert().multiply(FR.get(b.name).rest).multiply(m.skeleton.boneInverses[i]) : m.skeleton.boneInverses[i].clone()); });
  for (const b of pre) { const r = NR.get(b); FR.set(b.name, { bone: b, rest: r, inv: r.clone().invert() }); }
}

// ---------------------------------------------------------------------------------------------------------------------
// the test sheet (the app's hidden window, on the Characters preview page): the character on a figure in our poses,
// front + side, with automatic checks
// ---------------------------------------------------------------------------------------------------------------------
export const SHEET_POSES = [['T-pose', null], ['idle', 'stand'], ['walk', 'walk'], ['sit', 'sit'], ['phone', 'phone'], ['point', 'point'], ['typing', 'typing']];
const LIMBS = [['upperarm_l', 'lowerarm_l'], ['lowerarm_l', 'hand_l'], ['upperarm_r', 'lowerarm_r'], ['lowerarm_r', 'hand_r'], ['thigh_l', 'calf_l'], ['calf_l', 'foot_l'], ['thigh_r', 'calf_r'], ['calf_r', 'foot_r'], ['spine_01', 'Head']];
function restPose(fig) {   // the figure's bones to their bind (rest) pose
  const sk = fig.skeleton, set = new Set(sk.bones), inv = new Map(sk.bones.map((b, i) => [b, sk.boneInverses[i]]));
  fig.updateMatrixWorld(true);
  for (const b of sk.bones) { const rest = inv.get(b).clone().invert();
    let L; if (set.has(b.parent)) L = inv.get(b.parent).clone().multiply(rest);
    else { const Pb = fig.bindMatrix.clone().multiply(fig.matrixWorld.clone().invert()).multiply(b.parent ? b.parent.matrixWorld : new THREE.Matrix4()); L = Pb.invert().multiply(rest); }
    L.decompose(b.position, b.quaternion, b.scale); }
}
// the segments proportionCheck compares (the file's own joints vs the figure's bones)
export const PROPORTION_PAIRS = [['pelvis', 'spine_01'], ['spine_01', 'spine_02'], ['spine_02', 'spine_03'], ['spine_03', 'neck_01'], ['neck_01', 'Head'], ['spine_03', 'clavicle_l'], ['clavicle_l', 'clavicle_r'],
  ['clavicle_l', 'upperarm_l'], ['clavicle_r', 'upperarm_r'], ['upperarm_l', 'upperarm_r'], ['upperarm_l', 'lowerarm_l'], ['lowerarm_l', 'hand_l'], ['upperarm_r', 'lowerarm_r'], ['lowerarm_r', 'hand_r'], ['hand_l', 'middle_01_l'],
  ['index_01_l', 'pinky_01_l'], ['pelvis', 'thigh_l'], ['thigh_l', 'thigh_r'], ['thigh_l', 'calf_l'], ['calf_l', 'foot_l'], ['thigh_r', 'calf_r'], ['calf_r', 'foot_r'], ['foot_l', 'ball_l']];
/**
 * proportionCheck(f) (QA: the test sheet, the app's charupload test): does a figure wearing a custom body keep the
 * character's OWN proportions and skin? -> { ok, lengths: { 'neck_01-Head': { file, figure, ratio } (mm in the character's
 * units) }, worst: { pair, ratio }, bindError: { max, p95 } (mm) } | null (no custom body).
 * bindError: the figure's skeleton is turned (rotations only, the pelvis moved) so the custom mesh should land exactly on its
 * own bind pose: a joint moved onto the mannequin's shows up as millimetres here (v20 and older: 40-150 mm). Leaves the
 * figure in its rest pose.
 */
export function proportionCheck(f) {
  const root = f?.root ?? f?.group, m0 = f?.custom?.meshes?.[0], C = m0 && CACHE.get(m0.userData.customChar); if (!root || !C) return null;
  const fig = figureSkin(root); let src = null; C.scene.traverse(m => { if (!src && m.isSkinnedMesh) src = m; }); if (!fig || !src) return null;
  const V = () => new THREE.Vector3(), tIdx = new Map(src.skeleton.bones.map((b, i) => [b.name, i])), sk = m0.skeleton;
  restPose(fig); root.updateMatrixWorld(true);
  const pel = fig.skeleton.bones.find(b => b.name === 'pelvis'), G = pel.matrixWorld.clone().multiply(fig.skeleton.boneInverses[fig.skeleton.bones.indexOf(pel)]);   // bind space -> world
  const k = V().setFromMatrixScale(G).x * V().setFromMatrixScale(m0.bindMatrix.clone().multiply(src.bindMatrix.clone().invert())).x;   // the model's units -> world
  // 1. their bind pose through our skeleton
  const inSk = new Set(fig.skeleton.bones); let top = pel; while (top.parent && inSk.has(top.parent)) top = top.parent;
  const pre = []; (function rec(b) { pre.push(b); for (const c of b.children) if (inSk.has(c)) rec(c); })(top);
  const p = V(), q = new THREE.Quaternion(), s = V();
  for (const b of pre) { const t = C.mapping.map[b.name], i = t != null ? tIdx.get(t) : null;
    if (i != null && sk.bones[i] === b && b.parent) { b.parent.matrixWorld.clone().invert().multiply(G.clone().multiply(sk.boneInverses[i].clone().invert())).decompose(p, q, s); b.quaternion.copy(q); if (b === pel) b.position.copy(p); }
    b.updateWorldMatrix(false, false); }
  root.updateMatrixWorld(true);
  const err = [], v = V(), w = V();
  for (const m of f.custom.meshes) { const pa = m.geometry.attributes.position; for (let i = 0; i < pa.count; i += 3) { v.fromBufferAttribute(pa, i); w.copy(v).applyMatrix4(m.bindMatrix).applyMatrix4(G); m.applyBoneTransform(i, v); v.applyMatrix4(m.matrixWorld); err.push(v.distanceTo(w) / k * 1000); } }
  err.sort((a, b) => a - b);
  // 2. segment lengths (any pose: clips turn bones, they never move a joint but the pelvis)
  const TP = n => { const t = C.mapping.map[n], i = t != null ? tIdx.get(t) : null; return i == null ? null : V().setFromMatrixPosition(src.skeleton.boneInverses[i].clone().invert()); };
  const WP = n => { const b = fig.skeleton.bones.find(x => x.name === n); return b ? b.getWorldPosition(V()) : null; };
  const lengths = {}; let worst = { pair: null, ratio: 1 };
  for (const [a, b] of PROPORTION_PAIRS) { const ta = TP(a), tb = TP(b), fa = WP(a), fb = WP(b); if (!ta || !tb || !fa || !fb) continue;
    const file = ta.distanceTo(tb) * 1000, figure = fa.distanceTo(fb) / k * 1000; if (file < 1) continue; const ratio = figure / file;
    lengths[`${a}-${b}`] = { file: +file.toFixed(1), figure: +figure.toFixed(1), ratio: +ratio.toFixed(3) }; if (Math.abs(ratio - 1) > Math.max(5e-4, Math.abs(worst.ratio - 1))) worst ={ pair: `${a}-${b}`, ratio: +ratio.toFixed(3) }; }
  restPose(fig); root.updateMatrixWorld(true);
  const bindError = { max: +(err[err.length - 1] ?? 0).toFixed(1), p95: +(err[Math.floor(err.length * .95)] ?? 0).toFixed(1) };
  return { ok: Math.abs(worst.ratio - 1) <= .01 && bindError.max <= 2, proportions: f.custom.proportions ?? 'figure', worst, bindError, lengths };
}
/** renderSheet(id, { F, w, h }) -> { sheet: PNG data URL, thumb: PNG data URL, warnings: [...], checks } */
export async function renderSheet(id, o = {}) {
  const F = o.F ?? await import('./figures.js');
  await F.loadFigures(['mq']);
  const C = await loadCustomChar(id, { fresh: true });
  await F.loadFigures(['custom:' + id]);
  const tw = o.w ?? 256, th = o.h ?? 384, cols = SHEET_POSES.length;
  const canvas = document.createElement('canvas'); canvas.width = tw; canvas.height = th;
  const R = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); R.setPixelRatio(1); R.setSize(tw, th, false); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#3b424c');
  scene.add(new THREE.HemisphereLight(0xf2f4f8, 0x30343a, 1.6)); const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2.5, 4.5, 3.5); scene.add(key); const rim = new THREE.DirectionalLight(0xbfd4ff, 1.0); rim.position.set(-3, 3, -3.5); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.MeshStandardMaterial({ color: '#59616d', roughness: .95 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const stage = new THREE.Group(); scene.add(stage);
  const box = (w, h, d, x, y, z, c = '#7d8591') => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: c, roughness: .8 })); m.position.set(x, y, z); return m; };
  const furniture = new THREE.Group(); stage.add(furniture);
  const setFurniture = act => { furniture.clear(); if (act !== 'sit' && act !== 'typing') return; const sc = C.height / 1.8, u = .08, z = -.17;   // (lib/figures.js: the clips sit on a 0.45 m seat)
    const g = new THREE.Group(); g.scale.setScalar(sc); furniture.add(g);
    g.add(box(.46, .05 + u, .44, 0, .345 + u / 2, -.04 + z)); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(.035, .32 + u, .035, a * .2, .16 + u / 2, -.04 + z + b * .19, '#5f6670'));
    g.add(box(.46, .42, .04, 0, .59 + u, -.27 + z - .06));
    if (act === 'typing') { g.add(box(.9, .035, .5, 0, .7225, .5)); g.add(box(.42, .015, .14, 0, .748, .44, '#24272c')); } };
  // (v21: the figure wears it the way a scene's figure does, body 'custom:<id>': grounding, hands and capsules are measured on
  // the character itself; before, a male figure got the body afterwards and stood on the hidden mannequin's feet)
  const f = F.figure({ role: 'extra', body: 'custom:' + id, height: C.height, name: 'sheet', parent: stage });
  const body = f.custom; if (!body) throw new Error('the character could not be put on a figure');
  const fig = figureSkin(f.root); f.root.updateMatrixWorld(true);
  const cam = new THREE.PerspectiveCamera(30, tw / th, .05, 50), H = C.height;
  const views = [['front', new THREE.Vector3(0, H * .56, H * 2.55)], ['side', new THREE.Vector3(H * 2.55, H * .56, 0)]];
  const sheet = document.createElement('canvas'); sheet.width = tw * cols; sheet.height = th * 2 + 28; const sx = sheet.getContext('2d');
  sx.fillStyle = '#20242a'; sx.fillRect(0, 0, sheet.width, sheet.height); sx.font = '600 15px system-ui, sans-serif';
  const warnings = [], checks = { poses: {}, fit: body.fit };
  for (const [n, a] of Object.entries(body.fit)) if (a > 100) warnings.push(`${n}: their bone had to turn ${Math.round(a)} degrees to match ours (a wrong bone in the mapping?)`);
  // own proportions: every segment as long as in the file, the file's own bind pose reproduced through the skeleton
  const pc = proportionCheck(f); checks.proportions = pc;
  if (pc && !pc.ok) warnings.push(`proportions: not the file's own (${pc.worst.pair} ${Math.round(pc.worst.ratio * 100)} % of its length, the bind pose off by up to ${pc.bindError.max} mm)`);
  // vertices: their dominant bone's mapped bone (for the checks)
  const meshes = body.meshes, vsamp = [];
  for (const m of meshes) { const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight, n = m.geometry.attributes.position.count, step = Math.max(1, Math.floor(n / 4000));
    for (let i = 0; i < n; i += step) { let b = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; b = si.getComponent(i, k); } } vsamp.push([m, i, m.skeleton.bones[b]?.name]); } }
  const W = b => b.getWorldPosition(new THREE.Vector3()), bone = n => fig.skeleton.bones.find(b => b.name === n);
  const measure = () => {
    f.root.updateMatrixWorld(true); for (const m of meshes) m.skeleton.update();
    const bb = new THREE.Box3(); for (const b of fig.skeleton.bones) if (!/leaf/.test(b.name)) bb.expandByPoint(W(b)); bb.expandByScalar(H * .3);
    const v = new THREE.Vector3(), cent = {}, out = []; let outside = 0;
    for (const [m, i, bn] of vsamp) { v.fromBufferAttribute(m.geometry.attributes.position, i); m.applyBoneTransform(i, v); v.applyMatrix4(m.matrixWorld);
      if (!bb.containsPoint(v)) { outside++; if (out.length < 3) out.push(bn); }
      (cent[bn] ??= { s: new THREE.Vector3(), n: 0 }).s.add(v); cent[bn].n++; }
    const c = n => cent[n]?.n ? cent[n].s.clone().divideScalar(cent[n].n) : null;
    const twisted = [];
    for (const [a, b] of LIMBS) { const ca = c(a), cb = c(b), A = bone(a), B = bone(b); if (!ca || !cb || !A || !B) continue;
      const dm = cb.clone().sub(ca), db = W(B).sub(W(A)); if (dm.lengthSq() < 1e-8 || db.lengthSq() < 1e-8) continue;
      const ang = dm.angleTo(db) * 180 / Math.PI; if (ang > 90) twisted.push(`${a} ${Math.round(ang)}°`); }
    const hands = []; for (const s of ['l', 'r']) { const ch = c('hand_' + s), hb = bone('hand_' + s); if (ch && hb && ch.distanceTo(W(hb)) > H * .14) hands.push(`hand_${s} ${(ch.distanceTo(W(hb)) * 100).toFixed(0)} cm from the wrist`); }
    return { outsidePct: +(100 * outside / Math.max(1, vsamp.length)).toFixed(2), outsideNear: [...new Set(out)], twisted, hands };
  };
  const thumbC = document.createElement('canvas'); thumbC.width = 160; thumbC.height = 200;
  for (const [ci, [label, act]] of SHEET_POSES.entries()) {
    setFurniture(act);
    if (act) f.act(act, { t: act === 'walk' ? .25 : act === 'point' ? .8 : 1.2 }); else restPose(fig);
    const m = measure(); checks.poses[label] = m;
    if (m.outsidePct > .5) warnings.push(`${label}: ${m.outsidePct}% of the mesh is far outside the skeleton (near ${m.outsideNear.join(', ') || '?'}): the mesh explodes`);
    if (m.twisted.length) warnings.push(`${label}: twisted limbs (${m.twisted.join(', ')})`);
    if (m.hands.length) warnings.push(`${label}: hands far from where they should be (${m.hands.join(', ')})`);
    for (const [ri, [vn, pos]] of views.entries()) {
      cam.position.copy(pos); cam.lookAt(0, H * (act === 'sit' || act === 'typing' ? .4 : .5), 0); cam.updateMatrixWorld(true);
      R.render(scene, cam); sx.drawImage(canvas, ci * tw, 28 + ri * th);
      if (ci === 1 && ri === 0) thumbC.getContext('2d').drawImage(canvas, (tw - th * 160 / 200) / 2, 0, th * 160 / 200, th, 0, 0, 160, 200);
    }
    sx.fillStyle = '#e8ebef'; sx.fillText(label, ci * tw + 10, 19);
  }
  sx.fillStyle = 'rgba(232,235,239,.55)'; sx.font = '12px system-ui, sans-serif'; sx.fillText('front', 6, 28 + 16); sx.fillText('side', 6, 28 + th + 16);
  const out = { sheet: sheet.toDataURL('image/png'), thumb: thumbC.toDataURL('image/png'), warnings: [...new Set(warnings)], checks };
  f.root.parent?.remove(f.root); R.dispose(); R.forceContextLoss?.();
  return out;
}
