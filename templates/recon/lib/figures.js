// Figures (recon engine, lib/figures.js in a project). v16 THE CHARACTERS: two bodies in ONE style - the male jointed
// mannequin (Mixamo Y Bot) and his sister (the CC0 Quaternius female mannequin, assets/figures/mannequin_f.glb, built by
// experiments/recon-style/tools/build_mannequin_f.mjs) - on the 65-bone UE5 skeleton the CC0 mocap clips drive, each in a
// finish (matte | glossy | glow) and a colour. No clothes, no faces, nothing hidden under the drawn body.
//
//   figure('suspect', { parent: S.scene })            the role's figure as the project's settings say (Look > Characters)
//   figure({ role, body: 'male'|'female', finish: 'matte'|'glossy'|'glow', color: '#rrggbb', joints?, group?, height, name,
//            parent, x, y, z, ry, act, t })
//   body 'custom:<id>': the user's own uploaded character (lib/customchar.js) on the male skeleton, every clip / hold / palm
//            as above; own materials unless a finish is chosen. v21: the skeleton takes the character's own proportions (its
//            joints, neck, shoulders, legs; the clips' rotations are retargeted rest-relative, the hips scaled by its legs).
//            Named in settings it just loads; named only in a scene call:
//            await loadFigures(['custom:<id>']) first. A missing one warns and draws the male body.
//   f.act('typing', { t }) / f.sequence([...], t) / f.walkAt(from, dir, dist) / f.handTo(side, P, o) / f.hold(obj, o) / f.grip
//   f.bone(name) every skeleton bone (fingers too)   f.palm(side) { position, normal, forward } of the DRAWN hand   f.root
//   f.caps()  capsules measured on the drawn body for S.collide        f.look({ finish, color })  change it from now on
//   figureGroup('cops', { finish, color })  a group's look in code; figure(role, { group: 'cops' })
//   listFigures()  the rosters (bodies, finishes, roles, acts) for tooling      references/characters.md (the skill)
//
// settings.figures = { main: { body, finish, color }, roles: { suspect: {...}, ... }, groups: { name: { roles: [...], finish,
// color } } } (the app's Characters picker writes main / roles). A scene names the ROLE only, so a change in the settings
// changes every scene at once. Order: scene options > the role's settings > its group > the role's default. Old values
// (rig human / porcelain / faceted / masked / ual / mixamo / model, outfits, colors) still load: a body from body 'f'/'m',
// glossy for porcelain, glow for outfit 'glow', the top colour as the colour (the old rigs below stay as code only).
//
// (before v16:)
// Rigs: porcelain = the 18-joint mannequin of models.js (glossy porcelain in the Investigation look, matte clay in Studio);
// faceted = the same rig as flat-shaded low-poly facets (the unknown person); masked = porcelain under a balaclava and
// gloves (force figures); ual = the CC0 Quaternius rigged actor with its animation clips (colour regions, no cloth).
// The three mannequin rigs share the wardrobe: garments are separate smooth shells built around the joints (collars,
// cuffs, hems with rolled edges, rib bands, zips, seams as thin parts, fabric texture and sheen), skinned to the rig on
// the CPU every time the figure moves and pushed out of the body (no body part ever pokes through a garment).
// Colours: the skin is the person's instance colour (x the engine's MAT.white: v7 THEME.figure makes it glossy), every
// garment has its own fabric material in its region colour { skin, top, bottom, shoes, accent }. The theme's grade
// (contrast, desaturation, highlight cap) applies to the clothes like to everything else; THEME.prop never tints them.
import * as ENG from '../engine.js';
import * as MOD from '../models.js';
import * as ANIM from './anims.js';   // the animation catalog: every built-in clip + the user's imports (Mixamo), by name
const { THREE } = ENG;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, k) => a + (b - a) * k;
const sstep = t => t * t * (3 - 2 * t), smooth = (a, b, x) => sstep(clamp((x - a) / (b - a)));
const SETTINGS = ENG.SETTINGS || globalThis.__CZ_SETTINGS || {};
const THEME = ENG.THEME || null;
// project files (the UAL actor): next to the project's lib/ (or the app's template in the Characters preview)
const BASE = globalThis.__CZ_FIG_BASE || (/\/(lib|__figview)\/figures\.js/.test(import.meta.url) ? new URL('../', import.meta.url).href : new URL('./', import.meta.url).href);

// =====================================================================================================================
// THE REST SKELETON (a copy of models.js JOINTS: keep in sync) and the body as shapes (a copy of models.js PARTS)
// =====================================================================================================================
const JP = { hips: ['root', [0, .98, 0]], spine: ['hips', [0, .1, 0]], chest: ['spine', [0, .18, 0]], neck: ['chest', [0, .29, 0]], head: ['neck', [0, .08, 0]],
  shL: ['chest', [.19, .22, 0]], elL: ['shL', [0, -.29, 0]], wrL: ['elL', [0, -.26, 0]], fiL: ['wrL', [0, -.088, 0]],
  shR: ['chest', [-.19, .22, 0]], elR: ['shR', [0, -.29, 0]], wrR: ['elR', [0, -.26, 0]], fiR: ['wrR', [0, -.088, 0]],
  hipL: ['hips', [.095, -.05, 0]], knL: ['hipL', [0, -.44, 0]], anL: ['knL', [0, -.435, 0]],
  hipR: ['hips', [-.095, -.05, 0]], knR: ['hipR', [0, -.44, 0]], anR: ['knR', [0, -.435, 0]] };
const JN = Object.keys(JP), JI = Object.fromEntries(JN.map((n, i) => [n, i]));
const REST = {}; for (const n of JN) { const [p, o] = JP[n], b = p === 'root' ? [0, 0, 0] : REST[p]; REST[n] = [b[0] + o[0], b[1] + o[1], b[2] + o[2]]; }
const RIG_H = 1.842;   // rest height: the top of the head

// body shapes in joint space: ball / ell (ellipsoid) / cap (tapered capsule a..b) / shaped (models.js shaped(): a sphere
// whose x/z are scaled by fx(t), fz(t) of its height t, the chest's top squashed)
const BODY = {
  hips: { j: 'hips', kind: 'shaped', c: [0, -.015, 0], s: [.158, .11, .1], fx: t => .82 + .18 * t, fz: () => .9 },
  waist: { j: 'spine', kind: 'shaped', c: [0, .07, -.004], s: [.098, .12, .074], fx: t => .78 + .22 * Math.abs(t - .5) * 2, fz: t => .78 + .22 * Math.abs(t - .5) * 2 },
  chest: { j: 'chest', kind: 'shaped', c: [0, .13, -.004], s: [.19, .235, .11], fx: t => .72 + .3 * sstep(Math.min(1, t * 1.15)), fz: t => .8 + .12 * Math.sin(t * Math.PI), squash: true },
  neck: { j: 'neck', kind: 'cap', a: [0, -.005, 0], b: [0, .065, 0], ra: .037, rb: .037 },
  head: { j: 'head', kind: 'ell', c: [0, .1, .012], r: [.087, .112, .098] },
};
for (const s of ['L', 'R']) Object.assign(BODY, {
  ['shb' + s]: { j: 'sh' + s, kind: 'ball', c: [0, 0, 0], r: .054 },
  ['uarm' + s]: { j: 'sh' + s, kind: 'cap', a: [0, -.05, 0], b: [0, -.24, 0], ra: .045, rb: .045 },
  ['elb' + s]: { j: 'el' + s, kind: 'ball', c: [0, 0, 0], r: .04 },
  ['farm' + s]: { j: 'el' + s, kind: 'cap', a: [0, -.045, 0], b: [0, -.215, 0], ra: .037, rb: .037 },
  ['wri' + s]: { j: 'wr' + s, kind: 'ball', c: [0, 0, 0], r: .03 },
  ['hipb' + s]: { j: 'hip' + s, kind: 'ball', c: [0, 0, 0], r: .066 },
  ['thigh' + s]: { j: 'hip' + s, kind: 'cap', a: [0, -.07, 0], b: [0, -.37, 0], ra: .066, rb: .054 },
  ['knee' + s]: { j: 'kn' + s, kind: 'ball', c: [0, 0, 0], r: .052 },
  ['shin' + s]: { j: 'kn' + s, kind: 'cap', a: [0, -.06, 0], b: [0, -.37, 0], ra: .05, rb: .0375 },
  ['ankle' + s]: { j: 'an' + s, kind: 'ball', c: [0, 0, 0], r: .036 },
});
function prep(p) {   // bounding radius + centre for the quick reject
  const q = { ...p };
  if (q.kind === 'cap') { q.c = q.a.map((v, i) => (v + q.b[i]) / 2); q.R = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1], q.b[2] - q.a[2]) / 2 + Math.max(q.ra, q.rb); q.ab = q.b.map((v, i) => v - q.a[i]); q.ab2 = q.ab[0] ** 2 + q.ab[1] ** 2 + q.ab[2] ** 2; }
  else if (q.kind === 'ball') q.R = q.r; else if (q.kind === 'ell') q.R = Math.max(...q.r); else q.R = Math.max(...q.s) * 1.05;
  q.ji = JI[q.j]; return q;
}
for (const k in BODY) BODY[k] = prep(BODY[k]);
// is local point l inside shape p inflated by m? (and pushLocal: move it onto that inflated surface)
function inside(p, x, y, z, m = 0) {
  const dx = x - p.c[0], dy = y - p.c[1], dz = z - p.c[2]; if (dx * dx + dy * dy + dz * dz > (p.R + m) ** 2) return false;
  if (p.kind === 'ball') return dx * dx + dy * dy + dz * dz < (p.r + m) ** 2;
  if (p.kind === 'ell') return (dx / (p.r[0] + m)) ** 2 + (dy / (p.r[1] + m)) ** 2 + (dz / (p.r[2] + m)) ** 2 < 1;
  if (p.kind === 'cap') { const ax = x - p.a[0], ay = y - p.a[1], az = z - p.a[2], t = clamp((ax * p.ab[0] + ay * p.ab[1] + az * p.ab[2]) / p.ab2), r = lerp(p.ra, p.rb, t) + m;
    return (ax - p.ab[0] * t) ** 2 + (ay - p.ab[1] * t) ** 2 + (az - p.ab[2] * t) ** 2 < r * r; }
  let Y = dy / (p.s[1] + m); if (p.squash && Y > .55) Y = .55 + (Y - .55) / .45; if (Y >= 1 || Y <= -1) return false;
  const t = (Y + 1) / 2, X = dx / ((p.s[0] + m) * p.fx(t)), Z = dz / ((p.s[2] + m) * p.fz(t)); return X * X + Y * Y + Z * Z < 1;
}
const _l = [0, 0, 0];
function pushLocal(p, l, m) {
  const dx = l[0] - p.c[0], dy = l[1] - p.c[1], dz = l[2] - p.c[2]; if (dx * dx + dy * dy + dz * dz > (p.R + m) ** 2) return false;
  if (p.kind === 'ball') { const d = Math.hypot(dx, dy, dz), r = p.r + m; if (d >= r) return false; const k = d > 1e-7 ? r / d : 0; if (!k) { l[1] = p.c[1] + r; return true; }
    l[0] = p.c[0] + dx * k; l[1] = p.c[1] + dy * k; l[2] = p.c[2] + dz * k; return true; }
  if (p.kind === 'ell') { const q = (dx / (p.r[0] + m)) ** 2 + (dy / (p.r[1] + m)) ** 2 + (dz / (p.r[2] + m)) ** 2; if (q >= 1) return false; const k = 1 / Math.sqrt(Math.max(q, 1e-9));
    l[0] = p.c[0] + dx * k; l[1] = p.c[1] + dy * k; l[2] = p.c[2] + dz * k; return true; }
  if (p.kind === 'cap') { const ax = l[0] - p.a[0], ay = l[1] - p.a[1], az = l[2] - p.a[2], t = clamp((ax * p.ab[0] + ay * p.ab[1] + az * p.ab[2]) / p.ab2), r = lerp(p.ra, p.rb, t) + m;
    let ex = ax - p.ab[0] * t, ey = ay - p.ab[1] * t, ez = az - p.ab[2] * t; const d = Math.hypot(ex, ey, ez); if (d >= r) return false;
    if (d < 1e-7) { ex = 1; ey = ez = 0; } const k = d < 1e-7 ? r : r / d;
    l[0] = p.a[0] + p.ab[0] * t + ex * k; l[1] = p.a[1] + p.ab[1] * t + ey * k; l[2] = p.a[2] + p.ab[2] * t + ez * k; return true; }
  const sx = p.s[0] + m, sy = p.s[1] + m, sz = p.s[2] + m; let Y = dy / sy; if (p.squash && Y > .55) Y = .55 + (Y - .55) / .45; if (Y >= 1 || Y <= -1) return false;
  const t = (Y + 1) / 2, X = dx / (sx * p.fx(t)), Z = dz / (sz * p.fz(t)), R = Math.hypot(X, Y, Z); if (R >= 1) return false;
  const Xs = X / R, Ys = Y / R, Zs = Z / R, ts = (Ys + 1) / 2; let ys = Ys; if (p.squash && ys > .55) ys = .55 + (ys - .55) * .45;
  l[0] = p.c[0] + Xs * p.fx(ts) * sx; l[1] = p.c[1] + ys * sy; l[2] = p.c[2] + Zs * p.fz(ts) * sz; return true;
}
// a garment's own extra shapes (the sleeve caps the torso wraps over, the leg tubes the trousers' seat wraps over)
const extra = (name, j, kind, o) => prep({ j, kind, ...o, name });
const restIn = (p, x, y, z, m = 0) => inside(p, x - REST[p.j][0], y - REST[p.j][1], z - REST[p.j][2], m);
function restPush(list, P, m) {   // push rest positions out of shapes (rest joints are pure translations)
  let moved = 0;
  for (let v = 0; v < P.length; v += 3) for (const p of list) { const r = REST[p.j]; _l[0] = P[v] - r[0]; _l[1] = P[v + 1] - r[1]; _l[2] = P[v + 2] - r[2];
    if (pushLocal(p, _l, m)) { P[v] = _l[0] + r[0]; P[v + 1] = _l[1] + r[1]; P[v + 2] = _l[2] + r[2]; moved++; } }
  return moved;
}

// =====================================================================================================================
// GARMENT GEOMETRY: horizontal rings lofted into a tube (rest pose: arms and legs hang straight, so every tube is vertical)
// =====================================================================================================================
// ring: { pts: [[x, y, z] x N], v (metres along), rib?: true, fixed?: true }. Rings are listed in SURFACE order (a hem's
// inner fold first, then the edge, then up the outside), so the faces' winding follows the cloth.
function loft(rings, o = {}) {
  const N = rings[0].pts.length, wrap = o.wrap !== false, cols = wrap ? N + 1 : N, M = rings.length;
  const pos = new Float32Array(M * cols * 3), uv = new Float32Array(M * cols * 2), seams = [];
  let vacc = 0, prevC = null;
  for (let i = 0; i < M; i++) {
    const P = rings[i].pts, c = P.reduce((a, p) => [a[0] + p[0] / N, a[1] + p[1] / N, a[2] + p[2] / N], [0, 0, 0]);
    if (prevC) vacc += Math.hypot(c[0] - prevC[0], c[1] - prevC[1], c[2] - prevC[2]) + Math.abs((rings[i].r ?? 0) - (rings[i - 1].r ?? 0)); prevC = c;
    let acc = 0;
    for (let k = 0; k < cols; k++) { const p = P[k % N]; if (k) { const q = P[(k - 1) % N]; acc += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }
      const a = i * cols + k; pos[a * 3] = p[0]; pos[a * 3 + 1] = p[1]; pos[a * 3 + 2] = p[2]; uv[a * 2] = acc; uv[a * 2 + 1] = vacc; }
    if (wrap) seams.push([i * cols, i * cols + N]);
  }
  const idx = [], groups = []; let gStart = 0, gMat = rings[0].rib ? 1 : 0;
  for (let i = 0; i < M - 1; i++) {
    const mat = rings[i].rib && rings[i + 1].rib ? 1 : 0;
    if (mat !== gMat) { if (idx.length > gStart) groups.push([gStart, idx.length - gStart, gMat]); gStart = idx.length; gMat = mat; }
    for (let k = 0; k < cols - 1; k++) {
      if (o.skip) { const a = i * cols + k, d = (i + 1) * cols + k + 1; if (o.skip((pos[a * 3] + pos[d * 3]) / 2, (pos[a * 3 + 1] + pos[d * 3 + 1]) / 2, (pos[a * 3 + 2] + pos[d * 3 + 2]) / 2, i, k)) continue; }
      const a = i * cols + k, b = a + 1, c = a + cols, d = c + 1; idx.push(a, b, c, b, d, c);
    }
  }
  if (idx.length > gStart) groups.push([gStart, idx.length - gStart, gMat]);
  return { pos, uv, idx, seams, groups, cols, M };
}
// polar ring around a vertical axis at (cx, cz): radius rf(th) (th = 0 is the front, +Z; pi/2 is the figure's left, +X)
const TH0 = -Math.PI / 2, TH = (k, N) => TH0 + k / N * Math.PI * 2;   // ring seams under the right arm
const ringAt = (y, N, cx, cz, rf) => { const pts = []; for (let k = 0; k < N; k++) { const th = TH(k, N), r = rf(th, k); pts.push([cx + r * Math.sin(th), y, cz + r * Math.cos(th)]); } return pts; };
const ellR = (w, d, n = 2) => th => { const s = Math.abs(Math.sin(th)), c = Math.abs(Math.cos(th)); return 1 / Math.pow(Math.pow(s / w, n) + Math.pow(c / d, n), 1 / n); };
// a ring moved outward/inward from its axis (cx, cz) by dr metres and up by dy (hem folds, rib bands, collars)
const offRing = (pts, cx, cz, dr, dy = 0) => pts.map(p => { const dx = p[0] - cx, dz = p[2] - cz, r = Math.hypot(dx, dz) || 1e-6; return [p[0] + dx / r * dr, p[1] + dy, p[2] + dz / r * dr]; });
// a rolled edge at the open end of a tube: the cloth turns over and goes back inside (so every opening shows a thickness)
function hemRings(pts, cx, cz, dir, o = {}) {   // dir: -1 = the open end is below the end ring (a hem), +1 = above it (a neckline)
  // beyond the end ring: a stitch groove, the folded edge, and the fold going back inside (surface order)
  const th = o.thick ?? .0045, back = o.back ?? .014, d = dir;
  const st = { pts: offRing(pts, cx, cz, -.0013, d * .009), fixed: true }, be = { pts: offRing(pts, cx, cz, 0, d * .012), fixed: true },
    ed = { pts: offRing(pts, cx, cz, th * .4, d * .0165), fixed: true }, inn = { pts: offRing(pts, cx, cz, -th, d * (.0165 - back)), fixed: true };
  return d < 0 ? [inn, ed, be, st] : [st, be, ed, inn];
}
// rib band (cuffs, waistbands, collars): a snug tube of fine vertical ribs ending in a rolled edge
function ribRings(pts, cx, cz, dir, h, o = {}) {
  const snug = o.snug ?? -.003, n = Math.max(2, Math.round(h / .008)), out = [];
  for (let i = n; i >= 1; i--) out.push({ pts: offRing(pts, cx, cz, snug * (i / n), dir * h * (i / n)), rib: true, fixed: true });
  const end = out[0].pts, e1 = offRing(end, cx, cz, .002, dir * .003), e2 = offRing(end, cx, cz, -.006, -dir * .012);
  const head = [{ pts: e2, rib: true, fixed: true }, { pts: e1, rib: true, fixed: true }];
  return dir < 0 ? [...head, ...out] : [...out.reverse(), ...head.reverse()];
}
// Laplacian relax of the rings that are not fixed (grid neighbours, wrapping around)
function relax(rings, it = 2, k = .45) {
  const N = rings[0].pts.length;
  for (let n = 0; n < it; n++) {
    const next = rings.map((r, i) => r.fixed || i === 0 || i === rings.length - 1 ? r.pts : r.pts.map((p, j) => {
      const a = r.pts[(j + 1) % N], b = r.pts[(j + N - 1) % N], u = rings[i - 1].pts[j], d = rings[i + 1].pts[j];
      return [0, 1, 2].map(c => lerp(p[c], (a[c] + b[c]) * .3 + (u[c] + d[c]) * .2, c === 1 ? k * .25 : k)); }));
    next.forEach((pts, i) => { rings[i].pts = pts; });
  }
}
// rest-pose clearance: rings pushed out of the body shapes (with ease) and relaxed, a few times
function settleRings(rings, shapes, m, it = 3) {
  for (let n = 0; n < it; n++) {
    for (const r of rings) if (!r.fixed) for (const p of r.pts) for (const s of shapes) { const R = REST[s.j]; _l[0] = p[0] - R[0]; _l[1] = p[1] - R[1]; _l[2] = p[2] - R[2]; if (pushLocal(s, _l, s.pm ?? m)) { p[0] = _l[0] + R[0]; p[1] = _l[1] + R[1]; p[2] = _l[2] + R[2]; } }
    if (n < it - 1) relax(rings, 1, .35);
  }
}
// widest body radius along a horizontal ray (wrapping a torso)
function wrapR(shapes, th, y, cx, cz) { const s = Math.sin(th), c = Math.cos(th); let last = 0;
  for (let r = 0; r <= .42; r += .003) if (shapes.some(p => restIn(p, cx + r * s, y, cz + r * c))) last = r; return last; }
// circular smoothing of a radius list
const csmooth = (R, it = 2) => { const N = R.length; for (let n = 0; n < it; n++) { const o = R.slice(); for (let k = 0; k < N; k++) R[k] = (o[(k + N - 1) % N] + 2 * o[k] + o[(k + 1) % N]) / 4; } return R; };

// ---------- skin weights: up to 3 joints per vertex, from the rest position ----------
function bindAll(pos, fn) {
  const n = pos.length / 3, I = new Uint8Array(n * 3), W = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) { const ws = fn(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]).filter(w => w[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 3), t = ws.reduce((a, w) => a + w[1], 0) || 1;
    ws.forEach(([j, w], k) => { I[v * 3 + k] = JI[j]; W[v * 3 + k] = w / t; }); }
  return { I, W };
}
const side = x => (x >= 0 ? 'L' : 'R');
// torso cloth: hips -> waist -> chest by height; a long hem follows the thighs a little
const wTorso = (x, y, legK = .55) => { const a = smooth(1.02, 1.13, y), b = smooth(1.2, 1.33, y), out = [['hips', (1 - a)], ['spine', a * (1 - b)], ['chest', b]];
  const leg = smooth(.93, .72, y) * legK * clamp(Math.abs(x) / .07); if (leg > 0) { out.forEach(w => { w[1] *= 1 - leg; }); out.push(['hip' + side(x), leg]); } return out; };
const wArm = (s0, x, y) => { const s = REST['sh' + s0][1] - y, e = smooth(.255, .325, s); return [['sh' + s0, 1 - e], ['el' + s0, e]]; };
const wLeg = (s0, x, y) => { const s = REST['hip' + s0][1] - y, e = smooth(.395, .485, s), a = smooth(.84, .9, s) * .35; return [['hip' + s0, 1 - e], ['kn' + s0, e * (1 - a)], ['an' + s0, e * a]]; };
const wSeat = (x, y) => { const l = smooth(.95, .845, y) * clamp(.5 + Math.abs(x) / .12, 0, 1) * .75, sd = side(x), cx = clamp(.5 + x / .05, 0, 1);
  if (Math.abs(x) < .025) return [['hips', 1 - l], ['hipL', l * cx], ['hipR', l * (1 - cx)]]; return [['hips', 1 - l], ['hip' + sd, l]]; };
const wHead = (x, y) => { const h = smooth(1.6, 1.66, y), n = smooth(1.555, 1.6, y); return [['chest', 1 - n], ['neck', n * (1 - h)], ['head', h]]; };

// ---------- the panel and rigid part records a garment returns ----------
// panel: { name, geo (loft), bind, shapes: [shape names], margin, mats: ['main', 'rib'?], region, fabric }
function panel(name, geo, bindFn, o) { return { name, geo, bind: bindAll(geo.pos, bindFn), shapes: o.shapes || [], margin: o.margin ?? .007, mats: o.mats || ['main', 'rib'], region: o.region, fabric: o.fabric, rib: o.rib, layer: o.layer ?? 0, flat: !!o.flat }; }
// rigid: a mesh on one joint (shoes, caps, buttons): geometry in that joint's space at rest
function rigid(name, geo, joint, at, o = {}) { const m = new THREE.Matrix4().compose(V3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.rot || [0, 0, 0]))), V3(...(o.scale || [1, 1, 1])));
  return { name, geo, joint, m, region: o.region, fabric: o.fabric, color: o.color }; }
// a point on a panel's rest surface: the ring outlines are lofts of N points; th in radians, y in metres
function surfaceAt(rings, th, y) {
  const main = rings.filter(r => r.main); let i = main.findIndex(r => r.pts[0][1] >= y); if (i <= 0) i = Math.max(1, i < 0 ? main.length - 1 : 1);
  const A = main[i - 1], B = main[i], k = clamp((y - A.pts[0][1]) / ((B.pts[0][1] - A.pts[0][1]) || 1)), N = A.pts.length, f = (((th - TH0) / (Math.PI * 2)) % 1 + 1) % 1 * N, k0 = Math.floor(f) % N, k1 = (k0 + 1) % N, u = f - Math.floor(f);
  const P = c => lerp(lerp(A.pts[k0][c], A.pts[k1][c], u), lerp(B.pts[k0][c], B.pts[k1][c], u), k);
  const p = V3(P(0), P(1), P(2)), cx = A.cx ?? 0, cz = A.cz ?? 0, n = V3(p.x - cx, 0, p.z - cz).normalize(); return { p, n };
}
// a patch lying on a panel (pockets, plackets, lapels, a tie): its outline in (th, y), lifted `off` metres, with a rolled
// border so it reads as a separate piece of cloth sewn on
function patch(name, srcRings, bindFn, o) {
  const rows = o.rows ?? 8, cols = o.cols ?? 10, rings = [];
  for (let i = 0; i <= rows; i++) { const y = lerp(o.y0, o.y1, i / rows), [ta, tb] = o.th(y, i / rows), pts = [];
    for (let k = 0; k <= cols; k++) { const s = surfaceAt(srcRings, lerp(ta, tb, k / cols), y), bulge = (o.bulge ?? 0) * Math.sin(Math.PI * k / cols) * Math.sin(Math.PI * i / rows);
      pts.push([s.p.x + s.n.x * (o.off + bulge), s.p.y, s.p.z + s.n.z * (o.off + bulge)]); }
    rings.push({ pts }); }
  // border: the outline pushed back toward the cloth (a thickness all round)
  const geo = loft(rings, { wrap: false }); const n = (rows + 1) * (cols + 1), ext = [];
  const edge = []; for (let k = 0; k <= cols; k++) edge.push(k); for (let i = 1; i <= rows; i++) edge.push(i * (cols + 1) + cols); for (let k = cols - 1; k >= 0; k--) edge.push(rows * (cols + 1) + k); for (let i = rows - 1; i >= 1; i--) edge.push(i * (cols + 1));
  const P = Array.from(geo.pos), U = Array.from(geo.uv), I = geo.idx.slice(), top = [];
  const r0 = srcRings.find(r => r.main) || {};
  edge.forEach(v => { const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], s = surfaceAt(srcRings, Math.atan2(x - (r0.cx ?? 0), z - (r0.cz ?? 0)), y);
    top.push(P.length / 3); P.push(x, y, z); U.push(U[v * 2], U[v * 2 + 1]);                      // the border's own copy (its own normals)
    ext.push(P.length / 3); P.push(x - s.n.x * o.off * .9, y, z - s.n.z * o.off * .9); U.push(U[v * 2], U[v * 2 + 1] + .01); });
  for (let e = 0; e < edge.length; e++) { const a = top[e], b = top[(e + 1) % edge.length], c = ext[e], d = ext[(e + 1) % edge.length]; I.push(a, c, b, b, c, d); }
  const g = { pos: new Float32Array(P), uv: new Float32Array(U), idx: I, seams: [], groups: [[0, I.length, 0]] };
  void n; return panel(name, g, bindFn, { ...o, mats: ['main'] });
}
// a round cord along a closed or open path of rest points (piping on a cut edge, drawstrings, seams)
function cord(name, pts, r, bindFn, o = {}) {
  const N = o.N ?? 8, closed = !!o.closed, rings = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = V3(...pts[i]), a = V3(...pts[closed ? (i + n - 1) % n : Math.max(0, i - 1)]), b = V3(...pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]), t = b.sub(a).normalize();
    const u = Math.abs(t.y) < .9 ? V3(0, 1, 0).cross(t).normalize() : V3(1, 0, 0).cross(t).normalize(), w = t.clone().cross(u);
    const ring = []; for (let k = 0; k < N; k++) { const q = k / N * Math.PI * 2; ring.push([p.x + (u.x * Math.cos(q) + w.x * Math.sin(q)) * r, p.y + (u.y * Math.cos(q) + w.y * Math.sin(q)) * r, p.z + (u.z * Math.cos(q) + w.z * Math.sin(q)) * r]); }
    rings.push({ pts: ring });
  }
  if (closed) rings.push({ pts: rings[0].pts.map(p => p.slice()) });
  return panel(name, loft(rings), bindFn, { ...o, mats: ['main'] });
}

// =====================================================================================================================
// GARMENTS
// =====================================================================================================================
const TORSO_SHAPES = ['hips', 'waist', 'chest', 'neck'];
const capShape = (s, r) => extra('cap' + s, 'sh' + s, 'ball', { c: [0, 0, 0], r, pm: .004 });
// the trousers' seat as seen from a top hanging over it (round each hip joint)
const seatShape = s => extra('seat' + s, 'hip' + s, 'cap', { a: [0, .07, 0], b: [0, -.13, 0], ra: .09, rb: .088, pm: .008 });
// torso: hem -> shoulders (wrapped round the body with ease, hanging straight down from the chest), a yoke over the
// shoulder caps up to the neckline, a rolled hem and a collar (crew rib / none / stand)
function torsoRings(o) {
  const N = o.N ?? 64, cx = 0, cz = -.005, ease = o.ease ?? .018, capR = o.capR ?? .064;
  const seat = o.hem < 1.0 && !o.noSeat ? [seatShape('L'), seatShape('R')] : [];   // a top hangs OVER the trousers' seat
  const wrapSet = [...TORSO_SHAPES.map(k => BODY[k]), capShape('L', capR), capShape('R', capR), ...(o.hem < .96 ? ['hipbL', 'hipbR', 'thighL', 'thighR'].map(k => BODY[k]) : []), ...seat, ...(o.wrapExtra || [])];
  const ys = []; for (let y = o.hem; y < 1.468; y += .022) ys.push(y); ys.push(1.47);
  const R = ys.map(y => csmooth(Float32Array.from({ length: N }, (_, k) => wrapR(wrapSet, TH(k, N), y, cx, cz) + ease), 3));
  const top = ys.findIndex(y => y >= 1.37);
  for (let i = top - 1; i >= 0; i--) { const dy = ys[i + 1] - ys[i]; for (let k = 0; k < N; k++) R[i][k] = Math.max(R[i][k], R[i + 1][k] - (o.drape ?? .1) * dy); }
  // between the widest point over the hips and the chest the cloth spans straight (no pinch at the mannequin's narrow waist);
  // a fitted garment (a dress) takes in a natural waist instead
  if (o.fitted) { const wr = ellR(.13, .1, 2.4); for (let i = 0; i < ys.length; i++) { const k0 = smooth(.98, 1.08, ys[i]) * (1 - smooth(1.2, 1.3, ys[i])); if (k0 <= 0) continue;
      for (let k = 0; k < N; k++) R[i][k] = lerp(R[i][k], Math.max(wr(TH(k, N)), wrapR(wrapSet, TH(k, N), ys[i], cx, cz) + ease * .5), k0); } }
  else for (let k = 0; k < N; k++) { let ih = 0; for (let i = 0; i < top; i++) if (ys[i] < 1.06 && R[i][k] >= R[ih][k]) ih = i;
    for (let i = ih + 1; i < top; i++) R[i][k] = Math.max(R[i][k], lerp(R[ih][k], R[top][k], (ys[i] - ys[ih]) / (ys[top] - ys[ih]))); }
  if (o.flare) for (let i = 0; i < ys.length; i++) { const f = o.flare * smooth(.95, o.hem, ys[i]); for (let k = 0; k < N; k++) R[i][k] += f; }
  const rings = ys.map((y, i) => ({ pts: ringAt(y, N, cx, cz, (th, k) => R[i][k]), main: true, cx, cz }));
  // yoke: from the top ring to the neckline, the sides staying out over the shoulder caps until the shoulder point
  const nk = { w: .074, d: .068, y: 1.566, z: .012, ...(o.neck || {}) }, topR = R[R.length - 1], nkR = ellR(nk.w, nk.d, 2.2);
  const steps = 10;
  for (let s = 1; s <= steps; s++) { const f = s / steps, y = lerp(1.47, nk.y, Math.pow(f, .85));
    rings.push({ main: true, cx, cz, pts: Array.from({ length: N }, (_, k) => { const th = TH(k, N), L = Math.pow(Math.sin(th), 2), g = L * Math.pow(smooth(.25, 1, f), 1.1) + (1 - L) * Math.pow(f, 1.15);
      const r0 = topR[k], x0 = cx + r0 * Math.sin(th), z0 = cz + r0 * Math.cos(th), r1 = nkR(th), x1 = r1 * Math.sin(th), z1 = nk.z + r1 * Math.cos(th);
      return [lerp(x0, x1, g), y, lerp(z0, z1, g)]; }) }); }
  const shapes = [...TORSO_SHAPES.map(k => BODY[k]), capShape('L', capR), capShape('R', capR), ...(o.hem < .96 ? ['hipbL', 'hipbR', 'thighL', 'thighR'].map(k => BODY[k]) : []), ...seat, ...(o.wrapExtra || [])];
  rings[rings.length - 1].fixed = false;
  settleRings(rings, shapes, ease * .65, 6);
  relax(rings, 2, .25); settleRings(rings, shapes, ease * .65, 1);
  rings.forEach(r => { r.fixed = true; });
  // hem + collar
  const hem = o.hemRib ? ribRings(rings[0].pts, cx, cz, -1, o.hemRib, { snug: -.004 }) : hemRings(rings[0].pts, cx, cz, -1);
  const neckPts = rings[rings.length - 1].pts;
  const collar = o.collar === 'crew' ? ribRings(neckPts, 0, nk.z, 1, .016, { snug: .002 }) : o.collar === 'stand' ? ribRings(neckPts, 0, nk.z, 1, o.standH ?? .03, { snug: .004 }).map(r => ({ ...r, rib: false })) : hemRings(neckPts, 0, nk.z, 1);
  return { rings: [...hem, ...rings, ...collar], main: rings, N, cx, cz, shapes };
}
function torsoPanel(name, o) {
  const T = torsoRings(o), geo = loft(T.rings, { skip: o.skip });
  const p = panel(name, geo, (x, y) => wTorso(x, y, o.legK), { shapes: [...TORSO_SHAPES, 'capL', 'capR', ...(o.hem < .96 ? ['hipbL', 'hipbR', 'thighL', 'thighR'] : []), ...(o.hem < 1.0 && !o.noSeat ? ['seatL', 'seatR'] : [])], margin: (o.ease ?? .018) * .45, ...o });
  p.capR = o.capR ?? .064; p.rings = T.main; return p;
}
// sleeve: a tube down the arm from a dome over the shoulder (a sphere round the joint: any arm angle keeps it covered)
// distances down a limb (from `end` up to 0, bottom first) every `step`, finer inside the [a, b, step] zones
function stations(end, step, zones = []) { const out = []; let s = 0; while (s < end - 1e-6) { out.push(s); const z = zones.find(([a, b]) => s >= a && s < b); s += z ? z[2] : step; } out.push(end); return out.reverse(); }
const ARM_R = s => s < .24 ? .062 : s < .3 ? lerp(.062, .057, (s - .24) / .06) : lerp(.057, .047, clamp((s - .3) / .23));
function sleevePanel(sd, o) {
  const N = o.N ?? 28, sh = REST['sh' + sd], cx = sh[0], cz = 0, fit = o.fit ?? 1, end = o.end ?? .53, capR = o.capR ?? .064;
  // under the shoulder yoke the sleeve narrows into its cap (a sphere round the joint, inside the torso's own shoulder cap)
  const rOf = (s, th) => { let r = ARM_R(s) * fit; if (o.folds) r += .0024 * Math.sin(3 * th + 1.3) * Math.exp(-(((s - .3) / .045) ** 2)) + .002 * Math.sin(5 * th + .4) * Math.exp(-(((s - end + .07) / .04) ** 2));
    return Math.min(r, lerp(capR - .003, r, smooth(.02, .15, s))); };
  // ring stations down the arm: every 2.2 cm, every 7 mm across the elbow (a bent elbow stretches the cloth there)
  const main = [], ss = stations(end, .022, [[.2, .38, .007]]);
  for (const s of ss) { const cr = s < .06 ? lerp(capR, rOf(.06, 0), s / .06) : null; main.push({ main: true, cx, cz, pts: ringAt(sh[1] - s, N, cx, cz, th => cr ?? rOf(s, th)) }); }
  for (const a of [16, 32, 48, 64, 78, 88]) { const q = a * Math.PI / 180; main.push({ pts: ringAt(sh[1] + capR * Math.sin(q), N, cx, cz, () => Math.max(.002, capR * Math.cos(q))), fixed: true }); }
  const end0 = main[0].pts, cuff = o.cuff === 'rib' ? ribRings(end0, cx, cz, -1, .04, { snug: -.006 }) : hemRings(end0, cx, cz, -1, { back: .016 });
  const rings = [...cuff, ...main], geo = loft(rings);
  const p = panel('sleeve' + sd, geo, (x, y) => wArm(sd, x, y), { shapes: ['shb', 'uarm', 'elb', 'farm', 'wri'].map(k => k + sd).concat(['head']), margin: .0075, ...o });
  p.rings = main; return p;
}
// trousers: a seat (wrapped round the hips and the tops of the leg tubes) and two leg tubes from domes over the hip joints
const LEG_R = s => s < .2 ? lerp(.081, .078, s / .2) : s < .44 ? lerp(.078, .068, (s - .2) / .24) : s < .62 ? lerp(.068, .063, (s - .44) / .18) : lerp(.063, .06, clamp((s - .62) / .24));
function legPanel(sd, o) {
  const N = o.N ?? 28, hp = REST['hip' + sd], cx = hp[0], cz = 0, fit = o.fit ?? 1, end = o.end ?? .862, capR = .081 * fit;
  const rOf = (s, th) => { let r = LEG_R(s) * fit; if (o.flare) r += o.flare * smooth(.5, end, s);
    if (o.stack) r += .0028 * Math.sin(4 * th + 2.1 + s * 30) * smooth(end - .14, end - .02, s) + .002 * Math.sin(3 * th + .7) * Math.exp(-(((s - .47) / .04) ** 2)); return r; };
  const main = [], ss = stations(end, .024, [[.34, .56, .008]]);   // dense across the knee
  for (const s of ss) main.push({ main: true, cx, cz, pts: ringAt(hp[1] - s, N, cx, cz, th => s < .05 ? lerp(capR, rOf(.05, th), s / .05) : rOf(s, th)) });
  for (const a of [18, 36, 54, 70, 84]) { const q = a * Math.PI / 180; main.push({ pts: ringAt(hp[1] + capR * Math.sin(q), N, cx, cz, () => Math.max(.002, capR * Math.cos(q))), fixed: true }); }
  const cuff = o.cuff === 'rib' ? ribRings(main[0].pts, cx, cz, -1, .045, { snug: -.012 }) : hemRings(main[0].pts, cx, cz, -1, { back: .02, thick: .005 });
  const geo = loft([...cuff, ...main]);
  const p = panel('leg' + sd, geo, (x, y) => wLeg(sd, x, y), { shapes: ['hipb', 'thigh', 'knee', 'shin', 'ankle'].map(k => k + sd), margin: .0075, ...o });
  p.rings = main; p.capR = capR; return p;
}
function seatPanel(o) {
  const N = o.N ?? 44, cx = 0, cz = 0, fit = o.fit ?? 1, top = o.waist ?? 1.02, bot = o.bottom ?? .846, ease = o.ease ?? .012;
  const legTube = s => extra('tube' + s, 'hip' + s, 'cap', { a: [0, 0, 0], b: [0, -.2, 0], ra: .081 * fit + .001, rb: .078 * fit + .001 });
  const shapes = [BODY.hips, BODY.waist, BODY.hipbL, BODY.hipbR, legTube('L'), legTube('R')];
  const ys = []; for (let y = bot; y < top - 1e-6; y += .02) ys.push(y); ys.push(top);
  const R = ys.map(y => csmooth(Float32Array.from({ length: N }, (_, k) => wrapR(shapes, TH(k, N), y, cx, cz) + ease), 4));
  // hold the waist up: the seat never pinches in above the hips (the mannequin's waist is narrower than a waistband)
  const iw = ys.findIndex(y => y >= .99); for (let i = Math.max(1, iw); i < ys.length; i++) for (let k = 0; k < N; k++) R[i][k] = Math.max(R[i][k], R[i - 1][k] - .25 * (ys[i] - ys[i - 1]));
  const rings = ys.map((y, i) => ({ main: true, cx, cz, pts: ringAt(y, N, cx, cz, (th, k) => R[i][k]) }));
  settleRings(rings, shapes, ease * .6, 3);
  const band = o.band ?? .038, top0 = rings[rings.length - 1].pts;
  const wb = [{ pts: offRing(top0, cx, cz, .0025, .002), fixed: true, band: true }, { pts: offRing(top0, cx, cz, .0035, band * .5), fixed: true, band: true }, { pts: offRing(top0, cx, cz, .003, band), fixed: true, band: true },
    { pts: offRing(top0, cx, cz, .0005, band + .004), fixed: true, band: true }, { pts: offRing(top0, cx, cz, -.005, band - .01), fixed: true, band: true }];
  // the seat ends just outside the leg tubes with a thin turned edge (no hem line: it reads as one garment with the legs)
  const hem = [{ pts: offRing(rings[0].pts, cx, cz, -.004, .012), fixed: true }, { pts: offRing(rings[0].pts, cx, cz, -.001, -.003), fixed: true }];
  const all = [...hem, ...rings, ...wb], geo = loft(all);
  const p = panel('seat', geo, (x, y) => wSeat(x, y), { shapes: ['hips', 'waist', 'hipbL', 'hipbR', 'thighL', 'thighR'], margin: .008, ...o });
  p.rings = rings; p.waistTop = top + band; return p;
}
// hood (up): a shell round the head, open at the face (piped edge), its base sitting in the neckline
function hoodUp(o) {
  const N = 40, cx = 0, cz = .012, prof = [[1.565, .088, .072, .09], [1.6, .1, .088, .112], [1.64, .112, .104, .13], [1.69, .12, .116, .142], [1.735, .122, .121, .148], [1.78, .117, .116, .142], [1.815, .104, .1, .128], [1.845, .085, .078, .108], [1.866, .058, .05, .078], [1.879, .028, .022, .04], [1.884, .006, .005, .008]];
  const rings = prof.map(([y, w, df, db]) => ({ main: true, cx, cz, pts: Array.from({ length: N }, (_, k) => { const th = TH(k, N), c = Math.cos(th), d = c >= 0 ? df : db, r = ellR(w, d, 2.15)(th);
    return [cx + r * Math.sin(th), y, cz + r * c + (c > 0 ? .012 * smooth(1.62, 1.8, y) * c : 0)]; }) }));
  const opening = (x, y, z) => { const dy = (y - 1.735) / .1; if (dy * dy >= 1 || z < .02) return false; const a = Math.atan2(x, z - cz); return Math.abs(a) < .98 * Math.sqrt(1 - dy * dy); };
  const geo = loft(rings, { skip: (x, y, z) => opening(x, y, z) });
  const p = panel('hood', geo, (x, y) => wHead(x, y), { shapes: ['head', 'neck'], margin: .012, ...o, mats: ['main', 'rib'] });
  // the piped edge round the face opening: sampled on the shell where the opening's border runs
  const edge = []; for (let i = 0; i < 44; i++) { const a = i / 44 * Math.PI * 2, y = 1.735 + .1 * Math.sin(a) * .985, half = .98 * Math.sqrt(Math.max(0, 1 - ((y - 1.735) / .1) ** 2)), th = Math.cos(a) >= 0 ? half : -half;
    const s = surfaceAt(rings, th, y); edge.push([s.p.x + s.n.x * .002, s.p.y, s.p.z + s.n.z * .002]); }
  const pipe = cord('hoodEdge', edge, .0085, (x, y) => wHead(x, y), { closed: true, region: o.region, fabric: o.fabric, shapes: ['head'], margin: .012 });
  return { panels: [p, pipe], rings };
}
// hood (down): the hood lies folded round the back of the neck on the shoulders
function hoodDown(o) {
  const pts = [], big = Math.max(0, (o.layer ?? 1) - 1) * .02; for (let i = 0; i <= 16; i++) { const a = lerp(-1.6, 1.6, i / 16), r = .108 + big + .02 * Math.cos(a);
    pts.push([r * Math.sin(a) * 1.06, 1.552 - .022 * (1 - Math.cos(a)) * .5 + .006 * Math.cos(a), .012 - r * Math.cos(a) * .95 + (Math.abs(a) > 1.5 ? .02 : 0)]); }
  const N = 14, rings = pts.map((p, i) => { const t = i / 16, rr = .032 * Math.max(.12, Math.pow(Math.sin(Math.PI * t), .6)), prev = pts[Math.max(0, i - 1)], next = pts[Math.min(16, i + 1)], tg = V3(next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]).normalize();
    const u = V3(0, 1, 0), w = tg.clone().cross(u).normalize(); return { pts: Array.from({ length: N }, (_, k) => { const q = k / N * Math.PI * 2, f = Math.sin(q) > 0 ? 1.25 : .8;
      return [p[0] + (u.x * Math.cos(q) * .7 + w.x * Math.sin(q) * f) * rr, p[1] + (u.y * Math.cos(q) * .7) * rr, p[2] + (u.z * Math.cos(q) * .7 + w.z * Math.sin(q) * f) * rr]; }) }; });
  return panel('hoodDown', loft(rings), () => [['chest', 1]], { shapes: ['chest', 'neck', 'capL', 'capR'], margin: .026 + (o.layer ?? 1) * .012, capR: .07 + (o.layer ?? 1) * .012, ...o, mats: ['main'] });
}
// geometry helpers for rigid parts
const RB = (w, h, d, r = .01, s = 3) => MOD.box(w, h, d, r, s);
function sole(w, h, d) { return RB(w, h, d, Math.min(.011, h / 2 - .001)); }
function lathe(prof, seg = 28) { return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg); }

