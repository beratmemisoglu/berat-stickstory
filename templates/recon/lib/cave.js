// v8 Tham Luang assets. People are the CC0 Quaternius mannequin (library.actor); dive tanks, torch and helmets are
// CC-BY models (src/assets/models/CREDITS.json). Procedural here: rock (noise-displaced), the cave entrance, bicycles,
// trees, the mountain cross-section from real elevation, chamber and tunnel cutaways, full-face mask, torch beam,
// and the 'carry' helpers that put props on a skinned body every frame.
import { THREE, C, selectable } from '../engine.js';
import { box, mesh, hash } from '../models.js';
import { heightAt } from './world.js';
import { mergeVertices } from '../vendor/jsm/utils/BufferGeometryUtils.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const std = (c, r = .9, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...x });
export const ROCK = std(0xbcb7ad, .95), ROCK_D = std(0x8e897f, .95), MUD = std(0xa59a86, 1);
// smooth value noise (deterministic)
const n3 = (x, y, z) => { const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), f = t => t * t * (3 - 2 * t), u = f(x - i), v = f(y - j), w = f(z - k);
  const h = (a, b, c) => hash(a * 57 + b * 113 + c * 271, 7); let s = 0;
  for (const [a, wa] of [[0, 1 - u], [1, u]]) for (const [b, wb] of [[0, 1 - v], [1, v]]) for (const [c, wc] of [[0, 1 - w], [1, w]]) s += h(i + a, j + b, k + c) * wa * wb * wc; return s; };
export const fbm = (x, y, z) => n3(x, y, z) * .55 + n3(x * 2.1, y * 2.1, z * 2.1) * .3 + n3(x * 4.3, y * 4.3, z * 4.3) * .15;
// displace a geometry's vertices along their normals by fbm (amp in metres, freq per metre)
// Welds first: displacing an unwelded mesh along per-face normals tore every shared corner apart (grid cracks, v8).
export function roughen(g, amp, freq, seed = 0) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  g = mergeVertices(g, 1e-4); g.computeVertexNormals(); const p = g.attributes.position, nn = g.attributes.normal, v = V3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const d = (fbm(v.x * freq + seed, v.y * freq, v.z * freq) - .5) * 2 * amp;
    p.setXYZ(i, v.x + nn.getX(i) * d, v.y + nn.getY(i) * d, v.z + nn.getZ(i) * d); }
  g.computeVertexNormals(); return g;
}

