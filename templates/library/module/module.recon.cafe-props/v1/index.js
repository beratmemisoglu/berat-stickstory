// module.recon.cafe-props v1 - café furniture and practicals from the night-café shot match (V3, critic 7/10):
// bentwood chair (Thonet No. 18 type), café table, pendant lamp with a haze cone, lantern wall sconce, cup and saucer,
// leather duffel, a banquette booth with a pedestal table, an espresso machine. Real sizes in metres, y up, each standing on
// y = 0 of its parent. Parts that hang (rims, spindles, handles, lamps) are marked noContact; tops are returned as solids.
// Contract: THREE from engine.js; part/std/rbox from lib/crime.js; hh from lib/crimeover.js; tiled/leather/furnitureWood
// from module.recon.canvas-materials; hazeCone from module.any.haze-beam (both copied next to this module).
import { THREE } from '../../engine.js';
import { part, std, rbox } from '../../lib/crime.js';
import { hh } from '../../lib/crimeover.js';
import { tiled, leather, furnitureWood } from '../module.recon.canvas-materials/index.js';
import { hazeCone } from '../module.any.haze-beam/index.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const cyl = (r0, r1, h, n = 20, open = false) => new THREE.CylinderGeometry(r0, r1, h, n, 1, open);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const glowMat = (c, x = {}) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...x });
const ns = m => { m.castShadow = false; return m; };
const hung = m => { m.userData.noContact = true; return m; };
export const tubeAlong = (pts, r, seg = 24) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V(...p))), seg, r, 8, false);

// shared materials (created on first use, after the engine is up)
const M = {};
export function cafeMaterials() {
  if (M.ok) return M; M.ok = true;
  M.leather = tiled(leather(false), 1, 1, { repeat: [2, 2], color: 0xc0b8b0, rough: .62, bump: 1.2 });
  M.leatherCh = tiled(leather(true), 1, 1, { repeat: [3.6, 1], color: 0x6a5a52, rough: .78, bump: 1.5, x: { envMapIntensity: .3 } });
  M.black = std(0x101012, .4); M.metalDk = std(0x1d1a18, .38, { metalness: .65 }); M.chrome = std(0xd0d0d4, .14, { metalness: 1 });
  M.bent = new THREE.MeshPhysicalMaterial({ color: 0x4b2d1b, roughness: .42, clearcoat: .35, clearcoatRoughness: .4 });
  M.woodDk = std(0x2a1a10, .55); M.woodTop = tiled(furnitureWood('#3a2618'), 1, 1, { repeat: [1.2, 1.2], color: 0xa8a8a8, rough: .7, bump: .6, x: { envMapIntensity: .25 } });
  return M;
}

