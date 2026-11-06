// RECIPE recipe.recon.night-cafe-cutaway v1: a cut-away café corner at night (a building corner sliced open above the
// street, brick walls, a bar with an espresso machine, pendants with haze cones, sconces, bentwood chairs), two glowing
// men in a banquette booth, a barista. Matched to an AI reference by measurement (café V3: ~44 renders, 7 critics,
// critic 7/10, ISSUES 0). Needs project.json settings from settings.json next to this file.
// BLUEPRINT
//   camera p (-7.23, 2.862, 6.156) look (-.343, 1.253, -.255) fov 31.075 (the solve: a hand-tweaked camera drifted
//   ~100 px and made the room too wide - trust the solve, re-fit the scene)
//   room interior x -1.2 .. 4.75, z -5.2 .. 1.05, ceiling 2.95; low brick parapet (.27) on the two cut sides
//   floor slab .37 thick under it, earth block below; ceiling slab 3.17 .. 3.6 overhanging .35; brick storey above
//   the booth group at (-.08, 0, .04), turned -.815 rad, scaled 1.15, seat tops .46 (the men inside it, seated by sitOn)
//   bar front z -4.35 (x -1.18 .. 3.25, top 1.08), barista (1.85, -4.92), bar pendants (.56 / 1.78 / 2.94, -4.6) at 2.2
//   wall B: sconces z -3.37 / .04 at y 1.9, boards z -2.4 / -1.39, red glow at the ceiling z -2.3
// Light: practicals only (pendant cones, sconce pools, a red wash, the glowing men), a cool night fill outside.
import { shot, THREE } from '../engine.js';
import { setup, MODELS } from '../lib/library.js';
import { part, std, rbox } from '../lib/crime.js';
import { hh } from '../lib/crimeover.js';
import { figure } from '../lib/figures.js';
import { sitOn } from '../lib/props.js';
import { tiled, brick, coping, planks, castConcrete, rootSoil, earthClods, furnitureWood, chalkMenu } from '../library/module.recon.canvas-materials/index.js';
import { glowPerson, glow, rebindMannequin, glowCap } from '../library/module.recon.glow-person/index.js';
import { lean, bodyOf, boneLog } from '../library/module.recon.rig-pose/index.js';
import { cafeMaterials, bentwoodChair, cafeTable, pendant, sconce, duffel, booth, espressoMachine } from '../library/module.recon.cafe-props/index.js';

// ---- CONFIG ----
const MANNEQUIN = null;   // null = the kit's bare human, glowing; or 'assets/models/mannequin.glb' (kit bone names)
if (MANNEQUIN) await setup({ models: { man: MANNEQUIN } });
const CAM = { p: [-7.23, 2.862, 6.156], l: [-.343, 1.253, -.255], fov: 31.075 };
const X0 = -1.2, X1 = 4.75, Z0 = -5.2, Z1 = 1.05, CEIL = 2.95, PT = .27, PH = .22, CAP = .07, SLAB = .37, SOFF = 3.17, STOP = 3.6;
const BOOTH = { rot: -.815, pos: [-.08, 0, .04], scale: 1.15, seat: .46 };   // seat: cushion tops (.52 put the knees into the table; .41 since figures v17 sit ON the cushion put the forearms into the table top)

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const cyl = (r0, r1, h, n = 20, open = false) => new THREE.CylinderGeometry(r0, r1, h, n, 1, open);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const glowM = (c, x = {}) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...x });
const ns = m => { m.castShadow = false; return m; };
const hung = m => { m.userData.noContact = true; return m; };
// a material from a texture set with explicit repeats (as tuned in the match): tm(set, rx, ry, o)
const tm = (set, rx, ry, o = {}) => tiled(set, 1, 1, { repeat: [rx, ry], bump: 2, ...o });

