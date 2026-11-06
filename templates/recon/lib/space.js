// v8 Apollo 13 assets. Downloaded (src/assets/models/CREDITS.json): the Command Module is the Smithsonian's CC0 scan of
// Apollo 11 'Columbia' (same Block II shape as Apollo 13 'Odyssey'), the Lunar Module is NASA's model. Everything else
// here is procedural: Earth (Natural Earth land), Moon (NASA CGI Moon Kit colour + LRO relief), the Service Module with
// an openable bay 4, the LM cabin, the CO2 'mailbox' and the parachutes.
import { THREE, MAT, C, lerp, selectable } from '../engine.js';
import { box, mesh, hash } from '../models.js';
import { model, TEXTURES as TX, hitAlong } from './library.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const std = (c, r = .85, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...x });

// ---------- Earth and Moon ----------
export function earth(parent, r = 1) {
  const g = selectable(new THREE.Group(), 'earth', 'globe'); parent.add(g);
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 128, 64), std(0xffffff, .95, { map: TX.earth, bumpMap: TX.earthBump, bumpScale: 1.2 }));
  m.rotation.z = 23.4 * Math.PI / 180; m.castShadow = m.receiveShadow = true; g.add(m); g.userData.globe = m; return g;
}
export function moon(parent, r = .27) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 256, 128), std(0xffffff, .98, {
    map: TX.moon, displacementMap: TX.moonDisp, displacementScale: r * .035, displacementBias: -r * .035 * .45, bumpMap: TX.moonDisp, bumpScale: 2 }));
  m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}

