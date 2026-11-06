// Models for the v8 stories: Tacoma Narrows Bridge (deforming suspension bridge, 1930s car, crawl gait).
// Same rules as models.js: real dimensions, one surface per surface, everything QA'd alone in scenes/assets2.js.
import { THREE, MAT, C, clamp, lerp, E, selectable } from '../engine.js';
import { box, mesh, inst, POSE, mix, add, hash } from '../models.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.r ?? .85, metalness: 0, ...o.x });
const sph = new THREE.SphereGeometry(1, 28, 18);

// =====================================================================================================================
// TACOMA NARROWS BRIDGE (1940). Bridge frame: x along the span (+x = east, Tacoma), y up (water = 0), z across.
// Main span 853 m (2,800 ft), side spans 335 m, towers 130 m (425 ft) above water at x = +-426.5, deck 11.9 m (39 ft)
// wide on two 2.44 m (8 ft) solid plate girders, roadway ~59 m (195 ft) above the water at mid-span, cable sag ~71 m.
// bridge.set(t-independent state): { v: vertical amplitude (m), n: vertical half-waves, th: twist amplitude (rad),
//   ph: oscillation phase (rad), gone: [x0, x1] deck stretch that has fallen away (handled by the scene) }
// bridge.frame(x) -> Matrix4 of the deck section at x (for things riding on the deck: car, people).
// =====================================================================================================================
export const TNB = { L: 853, side: 335, tower: 130, deckY: 59, W: 11.9, gird: 2.44, sag: 71 };
// deck cross-section (y, z) around the roadway centre: slab + two solid plate girders with flanges (the H the wind got hold of)
const HW = TNB.W / 2;
export const TNB_PROF = [[0, -HW], [0, HW], [.24, HW + .05], [.24, HW + .45], [-2.2, HW + .45], [-2.2, HW + .05], [-.3, HW], [-.3, -HW], [-2.2, -HW - .05], [-2.2, -HW - .45], [.24, -HW - .45], [.24, -HW - .05]];
// a short straight piece of the deck as one closed solid (diagrams, wind-tunnel models): length along x, centred
export function deckSection(parent, len, mat) {
  const sh = new THREE.Shape(TNB_PROF.map(([y, z]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2); g.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(g, mat ?? new THREE.MeshStandardMaterial({ color: 0xebeae5, roughness: .75, flatShading: true })); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
export function tacomaBridge(parent, o = {}) {
  const g = selectable(new THREE.Group(), 'Tacoma Narrows bridge', 'building'); parent.add(g);
  const { L, side, tower, deckY, W, gird } = TNB, hw = W / 2, X0 = -L / 2 - side, X1 = L / 2 + side, step = 2.5, LZ = hw + 1.6;   // tower legs straddle the deck
  const steel = std(0xe9e8e3, { r: .7 }), concrete = std(0xd9d7d0, { r: .95 }), road = std(0xc4c3bd, { r: .95 });
  const st = { v: 0, n: 9, th: 0, ph: 0, ph2: 0, gone: null, fall: 0 };
  // ---- deck: a cross-section profile swept along x; vertices recomputed every frame from the deformation ----
  // profile (y, z) around the section centre (roadway top at y = 0): roadway slab, two plate girders with top flanges
  const prof = TNB_PROF;
  const capTris = THREE.ShapeUtils.triangulateShape(prof.map(([py, pz]) => new THREE.Vector2(py, pz)), []).map(([a, b, c]) => {
    const [ay, az] = prof[a], [by, bz] = prof[b], [cy, cz] = prof[c];
    return (by - ay) * (cz - az) - (bz - az) * (cy - ay) > 0 ? [a, b, c] : [a, c, b]; });       // normal +x
  const capInto = (idx, base, dir) => { for (const [a, b, c] of capTris) dir > 0 ? idx.push(base + a, base + b, base + c) : idx.push(base + a, base + c, base + b); };
  const stations = []; for (let x = X0; x <= X1 + 1e-6; x += step) stations.push(x);
  const NS = stations.length, NP = prof.length;
  const pos = new Float32Array(NS * NP * 3);
  // the deck index is rebuilt whenever the fallen stretch changes: station pairs inside it are left out and each broken
  // end is closed with a cap (collapsing the vertices instead stretched long triangles down to the collapse point)
  const buildIndex = gone => { const idx = [], inG = i => gone && stations[i] > gone[0] && stations[i] < gone[1];
    for (let i = 0; i < NS - 1; i++) { if (inG(i) || inG(i + 1)) continue;
      for (let k = 0; k < NP; k++) { const a = i * NP + k, b = i * NP + (k + 1) % NP, c = a + NP, d = b + NP; idx.push(a, c, b, b, c, d); } }
    if (gone) for (let i = 0; i < NS - 1; i++) { if (!inG(i) && inG(i + 1)) capInto(idx, i * NP, +1); if (inG(i) && !inG(i + 1)) capInto(idx, (i + 1) * NP, -1); }
    return idx; };
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); dg.setIndex(buildIndex(null)); let gapKey = '';
  // flat shading: the girder corners stay crisp (smoothed normals made the deck read as a tube)
  const deckMat = std(0xebeae5, { r: .75, x: { flatShading: true } });
  const deck = new THREE.Mesh(dg, deckMat); deck.castShadow = deck.receiveShadow = true; deck.frustumCulled = false; g.add(deck);
  // roadway surface strip (its own surface 3 cm above the slab top would z-fight: instead the slab top IS the road, coloured by a
  // second material group on the first profile edge)
  // ---- towers: two tapering legs, cross struts, X bracing between the struts; pier caisson in the water ----
  const towerAt = x => { const t = new THREE.Group(); t.position.x = x; g.add(t);
    mesh(box(30, 8, 22, .6), concrete, [0, 2, 0], [0, 0, 0], t);                                       // pier caisson (2 m above water)
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.3, tower - 6, 4, 1), std(0xe9e8e3, { r: .7, x: { flatShading: true } })); leg.rotation.y = Math.PI / 4; leg.position.set(0, 6 + (tower - 6) / 2, s * LZ); leg.castShadow = leg.receiveShadow = true; t.add(leg); }
    for (const y of [tower - 2, deckY - 4, 100, 30]) mesh(box(2.6, 3, 2 * LZ, .4), steel, [0, y, 0], [0, 0, 0], t);
    for (const [ya, yb] of [[deckY + 6, 100], [100, tower - 4], [10, deckY - 6]]) {             // X bracing in each bay
      const h = yb - ya, d = 2 * LZ, len = Math.hypot(h, d), a = Math.atan2(h, d);
      for (const sg of [-1, 1]) mesh(box(1, len, 1, .2), steel, [0, (ya + yb) / 2, 0], [sg * (Math.PI / 2 - a), 0, 0], t);
    }
    mesh(box(4, 2.4, 2 * LZ + 3, .6), steel, [0, tower + 1, 0], [0, 0, 0], t);                           // cable saddles
    return t; };
  towerAt(-L / 2); towerAt(L / 2);
  // ---- anchorages on the banks, approach piers under the side spans ----
  for (const sx of [-1, 1]) { mesh(box(30, 26, 26, 1), concrete, [sx * (X1 + 6), deckY - 13 + 3, 0], [0, 0, 0], g);
    for (const f of [.33, .66]) { const x = sx * (L / 2 + side * f); mesh(box(4, deckY - 2.2, W + 2, .3), concrete, [x, (deckY - 2.2) / 2, 0], [0, 0, 0], g); } }
  // ---- cables (instanced segments) and suspenders (instanced rods), updated every frame ----
  const cableY = x => { const ax = Math.abs(x);
    if (ax <= L / 2) return deckY + 2 + (tower - deckY - 2) * Math.pow(ax / (L / 2), 2);                 // parabola, low point 2 m above the road
    const k = (ax - L / 2) / side; return lerp(tower, deckY + 1, k) - 8 * Math.sin(k * Math.PI); };     // side span: sagging toward the anchorage
  const NC = 260, cab = new THREE.InstancedMesh(new THREE.CylinderGeometry(.42, .42, 1, 8), steel, NC * 2); cab.castShadow = true; g.add(cab);
  const susX = []; for (let x = X0 + 15; x < X1 - 10; x += 15.24) if (Math.abs(Math.abs(x) - L / 2) > 6) susX.push(x);
  const sus = new THREE.InstancedMesh(new THREE.CylinderGeometry(.06, .06, 1, 5), steel, susX.length * 2); g.add(sus);
  // ---- railings (post every 3 m + top rail segments) and lamp posts every 46 m, both edges, riding the deck ----
  const railX = []; for (let x = X0 + 1; x < X1 - 1; x += 3) railX.push(x);
  const posts = new THREE.InstancedMesh(box(.08, .9, .08, .02), steel, railX.length * 2), rails = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .07, .07), steel, railX.length * 2);
  const lampX = []; for (let x = X0 + 20; x < X1 - 10; x += 46) lampX.push(x);
  const lampG = new THREE.CylinderGeometry(.07, .1, 6.5, 8); lampG.translate(0, 3.25, 0);
  const lamps = new THREE.InstancedMesh(lampG, steel, lampX.length * 2), heads = new THREE.InstancedMesh(box(.9, .22, .35, .08), steel, lampX.length * 2);
  for (const m of [posts, rails, lamps, heads]) { m.castShadow = true; m.frustumCulled = false; g.add(m); }
  // ---- deformation ----
  const defo = x => {                                     // vertical offset and twist of the deck at x (bridge frame)
    const ax = Math.abs(x); if (ax > L / 2) { const k = (ax - L / 2) / side; return { v: st.v * .15 * Math.sin(k * Math.PI) * Math.sin(st.ph2), th: 0 }; }
    const u = (x + L / 2) / L;
    return { v: st.v * Math.sin(st.n * Math.PI * u) * Math.sin(st.ph2), th: st.th * Math.sin(2 * Math.PI * u) * Math.sin(st.ph) };
  };
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Sx = V3(), up = V3(0, 1, 0);
  const segM = (a, b, r) => { const d = b.clone().sub(a), l = d.length(); Q.setFromUnitVectors(up, d.normalize()); M4.compose(a.clone().add(b).multiplyScalar(.5), Q, V3(r, l, r)); return M4; };
  const api = {
    group: g, deck, st,
    set(o2) { Object.assign(st, o2); return api; },
    defo,
    // world-independent frame of the deck at x (bridge space): road surface centre, rotated by the twist
    frame(x, out = new THREE.Matrix4()) { const d = defo(x); return out.compose(V3(x, deckY + d.v, 0), new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), d.th), V3(1, 1, 1)); },
    inGap: x => st.gone && x > st.gone[0] && x < st.gone[1],
    update() {
      // deck vertices (stations inside the fallen stretch are collapsed to zero size: the scene draws the falling pieces)
      const gk = String(st.gone); if (gk !== gapKey) { gapKey = gk; dg.setIndex(buildIndex(st.gone)); }
      for (let i = 0; i < NS; i++) { const x = stations[i], d = defo(x), c = Math.cos(d.th), s = Math.sin(d.th);
        for (let k = 0; k < NP; k++) { const [py, pz] = prof[k], o3 = (i * NP + k) * 3;
          pos[o3] = x; pos[o3 + 1] = deckY + d.v + py * c - pz * s; pos[o3 + 2] = py * s + pz * c; } }
      dg.attributes.position.needsUpdate = true; dg.computeVertexNormals(); dg.computeBoundingSphere();
      // cables follow the deck edge they carry (vertical offset only)
      for (const [j, zs] of [[0, -hw - .2], [1, hw + .2]]) for (let i = 0; i < NC; i++) {
        const xa = X0 + (X1 - X0) * i / NC, xb = X0 + (X1 - X0) * (i + 1) / NC;
        const off = x => { if (Math.abs(x) > L / 2) return 0; const d = defo(x), w = 1 - Math.pow(Math.abs(x) / (L / 2), 2); return (d.v + zs * Math.sin(d.th)) * w * .9; };
        cab.setMatrixAt(j * NC + i, segM(V3(xa, cableY(xa) + off(xa), zs), V3(xb, cableY(xb) + off(xb), zs), .42));
      }
      cab.instanceMatrix.needsUpdate = true;
      susX.forEach((x, i) => { for (const [j, zs] of [[0, -hw - .2], [1, hw + .2]]) {
        const d = defo(x), w = Math.abs(x) <= L / 2 ? 1 - Math.pow(Math.abs(x) / (L / 2), 2) : 0, cy = cableY(x) + (Math.abs(x) <= L / 2 ? (d.v + zs * Math.sin(d.th)) * w * .9 : 0);
        const ey = deckY + d.v + .24 * Math.cos(d.th) - zs * Math.sin(d.th), ez = .24 * Math.sin(d.th) + zs * Math.cos(d.th);
        const bot = api.inGap(x) ? V3(x, cy - 18 - hash(i, j) * 10, zs) : V3(x, ey, ez);              // snapped: a broken rod hangs from the cable
        sus.setMatrixAt(j * susX.length + i, segM(V3(x, cy, zs), bot, .06)); } });
      sus.instanceMatrix.needsUpdate = true;
      // railings and lamp posts in the deck section's own frame (rotated with the twist), hidden over the fallen stretch
      const F = new THREE.Matrix4(), L4 = new THREE.Matrix4(), Z = new THREE.Matrix4().makeScale(0, 0, 0);
      railX.forEach((x, i) => { api.frame(x, F); for (const [j, zs] of [[0, -hw + .25], [1, hw - .25]]) {
        if (api.inGap(x)) { posts.setMatrixAt(j * railX.length + i, Z); rails.setMatrixAt(j * railX.length + i, Z); continue; }
        posts.setMatrixAt(j * railX.length + i, L4.copy(F).multiply(new THREE.Matrix4().makeTranslation(0, .45, zs)));
        rails.setMatrixAt(j * railX.length + i, L4.copy(F).multiply(new THREE.Matrix4().compose(V3(1.5, .9, zs), new THREE.Quaternion(), V3(3, 1, 1)))); } });
      lampX.forEach((x, i) => { api.frame(x, F); for (const [j, zs] of [[0, -hw + .25], [1, hw - .25]]) {
        if (api.inGap(x)) { lamps.setMatrixAt(j * lampX.length + i, Z); heads.setMatrixAt(j * lampX.length + i, Z); continue; }
        lamps.setMatrixAt(j * lampX.length + i, L4.copy(F).multiply(new THREE.Matrix4().makeTranslation(0, 0, zs)));
        heads.setMatrixAt(j * lampX.length + i, L4.copy(F).multiply(new THREE.Matrix4().makeTranslation(0, 6.5, zs - Math.sign(zs) * .4))); } });
      for (const m of [posts, rails, lamps, heads]) m.instanceMatrix.needsUpdate = true;
    },
  };
  api.update();
  // a falling deck piece (bridge frame) between x0 and x1, same cross-section, as its own rigid mesh
  api.piece = (x0, x1) => { const n = Math.max(2, Math.round((x1 - x0) / step) + 1), p2 = new Float32Array(n * NP * 3), id2 = [];
    for (let i = 0; i < n; i++) for (let k = 0; k < NP; k++) { const o3 = (i * NP + k) * 3; p2[o3] = lerp(x0, x1, i / (n - 1)) - (x0 + x1) / 2; p2[o3 + 1] = prof[k][0]; p2[o3 + 2] = prof[k][1]; }
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < NP; k++) { const a = i * NP + k, b = i * NP + (k + 1) % NP; id2.push(a, a + NP, b, b, a + NP, b + NP); }
    capInto(id2, 0, -1); capInto(id2, (n - 1) * NP, +1);                                                  // closed ends
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(p2, 3)); pg.setIndex(id2); pg.computeVertexNormals();
    const m = new THREE.Mesh(pg, steel); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  return api;
}