// ---------- the cave entrance: a limestone cliff with a dark arched mouth, valley floor, trees, the boys' bicycles ----------
export function caveEntrance(parent) {
  const g = selectable(new THREE.Group(), 'cave entrance', 'place'); parent.add(g);
  const ground = new THREE.Mesh(roughen(new THREE.PlaneGeometry(120, 120, 120, 120).rotateX(-Math.PI / 2), .25, .15), MUD); ground.receiveShadow = true; ground.userData.ground = true; g.add(ground);
  // cliff: a long displaced slab behind the mouth (mouth faces +z), height ~22 m
  const cliff = new THREE.Mesh(roughen(roughen(new THREE.BoxGeometry(70, 26, 14, 140, 52, 28), 2.4, .07, 3), .45, .45, 11), ROCK);   // big folds + limestone texture
  cliff.position.set(0, 11, -9); cliff.castShadow = cliff.receiveShadow = true; g.add(cliff);
  // the mouth: an arch-shaped dark tunnel cut into the cliff face (its own geometry in front of the cliff, so nothing is coplanar)
  const arch = new THREE.Shape(); arch.moveTo(-4.5, 0); arch.lineTo(-4.5, 3.5); arch.absarc(0, 3.5, 4.5, Math.PI, 0, true); arch.lineTo(4.5, 0); arch.lineTo(-4.5, 0);
  const mouth = new THREE.Mesh(new THREE.ExtrudeGeometry(arch, { depth: 8, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: 0x1c1d20 })); mouth.position.set(0, 0, -6.5); g.add(mouth);
  const rim = new THREE.Mesh(roughen(new THREE.TorusGeometry(5.2, 1.1, 10, 40, Math.PI), .5, .4, 9), ROCK_D); rim.position.set(0, 3.5, -1.6); rim.castShadow = true; g.add(rim);
  for (const s of [-1, 1]) { const j = new THREE.Mesh(roughen(new THREE.BoxGeometry(2.2, 3.6, 2.2, 6, 6, 6), .4, .5, s * 5), ROCK_D); j.position.set(s * 5.2, 1.7, -1.6); j.castShadow = true; g.add(j); }
  // trees: clay trunks + clustered crowns, kept clear of the path (x in -5..5 near the mouth)
  for (let i = 0; i < 60; i++) { const a = hash(i, 1), x = (a - .5) * 100, z = -1 + hash(i, 2) * 26; if (Math.abs(x) < 16) continue;   // the path and the camera corridor stay clear
    const t = new THREE.Group(); t.position.set(x, 0, z); g.add(t); const h = 6 + hash(i, 3) * 7;
    mesh(new THREE.CylinderGeometry(.2, .32, h, 8), std(0x9b8f7c), [0, h / 2, 0], [0, 0, 0], t);
    for (let k = 0; k < 4; k++) mesh(new THREE.IcosahedronGeometry(1.6 + hash(i, 4 + k) * 1.4, 1), std(0xc7cdb7, .95, { flatShading: true }), [(hash(i, 8 + k) - .5) * 2.4, h + (hash(i, 12 + k) - .3) * 1.8, (hash(i, 16 + k) - .5) * 2.4], [0, 0, 0], t); }
  for (let i = 0; i < 26; i++) { const x = (hash(i, 31) - .5) * 64, h = 3 + hash(i, 32) * 4, t = new THREE.Group(); t.position.set(x, 23 + hash(i, 33) * 1.5, -9 + (hash(i, 34) - .5) * 9); g.add(t);
    for (let k = 0; k < 3; k++) mesh(new THREE.IcosahedronGeometry(1.8 + hash(i, 35 + k) * 1.4, 1), std(0xc7cdb7, .95, { flatShading: true }), [(hash(i, 40 + k) - .5) * 3, hash(i, 44 + k) * 1.5, (hash(i, 48 + k) - .5) * 3], [0, 0, 0], t); }
  // bicycles leaning in a row by the mouth (found there on 23 June)
  for (let i = 0; i < 11; i++) { const b = bicycle(g); b.position.set(-8.5 + (i % 6) * .55, 0, 5 + Math.floor(i / 6) * 2.2); b.rotation.set(0, Math.PI / 2 + (hash(i, 20) - .5) * .3, .22); }
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}
export function bicycle(parent) {
  const g = selectable(new THREE.Group(), 'bicycle', 'vehicle'); parent.add(g); const frame = std(C.accent ?? 0x3d6fd6, .6), dark = std(0x33373c, .7);
  for (const x of [-.52, .52]) mesh(new THREE.TorusGeometry(.33, .025, 8, 28), dark, [x, .35, 0], [0, 0, 0], g);
  const tube = (a, b, r = .018) => { const d = b.clone().sub(a), m = mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), frame, [0, 0, 0], [0, 0, 0], g);
    m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); };
  const P = { rw: V3(-.52, .35, 0), fw: V3(.52, .35, 0), bb: V3(-.05, .32, 0), st: V3(-.18, .78, 0), ht: V3(.38, .82, 0) };
  tube(P.rw, P.bb); tube(P.bb, P.st); tube(P.st, P.ht); tube(P.bb, P.ht); tube(P.rw, P.st); tube(P.ht, P.fw); tube(P.ht, V3(.34, .98, 0));
  mesh(box(.06, .02, .5, .01), dark, [.34, .98, 0], [0, 0, 0], g); mesh(box(.22, .04, .1, .02), dark, [-.2, .82, 0], [0, 0, 0], g);
  return g;
}

