// People and animals: library rigs (one shared skeleton for every human body), library mocap clips fitted with the
// library's prepareClip (feet on the floor at any leg length), outfits painted per body region, drawn faces on a mask
// that follows the head, hair from the library, hats/glasses/ties built here, props held in the hand, sitting, walking
// along a path at the clip's own speed (feet don't slide), head turns. Every pose is a pure function of time.
import { THREE, clamp, lerp, seg, E, rnd, noise1, MOODY } from './core.js';
import { model, gltf, find, clip as libClip, entry } from './assets.js';
import { prepareClip, attachToSkeleton, pelvisRest } from '../__lib/tools/anim-runtime.js';
import { drawFace } from './faces.js';
import { resolveCast } from './cast.js';
import { cutHead, buildHead, hairCap, drawBeard, wornOnHead, intrusion } from './head.js';

// ---------- bodies, skins, outfits ----------
const BODY = { m: 'char.base_m_grey', man: 'char.base_m_grey', male: 'char.base_m_grey', f: 'char.base_f_grey', woman: 'char.base_f_grey', female: 'char.base_f_grey',
  mannequin: 'char.mannequin_m', mannequin_m: 'char.mannequin_m', mannequin_f: 'char.mannequin_f' };
export const SKIN = { pale: '#f3d2bc', light: '#e8b996', medium: '#c99472', tan: '#b07a55', brown: '#8a5638', dark: '#5c3824', deep: '#3f2618' };
// region ids baked per triangle (see regionGeometry)
const R = { skin: 0, hands: 1, vee: 2, tie: 3, torso: 4, upperarm: 5, forearm: 6, hips: 7, thigh: 8, calf: 9, feet: 10 };
const NREG = 11;
// outfit presets: region colours (null = skin). top: torso + upper arms (+forearms when long), bottom: hips/thighs/calves
export const OUTFITS = {
  casual: { top: '#3d6fb0', sleeves: 'short', bottom: '#2f4468', shoes: '#e8e8e8' },
  tee: { top: '#d9d9d9', sleeves: 'short', bottom: '#33465f', shoes: '#2a2a2a' },
  everyman: { jacket: '#7a3524', shirt: '#26262a', open: true, bottom: '#3a5684', shoes: '#141414' },     // leather jacket, black tee, jeans
  suit: { jacket: '#22252b', shirt: '#f2f2f2', tie: '#8c1c1c', bottom: '#22252b', shoes: '#111111' },
  guard: { jacket: '#111215', shirt: '#f2f2f2', tie: '#111215', bottom: '#111215', shoes: '#0b0b0b', glasses: 'shades' },
  business: { top: '#e9eef5', sleeves: 'long', tie: '#1f3d7a', bottom: '#3b3f46', shoes: '#2b1d14' },
  dealer: { vest: '#a3241c', shirt: '#f4f4f0', bottom: '#151515', shoes: '#0f0f0f', bowtie: '#151515' },
  doctor: { coat: '#f4f6f8', shirt: '#9fc3e6', tie: '#33507a', bottom: '#3a3f4a', shoes: '#222' },
  scrubs: { top: '#3f8fd0', sleeves: 'short', bottom: '#3f8fd0', shoes: '#f0f0f0' },
  nurse: { top: '#58b7b0', sleeves: 'short', bottom: '#58b7b0', shoes: '#f0f0f0' },
  police: { top: '#22324f', sleeves: 'long', tie: '#111a2b', bottom: '#1a2338', shoes: '#0d0d0d', hat: 'police' },
  prisoner: { top: '#f07a1a', sleeves: 'short', bottom: '#f07a1a', shoes: '#f0f0f0' },
  worker: { vest: '#e8e21a', shirt: '#6d7480', bottom: '#3c4a5c', shoes: '#4a3424', hat: 'hardhat' },
  hoodie: { top: '#5a5f68', sleeves: 'long', bottom: '#2b3240', shoes: '#efefef' },
  sweater: { top: '#7b8fa6', sleeves: 'long', bottom: '#3a3226', shoes: '#2a2018' },
  labcoat: { coat: '#f4f6f8', shirt: '#8aa6c8', bottom: '#2f3540', shoes: '#1e1e1e' },
  judge: { coat: '#141414', shirt: '#141414', bottom: '#141414', shoes: '#0d0d0d' },
  soldier: { top: '#5b6b3c', sleeves: 'long', bottom: '#56653a', shoes: '#2a2216', hat: 'helmet' },
  chef: { top: '#f2f2f2', sleeves: 'long', bottom: '#2a2a2a', shoes: '#111' },
  swim: { bottom: '#2a5bd8', shorts: true, shoes: null },
  none: {},
};
// 'random' outfits for crowds: palettes of plausible clothes
const TOPS = ['#3d6fb0', '#b03a3a', '#e0e0e0', '#2b2b2b', '#5a7a3a', '#c9a227', '#7a4a8c', '#d0743c', '#486b78', '#9aa3ad'], BOTTOMS = ['#2f4468', '#232323', '#4a3b2a', '#5d6670', '#3a5684', '#1b2a3c'];
export function randomOutfit(seed) { const r = rnd(seed); const k = r(); const top = TOPS[Math.floor(r() * TOPS.length)], bottom = BOTTOMS[Math.floor(r() * BOTTOMS.length)];
  return k < .2 ? { jacket: TOPS[Math.floor(r() * TOPS.length)], shirt: '#ececec', bottom, shoes: '#222' } : { top, sleeves: r() < .5 ? 'short' : 'long', bottom, shoes: r() < .5 ? '#eeeeee' : '#262626' }; }