// ---- the shell: the cut building corner, the neighbours, the earth ----
function shell(S, G) {
  const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2, w = X1 - X0, d = Z1 - Z0;
  const fl = part(box(w, .02, d), tm(planks(), w / 2, d / 2, { color: 0xa8a8a8, rough: .5, bump: 1.2, physical: true, x: { clearcoat: .15, clearcoatRoughness: .6 } }), [cx, -.01, cz], null, G, 'floor'); fl.userData.ground = true; fl.castShadow = false;
  // floor slab (bevelled concrete, a lip proud of the parapet), the root-laced soil under it, the earth block
  const sx0 = X0 - PT - .04, sz1 = Z1 + PT + .04, sx1 = X1 + .3, sz0 = Z0 - .3;
  part(rbox(sx1 - sx0, SLAB, sz1 - sz0, .025), tm(castConcrete('#36383c', { drips: 26 }), (sx1 - sx0) / 2, SLAB / 2, { rough: .92, bump: 2.2 }), [(sx0 + sx1) / 2, -.02 - SLAB / 2, (sz0 + sz1) / 2], null, G, 'floor slab');
  const ex0 = sx0 + .03, ez1 = sz1 - .03;
  part(box(sx1 - ex0, .2, ez1 - sz0), tm(rootSoil(), (sx1 - ex0) / 2, .8, { rough: 1, bump: 3 }), [(ex0 + sx1) / 2, -.02 - SLAB - .1, (sz0 + ez1) / 2], null, G, 'soil band');
  part(box(sx1 - ex0, 5, ez1 - sz0), tm(earthClods(), (sx1 - ex0) / 2.4, 5 / 2.4, { rough: 1, bump: 5 }), [(ex0 + sx1) / 2, -.02 - SLAB - .2 - 2.5, (sz0 + ez1) / 2], null, G, 'earth');
  // interior brick walls (A: the bar wall, B: the sconce wall): soot at the top, grime at the foot
  part(box(w + .35, CEIL, .3), tm(brick({ soot: .5, grime: .55, seed: 1, dark: .78, grey: .38 }), (w + .35) / 2, CEIL / 3, { rough: .9, bump: 1.8 }), [cx + .125, CEIL / 2, Z0 - .15], null, G, 'wall A');
  part(box(.3, CEIL, d + .3), tm(brick({ soot: .45, grime: .5, seed: 2, dark: .78, grey: .38 }), (d + .3) / 2, CEIL / 3, { rough: .9, bump: 1.8 }), [X1 + .15, CEIL / 2, cz - .15], null, G, 'wall B');
  // parapets on the two cut sides: a concrete upstand of the slab, one brick course, a rowlock coping
  const parP = brick({ seed: 3, blots: 4, grey: .55, dark: .62 }), CURB = .05, curbM = tm(castConcrete('#36383c', { drips: 26 }), 4, .1, { rough: .92, bump: 2 });
  const parapet = (L, pos, ry, name, cl = L + .02, co = 0, out = 1) => { const g = new THREE.Group(); g.position.set(...pos); g.rotation.y = ry; G.add(g);
    part(box(L + (out < 0 ? .04 : 0), CURB + .02, PT + .04), curbM, [out < 0 ? -.02 : 0, (CURB + .02) / 2 - .02, out * .02], null, g, name + ' upstand');
    part(box(L, PH - CURB, PT), tm(parP, L / 2, (PH - CURB) / 3, { rough: .9, bump: 2.6, oy: .35 }), [0, CURB + (PH - CURB) / 2, 0], null, g, name);
    part(rbox(cl, CAP, PT + .03, .006), tm(coping(), cl / .6, 1, { color: 0xb8aea6, rough: .85, bump: 2.4 }), [co, PH + CAP / 2, 0], null, g, name + ' coping'); };
  parapet(d + PT, [X0 - PT / 2, 0, cz + PT / 2], Math.PI / 2, 'parapet left', d + PT + .02, 0, -1); parapet(w - .01, [cx + .005, 0, Z1 + PT / 2], 0, 'parapet front', w - .04, .025);
  // above the room: the dark ceiling band, the ceiling slab overhanging the cut, the brick storey above set back on it
  hung(part(box(w + PT + .3, SOFF - CEIL, d + PT + .3), std(0x564e4a, .95), [cx - PT / 2 + .15, (CEIL + SOFF) / 2, cz + PT / 2 - .15], null, G, 'ceiling'));
  const ux0 = X0 - .35, uz1 = Z1 + .35, ux1 = X1 + .5, uz0 = Z0 - .3;
  part(rbox(ux1 - ux0, STOP - SOFF, uz1 - uz0, .03), tm(castConcrete('#5e6166', { drips: 40 }), (ux1 - ux0) / 2, (STOP - SOFF) / 2, { rough: .9, bump: 2.2 }), [(ux0 + ux1) / 2, (SOFF + STOP) / 2, (uz0 + uz1) / 2], null, G, 'ceiling slab');
  const UH = 3.2, uy = STOP + UH / 2, upP = brick({ seed: 9, dark: .8, streaks: 14, soot: .2, grey: .4 });
  part(box(ux1 - ux0 - .1, UH, .3), tm(upP, (ux1 - ux0 - .1) / 2, UH / 3, { rough: .92, bump: 2.6 }), [(ux0 + ux1) / 2 + .05, uy, uz1 - .25], null, G, 'upper wall front');
  part(box(.3, UH, uz1 - uz0 - .4), tm(upP, (uz1 - uz0 - .4) / 2, UH / 3, { rough: .92, bump: 2.6, ox: .3 }), [ux0 + .25, uy, (uz0 + uz1) / 2 - .2], null, G, 'upper wall left');
  // the neighbours: a concrete pier at each end of the cut, then their façades (ground-floor openings, floor band, brick,
  // windows with sill and lintel), dark earth under them
  const concN = castConcrete('#3a3c40', { drips: 30 }), brickN = brick({ seed: 21, dark: .7, streaks: 18, soot: .25 });
  const pierM = h => tm(castConcrete('#505257', { drips: 20 }), .3, h / 2, { rough: .9, bump: 2 });
  part(rbox(.3, 8, .32, .02), pierM(8), [-1.7, 3.7, -5.5], null, G, 'pier left');
  part(rbox(.38, 8, .35, .02), pierM(8), [5.61, 3.7, 1.17], null, G, 'pier right');
  const glass = std(0x0b0d10, .15, { metalness: .5 }), frameM = std(0x3a3c3f, .7), sillM = std(0x5a5c5f, .85);
  const facade = (name, pos, ry, xa, xb, opens) => { const g = new THREE.Group(); g.name = name; g.position.set(...pos); g.rotation.y = ry; G.add(g); const L = xb - xa, xc = (xa + xb) / 2;
    part(box(L, SOFF, .4), tm(concN, L / 2, SOFF / 2, { rough: .9, bump: 2 }), [xc, SOFF / 2, -.2], null, g, name + ' ground');
    part(box(L, .3, 2.0), tm(castConcrete('#444648', { drips: 0 }), L / 2, 1, { rough: .85, bump: 1.5 }), [xc, -.15, .6], null, g, name + ' pavement');
    part(rbox(L, STOP - SOFF, .55, .02), tm(concN, L / 2, (STOP - SOFF) / 2, { rough: .9, bump: 2 }), [xc, (SOFF + STOP) / 2, -.125], null, g, name + ' band');
    part(box(L, 4, .4), tm(brickN, L / 2, 4 / 3, { rough: .92, bump: 2.6 }), [xc, STOP + 2, -.2], null, g, name + ' brick');
    part(box(L, 6, 1.2), tm(earthClods(), L / 2.4, 6 / 2.4, { color: 0x5a5a5a, rough: 1, bump: 4 }), [xc, -.3 - 3, -.4], null, g, name + ' earth');
    for (const [x, y, w_, h_, sill] of opens) {
      hung(part(box(w_, h_, .02), glass, [x, y, .01], null, g, 'window glass'));
      hung(part(box(w_ + .12, .07, .06), frameM, [x, y + h_ / 2 + .035, .03], null, g, 'window head'));
      for (const s of [-1, 1]) hung(part(box(.06, h_, .06), frameM, [x + s * (w_ / 2 + .03), y, .03], null, g, 'window jamb'));
      hung(part(box(.04, h_, .03), frameM, [x, y, .035], null, g, 'window mullion'));
      if (sill) { hung(part(rbox(w_ + .24, .07, .2, .01), sillM, [x, y - h_ / 2 - .035, .1], null, g, 'window sill')); hung(part(rbox(w_ + .16, .12, .08, .01), sillM, [x, y + h_ / 2 + .13, .04], null, g, 'window lintel')); }
      else hung(part(box(w_ + .12, .06, .06), frameM, [x, y - h_ / 2 - .03, .03], null, g, 'door foot')); }
    return g; };
  facade('neighbour left', [X0 - .45, 0, -5.66], -Math.PI / 2, -9, 0, [[-.85, 1.17, .95, 2.3, false], [-2.9, 1.5, 1.4, 1.4, true], [-1.35, STOP + 1.35, 1.0, 1.5, true]]);
  facade('neighbour right', [5.8, .3, Z1 + .5], 0, 0, 9, [[1.05, 1.55, 1.8, 1.6, true], [1.2, STOP + 1.35, 1.0, 1.5, true]]);
}

