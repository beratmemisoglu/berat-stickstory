// Real New York from OpenStreetMap (baked by tools/bake_map.py; data (c) OpenStreetMap contributors, ODbL).
//   loadWorld()                  once at boot: building footprints + the ground texture + the land mask
//   cityMesh({ unit, center, radius, hScale, minH }) -> one merged, shared Mesh of extruded buildings
//   groundMesh({ unit, center })  -> the baked map as a ground plane (land + water + parks + runways + roads)
//   landMesh({ unit, center, y }) -> only the land (alpha from the mask), to lay over a moving water plane
// Units: 'km' (1 world unit = 1 km, the overview map) or 'm' (1 unit = 1 m, eye-level scenes). Map x = east, y = north;
// world x = east, world -z = north. `center` is a map point [x, y] km that becomes the world origin.
import { THREE, ROOT } from '../engine.js';
import * as ENG from '../engine.js';
import { Water } from '../vendor/jsm/objects/Water.js';

// riverWater(size): a reflective water surface (three.js Water). Its normal map is generated here (sum of sine waves on
// whole-number frequencies, so it tiles seamlessly): no texture download, identical on every machine.
let WN = null;
function waterNormals() {
  if (WN) return WN; const N = 512, data = new Uint8Array(N * N * 4);
  const waves = []; let sd = 7; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 28; k++) { const fx = Math.round((r() - .5) * 24), fy = Math.round((r() - .5) * 24); if (!fx && !fy) continue; waves.push([fx, fy, 1 / Math.hypot(fx, fy) ** 1.2, r() * 6.283]); }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let gx = 0, gy = 0;
    for (const [fx, fy, a, ph] of waves) { const c = Math.cos(6.2832 * (fx * x + fy * y) / N + ph) * a * 6.2832; gx += c * fx; gy += c * fy; }
    const nx = -gx * .02, ny = -gy * .02, l = Math.hypot(nx, ny, 1), i = (y * N + x) * 4;
    data[i] = (nx / l * .5 + .5) * 255; data[i + 1] = (ny / l * .5 + .5) * 255; data[i + 2] = (1 / l * .5 + .5) * 255; data[i + 3] = 255; }
  WN = new THREE.DataTexture(data, N, N); WN.wrapS = WN.wrapT = THREE.RepeatWrapping; WN.needsUpdate = true; return WN;
}
export function riverWater(scene, o = {}) {
  const w = new Water(new THREE.PlaneGeometry(o.size ?? 30000, o.size ?? 30000), { textureWidth: 1024, textureHeight: 1024, waterNormals: waterNormals(),
    sunDirection: (o.sun ?? new THREE.Vector3(-.45, .75, .3)).clone().normalize(), sunColor: 0xffffff, waterColor: o.color ?? 0x5d7486, distortionScale: o.distortion ?? 1.1, fog: !!scene.fog, alpha: 1 });
  w.rotation.x = -Math.PI / 2; w.material.uniforms.size.value = o.scale ?? 6; w.name = 'river water'; w.userData.ground = true; scene.add(w);
  w.userData.tick = t => { w.material.uniforms.time.value = t * (o.speed ?? .35); };
  return w;
}

