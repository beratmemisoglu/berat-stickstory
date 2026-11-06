// module.recon.prison-props v1 - prison set pieces from the two prison shot matches: a guard tower with lit windows (a
// painted guard silhouette, not an emissive room box), a precast perimeter wall with razor wire, cell bars, a steel
// toilet and sink unit, a rusty bunk bed with rumpled blankets, a bare bulb on a sagging wire, a rope.
// Contract: THREE from engine.js; part/std/rbox from lib/crime.js; hh from lib/crimeover.js; canvas-materials, metric-box,
// cloth-drape from the library (copied next to this module).
import { THREE } from '../../engine.js';
import { part, std, rbox } from '../../lib/crime.js';
import { hh } from '../../lib/crimeover.js';
import { tiled, panelConcrete, canvasTex } from '../module.recon.canvas-materials/index.js';
import { drape, heap, lumpyBox } from '../module.any.cloth-drape/index.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const cyl = (r0, r1, h, n = 16, open = false) => new THREE.CylinderGeometry(r0, r1, h, n, 1, open);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const glowMat = (c, x = {}) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...x });
const hung = m => { m.userData.noContact = true; return m; };

const M = {};
export function prisonMaterials() {
  if (M.ok) return M; M.ok = true;
  M.iron = std(0x2a2724, .55, { metalness: .6 }); M.steel = std(0x9a968e, .35, { metalness: .9, envMapIntensity: 2.5 }); M.rust = std(0x3b3833, .5, { metalness: .6 });
  M.cloth = std(0x6a5f52, .95, { side: THREE.DoubleSide }); M.clothDk = std(0x4a453e, .95); M.mattress = std(0x7e7a72, .9); M.rope = std(0xb9a684, .95);
  return M;
}