// ---- the bar wall: counter with raised panels, espresso machine, grinder, shelves, menu board, kitchen door ----
function bar(S, G) {
  const C = cafeMaterials(), top = std(0x4e4844, .38), BX0 = X0 + .02, BX1 = 3.25, BZ = -4.35, BD = .55, L = BX1 - BX0, mx = (BX0 + BX1) / 2, BH = 1.03, frontW = tm(furnitureWood('#4a3628'), 2, 1, { color: 0xc8c8c8, rough: .6, bump: .4 });
  part(rbox(L, BH, BD, .015), frontW, [mx, BH / 2, BZ - BD / 2], null, G, 'bar counter');
  part(rbox(L + .04, .05, BD + .1, .012), top, [mx, BH + .025, BZ - BD / 2 + .04], null, G, 'bar top');
  hung(part(box(L - .02, .1, .02), std(0x140d08, .7), [mx, .05, BZ + .01], null, G, 'bar kick'));
  const n = 6, pw = L / n;
  for (let i = 0; i < n; i++) { const x = BX0 + (i + .5) * pw;
    hung(part(rbox(pw - .16, .58, .02, .006), tm(furnitureWood('#4a3628'), .5, 1, { color: 0xb8b8b8, rough: .55, bump: .4 }), [x, .5, BZ + .01], null, G, 'bar panel'));
    hung(part(box(.05, .85, .025), std(0x24170e, .6), [BX0 + i * pw + .025, .55, BZ + .0125], null, G, 'bar stile')); }
  hung(part(box(L, .05, .025), std(0x24170e, .6), [mx, .925, BZ + .0125], null, G, 'bar rail')); hung(part(box(L, .05, .025), std(0x24170e, .6), [mx, .16, BZ + .0125], null, G, 'bar rail'));
  const TY = BH + .05;
  espressoMachine(G, [.3, TY, BZ - .29], 1.22);
  const gr = new THREE.Group(); gr.name = 'grinder'; gr.position.set(-.45, TY, BZ - .3); gr.scale.setScalar(1.25); G.add(gr);
  part(rbox(.16, .06, .2, .01), C.black, [0, .03, 0], null, gr, 'grinder foot'); part(cyl(.065, .075, .28, 18), std(0x1a1716, .35, { metalness: .3 }), [0, .2, 0], null, gr, 'grinder body');
  part(cyl(.085, .045, .16, 18), std(0x3a2a20, .2), [0, .42, 0], null, gr, 'grinder hopper'); part(cyl(.088, .088, .02, 18), C.black, [0, .51, 0], null, gr, 'hopper lid');
  part(cyl(.042, .042, .24, 16), std(0xa8a8a8, .2, { metalness: .85 }), [1.16, TY + .12, BZ - .2], null, G, 'tin');
  for (const x of [1.52, 1.66]) { part(cyl(.042, .042, .1, 14), std(0x2b1d14, .45), [x, TY + .05, BZ - .16], null, G, 'canister'); hung(part(cyl(.044, .044, .02, 14), C.black, [x, TY + .11, BZ - .16], null, G, 'canister lid')); }
  part(cyl(.03, .026, .1, 12), std(0x8a8f90, .1, { transparent: true, opacity: .6 }), [2.62, TY + .05, BZ - .16], null, G, 'glass');
  const till = new THREE.Group(); till.name = 'till'; till.position.set(2.95, TY, BZ - .28); till.rotation.y = -.35; G.add(till);
  part(rbox(.36, .07, .26, .01), std(0x18181a, .4), [0, .035, 0], null, till, 'till base'); part(cyl(.02, .025, .13, 10), C.black, [0, .135, -.03], null, till, 'till stand');
  hung(part(rbox(.32, .22, .03, .01), std(0x101012, .35), [0, .29, -.02], [-.25, 0, 0], till, 'till monitor'));
  hung(ns(part(box(.28, .18, .004), glowM(0x6a7c88), [0, .29, -.0035], [-.25, 0, 0], till, 'till screen')));
  // shelves on wall A left of the board: jars, a paper bag, tins
  for (const [y, k] of [[1.68, 0], [2.1, 1]]) { part(rbox(1.15, .035, .22, .005), tm(furnitureWood('#4a3020'), 1, .3, { rough: .55 }), [-.58, y, Z0 + .11], null, G, 'shelf');
    for (const x of [-1.05, -.15]) hung(part(box(.025, .14, .2), C.black, [x, y - .085, Z0 + .1], null, G, 'shelf bracket'));
    const items = k ? [['jar', -1.0], ['jar', -.86], ['bag', -.62], ['jar', -.4], ['tin', -.24], ['jar', -.12]] : [['jar', -1.02], ['tin', -.9], ['jar', -.78], ['bag', -.55], ['tin', -.33], ['jar', -.18]];
    for (const [t, x] of items) { const yb = y + .0175;
      if (t === 'jar') { const hj = .14 + hh((x * 100) | 0, k) * .06; part(cyl(.045, .045, hj, 14), std(0x3a3430, .25), [x, yb + hj / 2, Z0 + .11], null, G, 'jar'); hung(part(cyl(.047, .047, .02, 14), C.black, [x, yb + hj + .01, Z0 + .11], null, G, 'jar lid')); }
      else if (t === 'bag') part(box(.12, .2, .08), std(0x6a5e50, .9), [x, yb + .1, Z0 + .1], [0, .2, 0], G, 'coffee bag');
      else part(cyl(.05, .05, .15, 14), std(0x2e2a28, .5, { metalness: .3 }), [x, yb + .075, Z0 + .11], null, G, 'shelf tin'); } }
  const chalk = chalkMenu();
  part(box(2.5, .95, .03), new THREE.MeshStandardMaterial({ map: chalk, roughness: .92, emissive: 0xffffff, emissiveMap: chalk, emissiveIntensity: .14 }), [1.45, 2.2, Z0 + .03], null, G, 'chalk board');
  part(box(2.6, 1.05, .02), std(0x1a120c, .6), [1.45, 2.2, Z0 + .01], null, G, 'board frame');
  part(box(1.0, 2.2, .04), std(0x2b2d2a, .55), [3.6, 1.1, Z0 + .02], null, G, 'kitchen door');
  hung(part(box(1.1, .06, .05), std(0x161310, .6), [3.6, 2.23, Z0 + .025], null, G, 'door head'));
  for (const x of [3.075, 4.125]) hung(part(box(.05, 2.26, .05), std(0x161310, .6), [x, 1.13, Z0 + .025], null, G, 'door jamb'));
  hung(part(box(.5, .7, .01), std(0x34383a, .4), [3.6, 1.45, Z0 + .045], null, G, 'door panel'));
}