// ---------- Service Module (built along +y; forward face at y = 0, under the CM heat shield) ----------
// Block II SM: 3.9 m diameter, body 4.7 m + SPS nozzle; six sectors, bay 4 (50 deg, centred on +z here) holds the two
// oxygen tanks over the three fuel cells. sm.panel is the bay-4 skin panel (blown off at 55:54:53).
export const SM = { R: 1.95, L: 4.7 };
export function serviceModule(parent) {
  const g = selectable(new THREE.Group(), 'service module', 'vehicle'); parent.add(g);
  const { R, L } = SM, skin = std(0xe9e8e3, .6), dark = std(0x55595f, .7), bay = std(0xcfcdc6, .9), w = 25 * Math.PI / 180;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 96, 1, true, w, 2 * Math.PI - 2 * w), skin); shell.position.y = -L / 2; g.add(shell);
  const panel = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L - .02, 24, 1, true, -w, 2 * w), skin); panel.position.y = -L / 2; g.add(panel);
  const fwd = new THREE.Mesh(new THREE.CircleGeometry(R, 96), skin); fwd.rotation.x = -Math.PI / 2; fwd.position.y = -.001; g.add(fwd);   // forward bulkhead (under the heat shield, never seen flat-on)
  const aft = new THREE.Mesh(new THREE.CylinderGeometry(R, R * .96, .25, 96), skin); aft.position.y = -L - .12; g.add(aft);
  for (const m of [shell, panel, fwd, aft]) { m.castShadow = m.receiveShadow = true; m.material.side = THREE.DoubleSide; }
  // EPS radiator panels: raised strips around the upper body (not over bay 4)
  for (let k = 0; k < 14; k++) { const a = w + .12 + k * (2 * Math.PI - 2 * w - .24) / 13; mesh(box(.5, 1.5, .05, .01), skin, [Math.sin(a) * (R + .03), -.95, Math.cos(a) * (R + .03)], [0, a, 0], g); }
  // RCS quads at 90 degrees (none on bay 4's centre line): housing + four nozzles
  for (const a of [Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4, -Math.PI / 4]) {
    const q = new THREE.Group(); q.position.set(Math.sin(a) * (R + .18), -1.2, Math.cos(a) * (R + .18)); q.rotation.y = a; g.add(q);
    mesh(box(.42, .62, .32, .05), skin, [0, 0, 0], [0, 0, 0], q);
    for (const [x, y, rx, rz] of [[0, .42, 0, 0], [0, -.42, Math.PI, 0], [.3, 0, 0, -Math.PI / 2], [-.3, 0, 0, Math.PI / 2]]) mesh(new THREE.CylinderGeometry(.03, .08, .2, 16), dark, [x, y, 0], [rx, 0, rz], q);
  }
  // SPS engine bell
  const bell = new THREE.LatheGeometry(Array.from({ length: 24 }, (_, i) => { const u = i / 23; return new THREE.Vector2(.42 + .83 * Math.pow(u, 1.6), -u * 2.8); }), 64);
  const nz = new THREE.Mesh(bell, std(0x8b8f95, .5, { side: THREE.DoubleSide })); nz.position.y = -L - .25; nz.castShadow = true; g.add(nz);
  // high-gain antenna: a boom folded out radially from the aft end (+x of its own frame = outward), four dishes on its end
  const hg = new THREE.Group(); hg.position.set(-R * .7071, -L + .3, -R * .7071); hg.rotation.y = 3 * Math.PI / 4; g.add(hg);
  mesh(new THREE.CylinderGeometry(.05, .05, 1.1, 12), skin, [.55, 0, 0], [0, 0, Math.PI / 2], hg);
  mesh(box(.12, .5, .5, .03), skin, [1.12, 0, 0], [0, 0, 0], hg);
  for (const [y, z] of [[-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]]) mesh(new THREE.SphereGeometry(.42, 24, 12, 0, Math.PI * 2, 0, .5), std(0xe9e8e3, .6, { side: THREE.DoubleSide }), [1.0, y, z], [0, 0, Math.PI / 2], hg);
  // bay 4 interior: radial walls, centre column face, two O2 tanks (0.66 m) over three fuel cells
  const inner = new THREE.Group(); g.add(inner);
  for (const s of [-1, 1]) { const wall = mesh(box(.04, L - .1, R - .55, .01), bay, [0, -L / 2, 0], [0, 0, 0], inner); wall.position.set(Math.sin(s * w) * (R + .55) / 2, -L / 2, Math.cos(s * w) * (R + .55) / 2); wall.rotation.y = s * w; }
  mesh(new THREE.CylinderGeometry(.55, .55, L - .1, 32, 1, true, -w * 1.4, 2 * w * 1.4), bay, [0, -L / 2, 0], [0, 0, 0], inner);
  const tanks = [];
  for (const [y, z] of [[-1.0, 1.25], [-1.75, 1.25]]) { const t = mesh(new THREE.SphereGeometry(.33, 32, 20), std(0xdedcd5, .5), [0, y, z], [0, 0, 0], inner); tanks.push(t); }
  for (let k = 0; k < 3; k++) mesh(new THREE.CylinderGeometry(.22, .22, 1.1, 24), std(0xc9c7c0, .8), [(k - 1) * .42, -3.3, 1.2], [0, 0, 0], inner);
  return { group: g, panel, tanks, bayDir: V3(0, 0, 1) };
}

// ---------- the docked stack (along +y: SM, CM apex up, LM upside down on the CM's docking port) ----------
export function stack(parent, o = {}) {
  const g = selectable(new THREE.Group(), 'Apollo stack', 'vehicle'); parent.add(g);
  const sm = serviceModule(g);
  const cm = model('cm', { width: 3.9, upright: true, look: 'tone', tint: 0xefeee9, dark: 0x8d9198 }); g.add(cm); cm.position.y = .02;
  // CM docking probe tip and LM drogue are found by casting along the axis: the bounding boxes include antennas off-axis
  const cmTop = 20 - hitAlong(cm, V3(0, 20, 0), V3(0, -1, 0));
  const lm = model('lm', { height: 7.04, look: 'tone', tint: 0xe6e4dd, dark: 0x6d7177 });
  const lmTop = 20 - hitAlong(lm, V3(0, 20, 0), V3(0, -1, 0));                              // LM upright: its top hatch/drogue
  const lmG = new THREE.Group(); lmG.add(lm); lm.rotation.x = Math.PI; lmG.position.y = cmTop + lmTop + .02; g.add(lmG);
  return { group: g, sm, cm, lm: lmG, cmTop };
}