// region per triangle from the bind pose: which bone drives it most + where it is (front strip = shirt under a jacket)
const REGION_CACHE = new Map();
// Builds: the male base body is a "superhero" (huge lats, pecs, arms): the references use normal stock-game proportions.
// Every bone's flesh is scaled toward the bone (perpendicular to it) by a factor; skin weights blend the factors, so the
// surface stays continuous at the joints. Spine / pelvis / neck: toward their vertical axis (x, front z, back z separately).
// 'athletic' = the file as it is. Female bodies get half the change (they are not over-built).
export const BUILDS = {
  normal: { spine_03: [.8, .7, .88], spine_02: [.82, .74, .9], spine_01: [.88, .82, .94], pelvis: [.95, .93, .96], neck_01: .88, clavicle: .8, upperarm: .64, lowerarm: .8, thigh: .86, calf: .9 },
  slim: { spine_03: [.74, .64, .84], spine_02: [.76, .68, .86], spine_01: [.82, .76, .9], pelvis: [.9, .88, .92], neck_01: .84, clavicle: .74, upperarm: .56, lowerarm: .74, thigh: .8, calf: .86 },
  heavy: { spine_03: [.95, 1.0, .98], spine_02: [1.04, 1.28, 1.0], spine_01: [1.1, 1.34, 1.02], pelvis: [1.08, 1.12, 1.06], neck_01: 1.0, clavicle: .95, upperarm: .86, lowerarm: .92, thigh: 1.02, calf: 1.0 },
  athletic: null,
};
function buildDeform(actor, mesh, build) {
  let B = typeof build === 'object' ? build : BUILDS[build ?? 'normal']; if (!B || /mannequin/.test(actor.libId)) return null;
  const half = /_f_/.test(actor.libId) ? .5 : 1, inv = new THREE.Matrix4().copy(actor.rig.matrixWorld).invert();
  const P = b => new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).applyMatrix4(inv).multiplyScalar(1 / actor.scale);
  const per = mesh.skeleton.bones.map(b => {
    const key = b.name.replace(/_[lr]$/, ''), f = B[b.name] ?? B[key]; if (f == null) return null;
    const fs = (Array.isArray(f) ? f : [f, f, f]).map(x => 1 + (x - 1) * half), a = P(b);
    if (/^(spine|pelvis|neck)/.test(b.name)) return { vert: true, a, fs };
    const kids = b.children.filter(c => c.isBone); if (!kids.length) return null;
    const bb = kids.map(P).sort((p, q) => q.distanceTo(a) - p.distanceTo(a))[0];
    return { vert: false, a, b: bb, fs };
  });
  return { key: JSON.stringify(B) + half, per };
}
function regionGeometry(mesh, charSpace, L, deform) {
  const key = mesh.geometry.uuid + (deform ? '|' + deform.key : '');
  if (REGION_CACHE.has(key)) return REGION_CACHE.get(key);
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const pos = src.attributes.position, n = pos.count, reg = new Float32Array(n), bind = new Float32Array(n * 3), v = new THREE.Vector3(), c = new THREE.Vector3();
  if (deform && src.attributes.skinIndex) {                      // the build: flesh pulled toward / pushed from the bones
    const si = src.attributes.skinIndex, sw = src.attributes.skinWeight, toLocal = charSpace.clone().invert(), d = new THREE.Vector3(), off = new THREE.Vector3(), ab = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(charSpace); d.set(0, 0, 0);
      for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j), s = deform.per[si.getComponent(i, j)]; if (!s || w <= 0) continue;
        if (s.vert) { off.set(v.x - s.a.x, 0, v.z - s.a.z); d.x += w * (s.fs[0] - 1) * off.x; d.z += w * ((off.z > 0 ? s.fs[1] : s.fs[2]) - 1) * off.z; }
        else { ab.subVectors(s.b, s.a); const k = clamp(off.subVectors(v, s.a).dot(ab) / ab.lengthSq()); off.copy(v).sub(s.a.clone().addScaledVector(ab, k)); d.addScaledVector(off, w * (s.fs[0] - 1)); } }
      v.add(d).applyMatrix4(toLocal); pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
  }
  const orig = deform ? mesh.geometry.index ? mesh.geometry.toNonIndexed().attributes.position : mesh.geometry.attributes.position : pos;   // clothes are cut on the file's own shape
  // T-pose landmarks (character space, metres): clean straight borders between the regions, like painted game clothes
  for (let t = 0; t < n; t += 3) {
    c.set(0, 0, 0); for (let k = 0; k < 3; k++) { v.fromBufferAttribute(orig, t + k).applyMatrix4(charSpace); c.add(v); bind.set([v.x, v.y, v.z], (t + k) * 3); } c.multiplyScalar(1 / 3);
    const ax = Math.abs(c.x), y = c.y, front = c.z > .015;
    let r;
    if (ax >= L.wristX - .015 && y > L.hipY + .2) r = R.hands;
    else if (ax >= L.elbowX && y > L.hipY + .2) r = R.forearm;
    else if (ax >= L.shoulderX + .035 && y > L.hipY + .25) r = R.upperarm;
    else if (y >= L.neckY + .035) r = R.skin;
    else if (y >= L.hipY + .09) {
      const top = L.neckY + .03, k = clamp((y - (L.hipY + .25)) / (top - (L.hipY + .25)));
      r = front && ax < .021 && y > L.hipY + .17 && y < L.neckY - .005 ? R.tie : front && ax < .02 + .07 * k && y > L.hipY + .25 ? R.vee : R.torso;
    }
    else if (y >= L.hipY - .1) r = R.hips;
    else if (y >= L.kneeY) r = R.thigh;
    else if (y >= L.ankleY + .035) r = R.calf;
    else r = R.feet;
    reg[t] = reg[t + 1] = reg[t + 2] = r;
  }
  src.setAttribute('region', new THREE.BufferAttribute(reg, 1));
  src.setAttribute('bind', new THREE.BufferAttribute(bind, 3));      // bind-pose position (character space): the shader cuts the clothes per pixel
  if (src.attributes.normal) src.setAttribute('clothN', clothNormals(src.attributes.normal, bind, n));
  src.userData.landmarks = L;
  REGION_CACHE.set(key, src);
  return src;
}
// Cloth normals: the body's normals blurred over ~9 cm (same-facing neighbours only, so an arm doesn't cancel itself out).
// Clothes are shaded with these and pushed out along them: a shirt drapes over the chest instead of showing the base
// body's sculpted pecs and abs (the bodies are Quaternius "Superhero" scans in underwear).
function clothNormals(nrm, bind, n) {
  const R2 = .09 * .09, cs = .09, grid = new Map(), key = (x, y, z) => x + ',' + y + ',' + z, out = new Float32Array(n * 3);
  const cell = i => [Math.floor(bind[i * 3] / cs), Math.floor(bind[i * 3 + 1] / cs), Math.floor(bind[i * 3 + 2] / cs)];
  // unique positions only (the geometry is non-indexed: every vertex is there ~6 times)
  const uniq = new Map(), rep = new Int32Array(n), U = [];
  for (let i = 0; i < n; i++) { const k = bind[i * 3].toFixed(4) + bind[i * 3 + 1].toFixed(4) + bind[i * 3 + 2].toFixed(4); let u = uniq.get(k);
    if (u == null) { u = U.length; uniq.set(k, u); U.push({ i, nx: 0, ny: 0, nz: 0 }); } rep[i] = u; const q = U[u]; q.nx += nrm.getX(i); q.ny += nrm.getY(i); q.nz += nrm.getZ(i); }
  for (const q of U) { const l = Math.hypot(q.nx, q.ny, q.nz) || 1; q.nx /= l; q.ny /= l; q.nz /= l; const c = cell(q.i), k = key(...c); (grid.get(k) || grid.set(k, []).get(k)).push(q); }
  const sm = U.map(q => { const c = cell(q.i), px = bind[q.i * 3], py = bind[q.i * 3 + 1], pz = bind[q.i * 3 + 2]; let x = 0, y = 0, z = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) for (const o of grid.get(key(c[0] + a, c[1] + b, c[2] + d)) || []) {
      const dx = bind[o.i * 3] - px, dy = bind[o.i * 3 + 1] - py, dz = bind[o.i * 3 + 2] - pz, d2 = dx * dx + dy * dy + dz * dz; if (d2 > R2) continue;
      const w = (q.nx * o.nx + q.ny * o.ny + q.nz * o.nz); if (w <= .05) continue; const ww = w * (1 - d2 / R2); x += o.nx * ww; y += o.ny * ww; z += o.nz * ww; }
    const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; });
  for (let i = 0; i < n; i++) out.set(sm[rep[i]], i * 3);
  return new THREE.BufferAttribute(out, 3);
}
// the outfit as one colour (+ cloth flag) per region
function outfitColors(o, skin) {
  const cols = new Array(NREG).fill(null);                       // null = skin
  const set = (rs, col) => { if (col) for (const r of rs) cols[r] = col; };
  const top = o.top, long = o.sleeves === 'long';
  if (top) { set([R.torso, R.vee, R.tie], top); set([R.upperarm], top); if (long) set([R.forearm], top); }
  if (o.shirt) { set([R.torso, R.vee, R.tie, R.upperarm, R.forearm], o.shirt); }
  if (o.jacket) { set([R.torso, R.upperarm, R.forearm], o.jacket); }
  if (o.vest) { set([R.torso], o.vest); }
  if (o.coat) { set([R.torso, R.upperarm, R.forearm, R.hips, R.thigh], o.coat); }
  if (o.tie) set([R.tie], o.tie);
  if (o.bottom) { set([R.hips], o.coat ? o.coat : o.bottom); if (!o.coat) set([R.thigh], o.bottom); if (!o.shorts) set([R.calf], o.bottom); if (o.coat) set([R.calf], o.bottom); }
  if (o.shoes !== null) set([R.feet], o.shoes || (o.bottom ? '#1c1c1c' : null));
  if (o.gloves) set([R.hands], o.gloves);
  return cols;
}
const MASK_BIAS = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 };
// body material: the skin texture tinted by skin tone, clothes painted per region (texture luminance kept as folds)
// The clothes are cut per pixel from the bind-pose position (the same landmark rules as regionGeometry, which per triangle
// gave ragged collars, V-necks and sleeve ends on close-ups)
const REGION_GLSL = `
  int lpRegion(vec3 c) {
    float ax = abs(c.x), y = c.y; bool front = c.z > .015;
    float shX = uLa.x, elX = uLa.y, wrX = uLa.z, nkY = uLa.w, hpY = uLb.x, knY = uLb.y, anY = uLb.z;
    if (ax >= wrX - .015 && y > hpY + .2) return 1;
    if (ax >= elX && y > hpY + .2) return 6;
    if (ax >= shX + .035 && y > hpY + .25) return 5;
    if (y >= nkY + .035) return 0;
    if (y >= hpY + .09) { float top = nkY + .03, k = clamp((y - (hpY + .25)) / (top - (hpY + .25)), 0., 1.);
      float opn = uLb.w - 1.;                                   // an open jacket: a straight opening (the tee shows)
      if (opn > .001) { if (front && ax < opn * (.85 + .3 * k) && y > hpY + .1) return 2; return 4; }
      if (front && ax < .021 && y > hpY + .17 && y < nkY - .005) return 3;
      if (front && ax < .02 + .07 * k && y > hpY + .25) return 2;
      return 4; }
    if (y >= hpY - .1) return 7;
    if (y >= knY) return 8;
    if (y >= anY + .035) return 9;
    return 10;
  }`;
