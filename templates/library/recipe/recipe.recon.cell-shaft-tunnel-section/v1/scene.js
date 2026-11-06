// RECIPE recipe.recon.cell-shaft-tunnel-section v1: a sunlit prison-cell cut-away over the earth - the cell (bars, bunk,
// steel toilet and sink), a dug shaft through the floor slab with a rope over the broken lip, a timbered tunnel with a bare
// bulb, four glowing men (standing at the bars, kneeling at the hole, climbing the rope, crawling in the tunnel).
// Matched to an AI reference by measurement: layout right from pass 1, critic 5/10 (the material ceiling of procedural
// canvas textures), ISSUES 0. Needs project.json settings from settings.json next to this file (post.cap .97, ca 0).
// BLUEPRINT (14 landmarks on a 1920x1080 grid, ~19 px weighted rms; the lens is a dolly-zoom family until a real depth is
// assumed: cell depth 2.7 m):
//   camera (-.05, .87, 10.07) looking straight down -z, fov 38.74, LENS SHIFT 206 px (verticals stay vertical):
//   S.cam.setViewOffset(1920, 1080, 0, 206, 1920, 1080) after S.camera()
//   the cut plane z = 0. Cell interior x -4.86 .. 4.88, floor 0, ceiling 2.85, back wall z -2.68.
//   floor slab 0 .. -.58; shaft x -.58 .. 1.16 down to -3.47; tunnel y -3.47 .. -2.02 from x 1.16 to the right edge.
import { shot, THREE } from '../engine.js';
import { setup, MODELS } from '../lib/library.js';
import { part, std, rbox } from '../lib/crime.js';
import { hh } from '../lib/crimeover.js';
import { figure } from '../lib/figures.js';
import { perMetre, boardConcrete, looseSoil, weatheredWood } from '../library/module.recon.canvas-materials/index.js';
import { metricBox } from '../library/module.any.metric-box/index.js';
import { relief, reliefFaces, lumpyLip } from '../library/module.any.relief/index.js';
import { glowPerson, glow, rebindMannequin, glowLight } from '../library/module.recon.glow-person/index.js';
import { turn, footTo, bodyOf, boneLog } from '../library/module.recon.rig-pose/index.js';
import { cellBars, bunkBed, steelToilet, sinkUnit, hangingBulb, rope, prisonMaterials } from '../library/module.recon.prison-props/index.js';
import { faceGravel, faceStones, roots } from '../library/module.recon.ground-cover/index.js';

// ---- CONFIG ----
const MANNEQUIN = null;   // null = the kit's bare human, glowing; or 'assets/models/mannequin.glb' (kit bone names)
if (MANNEQUIN) await setup({ models: { man: MANNEQUIN } });
const CAM = { p: [-.05, .87, 10.07], l: [-.05, .87, 0], fov: 38.74 }, SHIFT_Y = 206;
const XL = -4.86, XR = 4.88, CEIL = 2.85, DEP = 2.68, JL = -5.36, JR = 5.36, SLAB = .58;
const SH0 = -.58, SH1 = 1.16, SHD = 1.0, TUN_C = -2.02, TUN_F = -3.47, TD = 1.0, BOT = -5.2;

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = new URLSearchParams(location.search);
const box = (w, h, d) => metricBox(w, h, d);   // metric UVs on every box (pitfall.any.box-uv-stretch)
const hung = m => { m.userData.noContact = true; return m; };
const M = {};
function mats() { if (M.ok) return M; M.ok = true;
  M.conc = perMetre(boardConcrete(), { rough: .92 }); M.concWall = perMetre(boardConcrete({ seams: true, ties: true, base: '#7a7874' }), { rough: .94 });
  M.concFloor = perMetre(boardConcrete({ base: '#8c8984' }), { rough: .9 });
  M.concCeil = perMetre(boardConcrete(), { color: 0xd0ccc4, rough: .95, x: { emissive: 0x2a2724 } });   // (no GI: the sunlit floor's bounce on the ceiling, faked)
  M.soil = perMetre(looseSoil(), { color: 0xc8d0e8, rough: 1 });   // (cool tint: cancels the warm grade + warm keys -> the reference's brown-grey)
  M.soilDk = perMetre(looseSoil(), { color: 0x8a8480, rough: 1 });
  M.wood = perMetre(weatheredWood(), { color: 0x9a8a7a }); M.woodDk = perMetre(weatheredWood(), { color: 0x6a5c50, rough: .9 });
  M.woodV = perMetre(weatheredWood(), { color: 0x9a8a7a, rot: Math.PI / 2 });   // vertical members: grain along their length
  M.rock = std(0x6e665d, .85);
  return M; }

