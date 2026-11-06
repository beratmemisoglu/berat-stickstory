// Tech and machine props in the toon look: retro tech, modern gadgets, casino / arcade / city machines, lab kit.
// Everything is made in code (rounded boxes, bevelled lathes, canvas labels); invented brand names only.
// Conventions (lib/props.js): front faces +z; the origin sits on the floor under the prop (y = 0) unless the desc says
// otherwise (wall-mounted props: origin on the floor at the wall, back face at z = 0).
//   userData.screen  the canvasTex of a screen prop        userData.draw(fn)  redraw it with fn(ctx, w, h) (any frame)
//   userData.update(t) is called by the engine every frame (reels, LEDs, bulbs, records, rotors ...): deterministic in t
//   userData.top / grip / light as in props.js. Small handhelds lie flat by default; { upright: true } stands them up.
import { THREE, C, shade, canvasTex, redraw, rnd, hash, clamp, lerp, E, seg, springStep } from '../core.js';
import { toonMat } from '../rig.js';
import { outlineMat, lathe as smoothLathe } from '../geo.js';
import { mergeVertices } from '../../vendor/jsm/utils/BufferGeometryUtils.js';

export const REG = {};
const def = (name, tags, desc, make) => { REG[name] = { tags: ['tech', ...tags], desc, make }; };

const OL = C.ink, PI = Math.PI, TAU = PI * 2;
const AX = [PI / 2, 0, 0], AZ = [0, 0, PI / 2], UP = [-PI / 2, 0, 0];   // cylinder axis -> +z / -> x ; plane facing +y
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- geometry (memoised: every copy of a prop shares its geometry) ----------
const GEO = new Map();
const memo = (k, f) => { let g = GEO.get(k); if (!g) { g = f(); GEO.set(k, g); } return g; };
const q4 = v => Math.round(v * 1e5) / 1e5;
/** rounded box with smooth normals (the ink hull never cracks at the edges) */
function rboxGeo(w, h, d, r, seg = 3) {
  r = Math.max(1e-4, Math.min(r, w / 2 * .999, h / 2 * .999, d / 2 * .999));
  return memo(`rb${q4(w)},${q4(h)},${q4(d)},${q4(r)},${seg}`, () => {
    const s = seg * 2 + 1, b = new THREE.BoxGeometry(1, 1, 1, s, s, s), g = b.toNonIndexed(); b.dispose();
    const P = g.attributes.position.array, N = g.attributes.normal.array, hs = .5 / s, n = new THREE.Vector3();
    const bx = w / 2 - r, by = h / 2 - r, bz = d / 2 - r;
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i], y = P[i + 1], z = P[i + 2];
      n.set(x - Math.sign(x) * hs, y - Math.sign(y) * hs, z - Math.sign(z) * hs).normalize();
      P[i] = bx * Math.sign(x) + n.x * r; P[i + 1] = by * Math.sign(y) + n.y * r; P[i + 2] = bz * Math.sign(z) + n.z * r;
      N[i] = n.x; N[i + 1] = n.y; N[i + 2] = n.z;
    }
    g.computeBoundingSphere(); return g;
  });
}
/** cylinder / cone with rounded rims (lathe, smooth normals), centred on its middle, axis y */
function rcylGeo(rt, rb, h, b, n = 32) {
  b = Math.max(1e-4, Math.min(b ?? Math.min(rt, rb, h / 2) * .3, rt * .9, rb * .9, h / 2 * .95));
  return memo(`rc${q4(rt)},${q4(rb)},${q4(h)},${q4(b)},${n}`, () => {
    const P = [new THREE.Vector2(0, -h / 2)];
    for (let i = 0; i <= 4; i++) { const a = -PI / 2 + i / 4 * PI / 2; P.push(new THREE.Vector2(rb - b + Math.cos(a) * b, -h / 2 + b + Math.sin(a) * b)); }
    for (let i = 0; i <= 4; i++) { const a = i / 4 * PI / 2; P.push(new THREE.Vector2(rt - b + Math.cos(a) * b, h / 2 - b + Math.sin(a) * b)); }
    P.push(new THREE.Vector2(0, h / 2));
    return new THREE.LatheGeometry(P, n);
  });
}
const sphGeo = (r, w = 24, h = 16) => memo(`sp${q4(r)},${w}`, () => new THREE.SphereGeometry(r, w, h));
const torGeo = (R, r, arc = TAU, rs = 12, ts = 40) => memo(`to${q4(R)},${q4(r)},${q4(arc)},${rs},${ts}`, () => new THREE.TorusGeometry(R, r, rs, ts, arc));
const planeGeo = (w, h) => memo(`pl${q4(w)},${q4(h)}`, () => new THREE.PlaneGeometry(w, h));
const circGeo = (r, n = 48) => memo(`ci${q4(r)},${n}`, () => new THREE.CircleGeometry(r, n));
/** a lathe from explicit [r, y] points (bottom to top), no smoothing */
const latheGeo = (key, pts, n = 36) => memo('la' + key + n, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), n));
function rrShape(w, h, r, s = new THREE.Shape(), cx = 0, cy = 0) {
  r = Math.max(1e-5, Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5)); const x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -PI / 2, 0); s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, PI / 2); s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, PI / 2, PI);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, PI, PI * 1.5); return s;
}
/** a flat shape with uvs normalised to its bounding box (labels, screens with round corners, arches) */
function shapeGeo(key, shape, n = 8) {
  return memo('sh' + key, () => {
    const g = new THREE.ShapeGeometry(shape, n); g.computeBoundingBox(); const b = g.boundingBox, p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - b.min.x) / (b.max.x - b.min.x), (p.getY(i) - b.min.y) / (b.max.y - b.min.y));
    return g;
  });
}
const rrectGeo = (w, h, r) => shapeGeo(`rr${q4(w)},${q4(h)},${q4(r)}`, rrShape(w, h, r));
/** extruded shape (centred on z) with a bevel; carries a smooth twin for the ink hull */
function exGeo(key, shape, depth, bev, curve = 16) {
  return memo('ex' + key, () => {
    const inner = Math.max(1e-4, depth - 2 * bev);
    const g = new THREE.ExtrudeGeometry(shape, { depth: inner, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: curve });
    g.translate(0, 0, -inner / 2);
    const s = g.clone(); s.deleteAttribute('uv'); s.deleteAttribute('normal'); const m = mergeVertices(s, 1e-5); m.computeVertexNormals(); g.userData.hull = m;
    return g;
  });
}
/** a plane bulging toward +z (CRT glass) */
const bulgeGeo = (w, h, b) => memo(`bu${q4(w)},${q4(h)},${q4(b)}`, () => {
  const g = new THREE.PlaneGeometry(w, h, 16, 12), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const u = p.getX(i) / (w / 2), v = p.getY(i) / (h / 2); p.setZ(i, b * (1 - u * u * .85) * (1 - v * v * .85)); }
  g.computeVertexNormals(); return g;
});
/** a tube along points (cables, handles, coiled cords) */
const tubeGeo = (key, pts, r, n = 48, rs = 8, closed = false) => memo('tu' + key, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V(...p)), closed, 'catmullrom', .5), n, r, rs, closed));

// ---------- meshes ----------
function mk(par, geo, mat, p, rot, s) {
  const m = new THREE.Mesh(geo, mat);
  if (p) m.position.set(p[0], p[1], p[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (s != null) { if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(s[0], s[1], s[2]); }
  par.add(m); return m;
}
const mid3 = (a, b, c) => [a, b, c].sort((x, y) => x - y)[1];
/** rounded box centred at p. o: { r, rot, ol (outline width), seg } */
function box(par, w, h, d, mat, p, o = {}) { const m = mk(par, rboxGeo(w, h, d, o.r ?? Math.min(w, h, d) * .22, o.seg ?? 3), mat, p, o.rot, o.s); m.userData.th = mid3(w, h, d); if (o.ol != null) m.userData.olw = o.ol; if (o.noOl) m.userData.noOutline = true; return m; }
/** rounded cylinder centred at p, axis y (o.rot: AX = facing +z, AZ = along x) */
function cyl(par, rt, rb, h, mat, p, o = {}) { const m = mk(par, rcylGeo(rt, rb, h, o.b, o.n ?? 32), mat, p, o.rot, o.s); m.userData.th = 2 * Math.max(rt, rb); if (o.ol != null) m.userData.olw = o.ol; if (o.noOl) m.userData.noOutline = true; return m; }
function ball(par, r, mat, p, s, o = {}) { const m = mk(par, sphGeo(r, o.w ?? 24, o.h ?? 16), mat, p, o.rot, s); m.userData.th = 2 * r * (Array.isArray(s) ? Math.max(...s) : s ?? 1); if (o.noOl) m.userData.noOutline = true; return m; }
function tor(par, R, r, mat, p, o = {}) { const m = mk(par, torGeo(R, r, o.arc ?? TAU, o.rs ?? 12, o.ts ?? 40), mat, p, o.rot, o.s); m.userData.th = 2 * r * 3; if (o.noOl) m.userData.noOutline = true; return m; }
/** a rod between two points (struts, cables, antennas) */
function rod(par, a, b, r, mat, o = {}) {
  const A = V(...a), B = V(...b), L = A.distanceTo(B), m = mk(par, rcylGeo(r, r, L, o.b ?? r * .45, o.n ?? 12), mat);
  m.position.copy(A).add(B).multiplyScalar(.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), B.clone().sub(A).normalize()); m.userData.th = 2 * r; if (o.noOl) m.userData.noOutline = true; return m;
}
function tube(par, key, pts, r, mat, o = {}) { const m = mk(par, tubeGeo(key, pts, r, o.n ?? 48, o.rs ?? 8), mat, o.p, o.rot); m.userData.th = 2 * r; if (o.noOl !== false) m.userData.noOutline = true; return m; }
/** a flat textured face (label, screen) - no outline; o.glow = emissive intensity (screens), o.r = round corners, o.alpha */
function decal(par, w, h, tex, p, o = {}) {
  const mat = o.mat || (o.glow != null ? glowMat(tex, o.glow) : new THREE.MeshStandardMaterial({ map: tex, roughness: o.rough ?? .7, transparent: !!o.alpha, alphaTest: o.alpha ? .04 : 0, side: o.double ? THREE.DoubleSide : THREE.FrontSide }));
  const m = mk(par, o.geo || (o.r ? rrectGeo(w, h, o.r) : planeGeo(w, h)), mat, p, o.rot);
  m.userData.noOutline = true; return m;
}
const discDecal = (par, r, tex, p, o = {}) => decal(par, 0, 0, tex, p, { ...o, geo: circGeo(r) });

// ---------- materials ----------
const MAT = new Map();
const plastic = (c, o = {}) => toonMat(c, { rough: o.rough ?? .45, ...o });
const matte = c => toonMat(c);
const chrome = (c = '#c4cbd2') => toonMat(c, { metal: .5, rough: .38 });
const glossy = c => toonMat(c, { rough: .28 });
/** a lit colour (LED, lamp lens): shared, steady */
const glow = (c, ei = 1.6) => toonMat(c, { emissive: c, ei, rough: .35 });
/** a material of its own (blinking LEDs, buttons that light up): set .emissiveIntensity / .emissive per frame */
const own = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.rough ?? .4, metalness: o.metal ?? 0, emissive: new THREE.Color(o.emissive ?? c), emissiveIntensity: o.ei ?? 0 });
/** screens: the canvas drives the emissive channel so the picture glows (and blooms where it is bright) */
// (x .85: a white screen pixel lands just under the bloom threshold, so only bright accents bloom)
const glowMat = (tex, ei = 1.15) => new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: ei * .85, roughness: .42 });
/** glass: clear with a white fresnel edge so it reads in the toon look (no ink hull: it would show through) */
function glassMat(color = '#d4f0fa', opacity = .2) {
  const key = 'glass' + color + opacity; if (MAT.has(key)) return MAT.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: .06, metalness: 0, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  float czF = pow(1. - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.2);\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.), czF * .6);\n  gl_FragColor.a = clamp(gl_FragColor.a + czF * .55, 0., .9);'); };
  m.customProgramCacheKey = () => 'czglass';
  MAT.set(key, m); return m;
}
const basicTex = (tex, o = {}) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: .04, color: o.color ?? '#ffffff', depthWrite: o.depthWrite ?? true, toneMapped: false });
/** two white diagonal streaks: put in front of any glass pane so it reads as glass */
function streakMat() {
  if (MAT.has('streak')) return MAT.get('streak');
  const t = canvasTex(128, 64, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.22)'; x.beginPath(); x.moveTo(w * .1, 0); x.lineTo(w * .26, 0); x.lineTo(w * .14, h); x.lineTo(-w * .02, h); x.fill(); x.fillStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.moveTo(w * .3, 0); x.lineTo(w * .35, 0); x.lineTo(w * .23, h); x.lineTo(w * .18, h); x.fill(); });
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }); MAT.set('streak', m); return m;
}

// ---------- the ink outline (per part: thin parts get thinner lines; widths snapped so few shader programs exist) ----------
const STEPS = [.0006, .0009, .0012, .0016, .002, .0025, .003, .0038, .0046, .0055, .0065, .0078, .009, .0105, .012, .014];
const snapW = w => STEPS.reduce((a, b) => Math.abs(b - w) < Math.abs(a - w) ? b : a);
/** outline every solid part: W = size * k (0.6-1 % of the prop), a part never gets more than 11 % of its own thickness */
function ink(g, size, o = {}) {
  const W = Math.max(.0011, size * (o.k ?? .0075)), list = [];
  g.traverse(m => { if (m.isMesh && !m.isInstancedMesh && !m.userData.isOutline && !m.userData.noOutline) list.push(m); });
  for (const m of list) {
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    if (m.userData.olMesh || (mat?.transparent && (mat.opacity ?? 1) < .99)) continue;
    const w = snapW(m.userData.olw ?? Math.min(W, (m.userData.th ?? size) * .11));
    const h = new THREE.Mesh(m.geometry.userData.hull || m.geometry, outlineMat(OL, w, o.px ?? 1.2));
    h.userData.isOutline = true; h.userData.noPick = true; h.castShadow = false; h.receiveShadow = false; h.renderOrder = m.renderOrder;
    m.add(h); m.userData.olMesh = h;
  }
  return g;
}
/** small flat things (media, pads, calculators): built upright facing +z around the origin; lie flat (face up) unless o.upright */
function lay(g, inner, o, thick, height, flatDefault = true) {
  const flat = o.upright ? false : o.flat ?? flatDefault;
  if (flat) { inner.rotation.x = -PI / 2; inner.position.y = thick / 2; } else inner.position.y = height / 2;
  g.userData.flat = flat; return flat;
}
function screenApi(g, tex, extra = {}) { g.userData.screen = tex; g.userData.draw = fn => { redraw(tex, fn); return g; }; Object.assign(g.userData, extra); return tex; }
const tex = (w, h, fn) => canvasTex(w, h, fn);
const TEXC = new Map();
/** a canvas texture shared by every copy with the same key (labels that never change) */
const ctex = (key, w, h, fn) => { let t = TEXC.get(key); if (!t) { t = canvasTex(w, h, fn); TEXC.set(key, t); } return t; };

// ---------- canvas drawing ----------
const font = (px, w = 800) => `${w} ${Math.round(px)}px Inter, Arial, sans-serif`;
function tx(x, s, X, Y, px, color, o = {}) {
  x.save(); x.font = font(px, o.w ?? 800); x.textAlign = o.align || 'center'; x.textBaseline = 'middle';
  if (o.skew) x.transform(1, 0, -o.skew, 1, o.skew * Y, 0);
  if (o.glow) { x.shadowColor = o.glowColor || color; x.shadowBlur = o.glow; }
  if (o.stroke) { x.lineJoin = 'round'; x.lineWidth = o.sw ?? px * .18; x.strokeStyle = o.stroke; x.strokeText(s, X, Y, o.max); }
  x.fillStyle = color; x.fillText(s, X, Y, o.max); x.restore();
}
function rr(x, X, Y, W, H, r, fill, stroke, lw) { x.beginPath(); x.roundRect(X, Y, W, H, r); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.lineWidth = lw || 2; x.strokeStyle = stroke; x.stroke(); } }
function circ(x, X, Y, r, fill, stroke, lw) { x.beginPath(); x.arc(X, Y, r, 0, TAU); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.lineWidth = lw || 2; x.strokeStyle = stroke; x.stroke(); } }
function scan(x, w, h, a = .08, step = 3) { x.fillStyle = `rgba(0,0,0,${a})`; for (let y = 0; y < h; y += step) x.fillRect(0, y, w, Math.max(1, step / 3)); }
function vign(x, w, h, a = .45) { const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); x.fillStyle = g; x.fillRect(0, 0, w, h); }
function vgrad(x, w, h, a, b, y0 = 0, y1 = h) { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, w, h); }
function glare(x, w, h, a = .1) { x.save(); x.globalAlpha = a; x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(w * .08, 0); x.lineTo(w * .42, 0); x.lineTo(w * .12, h); x.lineTo(-w * .22, h); x.fill(); x.restore(); }
function star(x, X, Y, R, r, n = 5, rot = -PI / 2) { x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + i * PI / n, q = i % 2 ? r : R; x.lineTo(X + Math.cos(a) * q, Y + Math.sin(a) * q); } x.closePath(); }
// seven-segment digits (LED / LCD / VFD counters): X, Y top-left, h digit height; returns the width drawn
const SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '', E: 'adefg', r: 'eg', o: 'cdeg', H: 'bcefg', L: 'def', P: 'abefg', A: 'abcefg', b: 'cdefg', C: 'adef', c: 'deg', d: 'bcdeg', F: 'aefg', n: 'ceg', U: 'bcdef', u: 'cde', t: 'defg', y: 'bcdfg', S: 'acdfg', I: 'bc', O: 'abcdef', G: 'acdef', h: 'cefg', J: 'bcde', _: 'd' };
const SEGP = { a: [0, 0, 1, 0], b: [1, 0, 1, .5], c: [1, .5, 1, 1], d: [0, 1, 1, 1], e: [0, .5, 0, 1], f: [0, 0, 0, .5], g: [0, .5, 1, .5] };
function seg7(x, str, X, Y, h, on, off, o = {}) {
  const w = h * (o.wr ?? .52), t = h * (o.tr ?? .13), gap = h * (o.gap ?? .24), sl = o.slant ?? .1; let cx = X;
  x.save(); x.lineCap = 'round';
  const P = (u, v) => [cx + u * w + (1 - v) * h * sl, Y + v * h];
  for (const ch of String(str)) {
    if (ch === '.' || ch === ',' || ch === ':') {
      x.fillStyle = on; x.shadowColor = on; x.shadowBlur = o.glow ?? t;
      for (const v of ch === ':' ? [.3, .72] : [.97]) { const [px, py] = P(0, v); x.beginPath(); x.arc(px + t * .5, py, t * .6, 0, TAU); x.fill(); }
      cx += t * 2; continue;
    }
    if (!(ch in SEGS)) { x.shadowColor = on; x.shadowBlur = o.glow ?? t; tx(x, ch, cx + w / 2 + h * sl * .5, Y + h / 2, h * 1.08, on, { w: 800 }); x.shadowBlur = 0; cx += w + gap; continue; }
    const lit = SEGS[ch];
    for (const k of 'abcdefg') {
      const isOn = lit.includes(k); if (!isOn && !off) continue;
      const [u0, v0, u1, v1] = SEGP[k], [x0, y0] = P(u0, v0), [x1, y1] = P(u1, v1);
      const L = Math.hypot(x1 - x0, y1 - y0), ix = (x1 - x0) / L * t * .75, iy = (y1 - y0) / L * t * .75;
      x.strokeStyle = isOn ? on : off; x.lineWidth = t; x.shadowColor = isOn ? on : 'rgba(0,0,0,0)'; x.shadowBlur = isOn ? (o.glow ?? t * 1.2) : 0;
      x.beginPath(); x.moveTo(x0 + ix, y0 + iy); x.lineTo(x1 - ix, y1 - iy); x.stroke();
    }
    cx += w + gap;
  }
  x.restore(); return cx - X - gap;
}
const seg7w = (str, h, o = {}) => { let n = 0; for (const ch of String(str)) n += '.,:'.includes(ch) ? h * (o.tr ?? .13) * 2 : h * (o.wr ?? .52) + h * (o.gap ?? .24); return n - h * (o.gap ?? .24); };
/** seven-segment text right-aligned in a box, with dim ghost 8s behind (the LED look) */
function seg7R(x, str, right, Y, h, on, off, digits, o = {}) {
  str = String(str); const ghost = '8'.repeat(Math.max(0, (digits ?? 0) - str.replace(/[.,:]/g, '').length));
  const wAll = seg7w(ghost + str, h, o); if (off && ghost) seg7(x, ghost, right - wAll, Y, h, off, null, o);
  seg7(x, str, right - seg7w(str, h, o), Y, h, on, off, o);
}
// a 5 x 7 LED font (7 rows of 5 bits, hex) for dot-matrix displays
const F57 = { A: '0e11111f111111', B: '1e11111e11111e', C: '0e11101010110e', D: '1c12111111121c', E: '1f10101e10101f', F: '1f10101e101010', G: '0e11101711110f', H: '1111111f111111', I: '0e04040404040e', J: '0702020202120c', K: '11121418141211', L: '1010101010101f', M: '111b1515111111', N: '11111915131111', O: '0e11111111110e', P: '1e11111e101010', Q: '0e11111115120d', R: '1e11111e141211', S: '0f10100e01011e', T: '1f040404040404', U: '1111111111110e', V: '11111111110a04', W: '1111111515150a', X: '11110a040a1111', Y: '1111110a040404', Z: '1f01020408101f',
  0: '0e11131519110e', 1: '040c040404040e', 2: '0e11010204081f', 3: '1f02040201110e', 4: '02060a121f0202', 5: '1f101e0101110e', 6: '0608101e11110e', 7: '1f010204080808', 8: '0e11110e11110e', 9: '0e11110f01020c',
  ' ': '00000000000000', '.': '00000000000c0c', ':': '000c0c000c0c00', '-': '0000001f000000', '!': '04040404040004', '?': '0e110102040004', $: '040f140e051e04', '%': '18190204081303', '+': '0004041f040400', '/': '00010204081000', '#': '0a0a1f0a1f0a0a', ',': '000000000c0408', "'": '0c040800000000', '<': '02040810080402', '>': '08040201020408', '=': '00001f001f0000', '*': '0004150e150400', '♥': '000a1f1f0e0400' };
/** dot-matrix LED text: X, Y top-left, pitch = dot spacing; returns the columns used */
function dotText(x, str, X, Y, pitch, on) {
  let col = 0; x.save(); x.fillStyle = on; x.shadowColor = on; x.shadowBlur = pitch * .9;
  for (const ch of String(str).toUpperCase()) {
    const hx = F57[ch] ?? F57['?'];
    for (let r = 0; r < 7; r++) { const bits = parseInt(hx.slice(r * 2, r * 2 + 2), 16); for (let c = 0; c < 5; c++) if (bits & (16 >> c)) { x.beginPath(); x.arc(X + (col + c + .5) * pitch, Y + (r + .5) * pitch, pitch * .4, 0, TAU); x.fill(); } }
    col += 6;
  }
  x.restore(); return col;
}
// a little original pixel hero (a round teal blob with an antenna) for games, carts and arcade screens
function pixHero(x, X, Y, s, body = '#2fc4b8') {
  const P = ['...yy...', '....d...', '..tttt..', '.tttttt.', 'tWkttWkt', 'tttttttt', 'tttmmttt', '.tt..tt.'], col = { t: body, W: '#ffffff', k: '#16161c', m: shade(body, -.5), d: shade(body, -.5), y: '#ffd84a' };
  P.forEach((row, j) => [...row].forEach((c, i) => { if (c !== '.') { x.fillStyle = col[c]; x.fillRect(X + i * s, Y + j * s, s + .5, s + .5); } }));
}

// ---------- screen contents (original pictures; scenes can draw their own with userData.draw) ----------
function drawTV(x, w, h, show = 'cartoon', seed = 1) {
  if (show === 'off') { const g = x.createRadialGradient(w * .35, h * .3, 0, w * .5, h * .5, w * .75); g.addColorStop(0, '#41514e'); g.addColorStop(1, '#121918'); x.fillStyle = g; x.fillRect(0, 0, w, h); glare(x, w, h, .07); return; }
  if (show === 'static') { const R = rnd(seed); for (let y = 0; y < h; y += 3) for (let i = 0; i < w; i += 4) { const v = 40 + Math.floor(R() * 215); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, y, 4, 3); } }
  else if (show === 'bars') {
    ['#ececec', '#eee23a', '#3ae2e2', '#3ee03a', '#e23ae2', '#e23a3a', '#3a46e2'].forEach((c, i) => { x.fillStyle = c; x.fillRect(i * w / 7, 0, w / 7 + 1, h * .7); });
    x.fillStyle = '#16161a'; x.fillRect(0, h * .7, w, h * .3); tx(x, 'NO SIGNAL', w * .5, h * .85, h * .1, '#f2f2f2');
  } else if (show === 'news') {
    vgrad(x, w, h, '#244a9a', '#0f2350'); circ(x, w * .72, h * .4, h * .2, '#ffd84a'); tx(x, '24°', w * .3, h * .38, h * .2, '#ffffff');
    x.fillStyle = '#e2432f'; x.fillRect(0, h * .72, w * .32, h * .12); tx(x, 'LIVE', w * .16, h * .78, h * .08, '#fff');
    x.fillStyle = '#f2f2f2'; x.fillRect(w * .32, h * .72, w * .68, h * .12); tx(x, 'SUNNY ALL WEEK', w * .64, h * .78, h * .07, '#16213a');
  } else {
    vgrad(x, w, h, '#57b4f0', '#d2efff');
    const sx = w * .74, sy = h * .27, sr = h * .12; x.strokeStyle = '#ffcf3a'; x.lineWidth = h * .028; x.lineCap = 'round';
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; x.beginPath(); x.moveTo(sx + Math.cos(a) * sr * 1.3, sy + Math.sin(a) * sr * 1.3); x.lineTo(sx + Math.cos(a) * sr * 1.7, sy + Math.sin(a) * sr * 1.7); x.stroke(); }
    circ(x, sx, sy, sr, '#ffd84a', OL, h * .012); circ(x, sx - sr * .35, sy - sr * .1, sr * .11, OL); circ(x, sx + sr * .35, sy - sr * .1, sr * .11, OL);
    x.lineWidth = h * .014; x.strokeStyle = OL; x.beginPath(); x.arc(sx, sy + sr * .1, sr * .45, .3, PI - .3); x.stroke();
    for (const [cx, cy, r] of [[.2, .27, .07], [.29, .22, .09], [.38, .27, .065], [.29, .3, .07]]) circ(x, w * cx, h * cy, h * r, '#ffffff');
    x.fillStyle = '#4fa83a'; x.beginPath(); x.moveTo(-10, h); x.quadraticCurveTo(w * .32, h * .42, w * .78, h); x.fill();
    x.fillStyle = '#6cc84a'; x.beginPath(); x.moveTo(w * .3, h); x.quadraticCurveTo(w * .75, h * .5, w * 1.1, h); x.fill();
    pixHero(x, w * .42, h * .58, h * .035);
    tx(x, 'CH 4', w * .06, h * .1, h * .08, '#7dff7a', { align: 'left', glow: 6 });
  }
  scan(x, w, h, .1, 3); vign(x, w, h, .5); glare(x, w, h, .06);
}
function drawTerm(x, w, h, lines, fg = '#5dff7e', bg = '#06180b') {
  x.fillStyle = bg; x.fillRect(0, 0, w, h); const px = h / 10;
  x.save(); x.shadowColor = fg; x.shadowBlur = px * .35;
  lines.forEach((l, i) => tx(x, l, w * .07, px * (1.2 + i * 1.25), px * .82, fg, { align: 'left', w: 600 }));
  x.restore(); scan(x, w, h, .16, 3); vign(x, w, h, .55); glare(x, w, h, .05);
}
// slot reel symbols (all original drawings)
const SYMS = ['seven', 'cherry', 'bar', 'bell', 'lemon', 'star', 'plum', 'diamond'];
function drawSym(x, name, cx, cy, s) {
  x.save(); x.translate(cx, cy); x.lineJoin = 'round'; x.lineCap = 'round'; const lw = s * .045;
  const blob = (X, Y, r, c) => { circ(x, X, Y, r, c, OL, lw); circ(x, X - r * .35, Y - r * .35, r * .25, 'rgba(255,255,255,.55)'); };
  switch (name) {
    case 'seven': tx(x, '7', s * .02, s * .04, s * .86, '#e8322a', { stroke: OL, sw: s * .09, skew: .18 }); tx(x, '7', s * -.01, s * .0, s * .86, 'rgba(255,255,255,.18)', { skew: .18 }); break;
    case 'cherry': x.strokeStyle = '#3d8a2c'; x.lineWidth = s * .05; x.beginPath(); x.moveTo(-s * .2, s * .08); x.quadraticCurveTo(-s * .1, -s * .25, s * .12, -s * .32); x.moveTo(s * .2, s * .14); x.quadraticCurveTo(s * .18, -s * .12, s * .12, -s * .32); x.stroke();
      x.fillStyle = '#5fbf3a'; x.beginPath(); x.ellipse(s * .2, -s * .32, s * .13, s * .06, -.4, 0, TAU); x.fill(); x.lineWidth = lw; x.strokeStyle = OL; x.stroke();
      blob(-s * .2, s * .17, s * .16, '#e2262a'); blob(s * .2, s * .22, s * .16, '#e2262a'); break;
    case 'bar': rr(x, -s * .38, -s * .17, s * .76, s * .34, s * .07, '#1f1f26', OL, lw); tx(x, 'BAR', 0, s * .01, s * .26, '#ffffff'); break;
    case 'bell': x.fillStyle = '#f2b42a'; x.beginPath(); x.moveTo(-s * .3, s * .22); x.quadraticCurveTo(-s * .26, -s * .3, 0, -s * .32); x.quadraticCurveTo(s * .26, -s * .3, s * .3, s * .22); x.closePath(); x.fill(); x.strokeStyle = OL; x.lineWidth = lw; x.stroke();
      rr(x, -s * .34, s * .18, s * .68, s * .08, s * .04, '#e09a1a', OL, lw); circ(x, 0, s * .3, s * .07, '#c27a10', OL, lw); circ(x, 0, -s * .36, s * .05, '#e09a1a', OL, lw); circ(x, -s * .1, -s * .12, s * .06, 'rgba(255,255,255,.5)'); break;
    case 'lemon': x.fillStyle = '#ffe23a'; x.beginPath(); x.ellipse(0, 0, s * .34, s * .24, -.2, 0, TAU); x.fill(); x.strokeStyle = OL; x.lineWidth = lw; x.stroke(); circ(x, -s * .12, -s * .08, s * .07, 'rgba(255,255,255,.55)'); break;
    case 'star': star(x, 0, s * .03, s * .36, s * .16); x.fillStyle = '#ffb21a'; x.fill(); x.strokeStyle = OL; x.lineWidth = lw; x.stroke(); star(x, -s * .02, 0, s * .16, s * .07); x.fillStyle = 'rgba(255,255,255,.45)'; x.fill(); break;
    case 'plum': blob(0, s * .05, s * .27, '#7b3fc4'); x.fillStyle = '#5fbf3a'; x.beginPath(); x.ellipse(s * .12, -s * .26, s * .12, s * .05, -.5, 0, TAU); x.fill(); x.strokeStyle = OL; x.lineWidth = lw; x.stroke(); break;
    case 'diamond': x.beginPath(); x.moveTo(-s * .3, -s * .1); x.lineTo(-s * .16, -s * .28); x.lineTo(s * .16, -s * .28); x.lineTo(s * .3, -s * .1); x.lineTo(0, s * .3); x.closePath(); x.fillStyle = '#5fd8f2'; x.fill(); x.strokeStyle = OL; x.lineWidth = lw; x.stroke();
      x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.moveTo(-s * .16, -s * .28); x.lineTo(0, -s * .1); x.lineTo(-s * .3, -s * .1); x.fill(); break;
  }
  x.restore();
}

