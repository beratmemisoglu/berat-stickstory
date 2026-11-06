// RECIPE recipe.recon.prison-wall-dig-diorama v1: an escape tunnel under a prison wall - a cut-away block of earth at night,
// a timbered gallery with rails, a mine cart, caged lamps, four glowing men (pusher, map reader, two diggers), the wall
// with razor wire on top and a guard tower far back. Matched to an AI reference by measurement: critic 7/10, ISSUES 0.
// Needs project.json settings from settings.json next to this file (theme investigation, post.cap .95, post.ca 0).
// BLUEPRINT (solved from 22 landmarks on a 1920x1080 grid, ~16 px weighted rms, subject region ~10 px; scale from figures):
//   camera p (-3.293, 3.008, 14.167) look (6.759, -2.386, -2.454) fov 36.86, ENGINE roll -.114 (= -solver roll)
//   world: the cut face is z = 0, the ground top y = 0, the block runs x 0 .. 22.3
//   gallery floor y -4.34, plank deck underside -1.38 (2.96 m high), back lining z -2.9, x .12 .. 17.3
//   wall panels 3.2 m wide x 2.45 m from x 2.39 to 21.7, front face z -.6; footings flush with the cut
//   the reference draws people ~1.5x the structure: POSE.*.s is each figure's scale fitted to its pixel height
// Edit the numbers in the CONFIG block; everything else follows from them.
import { shot, THREE } from '../engine.js';
import { setup, MODELS } from '../lib/library.js';
import { part, std } from '../lib/crime.js';
import { hh } from '../lib/crimeover.js';
import { tiled, canvasTex, strataSoil, rockFace, frostTop, gravelRoad, panelConcrete, liningBoards, deckBoards, dirtFloor, blobDecal, alphaRamp } from '../library/module.recon.canvas-materials/index.js';
import { glowPerson, glow, rebindMannequin, glowLight } from '../library/module.recon.glow-person/index.js';
import { hinge, lean, bodyOf } from '../library/module.recon.rig-pose/index.js';
import { cageLamp, railTrack, mineCart, airHose, cables, dirtPile, shovel, plantShovel, floorLantern } from '../library/module.recon.mine-props/index.js';
import { guardTower, prisonWall } from '../library/module.recon.prison-props/index.js';
import { grassTufts, stones } from '../library/module.recon.ground-cover/index.js';
import { figure } from '../lib/figures.js';
import { prop, sitOn } from '../lib/props.js';

// ---- CONFIG ----
// Body: null = the kit's bare human (glowing); or a project path to a rigged mannequin glb with the kit's bone names
const MANNEQUIN = null;   // e.g. 'assets/models/mannequin.glb'
if (MANNEQUIN) await setup({ models: { man: MANNEQUIN } });
const CAM = { p: [-3.293, 3.008, 14.167], l: [6.759, -2.386, -2.454], fov: 36.86, roll: -.114 };
const LX = 22.3, YF = -4.34, YC = -1.38, TZ = -2.9, TX0 = .12, TX1 = 17.3, DEPTH = 45, BOT = -26, BOT_FAR = -11.2;
const WX0 = 2.39, WX1 = 21.7, WZ = -.6, WH = 2.45, WT = .35, PANEL = 3.2, DECK = .07, DECKZ = .5;
const RAIL_K = .042, RAIL_Z0 = -1.22, GAUGE = .7, RAIL_END = 15.6, railZ = x => RAIL_Z0 + RAIL_K * x;
const CART_X = 3.05, CART_L = 1.5;
const POSE = { push: { x: 1.1, t: 0, hinge: .6, lean: .2, head: -.2, s: 1.5 }, read: { x: 8.15, z: -2.3, ry: .75, clip: 'Sitting_Idle_Loop', t: .3, lean: .25, head: .45, s: 1.45 },
  d1: { x: 12.9, z: -1.3, ry: 1.85, t: .75, hinge: .85, lean: .3, head: 0, reach: .8, back: .6, side: .1, s: 1.45 }, d2: { x: 15.3, z: -1.05, ry: -1.35, t: .1, hinge: 1.0, lean: .35, head: 0, reach: .75, back: .6, side: -.1, s: 1.45 } };

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const glowM = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
const hung = m => { m.userData.noContact = true; return m; };
const ns = m => { m.castShadow = false; return m; };
// a dig material: repeat once per `unit` metres over a w x h face (roughness .95 unless given)
const T = (set, w, h, unit, o = {}) => tiled(set, w, h, { unit, rough: .95, ...o });
const SOIL = strataSoil(), ROCKF = rockFace(), TOP = frostTop(), ROAD = gravelRoad(), CONC = panelConcrete(), BOARDS = liningBoards(), DECKTEX = deckBoards(), FLOOR = dirtFloor();
const MAPTEX = canvasTex(512, 400, (x, W, H) => { x.fillStyle = '#e8e2d2'; x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(60,50,40,.7)'; x.lineWidth = 3;
  for (let i = 0; i < 9; i++) { x.strokeRect(40 + hh(i, 1) * 360, 40 + hh(i, 2) * 260, 30 + hh(i, 3) * 90, 20 + hh(i, 4) * 70); }
  x.beginPath(); x.moveTo(30, 330); x.lineTo(200, 300); x.lineTo(300, 200); x.lineTo(470, 160); x.stroke(); x.setLineDash([10, 8]); x.beginPath(); x.moveTo(60, 120); x.lineTo(460, 300); x.stroke(); });