// projection of the loaded region (map.json): x = (lon - lon0) * kx, y = (lat - lat0) * ky, km. NYC: 40.78 N 73.95 W, kx 84.2
let B = null, META = null, TEX = null, MASK = null, TEXD = null;
export const ll = (lat, lon) => [(lon - META.lon0) * META.kx, (lat - META.lat0) * META.ky];
// v16: AERO = the region's airport vectors (aero.json from region.py --layers ...,aeroway: { runway, taxiway, apron, terminal,
// hangar: [{ name, w, area, p: [[x, y] km] }], gate: [{ ref, p }] }) or null; META = map.json (extent, centre, attribution)
export let AERO = null;
export const mapMeta = () => META;
// the map texture a look draws with: 'dark' = map_dark.jpg (the Investigation look's default: dark land, light roads and
// runways) when the region has one, 'light' = map.jpg (high-key clay)
const lookTex = look => ((look ?? (ENG.THEME?.outdoor?.map?.tex ?? (ENG.THEME_ID === 'investigation' ? 'dark' : 'light'))) === 'dark' && TEXD) ? TEXD : TEX;
const CACHE = new Map();
export async function loadWorld(base = '', region = 'nyc') {
  const dir = base + 'assets/map/' + region + '/';
  META = await (await fetch(dir + 'map.json')).json();
  META.region = region; META.base = base; HGT = null; TEXD = null; AERO = null;
  const bres = await fetch(dir + 'buildings.bin'); const buf = new DataView(bres.ok ? await bres.arrayBuffer() : new ArrayBuffer(0));
  B = []; let o = 0;
  while (o < buf.byteLength) {
    const n = buf.getUint8(o), h = buf.getUint16(o + 1, true) / 10; o += 3;
    const p = new Float32Array(n * 2); let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) { p[i * 2] = buf.getInt16(o, true) / 1000; p[i * 2 + 1] = buf.getInt16(o + 2, true) / 1000; cx += p[i * 2]; cy += p[i * 2 + 1]; o += 4; }
    B.push({ p, h, cx: cx / n, cy: cy / n });
  }
  const load = url => new Promise(r => new THREE.TextureLoader().load(url, r, undefined, () => r(null)));
  [TEX, MASK, TEXD, AERO] = await Promise.all([load(dir + (META.texture ?? 'nyc_map.jpg')), load(dir + 'land_mask.png'),
    META.textureDark ? load(dir + META.textureDark) : null, META.aero ? fetch(dir + META.aero).then(r => r.ok ? r.json() : null, () => null) : null]);
  for (const t of [TEX, TEXD]) if (t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; }
  if (MASK) MASK.anisotropy = 16;
  await heights();
  return B.length;
}
const keep = o => { o.userData.shared = true; o.traverse(c => (c.userData.shared = true)); return o; };