// =====================================================================================================================
// RETRO TECH
// =====================================================================================================================
def('crt_tv', ['retro', 'screen', 'home'], 'chunky 80s CRT television (0.6 m wide, sits on a table or the floor): bulging glass screen, knobs, rabbit-ear antennas. o.color, o.show: cartoon | bars | news | static | off. userData.screen/draw(fn)/show(name)', o => {
  const g = new THREE.Group(), col = o.color || '#9b6a42', body = plastic(col, { rough: .55 }), trim = plastic(shade(col, -.32)), dark = matte('#2c2a2c'), W = .6, H = .46, D = .42, y0 = .02, cy = y0 + H / 2;
  box(g, W, H, D, body, [0, cy, 0], { r: .05 });
  box(g, .42, .34, .2, trim, [0, cy + .01, -D / 2 - .05], { r: .07 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, .018, .022, .024, dark, [sx * .23, .012, sz * .15]);
  box(g, .44, .35, .03, dark, [-.065, cy, D / 2], { r: .035 });
  const t = tex(384, 288, (x, w, h) => drawTV(x, w, h, o.show, o.seed));
  mk(g, bulgeGeo(.39, .3, .014), glowMat(t, 1.1), [-.065, cy, D / 2 + .016]).userData.noOutline = true;
  box(g, .1, .37, .02, trim, [.228, cy, D / 2 + .003], { r: .012 });
  const knob = plastic('#e9e2cf');
  for (const y of [.1, .015]) { cyl(g, .028, .03, .03, dark, [.228, cy + y, D / 2 + .022], { rot: AX }); box(g, .007, .03, .007, knob, [.228, cy + y + .01, D / 2 + .038], { noOl: true }); }
  for (let i = 0; i < 5; i++) box(g, .066, .007, .006, dark, [.228, cy - .07 - i * .018, D / 2 + .014], { noOl: true });
  decal(g, .1, .022, ctex('crt-brand' + col, 128, 28, (x, w, h) => { x.fillStyle = shade(col, -.32); x.fillRect(0, 0, w, h); tx(x, 'VIEWMAX', w / 2, h / 2, h * .62, '#e8d9b0'); }), [-.065, y0 + .03, D / 2 + .001]);
  ball(g, .045, dark, [0, y0 + H, -.08], [1, .45, 1]);
  const ant = chrome();
  for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * .012, y0 + H + .015, -.08); a.rotation.set(-.18, 0, -s * .52); rod(a, [0, 0, 0], [0, .42, 0], .0045, ant); ball(a, .01, ant, [0, .42, 0]); g.add(a); }
  screenApi(g, t, { show: name => redraw(t, (x, w, h) => drawTV(x, w, h, name)), top: y0 + H });
  if (o.show === 'static') g.userData.update = tt => redraw(t, (x, w, h) => drawTV(x, w, h, 'static', Math.floor(tt * 30)));
  return ink(g, .6);
});

def('retro_computer', ['retro', 'screen', 'office'], 'beige 80s desktop computer: case with floppy drive, CRT monitor with green text, keyboard and mouse (0.5 m wide, sits on a desk). o.lines: screen text lines. userData.screen/draw(fn)/type(lines)', o => {
  const g = new THREE.Group(), beige = plastic('#e4d8bc', { rough: .6 }), beigeD = plastic('#c9b993', { rough: .6 }), dark = matte('#3a3a3e');
  box(g, .48, .13, .38, beige, [0, .065, -.06], { r: .02 });
  box(g, .16, .046, .008, beigeD, [.12, .07, .133], { r: .004 }); box(g, .12, .01, .006, dark, [.12, .075, .138], { noOl: true }); box(g, .022, .009, .006, beigeD, [.165, .057, .138], { noOl: true });
  ball(g, .0055, glow('#4dff6a', 2), [-.18, .07, .132], null, { noOl: true });
  decal(g, .1, .02, ctex('pc-badge', 160, 32, (x, w, h) => { x.fillStyle = '#e4d8bc'; x.fillRect(0, 0, w, h); tx(x, 'PIXO PC', w * .5, h * .55, h * .7, '#5a4a32'); }), [-.12, .09, .1305]);
  box(g, .22, .02, .2, beigeD, [0, .14, -.06], { r: .008 });
  box(g, .4, .33, .3, beige, [0, .315, -.06], { r: .035 });
  box(g, .3, .25, .17, beigeD, [0, .31, -.27], { r: .06 });
  box(g, .33, .265, .02, beigeD, [0, .325, .09], { r: .02 });
  const t = tex(400, 300, (x, w, h) => drawTerm(x, w, h, o.lines || ['PIXO-DOS 2.1', '', 'READY.', '> RUN HELLO', 'HELLO, WORLD!', '> _']));
  mk(g, bulgeGeo(.29, .218, .01), glowMat(t, 1.15), [0, .327, .101]).userData.noOutline = true;
  ball(g, .005, glow('#ffb43a', 2), [.15, .18, .1], null, { noOl: true });
  box(g, .44, .032, .15, beige, [0, .016, .29], { r: .012 });
  const keyG = rboxGeo(.025, .014, .025, .006, 1), km = [plastic('#efe6d0'), plastic('#b9a986')];
  for (const k of [0, 1]) {
    const inst = new THREE.InstancedMesh(keyG, km[k], 60); inst.userData.noOutline = true; let n = 0; const m4 = new THREE.Matrix4();
    for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) { const dark2 = (c === 0 || c === 13 || (r === 0 && (c < 4 || c > 9))); if (+dark2 !== k) continue; if (r === 0 && c >= 4 && c <= 9) continue; m4.makeTranslation(-.195 + c * .03, .036, .335 - r * .03); inst.setMatrixAt(n++, m4); }
    inst.count = n; g.add(inst);
  }
  box(g, .17, .014, .025, km[0], [0, .036, .335], { noOl: true });
  ball(g, .028, beige, [.31, .017, .3], [1, .55, 1.4]); box(g, .004, .006, .03, dark, [.31, .03, .32], { noOl: true });
  tube(g, 'pc-mouse', [[.31, .012, .26], [.31, .01, .19], [.27, .02, .1], [.23, .03, .07]], .004, dark);
  screenApi(g, t, { type: lines => redraw(t, (x, w, h) => drawTerm(x, w, h, lines)), top: .48 });
  return ink(g, .5);
});

def('floppy_disk', ['retro', 'handheld', 'office'], '3.5 inch floppy disk (9.4 cm; lies flat, o.upright stands it): metal shutter, handwritten label. o.color, o.text', o => {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const W = .094, T = .0055, col = o.color || '#2c3e66';
  box(inner, W, W, T, plastic(col), [0, 0, 0], { r: .0024 });
  box(inner, .05, .031, T + .0014, chrome('#cfd6dc'), [.006, W / 2 - .0175, 0], { r: .001 });
  box(inner, .012, .02, T + .002, matte('#2a2a30'), [.017, W / 2 - .017, 0], { noOl: true, r: .001 });
  box(inner, .007, .007, T + .0008, matte('#1d1d22'), [-W / 2 + .008, -W / 2 + .008, 0], { noOl: true, r: .001 });
  const lab = ctex('floppy:' + (o.text || 'GAMES 2') + (o.band || ''), 256, 190, (x, w, h) => { x.fillStyle = '#f6f1e2'; x.fillRect(0, 0, w, h); x.fillStyle = o.band || '#e2432f'; x.fillRect(0, 0, w, h * .16); x.strokeStyle = '#9bb6d8'; x.lineWidth = 2; for (let i = 1; i < 5; i++) { x.beginPath(); x.moveTo(8, h * .2 + i * h * .16); x.lineTo(w - 8, h * .2 + i * h * .16); x.stroke(); } tx(x, o.text || 'GAMES 2', w / 2, h * .52, h * .22, '#253a7a', { w: 600 }); });
  decal(inner, .076, .056, lab, [0, -.014, T / 2 + .0004]);
  lay(g, inner, o, T, W); g.userData.grip = { at: [0, g.userData.flat ? T / 2 : W / 2, 0], rot: [0, 0, 0] };
  return ink(g, .094);
});

def('cassette_tape', ['retro', 'handheld', 'music'], 'audio cassette (10 cm; lies flat, o.upright stands it): label with handwriting, window with two white hubs. o.color shell, o.text', o => {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const W = .102, H = .064, T = .013, col = o.color || '#e9e4da';
  box(inner, W, H, T, plastic(col), [0, 0, 0], { r: .003 });
  const face = ctex('cas:' + col + (o.text || 'MIX 90') + (o.band || ''), 320, 200, (x, w, h) => {
    rr(x, w * .05, h * .06, w * .9, h * .58, 10, '#f7f2e4'); x.fillStyle = o.band || '#f08a2a'; x.fillRect(w * .05, h * .06, w * .9, h * .12); x.fillStyle = '#3f6fd1'; x.fillRect(w * .05, h * .18, w * .9, h * .04);
    tx(x, o.text || 'MIX 90', w * .5, h * .27, h * .1, '#2a2a6a', { w: 600 });
    rr(x, w * .25, h * .34, w * .5, h * .22, 12, '#2a2622'); circ(x, w * .36, h * .45, h * .085, '#6b4a32'); circ(x, w * .64, h * .45, h * .06, '#6b4a32');
    for (const cx of [.32, .68]) { circ(x, w * cx, h * .45, h * .062, '#ffffff', OL, 3); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; x.fillStyle = OL; x.fillRect(w * cx + Math.cos(a) * h * .035 - 2, h * .45 + Math.sin(a) * h * .035 - 2, 4, 4); } }
    x.fillStyle = shade(col, -.18); x.beginPath(); x.moveTo(w * .22, h * .97); x.lineTo(w * .28, h * .74); x.lineTo(w * .72, h * .74); x.lineTo(w * .78, h * .97); x.fill();
    for (const cx of [.36, .45, .55, .64]) circ(x, w * cx, h * .86, h * .03, '#2a2622');
  });
  decal(inner, W - .004, H - .003, face, [0, 0, T / 2 + .0004]); decal(inner, W - .004, H - .003, face, [0, 0, -T / 2 - .0004], { rot: [0, PI, 0] });
  lay(g, inner, o, T, H); g.userData.grip = { at: [0, g.userData.flat ? T / 2 : H / 2, 0], rot: [0, 0, 0] };
  return ink(g, .1);
});

def('vhs_tape', ['retro', 'handheld', 'home'], 'VHS video tape (19 cm; lies flat, o.upright stands it): black shell, window with reels, handwritten label + spine label. o.text', o => {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const W = .188, H = .104, T = .026, txt = o.text || 'HOME VIDEO';
  box(inner, W, H, T, plastic('#26262b', { rough: .5 }), [0, 0, 0], { r: .004 });
  const face = ctex('vhs:' + txt + (o.band || ''), 400, 222, (x, w, h) => {
    x.fillStyle = '#2b2b31'; x.fillRect(0, 0, w, h); rr(x, w * .2, h * .1, w * .6, h * .28, 6, '#141418'); circ(x, w * .33, h * .24, h * .1, '#4a3424'); circ(x, w * .67, h * .24, h * .07, '#4a3424');
    for (const cx of [.33, .67]) circ(x, w * cx, h * .24, h * .045, '#e8e8e8');
    rr(x, w * .12, h * .46, w * .76, h * .42, 6, '#f6f1e2'); x.fillStyle = o.band || '#3f6fd1'; x.fillRect(w * .12, h * .46, w * .76, h * .08);
    tx(x, txt, w * .5, h * .68, h * .14, '#232a5a', { w: 600 }); tx(x, 'SP 120', w * .78, h * .83, h * .06, '#7a7a8a', { w: 600 });
    for (const [cx, cy] of [[.05, .1], [.95, .1], [.05, .9], [.95, .9]]) circ(x, w * cx, h * cy, h * .025, '#55555e');
  });
  decal(inner, W - .004, H - .004, face, [0, 0, T / 2 + .0005]);
  decal(inner, W * .8, T * .62, ctex('vhs-sp:' + txt, 400, 56, (x, w, h) => { x.fillStyle = '#f6f1e2'; x.fillRect(0, 0, w, h); tx(x, txt, w / 2, h / 2, h * .55, '#232a5a', { w: 600 }); }), [0, -H / 2 - .0005, 0], { rot: [PI / 2, 0, 0] });
  lay(g, inner, o, T, H); g.userData.grip = { at: [0, g.userData.flat ? T / 2 : H / 2, 0], rot: [0, 0, 0] };
  return ink(g, .19);
});

/** foam headphones: band arc up, cups facing +-x, cups rest on y = 0 */
function headphones(par, col, p, yaw = 0, flat = false) {
  const o = new THREE.Group(); o.position.set(...p); o.rotation.y = yaw; par.add(o);
  const h = new THREE.Group(); o.add(h); if (flat) { h.rotation.x = -PI / 2; h.position.y = .034; }
  const band = chrome('#c9d0d8'), foam = matte(col), cupM = plastic('#3a3d44');
  tor(h, .085, .006, band, [0, .034, 0], { arc: PI, rs: 8, ts: 32 });
  for (const s of [-1, 1]) { cyl(h, .03, .03, .016, cupM, [s * .085, .034, 0], { rot: AZ }); cyl(h, .034, .034, .02, foam, [s * .07, .034, 0], { rot: AZ, b: .009 }); }
  return o;
}
def('headphones', ['retro', 'handheld', 'music'], 'retro foam headphones (17 cm): metal band, orange foam pads; stands on its pads, band up. o.color pads', o => {
  const g = new THREE.Group(); headphones(g, o.color || '#f08a2a', [0, 0, 0]); g.userData.grip = { at: [0, .115, 0], rot: [0, 0, 0] };
  return ink(g, .17);
});

def('tape_player', ['retro', 'handheld', 'music'], 'portable cassette player with a tape in its window, play buttons on top and foam headphones lying beside it (player 14 cm tall). o.color', o => {
  const g = new THREE.Group(), col = o.color || '#f0b429', dark = plastic('#2c2e34'), W = .115, H = .145, T = .04;
  box(g, W, H, T, plastic(col), [0, H / 2, 0], { r: .012 });
  box(g, W - .018, H * .52, .006, dark, [0, H * .6, T / 2 + .001], { r: .006 });
  decal(g, .086, .056, ctex('tp-win', 256, 168, (x, w, h) => { x.fillStyle = '#1b1c22'; x.fillRect(0, 0, w, h); rr(x, w * .08, h * .1, w * .84, h * .8, 10, '#e9e4da'); x.fillStyle = '#f08a2a'; x.fillRect(w * .08, h * .1, w * .84, h * .14); rr(x, w * .25, h * .38, w * .5, h * .3, 8, '#2a2622'); for (const cx of [.36, .64]) circ(x, w * cx, h * .53, h * .09, '#ffffff', OL, 3); x.fillStyle = 'rgba(120,200,255,.18)'; x.fillRect(0, 0, w, h); glare(x, w, h, .12); }), [0, H * .6, T / 2 + .0045]);
  decal(g, .07, .014, ctex('tp-brand' + col, 160, 32, (x, w, h) => { x.fillStyle = col; x.fillRect(0, 0, w, h); tx(x, 'JOGBEAT', w / 2, h / 2, h * .7, '#2c2e34'); }), [0, H * .2, T / 2 + .0005]);
  const bc = [plastic('#8d939d'), plastic('#8d939d'), plastic('#e2432f'), plastic('#8d939d')];
  bc.forEach((m, i) => box(g, .021, .012, .026, m, [-.036 + i * .024, H + .004, 0], { r: .003 }));
  cyl(g, .013, .013, .007, dark, [W / 2 + .002, H * .38, 0], { rot: AZ });
  box(g, .045, .07, .006, dark, [0, H * .56, -T / 2 - .004], { r: .003 });
  headphones(g, o.pads || '#f08a2a', [.2, 0, .03], -.4, true);
  tube(g, 'tp-wire', [[.03, H + .002, 0], [.06, H + .04, .02], [.12, .09, .06], [.16, .03, .05], [.2, .012, .02]], .0025, dark);
  g.userData.grip = { at: [0, H / 2, 0], rot: [0, 0, 0] };
  return ink(g, .2);
});