// ---------- mountain cross-section along a bearing from the entrance, from the real relief (metres; 1 unit = 100 m) ----------
// The cave is drawn as a tube just proud of the section's front face (z = +W/2): schematic, its route simplified.
export function crossSection(parent, o = {}) {
  const g = selectable(new THREE.Group(), 'cross-section', 'diagram'); parent.add(g); const L = o.km ?? 4.6, brg = (o.bearing ?? 218) * Math.PI / 180, W = o.depth ?? 3, base = 380, N = 160;
  const pts = []; for (let i = 0; i <= N; i++) { const d = L * i / N, h = heightAt([Math.sin(brg) * d, Math.cos(brg) * d]); pts.push([d * 10, (h - base) / 100]); }
  const sh = new THREE.Shape(); sh.moveTo(0, -.6); pts.forEach(([x, y]) => sh.lineTo(x, Math.max(.3, y))); sh.lineTo(L * 10, -.6); sh.lineTo(0, -.6);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false, curveSegments: 1 }); geo.translate(0, 0, -W / 2);
  const m = new THREE.Mesh(geo, std(0xd6d0c4, .95, { flatShading: true })); m.castShadow = m.receiveShadow = true; g.add(m);
  const yAt = x => { const i = Math.min(N - 1, Math.max(0, Math.floor(x / (L * 10) * N))), f = x / (L * 10) * N - i; return pts[i][1] * (1 - f) + pts[i + 1][1] * f; };
  // strata lines on the front face (thin raised strips, 2 cm proud)
  for (let k = 1; k < 7; k++) { const y = k * 1.1 - .3; let x0 = null;                       // strata: only where the rock is above the line
    for (let i = 0; i <= 200; i++) { const x = L * 10 * i / 200, inside = yAt(x) > y + .15 && i < 200;
      if (inside && x0 === null) x0 = x; if (!inside && x0 !== null) { if (x - x0 > .3) mesh(box(x - x0, .03, .02, .005), std(0xbab3a6), [(x0 + x) / 2, y, W / 2 + .012], [0, 0, 0], g); x0 = null; } } }
  // the cave route (elevation ~ 430-470 m), with two low sumps that flood first
  const cave = []; for (let i = 0; i <= 60; i++) { const u = i / 60, x = u * L * 10 * .92 + .3, y = (440 - base) / 100 + .35 * Math.sin(u * 9.5) * Math.exp(-u * .5) + u * .25; cave.push(V3(x, y, W / 2 + .06)); }
  const curve = new THREE.CatmullRomCurve3(cave), tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 240, .2, 10), new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: .8 })); g.add(tube);
  const water = new THREE.Mesh(new THREE.TubeGeometry(curve, 240, .235, 10), new THREE.MeshStandardMaterial({ color: 0x3f7fd6, roughness: .4 })); g.add(water);
  water.geometry.setDrawRange(0, 0);
  return { group: g, curve, water, L, pts, W, setFlood(u0, u1) { const s = Math.floor(u0 * 240), e = Math.floor(u1 * 240); water.geometry.setDrawRange(s * 10 * 6, Math.max(0, e - s) * 10 * 6); } };
}