function bodyMaterial(src, cols, skin, isMannequin, L, open = 0, puff = 0) {
  const m = src.clone(); m.vertexColors = false;            // (COLOR_0 of the base bodies is a mask, not a colour)
  const U = { uSkin: { value: new THREE.Color(skin) }, uCols: { value: Array.from({ length: NREG }, (_, i) => new THREE.Vector4(...(cols[i] ? [...new THREE.Color(cols[i]).toArray(), 1] : [0, 0, 0, 0]))) }, uMann: { value: isMannequin ? 1 : 0 },
    uLa: { value: new THREE.Vector4(L?.shoulderX ?? .17, L?.elbowX ?? .45, L?.wristX ?? .7, L?.neckY ?? 1.48) }, uLb: { value: new THREE.Vector4(L?.hipY ?? .95, L?.kneeY ?? .5, L?.ankleY ?? .08, L ? 1 + open : 0) }, uPuff: { value: puff } };
  m.userData.U = U;
  if (isMannequin) m.color = new THREE.Color(1, 1, 1);
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nattribute float region; varying float vRegion; attribute vec3 bind; varying vec3 vBind; attribute vec3 clothN; uniform vec4 uCols[${NREG}]; uniform vec4 uLa; uniform vec4 uLb; uniform float uPuff;\n${REGION_GLSL}`).replace('#include <uv_vertex>', '#include <uv_vertex>\nvRegion = region; vBind = bind;')
      // clothes: shaded with the blurred cloth normals and pushed out a little (no sculpted muscles under a shirt)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n float lpCloth = 0.; { int rv = uLb.w > .5 ? lpRegion(bind) : int(region + .5); for (int i = 0; i < ${NREG}; i++) if (i == rv) lpCloth = uCols[i].a; }\n objectNormal = normalize(mix(objectNormal, clothN, lpCloth));`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += clothN * uPuff * lpCloth;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying float vRegion; varying vec3 vBind; uniform vec3 uSkin; uniform vec4 uCols[${NREG}]; uniform float uMann; uniform vec4 uLa; uniform vec4 uLb;\n${REGION_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        { int ri = uLb.w > .5 ? lpRegion(vBind) : int(vRegion + .5); vec4 cl = uCols[0];
          for (int i = 0; i < ${NREG}; i++) if (i == ri) cl = uCols[i];
          float L = dot(diffuseColor.rgb, vec3(.299, .587, .114));
          vec3 skin = uMann > .5 ? uSkin * (.82 + .25 * L) : uSkin * clamp(.5 + 1.75 * L, .3, 1.5);
          vec3 cloth = cl.rgb * (uMann > .5 ? 1. : (.97 + .06 * L));      // flat game cloth: the texture's painted muscles must not show
          diffuseColor.rgb = mix(skin, cloth, cl.a); }`);
  };
  m.customProgramCacheKey = () => 'lpbody3' + NREG;
  return m;
}

// ---------- clips ----------
const PREP = new Map();     // fitted clips per body root (pelvis rest differs per body)
const REBIND = new Map();   // attachments re-bound per body
function fitted(actor, name) {
  const k = actor.libId + '|' + name;
  if (PREP.has(k)) return PREP.get(k);
  const c = actor.animal ? actor.animations.find(a => a.name === name) || actor.animations.find(a => a.name.toLowerCase().includes(name.toLowerCase())) : prepareClip(THREE, libClip(name), actor.rig);
  if (!c) throw new Error(`${actor.name}: no clip "${name}" (this animal has: ${actor.animations.map(a => a.name).join(', ')})`);
  PREP.set(k, c); return c;
}
const LOOPS = /_Loop$|^(Walk|Run|Gallop|Idle|Swim|Eating|Fly|Flying)\b|Loop/i;
const SPEED = new Map();
/** Ground speed of an in-place locomotion clip on this body (m/s at timeScale 1), measured from the planted foot. */
export function clipSpeed(actor, name) { return clipGait(actor, name).v; }
/** The clip's gait: mean ground speed v and the distance travelled over one cycle as a curve of clip time (cum[i] at
 *  i * D / N, metres at this body's scale). The planted foot (the lowest heel / ball within 1.5 cm of the floor) gives the
 *  speed at each moment: clips are not even (Crouch_Fwd_Loop's left stance is 27% slower than its right), so a constant
 *  speed slid the planted foot 5-8 cm per step. walk() follows this curve: the body moves as fast as the foot pushes. */
export function clipGait(actor, name) {
  const k = actor.libId + '|' + name + '|' + actor.scale.toFixed(3);
  if (SPEED.has(k)) return SPEED.get(k);
  const c = fitted(actor, name), D = c.duration || 1, N = 120, dt = D / N;
  const names = ['ball_l', 'ball_r', 'foot_l', 'foot_r'], bones = actor.animal ? [] : names.map(n => actor.rig.getObjectByName(n));
  let g;
  if (bones[0] && bones[1]) {
    const mixer = new THREE.AnimationMixer(actor.rig), a = mixer.clipAction(c); a.play();
    const inv = new THREE.Matrix4(), p = new THREE.Vector3(), S = [];
    for (let i = 0; i <= N; i++) {
      a.time = Math.min(i * dt, D - 1e-4); mixer.update(0); actor.rig.updateMatrixWorld(true); inv.copy(actor.rig.matrixWorld).invert();
      S.push(bones.map((b, j) => { if (!b) return null; p.setFromMatrixPosition(b.matrixWorld).applyMatrix4(inv); return { h: p.y - (actor._rest[names[j]] ?? 0), z: p.z }; }));
    }
    mixer.stopAllAction(); mixer.uncacheRoot(actor.rig);
    const floor = Math.min(...S.flat().filter(Boolean).map(q => q.h)), sp = new Array(N).fill(NaN);
    for (let i = 0; i < N; i++) {                          // the planted bone: the lowest one, on the floor in both samples
      let j = -1, lo = 1e9; S[i].forEach((q, n) => { if (q && q.h < lo) { lo = q.h; j = n; } });
      if (j >= 0 && S[i][j].h < floor + .015 && S[i + 1][j].h < floor + .015) sp[i] = (S[i][j].z - S[i + 1][j].z) / dt;
    }
    const ok = sp.filter(x => isFinite(x) && x > 0), mean = ok.length ? ok.reduce((x, y) => x + y, 0) / ok.length : 0;
    const raw = sp.map(x => isFinite(x) && x > 0 ? Math.min(x, mean * 2.2) : mean), cur = raw.map((_, i) => { let s2 = 0; for (let q = -3; q <= 3; q++) s2 += raw[(i + q + N) % N]; return s2 / 7; });
    const cum = new Float64Array(N + 1); for (let i = 0; i < N; i++) cum[i + 1] = cum[i] + cur[i] * dt * actor.scale;
    g = { v: cum[N] / D, D, N, cum };
  } else { const v = /run|gallop|sprint|jog/i.test(name) ? 4 : /walk/i.test(name) ? 1.2 : 0; g = { v, D, N: 1, cum: new Float64Array([0, v * D]) }; }
  SPEED.set(k, g); return g;
}
/** distance the gait covers in `tau` clip seconds */
function gaitAt(g, tau) { const cyc = Math.floor(tau / g.D), f = (tau - cyc * g.D) / g.D * g.N, i = Math.min(g.N - 1, Math.floor(f)); return cyc * g.cum[g.N] + g.cum[i] + (g.cum[i + 1] - g.cum[i]) * (f - i); }

/** metres walked el seconds after a walk starts: the clip's own gait curve (the planted foot stays put), eased in over the blend */
function walkDist(m, el) {
  if (el <= 0) return 0; const f = m.fade || 0;
  if (m.t1 != null && el > m.t1) { const x = Math.min(el - m.t1, m.fe); return m.d1 + (m.fe > 0 ? m.v * (x - x * x / (2 * m.fe)) : 0); }
  if (!m.gait) return m.v * (el < f ? el * el / (2 * f) : el - f / 2);
  if (el < f) return m.v * el * el / (2 * f);
  return m.v * f / 2 + gaitAt(m.gait, el * m.ts) - gaitAt(m.gait, f * m.ts);
}
/** least-squares z = c0 + c1 x + c2 x^2 + c3 y + c4 y^2 + c5 x y over the face points: the smooth front of the head */
function fitFace(P) {
  const row = p => [1, p.x, p.x * p.x, p.y, p.y * p.y, p.x * p.y], A = Array.from({ length: 6 }, () => new Array(7).fill(0));
  for (const p of P) { const r = row(p); for (let i = 0; i < 6; i++) { for (let j = 0; j < 6; j++) A[i][j] += r[i] * r[j]; A[i][6] += r[i] * p.z; } }
  for (let i = 0; i < 6; i++) A[i][i] += 1e-6;
  for (let c = 0; c < 6; c++) { let m = c; for (let r = c + 1; r < 6; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r; [A[c], A[m]] = [A[m], A[c]];
    for (let r = 0; r < 6; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 7; k++) A[r][k] -= f * A[c][k]; } }
  const k = A.map((r, i) => r[6] / r[i]);
  return { z: (x, y) => k[0] + k[1] * x + k[2] * x * x + k[3] * y + k[4] * y * y + k[5] * x * y,
    n: (x, y) => new THREE.Vector3(-(k[1] + 2 * k[2] * x + k[5] * y), Math.max(-.15, -(k[3] + 2 * k[4] * y + k[5] * x)), 1).normalize() };   // (a chin turned to the floor went black under Moody's top key)
}
/** v (0..1 of the face box) of the skin texture's painted lips: the reddest band under the eyes near the middle */
function findLips(mat, uv, front, x0, x1, y0, y1, eyeV) {
  const img = mat.map?.image; if (!img || !uv) return null; faceLuminance(mat, uv, []); const cache = FACE_L.get(img); if (!cache) return null;
  const S = [];
  for (const k of front) for (let j = 0; j < 3; j++) { const p = k.pts[j], fu = (p.x - x0) / (x1 - x0), fv = (p.y - y0) / (y1 - y0); if (Math.abs(fu - .5) > .12 || fv > eyeV - .12) continue;
    let u = uv.getX(k.t + j), v = uv.getY(k.t + j); u -= Math.floor(u); v -= Math.floor(v); if (mat.map.flipY) v = 1 - v;
    const i = (Math.min(cache.c.height - 1, Math.floor(v * cache.c.height)) * cache.c.width + Math.min(cache.c.width - 1, Math.floor(u * cache.c.width))) * 4;
    S.push({ fv, red: cache.d[i] - (cache.d[i + 1] + cache.d[i + 2]) / 2 }); }
  if (S.length < 6) return null;
  const m = S.reduce((a, b) => a + b.red, 0) / S.length; let w = 0, sv = 0;
  for (const q of S) { const d = q.red - m; if (d > 0) { w += d * d; sv += d * d * q.fv; } }
  return w > 0 ? sv / w : null;
}
const FACE_L = new WeakMap();
/** mean linear luminance of the body texture under the face triangles (0 = no texture: keep it as it is) */
function faceLuminance(mat, uv, front) {
  const img = mat.map?.image; if (!img || !uv || !img.width) return 0;
  let cache = FACE_L.get(img); if (!cache) { const c = document.createElement('canvas'); c.width = Math.min(512, img.width); c.height = Math.min(512, img.height);
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, c.width, c.height); cache = { c, d: x.getImageData(0, 0, c.width, c.height).data }; FACE_L.set(img, cache); }
  const lin = v => Math.pow(v / 255, 2.2), col = mat.color || { r: 1, g: 1, b: 1 }; let sum = 0, n = 0;
  for (const k of front) for (let j = 0; j < 3; j++) { let u = uv.getX(k.t + j), v = uv.getY(k.t + j); u -= Math.floor(u); v -= Math.floor(v); if (mat.map.flipY) v = 1 - v;
    const px = Math.min(cache.c.width - 1, Math.floor(u * cache.c.width)), py = Math.min(cache.c.height - 1, Math.floor(v * cache.c.height)), i = (py * cache.c.width + px) * 4;
    sum += .299 * lin(cache.d[i]) * col.r + .587 * lin(cache.d[i + 1]) * col.g + .114 * lin(cache.d[i + 2]) * col.b; n++; }
  return n ? sum / n : 0;
}
let ACTOR_ID = 0;
/** A person: person({ body: 'm'|'f'|'mannequin'|id, skin, outfit, hair, hairColor, beard, face, glasses, hat, height, name }) */
export function person(o = {}) { return new Actor(resolveCast(o), false); }   // o.character / o.role: the roster (lib/cast.js, the app's Characters picker)
/** An animal from the library with its own clips: animal('cow', { clip: 'Walk' }) */
export function animal(ref, o = {}) { return new Actor({ ...o, body: ref }, true); }

export class Actor {
  constructor(o, isAnimal) {
    this.o = o; this.id = ++ACTOR_ID; this.animal = isAnimal; this.name = o.name || null;
    const bodyRef = isAnimal ? o.body : (BODY[o.body] || o.body || (o.gender === 'f' ? BODY.f : BODY.m));
    const e = find(bodyRef, isAnimal ? 'animal' : 'character'); this.libId = e.id; this.entry = e;
    this.root = new THREE.Group(); this.root.name = this.name || (isAnimal ? e.name : 'person'); this.root.userData.kind = isAnimal ? 'animal' : 'person'; this.root.userData.pickRoot = true; this.root.userData.actor = this;
    const m = model(e.id); this.rig = m.children[0]; this.root.add(this.rig); this.animations = m.userData.animations || [];
    this.scale = o.height ? o.height / (e.size_m?.[1] || 1.8) : (o.scale ?? 1);
    if (isAnimal && o.size) { const b = new THREE.Box3().setFromObject(this.rig), s = b.getSize(new THREE.Vector3()); this.scale = o.size / Math.max(s.x, s.y, s.z); }
    this.rig.scale.multiplyScalar(this.scale);
    this.meshes = []; this.rig.traverse(x => { if (x.isSkinnedMesh) this.meshes.push(x); if (x.isMesh) { x.castShadow = true; x.receiveShadow = !MOODY; } });
    this.bones = {}; this.rig.traverse(x => { if (x.isBone) this.bones[x.name] = x; });
    if (!isAnimal) pelvisRest(this.rig);
    this.rig.updateMatrixWorld(true); this._rest = {};                  // foot bones above the sole at the bind pose (feet check)
    for (const n of ['foot_l', 'foot_r', 'ball_l', 'ball_r']) if (this.bones[n]) this._rest[n] = new THREE.Vector3().setFromMatrixPosition(this.bones[n].matrixWorld).y / this.scale;
    this.mixer = new THREE.AnimationMixer(this.rig);
    this.plan = []; this.moves = []; this.looks = []; this.faces = []; this.holds = []; this.place = { p: new THREE.Vector3(...(o.at || [0, 0, 0])), ry: o.ry ?? 0 };
    this.root.position.copy(this.place.p); this.root.rotation.y = this.place.ry;
    if (!isAnimal) this.dress(o);
    this.do(o.clip || (isAnimal ? (this.animations.find(a => /idle/i.test(a.name))?.name || this.animations[0]?.name) : 'Idle_Loop'), -100, { fade: 0, phase: o.phase ?? (this.id * .37) % 1 });
  }
  // ---- looks ----
  dress(o) {
    const isMann = /mannequin/.test(this.libId), skin = SKIN[o.skin] || o.skin || (isMann ? (/_f/.test(this.libId) ? '#9a6ad0' : '#e0952a') : SKIN.light);
    const outfit = typeof o.outfit === 'object' ? o.outfit : OUTFITS[o.outfit ?? (isMann ? 'none' : 'casual')] || OUTFITS.casual;
    this.outfit = outfit; this.skinColor = skin;
    this.rig.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.rig.matrixWorld).invert();
    // hide the modelled eyes and lashes of the base bodies: the drawn face replaces them
    let body = null;
    for (const mesh of this.meshes) {
      const mn = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material)?.name || '';
      if (/Eyes|Hair/i.test(mn) && !/Superhero|Main|Joints/i.test(mn)) { mesh.visible = false; this.eyeMesh ??= /Eyes/i.test(mn) ? mesh : null; continue; }
      const toChar = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld).multiply(new THREE.Matrix4().makeScale(1 / this.scale, 1 / this.scale, 1 / this.scale));
      // (the rig was scaled already: char space here is the unscaled bind pose, metres, feet at 0)
      const sc = new THREE.Matrix4().makeScale(1 / this.scale, 1 / this.scale, 1 / this.scale).multiply(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
      mesh.geometry = regionGeometry(mesh, sc, this.landmarks(inv), buildDeform(this, mesh, o.build)); void toChar;
      mesh.material = bodyMaterial(mesh.material, outfitColors(outfit, skin), skin, isMann, mesh.geometry.userData.landmarks, outfit.open ? (outfit.open === true ? .055 : outfit.open) : 0, (outfit.puff ?? .012) / new THREE.Vector3().setFromMatrixScale(sc).x);
      if (!/Joints/i.test(mn) && (!body || mesh.geometry.attributes.position.count > body.geometry.attributes.position.count)) body = mesh;   // (the mannequin's joint balls mesh is bigger than its body: the face went on a neck ball)
    }
    this.body = body;
    // finger curl axes (bone-local), from the rest pose: across the hand, so a positive turn bends the finger toward the palm
    this.fingerAxes = {}; this.rig.updateMatrixWorld(true);
    for (const h of ['l', 'r']) { const hb = this.bones['hand_' + h], mid = this.bones['middle_01_' + h], th = this.bones['thumb_01_' + h]; if (!hb || !mid || !th) continue;
      const P = b => new THREE.Vector3().setFromMatrixPosition(b.matrixWorld), ph = P(hb), f = P(mid).sub(ph).normalize(), td = P(th).sub(ph); td.sub(f.clone().multiplyScalar(td.dot(f))).normalize();
      const nrm = new THREE.Vector3().crossVectors(f, td).normalize(); if (nrm.y > 0) nrm.negate();
      for (const fn of ['index', 'middle', 'ring', 'pinky', 'thumb']) for (let j = 1; j <= 3; j++) { const b = this.bones[`${fn}_0${j}_${h}`], c = this.bones[`${fn}_0${j + 1}_${h}`] || this.bones[`${fn}_04_leaf_${h}`]; if (!b || !c) continue;
        const dir = P(c).sub(P(b)).normalize(), ax = new THREE.Vector3().crossVectors(dir, fn === 'thumb' ? f : nrm).normalize(); if (fn === 'thumb') ax.negate();
        const qw = new THREE.Quaternion(); b.getWorldQuaternion(qw); this.fingerAxes[b.name] = ax.applyQuaternion(qw.invert()); } }
    if (o.head === 'stylised' && body) return this.stylisedHead(o, outfit, inv, isMann, skin);   // experimental, off: the user preferred the library head + face sheet (PITFALLS)
    if (o.face !== false && body) this.buildFace(o);
    const hairOf = h => !h || h === 'bald' || h === 'none' ? null : entry('char.hair_' + h) ? 'char.hair_' + h : h;
    const hair = o.hair === undefined ? (isMann ? null : /_f_/.test(this.libId) ? 'long' : 'simpleparted') : o.hair;
    for (const [ref, col] of [[hairOf(hair === 'parted' ? 'simpleparted' : hair), o.hairColor || '#3a2a1e'], [o.beard ? 'char.hair_beard' : null, o.beardColor || o.hairColor || '#3a2a1e'],
      [o.brows === false || isMann || (o.face !== false && o.brows !== 'mesh') ? null :      // the drawn face draws its own brows (they move with the expression): the mesh brows doubled them
       (/_f_/.test(this.libId) ? 'char.eyebrows_female' : 'char.eyebrows_regular'), o.hairColor || '#2a1e16']]) {
      if (!ref) continue;
      try { for (const mm of this.attach(ref)) { mm.material = mm.material.clone(); mm.material.color = new THREE.Color(col).multiplyScalar(1.6); mm.material.vertexColors = false; mm.castShadow = true; } }
      catch (err) { console.warn(err.message); }
    }
    const hat = o.hat ?? outfit.hat, glasses = o.glasses ?? outfit.glasses;
    if (hat) this.wear(hat, o.hatColor); if (glasses) this.wear(glasses === true ? 'glasses' : glasses); if (outfit.bowtie) this.wear('bowtie', outfit.bowtie);
    for (const x of this.meshes) x.frustumCulled = false;            // skinned bounds don't follow the animation
  }
  /** the clean stylised head (lib/head.js): the scanned head cut away, a rounded head bound to the Head bone, the face
   *  painted into its material, a hair cap, a painted beard, hats / glasses on the same skull. Opt-in only (o.head: 'stylised'):
   *  judged worse than the library head + face sheet by the user (docs/ps1-style/PITFALLS.md) */
  stylisedHead(o, outfit, inv, isMann, skin) {
    const toCharOf = mesh => new THREE.Matrix4().makeScale(1 / this.scale, 1 / this.scale, 1 / this.scale).multiply(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
    // skin tone of the head = the body's face skin as the body shader draws it (texture luminance under the old face)
    const tris = (() => { const m = this.body, g = m.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, hi = m.skeleton.bones.findIndex(b => b.name === 'Head'), out = [];
      if (hi < 0 || !si) return out; for (let t = 0; t < g.attributes.position.count; t += 3) { let w = 0; for (let j = 0; j < 4; j++) if (si.getComponent(t, j) === hi) w += sw.getComponent(t, j); if (w > .6) out.push({ t }); } return out; })();
    const L = faceLuminance(this.body.material, this.body.geometry.attributes.uv, tris);
    { const nb = this.bones.neck_01; if (nb) this.neckTop = new THREE.Vector3().setFromMatrixPosition(nb.matrixWorld).applyMatrix4(inv).y / this.scale; }
    const H = cutHead(this, toCharOf); if (!H) return;
    this.headDims = H;
    const tone = new THREE.Color(skin).multiplyScalar(isMann ? 1.02 : L > 0 ? clamp(.5 + 1.75 * L, .3, 1.5) : 1);
    const head = buildHead(this, H, tone, {});
    this.bindTo(head.group, this.bones.Head); head.group.traverse(m => { if (m.isMesh) m.userData.headPart = true; });
    this.faceCanvas = head.canvas; this.faceTex = head.tex; this.faceLayout = head.layout; this.faceMask = head.mesh; this.faceNow = null; this.headMesh = head.mesh;
    this.faceBox = { x0: H.c.x - H.rx, x1: H.c.x + H.rx, y0: H.c.y - H.ry, y1: H.c.y + H.ry };
    const female = /_f/.test(this.libId), hair = o.hair === undefined ? (isMann ? 'bald' : female ? 'long' : 'short') : o.hair;
    this.hairColor = o.hairColor || '#3a2a1e'; this.beard = o.beard ?? null;
    this.wornIssues = [];
    const cap = hairCap(H, hair, new THREE.Color(this.hairColor).multiplyScalar(1.25), { hat: o.hat ?? outfit.hat }); if (cap) { this.bindTo(cap, this.bones.Head); this.checkWorn('hair', cap); }
    const hat = o.hat ?? outfit.hat, glasses = o.glasses ?? outfit.glasses;
    if (hat) this.wear(hat, o.hatColor); if (glasses) this.wear(glasses === true ? 'glasses' : glasses); if (outfit.bowtie) this.wear('bowtie', outfit.bowtie);
    for (const x of this.meshes) x.frustumCulled = false;
    this.setFace(o.face || 'neutral');
  }
  /** a worn thing must not cut into the face (check_layout reports it) */
  checkWorn(what, g) { if (!this.headDims) return; const g2 = g.clone(); g2.position.set(0, 0, 0); g2.rotation.set(0, 0, 0); g2.scale.set(1, 1, 1); g2.updateMatrix();
    const d = intrusion(this.headDims, g2); if (d > .004) this.wornIssues.push(`${what} cuts ${Math.round(d * 1000)} mm into the face`); }
  /** joint positions of the bind pose in character space (metres): where clothes start and end */
  landmarks(inv) {
    const P = n => { const b = this.bones[n]; return b ? new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).applyMatrix4(inv).multiplyScalar(1 / this.scale) : null; };
    const X = n => Math.abs(P(n)?.x ?? 0), Y = n => P(n)?.y ?? 0;
    return { shoulderX: X('upperarm_l') || .17, elbowX: X('lowerarm_l') || .45, wristX: X('hand_l') || .7, neckY: Y('neck_01') || 1.48, hipY: Y('pelvis') || .95, kneeY: Y('calf_l') || .5, ankleY: Y('foot_l') || .08 };
  }
  /** The face mask: the front of the head re-drawn with an expression canvas (same vertices + weights as the body: no gaps). */
  buildFace(o) {
    const mesh = this.body, g = mesh.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, uv = g.attributes.uv;
    const hi = mesh.skeleton.bones.findIndex(b => b.name === 'Head'); if (hi < 0) return;
    this.rig.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.rig.matrixWorld).invert(), toChar = new THREE.Matrix4().makeScale(1 / this.scale, 1 / this.scale, 1 / this.scale).multiply(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
    const P = [], keep = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    const headW = i => { let w = 0; for (let j = 0; j < 4; j++) if (si.getComponent(i, j) === hi) w += sw.getComponent(i, j); return w; };
    for (let t = 0; t < pos.count; t += 3) {
      if (headW(t) < .5 || headW(t + 1) < .5 || headW(t + 2) < .5) continue;
      a.fromBufferAttribute(pos, t).applyMatrix4(toChar); b.fromBufferAttribute(pos, t + 1).applyMatrix4(toChar); c.fromBufferAttribute(pos, t + 2).applyMatrix4(toChar);
      n.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
      if (n.z < 0) n.negate().negate();                                 // (winding: use the outward normal from the centroid below)
      const cen = a.clone().add(b).add(c).multiplyScalar(1 / 3);
      keep.push({ t, cen, pts: [a.clone(), b.clone(), c.clone()] });
    }
    if (!keep.length) return;
    // head centre and the front: triangles whose outward direction (from the head centre) faces +z
    const hc = keep.reduce((s, k) => s.add(k.cen), new THREE.Vector3()).multiplyScalar(1 / keep.length);
    const front = keep.filter(k => { const d = k.cen.clone().sub(hc); d.y *= .6; return d.normalize().z > .42 && k.cen.y < hc.y + .085; });
    if (!front.length) return;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const k of front) for (const p of k.pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    const geo = new THREE.BufferGeometry(), N = front.length * 3, fp = new Float32Array(N * 3), fuv = new Float32Array(N * 2), fu2 = new Float32Array(N * 2), fsi = new Uint16Array(N * 4), fsw = new Float32Array(N * 4), fn = new Float32Array(N * 3);
    // a paper mask: the face's sockets, lips and nostrils are filled up to a smooth surface (z fitted over x and y), the
    // nose keeps its shape. The drawn eyes and mouth then sit on a smooth face (on the modelled head the eye sockets and
    // lips shaded through the drawing: a second pair of eyes and a double mouth)
    const pts = front.flatMap(k => k.pts), fit = fitFace(pts), toLocal = toChar.clone().invert(), nm = new THREE.Matrix3().setFromMatrix4(toLocal), q = new THREE.Vector3(), nq = new THREE.Vector3();
    front.forEach((k, f) => { for (let j = 0; j < 3; j++) { const i = k.t + j, o3 = (f * 3 + j);
      const cp = k.pts[j], zf = fit.z(cp.x, cp.y);
      const dz = clamp(zf + .003 - cp.z, 0, .013);                          // fill sockets / lips by at most 1.3 cm (an unclamped fit floated a muzzle in front of the chin)
      q.set(cp.x, cp.y, cp.z + dz).applyMatrix4(toLocal); fp.set([q.x, q.y, q.z], o3 * 3);
      nq.copy(fit.n(cp.x, cp.y)).applyMatrix3(nm).normalize(); const on = g.attributes.normal ? new THREE.Vector3(g.attributes.normal.getX(i), g.attributes.normal.getY(i), g.attributes.normal.getZ(i)) : nq.clone();
      nq.lerp(on, .45).normalize(); fn.set([nq.x, nq.y, nq.z], o3 * 3);
      if (uv) fuv.set([uv.getX(i), uv.getY(i)], o3 * 2);
      fu2.set([(k.pts[j].x - x0) / (x1 - x0), (k.pts[j].y - y0) / (y1 - y0)], o3 * 2);
      for (let q = 0; q < 4; q++) { fsi[o3 * 4 + q] = si.getComponent(i, q); fsw[o3 * 4 + q] = sw.getComponent(i, q); } } });
    geo.setAttribute('position', new THREE.BufferAttribute(fp, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(fn, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(fuv, 2));
    geo.setAttribute('faceUv', new THREE.BufferAttribute(fu2, 2)); geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(fsi, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(fsw, 4));
    geo.setAttribute('region', new THREE.BufferAttribute(new Float32Array(N), 1));
    // the layout of the drawn face: the modelled eyes when the body has them, else proportions of the head
    let eyes = [[.32, .55], [.68, .55]];
    if (this.eyeMesh) { const ep = this.eyeMesh.geometry.attributes.position, L = [], Rr = []; const tc = new THREE.Matrix4().makeScale(1 / this.scale, 1 / this.scale, 1 / this.scale).multiply(new THREE.Matrix4().multiplyMatrices(inv, this.eyeMesh.matrixWorld));
      for (let i = 0; i < ep.count; i++) { const p = new THREE.Vector3().fromBufferAttribute(ep, i).applyMatrix4(tc); (p.x > 0 ? L : Rr).push(p); }
      const avg = s => s.reduce((m, p) => m.add(p), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, s.length));
      if (L.length && Rr.length) { const l = avg(L), r = avg(Rr); eyes = [r, l].map(p => [(p.x - x0) / (x1 - x0), (p.y - y0) / (y1 - y0)]); } }
    const eyeV = (eyes[0][1] + eyes[1][1]) / 2;
    this.faceLayout = { eyes, mouth: Math.max(.08, eyeV - .34 * (y1 - y0 > .2 ? 1 : 1)), eyeR: Math.min(.11, Math.abs(eyes[1][0] - eyes[0][0]) * .27), mouthW: .24 };
    this.faceBox = { x0, x1, y0, y1 };
    this.faceLayout.aspect = (y1 - y0) / Math.max(1e-4, x1 - x0);
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = tex.magFilter = MOODY ? THREE.LinearFilter : THREE.NearestFilter;
    // the face's own painted features (lips, nostrils, brows of the skin texture) are flattened to the face's mean skin
    // tone inside the mask, fading back to the texture at its border: only the sheet's mouth shows (no double mouth)
    const flatL = faceLuminance(mesh.material, uv, front);
    const lipV = findLips(mesh.material, uv, front, x0, x1, y0, y1, eyeV); if (lipV != null) this.faceLayout.mouthV = lipV;   // the drawn mouth goes where the painted lips were
    const mat = mesh.material.clone(); Object.assign(mat, MASK_BIAS); const U = { ...mesh.material.userData.U, uFace: { value: tex }, uFlatL: { value: flatL } };
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 faceUv; varying vec2 vFaceUv; attribute float region; varying float vRegion;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvFaceUv = faceUv; vRegion = region;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vFaceUv; varying float vRegion; uniform vec3 uSkin; uniform float uMann; uniform sampler2D uFace; uniform float uFlatL;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          { float L = dot(diffuseColor.rgb, vec3(.299, .587, .114)); float e = min(min(vFaceUv.x, 1. - vFaceUv.x), min(vFaceUv.y, 1. - vFaceUv.y));
            if (uFlatL > 0.) L = mix(L, uFlatL, smoothstep(.02, .2, e));
            vec3 skin = uMann > .5 ? uSkin * (.82 + .25 * L) : uSkin * clamp(.5 + 1.75 * L, .3, 1.5);
            vec4 f = texture2D(uFace, vFaceUv); diffuseColor.rgb = mix(skin, f.rgb, f.a); }`);
    };
    mat.customProgramCacheKey = () => 'lpface';
    const mask = new THREE.SkinnedMesh(geo, mat); mask.name = 'face'; mask.frustumCulled = false; mask.castShadow = false;
    mesh.parent.add(mask); mask.bind(mesh.skeleton, mesh.bindMatrix);
    this.faceTex = tex; this.faceCanvas = cv; this.faceMask = mask; this.faceNow = null; this.faceInk = o.faceInk;
    this.setFace(o.face || 'neutral');
  }
  setFace(name) {
    if (!this.faceCanvas || this.faceNow === name) return; this.faceNow = name;
    const x = this.faceCanvas.getContext('2d'); drawFace(x, this.faceCanvas.width, this.faceCanvas.height, name, this.faceLayout, { iris: this.o.eyeColor, brow: this.o.hairColor && this.o.hair !== 'bald' ? this.o.hairColor : undefined });
    if (this.headDims && this.beard) drawBeard(x, this.faceCanvas.width, this.faceCanvas.height, this.faceLayout, this.beard, this.o.beardColor || this.hairColor);
    this.faceTex.needsUpdate = true;
  }
  /** Things worn on the head or chest, built here: 'cap' | 'hat' | 'tophat' | 'police' | 'hardhat' | 'helmet' | 'wig' | 'glasses' | 'shades' | 'headset' | 'bowtie' */
  wear(kind, color) {
    const head = this.bones.Head; if (!head) return;
    if (this.headDims && kind !== 'bowtie') { const w = wornOnHead(this.headDims, kind, color); this.checkWorn(kind, w); return this.bindTo(w, head); }
    const box = this.faceBox || { x0: -.08, x1: .08, y0: 1.58, y1: 1.78 };
    const hw = (box.x1 - box.x0) / 2 * 1.12, top = box.y1 + .05;
    // built in character space (metres, bind pose), then bound to the head bone
    const g = new THREE.Group(); const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .8, ...o });
    const add = (geo, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; g.add(m); return m; };
    const cz = (box.x0 + box.x1) / 2, eyeY = box.y0 + (this.faceLayout?.eyes?.[0]?.[1] ?? .55) * (box.y1 - box.y0);
    if (kind === 'cap' || kind === 'police') { const c = color || (kind === 'police' ? '#1a2338' : '#c83232');
      add(new THREE.SphereGeometry(hw * 1.02, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(c), cz, top - .075, -.02);
      add(new THREE.BoxGeometry(hw * 1.6, .012, .09), M(c), cz, top - .07, hw * .95);
      if (kind === 'police') add(new THREE.BoxGeometry(.05, .04, .01), M('#d8b542', { emissive: '#3a2a00' }), cz, top - .02, hw * 1.0); }
    else if (kind === 'hat' || kind === 'tophat') { const c = color || '#1b1b1b', h = kind === 'tophat' ? .2 : .1;
      add(new THREE.CylinderGeometry(hw * 1.15, hw * 1.15, .012, 12), M(c), cz, top - .06, -.02);
      add(new THREE.CylinderGeometry(hw * .82, hw * .9, h, 10), M(c), cz, top - .06 + h / 2, -.02); }
    else if (kind === 'hardhat' || kind === 'helmet') { const c = color || (kind === 'hardhat' ? '#f2c200' : '#4f5d36');
      add(new THREE.SphereGeometry(hw * 1.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(c), cz, top - .085, -.02);
      add(new THREE.CylinderGeometry(hw * 1.2, hw * 1.2, .012, 12), M(c), cz, top - .085, -.02); }
    else if (kind === 'wig') add(new THREE.SphereGeometry(hw * 1.25, 8, 6), M(color || '#e8e4dc'), cz, top - .08, -.05);
    else if (kind === 'glasses' || kind === 'shades') { const c = kind === 'shades' ? '#050505' : (color || '#1c1410'), fz = hw * 1.02, ex = Math.abs((this.faceLayout?.eyes?.[1]?.[0] ?? .68) - (this.faceLayout?.eyes?.[0]?.[0] ?? .32)) / 2 * (box.x1 - box.x0);
      for (const s of [-1, 1]) { if (kind === 'shades') add(new THREE.BoxGeometry(ex * 1.25, ex * .8, .006), M(c, { roughness: .2 }), cz + s * ex, eyeY, fz);
        else add(new THREE.TorusGeometry(ex * .55, .006, 4, 10), M(c), cz + s * ex, eyeY, fz); }
      add(new THREE.BoxGeometry(ex * .5, .008, .008), M(c), cz, eyeY + .005, fz); }
    else if (kind === 'headset') { add(new THREE.TorusGeometry(hw * 1.05, .012, 4, 12, Math.PI), M('#222'), cz, top - .1, -.01); add(new THREE.BoxGeometry(.02, .06, .06), M('#222'), cz - hw * 1.05, top - .12, 0); }
    else if (kind === 'bowtie') { const c = color || '#151515'; const b = new THREE.Group();
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(.028, .05, 4), M(c)); w.rotation.z = s * Math.PI / 2; w.position.x = s * .025; b.add(w); }
      b.position.set(0, 1.455, .095); const sk = this.bones.neck_01 || head; return this.bindTo(b, sk); }
    return this.bindTo(g, head);
  }
  /** Parent a group built in character space (metres, bind pose) to a bone so it follows the animation. */
  bindTo(g, bone) {
    this.rig.updateMatrixWorld(true);
    const charToBone = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(this.rig.matrixWorld).multiply(new THREE.Matrix4().makeScale(this.scale, this.scale, this.scale));
    g.applyMatrix4(charToBone); bone.add(g); g.traverse(m => { if (m.isMesh) m.userData.worn = true; }); return g;
  }
  /** A skinned library attachment (hair, beard, eyebrows) re-bound to this body's own skeleton. Its vertices are taken where
   *  the attachment file itself puts them (its own skeleton at rest) and expressed in the body's bind space, so the files'
   *  armature orientation doesn't matter (anim-runtime's attachToSkeleton kept the file's inverse binds: the hair came out
   *  turned 180 degrees on these bodies). */
  attach(ref) {
    const { g, e } = gltf(ref), body = this.body || this.meshes[0], key = e.id + '|' + this.libId;
    let list = REBIND.get(key);
    if (!list) {
      list = []; g.scene.updateMatrixWorld(true); this.rig.updateMatrixWorld(true);
      const names = body.skeleton.bones.map(b => b.name), rigInv = this.rig.matrixWorld.clone().invert(), v = new THREE.Vector3();
      // per body bone: bind space -> rig space (unscaled) at the rest pose; a vertex goes back through the inverse of its blend
      const Mb = body.skeleton.bones.map((b, j) => rigInv.clone().multiply(b.matrixWorld).multiply(body.skeleton.boneInverses[j]).multiply(body.bindMatrix));
      const B = new THREE.Matrix4(), tmp = new THREE.Matrix4();
      g.scene.traverse(src => { if (!src.isSkinnedMesh) return; src.skeleton.update();
        const geo = src.geometry.clone(), p = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
        for (let i = 0; i < si.count; i++) for (let j = 0; j < 4; j++) { const k = names.indexOf(src.skeleton.bones[si.getComponent(i, j)]?.name); si.setComponent(i, j, k < 0 ? names.indexOf('Head') : k); }
        for (let i = 0; i < p.count; i++) {
          src.getVertexPosition(i, v); v.applyMatrix4(src.matrixWorld);
          B.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0); let ws = 0;
          for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j); if (w <= 0) continue; ws += w; const e = Mb[si.getComponent(i, j)].elements; for (let q = 0; q < 16; q++) B.elements[q] += e[q] * w; }
          if (ws > 0) { for (let q = 0; q < 16; q++) B.elements[q] /= ws; v.applyMatrix4(tmp.copy(B).invert()); }
          p.setXYZ(i, v.x, v.y, v.z);
        }
        geo.deleteAttribute('color'); geo.computeVertexNormals(); geo.computeBoundingSphere();
        list.push({ geo, mat: Array.isArray(src.material) ? src.material[0] : src.material }); });
      REBIND.set(key, list);
    }
    return list.map(({ geo, mat }) => { const m = new THREE.SkinnedMesh(geo, mat); m.frustumCulled = false; body.parent.add(m); m.bind(body.skeleton, body.bindMatrix); return m; });
  }
  // ---- placement and motion (all times absolute seconds) ----
  at(x, y = 0, z = 0, ry) { if (Array.isArray(x)) { ry = y; [x, y, z] = x.length === 2 ? [x[0], 0, x[1]] : x; } this.place = { p: new THREE.Vector3(x, y, z), ry: ry ?? this.place.ry }; return this; }
  face(target) { const p = Array.isArray(target) ? new THREE.Vector3(target[0], 0, target[target.length - 1]) : target?.root ? target.root.position : target; this.place.ry = Math.atan2(p.x - this.place.p.x, p.z - this.place.p.z); return this; }
  /** play a clip from time `at` (blends over `fade` s): do('Walk_Loop', 2.1), do('G_Shrug', cue('shrug', 6)) */
  do(name, at = 0, o = {}) {
    const c = fitted(this, name); const loop = o.loop ?? LOOPS.test(name);
    this.plan.push({ name, c, at, fade: o.fade ?? (at < -50 ? 0 : .25), speed: o.speed ?? 1, loop, phase: o.phase ?? 0, until: o.until ?? null });
    this.plan.sort((a, b) => a.at - b.at); return this;
  }
  /** walk along points [[x, z], ...] from time at; speed matched to the clip (no foot sliding); ends in `then` (idle) */
  walk(points, o = {}) {
    const at = o.at ?? 0, clipName = o.clip || (o.run ? 'Jog_Fwd_Loop' : 'Walk_Loop'), ts = o.pace ?? (o.run ? 1 : 1.25);
    const pts = points.map(p => new THREE.Vector3(p[0], p.length === 3 ? p[1] : this.place.p.y, p[p.length - 1]));
    if (o.from !== false) pts.unshift(this.place.p.clone());
    const gait = clipGait(this, clipName), v = gait.v * ts; const segs = []; let L = 0;
    for (let i = 1; i < pts.length; i++) { const d = pts[i].distanceTo(pts[i - 1]); segs.push({ a: pts[i - 1], b: pts[i], L0: L, d }); L += d; }
    const fade = o.fade ?? .2, m = { at, segs, L, v, fade, ts, gait };   // (the speed ramps up with the clip's blend: no slide while it fades in)
    // the end: the body slows down over the blend into the idle (it used to stop dead while the walk clip faded out: the
    // planted foot slid ~8 cm on every stop)
    const fe = o.then === false ? 0 : .3; m.fe = fe;
    let t1 = 0; if (v > 0) { while (walkDist(m, t1) < L - v * fe / 2 && t1 < 600) t1 += 1 / 120; } m.t1 = t1; m.d1 = walkDist(m, t1); m.dur = t1 + fe;
    this.moves.push(m);
    this.do(clipName, at, { speed: ts, fade });
    if (o.then !== false) this.do(o.then || (this.animal ? (this.animations.find(a => /idle/i.test(a.name))?.name || this.animations[0]?.name) : /^Crouch/.test(clipName) ? 'Crouch_Idle_Loop' : 'Idle_Loop'), at + t1, { fade: fe });   // (crouch -> standing idle in 0.3 s sank the feet 12 cm and slid them 35 cm)
    const last = pts[pts.length - 1], prev = pts[pts.length - 2] || last; this.endPlace = { p: last.clone(), ry: Math.atan2(last.x - prev.x, last.z - prev.z) };
    return this;
  }
  run(points, o = {}) { return this.walk(points, { ...o, run: true }); }
  /** head turns to a point / actor / object from `at` (weight eases in over .35 s), until `until` */
  lookAt(target, at = 0, o = {}) { this.looks.push({ target, at, until: o.until ?? 1e9, w: o.weight ?? 1 }); return this; }
  expr(name, at = 0) { this.faces.push({ name, at }); this.faces.sort((a, b) => a.at - b.at); return this; }
  /** finger poses on top of the clip: fingers('wiggle' | 'fist' | 'point' | 'open' | 'claw', at, { until, hand: 'r'|'l'|'both', rate })
   *  'wiggle' = tickling / typing fingers, 'claw' = tickle hands up, 'point' = index out. The clips' hands are mittens otherwise. */
  fingers(mode, at = 0, o = {}) { this.fingerPoses ??= []; this.fingerPoses.push({ mode, at, until: o.until ?? 1e9, hand: o.hand || 'both', rate: o.rate ?? 9, amt: o.amount ?? 1 }); return this; }
  applyFingers(t) {
    const fp = this.fingerPoses?.filter(f => t >= f.at - .2 && t < f.until + .2); if (!fp?.length) return;
    const AX = this.fingerAxes, q = new THREE.Quaternion(); if (!AX) return;
    for (const f of fp) { const w = E.inOut(seg(t, f.at - .2, f.at)) * (1 - E.inOut(seg(t, f.until, f.until + .2))) * f.amt;
      for (const h of f.hand === 'both' ? ['l', 'r'] : [f.hand]) ['index', 'middle', 'ring', 'pinky', 'thumb'].forEach((fn, k) => {
        let c = { fist: 1.35, claw: .75, open: -.15, point: fn === 'index' ? -.1 : 1.35, wiggle: .55 + .55 * Math.sin(t * f.rate * 2 * Math.PI / 4 + k * 1.3) }[f.mode] ?? 0;
        if (fn === 'thumb') c *= .45;
        for (let j = 1; j <= 3; j++) { const n = `${fn}_0${j}_${h}`, b = this.bones[n]; if (!b || !AX[n]) continue; q.setFromAxisAngle(AX[n], c * w * (j === 1 ? .8 : 1)); b.quaternion.multiply(q); }
      }); }
  }
  /** hold a prop in a hand: hold(obj, { hand: 'r', grip: 'palm'|'grip'|'phone'|'card'|'tray', at, until, offset, rot }) */
  hold(obj, o = {}) {
    const hand = o.hand === 'l' ? 'l' : 'r', hb = this.bones['hand_' + hand], mid = this.bones['middle_01_' + hand], th = this.bones['thumb_01_' + hand];
    if (!hb) return obj;
    this.rig.updateMatrixWorld(true);
    const P = b => new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
    const ph = P(hb), pm = mid ? P(mid) : ph.clone().add(new THREE.Vector3(hand === 'r' ? -.08 : .08, 0, 0)), pt = th ? P(th) : ph.clone().add(new THREE.Vector3(0, 0, .04));
    const f = pm.clone().sub(ph).normalize(), tdir = pt.clone().sub(ph); tdir.sub(f.clone().multiplyScalar(tdir.dot(f))).normalize();
    let nrm = new THREE.Vector3().crossVectors(f, tdir).normalize(); if (nrm.y > 0) nrm.negate();      // T-pose: the palm faces down
    // socket frame (world, bind pose): +z along the fingers, +y out of the palm, origin on the palm
    const z = f, y = nrm, x = new THREE.Vector3().crossVectors(y, z).normalize();
    const palm = ph.clone().lerp(pm, .55).add(y.clone().multiplyScalar(.018 * this.scale));
    const sock = new THREE.Group(); const basis = new THREE.Matrix4().makeBasis(x, y, z).setPosition(palm);
    sock.applyMatrix4(new THREE.Matrix4().copy(hb.matrixWorld).invert().multiply(basis));
    hb.add(sock);
    const grip = o.grip || 'palm', b = new THREE.Box3().setFromObject(obj), s = b.getSize(new THREE.Vector3());
    const g = new THREE.Group(); g.add(obj); obj.position.set(0, 0, 0);
    if (grip === 'palm' || grip === 'tray') { obj.position.y = .005; }                              // resting on the palm, its top facing away from it
    else if (grip === 'grip') { obj.rotation.z = -Math.PI / 2; obj.position.set(-s.y / 2, Math.max(.025, Math.min(s.x, s.z) / 2), .045); }   // upright through the fist (bottle, can, axe handle)   // a handle along the fist (bottle, axe, torch)
    else if (grip === 'phone' || grip === 'card') { obj.rotation.x = -Math.PI / 2; obj.position.set(0, .01, Math.min(.11, s.y * .7)); }   // lying in the palm, face away from it, centred on the palm   // flat object held up, its face toward the palm side
    if (o.rot) obj.rotation.set(...o.rot); if (o.offset) obj.position.add(new THREE.Vector3(...o.offset));
    sock.add(g); obj.userData.heldBy = this; obj.userData.hand = hand;
    this.holds.push({ obj: g, item: obj, at: o.at ?? -1e9, until: o.until ?? 1e9, hand, sock });   // (sock: the palm point check_layout measures from)
    return obj;
  }
  /** sit on a seat: { pos: [x, y, z] (top of the seat), ry } or a chair object (its seat height ~0.45 m); enter: play the sit-down first */
  sit(seat, o = {}) {
    let p, ry;
    if (seat?.isObject3D) { const b = new THREE.Box3().setFromObject(seat); p = new THREE.Vector3((b.min.x + b.max.x) / 2, o.height ?? Math.min(.5, b.max.y * .5), (b.min.z + b.max.z) / 2); ry = seat.rotation.y; }
    else { p = new THREE.Vector3(...(seat.pos || seat)); ry = seat.ry ?? this.place.ry; }
    const k = this.scale * (pelvisRest(this.rig) / .918), seatClip = .45 * k;
    this.place = { p: new THREE.Vector3(p.x, p.y - seatClip, p.z).add(new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)).multiplyScalar((o.forward ?? .12) * k)), ry };
    const at = o.at ?? -100;
    if (o.enter) { this.do('Sitting_Enter', at, { loop: false }); this.do(o.clip || 'Sitting_Idle_Loop', at + 1.25, { fade: .2 }); }
    else this.do(o.clip || 'Sitting_Idle_Loop', at, { fade: at < -50 ? 0 : .3 });
    this.seated = true; this.seatPos = p.clone(); return this;
  }
  // ---- per frame ----
  update(t) {
    // where: placement, or along a walk
    let p = this.place.p, ry = this.place.ry;
    for (const m of this.moves) {
      if (t < m.at) break;
      const el = t - m.at, d = clamp(walkDist(m, el), 0, m.L); let s = m.segs[0];
      for (const sg of m.segs) if (d >= sg.L0) s = sg;
      const k = s.d > 0 ? (d - s.L0) / s.d : 0; p = s.a.clone().lerp(s.b, clamp(k));
      const dir = s.b.clone().sub(s.a); let h = Math.atan2(dir.x, dir.z);
      const nx = m.segs[m.segs.indexOf(s) + 1];                       // round the corner over the last 0.35 m of a segment
      if (nx && s.d - (d - s.L0) < .35) { const d2 = nx.b.clone().sub(nx.a), h2 = Math.atan2(d2.x, d2.z); let dh = h2 - h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI; h += dh * (1 - (s.d - (d - s.L0)) / .35) * .5; }
      if (s !== m.segs[0] || k > 0 || d > 0) { const pr = m.segs[m.segs.indexOf(s) - 1]; if (pr && d - s.L0 < .35) { const d0 = pr.b.clone().sub(pr.a), h0 = Math.atan2(d0.x, d0.z); let dh = h - h0; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI; h = h0 + dh * (.5 + .5 * (d - s.L0) / .35); } }
      ry = h;
    }
    this.root.position.copy(p); this.root.rotation.y = ry;
    // clips: the current one and the one it blends from
    const plan = this.plan; let i = 0; while (i + 1 < plan.length && t >= plan[i + 1].at) i++;
    const cur = plan[i], prev = i > 0 ? plan[i - 1] : null, w = prev && cur.fade > 0 ? E.inOut(seg(t, cur.at, cur.at + cur.fade)) : 1;
    const local = st => { const d = st.c.duration || 1; let lt = (t - st.at) * st.speed + st.phase * d; return st.loop ? ((lt % d) + d) % d : clamp(lt, 0, d - 1e-4); };
    for (const st of plan) { const a = this.mixer.clipAction(st.c); if (!a.isRunning()) a.play(); a.enabled = true; a.setEffectiveTimeScale(1);
      a.setEffectiveWeight(st === cur ? w : st === prev ? 1 - w : 0); if (st === cur || st === prev) a.time = local(st); }
    // the bones the engine turns on top of the clip (head turns, finger poses) start each frame from their rest pose: a clip
    // that has no key for them left last frame's turn in place, so a frame looked different after a seek (check: determinism)
    if (!this._procRest) { this._procRest = []; for (const [n, b] of Object.entries(this.bones)) if (/^(neck_01|Head)$|^(index|middle|ring|pinky|thumb)_0[123]_[lr]$/.test(n)) this._procRest.push([b, b.quaternion.clone()]); }
    for (const [b, q] of this._procRest) b.quaternion.copy(q);
    this.mixer.update(0);
    // head turn (after the clip)
    const lk = [...this.looks].reverse().find(l => t >= l.at && t < l.until + .4);
    if (lk && this.bones.Head) {
      const wgt = lk.w * E.inOut(seg(t, lk.at, lk.at + .35)) * (1 - E.inOut(seg(t, lk.until, lk.until + .4)));
      if (wgt > .001) this.turnHead(lk.target, wgt);
    }
    // face
    this.applyFingers(t);
    if (this.faces.length) { let f = null; for (const x of this.faces) if (t >= x.at) f = x; this.setFace(f ? f.name : (this.o.face || 'neutral')); }
    for (const hd of this.holds) hd.obj.visible = t >= hd.at && t < hd.until;
  }
  turnHead(target, w) {
    const head = this.bones.Head, neck = this.bones.neck_01; this.root.updateMatrixWorld(true);
    const hp = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld);
    const tp = target?.isVector3 ? target : Array.isArray(target) ? new THREE.Vector3(...target) : target?.head ? target.head() : target?.root ? new THREE.Vector3().setFromMatrixPosition(target.root.matrixWorld).add(new THREE.Vector3(0, 1.6, 0)) : target?.isObject3D ? new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3()) : null;
    if (!tp) return;
    const inv = new THREE.Quaternion().copy(this.root.quaternion).invert(), d = tp.clone().sub(hp).applyQuaternion(inv);
    const yaw = clamp(Math.atan2(d.x, d.z), -1.2, 1.2) * w, pitch = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -.5, .5) * w;
    const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    const worldDelta = this.root.quaternion.clone().multiply(delta).multiply(inv);
    for (const [b, k] of [[neck, .4], [head, .6]]) { if (!b) continue;
      const part = new THREE.Quaternion().slerp(worldDelta, k), pw = new THREE.Quaternion(); b.parent.getWorldQuaternion(pw);
      const bw = new THREE.Quaternion(); b.getWorldQuaternion(bw); const nw = part.multiply(bw); b.quaternion.copy(pw.invert().multiply(nw)); b.updateMatrixWorld(true); }
  }
  // ---- what checks and cameras need ----
  head() { const h = this.bones.Head; return h ? new THREE.Vector3().setFromMatrixPosition(h.matrixWorld).add(new THREE.Vector3(0, .09 * this.scale, 0)) : this.root.position.clone().add(new THREE.Vector3(0, 1.6, 0)); }
  boneAt(n) { const b = this.bones[n]; return b ? new THREE.Vector3().setFromMatrixPosition(b.matrixWorld) : null; }
  box() { const b = new THREE.Box3(); this.root.updateMatrixWorld(true); for (const n of Object.keys(this.bones)) { if (/_0[234]|leaf|thumb|index|middle|ring|pinky/.test(n)) continue; b.expandByPoint(this.boneAt(n)); } b.min.y = Math.min(b.min.y, this.root.position.y); b.max.y += .12 * this.scale; b.expandByScalar(.08 * this.scale); return b; }
  height() { return (this.entry.size_m?.[1] || 1.8) * this.scale; }
  /** bone capsules [a, b, radius] for the clipping check */
  capsules() {
    const C = []; const seg2 = (a, b, r) => { const A = this.boneAt(a), B = this.boneAt(b); if (A && B) C.push([A, B, r * this.scale, a]); };
    if (this.animal) { const b = new THREE.Box3().setFromObject(this.rig); const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()); const r = Math.min(s.x, s.y) * .35;
      const ax = s.z > s.x ? new THREE.Vector3(0, 0, s.z / 2 - r) : new THREE.Vector3(s.x / 2 - r, 0, 0); C.push([c.clone().sub(ax), c.clone().add(ax), r, 'body']); return C; }
    seg2('pelvis', 'spine_03', .14); seg2('spine_03', 'Head', .09); seg2('neck_01', 'Head', .1);
    for (const s of ['l', 'r']) { seg2('upperarm_' + s, 'lowerarm_' + s, .055); seg2('lowerarm_' + s, 'hand_' + s, .045); seg2('thigh_' + s, 'calf_' + s, .075); seg2('calf_' + s, 'foot_' + s, .06); seg2('foot_' + s, 'ball_' + s, .045); }
    return C;
  }
}
export const isActor = o => o instanceof Actor;