// ---- the building: slab with the dug hole, walls, jamb, ceiling ----
function building(S, G) { const { conc, concWall, concFloor, concCeil } = mats(), solids = [];
  const B = (w, h, d, at, m, name, ground) => { const o = part(box(w, h, d), m, at, null, G, name); if (ground) o.userData.ground = true; return o; };
  const zb = -DEP - .3;
  solids.push(B(SH0 - (-11), SLAB, -zb, [(SH0 - 11) / 2, -SLAB / 2, zb / 2], concFloor, 'floor slab left', true));
  solids.push(B(JR - SH1 - .03, SLAB, -zb, [(SH1 + .03 + JR) / 2, -SLAB / 2, zb / 2], concFloor, 'floor slab right', true));
  solids.push(B(SH1 + .03 - SH0, SLAB, -zb - SHD, [(SH0 + SH1 + .03) / 2, -SLAB / 2, (zb - SHD) / 2], concFloor, 'floor slab behind the hole', true));
  B(JR + 11, CEIL, .3, [(JR - 11) / 2, CEIL / 2, -DEP - .15], concWall, 'back wall');
  solids.push(B(JR - XR, CEIL, DEP, [(XR + JR) / 2, CEIL / 2, -DEP / 2], conc, 'right wall'));
  solids.push(B(XL - JL, CEIL, .55, [(XL + JL) / 2, CEIL / 2, -.275], conc, 'left jamb'));
  B(XL - JL, CEIL - 2.62, DEP - .55, [(XL + JL) / 2, (CEIL + 2.62) / 2, -.55 - (DEP - .55) / 2], conc, 'bars lintel');
  B(XL - JL, .08, DEP - .55, [(XL + JL) / 2, .04, -.55 - (DEP - .55) / 2], conc, 'bars sill');
  B(JR + 11, .9, DEP + .3, [(JR - 11) / 2, CEIL + .45, -(DEP + .3) / 2], concCeil, 'ceiling slab');
  { const f = part(box(JR + 11, .9, .02), conc, [(JR - 11) / 2, CEIL + .45, .01], null, G, 'frame head face'); f.castShadow = false; }
  return solids; }