// the wardrobe: key -> (o) => { panels, rigid }. o: { region, fabric, ...garment options } (+ o.colors for sub-parts)
const GARMENTS = {
  tee(o) { const t = torsoPanel('tee', { hem: .895, ease: .017, capR: .06, collar: 'crew', region: o.region, fabric: o.fabric ?? 'jersey', rib: 'rib', drape: .12 });
    const s = ['L', 'R'].map(sd => sleevePanel(sd, { end: .19, fit: 1.06, capR: .06, region: o.region, fabric: o.fabric ?? 'jersey', rib: 'rib' }));
    return { panels: [t, ...s] }; },
  longtee(o) { const t = torsoPanel('longtee', { hem: .865, ease: .02, collar: 'crew', region: o.region, fabric: o.fabric ?? 'jersey', rib: 'rib' });
    return { panels: [t, ...['L', 'R'].map(sd => sleevePanel(sd, { end: .52, fit: 1.04, folds: true, cuff: 'rib', region: o.region, fabric: o.fabric ?? 'jersey', rib: 'rib' }))] }; },
  sweater(o) { const t = torsoPanel('sweater', { hem: .87, ease: .022, capR: .062, collar: 'crew', hemRib: .05, region: o.region, fabric: 'knit', rib: 'rib', drape: .06 });
    return { panels: [t, ...['L', 'R'].map(sd => sleevePanel(sd, { end: .525, fit: 1.1, folds: true, cuff: 'rib', capR: .062, region: o.region, fabric: 'knit', rib: 'rib' }))] }; },
  hoodie(o) {
    const L = o.layer ?? 0, ease = .026 + L * .02, f = o.fabric ?? 'fleece';
    const t = torsoPanel('hoodie', { hem: .86, ease, collar: o.hood === 'up' ? 'none' : 'crew', hemRib: .055, neck: { w: .08, d: .07 }, region: o.region, fabric: f, rib: 'rib', drape: .05, layer: L, capR: .064 });
    const out = [t, ...['L', 'R'].map(sd => sleevePanel(sd, { end: .525, fit: 1.14, folds: true, cuff: 'rib', capR: .064, region: o.region, fabric: f, rib: 'rib', layer: L }))];
    if (!o.under) out.push(patch('pocket', t.rings, (x, y) => wTorso(x, y), { y0: .935, y1: 1.1, rows: 6, cols: 12, off: .006, bulge: .004, th: (y, v) => { const w = lerp(.62, .4, v); return [-w, w]; }, region: o.region, fabric: f, shapes: ['hips', 'waist', 'chest'], margin: ease * .45 + .006 }));
    const parts = { panels: out, rigid: [] };
    if (o.hood === 'up') { const H = hoodUp({ region: o.region, fabric: f }); parts.panels.push(...H.panels);
      // drawstrings from the hood's front edge, metal aglets
      for (const s of [1, -1]) { const top = surfaceAt(H.rings, s * .62, 1.648), x = top.p.x + top.n.x * .01, z = top.p.z + top.n.z * .01;
        const pts = []; for (let i = 0; i <= 8; i++) { const k = i / 8; pts.push([x + s * .004 * k, 1.645 - .17 * k, z + .02 * Math.sin(k * 1.4) + .012]); }
        parts.panels.push(cord('string', pts, .0032, () => [['chest', 1]], { region: 'accent2', fabric: 'cotton', shapes: ['chest'], margin: .03 }));
        parts.rigid.push(rigid('aglet', new THREE.CylinderGeometry(.0042, .0042, .018, 10), 'chest', [pts[8][0] - REST.chest[0], pts[8][1] - .008 - REST.chest[1], pts[8][2] - REST.chest[2]], { region: 'metal', fabric: 'metal' })); }
      if (o.visor) parts.rigid.push(...visor()); }
    else if (o.hood !== 'none') parts.panels.push(hoodDown({ region: o.region, fabric: f, layer: o.under ? 3 : L + 1 }));
    return parts;
  },
  parka(o) {
    const ease = .046, f = 'nylon';
    const t = torsoPanel('parka', { hem: .7, ease, collar: 'stand', standH: .055, neck: { w: .1, d: .092, y: 1.575, z: .006 }, region: o.region, fabric: f, drape: .02, flare: .012, layer: 1, capR: .08 });
    const sl = ['L', 'R'].map(sd => sleevePanel(sd, { end: .525, fit: 1.3, folds: true, capR: .08, region: o.region, fabric: f, layer: 1 }));
    const tw = (x, y) => wTorso(x, y), sh = ['hips', 'waist', 'chest', 'thighL', 'thighR'], m = ease * .45 + .007;
    const out = [t, ...sl,
      patch('placket', t.rings, tw, { y0: .72, y1: 1.58, rows: 18, cols: 3, off: .005, th: () => [-.075, .075], region: o.region, fabric: f, shapes: sh, margin: m }),
      ...[1, -1].flatMap(s => [
        patch('pocketLow', t.rings, tw, { y0: .78, y1: .93, rows: 5, cols: 6, off: .007, bulge: .006, th: () => s > 0 ? [.45, 1.05] : [-1.05, -.45], region: o.region, fabric: f, shapes: sh, margin: m }),
        patch('flapLow', t.rings, tw, { y0: .915, y1: .965, rows: 2, cols: 6, off: .016, th: () => s > 0 ? [.43, 1.07] : [-1.07, -.43], region: o.region, fabric: f, shapes: sh, margin: m }),
        patch('pocketChest', t.rings, tw, { y0: 1.27, y1: 1.39, rows: 4, cols: 5, off: .007, bulge: .004, th: () => s > 0 ? [.3, .78] : [-.78, -.3], region: o.region, fabric: f, shapes: sh, margin: m }),
        patch('flapChest', t.rings, tw, { y0: 1.375, y1: 1.415, rows: 2, cols: 5, off: .015, th: () => s > 0 ? [.28, .8] : [-.8, -.28], region: o.region, fabric: f, shapes: sh, margin: m })])];
    const zip = patch('zip', t.rings, tw, { y0: .72, y1: 1.6, rows: 18, cols: 1, off: .0085, th: () => [-.012, .012], region: 'zip', fabric: 'metal', shapes: sh, margin: m });
    return { panels: [...out, zip] };
  },
  jacket(o) {   // suit jacket: open V front with lapels, a back collar, buttons, flap pockets
    const ease = .03, f = 'wool', vb = 1.14;
    const vHalf = y => y < vb ? 0 : .42 * Math.pow(smooth(vb, 1.56, y), .8) + .02;
    const skip = (x, y, z) => z > 0 && y > vb && Math.abs(Math.atan2(x, z + .005)) < vHalf(y);
    const t = torsoPanel('jacket', { hem: .81, ease, collar: 'none', neck: { w: .085, d: .078, y: 1.585, z: .0 }, region: o.region, fabric: f, drape: .05, layer: 1, capR: .074, skip });
    const tw = (x, y) => wTorso(x, y), sh = ['hips', 'waist', 'chest'], m = ease * .45 + .007;
    const lapel = s => patch('lapel', t.rings, tw, { y0: vb, y1: 1.575, rows: 14, cols: 4, off: .006, bulge: .003, th: (y, v) => { const a = vHalf(y), w = .05 + .24 * Math.sin(Math.PI * Math.pow(v, .9)) * (v < .75 ? 1 : 1 - (v - .75) * 2.6); return s > 0 ? [a - .12, a + Math.max(.04, w)] : [-a - Math.max(.04, w), -a + .12]; }, region: o.region, fabric: 'wool2', shapes: sh, margin: m });
    const out = [t, ...['L', 'R'].map(sd => sleevePanel(sd, { end: .515, fit: 1.2, folds: true, capR: .074, region: o.region, fabric: f, layer: 1 })), lapel(1), lapel(-1),
      ...[1, -1].map(s => patch('flap', t.rings, tw, { y0: .93, y1: .975, rows: 2, cols: 5, off: .006, th: () => s > 0 ? [.62, 1.05] : [-1.05, -.62], region: o.region, fabric: f, shapes: sh, margin: m })),
      patch('breast', t.rings, tw, { y0: 1.33, y1: 1.355, rows: 1, cols: 4, off: .005, th: () => [.62, .9], region: o.region, fabric: f, shapes: sh, margin: m })];
    // the back collar: a band round the back of the neck meeting the lapels
    const cr = []; for (let i = 0; i <= 3; i++) { const y = 1.555 + i * .012, pts = []; for (let k = 0; k <= 16; k++) { const a = lerp(.9, Math.PI * 2 - .9, k / 16), s = surfaceAt(t.rings, a, Math.min(1.57, y)); pts.push([s.p.x + s.n.x * (.006 + i * .002), y + .004, s.p.z + s.n.z * (.006 + i * .002)]); } cr.push({ pts }); }
    out.push(panel('collar', loft(cr, { wrap: false }), (x, y) => wTorso(x, y), { shapes: ['chest', 'neck'], margin: .03, region: o.region, fabric: 'wool2', mats: ['main'] }));
    const rig = [];
    for (const y of [1.0, 1.1]) { const s = surfaceAt(t.rings, .03, y); rig.push(rigid('button', new THREE.CylinderGeometry(.011, .011, .005, 16), 'spine', [s.p.x + s.n.x * .006 - REST.spine[0], y - REST.spine[1], s.p.z + s.n.z * .006 - REST.spine[2]], { rot: [Math.PI / 2, 0, 0], region: 'button', fabric: 'plastic' })); }
    return { panels: out, rigid: rig };
  },
  shirt(o) {   // dress shirt: only the collar and the V show under a jacket (its own sleeves end at the cuffs)
    const t = torsoPanel('shirt', { hem: .9, ease: .014, collar: 'stand', standH: .03, neck: { w: .066, d: .06, y: 1.585, z: .012 }, region: o.region, fabric: 'cotton', drape: .14 });
    const out = [t, ...['L', 'R'].map(sd => sleevePanel(sd, { end: .54, fit: 1.0, region: o.region, fabric: 'cotton' }))];
    const rig = [];
    // collar points, angled down over the stand
    for (const s of [1, -1]) { const p = surfaceAt(t.rings, s * .3, 1.57); rig.push(rigid('collarPt', RB(.05, .045, .004, .002), 'chest', [p.p.x + s * .006 - REST.chest[0], 1.593 - REST.chest[1], p.p.z + .02 - REST.chest[2]], { rot: [.35, s * .55, s * .75], region: o.region, fabric: 'cotton' })); }
    if (o.tie) { const tw = (x, y) => wTorso(x, y);
      out.push(patch('tie', t.rings, tw, { y0: 1.02, y1: 1.555, rows: 14, cols: 3, off: .008, bulge: .002, th: (y, v) => { const w = lerp(.15, .075, Math.pow(v, .7)); return v < .06 ? [-w * v / .06, w * v / .06] : [-w, w]; }, region: 'accent', fabric: 'silk', shapes: ['waist', 'chest'], margin: .022 }));
      const k = surfaceAt(t.rings, 0, 1.565); rig.push(rigid('knot', RB(.034, .036, .022, .009), 'chest', [k.p.x - REST.chest[0], 1.567 - REST.chest[1], k.p.z + .012 - REST.chest[2]], { rot: [-.12, 0, 0], region: 'accent', fabric: 'silk' })); }
    return { panels: out, rigid: rig };
  },
  jumpsuit(o) {
    const t = torsoPanel('jumpsuitTop', { hem: .86, ease: .026, collar: 'stand', standH: .026, neck: { w: .078, d: .07 }, region: o.region, fabric: 'canvas', drape: .04, capR: .068 });
    const seat = seatPanel({ waist: 1.02, ease: .006, fit: 1.06, band: .0, region: o.region, fabric: 'canvas' });
    const legs = ['L', 'R'].map(sd => legPanel(sd, { fit: 1.06, stack: true, region: o.region, fabric: 'canvas' }));
    const tw = (x, y) => wTorso(x, y);
    return { panels: [t, seat, ...legs, ...['L', 'R'].map(sd => sleevePanel(sd, { end: .5, fit: 1.16, folds: true, capR: .068, region: o.region, fabric: 'canvas' })),
      patch('zip', t.rings, tw, { y0: .9, y1: 1.6, rows: 14, cols: 1, off: .006, th: () => [-.01, .01], region: 'zip', fabric: 'metal', shapes: ['waist', 'chest'], margin: .02 }),
      patch('pocket', t.rings, tw, { y0: 1.26, y1: 1.37, rows: 3, cols: 4, off: .006, bulge: .003, th: () => [.36, .78], region: o.region, fabric: 'canvas', shapes: ['chest'], margin: .02 })] };
  },
  vest(o) {   // police duty vest / plate carrier: sleeveless, deep armholes, straps over the shoulders, pouches
    const plate = o.kind === 'plate', ease = plate ? .05 : .038;
    const skip = (x, y) => (Math.abs(x) > (plate ? .125 : .14) && y > 1.31) || (y > 1.5 && Math.abs(x) < .075);
    const t = torsoPanel('vest', { hem: plate ? .96 : .98, ease, collar: 'none', neck: { w: .1, d: .09, y: 1.565 }, region: o.region, fabric: 'tactical', drape: 0, layer: 1, capR: .07, skip, hemRib: 0 });
    const tw = (x, y) => wTorso(x, y), rig = [];
    const pouch = (th, y, w, h, d, j = 'spine') => { const s = surfaceAt(t.rings, th, y), r = REST[j], rot = Math.atan2(s.n.x, s.n.z);
      rig.push(rigid('pouch', RB(w, h, d, .008), j, [s.p.x + s.n.x * (d / 2 + .002) - r[0], y - r[1], s.p.z + s.n.z * (d / 2 + .002) - r[2]], { rot: [0, rot, 0], region: 'accent', fabric: 'tactical' })); };
    if (plate) { for (const th of [-.42, 0, .42]) pouch(th, 1.06, .07, .1, .035); pouch(.75, 1.33, .07, .09, .03, 'chest'); pouch(-.75, 1.33, .07, .09, .03, 'chest'); }
    else { pouch(.55, 1.1, .065, .08, .03); pouch(-.55, 1.1, .065, .08, .03); const b = surfaceAt(t.rings, .5, 1.36); rig.push(rigid('badge', new THREE.CylinderGeometry(.022, .022, .004, 6), 'chest', [b.p.x + b.n.x * .004 - REST.chest[0], 1.36 - REST.chest[1], b.p.z + b.n.z * .004 - REST.chest[2]], { rot: [Math.PI / 2, 0, Math.atan2(b.n.x, b.n.z) * 0], region: 'badge', fabric: 'metal' })); }
    void tw; return { panels: [t], rigid: rig };
  },
  jeans(o) { const seat = seatPanel({ waist: 1.03, ease: .006, fit: 1, region: o.region, fabric: 'denim' });
    return { panels: [seat, ...['L', 'R'].map(sd => legPanel(sd, { fit: 1, stack: true, region: o.region, fabric: 'denim' }))], rigid: belt(seat, o) }; },
  trousers(o) { const seat = seatPanel({ waist: 1.035, ease: .006, fit: o.fit ?? 1.06, region: o.region, fabric: o.fabric ?? 'wool' });
    return { panels: [seat, ...['L', 'R'].map(sd => legPanel(sd, { fit: o.fit ?? 1.06, region: o.region, fabric: o.fabric ?? 'wool', stack: false }))], rigid: o.belt === false ? [] : belt(seat, o) }; },
  cargo(o) { const seat = seatPanel({ waist: 1.035, ease: .006, fit: 1.1, region: o.region, fabric: 'tactical' });
    const legs = ['L', 'R'].map(sd => legPanel(sd, { fit: 1.1, cuff: 'none', stack: true, region: o.region, fabric: 'tactical' }));
    const pk = ['L', 'R'].map(sd => patch('cargo', legs[sd === 'L' ? 0 : 1].rings, (x, y) => wLeg(sd, x, y), { y0: .62, y1: .76, rows: 4, cols: 5, off: .007, bulge: .006, th: () => sd === 'L' ? [1.15, 2.0] : [-2.0, -1.15], region: o.region, fabric: 'tactical', shapes: ['thigh' + sd], margin: .03 }));
    return { panels: [seat, ...legs, ...pk], rigid: belt(seat, { ...o, heavy: true }) }; },
  shorts(o) { const seat = seatPanel({ waist: 1.03, ease: .006, fit: 1.08, region: o.region, fabric: o.fabric ?? 'cotton' });
    return { panels: [seat, ...['L', 'R'].map(sd => legPanel(sd, { end: .3, fit: 1.12, region: o.region, fabric: o.fabric ?? 'cotton' }))] }; },
  dress(o) {   // a knee-length dress: fitted top, a skirt that flares from the waist (follows the thighs a little)
    const t = torsoPanel('dress', { hem: .52, ease: .016, collar: 'crew', fitted: true, noSeat: true, legK: .92, region: o.region, fabric: o.fabric ?? 'jersey', rib: 'rib', drape: .0, flare: .07, capR: .06 });
    return { panels: [t, ...['L', 'R'].map(sd => sleevePanel(sd, { end: .2, fit: 1.08, region: o.region, fabric: o.fabric ?? 'jersey', rib: 'rib' }))] }; },
  sneakers(o) { return { rigid: ['L', 'R'].flatMap(sd => shoe(sd, { ...o, sneaker: true })) }; },
  shoes(o) { return { rigid: ['L', 'R'].flatMap(sd => shoe(sd, { ...o, dress: true })) }; },
  boots(o) { const sh = ['L', 'R'].map(sd => bootShaft(sd, o)); return { panels: sh, rigid: ['L', 'R'].flatMap(sd => shoe(sd, { ...o, boot: true })) }; },
  cap(o) {   // police peaked cap
    const g = lathe([[.0, .118], [.075, .118], [.104, .112], [.108, .094], [.1, .052], [.098, .05], [.0, .05]], 36);
    const brim = new THREE.CylinderGeometry(.075, .085, .006, 30, 1, false, -Math.PI / 2 - 1.1, 2.2);
    return { rigid: [rigid('cap', g, 'head', [0, .1, .006], { scale: [1, 1, 1.08], region: o.region, fabric: 'wool' }), rigid('band', new THREE.CylinderGeometry(.1, .1, .022, 36, 1, true), 'head', [0, .162, .006], { scale: [1.005, 1, 1.085], region: 'accent2', fabric: 'tactical' }),
      rigid('brim', brim, 'head', [0, .152, .07], { rot: [.22, 0, 0], region: 'black', fabric: 'leather' }), rigid('capBadge', new THREE.CylinderGeometry(.014, .014, .004, 6), 'head', [0, .2, .118], { rot: [Math.PI / 2 - .2, 0, 0], region: 'badge', fabric: 'metal' })] }; },
  helmet(o) { const shell = new THREE.SphereGeometry(1, 36, 18, 0, Math.PI * 2, 0, 1.75);
    return { rigid: [rigid('helmet', shell, 'head', [0, .118, .0], { scale: [.118, .118, .132], region: o.region, fabric: 'tactical' }), rigid('rim', new THREE.TorusGeometry(1, .07, 8, 36), 'head', [0, .095, .0], { rot: [Math.PI / 2 - .1, 0, 0], scale: [.117, .131, .118], region: o.region, fabric: 'tactical' })] }; },
  balaclava(o) { return { rigid: [rigid('balaclava', new THREE.SphereGeometry(1, 36, 24), 'head', [0, .098, .012], { scale: [.094, .119, .105], region: o.region ?? 'black', fabric: 'knit' }),
    rigid('neckGaiter', new THREE.CylinderGeometry(.052, .062, .1, 24, 1, true), 'neck', [0, .02, .0], { region: o.region ?? 'black', fabric: 'knit' })] }; },
  goggles() { return { rigid: [rigid('goggles', new THREE.SphereGeometry(1, 32, 8, Math.PI / 2 - 1.05, 2.1, 1.25, .55), 'head', [0, .105, .012], { scale: [.1, .125, .112], region: 'lens', fabric: 'lens' }),
    rigid('strap', new THREE.CylinderGeometry(1, 1, .022, 32, 1, true), 'head', [0, .14, .012], { scale: [.098, 1, .11], region: 'black', fabric: 'tactical' })] }; },
  gloves(o) { return { rigid: ['L', 'R'].flatMap(sd => [rigid('palmG', RB(.036, .096, .08, .016), 'wr' + sd, [0, -.046, 0], { region: o.region ?? 'black', fabric: 'leather' }), rigid('fingG', RB(.031, .078, .076, .014), 'fi' + sd, [0, -.034, 0], { region: o.region ?? 'black', fabric: 'leather' }),
    rigid('cuffG', new THREE.CylinderGeometry(.04, .036, .045, 18), 'wr' + sd, [0, .0, 0], { region: o.region ?? 'black', fabric: 'leather' })]) }; },
  kneepads(o) { return { rigid: ['L', 'R'].map(sd => rigid('kneepad', RB(.11, .12, .05, .02), 'kn' + sd, [0, -.01, .075], { region: o.region ?? 'black', fabric: 'tactical' })) }; },
};
function visor() {   // the chrome visor across the egg head (generic hacker): a curved band, mirror finish
  const g = new THREE.SphereGeometry(1, 40, 10, Math.PI / 2 - 1.2, 2.4, 1.3, .48);
  return [rigid('visor', g, 'head', [0, .1, .016], { scale: [.098, .124, .112], region: 'chrome', fabric: 'chrome' })];
}
function belt(seat, o) {
  const rig = [], s = surfaceAt(seat.rings, 0, seat.waistTop - .02);
  rig.push(rigid('buckle', RB(.05, .036, .008, .004), 'hips', [s.p.x - REST.hips[0], seat.waistTop - .02 - REST.hips[1], s.p.z + .009 - REST.hips[2]], { region: o.heavy ? 'black' : 'metal', fabric: o.heavy ? 'plastic' : 'metal' }));
  return rig;
}
function shoe(sd, o) {
  const j = 'an' + sd, out = [], up = o.boot ? 'bootUp' : 'shoe';
  out.push(rigid('sole', sole(.104, .024, .276), j, [0, -.06, .051], { region: o.dress ? 'soleDark' : o.boot ? 'soleDark' : 'sole', fabric: 'rubber' }));
  if (o.boot) out.push(rigid(up, RB(.1, .1, .26, .032), j, [0, -.012, .045], { region: o.region, fabric: 'leather' }));
  else out.push(rigid(up, RB(.096, .064, .258, .03), j, [0, -.03, .047], { region: o.region, fabric: o.dress ? 'leatherGloss' : 'leather' }));
  if (o.sneaker) { out.push(rigid('toe', RB(.099, .03, .056, .013), j, [0, -.046, .158], { region: 'sole', fabric: 'rubber' }));
    out.push(rigid('collar', new THREE.TorusGeometry(.044, .011, 10, 24), j, [0, .0, -.006], { rot: [Math.PI / 2 + .25, 0, 0], scale: [1, 1.2, 1], region: o.region, fabric: 'leather' }));
    out.push(rigid('tongue', RB(.05, .055, .012, .006), j, [0, -.006, .062], { rot: [-.55, 0, 0], region: o.region, fabric: 'leather' }));
    for (let i = 0; i < 4; i++) out.push(rigid('lace', RB(.05, .005, .007, .002), j, [0, -.005 - i * .0065, .05 + i * .02], { rot: [-.55, 0, 0], region: 'lace', fabric: 'cotton' })); }
  if (o.boot) for (let i = 0; i < 5; i++) out.push(rigid('lace', RB(.054, .005, .007, .002), j, [0, .02 - i * .012, .088 + i * .01], { rot: [-.4, 0, 0], region: 'lace', fabric: 'cotton' }));
  return out;
}
function bootShaft(sd, o) {   // the boot's shaft round the ankle and shin (skinned: ankle at the bottom, shin at the top)
  const N = 22, an = REST['an' + sd], cx = an[0], rings = [];
  for (let i = 0; i <= 5; i++) { const y = an[1] - .01 + i * .028; rings.push({ main: true, pts: ringAt(y, N, cx, .004, th => .056 - i * .0015 + .004 * Math.max(0, Math.cos(th))) }); }
  const top = rings[rings.length - 1].pts, roll = [{ pts: offRing(top, cx, .004, .003, .004), fixed: true }, { pts: offRing(top, cx, .004, -.006, -.012), fixed: true }];
  return panel('shaft' + sd, loft([...rings, ...roll]), (x, y) => { const k = smooth(an[1] + .02, an[1] + .12, y); return [['an' + sd, 1 - k], ['kn' + sd, k]]; }, { shapes: ['ankle' + sd, 'shin' + sd], margin: .01, region: o.region, fabric: 'leather', mats: ['main'] });
}