// ---------- a mid-1930s sedan (clay), ~5 m long, nose +z ----------
// Period shape: long narrow hood with a vertical grille, a separate rounded cabin set back over the rear axle, arched
// fenders standing proud of the body over each wheel, running boards between them, separate headlamps on the fenders.
export function car1936(parent, o = {}) {
  const g = selectable(new THREE.Group(), '1936 car', 'vehicle'); parent.add(g);
  const body = o.mat ?? std(0xe7e5df, { r: .55 }), dark = std(0x2a2e33, { r: .5 }), chrome = std(0xa7adb3, { r: .3 }), fenderM = body.clone(); fenderM.side = THREE.DoubleSide;
  mesh(box(1.12, .62, 1.9, .16), body, [0, .92, 1.25], [0, 0, 0], g);                                                 // hood
  const cab = new THREE.Shape(new THREE.SplineCurve([[-2.15, .62], [.32, .62], [.28, 1.2], [-.1, 1.62], [-1.3, 1.66], [-1.95, 1.38], [-2.3, .95], [-2.15, .62]].map(([a, b]) => new THREE.Vector2(a, b))).getPoints(48));
  const cg = new THREE.ExtrudeGeometry(cab, { depth: 1.46, bevelEnabled: true, bevelSize: .1, bevelThickness: .1, bevelSegments: 4 }); cg.translate(0, 0, -.73); cg.rotateY(-Math.PI / 2);
  mesh(cg, body, [0, 0, 0], [0, 0, 0], g);                                                                             // cabin + tail
  mesh(box(1.32, .4, .04, .06), dark, [0, 1.37, .2], [-.38, 0, 0], g);                                                // windscreen
  for (const s2 of [-1, 1]) { mesh(box(.04, .36, .62, .06), dark, [s2 * .845, 1.33, -.25], [0, 0, 0], g); mesh(box(.04, .32, .5, .06), dark, [s2 * .83, 1.3, -1.02], [0, 0, 0], g); }
  mesh(box(.9, .3, .04, .06), dark, [0, 1.25, -2.2], [.6, 0, 0], g);                                                  // rear window
  const fg = new THREE.CylinderGeometry(.5, .5, .34, 28, 1, true, 0, Math.PI); fg.rotateZ(Math.PI / 2);     // open half-shell over the TOP of the wheel (theta 0..pi = y > 0 after the turn)
  for (const [x, z] of [[-.78, 1.5], [.78, 1.5], [-.78, -1.5], [.78, -1.5]]) {
    mesh(fg, fenderM, [x, .45, z], [0, 0, 0], g);                                                                      // arched fender
    mesh(new THREE.CylinderGeometry(.36, .36, .24, 26), dark, [x, .36, z], [0, 0, Math.PI / 2], g);                    // tyre
    mesh(new THREE.CylinderGeometry(.2, .2, .26, 20), chrome, [x, .36, z], [0, 0, Math.PI / 2], g);                    // hub
  }
  for (const s2 of [-1, 1]) mesh(box(.3, .06, 2.0, .02), body, [s2 * .78, .32, 0], [0, 0, 0], g);                      // running boards
  const gr = mesh(box(.32, .62, .32, .03), chrome, [0, .93, 2.1], [0, Math.PI / 4, 0], g); gr.scale.set(1, 1, .55);        // pointed 'waterfall' grille
  for (let k = -3; k <= 3; k++) mesh(box(.018, .52, .02, .005), dark, [k * .042, .93, 2.24 - Math.abs(k) * .042], [0, 0, 0], g);
  for (const s2 of [-1, 1]) mesh(sph, chrome, [s2 * .62, 1.0, 2.05], [0, 0, 0], g).scale.set(.14, .14, .12);          // headlamps
  mesh(box(1.6, .1, .1, .04), chrome, [0, .38, 2.4], [0, 0, 0], g); mesh(box(1.6, .1, .1, .04), chrome, [0, .38, -2.42], [0, 0, 0], g);
  mesh(new THREE.CylinderGeometry(.34, .34, .18, 24), dark, [0, .85, -2.42], [Math.PI / 2, 0, 0], g);                  // spare wheel
  return g;
}