// ---- under the slab: the earth face (relief + backing mass), the shaft, the tunnel ----
function earth(S, G) { const { soil, soilDk } = mats(), solids = [], R = reliefFaces(G);
  R.face(-11, SH0, BOT, -SLAB, .02, 1, .5, soil, { name: 'earth left' });
  R.face(SH1, 12, TUN_C, -SLAB, .02, 2, .5, soil, { name: 'earth above tunnel' });
  R.face(SH0, 12, BOT, TUN_F, .02, 3, .35, soil, { name: 'earth below' });
  R.face(JR, 12, -SLAB - .02, 4.2, -.1, 4, .45, soil, { name: 'earth right of the cell' });
  R.face(SH0, SH1, TUN_F, -SLAB, -SHD, 5, .25, soilDk, { name: 'shaft back', back: true });
  R.face(SH1 - .02, 12, TUN_F, TUN_C, -TD, 6, .25, soilDk, { name: 'tunnel back', back: true });
  { const c = relief(12 - SH1, TD, .12, 7, soilDk); c.rotation.x = Math.PI / 2; c.position.set((SH1 + 12) / 2, TUN_C, -TD / 2); c.name = 'tunnel ceiling'; G.add(c); }
  { const fl = relief(12 - SH0, TD, .06, 8, soil, { bias: .03 }); fl.rotation.x = -Math.PI / 2; fl.position.set((SH0 + 12) / 2, TUN_F, -TD / 2); fl.name = 'tunnel floor'; fl.userData.ground = true; G.add(fl); }
  // the earth's backing masses sit .3 m+ behind the faces (clamped relief plateaus z-fight with a box at their depth)
  for (const [x0, x1, z] of [[-11, SH0, -.3], [SH1, 12, -.3]]) { const b = part(new THREE.BoxGeometry(x1 - x0, 1.6, 4), std(0x1a140f, 1), [(x0 + x1) / 2, -SLAB - .8 - .02, z - 2], null, G, 'earth mass'); b.castShadow = false; }
  { const b = part(new THREE.BoxGeometry(12 - SH0, BOT - TUN_F, 4), std(0x1a140f, 1), [(SH0 + 12) / 2, (BOT + TUN_F) / 2 - .05, -2.3], null, G, 'earth mass below'); b.castShadow = false; b.userData.ground = true; solids.push(b); }
  // the overhang over the tunnel: a lumpy lip of soil along the cut edge
  { const lip = part(lumpyLip(12 - SH1, .11, 41), soil, [(SH1 + 12) / 2, TUN_C + .06, -.08], [0, 0, Math.PI / 2], G, 'overhang lip'); lip.scale.set(1, 1, .8); hung(lip); }
  // stones half buried in the face, 450 gravel pebbles pressed into it, roots fanning down from under the slab
  const st = []; for (let i = 0; i < 34; i++) { const x = -10 + hh(i, 1) * 9.2, y = -.9 - hh(i, 2) * 4.0, r = .05 + hh(i, 3) ** 2 * .17; if (x < SH0 - .25) st.push([x, y, r, i]); }
  for (let i = 0; i < 12; i++) st.push([SH1 + .4 + hh(i, 11) * 6, -.8 - hh(i, 12) * 1.0, .05 + hh(i, 13) ** 2 * .14, i + 50]);
  faceStones(G, R.surf, st, { mat: mats().rock });
  faceGravel(G, R.surf, { n: 450, x0: -10.5, x1: 11.5, y0: -5.0, y1: -.7, skip: (x, y) => (x > SH0 - .05 && x < SH1 + .05) || (x > SH1 && y < TUN_C + .05 && y > TUN_F - .05) || (x > JR && y > -SLAB) });
  roots(G, R.surf, [[-4.75, -.6], [-4.5, .5], [-2.7, .2], [-2.35, -.45], [-3.6, .5], [2.55, .7], [2.85, -.5]].map(([x, a], k) => [x, -SLAB - .03, a, k < 5 ? 1.3 + hh(k, 2) * .6 : .8]), { floor: -4.6 });
  return solids; }

