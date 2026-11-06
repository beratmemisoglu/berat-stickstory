// Reusable low-poly / voxel models, all faceted palette shading.
import { THREE, C, RAMP, facet, flat, box, vox, rng, GEO, V } from './engine.js';

export function group(...kids) { const g = new THREE.Group(); kids.forEach(k => k && g.add(k)); return g; }

// The original "fat" PlayStation 2, lying horizontally. Front faces +z. ~3 x .8 x 1.9
export function ps2() {
  const g = new THREE.Group();
  g.add(box(3.0, .52, 1.9, 'black', [0, .26, 0]));                 // lower body
  g.add(box(3.0, .26, 1.7, 'black', [0, .65, -.05]));               // upper deck
  g.add(box(2.96, .06, .06, 'grey', [0, .52, .93]));                // seam line
  for (let i = 0; i < 14; i++) g.add(box(.05, .03, 1.5, 'grey', [-1.35 + i * .085, .79, -.05]));   // ribbed top
  g.add(box(1.7, .07, .05, 'grey', [.25, .36, .96]));               // disc tray slot
  g.add(box(.26, .16, .03, 'blue', [-1.15, .36, .96]));              // PS logo plate
  g.add(box(.12, .1, .04, 'black', [-.6, .15, .96]));               // controller ports
  g.add(box(.12, .1, .04, 'black', [-.35, .15, .96]));
  g.add(box(.08, .05, .04, 'green', [1.3, .36, .96]));               // power LED
  g.add(box(.08, .05, .04, 'blue', [1.3, .25, .96]));                // eject LED
  g.add(box(.16, .1, .02, [C.dark, C.slate, C.silver], [1.05, .15, .96]));  // memory card slot
  for (const x of [-1.3, 1.3]) for (const z of [-.8, .8]) g.add(box(.2, .04, .2, 'black', [x, -.02, z]));
  return g;
}

// 32 MB as a grid of cells (1 cell = 1 MB by default). Returns group with .cells and .set(i, ramp)
export function memory(cols = 8, rows = 4, size = .32, gap = .06, ramp = 'navy') {
  const g = new THREE.Group(); g.cells = [];
  const step = size + gap;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const m = box(size, size, size, ramp, [(c - (cols - 1) / 2) * step, (rows - 1 - r) * step, 0]);
    g.add(m); g.cells.push(m);
  }
  const frameMat = flat(C.slate);
  const w = cols * step + .1, h = rows * step + .1;
  [[w, .04, 0, -step / 2 - .05 + h], [w, .04, 0, -step / 2 - .05], [.04, h, -w / 2, (rows - 1) * step / 2], [.04, h, w / 2, (rows - 1) * step / 2]]
    .forEach(([bw, bh, x, y]) => { const b = new THREE.Mesh(GEO.box, frameMat); b.scale.set(bw, bh, .04); b.position.set(x, y, -size / 2); g.add(b); });
  g.set = (i, r) => { g.cells[i].material = facet(r); };
  g.size = [cols * step, rows * step];
  return g;
}

export function disc(r = 1.2) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .05, 48), facet([C.slate, C.silver, C.white]));
  g.add(body);
  const ring = (r0, r1, col, y) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48), flat(col, { side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; g.add(m); return m; };
  g.data = ring(r * .36, r * .97, C.silver, .027);
  ring(r * .3, r * .36, C.slate, .028);
  ring(0, r * .12, C.bg, .03);
  g.sheen = ring(r * .5, r * .62, C.cyan, .029);
  return g;
}