def('boombox', ['retro', 'music', 'handheld'], 'big 80s boombox (0.62 m wide): two speakers with chrome rings, tape deck, glowing tuner, carry handle, antenna. o.color body', o => {
  const g = new THREE.Group(), col = o.color || '#3a3d45', body = plastic(col), ch = chrome(), dark = plastic('#1f2025'), W = .62, H = .32, T = .15, cy = .015 + H / 2;
  box(g, W, H, T, body, [0, cy, 0], { r: .035 });
  for (const sx of [-1, 1]) { box(g, .05, .015, .1, dark, [sx * .24, .0075, 0], { r: .006 }); }
  const grille = ctex('bb-grille', 256, 256, (x, w, h) => { x.fillStyle = '#26272c'; x.fillRect(0, 0, w, h); x.fillStyle = '#0f0f13'; for (let j = 0; j < 22; j++) for (let i = 0; i < 22; i++) if (Math.hypot(i - 10.5, j - 10.5) < 11) { x.beginPath(); x.arc(i * 11.6 + 6, j * 11.6 + 6, 3.3, 0, TAU); x.fill(); } });
  for (const sx of [-1, 1]) {
    const sp = [sx * .195, cy - .015, T / 2];
    tor(g, .1, .012, ch, [sp[0], sp[1], sp[2] + .008]);
    cyl(g, .098, .098, .014, dark, [sp[0], sp[1], sp[2] + .002], { rot: AX, noOl: true });
    discDecal(g, .094, grille, [sp[0], sp[1], sp[2] + .0096]);
    ball(g, .032, plastic('#4a4d55'), [sp[0], sp[1], sp[2] + .012], [1, 1, .45]);
  }
  box(g, .16, .105, .01, dark, [0, cy - .045, T / 2 + .002], { r: .008 });
  decal(g, .14, .088, ctex('bb-deck', 256, 160, (x, w, h) => { x.fillStyle = '#18181d'; x.fillRect(0, 0, w, h); rr(x, w * .12, h * .2, w * .76, h * .5, 10, '#e9e4da'); rr(x, w * .3, h * .36, w * .4, h * .2, 6, '#2a2622'); for (const cx of [.4, .6]) circ(x, w * cx, h * .46, h * .07, '#fff'); tx(x, 'AUTO REVERSE', w / 2, h * .84, h * .09, '#9aa0aa'); glare(x, w, h, .1); }), [0, cy - .045, T / 2 + .0075]);
  decal(g, .16, .04, ctex('bb-tuner', 320, 80, (x, w, h) => { x.fillStyle = '#2a1606'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ffb447'; x.lineWidth = 2; for (let i = 0; i <= 20; i++) { x.beginPath(); x.moveTo(w * .06 + i * w * .044, h * .3); x.lineTo(w * .06 + i * w * .044, h * (i % 5 ? .45 : .55)); x.stroke(); } ['88', '92', '96', '100', '104'].forEach((s, i) => tx(x, s, w * .06 + i * w * .22, h * .78, h * .26, '#ffb447', { glow: 6 })); x.fillStyle = '#ff4a2a'; x.fillRect(w * .58, h * .12, 4, h * .6); }), [0, cy + .07, T / 2 + .0005], { glow: 1.2 });
  for (let i = 0; i < 6; i++) box(g, .022, .012, .03, i === 2 ? plastic('#e2432f') : ch, [-.07 + i * .028, .015 + H + .004, .035], { r: .003 });
  tube(g, 'bb-handle', [[-.2, .015 + H - .01, -.01], [-.2, .015 + H + .07, -.01], [-.17, .015 + H + .105, -.01], [.17, .015 + H + .105, -.01], [.2, .015 + H + .07, -.01], [.2, .015 + H - .01, -.01]], .012, ch, { noOl: false });
  rod(g, [.27, .015 + H - .01, -.05], [.36, .015 + H + .3, -.08], .0045, ch);
  decal(g, .11, .02, ctex('bb-brand' + col, 220, 40, (x, w, h) => { x.fillStyle = col; x.fillRect(0, 0, w, h); tx(x, 'BOOMTRON', w / 2, h / 2, h * .66, '#e6e9ee'); }), [0, cy + .115, T / 2 + .0005]);
  g.userData.grip = { at: [0, .015 + H + .105, -.01], rot: [0, 0, 0] };
  return ink(g, .62);
});

/** a game cartridge built upright facing +z, bottom at y = 0 */
function cartridge(par, p, o = {}) {
  const c = new THREE.Group(); c.position.set(...p); par.add(c);
  box(c, .12, .09, .02, plastic(o.color || '#8f949c'), [0, .045, 0], { r: .005 });
  for (let i = 0; i < 4; i++) box(c, .1, .003, .022, plastic('#7a7f87'), [0, .078 + i * .004, 0], { noOl: true, r: .001 });
  decal(c, .09, .056, ctex('cart:' + (o.title || 'SKY HOPPER'), 256, 160, (x, w, h) => { vgrad(x, w, h, '#4aa8f0', '#b8e4ff'); x.fillStyle = '#5fbf3a'; x.beginPath(); x.moveTo(0, h); x.quadraticCurveTo(w * .4, h * .55, w, h * .9); x.lineTo(w, h); x.fill(); pixHero(x, w * .4, h * .42, h * .045); tx(x, o.title || 'SKY HOPPER', w / 2, h * .17, h * .17, '#ffd84a', { stroke: OL, sw: 5 }); }), [0, .04, .0105]);
  return c;
}
def('game_cartridge', ['retro', 'handheld', 'game'], 'retro game cartridge with an original game label (12 cm; lies flat, o.upright stands it). o.title, o.color', o => {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner); cartridge(inner, [0, -.045, 0], o);
  lay(g, inner, o, .02, .09); g.userData.grip = { at: [0, g.userData.flat ? .01 : .07, 0], rot: [0, 0, 0] };
  return ink(g, .12);
});
/** a retro gamepad built upright facing +z, centred */
function gamepadRetro(par, p, o = {}) {
  const c = new THREE.Group(); c.position.set(...p); if (o.rot) c.rotation.set(...o.rot); par.add(c);
  const body = plastic(o.color || '#efe6d0'), face = plastic('#33415e');
  box(c, .11, .056, .026, body, [0, 0, 0], { r: .012 });
  for (const s of [-1, 1]) { cyl(c, .037, .037, .026, body, [s * .058, 0, 0], { rot: AX, b: .009 }); cyl(c, .027, .027, .004, face, [s * .058, 0, .0125], { rot: AX, noOl: true, b: .0015 }); }
  const blk = plastic('#1f1f24'); box(c, .032, .01, .008, blk, [-.058, 0, .016], { r: .002 }); box(c, .01, .032, .008, blk, [-.058, 0, .016], { r: .002 });
  [['#f08a2a', -.012, -.01], ['#2fc4b8', 0, .003], ['#f6c945', .012, .015]].forEach(([col, dx, dy]) => cyl(c, .0072, .0072, .008, glossy(col), [.058 + dx, dy, .0165], { rot: AX }));
  for (const x of [-.008, .008]) box(c, .011, .004, .004, plastic('#8d939d'), [x, -.006, .0145], { r: .0018 });
  return c;
}
def('gamepad_retro', ['retro', 'handheld', 'game'], 'retro dog-bone gamepad (19 cm, original design): cream body, navy pads, d-pad, three coloured buttons (lies flat, o.upright to hold it up to camera). o.color', o => {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner); gamepadRetro(inner, [0, 0, 0], o);
  lay(g, inner, o, .026, .072); g.userData.grip = { at: [0, g.userData.flat ? .013 : .036, 0], rot: [0, 0, 0] };
  return ink(g, .16);
});
def('game_console', ['retro', 'game', 'home'], 'original 90s home console "PIXO 16" (30 cm) with a cartridge in the slot and a corded gamepad in front. o.color', o => {
  const g = new THREE.Group(), dark = plastic(o.color || '#33415e'), light = plastic('#e9dfc6'), blk = plastic('#1f1f24');
  box(g, .3, .07, .22, dark, [0, .035, 0], { r: .022 });
  box(g, .26, .018, .19, light, [0, .074, 0], { r: .008 });
  box(g, .15, .022, .045, dark, [0, .09, -.03], { r: .008 });
  box(g, .125, .006, .024, blk, [0, .1012, -.03], { noOl: true, r: .002 });
  cartridge(g, [0, .07, -.03], { title: o.title });
  box(g, .036, .012, .02, plastic('#f08a2a'), [-.09, .088, .05], { r: .004 }); box(g, .03, .012, .02, dark, [.09, .088, .05], { r: .004 });
  ball(g, .0045, glow('#ff3b30', 2.4), [-.09, .045, .1105], null, { noOl: true });
  for (const x of [-.05, .05]) box(g, .03, .018, .006, blk, [x, .032, .109], { r: .003, noOl: true });
  decal(g, .1, .02, ctex('pixo16', 200, 40, (x, w, h) => { x.fillStyle = '#e9dfc6'; x.fillRect(0, 0, w, h); tx(x, 'PIXO 16', w * .5, h * .55, h * .7, '#2f3440'); x.fillStyle = '#f08a2a'; x.fillRect(w * .02, h * .4, w * .1, h * .2); }), [0, .0832, .06], { rot: UP });
  gamepadRetro(g, [.02, .013, .3], { rot: [-PI / 2, 0, .15] });
  tube(g, 'gc-cable', [[-.05, .032, .112], [-.06, .02, .17], [-.03, .006, .22], [.0, .01, .262]], .003, blk);
  return ink(g, .3);
});

def('joystick', ['retro', 'game', 'handheld'], 'retro arcade-style joystick: black base, chrome stick with a red ball top, red fire button (17 cm base). userData.stick = the stick pivot (rotate it to tilt)', o => {
  const g = new THREE.Group(), blk = plastic('#24252b');
  box(g, .17, .05, .17, blk, [0, .025, 0], { r: .016 });
  box(g, .13, .004, .13, plastic('#3a3d44'), [0, .051, 0], { r: .002, noOl: true });
  const st = new THREE.Group(); st.position.set(-.025, .05, -.01); g.add(st);
  cyl(st, .02, .026, .016, blk, [0, .008, 0]); cyl(st, .007, .008, .1, chrome(), [0, .06, 0]); ball(st, .024, glossy(o.color || '#e2432f'), [0, .118, 0]);
  cyl(g, .019, .021, .016, blk, [.05, .056, .045]); cyl(g, .016, .016, .012, glossy('#e2432f'), [.05, .066, .045]);
  g.userData.stick = st; g.userData.grip = { at: [-.025, .168, -.01], rot: [0, 0, 0] };
  return ink(g, .17);
});

// "COSMO CRUSH": an original space platform hopper - floating platforms, stars to collect, the blob hero mid-jump
function drawArcade(x, w, h, o = {}) {
  vgrad(x, w, h, '#0b0a2e', '#2a145a'); const R = rnd(o.seed ?? 4);
  for (let i = 0; i < 70; i++) { x.fillStyle = R() > .8 ? '#ffe9a0' : '#8fa8ff'; x.fillRect(R() * w, R() * h, 2, 2); }
  circ(x, w * .8, h * .22, h * .1, '#f6e7a8'); circ(x, w * .77, h * .2, h * .02, '#e2cf86'); circ(x, w * .84, h * .26, h * .015, '#e2cf86');
  const plats = [[.08, .8, .34, '#ff4fa3'], [.55, .7, .3, '#4fe0ff'], [.2, .56, .26, '#ffd84a'], [.6, .44, .28, '#7dff6a'], [.12, .32, .24, '#4fe0ff']];
  for (const [px, py, pw, c] of plats) { rr(x, w * px, h * py, w * pw, h * .035, h * .017, c); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(w * px + 4, h * (py + .025), w * pw - 8, h * .01); }
  for (const [sx, sy] of [[.7, .38], [.3, .5], [.22, .26], [.66, .64]]) { star(x, w * sx, h * sy, h * .025, h * .011); x.fillStyle = '#ffd84a'; x.fill(); }
  pixHero(x, w * .38, h * .6, h * .022);
  x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 2; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(w * (.39 + i * .04), h * .8); x.lineTo(w * (.39 + i * .04), h * .76); x.stroke(); }
  x.fillStyle = '#3a3f8a'; x.fillRect(0, h * .93, w, h * .07);
  tx(x, 'SCORE ' + String(o.score ?? 4250).padStart(6, '0'), w * .05, h * .06, h * .05, '#ffffff', { align: 'left', glow: 4 }); tx(x, 'HI 98000', w * .95, h * .06, h * .05, '#ffd84a', { align: 'right', glow: 4 });
  for (let i = 0; i < 3; i++) { const X = w * (.06 + i * .06), Y = h * .965; x.fillStyle = '#ff4f6a'; x.beginPath(); x.arc(X - 4, Y - 2, 4.5, 0, TAU); x.arc(X + 4, Y - 2, 4.5, 0, TAU); x.moveTo(X - 8.5, Y); x.lineTo(X, Y + 9); x.lineTo(X + 8.5, Y); x.fill(); }
  scan(x, w, h, .12, 3); vign(x, w, h, .45);
}
def('arcade_cabinet', ['retro', 'game', 'machine', 'screen', 'arcade'], 'upright arcade cabinet "COSMO CRUSH" (1.78 m, 0.66 m wide): lit marquee, tilted screen, joystick and buttons, coin door, side art. o.color sides, o.title. userData.screen/draw(fn)', o => {
  const g = new THREE.Group(), col = o.color || '#3558c8', side = plastic(col, { rough: .5 }), blk = plastic('#1d1e24'), trim = plastic('#f6c945');
  const prof = [[-.4, 0], [.3, 0], [.3, .78], [.42, .86], [.42, .94], [.2, .985], [.12, 1.46], [.3, 1.52], [.3, 1.78], [-.4, 1.78]];
  const sh = new THREE.Shape(); prof.forEach(([z, y], i) => i ? sh.lineTo(z, y) : sh.moveTo(z, y));
  const sg = exGeo('arcade-side', sh, .03, .008, 4);
  for (const s of [-1, 1]) { const m = mk(g, sg, side, [s * .315, 0, 0], [0, -PI / 2, 0]); m.userData.th = .6; }
  decal(g, .5, .5, ctex('arc-side', 256, 256, (x, w, h) => { x.clearRect(0, 0, w, h); star(x, w * .5, h * .5, w * .45, w * .2, 6); x.fillStyle = '#ffd84a'; x.fill(); x.strokeStyle = OL; x.lineWidth = 6; x.stroke(); tx(x, 'CC', w * .5, h * .52, h * .22, '#e2432f', { stroke: OL, sw: 8 }); }), [-.336, .55, -.05], { rot: [0, -PI / 2, 0], alpha: true });
  decal(g, .5, .5, ctex('arc-side', 256, 256, () => {}), [.336, .55, -.05], { rot: [0, PI / 2, 0], alpha: true });
  const Wi = .6;
  box(g, Wi, .78, .03, plastic(shade(col, -.45)), [0, .39, .285], { r: .008 });
  box(g, .26, .22, .02, chrome('#8d949c'), [0, .52, .303], { r: .01 });
  for (const x of [-.05, .05]) { box(g, .035, .06, .01, plastic('#3a3b43'), [x, .55, .315], { r: .003 }); box(g, .006, .03, .012, glow('#ff6a2a', 2.2), [x, .555, .316], { noOl: true, r: .002 }); }
  const cp = new THREE.Group(); cp.position.set(0, .9, .33); cp.rotation.x = .18; g.add(cp);
  box(cp, Wi + .02, .07, .22, side, [0, 0, 0], { r: .02 });
  decal(cp, Wi - .04, .18, ctex('arc-cp', 300, 90, (x, w, h) => { x.fillStyle = '#1d1e24'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd84a'; x.fillRect(0, h * .9, w, h * .1); tx(x, '1P', w * .2, h * .2, h * .16, '#ffd84a'); tx(x, '2P', w * .8, h * .2, h * .16, '#ffd84a'); }), [0, .0355, 0], { rot: UP });
  for (const [pl, jx] of [[0, -.22], [1, .08]]) {
    cyl(cp, .018, .022, .014, blk, [jx, .043, .01]); cyl(cp, .006, .006, .06, chrome(), [jx, .07, .01]); ball(cp, .02, glossy(pl ? '#3f6fd1' : '#e2432f'), [jx, .1, .01]);
    for (let i = 0; i < 3; i++) cyl(cp, .014, .014, .014, glow(['#ff4fa3', '#ffd84a', '#4fe0ff'][i], .5), [jx + .075 + i * .036, .042, (i === 1 ? -.012 : .004)]);
  }
  const sb = new THREE.Group(); sb.position.set(0, 1.222, .15); sb.rotation.x = -Math.atan2(.08, .475); g.add(sb);
  box(sb, Wi, .5, .04, blk, [0, 0, 0], { r: .01 });
  const t = tex(360, 300, (x, w, h) => drawArcade(x, w, h, o));
  decal(sb, .44, .36, t, [0, .01, .0205], { glow: 1.25, r: .015 });
  box(g, Wi, .07, .2, blk, [0, 1.49, .2], { r: .01 });
  box(g, Wi, .26, .04, side, [0, 1.65, .282], { r: .01 });
  decal(g, Wi - .04, .21, ctex('arc-marq:' + (o.title || 'COSMO CRUSH'), 512, 180, (x, w, h) => { vgrad(x, w, h, '#2a0a5a', '#7a1fa8'); for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,255,255,.6)'; x.fillRect((i * 97) % w, (i * 53) % h, 3, 3); } tx(x, o.title || 'COSMO CRUSH', w / 2, h * .52, h * .34, '#ffd84a', { stroke: '#e2432f', sw: 10, glow: 14, glowColor: '#ff4fa3', skew: .12 }); }), [0, 1.65, .3035], { glow: 1.1 });
  box(g, Wi, .03, .7, blk, [0, 1.765, -.05], { r: .01 });
  box(g, Wi, 1.75, .03, blk, [0, .89, -.385], { r: .01 });
  box(g, Wi + .06, .025, .03, trim, [0, .955, .43], { r: .008 });
  screenApi(g, t, { top: 1.78 });
  return ink(g, 1.78);
});

def('rotary_phone', ['retro', 'home', 'office'], 'classic rotary telephone (22 cm): dome body, finger-wheel dial, handset on the cradle, coiled cord. o.color. userData.handset (lift it off)', o => {
  const g = new THREE.Group(), col = o.color || '#d6372b', body = glossy(col), cream = plastic('#f1e9d6'), dark = plastic(shade(col, -.45));
  box(g, .22, .035, .2, body, [0, .0175, 0], { r: .014 });
  box(g, .2, .08, .17, body, [0, .07, -.012], { r: .036 });
  const dg = new THREE.Group(); dg.position.set(0, .088, .07); dg.rotation.x = -.75; g.add(dg);
  cyl(dg, .062, .064, .012, cream, [0, 0, 0], { rot: AX });
  discDecal(dg, .06, ctex('rot-dial', 256, 256, (x, w, h) => { x.fillStyle = '#f1e9d6'; x.fillRect(0, 0, w, h); for (let i = 0; i < 10; i++) { const a = -PI * .35 - i * TAU / 13, X = w / 2 + Math.cos(a) * w * .36, Y = h / 2 + Math.sin(a) * h * .36; circ(x, X, Y, w * .075, '#2a2622'); tx(x, String((i + 1) % 10), X, Y, w * .07, '#f1e9d6'); } circ(x, w / 2, h / 2, w * .2, '#ffffff', '#c9c0a8', 4); tx(x, '555-0142', w / 2, h / 2, w * .06, '#2a2622', { w: 600 }); }), [0, 0, .0065]);
  box(dg, .006, .025, .01, chrome(), [.05, -.035, .01], { rot: [0, 0, .7], noOl: true });
  for (const s of [-1, 1]) box(g, .03, .03, .03, body, [s * .075, .118, -.02], { r: .01 });
  const hs = new THREE.Group(); hs.position.set(0, .15, -.02); g.add(hs);
  cyl(hs, .019, .019, .17, body, [0, .012, 0], { rot: AZ });
  for (const s of [-1, 1]) cyl(hs, .034, .028, .032, body, [s * .095, -.004, 0]);
  const coil = []; for (let i = 0; i <= 160; i++) { const u = i / 160, a = u * TAU * 16, p = [lerp(-.112, -.1, u), lerp(.13, .025, u) - Math.sin(u * PI) * .03, lerp(-.02, -.1, u) - Math.sin(u * PI) * .02]; coil.push([p[0] + Math.cos(a) * .008, p[1], p[2] + Math.sin(a) * .008]); }
  tube(g, 'rot-coil', coil, .0025, dark, { n: 320, rs: 6 });
  g.userData.handset = hs;
  return ink(g, .22);
});

def('brick_phone', ['retro', 'handheld', 'screen'], 'chunky 80s brick mobile phone (22 cm, stands upright): pull antenna, green LCD, big keypad. userData.screen/draw(fn)/set(text)', o => {
  const g = new THREE.Group(), body = plastic(o.color || '#2f3136'), W = .07, H = .2, T = .045;
  box(g, W, H, T, body, [0, H / 2, 0], { r: .013 });
  decal(g, W - .012, .13, ctex('brick-keys', 140, 260, (x, w, h) => {
    x.fillStyle = '#2f3136'; x.fillRect(0, 0, w, h); const lab = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
    for (let i = 0; i < 12; i++) { const X = 10 + (i % 3) * 42, Y = 64 + Math.floor(i / 3) * 46; rr(x, X, Y + 3, 36, 36, 9, '#16171b'); rr(x, X, Y, 36, 36, 9, '#c9ccd2'); tx(x, lab[i], X + 18, Y + 19, 22, '#2f3136'); }
    rr(x, 10, 12, 54, 36, 9, '#3fae4a'); tx(x, 'SEND', 37, 31, 15, '#fff'); rr(x, 76, 12, 54, 36, 9, '#e2432f'); tx(x, 'END', 103, 31, 15, '#fff');
  }), [0, .07, T / 2 + .0005]);
  box(g, .056, .036, .006, plastic('#1d1e22'), [0, .162, T / 2 + .001], { r: .004 });
  const t = tex(200, 120, (x, w, h) => drawLCD(x, w, h, o.text ?? '555 0142'));
  decal(g, .048, .028, t, [0, .162, T / 2 + .0045], { glow: .75 });
  for (let i = 0; i < 4; i++) box(g, .03, .0025, .002, plastic('#16171b'), [0, .19 - i * .0045 + .002, T / 2 + .0005], { noOl: true });
  cyl(g, .0065, .0075, .075, body, [.02, H + .036, -.008]); ball(g, .009, body, [.02, H + .074, -.008]);
  screenApi(g, t, { set: s => redraw(t, (x, w, h) => drawLCD(x, w, h, s)) });
  g.userData.grip = { at: [0, .07, 0], rot: [0, 0, 0] };
  return ink(g, .24);
});
function drawLCD(x, w, h, s, bg = '#a9c46a', fg = '#1e2a12') { x.fillStyle = bg; x.fillRect(0, 0, w, h); const g2 = x.createLinearGradient(0, 0, 0, h); g2.addColorStop(0, 'rgba(255,255,255,.25)'); g2.addColorStop(1, 'rgba(0,0,0,.15)'); x.fillStyle = g2; x.fillRect(0, 0, w, h); seg7R(x, s, w * .94, h * .25, h * .5, fg, 'rgba(30,42,18,.1)', 0, { glow: 0 }); }

def('pager', ['retro', 'handheld', 'screen'], '90s pager (6 cm, stands upright): dot-matrix LED message window, two buttons, belt clip. o.text. userData.screen/draw(fn)/set(text)', o => {
  const g = new THREE.Group(), body = plastic(o.color || '#2b2c31'), W = .064, H = .046, T = .019;
  box(g, W, H, T, body, [0, H / 2, 0], { r: .007 });
  box(g, .05, .022, .004, plastic('#141519'), [0, .027, T / 2 + .0005], { r: .003 });
  const t = tex(256, 96, (x, w, h) => drawDots(x, w, h, [o.text || 'CALL HOME']));
  decal(g, .046, .018, t, [0, .027, T / 2 + .003], { glow: 1.1 });
  for (const x of [-.014, .014]) box(g, .016, .005, .009, plastic('#5a5d66'), [x, H + .002, 0], { r: .002 });
  box(g, .03, .036, .004, body, [0, .024, -T / 2 - .003], { r: .002 });
  screenApi(g, t, { set: s => redraw(t, (x, w, h) => drawDots(x, w, h, [].concat(s))) });
  g.userData.grip = { at: [0, H / 2, 0], rot: [0, 0, 0] };
  return ink(g, .064);
});
/** a dot-matrix panel: every dot faintly visible, the lines lit (amber by default) */
function drawDots(x, w, h, lines, on = '#ffb02e', off = 'rgba(255,150,50,.1)', bg = '#160c04') {
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  const cols = Math.max(12, ...lines.map(l => String(l).length)) * 6 + 1, rows = lines.length * 9 - 1, p = Math.min(w / (cols + 1), h / (rows + 1));
  const X0 = (w - cols * p) / 2, Y0 = (h - rows * p) / 2;
  x.fillStyle = off; for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { x.beginPath(); x.arc(X0 + (i + .5) * p, Y0 + (j + .5) * p, p * .36, 0, TAU); x.fill(); }
  lines.forEach((l, i) => dotText(x, l, X0 + p, Y0 + i * 9 * p, p, on));
}

def('film_camera', ['retro', 'handheld', 'photo'], '35 mm film SLR camera (15 cm): black body, chrome top plate and prism, big lens. grip in the right hand', o => {
  const g = new THREE.Group(), blk = matte('#2c2c31'), ch = chrome(), W = .15;
  box(g, W, .085, .055, blk, [0, .0425, 0], { r: .012 });
  box(g, W, .022, .055, ch, [0, .091, 0], { r: .008 });
  box(g, .055, .035, .05, blk, [0, .108, 0], { r: .01 });
  box(g, .05, .01, .048, ch, [0, .128, 0], { r: .004 });
  cyl(g, .031, .031, .012, ch, [0, .045, .034], { rot: AX });
  cyl(g, .028, .027, .04, blk, [0, .045, .058], { rot: AX });
  cyl(g, .0295, .0295, .014, plastic('#45464d'), [0, .045, .066], { rot: AX });
  cyl(g, .022, .022, .004, toonMat('#22406e', { rough: .08 }), [0, .045, .079], { rot: AX, noOl: true });
  ball(g, .006, toonMat('#ffffff', { emissive: '#ffffff', ei: .6 }), [-.008, .053, .081], null, { noOl: true });
  cyl(g, .006, .006, .01, ch, [.05, .107, .008]); box(g, .03, .004, .008, ch, [.05, .107, -.012], { rot: [0, .5, 0] });
  for (const s of [-1, 1]) tor(g, .006, .0018, ch, [s * .076, .075, 0], { rot: [0, PI / 2, 0], noOl: true });
  g.userData.grip = { at: [.05, .045, 0], rot: [0, 0, 0] };
  return ink(g, .15);
});

def('instant_camera', ['retro', 'handheld', 'photo'], 'chunky instant camera (14 cm): white body, big lens, flash, a colour stripe; o.photo: true pushes a fresh photo out of the slot. o.color, o.stripe', o => {
  const g = new THREE.Group(), col = o.color || '#f1eee6', body = plastic(col), blk = plastic('#232429');
  box(g, .14, .105, .1, body, [0, .0525, 0], { r: .022 });
  box(g, .1, .085, .028, blk, [0, .055, .056], { r: .016 });
  cyl(g, .033, .033, .016, plastic('#3a3b42'), [0, .052, .072], { rot: AX });
  cyl(g, .022, .022, .006, toonMat('#1f3a66', { rough: .06 }), [0, .052, .081], { rot: AX, noOl: true });
  ball(g, .005, toonMat('#ffffff', { emissive: '#ffffff', ei: .6 }), [-.007, .058, .084], null, { noOl: true });
  box(g, .026, .02, .01, blk, [.045, .092, .05], { r: .004 }); box(g, .04, .018, .006, toonMat('#f4f6f8', { emissive: '#ffffff', ei: .25 }), [-.035, .095, .051], { r: .003 });
  box(g, .012, .105, .003, plastic(o.stripe || '#f08a2a'), [.058, .0525, .0505], { r: .001, noOl: true });
  cyl(g, .009, .009, .007, glossy('#e2432f'), [-.055, .075, .052], { rot: AX });
  box(g, .09, .005, .01, plastic('#1a1a1e'), [0, .012, .05], { noOl: true, r: .002 });
  if (o.photo) { const ph = box(g, .088, .003, .1, plastic('#f7f7f2'), [0, .012, .1], { r: .0012 }); void ph; decal(g, .076, .074, ctex('instant-photo', 128, 128, (x, w, h) => { vgrad(x, w, h, '#2a2f38', '#4a4256'); x.globalAlpha = .4; circ(x, w * .6, h * .4, h * .2, '#d9b38a'); x.globalAlpha = 1; }), [0, .0137, .093], { rot: UP }); }
  g.userData.grip = { at: [0, .05, 0], rot: [0, 0, 0] };
  return ink(g, .14);
});

def('typewriter', ['retro', 'office'], 'manual typewriter (0.4 m wide, sits on a desk): stepped round keys, platen with a typed sheet, return lever. o.color, o.text (sheet text)', o => {
  const g = new THREE.Group(), col = o.color || '#3f6b57', body = plastic(col, { rough: .4 }), blk = plastic('#1f2024'), ch = chrome();
  box(g, .38, .09, .3, body, [0, .045, 0], { r: .03 });
  const deck = box(g, .35, .04, .15, body, [0, .095, .065], { r: .015, rot: [.32, 0, 0] }); void deck;
  const kg = rcylGeo(.0105, .0105, .01, .003, 16), ring = torGeo(.0108, .0022, TAU, 6, 16);
  const ki = new THREE.InstancedMesh(kg, plastic('#f4efe2'), 40), ri = new THREE.InstancedMesh(ring, ch, 40), m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-PI / 2, 0, 0));
  let n = 0; for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) { const p = V(-.13 + c * .029 + (r % 2) * .007, .106 + r * .01, .125 - r * .03); m4.makeTranslation(p.x, p.y, p.z); ki.setMatrixAt(n, m4); m4.compose(V(p.x, p.y + .004, p.z), q, V(1, 1, 1)); ri.setMatrixAt(n++, m4); }
  ki.userData.noOutline = ri.userData.noOutline = true; g.add(ki, ri);
  box(g, .16, .01, .016, plastic('#f4efe2'), [0, .088, .155], { r: .004 });
  box(g, .34, .07, .12, body, [0, .135, -.06], { r: .03 });
  box(g, .46, .02, .045, ch, [0, .168, -.11], { r: .008 });
  cyl(g, .032, .032, .42, blk, [0, .2, -.1], { rot: AZ });
  for (const s of [-1, 1]) cyl(g, .022, .022, .022, blk, [s * .225, .2, -.1], { rot: AZ });
  const sheet = ctex('tw:' + (o.text || ''), 256, 320, (x, w, h) => { x.fillStyle = '#fbf8ef'; x.fillRect(0, 0, w, h); const L = (o.text || 'Dear diary,\nthe machine\nworks again.\n\nIt is 3 a.m.').split('\n'); L.forEach((l, i) => tx(x, l, w * .1, h * .1 + i * h * .075, h * .05, '#2a2a33', { align: 'left', w: 600 })); });
  decal(g, .2, .25, sheet, [0, .31, -.125], { rot: [-.22, 0, 0], double: true });
  tube(g, 'tw-lever', [[-.24, .2, -.08], [-.27, .23, -.05], [-.28, .24, .01], [-.27, .24, .05]], .005, ch, { noOl: false });
  for (const s of [-1, 1]) cyl(g, .028, .028, .012, plastic(s < 0 ? '#2a2a30' : '#b8322a'), [s * .1, .176, -.02]);
  return ink(g, .4);
});

function drawCalc(x, w, h, v) { drawLCD(x, w, h, v, '#b8c69a', '#20261a'); }
def('calculator', ['retro', 'office', 'handheld', 'screen'], 'desktop calculator (16 cm; lies flat, o.upright stands it): LCD with segment digits, grey and orange keys, solar strip. o.value. userData.screen/draw(fn)/set(value)', o => {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const W = .1, H = .16, T = .02;
  box(inner, W, H, T, plastic(o.color || '#3a3d44'), [0, 0, 0], { r: .008 });
  box(inner, .084, .034, .004, plastic('#24262b'), [0, .05, T / 2 + .001], { r: .004 });
  const t = tex(256, 96, (x, w, h) => drawCalc(x, w, h, o.value ?? '0.'));
  decal(inner, .078, .027, t, [0, .05, T / 2 + .0035]);
  decal(inner, .05, .01, ctex('calc-solar', 100, 20, (x, w, h) => { x.fillStyle = '#3a2a22'; x.fillRect(0, 0, w, h); x.strokeStyle = '#5a463a'; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(i * w / 4, 0); x.lineTo(i * w / 4, h); x.stroke(); } }), [.016, .072, T / 2 + .0005]);
  const lab = ['C', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '=', '='];
  const keys = ctex('calc-keys', 220, 220, (x, w, h) => { x.clearRect(0, 0, w, h); for (let i = 0; i < 20; i++) { if (i === 19) continue; const c = i % 4, r = Math.floor(i / 4), X = 8 + c * 52, Y = 8 + r * 42, wide = i === 18; rr(x, X, Y + 4, wide ? 100 : 48, 34, 8, 'rgba(0,0,0,.45)'); rr(x, X, Y, wide ? 100 : 48, 34, 8, i === 0 ? '#e2432f' : c === 3 || wide ? '#f08a2a' : '#d9dce2'); tx(x, lab[i], X + (wide ? 50 : 24), Y + 18, 22, i === 0 || c === 3 || wide ? '#ffffff' : '#2b2d33'); } });
  box(inner, .09, .088, .004, plastic('#2d3036'), [0, -.03, T / 2 + .001], { r: .004, noOl: true });
  decal(inner, .088, .088, keys, [0, -.031, T / 2 + .0034], { alpha: true });
  lay(g, inner, o, T, H); g.userData.grip = { at: [0, g.userData.flat ? T / 2 : H / 2, 0], rot: [0, 0, 0] };
  screenApi(g, t, { set: v => redraw(t, (x, w, h) => drawCalc(x, w, h, v)) });
  return ink(g, .16);
});

def('radio', ['retro', 'home', 'music'], 'vintage wooden tabletop radio (0.38 m wide): cloth grille with slats, glowing round tuning dial, two knobs. o.color wood', o => {
  const g = new THREE.Group(), wood = toonMat(o.color || '#9a5f33', { rough: .5 }), dk = toonMat(shade(o.color || '#9a5f33', -.35)), cream = plastic('#efe4c8');
  box(g, .38, .24, .16, wood, [0, .13, 0], { r: .055 });
  for (const s of [-1, 1]) box(g, .06, .012, .1, dk, [s * .13, .006, 0], { r: .004 });
  decal(g, .2, .16, ctex('radio-cloth', 256, 200, (x, w, h) => { x.fillStyle = '#e3cf9a'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(120,80,30,.25)'; x.lineWidth = 1; for (let i = 0; i < w; i += 4) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); } for (let j = 0; j < h; j += 4) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); } }), [-.065, .14, .0805]);
  for (let i = 0; i < 4; i++) box(g, .012, .17, .012, dk, [-.15 + i * .057, .14, .084], { r: .005 });
  tor(g, .046, .008, chrome('#d9b56a'), [.115, .165, .081]);
  discDecal(g, .044, ctex('radio-dial', 256, 256, (x, w, h) => { const gr = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, '#fff2c8'); gr.addColorStop(1, '#f2c25a'); x.fillStyle = gr; x.fillRect(0, 0, w, h); ['55', '70', '90', '110', '140', '160'].forEach((s, i) => { const a = PI * .85 + i * PI * 1.3 / 5; tx(x, s, w / 2 + Math.cos(a) * w * .34, h / 2 + Math.sin(a) * h * .34, w * .08, '#6a3a12'); }); x.strokeStyle = '#d0302a'; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); x.moveTo(w / 2, h / 2); x.lineTo(w / 2 + w * .3, h * .3); x.stroke(); circ(x, w / 2, h / 2, w * .06, '#6a3a12'); }), [.115, .165, .084], { glow: .9 });
  for (const x of [.075, .155]) cyl(g, .019, .021, .022, cream, [x, .07, .085], { rot: AX });
  decal(g, .07, .016, ctex('radio-brand' + (o.color || ''), 160, 36, (x, w, h) => { x.fillStyle = shade(o.color || '#9a5f33', -.35); x.fillRect(0, 0, w, h); tx(x, 'HUMTONE', w / 2, h / 2, h * .66, '#f2d48a'); }), [.115, .225, .078], { rot: [-.4, 0, 0] });
  return ink(g, .38);
});

def('record_player', ['retro', 'home', 'music'], 'record player (0.44 m wide): wooden base, chrome platter with a spinning record (o.spin false stops it), tonearm on the record. o.label colour. userData.platter', o => {
  const g = new THREE.Group(), wood = toonMat(o.color || '#8a5a34', { rough: .5 }), ch = chrome();
  box(g, .44, .09, .36, wood, [0, .045, 0], { r: .014 });
  box(g, .42, .008, .34, plastic('#2a2a2f'), [0, .092, 0], { r: .003 });
  const pl = new THREE.Group(); pl.position.set(-.05, .096, 0); g.add(pl);
  cyl(pl, .156, .156, .016, ch, [0, .008, 0], { n: 48 });
  cyl(pl, .15, .15, .004, plastic('#141418', { rough: .3 }), [0, .018, 0], { n: 48, noOl: true });
  discDecal(pl, .148, ctex('rec:' + (o.label || '#e2432f'), 512, 512, (x, w, h) => { x.fillStyle = '#141418'; x.fillRect(0, 0, w, h); for (let r = w * .2; r < w * .49; r += 3) { x.strokeStyle = `rgba(255,255,255,${.04 + (r % 9) * .006})`; x.lineWidth = 1; x.beginPath(); x.arc(w / 2, h / 2, r, 0, TAU); x.stroke(); } x.save(); x.globalAlpha = .18; x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(w / 2, h / 2); x.arc(w / 2, h / 2, w * .49, -.5, .1); x.fill(); x.beginPath(); x.moveTo(w / 2, h / 2); x.arc(w / 2, h / 2, w * .49, PI - .5, PI + .1); x.fill(); x.restore(); circ(x, w / 2, h / 2, w * .17, o.label || '#e2432f'); tx(x, 'GROOVE', w / 2, h * .44, w * .045, '#fff'); tx(x, '33', w / 2, h * .57, w * .04, '#fff'); circ(x, w / 2, h / 2, w * .012, '#141418'); }), [0, .0204, 0], { rot: UP });
  cyl(pl, .004, .004, .02, ch, [0, .026, 0]);
  const pv = new THREE.Group(); pv.position.set(.15, .096, -.1); g.add(pv);
  cyl(pv, .022, .026, .026, ch, [0, .013, 0]);
  const arm = new THREE.Group(); arm.position.y = .036; arm.rotation.y = Math.atan2(-.12, .15); pv.add(arm);
  cyl(arm, .0045, .0045, .2, ch, [0, 0, .1], { rot: AX }); box(arm, .02, .01, .03, plastic('#2a2a2f'), [-.006, -.006, .205], { r: .003 }); cyl(arm, .014, .014, .03, plastic('#2a2a2f'), [0, 0, -.035], { rot: AX });
  cyl(g, .015, .015, .012, ch, [.17, .1, .13]); box(g, .03, .008, .018, plastic('#e2432f'), [.12, .098, .14], { r: .003 });
  g.userData.platter = pl; g.userData.top = .1;
  if (o.spin !== false) g.userData.update = t => { pl.rotation.y = -t * 3.49; };
  return ink(g, .44);
});
// =====================================================================================================================
// MODERN GADGETS
// =====================================================================================================================
function statusBar(x, w, h, dark) {
  const c = dark ? '#16161c' : '#ffffff', u = w / 30;
  tx(x, '10:08', u * 2.2, u * 1.9, u * 1.25, c, { align: 'left' });
  rr(x, w - u * 4.2, u * 1.35, u * 2.3, u * 1.1, u * .3, null, c, u * .22); x.fillStyle = c; x.fillRect(w - u * 3.95, u * 1.6, u * 1.5, u * .6);
  for (let i = 0; i < 4; i++) x.fillRect(w - u * 7.6 + i * u * .65, u * 2.35 - i * u * .3, u * .4, u * .3 + i * u * .3);
}
/** phone / tablet screens: home | chat | call | stocks | notify | map | video | off */
function drawPhone(x, w, h, app = 'home', o = {}) {
  const u = w / 30, R = rnd(o.seed ?? 3);
  if (app === 'off') { x.fillStyle = '#0c0d12'; x.fillRect(0, 0, w, h); glare(x, w, h, .07); return; }
  if (app === 'chat') {
    x.fillStyle = '#f4f5f8'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, u * 7.5);
    circ(x, u * 4, u * 5, u * 1.8, o.color || '#f08a2a'); tx(x, o.name || 'Milo', u * 7, u * 5, u * 1.5, '#16161c', { align: 'left' });
    const msgs = o.msgs || [[0, 'did you see it?'], [1, 'see what'], [0, 'the jackpot!!'], [1, 'NO WAY'], [0, '3 sevens. 3!'], [1, 'call me now']];
    let y = u * 10;
    for (const [me, s] of msgs) { x.font = font(u * 1.35, 600); const tw = Math.min(w * .66, x.measureText(s).width + u * 2.4), X = me ? w - tw - u * 1.5 : u * 1.5; rr(x, X, y, tw, u * 3, u * 1.4, me ? '#3f7dff' : '#e3e5ea'); tx(x, s, X + u * 1.2, y + u * 1.55, u * 1.35, me ? '#ffffff' : '#16161c', { align: 'left', w: 600 }); y += u * 4.1; }
    rr(x, u * 1.5, h - u * 5.5, w - u * 3, u * 3, u * 1.5, '#ffffff', '#d5d8de', u * .15); statusBar(x, w, h, true); return;
  }
  if (app === 'call') {
    vgrad(x, w, h, '#2b3a66', '#120f22'); circ(x, w / 2, h * .3, w * .2, o.color || '#f08a2a'); tx(x, (o.name || 'MOM').slice(0, 1), w / 2, h * .3, w * .2, '#ffffff');
    tx(x, o.name || 'MOM', w / 2, h * .47, u * 2.6, '#ffffff'); tx(x, o.sub || 'calling...', w / 2, h * .52, u * 1.4, 'rgba(255,255,255,.7)', { w: 600 });
    circ(x, w * .28, h * .82, u * 3.2, '#ff4a3d'); circ(x, w * .72, h * .82, u * 3.2, '#34c759'); statusBar(x, w, h); return;
  }
  if (app === 'stocks') {
    x.fillStyle = '#0d1117'; x.fillRect(0, 0, w, h); tx(x, o.name || 'PIXO', u * 2, h * .12, u * 2.2, '#ffffff', { align: 'left' });
    const up = (o.change ?? 12.4) >= 0, col = up ? '#3ddc84' : '#ff5a4a';
    tx(x, (up ? '+' : '') + (o.change ?? 12.4) + '%', u * 2, h * .18, u * 2.8, col, { align: 'left' });
    x.strokeStyle = col; x.lineWidth = u * .5; x.lineJoin = 'round'; x.beginPath(); let v = .5;
    for (let i = 0; i <= 24; i++) { v += (R() - (up ? .38 : .62)) * .08; v = clamp(v, .05, .95); x.lineTo(u * 1.5 + i * (w - u * 3) / 24, h * .65 - v * h * .3); } x.stroke();
    statusBar(x, w, h); return;
  }
  if (app === 'map') {
    x.fillStyle = '#e9efe3'; x.fillRect(0, 0, w, h); x.fillStyle = '#bfe0a8'; x.fillRect(w * .55, h * .1, w * .4, h * .2); x.fillStyle = '#a8d4f0'; x.beginPath(); x.ellipse(w * .2, h * .75, w * .3, h * .12, .3, 0, TAU); x.fill();
    x.strokeStyle = '#ffffff'; x.lineWidth = u * 1.4; for (const [a, b, c, d] of [[0, .35, 1, .45], [.4, 0, .5, 1], [0, .7, 1, .6], [.8, 0, .7, 1]]) { x.beginPath(); x.moveTo(a * w, b * h); x.lineTo(c * w, d * h); x.stroke(); }
    x.strokeStyle = '#3f7dff'; x.lineWidth = u * .8; x.beginPath(); x.moveTo(w * .15, h * .36); x.lineTo(w * .45, h * .4); x.lineTo(w * .47, h * .62); x.stroke();
    circ(x, w * .47, h * .6, u * 1.8, '#ff3b30', '#ffffff', u * .4); statusBar(x, w, h, true); return;
  }
  if (app === 'video') {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h); const vh = w * .5625, y0 = h * .3;
    x.save(); x.translate(0, y0); x.beginPath(); x.rect(0, 0, w, vh); x.clip(); drawTV(x, w, vh, 'cartoon'); x.restore();
    x.fillStyle = '#ff3b30'; x.fillRect(0, y0 + vh, w * .4, u * .5); x.fillStyle = '#444'; x.fillRect(w * .4, y0 + vh, w * .6, u * .5); statusBar(x, w, h); return;
  }
  // home / notify: wallpaper, clock, icons
  vgrad(x, w, h, o.wall?.[0] || '#5a5cff', o.wall?.[1] || '#ff7ab8');
  circ(x, w * .8, h * .55, w * .5, 'rgba(255,255,255,.08)'); circ(x, w * .1, h * .3, w * .35, 'rgba(255,255,255,.07)');
  if (app === 'notify') {
    tx(x, '10:08', w / 2, h * .2, w * .22, '#ffffff', { w: 600 }); tx(x, 'Tuesday 14', w / 2, h * .29, u * 1.5, '#ffffff', { w: 600 });
    rr(x, u * 1.5, h * .38, w - u * 3, u * 7, u * 1.6, 'rgba(255,255,255,.9)'); rr(x, u * 2.6, h * .38 + u * 1.1, u * 2.4, u * 2.4, u * .6, o.color || '#34c759');
    tx(x, o.title || 'BANK', u * 6, h * .38 + u * 2.3, u * 1.3, '#16161c', { align: 'left' }); tx(x, o.body || 'You received $2,000', u * 2.6, h * .38 + u * 5, u * 1.35, '#16161c', { align: 'left', w: 600, max: w - u * 5 });
    statusBar(x, w, h); return;
  }
  tx(x, '10:08', w / 2, h * .13, w * .2, '#ffffff', { w: 600 });
  const cols = w / h > .6 ? 5 : 4, sz = w / (cols + 1.4), gap = (w - cols * sz) / (cols + 1), pal = ['#ff5a4a', '#ffb02e', '#34c759', '#3f7dff', '#a052ff', '#ff4fa3', '#2fc4b8', '#ffd84a'];
  for (let i = 0; i < cols * 4; i++) { const X = gap + (i % cols) * (sz + gap), Y = h * .24 + Math.floor(i / cols) * (sz + gap * 1.6); rr(x, X, Y, sz, sz, sz * .26, pal[Math.floor(R() * pal.length)]); const k = Math.floor(R() * 3); x.fillStyle = 'rgba(255,255,255,.9)'; if (k === 0) circ(x, X + sz / 2, Y + sz / 2, sz * .22, '#ffffff'); else if (k === 1) x.fillRect(X + sz * .3, Y + sz * .3, sz * .4, sz * .4); else { star(x, X + sz / 2, Y + sz / 2, sz * .26, sz * .11); x.fill(); } }
  rr(x, gap * .6, h - sz - gap * 2.2, w - gap * 1.2, sz + gap * 1.2, sz * .35, 'rgba(255,255,255,.25)');
  for (let i = 0; i < cols; i++) rr(x, gap + i * (sz + gap), h - sz - gap * 1.6, sz, sz, sz * .26, pal[(i * 3) % pal.length]);
  statusBar(x, w, h);
}
/** a phone-like slab: body, round-cornered screen, camera bump; built upright facing +z around the origin */
function slabDevice(par, W, H, T, r, col, app, o, res = 300) {
  const bev = Math.min(.0025, T * .3);
  const body = mk(par, exGeo(`slab${q4(W)},${q4(H)},${q4(T)},${q4(r)}`, rrShape(W - 2 * bev, H - 2 * bev, r - bev), T, bev, 10), plastic(col, { rough: .35 })); body.userData.th = W;
  const t = tex(res, Math.round(res * H / W), (x, w, h) => drawPhone(x, w, h, app, o));
  decal(par, W - T * .55 - .004, H - T * .55 - .004, t, [0, 0, T / 2 + .0006], { glow: 1.15, r: Math.max(.001, r - .003) });
  return t;
}
def('smartphone', ['modern', 'handheld', 'screen'], 'smartphone (17 cm, stands upright; o.flat lies screen up): round-cornered glowing screen. o.app: home | chat | call | stocks | notify | map | video | off (+ o.name, o.msgs, o.title, o.body, o.change). userData.screen/draw(fn)/app(name, o)', o => {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const W = .084, H = .17, T = .011, col = o.color || '#23252c';
  const t = slabDevice(inner, W, H, T, .013, col, o.app || 'home', o);
  box(inner, .032, .032, .004, plastic(shade(col, .12)), [-.019, .058, -T / 2 - .0015], { r: .007 });
  for (const [x, y] of [[-.026, .065], [-.012, .065], [-.026, .051]]) cyl(inner, .0045, .0045, .003, plastic('#0d0e12'), [x, y, -T / 2 - .0034], { rot: AX, noOl: true });
  box(inner, .002, .022, .004, plastic(col), [W / 2 + .0006, .035, 0], { r: .0008, noOl: true });
  lay(g, inner, o, T, H, false);
  g.userData.grip = { at: [0, g.userData.flat ? T / 2 : H * .35, 0], rot: [0, 0, 0] };
  screenApi(g, t, { app: (a, oo = {}) => redraw(t, (x, w, h) => drawPhone(x, w, h, a, { ...o, ...oo })) });
  return ink(g, .17);
});
def('tablet', ['modern', 'handheld', 'screen', 'office'], 'tablet (26 cm, stands upright; o.flat lies screen up). o.app as smartphone (default video). userData.screen/draw(fn)/app(name, o)', o => {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const W = .19, H = .26, T = .009;
  const t = slabDevice(inner, W, H, T, .016, o.color || '#2a2c33', o.app || 'video', o, 420);
  box(inner, .022, .022, .003, plastic('#3a3d45'), [-.075, .11, -T / 2 - .001], { r: .006 });
  lay(g, inner, o, T, H, false);
  g.userData.grip = { at: [0, g.userData.flat ? T / 2 : H * .4, 0], rot: [0, 0, 0] };
  screenApi(g, t, { app: (a, oo = {}) => redraw(t, (x, w, h) => drawPhone(x, w, h, a, { ...o, ...oo })) });
  return ink(g, .26);
});