function shaft(S, G) { const g = new THREE.Group(); g.name = 'shaft timbering'; G.add(g); const { wood: W, woodDk: Wd, woodV, conc, rock } = mats(), solids = [], top = -SLAB, bot = TUN_F;
  for (const [x, z] of [[SH0 + .08, -.08], [SH1 - .08, -.08], [SH0 + .08, -SHD + .1], [SH1 - .08, -SHD + .1]]) solids.push(part(box(.13, top - bot, .12), woodV, [x, (top + bot) / 2, z], null, g, 'shaft post'));
  for (let i = 0; i < 9; i++) { const y = top - .2 - i * .33; part(box(.1, .07, SHD - .1), Wd, [SH0 + .17, y, -SHD / 2], [0, 0, (hh(i, 1) - .5) * .08], g, 'crib board'); }
  for (let i = 0; i < 6; i++) { const y = top - .35 - i * .5; part(box(.08, .07, SHD - .1), Wd, [SH1 - .17, y, -SHD / 2], null, g, 'crib board'); }
  // back: horizontal crib boards at ~0.18 m pitch, uneven lengths and tilts, a few missing (critic: not clean X braces)
  for (let i = 0; i < 16; i++) { if (hh(i, 9) < .15) continue; const y = top - .12 - i * .18, L = SH1 - SH0 - .3 - hh(i, 4) * .3;
    hung(part(box(L, .07, .03), hh(i, 5) < .5 ? Wd : W, [(SH0 + SH1) / 2 + (hh(i, 6) - .5) * .2, y, -SHD + .04 + hh(i, 7) * .04], [0, 0, (hh(i, 3) - .5) * (hh(i, 8) < .35 ? 1.2 : .3)], g, 'back plank')); }
  const brace = (a, b, n) => { const A = V(...a), Bv = V(...b), d = Bv.clone().sub(A), m = part(box(.08, d.length(), .05), woodV, [0, 0, 0], null, g, n); m.position.copy(A).add(Bv).multiplyScalar(.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); return m; };
  brace([SH0 + .2, -.8, -.75], [SH1 - .25, -1.9, -.78], 'brace'); brace([SH1 - .2, -1.7, -.7], [SH0 + .25, -2.9, -.72], 'brace'); brace([SH0 + .2, -1.2, -.6], [SH1 - .3, -1.5, -.62], 'brace'); brace([SH1 - .25, -2.6, -.55], [SH0 + .3, -3.3, -.57], 'brace');
  solids.push(brace([SH0 + .1, -2.4, -.15], [.55, bot + .02, -.25], 'fallen board'));
  for (let i = 0; i < 9; i++) { const x = SH0 + .2 + hh(i, 5) * 1.3, y = bot + .03 + i * .045; part(box(.5 + hh(i, 6) * .4, .04, .08), Wd, [x, y, -.3 - hh(i, 7) * .5], [0, hh(i, 8) * 3, (hh(i, 9) - .5) * .4], g, 'debris board'); }
  for (let i = 0; i < 18; i++) { const r = .03 + hh(i, 21) * .06; part(new THREE.DodecahedronGeometry(r, 0), rock, [SH0 - .1 + hh(i, 22) * 1.9, bot + r * .6, -.1 - hh(i, 23) * .8], [hh(i, 24) * 3, 0, hh(i, 25) * 3], g, 'rubble'); }
  // the slab's broken front lip over the hole (the rope runs over it): one jagged extruded profile, .24 m deep
  { const sh = new THREE.Shape(), n = 26, x0 = SH0 + .005, x1 = SH1 + .025, tp = i => -.03 - Math.sin(Math.PI * i / n) * .1 - hh(i, 81) * .05, bt = i => -.3 - hh(i, 82) * .1 + Math.sin(Math.PI * i / n) * .08;
    sh.moveTo(x0, -.0); for (let i = 1; i < n; i++) sh.lineTo(x0 + (x1 - x0) * i / n, tp(i)); sh.lineTo(x1, -.0); sh.lineTo(x1, -SLAB + .05);
    for (let i = n - 1; i > 0; i--) sh.lineTo(x0 + (x1 - x0) * i / n, bt(i)); sh.lineTo(x0, -SLAB + .05); sh.closePath();
    part(new THREE.ExtrudeGeometry(sh, { depth: .24, bevelEnabled: false }), conc, [0, 0, -.25], null, g, 'broken slab lip'); }   // (extrude UVs are already metres)
  // chips on the floor by the hole, rested ON the floor (a chip sunk 7 mm read as 'floating 56 cm': the ray starts inside)
  for (const [x, z, ry] of [[-.85, -.3, .4], [1.4, -.35, -.6], [1.62, -.2, 1.1]]) { const c = part(new THREE.DodecahedronGeometry(.06 + hh(x * 9, 1) * .04, 0), conc, [x, 0, z], [0, ry, 0], g, 'slab chip'); c.scale.set(1.5, .45, 1.1);
    c.updateMatrixWorld(true); c.position.y = .001 - new THREE.Box3().setFromObject(c).min.y; }
  return solids; }