// ---------- LM ascent-stage cabin (interior), metres; floor y = 0, front windows at z = -0.9 ----------
// o.cutaway: leave out the aft wall and the +x side wall (and its console) so a camera outside can see the whole cabin
export function lmCabin(parent, o = {}) {
  const g = selectable(new THREE.Group(), 'lunar module cabin', 'interior'); parent.add(g);
  const wall = std(0xd9d7d0, .9), panel = std(0x9ea3a8, .8), sw = std(0x3b3f45, .6), W = 2.4, D = 1.8, H = 2.15;
  mesh(box(W, .06, D, .01), wall, [0, -.03, 0], [0, 0, 0], g).name = 'floor';
  // ceiling: a slab with a real round hole under the docking tunnel (a body coming down from the CM must not pass through it)
  const cs = new THREE.Shape([[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]].map(([a, b]) => new THREE.Vector2(a, b)));
  cs.holes.push(new THREE.Path().absarc(0, .25, .42, 0, Math.PI * 2, true));
  const cg = new THREE.ExtrudeGeometry(cs, { depth: .06, bevelEnabled: false, curveSegments: 48 }); cg.rotateX(Math.PI / 2);   // shape y -> world z
  mesh(cg, wall, [0, H + .06, 0], [0, 0, 0], g).name = 'ceiling';
  // front wall with the two triangular windows (real holes) and a dark sky behind them
  const fw = new THREE.Shape([[-W / 2, 0], [W / 2, 0], [W / 2, H], [-W / 2, H]].map(([a, b]) => new THREE.Vector2(a, b)));
  for (const s of [-1, 1]) fw.holes.push(new THREE.Path([[s * .25, 1.35], [s * .95, 1.35], [s * .25, 1.9]].map(([a, b]) => new THREE.Vector2(a, b))));
  const fg = new THREE.ExtrudeGeometry(fw, { depth: .06, bevelEnabled: false }); mesh(fg, wall, [0, 0, -D / 2 - .06], [0, 0, 0], g).name = 'front wall';
  mesh(new THREE.PlaneGeometry(2.1, .75), new THREE.MeshBasicMaterial({ color: 0x14171b }), [0, 1.62, -D / 2 - .12], [0, 0, 0], g);   // night sky, only behind the windows
  for (const s of o.cutaway ? [-1] : [-1, 1]) { const m = mesh(box(.04, .9, 1.9, .01), wall, [s * W / 2, H / 2, 0], [0, 0, 0], g); m.scale.set(1, H / .9, D / 1.9); m.name = 'side wall'; }   // side walls
  if (!o.cutaway) mesh(box(W, H, .06, .01), wall, [0, H / 2, D / 2 + .03], [0, 0, 0], g);                          // aft wall
  // consoles: angled main panel under the windows, side panels; switches as instanced boxes on each panel face
  const consoles = [[0, .95, -D / 2 + .22, -.45, 1.5, .8], [-W / 2 + .2, 1.2, -.2, 0, .9, .7], [W / 2 - .2, 1.2, -.2, 0, .9, .7]].slice(0, o.cutaway ? 2 : 3);
  const swGeo = new THREE.BoxGeometry(.022, .022, .016), swM = new THREE.InstancedMesh(swGeo, sw, 900); let n = 0; const M4 = new THREE.Matrix4();
  consoles.forEach(([x, y, z, tilt, w2, h2], i) => {
    const p = new THREE.Group(); p.position.set(x, y, z); if (i === 0) p.rotation.x = tilt; else p.rotation.y = i === 1 ? Math.PI / 2 : -Math.PI / 2; g.add(p);
    mesh(box(w2, h2, .12, .02), panel, [0, 0, 0], [0, 0, 0], p).name = i ? 'side console' : 'main console';
    p.updateMatrixWorld(true);
    for (let a = 0; a < 18; a++) for (let b = 0; b < 9; b++) { if (n >= 900 || hash(a * 9 + b, i) < .35) continue; const P = V3((a / 17 - .5) * w2 * .88, (b / 8 - .5) * h2 * .8, .075);
      p.localToWorld(P); g.worldToLocal(P); M4.compose(P, p.quaternion, V3(1, 1, 1)); swM.setMatrixAt(n++, M4); }
  });
  swM.count = n; g.add(swM);
  // overhead docking tunnel ring and hatch
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.42, .05, 12, 48), panel); ring.rotation.x = Math.PI / 2; ring.position.set(0, H - .05, .25); g.add(ring);
  mesh(new THREE.CylinderGeometry(.4, .4, .3, 48, 1, true), std(0x8f949a, .8, { side: THREE.DoubleSide }), [0, H + .15, .25], [0, 0, 0], g);
  // stowage on the aft wall, handholds
  if (!o.cutaway) for (let k = 0; k < 4; k++) mesh(box(.45, .35, .25, .03), panel, [-.75 + k * .5, 1.55, D / 2 - .14], [0, 0, 0], g);
  for (const s of [-1, 1]) mesh(new THREE.TorusGeometry(.08, .012, 8, 20, Math.PI), sw, [s * .7, 1.95, -D / 2 + .08], [0, 0, 0], g);
  if (o.cutaway) for (const y of [-.03, H + .03]) mesh(box(W + .08, .1, .06, .02), panel, [0, y, D / 2 + .02], [0, 0, 0], g);   // cut-edge trims
  g.traverse(m => { if (m.isMesh) m.receiveShadow = m.castShadow = true; });
  // the main console's front face as a frame: point(x, v) is on the face (v = distance up the panel from its centre), n its normal, up the panel direction
  const tilt = consoles[0][3], up = V3(0, Math.cos(tilt), Math.sin(tilt)), fn = V3(0, -Math.sin(tilt), Math.cos(tilt)), c0 = V3(0, consoles[0][1], consoles[0][2]);
  return { group: g, W, D, H, hole: V3(0, H, .25), console: { n: fn, up, point: (x, v, off = .06) => c0.clone().add(V3(x, 0, 0)).addScaledVector(up, v).addScaledVector(fn, off) } };
}