// ---------- chamber cutaway: a rock vault (back half), a sloping mud ledge (+x side) and a pool (-x side) ----------
export function chamber(parent) {
  const g = selectable(new THREE.Group(), 'cave chamber', 'place'); parent.add(g);
  const vault = new THREE.Mesh(roughen(roughen(new THREE.SphereGeometry(7, 96, 36, Math.PI, Math.PI, 0, Math.PI / 2), .6, .3, 2), .18, 1.4, 6), std(0x8f8a80, .95, { side: THREE.DoubleSide }));   // phi pi..2pi = the back half (z <= 0)
  vault.scale.set(1.3, .75, 1); g.add(vault);
  const cut = new THREE.Mesh(new THREE.TorusGeometry(7, .25, 8, 64, Math.PI), std(0x6f6b64, .9)); cut.scale.set(1.3, .75, 1); g.add(cut);   // the cut edge of the section
  const floor = new THREE.Mesh(roughen(new THREE.CircleGeometry(9.5, 64, 0, Math.PI * 2).rotateX(-Math.PI / 2), .08, .6, 4), MUD); floor.position.y = -.05; g.add(floor);
  // (tried: a see-through pool over a basin with a hole cut in the floor - the cut left jagged slivers; the pool stays opaque and surfacing divers are shown from the chest up)
  // ledge: a sloped mound on the right, top ~1.3 m above the floor
  const ledge = new THREE.Mesh(roughen(new THREE.SphereGeometry(4.2, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), .25, .5, 6), MUD); ledge.scale.set(1.25, .32, .8); ledge.position.set(3.4, -.05, -2.2); g.add(ledge);
  // pool: a recessed water surface on the left, 30 cm below the floor (a rim ring of rock around it: different heights, never coplanar)
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), new THREE.MeshStandardMaterial({ color: 0x5d7a90, roughness: .15, metalness: .1 })); pool.rotation.x = -Math.PI / 2; pool.position.set(-4.2, .06, -1.2); g.add(pool);   // above the floor's bumps, inside its rock rim
  const rim = new THREE.Mesh(roughen(new THREE.TorusGeometry(3.25, .35, 8, 40), .12, .9, 8), ROCK_D); rim.rotation.x = Math.PI / 2; rim.position.set(-4.2, .02, -1.2); g.add(rim);
  for (let i = 0; i < 12; i++) { const x = (hash(i, 3) - .5) * 12, z = -1 - hash(i, 5) * 4.5, roof = 5.25 * Math.sqrt(Math.max(0, 1 - (x / 9.1) ** 2 - (z / 7) ** 2)), h = .6 + hash(i, 2) * 1.2;
    mesh(new THREE.ConeGeometry(.1 + hash(i, 1) * .12, h, 7), ROCK_D, [x, roof - .25 - h / 2, z], [Math.PI, 0, 0], g); }   // stalactites hang from the vault's inner surface
  g.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });
  return { group: g, ledgeTop: x => .05 + 1.3 * Math.max(0, 1 - ((x - 3.4) / 5.2) ** 2), poolPos: V3(-4.2, .06, -1.2) };
}

// ---------- flooded tunnel cutaway along +x: the back half of an irregular tube (one smooth surface), cut edge toward +z ----------
// o.pinch: x of a restriction (the passage narrows to ~30 % of its height there). Water: a faint blue 'aquarium glass' at the cut.
export function tunnel(parent, o = {}) {
  const g = selectable(new THREE.Group(), 'tunnel', 'place'); parent.add(g); const L = o.length ?? 60, r0 = o.radius ?? 1.25, pinch = o.pinch ?? null, NX = Math.round(L * 6), NA = 40;
  const rAt = (x, a) => { let r = r0 * (1 + .14 * Math.sin(x * .7) + .08 * Math.sin(x * 1.9 + 1)); if (pinch != null) r *= 1 - .68 * Math.exp(-(((x - pinch) / 1.4) ** 2));
    return r * (1 + .12 * (fbm(x * .8, a * 1.3, 3) - .5) * 2); };
  const mid = x => .25 * Math.sin(x * .33), pos = [], idx = [];
  for (let i = 0; i <= NX; i++) { const x = L * i / NX; for (let j = 0; j <= NA; j++) { const a = Math.PI * j / NA, r = rAt(x, a);   // a: 0 = floor at the cut, pi = ceiling at the cut
      pos.push(x, mid(x) - Math.cos(a) * r * .95, -Math.sin(a) * r); } }
  for (let i = 0; i < NX; i++) for (let j = 0; j < NA; j++) { const A = i * (NA + 1) + j, B = A + NA + 1; idx.push(A, B, A + 1, A + 1, B, B + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const wall = new THREE.Mesh(geo, std(o.color ?? 0x8f8a80, .95, { side: THREE.DoubleSide })); wall.receiveShadow = wall.castShadow = true; g.add(wall);
  // the cut edges (floor and ceiling lips) as thick rims so the section reads as solid rock
  for (const a of [0, Math.PI]) { const c = new THREE.CatmullRomCurve3(Array.from({ length: 121 }, (_, i) => { const x = L * i / 120, r = rAt(x, a); return V3(x, mid(x) - Math.cos(a) * r * .95 - Math.cos(a) * .25, .02); }));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 240, .28, 8), std(0x6f6b64, .9))); }
  // solid rock above the ceiling and below the floor (the cut face, lighter than the tunnel walls), so the section sits in a mountain
  for (const a of [0, Math.PI]) { const sh = new THREE.Shape(), far = a ? 9 : -9; sh.moveTo(0, far);
    for (let i = 0; i <= 160; i++) { const x = L * i / 160; sh.lineTo(x, mid(x) - Math.cos(a) * rAt(x, a) * .95 - Math.cos(a) * .2); }
    sh.lineTo(L, far); sh.lineTo(0, far);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 4, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -4), std(0xb3ada1, .95)); m.receiveShadow = true; g.add(m); }
  // silt drifting in the water (the cave is flooded: this is what reads as 'underwater')
  const NS = 500, silt = new THREE.InstancedMesh(new THREE.SphereGeometry(.02, 6, 4), new THREE.MeshBasicMaterial({ color: 0xd9d2bf, transparent: true, opacity: .6 }), NS), M4 = new THREE.Matrix4();
  for (let i = 0; i < NS; i++) { const x = hash(i, 1) * L, a = hash(i, 2) * Math.PI, r = rAt(x, a) * .8 * Math.sqrt(hash(i, 3));
    silt.setMatrixAt(i, M4.makeTranslation(x, mid(x) - Math.cos(a) * r, -Math.sin(a) * r * .9 + .05)); }
  g.add(silt);
  return { group: g, hAt: x => 2 * rAt(x, Math.PI / 2) * .95, rAt, L, mid };
}