function tunnel(S, G) { const g = new THREE.Group(); g.name = 'tunnel timbering'; G.add(g); const { wood, woodDk, woodV, soilDk } = mats(), solids = [];
  for (const [x, z] of [[1.47, -.12], [4.8, -.12], [1.47, -TD + .12], [4.8, -TD + .12], [8.1, -.12]]) { solids.push(part(box(.14, TUN_C - TUN_F, .13), woodV, [x, (TUN_C + TUN_F) / 2, z], [0, 0, (hh(x * 10, 2) - .5) * .03], g, 'tunnel post'));
    part(box(.18, .1, .16), woodDk, [x, TUN_C - .05, z], null, g, 'post cap'); }
  // the tray of spoil the crawler pushes
  const T = new THREE.Group(); T.name = 'spoil tray'; T.position.set(4.15, TUN_F + .005, -.42); g.add(T);
  for (const [w, d, x, z] of [[1.15, .04, 0, .3], [1.15, .04, 0, -.3], [.04, .6, -.56, 0], [.04, .6, .56, 0]]) solids.push(part(box(w, .2, d), wood, [x, .1, z], null, T, 'tray side'));
  solids.push(part(box(1.15, .03, .6), woodDk, [0, .015, 0], null, T, 'tray bottom'));
  { const m = relief(1.08, .52, .12, 12, soilDk, { res: 30, bias: .07 }); m.rotation.x = -Math.PI / 2; m.position.set(0, .16, 0); m.name = 'spoil'; T.add(m); }
  hangingBulb(S, g, [[SH1 + .05, TUN_C - .1, -.2], [1.47, TUN_C - .09, -.2], [2.3, TUN_C - .22, -.3], [3.1, TUN_C - .12, -.35], [4.0, TUN_C - .24, -.3], [4.8, TUN_C - .09, -.2], [6.4, TUN_C - .25, -.25], [8.1, TUN_C - .09, -.2]], [3.1, TUN_C - .34, -.35]);
  return solids; }