export function car(ramp = 'red', s = 1, taxi = false) {
  const g = new THREE.Group();
  g.paint = [box(.92 * s, .2 * s, .44 * s, ramp, [0, .19 * s, 0]), box(.5 * s, .16 * s, .4 * s, ramp, [-.06 * s, .37 * s, 0])];
  g.add(...g.paint);
  g.add(box(.02 * s, .12 * s, .36 * s, [C.navy, C.sky, C.cyan], [.2 * s, .38 * s, 0]));          // windshield
  g.add(box(.02 * s, .1 * s, .34 * s, [C.navy, C.blue, C.sky], [-.32 * s, .38 * s, 0]));         // rear window
  g.add(box(.36 * s, .09 * s, .41 * s, [C.navy, C.blue, C.sky], [-.06 * s, .39 * s, 0]));       // side windows band
  for (const x of [-.28, .28]) for (const z of [-.21, .21]) {
    g.add(box(.2 * s, .2 * s, .07 * s, 'black', [x * s, .1 * s, z * s]));
    g.add(box(.08 * s, .08 * s, .02 * s, 'grey', [x * s, .1 * s, z * s + Math.sign(z) * .04 * s]));
  }
  for (const z of [-.14, .14]) { g.add(box(.02 * s, .05 * s, .08 * s, 'white', [.47 * s, .22 * s, z * s])); g.add(box(.02 * s, .05 * s, .08 * s, 'red', [-.47 * s, .22 * s, z * s])); }
  g.add(box(.94 * s, .03 * s, .46 * s, 'black', [0, .1 * s, 0]));                                 // bumper line
  if (taxi) g.add(box(.14 * s, .05 * s, .1 * s, 'yellow', [-.06 * s, .48 * s, 0]));
  return g;
}
export function building(w, h, d, ramp = 'grey', seed = 1, lit = .45) {
  const g = new THREE.Group(), r = rng(seed * 7919 + 13);
  g.add(box(w, h, d, ramp, [0, h / 2, 0]));
  g.add(box(w + .04, .32, d + .04, 'black', [0, .16, 0]));                                          // shop floor
  const shop = [['yellow', 'cyan', 'orange', 'lime'][Math.floor(r() * 4)]];
  g.add(box(w * .7, .16, .02, shop[0], [0, .16, d / 2 + .03]));                                   // shop window
  g.add(box(w * .8, .05, .16, ['red', 'teal', 'blue', 'plum'][Math.floor(r() * 4)], [0, .34, d / 2 + .08]));   // awning
  const on = [], off = [], cy = [];
  for (let y = .55; y < h - .2; y += .3) {
    for (let x = -w / 2 + .2; x < w / 2 - .12; x += .24) { const k = r(); (k < lit * .12 ? cy : k < lit ? on : off).push([x, y, d / 2 + .01, 0]); }
    for (let z = -d / 2 + .2; z < d / 2 - .12; z += .24) { const k = r(); (k < lit * .12 ? cy : k < lit ? on : off).push([w / 2 + .01, y, z, 1]); }
  }
  const M = new THREE.Matrix4();
  for (const [list, ramp2] of [[on, [C.orange, C.yellow, C.yellow]], [cy, [C.sky, C.cyan, C.cyan]], [off, [C.bg, C.navy, C.navy]]]) {
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(GEO.box, facet(ramp2), list.length);
    list.forEach(([x, y, z, side], i) => im.setMatrixAt(i, M.makeScale(side ? .02 : .12, .15, side ? .12 : .02).setPosition(x, y, z)));
    g.add(im);
  }
  g.add(box(w + .08, .08, d + .08, 'grey', [0, h + .04, 0]));                                       // cornice
  if (r() < .6) g.add(box(.22, .14, .3, 'white', [w * (r() - .5) * .5, h + .15, d * (r() - .5) * .5]));        // AC unit
  if (r() < .35) g.add(box(.16, .1, .16, 'grey', [w * (r() - .5) * .5, h + .13, d * (r() - .5) * .5]));
  if (h > 2 && r() < .45) {                                                                          // water tower
    const x = w * (r() - .5) * .4, z = d * (r() - .5) * .4;
    for (const [dx, dz] of [[-.1, -.1], [.1, -.1], [-.1, .1], [.1, .1]]) g.add(box(.03, .25, .03, 'black', [x + dx, h + .2, z + dz]));
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .3, 8), facet([C.plum, C.red, C.orange])); tank.position.set(x, h + .47, z); g.add(tank);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.19, .12, 8), facet('black')); cap.position.set(x, h + .68, z); g.add(cap);
  } else if (r() < .4) g.add(box(.03, .6, .03, 'grey', [w * .3, h + .35, -d * .3]));                // antenna
  return g;
}
export function tree(s = 1, seed = 0) {
  const r = rng(seed * 131 + 7), ramp = [[C.teal, C.green, C.lime], [C.navy, C.teal, C.green], [C.teal, C.green, C.green]][seed % 3];
  const g = group(box(.09 * s, .34 * s, .09 * s, [C.plum, C.red, C.red], [0, .17 * s, 0]));
  const tiers = [[.44, .22, .38], [.34, .2, .56], [.2, .16, .72]];
  tiers.forEach(([w, h, y], i) => g.add(box(w * s, h * s, w * s, ramp, [(r() - .5) * .05 * s, y * s, (r() - .5) * .05 * s])));
  return g;
}
export function lamppost(s = 1) {
  return group(box(.04 * s, .7 * s, .04 * s, 'grey', [0, .35 * s, 0]), box(.2 * s, .03 * s, .04 * s, 'grey', [.08 * s, .7 * s, 0]),
    box(.08 * s, .04 * s, .06 * s, 'yellow', [.16 * s, .67 * s, 0]));
}