// ---- the room: boards and sconces on wall B, tables with chairs, pendants, downlight, the red lamp ----
function room(S, G) {
  const C = cafeMaterials();
  for (const [z, y, w_, h_, c] of [[-2.4, 1.84, .63, .86, 0x120b09], [-1.385, 1.86, .6, .83, 0x1c140f]]) {
    part(box(.03, h_ + .06, w_ + .06), std(0x120c09, .55), [X1 - .015, y, z], null, G, 'board frame');
    hung(part(box(.012, h_, w_), std(c, .7), [X1 - .036, y, z], null, G, 'dark board')); }
  sconce(S, G, [X1, 1.9, -3.37], -Math.PI / 2); sconce(S, G, [X1, 1.92, .04], -Math.PI / 2);
  const solids = [];
  const t = (p, chairs, o = {}) => { const T = cafeTable(G, p, o); solids.push(...T.solids); for (const [dx, dz, ry] of chairs) bentwoodChair(G, [p[0] + dx, 0, p[2] + dz], ry); };
  t([-.35, 0, -2.6], [[-.5, -.32, Math.PI / 2 - .3]]);
  t([2.75, 0, .35], [[.5, -.25, -Math.PI / 2 - .5]]);
  t([4.25, 0, -.5], [[0, -.55, 0]]);
  t([3.95, 0, -2.55], [[0, -.58, 0]]);
  const copper = std(0xb06a40, .3, { metalness: .9 });
  for (const x of [.56, 1.78, 2.94]) pendant(S, G, [x, 2.2, -4.6], { ceil: CEIL, cone: 5, r: .14, mat: std(0x231c1a, .55, { metalness: .4 }), rim: copper, inner: 0xff7a3a });
  pendant(S, G, [.1, 2.12, -2.65], { ceil: CEIL, cone: 10, r: .2, mat: std(0x1e1a19, .5, { metalness: .4 }), rim: copper, inner: 0xff8a4a });
  pendant(S, G, [2.6, 1.9, -2.3], { ceil: CEIL, cone: 10, r: .25 }); pendant(S, G, [3.8, 2.0, -.7], { ceil: CEIL, cone: 10, r: .24 });
  hung(part(cyl(.07, .07, .05, 18), C.black, [2.05, CEIL - .025, -2.1], null, G, 'downlight can')); hung(ns(part(cyl(.055, .055, .006, 18), glowM(0xffa860), [2.05, CEIL - .053, -2.1], null, G, 'downlight')));
  { const dl = new THREE.SpotLight(0xffd0a0, 2.5, 4, .5, .8, 1.5); dl.position.set(2.05, CEIL - .08, -2.1); dl.target.position.set(2.05, 0, -2.1); S.scene.add(dl, dl.target); const cg = new THREE.PointLight(0xffc890, .25, .7, 2); cg.position.set(2.05, CEIL - .15, -2.1); S.scene.add(cg); }
  hung(ns(part(rbox(.5, .03, .08, .01), glowM(0xff3a20), [X1 - .12, CEIL - .015, -2.3], null, G, 'red lamp')));
  return solids;
}