shot({ trans: 'cut', t0: 0, build(S) {
  mats(); const P_ = prisonMaterials();
  S.scene.background = new THREE.Color(0x1a140e); S.scene.environmentIntensity = .25;
  S.recon = false;   // no corner badge on a still
  S.scene.add(new THREE.HemisphereLight(0xc8c0b4, 0x5a4c40, .15));
  // raking key for the earth face: from the far left, nearly along the face, so every lump has a lit side and a shadow
  const rake = new THREE.DirectionalLight(0xffd0a0, 1.2); rake.position.set(-9, 5, 3); rake.target.position.set(0, -2.2, 0);
  rake.castShadow = true; rake.shadow.mapSize.set(4096, 4096); Object.assign(rake.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: .5, far: 40 }); rake.shadow.bias = -.0006; rake.shadow.normalBias = .03;
  S.scene.add(rake, rake.target);
  // bounce off the sunlit cell floor (lights the ceiling's underside and the walls' lower halves): a cheap GI term
  const bounce = new THREE.SpotLight(0xd8ccbc, 4, 8, 1.3, 1, 1.0); bounce.position.set(0, .05, -.6); bounce.target.position.set(0, CEIL, -1.6); S.scene.add(bounce, bounce.target);
  // low late sun from the front left: lights the cell, rakes the earth face, the frame's shadows fall right
  const sun = new THREE.DirectionalLight(0xffdcb4, 6.5); sun.position.set(-7, 9, 9); sun.target.position.set(0, -.5, -1);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 9, bottom: -9, near: .5, far: 40 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03; sun.shadow.radius = 6; sun.shadow.blurSamples = 16;
  S.scene.add(sun, sun.target);
  const pool = new THREE.SpotLight(0xfff0e0, 30, 18, .55, .9, 1.2); pool.position.set(2.5, 3, 8); pool.target.position.set(-1.6, -1.7, 0); S.scene.add(pool, pool.target);
  const fill = new THREE.DirectionalLight(0xf0e6dc, .45); fill.position.set(1, 2, 12); fill.target.position.set(0, -1, 0); S.scene.add(fill, fill.target);
  const G = new THREE.Group(); G.name = 'prison cut-away'; S.scene.add(G);
  const solids = [...building(S, G), ...earth(S, G), ...shaft(S, G), ...tunnel(S, G)];
  cellBars(G, { x: XL - .12, z0: -.6, z1: -DEP + .05 });
  solids.push(...bunkBed(G, { x0: -2.45, x1: .05, z0: -1.05, z1: -1.95 }).solids);
  solids.push(...steelToilet(G, [4.2, 0, -.6]).solids, ...sinkUnit(G, [XR - .2, 0, -.75]).solids);
  part(new THREE.CylinderGeometry(.07, .07, CEIL, 14), std(0x3a3632, .5, { metalness: .5 }), [4.45, CEIL / 2, -DEP + .1], null, G, 'soil pipe');
  part(box(.04, .35, .12), P_.steel, [XR - .021, 1.25, -1.5], null, G, 'flush plate');
  { const sh = new THREE.Group(); G.add(sh); part(rbox(.26, .09, .1, .03), P_.clothDk, [-2.6, .045, -.95], [0, .3, 0], sh, 'shoe'); hung(part(new THREE.BoxGeometry(.18, .003, .12), std(0xd8d4cc, .9), [-.6, .0015, -.6], [0, .4, 0], sh, 'paper')); }
  // the rope: tied round the broken lip (a loop over its top), falling in front of it, then back under it to the climber's hands
  { const lipTop = -.03 - Math.sin(Math.PI * (.33 - (SH0 - .02)) / (SH1 + .07 - SH0)) * .1;
    rope(G, [[.33, lipTop + .02, .045], [.33, lipTop - .25, .06], [.3, -.42, .05], [.2, -.62, -.2], [.12, -.85, -.4], [.1, -1.2, -.41], [.08, -1.8, -.42], [.04, -2.6, -.4], [.0, -3.1, -.38]],
      { loop: [[.33, lipTop - .2, .05], [.33, lipTop + .03, .04], [.34, lipTop + .04, -.12], [.34, lipTop + .03, -.27], [.34, lipTop - .25, -.28], [.335, -.5, -.12], [.33, lipTop - .2, .05]], knot: [.33, lipTop - .22, .065] }); }
  // the four men, glowing (sunlit look: core->rim ramp + additive halo shells; bloom can't isolate them in sunlight)
  const man = (name, o) => MANNEQUIN ? glow(rebindMannequin(figure({ role: 'extra', body: 'm', name }, o), MODELS.man), 'sunlit') : glowPerson(name, o, 'sunlit');
  const A = man('at the bars', { parent: G, x: -4.15, z: -1.0, ry: -1.85 }); A.group.scale.setScalar(1.07);   // 0.5 m deeper + 1.07: size AND reach land
  const K = man('kneeler', { parent: G, x: 2.05, y: .02, z: -1.2, ry: -Math.PI / 2 });
  const C = man('climber', { parent: G, x: -.06, z: -.45, ry: Math.PI / 2 + .45 });
  const P = man('crawler', { parent: G, x: 2.75, z: -.45, ry: Math.PI / 2 });
  const Z = V(0, 0, 1);
  // the lowest DRAWN point of a posed figure (world y): the idle clip's soles end ~3 cm under its root on this body, so the
  // man at the bars and the kneeler are lifted by exactly that (soles / knee on the floor, not in the slab)
  const soleY = f => { let lo = Infinity; const v = V(); f.group.updateMatrixWorld(true);
    f.group.traverseVisible(m => { if (!m.isSkinnedMesh || !(m.layers.mask & 1)) return; const n = m.geometry.attributes.position.count;
      for (let i = 0; i < n; i += 2) { m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld); if (v.y < lo) lo = v.y; } }); return lo; };
  let liftA = null, liftK = null;
  S.tick(() => {   // poses: pose.recon.bars-reacher / hole-kneeler / rope-climber / prone-crawler
    // (the idle stance stands both soles on the floor by itself: a foot IK target re-aims the calf and pitches the toes
    // into the slab on the mannequin body, so the feet stay the clip's; only the left palm goes to a bar)
    A.play('Idle_Loop', 0).apply(); A.group.position.y = liftA ??= -soleY(A); A.handTo('L', V(XL - .1, 1.32, -1.5), { weight: 1, curl: .7, palmNormal: [-1, 0, 0] });
    K.group.position.y = 0; K.play('Fixing_Kneeling', 1).apply(); K.group.position.y = liftK ??= -soleY(K); turn(K, 'spine_01', Z, .2); turn(K, 'spine_02', Z, .2); turn(K, 'neck_01', Z, -.15); K.handTo('L', V(1.5, .01, -.95), { weight: 1, curl: .2, palmNormal: [0, -1, 0] }); K.handTo('R', V(1.62, .01, -1.4), { weight: 1, curl: .2, palmNormal: [0, -1, 0] });
    C.group.position.y = -2.78; C.play('Idle_Loop', 0).apply();
    footTo(C, 'R', V(.56, -2.16, -.42), V(.6, -1.2, -.3)); footTo(C, 'L', V(.1, -2.74, -.5), V(.5, -2.3, -.4));
    C.handTo('R', V(.11, -1.0, -.41), { weight: 1, curl: .85 }); C.handTo('L', V(.09, -1.45, -.41), { weight: 1, curl: .85 });
    P.group.position.y = TUN_F + .2; P.play('Swim_Fwd_Loop', .3).apply();
    footTo(P, 'L', V(1.55, TUN_F + .08, -.55), V(1.9, TUN_F + .5, -.55)); footTo(P, 'R', V(1.5, TUN_F + .08, -.3), V(1.9, TUN_F + .5, -.3));
    turn(P, 'spine_01', Z, .25); turn(P, 'spine_02', Z, .35); turn(P, 'spine_03', Z, .15); turn(P, 'neck_01', Z, .2); P.handTo('R', V(3.6, TUN_F + .21, -.6), { weight: 1, curl: .5 }); P.handTo('L', V(3.6, TUN_F + .21, -.25), { weight: 1, curl: .5 });
  });
  boneLog(S, [A, K, C, P]);   // ?bones=1 prints them once
  for (const [f, i, d] of [[A, .9, 2.2], [K, .9, 2.2], [C, 1.6, 2.6], [P, 1.4, 2.6]]) glowLight(S, f, { color: 0xff7a20, i, d, bone: 'spine_02', off: [0, 0, .35] });
  // (his soles are put on the floor by measurement above; the kit's foot capsule - ankle to ball, its radius taken over the
  // toes too - reaches ~2 cm under a flat sole, so a flat-footed stance on a solid slab always reads 'inside'. His feet are
  // left out of the body check; everyone else, and his legs, hands and body, are checked against every solid.)
  S.collide = { bodies: () => [A, K, C, P].map(f => { const b = bodyOf(f); if (f === A) b.caps = b.caps.filter(c => !/^(foot|ball)_/.test(c.part)); return b; }), solids };
  S.post.bloom = .45; S.post.dof = null; S.subject = [0, 0, 0]; S.visibility = false;
  S.camera([{ t: 0, ...CAM }, { t: 5, ...CAM }]);
  // the reference's lens is shifted (verticals parallel, horizon above centre): an off-axis frustum, kept by the engine
  S.cam.setViewOffset(1920, 1080, 0, +(Q.get('offy') ?? SHIFT_Y), 1920, 1080);
} });