function drawLaptop(x, w, h, app = 'chart', o = {}) {
  const u = w / 40;
  if (app === 'code') {
    x.fillStyle = '#1b1f2a'; x.fillRect(0, 0, w, h); x.fillStyle = '#141720'; x.fillRect(0, 0, w * .18, h);
    const cols = ['#ff7ab8', '#7dd3fc', '#fde68a', '#86efac', '#c4b5fd', '#e5e7eb'], R = rnd(o.seed ?? 9);
    for (let i = 0; i < 16; i++) { let X = w * .22 + (i % 4 === 0 ? 0 : u * 2 * (1 + (i % 3))); const y = u * 2.5 + i * u * 1.6; for (let k = 0; k < 3; k++) { const L = u * (2 + R() * 6); x.fillStyle = cols[Math.floor(R() * cols.length)]; x.fillRect(X, y, L, u * .7); X += L + u * .7; } }
    return;
  }
  if (app === 'video') {
    x.fillStyle = '#16181f'; x.fillRect(0, 0, w, h); const pal = ['#f08a2a', '#3f7dff', '#34c759', '#a052ff'];
    for (let i = 0; i < 4; i++) { const X = (i % 2) * w / 2 + u, Y = Math.floor(i / 2) * h / 2 + u, W2 = w / 2 - u * 2, H2 = h / 2 - u * 2; rr(x, X, Y, W2, H2, u, '#2a2e3a'); circ(x, X + W2 / 2, Y + H2 * .62, H2 * .42, pal[i]); circ(x, X + W2 / 2, Y + H2 * .38, H2 * .22, '#f6d1a6'); }
    return;
  }
  x.fillStyle = '#f3f4f7'; x.fillRect(0, 0, w, h); x.fillStyle = '#dfe2e8'; x.fillRect(0, 0, w, u * 2.4);
  for (let i = 0; i < 3; i++) circ(x, u * (1.4 + i * 1.4), u * 1.2, u * .5, '#a9aeb8');
  tx(x, o.title || 'SALES', u * 2, u * 5, u * 1.8, '#16161c', { align: 'left' });
  const vals = o.values || [3, 4, 3.5, 5, 6.5, 8], mx = Math.max(...vals);
  vals.forEach((v, i) => { const bw = (w - u * 8) / vals.length, X = u * 4 + i * bw, bh = (h - u * 12) * v / mx; rr(x, X + bw * .15, h - u * 3 - bh, bw * .7, bh, u * .5, i === vals.length - 1 ? '#34c759' : '#3f7dff'); });
}
def('laptop', ['modern', 'screen', 'office'], 'open laptop (34 cm wide, on a desk): silver body, dark keyboard, glowing screen. o.app: chart | code | video, o.open degrees (105). userData.lid (hinge), open(deg), screen/draw(fn)/app(name)', o => {
  const g = new THREE.Group(), body = plastic(o.color || '#c3c8cf', { rough: .35 });
  box(g, .34, .018, .24, body, [0, .009, 0], { r: .007 });
  decal(g, .3, .11, ctex('lap-keys', 300, 110, (x, w, h) => { x.fillStyle = '#b8bec6'; x.fillRect(0, 0, w, h); for (let r = 0; r < 5; r++) for (let c = 0; c < 14; c++) rr(x, 4 + c * 21.2, 4 + r * 21, 18, 17, 3, '#2a2d34'); rr(x, 4 + 4 * 21.2, 4 + 4 * 21, 18 + 5 * 21.2, 17, 3, '#2a2d34'); }), [0, .0182, -.035], { rot: UP });
  decal(g, .1, .06, ctex('lap-pad', 64, 40, (x, w, h) => { rr(x, 1, 1, w - 2, h - 2, 6, '#b3b9c1', '#a5abb3', 2); }), [0, .0182, .068], { rot: UP });
  const lid = new THREE.Group(); lid.position.set(0, .018, -.118); g.add(lid);
  box(lid, .34, .23, .01, body, [0, .115, -.005], { r: .004 });
  decal(lid, .332, .222, ctex('lap-bezel', 8, 8, (x, w, h) => { x.fillStyle = '#16171c'; x.fillRect(0, 0, w, h); }), [0, .115, .0006], { r: .008 });
  const t = tex(480, 300, (x, w, h) => drawLaptop(x, w, h, o.app, o));
  decal(lid, .31, .194, t, [0, .118, .0012], { glow: 1.1 });
  discDecal(lid, .02, ctex('lap-logo', 64, 64, (x, w, h) => { x.fillStyle = '#dfe3e8'; x.fillRect(0, 0, w, h); star(x, w / 2, h / 2, w * .4, w * .17); x.fillStyle = '#9aa2ad'; x.fill(); }), [0, .12, -.0103], { rot: [0, PI, 0] });
  const open = deg => { lid.rotation.x = PI / 2 - deg * PI / 180; return g; };
  open(o.open ?? 105);
  screenApi(g, t, { lid, open, app: (a, oo = {}) => redraw(t, (x, w, h) => drawLaptop(x, w, h, a, { ...o, ...oo })), top: .018 });
  return ink(g, .34);
});

function drawWatch(x, w, h, o = {}) {
  x.fillStyle = '#05060a'; x.fillRect(0, 0, w, h); const c = w / 2;
  x.lineCap = 'round'; x.lineWidth = w * .07; x.strokeStyle = '#1d3a24'; x.beginPath(); x.arc(c, h * .42, w * .36, 0, TAU); x.stroke();
  x.strokeStyle = '#3ddc84'; x.beginPath(); x.arc(c, h * .42, w * .36, -PI / 2, -PI / 2 + TAU * (o.ring ?? .72)); x.stroke();
  tx(x, o.time || '10:08', c, h * .42, w * .26, '#ffffff', { w: 600 });
  tx(x, '♥ ' + (o.bpm ?? 72), c, h * .86, w * .14, '#ff5a6a');
}
def('smartwatch', ['modern', 'handheld', 'screen'], 'smartwatch standing on its strap, face toward +z (8 cm): glowing face with time, activity ring, heart rate. o.color strap, o.time, o.bpm. userData.screen/draw(fn)/set({time, bpm, ring})', o => {
  const g = new THREE.Group(), strap = plastic(o.color || '#2f9c95', { rough: .6 }), R = .03, r = .0055;
  tor(g, R, r, strap, [0, R + r, 0], { rot: [0, PI / 2, 0], s: [1, 1, 2.1], rs: 10, ts: 36 });
  box(g, .044, .052, .013, plastic('#1b1c21', { rough: .3 }), [0, R + r, R + .006], { r: .011 });
  const t = tex(160, 190, (x, w, h) => drawWatch(x, w, h, o));
  decal(g, .037, .044, t, [0, R + r, R + .0127], { glow: 1.1, r: .008 });
  cyl(g, .004, .004, .006, chrome(), [.024, R + r + .008, R + .006], { rot: AZ });
  screenApi(g, t, { set: oo => redraw(t, (x, w, h) => drawWatch(x, w, h, { ...o, ...oo })) });
  g.userData.grip = { at: [0, R + r, 0], rot: [0, 0, 0] };
  return ink(g, .08);
});

def('vr_headset', ['modern', 'handheld', 'game'], 'VR headset (20 cm): white visor with a black glossy front, face foam, head strap loop. o.color', o => {
  const g = new THREE.Group(), body = plastic(o.color || '#eef0f2', { rough: .4 }), blk = toonMat('#1c1d22', { rough: .22 }), strap = plastic('#3a3d44', { rough: .7 });
  box(g, .19, .1, .1, body, [0, .055, .02], { r: .036 });
  box(g, .168, .078, .012, blk, [0, .055, .07], { r: .022 });
  for (const [x, y] of [[-.06, .08], [.06, .08], [-.06, .03], [.06, .03]]) cyl(g, .005, .005, .003, plastic('#3a3b42'), [x, y, .0765], { rot: AX, noOl: true });
  box(g, .17, .08, .03, strap, [0, .055, -.042], { r: .022 });
  tor(g, .1, .011, strap, [0, .055, -.09], { rot: [PI / 2, 0, 0], s: [1, 1.15, 1], rs: 10, ts: 48 });
  tor(g, .085, .01, strap, [0, .07, -.07], { rot: [0, PI / 2, 0], arc: PI, rs: 8, ts: 24 });
  g.userData.grip = { at: [.09, .055, .02], rot: [0, 0, 0] };
  return ink(g, .2);
});

def('drone', ['modern', 'handheld'], 'quadcopter drone (36 cm across): white body, four arms with rotors, camera gimbal, green/red arm LEDs. o.spin: true shows spinning rotor discs (rotors turn every frame). userData.rotors', o => {
  const g = new THREE.Group(), white = plastic(o.color || '#f1f2f4', { rough: .35 }), dark = plastic('#2d3038'), rotors = [];
  box(g, .13, .045, .16, white, [0, .07, 0], { r: .02 }); box(g, .1, .02, .12, dark, [0, .095, -.005], { r: .009 });
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz], i) => {
    const a = new THREE.Group(); a.position.set(0, .075, 0); a.rotation.y = Math.atan2(sx, sz); g.add(a);
    cyl(a, .009, .009, .17, dark, [0, 0, .085], { rot: AX }); cyl(a, .016, .016, .026, dark, [0, .008, .17]);
    ball(a, .005, glow(sz > 0 ? '#3dff6a' : '#ff3b30', 2.4), [0, -.01, .182], null, { noOl: true });
    const rt = new THREE.Group(); rt.position.set(0, .025, .17); a.add(rt); rotors.push(rt);
    cyl(rt, .006, .006, .008, chrome(), [0, 0, 0]);
    const blades = new THREE.Group(); rt.add(blades); box(blades, .13, .003, .016, plastic('#dfe2e6'), [0, .004, 0], { r: .0015, rot: [0, 0, .08] });
    const disc = mk(rt, circGeo(.068, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .22, depthWrite: false }), [0, .006, 0], UP); disc.userData.noOutline = true;
    disc.visible = !!o.spin; blades.rotation.y = i * .7; rt.userData.blades = blades;
  });
  for (const s of [-1, 1]) { box(g, .008, .045, .008, dark, [s * .045, .03, .03], { r: .003, rot: [0, 0, s * .2] }); box(g, .008, .045, .008, dark, [s * .045, .03, -.03], { r: .003, rot: [0, 0, s * .2] }); box(g, .01, .008, .1, dark, [s * .05, .004, 0], { r: .004 }); }
  ball(g, .02, dark, [0, .045, .07]); cyl(g, .01, .01, .006, toonMat('#1f3a66', { rough: .06 }), [0, .045, .089], { rot: AX, noOl: true });
  g.userData.rotors = rotors;
  if (o.spin) g.userData.update = t => rotors.forEach((r, i) => { r.userData.blades.rotation.y = t * 37 * (i % 2 ? 1 : -1) + i; });
  g.userData.grip = { at: [0, .07, 0], rot: [0, 0, 0] };
  return ink(g, .36);
});

/** robot face screen: neutral | happy | sad | surprised | love | error | sleep */
function drawRobotFace(x, w, h, mood = 'happy', col = '#5ff2ff') {
  x.fillStyle = '#0c1220'; x.fillRect(0, 0, w, h); x.save(); x.shadowColor = col; x.shadowBlur = h * .08; x.fillStyle = col; x.strokeStyle = col; x.lineCap = 'round'; x.lineWidth = h * .09;
  const ex = [w * .3, w * .7], ey = h * .42, er = h * .14;
  for (const X of ex) {
    if (mood === 'happy') { x.beginPath(); x.arc(X, ey + er * .4, er, PI * 1.15, PI * 1.85); x.stroke(); }
    else if (mood === 'sad') { x.beginPath(); x.arc(X, ey - er * .2, er, PI * .15, PI * .85); x.stroke(); }
    else if (mood === 'surprised') { x.beginPath(); x.arc(X, ey, er * 1.1, 0, TAU); x.stroke(); }
    else if (mood === 'love') { x.beginPath(); x.moveTo(X, ey + er); x.bezierCurveTo(X - er * 2, ey - er * .3, X - er * .6, ey - er * 1.6, X, ey - er * .4); x.bezierCurveTo(X + er * .6, ey - er * 1.6, X + er * 2, ey - er * .3, X, ey + er); x.fill(); }
    else if (mood === 'error') { x.beginPath(); x.moveTo(X - er, ey - er); x.lineTo(X + er, ey + er); x.moveTo(X + er, ey - er); x.lineTo(X - er, ey + er); x.stroke(); }
    else if (mood === 'sleep') { x.beginPath(); x.moveTo(X - er, ey); x.lineTo(X + er, ey); x.stroke(); }
    else rr(x, X - er * .7, ey - er * 1.1, er * 1.4, er * 2.2, er * .6, col);
  }
  if (mood === 'happy' || mood === 'love') { x.beginPath(); x.arc(w / 2, h * .62, h * .12, .2, PI - .2); x.stroke(); }
  else if (mood === 'sad' || mood === 'error') { x.beginPath(); x.arc(w / 2, h * .82, h * .12, PI + .3, -.3); x.stroke(); }
  else if (mood === 'surprised') { x.beginPath(); x.arc(w / 2, h * .74, h * .07, 0, TAU); x.stroke(); }
  x.restore(); scan(x, w, h, .18, 4);
}
def('robot_small', ['modern', 'robot', 'screen'], 'small cute helper robot (0.6 m tall): rounded white body on treads, screen face with glowing eyes, antenna light, short arms. o.color accent, o.mood: happy | neutral | sad | surprised | love | error | sleep. userData.head, arms [L, R], face(mood), screen/draw(fn)', o => {
  const g = new THREE.Group(), white = plastic('#f2f2ee', { rough: .4 }), acc = plastic(o.color || '#2f9c95'), dark = plastic('#3b3f48'), grey = plastic('#8d939d');
  for (const s of [-1, 1]) { box(g, .07, .08, .22, dark, [s * .11, .04, 0], { r: .035 }); for (const z of [-.07, 0, .07]) cyl(g, .022, .022, .01, grey, [s * .147, .04, z], { rot: AZ }); }
  box(g, .2, .04, .16, grey, [0, .085, 0], { r: .015 });
  box(g, .24, .2, .18, white, [0, .19, 0], { r: .06 });
  for (const [x, c] of [[-.05, '#ffd84a'], [0, '#ff5a4a'], [.05, '#5ff2ff']]) ball(g, .011, glow(c, 1.3), [x, .2, .089], [1, 1, .5], { noOl: true });
  cyl(g, .03, .036, .04, grey, [0, .305, 0]);
  const head = new THREE.Group(); head.position.set(0, .32, 0); g.add(head);
  box(head, .26, .17, .18, white, [0, .085, 0], { r: .06 });
  const t = tex(256, 140, (x, w, h) => drawRobotFace(x, w, h, o.mood || 'happy'));
  decal(head, .2, .108, t, [0, .085, .0905], { glow: 1.2, r: .03 });
  for (const s of [-1, 1]) cyl(head, .032, .032, .02, acc, [s * .135, .085, 0], { rot: AZ });
  cyl(head, .004, .004, .08, grey, [0, .21, 0]); ball(head, .016, glow('#ff3b30', 2), [0, .255, 0]);
  const arms = [-1, 1].map(s => { const a = new THREE.Group(); a.position.set(s * .13, .25, 0); a.rotation.z = s * .15; g.add(a); cyl(a, .022, .022, .13, acc, [0, -.06, 0]); box(a, .016, .03, .02, grey, [-.008, -.13, 0], { r: .006 }); box(a, .016, .03, .02, grey, [.008, -.13, 0], { r: .006 }); return a; });
  screenApi(g, t, { head, arms, face: m => redraw(t, (x, w, h) => drawRobotFace(x, w, h, m)) });
  return ink(g, .6);
});