// ---- the block of earth with the gallery cut into its face ----
function block(G) {
  const dk = std(0x0c0b0a, 1);
  const B = (name, x0, x1, y0, y1, z0, z1, o = {}) => { const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const side = o.side ? T(o.side, d, h, o.su ?? 4, o.so) : dk, top = o.top ? T(o.top, w, d, o.tu ?? 4, o.to) : dk, front = o.front ? T(o.front, w, h, o.fu ?? 4, o.fo) : dk;
    return part(box(w, h, d), [side, side, top, dk, front, dk], [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], null, G, name); };   // +x -x +y -y +z -z
  const soilF = { color: 0xa09488 };
  B('ground top block', 0, LX, YC + DECK, 0, -DEPTH, 0, { top: TOP, tu: 5, to: { color: 0xd4dae4 }, front: SOIL, fu: 3.2, fo: soilF, side: ROCKF, su: 5 });
  { const m = B('earth below', 0, LX, BOT, YF, -DEPTH, 0, { front: SOIL, fu: 4.5, fo: { color: 0xffffff }, side: ROCKF, su: 6 });
    // the chunk's underside slopes: deep under the near end, shallow under the far end
    const p = m.geometry.attributes.position, h = (YF - BOT) / 2;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) { const x = p.getX(i) + LX / 2; p.setY(i, -h + (BOT_FAR - BOT) * x / LX * (p.getZ(i) > 0 ? 1 : .6)); }
    p.needsUpdate = true; m.geometry.computeVertexNormals(); }
  B('earth behind gallery', 0, LX, YF, YC + DECK, -DEPTH, TZ - .06, { side: ROCKF, su: 5 });
  B('earth left of gallery', 0, TX0, YF, YC + DECK, TZ - .06, 0, { front: ROCKF, fu: 3, side: ROCKF, su: 3 });
  B('earth right of gallery', TX1, LX, YF, YC + DECK, TZ - .06, 0, { front: SOIL, fu: 3.2, fo: soilF, side: SOIL, su: 3 });
  // the gallery floor: a 0.36 m slab whose front lip stands 12 cm proud of the cut (the reference's lit ledge under the rails)
  const fl = part(box(TX1 - TX0, .36, -TZ + .12), T(FLOOR, TX1 - TX0, -TZ + .12, 2.2, { color: 0xd0c0ac }), [(TX0 + TX1) / 2, YF + .06 - .18, TZ / 2 + .06], null, G, 'gallery floor'); fl.userData.ground = true;
  // an orange-brown dirt patch on the top (a decal: lifted 8 cm, polygonOffset - pitfall.any.far-decal-zfight)
  const patch = part(new THREE.PlaneGeometry(4.5, 3.5), new THREE.MeshStandardMaterial({ map: blobDecal(), transparent: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3 }), [6.8, .08, -23.8], [-Math.PI / 2, 0, 0], G, 'dirt patch'); patch.userData.noContact = true; patch.castShadow = false;
  // the rough end face (left): a displaced skin over the box face
  const g = new THREE.PlaneGeometry(DEPTH, -BOT, 160, 48), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const u = p.getX(i), v = p.getY(i), edge = Math.min(1, Math.abs(u - DEPTH / 2) / .6, Math.abs(v + BOT / 2) / .6);
    const n = (hh(Math.floor(u * 3) + Math.floor(v * 3) * 977, 1) - .5) * .2 + Math.sin(u * 1.3 + v * .7) * .14 + Math.sin(u * .37 - v * 1.1) * .2 + Math.sin(u * .12 + v * .3) * .35;
    p.setZ(i, (.06 + Math.abs(n)) * edge); }
  g.computeVertexNormals();
  const skin = part(g, T(ROCKF, DEPTH, -BOT, 9, { color: 0xccc6be }), [-.02, BOT / 2, -DEPTH / 2], [0, -Math.PI / 2, 0], G, 'end face rock'); skin.userData.noContact = true;
  // the patrol road behind the wall (8 m wide back-projected band), a feathered decal 4.5 cm up
  const road = part(new THREE.PlaneGeometry(LX - .4, 8), T(ROAD, LX - .4, 8, 4, { color: 0xc4c0b8, x: { polygonOffset: true, polygonOffsetFactor: -2, transparent: true,
    alphaMap: alphaRamp([[0, '#000'], [.3, '#bbb'], [.5, '#fff'], [.75, '#999'], [1, '#000']]) } }), [LX / 2, .045, -17], [-Math.PI / 2, 0, 0], G, 'patrol road');
  road.receiveShadow = true; road.castShadow = false; road.userData.noContact = true;
}

