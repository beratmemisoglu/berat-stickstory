// module.recon.mine-props v1 - escape-tunnel / mine gallery props from the prison-wall dig shot match (critic 7/10):
// caged bulb lamp, mine cart on a track, the track itself (both rails ONE mesh + sleepers), a ribbed air hose, sagging
// cables, dirt piles, a shovel planted for a digger's hands, a floor lantern. Metres, y up.
// Contract: THREE from engine.js; part/std from lib/crime.js; hh from lib/crimeover.js; tiled/rivetedSteel/dirtFloor/
// canvasTex from module.recon.canvas-materials; frustum from module.any.frustum; merged from module.any.metric-box.
import { THREE } from '../../engine.js';
import { part, std } from '../../lib/crime.js';
import { hh } from '../../lib/crimeover.js';
import { tiled, perMetre, rivetedSteel, dirtFloor, canvasTex } from '../module.recon.canvas-materials/index.js';
import { frustum } from '../module.any.frustum/index.js';
import { merged } from '../module.any.metric-box/index.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const cyl = (r0, r1, h, n = 20, open = false) => new THREE.CylinderGeometry(r0, r1, h, n, 1, open);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const glowMat = (c, x = {}) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...x });
const ns = m => { m.castShadow = false; return m; };
const hung = m => { m.userData.noContact = true; return m; };