// bentwoodChair(parent, at, ry): round seat with a rim, splayed bent legs with a ring, bent back posts, a steam-bent top
// rail and four spindles (seat top .48 m). A small deterministic yaw jitter from the position keeps rows from looking cloned.
export function bentwoodChair(parent, at, ry = 0, o = {}) {
  const w = o.mat ?? cafeMaterials().bent, g = new THREE.Group(); g.position.set(...at); g.rotation.y = ry + (o.jitter === false ? 0 : (hh(Math.round(at[0] * 70 + at[2] * 30), 4) - .5) * .3); parent.add(g); g.name = 'bentwood chair';
  part(cyl(.205, .198, .03, 32), w, [0, .465, 0], null, g, 'chair seat');
  hung(part(new THREE.TorusGeometry(.2, .016, 8, 36), w, [0, .452, 0], [Math.PI / 2, 0, 0], g, 'seat rim'));
  for (const s of [-1, 1]) {
    part(tubeAlong([[s * .13, .45, .12], [s * .145, .24, .15], [s * .168, .014, .18]], .018), w, [0, 0, 0], null, g, 'chair leg');
    part(cyl(.017, .019, .014, 10), w, [s * .168, .007, .18], null, g, 'leg foot');
    part(tubeAlong([[s * .16, .014, -.2], [s * .138, .24, -.16], [s * .13, .45, -.135], [s * .133, .66, -.16], [s * .148, .87, -.215]], .019, 32), w, [0, 0, 0], null, g, 'chair post');
    part(cyl(.017, .019, .014, 10), w, [s * .16, .007, -.2], null, g, 'leg foot');
  }
  const arc = []; for (let i = 0; i <= 12; i++) { const a = -.95 + i / 12 * 1.9; arc.push([Math.sin(a) * .2, 0, -.035 - Math.cos(a) * .18]); }
  const top = hung(part(tubeAlong(arc, .02, 32), w, [0, .86, 0], null, g, 'chair top rail')); top.scale.y = 2.4;
  hung(part(tubeAlong(arc.map(([x, y, z]) => [x * .93, y, z * .93 + .01]), .012, 32), w, [0, .6, 0], null, g, 'chair back rail'));
  for (const a of [-.5, -.17, .17, .5]) hung(part(cyl(.009, .009, .25, 8), w, [Math.sin(a) * .19, .73, -.035 - Math.cos(a) * .17], [-.1, 0, 0], g, 'chair spindle'));
  hung(part(new THREE.TorusGeometry(.172, .009, 6, 36), w, [0, .2, -.005], [Math.PI / 2, 0, 0], g, 'leg ring'));
  return g;
}
// cafeTable(parent, at, o): plank top with an edge, apron, tapered square legs. o: w (.8), d (.8), h (.76), ry, name.
// Returns { g, solids: [top] }.
export function cafeTable(parent, at, o = {}) {
  const C = cafeMaterials(), g = new THREE.Group(); g.position.set(...at); g.rotation.y = o.ry ?? 0; parent.add(g); g.name = o.name ?? 'table'; const W = o.w ?? .8, D = o.d ?? .8, H = o.h ?? .76;
  const top = part(rbox(W, .045, D, .008), C.woodTop, [0, H - .0225, 0], null, g, 'table top');
  for (const [w_, d_, x_, z_] of [[W - .12, .02, 0, D / 2 - .07], [W - .12, .02, 0, -(D / 2 - .07)], [.02, D - .12, W / 2 - .07, 0], [.02, D - .12, -(W / 2 - .07), 0]]) hung(part(box(w_, .08, d_), C.woodDk, [x_, H - .085, z_], null, g, 'apron'));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(new THREE.CylinderGeometry(.022, .016, H - .045, 4, 1).rotateY(Math.PI / 4), C.woodDk, [x * (W / 2 - .06), (H - .045) / 2, z * (D / 2 - .06)], null, g, 'table leg');
  return { g, solids: [top] };
}
// pendant(S, parent, at, o): a dome shade (lathe) on a cord to the ceiling, glowing inside, a bulb, a point light, a spot
// cone down and a haze cone. at = the shade's mouth centre (world = parent space). o: ceil (2.95), r (.2), mat, rim (a
// material for a rim ring), inner (glow colour), ie, color (light), i, cone (spot strength), angle, beam (haze k, 0 = none),
// beamTo (haze foot y), beamColor, shadow.
export function pendant(S, parent, at, o = {}) {
  const C = cafeMaterials(), g = new THREE.Group(); g.name = 'pendant lamp'; parent.add(g); const r = o.r ?? .2, sh_ = r * 1.05, len = (o.ceil ?? 2.95) - at[1] - sh_ - .05;
  hung(part(cyl(.005, .005, len, 6), std(0x0d0d0d), [at[0], at[1] + sh_ + .05 + len / 2, at[2]], null, g, 'cord'));
  hung(part(cyl(.025, .03, .05, 14), o.mat ?? C.metalDk, [at[0], at[1] + sh_ + .025, at[2]], null, g, 'shade cap'));
  const prof = []; for (let i = 0; i <= 14; i++) { const k = i / 14, a = k * Math.PI / 2; prof.push(new THREE.Vector2(Math.max(.035, r * Math.sin(a) * (1 + .08 * k * k)), sh_ * Math.cos(a))); }
  prof.push(new THREE.Vector2(r * 1.1, -.004));
  const shade = hung(part(new THREE.LatheGeometry(prof, 40), o.mat ?? C.metalDk, at, null, g, 'shade')); shade.material = shade.material.clone(); shade.material.side = THREE.DoubleSide; shade.castShadow = false;
  hung(ns(part(new THREE.LatheGeometry(prof.map(v => new THREE.Vector2(v.x * .97, v.y - .003)), 40), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: o.inner ?? 0xff9a50, emissiveIntensity: o.ie ?? .7, side: THREE.BackSide }), at, null, g, 'shade inside')));
  if (o.rim) hung(part(new THREE.TorusGeometry(r * 1.1, .007, 6, 40), o.rim, [at[0], at[1] - .004, at[2]], [Math.PI / 2, 0, 0], g, 'shade rim'));
  ns(hung(part(new THREE.SphereGeometry(r * .22, 14, 10), glowMat(0xffe2b8), [at[0], at[1] + r * .12, at[2]], null, g, 'bulb')));
  const W = p => parent.localToWorld(V(...p)); parent.updateWorldMatrix(true, false);
  const pl = new THREE.PointLight(o.color ?? 0xffe8dc, o.i ?? .5, 1.6, 2); pl.position.copy(W([at[0], at[1] - .05, at[2]])); S.scene.add(pl);
  const sp = new THREE.SpotLight(o.color ?? 0xffe8dc, (o.cone ?? 9) * .75, 5, o.angle ?? .62, .7, 1.6); sp.position.copy(W([at[0], at[1] + .04, at[2]])); sp.target.position.copy(W([at[0], 0, at[2]]));
  if (o.beam !== 0) g.add(hazeCone(at, o.beamTo ?? .8, { r, k: o.beam ?? .15, color: o.beamColor ?? 0xffc890 }));
  if (o.shadow) { sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.radius = 5; sp.shadow.bias = -.0006; sp.shadow.normalBias = .02; }
  S.scene.add(sp, sp.target); return g;
}
// sconce(S, parent, at, ry, o): a lantern wall sconce. at = the wall point (parent space) of the mounting plate centre + .05
// up; ry turns the local +z (out of the wall) into the room. Adds its bulb light, a down wash and an up wash on the wall.
export function sconce(S, parent, at, ry = 0, o = {}) {
  const C = cafeMaterials(), g = new THREE.Group(); g.position.set(...at); g.rotation.y = ry; parent.add(g); g.name = 'wall sconce'; g.userData.noContact = true;
  part(cyl(.05, .05, .02, 20), C.black, [0, -.05, .01], [Math.PI / 2, 0, 0], g, 'sconce plate');
  part(tubeAlong([[0, -.05, .015], [0, -.03, .09], [0, -.075, .15], [0, -.1, .14], [0, -.09, .12]], .008, 20), C.black, [0, 0, 0], null, g, 'sconce scroll');
  part(tubeAlong([[0, -.05, .015], [0, -.02, .1], [0, .03, .15]], .009, 16), C.black, [0, 0, 0], null, g, 'sconce arm');
  const lan = new THREE.Group(); lan.position.set(0, .1, .16); g.add(lan);
  part(cyl(.012, .07, .06, 16), C.black, [0, .1, 0], null, lan, 'lantern roof'); part(cyl(.012, .012, .03, 8), C.black, [0, .14, 0], null, lan, 'lantern finial');
  ns(part(cyl(.052, .044, .12, 16, true), new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xff9a40, emissiveIntensity: .14, transparent: true, opacity: .7, side: THREE.DoubleSide }), [0, .01, 0], null, lan, 'lantern glass'));
  part(cyl(.055, .055, .008, 16), C.black, [0, .07, 0], null, lan, 'lantern ring'); part(cyl(.045, .03, .03, 16), C.black, [0, -.065, 0], null, lan, 'lantern base');
  ns(part(new THREE.SphereGeometry(.022, 12, 8), glowMat(0x9a7a50), [0, .01, 0], null, lan, 'sconce bulb'));
  g.updateWorldMatrix(true, true);
  const pl = new THREE.PointLight(0xffc890, o.i ?? .45, 2.4, 1.8); pl.position.copy(lan.localToWorld(V(0, -.02, .2))); S.scene.add(pl);
  const wash = new THREE.SpotLight(0xffcc98, o.wash ?? 3.8, 3.0, 1.0, 1, 1.6); wash.position.copy(g.localToWorld(V(0, -.05, .55))); wash.target.position.copy(g.localToWorld(V(0, -1.1, -.05))); S.scene.add(wash, wash.target);
  const up = new THREE.SpotLight(0xffcc98, o.up ?? 2.2, 1.6, .6, .9, 1.6); up.position.copy(g.localToWorld(V(0, .1, .35))); up.target.position.copy(g.localToWorld(V(0, .9, -.05))); S.scene.add(up, up.target);
  return g;
}
// cupSaucer(parent, at, ry): a white cup and saucer (lathe), coffee, handle, spoon. at = the saucer's underside.
export function cupSaucer(parent, at, ry = 0) {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = ry; parent.add(g); g.name = 'coffee cup'; const wh = std(0xeae4da, .25);
  const sp = [[0, 0], [.05, 0], [.068, .006], [.075, .013], [.074, .015], [.03, .01], [0, .01]].map(([a, b]) => new THREE.Vector2(a, b));
  part(new THREE.LatheGeometry(sp, 32), wh, [0, 0, 0], null, g, 'saucer');
  const cp = [[0, .008], [.026, .008], [.034, .014], [.042, .035], [.046, .06], [.047, .066], [.043, .066], [.04, .04], [.03, .016], [0, .016]].map(([a, b]) => new THREE.Vector2(a, b));
  part(new THREE.LatheGeometry(cp, 32), wh, [0, 0, 0], null, g, 'cup');
  hung(part(cyl(.041, .041, .003, 24), std(0x2a1608, .2), [0, .056, 0], null, g, 'coffee'));
  hung(part(new THREE.TorusGeometry(.016, .005, 6, 14, Math.PI * 1.3), wh, [.054, .04, 0], [0, 0, -Math.PI * .65], g, 'handle'));
  hung(part(new THREE.BoxGeometry(.008, .003, .07), std(0xb8b8b8, .2, { metalness: .9 }), [.03, .0165, .035], [0, .5, 0], g, 'spoon'));
  return g;
}
// duffel(parent, at, ry): a leather doctor's-bag duffel: a domed profile extruded along its length (.44 m), darker end
// panels, two arched handles, a zip, strap bands. ~.37 x .31 x .5 m.
export function duffel(parent, at, ry = 0) {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = ry; parent.add(g); g.name = 'duffel bag';
  const lt = std(0x302c2a, .58), st = std(0x181615, .55);
  const prof = (s, h) => { const sh = new THREE.Shape(); sh.moveTo(-s * .15, 0); sh.lineTo(s * .15, 0); sh.quadraticCurveTo(s * .175, 0, s * .172, .03);
    sh.bezierCurveTo(s * .19, h * .45, s * .16, h * .92, s * .07, h); sh.quadraticCurveTo(0, h - .018, -s * .07, h); sh.bezierCurveTo(-s * .16, h * .92, -s * .19, h * .45, -s * .172, .03); sh.quadraticCurveTo(-s * .175, 0, -s * .15, 0); return sh; };
  const body = new THREE.ExtrudeGeometry(prof(1, .29), { depth: .44, bevelEnabled: true, bevelThickness: .03, bevelSize: .012, bevelSegments: 4, curveSegments: 16 }); body.translate(0, 0, -.22);
  part(body, lt, [0, .012, 0], null, g, 'bag body');
  for (const z of [-.262, .262]) part(new THREE.ExtrudeGeometry(prof(1.05, .3), { depth: .012, bevelEnabled: false, curveSegments: 16 }).translate(0, 0, -.006), st, [0, .004, z], null, g, 'bag end');
  for (const x of [-.045, .045]) hung(part(new THREE.TorusGeometry(.12, .011, 8, 24, Math.PI), st, [x, .29, 0], [0, Math.PI / 2, x * 3], g, 'bag handle'));
  hung(part(tubeAlong([[0, .303, -.24], [0, .307, 0], [0, .303, .24]], .005), std(0x8a8a8a, .3, { metalness: .8 }), [0, 0, 0], null, g, 'zip'));
  for (const z of [-.2, .2]) hung(part(box(.375, .02, .03), st, [0, .14, z], null, g, 'strap band'));
  return g;
}
// booth(S, parent, o): a banquette booth: one tall channelled back along local -z with a rolled top, a long seat at the back,
// a seat under each end (x = +-.85, seat top .52), tall padded end panels, and a pedestal table at the origin (top .775)
// with two cups, a wallet and a phone. o: rot (y), pos, scale, tableRot, seat (cushion top, default .52 - a standard chair
// is .45: a lower seat keeps a seated person's knees under the .775 table top). Returns { B, solids, seatY }.
export function booth(S, parent, o = {}) {
  const C = cafeMaterials(), B = new THREE.Group(); B.name = 'booth'; B.rotation.y = o.rot ?? 0; B.position.set(...(o.pos ?? [0, 0, 0])); B.scale.setScalar(o.scale ?? 1); parent.add(B);
  const solids = [], fz = -.95, zf = -.05, H = 1.0, frame = std(0x24150e, .5), TROT = o.tableRot ?? 0, SY = o.seat ?? .52;
  part(rbox(2.7, H - .04, .1, .03), frame, [0, (H - .04) / 2, fz - .05], null, B, 'banquette shell');
  solids.push(part(rbox(2.5, .62, .16, .07), C.leatherCh, [0, .78, fz + .07], [-.1, 0, 0], B, 'banquette back'));
  part(cyl(.068, .068, 2.64, 18), C.leather, [0, H - .03, fz - .03], [0, 0, Math.PI / 2], B, 'banquette roll');
  solids.push(part(rbox(.98, .14, .38, .045), C.leather, [0, SY - .07, -.64], null, B, 'long cushion')); part(rbox(.98, SY - .14, .36, .01), C.woodDk, [0, (SY - .14) / 2, -.64], null, B, 'long base');
  for (const s of [-1, 1]) {
    solids.push(part(rbox(.7, .14, zf + .83, .045), C.leather, [s * .85, SY - .07, (zf - .83) / 2], null, B, 'bench cushion'));
    solids.push(part(rbox(.66, SY - .14, zf + .81, .01), C.woodDk, [s * .85, (SY - .14) / 2, (zf - .83) / 2], null, B, 'bench base'));
    part(rbox(.12, H - .06, .62, .05), C.leather, [s * 1.3, (H - .06) / 2, -.64], null, B, 'banquette end');
    hung(part(rbox(.02, H - .16, .5, .008), frame, [s * 1.37, (H - .16) / 2 + .04, -.64], null, B, 'end trim'));
  }
  const top = part(rbox(1.16, .05, .88, .01), C.woodTop, [0, .75, 0], [0, TROT, 0], B, 'table top'); solids.push(top);
  hung(part(box(.96, .06, .68), C.woodDk, [0, .695, 0], [0, TROT, 0], B, 'table apron'));
  solids.push(part(cyl(.05, .05, .66, 16), C.black, [0, .36, 0], null, B, 'pedestal'));
  for (const r of [0, Math.PI / 2]) solids.push(part(rbox(.6, .035, .07, .01), C.black, [0, .0175, 0], [0, r + .78, 0], B, 'table foot'));
  hung(part(cyl(.07, .05, .02, 16), C.black, [0, .675, 0], null, B, 'pedestal head'));
  if (o.props !== false) {
    cupSaucer(B, [-.2, .775, .1], .4); cupSaucer(B, [.18, .775, .02], 2.6);
    const wal = part(rbox(.11, .022, .075, .008), std(0x0e0e10, .35), [.0, .786, -.03], [0, .5, 0], B, 'wallet'); hung(part(box(.1, .003, .002), std(0x2a2a2a, .5), [0, .011, .0], null, wal, 'wallet fold'));
    hung(part(rbox(.07, .008, .13, .006), std(0x0a0a0c, .2), [.07, .779, -.16], [0, -.3, 0], B, 'phone'));
  }
  return { B, solids, seatY: SY };
}
// espressoMachine(parent, at, s): a chrome two-group machine with copper sides, portafilters, steam wands and cups on top.
// at = the counter top point under its centre; s = scale (1 = .72 m wide).
export function espressoMachine(parent, at, s = 1) {
  const C = cafeMaterials(), em = new THREE.Group(); em.name = 'espresso machine'; em.position.set(...at); em.scale.setScalar(s); parent.add(em);
  part(rbox(.72, .38, .4, .06), std(0xb4aaa6, .18, { metalness: .95 }), [0, .191, 0], null, em, 'machine body');
  for (const k of [-1, 1]) hung(part(rbox(.02, .3, .4, .006), std(0x8a3a2c, .22, { metalness: .95 }), [k * .365, .2, 0], null, em, 'machine copper'));
  hung(part(rbox(.66, .1, .012, .004), std(0x8a3424, .2, { metalness: .9 }), [0, .32, .205], null, em, 'machine copper band')); hung(part(rbox(.66, .045, .012, .004), std(0x8a3424, .2, { metalness: .9 }), [0, .06, .205], null, em, 'machine copper band'));
  part(rbox(.7, .03, .44, .008), std(0x2a2a2a, .3, { metalness: .8 }), [0, .415, 0], null, em, 'cup tray');
  part(rbox(.62, .03, .14, .005), std(0x1a1a1a, .3, { metalness: .8 }), [0, .015, .22], null, em, 'drip tray');
  for (const x of [-.18, .18]) { hung(part(cyl(.035, .03, .05, 14), C.chrome, [x, .16, .26], null, em, 'group head')); hung(part(cyl(.04, .035, .03, 14), C.chrome, [x, .125, .27], null, em, 'portafilter'));
    hung(part(cyl(.009, .011, .13, 8), C.black, [x, .125, .35], [Math.PI / 2, 0, 0], em, 'portafilter handle')); }
  for (const k of [-1, 1]) hung(part(tubeAlong([[k * .3, .3, .23], [k * .32, .2, .29], [k * .31, .08, .3]], .005), C.chrome, [0, 0, 0], null, em, 'steam wand'));
  for (let i = 0; i < 7; i++) hung(part(cyl(.026, .021, .04, 14), std(0xa8a29a, .35), [-.27 + i * .09, .45, -.05 + (i % 2) * .07], null, em, 'cup on top'));
  for (let i = 0; i < 2; i++) hung(part(cyl(.026, .021, .04, 14), std(0xa8a29a, .35), [-.2 + i * .12, .49, .02], null, em, 'cup stacked'));
  return em;
}