// ---- the gallery: lining, deck, posts, rails, lamps ----
function gallery(S, G) {
  const wood = std(0x463a30, .85), woodDk = std(0x2e2620, .85), solids = [], lw = TX1 - TX0, lh = YC - YF;
  solids.push(part(box(lw, lh, .06), T(BOARDS, lw, lh, 2.6, { color: 0xa89888 }), [(TX0 + TX1) / 2, (YF + YC) / 2, TZ - .03], null, G, 'back lining'));
  part(box(.06, lh, -TZ), T(BOARDS, -TZ, lh, 2.6, { color: 0xc8b090 }), [TX0 + .03, (YF + YC) / 2, TZ / 2], null, G, 'end lining left');
  // deck planks across the gallery, out over the cut; heights alternate 1.2 cm (neighbouring rotated planks read COPLANAR)
  const pw = .24; let x = TX0 - .2;
  for (let i = 0; x < TX1 + .2; i++) { const w = pw * (.85 + hh(i, 1) * .3), len = -TZ + DECKZ + (hh(i, 2) - .5) * .25, v = hh(i, 3);
    part(box(w - .025, DECK, len), T(DECKTEX, len, w, 2.4, { color: new THREE.Color().setHSL(.08, .1, .62 + v * .2), rot: Math.PI / 2 }), [x + w / 2, YC + DECK / 2 + (i % 2) * .012, TZ + len / 2], [0, (hh(i, 4) - .5) * .03, 0], G, 'deck plank'); x += w; }
  part(box(lw + .3, .22, .22), wood, [(TX0 + TX1) / 2, YC - .11, .1], null, G, 'front beam');
  part(box(lw, .2, .2), woodDk, [(TX0 + TX1) / 2, YC - .1, TZ + .1], null, G, 'back beam');
  for (const px of [.25, 4.6, 9.1, 16.4]) { solids.push(part(box(.22, lh - .22, .22), wood, [px, YF + (lh - .22) / 2, .1], null, G, 'front post'));
    for (const s of [-1, 1]) { if ((px < 1 && s < 0) || (px > 16 && s > 0)) continue; part(box(.12, .75, .12), wood, [px + s * .3, YC - .22 - .26, .1], [0, 0, -s * Math.PI / 4], G, 'knee brace'); } }
  for (const px of [.55, 2.55, 5.0, 7.45, 9.9, 12.35, 14.8, 17.0]) solids.push(part(box(.2, lh - .2, .18), woodDk, [px, YF + (lh - .2) / 2, TZ + .09], null, G, 'back post'));
  // the track drifts toward the cut as it runs right (railZ), as in the reference
  railTrack(G, { x0: TX0 + .15, x1: RAIL_END, y: YF + .06, zAt: railZ, gauge: GAUGE });
  // lamps on the back posts, heights back-projected onto the lining (~1.9 m above the floor)
  for (const [lx, ly] of [[2.55, YF + 1.9], [7.45, YF + 1.85], [14.8, YF + 1.9]]) cageLamp(S, G, [lx, ly, TZ + .32], { floorY: YF });
  // the gallery's bounce: weak warm fill under the deck
  for (const fx of [1.8, 5.5, 9.5, 13.5, 16.2]) { const fl = new THREE.PointLight(0xffc890, .8, 5.5, 1.5); fl.position.set(fx, YC - .5, -.6); S.scene.add(fl); }
  floorLantern(S, G, [7.3, YF + .06, -2.45]);
  return solids;
}