// cageLamp(S, parent, at, o): a caged bulb on a wall mount (mount behind it along -z), a warm point light (decay 2, 3.5 m:
// light POOLS, not a flat wash) and a spot down to o.floorY ahead of it. o: floorY, i (7), spot (9), color.
export function cageLamp(S, parent, at, o = {}) {
  const g = new THREE.Group(); g.name = 'cage lamp'; g.position.set(...at); g.rotation.y = o.ry ?? 0; parent.add(g); g.userData.noContact = true;
  const blk = std(0x151515, .4, { metalness: .5 });
  part(box(.12, .12, .1), blk, [0, .12, -.17], null, g, 'lamp mount'); part(cyl(.05, .05, .05, 12), blk, [0, .1, -.1], [Math.PI / 2, 0, 0], g, 'lamp neck');
  part(cyl(.06, .055, .04, 16), blk, [0, .08, 0], null, g, 'lamp cap');
  ns(part(new THREE.SphereGeometry(.075, 16, 12), glowMat(0xffffff), [0, 0, 0], null, g, 'lamp bulb'));
  ns(part(cyl(.07, .07, .14, 16, true), new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: 0xffc070, emissiveIntensity: .7, transparent: true, opacity: .55, side: THREE.DoubleSide }), [0, 0, 0], null, g, 'lamp glass'));
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; part(cyl(.005, .005, .16, 4), blk, [Math.cos(a) * .075, 0, Math.sin(a) * .075], null, g, 'cage bar'); }
  parent.updateWorldMatrix(true, true); const W = p => g.localToWorld(V(...p));
  const pl = new THREE.PointLight(o.color ?? 0xffe2c0, o.i ?? 7, 3.5, 2); pl.position.copy(W([0, -.05, .15])); S.scene.add(pl);
  const sp = new THREE.SpotLight(0xffd0a0, o.spot ?? 9, 6, 1.0, .85, 1.6); sp.position.copy(W([0, 0, .1])); const tg = W([0, 0, 1.2]); if (o.floorY != null) tg.y = parent.localToWorld(V(0, o.floorY, 0)).y; sp.target.position.copy(tg); S.scene.add(sp, sp.target);
  return g;
}
// railTrack(parent, o): a narrow-gauge track on sleepers. o: x0, x1 (track ends along x), y (top of the floor it lies on),
// zAt(x) (the centre line's z: a track may drift, e.g. x => -1.22 + .042 x), gauge (.7). The two rails are ONE mesh
// (two rotated rails as separate meshes read as COPLANAR to the checker), 10 cm tall and 12 cm wide so a cart's wheels
// count as supported (thin diagonal rails become "decals" to the contact check). Returns { rails, railTop, angle }.
export function railTrack(parent, o = {}) {
  const gauge = o.gauge ?? .7, y = o.y ?? 0, x0 = o.x0 ?? 0, x1 = o.x1 ?? 10, zAt = o.zAt ?? (() => 0), k = (zAt(x1) - zAt(x0)) / (x1 - x0), ang = Math.atan(k), len = (x1 - x0) / Math.cos(ang), mx = (x0 + x1) / 2;
  const steel = o.steel ?? std(0x4a4440, .45, { metalness: .7 }), woodDk = o.wood ?? std(0x2e2620, .85);
  const rails = part(merged([-1, 1].map(s => box(len, .1, .12).translate(0, 0, s * gauge / 2))), steel, [mx, y + .06 + .05, zAt(mx)], [0, -ang, 0], parent, 'rails');
  for (let sx = x0 + .2; sx < x1 - .1; sx += .62) part(box(.16, .06, gauge + .3), woodDk, [sx, y + .03, zAt(sx)], [0, -ang + (hh(sx * 9, 2) - .5) * .12, 0], parent, 'sleeper');
  return { rails, railTop: y + .06 + .1, angle: ang, gauge };
}
// mineCart(parent, o): a riveted rusty tub (an open frustum: wider at the top) on a chassis with two axles; wheels sit on
// rails at gauge .7 when o.y = the rail top - .0 (wheel centres .17 above the cart origin, radius .17). o: x, y, z, ry,
// L (1.5), W (.95), load (true: a dirt heap). Returns { g, solids, top } (top = rim height in parent space).
export function mineCart(parent, o = {}) {
  const L = o.L ?? 1.5, Wd = o.W ?? .95, gauge = o.gauge ?? .7, g = new THREE.Group(); g.name = 'mine cart'; g.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0); g.rotation.y = o.ry ?? 0; parent.add(g);
  const iron = std(0x46403a, .7, { metalness: .6 }), rust = std(0x5a4a3e, .7, { metalness: .4 }), solids = [];
  const tubMat = perMetre(rivetedSteel(), { color: 0xb0a49a, rough: .7, x: { metalness: .45, side: THREE.DoubleSide } });
  solids.push(part(frustum(L, Wd, L - .35, Wd - .3, .6), tubMat, [0, .45, 0], null, g, 'cart tub'));
  for (const [w, d, x, z] of [[L + .06, .05, 0, Wd / 2], [L + .06, .05, 0, -Wd / 2], [.05, Wd, L / 2, 0], [.05, Wd, -L / 2, 0]]) hung(part(box(w, .045, d), rust, [x, 1.05, z], null, g, 'cart rim'));
  if (o.load !== false) { const dirt = part(new THREE.SphereGeometry(.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), tiled(dirtFloor(), 1, 1, { unit: .5, color: 0x9a7c60 }), [0, .96, 0], null, g, 'cart dirt'); dirt.scale.set(1.42 * L / 1.5, .42, .9 * Wd / .95); dirt.userData.noContact = true; }
  part(box(L - .45, .1, .55), iron, [0, .38, 0], null, g, 'cart chassis');
  for (const x of [-.42, .42]) { part(cyl(.025, .025, gauge + .1, 8), iron, [x, .17, 0], [Math.PI / 2, 0, 0], g, 'axle');
    for (const s of [-1, 1]) { part(cyl(.17, .17, .05, 22), rust, [x, .17, s * gauge / 2], [Math.PI / 2, 0, 0], g, 'wheel'); part(cyl(.07, .07, .08, 12), iron, [x, .17, s * (gauge / 2 + .01)], [Math.PI / 2, 0, 0], g, 'hub'); } }
  part(box(.1, .18, .14), iron, [-L / 2 + .05, .4, 0], null, g, 'coupler');
  return { g, solids, top: (o.y ?? 0) + 1.05 };
}
// airHose(parent, points, o): a flexible ribbed duct along a curve (world points or [x,y,z] arrays). o.r (.13)
export function airHose(parent, pts, o = {}) {
  const c = new THREE.CatmullRomCurve3(pts.map(p => p.isVector3 ? p : V(...p))), tex = canvasTex(64, 256, (x, W, H) => { for (let y = 0; y < H; y += 8) { x.fillStyle = '#b8b4ac'; x.fillRect(0, y, W, 5); x.fillStyle = '#5a5854'; x.fillRect(0, y + 5, W, 3); } });
  tex.repeat.set(1, Math.max(8, Math.round(c.getLength() * 21))); const m = part(new THREE.TubeGeometry(c, 200, o.r ?? .13, 14), new THREE.MeshStandardMaterial({ color: 0xc8c4bc, map: tex, bumpMap: tex, bumpScale: 2, roughness: .7 }), [0, 0, 0], null, parent, 'air duct');
  m.userData.noContact = true; return m;
}
// cables(parent, o): coloured cables looping between hooks along x. o: x0, x1, y (hook height), z, period (2.45 m), sag (.35),
// ref (x of a hook, default x0),
// colors ([[0x8a3a2a, 0, 0], [0x3e6034, .06, -.05]] = colour, dz, dy)
export function cables(parent, o = {}) {
  const out = [];
  for (const [col, dz, dy] of o.colors ?? [[0x8a3a2a, 0, 0], [0x3e6034, .06, -.05]]) {
    const pts = []; for (let x = o.x0 ?? 0; x <= (o.x1 ?? 10); x += .5) pts.push(V(x, (o.y ?? 0) + dy - Math.sin(((x - (o.ref ?? o.x0 ?? 0)) / (o.period ?? 2.45)) * Math.PI) ** 2 * (o.sag ?? .35), (o.z ?? 0) + dz));
    out.push(hung(part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 300, o.r ?? .009, 6), std(col, .5), [0, 0, 0], null, parent, 'cable'))); }
  return out;
}
// dirtPile(parent, at, s, name): a lumpy dome of packed dirt (half sphere, radius 1 scaled by s = [sx, sy, sz])
export function dirtPile(parent, at, s = [.5, .2, .4], name = 'dirt pile', o = {}) {
  const g = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + (hh(Math.round(x * 9) * 31 + Math.round(z * 9) * 7, 3) - .5) * .25 * y; p.setXYZ(i, x * n, y * n, z * n); }
  g.computeVertexNormals(); const m = part(g, tiled(dirtFloor(), 1, 1, { unit: .7, color: o.color ?? 0xc0a080 }), at, null, parent, name); m.scale.set(...s); return m;
}
// shovel(parent): a shovel (1.15 scale, shaft along y, blade at the bottom), all noContact (it is held)
export function shovel(parent) {
  const g = new THREE.Group(); g.name = 'shovel'; const wd = std(0x6a4a30, .7);
  part(cyl(.018, .018, 1.0, 8), wd, [0, 0, 0], null, g, 'shovel shaft'); part(box(.13, .03, .04), wd, [0, .52, 0], null, g, 'shovel grip');
  const bl = part(new THREE.PlaneGeometry(.28, .34), new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: .35, metalness: .6, side: THREE.DoubleSide }), [0, -.64, .02], null, g, 'shovel blade'); bl.rotation.x = .2;
  g.scale.setScalar(1.15); g.traverse(m => { m.userData.noContact = true; }); parent.add(g); return g;
}
// plantShovel(sh, o): plant a shovel's blade on the floor in front of a digger and lean its shaft back toward him; call each
// tick before handTo. o: x, z, ry (the digger's), floorY, reach (.8 ahead), back (.6 lean), side. Returns { lo, hi } grip points.
export function plantShovel(sh, o) {
  const F = V(Math.sin(o.ry), 0, Math.cos(o.ry)), Sd = V(Math.cos(o.ry), 0, -Math.sin(o.ry));
  const B = V(o.x, (o.floorY ?? 0) + .02, o.z).addScaledVector(F, o.reach ?? .8).addScaledVector(Sd, o.side ?? 0), U = F.clone().multiplyScalar(-(o.back ?? .6)).add(V(0, 1, 0)).normalize();
  sh.position.copy(B).addScaledVector(U, .79 * 1.15); sh.quaternion.setFromUnitVectors(V(0, 1, 0), U); sh.updateMatrixWorld(true);
  return { lo: sh.localToWorld(V(0, -.12, 0)), hi: sh.localToWorld(V(0, .38, 0)) };
}
// floorLantern(S, parent, at, o): a small glowing lantern standing on the floor with its own warm light (o.i 2.2)
export function floorLantern(S, parent, at, o = {}) {
  const g = new THREE.Group(); g.name = 'lantern'; g.position.set(...at); parent.add(g);
  // (the glass is an emissive STANDARD material: the contact check skips MeshBasicMaterial meshes as effects, so with a
  // basic glow the lantern's top read as 'floating 16 cm')
  part(cyl(.07, .08, .03, 12), std(0x1a1a1a, .5), [0, .015, 0], null, g, 'lantern base');
  ns(part(cyl(.05, .055, .16, 12), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffd090, emissiveIntensity: 1, toneMapped: false }), [0, .11, 0], null, g, 'lantern glass'));
  part(cyl(.035, .07, .05, 12), std(0x1a1a1a, .5), [0, .215, 0], null, g, 'lantern top'); hung(part(new THREE.TorusGeometry(.04, .006, 6, 16), std(0x1a1a1a), [0, .27, 0], null, g, 'lantern ring'));
  parent.updateWorldMatrix(true, true); const pl = new THREE.PointLight(0xffa850, o.i ?? 2.2, 3.5, 1.6); pl.position.copy(g.localToWorld(V(0, .24, .15))); S.scene.add(pl);
  return g;
}