// =====================================================================================================================
// FABRICS: a small tiling weave per cloth (detail in the colour and the same picture as a bump map), sheen on soft cloth
// =====================================================================================================================
let _seed = 7; const rnd = () => ((_seed = (_seed * 16807) % 2147483647) / 2147483647);
const TEX = {};
function weave(kind) {
  if (TEX[kind]) return TEX[kind];
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d'), img = x.createImageData(S, S), d = img.data; _seed = 11 + kind.length * 97 + kind.charCodeAt(0);
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    let v;
    switch (kind) {
      case 'jersey': v = 236 + (rnd() - .5) * 26 + (py % 4 < 2 ? 3 : -3); break;                                 // heathered knit: flecks + fine courses
      case 'fleece': v = 238 + (rnd() - .5) * 12; break;
      case 'knit': { const cx = px % 8, cy = py % 10; v = 230 + 18 * Math.cos(cx / 8 * Math.PI * 2) * (cy < 5 ? 1 : -1) * .5 + (rnd() - .5) * 10 - (cy === 0 ? 14 : 0); break; }   // stocking stitch
      case 'rib': v = 222 + 30 * (Math.sin(px / S * Math.PI * 2 * 32) * .5 + .5) + (rnd() - .5) * 8; break;    // ribs run along v (down the band)
      case 'denim': v = 212 + (((px + py) % 6) < 3 ? 14 : -10) + (rnd() - .5) * 30 + (rnd() < .02 ? 35 : 0); break;   // twill + slubs
      case 'wool': v = 240 + (rnd() - .5) * 10; break;
      case 'nylon': v = 244 + (rnd() - .5) * 5 - (py % 64 < 2 ? 34 : py % 64 < 4 ? 12 : 0); break;          // quilted channels
      case 'canvas': v = 236 + ((px % 3 === 0) !== (py % 3 === 0) ? 8 : -4) + (rnd() - .5) * 10; break;
      case 'tactical': v = 232 + (py % 16 < 2 ? -28 : 0) + (rnd() - .5) * 12; break;                          // webbing rows
      case 'cotton': v = 242 + (rnd() - .5) * 8 + (px % 2 ? 2 : -2); break;
      default: v = 245 + (rnd() - .5) * 6;
    }
    const i = (py * S + px) * 4; d[i] = d[i + 1] = d[i + 2] = clamp(v, 0, 255); d[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return (TEX[kind] = t);
}
// rough: roughness | sheen: the soft rim of cloth | tile: metres per repeat of the weave | bump: relief of the weave
const FABRIC = {
  jersey: { rough: .86, sheen: .7, tile: .07, bump: .9, tex: 'jersey' }, fleece: { rough: .92, sheen: .9, tile: .1, bump: .5, tex: 'fleece' },
  knit: { rough: .95, sheen: 1, tile: .045, bump: 2.2, tex: 'knit' }, rib: { rough: .9, sheen: .8, tile: .05, bump: 1.8, tex: 'rib' },
  denim: { rough: .84, sheen: .35, tile: .045, bump: 1.2, tex: 'denim' }, wool: { rough: .8, sheen: .55, tile: .08, bump: .45, tex: 'wool' },
  wool2: { rough: .66, sheen: .6, tile: .08, bump: .3, tex: 'wool' }, nylon: { rough: .52, sheen: .25, coat: .12, tile: .42, bump: 2.2, tex: 'nylon' },
  canvas: { rough: .86, sheen: .35, tile: .05, bump: .9, tex: 'canvas' }, tactical: { rough: .8, sheen: .2, tile: .26, bump: 1.4, tex: 'tactical' },
  cotton: { rough: .84, sheen: .45, tile: .06, bump: .35, tex: 'cotton' }, silk: { rough: .36, sheen: .8, tile: .05, bump: .15, tex: 'wool' },
  leather: { rough: .5, coat: .25 }, leatherGloss: { rough: .26, coat: .85 }, rubber: { rough: .78 }, plastic: { rough: .4, coat: .4 },
  metal: { rough: .28, metal: 1 }, chrome: { rough: .05, metal: 1, coat: 1 }, lens: { rough: .06, metal: .25, coat: 1 },
};
const MATS = new Map();
function fabricMat(fabric, color, flat) {
  const F = FABRIC[fabric] || FABRIC.cotton, key = `${fabric}|${color}|${!!flat}`; if (MATS.has(key)) return MATS.get(key);
  const col = new THREE.Color(color), o = { color: col, roughness: F.rough ?? .8, metalness: F.metal ?? 0, side: THREE.DoubleSide, flatShading: !!flat };
  if (F.sheen) { o.sheen = F.sheen; o.sheenRoughness = .7; o.sheenColor = col.clone().lerp(new THREE.Color(0xffffff), .3); }
  if (F.coat) { o.clearcoat = F.coat; o.clearcoatRoughness = .22; }
  if (F.tex && !flat) { const t = weave(F.tex).clone(); t.needsUpdate = true; t.repeat.set(1 / F.tile, 1 / F.tile); o.map = t; o.bumpMap = t; o.bumpScale = F.bump ?? 1; }
  const m = new THREE.MeshPhysicalMaterial(o); m.name = fabric; MATS.set(key, m); return m;
}
// colours of the small parts that are not one of the five regions
const FIXED = { sole: '#ecebe7', soleDark: '#1a1b1d', lace: '#ecebe7', metal: '#b5bac0', zip: '#8e9399', button: '#1d1d1f', badge: '#c4a44c', black: '#141517', chrome: '#dce3ea', lens: '#14171b', accent2: '#e6e6e3', shirt: '#e8eaed' };
export const REGIONS = ['skin', 'top', 'bottom', 'shoes', 'accent'];

// =====================================================================================================================
// THE ROSTERS (the app's Characters picker lists the same ids: src/shared/reconFigures.ts - keep in sync)
// =====================================================================================================================
export const RIGS = {
  human: { label: 'Realistic person', about: 'A realistic body from the character library (CC0, Quaternius) moved by real motion-capture clips: walk, sit, type, phone, carry, point, fall. Clothes are the outfit painted on the body; faces stay plain.' },
  porcelain: { label: 'Porcelain mannequin', about: 'The faceless egg-head mannequin: glossy porcelain in the Investigation look, matte clay in Studio. Wears every outfit; every pose, hands that really touch.' },
  faceted: { label: 'Faceted unknown', about: 'The same mannequin cut into flat low-poly facets: the person nobody can identify.' },
  masked: { label: 'Masked figure', about: 'A mannequin under a balaclava and gloves: police raids, tactical teams, guards.' },
  ual: { label: 'Animated actor', about: 'The CC0 Quaternius actor with its own walk, sit, talk and phone clips (Universal Animation Library). Wears its outfit as colour regions.' },
  mixamo: { label: 'Mixamo mannequin', about: 'The smooth jointed Mixamo mannequin on the realistic person\'s skeleton: every motion-capture clip and hand that really touches. No clothes: the outfit\'s top colour tints the body.' },
};
export const OUTFITS = {
  none: { label: 'Bare mannequin', palette: {}, wear: [] },
  glow: { label: 'Glowing (no clothes)', palette: {}, wear: [] },
  'red-tee-jeans': { label: 'Red tee, jeans, red sneakers', palette: { top: '#b4232d', bottom: '#2f3d57', shoes: '#ad242c', accent: '#f1f1ee' }, wear: [['tee', { region: 'top' }], ['jeans', { region: 'bottom' }], ['sneakers', { region: 'shoes' }]] },
  'hacker-hoodie': { label: 'Black hoodie, hood up, chrome visor', palette: { top: '#17181b', bottom: '#24272e', shoes: '#151618', accent: '#2a2c30', lace: '#2a2c30', accent2: '#bfc3c8' }, wear: [['hoodie', { region: 'top', hood: 'up', visor: true }], ['jeans', { region: 'bottom' }], ['sneakers', { region: 'shoes' }]] },
  'grey-hoodie': { label: 'Grey hoodie, hood down', palette: { top: '#80848b', bottom: '#2b3242', shoes: '#e9e9e6', accent: '#e9e9e6' }, wear: [['hoodie', { region: 'top', hood: 'down' }], ['jeans', { region: 'bottom' }], ['sneakers', { region: 'shoes' }]] },
  'olive-parka': { label: 'Olive parka over a grey hoodie', palette: { top: '#3d4a2f', bottom: '#2b2e34', shoes: '#3a332b', accent: '#7e8288', lace: '#2a2520' }, wear: [['hoodie', { region: 'accent', hood: 'down', under: true }], ['parka', { region: 'top' }], ['trousers', { region: 'bottom', fabric: 'canvas', fit: 1.1 }], ['boots', { region: 'shoes' }]] },
  'suit-blue-tie': { label: 'Black suit, white shirt, blue tie', palette: { top: '#18191c', bottom: '#18191c', shoes: '#0d0e0f', accent: '#2234a8', shirt: '#e8eaed' }, wear: [['shirt', { region: 'shirt', tie: true }], ['jacket', { region: 'top' }], ['trousers', { region: 'bottom' }], ['shoes', { region: 'shoes' }]] },
  'navy-suit': { label: 'Navy suit, open collar', palette: { top: '#1f293d', bottom: '#1f293d', shoes: '#141414', accent: '#a7bad0' }, wear: [['shirt', { region: 'accent' }], ['jacket', { region: 'top' }], ['trousers', { region: 'bottom' }], ['shoes', { region: 'shoes' }]] },
  'orange-jumpsuit': { label: 'Orange prison jumpsuit', palette: { top: '#cf611f', bottom: '#cf611f', shoes: '#e7e6e2', accent: '#e7e6e2' }, wear: [['jumpsuit', { region: 'top' }], ['sneakers', { region: 'shoes' }]] },
  police: { label: 'Police: uniform, cap, duty vest', palette: { top: '#1c2538', bottom: '#151a25', shoes: '#0f1012', accent: '#17181b', accent2: '#cfd2d6' }, wear: [['shirt', { region: 'top' }], ['vest', { region: 'accent' }], ['cargo', { region: 'bottom' }], ['boots', { region: 'shoes' }], ['cap', { region: 'top' }]] },
  swat: { label: 'Tactical team: helmet, mask, plate carrier', palette: { top: '#25282d', bottom: '#25282d', shoes: '#131416', accent: '#2e3229' }, wear: [['longtee', { region: 'top', fabric: 'canvas' }], ['vest', { region: 'accent', kind: 'plate' }], ['cargo', { region: 'bottom' }], ['boots', { region: 'shoes' }], ['kneepads', {}], ['gloves', {}], ['balaclava', {}], ['goggles', {}], ['helmet', { region: 'accent' }]] },
  'pink-sweater': { label: 'Pink sweater, grey trousers', palette: { top: '#d68a9b', bottom: '#5e636a', shoes: '#ecebe7', accent: '#ecebe7' }, wear: [['sweater', { region: 'top' }], ['trousers', { region: 'bottom', fabric: 'cotton', belt: false }], ['sneakers', { region: 'shoes' }]] },
  'white-shirt': { label: 'White shirt, dark trousers', palette: { top: '#e9eaec', bottom: '#2a2c31', shoes: '#141414', accent: '#141414' }, wear: [['shirt', { region: 'top' }], ['trousers', { region: 'bottom' }], ['shoes', { region: 'shoes' }]] },
  dress: { label: 'Dark dress', palette: { top: '#3b3048', bottom: '#3b3048', shoes: '#121212', accent: '#121212' }, wear: [['dress', { region: 'top' }], ['shoes', { region: 'shoes' }]] },
  smock: { label: 'White work smock, dark trousers', palette: { top: '#e2ded3', bottom: '#2c2b2a', shoes: '#1c1a18', accent: '#d6d2c6' }, wear: [['smock', { region: 'top' }], ['trousers', { region: 'bottom' }], ['shoes', { region: 'shoes' }]] },
  overalls: { label: 'Blue overalls over a tee (plumber)', palette: { top: '#2c4a7c', bottom: '#2c4a7c', shoes: '#2e271f', accent: '#d9d6cf' }, wear: [['tee', { region: 'accent' }], ['overalls', { region: 'top' }], ['boots', { region: 'shoes' }]] },
  blazer: { label: 'Grey blazer, open shirt, chinos', palette: { top: '#575c63', bottom: '#b9ab90', shoes: '#3a2a1f', accent: '#eef0f2' }, wear: [['shirt', { region: 'accent' }], ['jacket', { region: 'top' }], ['trousers', { region: 'bottom', fabric: 'cotton' }], ['shoes', { region: 'shoes' }]] },
  longsleeve: { label: 'Long-sleeve shirt, jeans', palette: { top: '#5b6b7a', bottom: '#2f3d57', shoes: '#1a1a1a', accent: '#1a1a1a' }, wear: [['shirt', { region: 'top' }], ['jeans', { region: 'bottom' }], ['shoes', { region: 'shoes' }]] },
};
// the mannequin rigs dress the new human-only garments as their nearest old shell
const MANNEQUIN_ALIAS = { smock: 'parka', overalls: 'jumpsuit', longsleeve: 'longtee', blazer: 'jacket' };
// v16 THE CHARACTERS: two bodies in one style (smooth mannequin surface + darker joint pieces), three finishes, a colour
// per role. Every old rig / outfit value of older projects maps onto these (never a crash, never the old look).
export const BODIES = {
  male: { label: 'Male', about: 'The smooth jointed mannequin (Mixamo Y Bot) on the motion-capture skeleton: every clip, hands that really touch.', file: 'assets/figures/mixamo_mannequin.glb', height: 1.8 },
  female: { label: 'Female', about: 'His sister: the female jointed mannequin (Quaternius, CC0) on the same skeleton and clips, hands that really touch.', file: 'assets/figures/mannequin_f.glb', height: 1.68 },
};
export const FINISHES = {
  matte: { label: 'Matte', about: 'Clay-like matte body, darker joints.' },
  glossy: { label: 'Glossy', about: 'Porcelain-like clearcoat, darker joints.' },
  glow: { label: 'Glow', about: 'Emissive body with a bright fresnel rim and an outline (pair with settings.post.cap >= .95).' },
};
// roles a scene names; Automatic in the picker = these (the main character stands apart: glossy orange)
export const ROLES = {
  main: { label: 'Main character', body: 'male', finish: 'glossy', color: '#e8742a' },
  suspect: { label: 'Suspect', body: 'male', finish: 'matte', color: '#c9343a' },
  victim: { label: 'Victim', body: 'female', finish: 'matte', color: '#e6d9c2' },
  detective: { label: 'Detective', body: 'male', finish: 'matte', color: '#3f6fc4' },
  witness: { label: 'Witness', body: 'female', finish: 'matte', color: '#3fa68c' },
  accomplice: { label: 'Accomplice', body: 'male', finish: 'matte', color: '#8a5fb0' },
  official: { label: 'Official', body: 'male', finish: 'matte', color: '#c9a43c' },
  prisoner: { label: 'Prisoner', body: 'male', finish: 'matte', color: '#cf611f' },
  police: { label: 'Police officer', body: 'male', finish: 'matte', color: '#3c5a8a' },
  swat: { label: 'Tactical officer', body: 'male', finish: 'matte', color: '#5a6068' },
  unknown: { label: 'Unknown person', body: 'male', finish: 'matte', color: '#8a9097' },
  extra: { label: 'Extra', body: 'male', finish: 'matte', color: '#b9b2a6' },
};
export const ACTS = ['stand', 'sit', 'walk', 'typing', 'phone', 'handsOnHead', 'cuffed', 'think', 'talk', 'point', 'carry', 'pickup', 'door', 'fall'];
export function listFigures() {
  return { bodies: Object.entries(BODIES).map(([id, b]) => ({ id, label: b.label, about: b.about })), finishes: Object.entries(FINISHES).map(([id, f]) => ({ id, ...f })),
    roles: Object.entries(ROLES).map(([id, r]) => ({ id, ...r })), acts: ACTS.slice(), groups: Object.keys(GROUPS), humanActs: { ...HUMAN_ACTS }, clips: [...new Set([...Object.keys(CLIPS), ...ANIM.animNames()])],
    legacy: { rigs: Object.keys(RIGS), outfits: Object.keys(OUTFITS) } };
}

// =====================================================================================================================
// SETTINGS -> a figure's spec
// =====================================================================================================================
const FIG = SETTINGS.figures && typeof SETTINGS.figures === 'object' ? SETTINGS.figures : {};
const HEX = /^#[0-9a-f]{6}$/i;
// GROUPS: several characters share one look. settings.figures.groups = { cops: { roles: ['police', 'swat'], finish: 'glossy',
// color: '#3c5a8a' } }, or in a scene: figureGroup('ghosts', { finish: 'glow', color: '#e8742a' }) + figure('extra', { group: 'ghosts' }).
const GROUPS = {};
for (const [k, g] of Object.entries(FIG.groups && typeof FIG.groups === 'object' ? FIG.groups : {})) if (g && typeof g === 'object') GROUPS[k] = { ...g };
export function figureGroup(name, look = null) { if (look) GROUPS[name] = { ...(GROUPS[name] || {}), ...look }; return GROUPS[name] ?? null; }
const groupOf = (role, name) => (name && GROUPS[name]) || Object.values(GROUPS).find(g => Array.isArray(g.roles) && g.roles.includes(role)) || {};
// old values -> the new bodies: body 'f'/'m', a rig ('porcelain' was glossy, outfit 'glow' glows), an outfit's top colour
const bodyId = b => b === 'f' || b === 'female' ? 'female' : b === 'm' || b === 'male' ? 'male' : null;
// 'custom:<id>' -> the id of one of the user's own characters (<workspace>/characters3d/<id>, served at <project>/__chars3d/)
const customId = b => typeof b === 'string' && /^custom:[a-z0-9][a-z0-9-]{0,47}$/.test(b) ? b.slice(7) : null;
let CC = null;   // lib/customchar.js, imported only when a custom body is named
const legacyFinish = x => !x ? null : x.outfit === 'glow' ? 'glow' : x.rig === 'porcelain' || x.rig === 'masked' ? 'glossy' : x.rig ? 'matte' : null;
// (a scene's own outfit keeps its top colour - the prison scene's orange; a settings outfit doesn't: the picker shows the role's colour)
const legacyColor = (x, scene) => { if (!x) return null; const c = x.colors?.top; if (typeof c === 'string' && HEX.test(c)) return c; const p = scene && x.outfit && OUTFITS[x.outfit]?.palette?.top; return p || null; };
export function figureSpec(spec = 'main') {
  const o = typeof spec === 'string' ? { role: spec } : { ...spec };
  const role = o.role ?? (o.rig || o.outfit || o.body ? 'extra' : 'main'), base = ROLES[role] ?? ROLES.extra;
  const user = (role === 'main' ? FIG.main : FIG.roles?.[role]) || {}, grp = groupOf(role, o.group ?? user.group);
  const pick = (k, legacy) => o[k] ?? legacy(o, true) ?? user[k] ?? legacy(user, false) ?? grp[k] ?? base[k];
  // body: male | female | 'custom:<id>' (the user's own character, lib/customchar.js: it rides the male skeleton)
  let body = null, custom = null;
  for (const b of [o.body, user.body, grp.body]) { if (bodyId(b)) { body = bodyId(b); break; } if (customId(b)) { custom = customId(b); break; } }
  if (custom && !(CC?.customCharLoaded(custom) && MODELS_READY.has('mq:male'))) { console.warn(`figure ${role}: your character "${custom}" is not loaded (removed, or no await loadFigures(['custom:${custom}']) in the scene): the male body instead`); custom = null; body = 'male'; }
  if (custom) body = 'male';
  body ??= base.body;
  let finish = pick('finish', legacyFinish); if (!FINISHES[finish]) { console.warn(`figure ${role}: unknown finish "${finish}"`); finish = base.finish; }
  // a custom body keeps its own materials unless a finish was chosen (in the scene call, the settings or its group)
  const finishSet = [o.finish, user.finish, grp.finish].some(v => v != null && !!FINISHES[v]);
  let color = pick('color', legacyColor); color = typeof color === 'string' && HEX.test(color) ? color.toLowerCase() : base.color;
  const joints = [o.joints, user.joints, grp.joints].find(v => typeof v === 'string' && HEX.test(v)) ?? null;
  if (!BODIES[body]) body = base.body;
  // the drawn rig: the mannequin of that body; the old procedural mannequin only when the clips / bodies can't load
  let rig = MODELS_READY.has('mq:' + body) ? 'mq' : 'porcelain';
  if (rig !== 'mq') console.warn(`figure ${role}: the ${body} mannequin is not loaded (assets/figures/${BODIES[body].file.split('/').pop()} or <project>/__lib/ missing? Update engine): the plain mannequin instead`);
  const outfit = 'none', colors = { skin: color, top: null, bottom: null, shoes: null, accent: null };
  const height = +(o.height ?? user.height) || (custom && rig === 'mq' ? +CC.customCharInfo(custom)?.height : 0) || null;
  return { role, rig, body, finish, color, joints, outfit, colors, model: null, height: height && height > .5 && height < 2.5 ? height : null, name: o.name ?? user.name ?? base.label,
    ...(custom && rig === 'mq' ? { custom, finishSet } : {}) };
}
const regionColor = (spec, region) => {
  const pal = OUTFITS[spec.outfit].palette;
  if (REGIONS.includes(region)) return spec.colors[region] ?? pal[region] ?? (region === 'skin' ? null : '#7a7d82');
  if (region === 'lace') return pal.lace ?? FIXED.lace;
  return pal[region] ?? FIXED[region] ?? '#7a7d82';
};

// =====================================================================================================================
// THE MANNEQUIN RIGS: a models.js person (joints, poses, IK, walkAt) dressed in skinned garment shells
// =====================================================================================================================
const GCACHE = new Map();
const garment = (key, o) => { const k = key + JSON.stringify(o); if (!GCACHE.has(k)) GCACHE.set(k, GARMENTS[key](o)); return GCACHE.get(k); };
const shapeOf = (name, pan) => BODY[name] ?? (name.startsWith('cap') ? capShape(name.slice(3), pan.capR ?? .064) : name.startsWith('seat') ? seatShape(name.slice(4)) : null);
const ico = (geo, f) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const v = f(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, v[0], v[1], v[2]); } geo.computeVertexNormals(); return geo; };
const shapedIco = s => ico(new THREE.IcosahedronGeometry(1, 2), (X, Y, Z) => { const t = (Y + 1) / 2; let y = Y; if (s.squash && y > .55) y = .55 + (y - .55) * .45; return [X * s.fx(t) * s.s[0], y * s.s[1], Z * s.fz(t) * s.s[2]]; });
let FACETS = null;
function facetParts() {   // the faceted rig's body: the mannequin's parts as flat low-poly solids
  if (FACETS) return FACETS;
  const b = (r, d = 1) => new THREE.IcosahedronGeometry(r, d), cy = (r0, r1, h) => new THREE.CylinderGeometry(r0, r1, h, 7, 2), bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  FACETS = [['hips', shapedIco(BODY.hips), [0, -.015, 0]], ['spine', shapedIco(BODY.waist), [0, .07, -.004]], ['chest', shapedIco(BODY.chest), [0, .13, -.004]], ['neck', cy(.037, .037, .1), [0, .03, 0]],
    ['head', ico(new THREE.IcosahedronGeometry(1, 2), (x, y, z) => [x * .087, y * .112, z * .098]), [0, .1, .012]]];
  for (const s of ['L', 'R']) FACETS.push(['sh' + s, b(.054), [0, 0, 0]], ['sh' + s, cy(.045, .041, .29), [0, -.145, 0]], ['el' + s, b(.04), [0, 0, 0]], ['el' + s, cy(.037, .031, .25), [0, -.13, 0]], ['wr' + s, b(.03), [0, 0, 0]],
    ['wr' + s, bx(.03, .088, .074), [0, -.046, 0]], ['fi' + s, bx(.025, .072, .07), [0, -.034, 0]], ['hip' + s, b(.066), [0, 0, 0]], ['hip' + s, cy(.066, .054, .43), [0, -.22, 0]], ['kn' + s, b(.052), [0, 0, 0]],
    ['kn' + s, cy(.05, .0375, .41), [0, -.215, 0]], ['an' + s, b(.036), [0, 0, 0]], ['an' + s, bx(.085, .06, .225), [0, -.04, .052]]);
  return FACETS;
}
const _sk = new Float32Array(JN.length * 16), _inv = JN.map(() => new THREE.Matrix4()), _q = new THREE.Quaternion();
const POSE = MOD.POSE;
function dress(p, spec, cast) {
  const S = p.scale || 1, wardrobe = new THREE.Group(); wardrobe.name = 'wardrobe'; cast.group.add(wardrobe);
  const flat = spec.rig === 'faceted', wear = OUTFITS[spec.outfit].wear.slice();
  if (spec.rig === 'masked') { if (!wear.some(w => w[0] === 'balaclava')) wear.push(['balaclava', {}]); if (!wear.some(w => w[0] === 'gloves')) wear.push(['gloves', {}]); }
  const panels = [], rigids = [], flags = { top: 0, sleeves: 0, legs: 0, head: 0 };
  for (const [key0, go] of wear) {
    const key = MANNEQUIN_ALIAS[key0] ?? key0, g = garment(key, go);
    if (/tee|sweater|hoodie|parka|jacket|shirt|jumpsuit|dress|vest/.test(key)) flags.top = Math.max(flags.top, key === 'parka' ? .05 : .03);
    if (/longtee|sweater|hoodie|parka|jacket|shirt|jumpsuit/.test(key)) flags.sleeves = Math.max(flags.sleeves, key === 'parka' ? .035 : .022);
    if (/jeans|trousers|cargo|jumpsuit/.test(key)) flags.legs = Math.max(flags.legs, .028);
    if (key === 'hoodie' && go.hood === 'up' || /helmet|cap/.test(key)) flags.head = Math.max(flags.head, key === 'cap' ? .05 : .03);
    for (const pan of g.panels || []) {
      const geo = new THREE.BufferGeometry(), n = pan.geo.pos.length / 3;
      geo.setAttribute('position', new THREE.BufferAttribute(pan.geo.pos.slice(), 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('uv', new THREE.BufferAttribute(pan.geo.uv, 2));
      geo.setIndex(pan.geo.idx); for (const [s0, c, mi] of pan.geo.groups) geo.addGroup(s0, c, mi);
      const col = regionColor(spec, pan.region) ?? '#' + p.color.getHexString(), mats = [fabricMat(pan.fabric, col, flat), fabricMat(pan.rib === 'rib' && !flat ? 'rib' : pan.fabric, col, flat)];
      const m = new THREE.Mesh(geo, pan.geo.groups.length > 1 ? mats : mats[0]); m.name = `${spec.name} ${pan.name}`; m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
      m.userData.joints = new Set([...new Set(pan.bind.I)].filter((j, i, a) => pan.bind.W.some((w, k) => w > .05 && pan.bind.I[k] === j)).map(j => JN[j]));
      wardrobe.add(m); panels.push({ m, pan, n, shapes: pan.shapes.map(nm => shapeOf(nm, pan)).filter(Boolean) });
    }
    for (const r of g.rigid || []) {
      const col = r.region ? regionColor(spec, r.region) ?? '#' + p.color.getHexString() : FIXED[r.color] ?? '#777';
      const m = new THREE.Mesh(r.geo, fabricMat(r.fabric, col, flat)); m.name = `${spec.name} ${r.name}`; m.matrixAutoUpdate = false; m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
      m.userData.joints = new Set([r.joint]); wardrobe.add(m); rigids.push({ m, joint: r.joint, local: r.m });
    }
  }
  if (flat) {   // the faceted body replaces the smooth instanced one
    for (const c of cast.group.children) if (c.isInstancedMesh) c.visible = false;
    const fm = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(spec.colors.skin ?? '#8a9097'), roughness: .38, clearcoat: .55, clearcoatRoughness: .3, flatShading: true });
    for (const [j, geo, at] of facetParts()) { const m = new THREE.Mesh(geo, fm); m.name = `${spec.name} body`; m.matrixAutoUpdate = false; m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.userData.body = true; m.userData.joint = j;
      wardrobe.add(m); rigids.push({ m, joint: j, local: new THREE.Matrix4().makeTranslation(...at) }); }
  }
  let sig = NaN;
  const sync = (force) => {
    const rig = p.root.parent; if (!rig) return; rig.updateMatrixWorld(true);
    wardrobe.visible = p.visible;
    let h = 0; JN.forEach((n, i) => { const e = p.j[n].matrixWorld.elements; h += (e[0] * 1.3 + e[5] * 2.1 + e[10] * 3.7 + e[12] * 5.3 + e[13] * 7.1 + e[14] * 9.7 + e[4] * 11.3 + e[8] * 13.1) * (i + 1); });
    if (!force && h === sig) return; sig = h;
    cast.sync();
    JN.forEach((n, i) => { const W = p.j[n].matrixWorld.elements, r = REST[n], o = i * 16; for (let k = 0; k < 16; k++) _sk[o + k] = W[k];
      _sk[o + 12] = W[12] - (W[0] * r[0] + W[4] * r[1] + W[8] * r[2]); _sk[o + 13] = W[13] - (W[1] * r[0] + W[5] * r[1] + W[9] * r[2]); _sk[o + 14] = W[14] - (W[2] * r[0] + W[6] * r[1] + W[10] * r[2]);
      _inv[i].copy(p.j[n].matrixWorld).invert(); });
    for (const P of panels) {
      const A = P.m.geometry.attributes.position.array, R = P.pan.geo.pos, I = P.pan.bind.I, Wt = P.pan.bind.W, mm = P.pan.margin / S;
      for (let v = 0; v < P.n; v++) {
        const x = R[v * 3], y = R[v * 3 + 1], z = R[v * 3 + 2]; let X = 0, Y = 0, Z = 0;
        for (let k = 0; k < 3; k++) { const w = Wt[v * 3 + k]; if (!w) continue; const o = I[v * 3 + k] * 16;
          X += w * (_sk[o] * x + _sk[o + 4] * y + _sk[o + 8] * z + _sk[o + 12]); Y += w * (_sk[o + 1] * x + _sk[o + 5] * y + _sk[o + 9] * z + _sk[o + 13]); Z += w * (_sk[o + 2] * x + _sk[o + 6] * y + _sk[o + 10] * z + _sk[o + 14]); }
        for (const s of P.shapes) { const e = _inv[s.ji].elements; _l[0] = e[0] * X + e[4] * Y + e[8] * Z + e[12]; _l[1] = e[1] * X + e[5] * Y + e[9] * Z + e[13]; _l[2] = e[2] * X + e[6] * Y + e[10] * Z + e[14];
          if (pushLocal(s, _l, s.pm != null ? s.pm / S : mm)) { const f = p.j[JN[s.ji]].matrixWorld.elements; X = f[0] * _l[0] + f[4] * _l[1] + f[8] * _l[2] + f[12]; Y = f[1] * _l[0] + f[5] * _l[1] + f[9] * _l[2] + f[13]; Z = f[2] * _l[0] + f[6] * _l[1] + f[10] * _l[2] + f[14]; } }
        A[v * 3] = X; A[v * 3 + 1] = Y; A[v * 3 + 2] = Z;
      }
      const g = P.m.geometry; g.attributes.position.needsUpdate = true; g.computeVertexNormals();
      const N = g.attributes.normal; for (const [a, b] of P.pan.geo.seams) { const nx = N.getX(a) + N.getX(b), ny = N.getY(a) + N.getY(b), nz = N.getZ(a) + N.getZ(b), l = Math.hypot(nx, ny, nz) || 1; N.setXYZ(a, nx / l, ny / l, nz / l); N.setXYZ(b, nx / l, ny / l, nz / l); }
      g.computeBoundingSphere(); g.boundingBox = null;
    }
    for (const r of rigids) { r.m.matrix.multiplyMatrices(p.j[r.joint].matrixWorld, r.local); r.m.matrixWorldNeedsUpdate = true; }
  };
  return { wardrobe, panels, rigids, sync, flags };
}
const quatSave = p => JN.map(n => p.j[n].quaternion.clone()).concat([p.j.hips.position.y]);
const quatLoad = (p, s) => { JN.forEach((n, i) => p.j[n].quaternion.copy(s[i])); p.j.hips.position.y = s[JN.length]; };
const d2r = Math.PI / 180;
const TYPING = { ...POSE.sit, spine: [4 * d2r, 0, 0], chest: [5 * d2r, 0, 0], neck: [6 * d2r, 0, 0], head: [6 * d2r, 0, 0] };
function mannequin(spec, o) {
  const group = new THREE.Group(); group.name = spec.name; group.userData.kind = 'person'; group.userData.noContact = true;   // bodies: S.collide (caps()), not the prop check
  const cast = MOD.cast(group, 1), p = cast.add({ name: spec.name, color: spec.colors.skin ?? undefined, scale: spec.height ? spec.height / RIG_H : 1 });
  const W = dress(p, spec, cast);
  group.userData.pickRoot = true; group.userData.api = p; ENG.selectable?.(group, spec.name, 'person');
  // the clothes follow the body on every render (scene.updateMatrixWorld runs first in renderer.render): no sync() needed
  const base = group.updateMatrixWorld.bind(group); let busy = false;
  group.updateMatrixWorld = force => { if (!busy) { busy = true; try { W.sync(); } finally { busy = false; } } return base(force); };
  Object.assign(p, {
    rig: spec.rig, figure: spec, group, wardrobe: W.wardrobe,
    sync(force = true) { W.sync(force); return p; },
    // act(name, o): a named pose. o.t (seconds) animates small things (typing fingers, talking hands); o.phase for walk
    act(name, a = {}) {
      const t = a.t ?? 0;
      if (name === 'sit') { p.apply(POSE.sit); return p.lap(a); }
      if (name === 'walk') return p.apply(MOD.walk(a.phase ?? t * .8));
      if (name === 'typing') { p.apply(TYPING); p.root.updateMatrixWorld(true);
        for (const sd of ['L', 'R']) { const s = sd === 'L' ? 1 : -1, tap = .42 + .22 * Math.max(0, Math.sin(t * 13 + (s > 0 ? 0 : 1.9)));
          // hands just over the keys (desk + 5 cm), forearms clear of the desk edge, elbows out: no contact to fake
          p.handTo(sd, p.root.localToWorld(V3(s * .115, (a.desk ?? .74) + .05, a.reach ?? .42)), p.root.localToWorld(V3(0, -1, 0)).sub(p.root.localToWorld(V3())).normalize(), p.fwd().add(V3(-s * .25, -.12, 0)).normalize(), tap, p.root.localToWorld(V3(s * .55, .9, -.2))); }
        return p; }
      if (name === 'phone') { p.apply(a.sit ? POSE.sit : POSE.stand); if (a.sit) p.lap(a, ['L']); p.root.updateMatrixWorld(true);
        const hd = p.j.head, c = hd.localToWorld(V3(0, .1, .012)), tg = hd.localToWorld(V3(-.118 - W.flags.head * .6, .085, .025)), up = hd.localToWorld(V3(0, 1, -.35)).sub(hd.localToWorld(V3())).normalize();
        p.handTo('R', tg, c.clone().sub(tg).normalize(), up, .95, p.root.localToWorld(V3(-.42, a.sit ? .6 : 1.08, .3)));
        if (a.phone !== false) p.prop('phone'); return p; }
      if (name === 'handsOnHead') { p.apply(a.sit ? POSE.sit : POSE.stand); p.root.updateMatrixWorld(true); const hd = p.j.head, lift = W.flags.head;
        for (const sd of ['L', 'R']) { const s = sd === 'L' ? 1 : -1, tg = hd.localToWorld(V3(s * .045, .203 + lift, -.035)), dn = hd.localToWorld(V3(-s * .25, -1, .1)).sub(hd.localToWorld(V3())).normalize(), fd = hd.localToWorld(V3(-s * .55, .05, -.8)).sub(hd.localToWorld(V3())).normalize();
          p.handTo(sd, tg, dn, fd, .35, p.root.localToWorld(V3(s * .62, 1.62, .22))); }
        return p; }
      if (name === 'cuffed') { p.apply(POSE.stand); p.root.updateMatrixWorld(true);
        for (const sd of ['L', 'R']) { const s = sd === 'L' ? 1 : -1; p.handTo(sd, p.root.localToWorld(V3(s * .045, .9, -.2 - W.flags.top * .5)), p.root.localToWorld(V3(-s, 0, 0)).sub(p.root.localToWorld(V3())).normalize(), V3(0, -1, 0), .6, p.root.localToWorld(V3(s * .35, 1.0, -.55))); }
        return p; }
      if (name === 'think') { p.apply(POSE.stand); p.root.updateMatrixWorld(true); const hd = p.j.head;
        p.handTo('R', hd.localToWorld(V3(-.01, .0, .095 + W.flags.head * .3)), hd.localToWorld(V3(0, 1, -.4)).sub(hd.localToWorld(V3())).normalize(), hd.localToWorld(V3(0, .5, 1)).sub(hd.localToWorld(V3())).normalize(), 1.1, p.root.localToWorld(V3(-.3, 1.0, .35)));
        return p; }
      if (name === 'talk') { const k = Math.sin(t * 2.3) * .5 + .5; return p.apply(MOD.mix(POSE.stand, { ...POSE.stand, elR: [-62 * d2r, 0, 12 * d2r], shR: [-14 * d2r, 0, -14 * d2r], elL: [-35 * d2r, 0, -6 * d2r] }, .55 + .25 * k)); }
      return p.apply(POSE[name] ?? POSE.stand);
    },
    // lap(): seated hands rest on the thighs, on top of the trousers (models.js settle() puts them on the bare thigh)
    lap(a = {}, sides = ['L', 'R']) { p.root.updateMatrixWorld(true);
      for (const sd of sides) { const s = sd === 'L' ? 1 : -1, hip = p.j['hip' + sd].getWorldPosition(V3()), kn = p.j['kn' + sd].getWorldPosition(V3());
        const t = hip.clone().lerp(kn, a.along ?? .62).add(V3(0, (.072 + W.flags.legs) * p.scale, 0)).add(p.root.localToWorld(V3(-s * .015, 0, 0)).sub(p.root.getWorldPosition(V3())));
        p.handTo(sd, t, V3(0, -1, 0), kn.clone().sub(hip).setY(0).normalize(), .3, p.root.localToWorld(V3(s * .3, .55, -.6))); }
      return p; },
    walkAt(from, dir, dist, wo) { return MOD.walkAt(p, from, dir, dist, wo); },
    // a small prop in the right hand (rigid on the wrist): 'phone'
    prop(kind) { if (p._prop === kind) return p; if (p._propMesh) { W.wardrobe.remove(p._propMesh); const k = W.rigids.findIndex(r => r.m === p._propMesh); if (k >= 0) W.rigids.splice(k, 1); }
      p._prop = kind; if (!kind) return p;
      const m = new THREE.Mesh(RB(.0095, .148, .072, .006), fabricMat('plastic', '#121316')); m.name = `${spec.name} phone`; m.matrixAutoUpdate = false; m.castShadow = true; W.wardrobe.add(m);
      W.rigids.push({ m, joint: 'wrR', local: new THREE.Matrix4().makeTranslation(.026, -.07, .004) }); p._propMesh = m; return p; },
    // capsules of the clothed body for S.collide (collide.js check): the mannequin's capsules grown by the clothes
    caps() { const s = p.scale ?? 1, w = n => p.scenePos(n), F = W.flags;
      const hp = (n) => n === 'head+' ? w('head').add(w('head').sub(w('neck')).normalize().multiplyScalar(.12 * s)) : w(n);
      return [['hips', 'neck', .13 + F.top], ['head', 'head+', .095 + F.head], ['shL', 'elL', .045 + F.sleeves], ['elL', 'wrL', .038 + F.sleeves * .8], ['wrL', 'fiL', .035], ['shR', 'elR', .045 + F.sleeves], ['elR', 'wrR', .038 + F.sleeves * .8],
        ['wrR', 'fiR', .035], ['hipL', 'knL', .06 + F.legs], ['knL', 'anL', .045 + F.legs], ['hipR', 'knR', .06 + F.legs], ['knR', 'anR', .045 + F.legs]].map(([a, b, r]) => ({ a: hp(a), b: hp(b), r: r * s, part: a })); },
    // clipReport(): how much of the body that the clothes cover standing is uncovered in the current pose (body pushing
    // through cloth, a sleeve pulled off the arm). { checked, exposed, pct, parts: { joint: count } }
    clipReport(o2 = {}) { return clipReport(p, W, cast, o2); },
  });
  if (spec.rig === 'faceted') p.tint = function (hex) { this.color.set(hex); return this; };
  p.place(o.x ?? 0, o.y ?? 0, o.z ?? 0, o.ry ?? 0);
  if (o.act) p.act(o.act, o); else p.apply(o.pose || POSE.stand);
  W.sync(true);
  return p;
}
// the joint of each instanced body part of models.js cast() (PARTS order: keep in sync)
const PART_JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', ...['L', 'R'].flatMap(s => ['sh', 'sh', 'el', 'el', 'wr', 'wr', 'fi', 'wr', 'hip', 'hip', 'kn', 'kn', 'an', 'an'].map(j => j + s))];
// body points (the drawn body's vertices) count as covered when their outward ray meets, within 9 cm, a garment that
// is bound to the same body part (a hand beside the hip is not "covered" by the tee)
function bodySamples(p, W, cast) {
  const out = [], m4 = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = V3(), n = V3();
  const meshes = W.rigids.some(r => r.m.userData.body) ? W.rigids.filter(r => r.m.userData.body).map(r => r.m) : cast.group.children.filter(c => c.isInstancedMesh);
  cast.group.updateMatrixWorld(true);
  for (const m of meshes) { const pos = m.geometry.attributes.position, nor = m.geometry.attributes.normal; if (!pos || !nor) continue;
    if (m.isInstancedMesh) { m.getMatrixAt(0, m4); m4.premultiply(m.matrixWorld); } else { m.updateMatrixWorld(true); m4.copy(m.matrixWorld); } nm.getNormalMatrix(m4);
    const step = Math.max(1, Math.floor(pos.count / 60)), k = cast.group.children.filter(c => c.isInstancedMesh).indexOf(m), joint = m.isInstancedMesh ? PART_JOINTS[k] ?? null : m.userData.joint;
    for (let i = 0; i < pos.count; i += step) out.push({ p: v.fromBufferAttribute(pos, i).applyMatrix4(m4).clone(), n: n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize().clone(), mesh: m, i, joint }); }
  return out;
}
const _rc = new THREE.Raycaster();
// a point that is not covered but whose outward ray runs into the body within 6 cm is inside a fold (the back of a bent
// knee, an armpit): nobody can see it, so it is not counted
function covered(samples, garments, body) {
  return samples.map(s => { if (!s.joint) return false; _rc.set(s.p.clone().addScaledVector(s.n, .0005), s.n); _rc.far = .09;
    if (_rc.intersectObjects(garments, false).some(h => h.object.userData.joints?.has(s.joint))) return true;
    if (!body) return false; _rc.far = .06; return _rc.intersectObjects(body, false).some(h => h.distance > .003) ? 'fold' : false; });
}
function clipReport(p, W, cast, o = {}) {
  const garments = W.wardrobe.children.filter(m => m.isMesh && !m.userData.body && m.visible);
  if (!garments.length) return { checked: 0, poke: 0, pokePct: 0, pokes: {}, exposed: 0, pct: 0, parts: {} };
  const now = quatSave(p);
  quatLoad(p, quatSave(p.apply(o.ref ?? POSE.stand))); W.sync(true); W.wardrobe.updateMatrixWorld(true);
  const S0 = bodySamples(p, W, cast), ref = covered(S0, garments);
  quatLoad(p, now); W.sync(true); W.wardrobe.updateMatrixWorld(true);
  const body = W.rigids.some(r => r.m.userData.body) ? W.rigids.filter(r => r.m.userData.body).map(r => r.m) : cast.group.children.filter(c => c.isInstancedMesh);
  for (const m of body) if (m.isInstancedMesh) { m.boundingSphere = m.boundingBox = null; }
  const S1 = bodySamples(p, W, cast), cur = covered(S1, garments, body), parts = {};
  // poke-through: the body point lies OUTSIDE the nearest cloth bound to its body part (signed distance along the cloth's
  // normal > 2 mm). The precise clipping measure; 'exposed' (no cloth in front of it within 9 cm, folds excepted) is the
  // looser one.
  const cloth = W.panels.map(P => ({ P, js: P.m.userData.joints, pos: P.m.geometry.attributes.position.array, nor: P.m.geometry.attributes.normal.array }));
  const toLocal = new THREE.Matrix4().copy(cast.group.matrixWorld).invert(), q0 = V3();
  const poke = s0 => { const b = q0.copy(s0.p).applyMatrix4(toLocal); let best = Infinity, sd = 0;
    for (const c of cloth) { if (!c.js.has(s0.joint)) continue; const A = c.pos, N = c.nor;
      for (let v = 0; v < A.length; v += 3) { const dx = b.x - A[v], dy = b.y - A[v + 1], dz = b.z - A[v + 2], d2 = dx * dx + dy * dy + dz * dz; if (d2 < best) { best = d2; sd = dx * N[v] + dy * N[v + 1] + dz * N[v + 2]; } } }
    return best < .05 * .05 && sd > .002; };
  // a body point inside another body part (the back of a bent knee inside the calf) can never be seen: not counted
  const inv = {}; for (const n of JN) inv[n] = p.j[n].matrixWorld.clone().invert();
  const buried = s0 => { const b = q0.copy(s0.p).applyMatrix4(toLocal); for (const k in BODY) { const sh = BODY[k]; if (sh.j === s0.joint) continue; const l = b.clone().applyMatrix4(inv[sh.j]); if (inside(sh, l.x, l.y, l.z, -.002)) return true; } return false; };
  let checked = 0, exposed = 0, poked = 0; const where = [], pokes = {};
  for (let i = 0; i < S1.length; i++) { if (!ref[i] || buried(S1[i])) continue; checked++;
    if (poke(S1[i])) { poked++; const k = S1[i].joint; pokes[k] = (pokes[k] ?? 0) + 1; }
    if (cur[i] === false) { exposed++; const k = S1[i].joint || S1[i].mesh.geometry.type; parts[k] = (parts[k] ?? 0) + 1;
    if (o.debug && S1[i].joint) { const l = p.j[S1[i].joint].worldToLocal(S1[i].p.clone().applyMatrix4(new THREE.Matrix4().copy(cast.group.matrixWorld).invert())); where.push([S1[i].joint, ...l.toArray().map(v => +v.toFixed(3)), S1[i].mesh.geometry.type]); } } }
  return { checked, poke: poked, pokePct: checked ? +(poked / checked * 100).toFixed(2) : 0, pokes, exposed, pct: checked ? +(exposed / checked * 100).toFixed(2) : 0, parts, ...(o.debug ? { where } : {}) };
}