// guardTower(S, parent, o): a concrete tower (shaft 2.15 m, cab 2.25 m, roof slab 3 m wide, ~5.45 m tall), two lit cab
// windows painted with the warm room and a guard's dark shape, antennas, a warm light in front of the cab.
// o: pos [x, y, z] (the base centre), ry, scale (1), lean (radians about z, pivoted on the edge that stays on the ground:
// an embedded base reads as FLOATING to the contact check), pivot (1.18: the pivot edge's x offset), windowGlow, conc.
export function guardTower(S, parent, o = {}) {
  const s = o.scale ?? 1, lean = o.lean ?? 0, piv = o.pivot ?? 1.18, tg = new THREE.Group(), g = new THREE.Group(); g.name = 'guard tower';
  tg.position.set((o.pos?.[0] ?? 0) + (lean ? piv : 0), o.pos?.[1] ?? 0, o.pos?.[2] ?? 0); tg.rotation.z = lean; g.position.x = lean ? -piv : 0; g.rotation.y = o.ry ?? 0; g.scale.setScalar(s); tg.add(g); parent.add(tg);
  const c = o.conc ?? tiled(panelConcrete(), 2.6, 4, { unit: 1.6, color: 0xc8ccd2, rough: .95 });
  part(box(2.15, 3.1, 2.15), c, [0, 1.55, 0], null, g, 'tower shaft');
  part(box(2.25, 2.15, 2.25), c, [0, 4.07, 0], null, g, 'tower cab');
  const winTex = guard => canvasTex(256, 128, (x, W, H) => { const gr = x.createRadialGradient(W * .55, H * .35, 4, W * .55, H * .4, W * .6); gr.addColorStop(0, '#ffd9a0'); gr.addColorStop(.5, '#c88848'); gr.addColorStop(1, '#4a2a14');
    x.fillStyle = gr; x.fillRect(0, 0, W, H); x.fillStyle = '#2a2a2c'; x.fillRect(0, 0, W, 6); x.fillRect(0, H - 6, W, 6); x.fillRect(0, 0, 6, H); x.fillRect(W - 6, 0, 6, H); x.fillRect(W / 2 - 3, 0, 6, H);
    if (guard) { x.fillStyle = '#1a120c'; x.beginPath(); x.ellipse(W * .62, H * .42, 13, 15, 0, 0, 7); x.fill(); x.beginPath(); x.moveTo(W * .5, H); x.quadraticCurveTo(W * .52, H * .55, W * .62, H * .58); x.quadraticCurveTo(W * .74, H * .55, W * .76, H); x.fill(); } });
  const wm = guard => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: winTex(guard), emissiveIntensity: o.windowGlow ?? .75 });
  part(new THREE.PlaneGeometry(1.8, .95), wm(true), [0, 4.5, 1.145], null, g, 'cab window').userData.noContact = true;
  part(new THREE.PlaneGeometry(1.7, .95), wm(false), [-1.145, 4.5, 0], [0, -Math.PI / 2, 0], g, 'cab window').userData.noContact = true;
  part(box(3.0, .3, 3.0), c, [0, 5.3, 0], null, g, 'tower roof');
  for (const x of [-.8, .9]) part(cyl(.02, .02, .7, 6), std(0x222222), [x, 5.7, -.5], null, g, 'antenna');
  const pl = new THREE.PointLight(0xffb060, 3, 3, 1.6); g.updateWorldMatrix(true, false); pl.position.copy(g.localToWorld(V(0, 4.5, 2.2))); S.scene.add(pl);
  return tg;
}
// prisonWall(S, parent, o): precast concrete panels (with a thickened foot course and a cap) along x from x0 to x1, the
// panels' front face at z, Y brackets at every joint and a razor-wire coil + two tension wires on top.
// o: x0, x1, z, h (2.45), t (.35), panel (3.2), y (0). Returns { panels }.
export function prisonWall(S, parent, o = {}) {
  const x0 = o.x0 ?? 0, x1 = o.x1 ?? 10, z = o.z ?? 0, H = o.h ?? 2.45, T = o.t ?? .35, P = o.panel ?? 3.2, y = o.y ?? 0, panels = [];
  const conc = w => tiled(panelConcrete(), w, H, { color: 0xd0ccc8, rough: .88 }), concLow = w => tiled(panelConcrete(), w, .8, { color: 0xbcb8b4, rough: .9 });
  for (let x = x0; x < x1 - .1; x += P) { const w = Math.min(P, x1 - x) - .03;
    panels.push(part(box(w, H, T), conc(w), [x + w / 2, y + H / 2, z - T / 2], null, parent, 'wall panel'));
    part(box(w, .8, T + .44), concLow(w), [x + w / 2, y + .4, z - T / 2], null, parent, 'wall foot');
    part(box(w + .02, .08, T + .06), conc(w), [x + w / 2, y + H + .04, z - T / 2], null, parent, 'wall cap'); }
  const steel = std(0x9aa0a8, .35, { metalness: .85 });
  for (let x = x0 + .15; x < x1; x += P) for (const s of [-1, 1]) part(cyl(.018, .018, .7, 6), std(0x2a2c30, .5, { metalness: .6 }), [x, y + H + .08 + .3, z - T / 2 + s * .15], [s * .45, 0, 0], parent, 'wire bracket');
  const turns = (x1 - x0) / .22, pts = [];
  for (let i = 0; i <= turns * 18; i++) { const a = i / 18 * Math.PI * 2, x = x0 + i / 18 * .22; pts.push(V(x + Math.sin(a) * .05, y + H + .4 + Math.cos(a) * .26, z - T / 2 + Math.sin(a) * .26)); }
  hung(part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, .011, 5), new THREE.MeshStandardMaterial({ color: 0xd8dde4, roughness: .3, metalness: .9, emissive: 0x2a3038, emissiveIntensity: 1 }), [0, 0, 0], null, parent, 'razor wire'));
  for (const s of [-1, 1]) hung(part(new THREE.CylinderGeometry(.006, .006, x1 - x0, 4), steel, [(x0 + x1) / 2, y + H + .55, z - T / 2 + s * .22], [0, 0, Math.PI / 2], parent, 'tension wire'));
  return { panels };
}
// cellBars(parent, o): a barred cell door in a wall plane x = o.x from z0 to z1: 11 round bars (2.55 m), three flat cross
// bars, a frame and a lock box. Returns the group.
export function cellBars(parent, o = {}) {
  const C = prisonMaterials(), g = new THREE.Group(); g.name = 'cell bars'; parent.add(g); const x = o.x ?? 0, z0 = o.z0 ?? 0, z1 = o.z1 ?? -2, n = o.n ?? 10;
  for (let i = 0; i <= n; i++) { const z = z0 + (z1 - z0) * i / n; part(cyl(.017, .017, 2.55, 10), C.iron, [x, 1.33, z], null, g, 'bar'); }
  for (const y of [.12, 1.25, 2.52]) part(box(.03, .06, Math.abs(z0 - z1) + .04), C.iron, [x, y, (z0 + z1) / 2], null, g, 'cross bar');
  for (const z of [z0, z1]) part(box(.05, 2.55, .05), C.iron, [x, 1.33, z], null, g, 'door frame');
  part(box(.08, .2, .14), C.rust, [x + .02, 1.32, z0 - .2 * Math.sign(z0 - z1 || 1)], null, g, 'lock box');
  return g;
}
// bunkBed(parent, o): a rusty tube-frame bunk (x0..x1 along x, z0..z1 deep, 1.86 m tall), two thin lumpy mattresses
// (tops at .555 and 1.435), blankets laid on them hanging over the front edge, heaps, pillows. Returns { g, solids }.
export function bunkBed(parent, o = {}) {
  const C = prisonMaterials(), g = new THREE.Group(); g.name = 'bunk bed'; parent.add(g); const x0 = o.x0 ?? -1.25, x1 = o.x1 ?? 1.25, z0 = o.z0 ?? .45, z1 = o.z1 ?? -.45, H = 1.86, solids = [];
  for (const x of [x0, x1]) for (const z of [z0, z1]) part(box(.06, H, .06), C.rust, [x, H / 2, z], null, g, 'bunk post');
  for (const y of [.42, 1.3]) { for (const z of [z0, z1]) part(box(x1 - x0, .06, .035), C.rust, [(x0 + x1) / 2, y, z], null, g, 'bunk rail');
    for (const x of [x0, x1]) part(box(.035, .06, z0 - z1), C.rust, [x, y, (z0 + z1) / 2], null, g, 'bunk end rail');
    solids.push(part(lumpyBox(x1 - x0 - .06, .09, z0 - z1 - .04, y * 7, .012), C.mattress, [(x0 + x1) / 2, y + .075, (z0 + z1) / 2], null, g, 'mattress')); }
  for (const x of [x0, x1]) part(box(.03, .03, z0 - z1), C.rust, [x, H - .02, (z0 + z1) / 2], null, g, 'bunk head rail');
  const dz = (z0 - z1) / 2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  hung(part(drape(1.25, .9 + .45, dz, 3, .2, .4), C.cloth, [cx + .4, .555, cz], null, g, 'lower blanket'));
  hung(part(drape(1.3, .9 + .4, dz, 7, .22, .3), C.cloth, [cx + .5, 1.435, cz], null, g, 'upper blanket'));
  hung(part(heap(.36, .09, .26, 5), C.cloth, [cx + .7, .54, cz + .1], [0, .3, 0], g, 'blanket heap'));
  hung(part(heap(.32, .08, .24, 9), C.cloth, [cx + .6, 1.42, cz + .05], [0, -.2, 0], g, 'blanket heap'));
  for (const [x, y, s] of [[x0 + .35, .6, 0], [x0 + .73, .63, 1], [x0 + .4, 1.48, 2]]) hung(part(lumpyBox(.42, .16, .34, 11 + s, .03), C.mattress, [x, y, cz + .08 + s * .05], [0, 0, .12 * (s - 1)], g, 'pillow'));
  return { g, solids };
}
// steelToilet(parent, at, o): a stainless prison toilet (lathe bowl ~.47 m high) + rim. Returns { g, solids }.
export function steelToilet(parent, at, o = {}) {
  const C = prisonMaterials(), g = new THREE.Group(); g.name = 'toilet'; g.position.set(...at); g.rotation.y = o.ry ?? 0; parent.add(g);
  const prof = [[0, 0], [.13, 0], [.12, .04], [.11, .14], [.13, .22], [.18, .3], [.215, .37], [.22, .4], [.18, .405], [.12, .3], [0, .28]].map(([x, y]) => new THREE.Vector2(x, y));
  const bowl = part(new THREE.LatheGeometry(prof, 32), C.steel, [0, 0, 0], null, g, 'toilet'); bowl.scale.set(1.45, 1.15, 1.15);
  part(cyl(.2, .2, .025, 32), C.steel, [0, .47, 0], null, g, 'toilet rim').scale.set(1.45, 1, 1.15);
  return { g, solids: [bowl] };
}
// sinkUnit(parent, at, o): a steel sink cabinet against a wall (front facing -x by default: o.ry turns it), tap, a stain.
export function sinkUnit(parent, at, o = {}) {
  const C = prisonMaterials(), g = new THREE.Group(); g.name = 'sink unit'; g.position.set(...at); g.rotation.y = o.ry ?? 0; parent.add(g);
  const sink = part(box(.4, 1.12, .5), std(0xa8a39a, .35, { metalness: .75 }), [0, .56, 0], null, g, 'sink unit');
  part(box(.38, .04, .46), C.steel, [0, 1.13, 0], null, g, 'sink top'); part(cyl(.012, .012, .14, 8), C.steel, [-.02, 1.2, -.05], null, g, 'tap');
  part(box(.02, .3, .26), C.rust, [-.21, .3, 0], null, g, 'sink stain');
  return { g, solids: [sink] };
}
// hangingBulb(S, parent, wirePts, at, o): a lamp wire sagging along points and a bare bulb on a short cord at `at`, with a
// shadow-casting warm point light (o.i 16, o.d 6). Returns the light.
export function hangingBulb(S, parent, wirePts, at, o = {}) {
  hung(part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wirePts.map(p => p.isVector3 ? p : V(...p))), 160, .008, 6), std(0x0e0e0e, .5), [0, 0, 0], null, parent, 'lamp wire'));
  const [bx, by, bz] = at;
  hung(part(cyl(.006, .006, .2, 6), std(0x0e0e0e, .5), [bx, by + .12, bz], null, parent, 'bulb cord')); hung(part(cyl(.025, .025, .06, 12), std(0x1a1a1a, .5), [bx, by + .06, bz], null, parent, 'bulb socket'));
  hung(part(new THREE.SphereGeometry(.05, 16, 12), glowMat(0xfff2c8), [bx, by, bz], null, parent, 'bulb'));
  const pl = new THREE.PointLight(o.color ?? 0xffd0a0, o.i ?? 16, o.d ?? 6, 1.6); parent.updateWorldMatrix(true, false); pl.position.copy(parent.localToWorld(V(bx, by - .05, bz + .05)));
  if (o.shadow !== false) { pl.castShadow = true; pl.shadow.mapSize.set(1024, 1024); pl.shadow.bias = -.002; } S.scene.add(pl); return pl;
}
// rope(parent, pts, o): a rope along points (o.r .018), with an optional closed loop (o.loop points) and a knot (o.knot [x,y,z])
export function rope(parent, pts, o = {}) {
  const C = prisonMaterials(), r = hung(part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => p.isVector3 ? p : V(...p))), 120, o.r ?? .018, 8), C.rope, [0, 0, 0], null, parent, 'rope'));
  if (o.loop) hung(part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(o.loop.map(p => p.isVector3 ? p : V(...p)), true), 60, (o.r ?? .018) + .002, 8, true), C.rope, [0, 0, 0], null, parent, 'rope loop'));
  if (o.knot) hung(part(new THREE.SphereGeometry(.04, 12, 10), C.rope, o.knot, null, parent, 'rope knot'));
  return r;
}