def('earbuds', ['modern', 'handheld', 'music'], 'wireless earbuds: white pill charging case with a status light and two buds lying in front (6 cm case)', o => {
  const g = new THREE.Group(), white = plastic(o.color || '#f4f4f2', { rough: .3 });
  box(g, .06, .045, .028, white, [0, .0225, 0], { r: .013 });
  box(g, .0605, .0012, .0285, plastic('#c9cbd0'), [0, .032, 0], { r: .0005, noOl: true });
  ball(g, .0018, glow('#3dff6a', 2.5), [0, .015, .0141], null, { noOl: true });
  for (const s of [-1, 1]) { const b = new THREE.Group(); b.position.set(s * .02, .0095, .045); b.rotation.y = s * .6; g.add(b); ball(b, .0095, white, [0, 0, 0]); cyl(b, .0036, .0042, .028, white, [s * .016, -.003, .002], { rot: [0, 0, s * 1.3] }); }
  g.userData.grip = { at: [0, .0225, 0], rot: [0, 0, 0] };
  return ink(g, .07);
});

def('game_controller', ['modern', 'handheld', 'game'], 'modern twin-grip game controller lying face up (16 cm): two thumbsticks, d-pad, four pastel face buttons, light bar. o.color', o => {
  const g = new THREE.Group(), col = o.color || '#2d3038', body = plastic(col, { rough: .4 }), d2 = plastic(shade(col, -.25)), st = plastic('#3b3f48');
  box(g, .13, .03, .075, body, [0, .02, -.005], { r: .014 });
  for (const s of [-1, 1]) ball(g, .032, body, [s * .056, .019, .032], [1, .55, 1.3], { rot: [0, -s * .35, 0] });
  for (const [x, z] of [[-.03, .012], [.022, .036]]) { cyl(g, .011, .013, .014, d2, [x, .038, z]); cyl(g, .014, .014, .006, st, [x, .047, z]); }
  box(g, .022, .006, .008, d2, [-.048, .036, -.012], { r: .002 }); box(g, .008, .006, .022, d2, [-.048, .036, -.012], { r: .002 });
  [['#ff9a5a', 0, -.024], ['#4fd1c5', .012, -.012], ['#b49aff', -.012, -.012], ['#9be15d', 0, 0]].forEach(([c, dx, dz]) => cyl(g, .0062, .0062, .006, glossy(c), [.048 + dx, .037, dz]));
  box(g, .04, .004, .006, glow('#5fd8ff', 1.5), [0, .036, -.04], { r: .002, noOl: true });
  for (const s of [-1, 1]) box(g, .04, .012, .02, d2, [s * .045, .026, -.042], { r: .005 });
  g.userData.grip = { at: [0, .02, .02], rot: [0, 0, 0] };
  return ink(g, .16);
});

def('flat_tv', ['modern', 'screen', 'home'], 'flat screen TV on its stand (1.12 m wide, on a cabinet). o.show: news | cartoon | bars | static | off. userData.screen/draw(fn)/show(name)', o => {
  const g = new THREE.Group(), blk = plastic('#1d1e23', { rough: .3 }), W = 1.12, H = .64, cy = .1 + H / 2;
  box(g, W, H, .035, blk, [0, cy, 0], { r: .012 });
  box(g, W * .55, H * .55, .04, plastic('#2a2b30'), [0, cy, -.035], { r: .02 });
  const t = tex(640, 360, (x, w, h) => drawTV(x, w, h, o.show || 'news', o.seed));
  decal(g, W - .03, H - .03, t, [0, cy, .0181], { glow: 1.1 });
  box(g, .08, .1, .04, chrome('#9aa1a9'), [0, .06, -.02], { r: .01 });
  box(g, .38, .016, .2, plastic('#26272c', { rough: .6 }), [0, .008, -.01], { r: .007 });
  ball(g, .003, glow('#ff3b30', 2), [W / 2 - .04, cy - H / 2 + .008, .018], null, { noOl: true });
  screenApi(g, t, { show: name => redraw(t, (x, w, h) => drawTV(x, w, h, name)) });
  if (o.show === 'static') g.userData.update = tt => redraw(t, (x, w, h) => drawTV(x, w, h, 'static', Math.floor(tt * 30)));
  return ink(g, 1.12, { k: .005 });
});

def('router', ['modern', 'office', 'home'], 'wifi router (24 cm): white box, three antennas, a row of blinking status LEDs', o => {
  const g = new THREE.Group(), white = plastic(o.color || '#f2f2f0', { rough: .4 }), dark = plastic('#2a2b30');
  box(g, .24, .042, .16, white, [0, .025, 0], { r: .014 });
  for (const s of [-1, 1]) for (const z of [-.05, .05]) cyl(g, .01, .01, .006, dark, [s * .09, .003, z]);
  decal(g, .16, .08, ctex('router-vents', 160, 80, (x, w, h) => { x.fillStyle = '#f2f2f0'; x.fillRect(0, 0, w, h); x.fillStyle = '#c9cbd0'; for (let i = 0; i < 9; i++) rr(x, 6 + i * 17, 10, 8, h - 20, 4, '#c9cbd0'); }), [0, .0465, -.01], { rot: UP });
  [-.08, 0, .08].forEach((x, i) => { const a = new THREE.Group(); a.position.set(x, .03, -.075); a.rotation.set(-.12, 0, (i - 1) * -.25); g.add(a); cyl(a, .009, .007, .16, dark, [0, .08, 0]); });
  const leds = [], cols = ['#3dff6a', '#3dff6a', '#ffb02e', '#3dff6a', '#5fd8ff'];
  cols.forEach((c, i) => { const m = own(c, { ei: 1.6 }); leds.push(m); box(g, .008, .004, .003, m, [-.05 + i * .025, .024, .0805], { r: .0012, noOl: true }); });
  decal(g, .05, .01, ctex('router-brand', 120, 24, (x, w, h) => { x.fillStyle = '#f2f2f0'; x.fillRect(0, 0, w, h); tx(x, 'WIFLO', w / 2, h / 2, h * .7, '#8d939d'); }), [.08, .025, .0805]);
  g.userData.update = t => leds.forEach((m, i) => { m.emissiveIntensity = hash(Math.floor(t * (6 + i * 3)), i) > .35 ? 1.8 : .15; });
  return ink(g, .24);
});
// =====================================================================================================================
// MACHINES (casino, arcade hall, shop, bank, city, control rooms)
// =====================================================================================================================
// ---- slot reels: deterministic in t. spin(at, ['seven','seven','cherry'], { dur, stagger, turns }) plans a spin;
// setReels(t) puts every reel where it is at time t (the engine calls update(t) every frame). Symbols: SYMS.
const RN = SYMS.length;
const REEL_ORDERS = [0, 1, 2].map(i => { const R = rnd(31 + i * 7), a = SYMS.map((_, k) => k); for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(R() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; });
function reelTex(order, blur) {
  return ctex('reel:' + order.join('') + (blur ? 'b' : ''), 200, 200 * RN, (x, w, h) => {
    x.fillStyle = '#fbf3df'; x.fillRect(0, 0, w, h);
    const draw = () => order.forEach((sym, k) => { drawSym(x, SYMS[sym], w / 2, h - (k + .5) * w, w * .9); x.fillStyle = 'rgba(80,40,20,.12)'; x.fillRect(0, h - (k + 1) * w, w, 3); });
    if (!blur) return draw();
    x.globalAlpha = .17; for (let i = 0; i < 9; i++) { x.save(); x.translate(0, (i - 4) * w * .1); draw(); x.restore(); } x.globalAlpha = 1;
  });
}
function reelGeo(r, w, n = 64) {
  return memo(`reel${q4(r)},${q4(w)}`, () => {
    const pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) { const a = i / n * TAU, s = Math.sin(a), c = Math.cos(a); for (let j = 0; j <= 1; j++) { pos.push((j - .5) * w, r * s, r * c); nor.push(0, s, c); uv.push(j, i / n); } }
    for (let i = 0; i < n; i++) { const a = i * 2, b = a + 2; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeBoundingSphere(); return g;
  });
}
function reelBank(par, o) {
  const reels = [], mats = [], idxOf = [], sharp = [], blur = [], plan = [];
  o.xs.forEach((x, i) => {
    const order = REEL_ORDERS[i % 3]; sharp.push(reelTex(order, false)); blur.push(reelTex(order, true));
    const m = new THREE.MeshStandardMaterial({ map: sharp[i], roughness: .5, emissive: '#ffffff', emissiveMap: sharp[i], emissiveIntensity: o.backlight ?? .32 }); mats.push(m);   // backlit reels
    const reel = mk(par, reelGeo(o.r, o.w), m, [o.p[0] + x, o.p[1], o.p[2]]); reel.userData.noOutline = true;
    for (const s of [-1, 1]) cyl(reel, o.r * 1.035, o.r * 1.035, .008, chrome('#9aa2ab'), [s * (o.w / 2 + .004), 0, 0], { rot: AZ, noOl: true, n: 48 });
    reels.push(reel); idxOf.push(name => { const k = SYMS.indexOf(name); return order.indexOf(k < 0 ? 0 : k); });
  });
  let rest = (o.symbols || ['seven', 'cherry', 'bar']).slice();
  const ang = k => (k + .5) / RN * TAU, f = k => k < .75 ? .9 * k / .75 : .9 + .1 * E.outCubic((k - .75) / .25);
  function stateAt(i, t) {
    let cur = idxOf[i](rest[i]), last = -1e9;
    for (const s of plan) {
      if (t < s.at) break;
      const stop = s.at + s.dur + i * s.stagger, tgt = idxOf[i](s.result[i] ?? s.result[0]);
      if (t < stop) { const a = ang(cur), k = (t - s.at) / (stop - s.at); let b = ang(tgt); while (b < a + TAU * (s.turns + i * .5)) b += TAU; return { a: a + (b - a) * f(k), fast: k > .03 && k < .8 }; }
      cur = tgt; last = stop;
    }
    const x = t - last; return { a: ang(cur) + (x >= 0 && x < .7 ? .1 * Math.sin(x * TAU * 2.4) * Math.exp(-x * 7) : 0), fast: false };
  }
  const api = {
    reels, symbols: SYMS,
    setReels(t) { reels.forEach((rl, i) => { const s = stateAt(i, t); rl.rotation.x = s.a; mats[i].map = mats[i].emissiveMap = s.fast ? blur[i] : sharp[i]; }); },
    spin(at, result = ['seven', 'seven', 'seven'], so = {}) { const s = { at, result: [].concat(result), dur: so.dur ?? 1.1, stagger: so.stagger ?? .45, turns: so.turns ?? 3 }; plan.push(s); plan.sort((a, b) => a.at - b.at); return at + s.dur + (reels.length - 1) * s.stagger; },
    show(names) { rest = [].concat(names); },
  };
  api.setReels(-1e9);
  return api;
}
function drawBelly(x, w, h) {
  vgrad(x, w, h, '#5a0e12', '#2a0608'); rr(x, w * .04, h * .04, w * .92, h * .92, w * .04, null, '#e9b44c', w * .012);
  tx(x, 'PAYS', w / 2, h * .13, h * .1, '#ffd84a', { stroke: OL, sw: 6 });
  [['seven', '1000'], ['bar', '200'], ['bell', '100'], ['cherry', '50']].forEach(([s, v], i) => { const y = h * (.32 + i * .18); for (let k = 0; k < 3; k++) drawSym(x, s, w * (.14 + k * .14), y, h * .15); tx(x, v, w * .8, y, h * .1, '#ffffff', { stroke: OL, sw: 5 }); });
}
function drawTopper(x, w, h, title = 'SUPER SPIN') {
  const cx = w / 2, cy = h * .66; x.fillStyle = '#c21d22'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 24; i++) { x.fillStyle = i % 2 ? '#e8452a' : '#ff7a2a'; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, w, i / 24 * TAU, (i + 1) / 24 * TAU); x.fill(); }
  const gr = x.createRadialGradient(cx, cy, 0, cx, cy, w * .4); gr.addColorStop(0, 'rgba(255,240,180,.85)'); gr.addColorStop(1, 'rgba(255,240,180,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  star(x, cx, cy - h * .12, h * .26, h * .12); x.fillStyle = '#ffd84a'; x.fill(); x.strokeStyle = OL; x.lineWidth = 8; x.stroke();
  const [a, b] = title.split(' '); if (b) { tx(x, a, cx, h * .5, h * .14, '#ffffff', { stroke: OL, sw: 9 }); tx(x, b, cx, h * .78, h * .28, '#ffd84a', { stroke: OL, sw: 14, skew: .12 }); } else tx(x, a, cx, h * .7, h * .26, '#ffd84a', { stroke: OL, sw: 14 });
  for (let i = 0; i < 14; i++) { const R = rnd(i + 5); star(x, R() * w, R() * h * .9, 9, 3, 4); x.fillStyle = '#fff6c8'; x.fill(); }
}
function drawCredits(x, w, h, n) { x.fillStyle = '#0b0405'; x.fillRect(0, 0, w, h); tx(x, 'CREDIT', w * .05, h * .5, h * .26, '#ffb02e', { align: 'left' }); seg7R(x, String(n), w * .95, h * .2, h * .6, '#ff3a2a', 'rgba(255,60,40,.1)', 4); }
def('slot_machine', ['machine', 'casino', 'screen'], 'casino slot machine "SUPER SPIN" (2.07 m with its arched topper, 0.74 m wide; a stool in front makes it playable): three real spinning reels behind glass with a payline, chasing topper bulbs, pull lever, button deck, credit LEDs, pay table. o.color, o.text (topper), o.symbols (rest), o.credits. userData.reels, symbols, spin(at, result[3], {dur, stagger, turns}) -> stop time, show(names), setReels(t), credits(n), pull(at), lever', o => {
  const g = new THREE.Group(), col = o.color || '#d63a2c', body = plastic(col, { rough: .42 }), dk = plastic(shade(col, -.55)), base = plastic('#2a1a1a'), ch = chrome(), gold = toonMat('#e9b44c', { metal: .35, rough: .35 }), W = .74, D = .6, F = D / 2;
  box(g, W + .03, .08, D + .03, base, [0, .04, 0], { r: .015 });
  box(g, W, 1.46, D, body, [0, .81, 0], { r: .03 });
  box(g, W - .1, .46, .02, dk, [0, .5, F + .002], { r: .015 });
  decal(g, W - .14, .42, ctex('slot-belly', 384, 256, drawBelly), [0, .5, F + .0125], { glow: .55 });
  const deck = new THREE.Group(); deck.position.set(0, .925, F + .07); deck.rotation.x = .2; g.add(deck);
  box(deck, W + .02, .06, .22, base, [0, -.03, 0], { r: .02 });
  const spinM = own('#ff2a2a', { ei: .5, rough: .3 });
  cyl(deck, .036, .038, .03, spinM, [.24, .012, .03]);
  discDecal(deck, .03, ctex('lbl-spin', 128, 128, (x, w, h) => { circ(x, w / 2, h / 2, w / 2, '#ff3a2a'); tx(x, 'SPIN', w / 2, h / 2, h * .28, '#ffffff'); }), [.24, .0276, .03], { rot: UP, glow: .9 });
  [['BET ONE', '#ffd84a', -.02], ['MAX BET', '#ff9a2a', .1], ['CASH OUT', '#4fa3ff', -.2]].forEach(([s, c, x]) => {
    box(deck, .1, .024, .05, glow(c, .35), [x, .012, .03], { r: .006 });
    decal(deck, .088, .04, ctex('lbl:' + s + c, 176, 80, (q, w, h) => { q.fillStyle = c; q.fillRect(0, 0, w, h); tx(q, s, w / 2, h / 2, h * .32, '#1d1416'); }), [x, .0246, .03], { rot: UP, glow: .55 });
  });
  const ct = tex(256, 64, (x, w, h) => drawCredits(x, w, h, o.credits ?? 35));
  decal(g, .22, .055, ct, [-.17, .995, F + .002], { glow: 1.2 });
  box(g, .11, .085, .04, plastic('#232327'), [.2, .995, F + .02], { r: .008 });
  box(g, .08, .006, .004, glow('#3dff6a', 2.2), [.2, 1.01, F + .0405], { noOl: true, r: .002 });
  const bev = .012, outer = rrShape(W - .04 - 2 * bev, .36 - 2 * bev, .04 - bev); outer.holes.push(rrShape(.6 + 2 * bev, .25 + 2 * bev, .025 + bev, new THREE.Path()));
  mk(g, exGeo('slot-bezel', outer, .07, bev, 10), gold, [0, 1.24, F + .035]).userData.th = .36;
  decal(g, .6, .25, ctex('slot-recess', 16, 64, (x, w, h) => vgrad(x, w, h, '#120606', '#2a0c0c')), [0, 1.24, F + .001]);
  const bank = reelBank(g, { r: .14, w: .18, xs: [-.196, 0, .196], p: [0, 1.24, F - .1], symbols: o.symbols });
  box(g, .62, .007, .004, glow('#ff2a2a', 2.6), [0, 1.24, F + .052], { noOl: true, r: .002 });
  decal(g, .6, .25, null, [0, 1.24, F + .056], { mat: basicTex(ctex('slot-shade', 16, 128, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(.3, 'rgba(0,0,0,0)'); gr.addColorStop(.7, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.75)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); }), { depthWrite: false }) });
  decal(g, .6, .25, null, [0, 1.24, F + .062], { mat: streakMat() });
  decal(g, .6, .085, ctex('slot-strip', 512, 72, (x, w, h) => { vgrad(x, w, h, '#3a0608', '#1a0204'); tx(x, '★  WIN UP TO 1000  ★', w / 2, h / 2, h * .5, '#ffd84a', { glow: 8 }); }), [0, 1.475, F + .002], { glow: .9 });
  for (const s of [-1, 1]) cyl(g, .012, .012, 1.44, ch, [s * (W / 2 + .003), .81, F - .006]);
  box(g, W + .03, .05, D + .03, base, [0, 1.56, 0], { r: .015 });
  const tz = F - .1;
  box(g, .66, .16, .14, body, [0, 1.665, tz], { r: .02 });
  cyl(g, .33, .33, .14, body, [0, 1.745, tz], { rot: AX, n: 48 });
  const arch = new THREE.Shape(); arch.moveTo(-.31, 0); arch.lineTo(.31, 0); arch.lineTo(.31, .16); arch.absarc(0, .16, .31, 0, PI); arch.lineTo(-.31, 0);
  decal(g, 0, 0, ctex('slot-top:' + (o.text || 'SUPER SPIN'), 512, 388, (x, w, h) => drawTopper(x, w, h, o.text || 'SUPER SPIN')), [0, 1.585, tz + .0705], { glow: 1, geo: shapeGeo('slot-arch', arch, 24) });
  const bA = own('#fff2b0', { ei: 2 }), bB = own('#fff2b0', { ei: .3 });
  for (let i = 0; i <= 14; i++) { const a = i / 14 * PI; ball(g, .013, i % 2 ? bA : bB, [Math.cos(a) * .325, 1.745 + Math.sin(a) * .325, tz + .072], null, { noOl: true, w: 12, h: 8 }); }
  for (const s of [-1, 1]) for (const y of [1.6, 1.68]) ball(g, .013, y > 1.65 ? bA : bB, [s * .325, y, tz + .072], null, { noOl: true, w: 12, h: 8 });
  cyl(g, .04, .04, .05, ch, [W / 2 + .025, 1.1, .02], { rot: AZ });
  const lever = new THREE.Group(); lever.position.set(W / 2 + .05, 1.1, .02); g.add(lever);
  cyl(lever, .012, .012, .42, ch, [0, .21, 0]); ball(lever, .038, glossy('#e2322a'), [0, .43, 0]);
  box(g, .36, .05, .12, ch, [0, .2, F + .05], { r: .014 });
  decal(g, .3, .08, ctex('slot-tray', 8, 8, (x, w, h) => { x.fillStyle = '#202024'; x.fillRect(0, 0, w, h); }), [0, .2255, F + .05], { rot: UP });
  const pulls = [];
  const leverAt = t => { let a = 0; for (const p of pulls) { const x = t - p; if (x < 0 || x > 1.2) continue; a = x < .2 ? 1.05 * E.inOutQuad(x / .2) : 1.05 * (1 - springStep(x - .2, 2.4, .45)); } return a; };
  Object.assign(g.userData, bank, {
    lever, top: 1.585,
    pull(at) { pulls.push(at); return g; },
    spin(at, result, so = {}) { if (so.lever !== false) pulls.push(at - .2); return bank.spin(at, result, so); },
    credits(n) { redraw(ct, (x, w, h) => drawCredits(x, w, h, n)); return g; },
    screen: ct, draw: fn => { redraw(ct, fn); return g; },
    update(t) { bank.setReels(t); const k = Math.floor(t * 7) % 2; bA.emissiveIntensity = k ? 2.2 : .25; bB.emissiveIntensity = k ? .25 : 2.2; spinM.emissiveIntensity = .4 + .5 * (Math.sin(t * 5) * .5 + .5); lever.rotation.x = leverAt(t); },
  });
  return ink(g, 2.07, { k: .0055 });
});

def('slot_reel_unit', ['machine', 'casino'], 'the inside of a slot machine: three reels on a steel bracket with motors, an axle and a part label (0.7 m wide, 0.4 m tall; put it on a shelf or inside a cut-open cabinet). Same reel API as slot_machine: reels, spin(at, result), show(names), setReels(t)', o => {
  const g = new THREE.Group(), steel = toonMat('#98a0aa', { metal: .3, rough: .55 }), dark = plastic('#2a2b30');
  box(g, .7, .025, .26, steel, [0, .0125, 0], { r: .006 });
  for (const s of [-1, 1]) box(g, .02, .34, .26, steel, [s * .34, .195, 0], { r: .006 });
  box(g, .7, .38, .02, steel, [0, .2, -.13], { r: .006 });
  for (let i = 0; i < 6; i++) cyl(g, .008, .008, .006, chrome(), [-.28 + i * .112, .36, -.117], { rot: AX, noOl: true });
  const bank = reelBank(g, { r: .14, w: .18, xs: [-.2, 0, .2], p: [0, .19, .0], symbols: o.symbols });
  cyl(g, .008, .008, .66, chrome(), [0, .19, 0], { rot: AZ });
  for (const x of [-.2, 0, .2]) box(g, .06, .05, .06, dark, [x, .05, -.07], { r: .008 });
  decal(g, .5, .022, ctex('reel-unit-label', 512, 24, (x, w, h) => { x.fillStyle = '#f6c945'; x.fillRect(0, 0, w, h); tx(x, '3-REEL UNIT  ·  STEPPER  ·  DO NOT ADJUST', w / 2, h / 2, h * .66, '#2a1d17'); }), [0, .0125, .1305]);
  Object.assign(g.userData, bank, { update: t => bank.setReels(t), top: .025 });
  return ink(g, .7);
});

function drawFizzo(x, w, h) { vgrad(x, w, h, '#ffffff', '#e6eefc'); for (let i = 0; i < 12; i++) { const R = rnd(i + 2); circ(x, R() * w, R() * h, 4 + R() * 9, 'rgba(63,111,209,.18)'); } tx(x, 'FIZZO', w * .5, h * .54, h * .62, '#e2432f', { stroke: '#ffffff', sw: 10, skew: .14 }); tx(x, 'ice cold', w * .82, h * .82, h * .14, '#3f6fd1', { w: 600 }); }
def('vending_machine', ['machine', 'shop', 'city'], 'drinks vending machine "FIZZO" (1.85 m, 0.95 m wide): lit glass front with five shelves of cans and bottles, keypad and price LEDs, coin and bill slots, pickup flap. o.color', o => {
  const g = new THREE.Group(), col = o.color || '#2f6fd1', body = plastic(col, { rough: .42 }), dk = plastic('#1c1d22'), ch = chrome(), W = .95, H = 1.85, D = .78, F = D / 2, wx = -.11;
  box(g, W - .04, .06, D - .04, dk, [0, .03, 0], { r: .01 });
  box(g, W, H - .06, D, body, [0, .06 + (H - .06) / 2, 0], { r: .03 });
  const bev = .01, fr = rrShape(.66 - 2 * bev, 1.16 - 2 * bev, .03 - bev); fr.holes.push(rrShape(.6 + 2 * bev, 1.08 + 2 * bev, .02 + bev, new THREE.Path()));
  mk(g, exGeo('vend-frame', fr, .14, bev, 8), plastic(shade(col, -.35)), [wx, 1.08, F + .07]).userData.th = .66;
  decal(g, .6, 1.08, ctex('vend-back', 32, 128, (x, w, h) => vgrad(x, w, h, '#f4f9ff', '#bcd7ff')), [wx, 1.08, F + .002], { glow: .6 });
  const pal = o.colors || ['#e2432f', '#ff9a2a', '#5fae4a', '#7a4fc4', '#2f8fe0'];
  const bottle = latheGeo('vend-bottle', [[0, 0], [.024, 0], [.027, .006], [.027, .085], [.022, .105], [.011, .125], [.011, .145], [0, .145]]);
  for (let r = 0; r < 5; r++) {
    const y = .6 + r * .21;
    box(g, .6, .012, .13, ch, [wx, y, F + .068], { r: .004 });
    decal(g, .6, .02, ctex('vend-price', 512, 34, (x, w, h) => { x.fillStyle = '#e8ecf2'; x.fillRect(0, 0, w, h); for (let c = 0; c < 5; c++) { rr(x, 18 + c * 100, 4, 70, h - 8, 4, '#ffffff', '#c3c8d0', 1); tx(x, '1.50', 53 + c * 100, h / 2 + 1, h * .55, '#2b2d33'); } }), [wx, y - .004, F + .1345]);
    const c0 = pal[(r + (o.seed ?? 0)) % pal.length], m = toonMat(c0, { rough: .28, emissive: c0, ei: .45 }), m2 = toonMat(shade(c0, -.3), { rough: .3, emissive: c0, ei: .25 });
    for (let c = 0; c < 5; c++) {
      const x = wx + (c - 2) * .114, z = F + .07;
      if (r < 3) { cyl(g, .029, .029, .085, m, [x, y + .0485, z]); cyl(g, .026, .029, .014, ch, [x, y + .098, z]); tor(g, .0295, .003, plastic('#ffffff'), [x, y + .05, z], { rot: [PI / 2, 0, 0], noOl: true, rs: 6, ts: 24 }); }
      else { const b = mk(g, bottle, m, [x, y + .006, z]); b.userData.th = .055; cyl(g, .012, .012, .012, m2, [x, y + .157, z]); }
    }
  }
  mk(g, planeGeo(.6, 1.08), glassMat('#e6f6ff', .12), [wx, 1.08, F + .128]).userData.noOutline = true;
  decal(g, .6, 1.08, null, [wx, 1.08, F + .13], { mat: streakMat() });
  box(g, W - .04, .2, .04, plastic('#f4f6fa'), [0, 1.735, F + .012], { r: .02 });
  decal(g, W - .1, .16, ctex('fizzo', 512, 96, drawFizzo), [0, 1.735, F + .0325], { glow: .95 });
  const px = .335;
  decal(g, .16, .045, ctex('vend-led', 256, 72, (x, w, h) => { x.fillStyle = '#04110a'; x.fillRect(0, 0, w, h); seg7R(x, '1.50', w * .92, h * .18, h * .62, '#3dff6a', 'rgba(60,255,100,.08)', 4); }), [px, 1.5, F + .002], { glow: 1.2 });
  box(g, .19, .25, .01, dk, [px, 1.25, F + .004], { r: .008 });
  decal(g, .17, .23, ctex('vend-keys', 170, 230, (x, w, h) => { x.fillStyle = '#1c1d22'; x.fillRect(0, 0, w, h); const L = 'ABCDE'; for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) { const X = 12 + c * 52, Y = 10 + r * 43; rr(x, X, Y, 44, 34, 6, '#d9dde3'); tx(x, c < 2 ? L[r] + (c + 1) : '#', X + 22, Y + 18, 15, '#2b2d33'); } }), [px, 1.25, F + .0095], { glow: .45 });
  box(g, .05, .07, .015, ch, [px - .04, 1.05, F + .008], { r: .005 }); box(g, .006, .04, .004, dk, [px - .04, 1.05, F + .0155], { noOl: true });
  box(g, .13, .04, .025, dk, [px, .95, F + .012], { r: .006 }); box(g, .1, .005, .004, glow('#3dff6a', 2), [px, .955, F + .0245], { noOl: true });
  box(g, .08, .06, .03, ch, [px, .72, F + .015], { r: .008 }); decal(g, .06, .035, ctex('dark', 8, 8, (x, w, h) => { x.fillStyle = '#121216'; x.fillRect(0, 0, w, h); }), [px, .715, F + .0305]);
  box(g, .6, .2, .05, dk, [wx, .3, F + .025], { r: .012 });
  box(g, .56, .14, .02, plastic('#3b3f48'), [wx, .3, F + .055], { r: .008, rot: [-.12, 0, 0] });
  decal(g, .14, .03, ctex('push', 128, 28, (x, w, h) => { x.fillStyle = '#3b3f48'; x.fillRect(0, 0, w, h); tx(x, 'PUSH', w / 2, h / 2, h * .7, '#e8ecf2'); }), [wx, .33, F + .0655], { rot: [-.12, 0, 0] });
  return ink(g, 1.85, { k: .0055 });
});