// =====================================================================================================================
// ACTOR RIGS: the Quaternius UAL actor (its clips) and humanoid models from the user's library, as figures
// =====================================================================================================================
const MODELS_READY = new Set(); let LIB = null;
const UAL_FILE = 'assets/figures/ual_actor.glb';
// the glowing person (outfit 'glow', from the shot-match runs: module.recon.glow-person): an emissive body that ignores the
// grade (toneMapped false), a fresnel rim lighter than the core, and a skinned inverted-hull outline
const lighter = (hex, k) => new THREE.Color(hex).lerp(new THREE.Color(0xffffff), k);
function glowBody(hex, joints) {
  const core = new THREE.Color(hex), rim = lighter(hex, .55);
  const m = new THREE.MeshStandardMaterial({ color: core.clone().multiplyScalar(.25), emissive: core, emissiveIntensity: joints ? .45 : .85, roughness: .6, metalness: 0, toneMapped: false });
  const code = `float czFr = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.5);
    totalEmissiveRadiance += vec3(${rim.r.toFixed(4)}, ${rim.g.toFixed(4)}, ${rim.b.toFixed(4)}) * czFr * 1.5;`;
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + code); };
  m.customProgramCacheKey = () => 'czglow|' + code; return m;
}
function glowHull(hex) {
  const m = new THREE.MeshBasicMaterial({ color: lighter(hex, .45), side: THREE.BackSide, toneMapped: false, transparent: true, opacity: .85 });
  m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n transformed += normalize(objectNormal) * 0.006;'); };
  m.customProgramCacheKey = () => 'czhull|0.006'; return m;
}
// FINISHES (v16): one material set per finish x colour x part, shared by every figure that wears it. The joint pieces stay
// dark (Y Bot's look) or take spec.joints; glow keeps the shot-match look (emissive core, fresnel rim, outline hull).
const FMATS = new Map();
const PLANT_ALL = new Map();   // body|clip|plant|scale -> the planted-feet table (humanFigure pTable), read only
// measured once per body, at rest, in the body's own units (they were measured again for every person of every shot):
const DOM_NAMES = new WeakMap();   // body geometry -> each vertex's dominant bone name
const CAPR_ALL = new Map();        // body -> the collision capsules' radii
const PALM_ALL = new Map();        // body -> per hand: the palm vertices (mesh index, vertex) and the palm point in the hand bone
const H0_ALL = new Map();          // mannequin body -> its drawn height at rest (before the figure's own scale)
const GROUND = new Map();   // body|clip -> { loop, vals }: the root lift over the clip (the body's units) that puts the lowest drawn sole on y = 0
function finishMat(finish, hex, joints, jointHex) {
  const key = `${finish}|${hex}|${joints ? 1 : 0}|${jointHex ?? ''}`; if (FMATS.has(key)) return FMATS.get(key);
  const jc = jointHex ? new THREE.Color(jointHex) : new THREE.Color(hex).multiplyScalar(.12).lerp(new THREE.Color('#1c1e23'), .7);
  let m;
  if (finish === 'glow') m = joints ? glowBody(hex, true) : glowBody(hex, false);
  else if (finish === 'glossy') m = new THREE.MeshPhysicalMaterial({ color: joints ? jc : new THREE.Color(hex), roughness: joints ? .36 : .3, metalness: 0, clearcoat: joints ? .6 : 1, clearcoatRoughness: joints ? .2 : .1 });
  else m = new THREE.MeshStandardMaterial({ color: joints ? jc : new THREE.Color(hex), roughness: joints ? .7 : .85, metalness: 0 });
  m.name = `figure ${finish} ${joints ? 'joints' : 'body'}`; FMATS.set(key, m); return m;
}
// loadFigures(['mq']): load what the figures need (top-level await in a scene file). 'mq' = the clips + both mannequin
// bodies; 'human' / 'ual' / 'model:...' load the old rigs' files (old scene code: harmless, they draw as mannequins now)
export async function loadFigures(list) {
  if (list.includes('mq') || list.includes('human') || list.includes('mixamo')) {
    if (!MODELS_READY.has('clips')) { await loadClips(); await _prep(); ANIM.registerBuiltinClips(CLIPS, PREP); await ANIM.loadAnims('user').catch(e => console.warn('animations: ' + e.message)); MODELS_READY.add('clips'); }
    LIB ??= await import('./library.js');
    const map = {}; for (const b of Object.keys(BODIES)) if (!MODELS_READY.has('mq:' + b)) map['fig:mq:' + b] = globalThis.__CZ_FIG_URL?.('mq:' + b) ?? new URL(BODIES[b].file, BASE).href;
    if (Object.keys(map).length) { await LIB.loadModels(map); for (const b of Object.keys(BODIES)) if (LIB.MODELS['fig:mq:' + b]?.scene) MODELS_READY.add('mq:' + b); }
  }
  if (list.includes('human') && !MODELS_READY.has('human')) { await loadHuman(); await loadFaces(); MODELS_READY.add('human'); }
  // the user's own characters: 'custom:<id>' in the list (a scene's await loadFigures(['custom:my-hero'])) + every one the
  // settings name (main, roles, groups); one that can't load (removed, no mapping) warns and draws the male body
  const customs = new Set(list.map(customId).filter(Boolean));
  for (const x of [FIG.main, ...Object.values(FIG.roles && typeof FIG.roles === 'object' ? FIG.roles : {}), ...Object.values(GROUPS)]) { const c = customId(x?.body); if (c) customs.add(c); }
  if (customs.size) {
    if (!MODELS_READY.has('mq:male') && !list.includes('mq')) await loadFigures(['mq']);   // (the skeleton a custom body rides)
    CC ??= await import('./customchar.js');
    for (const id of customs) { try { await CC.loadCustomChar(id); } catch (e) { console.warn(`figures: your character "${id}" did not load (${e.message}): the male body instead`); } }
  }
  const todo = list.filter(k => !['human', 'mq', 'mixamo'].includes(k) && !customId(k) && !MODELS_READY.has(k)); if (!todo.length) return;
  LIB ??= await import('./library.js');
  const map = {}; for (const k of todo) { const u = globalThis.__CZ_FIG_URL?.(k);   // (the app's Characters preview maps library models)
    if (u) map['fig:' + k] = u; else if (k === 'ual') map['fig:ual'] = new URL(UAL_FILE, BASE).href; else if (k.startsWith('model:') && /^assets\/[\w./ -]+\.glb$/i.test(k.slice(6)) && !k.includes('..')) map['fig:' + k] = new URL(k.slice(6), BASE).href; }
  await LIB.loadModels(map); for (const k of todo) if (LIB.MODELS['fig:' + k]) MODELS_READY.add(k);
}
const BONE_OF = { hips: 'pelvis', spine: 'spine_01', chest: 'spine_03', neck: 'neck_01', head: 'Head', shL: 'upperarm_l', elL: 'lowerarm_l', wrL: 'hand_l', fiL: 'hand_l', shR: 'upperarm_r', elR: 'lowerarm_r', wrR: 'hand_r', fiR: 'hand_r',
  hipL: 'thigh_l', knL: 'calf_l', anL: 'foot_l', hipR: 'thigh_r', knR: 'calf_r', anR: 'foot_r' };
const CLIP_OF = { stand: 'Idle_Loop', sit: 'Sitting_Idle_Loop', walk: 'Walk_Loop', typing: 'Sitting_Talking_Loop', phone: 'Idle_TalkingPhone_Loop', handsOnHead: 'Hit_Head', cuffed: 'Idle_FoldArms_Loop', think: 'Idle_No_Loop', talk: 'Idle_Talking_Loop' };
function actorFigure(spec, o) {
  const key = spec.rig === 'ual' ? 'fig:ual' : 'fig:model:' + spec.model, a = LIB.actor(key, { height: spec.height ?? 1.8, look: 'orig', name: spec.name, parent: o.parent });
  const wearKeys = OUTFITS[spec.outfit].wear.map(w => w[0]), short = wearKeys.includes('tee') || wearKeys.includes('dress'), bare = !wearKeys.length, hood = OUTFITS[spec.outfit].wear.some(w => w[0] === 'hoodie' && w[1].hood === 'up');
  const col = r => new THREE.Color(r === 'skin' ? spec.colors.skin ?? '#' + new THREE.Color(ENG.C.clay).getHexString() : regionColor(spec, r));
  const coat = THEME?.figure ? { clearcoat: THEME.figure.coat * .6, roughness: .4 } : { roughness: .82 };
  a.root.traverse(m => {
    if (!m.isMesh) return;
    if (spec.rig === 'model') { m.material = new THREE.MeshPhysicalMaterial({ color: col('skin'), ...coat }); return; }
    // the UAL actor: every vertex coloured by the bone that moves it most (outfit regions), one glossy material
    const g = m.geometry = m.geometry.clone(), si = g.attributes.skinIndex, sw = g.attributes.skinWeight, pos = g.attributes.position, bones = m.skeleton?.bones || [], cols = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
      let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
      const b = bones[best]?.name || '';
      const r = bare ? 'skin' : /Head|neck/i.test(b) ? (hood ? 'top' : 'skin') : /hand|thumb|index|middle|ring|pinky/i.test(b) ? 'skin' : /foot|ball/i.test(b) ? 'shoes'
        : /lowerarm/i.test(b) ? (short ? 'skin' : 'top') : /thigh|calf|pelvis/i.test(b) ? 'bottom' : 'top';
      const c = col(r); cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); m.material = new THREE.MeshPhysicalMaterial({ vertexColors: true, ...coat });
  });
  const g = a.group; g.userData.noContact = true; let warned = false;
  const f = {
    rig: spec.rig, figure: spec, name: spec.name, group: g, actor: a, root: g, scale: (spec.height ?? 1.8) / 1.8, visible: true,
    place(x, y, z, ry) { g.position.set(x, y, z); if (ry != null) g.rotation.y = ry; return f; },
    play(clip, t = 0, w) { if (a.clips.includes(clip)) a.pose(clip, t, w); return f; },
    act(name, ao = {}) { const c = CLIP_OF[name] ?? 'Idle_Loop', clip = a.clips.includes(c) ? c : a.clips.find(n => /idle/i.test(n)) ?? a.clips[0];
      if (clip) a.pose(clip, name === 'handsOnHead' ? .45 : ao.t ?? 0).apply(); return f; },
    apply(pose) { return f.act((pose?.dy ?? 0) < -.3 ? 'sit' : 'stand'); },
    walkAt(from, dir, dist) { const D = dir.clone().setY(0).normalize(), P = from.clone().addScaledVector(D, dist); f.place(P.x, P.y, P.z, Math.atan2(D.x, D.z));
      if (a.clips.includes('Walk_Loop')) { f._speed ??= LIB.clipSpeed(a, 'Walk_Loop'); a.pose('Walk_Loop', dist / Math.max(.1, f._speed)).apply(); } return f; },
    world(n) { const b = a.bone(BONE_OF[n] ?? n); g.parent?.updateMatrixWorld(true); const w = b.getWorldPosition(V3()); return g.parent ? g.parent.worldToLocal(w) : w; },
    scenePos(n) { return a.bone(BONE_OF[n] ?? n).getWorldPosition(V3()); },
    fwd() { g.updateMatrixWorld(true); return V3(0, 0, 1).transformDirection(g.matrixWorld); },
    box() { g.updateMatrixWorld(true); return new THREE.Box3().setFromObject(g); },
    caps() { const s = f.scale, w = n => a.bone(n).getWorldPosition(V3()), pos = n => n === 'Head+' ? w('Head').add(w('Head').sub(w('neck_01')).normalize().multiplyScalar(.14 * s)) : w(n);
      return [['pelvis', 'neck_01', .13], ['Head', 'Head+', .095], ['upperarm_l', 'lowerarm_l', .045], ['lowerarm_l', 'hand_l', .038], ['upperarm_r', 'lowerarm_r', .045], ['lowerarm_r', 'hand_r', .038],
        ['thigh_l', 'calf_l', .06], ['calf_l', 'foot_l', .045], ['thigh_r', 'calf_r', .06], ['calf_r', 'foot_r', .045]].map(([x, y, r]) => ({ a: pos(x), b: pos(y), r: r * s, part: x })); },
    tint() { return f; }, sync() { return f; }, lap() { return f; }, clipReport() { return { checked: 0, poke: 0, pokePct: 0, pokes: {}, exposed: 0, pct: 0, parts: {}, note: 'actor: colour regions, no cloth' }; },
  };
  for (const k of ['handTo', 'reach', 'orientHand', 'grip', 'settle', 'brace', 'curl', 'prop']) f[k] = () => { if (!warned) { warned = true; console.warn(`${spec.name}: the ${spec.rig === 'ual' ? 'animated actor' : 'model'} plays clips (act/play); ${k}() needs a mannequin rig`); } return f; };
  g.userData.api = f;
  f.place(o.x ?? 0, o.y ?? 0, o.z ?? 0, o.ry ?? 0); f.act(o.act ?? 'stand', o);
  return f;
}

// =====================================================================================================================
// THE HUMAN RIG (default): the realistic base bodies of the app's character library (Quaternius, CC0) on its shared
// skeleton, animated by the library's CC0 mocap clips (UAL1 + UAL2, gestures, KayKit) through ONE shared loader. The
// library is served to every project at <project>/__lib/ (and to the Characters preview at /fv/__lib/). Clothes are the
// outfit's colours painted per body region (cut on the T-pose: sleeves, collar V, tie strip, trousers, shoes), with
// cloth sheen; the head keeps its hair, the face stays plain.
// =====================================================================================================================
const LIBB = globalThis.__CZ_FIG_LIB || new URL('__lib/', BASE).href;
const HUMAN_FILES = { 'h:m': 'characters/base_m_grey.glb', 'h:f': 'characters/base_f_grey.glb', 'hair:m': 'characters/hair/hair_buzzed.glb', 'hair:f': 'characters/hair/hair_long.glb', 'a:ual1': 'animations/ual1.glb', 'a:ual2': 'animations/ual2.glb', 'a:gestures': 'animations/gestures.glb', 'a:kaykit': 'animations/kaykit_ue.glb' };
export const CLIPS = {};            // name -> AnimationClip (every clip of the four packs)
// act name -> clip (the mannequin rigs' act names work on humans too)
export const HUMAN_ACTS = { stand: 'Idle_Loop', idle: 'Idle_Loop', walk: 'Walk_Loop', walkFormal: 'Walk_Formal_Loop', jog: 'Jog_Fwd_Loop', run: 'Sprint_Loop', sit: 'Sitting_Idle_Loop',
  sitDown: 'Sitting_Enter', standUp: 'Sitting_Exit', sitChair: 'KK_Sit_Chair_Idle_Loop', typing: 'G_Typing_Seated_Loop', typingStand: 'G_Typing_Standing_Loop', phone: 'Idle_TalkingPhone_Loop', talk: 'Idle_Talking_Loop',
  handsOnHead: 'G_Hands_On_Head_Loop', point: 'G_Point_Forward', shrug: 'G_Shrug', facepalm: 'G_Facepalm', cuffed: 'Idle_FoldArms_Loop', think: 'Idle_No_Loop', yes: 'Yes',
  carry: 'KK_Hold_A_Loop', walkCarry: 'Walk_Carry_Loop', pickup: 'KK_PickUp', door: 'KK_Interact', use: 'KK_Use_Item', fall: 'KK_Fall_Death_A', die: 'Death01', hit: 'Hit_Chest',
  crouch: 'Crouch_Idle_Loop', sneak: 'KK_Sneak_Loop', lockpick: 'KK_Lockpicking_Loop', lie: 'KK_Lie_Idle_Loop', throw: 'KK_Throw', push: 'Push_Loop', drive: 'Driving_Loop', aim: 'Pistol_Aim_Neutral', wave: 'KK_Wave' };
let SKU = null;
async function loadHuman() {   // the old realistic bodies (only old code paths: v16 figures are mannequins)
  LIB ??= await import('./library.js'); SKU ??= await import('../vendor/jsm/utils/SkeletonUtils.js');
  const map = {}; for (const [k, f] of Object.entries(HUMAN_FILES)) if (!k.startsWith('a:')) map['fig:' + k] = LIBB + f;
  await LIB.loadModels(map);
}
async function loadClips() {   // the four CC0 clip packs of the library (every figure's motion)
  LIB ??= await import('./library.js'); SKU ??= await import('../vendor/jsm/utils/SkeletonUtils.js');
  const map = {}; for (const [k, f] of Object.entries(HUMAN_FILES)) if (k.startsWith('a:') && !LIB.MODELS['fig:' + k]) map['fig:' + k] = LIBB + f;
  await LIB.loadModels(map);
  for (const k of Object.keys(HUMAN_FILES)) if (k.startsWith('a:')) for (const c of LIB.MODELS['fig:' + k].animations) CLIPS[c.name] ??= c;
}
const R2 = { skin: 0, hands: 1, vee: 2, tie: 3, torso: 4, upperarm: 5, forearm: 6, hips: 7, thigh: 8, calf: 9, feet: 10, head: 11 };
// the library's "normal" build (its base bodies are superhero scans): flesh pulled toward the bones (lowpoly actor.js BUILDS)
const BUILD = { spine_03: [.8, .7, .88], spine_02: [.82, .74, .9], spine_01: [.88, .82, .94], pelvis: [.95, .93, .96], neck_01: .88, clavicle: .8, upperarm: .64, lowerarm: .8, thigh: .86, calf: .9 };
const HGEO = new Map(); export const SEAT_H = .45;   // seat top the human sit/typing clips sit on (scaled with the figure's height / 1.8)
// smooth action changes: every change of clip is a crossfade (smootherstep weight) of blendFor(from, to) seconds
const SEATED = n => /sit|typing(?!_?stand)|lie|driv/i.test(String(n)), GESTURE = /^(point|shrug|facepalm|yes|wave|talk|phone|think|handsOnHead|cuffed|use|door|hit)$/;
export const smoother = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (u * (u * 6 - 15) + 10);
const smootherInt = u => u <= 0 ? 0 : u >= 1 ? .5 : u ** 6 - 3 * u ** 5 + 2.5 * u ** 4;   // the integral of smoother over 0..u
const lerpAng = (a, b, w) => { let d = (b - a) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return a + d * w; };
// blendFor(from, to): seconds of crossfade (sit <-> stand 0.5, gestures 0.25, walk starts/stops 0.35, else 0.3)
export function blendFor(a, b) { if (a == null || a === b) return 0; if (SEATED(a) !== SEATED(b)) return .5; if (SEATED(a)) return .45;   // seated to seated: the arms travel far
  if (GESTURE.test(a) || GESTURE.test(b)) return .25; return /walk|jog|run|sneak/i.test(a + ' ' + b) ? .35 : .3; }
const WALKS = /walk|jog|run|sneak/i, FIGHT = /sword|punch|melee|shield|kick|attack|combo|dash|hook|jab|cross|dodge|slash|block/i;
// how a clip meets the floor (the figure's grounding, humanFigure gTable): 'body' | 'air' | 'seat' | 'feet'
const GROUND_BODY = /lie|lay|sit_?floor|situps|pushups|crawl|death|die\b|fall|knockback|roll|slide|kneel|swim|dodge/i, GROUND_AIR = /jump|climb/i;
export function groundMode(n) { n = String(n); return GROUND_BODY.test(n) ? 'body' : GROUND_AIR.test(n) ? 'air' : SEATED(n) ? 'seat' : 'feet'; }
function humanGeometry(mesh, female, L) {
  const key = mesh.geometry.uuid; if (HGEO.has(key)) return HGEO.get(key);
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone(), pos = src.attributes.position, n = pos.count, reg = new Float32Array(n);
  const half = female ? .5 : 1, P = b => new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
  const per = mesh.skeleton.bones.map(b => { const k = b.name.replace(/_[lr]$/, ''), f = BUILD[b.name] ?? BUILD[k]; if (f == null) return null;
    const fs = (Array.isArray(f) ? f : [f, f, f]).map(x => 1 + (x - 1) * half), a = P(b); if (/^(spine|pelvis|neck)/.test(b.name)) return { vert: true, a, fs };
    const kids = b.children.filter(c => c.isBone); if (!kids.length) return null; return { vert: false, a, b: kids.map(P).sort((p, q) => q.distanceTo(a) - p.distanceTo(a))[0], fs }; });
  const si = src.attributes.skinIndex, sw = src.attributes.skinWeight, M = mesh.matrixWorld, Mi = M.clone().invert(), v = V3(), d = V3(), off = V3(), ab = V3(), orig = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(M); orig.set([v.x, v.y, v.z], i * 3); d.set(0, 0, 0);
    for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j), s = per[si.getComponent(i, j)]; if (!s || w <= 0) continue;
      if (s.vert) { off.set(v.x - s.a.x, 0, v.z - s.a.z); d.x += w * (s.fs[0] - 1) * off.x; d.z += w * ((off.z > 0 ? s.fs[1] : s.fs[2]) - 1) * off.z; }
      else { ab.subVectors(s.b, s.a); const k = clamp(off.subVectors(v, s.a).dot(ab) / ab.lengthSq()); off.copy(v).sub(s.a.clone().addScaledVector(ab, k)); d.addScaledVector(off, w * (s.fs[0] - 1)); } }
    v.add(d).applyMatrix4(Mi); pos.setXYZ(i, v.x, v.y, v.z); }
  for (let t = 0; t < n; t += 3) {
    const cx = (orig[t * 3] + orig[t * 3 + 3] + orig[t * 3 + 6]) / 3, y = (orig[t * 3 + 1] + orig[t * 3 + 4] + orig[t * 3 + 7]) / 3, cz = (orig[t * 3 + 2] + orig[t * 3 + 5] + orig[t * 3 + 8]) / 3, ax = Math.abs(cx), front = cz > .015;
    let r;
    if (ax >= L.wristX - .015 && y > L.hipY + .2) r = R2.hands; else if (ax >= L.elbowX && y > L.hipY + .2) r = R2.forearm; else if (ax >= L.shoulderX + .035 && y > L.hipY + .25) r = R2.upperarm;
    else if (y >= L.neckY + .12) r = R2.head; else if (y >= L.neckY + .035) r = R2.skin;
    else if (y >= L.hipY + .09) { const top = L.neckY + .03, k = clamp((y - (L.hipY + .25)) / (top - (L.hipY + .25)));
      r = front && ax < .021 && y > L.hipY + .17 && y < L.neckY - .005 ? R2.tie : front && ax < .02 + .07 * k && y > L.hipY + .25 ? R2.vee : R2.torso; }
    else if (y >= L.hipY - .1) r = R2.hips; else if (y >= L.kneeY) r = R2.thigh; else if (y >= L.ankleY + .035) r = R2.calf; else r = R2.feet;
    reg[t] = reg[t + 1] = reg[t + 2] = r;
  }
  src.userData.reg = reg; src.userData.orig = orig; HGEO.set(key, src); return src;   // (the file's smooth normals are kept)
}
// an outfit of the wardrobe as colours per body region
function humanColors(spec) {
  const pal = OUTFITS[spec.outfit].palette, wear = OUTFITS[spec.outfit].wear, has = k => wear.some(w => w[0] === k), c = r => regionColor(spec, r);
  const skin = spec.colors.skin ?? '#c99a7c', top = c('top'), bottom = c('bottom'), shoes = c('shoes'), cols = new Array(12).fill(skin);
  if (!wear.length) return cols;
  const short = has('tee') || has('dress'), suit = has('jacket'), tie = wear.some(w => w[0] === 'shirt' && w[1].tie);
  for (const r of [R2.torso, R2.vee, R2.tie, R2.upperarm]) cols[r] = top; if (!short) cols[R2.forearm] = top;
  if (suit) { cols[R2.vee] = pal.shirt ?? c('accent'); cols[R2.tie] = tie ? c('accent') : cols[R2.vee]; }
  if (has('vest') && !has('hoodie')) cols[R2.torso] = c('accent');
  if (has('dress')) { cols[R2.hips] = top; cols[R2.thigh] = top; } else { cols[R2.hips] = bottom; cols[R2.thigh] = bottom; }
  cols[R2.calf] = has('dress') ? skin : bottom; cols[R2.feet] = shoes;
  if (has('gloves') || has('balaclava') || spec.rig === 'masked') cols[R2.hands] = '#141517';
  if (has('balaclava')) cols[R2.head] = cols[R2.skin] = '#141517';
  if (wear.some(w => w[0] === 'hoodie' && w[1].hood === 'up')) cols[R2.skin] = top;
  if (has('jumpsuit')) cols[R2.hips] = cols[R2.thigh] = cols[R2.calf] = top;
  return cols;
}
// ---------------------------------------------------------------------------------------------------------------------
// THE HUMAN WARDROBE: real garments. Every garment is a shell cut from the body mesh itself (the triangles it covers,
// pushed 4-30 mm out along the body's normals, the cut edges snapped straight, a hem band and a turned edge), skinned to
// the SAME skeleton with the body's own weights, so it moves with every mocap clip and IK pose without lagging. Coats and
// dresses get a hanging skirt (pelvis + both thighs); collars, ties, buttons, hoods and cap brims are small parts skinned
// to the nearest body point. Under the cloth the body is painted the outer garment's colour, so a fold never shows skin.
// ---------------------------------------------------------------------------------------------------------------------
export const ramp = smooth;   // ramp(a, b, t): 0 before a, 1 after b, smooth between (fade a hold in/out)
const BODYDATA = new Map();
function bodyData(m, src, L) {   // welded vertices of the (built) body: world bind position, normal, skin, the T-pose position
  const key = src.uuid; if (BODYDATA.has(key)) return BODYDATA.get(key);
  const pos = src.attributes.position, nor = src.attributes.normal, si = src.attributes.skinIndex, sw = src.attributes.skinWeight, orig = src.userData.orig, n = pos.count, M = m.matrixWorld;
  const ids = new Int32Array(n), map = new Map(), P = [], N = [], O = [], SK = [], v = V3(), nn = V3();
  for (let i = 0; i < n; i++) { const k = `${Math.round(orig[i * 3] * 2e4)},${Math.round(orig[i * 3 + 1] * 2e4)},${Math.round(orig[i * 3 + 2] * 2e4)}`; let id = map.get(k);
    if (id == null) { id = P.length / 3; map.set(k, id); v.fromBufferAttribute(pos, i).applyMatrix4(M); P.push(v.x, v.y, v.z); N.push(0, 0, 0); O.push(orig[i * 3], orig[i * 3 + 1], orig[i * 3 + 2]);
      SK.push([0, 1, 2, 3].map(j => si.getComponent(i, j)), [0, 1, 2, 3].map(j => sw.getComponent(i, j))); }
    ids[i] = id; nn.fromBufferAttribute(nor, i).transformDirection(M); N[id * 3] += nn.x; N[id * 3 + 1] += nn.y; N[id * 3 + 2] += nn.z; }
  const W = P.length / 3; for (let i = 0; i < W; i++) { nn.set(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]).normalize(); N[i * 3] = nn.x; N[i * 3 + 1] = nn.y; N[i * 3 + 2] = nn.z; }
  // landmarks from the mesh: the top of the head, the head's centre depth, the side the left leg is on
  let top = 0, hz = 0, hc = 0; for (let i = 0; i < W; i++) { top = Math.max(top, O[i * 3 + 1]); if (O[i * 3 + 1] > L.neckY + .12) { hz += O[i * 3 + 2]; hc++; } }
  const d = { ids, P, N, O, SK, W, top, headZ: hc ? hz / hc : 0, M: M.clone(), Mi: M.clone().invert() };
  // the dominant bone of every welded vertex (hands: contact checks)
  d.dom = new Int32Array(W); for (let i = 0; i < W; i++) { const [I, Wt] = [SK[i * 2], SK[i * 2 + 1]]; let b = 0; for (let j = 1; j < 4; j++) if (Wt[j] > Wt[b]) b = j; d.dom[i] = I[b]; }
  d.corner = new Int32Array(W); for (let i = n - 1; i >= 0; i--) d.corner[ids[i]] = i;
  BODYDATA.set(key, d); return d;
}
// the garments a wear list makes on a human body: { sel(c), off, fabric, color, cuts, band, skirt, collar, ... }
function wardrobe(spec, L, D) {
  const wear = OUTFITS[spec.outfit].wear, c = r => regionColor(spec, r), has = k => wear.some(w => w[0] === k);
  const armX = L.shoulderX + .035, sA = x => (x - L.shoulderX) / (L.wristX - L.shoulderX), arm = q => q.ax >= armX && q.y > L.hipY + .2;
  const hand = q => q.ax >= L.wristX - .015 && q.y > L.hipY + .2, head = q => q.y >= L.neckY + .035 && !arm(q);
  const torso = (q, lo, hi = L.neckY + .018) => !arm(q) && q.y >= lo && q.y < hi;
  const legs = (q, lo) => q.y < L.hipY + .115 && q.y >= lo && !(q.y > L.hipY + .2);
  const out = []; const P = (o) => { out.push(o); return o; };
  const shellTop = (go, o) => P({ name: o.name, region: go.region ?? 'top', color: c(go.region ?? 'top'), fabric: go.fabric ?? o.fabric, off: o.off, band: o.band ?? .0025,
    sel: q => torso(q, o.hem) || (arm(q) && sA(q.ax) < o.sleeve) || (o.legs != null && legs(q, o.legs)) || (o.extra?.(q) ?? false),
    cutsY: [o.hem, L.neckY + .018].concat(o.legs != null ? [o.legs] : []), cutsX: o.sleeve < 1 ? [L.shoulderX + o.sleeve * (L.wristX - L.shoulderX)] : [], collar: o.collar, open: o.open, rib: o.rib, buttons: o.buttons, skirt: o.skirt, hood: o.hood });
  for (const [k, go] of wear) {
    if (k === 'tee') shellTop(go, { name: 'tee', fabric: 'jersey', off: .0045, hem: L.hipY - .02, sleeve: .3 });
    else if (k === 'longtee' || k === 'longsleeve') shellTop(go, { name: 'long-sleeve tee', fabric: 'jersey', off: .0045, hem: L.hipY - .02, sleeve: .96, rib: true });
    else if (k === 'shirt') shellTop(go, { name: 'shirt', fabric: 'cotton', off: .011, hem: L.hipY + .02, sleeve: .965, collar: true, buttons: !has('jacket') && !has('vest'), open: false });
    else if (k === 'sweater') shellTop(go, { name: 'sweater', fabric: 'knit', off: .007, hem: L.hipY - .05, sleeve: .955, rib: true });
    else if (k === 'hoodie') shellTop(go, { name: 'hoodie', fabric: 'fleece', off: go.under ? .007 : .009, hem: L.hipY - .07, sleeve: .955, rib: true, hood: go.hood ?? 'down' });
    else if (k === 'jacket' || k === 'blazer') shellTop(go, { name: 'jacket', fabric: 'wool2', off: .017, hem: L.hipY + .0, sleeve: .925, open: true, skirt: { y0: L.hipY + .03, y1: L.hipY - .2, off: .02, flare: .015 } });
    else if (k === 'parka') shellTop(go, { name: 'parka', fabric: 'nylon', off: .024, hem: L.hipY - .13, sleeve: .94, rib: true, skirt: { y0: L.hipY - .09, y1: L.hipY - .27, off: .028, flare: .03 } });
    else if (k === 'smock') shellTop(go, { name: 'smock', fabric: 'canvas', off: .02, hem: L.hipY + .04, sleeve: .9, collar: true, buttons: true, skirt: { y0: L.hipY + .07, y1: L.kneeY + .03, off: .03, flare: .045 } });   // v2.3: the cloth skirt clears the legs itself (no lampshade)
    else if (k === 'jumpsuit') shellTop(go, { name: 'jumpsuit', fabric: 'canvas', off: .011, hem: L.hipY - .2, sleeve: .955, legs: L.ankleY + .035, collar: true });
    else if (k === 'dress') shellTop(go, { name: 'dress', fabric: 'wool2', off: .006, hem: L.hipY + .09, sleeve: .22, skirt: { y0: L.hipY + .12, y1: L.kneeY - .04, off: .014, flare: .06 } });
    else if (k === 'overalls') { P({ name: 'overalls', color: c(go.region ?? 'top'), fabric: 'denim', off: .011, band: .003,
      sel: q => legs(q, L.ankleY + .035) || (!arm(q) && q.y >= L.hipY + .09 && (q.z > .0 ? q.y < L.neckY - .14 && q.ax < .13 : q.y < L.hipY + .25)) || (!arm(q) && q.y >= L.hipY + .09 && q.y < L.neckY - .005 && q.ax > .05 && q.ax < .1),
      cutsY: [L.ankleY + .035, L.neckY - .14, L.hipY + .25], cutsX: [.05, .1] }); }
    else if (k === 'jeans' || k === 'trousers' || k === 'cargo') { P({ name: k, color: c(go.region ?? 'bottom'), fabric: go.fabric ?? (k === 'jeans' ? 'denim' : k === 'cargo' ? 'canvas' : 'wool'), off: k === 'cargo' ? .009 : .0065, band: .003,
      sel: q => legs(q, L.ankleY + .03) && q.y < L.hipY + .1, cutsY: [L.ankleY + .03, L.hipY + .1], cutsX: [] });
      if (go.belt !== false && !has('jacket') && !has('smock')) P({ name: 'belt', color: '#1d1a17', fabric: 'leather', off: .012, band: 0, sel: q => !arm(q) && q.y >= L.hipY + .065 && q.y < L.hipY + .1, cutsY: [L.hipY + .065, L.hipY + .1], cutsX: [] }); }
    else if (k === 'shoes' || k === 'sneakers' || k === 'boots') P({ name: k, color: c(go.region ?? 'shoes'), fabric: k === 'shoes' ? 'leatherGloss' : k === 'boots' ? 'leather' : 'canvas', off: .005, band: .003,
      sel: q => q.y < (k === 'boots' ? L.ankleY + .13 : L.ankleY + .055), cutsY: [k === 'boots' ? L.ankleY + .13 : L.ankleY + .055], cutsX: [] });
    else if (k === 'vest') P({ name: 'vest', color: c(go.region ?? 'accent'), fabric: 'tactical', off: go.kind === 'plate' ? .045 : .03, band: .004, sel: q => !arm(q) && q.y >= L.hipY + .02 && q.y < L.neckY - .05 && q.ax < L.shoulderX + .0, cutsY: [L.hipY + .02, L.neckY - .05], cutsX: [] });
    else if (k === 'gloves') P({ name: 'gloves', color: '#141517', fabric: 'leather', off: .0025, band: .002, sel: q => q.ax >= L.wristX - .03 && q.y > L.hipY + .2, cutsY: [], cutsX: [L.wristX - .03] });
    else if (k === 'kneepads') P({ name: 'kneepads', color: '#1b1c1e', fabric: 'rubber', off: .022, band: 0, sel: q => q.y < L.hipY && Math.abs(q.y - L.kneeY) < .06 && q.z > .0, cutsY: [L.kneeY - .06, L.kneeY + .06], cutsX: [] });
    else if (k === 'balaclava') P({ name: 'balaclava', color: '#141517', fabric: 'knit', off: .004, band: 0, sel: q => head(q) && !(q.z > D.headZ + .03 && Math.abs(q.y - (D.top - .12)) < .022 && q.ax < .06), cutsY: [], cutsX: [] });
    else if (k === 'cap' || k === 'helmet') P({ name: k, color: c(go.region ?? 'top'), fabric: k === 'cap' ? 'cotton' : 'rubber', off: k === 'cap' ? .009 : .028, band: .003, sel: q => head(q) && q.y > D.top - (k === 'cap' ? .085 : .12), cutsY: [D.top - (k === 'cap' ? .085 : .12)], cutsX: [], brim: k === 'cap' });
  }
  if (wear.some(w => w[0] === 'hoodie' && w[1].hood === 'up')) P({ name: 'hood', color: c('top'), fabric: 'fleece', off: .024, band: .004, sel: q => q.ax < .16 && q.y > L.neckY - .01 && !arm(q) && !(q.z > D.headZ + .015 && q.y < D.top - .055 && q.y > L.neckY + .09 && q.ax < .07), cutsY: [], cutsX: [] });
  return out;
}
// a garment shell: the body triangles the garment covers, pushed out along the normals, edges snapped straight + turned
function shellGeo(D, src, g, L) {
  const ids = D.ids, O = src.userData.orig, T = ids.length / 3, keep = [], q = { x: 0, y: 0, z: 0, ax: 0 };
  for (let t = 0; t < T; t++) { let x = 0, y = 0, z = 0; for (let k = 0; k < 3; k++) { x += O[(t * 3 + k) * 3]; y += O[(t * 3 + k) * 3 + 1]; z += O[(t * 3 + k) * 3 + 2]; }
    q.x = x / 3; q.y = y / 3; q.z = z / 3; q.ax = Math.abs(q.x); if (g.sel(q)) keep.push(t); }
  const edge = new Map(), vid = new Map(); for (const t of keep) for (let k = 0; k < 3; k++) { const a = ids[t * 3 + k], b = ids[t * 3 + (k + 1) % 3], e = a < b ? a + ',' + b : b + ',' + a; edge.set(e, (edge.get(e) || 0) + 1); }
  const bnd = new Set(); for (const [e, n] of edge) if (n === 1) for (const s of e.split(',')) bnd.add(+s);
  const pos = [], nor = [], uv = [], si = [], sw = [], idx = [], wp = V3(), wn = V3(), M = D.Mi;
  const add = (id, off, snap = true) => { wp.set(D.P[id * 3], D.P[id * 3 + 1], D.P[id * 3 + 2]); wn.set(D.N[id * 3], D.N[id * 3 + 1], D.N[id * 3 + 2]);
    let band = 0; const oy = D.O[id * 3 + 1], ox = Math.abs(D.O[id * 3]);
    for (const cy of g.cutsY) { const dd = Math.abs(oy - cy); if (snap && bnd.has(id) && (dd < .035 || (dd < .07 && ox < L.shoulderX))) wp.y += cy - oy;   /* v2.2: wider snap on the torso cuts (no jagged neckline / waist), never the arms */ if (dd < .022) band = Math.max(band, g.band); }
    for (const cx of g.cutsX) { const dd = Math.abs(ox - cx); if (snap && bnd.has(id) && dd < .035) wp.x += Math.sign(wp.x) * (cx - ox); if (dd < .024) band = Math.max(band, g.band * (g.rib ? 1.6 : 1)); }
    wp.addScaledVector(wn, off + band).applyMatrix4(M); pos.push(wp.x, wp.y, wp.z); const nl = wn.clone().transformDirection(M); nor.push(nl.x, nl.y, nl.z);
    uv.push(D.O[id * 3] + D.O[id * 3 + 2] * .7, D.O[id * 3 + 1]); si.push(...D.SK[id * 2]); sw.push(...D.SK[id * 2 + 1]); return pos.length / 3 - 1; };
  for (const t of keep) for (let k = 0; k < 3; k++) { const id = ids[t * 3 + k]; if (!vid.has(id)) vid.set(id, add(id, g.off)); idx.push(vid.get(id)); }
  // cloth drapes over the muscles instead of shrink-wrapping them: Laplacian smoothing, then never closer than `off` to the body
  { const nb = new Map(), bp = new Float32Array(pos.length), Mw = D.M; for (let i = 0; i < idx.length; i += 3) for (let k = 0; k < 3; k++) { const a = idx[i + k], b = idx[i + (k + 1) % 3]; (nb.get(a) ?? nb.set(a, new Set()).get(a)).add(b); (nb.get(b) ?? nb.set(b, new Set()).get(b)).add(a); }
    const fixed = new Set([...bnd].map(id => vid.get(id))), ofId = new Map([...vid].map(([id, v]) => [v, id])), w = V3(), q2 = V3();
    const NB = [...nb].filter(([v]) => !fixed.has(v)).map(([v, ns]) => [v, [...ns]]);   // (flat arrays: the smoothing runs per garment, keep it fast)
    for (let it = 0; it < (g.smooth ?? 40); it++) { bp.set(pos); for (const [v, ns] of NB) { let x = 0, y = 0, z = 0; for (const u of ns) { x += bp[u * 3]; y += bp[u * 3 + 1]; z += bp[u * 3 + 2]; }
        // v2.2: drape = an outward-only smoothing (valleys between muscles fill, peaks never sink back onto the body)
        const n = ns.length, dx = (x / n - bp[v * 3]) * .75, dy = (y / n - bp[v * 3 + 1]) * .75, dz = (z / n - bp[v * 3 + 2]) * .75, nx = nor[v * 3], ny = nor[v * 3 + 1], nz = nor[v * 3 + 2], dn = Math.min(0, dx * nx + dy * ny + dz * nz);
        pos[v * 3] = bp[v * 3] + dx - dn * nx; pos[v * 3 + 1] = bp[v * 3 + 1] + dy - dn * ny; pos[v * 3 + 2] = bp[v * 3 + 2] + dz - dn * nz; } }
    for (const [v, id] of ofId) { w.set(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]).applyMatrix4(Mw); q2.set(D.P[id * 3], D.P[id * 3 + 1], D.P[id * 3 + 2]); const nn = V3(D.N[id * 3], D.N[id * 3 + 1], D.N[id * 3 + 2]), d = w.clone().sub(q2).dot(nn);
      if (d < g.off) w.addScaledVector(nn, g.off - d); w.applyMatrix4(D.Mi); pos[v * 3] = w.x; pos[v * 3 + 1] = w.y; pos[v * 3 + 2] = w.z; }
    // v2.2: shade the cloth by its OWN (smoothed) surface, not the body's normals: the body normals drew pecs, abs and
    // shoulder blades on every shirt (cloth "clinging like skin"). Area-weighted face normals, kept on the body's side.
    const fn = new Float32Array(pos.length), a = V3(), b = V3(), c = V3();
    for (let i = 0; i < idx.length; i += 3) { const [i0, i1, i2] = [idx[i], idx[i + 1], idx[i + 2]]; a.fromArray(pos, i0 * 3); b.fromArray(pos, i1 * 3).sub(a); c.fromArray(pos, i2 * 3).sub(a); b.cross(c);
      for (const v of [i0, i1, i2]) { fn[v * 3] += b.x; fn[v * 3 + 1] += b.y; fn[v * 3 + 2] += b.z; } }
    for (let v = 0; v < pos.length / 3; v++) { a.fromArray(fn, v * 3); if (a.lengthSq() < 1e-14) continue; a.normalize(); b.fromArray(nor, v * 3); if (a.dot(b) < 0) a.negate();
      a.lerp(b, .04).normalize(); nor[v * 3] = a.x; nor[v * 3 + 1] = a.y; nor[v * 3 + 2] = a.z; } }
  // the turned edge: a strip from the cloth surface back to the body along every cut (the cloth has a thickness)
  const inner = new Map(); for (const [e, n] of edge) { if (n !== 1) continue; const [a, b] = e.split(',').map(Number);
    for (const s of [a, b]) if (!inner.has(s)) inner.set(s, add(s, .0008));
    idx.push(vid.get(a), vid.get(b), inner.get(b), vid.get(a), inner.get(b), inner.get(a)); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); geo.setIndex(idx);
  geo.userData.covers = new Set(keep.flatMap(t => [ids[t * 3], ids[t * 3 + 1], ids[t * 3 + 2]]).filter(id => !bnd.has(id)));
  geo.userData.bnd = [...bnd].filter(id => vid.has(id)).map(id => [id, vid.get(id)]);
  return geo;
}
// FACES (v2.2): a photo face (experiments/crime-style/sprites, brows-to-chin oval with feathered alpha) on the head as a
// skin of the head's own front triangles, 2.5 mm out along the normals, skinned like the head; planar UVs from the front
// (eyes at 0.40 of the image, mouth at 0.61); vertex alpha fades it out where the head turns away (no plate, no seam).
export const FACE_EXPR = ['neutral', 'determined', 'worried', 'surprised', 'smirk', 'lookdown'];
const FACE_CHARS = ['youngman', 'official', 'woman'], FACE_TEX = {};
export const FACE_TUNE = { eye: .118, size: .262, dx: 0, off: .0025, zMin: .12 };
async function loadFaces() { if (FACE_TEX.ready) return; FACE_TEX.ready = true;
  await Promise.all(FACE_CHARS.flatMap(c => FACE_EXPR.map(async e => { const im = new Image(); im.src = new URL(`assets/figures/faces/${c}_${e}.png`, BASE).href;
    try { await im.decode(); } catch { return; } const t = new THREE.Texture(im); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; (FACE_TEX[c] ??= {})[e] = t;
    if (e === 'neutral') { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, 64, 64);
      let r = 0, g = 0, b = 0, n = 0; for (const [u0, v0] of [[.3, .55], [.64, .55], [.47, .26]]) { const d = x.getImageData(Math.round(u0 * 64), Math.round(v0 * 64), 4, 4).data; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } }
      if (n) FACE_TEX[c].skin = '#' + new THREE.Color(r / n / 255, g / n / 255, b / n / 255).convertSRGBToLinear().convertLinearToSRGB().getHexString(); } }))); }