// extruded buildings: walls (flat-shaded quads) + triangulated roofs, merged into one BufferGeometry, vertex colours
// a touch darker at the foot (cheap ground contact occlusion that reads at any distance)
export function cityMesh(o = {}) {
  const unit = o.unit ?? 'km', s = unit === 'm' ? 1000 : 1, hs = (o.hScale ?? 1) * (unit === 'm' ? 1 : .001);
  const [cx, cy] = o.center ?? [0, 0], R = o.radius ?? 99, minH = o.minH ?? 0;
  const key = JSON.stringify([unit, cx, cy, R, o.hScale, minH]);
  if (CACHE.has(key)) return CACHE.get(key).clone();
  const pos = [], nor = [], col = [];
  const push = (x, y, z, nx, ny, nz, c) => { pos.push(x, y, z); nor.push(nx, ny, nz); col.push(c, c, c); };
  for (const b of B) {
    if (b.h < minH || Math.hypot(b.cx - cx, b.cy - cy) > R) continue;
    const n = b.p.length / 2, H = b.h * hs, X = i => (b.p[i * 2] - cx) * s, Z = i => -(b.p[i * 2 + 1] - cy) * s;
    for (let i = 0; i < n; i++) {                     // walls
      const j = (i + 1) % n, x1 = X(i), z1 = Z(i), x2 = X(j), z2 = Z(j), dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L, nz = dx / L;                  // CCW footprint in map space -> outward normal after the z flip (matches the winding)
      const lo = .86, hi = 1;
      push(x1, 0, z1, nx, 0, nz, lo); push(x2, 0, z2, nx, 0, nz, lo); push(x2, H, z2, nx, 0, nz, hi);
      push(x1, 0, z1, nx, 0, nz, lo); push(x2, H, z2, nx, 0, nz, hi); push(x1, H, z1, nx, 0, nz, hi);
    }
    const contour = []; for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(X(i), Z(i)));
    for (const [a, b2, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
      // keep roofs facing up whatever the ring winding
      const A = contour[a], Bv = contour[b2], C = contour[c], up = (Bv.x - A.x) * (C.y - A.y) - (Bv.y - A.y) * (C.x - A.x) < 0;
      for (const k of up ? [a, b2, c] : [a, c, b2]) push(contour[k].x, H, contour[k].y, 0, 1, 0, 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: o.color ?? 0xf4f3ef, roughness: .92, vertexColors: true }));
  m.castShadow = m.receiveShadow = true; m.name = 'city buildings'; m.userData.pickRoot = true; m.userData.kind = 'buildings'; keep(m); CACHE.set(key, m);
  return m.clone();
}
function plane(unit, center, mat, y) {
  const [X0, X1, Y0, Y1] = META.extent, s = unit === 'm' ? 1000 : 1, [cx, cy] = center ?? [0, 0];
  const m = new THREE.Mesh(new THREE.PlaneGeometry((X1 - X0) * s, (Y1 - Y0) * s), mat);
  m.rotation.x = -Math.PI / 2; m.position.set(((X0 + X1) / 2 - cx) * s, y, -((Y0 + Y1) / 2 - cy) * s); m.receiveShadow = true; m.name = 'map'; m.userData.ground = true; return keep(m);
}
// o.look: 'dark' | 'light' (v16; default: the look's own map, dark in the Investigation look when the region has map_dark.jpg)
export const groundMesh = (o = {}) => plane(o.unit ?? 'km', o.center, new THREE.MeshStandardMaterial({ map: lookTex(o.look ?? (o.unit === 'm' ? 'light' : undefined)), roughness: 1 }), o.y ?? 0);
export const landMesh = (o = {}) => plane(o.unit ?? 'm', o.center, new THREE.MeshStandardMaterial({ map: lookTex(o.look ?? ((o.unit ?? 'm') === 'm' ? 'light' : undefined)), alphaMap: MASK, alphaTest: .5, roughness: 1 }), o.y ?? 1.5);
// is a map point [x, y] km on land? (sampled from the mask; for placing props on the right side of the shore)
let maskData = null;
export function onLand([x, y]) {
  if (!maskData) { const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'); g.drawImage(MASK.image, 0, 0, 1024, 1024); maskData = g.getImageData(0, 0, 1024, 1024).data; }
  const [X0, X1, Y0, Y1] = META.extent, u = Math.floor((x - X0) / (X1 - X0) * 1024), v = Math.floor((Y1 - y) / (Y1 - Y0) * 1024);
  return u >= 0 && v >= 0 && u < 1024 && v < 1024 && maskData[(v * 1024 + u) * 4] > 127;
}

// ---------- terrain (regions baked by tools/bake_region.py: height.bin = n x n int16 metres over the map extent) ----------
let HGT = null;
async function heights() {
  if (HGT || !META.height) return HGT;
  const r = await fetch(`${META.base ?? ROOT}assets/map/${META.region}/height.bin`); HGT = new Int16Array(await r.arrayBuffer()); return HGT;
}
export async function loadHeights() { return heights(); }
// height in metres at a map point [x, y] km (bilinear), 0 when the region has no relief
export function heightAt([x, y]) {
  if (!HGT) return 0; const n = META.height.n, [X0, X1, Y0, Y1] = META.extent;
  const u = Math.min(n - 1.001, Math.max(0, (x - X0) / (X1 - X0) * n - .5)), v = Math.min(n - 1.001, Math.max(0, (Y1 - y) / (Y1 - Y0) * n - .5));
  const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, H = (a, b) => HGT[b * n + a];
  return (H(i, j) * (1 - fu) + H(i + 1, j) * fu) * (1 - fv) + (H(i, j + 1) * (1 - fu) + H(i + 1, j + 1) * fu) * fv;
}
// terrainMesh({ unit: 'km' | 'm', center: [x, y] km, radius km, res, vScale, base, look }): the map texture draped on the real relief.
// km maps exaggerate relief by vScale (default 3); metre scenes use it 1:1. `base` (m) is subtracted so a chosen level sits at y = 0.
// look (v16): 'dark' | 'light' map texture (default: the look's own; a map shot is best built with lib/maps.js regionMap()).
export function terrainMesh(o = {}) {
  const unit = o.unit ?? 'km', s = unit === 'm' ? 1000 : 1, [cx, cy] = o.center ?? [0, 0], R = o.radius ?? Math.max(...META.extent.map(Math.abs));
  const res = o.res ?? 256, vs = (o.vScale ?? (unit === 'm' ? 1 : 3)) * (unit === 'm' ? 1 : .001), base = o.base ?? 0, [X0, X1, Y0, Y1] = META.extent;
  const x0 = Math.max(X0, cx - R), x1 = Math.min(X1, cx + R), y0 = Math.max(Y0, cy - R), y1 = Math.min(Y1, cy + R);
  const g = new THREE.PlaneGeometry((x1 - x0) * s, (y1 - y0) * s, res, res); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const wx = p.getX(i) / s + (x0 + x1) / 2, wy = -p.getZ(i) / s + (y0 + y1) / 2;
    p.setY(i, (heightAt([wx, wy]) - base) * vs);
    uv.setXY(i, (wx - X0) / (X1 - X0), (wy - Y0) / (Y1 - Y0));
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: lookTex(o.look ?? (unit === 'm' ? 'light' : undefined)), roughness: 1 }));
  m.position.set(((x0 + x1) / 2 - cx) * s, 0, -((y0 + y1) / 2 - cy) * s); m.receiveShadow = m.castShadow = true; m.name = 'terrain'; m.userData.ground = true; return m;
}
