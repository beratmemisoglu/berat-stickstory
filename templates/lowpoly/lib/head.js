// Stylised heads (engine 3). The library bodies' scanned heads (modelled nose, lips, jaw bumps, eye sockets) under a drawn
// face looked like a paper mask, and the library beard / hair meshes clipped the face. Every person now gets a clean head
// built here: the body's own head triangles are cut away at the neck (the neck stays), a rounded low-poly head (~250 tris,
// skull + jaw taper + chin, ears, a small nose) is bound to the Head bone, and the face (the generated expression sheet,
// lib/faces.js) is painted INTO the head's material from a curved projection around the front: no second surface, no edge,
// no z-fighting. Hair is a chunky low-poly cap shell around the same skull (styles below), beards / stubble are painted
// into the face texture. Hats and glasses are placed on the same skull numbers. Everything worn is tested against the skull.
import { THREE, MOODY, clamp } from './core.js';

const CUT = new Map();                                    // geometry without the head triangles, per source geometry
export const HAIR_STYLES = ['bald', 'buzzed', 'short', 'slick', 'long', 'bob', 'buns', 'curly', 'mohawk'];
const HAIR_ALIAS = { simpleparted: 'short', parted: 'short', buzzedfemale: 'bob', none: 'bald', afro: 'curly', bun: 'buns', ponytail: 'long' };
export const BEARDS = ['full', 'goatee', 'moustache', 'stubble'];
// the face projection: azimuth span (rad) either side of the nose, and its height, in skull radii
export const FACE = { span: 1.08, yb: -1.0, yt: .78, eyeAz: .37, eyeY: .1, mouthY: -.47 };