def('claw_machine', ['machine', 'arcade', 'shop'], 'claw crane machine "GRAB-O" (1.95 m, 0.82 m wide): glass case full of round plush prizes, a claw on a gantry, lit marquee, joystick and button. o.color. userData.setClaw(x, z, drop, open): x, z -1..1 across the case, drop 0..1, open 0..1; userData.claw (group)', o => {
  const g = new THREE.Group(), col = o.color || '#e4579a', body = plastic(col, { rough: .42 }), trim = plastic('#f6c945'), ch = chrome(), W = .82, D = .82, F = D / 2;
  box(g, W, .9, D, body, [0, .45, 0], { r: .03 });
  box(g, W + .02, .07, .22, trim, [0, .87, F + .08], { r: .02 });
  cyl(g, .018, .022, .014, plastic('#24252b'), [-.14, .912, F + .1]); cyl(g, .006, .006, .07, ch, [-.14, .94, F + .1]); ball(g, .022, glossy('#e2432f'), [-.14, .98, F + .1]);
  cyl(g, .04, .044, .026, glow('#ff4a3a', .6), [.14, .917, F + .1]);
  box(g, .22, .2, .02, plastic('#24252b'), [-.22, .38, F + .01], { r: .01 }); decal(g, .16, .05, ctex('prize-lbl', 160, 50, (x, w, h) => { x.fillStyle = '#24252b'; x.fillRect(0, 0, w, h); tx(x, 'PRIZE', w / 2, h / 2, h * .62, '#ffd84a', { glow: 6 }); }), [-.22, .44, F + .0205], { glow: .8 });
  box(g, .06, .09, .015, ch, [.22, .55, F + .008], { r: .006 }); box(g, .006, .05, .004, glow('#ff6a2a', 2), [.22, .55, F + .0155], { noOl: true });
  const gh = .76, gy = .9 + gh / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, .022, .022, gh, ch, [sx * (W / 2 - .022), gy, sz * (D / 2 - .022)]);
  box(g, W - .04, .02, D - .04, plastic('#5b3a8a'), [0, .91, 0], { r: .006 });
  decal(g, W - .06, gh - .04, ctex('claw-back', 256, 256, (x, w, h) => { vgrad(x, w, h, '#2a1a5a', '#7a2fa8'); for (let i = 0; i < 24; i++) { const R = rnd(i + 9); star(x, R() * w, R() * h, 8 + R() * 10, 3 + R() * 3); x.fillStyle = 'rgba(255,230,120,.75)'; x.fill(); } }), [0, gy, -D / 2 + .025], { glow: .5 });
  const gm = glassMat('#e6f6ff', .1);
  for (const [p, r, w, n] of [[[0, gy, F - .005], [0, 0, 0], W - .05, [0, 0, .003]], [[-W / 2 + .005, gy, 0], [0, -PI / 2, 0], D - .05, [-.003, 0, 0]], [[W / 2 - .005, gy, 0], [0, PI / 2, 0], D - .05, [.003, 0, 0]]]) {
    mk(g, planeGeo(w, gh), gm, p, r).userData.noOutline = true; decal(g, w, gh, null, [p[0] + n[0], p[1], p[2] + n[2]], { rot: r, mat: streakMat() });
  }
  const R = rnd(o.seed ?? 7), pastel = ['#ffb3c7', '#9fe0d6', '#ffe08a', '#c7b3ff', '#ffc89a', '#a8d8ff', '#b8f0a0'];
  const pile = [];
  for (let i = 0; i < 16; i++) {
    let x, z, tries = 0; do { x = (R() - .5) * (W - .2); z = (R() - .5) * (D - .2); tries++; } while (x < -.12 && z > .1 && tries < 20);
    const lay2 = i < 10 ? 0 : 1, r = .065 + R() * .02, y = .92 + r * .85 + lay2 * .08;
    const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = (R() - .5) * 1.6; g.add(p); pile.push(p);
    const c = pastel[i % pastel.length], m = toonMat(c, { emissive: c, ei: .22 });
    ball(p, r, m, [0, 0, 0], [1, .85, 1]); for (const s of [-1, 1]) ball(p, r * .32, m, [s * r * .62, r * .7, 0]);
    for (const s of [-1, 1]) ball(p, r * .1, matte('#1d1416'), [s * r * .32, r * .12, r * .9], null, { noOl: true, w: 10, h: 8 });
    ball(p, r * .14, matte(shade(c, .35)), [0, -r * .12, r * .92], [1, .7, .5], { noOl: true, w: 10, h: 8 });
  }
  for (const [x, z, w, d] of [[-.2, .25, .2, .01], [-.2, .15, .2, .01], [-.3, .2, .01, .1], [-.1, .2, .01, .1]]) box(g, w, .06, d, glassMat('#e6f6ff', .3), [x, .95, z], { noOl: true, r: .004 });
  const ty = 1.6, rails = [-1, 1].map(s => box(g, .02, .02, D - .06, ch, [s * (W / 2 - .05), ty, 0], { r: .006 }));
  const bridge = box(g, W - .1, .025, .03, ch, [0, ty, 0], { r: .008 }), trolley = box(g, .07, .04, .07, plastic('#2a2b30'), [0, ty - .02, 0], { r: .012 });
  const claw = new THREE.Group(); g.add(claw);
  const cable = cyl(g, .003, .003, 1, ch, [0, 0, 0], { noOl: true, n: 8 });
  cyl(claw, .028, .034, .04, ch, [0, 0, 0]); ball(claw, .02, ch, [0, -.025, 0]);
  const prongs = [0, 1, 2].map(i => { const p = new THREE.Group(); p.rotation.y = i * TAU / 3; p.position.y = -.02; claw.add(p); const h = new THREE.Group(); h.position.z = .024; p.add(h); cyl(h, .0055, .0055, .075, ch, [0, -.037, 0]); cyl(h, .005, .005, .03, ch, [0, -.078, -.01], { rot: [.9, 0, 0] }); return h; });
  const st = { x: o.clawX ?? .3, z: o.clawZ ?? -.2, drop: o.drop ?? 0, open: o.open ?? .3 };
  const apply = () => {
    const cx = st.x * (W / 2 - .12), cz = st.z * (D / 2 - .12), top = ty - .04, L = .05 + st.drop * .5;
    bridge.position.z = cz; trolley.position.set(cx, ty - .02, cz); claw.position.set(cx, top - L, cz);
    cable.position.set(cx, top - L / 2, cz); cable.scale.y = L;
    prongs.forEach(h => { h.rotation.x = -(.12 + st.open * .55); });
  };
  apply();
  box(g, W + .02, .05, D + .02, trim, [0, 1.685, 0], { r: .015 });
  box(g, W - .1, .012, .04, glow('#ffffff', 1.2), [0, 1.652, .1], { noOl: true, r: .004 });
  box(g, W, .26, .1, body, [0, 1.82, F - .05], { r: .03 });
  decal(g, W - .06, .21, ctex('grabo', 512, 136, (x, w, h) => { vgrad(x, w, h, '#ffe36a', '#ffb02e'); for (let i = 0; i < 10; i++) { const R2 = rnd(i + 30); star(x, R2() * w, R2() * h, 10, 4); x.fillStyle = '#ffffff'; x.fill(); } tx(x, 'GRAB-O', w / 2, h * .55, h * .6, '#e2432f', { stroke: '#ffffff', sw: 12, skew: .1 }); }), [0, 1.82, F + .0005], { glow: 1 });
  Object.assign(g.userData, { claw, pile, setClaw(x, z, drop = st.drop, open = st.open) { Object.assign(st, { x, z, drop, open }); apply(); return g; } });
  return ink(g, 1.95, { k: .0055 });
});

function drawATM(x, w, h, page = 'welcome', o = {}) {
  vgrad(x, w, h, '#1f4fa8', '#0e2a66'); x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, 0, w, h * .18);
  tx(x, 'CASH 24', w * .06, h * .09, h * .08, '#ffffff', { align: 'left' });
  if (page === 'pin') { tx(x, 'ENTER YOUR PIN', w / 2, h * .38, h * .08, '#ffffff'); for (let i = 0; i < 4; i++) circ(x, w * (.35 + i * .1), h * .55, h * .03, i < (o.digits ?? 2) ? '#ffffff' : 'rgba(255,255,255,.25)'); }
  else if (page === 'amount') { tx(x, 'WITHDRAW', w / 2, h * .3, h * .07, 'rgba(255,255,255,.75)'); ['$20', '$50', '$100', '$200'].forEach((s, i) => { const X = i % 2 ? w * .55 : w * .05, Y = h * (.45 + Math.floor(i / 2) * .22); rr(x, X, Y, w * .4, h * .16, h * .03, '#ffffff'); tx(x, s, X + w * .2, Y + h * .08, h * .08, '#16336e'); }); }
  else if (page === 'cash') { tx(x, 'PLEASE TAKE', w / 2, h * .42, h * .08, '#ffffff'); tx(x, 'YOUR CASH', w / 2, h * .55, h * .1, '#ffd84a'); }
  else { tx(x, 'WELCOME', w / 2, h * .42, h * .12, '#ffffff'); tx(x, 'please insert your card', w / 2, h * .58, h * .06, 'rgba(255,255,255,.8)', { w: 600 }); rr(x, w * .42, h * .7, w * .16, h * .1, 6, '#ffd84a'); }
  glare(x, w, h, .06);
}
def('atm', ['machine', 'bank', 'city', 'screen'], 'cash machine kiosk "CASH 24" (1.72 m): lit header, recessed screen with side keys, sloped keypad, glowing card slot, cash slot with a bill stack. o.page: welcome | pin | amount | cash. userData.screen/draw(fn)/page(name, o), cash (bill stack mesh: animate its position.z to dispense)', o => {
  const g = new THREE.Group(), dark = plastic('#3d4552'), light = plastic('#cfd5dd', { rough: .4 }), ch = chrome(), blk = plastic('#1b1c21'), W = .62;
  box(g, W, .98, .55, dark, [0, .49, 0], { r: .02 });
  box(g, W, .6, .3, light, [0, 1.28, -.11], { r: .02 });
  const kp = new THREE.Group(); kp.position.set(0, .99, .17); kp.rotation.x = .25; g.add(kp);
  box(kp, W, .05, .24, light, [0, 0, 0], { r: .015 });
  decal(kp, .26, .17, ctex('atm-keys', 260, 170, (x, w, h) => { x.fillStyle = '#b9c0c9'; x.fillRect(0, 0, w, h); const L = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '']; for (let i = 0; i < 12; i++) { const X = 10 + (i % 3) * 52, Y = 8 + Math.floor(i / 3) * 40; rr(x, X, Y + 3, 44, 32, 6, '#7d848e'); rr(x, X, Y, 44, 32, 6, '#eef0f3'); tx(x, L[i], X + 22, Y + 17, 18, '#2b2d33'); } [['#e2432f', 'X'], ['#f6c945', '<'], ['#3fae4a', 'OK']].forEach(([c, s], i) => { rr(x, 176, 8 + i * 54, 74, 44, 6, c); tx(x, s, 213, 31 + i * 54, 18, '#fff'); }); }), [-.05, .0255, 0], { rot: UP });
  box(g, .4, .32, .03, blk, [0, 1.32, .045], { r: .015 });
  const t = tex(400, 300, (x, w, h) => drawATM(x, w, h, o.page, o));
  decal(g, .32, .24, t, [0, 1.32, .0605], { glow: 1.15 });
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) box(g, .03, .02, .015, plastic('#9aa1ab'), [s * .19, 1.38 - i * .055, .066], { r: .004 });
  for (const s of [-1, 1]) box(g, .02, .36, .11, light, [s * .22, 1.32, .09], { r: .008 });
  box(g, .09, .03, .03, ch, [.17, 1.12, .055], { r: .008 }); box(g, .06, .004, .004, glow('#3dff6a', 2.4), [.17, 1.12, .0715], { noOl: true });
  box(g, .07, .015, .02, ch, [-.17, 1.12, .05], { r: .005 });
  box(g, .24, .05, .03, ch, [0, .88, .285], { r: .01 }); box(g, .2, .012, .004, blk, [0, .88, .3005], { noOl: true });
  const cash = box(g, .16, .008, .08, plastic('#7fbf6a'), [0, .88, .26], { r: .002 });
  box(g, W, .16, .32, plastic(o.color || '#2f6fd1'), [0, 1.64, -.1], { r: .02 });
  decal(g, W - .05, .12, ctex('cash24' + (o.color || ''), 400, 78, (x, w, h) => { x.fillStyle = o.color || '#2f6fd1'; x.fillRect(0, 0, w, h); tx(x, 'CASH 24', w / 2, h * .54, h * .62, '#ffffff', { glow: 8 }); }), [0, 1.64, .0605], { glow: 1 });
  screenApi(g, t, { cash, page: (p, oo = {}) => redraw(t, (x, w, h) => drawATM(x, w, h, p, { ...o, ...oo })) });
  return ink(g, 1.72, { k: .0055 });
});

function drawVFD(x, w, h, v, col = '#4fffd2') { x.fillStyle = '#04100e'; x.fillRect(0, 0, w, h); seg7R(x, String(v), w * .94, h * .2, h * .6, col, 'rgba(80,255,210,.07)', 6); }
def('cash_register', ['machine', 'shop'], 'shop cash register (0.42 m wide, on a counter): cream body, sloped keys, glowing green amount display on a post, drawer with bills and coins. o.amount. userData.drawer, open(k 0..1), set(amount), screen/draw(fn)', o => {
  const g = new THREE.Group(), cream = plastic(o.color || '#e8dcc0', { rough: .5 }), cd = plastic('#cdbd98'), blk = plastic('#2a2b30'), ch = chrome();
  box(g, .42, .1, .4, cream, [0, .05, 0], { r: .012 });
  const drawer = new THREE.Group(); drawer.position.set(0, .05, .2); g.add(drawer);
  box(drawer, .38, .072, .02, cd, [0, 0, .002], { r: .006 }); box(drawer, .12, .014, .014, ch, [0, .006, .016], { r: .005 });
  box(drawer, .36, .055, .32, plastic('#3a3d44'), [0, -.004, -.16], { r: .006 });
  for (let i = 0; i < 4; i++) box(drawer, .07, .012, .1, plastic('#7fbf6a'), [-.13 + i * .087, .026, -.08], { r: .002 });
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) cyl(drawer, .012, .012, .004, i % 2 ? toonMat('#e9b44c', { metal: .4, rough: .35 }) : ch, [-.13 + i * .087, .024 + k * .004, -.22], { noOl: true });
  box(g, .4, .1, .26, cream, [0, .14, -.06], { r: .025 });
  const kp = new THREE.Group(); kp.position.set(0, .2, .02); kp.rotation.x = .38; g.add(kp);
  box(kp, .38, .03, .2, cd, [0, 0, 0], { r: .012 });
  decal(kp, .34, .17, ctex('reg-keys', 340, 170, (x, w, h) => { x.fillStyle = '#cdbd98'; x.fillRect(0, 0, w, h); const L = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '00', '.']; for (let i = 0; i < 12; i++) { const X = 10 + (i % 3) * 52, Y = 8 + Math.floor(i / 3) * 40; rr(x, X, Y + 3, 44, 32, 7, '#8a7a5a'); rr(x, X, Y, 44, 32, 7, '#f6f1e2'); tx(x, L[i], X + 22, Y + 17, 18, '#3a2a1a'); } [['DEPT', '#3f6fd1', 0], ['VOID', '#f6c945', 1], ['TOTAL', '#e2432f', 2]].forEach(([s, c, i]) => { rr(x, 176, 8 + i * 54, 150, 44, 7, c); tx(x, s, 251, 31 + i * 54, 18, '#fff'); }); }), [0, .0155, 0], { rot: UP });
  cyl(g, .012, .012, .12, ch, [0, .25, -.15]);
  box(g, .17, .065, .05, blk, [0, .33, -.15], { r: .012 });
  const t = tex(256, 80, (x, w, h) => drawVFD(x, w, h, o.amount ?? '12.50'));
  decal(g, .15, .045, t, [0, .33, -.1245], { glow: 1.25 }); decal(g, .15, .045, t, [0, .33, -.1755], { glow: 1.25, rot: [0, PI, 0] });
  box(g, .1, .05, .08, cream, [-.13, .215, -.15], { r: .015 });
  decal(g, .06, .1, ctex('receipt', 60, 100, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.fillStyle = '#9aa0aa'; for (let i = 0; i < 7; i++) x.fillRect(6, 10 + i * 12, w * (.4 + (i * 37 % 5) / 10), 3); }), [-.13, .29, -.12], { rot: [-.25, 0, 0], double: true });
  const open = k => { drawer.position.z = .2 + clamp(k) * .24; return g; };
  open(o.open ?? 0);
  screenApi(g, t, { drawer, open, set: v => redraw(t, (x, w, h) => drawVFD(x, w, h, v)) });
  return ink(g, .42);
});

// a vertical pin-board ball machine (original): balls launched up the left rail, falling through the pins (deterministic)
function drawBoard(x, w, h) {
  const cx = w / 2, cy = h / 2, gr = x.createRadialGradient(cx, cy, 0, cx, cy, w / 2); gr.addColorStop(0, '#ffe680'); gr.addColorStop(.55, '#ff7a3a'); gr.addColorStop(1, '#8a1f6a'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 18; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,0)'; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, w, i / 18 * TAU, (i + 1) / 18 * TAU); x.fill(); }
  star(x, cx, h * .2, w * .07, w * .03); x.fillStyle = '#ffffff'; x.fill(); tx(x, 'BALL RUSH', cx, h * .82, h * .07, '#ffffff', { stroke: '#8a1f6a', sw: 6 });
  for (const [a, c] of [[.3, '#4fe0ff'], [.7, '#7dff6a']]) { circ(x, w * a, h * .66, w * .05, c, '#ffffff', 4); }
}
def('ball_machine', ['machine', 'arcade', 'casino'], 'vertical pin-board ball machine "BALL RUSH" (original, 1.86 m on its stand): round glass playfield with brass pins, silver balls launched up a rail and bouncing down through the pins, centre slot display, chasing border lights, ball tray. o.balls (moving balls, 10), o.color. userData.feature(text) sets the centre display', o => {
  const g = new THREE.Group(), col = o.color || '#7a1f2a', stand = plastic(col, { rough: .45 }), gold = toonMat('#e9b44c', { metal: .35, rough: .35 }), ch = chrome(), W = .58, cy = 1.3, R0 = .25, zf = .2;
  box(g, .6, .8, .45, stand, [0, .4, 0], { r: .02 });
  box(g, W, .92, .2, gold, [0, .8 + .46, .1], { r: .025 });
  const bev = .01, fr = rrShape(W - .02 - 2 * bev, .9 - 2 * bev, .04); const hole = new THREE.Path(); hole.absarc(0, cy - 1.26, R0 + bev, 0, TAU, true); fr.holes.push(hole);
  mk(g, exGeo('ball-frame', fr, .04, bev, 48), plastic(o.frame || '#2f4fb8', { rough: .32 }), [0, 1.26, zf + .02]).userData.th = .6;
  tor(g, R0 + .006, .008, gold, [0, cy, zf + .041], { rs: 8, ts: 64 });
  for (const [x, y] of [[-.22, 1.66], [.22, 1.66], [-.22, .87], [.22, .87]]) cyl(g, .012, .012, .006, gold, [x, y, zf + .042], { rot: AX, noOl: true });
  discDecal(g, R0 + .004, ctex('ball-board', 512, 512, drawBoard), [0, cy, zf + .002], { glow: .55 });
  const pinG = rcylGeo(.003, .003, .03, .0012, 8), pins = new THREE.InstancedMesh(pinG, toonMat('#ffd36a', { metal: .3, rough: .3 }), 160), m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(PI / 2, 0, 0)), PR = rnd(5);
  let n = 0; for (let j = 0; j < 14 && n < 160; j++) for (let i = 0; i < 14 && n < 160; i++) { const x = -R0 + .03 + i * .034 + (j % 2) * .017, y = cy - R0 + .05 + j * .032; if (Math.hypot(x, y - cy) > R0 - .035 || (Math.abs(x) < .075 && Math.abs(y - cy - .01) < .06) || PR() < .12) continue; m4.compose(V(x, y, zf + .017), q, V(1, 1, 1)); pins.setMatrixAt(n++, m4); }
  pins.count = n; pins.userData.noOutline = true; g.add(pins);
  const pts = []; for (let i = 0; i <= 24; i++) { const a = PI * 1.25 - i / 24 * PI * .78; pts.push([Math.cos(a) * (R0 - .012), cy + Math.sin(a) * (R0 - .012), zf + .012]); }
  tube(g, 'ball-rail', pts, .0035, ch, { n: 48, rs: 6 });
  box(g, .14, .1, .03, gold, [0, cy + .01, zf + .015], { r: .01 });
  const ft = tex(192, 112, (x, w, h) => drawFeature(x, w, h, o.feature || '777'));
  decal(g, .11, .07, ft, [0, cy + .01, zf + .031], { glow: 1.2 });
  cyl(g, .018, .022, .02, gold, [0, cy - .1, zf + .018], { rot: AX });
  mk(g, circGeo(R0 + .002, 48), glassMat('#eef8ff', .1), [0, cy, zf + .036]).userData.noOutline = true;
  decal(g, R0 * 2, R0 * 2, null, [0, cy, zf + .037], { geo: circGeo(R0, 48), mat: streakMat() });
  const bm = toonMat('#f4f7fa', { metal: .3, rough: .2 }), NB = o.balls ?? 10, balls = [];
  for (let i = 0; i < NB; i++) balls.push(ball(g, .0062, bm, [0, -10, zf + .02], null, { noOl: true, w: 12, h: 8 }));
  const ring = [], rA = own('#ffe9a0', { ei: 2 }), rB = own('#ff6ab0', { ei: .3 });
  for (let i = 0; i < 22; i++) { const a = i / 22 * TAU; ring.push(ball(g, .009, i % 2 ? rA : rB, [Math.cos(a) * (R0 + .022), cy + Math.sin(a) * (R0 + .022), zf + .044], null, { noOl: true, w: 10, h: 8 })); }
  box(g, .38, .05, .13, chrome('#8d949c'), [0, .84, .28], { r: .015 });
  const pile = new THREE.InstancedMesh(sphGeo(.0062, 10, 8), bm, 60); pile.userData.noOutline = true; const BR = rnd(11);
  for (let i = 0; i < 60; i++) { m4.makeTranslation((BR() - .5) * .32, .868 + BR() * .012 + (i > 40 ? .01 : 0), .28 + (BR() - .5) * .09); pile.setMatrixAt(i, m4); } g.add(pile);
  cyl(g, .032, .032, .04, ch, [.21, .95, .23], { rot: AX }); tor(g, .036, .007, plastic('#24252b'), [.21, .95, .25]);
  box(g, W, .14, .14, stand, [0, 1.79, .12], { r: .02 });
  decal(g, W - .04, .1, ctex('ballrush', 400, 70, (x, w, h) => { vgrad(x, w, h, '#ff4fa3', '#a01f6a'); tx(x, 'BALL RUSH', w / 2, h * .55, h * .66, '#ffe36a', { stroke: '#5a0a3a', sw: 8, glow: 10 }); }), [0, 1.79, .1905], { glow: 1 });
  const path = (i, t) => {   // ball i at time t: up the rail, then down through the pins
    const P = 2.6, u = ((t / P + i / NB) % 1 + 1) % 1, cyc = Math.floor(t / P + i / NB);
    if (u < .16) { const a = PI * 1.25 - (u / .16) * PI * .78; return [Math.cos(a) * (R0 - .012), cy + Math.sin(a) * (R0 - .012)]; }
    const k = (u - .16) / .84, rows = 12, j = Math.min(rows - 1, Math.floor(k * rows)), f = k * rows - j;
    let x = Math.cos(PI * .47) * (R0 - .02); const xs = [x];
    for (let r = 0; r < rows; r++) { x += (hash(r + cyc * 13, i * 7 + 1) - .55) * .07; x = clamp(x, -R0 + .05, R0 - .05); xs.push(x); }
    const y0 = cy + R0 - .03, y1 = cy - R0 + .03, yy = lerp(y0, y1, (j + f) / rows) + Math.sin(f * PI) * .006;
    const xx = lerp(xs[j], xs[j + 1], E.inOutSine(f)), lim = Math.sqrt(Math.max(0, (R0 - .02) ** 2 - (yy - cy) ** 2));
    return [clamp(xx, -lim, lim), yy];
  };
  Object.assign(g.userData, {
    balls, screen: ft, draw: fn => { redraw(ft, fn); return g; }, feature: s => { redraw(ft, (x, w, h) => drawFeature(x, w, h, s)); return g; },
    update(t) { balls.forEach((b, i) => { const [x, y] = path(i, t); b.position.set(x, y, zf + .02); }); const k = Math.floor(t * 8) % 2; rA.emissiveIntensity = k ? 2.2 : .3; rB.emissiveIntensity = k ? .3 : 2.2; },
  });
  g.userData.update(0);
  return ink(g, 1.86, { k: .0055 });
});
function drawFeature(x, w, h, s) { x.fillStyle = '#0a0620'; x.fillRect(0, 0, w, h); const d = String(s).split(''); d.forEach((c, i) => { rr(x, w * (.06 + i * .31), h * .12, w * .26, h * .76, 8, '#fbf3df'); tx(x, c, w * (.19 + i * .31), h * .52, h * .6, '#e2322a', { stroke: OL, sw: 5 }); }); }

function btnTex(label) { return ctex('elev:' + label, 96, 96, (x, w, h) => { x.clearRect(0, 0, w, h); if (label === 'bell') { x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(w * .3, h * .62); x.quadraticCurveTo(w * .3, h * .25, w * .5, h * .25); x.quadraticCurveTo(w * .7, h * .25, w * .7, h * .62); x.closePath(); x.fill(); x.fillRect(w * .26, h * .6, w * .48, h * .07); circ(x, w * .5, h * .74, w * .06, '#ffffff'); } else tx(x, label, w / 2, h * .54, h * (label.length > 1 ? .5 : .6), '#ffffff'); }); }
function drawFloor(x, w, h, n, dir) { x.fillStyle = '#100604'; x.fillRect(0, 0, w, h); seg7R(x, String(n), w * .72, h * .16, h * .68, '#ffb02e', 'rgba(255,170,40,.08)', 2); if (dir) { x.fillStyle = '#ffb02e'; x.shadowColor = '#ffb02e'; x.shadowBlur = 8; x.beginPath(); const y = h / 2, s = h * .22; if (dir > 0) { x.moveTo(w * .12, y + s); x.lineTo(w * .2, y - s); x.lineTo(w * .28, y + s); } else { x.moveTo(w * .12, y - s); x.lineTo(w * .2, y + s); x.lineTo(w * .28, y - s); } x.fill(); } }
def('elevator_panel', ['machine', 'building', 'screen'], 'elevator button panel, wall-mounted (origin on the floor at the wall, back at z = 0, panel centre ~1.25 m): floor display with arrow, two columns of round numbered buttons that light up one by one, alarm bell. o.floors (12), o.style: steel | brass, o.lit colour or o.rainbow, o.pressed [floors lit at start], o.h (panel centre). userData.light(n, on, colour) (n = floor number or "bell"), press(n, on), lightAll(on), floor(n, dir), buttons', o => {
  const g = new THREE.Group(), N = o.floors ?? 12, rows = Math.ceil(N / 2), brass = o.style === 'brass', plate = toonMat(brass ? '#c99a4a' : '#c4ccd4', { metal: .4, rough: .4 }), ring = chrome(brass ? '#e2c27a' : '#dfe4ea');
  const bh = .07, H = rows * bh + .3, cy = o.h ?? 1.25, W = .26, y0 = cy - H / 2;
  box(g, W, H, .024, plate, [0, cy, .012], { r: .012 });
  box(g, .17, .065, .012, plastic('#1b1c21'), [0, y0 + H - .065, .03], { r: .008 });
  const ft = tex(192, 72, (x, w, h) => drawFloor(x, w, h, o.floor ?? 1, 0));
  decal(g, .15, .052, ft, [0, y0 + H - .065, .0365], { glow: 1.2 });
  const labels = [...Array(N)].map((_, i) => String(i + 1)).concat(['bell']), buttons = {};
  labels.forEach((lb, i) => {
    let x, y; if (lb === 'bell') { x = 0; y = y0 + .07; } else { const col = i < rows ? 0 : 1, r = col ? i - rows : i; x = col ? .055 : -.055; y = y0 + .13 + r * bh; }
    tor(g, .022, .0042, ring, [x, y, .026], { rs: 8, ts: 28 });
    const face = own(lb === 'bell' ? '#e8b02a' : '#f2efe6', { rough: .35 });
    cyl(g, .019, .019, .01, face, [x, y, .028], { rot: AX, n: 24 });
    const nm = basicTex(btnTex(lb)); nm.color.set(lb === 'bell' ? '#3a2a10' : '#4a4d55');
    decal(g, .03, .03, null, [x, y, .0336], { mat: nm });
    buttons[lb] = { face, num: nm, x, y };
  });
  const hue = i => `hsl(${(i * 360 / N) % 360}, 90%, 62%)`;
  const light = (n, on = true, colr) => {
    const b = buttons[String(n)]; if (!b) return g; const i = +n - 1, c = colr || (o.rainbow ? hue(i) : o.lit || '#ffcf5a');
    b.face.color.set(on ? c : (n === 'bell' ? '#e8b02a' : '#f2efe6')); b.face.emissive.set(c); b.face.emissiveIntensity = on ? .85 : 0; b.num.color.set(on ? shade('#' + new THREE.Color(c).getHexString(), -.72) : (n === 'bell' ? '#3a2a10' : '#4a4d55'));
    return g;
  };
  Object.assign(g.userData, { buttons, light, press: light, lightAll: (on = true) => { labels.forEach(l => l !== 'bell' && light(l, on)); return g; }, floor: (n, dir = 0) => { redraw(ft, (x, w, h) => drawFloor(x, w, h, n, dir)); return g; }, screen: ft, draw: fn => { redraw(ft, fn); return g; }, solid: false });
  for (const n of [].concat(o.pressed || [])) light(n, true);
  return ink(g, H, { k: .009 });
});