// ---------- full-face dive mask (oval visor + rubber skirt + regulator), ~0.25 m, visor facing +z ----------
export function faceMask(parent) {
  const g = selectable(new THREE.Group(), 'face mask', 'prop'); parent.add(g);
  const skirt = new THREE.Mesh(new THREE.SphereGeometry(.13, 24, 16, 0, Math.PI * 2, 0, Math.PI * .55), std(0x3a3e44, .7)); skirt.rotation.x = Math.PI / 2; skirt.scale.set(1, .6, 1.25); g.add(skirt);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(.12, 24, 16, 0, Math.PI * 2, 0, Math.PI * .35), std(0xcfe0ea, .1, { metalness: .2 })); visor.rotation.x = Math.PI / 2; visor.scale.set(.95, .55, 1.15); visor.position.z = .02; g.add(visor);
  mesh(new THREE.CylinderGeometry(.035, .04, .05, 16), std(0x2c3035, .6), [0, -.09, .08], [Math.PI / 2, 0, 0], g);
  return g;
}
// ---------- torch beam: a soft visible cone (additive, no depth write) along +z, with a spotlight ----------
export function torchBeam(parent, o = {}) {
  const g = new THREE.Group(); parent.add(g); const len = o.length ?? 5, r = o.radius ?? 1.1;
  const cg = new THREE.ConeGeometry(r, len, 32, 1, true); cg.translate(0, -len / 2, 0); cg.rotateX(-Math.PI / 2);
  const cone = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0xfff6dc, transparent: true, opacity: o.opacity ?? .1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); g.add(cone);
  const sp = new THREE.SpotLight(0xfff2d6, o.intensity ?? 30, len * 2.2, .45, .6, 1.2); sp.position.set(0, 0, 0); sp.target.position.set(0, 0, 1); g.add(sp, sp.target);
  return g;
}

// ---------- props on a skinned body, every frame: body frame from pelvis/neck/shoulders ----------
// frame(a) -> { up: pelvis->neck, side: left->right shoulder, back: away from the face, chest point }
export function bodyFrame(a) {
  const w = n => a.bone(n).getWorldPosition(V3()); const pel = w('pelvis'), nk = w('neck_01'), l = w('upperarm_l'), r = w('upperarm_r'), hd = w('Head'), sp = w('spine_03');
  const up = nk.clone().sub(pel).normalize(), side = r.clone().sub(l).normalize(), back = side.clone().cross(up).normalize();   // (up x side pointed out of the chest)
  return { up, side, back, chest: sp, head: hd, pelvis: pel };
}
export function wear(obj, F, where, o = {}) {           // place obj (its +y along the body, +z away from the back) at a body point
  const M = new THREE.Matrix4().makeBasis(F.side, F.up, F.back); obj.quaternion.setFromRotationMatrix(M);
  const p = (where === 'back' ? F.chest.clone().addScaledVector(F.back, o.off ?? .2) : F.head.clone().addScaledVector(F.back, -(o.off ?? .1)));
  obj.position.copy(p.addScaledVector(F.up, o.up ?? 0)); if (o.flip) obj.rotateY(Math.PI);
}