// ---------- the CO2 'mailbox' (LiOH canister adapter), parts in their own groups so the scene can assemble them ----------
// As built on 14 April 1970 (NASA photo AS13-62-8929): the square CM canister (~0.3 m), a plastic bag pulled over its
// base and taped round it, cardboard (logbook covers) bracing the bag, a suit hose from the bag to the LM's round inlet.
// Canister centre at the origin, hose runs to +x.
export function mailbox(parent) {
  const g = selectable(new THREE.Group(), 'mailbox', 'prop'); parent.add(g); const P = {};
  const clay = std(0xe7e5df, .85), card = std(0xcdb796, .95), bag = std(0xf4f4f1, .5), tape = std(0x8f949a, .55), dark = std(0x41464c, .6);
  P.can = new THREE.Group(); g.add(P.can); mesh(box(.3, .3, .3, .02), clay, [0, 0, 0], [0, 0, 0], P.can);
  for (let k = -3; k <= 3; k++) { mesh(box(.26, .008, .012, .002), dark, [0, .153, k * .036], [0, 0, 0], P.can); }
  // bag: a wrinkled bowl over the lower half of the canister, narrowing to the hose neck under it
  P.bag = new THREE.Group(); g.add(P.bag);
  const prof = [[.05, -.36], [.12, -.34], [.22, -.28], [.27, -.18], [.27, -.06], [.235, .02]].map(([r, y]) => new THREE.Vector2(r, y));
  const bg = new THREE.LatheGeometry(prof, 48), bp = bg.attributes.position;
  for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i), a = Math.atan2(z, x), n = 1 + .035 * Math.sin(a * 9 + y * 30) * Math.sin(y * 22);
    bp.setXYZ(i, x * n, y, z * n); }
  bg.computeVertexNormals(); const bm = mesh(bg, bag, [0, 0, 0], [0, 0, 0], P.bag); bm.material.side = THREE.DoubleSide;
  // cardboard braces on two sides, standing just off the canister faces
  P.card = new THREE.Group(); g.add(P.card);
  for (const s2 of [-1, 1]) mesh(box(.012, .26, .3, .003), card, [s2 * .162, -.07, 0], [0, 0, s2 * .12], P.card);
  // two bands of grey tape: round the bag mouth (on the canister) and round the bag's belly
  P.tape = new THREE.Group(); g.add(P.tape);
  for (const [r, y] of [[.24, .02], [.275, -.12]]) { const t = mesh(new THREE.TorusGeometry(r, .012, 8, 64), tape, [0, y, 0], [Math.PI / 2, 0, 0], P.tape); t.scale.set(1, 1, 2.2); }
  // hose from the neck to the LM inlet
  P.hose = new THREE.Group(); g.add(P.hose);
  const curve = new THREE.CatmullRomCurve3([V3(0, -.36, 0), V3(.02, -.5, 0), V3(.22, -.6, .04), V3(.48, -.55, .05)]);
  mesh(new THREE.TubeGeometry(curve, 64, .035, 16), std(0x6f747a, .7), [0, 0, 0], [0, 0, 0], P.hose);
  for (let k = 1; k < 12; k++) { const u = k / 12, p = curve.getPoint(u), tn = curve.getTangent(u); const r = new THREE.Mesh(new THREE.TorusGeometry(.037, .006, 6, 20), dark);
    r.position.copy(p); r.quaternion.setFromUnitVectors(V3(0, 0, 1), tn); P.hose.add(r); }       // hose ribs
  P.socket = new THREE.Group(); g.add(P.socket); P.socket.position.set(.6, -.55, .05);
  mesh(new THREE.CylinderGeometry(.12, .12, .2, 40), clay, [0, 0, 0], [0, 0, Math.PI / 2], P.socket);
  mesh(new THREE.TorusGeometry(.12, .014, 10, 40), dark, [-.1, 0, 0], [0, Math.PI / 2, 0], P.socket);
  mesh(new THREE.CylinderGeometry(.04, .04, .04, 20), dark, [-.12, 0, 0], [0, 0, Math.PI / 2], P.socket);
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true; });
  return { group: g, parts: P };
}