function drawScope(x, w, h, t = 0, kind = 'wave') {
  x.fillStyle = '#031a0e'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(80,255,140,.18)'; x.lineWidth = 1; for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(i * w / 6, 0); x.lineTo(i * w / 6, h); x.stroke(); x.beginPath(); x.moveTo(0, i * h / 6); x.lineTo(w, i * h / 6); x.stroke(); }
  x.save(); x.shadowColor = '#5dff8e'; x.shadowBlur = 6; x.strokeStyle = '#5dff8e'; x.lineWidth = 3;
  if (kind === 'radar') { x.beginPath(); x.arc(w / 2, h / 2, h * .42, 0, TAU); x.stroke(); const a = t * 2.4; x.beginPath(); x.moveTo(w / 2, h / 2); x.lineTo(w / 2 + Math.cos(a) * h * .42, h / 2 + Math.sin(a) * h * .42); x.stroke(); for (const [bx, by] of [[.62, .32], [.38, .64], [.7, .6]]) circ(x, w * bx, h * by, 4, '#5dff8e'); }
  else { x.beginPath(); for (let i = 0; i <= 60; i++) { const X = i / 60 * w, Y = h / 2 + Math.sin(i / 60 * TAU * 2 + t * 4) * h * .28 * (1 + .2 * Math.sin(t * 1.3)); i ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke(); }
  x.restore(); scan(x, w, h, .12, 3);
}
function drawStatus(x, w, h, o = {}) {
  x.fillStyle = '#071226'; x.fillRect(0, 0, w, h); x.fillStyle = '#123a6a'; x.beginPath(); x.ellipse(w * .32, h * .5, w * .22, h * .3, 0, 0, TAU); x.fill(); x.beginPath(); x.ellipse(w * .7, h * .42, w * .18, h * .24, .4, 0, TAU); x.fill();
  for (const [bx, by, c] of [[.28, .42, '#ff4a3a'], [.68, .38, '#ffd84a'], [.75, .55, '#5dff8e']]) { circ(x, w * bx, h * by, h * .04, c); circ(x, w * bx, h * by, h * .08, null, c, 2); }
  tx(x, o.text || 'SYSTEM OK', w / 2, h * .1, h * .09, '#5dff8e', { glow: 6 }); scan(x, w, h, .1, 3);
}
def('control_panel', ['machine', 'lab', 'office', 'screen'], 'control room console desk (1.3 m wide, 1.4 m tall at the back): sloped panel with knobs, toggles, sliders, blinking lamps, a big red button, an oscilloscope and a radar, upright back panel with a status map screen. userData.screen/draw(fn) (the big screen), redButton (mesh), lamps (materials)', o => {
  const g = new THREE.Group(), col = o.color || '#5d7187', body = plastic(col, { rough: .5 }), top = plastic(shade(col, .18)), blk = plastic('#24262c'), wht = plastic('#eef0f3');
  box(g, 1.3, .76, .6, body, [0, .38, 0], { r: .02 });
  decal(g, 1.2, .64, ctex('cp-front:' + col, 480, 256, (x, w, h) => { x.fillStyle = col; x.fillRect(0, 0, w, h); const d = shade(col, -.3), l = shade(col, .12);
    for (const X of [8, w / 2 + 4]) { rr(x, X, 8, w / 2 - 12, h - 16, 10, null, d, 4); rr(x, X + 3, 11, w / 2 - 18, h - 22, 8, null, l, 1.5); rr(x, X + (X < w / 2 ? w / 2 - 34 : 14), h / 2 - 22, 10, 44, 4, '#2a2d33'); }
    x.fillStyle = d; for (let i = 0; i < 7; i++) rr(x, w * .12, h * .62 + i * 11, w * .22, 5, 2.5, d);
    rr(x, w * .64, h * .14, w * .2, h * .12, 4, '#e8ecf2', d, 2); tx(x, 'UNIT 03', w * .74, h * .2, h * .07, '#2a2d33'); }), [0, .4, .3005]);
  const sl = new THREE.Group(); sl.position.set(0, .85, .1); sl.rotation.x = .5; g.add(sl);
  box(sl, 1.3, .05, .44, top, [0, 0, 0], { r: .015 });
  const scope = tex(160, 110, (x, w, h) => drawScope(x, w, h, 0, 'wave')), radar = tex(128, 128, (x, w, h) => drawScope(x, w, h, 0, 'radar'));
  box(sl, .25, .012, .18, blk, [-.46, .028, -.02], { r: .01 }); decal(sl, .22, .15, scope, [-.46, .0345, -.02], { rot: UP, glow: 1.1 });
  box(sl, .2, .012, .2, blk, [.46, .028, -.02], { r: .01 }); decal(sl, .17, .17, radar, [.46, .0345, -.02], { rot: UP, glow: 1.1 });
  for (let i = 0; i < 5; i++) { const x = -.22 + i * .09; cyl(sl, .022, .026, .028, blk, [x, .04, -.1]); box(sl, .005, .006, .02, wht, [x, .056, -.106], { noOl: true, rot: [0, i * .7 - 1.2, 0] }); }
  for (let i = 0; i < 6; i++) { const x = -.24 + i * .07; box(sl, .03, .012, .03, plastic('#9aa1ab'), [x, .03, .02], { r: .004 }); const lv = cyl(sl, .004, .004, .03, wht, [x, .045, .02 + (i % 2 ? .006 : -.006)], { rot: [i % 2 ? .5 : -.5, 0, 0] }); void lv; }
  for (let i = 0; i < 3; i++) { const x = -.24 + i * .06; box(sl, .012, .006, .1, blk, [x, .027, .14], { r: .003, noOl: true }); box(sl, .032, .016, .018, wht, [x, .036, .1 + i * .025], { r: .004 }); }
  decal(sl, .1, .1, ctex('hazard', 64, 64, (x, w, h) => { x.fillStyle = '#ffd84a'; x.fillRect(0, 0, w, h); x.fillStyle = '#1d1e22'; for (let i = -4; i < 8; i++) { x.beginPath(); x.moveTo(i * 12, 0); x.lineTo(i * 12 + 6, 0); x.lineTo(i * 12 + 6 - 64, h); x.lineTo(i * 12 - 64, h); x.fill(); } }), [.2, .0256, .1], { rot: UP, r: .02 });
  const red = cyl(sl, .03, .034, .03, glossy('#e2322a'), [.2, .04, .1]);
  const lamps = ['#ff4a3a', '#ffd84a', '#5dff8e', '#4fc3ff'].map(c => own(c, { ei: 1.5 }));
  for (let i = 0; i < 10; i++) ball(sl, .011, lamps[i % 4], [-.24 + i * .055, .03, -.19], [1, .6, 1], { noOl: true, w: 12, h: 8 });
  box(g, 1.3, .44, .08, body, [0, 1.18, -.26], { r: .02 });
  box(g, .54, .32, .02, blk, [0, 1.2, -.212], { r: .012 });
  const t = tex(400, 240, (x, w, h) => drawStatus(x, w, h, o));
  decal(g, .5, .28, t, [0, 1.2, -.2005], { glow: 1.1 });
  for (const s of [-1, 1]) { box(g, .2, .12, .02, blk, [s * .45, 1.27, -.212], { r: .01 }); decal(g, .18, .1, ctex('vu', 180, 100, (x, w, h) => { x.fillStyle = '#f6efd9'; x.fillRect(0, 0, w, h); x.strokeStyle = '#3a2a1a'; x.lineWidth = 2; x.beginPath(); x.arc(w / 2, h * 1.1, h * .9, PI * 1.2, PI * 1.8); x.stroke(); x.strokeStyle = '#e2322a'; x.beginPath(); x.arc(w / 2, h * 1.1, h * .9, PI * 1.62, PI * 1.8); x.stroke(); x.strokeStyle = '#1d1e22'; x.lineWidth = 3; x.beginPath(); x.moveTo(w / 2, h * 1.05); x.lineTo(w * .62, h * .25); x.stroke(); }), [s * .45, 1.27, -.2015]); for (let i = 0; i < 4; i++) ball(g, .01, lamps[(i + (s > 0 ? 2 : 0)) % 4], [s * .45 - .06 + i * .04, 1.12, -.215], [1, 1, .6], { noOl: true, w: 12, h: 8 }); }
  Object.assign(g.userData, { lamps, redButton: red, top: .85 });
  screenApi(g, t);
  g.userData.update = tt => { lamps.forEach((m, i) => { m.emissiveIntensity = hash(Math.floor(tt * (2 + i)), i + 3) > .4 ? 1.8 : .2; }); redraw(scope, (x, w, h) => drawScope(x, w, h, tt, 'wave')); redraw(radar, (x, w, h) => drawScope(x, w, h, tt, 'radar')); };
  return ink(g, 1.4, { k: .006 });
});

def('server_rack', ['machine', 'office', 'lab'], 'data-centre server rack (2 m tall): twelve servers with drive bays and blinking green / amber / blue LEDs, vented top. o.color', o => {
  const g = new THREE.Group(), frame = plastic(o.color || '#24262c', { rough: .45 }), W = .6, H = 2, D = .8, F = D / 2;
  box(g, W, H, D, frame, [0, H / 2 + .02, 0], { r: .02 });
  for (const s of [-1, 1]) for (const z of [-1, 1]) cyl(g, .025, .025, .02, plastic('#3a3d44'), [s * .25, .01, z * .33]);
  decal(g, W - .06, D - .06, ctex('rack-top', 128, 160, (x, w, h) => { x.fillStyle = '#1d1e23'; x.fillRect(0, 0, w, h); for (let j = 0; j < 14; j++) for (let i = 0; i < 10; i++) circ(x, 8 + i * 12, 8 + j * 11, 3.4, '#0b0b0e'); }), [0, H + .0205, 0], { rot: UP });
  const bays = ctex('rack-bays', 512, 120, (x, w, h) => { x.fillStyle = '#3b3f48'; x.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { rr(x, 12 + i * 58, 14, 50, h - 28, 5, '#2a2d33'); x.fillStyle = '#5a5f6a'; for (let k = 0; k < 4; k++) x.fillRect(18 + i * 58, 24 + k * 18, 38, 4); } rr(x, 380, 20, 120, 30, 6, '#e8ecf2'); x.fillStyle = '#5a5f6a'; x.fillRect(384, 24, 112, 22); });
  const grp = ['#3dff6a', '#3dff6a', '#ffb02e', '#4fc3ff', '#3dff6a', '#ff4a3a'].map(c => own(c, { ei: 1.6 }));
  for (let u = 0; u < 12; u++) {
    const y = .12 + u * .148;
    box(g, .54, .13, .03, plastic(u % 3 === 1 ? '#454a55' : '#3b3f48'), [0, y, F + .002], { r: .006 });
    decal(g, .52, .12, bays, [0, y, F + .0175]);
    for (let k = 0; k < 4; k++) box(g, .008, .006, .004, grp[(u * 3 + k * 5) % grp.length], [.13 + k * .018, y - .03, F + .0185], { r: .002, noOl: true });
    for (const s of [-1, 1]) box(g, .012, .06, .012, plastic('#9aa1ab'), [s * .255, y, F + .022], { r: .004 });
  }
  g.userData.update = t => grp.forEach((m, i) => { m.emissiveIntensity = hash(Math.floor(t * (3 + i * 2.3)), i * 5 + 1) > .3 ? 2 : .12; });
  return ink(g, 2, { k: .0055 });
});

def('satellite_dish', ['machine', 'city', 'outdoor'], 'satellite dish on a pole (1.45 m, dish 0.9 m across): white parabolic dish tilted to the sky, feed arm with the receiver. o.tilt (radians up), o.color. userData.dish (pivot: aim it)', o => {
  const g = new THREE.Group(), white = plastic(o.color || '#eceff2', { rough: .45 }), grey = plastic('#8d939d'), dark = plastic('#2a2b30');
  cyl(g, .18, .2, .04, grey, [0, .02, 0]); cyl(g, .035, .04, 1.0, grey, [0, .54, 0]); box(g, .12, .1, .1, dark, [0, 1.04, 0], { r: .02 });
  const dish = new THREE.Group(); dish.position.set(0, 1.08, .06); dish.rotation.x = -(o.tilt ?? .5); g.add(dish);
  const R = .45, f = .34, t = .02, P = [];
  for (let i = 0; i <= 16; i++) { const r = i / 16 * R; P.push([r, r * r / (4 * f) - t]); }
  P.push([R + .006, R * R / (4 * f) - t * .5]);
  for (let i = 16; i >= 0; i--) { const r = i / 16 * R; P.push([r, r * r / (4 * f)]); }
  const dg = latheGeo('dish', P, 56);
  const dm = mk(dish, dg, white, [0, 0, 0], [PI / 2, 0, 0]); dm.userData.th = .9;
  cyl(dish, .1, .12, .05, grey, [0, 0, -.03], { rot: AX });
  const foc = V(0, 0, f);
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + PI / 2, rim = [Math.cos(a) * R * .95, Math.sin(a) * R * .95, R * R * .9 / (4 * f)]; rod(dish, rim, [foc.x, foc.y, foc.z - .03], .007, grey); }
  box(dish, .05, .05, .09, dark, [0, 0, f], { r: .012 });
  g.userData.dish = dish;
  return ink(g, 1.45);
});

def('antenna_tower', ['machine', 'city', 'outdoor'], 'radio / cell antenna lattice tower (o.h, default 6 m): three red and white legs, cross bracing, panel antennas, a small dish and a blinking red beacon on top', o => {
  const g = new THREE.Group(), H = o.h ?? 6, red = plastic('#d9452f'), wht = plastic('#f2f0ea'), grey = plastic('#9aa1ab'), n = 6;
  const leg = (i, h) => { const a = i / 3 * TAU + PI / 6, r = lerp(.9, .22, h / H); return [Math.cos(a) * r, h, Math.sin(a) * r]; };
  for (let s = 0; s < n; s++) {
    const h0 = s * H / n, h1 = (s + 1) * H / n;
    for (let i = 0; i < 3; i++) {
      rod(g, leg(i, h0), leg(i, h1), .035, s % 2 ? wht : red);
      const j = (i + 1) % 3; rod(g, leg(i, h0), leg(j, h1), .012, grey); rod(g, leg(j, h0), leg(i, h1), .012, grey); rod(g, leg(i, h1), leg(j, h1), .014, grey);
    }
  }
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU, p = [Math.cos(a) * .3, H - .5, Math.sin(a) * .3]; const b = box(g, .12, .6, .06, plastic('#f4f4f2'), p, { r: .02 }); b.rotation.y = -a + PI / 2; }
  cyl(g, .25, .25, .03, grey, [0, H, 0]);
  rod(g, [0, H, 0], [0, H + .9, 0], .025, red);
  const dish = new THREE.Group(); dish.position.set(.2, H - 1.4, .2); dish.rotation.set(0, PI / 4, 0); g.add(dish);
  mk(dish, latheGeo('mini-dish', [[0, -.02], [.18, .03], [.19, .045], [0, .0]], 24), plastic('#eceff2'), [0, 0, 0], [PI / 2, 0, 0]).userData.th = .38;
  const beacon = own('#ff2a1a', { ei: 2.2 });
  ball(g, .045, beacon, [0, H + .93, 0], null, { noOl: true });
  g.userData.update = t => { beacon.emissiveIntensity = (t % 1.2) < .45 ? 2.6 : .15; };
  return ink(g, H, { k: .003 });
});

def('cctv_camera', ['machine', 'city', 'building'], 'security camera on a wall bracket (origin on the floor at the wall, back at z = 0, mounted at o.h = 2.4 m): white housing with a sun hood, lens, blinking red light. o.sweep: true pans it slowly. userData.head (pivot: aim it)', o => {
  const g = new THREE.Group(), h = o.h ?? 2.4, white = plastic('#eef0f2', { rough: .4 }), grey = plastic('#9aa1ab'), blk = plastic('#1d1e23');
  box(g, .1, .14, .02, white, [0, h, .01], { r: .006 });
  rod(g, [0, h - .01, .02], [0, h - .04, .18], .016, grey);
  const head = new THREE.Group(); head.position.set(0, h - .04, .2); head.rotation.x = .35; g.add(head);
  ball(head, .03, grey, [0, 0, 0]);
  box(head, .1, .085, .24, white, [0, -.02, .07], { r: .03 });
  box(head, .13, .012, .27, white, [0, .032, .085], { r: .005 });
  cyl(head, .032, .032, .02, blk, [0, -.02, .195], { rot: AX });
  cyl(head, .024, .024, .004, toonMat('#1a2a4a', { rough: .05 }), [0, -.02, .206], { rot: AX, noOl: true });
  const led = own('#ff2a1a', { ei: 2 }); ball(head, .006, led, [.036, .005, .192], null, { noOl: true });
  Object.assign(g.userData, { head, solid: false, update: t => { led.emissiveIntensity = (t % 1) < .5 ? 2.4 : .1; if (o.sweep) head.rotation.y = Math.sin(t * .5) * .7; } });
  return ink(g, .3);
});

def('signal_box', ['machine', 'city', 'outdoor'], 'roadside traffic-signal controller cabinet (1.4 m): grey-green metal box on a concrete plinth, door with handle and lock, vents, warning sticker, ID plate', o => {
  const g = new THREE.Group(), body = plastic(o.color || '#8a9a8c', { rough: .55 }), dk = plastic(shade(o.color || '#8a9a8c', -.25)), conc = matte('#a7a39a');
  box(g, .82, .16, .5, conc, [0, .08, 0], { r: .02 });
  box(g, .7, 1.12, .4, body, [0, .16 + .56, 0], { r: .025 });
  box(g, .76, .05, .46, dk, [0, 1.305, 0], { r: .02 });
  box(g, .006, 1.02, .006, dk, [0, .72, .2025], { noOl: true });
  box(g, .025, .12, .03, plastic('#3a3d44'), [.06, .78, .21], { r: .008 }); cyl(g, .012, .012, .012, chrome(), [.06, .9, .206], { rot: AX });
  for (let i = 0; i < 6; i++) box(g, .2, .012, .015, dk, [-.18, 1.12 - i * .03, .2], { r: .004, rot: [-.4, 0, 0] });
  decal(g, .12, .105, ctex('hv-sticker', 128, 112, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#ffd84a'; x.strokeStyle = '#1d1e22'; x.lineWidth = 7; x.lineJoin = 'round'; x.beginPath(); x.moveTo(w / 2, 6); x.lineTo(w - 6, h - 6); x.lineTo(6, h - 6); x.closePath(); x.fill(); x.stroke(); x.fillStyle = '#1d1e22'; x.beginPath(); x.moveTo(w * .56, h * .3); x.lineTo(w * .4, h * .62); x.lineTo(w * .52, h * .62); x.lineTo(w * .44, h * .86); x.lineTo(w * .62, h * .54); x.lineTo(w * .5, h * .54); x.closePath(); x.fill(); }), [.2, .5, .2005], { alpha: true });
  decal(g, .14, .04, ctex('sig-id', 160, 46, (x, w, h) => { x.fillStyle = '#f4f2ea'; x.fillRect(0, 0, w, h); x.strokeStyle = '#1d1e22'; x.lineWidth = 3; x.strokeRect(2, 2, w - 4, h - 4); tx(x, 'SIG 07', w / 2, h / 2, h * .55, '#1d1e22'); }), [-.18, .5, .2005]);
  return ink(g, 1.4);
});

function drawCounter(x, w, h, v, o = {}) {
  x.fillStyle = '#120405'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,60,40,.04)'; for (let i = 0; i < w; i += 6) x.fillRect(i, 0, 1, h);
  const s = (o.prefix ?? '') + (typeof v === 'number' ? Math.round(v).toLocaleString('en-US') : v);
  seg7R(x, s, w * .96, h * .15, h * .7, o.color || '#ff3a24', 'rgba(255,60,40,.09)', o.digits, { glow: h * .1 });
}
def('led_counter', ['machine', 'casino', 'screen', 'data'], 'LED number board with red seven-segment digits (data as a physical object: jackpots, prices, counters). o.digits (8), o.value, o.prefix ("$"), o.color, o.label (title band above, e.g. "JACKPOT"), o.pole: true puts it on a 2.2 m pole sign. Origin on the floor. userData.set(v), count(from, to, t0, t1, ease) animates deterministically, screen/draw(fn)', o => {
  const g = new THREE.Group(), nd = o.digits ?? 8, W = .085 * nd + .16, H = .24, D = .1, blk = plastic('#1d1f24'), y0 = o.pole ? (o.h ?? 2.2) : 0;
  if (o.pole) { cyl(g, .05, .06, y0, plastic('#8d939d'), [0, y0 / 2, 0]); cyl(g, .16, .18, .04, plastic('#6a6f78'), [0, .02, 0]); }
  box(g, W, H, D, blk, [0, y0 + H / 2, 0], { r: .025 });
  const t = tex(Math.round(64 * nd + 60), 120, (x, w, h) => drawCounter(x, w, h, o.value ?? 0, { ...o, digits: nd + 2 }));
  decal(g, W - .05, H - .05, t, [0, y0 + H / 2, D / 2 + .0015], { glow: 1.25 });
  if (o.label) { box(g, W * .7, .1, D * .8, plastic('#c21d22'), [0, y0 + H + .05, 0], { r: .02 }); decal(g, W * .7 - .04, .07, ctex('lc-label:' + o.label, 400, 70, (x, w, h) => { vgrad(x, w, h, '#e2322a', '#a01418'); tx(x, o.label, w / 2, h * .55, h * .66, '#ffd84a', { stroke: '#5a0a0a', sw: 6, glow: 8 }); }), [0, y0 + H + .05, D * .4 + .0015], { glow: 1 }); }
  let last = null, anim = null;
  const set = v => { const k = String(typeof v === 'number' ? Math.round(v) : v); if (k === last) return g; last = k; redraw(t, (x, w, h) => drawCounter(x, w, h, v, { ...o, digits: nd + 2 })); return g; };
  Object.assign(g.userData, { set, count(a, b, t0, t1, ez = 'outCubic') { anim = { a, b, t0, t1, ez: typeof ez === 'function' ? ez : E[ez] || E.outCubic }; return g; }, update(tt) { if (anim) set(lerp(anim.a, anim.b, anim.ez(seg(tt, anim.t0, anim.t1)))); }, screen: t, draw: fn => { redraw(t, fn); last = null; return g; } });
  return ink(g, Math.max(W, y0 + H), { k: .006 });
});
// =====================================================================================================================
// LAB / SCIENCE
// =====================================================================================================================
const glassRim = () => toonMat('#e4f4fa', { rough: .2 });
const liquidMat = (c, o = {}) => toonMat(c, { rough: .22, emissive: c, ei: o.glow ? .9 : .1 });
def('beaker', ['lab', 'science', 'handheld'], 'glass lab beaker (12 cm) with coloured liquid and white measuring marks. o.liquid colour, o.fill 0..1, o.glow: true makes the liquid glow', o => {
  const g = new THREE.Group(), r = .042, h = .12, liq = o.liquid || '#4fd1c5', fill = o.fill ?? .6;
  const P = [[0, 0], [r - .006, 0], [r - .001, .002], [r, .008], [r, h], [r + .004, h + .003], [r + .001, h + .006], [r - .004, h], [r - .004, .008], [r - .009, .005], [0, .005]];
  mk(g, latheGeo('beaker', P, 40), glassMat(), [0, 0, 0]).userData.noOutline = true;
  const lh = (h - .012) * fill;
  cyl(g, r - .0055, r - .0055, lh, liquidMat(liq, o), [0, .005 + lh / 2, 0], { b: .003, n: 40 });
  cyl(g, r - .009, r - .009, .002, toonMat(shade(liq, .35), { rough: .2 }), [0, .005 + lh, 0], { noOl: true, n: 40 });
  tor(g, r + .0015, .0022, glassRim(), [0, h + .003, 0], { rot: [PI / 2, 0, 0], rs: 8, ts: 40 });
  tor(g, r - .001, .002, glassRim(), [0, .004, 0], { rot: [PI / 2, 0, 0], rs: 8, ts: 40, noOl: true });
  for (let i = 0; i < 4; i++) box(g, i % 2 ? .008 : .014, .0018, .001, toonMat('#ffffff', { emissive: '#ffffff', ei: .3 }), [-.012 + (i % 2 ? -.003 : 0), .03 + i * .022, r + .0008], { noOl: true, r: .0004 });
  g.userData.grip = { at: [r, h * .5, 0], rot: [0, 0, 0] };
  return ink(g, .13);
});

def('flask', ['lab', 'science', 'handheld'], 'conical lab flask (18 cm) half full of coloured liquid; o.bubbles: true makes bubbles rise, o.glow: true makes the liquid glow. o.liquid colour, o.fill 0..1', o => {
  const g = new THREE.Group(), rb = .055, rn = .016, hc = .12, hn = .175, liq = o.liquid || '#ee5fa0', fill = o.fill ?? .45;
  const P = [[0, 0], [rb - .008, 0], [rb - .001, .004], [rb, .012], [rn + .002, hc], [rn, hc + .01], [rn, hn], [rn + .004, hn + .003], [rn + .001, hn + .006], [rn - .003, hn], [rn - .003, hc + .01], [rb - .005, .013], [rb - .01, .006], [0, .006]];
  mk(g, latheGeo('flask', P, 40), glassMat(), [0, 0, 0]).userData.noOutline = true;
  const rAt = y => rb + (rn - rb) * clamp((y - .012) / (hc - .012)), fy = .012 + (hc - .012) * fill;
  const lq = mk(g, latheGeo('flask-liq' + q4(fill), [[0, .007], [rb - .011, .007], [rb - .0065, .013], [rAt(fy) - .0045, fy], [0, fy]], 40), liquidMat(liq, o), [0, 0, 0]); lq.userData.th = .1;
  tor(g, rn + .002, .0024, glassRim(), [0, hn + .004, 0], { rot: [PI / 2, 0, 0], rs: 8, ts: 28 });
  if (o.bubbles) {
    const bm = toonMat(shade(liq, .55), { rough: .2 }), bs = [...Array(7)].map(() => ball(g, .0035, bm, [0, -1, 0], null, { noOl: true, w: 10, h: 8 }));
    g.userData.update = t => bs.forEach((b, i) => { const u = (t * .45 + i / 7) % 1, y = .012 + u * (fy - .018), rr2 = (rAt(y) - .012) * hash(i, 3); b.position.set(Math.cos(i * 2.4 + t * .8) * rr2, y, Math.sin(i * 2.4 + t * .8) * rr2); b.scale.setScalar(.6 + u * .6); });
    g.userData.update(0);
  }
  g.userData.grip = { at: [0, hn - .02, 0], rot: [0, 0, 0] };
  return ink(g, .18);
});

def('test_tube_rack', ['lab', 'science'], 'wooden test-tube rack with five glass tubes of coloured liquids (26 cm). o.colors [5], o.n', o => {
  const g = new THREE.Group(), wood = toonMat('#c08a52', { rough: .55 }), n = o.n ?? 5, cols = o.colors || ['#ee5fa0', '#2fc4b8', '#f6c945', '#8a5ad6', '#6ccf4f'], R = rnd(o.seed ?? 4);
  box(g, .26, .015, .08, wood, [0, .0075, 0], { r: .005 }); box(g, .26, .012, .08, wood, [0, .078, 0], { r: .004 });
  for (const s of [-1, 1]) box(g, .012, .07, .07, wood, [s * .124, .042, 0], { r: .004 });
  const tg = latheGeo('ttube', [[0, 0], [.006, .001], [.0095, .005], [.011, .012], [.011, .14], [.0135, .142], [.012, .145], [.0085, .14], [.0085, .012], [.006, .006], [0, .004]], 24);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * .046, f = .045 + R() * .06;
    mk(g, tg, glassMat(), [x, .016, 0]).userData.noOutline = true;
    mk(g, latheGeo('ttube-liq' + q4(f), [[0, .005], [.005, .006], [.0078, .012], [.0078, f], [0, f]], 20), liquidMat(cols[i % cols.length], o), [x, .016, 0]).userData.th = .02;
    tor(g, .0128, .0022, matte('#5a3a22'), [x, .0845, 0], { rot: [PI / 2, 0, 0], rs: 6, ts: 20, noOl: true });
  }
  return ink(g, .26);
});

