// Geometry building blocks of the toon look: bendy "noodle" tubes (limbs, cables, tails) rebuilt per frame along a
// smooth curve, rounded bodies (beans, capsules) from a profile, and the ink outline (an inverted hull pushed out along
// the normals by a constant width in SCREEN pixels, so a far character and a close-up have the same line weight).
import { THREE, RH } from './core.js';

// ---------- the outline ----------
// The studied look: the ink line is part of the object (about 3 % of a character's width: 8-14 px at 1080 wide in a
// close-up), so it is a WORLD width; far away it never drops under `px` pixels (at 1920 tall) so it never disappears.
const OUTLINE_MATS = new Map();
/** Ink outline material: w = line width in metres, px = minimum width in pixels at 1920 tall. */
export function outlineMat(color = '#2a1d17', w = .012, px = 1.6) {
  const key = color + '|' + w + '|' + px;
  if (OUTLINE_MATS.has(key)) return OUTLINE_MATS.get(key);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.userData.outline = true;
  m.onBeforeCompile = sh => {
    sh.uniforms.olPx = { value: px * RH / 1920 }; sh.uniforms.olH = { value: RH }; sh.uniforms.olW = { value: w };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float olPx; uniform float olH; uniform float olW;')
      .replace('#include <project_vertex>', `
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        vec3 nV = normalize(normalMatrix * normal);
        float dz = -mvPosition.z;
        float persp = projectionMatrix[1][1];
        float px2world = (projectionMatrix[3][3] > .5) ? 2. / (persp * olH) : 2. * dz / (persp * olH);
        float wl = max(olW, olPx * px2world);
        mvPosition.xyz += nV * wl;
        mvPosition.z -= wl * .6;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  // one GPU program for every outline: width and minimum pixels are uniforms (three.js keeps them per material). With the
  // values in this key every distinct width compiled the same shader again the first time a shot showed it: 177 of a
  // short's ~300 programs, the main hitch when playing into a new shot (docs/PREVIEW_PERF.md)
  m.customProgramCacheKey = () => 'outline';
  OUTLINE_MATS.set(key, m);
  return m;
}
/** Add an ink outline to a mesh (shares its geometry). w = world width (m), px = minimum pixels. */
export function addOutline(mesh, color, w, px) {
  if (!mesh?.isMesh || mesh.userData.olMesh) return mesh;
  // the hull is pushed along the mesh's own normals in its own space: undo a non-uniform scale's effect on the width
  const s = mesh.scale, k = Math.max(1e-4, (Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.z)) / 3);
  const o = new THREE.Mesh(mesh.geometry, outlineMat(color, (w ?? .012), px));
  void k;
  o.userData.isOutline = true; o.userData.noPick = true; o.castShadow = false; o.receiveShadow = false; o.renderOrder = mesh.renderOrder;
  mesh.add(o); mesh.userData.olMesh = o;
  return mesh;
}
/** Outline every mesh under a group (skips transparent and outline-less ones). w = world width, px = minimum pixels. */
export function outlineAll(root, color, w, px, filter = () => true) {
  const list = []; root.traverse(o => { if (o.isMesh && !o.userData.isOutline && !o.userData.noOutline && filter(o)) list.push(o); });
  for (const m of list) { const mat = Array.isArray(m.material) ? m.material[0] : m.material; if (mat?.transparent && (mat.opacity ?? 1) < .99) continue; addOutline(m, color, w, px); }
  return root;
}

// ---------- zero-length normals ----------
// A lathe's axis points, a degenerate triangle or a collapsed cap leave normals of length 0: finite in the data, but the
// shader's normalize() turns them into NaN, and one NaN pixel used to bloom into a black square. Every mesh of a shot
// goes through this once when the shot is built (a geometry is checked once, wherever it is reused).
const _checked = new WeakSet();
export function fixNormals(root) {
  let fixed = 0;
  root.traverse(o => {
    const g = o.geometry; if (!g || _checked.has(g)) return; _checked.add(g);
    const n = g.attributes?.normal, p = g.attributes?.position; if (!n || !p) return;
    let c = null;
    for (let i = 0; i < n.count; i++) {
      const x = n.getX(i), y = n.getY(i), z = n.getZ(i), l = Math.hypot(x, y, z);
      if (l > 1e-6 && Number.isFinite(l)) continue;
      if (!c) { g.computeBoundingBox(); c = g.boundingBox.getCenter(new THREE.Vector3()); }
      let dx = p.getX(i) - c.x, dy = p.getY(i) - c.y, dz = p.getZ(i) - c.z, d = Math.hypot(dx, dy, dz);
      if (!(d > 1e-6)) { dx = 0; dy = 1; dz = 0; d = 1; }
      n.setXYZ(i, dx / d, dy / d, dz / d); fixed++;
    }
    if (fixed) n.needsUpdate = true;
  });
  return fixed;
}

// ---------- rounded bodies from a profile ----------
/** A solid of revolution around Y from [radius, y] pairs (bottom to top), smoothed: beans, capsules, vases, bottles. */
export function lathe(profile, seg = 40, smoothN = 4) {
  let pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  if (smoothN > 0 && pts.length > 2) { const curve = new THREE.SplineCurve(pts); pts = curve.getPoints(pts.length * smoothN); }
  const g = new THREE.LatheGeometry(pts, seg); g.computeVertexNormals(); return g;
}
/** A capsule-like bean (torso): width at hips / waist / chest, height. Bottom and top are rounded. */
export function bean(h = .55, rB = .2, rM = .19, rT = .17, round = .08) {
  const P = [[0, 0], [rB * .55, .006], [rB * .88, round * .4], [rB, round], [rM, h * .45], [rT, h - round], [rT * .86, h - round * .4], [rT * .5, h - .006], [0, h]];
  return lathe(P, 48, 6);
}

// ---------- noodle tubes ----------
const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3();
/** A tube whose path is re-set every frame: noodle.setPath(points[], radius or (u)=>radius). seg along, rad around. */
export class Noodle extends THREE.Mesh {
  constructor(mat, seg = 18, rad = 10, r = .03) {
    const g = new THREE.BufferGeometry();
    const n = (seg + 1) * (rad + 1) + 2;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    const idx = [];
    // triangles wind counter-clockwise seen from OUTSIDE (front faces out; the outline hull draws the back faces)
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) { const a = i * (rad + 1) + j, b = a + rad + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const c0 = (seg + 1) * (rad + 1), c1 = c0 + 1;   // end caps (flat discs closed by a centre vertex; hands/feet hide them)
    for (let j = 0; j < rad; j++) { idx.push(c0, j + 1, j); const e = seg * (rad + 1); idx.push(c1, e + j, e + j + 1); }
    g.setIndex(idx);
    super(g, mat);
    this.seg = seg; this.rad = rad; this.r = r; this.frustumCulled = false; this.castShadow = true;
    this._curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, -.1, 0), new THREE.Vector3(0, -.2, 0)], false, 'centripetal', .5);
  }
  /** points in the parent's space; radius = number or u => number (u 0..1 along) */
  setPath(points, radius = this.r) {
    const cv = this._curve; cv.points.length = 0; for (const p of points) cv.points.push(p.isVector3 ? p.clone() : new THREE.Vector3(...p));
    cv.updateArcLengths();   // getPointAt() caches arc lengths: new points need a new table
    const pos = this.geometry.attributes.position.array, nor = this.geometry.attributes.normal.array, uv = this.geometry.attributes.uv.array;
    const { seg, rad } = this; let prevN = null;
    for (let i = 0; i <= seg; i++) {
      const u = i / seg; cv.getPointAt(u, _p); cv.getTangentAt(u, _t).normalize();
      // rotation-minimising frame (parallel transport): no twisting along the noodle
      if (!prevN) { _n.set(0, 0, 1); if (Math.abs(_t.dot(_n)) > .9) _n.set(1, 0, 0); _n.sub(_v.copy(_t).multiplyScalar(_t.dot(_n))).normalize(); }
      else { _n.copy(prevN).sub(_v.copy(_t).multiplyScalar(_t.dot(prevN))).normalize(); }
      prevN = (prevN || new THREE.Vector3()).copy(_n);
      _b.crossVectors(_t, _n);
      const r = typeof radius === 'function' ? radius(u) : radius;
      for (let j = 0; j <= rad; j++) {
        const a = j / rad * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const k = (i * (rad + 1) + j) * 3, nx = _n.x * ca + _b.x * sa, ny = _n.y * ca + _b.y * sa, nz = _n.z * ca + _b.z * sa;
        pos[k] = _p.x + nx * r; pos[k + 1] = _p.y + ny * r; pos[k + 2] = _p.z + nz * r;
        nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
        const q = (i * (rad + 1) + j) * 2; uv[q] = j / rad; uv[q + 1] = u;
      }
      if (i === 0 || i === seg) { const c = ((seg + 1) * (rad + 1) + (i ? 1 : 0)) * 3; pos[c] = _p.x; pos[c + 1] = _p.y; pos[c + 2] = _p.z; nor[c] = _t.x * (i ? 1 : -1); nor[c + 1] = _t.y * (i ? 1 : -1); nor[c + 2] = _t.z * (i ? 1 : -1); }
    }
    this.geometry.attributes.position.needsUpdate = true; this.geometry.attributes.normal.needsUpdate = true; this.geometry.attributes.uv.needsUpdate = true;
    this.geometry.computeBoundingSphere();
    return this;
  }
}
/** Three points of a bent limb: root, joint (elbow/knee) and end, with the joint pushed out so the noodle curves softly. */
export function limbPath(root, joint, end, soft = .35) {
  const mid = root.clone().add(end).multiplyScalar(.5), j = joint.clone().lerp(mid, -soft * .2);
  return [root, root.clone().lerp(j, .55), j, j.clone().lerp(end, .45), end];
}