// ---------- Apollo main parachute (25.4 m canopy), white/clay gores; apex at local y = 0, risers to the confluence below ----------
export function parachute(parent, o = {}) {
  const g = selectable(new THREE.Group(), 'parachute', 'prop'); parent.add(g); const R = o.r ?? 12.7, NG = 24;
  const a = std(0xf3f2ee, .8, { side: THREE.DoubleSide }), b = std(0xd9b49a, .85, { side: THREE.DoubleSide });   // muted orange stripes (the real canopies were orange/white)
  for (let i = 0; i < NG; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(R, 6, 12, i / NG * Math.PI * 2, Math.PI * 2 / NG, 0, Math.PI * .42), i % 2 ? b : a);
    m.scale.set(1, .78, 1); m.position.y = -R * .78; m.castShadow = true; g.add(m); }
  const rimY = -R * .78 + R * .78 * Math.cos(Math.PI * .42), rimR = R * Math.sin(Math.PI * .42), conf = V3(0, rimY - (o.lines ?? 22), 0), pts = [];
  for (let i = 0; i < NG; i++) { const t = i / NG * Math.PI * 2; pts.push(V3(Math.sin(t) * rimR, rimY, Math.cos(t) * rimR), conf); }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x6d7177 })));
  g.userData.confluence = conf; return g;
}