// a chip: dark package with pins and a lighter die marking. top faces +y
export function chip(w = 1.6, d = 1.6, ramp = 'black', dieRamp = 'grey') {
  const g = new THREE.Group();
  g.add(box(w, .16, d, ramp, [0, .08, 0]));
  g.add(box(w * .55, .03, d * .55, dieRamp, [0, .175, 0]));
  const pins = [], n = Math.max(4, Math.round(w / .14));
  for (let i = 0; i < n; i++) { const p = -w / 2 + (i + .5) * w / n; pins.push([p, d / 2 + .05, 0], [p, -d / 2 - .05, 0]); }
  const m = Math.max(4, Math.round(d / .14));
  for (let i = 0; i < m; i++) { const p = -d / 2 + (i + .5) * d / m; pins.push([w / 2 + .05, p, 1], [-w / 2 - .05, p, 1]); }
  const im = new THREE.InstancedMesh(GEO.box, facet('white'), pins.length), M = new THREE.Matrix4();
  pins.forEach(([a, b, rot], i) => im.setMatrixAt(i, M.makeScale(rot ? .1 : .06, .04, rot ? .06 : .1).setPosition(rot ? a : a, .04, rot ? b : b)));
  g.add(im);
  return g;
}

// blocky Colossus: stone body, furry back, glowing eyes. Pivots: legL, legR, armL, armR (animate .rotation.x)
export function colossus(s = 1) {
  const g = new THREE.Group(), r = rng(9);
  const stone = [C.dark, C.slate, C.silver], dark = [C.bg, C.dark, C.slate], fur = [C.navy, C.teal, C.green];
  const part = (w, h, d, ramp, x, y, z, parent = g) => { const m = box(w * s, h * s, d * s, ramp, [x * s, y * s, z * s]); parent.add(m); return m; };
  const tufts = (parent, x, y, z, w, h, d, n) => { for (let i = 0; i < n; i++) part(.35 + r() * .3, .25 + r() * .35, .35 + r() * .3, i % 3 ? fur : [C.teal, C.green, C.lime],
    x + (r() - .5) * w, y + (r() - .5) * h, z + (r() - .5) * d, parent); };
  const pivot = (x, y, z) => { const p = new THREE.Group(); p.position.set(x * s, y * s, z * s); g.add(p); return p; };
  g.legL = pivot(-1.0, 3.3, 0); g.legR = pivot(1.0, 3.3, 0);
  for (const L of [g.legL, g.legR]) {
    part(1.3, 1.6, 1.3, fur, 0, -.6, 0, L);                 // furry thigh
    part(1.05, 2.0, 1.05, stone, 0, -2.2, 0, L);            // stone shin
    part(1.2, .5, .25, dark, 0, -2.0, .6, L);                // shin plate
    part(1.4, .45, 1.8, stone, 0, -3.1, .25, L);             // foot
    for (const x of [-.45, 0, .45]) part(.3, .3, .3, dark, x, -3.15, 1.2, L);  // toes
    tufts(L, 0, -.3, 0, 1.3, .8, 1.3, 4);
  }
  part(3.8, 2.8, 2.4, stone, 0, 4.6, 0);                     // torso
  part(3.3, .5, .3, dark, 0, 4.2, 1.25);                     // chest plate seam
  part(1.8, 1.2, .3, dark, 0, 5.2, 1.25);
  part(4.2, 1.2, 2.8, fur, 0, 5.9, -.2);                     // shoulder mantle
  tufts(g, 0, 5.5, -1.2, 3.8, 2.6, .8, 14);                  // fur cape down the back
  tufts(g, 0, 6.4, 0, 4, .6, 2.4, 8);
  const sigil = part(.5, .5, .15, 'cyan', 0, 5.6, -1.75);   // weak point on the back
  part(1.7, 1.5, 1.7, stone, 0, 6.8, .5);                    // head
  part(1.8, .9, .3, dark, 0, 6.7, 1.38);                     // face mask
  part(1.9, .5, 1.9, fur, 0, 7.6, .4);                       // fur crown
  g.eyes = [part(.3, .2, .1, 'cyan', -.42, 6.85, 1.55), part(.3, .2, .1, 'cyan', .42, 6.85, 1.55)];
  part(.25, .25, .1, 'cyan', 0, 7.2, 1.55);                  // forehead sigil
  for (const x of [-1, 1]) { part(.3, .9, .3, dark, x * .95, 7.9, .3); part(.3, .3, .6, dark, x * 1.05, 8.3, .6); }   // horns
  g.sigil = sigil;
  g.armL = pivot(-2.3, 5.6, 0); g.armR = pivot(2.3, 5.6, 0);
  for (const A of [g.armL, g.armR]) {
    part(1.2, 1.2, 1.2, fur, 0, -.3, 0, A); tufts(A, 0, -.4, 0, 1.2, .6, 1.2, 3);
    part(.95, 2.4, .95, stone, 0, -1.9, 0, A);
    part(1.1, .8, 1.1, dark, 0, -1.5, 0, A);                 // bracer
    part(1.1, .7, 1.2, stone, 0, -3.3, .1, A);               // fist
  }
  return g;
}
export function rider(s = 1) {   // Agro + Wander
  const g = new THREE.Group(), hide = [C.bg, C.dark, C.slate], mane = [C.bg, C.bg, C.dark];
  g.add(box(.95 * s, .38 * s, .32 * s, hide, [0, .78 * s, 0]));                              // barrel
  g.add(box(.3 * s, .42 * s, .22 * s, hide, [.52 * s, 1.02 * s, 0])); g.children.at(-1).rotation.z = -.5;   // neck
  g.add(box(.34 * s, .15 * s, .16 * s, hide, [.72 * s, 1.2 * s, 0])); g.children.at(-1).rotation.z = -.35;  // head
  g.add(box(.08 * s, .08 * s, .06 * s, hide, [.62 * s, 1.34 * s, .05 * s]));                // ear
  g.add(box(.36 * s, .08 * s, .06 * s, mane, [.46 * s, 1.14 * s, 0])); g.children.at(-1).rotation.z = -.55; // mane
  g.add(box(.07 * s, .42 * s, .07 * s, mane, [-.52 * s, .72 * s, 0])); g.children.at(-1).rotation.z = .3;   // tail
  for (const x of [-.36, .34]) for (const z of [-.11, .11]) {
    g.add(box(.09 * s, .56 * s, .09 * s, hide, [x * s, .3 * s, z * s]));
    g.add(box(.1 * s, .06 * s, .11 * s, 'black', [x * s, .03 * s, z * s]));
  }
  g.add(box(.3 * s, .06 * s, .36 * s, [C.plum, C.red, C.red], [-.02 * s, .99 * s, 0]));    // saddle blanket
  g.add(box(.18 * s, .34 * s, .16 * s, [C.slate, C.silver, C.white], [0, 1.18 * s, 0]));    // Wander's tunic
  g.add(box(.2 * s, .28 * s, .04 * s, [C.plum, C.red, C.red], [-.08 * s, 1.12 * s, -.1 * s])); // cape
  g.add(box(.13 * s, .13 * s, .13 * s, 'sand', [.02 * s, 1.42 * s, 0]));
  g.add(box(.15 * s, .06 * s, .15 * s, 'black', [0, 1.5 * s, 0]));
  g.add(box(.02 * s, .5 * s, .02 * s, 'white', [.1 * s, 1.2 * s, .1 * s])); g.children.at(-1).rotation.z = -.4;  // sword, catching light
  return g;
}
export function person(ramp = 'blue', s = 1, hair = 'black') {
  return group(box(.14 * s, .2 * s, .09 * s, ramp, [0, .25 * s, 0]),                     // torso
    box(.1 * s, .1 * s, .1 * s, 'sand', [0, .41 * s, 0]),                                  // head
    box(.11 * s, .04 * s, .11 * s, hair, [0, .47 * s, 0]), box(.11 * s, .06 * s, .03 * s, hair, [0, .43 * s, -.045 * s]),
    box(.04 * s, .16 * s, .04 * s, ramp, [-.09 * s, .26 * s, 0]), box(.04 * s, .16 * s, .04 * s, ramp, [.09 * s, .26 * s, 0]),   // arms
    box(.05 * s, .15 * s, .05 * s, 'black', [-.035 * s, .075 * s, 0]), box(.05 * s, .15 * s, .05 * s, 'black', [.035 * s, .075 * s, 0]));
}
export function mountain(r = 3, h = 4, seed = 1, ramp = 'stone', snow = true) {
  const g = new THREE.Group(), q = rng(seed * 17 + 3);
  const peaks = [[0, 0, 1, 1], [r * .55, r * .2, .62, .7], [-r * .5, -r * .25, .55, .62]];
  for (const [x, z, rs, hs] of peaks) {
    const segs = 5 + (seed % 3);
    const m = new THREE.Mesh(new THREE.ConeGeometry(r * rs, h * hs, segs, 1), facet(ramp)); m.position.set(x, h * hs / 2, z); m.rotation.y = seed + x; g.add(m);
    if (snow) { const c = new THREE.Mesh(new THREE.ConeGeometry(r * rs * .3, h * hs * .3, segs, 1), facet('white')); c.position.set(x, h * hs * .851, z); c.rotation.y = seed + x; g.add(c); }
  }
  return g;
}
// scatter rocks and grass tufts over a height field (instanced, cheap)
export function scatter(hf, { n = 200, area = 60, seed = 1, cx = 0, cz = 0, rocks = true, grass = true, grassRamp = [C.teal, C.green, C.lime] } = {}) {
  const g = new THREE.Group(), r = rng(seed), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E3 = new THREE.Euler();
  const mk = (ramp, count, sz) => { const im = new THREE.InstancedMesh(GEO.box, facet(ramp), count);
    for (let i = 0; i < count; i++) { const x = cx + (r() - .5) * area, z = cz + (r() - .5) * area, k = sz[0] + r() * sz[1];
      im.setMatrixAt(i, M.compose(V(x, hf(x, z) + k * .3, z), Q.setFromEuler(E3.set(r() * .5, r() * 3, r() * .5)), V(k, k * (ramp === grassRamp ? 1.4 : .7), k))); }
    g.add(im); };
  if (rocks) mk('stone', Math.round(n * .3), [.15, .45]);
  if (grass) mk(grassRamp, Math.round(n * .7), [.08, .12]);
  return g;
}
export function plane(s = 1) {
  return group(box(1.6 * s, .22 * s, .22 * s, 'white', [0, 0, 0]), box(.35 * s, .03 * s, .7 * s, 'white', [.05 * s, 0, 0]),
    box(.25 * s, .3 * s, .04 * s, 'red', [-.7 * s, .15 * s, 0]), box(.2 * s, .08 * s, .23 * s, [C.navy, C.sky, C.cyan], [.6 * s, .06 * s, 0]));
}
// faceted terrain: non-indexed so every triangle gets its own flat shade
export function terrain(w, d, seg, hf, ramp = 'green') {
  const g = new THREE.PlaneGeometry(w, d, seg, Math.round(seg * d / w)).toNonIndexed();
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, hf(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  return new THREE.Mesh(g, facet(ramp));
}
export function orbit(cam, target, r, ang, h) {
  cam.position.set(target.x + Math.sin(ang) * r, target.y + h, target.z + Math.cos(ang) * r); cam.lookAt(target);
}
// cyan edge overlay ("show the polygons")
export function wire(obj, col = C.cyan) {
  const g = new THREE.Group();
  obj.updateMatrixWorld(true);
  obj.traverse(m => {
    if (!m.isMesh || m.isInstancedMesh) return;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: col }));
    e.matrixAutoUpdate = false; e.matrix.copy(m.matrixWorld); g.add(e);
  });
  return g;
}
const EDGE_BOX = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
export function ghostBox(w, h, d, col = C.dark) {
  const e = new THREE.LineSegments(EDGE_BOX, new THREE.LineBasicMaterial({ color: col }));
  e.scale.set(w, h, d); e.position.y = h / 2; return e;
}
// city of blocks on a street grid. Each lot: { x, z, w, d, h, solid (group), ghost (lines) }
export function city(nx, nz, { lot = 2.2, seed = 5, hMin = .8, hMax = 3.2, ramps = ['grey', 'white', 'stone', 'teal', 'blue', 'red'], ghostCol = C.dark } = {}) {
  const g = new THREE.Group(), r = rng(seed), lots = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = (i - (nx - 1) / 2) * lot, z = (j - (nz - 1) / 2) * lot;
    const w = lot * (.5 + r() * .22), d = lot * (.5 + r() * .22), h = hMin + Math.pow(r(), 1.6) * (hMax - hMin);
    const solid = building(w, h, d, ramps[Math.floor(r() * ramps.length)], i * 31 + j);
    solid.position.set(x, 0, z);
    const ghost = ghostBox(w, h, d, ghostCol); ghost.position.set(x, h / 2, z);
    g.add(solid, ghost); lots.push({ x, z, w, d, h, solid, ghost });
  }
  g.lots = lots; return g;
}
export function ground(w, d, ramp = 'navy', y = 0) { return box(w, .1, d, ramp, [0, y - .05, 0]); }
export function gridFloor(size = 40, step = 1, col = C.navy) {
  const pts = [];
  for (let i = -size / 2; i <= size / 2; i += step) pts.push(i, 0, -size / 2, i, 0, size / 2, -size / 2, 0, i, size / 2, 0, i);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: col }));
}
// flat quad (e.g. a billboard / "image") with a solid ramp
export function panel(w, h, ramp = 'navy') { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), facet(ramp, { side: THREE.DoubleSide })); return m; }
// canvas texture quad for pixel images (nearest filtering)
export function pixelQuad(w, h, drawFn, pw = 64, ph = 64) {
  const cv = document.createElement('canvas'); cv.width = pw; cv.height = ph; const x = cv.getContext('2d');
  drawFn(x, pw, ph);
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, alphaTest: .5 }));
  m.userData.redraw = (fn) => { fn(x, pw, ph); tex.needsUpdate = true; };
  return m;
}

// Toon Studio: every model instance carries userData.kind, so a click in the editor can say what it hit
// ("tree", "building" ...). Do the same for project models: g.userData.kind = 'hut'.
const tagged = (name, f) => (...a) => { const o = f(...a); if (o?.userData && !o.userData.kind) o.userData.kind = name; return o; };
ps2 = tagged('ps2 console', ps2); memory = tagged('memory grid', memory); disc = tagged('disc', disc); car = tagged('car', car);
building = tagged('building', building); tree = tagged('tree', tree); lamppost = tagged('lamppost', lamppost); chip = tagged('chip', chip);
colossus = tagged('colossus', colossus); rider = tagged('rider', rider); person = tagged('person', person); mountain = tagged('mountain', mountain);
plane = tagged('plane', plane); city = tagged('city', city); scatter = tagged('scatter (rocks + grass)', scatter); terrain = tagged('terrain', terrain);