/** head triangles of a skinned mesh: a triangle goes when its mean Head weight is over .5 */
function headTris(mesh) {
  const g = mesh.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, hi = mesh.skeleton.bones.findIndex(b => b.name === 'Head');
  if (hi < 0 || !si) return [];
  const w = i => { let s = 0; for (let j = 0; j < 4; j++) if (si.getComponent(i, j) === hi) s += sw.getComponent(i, j); return s; };
  const out = []; for (let t = 0; t < g.attributes.position.count; t += 3) if (Math.max(w(t), w(t + 1), w(t + 2)) > .3) out.push(t);   // (a .5 mean left spiky jaw triangles sticking out of the new neck on a head turn)
  return out;
}
/** the body's head measured (character space, metres, bind pose) and cut away from every mesh of the actor */
export function cutHead(actor, toCharOf) {
  let box = new THREE.Box3(), core = new THREE.Box3(), list = [];
  for (const mesh of actor.meshes) {
    if (!mesh.visible || !mesh.geometry.attributes.skinIndex) continue;
    const tris = headTris(mesh); if (!tris.length) continue;
    const m = toCharOf(mesh), pos = mesh.geometry.attributes.position, v = new THREE.Vector3();
    if (mesh === actor.body) for (const t of tris) for (let j = 0; j < 3; j++) { v.fromBufferAttribute(pos, t + j).applyMatrix4(m); box.expandByPoint(v); if (Math.abs(v.x) < .055) core.expandByPoint(v); }
    let g = CUT.get(mesh.geometry.uuid);
    if (!g) { g = mesh.geometry.clone(); const p = g.attributes.position; for (const t of tris) { const x = p.getX(t), y = p.getY(t), z = p.getZ(t); p.setXYZ(t + 1, x, y, z); p.setXYZ(t + 2, x, y, z); } p.needsUpdate = true; CUT.set(mesh.geometry.uuid, g); }
    list.push({ mesh, tris }); mesh.geometry = g;
  }
  if (box.isEmpty()) return null;
  // the skull: width without the ears (the central band's depth gives the face front), chin to crown
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()), cs = core.isEmpty() ? s : core.getSize(new THREE.Vector3());
  const rx = Math.min(s.x / 2 * .86, cs.z * .5), ry = s.y / 2 * .98, rz = cs.z / 2 * 1.02;
  // stylised proportions: a little bigger and rounder than the scan (chunky game heads), crown kept where it was
  const RX = rx * 1.1, RY = Math.min(ry * 1.02, RX * 1.32), RZ = Math.min(rz, RX * 1.22), top = c.y + s.y / 2;
  return { c: new THREE.Vector3(c.x, top - RY * .98, core.isEmpty() ? c.z : core.getCenter(new THREE.Vector3()).z - .004), rx: RX, ry: RY, rz: RZ, list };
}
// the skull shape: a sphere with a narrower jaw and a forward chin (unit space, y up, +z front)
function skull(u, k = 1) {
  const v = u.clone();
  if (v.y < 0) { const t = -v.y; v.x *= 1 - .22 * t * t; if (v.z > 0) v.z *= 1 - .1 * t; else v.z *= 1 - .3 * t; }
  else { v.x *= 1 - .05 * v.y * v.y; if (v.z < 0) v.z *= 1.06; }
  return v.multiplyScalar(k);
}
function skullGeo(H, k = 1, w = 14, h = 10) {
  const g = new THREE.SphereGeometry(1, w, h), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const q = skull(v, k); p.setXYZ(i, H.c.x + q.x * H.rx, H.c.y + q.y * H.ry, H.c.z + q.z * H.rz); }
  g.computeVertexNormals(); return g;
}
/** inside test against the skull (unit-sphere value of a character-space point: < 1 = inside) */
export function skullValue(H, p) {
  const u = new THREE.Vector3((p.x - H.c.x) / H.rx, (p.y - H.c.y) / H.ry, (p.z - H.c.z) / H.rz);
  // undo the jaw taper approximately: the skull is never wider than the sphere
  if (u.y < 0) { const t = Math.min(1, -u.y); u.x /= 1 - .22 * t * t; if (u.z > 0) u.z /= 1 - .1 * t; else u.z /= 1 - .3 * t; }
  return u.length();
}
/** the head: { group, mesh, canvas, tex, layout } built in character space (bound to the Head bone by the caller) */
export function buildHead(actor, H, skinColor, o = {}) {
  const g = new THREE.Group(); g.name = 'head';
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = tex.magFilter = MOODY ? THREE.LinearFilter : THREE.NearestFilter;
  const mat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: o.roughness ?? .78, metalness: 0 });
  const U = { uFace: { value: tex }, uC: { value: H.c.clone() }, uSpan: { value: FACE.span }, uYb: { value: H.c.y + FACE.yb * H.ry }, uYt: { value: H.c.y + FACE.yt * H.ry }, uR: { value: new THREE.Vector2(H.rx, H.rz) } };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vHP; uniform sampler2D uFace; uniform vec3 uC; uniform float uSpan; uniform float uYb; uniform float uYt; uniform vec2 uR;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        { vec2 d = (vHP.xz - uC.xz) / uR; float az = atan(d.x, d.y); vec2 fuv = vec2(.5 + az / (2. * uSpan), (vHP.y - uYb) / (uYt - uYb));
          if (fuv.x > 0. && fuv.x < 1. && fuv.y > 0. && fuv.y < 1.) { vec4 f = texture2D(uFace, fuv); diffuseColor.rgb = mix(diffuseColor.rgb, f.rgb, f.a); } }`);
  };
  mat.customProgramCacheKey = () => 'lphead1';
  const mesh = new THREE.Mesh(skullGeo(H), mat); mesh.name = 'head'; mesh.castShadow = true; mesh.receiveShadow = !MOODY; g.add(mesh);
  const plain = new THREE.MeshStandardMaterial({ color: skinColor, roughness: o.roughness ?? .78 });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 5), plain); e.scale.set(H.rx * .16, H.ry * .26, H.rz * .2); e.position.set(H.c.x + s * H.rx * .97, H.c.y - H.ry * .02, H.c.z - H.rz * .08); e.castShadow = true; e.name = 'ear'; g.add(e); }
  // a small nose (structure in the middle of the face; the drawn face has none)
  const nose = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), plain); nose.scale.set(H.rx * .1, H.ry * .12, H.rz * .1);
  nose.position.set(H.c.x, H.c.y - H.ry * .2, H.c.z + H.rz * .96); nose.name = 'nose'; nose.castShadow = true; g.add(nose);
  // the neck under the skull (the cut body neck ends inside it)
  const nk = actor.neckTop ?? (H.c.y - H.ry * 1.3), nh = H.c.y - H.ry * .45 - nk + .02;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(H.rx * .6, H.rx * .66, nh, 10), plain); neck.position.set(H.c.x, nk + nh / 2 - .01, H.c.z - H.rz * .2); neck.name = 'neck'; g.add(neck);
  const arc = (H.rx + H.rz) / 2 * 2 * FACE.span, tall = (FACE.yt - FACE.yb) * H.ry;
  const layout = { eyes: [-1, 1].map(s => [.5 + s * FACE.eyeAz / (2 * FACE.span), (FACE.eyeY - FACE.yb) / (FACE.yt - FACE.yb)]), mouthV: (FACE.mouthY - FACE.yb) / (FACE.yt - FACE.yb), aspect: tall / arc, featureScale: 1.08 };
  return { group: g, mesh, canvas: cv, tex, layout, materials: [mat, plain] };
}
/** a hair cap: the skull shell 6-10 % bigger, cut at a hairline (high at the forehead, low at the nape), chunky (flat shaded) */
export function hairCap(H, style, color, o = {}) {
  style = HAIR_ALIAS[style] || style; if (!style || style === 'bald') return null;
  if (o.hat && ['short', 'slick', 'curly', 'mohawk', 'buns'].includes(style)) style = 'buzzed';      // under a hat only the hair below the brim shows
  const g = new THREE.Group(); g.name = 'hair: ' + style;
  const M = new THREE.MeshStandardMaterial({ color, roughness: .9, flatShading: true, side: THREE.DoubleSide });
  // [shell scale, hairline front / temples / nape (skull y), top volume, quiff forward]
  const P = { buzzed: [1.03, .5, .05, -.35, 0, 0], short: [1.07, .5, .1, -.4, .16, .08], slick: [1.06, .56, .08, -.45, .06, -.04], long: [1.07, .48, .1, -.5, .1, 0], bob: [1.08, .46, .1, -.5, .1, 0],
    buns: [1.05, .55, .08, -.4, .04, 0], curly: [1.2, .36, 0, -.35, .12, 0], mohawk: [1.03, .5, .05, -.3, 0, 0] }[style] || [1.07, .5, .1, -.4, .1, 0];
  const [k, front, side, back, vol, quiff] = P;
  const src = new THREE.SphereGeometry(1, 16, 12), sp = src.attributes.position, w = new THREE.Vector3();
  const drop = { long: 1.25, bob: .55 }[style] || 0;                    // long hair: the lower back / sides of the shell fall to the shoulders
  for (let i = 0; i < sp.count; i++) { w.fromBufferAttribute(sp, i); const up = Math.max(0, w.y); const q = skull(w, k); q.y += vol * up * up; q.z += quiff * up * Math.max(0, w.z);
    if (drop && w.y < .1 && Math.abs(Math.atan2(w.x, w.z)) > .95) { const d = (.1 - w.y) / 1.1; q.y -= drop * d; q.x *= 1 + .08 * d; q.z = q.z * (1 + .05 * d) - .1 * d; }
    sp.setXYZ(i, H.c.x + q.x * H.rx, H.c.y + q.y * H.ry, H.c.z + q.z * H.rz); }
  const src2 = src.toNonIndexed(), p = src2.attributes.position, keep = [], v = new THREE.Vector3();
  for (let t = 0; t < p.count; t += 3) {
    v.set(0, 0, 0); for (let j = 0; j < 3; j++) v.add(new THREE.Vector3().fromBufferAttribute(p, t + j)); v.multiplyScalar(1 / 3);
    const ux = (v.x - H.c.x) / H.rx, uy = (v.y - H.c.y) / H.ry, uz = (v.z - H.c.z) / H.rz, az = Math.atan2(ux, uz), b = (1 - Math.cos(az)) / 2;
    let line = b < .5 ? front + (side - front) * (b / .5) : side + (back - side) * ((b - .5) / .5);     // forehead -> temples -> nape
    if ((style === 'long' || style === 'bob') && Math.abs(az) > 1.05) line = -9;                          // (sides and back all the way down)
    if (style === 'mohawk' && Math.abs(ux) > .28 && uy > line) { continue; }
    if (uy > line) keep.push(t);
  }
  const pos = new Float32Array(keep.length * 9); keep.forEach((t, i) => { for (let j = 0; j < 3; j++) pos.set([p.getX(t + j), p.getY(t + j), p.getZ(t + j)], i * 9 + j * 3); });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.computeVertexNormals();
  const cap = new THREE.Mesh(geo, M); cap.castShadow = true; g.add(cap);
  const add = (geo2, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo2, M); m.position.set(H.c.x + x * H.rx, H.c.y + y * H.ry, H.c.z + z * H.rz); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
  if (style === 'mohawk') add(new THREE.BoxGeometry(H.rx * .34, H.ry * .55, H.rz * 1.7), 0, 1.0, -.05, 0, 0, 0);
  if (style === 'buns') add(new THREE.SphereGeometry(H.rx * .42, 7, 5), 0, .95, -.55);
  if (style === 'curly') for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; add(new THREE.IcosahedronGeometry(H.rx * .34, 0), Math.sin(a) * .85, .55 + Math.cos(a * 2) * .1, Math.cos(a) * .7 - .1); }
  return g;
}
/** a beard painted into the face canvas, behind the features (style: true | 'full' | 'goatee' | 'moustache' | 'stubble') */
export function drawBeard(main, w, h, L, style, color) {
  if (!style) return; style = style === true ? 'full' : style;
  const Y = v => (1 - v) * h, X = u => u * w, mv = L.mouthV, ex = L.eyes, half = (ex[1][0] - ex[0][0]) * w;
  const tmp = drawBeard.c ??= document.createElement('canvas'); tmp.width = w; tmp.height = h; const x = tmp.getContext('2d');
  x.save(); x.fillStyle = color; x.globalAlpha = style === 'stubble' ? .38 : 1;
  const mw = half * .62, my = Y(mv), cx = X(.5);
  x.beginPath();
  if (style === 'moustache') { x.ellipse(cx, my - h * .045, mw * .95, h * .03, 0, 0, Math.PI * 2); }
  else if (style === 'goatee') { x.ellipse(cx, my - h * .045, mw * .9, h * .028, 0, 0, Math.PI * 2); x.moveTo(cx - mw * .55, my + h * .02); x.quadraticCurveTo(cx, my + h * .2, cx + mw * .55, my + h * .02); x.closePath(); }
  else { x.ellipse(cx, Y(mv - .05), half * .82, h * .15, 0, 0, Math.PI * 2); x.moveTo(cx + mw * 1.05, my - h * .035); x.ellipse(cx, my - h * .035, mw * 1.05, h * .035, 0, 0, Math.PI * 2); }   // chin beard + moustache, inside the face patch
  x.fill();
  // the mouth keeps a skin-coloured gap (a mouth drawn on a dark beard disappeared)
  x.globalCompositeOperation = 'destination-out'; x.globalAlpha = 1; x.beginPath(); x.ellipse(cx, my, mw * .78, h * .05 / (L.aspect ?? 1) * 1.2, 0, 0, Math.PI * 2); x.fill(); x.restore();
  main.save(); main.globalCompositeOperation = 'destination-over'; main.drawImage(tmp, 0, 0); main.restore();
}
/** hats / glasses / headset on the skull: built in character space */
export function wornOnHead(H, kind, color) {
  const g = new THREE.Group(); g.name = kind; const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .8, ...o });
  const add = (geo, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(H.c.x + x, H.c.y + y, H.c.z + z); m.rotation.x = rx; m.castShadow = true; g.add(m); return m; };
  const R = Math.max(H.rx, H.rz), eyeY = FACE.eyeY * H.ry, ez = Math.cos(FACE.eyeAz) * H.rz * 1.02 + .012, ex = Math.sin(FACE.eyeAz) * H.rx;
  if (kind === 'cap' || kind === 'police') { const c = color || (kind === 'police' ? '#1a2338' : '#c83232');
    const dome = add(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(c), 0, H.ry * .32, 0); dome.scale.set(H.rx * 1.14, H.ry * .78, H.rz * 1.14);
    add(new THREE.BoxGeometry(H.rx * 1.5, .012, H.rz * .75), M(c), 0, H.ry * .36, H.rz * 1.25);
    if (kind === 'police') add(new THREE.BoxGeometry(.05, .04, .01), M('#d8b542', { emissive: '#3a2a00' }), 0, H.ry * .62, H.rz * 1.1); }
  else if (kind === 'hat' || kind === 'tophat') { const c = color || '#1b1b1b', hh = kind === 'tophat' ? .2 : .1;
    add(new THREE.CylinderGeometry(R * 1.55, R * 1.55, .014, 14), M(c), 0, H.ry * .55, 0);
    add(new THREE.CylinderGeometry(R * 1.02, R * 1.12, hh + H.ry * .35, 12), M(c), 0, H.ry * .55 + (hh + H.ry * .35) / 2 - H.ry * .3, 0); }
  else if (kind === 'hardhat' || kind === 'helmet') { const c = color || (kind === 'hardhat' ? '#f2c200' : '#4f5d36');
    const dome = add(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(c), 0, H.ry * .2, 0); dome.scale.set(H.rx * 1.22, H.ry * 1.0, H.rz * 1.22);
    add(new THREE.CylinderGeometry(R * 1.32, R * 1.32, .014, 14), M(c), 0, H.ry * .22, 0); }
  else if (kind === 'wig') { const w = add(new THREE.SphereGeometry(1, 8, 6), M(color || '#e8e4dc'), 0, H.ry * .2, -H.rz * .15); w.scale.set(H.rx * 1.3, H.ry * 1.05, H.rz * 1.3); }
  else if (kind === 'glasses' || kind === 'shades') { const c = kind === 'shades' ? '#050505' : (color || '#1c1410');
    for (const s of [-1, 1]) { if (kind === 'shades') add(new THREE.BoxGeometry(ex * 1.05, ex * .62, .006), M(c, { roughness: .2 }), s * ex, eyeY, ez);
      else add(new THREE.TorusGeometry(ex * .5, .005, 4, 12), M(c), s * ex, eyeY, ez);
      const arm = add(new THREE.BoxGeometry(.006, .006, H.rz * .9), M(c), s * H.rx * 1.02, eyeY, ez - H.rz * .5); void arm; }
    add(new THREE.BoxGeometry(ex * .5, .007, .007), M(c), 0, eyeY + .004, ez + .004); }
  else if (kind === 'headset') { const band = add(new THREE.TorusGeometry(H.rx * 1.12, .012, 4, 14, Math.PI), M('#222'), 0, H.ry * .05, 0); band.rotation.set(0, Math.PI / 2, 0);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(.025, .06, .06), M('#222'), s * H.rx * 1.1, 0, 0); }
  return g;
}
/** the worst intrusion of a worn group into the skull (char space): > 0 = cm inside */
export function intrusion(H, g) {
  let worst = 0; const v = new THREE.Vector3(); g.updateMatrixWorld(true);
  g.traverse(m => { if (!m.isMesh) return; const p = m.geometry.attributes.position; const mw = m.matrix.clone(); for (let x = m.parent; x && x !== g; x = x.parent) mw.premultiply(x.matrix);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(mw);
      const uy = (v.y - H.c.y) / H.ry, az = Math.atan2((v.x - H.c.x) / H.rx, (v.z - H.c.z) / H.rz); if (Math.abs(az) > FACE.span * .85 || uy < FACE.yb || uy > FACE.yt) continue;   // only the face matters (hair entering the skull at the back is hidden)
      const k = skullValue(H, v); if (k < .97) worst = Math.max(worst, (1 - k) * Math.min(H.rx, H.rz)); } });
  return worst;
}
export { clamp };