shot({ trans: 'cut', t0: 0, build(S) {
  // the night: a navy backdrop, a cool moon from the front-left, a soft front fill, warm practicals inside
  S.scene.background = canvasTex(16, 512, (x, W, H) => { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#16263a'); g.addColorStop(.55, '#0f1c2c'); g.addColorStop(1, '#080e17'); x.fillStyle = g; x.fillRect(0, 0, W, H); });
  S.scene.fog = new THREE.FogExp2(0x101b2a, .006); S.scene.environmentIntensity = .25;
  S.scene.add(new THREE.HemisphereLight(0x5a78a8, 0x120e0a, .55));
  const front = new THREE.DirectionalLight(0x8a90a0, .55); front.position.set(-2, 4, 20); front.target.position.set(8, -6, 0); S.scene.add(front, front.target);
  const moon = new THREE.DirectionalLight(0xb8c8e6, 3.6); moon.position.set(-16, 18, 14); moon.target.position.set(8, 0, -6); moon.castShadow = true;
  moon.shadow.mapSize.set(4096, 4096); Object.assign(moon.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 }); moon.shadow.bias = -.0004; moon.shadow.normalBias = .03; S.scene.add(moon, moon.target);
  const rim = new THREE.DirectionalLight(0x8ca5d2, .9); rim.position.set(-22, 12, -20); rim.target.position.set(4, -4, -10); S.scene.add(rim, rim.target);
  const G = new THREE.Group(); G.name = 'dig cut-away'; S.scene.add(G);
  block(G); const galSolids = gallery(S, G);
  const C = mineCart(G, { x: CART_X, y: YF + .22, z: railZ(CART_X), ry: -Math.atan(RAIL_K), L: CART_L });
  airHose(G, [[TX0 + .2, -2.2, TZ + .5], [2.0, -2.3, TZ + .55], [3.6, -2.38, TZ + .6], [5.4, -2.4, TZ + .62], [6.6, -2.3, TZ + .55], [7.15, -2.0, TZ + .35], [7.3, -1.6, TZ + .25]]);
  cables(G, { x0: TX0 + .3, x1: TX1 - .3, ref: TX0, y: -2.35, z: TZ + .3 });
  prisonWall(S, G, { x0: WX0, x1: WX1, z: WZ, h: WH, t: WT, panel: PANEL });
  for (const fx of [2.65, 5.55, 8.65, 15.0]) part(box(.62, -YC - DECK, .9), T(CONC, .62, -YC, 1.6, { color: 0x9a9ea2 }), [fx, (YC + DECK) / 2, -.45 + .02], null, G, 'footing');
  // the tower: plumb on screen although the camera is rolled (lean -.09, pivoted on the edge that stays on the ground)
  guardTower(S, G, { pos: [5.3, 0, -29.7], ry: .25, scale: .9, lean: -.09 });
  for (const [at, s, n] of [[[16.6, YF + .06, -1.5], [.75, .5, 1.0], 'dig face pile'], [[13.8, YF + .06, -2.4], [.6, .25, .4]], [[10.6, YF + .06, -2.5], [.5, .18, .35]], [[1.0, YF + .06, -2.5], [.55, .2, .35]],
    [[5.8, YF + .06, -2.55], [.45, .14, .3]], [[11.2, YF + .06, -.5], [.4, .1, .3]], [[3.0, YF + .06, -.4], [.35, .08, .25]], [[14.2, YF + .06, -.45], [.5, .14, .35]], [[9.4, YF + .06, -2.6], [.4, .12, .28]]]) dirtPile(G, at, s, n);
  // tufts back-projected from the reference onto the top: a dense patch at the near corner, big clumps far back
  grassTufts(G, [[1.1, -1, .35, 3, 0.42], [1.47, -2.37, .35, 3, 0.55], [1.84, -3.74, .35, 3, 0.48], [2.21, -1.11, .35, 3, 0.61], [2.58, -2.48, .35, 3, 0.54], [2.95, -3.85, .35, 3, 0.47], [3.32, -1.22, .35, 3, 0.6], [1.39, -2.59, .35, 3, 0.53], [1.76, -3.96, .35, 3, 0.46], [2.13, -1.33, .35, 3, 0.59], [2.5, -2.7, .35, 3, 0.52], [2.87, -4.07, .35, 3, 0.45], [3.24, -1.44, .35, 3, 0.58], [1.31, -2.81, .35, 3, 0.51], [1.68, -4.18, .35, 3, 0.44], [2.05, -1.55, .35, 3, 0.57], [2.42, -2.92, .35, 3, 0.5], [2.79, -4.29, .35, 3, 0.43], [3.16, -1.66, .35, 3, 0.56], [1.23, -3.03, .35, 3, 0.49], [1.6, -4.4, .35, 3, 0.62], [1.97, -1.77, .35, 3, 0.55],
    [1.5, -24, 1.6, 4, 1.5], [3.6, -25, 1.6, 4, 1.6], [2.4, -31, 2, 4, 1.9], [4.4, -36, 2, 4, 2.1], [7.5, -26, 2, 4, 1.6], [9.5, -30, 2, 3, 1.8], [.9, -9, 1.0, 3, .65], [1.6, -14, 1.2, 3, .9], [21.5, -1.4, .9, 6, .5], [20.6, -1.3, .6, 4, .45]]);
  stones(G, 50, [.3, 9, -26, -1.0], { seed: 1, color: 0x6a6660 });
  stones(G, 90, [TX0 + .3, TX1 - .3, TZ + .3, -.15], { seed: 7, y: YF + .06, color: 0x5a4c40, size: .07 });   // rubble on the gallery floor
  // the men, glowing (night look). Pusher and diggers: Walk_Loop stances (both soles down) + hip hinge; the reader sits on an
  // upturned crate (sitOn measures his thighs onto its top) holding the map (pose.recon.cart-pusher / shovel-digger /
  // floor-map-reader). Every standing man is GROUNDED by measurement: his lowest drawn point put on the gallery floor.
  const FY = YF + .06, P = POSE;
  const man = (name, o) => MANNEQUIN ? glow(rebindMannequin(figure({ role: 'extra', body: 'm', name }, o), MODELS.man), 'night') : glowPerson(name, o, 'night');
  const pusher = man('pusher', { parent: G, x: P.push.x, y: FY, z: railZ(P.push.x), ry: Math.PI / 2 - Math.atan(RAIL_K) });
  const reader = man('reader', { parent: G, x: P.read.x, y: FY, z: P.read.z, ry: P.read.ry });
  const dig1 = man('digger 1', { parent: G, x: P.d1.x, y: FY, z: P.d1.z, ry: P.d1.ry });
  const dig2 = man('digger 2', { parent: G, x: P.d2.x, y: FY, z: P.d2.z, ry: P.d2.ry });
  for (const [f, o] of [[pusher, P.push], [reader, P.read], [dig1, P.d1], [dig2, P.d2]]) f.group.scale.setScalar(o.s);
  // the reader's crate, scaled with him, its front edge toward the track; he sits on that edge facing out
  const crate = prop('crate'); crate.name = 'reader crate'; crate.scale.set(P.read.s, P.read.s * .9, P.read.s); crate.rotation.y = P.read.ry;   // (.9 high: his soles reach the floor)
  crate.position.set(P.read.x, FY, P.read.z + .15); G.add(crate); G.updateWorldMatrix(true, true);
  sitOn(S, reader, crate, { side: 'front', act: P.read.clip, t: P.read.t });
  const sh1 = shovel(G), sh2 = shovel(G);
  const map = part(new THREE.PlaneGeometry(.62, .46), new THREE.MeshStandardMaterial({ map: MAPTEX, side: THREE.DoubleSide, color: 0x9a9280, roughness: 1 }), [0, 0, 0], null, G, 'map'); map.userData.noContact = true;
  // the lowest DRAWN point of a posed figure (world y): the clip's soles are not exactly at its root on this body
  const lowest = f => { let lo = Infinity; const v = V(); f.group.updateMatrixWorld(true);
    f.group.traverseVisible(m => { if (!m.isSkinnedMesh || !(m.layers.mask & 1)) return; const n = m.geometry.attributes.position.count;
      for (let i = 0; i < n; i += 2) { m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld); if (v.y < lo) lo = v.y; } }); return lo; };
  const lift = new Map(), ground = f => { if (!lift.has(f)) { f.group.position.y = FY; lift.set(f, FY - lowest(f)); } f.group.position.y = FY + lift.get(f); f.group.updateMatrixWorld(true); };
  S.tick(() => {
    pusher.act('Walk_Loop', { t: P.push.t }); dig1.act('Walk_Loop', { t: P.d1.t }); dig2.act('Walk_Loop', { t: P.d2.t }); reader.act(P.read.clip, { t: P.read.t });
    G.updateWorldMatrix(true, true);
    for (const [f, o] of [[pusher, P.push], [dig1, P.d1], [dig2, P.d2], [reader, P.read]]) { hinge(f, o.hinge ?? 0); lean(f, o.lean, o.head ?? .3); }
    for (const f of [pusher, dig1, dig2]) ground(f);
    // both palms pressed down on the rear rim (cart-local x -L/2, rim top 1.0725), fingers forward over the load: the tub's
    // cavity is below 1.05, so nothing of the hand or forearm dips into it (a palm AT the tub's top edge sank into it)
    C.g.updateWorldMatrix(true, false);
    const fwd = C.g.localToWorld(V(1, 0, 0)).sub(C.g.localToWorld(V())).normalize();
    for (const [sd, z] of [['R', .3], ['L', -.3]]) pusher.handTo(sd, C.g.localToWorld(V(-CART_L / 2 + .01, 1.0725 + .012, z)), { weight: 1, curl: .35, palmNormal: [0, -1, 0], fingerDir: fwd.toArray() });
    for (const [f, sh, o] of [[dig1, sh1, P.d1], [dig2, sh2, P.d2]]) { const h = plantShovel(sh, { ...o, floorY: FY }); f.handTo('R', h.lo, { weight: 1, curl: .8 }); f.handTo('L', h.hi, { weight: 1, curl: .8 }); }
    // the reader holds the map open over his lap, looking down at it
    const c = reader.scenePos('spine_03'), fw = reader.fwd(), mp = c.clone().addScaledVector(fw, .38).add(V(0, -.22, 0));
    map.position.copy(mp); map.lookAt(S.cam.position.clone().lerp(mp.clone().add(V(0, 3, 0)), .35)); map.updateMatrixWorld(true);
    const side = V(0, 1, 0).cross(fw).normalize();
    reader.handTo('L', mp.clone().addScaledVector(side, .26), { weight: 1, curl: .4 }); reader.handTo('R', mp.clone().addScaledVector(side, -.26), { weight: 1, curl: .4 });
  });
  for (const f of [pusher, reader, dig1, dig2]) glowLight(S, f, { i: 2.2, d: 2.8 });
  S.collide = { bodies: () => [bodyOf(pusher), bodyOf(reader), bodyOf(dig1), bodyOf(dig2)], solids: [...galSolids, ...C.solids, crate] };
  // ?marks=1: glowing spheres on solved landmarks, to prove the camera against the reference's pixels
  if (new URLSearchParams(location.search).get('marks')) for (const p of [[0, 0, 0], [LX, 0, 0], [0, YF, 0], [0, YC, 0], [WX0, WH, WZ], [WX0, 0, WZ], [4.6, YF, .03], [9.1, YF, .03], [16.4, YF, .03]]) hung(ns(part(new THREE.SphereGeometry(.12, 10, 8), glowM(0x00ff40), p, null, S.scene, 'mark')));
  S.recon = false;   // no corner badge: the reference has none
  S.post.bloom = .6; S.post.dof = null; S.subject = [8, -3, -1.5]; S.visibility = false;
  S.camera([{ t: 0, ...CAM }, { t: 5, ...CAM }]);
} });