shot({ trans: 'cut', t0: 0, build(S) {
  cafeMaterials();
  S.recon = false;   // no corner tag: the reference has none
  S.scene.background = new THREE.Color(0x101216); S.scene.fog = new THREE.FogExp2(0x22252c, .028); S.scene.environmentIntensity = .3;
  S.scene.add(new THREE.HemisphereLight(0x5a78b8, 0x3a3436, .3));
  const night = new THREE.DirectionalLight(0x9aa2ae, 1.1); night.position.set(-9, 6, 8); S.scene.add(night);
  // the red wash by wall B
  const red = new THREE.SpotLight(0xd05040, 7, 6, 1.5, 1, 1.2); { const r2 = new THREE.PointLight(0xd04838, .9, 2.8, 1.6); r2.position.set(X1 - .45, 2.3, -1.7); S.scene.add(r2); } red.position.set(X1 - .15, CEIL - .06, -2.3); red.target.position.set(X1, 1.2, -2.0); S.scene.add(red, red.target);
  const redC = new THREE.PointLight(0xff3018, 1.6, 2.6, 2); redC.position.set(X1 - .3, CEIL - .2, -2.3); S.scene.add(redC);
  const redUp = new THREE.SpotLight(0xff3018, 4, 1.6, 1.3, 1, 2); redUp.position.set(X1 - .35, CEIL - .35, -2.3); redUp.target.position.set(X1 - .35, CEIL, -2.3); S.scene.add(redUp, redUp.target);
  // cool night fills on the outside (upper storey, slab and earth, the neighbours)
  const upFill = new THREE.SpotLight(0xa8acb4, 150, 40, .22, .8, 1.2); upFill.position.set(-9, 6.5, 8); upFill.target.position.set(1.0, 4.4, -.6); S.scene.add(upFill, upFill.target);
  const lowFill = new THREE.SpotLight(0x9ea2a8, 380, 40, .25, .9, 1.2); lowFill.position.set(-9, -2.2, 9); lowFill.target.position.set(.5, -1.0, 0); lowFill.castShadow = true; lowFill.shadow.mapSize.set(1024, 1024); lowFill.shadow.bias = -.001; lowFill.shadow.normalBias = .03; S.scene.add(lowFill, lowFill.target);
  for (const [tx, ty, tz, k] of [[-1.7, 1.6, -8.5, 360], [7.5, 1.6, 1.6, 430]]) { const f = new THREE.SpotLight(0x9ca0a6, k, 40, .3, 1, 1.2); f.position.set(-10, 4, 9); f.target.position.set(tx, ty, tz); S.scene.add(f, f.target); }
  { const rm = new THREE.PointLight(0xffe8dc, .6, 7, 1.2); rm.position.set(2.2, 2.6, -.8); S.scene.add(rm); const low = new THREE.PointLight(0xffd8b8, .9, 5, 1.2); low.position.set(.5, 1.6, -3.4); S.scene.add(low); const low2 = new THREE.PointLight(0xffd0a8, .6, 3.5, 1.3); low2.position.set(-.5, 1.5, -3.2); S.scene.add(low2); const cl = new THREE.PointLight(0xffc8a0, .5, 4, 1.5); cl.position.set(1.4, 2.8, -2.6); S.scene.add(cl); }
  const G = new THREE.Group(); G.name = 'café cut-away'; S.scene.add(G);
  shell(S, G); bar(S, G); room(S, G); const { B, solids, seatY: BSEAT } = booth(S, G, BOOTH);
  const key = new THREE.SpotLight(0xffd8b8, 3.5, 6, .5, .8, 1.5); key.position.set(.2, CEIL - .05, -.2); key.target.position.set(-.1, 0, .1); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 7; key.shadow.bias = -.0005; key.shadow.normalBias = .02; S.scene.add(key, key.target);
  // the two men in the booth (inside its group), glowing (cafe look); the barista dressed, not glowing
  const man = (name, o) => MANNEQUIN ? glow(rebindMannequin(figure({ role: 'extra', body: 'm', name }, o), MODELS.man), 'cafe') : glowPerson(name, o, 'cafe');
  const Lm = man('man left', { parent: B, x: -.36, z: -.02, ry: Math.PI / 2 }), Rm = man('man right', { parent: B, x: .31, z: -.02, ry: -Math.PI / 2 });
  const barista = figure({ role: 'extra', outfit: 'longsleeve', body: 'm', colors: { top: '#232a24', bottom: '#151517' }, name: 'barista' }, { parent: G, x: 1.85, z: -4.92, ry: .45 }); barista.group.scale.setScalar(1.08);
  const W = (x, y, z) => B.localToWorld(V(x, y, z)), tt = 1.3;
  // seated by MEASURING the posed bodies (lib/props.js sitOn): thighs on the side-bench cushions (booth-local top BOOTH.seat,
  // the pelvis over the bench centres x -/+ .88 so the feet clear the table's cross foot), facing each other across the
  // table; the tick then plays the clips WITHOUT seat: (that would move them again)
  S.scene.updateMatrixWorld(true);
  sitOn(S, Lm, { at: W(-.88, BSEAT, -.02).toArray(), face: W(0, BSEAT, -.02) }, { act: 'Sitting_Talking_Loop', t: tt });
  sitOn(S, Rm, { at: W(.88, BSEAT, -.02).toArray(), face: W(0, BSEAT, -.02) }, { act: 'Sitting_Idle_Loop', t: tt + .6 });
  S.tick(() => {   // pose.recon.booth-sitters
    Lm.act('Sitting_Talking_Loop', { t: tt }); Rm.act('Sitting_Idle_Loop', { t: tt + .6 }); barista.act('stand', { t: tt });
    B.updateWorldMatrix(true, true); lean(Lm, .16, -.02); lean(Rm, .2, 0);
    Lm.handTo('R', W(-.1, 1.02, .22), { weight: 1, curl: .1, palmNormal: [0, 1, 0] }); Lm.handTo('L', W(-.28, .84, -.04), { weight: 1, curl: .6 });
    Rm.handTo('L', W(.27, .86, .16), { weight: 1, curl: .6 }); Rm.handTo('R', W(.29, .845, -.1), { weight: 1, curl: .6 });
    barista.handTo('R', V(1.62, 1.1, -4.42), { weight: .9, curl: .5 }); barista.handTo('L', V(2.1, 1.1, -4.45), { weight: .7, curl: .5 }); });
  boneLog(S, [Lm, Rm], ['pelvis', 'thigh_l', 'calf_l', 'spine_03', 'Head'], { local: B });
  glowCap(S, Lm, 'cafe');   // (after the pose tick: the cap follows the posed head)
  for (const dx of [-.5, .5]) { const pl = new THREE.PointLight(0xff6a18, 1.6, 2.6, 1.8); S.scene.add(pl); S.tick(() => pl.position.copy(B.localToWorld(V(dx * 1.2, 1.15, -.4))));
    const kl = new THREE.PointLight(0xff6a18, 1.0, 2.0, 1.8); S.scene.add(kl); S.tick(() => kl.position.copy(B.localToWorld(V(dx * 1.4, .62, .32)))); }
  { const bag = duffel(G, [-.02, 0, .78], 1.4); bag.scale.setScalar(1.18); }
  S.collide = { bodies: () => [bodyOf(Lm), bodyOf(Rm)], solids: [...solids] };
  S.post.bloom = .32; S.post.dof = null; S.subject = [0, .9, 0]; S.visibility = false;
  S.camera([{ t: 0, ...CAM }, { t: 5, ...CAM }]);
} });