function faceGeo(D, src) {
  const ids = D.ids, O = src.userData.orig, T = ids.length / 3, F = FACE_TUNE, eyeY = D.top - F.eye, top = eyeY + .40 * F.size, keep = [];
  for (let t = 0; t < T; t++) { let y = 0, z = 0, x = 0, nz = 0; for (let k = 0; k < 3; k++) { const id = ids[t * 3 + k]; x += O[(t * 3 + k) * 3]; y += O[(t * 3 + k) * 3 + 1]; z += O[(t * 3 + k) * 3 + 2]; nz += D.N[id * 3 + 2]; }
    x /= 3; y /= 3; z /= 3; nz /= 3; if (y < top && y > top - F.size * .86 && z > D.headZ && Math.abs(x) < F.size * .3 && nz > F.zMin - .1) keep.push(t); }
  const vid = new Map(), pos = [], uv = [], col = [], si = [], sw = [], idx = [], wp = V3();
  for (const t of keep) for (let k = 0; k < 3; k++) { const id = ids[t * 3 + k]; if (!vid.has(id)) { wp.set(D.P[id * 3], D.P[id * 3 + 1], D.P[id * 3 + 2]).addScaledVector(V3(D.N[id * 3], D.N[id * 3 + 1], D.N[id * 3 + 2]), F.off).applyMatrix4(D.Mi);
      pos.push(wp.x, wp.y, wp.z); uv.push(.5 + (D.O[id * 3] - F.dx) / F.size, 1 - (top - D.O[id * 3 + 1]) / F.size); const a = smooth(F.zMin, F.zMin + .3, D.N[id * 3 + 2]); col.push(1, 1, 1, a);
      si.push(...D.SK[id * 2]); sw.push(...D.SK[id * 2 + 1]); vid.set(id, pos.length / 3 - 1); } idx.push(vid.get(id)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// which face a figure wears: spec.face (a character name) or by body / role (women: woman; officials, police, detectives,
// witnesses in suits: official; everyone else: youngman)
// (extras and witnesses keep the library face unless spec.face names one: a crowd of one photo face reads as clones)
const faceChar = spec => spec.face === false || spec.face === 'none' ? null : FACE_CHARS.includes(spec.face) ? spec.face : spec.body === 'f' && spec.role !== 'extra' ? 'woman'
  : /official|detective|police|director/.test(spec.role ?? '') ? 'official' : /suspect|main|accomplice|prisoner|victim/.test(spec.role ?? '') ? 'youngman' : null;
// a hanging skirt (coat tails, smock, dress): elliptic rings from the waist down, skinned to the pelvis and both thighs
function skirtGeo(D, sk, bones, L) {
  const R = 9, N = 36, rings = [], bi = n => Math.max(0, bones.findIndex(b => b.name === n)), PEL = bi('pelvis'), TL = bi('thigh_l'), TR = bi('thigh_r');
  const lx = Math.sign(bones[TL] ? new THREE.Vector3().setFromMatrixPosition(bones[TL].matrixWorld).x : 1) || 1;
  let rx = 0, zf = -1, zb = 1;
  for (let r = 0; r < R; r++) { const y = sk.y0 + (sk.y1 - sk.y0) * r / (R - 1); let cx = 0, f = -1, b = 1;
    for (let i = 0; i < D.W; i++) { const oy = D.P[i * 3 + 1]; if (Math.abs(oy - y) > .03 || Math.abs(D.O[i * 3]) > L.shoulderX + .02 || D.O[i * 3 + 1] > L.hipY + .2) continue; cx = Math.max(cx, Math.abs(D.P[i * 3])); f = Math.max(f, D.P[i * 3 + 2]); b = Math.min(b, D.P[i * 3 + 2]); }
    rx = Math.max(rx, cx); zf = Math.max(zf, f); zb = Math.min(zb, b); const k = r / (R - 1), o = sk.off + sk.flare * k, cz = (zf + zb) / 2;
    // the body's own outline at this height (per angle), so the waist of the skirt hugs the hips and only the hem is round
    const hug = new Float32Array(N + 1); for (let i = 0; i < D.W; i++) { if (Math.abs(D.P[i * 3 + 1] - y) > .03 || Math.abs(D.O[i * 3]) > L.shoulderX + .02 || D.O[i * 3 + 1] > L.hipY + .2) continue;
      const x = D.P[i * 3], z = D.P[i * 3 + 2] - cz, j = Math.round(((Math.atan2(x, z) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * N); hug[j % N] = Math.max(hug[j % N], Math.hypot(x, z)); }
    for (let it = 0; it < 3; it++) for (let j = 0; j < N; j++) hug[j] = Math.max(hug[j], (hug[(j + N - 1) % N] + hug[(j + 1) % N]) * .5); hug[N] = hug[0];
    rings.push({ y, rx: rx + o, rf: zf - cz + o, rb: cz - zb + o, cz, o, hug, k: smooth(0, .45, k), a: smooth(0, 1, (sk.y0 - y) / Math.max(.1, sk.y0 - L.kneeY)) * .9 }); }
  const pos = [], nor = [], uv = [], si = [], sw = [], idx = [], p = V3(), nn = V3(), cloth = { N, R, PEL, TL, TR, rings: [] };
  const ring = (rg, inset, dy) => { const s0 = pos.length / 3, rad = []; cloth.rings.push({ y: rg.y + dy, cz: rg.cz, a: rg.a, rad, inset }); for (let j = 0; j <= N; j++) { const th = j / N * Math.PI * 2, sx = Math.sin(th), cz = Math.cos(th), rz = cz > 0 ? rg.rf : rg.rb;
      const er = Math.hypot(rg.rx * sx, rz * cz), hr = rg.hug[j] + rg.o, rr = Math.max(hr, hr + (er - hr) * rg.k) - inset; rad.push(rr);
      p.set(rr * sx, rg.y + dy, rg.cz + rr * cz).applyMatrix4(D.Mi); pos.push(p.x, p.y, p.z); nn.set(sx / rg.rx, 0, cz / rz).normalize().transformDirection(D.Mi); nor.push(nn.x, nn.y, nn.z);
      uv.push(th * .25, rg.y); si.push(PEL, 0, 0, 0); sw.push(1, 0, 0, 0); } return s0; };   // (posed per frame by clothSkirt)
  const quads = (a, b) => { for (let j = 0; j < N; j++) idx.push(a + j, b + j, a + j + 1, a + j + 1, b + j, b + j + 1); };
  let prev = ring(rings[0], 0, 0); for (let r = 1; r < R; r++) { const cur = ring(rings[r], 0, 0); quads(prev, cur); prev = cur; }
  const hem = ring(rings[R - 1], .007, .006); quads(prev, hem);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); geo.setIndex(idx);
  geo.userData.cloth = cloth; return geo;
}
// v2.3 CLOTH SKIRT: the skirt is no longer linear-blend skinned to the thighs (a striding leg dragged the rings through each
// other: holes, dark trouser patches, the hem folding into the legs). Every frame (f.apply) each ring is placed from the
// pelvis, its centre following the knees by the ring's weight, and every vertex is pushed out along its ring's radius until
// it clears both legs' thigh / shin capsules (+ the garment's offset): per-vertex max(rest radius, leg clearance), then a
// max-preserving smoothing round each ring and down the skirt (no dents, the cloth falls straight from what pushes it).
// A closed shell with a turned hem, so it can't open a hole whatever the clip does. Written in the skirt's own skin space
// (all weight on the pelvis) so clipReport / applyBoneTransform still see the true positions.
function legCapsules(D, bones) {   // bind-space leg segments with their radius in 5 bins along the segment
  const B = n => bones.find(b => b.name === n), wp = b => new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);   // (called at dressing time: the rest pose, bind space)
  const segs = []; for (const sd of ['l', 'r']) for (const [a, b, re] of [['thigh_' + sd, 'calf_' + sd, new RegExp(`^thigh.*_${sd}$`)], ['calf_' + sd, 'foot_' + sd, new RegExp(`^calf.*_${sd}$`)]]) {
    const A = B(a), Bb = B(b); if (!A || !Bb) continue; const a0 = wp(A), b0 = wp(Bb), ab = b0.clone().sub(a0), L2 = ab.lengthSq(), rad = new Float32Array(5), v = V3(), bins = [[], [], [], [], []];
    for (let i = 0; i < D.W; i++) { const nm = bones[D.dom[i]]?.name || ''; if (!re.test(nm)) continue; v.set(D.P[i * 3], D.P[i * 3 + 1], D.P[i * 3 + 2]);
      const s = clamp(v.clone().sub(a0).dot(ab) / L2), d = v.distanceTo(a0.clone().addScaledVector(ab, s)), k = Math.min(4, Math.floor(s * 5)); if (d < .13) bins[k].push(d); }
    // the 85th percentile, not the max: the buttock / groin vertices the thigh bones own would make panniers at the hips
    for (let k = 0; k < 5; k++) { const b = bins[k].sort((x, y) => x - y); rad[k] = b.length ? b[Math.floor(b.length * .85)] : Math.max(rad[k - 1] || 0, .05); }
    segs.push({ A, B: Bb, rad, a0, b0 }); }
  return segs;
}
function clothSkirt(s, m, D, bones, margin) {
  const C = s.geometry.userData.cloth, pa = s.geometry.attributes.position, segs = legCapsules(D, bones), N = C.N, NR = C.rings.length;
  const inv = s.skeleton.boneInverses, Sk = i => new THREE.Matrix4().multiplyMatrices(m.matrixWorld, m.bindMatrixInverse).multiply(bones[i].matrixWorld).multiply(inv[i]).multiply(m.bindMatrix).multiply(D.Mi);
  const T = Array.from({ length: NR }, () => new Float32Array(N + 1)), ex = V3(), ey = V3(), ez = V3(), c = V3(), q = V3(), p = V3(), rd = V3(), qc = V3(), cT = V3(), A = V3(), B = V3();
  const legs = segs.map(() => ({ a: V3(), b: V3() }));
  return () => {
    const P = Sk(C.PEL), TLm = Sk(C.TL), TRm = Sk(C.TR); P.extractBasis(ex, ey, ez); const sc = ex.length(); ex.normalize(); ey.normalize(); ez.normalize();
    segs.forEach((g, i) => { legs[i].a.setFromMatrixPosition(g.A.matrixWorld); legs[i].b.setFromMatrixPosition(g.B.matrixWorld); });
    const cen = [], bx = [], bz = [], by = [], qP = new THREE.Quaternion(), qL = new THREE.Quaternion(), qR = new THREE.Quaternion(), qr = new THREE.Quaternion(), _s = V3(), _p = V3();
    P.decompose(_p, qP, _s); TLm.decompose(_p, qL, _s); TRm.decompose(_p, qR, _s); qL.slerp(qR, .5);
    for (let r = 0; r < NR; r++) { const rg = C.rings[r], cb = V3(0, rg.y, rg.cz); c.copy(cb).applyMatrix4(P); cT.copy(cb).applyMatrix4(TLm).add(q.copy(cb).applyMatrix4(TRm)).multiplyScalar(.5); c.lerp(cT, rg.a * .8); cen.push(c.clone());
      // the ring's plane turns with the thighs by its weight (seated: the lower rings stand across the lap, not through it)
      qr.copy(qP).slerp(qL, rg.a * .85); ex.set(1, 0, 0).applyQuaternion(qr); ez.set(0, 0, 1).applyQuaternion(qr); bx.push(ex.clone()); bz.push(ez.clone()); by.push(V3(0, 1, 0).applyQuaternion(qr));
      for (let j = 0; j <= N; j++) { const th = j / N * Math.PI * 2, sx = Math.sin(th), cz = Math.cos(th); rd.copy(ex).multiplyScalar(sx).addScaledVector(ez, cz);
        let t = rg.rad[j] * sc; if (r === 0) { T[r][j] = t; continue; }   // the waistband hugs the waist (nothing to clear there)
        for (let it = 0; it < 2; it++) { p.copy(c).addScaledVector(rd, t);
          for (let g = 0; g < segs.length; g++) { const L = legs[g], ab = B.copy(L.b).sub(L.a), u = clamp(A.copy(p).sub(L.a).dot(ab) / ab.lengthSq()), rad = segs[g].rad[Math.min(4, Math.floor(u * 5))] * sc + (margin - rg.inset) * sc;
            if (g % 2 === 0 && u < .2) continue;   // (the top of the thigh is inside the hips: the waist hug covers it, a capsule there = panniers)
            q.copy(L.a).addScaledVector(ab, u); qc.copy(q).sub(c); const along = qc.dot(rd); if (along < 0) continue; const perp2 = qc.lengthSq() - along * along, disc = rad * rad - perp2; if (disc > 0) t = Math.max(t, along + Math.sqrt(disc)); } }
        T[r][j] = t; } }
    for (let r = 0; r < NR; r++) { const R = T[r]; for (let it = 0; it < 4; it++) for (let j = 0; j < N; j++) R[j] = Math.max(R[j], (R[(j + N - 1) % N] + R[(j + 1) % N]) * .5 - .002 * sc); R[N] = R[0];
      if (r > 0 && !C.rings[r].inset) for (let j = 0; j <= N; j++) R[j] = Math.max(R[j], T[r - 1][j] - .012 * sc); }
    const hem = NR - 1; if (C.rings[hem].inset) for (let j = 0; j <= N; j++) T[hem][j] = T[hem - 1][j] - C.rings[hem].inset * sc;
    s.updateMatrixWorld(true); const Pinv = new THREE.Matrix4().multiplyMatrices(s.matrixWorld, s.bindMatrixInverse).multiply(bones[C.PEL].matrixWorld).multiply(inv[C.PEL]).multiply(s.bindMatrix).invert();
    for (let r = 0, v = 0; r < NR; r++) for (let j = 0; j <= N; j++, v++) { const th = j / N * Math.PI * 2; rd.copy(bx[r]).multiplyScalar(Math.sin(th)).addScaledVector(bz[r], Math.cos(th)); p.copy(cen[r]).addScaledVector(rd, T[r][j]).applyMatrix4(Pinv); pa.setXYZ(v, p.x, p.y, p.z); }
    pa.needsUpdate = true; s.geometry.computeVertexNormals(); const na = s.geometry.attributes.normal;
    for (let r = 0; r < NR; r++) { const a = r * (N + 1), b = a + N; p.set(na.getX(a) + na.getX(b), na.getY(a) + na.getY(b), na.getZ(a) + na.getZ(b)).normalize(); na.setXYZ(a, p.x, p.y, p.z); na.setXYZ(b, p.x, p.y, p.z); }
    na.needsUpdate = true; s.userData.clothState = { cen, T, bx, by, bz, ey: by[0], sc, N, NR, hemmed: !!C.rings[hem].inset }; };
}
// small parts (collar, tie, buttons, hood, brim) made in world bind space, every vertex skinned like its nearest body point
function accGeo(D, geo) {
  const g = geo.index ? geo : geo, pos = g.attributes.position, n = pos.count, si = [], sw = [], v = V3();
  const grid = D.grid ??= (() => { const m = new Map(); for (let i = 0; i < D.W; i++) { const k = `${Math.floor(D.P[i * 3] / .04)},${Math.floor(D.P[i * 3 + 1] / .04)},${Math.floor(D.P[i * 3 + 2] / .04)}`; (m.get(k) ?? m.set(k, []).get(k)).push(i); } return m; })();
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i); let best = 0, bd = 1e9; const gx = Math.floor(v.x / .04), gy = Math.floor(v.y / .04), gz = Math.floor(v.z / .04);
    for (let r = 1; r <= 3 && bd === 1e9; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let c = -r; c <= r; c++) for (const j of grid.get(`${gx + a},${gy + b},${gz + c}`) || []) { const d = (D.P[j * 3] - v.x) ** 2 + (D.P[j * 3 + 1] - v.y) ** 2 + (D.P[j * 3 + 2] - v.z) ** 2; if (d < bd) { bd = d; best = j; } }
    si.push(...D.SK[best * 2]); sw.push(...D.SK[best * 2 + 1]); }
  g.applyMatrix4(D.Mi); g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); return g;
}
function stripGeo(rows) {   // rows of points (world) -> a quad strip mesh
  const pos = [], idx = [], W = rows[0].length; for (const r of rows) for (const p of r) pos.push(p.x, p.y, p.z);
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < W - 1; j++) { const a = i * W + j, b = a + W; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const uv = []; for (let i = 0; i < rows.length; i++) for (let j = 0; j < W; j++) uv.push(j * .02, i * .02); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g;
}
function accessories(D, g, shell, L) {   // -> [[name, geo (bind world), fabric, colour]]
  const out = [], frontZ = (x, y) => { let z = -1; for (let i = 0; i < D.W; i++) if (Math.abs(D.O[i * 3] - x) < .02 && Math.abs(D.O[i * 3 + 1] - y) < .02 && D.O[i * 3] * x >= 0) z = Math.max(z, D.P[i * 3 + 2]); return z; };
  if (g.collar && shell) {   // a turned-down collar on the neckline, open at the front
    const ring = shell.userData.bnd.map(([id]) => id).filter(id => D.O[id * 3 + 1] > L.neckY - .05 && Math.abs(D.O[id * 3]) < .11);
    if (ring.length > 6) { let cz = 0; for (const id of ring) cz += D.P[id * 3 + 2]; cz /= ring.length;
      const ang = id => Math.atan2(D.P[id * 3], D.P[id * 3 + 2] - cz), pts = ring.map(id => ({ id, a: ang(id) })).filter(p => Math.abs(p.a) > .32).sort((p, q) => (p.a < 0 ? p.a + 7 : p.a) - (q.a < 0 ? q.a + 7 : q.a));
      // v2.3: the neckline points smoothed along the ring (the raw boundary vertices zig-zag in height: a jagged collar)
      const raw = pts.map(({ id }) => V3(D.P[id * 3], D.P[id * 3 + 1], D.P[id * 3 + 2])), sm = raw.map((p, i) => { const w = raw.slice(Math.max(0, i - 3), i + 4); return w.reduce((s, v) => s.add(v), V3()).multiplyScalar(1 / w.length); });
      const r0 = [], r1 = [], r2 = []; for (const [i, { a }] of pts.entries()) { const b = sm[i], rd = V3(Math.sin(a), 0, Math.cos(a)), fr = Math.max(0, Math.cos(a));
        r0.push(b.clone().addScaledVector(rd, g.off + .001)); r1.push(b.clone().addScaledVector(rd, g.off + .007).add(V3(0, .03 - .008 * fr, 0))); r2.push(b.clone().addScaledVector(rd, g.off + .03 + .012 * fr).add(V3(0, -.008 - .03 * fr, 0))); }
      out.push(['collar', stripGeo([r0, r1, r2]), g.fabric, g.color]); } }
  if (g.buttons) { const z0 = L.hipY + .08, z1 = L.neckY - .05, sp = shell?.attributes.position, w = V3();
    // v2.3: on the cloth's OWN front (the drape smoothing moves it out past body + off), so the buttons sit proud, never sunk
    const clothZ = y => { let z = -1; if (sp) for (let i = 0; i < sp.count; i++) { w.fromBufferAttribute(sp, i).applyMatrix4(D.M); if (Math.abs(w.x) < .012 && Math.abs(w.y - y) < .012) z = Math.max(z, w.z); } return z; };
    for (let k = 0; k < 5; k++) { const y = z0 + (z1 - z0) * k / 4, zc = clothZ(y), z = zc > -1 ? zc + .0022 : frontZ(0.001, y) + g.off + .003; if (z < 0) continue; const b = new THREE.CylinderGeometry(.0058, .0052, .0035, 12).rotateX(Math.PI / 2).translate(0, y, z); out.push(['button', b, 'plastic', '#2a2622']); } }
  if (g.hood === 'down') { const zc = frontZ(0, L.neckY - .02), pts = []; const back = (() => { let z = 1; for (let i = 0; i < D.W; i++) if (Math.abs(D.O[i * 3]) < .03 && Math.abs(D.O[i * 3 + 1] - (L.neckY - .03)) < .02) z = Math.min(z, D.P[i * 3 + 2]); return z; })();
    const t = new THREE.TorusGeometry(.105, .03, 10, 20, Math.PI * 1.25).rotateX(Math.PI / 2).rotateY(-Math.PI * .125 + Math.PI).scale(1, .6, .75).translate(0, L.neckY - .035, back + .07 + 0 * zc); out.push(['hood', t, g.fabric, g.color]); }
  if (g.brim) { const z = frontZ(0, D.top - .08); const b = new THREE.CylinderGeometry(.09, .09, .006, 24, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, .75).rotateX(.12).translate(0, D.top - .082, z - .01); out.push(['brim', b, g.fabric, g.color]); }
  return out;
}
const SHELLS = new Map();
function dressHuman(m, src, D, spec, L, female) {
  const list = wardrobe(spec, L, D), made = [], bones = m.skeleton.bones;
  for (const g of list) {
    const k = `${src.uuid}|${spec.outfit}|${g.name}`; let geo = SHELLS.get(k);
    if (!geo) { geo = { shell: shellGeo(D, src, g, L) }; geo.skirt = g.skirt ? skirtGeo(D, g.skirt, bones, L) : null; geo.acc = accessories(D, g, geo.shell, L).map(([n, a, f, c]) => [n, accGeo(D, a), f, c]); SHELLS.set(k, geo); }
    const mat = fabricMat(g.fabric, g.color), add = (gg, mt, name) => { const s = new THREE.SkinnedMesh(gg, mt); s.name = `${spec.name} ${name}`; s.bindMode = m.bindMode; s.bind(m.skeleton, m.bindMatrix); s.castShadow = s.receiveShadow = true; s.frustumCulled = false; s.userData.garment = g.name; m.parent.add(s); made.push(s); return s; };
    { const sh = add(geo.shell, mat, g.name); sh.userData.covers = geo.shell.userData.covers; sh.userData.off = g.off; } if (geo.skirt) { const sk = add(geo.skirt.clone(), mat, g.name + ' skirt'); sk.userData.skirt = true; sk.userData.clothUpdate = clothSkirt(sk, m, D, bones, g.skirt.off); }
    for (const [n, a, f, c] of geo.acc) add(a, fabricMat(f, c), n).userData.acc = true;
  }
  if (OUTFITS[spec.outfit].wear.some(w => w[0] === 'shirt' && w[1].tie)) {   // the tie: knot under the collar, blade down the shirt front
    const k = `${src.uuid}|tie`; let tg = SHELLS.get(k); if (!tg) { const fz = y => { let z = -1; for (let i = 0; i < D.W; i++) if (Math.abs(D.O[i * 3]) < .015 && Math.abs(D.O[i * 3 + 1] - y) < .015) z = Math.max(z, D.P[i * 3 + 2]); return z; };
      const rows = [], ys = [L.neckY + .005, L.neckY - .03, L.neckY - .1, L.hipY + .22, L.hipY + .13, L.hipY + .1]; for (const [i, y] of ys.entries()) { const w = [.018, .022, .03, .042, .044, .002][i], z = fz(y) + .009 + (i === 0 ? .006 : 0); rows.push([V3(-w, y, z), V3(0, y, z + .004), V3(w, y, z)]); }
      tg = accGeo(D, stripGeo(rows)); SHELLS.set(k, tg); }
    const s = new THREE.SkinnedMesh(tg, fabricMat('silk', regionColor(spec, 'accent'))); s.bindMode = m.bindMode; s.bind(m.skeleton, m.bindMatrix); s.castShadow = true; s.frustumCulled = false; s.userData.acc = true; s.name = spec.name + ' tie'; m.parent.add(s); made.push(s); }
  return made;
}
// the body under the clothes: each triangle the colour of the outermost garment that covers it (skin elsewhere)
function paintHuman(D, src, list, skin) {
  const ids = D.ids, T = ids.length / 3, cols = new Float32Array(ids.length * 3), sk = new THREE.Color(skin), cc = new THREE.Color();
  const covers = list.map(g => ({ c: new THREE.Color(g.color).multiplyScalar(.8), set: g.geo.userData.covers, off: g.off })).sort((a, b) => b.off - a.off);
  for (let t = 0; t < T; t++) { let col = sk; for (const g of covers) if (g.set.has(ids[t * 3]) && g.set.has(ids[t * 3 + 1]) && g.set.has(ids[t * 3 + 2])) { col = g.c; break; }
    for (let k = 0; k < 3; k++) cols.set([col.r, col.g, col.b], (t * 3 + k) * 3); }
  return cols;
}
// ---------------------------------------------------------------------------------------------------------------------
// HANDS THAT TOUCH: analytic two-bone IK on the mocap skeleton (upperarm -> lowerarm -> hand), run after the clip each
// frame and blended by a weight, the palm turned to face the object, fingers curled round its edge; relaxed idle hands.
// ---------------------------------------------------------------------------------------------------------------------
const NO_RELAX = /Point|Aim|Pistol|Lockpick|Punch|Throw|Fold/i;   // clips whose finger poses mean something (others get relaxed hands)
const FINGERS = ['index', 'middle', 'ring', 'pinky'], _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _va = V3(), _vb = V3();
function worldRotate(b, q) { b.getWorldQuaternion(_qa); _qa.premultiply(q); b.parent.getWorldQuaternion(_qb); b.quaternion.copy(_qb.invert().multiply(_qa)); b.updateMatrixWorld(true); }
// verts: [[mesh, vertex index, dominant bone name], ...] of the DRAWN body (the hands' contact points come from these)
function humanHands(root, verts, scale) {
  const B = n => root.getObjectByName(n), sides = {};
  for (const s of ['l', 'r']) {
    const hand = B('hand_' + s), up = B('upperarm_' + s), lo = B('lowerarm_' + s), fing = FINGERS.map(f => [1, 2, 3].map(k => B(`${f}_0${k}_${s}`))), thumb = [1, 2, 3].map(k => B(`thumb_0${k}_${s}`));
    root.updateMatrixWorld(true); const hw = hand.getWorldPosition(V3()), mid = fing[1][0].getWorldPosition(V3()), ix = fing[0][0].getWorldPosition(V3()), pk = fing[3][0].getWorldPosition(V3());
    const F = mid.clone().sub(hw).normalize(), side = ix.clone().sub(pk).normalize(); let N = V3().crossVectors(F, side).normalize(); if (N.y > 0) N.negate();   // T-pose: palms face down
    const hq = hand.getWorldQuaternion(new THREE.Quaternion()).invert();
    const all = [up, lo, hand, ...fing.flat(), ...thumb].filter(Boolean), rest = new Map(all.map(b => [b, b.quaternion.clone()]));
    const mine = verts.filter(([, , nm]) => nm.endsWith('_' + s) && /^(hand|index|middle|ring|pinky|thumb)/.test(nm)), hv = mine.map(e => [e[0], e[1]]), hp = mine.filter(e => /^hand_/.test(e[2])).map(e => [e[0], e[1]]);
    sides[s] = { hand, up, lo, fing, thumb, all, rest, Floc: F.clone().applyQuaternion(hq), Nloc: N.clone().applyQuaternion(hq), hv, hp: hp.length ? hp : hv, palm: .055 * scale };
  }
  return sides;
}
function curlFingers(H, amt, thumbAmt = amt * .5) {   // amt 0..1: 0 = the joints as they are, 1 = a loose fist
  const hq = H.hand.getWorldQuaternion(new THREE.Quaternion()), F = H.Floc.clone().applyQuaternion(hq), N = H.Nloc.clone().applyQuaternion(hq), ax = V3().crossVectors(F, N).normalize();
  const J = [.55, .95, .7]; for (const ch of H.fing) ch.forEach((b, k) => { if (b) { worldRotate(b, _qb.setFromAxisAngle(ax, J[k] * amt * 1.25)); } });
  H.thumb.forEach((b, k) => { if (b) worldRotate(b, _qb.setFromAxisAngle(ax, [.15, .4, .45][k] * thumbAmt * 1.25)); });
}
function relaxHand(H, k = 1) {   // open, softly curled fingers instead of the clips' fists
  const keep = [...H.fing.flat(), ...H.thumb].filter(Boolean).map(b => [b, b.quaternion.clone()]);
  for (const [b, q] of keep) b.quaternion.copy(H.rest.get(b)); H.hand.updateMatrixWorld(true); curlFingers(H, .28, .2);
  if (k < 1) for (const [b, q] of keep) b.quaternion.slerp(q, 1 - k).normalize(); H.hand.updateMatrixWorld(true);
}
// two-bone IK: the wrist to `T` (world), elbow toward `pole`, the hand's fingers along F, its palm facing N
function solveArm(H, T, F, N, pole) {
  const S = H.up.getWorldPosition(V3()), E = H.lo.getWorldPosition(V3()), W = H.hand.getWorldPosition(V3());
  const a = S.distanceTo(E), b = E.distanceTo(W), D = T.clone().sub(S), d = clamp(D.length(), Math.abs(a - b) + 1e-4, (a + b) * .9995), dir = D.normalize();
  const pv = (pole ? pole.clone().sub(S) : E.clone().sub(S)); pv.addScaledVector(dir, -pv.dot(dir)); if (pv.lengthSq() < 1e-8) pv.set(0, -1, 0); pv.normalize();
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA), E2 = S.clone().addScaledVector(dir, cosA * a).addScaledVector(pv, sinA * a);
  worldRotate(H.up, _qa.setFromUnitVectors(E.clone().sub(S).normalize(), E2.clone().sub(S).normalize()).clone());
  const E3 = H.lo.getWorldPosition(V3()), W3 = H.hand.getWorldPosition(V3()), Tc = S.clone().addScaledVector(dir, d);
  worldRotate(H.lo, _qa.setFromUnitVectors(W3.sub(E3).normalize(), Tc.sub(E3).normalize()).clone());
  if (F && N) { const hq = H.hand.getWorldQuaternion(new THREE.Quaternion()), f0 = H.Floc.clone().applyQuaternion(hq), q1 = new THREE.Quaternion().setFromUnitVectors(f0, F);
    const n1 = H.Nloc.clone().applyQuaternion(hq).applyQuaternion(q1), Np = N.clone().addScaledVector(F, -N.dot(F)).normalize(), n1p = n1.addScaledVector(F, -n1.dot(F)).normalize();
    const q2 = new THREE.Quaternion().setFromUnitVectors(n1p, Np); worldRotate(H.hand, q2.multiply(q1)); }
}
// ---------------------------------------------------------------------------------------------------------------------
// NO CLIPPING (v17, animqa): each bone's DRAWN mesh as a stack of star-shaped slices in that bone's bind space (2 cm
// slices, 24 sectors, the farthest vertex per sector). After a clip poses the body, any hand / forearm / upper arm that
// sank into the torso, head, legs or the other arm is moved out: the upper arm turns about the shoulder, a hand or forearm
// is carried by a two-bone arm IK (elbow in its bend plane, the hand keeps its world rotation), 3 passes at most. The clips
// were made on a slimmer body (the UAL mannequin): hands at the sides went 1-3 cm into the thighs, hands on the knees 5 cm,
// folded arms 7 cm into the chest, hands on the head 13 cm into it. A pure function of the pose: deterministic, and
// continuous in time (the push is the depth). f.unclip = false (or figure option unclip: false) turns it off.
// Measured by experiments/recon-style/src/stories/animqa (references/animations.md, "Failures and fixes").
// ---------------------------------------------------------------------------------------------------------------------
const BVOL = new Map(), VNS = 24, VOL_TORSO = ['pelvis', 'spine_01', 'spine_02', 'spine_03'];
function volBuild(P, k) {
  const c = V3(); for (const p of P) c.add(p); c.divideScalar(P.length);
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0; for (const p of P) { const x = p.x - c.x, y = p.y - c.y, z = p.z - c.z; xx += x * x; xy += x * y; xz += x * z; yy += y * y; yz += y * z; zz += z * z; }
  let a = V3(.31, .87, .38).normalize(); for (let i = 0; i < 80; i++) a = V3(xx * a.x + xy * a.y + xz * a.z, xy * a.x + yy * a.y + yz * a.z, xz * a.x + yz * a.y + zz * a.z).normalize();
  const u = Math.abs(a.y) < .9 ? V3().crossVectors(a, V3(0, 1, 0)).normalize() : V3().crossVectors(a, V3(1, 0, 0)).normalize(), w = V3().crossVectors(a, u);
  let smin = Infinity, smax = -Infinity, rad = 0; const S = P.map(p => { const d = p.clone().sub(c), s = d.dot(a); smin = Math.min(smin, s); smax = Math.max(smax, s); rad = Math.max(rad, d.length()); return [s, d.dot(u), d.dot(w)]; });
  const nb = Math.max(3, Math.min(40, Math.round((smax - smin) * k / .02))), bl = (smax - smin) / nb, bins = Array.from({ length: nb }, () => ({ n: 0, cu: 0, cw: 0, R: new Float32Array(VNS).fill(-1), p: [] }));
  for (const [s, pu, pw] of S) { const b = bins[Math.min(nb - 1, Math.floor((s - smin) / bl))]; b.n++; b.cu += pu; b.cw += pw; b.p.push(pu, pw); }
  for (const b of bins) { if (b.n < 6) { b.n = 0; b.p = null; continue; } b.cu /= b.n; b.cw /= b.n;
    for (let i = 0; i < b.p.length; i += 2) { const x = b.p[i] - b.cu, y = b.p[i + 1] - b.cw, r = Math.hypot(x, y), sec = Math.floor(((Math.atan2(y, x) + Math.PI) / (2 * Math.PI)) * VNS) % VNS; if (r > b.R[sec]) b.R[sec] = r; }
    const R0 = Array.from(b.R); for (let i = 0; i < VNS; i++) if (R0[i] < 0) { let l = -1, r = -1; for (let d = 1; d < VNS && (l < 0 || r < 0); d++) { if (l < 0 && R0[(i - d + VNS) % VNS] >= 0) l = R0[(i - d + VNS) % VNS]; if (r < 0 && R0[(i + d) % VNS] >= 0) r = R0[(i + d) % VNS]; } b.R[i] = Math.min(Math.max(l, 0), Math.max(r, 0)); }
    b.p = null; }
  return { c, a, u, w, smin, smax, bl, nb, bins, rad };
}
// depth (bone units) of a bone-space point inside the volume (> 0 inside, else -1); nOut: the way out (bone space, unit)
// infl (bone units): the volume grown by that much (f.unclipZone, experimental and off: a soft onset of the push)
function volDepth(V, p, nOut, radial = false, infl = 0) {   // radial: the way out is always across the limb (a limb end's cap pushed a hand along the thigh)
  const dx = p.x - V.c.x, dy = p.y - V.c.y, dz = p.z - V.c.z, s = dx * V.a.x + dy * V.a.y + dz * V.a.z; if (s <= V.smin - infl || s >= V.smax + infl) return -1;
  // (the slices are a staircase along the axis: a point crossing a 2 cm slice boundary sees its depth step - the cause of the
  // remaining unclip hand pops (Walk_Loop 0.68 s 2.6 cm, G_Point_Forward 3.8 cm). Interpolating the slices (v18 try) removed
  // them but moved the folded-arms / hands-on-head corrections past animqa's baseline (a 10 cm loop-seam pop): kept as is,
  // to be re-baselined together with animqa)
  const b = V.bins[Math.max(0, Math.min(V.nb - 1, Math.floor((s - V.smin) / V.bl)))]; if (!b.n) return -1;
  const x = dx * V.u.x + dy * V.u.y + dz * V.u.z - b.cu, y = dx * V.w.x + dy * V.w.y + dz * V.w.z - b.cw, r = Math.hypot(x, y);
  const f = ((Math.atan2(y, x) + Math.PI) / (2 * Math.PI)) * VNS - .5, i0 = ((Math.floor(f) % VNS) + VNS) % VNS, kf = f - Math.floor(f), R = b.R[i0] * (1 - kf) + b.R[(i0 + 1) % VNS] * kf + infl;
  if (r >= R) return -1; const rd = R - r, ca = s - V.smin + infl, cb = V.smax + infl - s, d = radial ? rd : Math.min(rd, ca, cb);
  if (nOut) { if (d === rd && r > 1e-9) nOut.copy(V.u).multiplyScalar(x / r).addScaledVector(V.w, y / r); else nOut.copy(V.a).multiplyScalar(d === ca ? -1 : 1); }
  return d;
}
// the body's volumes + the arm points that are tested (cached per body: every figure of a body shares its geometry)
function bodyVolumes(key, meshes, k) {
  if (BVOL.has(key)) return BVOL.get(key);
  const m0 = meshes[0], bones = m0.skeleton.bones, BI = new Map(bones.map((b, i) => [b.name, i])), per = new Map(), all = [];
  meshes.forEach((m, mi) => { const g = m.geometry, pa = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, inv = m.skeleton.boneInverses;
    for (let i = 0; i < pa.count; i++) { let b = 0, bw = -1; for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j); if (w > bw) { bw = w; b = si.getComponent(i, j); } } if (bw < .5) continue;
      const bn = m.skeleton.bones[b].name, l = V3().fromBufferAttribute(pa, i).applyMatrix4(m.bindMatrix).applyMatrix4(inv[b]); all.push([mi, i, bn, l]); (per.get(bn) ?? per.set(bn, []).get(bn)).push(l); } });
  const vols = {};
  for (const n of [...VOL_TORSO, 'neck_01', 'Head', ...['l', 'r'].flatMap(s => ['thigh', 'calf', 'upperarm', 'lowerarm', 'hand'].map(b => `${b}_${s}`))]) { const P = per.get(n); if (P && P.length >= 30) vols[n] = volBuild(P, k); }
  const childLocal = (b, c) => V3().setFromMatrixPosition(new THREE.Matrix4().copy(m0.skeleton.boneInverses[BI.get(b)]).multiply(new THREE.Matrix4().copy(m0.skeleton.boneInverses[BI.get(c)]).invert()));
  const pts = { l: [], r: [] }, tg = { l: {}, r: {} };
  for (const s of ['l', 'r']) { const o = s === 'l' ? 'r' : 'l', ua = childLocal(`upperarm_${s}`, `lowerarm_${s}`), fa = childLocal(`lowerarm_${s}`, `hand_${s}`), hre = new RegExp(`^(hand|thumb|index|middle|ring|pinky)(_0\\d)?_${s}$`);
    all.forEach((e, j) => { const [mi, i, bn, l] = e; let kind = null;
      if (hre.test(bn)) kind = j % 3 ? null : 'hand';
      else if (bn === `lowerarm_${s}`) kind = j % 3 || l.dot(fa) / fa.lengthSq() < .12 ? null : 'farm';
      else if (bn === `upperarm_${s}`) kind = j % 3 || l.dot(ua) / ua.lengthSq() < .35 ? null : 'uarm';
      if (kind) pts[s].push([mi, i, kind]); });
    const legs = ['thigh_l', 'thigh_r', 'calf_l', 'calf_r'];
    // arm against arm: only the LEFT arm gives way (both giving way fight each other: clap / folded arms flickered)
    const other = s === 'l' ? [`upperarm_${o}`, `lowerarm_${o}`, `hand_${o}`] : [];
    tg[s] = { hand: [...VOL_TORSO, 'neck_01', 'Head', ...legs, ...other], farm: [...VOL_TORSO, 'neck_01', 'Head', ...legs, ...other.slice(0, 2)], uarm: [...VOL_TORSO, 'Head'] };
    for (const kd in tg[s]) tg[s][kd] = tg[s][kd].filter(n => vols[n]); }
  const r = { vols, pts, tg }; BVOL.set(key, r); return r;
}
function humanFigure(spec, o) {
  // v16: spec.rig 'mq' = the two mannequin bodies (their own skeleton = the clips' skeleton, nothing hidden underneath)
  const MQ = spec.rig === 'mq', female = MQ ? spec.body === 'female' : spec.body === 'f' || spec.body === 'female';
  const g = LIB.MODELS[MQ ? 'fig:mq:' + spec.body : female ? 'fig:h:f' : 'fig:h:m'], root = SKU.clone(g.scene), outer = new THREE.Group(); outer.add(root);
  // bones by name, remembered: posing looks bones up by name dozens of times a frame and each lookup walked the whole
  // skeleton (30 mannequins: ~1 s of every 8 s of preview). The bones never change, so the answer is the same.
  { const find = root.getObjectByName.bind(root), seen = new Map(); root.getObjectByName = n => { let o = seen.get(n); if (!o) { o = find(n); if (o) seen.set(n, o); } return o; }; }
  outer.name = spec.name; outer.userData.noContact = true; outer.userData.kind = 'person'; ENG.selectable?.(outer, spec.name, 'person');
  root.updateMatrixWorld(true);
  const X = n => { const b = root.getObjectByName(n); return b ? Math.abs(new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).x) : 0; }, Y = n => { const b = root.getObjectByName(n); return b ? new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).y : 0; };
  const L = { shoulderX: X('upperarm_l') || .17, elbowX: X('lowerarm_l') || .45, wristX: X('hand_l') || .7, neckY: Y('neck_01') || 1.48, hipY: Y('pelvis') || .95, kneeY: Y('calf_l') || .5, ankleY: Y('foot_l') || .08 };
  if (!MQ) { const fc = faceChar(spec); if (fc && FACE_TEX[fc]?.skin) spec = { ...spec, colors: { ...spec.colors, skin: FACE_TEX[fc].skin } }; }   // the body's skin = the photo face's cheeks (the feather blends)
  const cols = MQ ? [] : humanColors(spec).map(h => new THREE.Color(h)), coat = THEME?.figure ? .25 : 0; let body = null; const featM = [], mqMeshes = [];
  root.traverse(m => {
    if (!m.isMesh) return; m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
    const mn = String(m.material?.name || '');
    if (MQ) { if (!m.isSkinnedMesh) { m.visible = false; return; } const jt = /joint/i.test(mn); m.material = finishMat(spec.finish, spec.color, jt, spec.joints); m.name = `${spec.name} ${jt ? 'joints' : 'body'}`; m.userData.joints = jt; mqMeshes.push(m); return; }
    if (/Eye/i.test(mn)) { m.material = new THREE.MeshPhysicalMaterial({ color: 0x1a1c1f, roughness: .2, clearcoat: 1 }); featM.push(m); return; }
    if (/Hair/i.test(mn)) { featM.push(m); m.material = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(spec.colors.hair ?? (spec.outfit === 'swat' ? '#141517' : '#2a221c')), roughness: .7, sheen: .6, sheenRoughness: .6 });
      if (OUTFITS[spec.outfit].wear.some(w => w[0] === 'balaclava' || (w[0] === 'hoodie' && w[1].hood === 'up'))) m.visible = false; return; }
    if (!m.isSkinnedMesh) return;
    const src = humanGeometry(m, female, L), geo = src.clone(), reg = src.userData.reg, n = geo.attributes.position.count; let cc = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const c = cols[reg[i]]; cc[i * 3] = c.r; cc[i * 3 + 1] = c.g; cc[i * 3 + 2] = c.b; }
    if (!body || n > body.n) body = { m, src, geo, n };
    geo.setAttribute('color', new THREE.BufferAttribute(cc, 3)); m.geometry = geo;
    m.material = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .62, sheen: .25, sheenRoughness: .6, sheenColor: new THREE.Color(0xd8b8a8), clearcoat: coat, clearcoatRoughness: .5 });
  });
  // real clothes: garment shells on the body's skeleton (o.paintedClothes: the old painted-on look)
  let clothes = [], D = null;
  if (body && !o.paintedClothes && !MQ) { D = bodyData(body.m, body.src, L); clothes = dressHuman(body.m, body.src, D, spec, L, female);
    const list = clothes.filter(s => s.userData.covers).map(s => ({ color: '#' + s.material.color.getHexString(), geo: { userData: { covers: s.userData.covers } }, off: s.userData.off }));
    body.geo.setAttribute('color', new THREE.BufferAttribute(paintHuman(D, body.src, list, spec.colors.skin ?? '#c99a7c'), 3)); }
  // hair from the library (none under a hood, a balaclava or a helmet)
  const covered = OUTFITS[spec.outfit].wear.some(w => /balaclava|helmet|cap/.test(w[0]) || (w[0] === 'hoodie' && w[1].hood === 'up'));
  if (!covered && ATTACH && !MQ) { const hg = LIB.MODELS[female ? 'fig:hair:f' : 'fig:hair:m']; if (hg) { const hs = SKU.clone(hg.scene); for (const m of ATTACH(THREE, root, hs)) { m.material = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(spec.colors.hair ?? (female ? '#3b2a1f' : '#1f1a16')), roughness: .75, sheen: .7, sheenRoughness: .55 }); m.castShadow = true; m.frustumCulled = false; } } }
  // (the mannequin's drawn height at rest, per body: measured over every skinned vertex, the same for each figure of it)
  const hKey = MQ ? 'mq:' + spec.body : null, h0 = (hKey && H0_ALL.get(hKey)) ?? (() => { const b = new THREE.Box3().setFromObject(root, true), h = b.max.y - b.min.y; if (hKey) H0_ALL.set(hKey, h); return h; })();
  const scale = (spec.height ?? (female ? 1.68 : 1.8)) / h0; root.scale.setScalar(scale);
  // the user's own character (body 'custom:<id>', lib/customchar.js): its meshes ride this skeleton, the mannequin's are
  // hidden (layer 31); it keeps its own materials unless a finish was chosen. Hands, capsules and box() measure it.
  let custom = null;
  if (MQ && spec.custom) { try { custom = CC.customBody(spec.custom, outer, { name: spec.name, mat: spec.finishSet ? j => finishMat(spec.finish, spec.color, j, spec.joints) : null }); }
    catch (e) { console.warn(`figure ${spec.role}: your character "${spec.custom}" could not be put on the body (${e.message}): the male body instead`); custom = null; } }
  const mixer = new THREE.AnimationMixer(root), acts = {}, act = name => { if (acts[name]) return acts[name];
    // a clip of the packs by its own name, else any catalog name of lib/anims.js (built-in tags, the user's Mixamo imports)
    // a clip the QA marked broken (builtin.json quality, references/animations.md) plays only with f.allowBroken: else the
    // idle stands in, with a warning (never a weird pose in a video)
    const ent = ANIM.animInfo(name); if (ANIM.qualityOf?.(ent, custom ? 'male' : spec.body) === 'broken' && !f.allowBroken && name !== 'Idle_Loop') { const k = 'broken|' + name; if (!warned2.has(k)) { warned2.add(k); console.warn(`${spec.name}: clip "${name}" is marked broken (${ent.notes || 'see references/animations.md'}): Idle_Loop plays instead (figure option allowBroken: true to force it)`); } return (acts[name] = act('Idle_Loop')); }
    // (built-in clips: ANIM.cleanClip cuts a snapping last key and closes a loop's seam; the catalog says which clips loop)
    const loopC = /_Loop$/.test(name) || !!ANIM.animInfo(name)?.loop;
    const clip = CLIPS[name] ? LIB_PREP(ANIM.cleanClip(CLIPS[name], loopC), root) : ANIM.animClip(name, root, { allowBroken: true }); if (!clip) return null;
    const a = mixer.clipAction(clip); a.play(); a.weight = 0; return (acts[name] = { a, d: clip.duration, loop: !!(clip.userData?.loop ?? loopC), clip }); };
  let pend = [], lastPend = null, warned = false; const warned2 = new Set(); const holds = [], onApply = [];
  // the drawn body's vertices with their dominant bone: hand contact (IK calibration, palm()) and the collision capsules
  // are measured on what the camera sees (v16: the mannequin itself, no hidden body underneath)
  const domBone = (m, i) => { const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight; let b = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; b = si.getComponent(i, k); } } return m.skeleton.bones[b]?.name || ''; };
  // (each vertex's dominant bone, worked out once per body geometry - every figure of a body shares it - not per figure)
  const drawnOf = ms => ms.flatMap(m => { let nm = DOM_NAMES.get(m.geometry);
    if (!nm) { nm = Array.from({ length: m.geometry.attributes.position.count }, (_, i) => domBone(m, i)); DOM_NAMES.set(m.geometry, nm); }
    return nm.map((n, i) => [m, i, n]); });
  let drawn = MQ ? drawnOf(custom ? custom.meshes : mqMeshes)
    : body && D ? Array.from({ length: D.W }, (_, i) => [body.m, D.corner[i], body.m.skeleton.bones[D.dom[i]]?.name || '']) : [];
  let VM = MQ ? (custom ? custom.meshes : mqMeshes) : null;
  if (custom && !['l', 'r'].every(s => drawn.some(e => e[2] === 'hand_' + s))) { console.warn(`figure ${spec.role}: your character "${spec.custom}" has no hand vertices: hands measured on the mannequin`); drawn = drawnOf(mqMeshes); VM = mqMeshes; }
  const HANDS = drawn.length ? humanHands(root, drawn, root.scale.x) : null, SC = root.scale.x;
  const skinned = (e, v) => { const [m, i] = typeof e === 'number' ? [body.m, e] : e; v.fromBufferAttribute(m.geometry.attributes.position, i); m.applyBoneTransform(i, v); return v.applyMatrix4(m.matrixWorld); };
  // each palm's surface point in its hand bone's space (the drawn hand at rest: hold() lays objects on it)
  // v17: the palm is the palm-side hand vertices between 35 % and 80 % of the wrist-to-knuckle length (H.pp): the wrist ball
  // no longer pulls the centre 37 mm toward the wrist (f.palm, hold, handTo and the phone all use it)
  const restKey = custom ? `custom:${spec.custom}@${CC.customCharInfo?.(spec.custom)?.rev ?? 0}` : spec.body, palm0 = HANDS && VM && PALM_ALL.get(restKey);
  if (palm0) for (const s in HANDS) { HANDS[s].pp = palm0[s].pp.map(([mi, i]) => [VM[mi], i]); HANDS[s].palmLocal = palm0[s].local.clone(); }
  else if (HANDS) { root.updateMatrixWorld(true); for (const s in HANDS) { const H = HANDS[s], v = V3(), c = V3(), Nw = H.Nloc.clone().applyQuaternion(H.hand.getWorldQuaternion(new THREE.Quaternion())); let top = -Infinity;
    { const W = H.hand.getWorldPosition(V3()), K = H.fing[1][0].getWorldPosition(V3()).sub(W), L2 = K.lengthSq(), mid = H.hp.filter(e => { const u = skinned(e, v).sub(W).dot(K) / L2; return u >= .35 && u <= .8; });
      if (mid.length >= 8) { const c0 = V3(); for (const e of mid) c0.add(skinned(e, v)); c0.divideScalar(mid.length); const pal = mid.filter(e => skinned(e, v).sub(c0).dot(Nw) > 0); H.pp = pal.length >= 4 ? pal : mid; } else H.pp = H.hp; }
    for (const e of H.pp) c.add(skinned(e, v)); c.divideScalar(H.pp.length); for (const e of H.pp) top = Math.max(top, skinned(e, v).sub(c).dot(Nw));
    H.palmLocal = H.hand.worldToLocal(c.clone().addScaledVector(Nw, top)); }
    if (VM && Object.values(HANDS).every(H => H.pp.every(([m]) => VM.includes(m))))
      PALM_ALL.set(restKey, Object.fromEntries(Object.entries(HANDS).map(([s, H]) => [s, { pp: H.pp.map(([m, i]) => [VM.indexOf(m), i]), local: H.palmLocal.clone() }]))); }
  // glow: the outline hull rides the same skeleton (back faces pushed out along the normals)
  if (MQ && !custom && spec.finish === 'glow') for (const m of mqMeshes.filter(x => !x.userData.joints)) { const h = new THREE.SkinnedMesh(m.geometry, glowHull(spec.color)); h.name = `${spec.name} outline`; h.castShadow = false; h.frustumCulled = false;
    h.userData.noPick = h.userData.noContact = true; h.bind(m.skeleton, m.bindMatrix); m.parent.add(h); }
  // collision capsules measured on the drawn body at rest: per segment a percentile of its vertices' distances
  const CAPSEG = [['pelvis', 'neck_01', /^(pelvis|spine_0\d)$/], ['Head', 'Head+', /^(Head|neck_01)$/], ...['l', 'r'].flatMap(s => [[`upperarm_${s}`, `lowerarm_${s}`, new RegExp(`^upperarm_${s}$`)], [`lowerarm_${s}`, `hand_${s}`, new RegExp(`^lowerarm_${s}$`)],
    [`hand_${s}`, `middle_03_${s}`, new RegExp(`^(hand|index|middle|ring|pinky|thumb)\\w*_${s}$`)], [`thigh_${s}`, `calf_${s}`, new RegExp(`^thigh_${s}$`)], [`calf_${s}`, `foot_${s}`, new RegExp(`^calf_${s}$`)], [`foot_${s}`, `ball_${s}`, new RegExp(`^(foot|ball)\\w*_${s}$`)]])];
  const capEnd = n => { const w = q => root.getObjectByName(q).getWorldPosition(V3()); if (n !== 'Head+') return w(n); const h = w('Head'); return h.add(h.clone().sub(w('neck_01')).normalize().multiplyScalar(.13 * SC * 1.8 / 1.8)); };
  const CAPR = (() => { if (!MQ) return null; if (CAPR_ALL.has(restKey)) return CAPR_ALL.get(restKey).slice(); root.updateMatrixWorld(true); const v = V3(), seg = CAPSEG.map(([a, b]) => ({ a: capEnd(a), b: capEnd(b), d: [] })); let soleY = Infinity;
    for (let k = 0; k < drawn.length; k += 3) { const [m, i, nm] = drawn[k]; const j = CAPSEG.findIndex(c => c[2].test(nm)); if (j < 0) continue; skinned([m, i], v); if (/^(foot|ball)/.test(nm)) soleY = Math.min(soleY, v.y); const s = seg[j], ab = s.b.clone().sub(s.a), u0 = v.clone().sub(s.a).dot(ab) / ab.lengthSq(), u = clamp(u0); if (j > 1 && !/hand|foot/.test(CAPSEG[j][0]) && (u0 < .2 || u0 > .9)) continue;   // (a limb's girth away from its joints: buttocks / knee caps are the next capsule's)
      s.d.push(v.distanceTo(s.a.clone().addScaledVector(ab, u))); }
    // (the torso is wide and shallow: its round capsule takes the median, the limbs the 85th percentile)
    // the foot capsules (ankle -> ball) stay inside the drawn foot: never below the flat sole at rest (a standing person must
    // not overlap the floor), the radius at most the lower end's height above the sole less 2 mm
    return seg.map((s, j) => { s.d.sort((x, y) => x - y); let r = s.d[Math.floor(s.d.length * (j === 0 ? .5 : .85))] ?? .04;
      if (/^foot_/.test(CAPSEG[j][0]) && Number.isFinite(soleY)) r = Math.max(.01 * SC, Math.min(r, Math.min(s.a.y, s.b.y) - soleY - .002 * SC));
      return r / SC; }); })();
  if (CAPR && !CAPR_ALL.has(restKey)) CAPR_ALL.set(restKey, CAPR.slice());
  // GROUNDING: the drawn feet (every 2nd foot / toe vertex) decide how high the root rides: the lowest drawn sole sits on
  // y = 0. A looping clip (stand, talk, walk, run ...) is measured at 32 times over its cycle and followed in time (walk: the
  // planted foot stays on the floor every frame); a one-shot clip takes its lowest sole over the whole clip (a fall or a jump
  // never pulls the body into the floor). Seated clips keep their seat calibration (0). Cached per body (male / female /
  // custom id) and clip in the body's own units: deterministic.
  const FEET = MQ ? drawn.filter((e, k) => !(k & 1) && /^(foot|ball)/.test(e[2])).map(e => [e[0], e[1]]) : [];
  const BODYPTS = MQ ? drawn.filter((e, k) => !(k % 5)).map(e => [e[0], e[1]]) : [];
  const FEET_S = { l: MQ ? drawn.filter((e, k) => !(k & 1) && /^(foot|ball)\w*_l$/.test(e[2])).map(e => [e[0], e[1]]) : [], r: MQ ? drawn.filter((e, k) => !(k & 1) && /^(foot|ball)\w*_r$/.test(e[2])).map(e => [e[0], e[1]]) : [] };
  const THIGHS = MQ ? drawn.filter((e, k) => !(k % 3) && /^thigh_[lr]$/.test(e[2])).map(e => [e[0], e[1]]) : [];
  const CALF_S = { l: MQ ? drawn.filter((e, k) => !(k % 3) && e[2] === 'calf_l').map(e => [e[0], e[1]]) : [], r: MQ ? drawn.filter((e, k) => !(k % 3) && e[2] === 'calf_r').map(e => [e[0], e[1]]) : [] };
  const BACKPTS = MQ ? drawn.filter((e, k) => !(k % 3) && /^spine_0[23]$/.test(e[2])).map(e => [e[0], e[1]]) : [];
  const ARMPTS = MQ ? drawn.filter((e, k) => !(k % 3) && /^(upperarm|lowerarm)_[lr]$/.test(e[2])).map(e => [e[0], e[1]]) : [];
  // (a custom body's key carries its load number: a re-imported character with the same id is measured again)
  const bKey = custom ? `custom:${spec.custom}@${CC.customCharInfo?.(spec.custom)?.rev ?? 0}` : spec.body, gKey = cn => `${bKey}|${cn}`;
  // v17 (animqa): four ways a clip meets the floor, by what it does (GROUND_MODE):
  //  feet  standing / walking / gestures: the lowest drawn sole on y = 0 at every time (loops 32 samples, one-shots ~24 / s:
  //        a one-shot no longer floats where its feet are higher than at its lowest moment)
  //  body  lying, floor sitting, falls, crawls, push-ups, rolls, slides: the lowest drawn point of the WHOLE body on y = 0
  //        at every time (the KayKit lie / floor-sit clips sank 17 cm into the floor or floated 40 cm above it)
  //  seat  chair sitting, typing, driving: the soles on the floor like 'feet' (the KayKit chair clips kept the pelvis at
  //        standing height and floated 0.5 m); T.seatH = the thigh underside at the clip's most seated moment (act's
  //        { seat } and sitOn put THAT on the seat; legs() then sets the resting feet on the floor)
  //  air   jumps, climbs: the lowest sole over the whole clip (the body leaves the floor, never goes into it)
  const gTable = A => { const cn = A.a.getClip().name, key = gKey(cn); if (GROUND.has(key)) return GROUND.get(key);
    const loop = /_Loop$/.test(cn) || !!A.loop, mode = groundMode(cn), N = loop ? 32 : Math.max(12, Math.min(120, Math.round(A.d * 24) + 1)), vals = new Float32Array(N);
    const pts = mode === 'body' ? BODYPTS : FEET; let seatH = Infinity;
    if (pts.length) {
      outer.updateWorldMatrix(true, true);   // (consistent world matrices for the whole sampling: see pTable)
      const y0 = root.position.y, v = V3(); root.position.y = 0;
      for (const k in acts) acts[k].a.weight = 0; A.a.weight = 1;
      for (let i = 0; i < N; i++) { A.a.time = loop ? A.d * i / N : Math.min(A.d - 1e-3, A.d * i / (N - 1)); mixer.update(0); let lo = Infinity;
        for (const pm of mixer._bindings) pm.binding.setValue(pm.buffer, mixer._accuIndex * pm.valueSize + pm.valueSize);
        root.updateMatrixWorld(true); const inv = outer.matrixWorld.clone().invert();
        for (const e of pts) lo = Math.min(lo, skinned(e, v).applyMatrix4(inv).y);
        vals[i] = Number.isFinite(lo) ? Math.max(-1, Math.min(1, -lo / SC)) : 0;
        if (mode === 'seat') { let th = Infinity; for (const e of THIGHS) th = Math.min(th, skinned(e, v).applyMatrix4(inv).y); seatH = Math.min(seatH, th / SC + vals[i]); } }
      A.a.weight = 0; root.position.y = y0;
      if (mode === 'air') vals.fill(Math.max(...vals));
    }
    const T = { loop, vals, mode, seatH: Number.isFinite(seatH) ? seatH : null }; GROUND.set(key, T); return T; };
  const groundOf = (A, t) => { const T = gTable(A), N = T.vals.length, d = A.d || 1;
    const u = T.loop ? ((((t % d) + d) % d) / d) * N : Math.max(0, Math.min(N - 1, t / d * (N - 1))), i = Math.floor(u) % N, k = u - Math.floor(u);
    const j = T.loop ? (i + 1) % N : Math.min(N - 1, i + 1); return (T.vals[i] * (1 - k) + T.vals[j] * k) * SC; };
  // FEET THAT STAY PUT (v17, animqa): the source clips (KayKit above all) let planted feet slide 10-160 cm (KK_PickUp 32 cm
  // on the clip's own skeleton). Per body and clip (cached, deterministic): where each foot touches the floor (lowest sole
  // < 2.5 cm, after grounding) and where its ankle is when that contact starts; while the contact lasts the ankle is held
  // there (leg IK, the foot keeps its world rotation), easing in / out over 0.1 s at the contact's ends. Standing and seated
  // clips only, never locomotion (a contact patch moving > 0.25 m/s: walkAt moves the figure instead) or floor / air clips.
  // (the cache is shared by every figure of the same body and height: it was made per figure, so each person of every
  // shot sampled its clips again with CPU skinning - a third of the time a shot with people took to build)
  const pk = `|${SC.toFixed(5)}`, PLANT = { has: k => PLANT_ALL.has(k + pk), get: k => PLANT_ALL.get(k + pk), set: (k, v) => PLANT_ALL.set(k + pk, v), delete: k => PLANT_ALL.delete(k + pk) };
  const pTable = A => { const cn = A.a.getClip().name, key = gKey(cn) + '|plant'; if (PLANT.has(key)) return PLANT.get(key);
    const G = gTable(A); let res = { mode: G.mode, lock: null };
    if (FEET.length && (G.mode === 'feet' || G.mode === 'seat')) {
      // (the figure's world matrix first: sitOn / place move it without updating it, and the ankle's getWorldPosition below
      // refreshes it mid-sampling - the first sample then sat 1 m off the others (the move), the planted feet read as a 1 m
      // slide and the seated soles were never set on the floor: male 8-26 mm in it, female 40-56 mm above it, depending on
      // where the figure stood when the clip first played)
      outer.updateWorldMatrix(true, true);
      const loop = G.loop, N = loop ? 48 : Math.max(12, Math.min(150, Math.round(A.d * 30) + 1)), dt = loop ? A.d / N : A.d / (N - 1), y0 = root.position.y, v = V3(), inv = new THREE.Matrix4();
      for (const k in acts) acts[k].a.weight = 0; A.a.weight = 1; const S2 = { l: { c: [], p: [] }, r: { c: [], p: [] } };
      for (let i = 0; i < N; i++) { const t = loop ? A.d * i / N : Math.min(A.d - 1e-3, A.d * i / (N - 1)); A.a.time = t; root.position.y = groundOf(A, t); mixer.update(0);
        for (const pm of mixer._bindings) pm.binding.setValue(pm.buffer, mixer._accuIndex * pm.valueSize + pm.valueSize);
        root.updateMatrixWorld(true); inv.copy(outer.matrixWorld).invert();
        for (const s of ['l', 'r']) { let lo = Infinity; for (const e of FEET_S[s]) lo = Math.min(lo, skinned(e, v).applyMatrix4(inv).y); const a = root.getObjectByName('foot_' + s).getWorldPosition(V3()).applyMatrix4(inv); S2[s].c.push(lo); S2[s].p.push(a.x, a.y, a.z); } }
      A.a.weight = 0; root.position.y = y0;
      let moving = 0, cnt = 0, travel = 0, dev = 0; const lock = {}, C = {}, PP = {};
      for (const s of ['l', 'r']) { const lo = S2[s].c, p3 = S2[s].p, p = []; for (let i = 0; i < N; i++) p.push(p3[i * 3], p3[i * 3 + 2]);
        // contact: the sole within 2.5 cm of the floor; seated also a foot that rests (ankle < 0.12 m/s, sole < 25 cm up:
        // the female's feet hang 15 cm above the floor in the sit clips) - a stepping foot is never planted
        const spd = i => { const j = loop ? (i + 1) % N : Math.min(N - 1, i + 1), k = loop ? (i - 1 + N) % N : Math.max(0, i - 1); return Math.hypot(p3[j * 3] - p3[k * 3], p3[j * 3 + 1] - p3[k * 3 + 1], p3[j * 3 + 2] - p3[k * 3 + 2]) / (Math.max(1, j - k) * dt); };
        const c = lo.map((y, i) => y < .025 * SC || (G.mode === 'seat' && y < .25 * SC && spd(i) < .12 * SC)); for (let i = 1; i < N; i++) if (c[i] && c[i - 1]) { moving += Math.hypot(p[i * 2] - p[i * 2 - 2], p[i * 2 + 1] - p[i * 2 - 1]) / dt; cnt++; }
        C[s] = c; PP[s] = p; }
      const runsOf = c => { const runs = []; for (let i = 0; i < N; i++) if (c[i]) { if (runs.length && runs[runs.length - 1][1] === i - 1) runs[runs.length - 1][1] = i; else runs.push([i, i]); }
        if (loop && runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][1] === N - 1) { const last = runs.pop(); runs[0] = [last[0] - N, runs[0][1]]; } return runs; };
      for (const s of ['l', 'r']) for (const [a, b] of runsOf(C[s])) if (b - a >= 2) { const p = PP[s], i0 = ((a % N) + N) % N, i1 = ((b % N) + N) % N; travel = Math.max(travel, Math.hypot(p[i1 * 2] - p[i0 * 2], p[i1 * 2 + 1] - p[i0 * 2 + 1])); }
      // (a one-shot plays where it stands: always held; a loop whose planted foot travels > 6 cm per step or > 0.25 m/s is
      // LOCOMOTION: its stance foot is held on a line moving back at the clip's own speed - the median stance-foot velocity,
      // which is what walkAt / sequence move the figure by (f.speed), so in the world it stays put even where the source's
      // pelvis surges (KK_Sneak_Loop, the zombie walk: the stance foot swung +-15 cm under a steady walk))
      const loco = loop && (travel > .06 * SC || (cnt && moving / cnt > .25 * SC) || WALKS.test(cn)); let vx = 0, vz = 0;
      if (loco) { const L = S2.l.c, R = S2.r.c; for (const s of ['l', 'r']) { const o = s === 'l' ? R : L, me = S2[s].c; C[s] = C[s].map((x, i) => x && me[i] <= o[i] + .005 * SC); }
        const VX = [], VZ = []; for (const s of ['l', 'r']) { const p = PP[s], c = C[s]; for (let i = 0; i < N; i++) { const j = (i + 1) % N; if (c[i] && c[j]) { VX.push((p[j * 2] - p[i * 2]) / dt); VZ.push((p[j * 2 + 1] - p[i * 2 + 1]) / dt); } } }
        VX.sort((x, y) => x - y); VZ.sort((x, y) => x - y); vx = VX[VX.length >> 1] ?? 0; vz = VZ[VZ.length >> 1] ?? 0; res.speed = Math.hypot(vx, vz); res.back = vz > .05 * SC; }
      for (const s of ['l', 'r']) { const p = PP[s], dx = new Float32Array(N), dz = new Float32Array(N), w = new Float32Array(N), ease = .1;
        // the anchor: the run's median ankle position (a foot that lands still sliding is held where it comes to rest); on the
        // moving line for locomotion
        for (const [a, b] of runsOf(C[s])) { const full = loop && b - a >= N - 1, xs = [], zs = []; for (let k = a; k <= b; k++) { const i = ((k % N) + N) % N; xs.push(p[i * 2] - vx * (k - a) * dt); zs.push(p[i * 2 + 1] - vz * (k - a) * dt); }
          xs.sort((x, y) => x - y); zs.sort((x, y) => x - y); const ax = xs[xs.length >> 1], az = zs[zs.length >> 1];
          // (fights step and lunge on purpose: a run there that needs the ankle pulled > 15 cm is left alone; elsewhere up to 45 cm)
          let far = 0; for (let k = a; k <= b; k++) { const i = ((k % N) + N) % N; far = Math.max(far, Math.hypot(ax + vx * (k - a) * dt - p[i * 2], az + vz * (k - a) * dt - p[i * 2 + 1])); } if (far > (FIGHT.test(cn) ? .15 : .45) * SC) continue;
          for (let k = a; k <= b; k++) { const i = ((k % N) + N) % N, inS = loop || a > 0 ? (k - a) * dt / ease : 1, outS = loop || b < N - 1 ? (b - k) * dt / ease : 1;
            w[i] = full && !loco ? 1 : smoother(Math.min(1, inS, outS)); dx[i] = ax + vx * (k - a) * dt - p[i * 2]; dz[i] = az + vz * (k - a) * dt - p[i * 2 + 1]; dev = Math.max(dev, Math.hypot(dx[i], dz[i])); } }
        lock[s] = { dx, dz, w }; }
      // (a walk whose stance foot already stays on its line - the UAL walks, jog, sprint - is left exactly as it is)
      res.travel = travel; res.dev = dev; if (!loco || dev > .03 * SC) res.lock = { loop, N, d: A.d, s: lock };
    }
    PLANT.set(key, res); return res; };
  const lockAt = (L, s, t) => { const X = L.s[s], N = L.N, d = L.d || 1, u = L.loop ? ((((t % d) + d) % d) / d) * N : Math.max(0, Math.min(N - 1, t / d * (N - 1))), i = Math.floor(u) % N, k = u - Math.floor(u), j = L.loop ? (i + 1) % N : Math.min(N - 1, i + 1);
    const wi = X.w[i] * (1 - k), wj = X.w[j] * k; return [X.dx[i] * wi + X.dx[j] * wj, X.dz[i] * wi + X.dz[j] * wj, wi + wj]; };
  // two-bone leg IK: the ankle moves by (dx, dy, dz) in the figure's own axes, the knee stays in its bend plane, the foot
  // keeps its world rotation
  const legIK = (s, d3) => { const th = root.getObjectByName('thigh_' + s), ca = root.getObjectByName('calf_' + s), fo = root.getObjectByName('foot_' + s); if (!th || !ca || !fo) return;
    const H = th.getWorldPosition(V3()), K = ca.getWorldPosition(V3()), Af = fo.getWorldPosition(V3()), fq = fo.getWorldQuaternion(new THREE.Quaternion());
    const Tg = Af.clone().add(d3.clone().applyQuaternion(outer.getWorldQuaternion(new THREE.Quaternion())));
    const a = H.distanceTo(K), b = K.distanceTo(Af), D = Tg.clone().sub(H), dd = clamp(D.length(), Math.abs(a - b) + 1e-4, (a + b) * .9995), dir = D.normalize(), fwd = V3(0, 0, 1).transformDirection(outer.matrixWorld);
    // (the knee bends toward the figure's front: a nearly straight leg's own bend direction is noise and flipped the knee back)
    // (blended, not switched: a switch between the two flipped the knee 40-55 deg in one frame of a stand-to-sit crossfade)
    let pv = K.clone().sub(H.clone().add(Af).multiplyScalar(.5)); pv.addScaledVector(dir, -pv.dot(dir)); const fp = fwd.clone().addScaledVector(dir, -fwd.dot(dir)).normalize(), pl = pv.length();
    const wA = pl > 1e-9 ? smooth(.01 * SC, .04 * SC, pl) * smooth(-.15, .25, pv.dot(fp) / pl) : 0; pv = (pl > 1e-9 ? pv.divideScalar(pl).multiplyScalar(wA) : V3()).addScaledVector(fp, 1 - wA); if (pv.lengthSq() < 1e-10) pv = V3(0, -1, 0); pv.normalize();
    const cA = clamp((a * a + dd * dd - b * b) / (2 * a * dd), -1, 1), K2 = H.clone().addScaledVector(dir, cA * a).addScaledVector(pv, Math.sqrt(1 - cA * cA) * a);
    worldRotate(th, new THREE.Quaternion().setFromUnitVectors(K.clone().sub(H).normalize(), K2.sub(H).normalize()));
    const K3 = ca.getWorldPosition(V3()), A3 = fo.getWorldPosition(V3()), Tc = H.clone().addScaledVector(dir, dd);
    worldRotate(ca, new THREE.Quaternion().setFromUnitVectors(A3.sub(K3).normalize(), Tc.sub(K3).normalize()));
    fo.quaternion.copy(fo.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(fq)); fo.updateMatrixWorld(true); };
  // seated: the sole onto the floor by the KNEE alone (the thigh stays on the seat): the shin turns about the knee's bend
  // axis (bisection, at most 50 deg either way) until the lowest sole meets floorY (outer space); out of reach = as close as
  // it gets
  const shinTo = (s, floorY, inv) => { const th = root.getObjectByName('thigh_' + s), ca = root.getObjectByName('calf_' + s), fo = root.getObjectByName('foot_' + s); if (!th || !ca || !fo) return;
    const K = ca.getWorldPosition(V3()), Hh = th.getWorldPosition(V3()), A0 = fo.getWorldPosition(V3()), u = K.clone().sub(Hh).normalize(), w = A0.clone().sub(K).normalize();
    let ax = V3().crossVectors(u, w); if (ax.lengthSq() < 1e-6) ax = V3(1, 0, 0).transformDirection(outer.matrixWorld); ax.normalize();
    const q0 = ca.quaternion.clone(), fq = fo.getWorldQuaternion(new THREE.Quaternion()), low = () => { let lo = Infinity; for (const e of FEET_S[s]) lo = Math.min(lo, skinned(e, _lv).applyMatrix4(inv).y); return lo; };
    const setA = a => { ca.quaternion.copy(q0); ca.updateMatrixWorld(true); worldRotate(ca, new THREE.Quaternion().setFromAxisAngle(ax, a)); fo.quaternion.copy(fo.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(fq)); fo.updateMatrixWorld(true); return low() - floorY; };
    const e0 = setA(0); if (Math.abs(e0) < .002 * SC) return;
    // which way lowers the foot: the sign that makes the error smaller at a small step
    // (continuous in the pose: the way that lowers the error by the slope at 0, and out of reach the closest angle by a
    // ternary search - a sampled best angle jumped 40 deg between two frames of a crossfade)
    // (the way: the one that lowers the error at a small step. With the shin near vertical both ways raise a foot that is in
    // the floor and the choice can flip between frames - the reason one-shots (sit-down / stand-up, the shin swinging through
    // vertical) get no floor fix: f.oneShotFloor)
    const sg = (setA(.01) - e0) * e0 < 0 ? 1 : -1;
    let lo = 0, hi = sg * .87;
    // (the calf stays in front of the seat's front edge, f.seatFront from sitOn: lowering a short body's feet turned the shin
    // back and the calf went 8 mm into a dining chair's seat; past that angle the toes point down instead)
    const SF = f.seatFront; if (SF && CALF_S[s].length) { const pen = () => { let p = -1; for (const e of CALF_S[s]) { skinned(e, _lv); if (_lv.y > SF.top + .02 || _lv.y < SF.top - .14) continue; const d = SF.v + .004 - _lv.clone().sub(SF.p).dot(SF.fw); if (d > p) p = d; } return p; };
      setA(0); const p0 = Math.max(0, pen()) + .0005; setA(hi); if (pen() > p0) { let a0 = 0, a1 = hi; for (let it = 0; it < 12; it++) { const m = (a0 + a1) / 2; setA(m); if (pen() > p0) a1 = m; else a0 = m; } hi = a0; } }
    let eh = setA(hi);
    if (Math.sign(eh) === Math.sign(e0)) { let a0 = 0, a1 = hi; for (let it = 0; it < 18; it++) { const m1 = a0 + (a1 - a0) / 3, m2 = a1 - (a1 - a0) / 3; if (Math.abs(setA(m1)) <= Math.abs(setA(m2))) a1 = m2; else a0 = m1; } const best = (a0 + a1) / 2, eb = setA(best);
      // still above the floor (a shorter body on a high seat): the toes point down to it (at most 50 deg at the ankle: at 35
      // the female's toes stayed 30 mm over the floor on a 46 cm chair in KK_Sit_Chair_Idle_Loop)
      if (eb > .005 * SC) { const fq0 = fo.quaternion.clone(), setF = a => { fo.quaternion.copy(fq0); fo.updateMatrixWorld(true); worldRotate(fo, new THREE.Quaternion().setFromAxisAngle(ax, a)); return low() - floorY; };
        const sf = setF(.05) < eb ? 1 : -1; let a0 = 0, a1 = sf * .87; if (setF(a1) > 0) return; for (let it = 0; it < 12; it++) { const m = (a0 + a1) / 2; if (setF(m) > 0) a0 = m; else a1 = m; } setF((a0 + a1) / 2); }
      return; }
    for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2, em = setA(mid); if (Math.sign(em) === Math.sign(e0)) lo = mid; else hi = mid; }
    setA((lo + hi) / 2); };
  // the legs after the clip: planted feet held (pTable) and, in seated clips, the soles set on the floor (f.seatFloor: the
  // world floor height sitOn measured, else the figure's placed y): a shorter body's feet no longer dangle, a taller one's no
  // longer go through the floor
  const _lv = V3();
  const legs = list => { if (!FEET.length || f.plantFeet === false) return; const corr = { l: V3(), r: V3() }; let seatW = 0;
    const restW = { l: 0, r: 0 }, oneW = { l: 0, r: 0 };
    // (resting feet of seated LOOPS: the knee alone sets the sole on the floor (shinTo). f.oneShotFloor (experimental, off):
    // the planted soles of seated ONE-SHOTS too - leg IK while the thigh is steep, the knee once it lies on the seat. Off
    // because both ways tried were worse: the knee turn jumped a landing foot 16-20 cm between its two solutions near a
    // vertical shin, leg IK on a seated leg pitched the thigh 25 mm into the seat. A sit-down / stand-up keeps the clip's own
    // soles: f.sitDown's root path never goes below the floor)
    for (const [A, t, w] of list) { const P = pTable(A); if (P.lock) for (const s of ['l', 'r']) { const [dx, dz, lw] = lockAt(P.lock, s, t); corr[s].x += w * dx; corr[s].z += w * dz; if (P.mode === 'seat' && (P.lock.loop || f.oneShotFloor)) (P.lock.loop ? restW : oneW)[s] += w * lw; } if (P.mode === 'seat') seatW += w; }
    if (seatW > 1e-3) { outer.updateMatrixWorld(true); const inv = outer.matrixWorld.clone().invert();
      const fw = f.seatFloor != null ? f.seatFloor : (outer.parent ? outer.parent.localToWorld(V3(outer.position.x, f._baseY ?? 0, outer.position.z)).y : (f._baseY ?? 0));
      const fl = V3(0, fw, 0); fl.x = outer.getWorldPosition(V3()).x; fl.z = outer.getWorldPosition(V3()).z; const fy = fl.applyMatrix4(inv).y;
      for (const s of ['l', 'r']) if (corr[s].x * corr[s].x + corr[s].z * corr[s].z > 1e-8) legIK(s, corr[s].setY(0));
      root.updateMatrixWorld(true);
      if (f.debugLegs) f._legDbg = { seatW, restW: { ...restW }, fy, lo: {} };
      for (const s of ['l', 'r']) { const k = Math.min(1, restW[s] + oneW[s]); if (k <= 1e-3) continue; const low = () => { let lo = Infinity; for (const e of FEET_S[s]) lo = Math.min(lo, skinned(e, _lv).applyMatrix4(inv).y); return lo; };
        let lo = low(); if (f._legDbg) f._legDbg.lo[s] = lo;
        // (down to the floor any distance; up out of it only a little - 2 cm fully, fading out by 5 cm: a stand-to-sit
        // crossfade has the soles 10 cm under it for a moment, and that is the blend's to resolve, not the knee's)
        // (f.seatFloorSide from sitOn: what is right under that foot - a table's foot bar, a footrest - else the floor)
        const fyS = f.seatFloorSide?.[s] != null ? (() => { const ow = outer.getWorldPosition(V3()); return V3(ow.x, f.seatFloorSide[s], ow.z).applyMatrix4(inv).y; })() : fy;
        // (the fade below is for the floor only: a foot rest's height is added in full - faded, a 3.5 cm table foot bar kept the
        // sole 19 mm inside it)
        if (!Number.isFinite(lo)) continue; let d = fy + .001 * SC - lo; if (d > 0) d *= 1 - smooth(.02 * SC, .05 * SC, d); d += fyS - fy;
        // (f.oneShotFloor only: one-shot feet by leg IK while the thigh is steep, blended into shinTo by the thigh's slope)
        const thB = root.getObjectByName('thigh_' + s), caB = root.getObjectByName('calf_' + s), tdy = caB.getWorldPosition(V3()).sub(thB.getWorldPosition(V3())).normalize().y;
        const kk = smoother(clamp((k - .5) / .5)), share = oneW[s] / Math.max(1e-6, oneW[s] + restW[s]) * smooth(.35, .75, -tdy);
        if (share > 1e-3 && Math.abs(d * kk * share) > 1e-4 * SC) { legIK(s, V3(0, d * kk * share, 0)); root.updateMatrixWorld(true); lo = low(); d = fy + .001 * SC - lo; if (d > 0) d *= 1 - smooth(.02 * SC, .05 * SC, d); }
        // (the knee alone - shinTo: the thigh stays on the seat, the toes point down past the reach. Tried in v18 and dropped:
        // raising a foot by leg IK pitched the thigh 6-10 mm off the seat and fed back into sitOn's seat height (soles 12 mm
        // deeper on a sofa); limited to sit-down -> sit crossfades it still swung a foot 43-50 mm (open: the knee turn has two
        // far-apart solutions when the shin passes vertical in that blend, 35 mm in 1/60 s once))
        if (share < 1 - 1e-3 && Math.abs(d) > .002 * SC) shinTo(s, lo + kk * (1 - share) * d / Math.max(1e-3, 1 - kk * share), inv); }
      root.updateMatrixWorld(true); return; }
    for (const s of ['l', 'r']) if (corr[s].lengthSq() > 1e-8) legIK(s, corr[s]);
    root.updateMatrixWorld(true); };
  // the back on the backrest (seated, f.seatBack from sitOn: { p, fw, bands }): the spine leans back until the upper back is
  // 1.2 cm off the backrest (at most 30 deg, the neck keeps 70 % of the head's angle, the hands stay where they were)
  const leanBack = w => { const B = f.seatBack; if (!B?.bands?.length || !BACKPTS.length || w <= 1e-3 || f.leanBack === false) return;
    const rt = V3(B.fw.z, 0, -B.fw.x).normalize(), sp = ['spine_01', 'spine_02', 'spine_03'].map(n => root.getObjectByName(n)), nk = root.getObjectByName('neck_01'); let tot = 0;
    const keep = HANDS ? Object.values(HANDS).map(H => [H, H.hand.getWorldPosition(V3()), H.hand.getWorldQuaternion(new THREE.Quaternion())]) : [];
    const q0s = [...sp, nk].filter(Boolean).map(b => [b, b.quaternion.clone()]); let gap = Infinity;
    const gapNow = () => { root.updateMatrixWorld(true); let g = Infinity, gy = 0; for (const e of BACKPTS) { skinned(e, _lv); let bb = null, by = 1e9; for (const b of B.bands) { const dy = Math.abs(_lv.y - b.y); if (dy < .035 && dy < by) { by = dy; bb = b; } } if (!bb) continue;
      const c = _lv.clone().sub(B.p).dot(B.fw) - bb.vb; if (c < g) { g = c; gy = _lv.y; } } return [g, gy]; };
    const CAPA = 30 * Math.PI / 180, OUTA = 42 * Math.PI / 180;
    for (let it = 0; it < 4; it++) { root.updateMatrixWorld(true); let gy = 0; gap = Infinity;
      for (const e of BACKPTS) { skinned(e, _lv); let bb = null, by = 1e9; for (const b of B.bands) { const dy = Math.abs(_lv.y - b.y); if (dy < .035 && dy < by) { by = dy; bb = b; } } if (!bb) continue;
        const c = _lv.clone().sub(B.p).dot(B.fw) - bb.vb; if (c < gap) { gap = c; gy = _lv.y; } }
      // (the arms vs the backrest's posts / sides: the lean stops 1 cm before an elbow reaches them - v18, sitOn's abands)
      if (B.abands?.length) for (const e of ARMPTS) { skinned(e, _lv); const d = _lv.clone().sub(B.p), u = d.dot(rt); let bb = null, by = 1e9;
        for (const b of B.abands) { const dy = Math.abs(_lv.y - b.y); if (dy < .035 && Math.abs(u - b.u) < .02 && dy < by) { by = dy; bb = b; } } if (!bb) continue;
        const c = d.dot(B.fw) - bb.vb + .002; if (c < gap) { gap = c; gy = _lv.y; } }
      f._lean = { gap, tot }; if (!Number.isFinite(gap) || gap < .0125) break; const p0 = sp[0].getWorldPosition(V3()), h = Math.max(.15, gy - p0.y);
      let th = Math.atan2(gap - .012, h); th = Math.min(th, OUTA - tot); if (th <= 1e-4) break; tot += th;
      for (const b of sp) worldRotate(b, new THREE.Quaternion().setFromAxisAngle(rt, -th / 3)); if (nk) worldRotate(nk, new THREE.Quaternion().setFromAxisAngle(rt, th * .7)); }
    // CONTINUOUS (charstress: a seated talker's head jumped 19 cm in 1/60 s when the lean switched between 30 deg and
    // upright - "a lean that does not reach the backrest is no lean at all" was an on-off switch): the lean the back needs,
    // up to 30 deg; a back that needs more (a deep sofa: the low back is what is far; a torso far forward) fades the lean
    // out between 30 and 42 deg needed, so the angle follows the clip's pose continuously
    // (the need is judged on the full lean, then weighted by the seated share w of the mix: weighting the need instead leaned
    // a person standing in front of the chair 0-25 deg while the sit-down faded in - a 5.7 cm head jump)
    { const fin = Math.min(tot, CAPA) * (1 - smooth(CAPA, OUTA, tot)) * w;
      if (Math.abs(fin - tot) > 1e-5) { for (const [b, q] of q0s) b.quaternion.copy(q); root.updateMatrixWorld(true);
        if (fin > 1e-5) { for (const b of sp) worldRotate(b, new THREE.Quaternion().setFromAxisAngle(rt, -fin / 3)); if (nk) worldRotate(nk, new THREE.Quaternion().setFromAxisAngle(rt, fin * .7)); }
        tot = fin; } }
    // the hands stay where the clip put them (on the thighs, at the keyboard): arm IK back to their world place
    if (tot > 1e-3) for (const [H, W0, q0] of keep) { const E = H.lo.getWorldPosition(V3()), S0 = H.up.getWorldPosition(V3()), W1 = H.hand.getWorldPosition(V3()), off = E.clone().sub(S0.clone().add(W1).multiplyScalar(.5));
      if (off.lengthSq() < 1e-8) off.copy(B.fw).negate(); solveArm(H, W0, H.Floc.clone().applyQuaternion(q0), H.Nloc.clone().applyQuaternion(q0), E.clone().addScaledVector(off.normalize(), .3 * SC)); }
    root.updateMatrixWorld(true); };
  drawn.length = 0;   // (the per-vertex list is only needed to set up the hands and capsules)
  // NO CLIPPING: the arms out of the body (see bodyVolumes); called by apply() after the clip and the relaxed hands
  const BV = (() => { if (!VM?.length || !HANDS || o.unclip === false) return null; try { const m0 = VM[0], b = m0.skeleton.bones.find(x => x.name === 'spine_02'); root.updateMatrixWorld(true);
    return bodyVolumes(bKey, VM, new THREE.Matrix4().multiplyMatrices(m0.matrixWorld, m0.bindMatrixInverse).multiply(b.matrixWorld).getMaxScaleOnAxis()); } catch (e) { console.warn('figures: no body volumes (' + e.message + ')'); return null; } })();
  const _pv = V3(), _pl = V3(), _pn = V3();
  const unclip = () => {
    if (!BV || f.unclip === false || smallInView()) return 0; const m0 = VM[0], MB = new THREE.Matrix4(), X = {}; let moves = 0;
    const margin = .004 * SC, tol = .002, soft = (f.unclipSoft ?? 0) * SC, softLeg = (f.unclipSoftLeg ?? 0) * SC;   // (f.unclipSoft: metres of overlap allowed as contact)
    // (f.unclipZone, experimental, off: the push starting that far outside the surface (C1 onset). Tried in charstress v18:
    // the walking / pointing hand pops were the volumes' slice staircase instead (volDepth), and a soft zone pushed folded
    // arms 32 mm into each other (animqa))
    const ZONE = (f.unclipZone ?? 0) * SC, KW = Math.max(1e-4 * SC, ZONE - margin), softPush = x => !ZONE ? x : x <= 0 ? 0 : x < 2 * KW ? x * x / (4 * KW) : x - KW, mg = d => ZONE ? 0 : margin * smooth(tol, tol + .01, d);
    for (let pass = 0; pass < 3; pass++) {
      root.updateMatrixWorld(true); MB.multiplyMatrices(m0.matrixWorld, m0.bindMatrixInverse);
      for (const n in BV.vols) { const bo = root.getObjectByName(n); if (!bo) continue; const T = (X[n] ??= { T: new THREE.Matrix4(), inv: new THREE.Matrix4(), c: V3(), k: 1 }); T.T.multiplyMatrices(MB, bo.matrixWorld); T.inv.copy(T.T).invert(); T.k = T.T.getMaxScaleOnAxis(); T.c.copy(BV.vols[n].c).applyMatrix4(T.T); T.r2 = (BV.vols[n].rad * T.k + .01 + ZONE) ** 2; }
      let moved = false; const neckY = root.getObjectByName('neck_01').getWorldPosition(V3()).y;
      for (const s of ['l', 'r']) { const H = HANDS[s], best = {};
        for (const [mi, i, kind] of BV.pts[s]) { skinned([VM[mi], i], _pv); const low = 1 - smooth(neckY - .03 * SC, neckY + .03 * SC, _pv.y);
          for (const n of BV.tg[s][kind]) { const T = X[n]; if (!T || _pv.distanceToSquared(T.c) > T.r2) continue;
            // (hands over the head may hold each other: hands on head; faded over 6 cm around the neck, not switched)
            const armV = /^(upperarm|lowerarm|hand)_/.test(n); if (armV && low <= 0) continue; const d0 = volDepth(BV.vols[n], _pl.copy(_pv).applyMatrix4(T.inv), _pn, false, ZONE / T.k); if (d0 <= 0) continue;
            // (every sunk point votes: the push is the depth-squared weighted mean way out, the deepest depth long; one point
            // alone would flip the direction from frame to frame deep inside a head - a 40 cm hand pop)
            // (a leg pushes a hand a little more upward than across: hands rest ON laps)
            // (CONTINUOUS: any depth > 0 counts, the push grows from 0 with it - a 2 mm threshold was an on-off switch)
            const legV = /^(thigh|calf)_/.test(n), d = softPush(d0 * T.k * (armV ? low : 1) - (legV ? softLeg : soft)); if (d <= 0) continue; const B2 = (best[kind] ??= { d: 0, n: V3(), p: V3(), w: 0 }), w2 = d * d;
            const nw = _pn.clone().transformDirection(T.T); if (/^(thigh|calf)_/.test(n) && nw.y > 0) { nw.y *= 2; nw.normalize(); }   B2.n.addScaledVector(nw, w2); B2.p.addScaledVector(_pv, w2); B2.w += w2; if (d > B2.d) B2.d = d; } }
        for (const k in best) { const B2 = best[k]; B2.p.divideScalar(B2.w); if (B2.n.lengthSq() < 1e-12) delete best[k]; else B2.n.normalize(); }
        const S = H.up.getWorldPosition(V3());
        if (best.uarm) { const b = best.uarm, to = b.p.clone().addScaledVector(b.n, b.d + mg(b.d)); worldRotate(H.up, new THREE.Quaternion().setFromUnitVectors(b.p.clone().sub(S).normalize(), to.sub(S).normalize())); moved = true; moves++; }
        if (!best.hand && !best.farm) continue;
        const E = H.lo.getWorldPosition(V3()), W = H.hand.getWorldPosition(V3()), hq = H.hand.getWorldQuaternion(new THREE.Quaternion());
        // the wrist's push: the hand's and the forearm's (a forearm point moves less than the wrist: divided by how far along
        // it is) blended by size, as long as the larger one - never switched between them (that kicked the arm 17 deg)
        const pushOf = b => { if (!b) return V3(); const along = b === best.farm ? Math.max(.3, Math.min(1, b.p.clone().sub(E).dot(W.clone().sub(E)) / W.distanceToSquared(E))) : 1;
          return b.n.clone().multiplyScalar((b.d + mg(b.d)) / along); };
        const vh = pushOf(best.hand), vf = pushOf(best.farm), lh = vh.length(), lf = vf.length(), dirP = vh.clone().multiplyScalar(lh).addScaledVector(vf, lf); if (dirP.lengthSq() < 1e-14) continue;
        const Tg = W.clone().addScaledVector(dirP.normalize(), Math.max(lh, lf)), mid = S.clone().add(W).multiplyScalar(.5), off = E.clone().sub(mid);
        if (off.lengthSq() < (.01 * SC) ** 2) off.copy(V3(0, 0, -1).transformDirection(outer.matrixWorld));
        solveArm(H, Tg, f.unclipKeepHand ? H.Floc.clone().applyQuaternion(hq) : null, f.unclipKeepHand ? H.Nloc.clone().applyQuaternion(hq) : null, E.clone().addScaledVector(off.normalize(), .3 * SC)); moved = true; moves++; }
      if (!moved) break;
    }
    if (moves) root.updateMatrixWorld(true); return moves; };
  const nearestHand = (H, T, list, N) => { const hw = H.hand.getWorldPosition(V3()), v = V3(); let best = null, bd = 1e9;
    for (const i of list) { skinned(i, v); if (N && v.clone().sub(hw).dot(N) < -.004 * SC) continue; const d = v.distanceTo(T); if (d < bd) { bd = d; best = v.clone(); } } return best ?? hw; };
  const asV = p => p == null ? null : p.isVector3 ? p.clone() : V3(...p);
  // handTo core: wrist placed so the palm meets P, palm facing N, fingers along F; calibrated on the skinned palm (2 passes)
  const reachTo = (side, P, ho) => {
    const H = HANDS[side], w = clamp(ho.weight ?? 1); if (w <= 0) return; const before = H.all.map(b => b.quaternion.clone());
    const S = H.up.getWorldPosition(V3()), chest = bone('spine_03').getWorldPosition(V3()), up = V3(0, 1, 0);
    const N = (asV(ho.palmNormal) ?? P.clone().sub(S)).normalize(), fw = V3(0, 0, 1).transformDirection(outer.matrixWorld);
    let F = (asV(ho.fingerDir) ?? fw.clone().addScaledVector(up, .25)); F.addScaledVector(N, -F.dot(N)); if (F.lengthSq() < 1e-6) F = up.clone().addScaledVector(N, -N.y); F.normalize();
    const out = S.clone().sub(chest).projectOnPlane(up).normalize(), pole = asV(ho.pole) ?? S.clone().addScaledVector(up, -.5).addScaledVector(out, .45).addScaledVector(fw, -.25);
    const Wt = P.clone().addScaledVector(F, -H.palm).addScaledVector(N, -.02 * SC), restore = () => { H.all.forEach((b, i) => b.quaternion.copy(before[i])); root.updateMatrixWorld(true); };
    solveArm(H, Wt, F, N, pole); root.updateMatrixWorld(true);
    // calibrated on the DRAWN palm (its surface point in the hand bone, measured on the visible mesh): the palm centre lands on P
    for (let it = 0; it < 3; it++) { const v = H.palmLocal ? H.hand.localToWorld(H.palmLocal.clone()) : nearestHand(H, P, H.hp, N); Wt.add(P.clone().sub(v)); restore(); solveArm(H, Wt, F, N, pole); root.updateMatrixWorld(true); }
    if (ho.curl != null) curlFingers(H, ho.curl, ho.curl * .6);
    if (w < 1) { const after = H.all.map(b => b.quaternion.clone()); H.all.forEach((b, i) => b.quaternion.copy(before[i]).slerp(after[i], w)); }
    root.updateMatrixWorld(true); H.last = { P: P.clone(), N, w };
  };
  // the world contact point of each hand of a hold: two-hand holds pair the left hand with the point nearer the left shoulder
  // (an object held from its back side swaps leftAt / rightAt); contactReport measures the same pairing
  const holdPoints = h => { let pts = h.hands.map(([s, at, o2]) => [s, h.obj.localToWorld(at.clone()), o2]);
    if (pts.length === 2) { const sl = HANDS.l.up.getWorldPosition(V3()); if (pts[0][1].distanceTo(sl) > pts[1][1].distanceTo(sl)) pts = [[pts[0][0], pts[1][1], pts[1][2]], [pts[1][0], pts[0][1], pts[0][2]]]; }
    return pts; };
  const applyHold = h => {
    if (h.attach === 'chest') { const c = outer.worldToLocal(bone('spine_03').getWorldPosition(V3())); h.obj.position.set(h.at[0], c.y + h.at[1], h.at[2]); h.obj.rotation.set(...h.rot); }
    h.obj.updateMatrixWorld(true); const C = h.obj.localToWorld(asV(h.center) ?? V3());
    for (const [s, P, o2] of holdPoints(h)) { const N = asV(o2.palmNormal) ?? C.clone().sub(P); if (o2.palmNormal) N.transformDirection(h.obj.matrixWorld); N.setY(N.y * .3);
      reachTo(s, P, { palmNormal: N, fingerDir: o2.fingerDir, weight: h.weight, curl: h.curl, pole: o2.pole }); }
  };
  const localBox = obj => { obj.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert(), b = new THREE.Box3(); obj.traverse(c => { if (c.isMesh && c.geometry) { c.geometry.computeBoundingBox(); b.union(c.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld))); } }); return b; };
  const bone = n => root.getObjectByName(BONE_OF[n] ?? n);
  // the photo face: two layers (the expression before, the one fading in on top), both skinned to the head
  const FCH = body && D ? faceChar(spec) : null, faceL = [];
  if (FCH && FACE_TEX[FCH]) { const k = `${body.src.uuid}|face`; let fg = SHELLS.get(k); if (!fg) { fg = faceGeo(D, body.src); SHELLS.set(k, fg); }
    for (let i = 0; i < 2; i++) { const mt = new THREE.MeshStandardMaterial({ map: FACE_TEX[FCH].neutral, transparent: true, vertexColors: true, alphaTest: .02, depthWrite: false, roughness: .85, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 - i, polygonOffsetUnits: -2 - i });
      const s = new THREE.SkinnedMesh(fg, mt); s.name = `${spec.name} face ${i}`; s.bindMode = body.m.bindMode; s.bind(body.m.skeleton, body.m.bindMatrix); s.frustumCulled = false; s.renderOrder = 2 + i; s.userData.acc = true; s.userData.noContact = true; s.visible = i === 0;
      body.m.parent.add(s); faceL.push(s); }
    for (const m of featM) m.visible = false; }   // the model's own eyes and brows would poke through the photo face
  // crossfade machinery (act from/at, sequence, timeline): weights per step, the root of a step at t, the weighted clip mix
  const bl = (L, j) => j > 0 ? (L[j].blend ?? (blendFor(L[j - 1].act, L[j].act) || .3)) : 0;
  const segWeights = (L, i, t, k, out, dep) => { const B = bl(L, i), u = B > 0 ? (t - L[i].t0) / B : 1;
    if (u < 1 && dep < 3) { const w = smoother(u); if (k * (1 - w) > 1e-4) segWeights(L, i - 1, t, k * (1 - w), out, dep + 1); if (k * w > 1e-4) out.push([i, k * w]); } else out.push([i, k]); return out; };
  const rootAt = (L, j, t, dep = 0) => { if (j < 0 || dep > 16) return null; const s = L[j];
    if (WALKS.test(s.act) && (s.dir || s.to)) { const from = s.from ? asV(s.from) : rootAt(L, j - 1, s.t0, dep + 1)?.p?.clone() ?? outer.position.clone();
      const D = (s.to ? asV(s.to).sub(from) : asV(s.dir)).setY(0), len = D.length(); D.normalize(); const clip = s.clip ?? HUMAN_ACTS[s.act] ?? s.act;
      const n = L[j + 1], Bi = bl(L, j), Bo = n ? bl(L, j + 1) : 0, t1 = n ? n.t0 : Infinity, c0 = s.t0 + Bi, c1 = t1 - Bo / 2;
      const V = s.speed ?? (s.to && n ? len / Math.max(.05, t1 - s.t0 - Bi / 2) : f.speed(clip)), tau = t - s.t0; let d = 0;
      if (tau > 0) { d = Bi > 0 ? Bi * smootherInt(Math.min(tau, Bi) / Bi) : 0; d += Math.max(0, Math.min(t, c1) - c0); if (Bo > 0 && t > c1) { const u = Math.min(1, (t - c1) / Bo); d += Bo * (u - smootherInt(u)); } }
      d *= V; return { p: from.clone().addScaledVector(D, d), ry: Math.atan2(D.x, D.z) + (f.speed(clip) && f._back?.[clip] ? Math.PI : 0), walk: { clip, d: d + (s.dist0 ?? 0) } }; }
    const pv = rootAt(L, j - 1, t, dep + 1);
    // a sit-down / stand-up step (f.sitDown / f.standUp): the root slides from path.from to path.to as the clip plays (x/z
    // over [k0, k1] of the clip, y over [ky0, ky1]), a pure function of the clip time
    if (s.path) { const d = act(HUMAN_ACTS[s.act] ?? s.act)?.d ?? 1, u = clamp(((t - s.t0) * (s.rate ?? 1) + (s.start ?? 0)) / d), P2 = s.path, a = P2.from, b = P2.to;
      const k = smoother(clamp((u - P2.k0) / Math.max(1e-3, P2.k1 - P2.k0))), ky = smoother(clamp((u - (P2.ky0 ?? P2.k0)) / Math.max(1e-3, (P2.ky1 ?? P2.k1) - (P2.ky0 ?? P2.k0))));
      return { p: V3(lerp(a.x, b.x, k), lerp(a.y, b.y, ky), lerp(a.z, b.z, k)), ry: s.ry ?? pv?.ry }; }
    if (s.x != null || s.z != null) return { p: V3(s.x ?? pv?.p?.x ?? outer.position.x, s.y ?? f._baseY ?? 0, s.z ?? pv?.p?.z ?? outer.position.z), ry: s.ry ?? pv?.ry };
    if (s.ry != null) return { p: pv?.p ?? null, ry: s.ry };
    return pv ? { p: pv.p, ry: pv.ry } : null; };
  const mix = list => { let any = false, ys = 0, ws = 0;
    for (const e of list) { const o = e.o || {}; if (/phone/i.test(e.name) && o.phone !== false && !f.noAutoPhone && !f._phone) { f._phone = f.hold(new THREE.Mesh(RB(.072, .148, .0095, .006), fabricMat('plastic', '#121316')), { hand: 'R', thick: .0095, along: .035 }); f._phone.name = `${spec.name} phone`; }
      // { seat: y }: the clip's own thigh underside (gTable seatH, v17) on the seat top (before: a fixed 0.45 m calibration)
      const sA = o.seat != null && /sit|typing/i.test(e.name) ? act(HUMAN_ACTS[e.name] ?? e.name) : null, sH = sA ? gTable(sA).seatH : null;
      const sy = sA ? o.seat - (sH != null ? sH * SC : SEAT_H * (f.height / 1.8)) : null;
      if (sy != null || e.y != null) any = true; ys += e.w * (sy ?? e.y ?? f._baseY ?? outer.position.y); ws += e.w; }
    if (any && ws > 0) outer.position.y = ys / ws;
    for (const e of list) f.play(HUMAN_ACTS[e.name] ?? e.name, e.t ?? 0, e.w); f.apply();
    // the phone call: the clip presses the palm on the side of the head; the phone needs room between them (palm out 2.2 cm)
    const pw = f.noAutoPhone ? 0 : list.reduce((s, e) => s + (/phone/i.test(e.name) && (e.o || {}).phone !== false ? e.w : 0), 0);
    if (pw > 1e-3 && HANDS?.r?.palmLocal && f._phone?.parent) { const H = HANDS.r, hq = H.hand.getWorldQuaternion(new THREE.Quaternion()), N = H.Nloc.clone().applyQuaternion(hq), F = H.Floc.clone().applyQuaternion(hq);
      reachTo('r', H.hand.localToWorld(H.palmLocal.clone()).addScaledVector(N, -.022 * SC), { palmNormal: N, fingerDir: F, weight: pw }); }
    return f; };
  // live preview only (engine.js step sets __czView to the shot camera's view while the shot's frame code runs): a figure
  // the camera can't see keeps its last pose instead of being posed again (clips, legs, hands, no-clipping: ~1.5 ms each).
  // Exports, stills and Claude's frames pose every figure on every frame as before.
  const _vs = new THREE.Sphere(), offView = () => { const vw = globalThis.__czView; if (!vw?.on) return false; const h = spec.height ?? 1.8;
    outer.getWorldPosition(_vs.center); _vs.center.y += h * .5 * outer.scale.y; _vs.radius = h * .8 * outer.scale.y; return !vw.frustum.intersectsSphere(_vs); };
  // live preview only, likewise: a figure drawn under 30 % of the frame's height skips the arms-out-of-the-body correction
  // (unclip, ~2 ms a figure a frame: 30 people in a cabin were 15 fps); its few cm are a few pixels there. Exports keep it.
  const smallInView = () => { const vw = globalThis.__czView; if (!vw?.on || !vw.cam) return false; const h = (spec.height ?? 1.8) * outer.scale.y;
    outer.getWorldPosition(_vs.center); const d = _vs.center.distanceTo(vw.cam.position); return h / (2 * Math.max(.01, d) * Math.tan(vw.cam.fov * Math.PI / 360)) < .3; };
  const f = {
    rig: 'human', body: MQ ? spec.body : female ? 'female' : 'male', finish: MQ ? spec.finish : null, color: MQ ? spec.color : null, mannequin: MQ ? mqMeshes.slice() : null, custom,
    height: spec.height ?? (female ? 1.68 : 1.8), figure: spec, name: spec.name, group: outer, root: outer, visible: true, scale, clips: Object.keys(CLIPS),
    place(x, y, z, ry) { outer.position.set(x, y, z); f._baseY = y; if (ry != null) outer.rotation.y = ry; return f; },
    // play(clip, t, weight): a clip at time t (loops wrap, one-shots hold their last frame); several = a blend. Then apply().
    play(name, t = 0, w = 1) { const A = act(name); if (!A) { if (!warned) { warned = true; console.warn(`${spec.name}: no clip "${name}"`); } return f; } pend.push([A, t, w]); return f; },
    apply(pose) { if (f._posed && offView()) { pend = []; return f; } f._posed = true;
      if (pose && typeof pose === 'object' && !pend.length) f.play((pose.dy ?? 0) < -.3 ? HUMAN_ACTS.sit : HUMAN_ACTS.stand, 0);
      // nothing queued: the last mix again (the pose stays; it never falls back to the bind pose)
      if (!pend.length && lastPend) pend = lastPend.slice();
      const list = pend; lastPend = pend; pend = [];
      // the pose of a mix [[A, t, w], ...]: the clips, relaxed hands, the legs and the back (everything but the arm correction)
      const poseOf = L => {
        // the root's lift: the weighted grounding of the clips in this mix (the drawn soles on the floor)
        if (FEET.length && L.length) { let gy = 0, gw = 0; for (const [A, t, w] of L) { gy += w * groundOf(A, t); gw += w; pTable(A); } if (gw > 0) root.position.y = gy / gw; }   // (the tables sample the mixer: before this frame's mix)
        for (const k in acts) acts[k].a.weight = 0;
        if (HANDS) for (const s in HANDS) for (const [b, q] of HANDS[s].rest) b.quaternion.copy(q);   // (no IK from the last frame survives)
        let top = null, rk = 0, rkR = 0; for (const [A, t, w] of L) { const cn = A.a.getClip().name; A.a.weight = w; A.a.time = /_Loop$/.test(cn) || A.loop ? ((t % A.d) + A.d) % A.d : Math.max(0, Math.min(A.d - 1e-3, t)); if (!top || w > top[1]) top = [cn, w];
          if (!NO_RELAX.test(cn)) { rk += w; if (!/Phone/i.test(cn)) rkR += w; } }
        mixer.update(0);
        // DETERMINISM: three's PropertyMixer only writes a bone when the mixed value differs from the last mix, so a bone that
        // IK / relaxHand / the rest reset above moved since keeps that pose (T-posed ghost arms when the same t renders twice,
        // preview != export). Write every bound value every frame.
        { const ai = mixer._accuIndex; for (const pm of mixer._bindings) pm.binding.setValue(pm.buffer, ai * pm.valueSize + pm.valueSize); }
        root.updateMatrixWorld(true);
        // relaxed hands by the weight of the clips that want them (a crossfade into a pointing clip lets go gradually)
        if (HANDS && f.relaxHands !== false) for (const s in HANDS) { const k = Math.min(1, s === 'r' ? rkR : rk) * .85; if (k > 1e-3) relaxHand(HANDS[s], k); }
        // v17 (animqa): planted feet held, seated soles on the floor, the back on the backrest
        legs(L);
        // CROSSFADES of standing / walking clips (v18, charstress): the blended pose's own lowest sole on the floor - the
        // weighted grounding of the two clips is not the blend's (walk -> stand sank the soles 49-51 mm into the floor mid-blend);
        // at either end of the blend this is the clip's own grounding (continuous), a pure function of the mix
        if (FEET.length && L.length > 1 && L.every(([A, , w]) => w < 1e-4 || gTable(A).mode === 'feet')) { const inv = new THREE.Matrix4().copy(outer.matrixWorld).invert(); let lo = Infinity;
          for (const e of FEET) lo = Math.min(lo, skinned(e, _lv).applyMatrix4(inv).y); if (Number.isFinite(lo) && Math.abs(lo) > 1e-4) { root.position.y -= lo; root.updateMatrixWorld(true); } }
        leanBack(L.reduce((sw, [A, , w]) => sw + (gTable(A).mode === 'seat' ? w : 0), 0));
        return top; };
      // no arm inside the body (unclip). In a CROSSFADE the correction blends like the clips do: each clip's own correction
      // (its pose alone, unclipped: the arm bones' local turns) mixed by the clips' weights onto the blended pose. Correcting
      // the blended pose itself let go of the hands on the thighs in one frame (sit -> typing: 22 deg/frame), because the
      // blend's hand leaves the thigh faster than any depth-based push can follow. A pure function of the mix: stateless.
      const live = list.filter(e => e[2] > 1e-4);
      let top;
      if (BV && f.unclip !== false && live.length > 1) {
        const ARM = []; for (const s of ['l', 'r']) ARM.push(HANDS[s].up, HANDS[s].lo, HANDS[s].hand);
        let moves = 0; const D = live.map(([A, t, w]) => { poseOf([[A, t, 1]]); const q0 = ARM.map(b => b.quaternion.clone()); moves += unclip(); return [w, ARM.map((b, i) => q0[i].invert().multiply(b.quaternion))]; });
        top = poseOf(list); let acc = 0; const Q = ARM.map(() => new THREE.Quaternion());
        for (const [w, dq] of D) { acc += w; ARM.forEach((b, i) => Q[i].slerp(dq[i], w / acc)); }
        ARM.forEach((b, i) => b.quaternion.multiply(Q[i])); root.updateMatrixWorld(true); f.unclipMoves = moves;
      } else { top = poseOf(list); f.unclipMoves = unclip(); }
      f.clip = top?.[0] ?? f.clip;
      if (HANDS) { for (const h of holds) applyHold(h); root.updateMatrixWorld(true); }
      for (const s of clothes) s.userData.clothUpdate?.();   // the cloth skirts clear this frame's legs
      for (const fn of onApply) fn(f.time ?? 0, f);   // f.onApply(fn): fn(t, f) after every apply (lib/hands.js holds)
      return f; },
    // onApply(fn): fn(t, f) runs at the end of every apply() (t = the time of the act / sequence / walkAt that called it);
    // returns a function that removes it
    onApply(fn) { onApply.push(fn); return () => { const i = onApply.indexOf(fn); if (i >= 0) onApply.splice(i, 1); }; },
    // mixWeight(re) -> 0..1: the weight of the clips whose name matches re in this frame's mix (lib/props.js: a seated rest
    // applies only as much as resting clips play)
    mixWeight(re) { let s = 0; for (const [A, , w] of lastPend ?? []) if (re.test(A.a.getClip().name)) s += w; return Math.min(1, s); },
    // plantInfo(name) (QA): how a clip's feet are held / rested - { mode, lock, travel, dev, speed, rest: per foot the share of the cycle resting }
    plantInfo(name, fresh = false) { const A = act(HUMAN_ACTS[name] ?? name); if (!A) return null; if (fresh) PLANT.delete(gKey(A.a.getClip().name) + '|plant'); const P = pTable(A); const share = s => P.lock ? +(Array.from(P.lock.s[s].w).reduce((a, b) => a + b, 0) / P.lock.N).toFixed(3) : 0;
      return { mode: P.mode, lock: !!P.lock, travel: P.travel, dev: P.dev, speed: P.speed ?? 0, rest: { l: share('l'), r: share('r') } }; },
    // clipInfo(name) -> { duration, loop, ground: 'feet' | 'body' | 'seat' | 'air', quality, notes } of a clip as this figure plays it
    clipInfo(name) { const A = act(HUMAN_ACTS[name] ?? name); if (!A) return null; const e = ANIM.animInfo(A.a.getClip().name); return { name: A.a.getClip().name, duration: A.d, loop: !!(A.loop || /_Loop$/.test(A.a.getClip().name)), ground: gTable(A).mode, quality: e?.quality ?? null, notes: e?.notes ?? null }; },
    // act(name, { t }): a named action (HUMAN_ACTS: stand, walk, sit, typing, phone, handsOnHead, point, carry, pickup, door,
    // fall, ...) at its time t; any clip name works too
    // Stateless crossfade: { from: 'walk', at: 12.4, blend?: s, fromT?: the outgoing clip's time (default t), fromRy + ry: the
    // root turns in place } blends from the previous action (still playing) into this one over blend (default blendFor) seconds.
    act(name, a = {}) { const t = a.t ?? 0; f.time = t;
      if (a.from != null && a.at != null) { const B = a.blend ?? blendFor(a.from, name), u = B > 0 ? (t - a.at) / B : 1;
        if (a.fromRy != null && a.ry != null) outer.rotation.y = lerpAng(a.fromRy, a.ry, smoother(u));
        if (u < 1) { const w = smoother(u); return mix([{ name: a.from, t: a.fromT ?? t, w: 1 - w, o: { ...a, ...(a.fromOpts || {}) } }, { name, t, w, o: a }]); } }
      return mix([{ name, t, w: 1, o: a }]); },
    // walkAt(from, dir, dist, { clip }): placed `dist` metres along `dir`, the walk clip at the time that distance takes at the
    // clip's own planted-foot speed (feet don't slide). A second clip blends in with o.blendTo / o.blend (0..1, eased).
    walkAt(from, dir, dist, wo = {}) { if (typeof wo.t === 'number') f.time = wo.t; const D = dir.clone().setY(0).normalize(), P = from.clone().addScaledVector(D, dist), clip = wo.clip ?? 'Walk_Loop', bw = smoother(wo.blend ?? 0);
      const sp = f.speed(clip); f.place(P.x, P.y, P.z, Math.atan2(D.x, D.z) + (f._back?.[clip] ? Math.PI : 0)); f.play(clip, dist / sp, 1 - bw); if (bw) f.play(HUMAN_ACTS[wo.blendTo] ?? wo.blendTo ?? 'Idle_Loop', wo.t ?? 0, bw); return f.apply(); },
    // sequence([{ act, t0, blend?, loop?, rate?, start?, seat?, x?, y?, z?, ry?, from?, dir?, to?, speed?, clip? }, ...], t): the
    // whole schedule of one figure, called every frame with the time only: each step crossfades from the one before (blend s,
    // default blendFor). Walk steps (act walk/jog/run/sneak with dir or to): from `from` (or where the step before stands) along
    // dir at `speed` (default the clip's own) or reaching `to` by the next step's t0; the speed ramps up over the blend and down
    // centred on the next t0 (the walk stops exactly there), the clip time follows the distance (planted feet). Steps without a
    // position stand where the step before ends; yaw changes turn smoothly. Stateless: any t alone gives the same pose.
    sequence(list, tt) { const t = typeof tt === 'number' ? tt : tt?.t ?? 0; f.time = t; if (!list?.length) return f;
      let i = 0; for (let k = 0; k < list.length; k++) if (list[k].t0 <= t) i = k;
      const W = segWeights(list, i, t, 1, [], 0), ents = [], P = V3(); let pw = 0, sx = 0, sy = 0;
      for (const [j, w] of W) { const s = list[j], r = rootAt(list, j, t), e = { name: s.act, w, o: s, y: r?.p?.y };
        if (r?.walk) e.t = r.walk.d / f.speed(r.walk.clip) + (s.phase ?? 0), e.name = r.walk.clip;
        else { const d = act(HUMAN_ACTS[s.act] ?? s.act)?.d ?? 1; let ct = (t - s.t0) * (s.rate ?? 1) + (s.start ?? 0);
          if (s.loop === true) ct = ((ct % d) + d) % d; else if (s.loop === false) ct = Math.max(0, Math.min(d - 1e-3, ct)); e.t = ct; }
        if (r?.p) { P.x += w * r.p.x; P.z += w * r.p.z; pw += w; } if (r?.ry != null) { sx += w * Math.sin(r.ry); sy += w * Math.cos(r.ry); }
        ents.push(e); }
      if (pw > 0) { outer.position.x = P.x / pw; outer.position.z = P.z / pw; } if (sx || sy) outer.rotation.y = Math.atan2(sx, sy);
      return mix(ents); },
    // SITTING DOWN / STANDING UP (v18, charstress): Sitting_Enter / Sitting_Exit played at the seated root started standing
    // INSIDE the chair (shins 17-39 mm in the seat, the soles 10 mm in / 41 mm over the floor, a 19 cm head jump into the
    // seated loop). sitOn(S, f, seat) measures, per seat: the seated root, the standing spot in front of it and the shin
    // clearance of the sit-down clip's last frame. Then, in f.sequence:
    //   [{ act: 'stand', t0: 0, ...f.standSpot(chair) }, ...f.sitDown(chair, { t0: .5 }), ...f.standUp(chair, { t0: 3.4 })]
    // standSpot(seat) -> { x, y, z, ry }: where to stand (or a walk step's `to`) in front of that seat (the figure's parent space)
    // sitDown(seat, { t0, dur?, act? (the seated act after it, default sitOn's), clip? 'Sitting_Enter', blend?, settle? .35 })
    //   -> 2 steps: the clip from the standing spot, the body coming down (root y over 20-75 % of the clip) and sliding back
    //   onto the seat while the thighs are on it (50-100 %), then the seated act at exactly sitOn's pose
    // standUp(seat, { t0, dur?, act? 'stand', clip? 'Sitting_Exit', blend? .35 }) -> 2 steps: the reverse, ending standing
    //   at the standing spot (the feet move with the root while the weight is on the seat: a scoot, not a slide on the floor)
    standSpot(seat) { const r = seatRec(seat); return { x: r.stand.x, y: r.stand.y, z: r.stand.z, ry: r.stand.ry }; },
    sitDown(seat, so = {}) { const r = seatRec(seat), clip = so.clip ?? 'Sitting_Enter', d = act(clip)?.d ?? 1.3, dur = so.dur ?? d, t0 = so.t0 ?? 0, end = { ...r.end, y: Math.max(r.end.y, r.stand.y) };
      return [{ act: clip, t0, loop: false, rate: d / dur, x: r.stand.x, y: r.stand.y, z: r.stand.z, ry: r.ry, path: { from: r.stand, to: end, k0: .5, k1: 1, ky0: .2, ky1: .75 }, ...(so.blend != null ? { blend: so.blend } : {}) },
        { act: so.act ?? r.act, t0: t0 + dur, x: r.seat.x, y: r.seat.y, z: r.seat.z, ry: r.ry, blend: so.settle ?? .35 }]; },
    standUp(seat, so = {}) { const r = seatRec(seat), clip = so.clip ?? 'Sitting_Exit', d = act(clip)?.d ?? 1, dur = so.dur ?? Math.max(d, 1.3), t0 = so.t0 ?? 0, end = { ...r.end, y: Math.max(r.end.y, r.stand.y) };
      return [{ act: clip, t0, loop: false, rate: d / dur, x: end.x, y: end.y, z: end.z, ry: r.ry, path: { from: end, to: r.stand, k0: 0, k1: .55, ky0: .25, ky1: .8 }, blend: so.blend ?? .35 },
        { act: so.act ?? 'stand', t0: t0 + dur, x: r.stand.x, y: r.stand.y, z: r.stand.z, ry: r.ry }]; },
    // timeline([{ t, act, opts }...], t): the same as sequence, written as act switches at times
    timeline(list, tt) { return f.sequence(list.map(e => ({ ...(e.opts || {}), act: e.act, t0: e.t })), tt); },
    speed(clip = 'Walk_Loop') { f._sp ??= {}; if (f._sp[clip]) return f._sp[clip]; const A = act(clip); if (!A) return 1;
      if (A.clip?.userData?.travels) return (f._sp[clip] = Math.max(.2, ANIM.animSpeed(clip, root) || .2));   // (an imported travelling clip, played in place)
      { const P = pTable(A); if (P.lock && P.speed > .05 * SC) { (f._back ??= {})[clip] = !!P.back; return (f._sp[clip] = Math.max(.2, P.speed * outer.scale.x)); } }   // v17: the held stance foot's speed
      // v17 (animqa): the speed of the CONTACT PATCH - the sole vertices within 8 mm of the floor in two samples in a row -
      // over the cycle (the old lowest-foot-bone estimate let sneaks, crouch walks and zombie walks slide 0.5-1.3 m per
      // step); a clip whose contact patch moves forward walks backwards (KK_Walk_Backwards_Loop): f._back[clip], and
      // walkAt / sequence turn the figure to face away from its travel
      const N = 90, V = [], inv = new THREE.Matrix4(), v = V3(), sub = FEET.filter((e, k) => !(k % 2)); let prev = null;
      for (let i = 0; i <= N; i++) { f.play(clip, A.d * i / N).apply(); inv.copy(outer.matrixWorld).invert(); const cur = sub.map(e => skinned(e, v).applyMatrix4(inv).toArray());
        if (prev) { let n = 0, dz = 0; for (let k = 0; k < cur.length; k++) if (cur[k][1] < .008 * SC && prev[k][1] < .008 * SC) { n++; dz += cur[k][2] - prev[k][2]; } if (n >= 3) V.push(-(dz / n) / (A.d / N)); }
        prev = cur; }
      if (V.length < 4) { const p = []; for (let i = 0; i <= N; i++) { f.play(clip, A.d * i / N).apply(); p.push(['foot_l', 'foot_r'].map(n => root.getObjectByName(n).getWorldPosition(V3()).applyMatrix4(new THREE.Matrix4().copy(outer.matrixWorld).invert()))); }
        V.length = 0; for (let i = 0; i < N; i++) { const k = p[i][0].y < p[i][1].y ? 0 : 1; V.push(-(p[i + 1][k].z - p[i][k].z) / (A.d / N)); } }
      V.sort((x, y) => x - y); const med = V[V.length >> 1] ?? .2; (f._back ??= {})[clip] = med < -.05;
      return (f._sp[clip] = Math.max(.2, Math.abs(med) * outer.scale.x)); },
    bone, hand: side => bone(side === 'L' || side === 'l' ? 'hand_l' : 'hand_r'),
    // hold(obj, { hand: 'R' | 'L', at: [x, y, z], rot: [rx, ry, rz] }): an object in the hand (it follows the hand bone)
    // hold(obj, { hand: 'R' | 'L', at?: [x, y, z] (hand-bone space), rot?, thick?, along? }): an object in the hand (it follows
    // the hand bone). Without `at` it lies on the DRAWN palm: its local +Y along the fingers, +Z out of the palm, `thick` m thick
    hold(obj, ho = {}) { const sd = sideOf(ho.hand ?? 'R'), h = f.hand(sd), H = HANDS?.[sd]; h.add(obj); const k = root.scale.x;
      if (!ho.at && H?.palmLocal) { const N = H.Nloc.clone().normalize(), F = H.Floc.clone().normalize(), X = V3().crossVectors(F, N).normalize(), F2 = V3().crossVectors(N, X);
        obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, F2, N)); obj.position.copy(H.palmLocal).addScaledVector(N, ((ho.thick ?? .01) / 2 + .002) / k).addScaledVector(F2, (ho.along ?? 0) / k);
        if (ho.rot) obj.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...ho.rot))); }
      else { obj.position.set(...(ho.at ?? [0, .08 / scale, .03 / scale])); obj.rotation.set(...(ho.rot ?? [0, 0, 0])); }
      obj.scale.setScalar(1 / k); obj.userData.noContact = true; return obj; },
    drop(obj) { const w = V3(); obj.getWorldPosition(w); obj.removeFromParent(); return w; },
    world(n) { const w = bone(n).getWorldPosition(V3()); outer.parent?.updateMatrixWorld(true); return outer.parent ? outer.parent.worldToLocal(w) : w; },
    scenePos(n) { return bone(n).getWorldPosition(V3()); },
    fwd() { outer.updateMatrixWorld(true); return V3(0, 0, 1).transformDirection(outer.matrixWorld); },
    box() { outer.updateMatrixWorld(true); if (!custom) return new THREE.Box3().setFromObject(outer);
      // (a custom body: what is drawn, not the hidden mannequin under it)
      const bx = new THREE.Box3(); outer.traverse(x => { if ((x.isMesh || x.isLine || x.isPoints) && !(x.layers.isEnabled(31) && !x.layers.isEnabled(0))) bx.expandByObject(x); }); return bx; },
    caps() { if (CAPR) { root.updateMatrixWorld(true); const k = root.scale.x; return CAPSEG.map(([a, b], i) => ({ a: capEnd(a), b: capEnd(b), r: CAPR[i] * k, part: a })); }
      const s = (spec.height ?? 1.8) / 1.8, w = n => root.getObjectByName(n).getWorldPosition(V3()), pos = n => n === 'Head+' ? w('Head').add(w('Head').sub(w('neck_01')).normalize().multiplyScalar(.14 * s)) : w(n);
      return [['pelvis', 'neck_01', .13], ['Head', 'Head+', .095], ['upperarm_l', 'lowerarm_l', .045], ['lowerarm_l', 'hand_l', .038], ['upperarm_r', 'lowerarm_r', .045], ['lowerarm_r', 'hand_r', .038],
        ['thigh_l', 'calf_l', .06], ['calf_l', 'foot_l', .045], ['thigh_r', 'calf_r', .06], ['calf_r', 'foot_r', .045]].map(([x, y, r]) => ({ a: pos(x), b: pos(y), r: r * s, part: x })); },
    tint() { return f; }, sync() { return f; }, lap() { return f; }, clipReport() { return { checked: 0, poke: 0, pokePct: 0, pokes: {}, exposed: 0, pct: 0, parts: {}, note: 'human: painted clothes' }; },
  };
  for (const k of ['reach', 'orientHand', 'settle', 'brace']) f[k] = () => { if (!warned) { warned = true; console.warn(`${spec.name}: the human rig plays mocap clips (act/play/walkAt/hold/handTo/holdTwoHand); ${k}() needs a mannequin rig`); } return f; };
  const sideOf = h => /^l/i.test(String(h)) ? 'l' : 'r';
  // the seat record sitOn (lib/props.js v18) left on this figure: by the seat object, its kit root, or the only one
  const seatRec = seat => { const M = f._seats; if (!M?.size) throw new Error(`${spec.name}: sitDown / standUp / standSpot need sitOn(S, figure, seat) first (it measures the seat)`);
    if (seat == null && M.size === 1) return [...M.values()][0];
    for (let o3 = seat; o3; o3 = o3.parent) if (M.has(o3)) return M.get(o3);
    for (const [k, r] of M) { let hit = false; k?.traverse?.(c => { if (c === seat) hit = true; }); if (hit) return r; }
    throw new Error(`${spec.name}: this seat was not measured by sitOn(S, figure, seat)`); };
  Object.assign(f, {
    clothes, bodyInfo: () => ({ mesh: body?.m ?? custom?.meshes[0] ?? mqMeshes.find(m => !m.userData.joints) ?? null, ids: D?.ids ?? null, meshes: custom ? custom.meshes.slice() : MQ ? mqMeshes.slice() : body ? [body.m] : [] }),
    // f.j.hips / f.j.wrR ...: the old mannequin joint names as bones (old scene code), f.bones(): every skeleton bone name
    j: new Proxy({}, { get: (_, n) => typeof n === 'string' ? bone(n) : undefined }),
    bones() { const out = []; root.traverse(b => { if (b.isBone) out.push(b.name); }); return out; },
    // palm('L'|'R') -> { position (the palm's surface, world), normal (out of the palm), forward (toward the fingers), center }
    // measured on the DRAWN hand's vertices this frame (call after act()/sequence()/handTo())
    palm(side) { const H = HANDS?.[sideOf(side)]; if (!H) return null; outer.updateMatrixWorld(true);
      const hq = H.hand.getWorldQuaternion(new THREE.Quaternion()), N = H.Nloc.clone().applyQuaternion(hq).normalize(), F = H.Floc.clone().applyQuaternion(hq).normalize(), c = V3(), v = V3(); let top = -Infinity;
      const pp = H.pp ?? H.hp; for (const e of pp) c.add(skinned(e, v)); c.divideScalar(pp.length); for (const e of pp) top = Math.max(top, skinned(e, v).sub(c).dot(N));
      return { position: c.clone().addScaledVector(N, top), normal: N, forward: F, center: c }; },
    // fingertip('L'|'R', 'index'|'middle'|'ring'|'pinky'|'thumb') -> world point of that finger's drawn tip
    fingertip(side, finger = 'index') { const H = HANDS?.[sideOf(side)]; if (!H) return null; const b = bone(`${finger}_03_${sideOf(side)}`); if (!b) return null; outer.updateMatrixWorld(true);
      const bp = b.getWorldPosition(V3()), v = V3(); let best = null, bd = -1; const dir = bp.clone().sub(bone(`${finger}_02_${sideOf(side)}`)?.getWorldPosition(V3()) ?? H.hand.getWorldPosition(V3())).normalize();
      for (const e of H.hv) { skinned(e, v); const d = v.clone().sub(bp); if (d.length() > .05 * SC) continue; const s = d.dot(dir); if (s > bd) { bd = s; best = v.clone(); } } return best ?? bp; },
    // look({ finish, color, joints }): another finish / colour for this figure from now on (a group's look in code)
    look(lk = {}) { if (!MQ) return f; Object.assign(spec, Object.fromEntries(Object.entries({ finish: FINISHES[lk.finish] ? lk.finish : null, color: HEX.test(lk.color ?? '') ? lk.color.toLowerCase() : null, joints: HEX.test(lk.joints ?? '') ? lk.joints : null }).filter(([, v]) => v)));
      for (const m of mqMeshes) m.material = finishMat(spec.finish, spec.color, m.userData.joints, spec.joints);
      // a custom body takes the finish once one is chosen here (its own joint materials stay the joint pieces)
      if (custom && (lk.finish || lk.color || lk.joints)) for (const m of custom.meshes) { const mats = [].concat(m.material).map(x => finishMat(spec.finish, spec.color, /joint/i.test(x?.name || ''), spec.joints)); m.material = Array.isArray(m.material) ? mats : mats[0]; }
      outer.traverse(h => { if (h.name === `${spec.name} outline`) h.visible = !custom && spec.finish === 'glow'; });
      if (spec.finish === 'glow' && !custom && !outer.getObjectByName(`${spec.name} outline`)) for (const m of mqMeshes.filter(x => !x.userData.joints)) { const h = new THREE.SkinnedMesh(m.geometry, glowHull(spec.color)); h.name = `${spec.name} outline`; h.castShadow = false; h.frustumCulled = false; h.userData.noPick = h.userData.noContact = true; h.bind(m.skeleton, m.bindMatrix); m.parent.add(h); }
      f.finish = spec.finish; f.color = spec.color; return f; },
    // handTo(hand 'L'|'R', worldPoint, { palmNormal, fingerDir, pole, weight 0..1, curl 0..1 }): after act()/walkAt() of this
    // frame, the arm bends (two-bone IK) so the palm touches the point; weight blends from the clip's arm (fade in/out)
    handTo(hand, P, ho = {}) { if (!HANDS || P == null) return f; reachTo(sideOf(hand), asV(P), ho); return f; },
    // curl(hand, amount): fingers 0 (as they are) .. 1 (a loose fist)
    curl(hand, k = .6) { if (HANDS) { curlFingers(HANDS[sideOf(hand)], k, k * .6); root.updateMatrixWorld(true); } return f; },
    // holdTwoHand(obj, { leftAt, rightAt (obj-local points on its edges), weight, curl, attach: 'chest' + at [x, dy, z] + rot }):
    // both palms on the object's edges every frame (re-solved in each act()/walkAt()); h.weight fades the hands in/out.
    // attach 'chest': the object is carried in front of the chest (parented to the figure, follows the chest's bob).
    holdTwoHand(obj, ho = {}) { const L2 = ho.leftAt ?? [-.3, 0, 0], R2 = ho.rightAt ?? [.3, 0, 0];
      const h = { obj, hands: [['l', asV(L2), ho.left ?? {}], ['r', asV(R2), ho.right ?? {}]], weight: ho.weight ?? 1, curl: ho.curl ?? .55, attach: ho.attach, at: ho.at ?? [0, -.12, .26], rot: ho.rot ?? [0, 0, 0], center: ho.center };
      if (h.attach === 'chest') { outer.add(obj); obj.userData.noContact = true; }
      holds.push(h); if (HANDS) { applyHold(h); root.updateMatrixWorld(true); } return h; },
    // grip(obj, { hand, at, palmNormal, fingerDir, weight, curl }): one hand on a point of the object (or { leftAt, rightAt }: two)
    grip(obj, go = {}) { if (go.leftAt || go.rightAt) return f.holdTwoHand(obj, go);
      const h = { obj, hands: [[sideOf(go.hand ?? 'R'), asV(go.at ?? [0, 0, 0]), go]], weight: go.weight ?? 1, curl: go.curl ?? .55 }; holds.push(h); if (HANDS) { applyHold(h); root.updateMatrixWorld(true); } return h; },
    // release(obj): let go (the object stays where it is in the world)
    release(obj) { for (let i = holds.length - 1; i >= 0; i--) if (holds[i].obj === obj) { const h = holds.splice(i, 1)[0]; if (h.attach === 'chest' && outer.parent) outer.parent.attach(obj); } return obj; },
    holds: () => holds.slice(),
    // face(expr, { from, at, t, blend = .2 }): the photo face's expression (FACE_EXPR); stateless crossfade from `from` to
    // expr over blend seconds starting at `at` (call every frame with t). faceChar: suspect = the young house painter,
    // official / police / detective = the older official, women = woman; extras keep the plain library face.
    // face.list: [[t, expr], ...] works too: face([[0, 'neutral'], [3.2, 'worried']], { t }).
    face(expr, fo = {}) { if (!faceL.length) return f; const TX = FACE_TEX[FCH], t = fo.t ?? 0, B = fo.blend ?? .2;
      let from = fo.from, at = fo.at, to = expr;
      if (Array.isArray(expr)) { let i = 0; for (let k = 0; k < expr.length; k++) if (expr[k][0] <= t) i = k; to = expr[i][1]; from = i > 0 ? expr[i - 1][1] : null; at = expr[i][0]; }
      const w = from != null && at != null && B > 0 ? smoother((t - at) / B) : 1;
      if (w >= 1 || from == null) { faceL[0].material.map = TX[to] ?? TX.neutral; faceL[0].material.opacity = 1; faceL[1].visible = false; }
      else { faceL[0].material.map = TX[from] ?? TX.neutral; faceL[0].material.opacity = 1; faceL[1].visible = w > 0; faceL[1].material.map = TX[to] ?? TX.neutral; faceL[1].material.opacity = w; }
      f.expr = w >= .5 ? to : from; return f; },
    faceMeshes: () => faceL.slice(),
    // contactReport(): per hold, each palm's distance to its contact point (m) and how deep the forearm / hand is in the object
    contactReport() { const out = []; if (!HANDS) return out; body?.m.skeleton.update();
      for (const h of holds) { const box = localBox(h.obj).expandByScalar(-.003), inv = new THREE.Matrix4().copy(h.obj.matrixWorld).invert(), r = { obj: h.obj.name, weight: h.weight, hands: {} };
        h.obj.updateMatrixWorld(true); for (const [s, P] of holdPoints(h)) { const H = HANDS[s], v = nearestHand(H, P, H.hv, null), E = H.lo.getWorldPosition(V3()), W = H.hand.getWorldPosition(V3());
          let fore = 0; for (let k = 0; k <= 12; k++) if (box.containsPoint(E.clone().lerp(W, k / 12).applyMatrix4(inv))) fore++;
          let hin = 0; const q = V3(); for (let k = 0; k < H.hv.length; k += 3) if (box.containsPoint(skinned(H.hv[k], q).applyMatrix4(inv))) hin++;
          r.hands[s] = { dist: +v.distanceTo(P).toFixed(4), forearmIn: fore, handIn: hin }; }
        out.push(r); }
      return out; },
    // clipReport(): body-through-cloth test of the current pose: covered body points that lie outside the cloth over them
    clipReport() { if (!D || !clothes.length) return { checked: 0, poke: 0, pokePct: 0, pct: 0, pokes: {}, note: 'human: no clothes' };
      body.m.skeleton.update(); const grid = new Map(), cell = .04, v = V3(), v2 = V3(), key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
      for (const s of clothes) { if (s.userData.acc) continue; const pa = s.geometry.attributes.position, na = s.geometry.attributes.normal;
        for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i); v2.fromBufferAttribute(na, i).multiplyScalar(.01).add(v); s.applyBoneTransform(i, v); s.applyBoneTransform(i, v2); v.applyMatrix4(s.matrixWorld); v2.applyMatrix4(s.matrixWorld);
          const n = v2.sub(v).normalize(), k = key(v.x, v.y, v.z); (grid.get(k) ?? grid.set(k, []).get(k)).push([v.x, v.y, v.z, n.x, n.y, n.z, s.userData.garment]); } }
      const cov = new Set(); for (const s of clothes) if (s.userData.covers) for (const id of s.userData.covers) cov.add(id);
      let checked = 0, poke = 0; const pokes = {};
      for (const id of cov) { if (id % 2) continue; skinned(D.corner[id], v); let best = null, bd = 1e9; const gx = Math.floor(v.x / cell), gy = Math.floor(v.y / cell), gz = Math.floor(v.z / cell);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) for (const p of grid.get(`${gx + a},${gy + b},${gz + c}`) || []) { const d = (p[0] - v.x) ** 2 + (p[1] - v.y) ** 2 + (p[2] - v.z) ** 2; if (d < bd) { bd = d; best = p; } }
        checked++; if (best && ((v.x - best[0]) * best[3] + (v.y - best[1]) * best[4] + (v.z - best[2]) * best[5]) > .002 * SC) { poke++; pokes[best[6]] = (pokes[best[6]] || 0) + 1; } }
      const pct = +(100 * poke / Math.max(1, checked)).toFixed(2); return { checked, poke, pokePct: pct, pct, pokes, note: 'human: garment shells' }; },
    // skirtReport(): the clothing gate's mesh test for the cloth skirts: every leg vertex (thigh / calf bones) at a skirt's
    // height must lie inside that skirt's ring at its angle (poke = outside, i.e. the leg shows through the cloth)
    skirtReport() { const out = { checked: 0, poke: 0, worst: 0 }; if (!D) return out; const sks = clothes.filter(s => s.userData.clothState); if (!sks.length) return out; body.m.skeleton.update();
      const v = V3(), d = V3();
      for (const s of sks) { const C = s.userData.clothState, last = C.NR - 1 - (C.hemmed ? 1 : 0);
        for (let i = 0; i < D.W; i += 2) { const nm = body.m.skeleton.bones[D.dom[i]]?.name || ''; if (!/^(thigh|calf)/.test(nm)) continue; skinned(D.corner[i], v);
          // above the waist ring / below the hem (each along its own ring axis): not the skirt's business
          if (v.clone().sub(C.cen[0]).dot(C.by[0]) > -.02 * C.sc || v.clone().sub(C.cen[last]).dot(C.by[last]) < .02 * C.sc) continue;
          let r = 0, bh = 1e9; for (let k = 1; k <= last; k++) { const hk = Math.abs(v.clone().sub(C.cen[k]).dot(C.by[k])); if (hk < bh) { bh = hk; r = k; } }
          d.copy(v).sub(C.cen[r]); d.addScaledVector(C.by[r], -d.dot(C.by[r])); const rad = d.length(), th = (Math.atan2(d.dot(C.bx[r]), d.dot(C.bz[r])) + Math.PI * 2) % (Math.PI * 2), j = Math.round(th / (Math.PI * 2) * C.N) % C.N;
          out.checked++; const over = rad - C.T[r][j]; if (over > -.002 * C.sc) { out.poke++; out.worst = Math.max(out.worst, +(over / C.sc).toFixed(4)); } } }
      return out; },
  });
  outer.userData.api = f; o.parent?.add(outer);
  if (o.noAutoPhone) f.noAutoPhone = true; if (o.allowBroken) f.allowBroken = true; if (o.unclip === false) f.unclip = false;
  f.place(o.x ?? 0, o.y ?? 0, o.z ?? 0, o.ry ?? 0); f.act(o.act ?? 'stand', o);
  return f;
}
let PREP = null, ATTACH = null; const LIB_PREP = (c, root) => PREP(THREE, c, root);
const _prep = async () => { const m = await import(LIBB + 'tools/anim-runtime.js'); PREP ??= m.prepareClip; ATTACH ??= m.attachToSkeleton; };

// =====================================================================================================================
// figure(): the one call scenes use
// =====================================================================================================================
// figure(role | spec, o?) o: { parent, x, y, z, ry, pose (a POSE), act (a name) + its options, name, rig, outfit, colors, height }
export function figure(spec = 'main', o2 = {}) {
  const o = typeof spec === 'string' ? { role: spec, ...o2 } : { ...spec, ...o2 };
  const sp = figureSpec(o), parent = o.parent;
  if (sp.rig === 'mq') return humanFigure(sp, { ...o, parent });
  const p = mannequin(sp, o); parent?.add(p.group); return p;   // (the clips / bodies did not load: the plain procedural mannequin)
}
void actorFigure;   // (the old actor rigs: kept for reference, every rig value draws as a mannequin since v16)
// a whole cast in one go: figures({ suspect: { x: 1 }, detective: { x: -1, act: 'phone' } }, S.scene) -> { suspect, detective }
export function figures(map, parent) { const out = {}; for (const [role, o] of Object.entries(map)) out[role] = figure(role, { parent, ...o }); return out; }

// preload what the settings ask for (a scene file imports this module: the swap needs no scene edit)
await loadFigures(['mq']).catch(e => console.warn('figures: ' + e.message));