// ---------- crawling on hands and knees (Coatsworth) ----------
// crawlAt(person, from, dir, dist, o): torso level, hips over the knees, hands planted on the floor ahead of the shoulders.
// Diagonal gait: left hand moves with the right knee. Hands are placed by IK (handTo) on WORLD footholds spaced one stride
// apart, so they stay planted while the body moves over them. o.floorY (world) and o.parentMatrix for a moving floor.
export const CRAWL = { stride: .42 };
export function crawlPose(ph) {
  const a = ph * Math.PI * 2, s = Math.sin(a), d = Math.PI / 180;
  return { dy: -.43 + .012 * Math.abs(Math.cos(a)), spine: [74 * d, s * 4 * d, 0], chest: [8 * d, -s * 5 * d, 0], neck: [-48 * d, 0, 0], head: [-22 * d, 0, 0],
    hipL: [(-4 + s * 14) * d, 0, 4 * d], hipR: [(-4 - s * 14) * d, 0, -4 * d], knL: [92 * d, 0, 0], knR: [92 * d, 0, 0], anL: [70 * d, 0, 0], anR: [70 * d, 0, 0],
    shL: [-80 * d, 0, 8 * d], shR: [-80 * d, 0, -8 * d], elL: [-8 * d, 0, 0], elR: [-8 * d, 0, 0] };
}
export function crawlAt(person, from, dir, dist, o = {}) {
  const D = dir.clone().setY(0).normalize(), P = from.clone().addScaledVector(D, dist), ph = dist / CRAWL.stride;
  person.place(P.x, P.y, P.z, Math.atan2(D.x, D.z)); person.apply(crawlPose(ph));
  const side = V3(D.z, 0, -D.x), floor = o.floorY ?? from.y;
  for (const [sd, off] of [['L', 0], ['R', .5]]) {
    // this hand's foothold: plants at whole strides (offset per hand); during the swing (last 35% of its cycle) it lifts and moves ahead
    const c = ph + off, k = Math.floor(c), f = c - k, sw = f > .65 ? (f - .65) / .35 : 0;
    const plant = (kk) => from.clone().addScaledVector(D, (kk + 1 - off) * CRAWL.stride + .34).addScaledVector(side, (sd === 'L' ? -1 : 1) * .17);
    const A = plant(k), B = plant(k + 1), H = A.clone().lerp(B, E.inOutSine(sw)); H.y = floor + .03 + Math.sin(sw * Math.PI) * .06;
    person.handTo(sd, H, V3(0, -1, 0), D, .25, P.clone().addScaledVector(side, (sd === 'L' ? -1 : 1) * .6).add(V3(0, .6, 0)));
  }
  return person;
}