def('microscope', ['lab', 'science'], 'lab microscope (40 cm), its side profile toward +z (arm on the left, eyepiece tube leaning right): cream body, black tube, objective turret, stage with a slide, lit lamp, focus knobs', o => {
  const g = new THREE.Group(), cream = plastic(o.color || '#ecebe4', { rough: .4 }), blk = plastic('#26272c'), ch = chrome();
  box(g, .15, .03, .19, cream, [0, .015, 0], { r: .012 });
  box(g, .045, .22, .05, cream, [0, .13, -.065], { r: .018, rot: [-.1, 0, 0] });
  box(g, .055, .055, .12, cream, [0, .245, -.025], { r: .02 });
  box(g, .12, .012, .11, blk, [0, .12, .02], { r: .004 });
  box(g, .07, .002, .026, glassMat('#e8f8ff', .45), [0, .127, .02], { noOl: true, r: .0008 });
  ball(g, .005, toonMat('#b03a8a'), [0, .1278, .02], [1, .3, 1], { noOl: true });
  for (const s of [-1, 1]) box(g, .006, .004, .03, ch, [s * .03, .128, .03], { noOl: true, r: .001 });
  cyl(g, .018, .018, .02, blk, [0, .104, .02]); cyl(g, .012, .012, .004, glow('#fff3c8', 1.6), [0, .093, .02], { noOl: true });
  cyl(g, .028, .03, .018, ch, [0, .205, .02]);
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + .4, ob = new THREE.Group(); ob.position.set(Math.cos(a) * .014, .19, .02 + Math.sin(a) * .014); ob.rotation.set(Math.sin(a) * .35, 0, -Math.cos(a) * .35); g.add(ob); cyl(ob, .007, .0055, .04, i ? ch : blk, [0, -.018, 0]); }
  const tb = new THREE.Group(); tb.position.set(0, .262, .0); tb.rotation.x = .5; g.add(tb);
  cyl(tb, .017, .017, .13, blk, [0, .065, 0]); cyl(tb, .015, .015, .03, blk, [0, .14, 0]); tor(tb, .015, .003, ch, [0, .155, 0], { rot: [PI / 2, 0, 0], noOl: true });
  for (const s of [-1, 1]) { cyl(g, .026, .026, .016, blk, [s * .034, .14, -.068], { rot: AZ }); cyl(g, .014, .014, .012, blk, [s * .046, .14, -.068], { rot: AZ }); }
  const side = new THREE.Group(); while (g.children.length) side.add(g.children[0]); side.rotation.y = PI / 2; g.add(side);   // the iconic side profile faces +z
  return ink(g, .4);
});

def('magnifying_glass', ['lab', 'science', 'handheld', 'detective'], 'magnifying glass (24 cm): wooden handle, brass rim, clear lens with a glint; stands on its handle end (origin) with the lens up, o.flat lays it on a table. userData.lens', o => {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const brass = toonMat(o.color || '#d9a640', { metal: .4, rough: .32 }), wood = toonMat('#5a3a22', { rough: .5 }), R = .065;
  cyl(inner, .012, .0135, .12, wood, [0, .06, 0], { b: .006 });
  cyl(inner, .0145, .012, .026, brass, [0, .132, 0]);
  tor(inner, R, .0075, brass, [0, .145 + R, 0], { rs: 10, ts: 48 });
  const lens = cyl(inner, R - .001, R - .001, .006, glassMat('#dff4ff', .16), [0, .145 + R, 0], { rot: AX, noOl: true, n: 48 });
  decal(inner, R * 1.4, R * 1.4, null, [0, .145 + R, .004], { mat: basicTex(ctex('lens-glint', 128, 128, (x, w, h) => { x.clearRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.arc(w / 2, h / 2, w * .36, PI * 1.05, PI * 1.45); x.stroke(); x.lineWidth = 5; x.beginPath(); x.arc(w / 2, h / 2, w * .36, PI * 1.55, PI * 1.62); x.stroke(); }), { depthWrite: false }) });
  if (o.flat) { inner.rotation.x = -PI / 2; inner.position.y = .0145; }
  g.userData.lens = lens; g.userData.grip = { at: [0, o.flat ? .0145 : .06, o.flat ? -.06 : 0], rot: [0, 0, 0] };
  return ink(g, .24);
});

def('bunsen_burner', ['lab', 'science', 'light'], 'Bunsen burner (15 cm) with a flickering blue flame and an orange gas hose; o.flame: false turns it off', o => {
  const g = new THREE.Group(), base = plastic('#2d3a5a'), ch = chrome(), brass = toonMat('#d9a640', { metal: .4, rough: .35 });
  cyl(g, .045, .05, .016, base, [0, .008, 0]); cyl(g, .02, .03, .012, base, [0, .02, 0]);
  cyl(g, .011, .011, .13, ch, [0, .081, 0]); cyl(g, .0145, .0145, .022, brass, [0, .045, 0]);
  cyl(g, .005, .006, .04, brass, [.025, .03, 0], { rot: AZ });
  tube(g, 'bb-hose', [[.044, .03, 0], [.07, .03, .01], [.1, .012, .04], [.14, .006, .06]], .0055, plastic('#f08a2a'), { noOl: false });
  if (o.flame !== false) {
    const fl = new THREE.Group(); fl.position.y = .146; g.add(fl);
    const add = (key, prof, c, op) => { const m = mk(fl, memo('flame-' + key, () => smoothLathe(prof, 24, 4)), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); m.userData.noOutline = true; return m; };
    add('out', [[0, 0], [.012, .012], [.011, .05], [.005, .08], [0, .095]], '#5aa0ff', .35);
    add('in', [[0, 0], [.0075, .008], [.006, .03], [0, .05]], '#7fd0ff', .85);
    add('tip', [[0, .06], [.004, .075], [0, .1]], '#ffb04a', .45);
    g.userData.update = t => { fl.scale.set(1 + .05 * Math.sin(t * 23), 1 + .1 * Math.sin(t * 17) + .05 * Math.sin(t * 41), 1 + .05 * Math.cos(t * 19)); };
  }
  return ink(g, .15);
});

def('petri_dish', ['lab', 'science'], 'petri dish (9 cm) with amber agar and coloured bacteria colonies; o.lid: true adds the clear lid', o => {
  const g = new THREE.Group(), r = .045, h = .013, R = rnd(o.seed ?? 6);
  mk(g, latheGeo('petri', [[0, 0], [r - .004, 0], [r, .003], [r, h], [r - .0015, h + .001], [r - .003, h], [r - .003, .003], [r - .006, .0025], [0, .0025]], 48), glassMat(), [0, 0, 0]).userData.noOutline = true;
  cyl(g, r - .0035, r - .0035, .006, toonMat('#f2d98a', { rough: .3 }), [0, .0055, 0], { n: 48 });
  tor(g, r - .0015, .0016, glassRim(), [0, h, 0], { rot: [PI / 2, 0, 0], rs: 6, ts: 48 });
  const cols = o.colors || ['#f7f2e2', '#ffd36a', '#ff8fb0', '#a8e07a'];
  for (let c = 0; c < 3; c++) { const cx = (R() - .5) * .04, cz = (R() - .5) * .04, col = matte(cols[c % cols.length]); for (let i = 0; i < 7; i++) { const a = R() * TAU, d = R() * .011, s = .0022 + R() * .004; ball(g, s, col, [cx + Math.cos(a) * d, .0085, cz + Math.sin(a) * d], [1, .42, 1], { noOl: true, w: 12, h: 8 }); } }
  if (o.lid) mk(g, latheGeo('petri-lid', [[0, .012], [r + .002, .012], [r + .003, .013], [r + .003, .019], [0, .019]], 48), glassMat('#eef8ff', .14), [0, 0, 0]).userData.noOutline = true;
  return ink(g, .09);
});

def('lightbulb', ['lab', 'science', 'light', 'idea'], 'classic light bulb (13 cm, stands on its screw cap; scale it up for a big "idea" bulb). o.lit (default true): warm glowing glass + a point light (userData.light); off: clear glass showing the filament. o.intensity, o.range. userData.set(on)', o => {
  const g = new THREE.Group(), metal = toonMat('#cfd4da', { metal: .45, rough: .35 }), brass = toonMat('#d9a640', { metal: .4, rough: .35 });
  cyl(g, .004, .004, .004, brass, [0, .002, 0]); cyl(g, .0085, .009, .005, plastic('#26272c'), [0, .0065, 0]);
  cyl(g, .0125, .0125, .024, metal, [0, .021, 0]);
  for (const y of [.014, .021, .028]) tor(g, .0128, .0017, metal, [0, y, 0], { rot: [PI / 2, 0, 0], rs: 6, ts: 24, noOl: true });
  const bulbG = memo('bulb', () => smoothLathe([[.0115, .03], [.013, .04], [.029, .064], [.035, .085], [.03, .108], [.017, .122], [0, .1265]], 40, 4));
  const onM = toonMat('#fff4cc', { emissive: '#ffd27a', ei: 1.7, rough: .3 }), offM = glassMat('#eef8ff', .2);
  const bulb = mk(g, bulbG, onM); bulb.userData.th = .07;
  const fil = tube(g, 'filament', [[-.008, .06, 0], [-.006, .074, 0], [-.003, .068, 0], [0, .076, 0], [.003, .068, 0], [.006, .074, 0], [.008, .06, 0]], .0011, glow('#ffb347', 3), { n: 40, rs: 5 });
  for (const s of [-1, 1]) rod(g, [s * .004, .032, 0], [s * .008, .06, 0], .0008, plastic('#6a5a4a'), { noOl: true });
  const L = new THREE.PointLight('#ffd28a', o.intensity ?? 1.2, o.range ?? 3, 2); L.position.y = .08; g.add(L);
  const set = on => { bulb.material = on ? onM : offM; fil.material = on ? glow('#ffb347', 3) : plastic('#7a5a3a'); L.intensity = on ? (o.intensity ?? 1.2) : 0; bulb.userData.olMesh && (bulb.userData.olMesh.visible = on); return g; };
  ink(g, .13);
  set(o.lit ?? true);
  Object.assign(g.userData, { light: L, set, grip: { at: [0, .02, 0], rot: [0, 0, 0] } });
  return g;
});

def('battery', ['lab', 'science', 'handheld', 'power'], 'battery cell standing on its minus end (AA 5 cm; o.big: true is a fat D cell 6 cm): black body, copper top band with a +, metal nub. o.color band', o => {
  const g = new THREE.Group(), big = !!o.big, r = big ? .017 : .0105, h = big ? .06 : .05;
  cyl(g, r, r, h * .66, plastic('#2b2b2f', { rough: .35 }), [0, h * .33, 0], { b: r * .25 });
  cyl(g, r, r, h * .34, toonMat(o.color || '#e88a2a', { metal: .35, rough: .3 }), [0, h * .66 + h * .17, 0], { b: r * .25 });
  cyl(g, r * .42, r * .46, h * .07, chrome(), [0, h + h * .03, 0], { b: r * .1 });
  decal(g, r * 1.1, r * 1.1, ctex('plus', 64, 64, (x, w, h2) => { x.clearRect(0, 0, w, h2); x.fillStyle = '#ffffff'; x.fillRect(w * .4, h2 * .15, w * .2, h2 * .7); x.fillRect(w * .15, h2 * .4, w * .7, h2 * .2); }), [0, h * .83, r + .0005], { alpha: true });
  decal(g, r * 1.2, h * .4, ctex('cell-lbl', 64, 96, (x, w, h2) => { x.clearRect(0, 0, w, h2); tx(x, 'PX', w / 2, h2 * .5, w * .42, '#f6c945'); }), [0, h * .36, r + .0005], { alpha: true });
  g.userData.grip = { at: [0, h / 2, 0], rot: [0, 0, 0] };
  return ink(g, h);
});

def('battery_big', ['lab', 'power', 'car'], 'car battery (26 cm): black box, red + and black - terminals, carry handle, yellow "12V" label, charge-eye light', o => {
  const g = new THREE.Group(), blk = plastic('#2b2d33', { rough: .5 }), lid = plastic('#3a3d44');
  box(g, .26, .18, .17, blk, [0, .09, 0], { r: .015 }); box(g, .27, .03, .18, lid, [0, .193, 0], { r: .01 });
  for (const [s, c] of [[1, '#e2322a'], [-1, '#2b2b2f']]) { cyl(g, .014, .016, .024, chrome('#b9bfc6'), [s * .085, .218, -.045]); cyl(g, .02, .02, .014, plastic(c), [s * .085, .216, -.045]); }
  decal(g, .24, .1, ctex('carbatt', 320, 132, (x, w, h) => { x.fillStyle = '#f6c945'; x.fillRect(0, 0, w, h); x.fillStyle = '#2b2d33'; x.fillRect(0, h * .72, w, h * .28); tx(x, 'ZAPCELL', w * .42, h * .3, h * .2, '#2b2d33'); tx(x, '12V', w * .42, h * .55, h * .24, '#e2322a'); tx(x, '+  -', w * .5, h * .86, h * .18, '#f6c945'); x.fillStyle = '#2b2d33'; x.beginPath(); x.moveTo(w * .86, h * .1); x.lineTo(w * .74, h * .4); x.lineTo(w * .82, h * .4); x.lineTo(w * .76, h * .66); x.lineTo(w * .9, h * .32); x.lineTo(w * .82, h * .32); x.closePath(); x.fill(); }), [0, .1, .0855]);
  tube(g, 'cb-handle', [[-.1, .21, .01], [-.08, .26, .01], [.08, .26, .01], [.1, .21, .01]], .006, plastic('#1d1e22'), { noOl: false, n: 24 });
  cyl(g, .008, .008, .004, glow('#3dff6a', 1.6), [.03, .209, -.045], { noOl: true });
  return ink(g, .26);
});

def('battery_meter', ['lab', 'power', 'data'], 'big battery charge indicator as a 3D object (0.5 m wide, stands upright): white rounded casing, five glowing segments red -> amber -> green with the level. o.level 0..1 (.8), o.charging: true adds a lightning bolt. userData.level(k), fill(k0, k1, t0, t1) animates deterministically', o => {
  const g = new THREE.Group(), frame = plastic('#f4f6f8', { rough: .35 }), cy = .13, bev = .012;
  const s = rrShape(.5 - 2 * bev, .26 - 2 * bev, .06 - bev); s.holes.push(rrShape(.44 + 2 * bev, .2 + 2 * bev, .035 + bev, new THREE.Path()));
  mk(g, exGeo('bmeter', s, .08, bev, 12), frame, [0, cy, 0]).userData.th = .26;
  box(g, .035, .1, .06, frame, [.265, cy, 0], { r: .014 });
  box(g, .44, .2, .02, plastic('#2a2d33'), [0, cy, -.025], { r: .01 });
  const segs = [...Array(5)].map((_, i) => { const m = own('#3a3f48', { rough: .3 }); box(g, .074, .165, .036, m, [-.174 + i * .087, cy, -.004], { r: .012 }); return m; });
  if (o.charging) decal(g, .1, .16, null, [0, cy, .022], { mat: basicTex(ctex('bolt', 64, 100, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#ffffff'; x.strokeStyle = '#2a2d33'; x.lineWidth = 5; x.lineJoin = 'round'; x.beginPath(); x.moveTo(w * .62, 4); x.lineTo(w * .16, h * .56); x.lineTo(w * .46, h * .56); x.lineTo(w * .36, h - 4); x.lineTo(w * .86, h * .42); x.lineTo(w * .54, h * .42); x.closePath(); x.fill(); x.stroke(); })) });
  let anim = null;
  const level = k => { k = clamp(k); const n = Math.ceil(k * 5 - 1e-6), c = k <= .2 ? '#ff4a3a' : k <= .5 ? '#ffb02e' : '#3ddc84'; segs.forEach((m, i) => { const on = i < n; m.color.set(on ? c : '#3a3f48'); m.emissive.set(c); m.emissiveIntensity = on ? .9 : 0; }); return g; };
  level(o.level ?? .8);
  Object.assign(g.userData, { level, fill(a, b, t0, t1) { anim = { a, b, t0, t1 }; return g; }, update(t) { if (anim) level(lerp(anim.a, anim.b, E.inOutCubic(seg(t, anim.t0, anim.t1)))); } });
  return ink(g, .5);
});

def('magnet', ['lab', 'science', 'handheld'], 'red horseshoe magnet with steel tips (17 cm), standing on its tips (U opening down). o.color', o => {
  const g = new THREE.Group(), red = glossy(o.color || '#e2432f'), steel = chrome('#d9dde2'), R = .05, r = .019, legH = .07, tip = .03;
  tor(g, R, r, red, [0, tip + legH, 0], { arc: PI, rs: 14, ts: 28 });
  for (const s of [-1, 1]) { cyl(g, r, r, legH, red, [s * R, tip + legH / 2, 0], { b: .002 }); cyl(g, r, r, tip, steel, [s * R, tip / 2, 0], { b: .003 }); }
  g.userData.grip = { at: [0, tip + legH + R, 0], rot: [0, 0, 0] };
  return ink(g, .17);
});

function gearShape(R, n, d) {
  const s = new THREE.Shape(), w = TAU / n, Rr = R - d;
  for (let i = 0; i < n; i++) { const a = i * w; for (const [f, rad] of [[0, Rr], [.12, R * .985], [.18, R], [.34, R], [.4, R * .985], [.52, Rr], [.76, Rr * .995]]) { const p = [Math.cos(a + f * w) * rad, Math.sin(a + f * w) * rad]; i || f ? s.lineTo(...p) : s.moveTo(...p); } }
  const hole = new THREE.Path(); hole.absarc(0, 0, R * .17, 0, TAU, true); s.holes.push(hole);
  if (R > .07) for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + PI / 4, h2 = new THREE.Path(); h2.absarc(Math.cos(a) * R * .52, Math.sin(a) * R * .52, R * .15, 0, TAU, true); s.holes.push(h2); }
  return s;
}
/** one gear facing +z: teeth n, outer radius R, tooth depth d (gears with the same R / n mesh) */
function gearMesh(par, R, n, mat, p, depth = .025) { const m = mk(par, exGeo(`gear${q4(R)},${n},${q4(depth)}`, gearShape(R, n, R * .15), depth, .004, 6), mat, p); m.userData.th = R * 2; return m; }
const GEAR_TOOTH = .26, GEAR_GAP = .76;   // centre of a tooth / of a gap, in tooth pitches
def('gears', ['lab', 'science', 'machine'], 'three meshing gears (brass, steel, copper) on a wooden backboard (0.5 m wide, stands upright); they turn together with correct ratios (o.spin rad/s of the big gear, 0 stops them). userData.gears [{ mesh, n }]', o => {
  const g = new THREE.Group(), wood = toonMat('#a46a3c', { rough: .55 }), ch = chrome();
  box(g, .52, .42, .025, wood, [0, .23, -.04], { r: .01 }); box(g, .52, .03, .15, wood, [0, .015, 0], { r: .008 });
  const mats = [toonMat('#d6a640', { metal: .4, rough: .35 }), toonMat('#a9b2bc', { metal: .45, rough: .35 }), toonMat('#c8743c', { metal: .4, rough: .35 })];
  const A = { n: 18, R: .12, c: [-.1, .23] }, B = { n: 12, R: .08 }, Cg = { n: 9, R: .06 }, dA = A.R * .15;
  const th1 = -.35, cB = [A.c[0] + Math.cos(th1) * (A.R + B.R - dA), A.c[1] + Math.sin(th1) * (A.R + B.R - dA)]; B.c = cB;
  const wA = TAU / A.n, wB = TAU / B.n, wC = TAU / Cg.n;
  A.p0 = th1 - GEAR_GAP * wA; B.p0 = th1 + PI - GEAR_TOOTH * wB;
  const th2 = B.p0 + GEAR_GAP * wB + Math.round((1.0 - (B.p0 + GEAR_GAP * wB)) / wB) * wB;
  Cg.c = [cB[0] + Math.cos(th2) * (B.R + Cg.R - dA), cB[1] + Math.sin(th2) * (B.R + Cg.R - dA)]; Cg.p0 = th2 + PI - GEAR_TOOTH * wC;
  const gs = [A, B, Cg].map((G, i) => { const m = gearMesh(g, G.R, G.n, mats[i], [G.c[0], G.c[1], 0]); m.rotation.z = G.p0; cyl(g, .012, .012, .05, ch, [G.c[0], G.c[1], 0], { rot: AX }); return { mesh: m, n: G.n, p0: G.p0 }; });
  const turn = t => { const w = (o.spin ?? .8) * t; gs[0].mesh.rotation.z = A.p0 + w; gs[1].mesh.rotation.z = B.p0 - w * A.n / B.n; gs[2].mesh.rotation.z = Cg.p0 + w * A.n / Cg.n; };
  Object.assign(g.userData, { gears: gs, update: turn }); turn(0);
  return ink(g, .5);
});
def('gear', ['lab', 'machine'], 'a single chunky gear standing on its teeth, facing +z (o.r radius .12, o.teeth 16, o.color, o.spin rad/s)', o => {
  const g = new THREE.Group(), R = o.r ?? .12, m = gearMesh(g, R, o.teeth ?? 16, toonMat(o.color || '#d6a640', { metal: .4, rough: .35 }), [0, R, 0], o.depth ?? R * .25);
  if (o.spin) g.userData.update = t => { m.rotation.z = t * o.spin; };
  return ink(g, R * 2);
});

function drawPCB(x, w, h) {
  x.fillStyle = '#2b8a4c'; x.fillRect(0, 0, w, h); const R = rnd(8);
  x.strokeStyle = '#e9c46a'; x.lineCap = 'round'; x.lineJoin = 'round';
  for (let i = 0; i < 26; i++) { x.lineWidth = 2 + (i % 3); let X = R() * w, Y = R() * h; x.beginPath(); x.moveTo(X, Y); for (let k = 0; k < 3; k++) { if (k % 2) X += (R() - .5) * w * .5; else Y += (R() - .5) * h * .5; x.lineTo(X, Y); } x.stroke(); circ(x, X, Y, 4, '#e9c46a'); }
  x.fillStyle = '#d8f0d0'; x.font = font(12, 600); x.fillText('PX-01', w * .05, h * .94); x.fillText('C3', w * .62, h * .3); x.fillText('R7', w * .3, h * .78);
  for (const [cx, cy] of [[.04, .06], [.96, .06], [.04, .94], [.96, .94]]) circ(x, w * cx, h * cy, 6, '#c9cfd6', '#8a6a2a', 2);
}
def('circuit_board', ['lab', 'tech', 'science'], 'green circuit board lying flat (22 cm): gold traces, a big chip, small chips, capacitors, resistors, header pins and a lit LED', o => {
  const g = new THREE.Group(), blk = plastic('#1d1e22', { rough: .4 }), ch = chrome();
  box(g, .22, .008, .15, plastic('#2b8a4c'), [0, .004, 0], { r: .002 });
  decal(g, .214, .144, ctex('pcb', 428, 288, drawPCB), [0, .0084, 0], { rot: UP });
  box(g, .05, .007, .05, blk, [-.03, .0115, -.01], { r: .002 });
  decal(g, .03, .01, ctex('chip-lbl', 96, 32, (x, w, h) => { x.fillStyle = '#1d1e22'; x.fillRect(0, 0, w, h); tx(x, 'PIXO', w / 2, h / 2, h * .7, '#c9cfd6'); }), [-.03, .0152, -.01], { rot: UP });
  const leg = new THREE.InstancedMesh(rboxGeo(.003, .002, .006, .0008, 1), ch, 32), m4 = new THREE.Matrix4(); let n = 0;
  for (let i = 0; i < 8; i++) for (const [sx, sz, rot] of [[1, 0, 0], [-1, 0, 0], [0, 1, 1], [0, -1, 1]]) { const off = -.0175 + i * .005; const x = -.03 + (sx ? sx * .028 : off), z = -.01 + (sz ? sz * .028 : off); m4.makeRotationY(rot ? 0 : PI / 2); m4.setPosition(x, .009, z); leg.setMatrixAt(n++, m4); }
  leg.userData.noOutline = true; g.add(leg);
  for (const [x, z] of [[.05, -.04], [.06, .03]]) box(g, .025, .005, .015, blk, [x, .0105, z], { r: .0015 });
  for (const [x, z, c] of [[.03, .045, '#3f6fd1'], [.05, .05, '#2b2b2f'], [.07, .045, '#3f6fd1']]) { cyl(g, .006, .006, .016, plastic(c), [x, .016, z]); cyl(g, .0055, .0055, .001, ch, [x, .0245, z], { noOl: true }); }
  for (let i = 0; i < 3; i++) { cyl(g, .0032, .0032, .014, plastic('#e8d8b0'), [-.07 + i * .015, .0115, .05], { rot: AX }); for (const k of [-1, 0, 1]) tor(g, .0033, .0007, plastic(['#e2322a', '#5a3a22', '#f6c945'][(i + k + 1) % 3]), [-.07 + i * .015, .0115, .05 + k * .003], { noOl: true, rs: 4, ts: 12 }); }
  for (let i = 0; i < 8; i++) { box(g, .004, .006, .004, blk, [-.09 + i * .005, .011, -.06], { noOl: true, r: .0008 }); box(g, .0012, .009, .0012, toonMat('#e9c46a', { metal: .4 }), [-.09 + i * .005, .018, -.06], { noOl: true, r: .0004 }); }
  ball(g, .003, glow(o.led || '#ff3b30', 2.4), [.085, .011, -.06], null, { noOl: true });
  box(g, .012, .004, .006, ch, [.07, .01, -.02], { r: .002 });
  return ink(g, .22);
});

def('wrist_gadget', ['lab', 'handheld', 'screen', 'spy'], 'chunky wrist gadget with a 2-line amber LED dot-matrix display, three buttons and a dial, on a thick black strap (stands on its strap, display toward +z). o.lines [2]. userData.screen/draw(fn)/set(line1, line2)', o => {
  const g = new THREE.Group(), strap = plastic('#26272c', { rough: .6 }), body = plastic(o.color || '#3b4048', { rough: .4 }), acc = plastic('#f08a2a'), R = .034, r = .008;
  tor(g, R, r, strap, [0, R + r, 0], { rot: [0, PI / 2, 0], s: [1, 1, 2.4], rs: 10, ts: 36 });
  box(g, .09, .056, .028, body, [0, R + r, R + .01], { r: .01 });
  box(g, .078, .034, .004, plastic('#141519'), [0, R + r + .006, R + .0245], { r: .004 });
  const lines = o.lines || ['SIGNAL', 'FOUND 042'];
  const t = tex(320, 128, (x, w, h) => drawDots(x, w, h, lines));
  decal(g, .072, .029, t, [0, R + r + .006, R + .0268], { glow: 1.2 });
  for (let i = 0; i < 3; i++) box(g, .014, .006, .006, i === 1 ? acc : plastic('#8d939d'), [-.02 + i * .02, R + r - .019, R + .025], { r: .002 });
  cyl(g, .009, .009, .008, acc, [.05, R + r + .008, R + .01], { rot: AZ });
  cyl(g, .002, .002, .02, plastic('#8d939d'), [-.035, R + r + .036, R + .01]); ball(g, .0035, glow('#ff3b30', 2), [-.035, R + r + .047, R + .01], null, { noOl: true });
  screenApi(g, t, { set: (a, b) => redraw(t, (x, w, h) => drawDots(x, w, h, [a ?? lines[0], b ?? ''])) });
  g.userData.grip = { at: [0, R + r, 0], rot: [0, 0, 0] };
  return ink(g, .1);
});