// ---------- streamlines: moving dashes along flow lines (wind, water currents) ----------
// streamlines(parent, { lines: [[y0, z0], ...], x0, x1, K dashes per line, len, thick, color, opacity, speed, field(x, y0, z0, t) -> y })
// Dashes travel +x at `speed` (m/s) and turn with the local slope of `field`; they fade in/out at both ends. update(t) each frame.
export function streamlines(parent, o) {
  const L = o.lines, K = o.K ?? 14, N = L.length * K, x0 = o.x0, x1 = o.x1, span = x1 - x0;
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: o.color ?? 0x2f6fd6, transparent: true, opacity: o.opacity ?? .55, depthWrite: false }), N);
  m.frustumCulled = false; parent.add(m);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), f = o.field ?? ((x, y) => y);
  m.userData.update = t => { let n = 0;
    L.forEach(([y0, z0], li) => { for (let k = 0; k < K; k++, n++) {
      const u = ((t * (o.speed ?? 6) / span + k / K + hash(li, 7) * .37) % 1 + 1) % 1, x = x0 + u * span;
      const y = f(x, y0, z0, t), dy = f(x + .3, y0, z0, t) - y, fade = Math.min(1, Math.sin(u * Math.PI) * 3);
      P.set(x, y, z0); Q.setFromAxisAngle(Z, Math.atan2(dy, .3)); S.set((o.len ?? 1.6) * fade + 1e-4, (o.thick ?? .07) * fade + 1e-4, (o.thick ?? .07) * fade + 1e-4);
      m.setMatrixAt(n, M4.compose(P, Q, S)); } });
    m.instanceMatrix.needsUpdate = true; };
  return m;
}
