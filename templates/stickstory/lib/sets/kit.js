// Stick stories - the SET KIT (owned by the set agent): everything places.js builds rooms, stages and exteriors with.
// Study: experiments/stickstory-style/analysis/sets/NOTES.md (+ camera NOTES 3 and 6).
//
// How a set is drawn (fast): flat shapes go into PAINTERS, one merged vertex-coloured mesh per painter (a whole back wall
// with its clock, calendar, cabinets and tiles is ONE mesh), so a dense set is ~20-60 meshes. A painter draws in a plane
// ('xy' cards at a depth, 'xz' floors / ceilings, 'side' walls) with integer layers (each layer Z.step nearer the camera).
// Colours go through the MOOD (day / dusk / evening / night / candle / alarm / violet / blue / memory / dim): '#hex' is
// recoloured for the mood, '!#hex' is emissive (screens, lit windows, bulbs keep their colour), a bare word is a key of
// the set's palette (with per-mood overrides from the notes). Practical lights light every vertex they reach (walls,
// floors, items: the measured falloff I = peak * exp(-0.69 d / r_half)) and add an additive glow; glows never flicker.
//
// Geometry of a box room (tuned on the references' wides): back wall at z = -D (D = 3.5), floor y = 0, ceiling 2.85 m,
// the subject plane z = 0. The wide framing `cam.wide` (picture 3.1 m tall at z = 0, camera 1.15 m high, looking level)
// puts a standing figure's feet at 83 % of the frame, its head top at 34 %, the floor line at ~74 %, the cornice at ~15 %
// and a 2.15 m door at ~490 px of 1080 (iq500 kitchen f784: 82 / 39 / 72 / 13 % and a 494-510 px door).
// The references are 2D (wall props are drawn at the near characters' scale and the floor is raked); in our true
// perspective a figure at the back wall is ~0.72x a figure at z = 0. Sets that need a raked look (call center rows,
// stadium) raise their back rows / paint the ground on a card instead.
//
// A set: const ctx = setCtx(S, name, o, { pal, moods, mood, D, H, x0, x1, family, gradeAs, propMood, rim, rimDir, shadows });
// draw on ctx.wall / ctx.at(z) painters, door() / win() / clock() ... register holes, light() the practicals, prop() the
// furniture (the prop library's, else FALLBACK), ctx.spot(...), then shell(ctx, {...}) and return finish(ctx, { cam }).
import { THREE, Z, rnd, clamp, lerp, text as coreText, mixHex } from '../core.js';
import * as PROPS from '../props.js';

// =====================================================================================================================
// numbers
// =====================================================================================================================
export const ROOM = { D: 3.5, H: 2.85, camH: 1.15, wideH: 3.1, fullH: 4.3, fullCamH: 1.3, front: 8 };

// =====================================================================================================================
// colour + moods
// =====================================================================================================================
// Colour strings: '#hex' = a design colour (the painter grades it for the mood), '!#hex' = FINAL (already graded, or
// emissive): ctx.c() returns final colours, and mul / mix keep the '!' so derived shades stay final.
const bare = h => h[0] === '!' ? h.slice(1) : h;
export const fin = bare;
export const rgb = h => { h = bare(h); return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; };
export const hexOf = a => '#' + a.slice(0, 3).map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
/** k < 1 darker, > 1 lighter (multiplies the sRGB channels: the notes' 0.84x / 0.77x / 1.15x recipe) */
export const mul = (h, k) => { const c = rgb(h), out = hexOf(k <= 1 ? c.map(v => v * k) : c.map(v => v + (255 - v) * (k - 1) * .9)); return h[0] === '!' ? '!' + out : out; };
export const mix = (a, b, k) => { const A = rgb(a), B = rgb(b), out = hexOf(A.map((v, i) => v + (B[i] - v) * k)); return a[0] === '!' || b[0] === '!' ? '!' + out : out; };
void mixHex;

// A mood = how every colour of a set is graded (sRGB): grey + (c - grey) * sat, times k, times tint; plus what the lights
// and the window show, the characters' rim light and the background. Numbers fitted on the notes' palettes (kitchen day
// -> dusk -> night -> candle, office neutral -> alarm / violet / blue, the grey "memory" flashback).
export const MOODS = {
  day:     { k: 1, sat: 1, tint: [1, 1, 1], lamps: false, sun: true, sky: 'day', rim: '#f2c08a', rimDir: [1, .35], bg: '#15131a' },
  dusk:    { k: .8, sat: .8, tint: [1.0, .96, 1.02], lamps: true, sun: false, sky: 'dusk', rim: '#f0ba84', rimDir: [-.6, .8], bg: '#141118' },
  evening: { k: .64, sat: .95, tint: [1.07, .97, .86], lamps: true, sun: false, sky: 'dusk', rim: '#efc49a', rimDir: [-.6, .8], bg: '#130f0f' },
  night:   { k: .42, sat: .3, tint: [.95, .96, 1.15], lamps: true, sun: false, sky: 'night', rim: '#9fb0c8', rimDir: [-1, .3], bg: '#0b0c12' },
  candle:  { k: .19, sat: .7, tint: [1.12, .93, .8], lamps: false, candle: true, sun: false, sky: 'night', rim: '#f0ba84', rimDir: [1, .2], bg: '#0b0807' },
  alarm:   { k: .52, sat: .35, tint: [1.42, .84, .86], lamps: true, sun: false, sky: 'night', rim: '#ff8f86', rimDir: [-1, .3], bg: '#120808' },
  violet:  { k: .48, sat: .35, tint: [1.02, .86, 1.36], lamps: true, sun: false, sky: 'night', rim: '#c4a6ff', rimDir: [-1, .3], bg: '#0e0a14' },
  blue:    { k: .44, sat: .4, tint: [.78, .93, 1.42], lamps: true, sun: false, sky: 'night', rim: '#91caf6', rimDir: [-1, .3], bg: '#080b14' },
  memory:  { k: .95, sat: .1, tint: [.95, .98, 1.08], lamps: false, sun: false, sky: 'grey', rim: '#d0cfc9', rimDir: [0, 1], bg: '#2a2c33' },
  dim:     { k: .9, sat: .55, tint: [1.02, 1, .97], lamps: false, sun: false, sky: 'day', rim: '#e8c8a8', rimDir: [-1, .4], bg: '#1a1514' },
};
export const MOOD_NAMES = Object.keys(MOODS);
export function grade(h, m) {
  h = bare(h); if (!m || m === MOODS.day) return h;
  const c = rgb(h), g = .299 * c[0] + .587 * c[1] + .114 * c[2];
  return hexOf(c.map((v, i) => (g + (v - g) * m.sat) * m.k * m.tint[i]));
}
const LIN = new Map();
/** '#hex' -> linear [r, g, b] (what vertex colours want) */
export function lin(h) { h = bare(h); let v = LIN.get(h); if (!v) { const c = new THREE.Color(h); v = [c.r, c.g, c.b]; LIN.set(h, v); } return v; }
const smoothstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };

// =====================================================================================================================
// the painter: many flat shapes -> one vertex-coloured mesh
// =====================================================================================================================
const VMATS = {};
function vmat(kind) {
  return VMATS[kind] ??= new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false, transparent: kind !== 'solid',
    depthWrite: kind === 'solid', blending: kind === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending });
}
const GEO = new Map();
export class Painter {
  /** kind 'solid' | 'alpha' | 'add'; map(u, v, layer) -> [x, y, z] world; lit: vertices take the set's lights */
  constructor(ctx, o = {}) {
    this.ctx = ctx; this.kind = o.kind || 'solid'; this.map = o.map; this.lit = o.lit ?? (this.kind === 'solid'); this.order = o.order;
    this.key = o.key || null; this.name = o.name || ''; this.pos = []; this.col = []; this.idx = []; this.nv = 0; this.off = o.off || [0, 0, 0];
  }
  // a colour spec -> linear rgba
  _c(c, a = 1) {
    if (Array.isArray(c)) return c.length === 4 ? c : [...c, a];
    const v = lin(this.ctx ? this.ctx.c(c) : c);
    return [v[0], v[1], v[2], a];
  }
  _v(u, v, l, c) {
    const w = this.map(u, v, l); this.pos.push(w[0], w[1], w[2]);
    if (this.kind === 'solid') this.col.push(c[0], c[1], c[2]); else this.col.push(c[0], c[1], c[2], c[3]);
    return this.nv++;
  }
  tri(a, b, c, col, l = 0, cols) { const i = this._v(a[0], a[1], l, cols?.[0] ?? col), j = this._v(b[0], b[1], l, cols?.[1] ?? col), k = this._v(c[0], c[1], l, cols?.[2] ?? col); this.idx.push(i, j, k); }
  /** a quad from 4 points (counter-clockwise or not, DoubleSide), one colour or 4 */
  quad(p0, p1, p2, p3, color, l = 0, a = 1, cols) {
    const c = cols ? null : this._c(color, a), cs = cols ? cols.map(x => this._c(x, a)) : null;
    const i0 = this._v(p0[0], p0[1], l, cs?.[0] ?? c), i1 = this._v(p1[0], p1[1], l, cs?.[1] ?? c), i2 = this._v(p2[0], p2[1], l, cs?.[2] ?? c), i3 = this._v(p3[0], p3[1], l, cs?.[3] ?? c);
    this.idx.push(i0, i1, i2, i0, i2, i3); return this;
  }
  rect(x0, y0, x1, y1, color, l = 0, a = 1) { return this.quad([x0, y0], [x1, y0], [x1, y1], [x0, y1], color, l, a); }
  /** vertical gradient (bottom colour, top colour) */
  gradV(x0, y0, x1, y1, cb, ct, l = 0, ab = 1, at = ab) { const B = this._c(cb, ab), T = this._c(ct, at); return this.quad([x0, y0], [x1, y0], [x1, y1], [x0, y1], null, l, 1, [B, B, T, T]); }
  gradH(x0, y0, x1, y1, cl, cr, l = 0, al = 1, ar = al) { const L = this._c(cl, al), R = this._c(cr, ar); return this.quad([x0, y0], [x1, y0], [x1, y1], [x0, y1], null, l, 1, [L, R, R, L]); }
  /** any simple polygon [[x, y], ...] (concave is fine) */
  poly(pts, color, l = 0, a = 1) {
    const c = this._c(color, a), v = pts.map(p => new THREE.Vector2(p[0], p[1]));
    const faces = pts.length === 3 ? [[0, 1, 2]] : pts.length === 4 ? [[0, 1, 2], [0, 2, 3]] : THREE.ShapeUtils.triangulateShape(v, []);
    const base = pts.map(p => this._v(p[0], p[1], l, c)); for (const f of faces) this.idx.push(base[f[0]], base[f[1]], base[f[2]]); return this;
  }
  ellipse(cx, cy, rx, ry, color, l = 0, a = 1, segs = 0, a0 = 0, a1 = Math.PI * 2) {
    const n = segs || Math.max(12, Math.min(48, Math.round(Math.max(rx, ry) * 90))), c = this._c(color, a), ic = this._v(cx, cy, l, c);
    let prev = null; for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n, k = this._v(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, l, c); if (prev != null) this.idx.push(ic, prev, k); prev = k; }
    return this;
  }
  circle(cx, cy, r, color, l = 0, a = 1, segs = 0) { return this.ellipse(cx, cy, r, r, color, l, a, segs); }
  ring(cx, cy, r0, r1, color, l = 0, a = 1, segs = 0) {
    const n = segs || Math.max(16, Math.min(64, Math.round(r1 * 120))), c = this._c(color, a);
    for (let i = 0; i < n; i++) { const t0 = Math.PI * 2 * i / n, t1 = Math.PI * 2 * (i + 1) / n;
      this.quad([cx + Math.cos(t0) * r0, cy + Math.sin(t0) * r0], [cx + Math.cos(t0) * r1, cy + Math.sin(t0) * r1], [cx + Math.cos(t1) * r1, cy + Math.sin(t1) * r1], [cx + Math.cos(t1) * r0, cy + Math.sin(t1) * r0], null, l, 1, [c, c, c, c]); }
    return this;
  }
  /** a thick straight segment (butt ends) */
  seg(x0, y0, x1, y1, w, color, l = 0, a = 1, w1 = w) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1e-6, nx = -dy / L / 2, ny = dx / L / 2;
    return this.quad([x0 + nx * w, y0 + ny * w], [x1 + nx * w1, y1 + ny * w1], [x1 - nx * w1, y1 - ny * w1], [x0 - nx * w, y0 - ny * w], color, l, a);
  }
  pline(pts, w, color, l = 0, a = 1) { for (let i = 0; i + 1 < pts.length; i++) this.seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, color, l, a); return this; }
  rrect(x0, y0, x1, y1, r, color, l = 0, a = 1) {
    r = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2); if (r <= 1e-4) return this.rect(x0, y0, x1, y1, color, l, a);
    const pts = [], q = (cx, cy, s) => { for (let i = 0; i <= 5; i++) { const t = s + Math.PI / 2 * i / 5; pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); } };
    q(x1 - r, y0 + r, -Math.PI / 2); q(x1 - r, y1 - r, 0); q(x0 + r, y1 - r, Math.PI / 2); q(x0 + r, y0 + r, Math.PI);
    const c = this._c(color, a), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ic = this._v(cx, cy, l, c), ids = pts.map(p => this._v(p[0], p[1], l, c));
    for (let i = 0; i < ids.length; i++) this.idx.push(ic, ids[i], ids[(i + 1) % ids.length]); return this;
  }
  /** a radial gradient disc: rings [[r, colour, alpha], ...] from the centre out (alpha / add painters: soft glows) */
  radial(cx, cy, rings, l = 0, segs = 40, sy = 1) {
    const R = rings.map(([r, c, a]) => [r, this._c(c, a ?? 1)]);
    for (let k = 0; k + 1 < R.length; k++) for (let i = 0; i < segs; i++) {
      const t0 = Math.PI * 2 * i / segs, t1 = Math.PI * 2 * (i + 1) / segs, [ra, ca] = R[k], [rb, cb] = R[k + 1];
      this.quad([cx + Math.cos(t0) * ra, cy + Math.sin(t0) * ra * sy], [cx + Math.cos(t0) * rb, cy + Math.sin(t0) * rb * sy], [cx + Math.cos(t1) * rb, cy + Math.sin(t1) * rb * sy], [cx + Math.cos(t1) * ra, cy + Math.sin(t1) * ra * sy], null, l, 1, [ca, cb, cb, ca]);
    }
    return this;
  }
  /**
   * A lit grid (walls, floors, ceilings): cells of ~`cell` m so the lights shade it smoothly; `holes` [{x0,y0,x1,y1}] are
   * left open (windows, doors); colFn(u, v) -> '#hex' for painted gradients (optional).
   */
  grid(x0, y0, x1, y1, color, o = {}) {
    const cell = o.cell ?? .45, holes = o.holes || [], l = o.l ?? 0;
    const bx = new Set([x0, x1]), by = new Set([y0, y1]);
    for (let x = x0 + cell; x < x1 - 1e-3; x += cell) bx.add(+x.toFixed(4));
    for (let y = y0 + cell; y < y1 - 1e-3; y += cell) by.add(+y.toFixed(4));
    for (const h of holes) { for (const v of [h.x0, h.x1]) if (v > x0 && v < x1) bx.add(v); for (const v of [h.y0, h.y1]) if (v > y0 && v < y1) by.add(v); }
    const xs = [...bx].sort((a, b) => a - b), ys = [...by].sort((a, b) => a - b), base = this._c(color);
    // colFn returns FINAL colours (e.g. mul(ctx.c('wall'), k))
    const cAt = o.colFn ? (u, v) => { const c = o.colFn(u, v); return this._c(typeof c === 'string' && c[0] === '#' ? '!' + c : c); } : () => base;
    for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < ys.length; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
      if (holes.some(h => cx > h.x0 && cx < h.x1 && cy > h.y0 && cy < h.y1)) continue;
      const P = [[xs[i], ys[j]], [xs[i + 1], ys[j]], [xs[i + 1], ys[j + 1]], [xs[i], ys[j + 1]]];
      this.quad(...P, null, l, 1, P.map(p => cAt(p[0], p[1])));
    }
    return this;
  }
  /** horizontal / vertical thin lines across a rect, skipping holes (tile grout, wallpaper stripes, planks, blocks) */
  hlines(x0, x1, ys, w, color, l, holes = []) { for (const y of ys) for (const [a, b] of cut1(x0, x1, holes.filter(h => y + w / 2 > h.y0 && y - w / 2 < h.y1).map(h => [h.x0, h.x1]))) this.rect(a, y - w / 2, b, y + w / 2, color, l); return this; }
  vlines(y0, y1, xs, w, color, l, holes = []) { for (const x of xs) for (const [a, b] of cut1(y0, y1, holes.filter(h => x + w / 2 > h.x0 && x - w / 2 < h.x1).map(h => [h.y0, h.y1]))) this.rect(x - w / 2, a, x + w / 2, b, color, l); return this; }
  mesh() {
    if (!this.nv) return null;
    let g = this.key ? GEO.get(this.key) : null;
    if (!g) {
      // the set's lights shade every vertex (done here, so lights registered after a shape was drawn still reach it)
      if (this.lit && this.ctx?.lights.length) { const n = this.kind === 'solid' ? 3 : 4; for (let i = 0; i < this.nv; i++) { const L = this.ctx.lightAt([this.pos[i * 3] + this.off[0], this.pos[i * 3 + 1] + this.off[1], this.pos[i * 3 + 2] + this.off[2]]); this.col[i * n] *= L[0]; this.col[i * n + 1] *= L[1]; this.col[i * n + 2] *= L[2]; } }
      g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, this.kind === 'solid' ? 3 : 4));
      g.setIndex(this.nv > 65000 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
      g.computeBoundingSphere(); g.computeBoundingBox();
      if (this.key) { g.userData.shared = true; GEO.set(this.key, g); if (GEO.size > 400) { const k0 = GEO.keys().next().value; GEO.delete(k0); } }
    }
    const m = new THREE.Mesh(g, vmat(this.kind)); m.name = this.name; m.frustumCulled = false;
    if (this.kind !== 'solid') { m.renderOrder = this.order ?? (this.kind === 'add' ? 6 : 2); m.userData.noPick = true; }
    return m;
  }
}
/** the parts of [a, b] outside the intervals */
function cut1(a, b, iv) { let parts = [[a, b]]; for (const [h0, h1] of iv) parts = parts.flatMap(([p, q]) => h1 <= p || h0 >= q ? [[p, q]] : [[p, Math.min(q, h0)], [Math.max(p, h1), q]].filter(([u, v]) => v - u > 1e-4)); return parts; }

// plane maps
export const XY = (z, step = Z.step) => (u, v, l) => [u, v, z + l * step];
export const XZ = (y, step = Z.step) => (u, v, l) => [u, y + l * step, v];          // floors (u = x, v = z), layers go up (step < 0 for ceilings)
/** a side wall: from the back corner (x, z0) toward the camera, splayed `splay` radians inward; u = distance along it, v = y; layers step into the room */
export const SIDE = (x, z0, dir, splay = 0, step = Z.step) => { const s = Math.sin(splay), c = Math.cos(splay); return (u, v, l) => [x + dir * u * s + dir * l * step * c, v, z0 + u * c - l * step * s]; };

// =====================================================================================================================
// the set context
// =====================================================================================================================
/**
 * ctx = setCtx(S, name, o, spec): spec = { pal: { key: '#hex' }, moods: { night: { key: '#hex' } }, mood: default, D, H, x0, x1, family }
 * ctx.c(colour) mood colour; ctx.at(z) a painter at depth z; ctx.wall (on the back wall); ctx.shadow (wall drop shadows);
 * ctx.light({ p, color, gain, rh, rc, glow }); ctx.spot(name, {...}); ctx.add(obj); finish(ctx) -> the place result.
 */
export function setCtx(S, name, o = {}, spec = {}) {
  const moodName = MOODS[o.mood] ? o.mood : (spec.mood || 'day'), M0 = MOODS[moodName];
  // a set may grade a mood like another one (the office's base palette IS its lit night: night grades like day)
  const ga = spec.gradeAs?.[moodName], M = ga ? { ...M0, ...(typeof ga === 'string' ? { k: MOODS[ga].k, sat: MOODS[ga].sat, tint: MOODS[ga].tint } : ga) } : M0;
  const D = o.depth ?? spec.D ?? ROOM.D, H = spec.H === null ? null : (o.height ?? spec.H ?? ROOM.H);
  const ctx = {
    S, name, o, spec, mood: moodName, M, D, H, z: -D, x0: spec.x0 ?? -6, x1: spec.x1 ?? 6, family: spec.family || 'room',
    seed: o.seed ?? 1, key: `${name}|${moodName}|${JSON.stringify(o)}`,
    lights: [], holes: [], views: [], glows: [], objs: [], spots: {}, painters: new Map(), updates: [], doors: {},
    pal: { ...(spec.pal || {}), ...((spec.moods || {})[moodName] || {}), ...(o.colors || {}) },
    rawPal: spec.pal || {}, moodPal: (spec.moods || {})[moodName] || {},
  };
  ctx.R = rnd(strHash(name) + (ctx.seed * 7919));
  ctx.propStyle = spec.family === 'stage' ? (spec.propStyle ?? 'silhouette') : spec.propStyle;
  // props placed later by the builder (S.prop) take the set's mood (the prop library knows day / dusk / night / candle)
  ctx.propMood = spec.propMood?.[moodName] || PROP_MOOD[moodName] || 'day';
  S.mood = ctx.propMood; S.moodName = moodName; S.moodGrade = M;   // S.tone('#hex') grades a builder's own cards the same way
  /** a colour for this mood: '#hex' graded, '!#hex' as is, a palette key (mood override or graded base) */
  ctx.c = c => {
    if (typeof c !== 'string') return c;
    if (c[0] === '!') return c;
    if (c[0] === '#') return '!' + grade(c, M);
    if (o.colors?.[c]) return o.colors[c][0] === '!' ? o.colors[c] : '!' + grade(o.colors[c], M);
    if (ctx.moodPal[c]) return ctx.moodPal[c][0] === '!' ? ctx.moodPal[c] : '!' + ctx.moodPal[c];
    if (ctx.rawPal[c]) return ctx.c(ctx.rawPal[c]);
    // structural keys a set may leave out: derived from the wall / floor the notes' way (plane tints)
    const DER = { ceiling: ['wall', .85], cornice: ['wall', 1.1], skirting: ['wall', .8], side: ['wall', .7], doorFrame: ['wall', 1.22], line: ['floor', .82] };
    if (DER[c] && (ctx.rawPal[DER[c][0]] || ctx.moodPal[DER[c][0]])) return mul(ctx.c(DER[c][0]), DER[c][1]);
    const FIX = { door: '#4a3c30', winFrame: '#e2ded4', curtain: '#d6b77a', floor: '#6b4a33', wall: '#a08f7b' };
    if (FIX[c]) return ctx.c(FIX[c]);
    console.warn(`place ${name}: no colour "${c}"`); return '!#ff00ff';
  };
  /** a shade of a (palette) colour: ctx.k('wall', .77) */
  ctx.k = (c, k) => mul(ctx.c(c), k);
  ctx.spot = (nm, s) => { ctx.spots[nm] = { y: 0, kind: 'stand', facing: 0, ...s }; return ctx.spots[nm]; };
  ctx.on = moods => !moods || moods === true || (Array.isArray(moods) ? moods.includes(moodName) : moods === 'lamps' ? !!M.lamps : moods === 'sun' ? !!M.sun : moods === moodName);
  /** the light multiplier at a world point (linear rgb) */
  ctx.lightAt = w => {
    let r = 1, g = 1, b = 1;
    for (const L of ctx.lights) {
      const dx = w[0] - L.p[0], dy = (w[1] - L.p[1]) * (L.sy ?? 1), dz = (w[2] - L.p[2]) * (L.sz ?? 1);
      let d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (L.cone) { if (w[1] > L.p[1] + .05) continue; const half = Math.atan2(Math.abs(dx), Math.max(.05, L.p[1] - w[1])); const e = 1 - smoothstep(L.cone - .12, L.cone + .1, half); if (e <= 0) continue; d = Math.max(0, d) * .6; const f = Math.exp(-.693 * d / L.rh) * e * L.gain; r += L.lc[0] * f; g += L.lc[1] * f; b += L.lc[2] * f; continue; }
      if (d > L.rc) continue;
      const f = Math.exp(-.693 * d / L.rh) * (1 - smoothstep(L.rc * .6, L.rc, d)) * L.gain;
      r += L.lc[0] * f; g += L.lc[1] * f; b += L.lc[2] * f;
    }
    return [r, g, b];
  };
  ctx.at = (z, o2 = {}) => { const k = `${o2.kind || 'solid'}|${z.toFixed(4)}|${o2.order ?? ''}`; let p = ctx.painters.get(k); if (!p) { p = new Painter(ctx, { kind: o2.kind, map: XY(z), order: o2.order, key: ctx.key + '|' + k, lit: o2.lit }); ctx.painters.set(k, p); } return p; };
  ctx.wall = ctx.at(-D + .002);
  ctx.shadow = ctx.at(-D + .0012, { kind: 'alpha', order: 1 });
  ctx.addGlow = ctx.at(-D + .02, { kind: 'add', order: 6 });
  return ctx;
}
export const strHash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/** light colours are emissive: '#hex' is used as is (not graded by the mood); palette keys resolve through the mood */
export const emi = (ctx, c) => c[0] === '#' ? '!' + c : ctx.c(c);
/** a practical light: lights vertices (walls, floor, items) and draws its glow. moods: 'lamps' (on when the mood has lamps), 'sun', [names], true */
export function light(ctx, L) {
  if (!ctx.on(L.moods ?? true)) return null;
  const col = emi(ctx, L.color || '#ffd9a8'), lc = lin(col), mx = Math.max(...lc) || 1;
  const e = { p: L.p, lc: lc.map(v => v / mx), gain: L.gain ?? 1.2, rh: L.rh ?? .8, rc: L.rc ?? (L.rh ?? .8) * 3.2, sy: L.sy, sz: L.sz, cone: L.cone };
  ctx.lights.push(e);
  if (L.glow !== false) glowAt(ctx, L.p[0], L.p[1], L.p[2] + (L.gz ?? .05), { r: L.gr ?? (L.rh ?? .8) * 2.2, color: col, peak: L.peak ?? .25, core: L.core });
  return e;
}
/** an additive soft glow (the measured exponential falloff), a few rings */
export function glowAt(ctx, x, y, z, o = {}) {
  const P = new Painter(ctx, { kind: 'add', map: XY(z), order: o.order ?? 7, lit: false });
  const c = o.color || '#ffd9a8', pk = o.peak ?? .25, r = o.r ?? 1, sy = o.sy ?? 1, cA = lin(c.replace('!', ''));
  const ring = k => { const f = Math.exp(-2.8 * k) * (1 - smoothstep(.6, 1, k)); return [r * k, [cA[0] * pk * f, cA[1] * pk * f, cA[2] * pk * f, 1]]; };
  const small = r * Math.max(1, sy) < .9, rings = (small ? [0, .06, .16, .32, .52, .75, 1] : [0, .04, .1, .18, .28, .4, .55, .72, .86, 1]).map(ring);
  if (o.core) rings[0][1] = rings[0][1].map((v, i) => i < 3 ? v * (1 + o.core) : v);
  P.radial(x, y, rings.map(([rr, cc]) => [rr, cc]), 0, small ? 20 : 40, sy);
  ctx.glows.push(P); return P;
}

// =====================================================================================================================
// the room shell
// =====================================================================================================================
/**
 * shell(ctx, { wall, ceiling, cornice, skirting, floor: { kind, color, line }, side: 'both'|'left'|'right'|'none', splay,
 *   wallTex: { kind: 'tiles'|'stripes'|'planks'|'blocks'|'bricks'|'panels', ... }, wainscot })
 */
export function shell(ctx, s = {}) {
  const D = ctx.D, H = ctx.H, x0 = ctx.x0, x1 = ctx.x1, z = -D, top = H ?? (s.wallTop ?? 7);
  const W = new Painter(ctx, { map: XY(z), key: ctx.key + '|wallgrid' });
  const holes = ctx.holes;
  W.grid(x0 - (s.side === 'none' || !H ? 3 : 0), 0, x1 + (s.side === 'none' || !H ? 3 : 0), top, s.wall || 'wall', { holes, cell: .5, colFn: s.wallFn });
  ctx.objs.push(W.mesh());
  const P = ctx.wall;
  // wall textures
  const T = s.wallTex;
  if (T) wallTexture(ctx, P, T, x0, x1, T.y0 ?? 0, T.y1 ?? top, holes);
  // wainscot (stage family / corridors): a lower band in another tone + a rail line
  if (s.wainscot) { const wc = s.wainscot; for (const [a, b] of cut1(x0 - 3, x1 + 3, holes.filter(h => h.y0 < wc.h).map(h => [h.x0, h.x1]))) { P.rect(a, 0, b, wc.h, wc.color, 1); P.rect(a, wc.h - .012, b, wc.h + .012, wc.line || mul(ctx.c(wc.color), .8), 2); } }
  // cornice (lighter strip under the ceiling) + skirting
  if (H && s.cornice !== false) { const cc = s.cornice || 'cornice'; P.rect(x0, H - .075, x1, H, cc, 2); P.rect(x0, H - .085, x1, H - .075, mul(ctx.c(cc), .86), 2); }
  if (s.skirting !== false) { const sk = s.skirting || 'skirting', sh = s.skirtH ?? .09; for (const [a, b] of cut1(x0 - (H ? 0 : 3), x1 + (H ? 0 : 3), holes.filter(h => h.y0 < sh).map(h => [h.x0, h.x1]))) { P.rect(a, 0, b, sh, sk, 3); P.rect(a, sh, b, sh + .012, mul(ctx.c(sk), 1.12), 3); } }
  // ceiling
  if (H) {
    const C = new Painter(ctx, { map: XZ(H, -Z.step), key: ctx.key + '|ceil' });
    C.grid(x0, z, x1, ROOM.front, s.ceiling || 'ceiling', { cell: .6, colFn: s.ceilFn });
    for (const f of s.ceilItems || []) f(C);
    ctx.objs.push(C.mesh());
  }
  // side walls (thin wedges at the frame edges in a wide; splayed so their junction lines rake like the references')
  const splay = s.splay ?? 0;
  if (H && s.side !== 'none') for (const [x, dir, on] of [[x0, 1, s.side !== 'right'], [x1, -1, s.side !== 'left']]) {
    if (!on) continue;
    const SW = new Painter(ctx, { map: SIDE(x, z, dir, splay), key: ctx.key + '|side' + dir });
    const len = (ROOM.front - z) / Math.cos(splay);
    SW.grid(0, 0, len, H, s.sideWall || 'side', { cell: .7 });
    SW.rect(0, 0, len, s.skirtH ?? .09, mul(ctx.c(s.skirting || 'skirting'), .78), 1);
    if (s.cornice !== false) SW.rect(0, H - .075, len, H, mul(ctx.c(s.cornice || 'cornice'), .74), 1);
    for (const f of s.sideItems || []) f(SW, dir);
    ctx.objs.push(SW.mesh());
  }
  floor(ctx, s.floor || {}, s);
}
/** wall textures drawn the reference way: thin lines only a few % darker than the wall */
export function wallTexture(ctx, P, T, x0, x1, y0, y1, holes) {
  const base = ctx.c(T.color || 'wall'), line = T.line ? ctx.c(T.line) : mul(base, T.k ?? .93), l = T.l ?? 1, R = rnd(strHash(ctx.name + T.kind));
  if (T.kind === 'stripes') { const sw = T.w ?? .28; let k = 0; for (let x = x0; x < x1; x += sw, k++) if (k % 2) for (const [a, b] of cut1(y0, y1, holes.filter(h => x + sw > h.x0 && x < h.x1).map(h => [h.y0, h.y1]))) P.rect(x, a, Math.min(x1, x + sw), b, mul(base, T.k ?? .95), l); }
  else if (T.kind === 'tiles') { const s = T.s ?? .15, ys = [], xs = []; for (let y = y0 + s; y < y1 - 1e-3; y += s) ys.push(y); for (let x = x0 + s; x < x1 - 1e-3; x += s) xs.push(x); P.hlines(x0, x1, ys, T.w ?? .012, line, l, holes); P.vlines(y0, y1, xs, T.w ?? .012, line, l, holes); }
  else if (T.kind === 'planks') { const s = T.s ?? .22, xs = []; for (let x = x0 + s; x < x1; x += s) xs.push(x); P.vlines(y0, y1, xs, T.w ?? .012, line, l, holes); }
  else if (T.kind === 'siding') { const s = T.s ?? .16, ys = []; for (let y = y0 + s; y < y1; y += s) ys.push(y); P.hlines(x0, x1, ys, T.w ?? .014, line, l, holes); }
  else if (T.kind === 'blocks' || T.kind === 'bricks') {
    const bw = T.bw ?? (T.kind === 'bricks' ? .5 : .86), bh = T.bh ?? (T.kind === 'bricks' ? .15 : .35), w = T.w ?? (T.kind === 'bricks' ? .02 : .012);
    const ys = []; for (let y = y0 + bh; y < y1; y += bh) ys.push(y); P.hlines(x0, x1, ys, w, line, l, holes);
    let row = 0; for (let y = y0; y < y1; y += bh, row++) { const off = row % 2 ? bw / 2 : 0, xs = []; for (let x = x0 + off; x < x1; x += bw) xs.push(x); P.vlines(y, Math.min(y1, y + bh), xs, w, line, l, holes);
      if (T.kind === 'bricks') for (let x = x0 + off - bw; x < x1; x += bw) { const k = R(); if (k < .45) continue; const col = mul(base, .9 + R() * .2); for (const [a, b] of cut1(Math.max(x0, x + w / 2), Math.min(x1, x + bw - w / 2), holes.filter(h => y + bh > h.y0 && y < h.y1).map(h => [h.x0, h.x1]))) P.rect(a, y + w / 2, b, Math.min(y1, y + bh - w / 2), col, l - .5 > 0 ? l - .5 : 0); } }
  }
  else if (T.kind === 'panels') { const s = T.s ?? 1.2; const xs = []; for (let x = x0 + s; x < x1; x += s) xs.push(x); P.vlines(y0, y1, xs, T.w ?? .02, line, l, holes); }
  else if (T.kind === 'concrete') { const s = T.s ?? 1.5, xs = [], ys = []; for (let x = x0 + s; x < x1; x += s) xs.push(x); for (let y = y0 + s * .66; y < y1; y += s * .66) ys.push(y); P.hlines(x0, x1, ys, .01, line, l, holes); P.vlines(y0, y1, xs, .01, line, l, holes);
    for (let x = x0 + s / 2; x < x1; x += s) for (let y = y0 + s * .33; y < y1; y += s * .66) if (!holes.some(h => x > h.x0 - .1 && x < h.x1 + .1 && y > h.y0 - .1 && y < h.y1 + .1)) P.circle(x, y, .018, mul(base, .88), l, 1, 8); }
}

// =====================================================================================================================
// floors
// =====================================================================================================================
/**
 * floor(ctx, { kind: 'planks'|'tiles'|'flat'|'concrete'|'carpet'|'grass'|'asphalt'|'paving', color, line, sheen })
 * Planks are drawn the references' way: the lines fan from a point far above the frame (a stylised raked stage floor),
 * not toward the room's vanishing point: in 3D they converge on a point in front of the wide camera.
 */
export function floor(ctx, f = {}, s = {}) {
  const z0 = -ctx.D, z1 = f.z1 ?? ROOM.front, x0 = f.x0 ?? ctx.x0 - (s.side === 'none' || !ctx.H ? 4 : 0), x1 = f.x1 ?? ctx.x1 + (s.side === 'none' || !ctx.H ? 4 : 0);
  const kind = f.kind || 'planks', col = f.color || 'floor';
  const P = new Painter(ctx, { map: XZ(0), key: ctx.key + '|floor' });
  const base = ctx.c(col);
  // brightness: a lighter sheen ellipse under the action (stage family) and a slight darkening toward the camera
  const sh = f.sheen, cf = (u, v) => { let k = 1 - clamp((v - 1.5) / 6) * (f.front ?? .14); if (sh) { const d = Math.hypot((u - (sh.x ?? 0)) / (sh.rx ?? 3.5), (v - (sh.z ?? 0)) / (sh.rz ?? 1.6)); k *= 1 + (sh.k ?? .15) * (1 - smoothstep(0, 1, d)); } return mul(base, k); };
  P.grid(x0, z0, x1, z1, base, { cell: .5, colFn: (u, v) => cf(u, v) });
  const R = rnd(strHash(ctx.name + 'floor') + ctx.seed);
  if (kind === 'planks') {
    const line = f.line ? ctx.c(f.line) : mul(base, .82), fz = f.fanZ ?? 12.5, sw = f.s ?? .19, cx = f.cx ?? (x0 + x1) / 2;
    // lines from the back wall toward the fan point (cx, fz); width tapers so it stays ~2.5 px on screen in the wide
    const ww = d => .0105 * d / 12.5;
    const n0 = Math.floor((x0 - cx) / sw * 1.6), n1 = Math.ceil((x1 - cx) / sw * 1.6);
    const zEnd = Math.min(z1, 5.5);
    for (let i = n0; i <= n1; i++) {
      const xb = cx + i * sw, at = zz => [lerp(xb, cx, (zz - z0) / (fz - z0)), zz];
      const a = at(z0), b = at(zEnd); if (Math.max(a[0], b[0]) < x0 - .5 || Math.min(a[0], b[0]) > x1 + .5) continue;
      P.seg(a[0], a[1], b[0], b[1], ww(9 - z0), line, 1, 1, ww(9 - zEnd));
      // staggered butt joints across the plank
      let zz = z0 + R() * 1.8; while (zz < zEnd - .3) { const p = at(zz), q = [lerp(cx + (i + 1) * sw, cx, (zz - z0) / (fz - z0)), zz]; P.seg(p[0], p[1], q[0], q[1], .016, line, 1); zz += 1.6 + R() * 2.2; }
    }
  } else if (kind === 'tiles' || kind === 'paving') {
    const line = f.line ? ctx.c(f.line) : mul(base, .86), s2 = f.s ?? (kind === 'paving' ? .6 : .45), w = f.w ?? .012;
    for (let x = Math.ceil(x0 / s2) * s2; x < x1; x += s2) P.seg(x, z0, x, z1, w, line, 1);
    for (let zz = z0 + s2; zz < z1; zz += s2) P.seg(x0, zz, x1, zz, w * 1.4, line, 1);
  } else if (kind === 'carpet' || kind === 'concrete' || kind === 'asphalt') {
    if (kind === 'concrete') { const line = mul(base, .9); for (let zz = z0 + 2.2; zz < z1; zz += 2.6) P.seg(x0, zz, x1, zz, .02, line, 1); }
  } else if (kind === 'grass') {
    const dark = mul(base, .86); let k = 0; for (let x = Math.floor(x0 / 1.4) * 1.4; x < x1; x += 1.4, k++) if (k % 2) P.quad([x, z0], [x + 1.4, z0], [x + 1.4 + 1.2, z1], [x + 1.2, z1], dark, 1);
  }
  for (const fn of f.items || []) fn(P);
  ctx.floorP = P;
  ctx.objs.push(P.mesh());
}

// =====================================================================================================================
// built-ins on the back wall (x in metres along the wall, y up from the floor)
// =====================================================================================================================
const Wd = ctx => ctx.wall;
/** a hard drop shadow for a wall-hung item: offset (+0.045, -0.065) m, wall x 0.83 */
export function dropShadow(ctx, x0, y0, x1, y1, round = false) {
  const dx = .045, dy = -.065;
  if (round) ctx.shadow.ellipse((x0 + x1) / 2 + dx, (y0 + y1) / 2 + dy, (x1 - x0) / 2, (y1 - y0) / 2, '!#000000', 0, .17);
  else ctx.shadow.rect(x0 + dx, y0 + dy, x1 + dx, y1 + dy, '!#000000', 0, .17);
}
/**
 * door(ctx, x, { w, h, state: 'closed'|'open'|'lit'|'ajar', color, frame, panels, hinge: 'left'|'right', name, sign })
 * cuts a hole; the leaf is its own mesh so it can swing open (r.doors[name].open(at, dur)); a lit doorway throws a light
 * patch onto the floor. Spot `name` (default 'door') = standing in the doorway.
 */
export function door(ctx, x, o = {}) {
  const w = o.w ?? .95, h = o.h ?? 2.15, fr = o.frameW ?? .07, z = ctx.z, name = o.name || 'door', P = Wd(ctx);
  const st = o.state || 'closed', hole = { x0: x - w / 2, y0: 0, x1: x + w / 2, y1: h };
  ctx.holes.push(hole);
  const fc = o.frame || 'doorFrame';
  P.rect(x - w / 2 - fr, 0, x - w / 2, h + fr, fc, 4); P.rect(x + w / 2, 0, x + w / 2 + fr, h + fr, fc, 4); P.rect(x - w / 2 - fr, h, x + w / 2 + fr, h + fr, fc, 4);
  P.rect(x - w / 2 - fr, h + fr - .012, x + w / 2 + fr, h + fr, mul(ctx.c(fc), 1.12), 5);
  P.rect(x - w / 2, h - .01, x + w / 2, h, mul(ctx.c(fc), .8), 5);
  // behind the door: the next room (dark, or warm light)
  const lit = st === 'lit' || st === 'litAjar' || (st === 'auto' && ctx.M.lamps);
  const back = new Painter(ctx, { map: XY(z - .6), key: ctx.key + '|doorback|' + name, lit: false });
  const bc = lit ? (o.litColor || (ctx.mood === 'night' || ctx.mood === 'blue' ? '!#867764' : '!#eccb9c')) : (o.back || mul(ctx.c('#3a3029'), .7));
  back.gradV(x - w, -.1, x + w, h + .5, bc, lit ? mul(bc, .86) : bc);
  if (!lit) back.rect(x - w, -.1, x + w, .05, mul(ctx.c('#3a3029'), .5), 1);
  ctx.objs.push(back.mesh());
  if (lit) {
    // light patch on the floor in front of the doorway + a soft glow
    const F = new Painter(ctx, { kind: 'add', map: XZ(.004), order: 3, lit: false }); const lc = lin(bc.replace('!', '')), k = o.patch ?? .35;
    const c0 = [lc[0] * k, lc[1] * k, lc[2] * k, 1], c1 = [0, 0, 0, 1];
    F.quad([x - w / 2, z + .01], [x + w / 2, z + .01], [x + w / 2 + .5, z + 2.4], [x - w / 2 - .5, z + 2.4], null, 0, 1, [c0, c0, c1, c1]);
    ctx.glows.push(F);
    ctx.lights.push({ p: [x, 1, z + .2], lc: lc.map(v => v / Math.max(...lc)), gain: .5, rh: .9, rc: 2.6 });
  }
  // the leaf (own mesh, pivot at the hinge)
  const hinge = o.hinge === 'right' ? 1 : -1, leafC = o.color || 'door';
  if (st !== 'open' && st !== 'lit') {
    const L = new Painter(ctx, { map: XY(0), key: ctx.key + '|leaf|' + name, off: [x + hinge * w / 2, 0, z] });
    const lx0 = hinge < 0 ? 0 : -w, lx1 = hinge < 0 ? w : 0;
    L.rect(lx0, 0, lx1, h, leafC, 0);
    if (o.panels) { const m = .12; L.rect(lx0 + m, h * .55, lx1 - m, h - m, mul(ctx.c(leafC), .9), 1); L.rect(lx0 + m, m + .1, lx1 - m, h * .5, mul(ctx.c(leafC), .9), 1);
      L.rect(lx0 + m, h * .55, lx1 - m, h * .55 + .012, mul(ctx.c(leafC), 1.12), 2); L.rect(lx0 + m, m + .1, lx1 - m, m + .112, mul(ctx.c(leafC), 1.12), 2); }
    if (o.glass) L.rect(lx0 + w * .25, h * .62, lx1 - w * .25, h * .9, o.glass, 1);
    if (o.sign) { /* text drawn separately */ }
    const hx = hinge < 0 ? lx1 - .09 : lx0 + .09;
    L.rrect(hx - .016, 1.0, hx + .016, 1.0 + .03, .01, o.handle || '#c9c4b8', 3); L.rect(hinge < 0 ? hx - .07 : hx - .01, 1.005, hinge < 0 ? hx + .01 : hx + .07, 1.025, o.handle || '#c9c4b8', 3);
    const leaf = L.mesh(); leaf.position.set(x + hinge * w / 2, 0, z + .001);
    const g = new THREE.Group(); g.add(leaf); ctx.objs.push(g);
    const ajar = st === 'ajar' || st === 'litAjar' ? .45 : 0, keys = [];
    leaf.scale.x = Math.cos(ajar * Math.PI / 2);
    const ctl = { leaf, keys, open(at, dur = .7, to = 1) { keys.push([at, dur, to]); keys.sort((a, b) => a[0] - b[0]); return ctl; }, close(at, dur = .6) { return ctl.open(at, dur, 0); } };
    leaf.userData.update = t => { let v = ajar; for (const [a, d, to] of keys) { if (t < a) break; const k = clamp((t - a) / d); v = lerp(v, to, k * k * (3 - 2 * k)); } leaf.scale.x = Math.max(.03, Math.cos(v * Math.PI * .47)); };
    ctx.doors[name] = ctl;
  } else ctx.doors[name] = { open() { return this; }, close() { return this; } };
  if (o.sign) sign(ctx, o.sign, x, h + .22, z + .02, { size: .09, color: o.signColor || '#e8e4da', bg: o.signBg || '#2d6a4a' });
  ctx.spot(name, { x, z: z + .35, kind: 'door', facing: 0, side: o.hinge || 'left', opens: 'in', w, h });
  return hole;
}
/**
 * win(ctx, x, { w, h, sill (height of the glass bottom), panes: [cols, rows], frame, curtains, rod, view, blinds, rain, shaft, plant })
 * A window: a hole in the wall, frame + mullions, a sill, curtains, the view behind (sky + city / trees / houses for the
 * mood), a faint glass haze, a light shaft in daylight.
 */
export function win(ctx, x, o = {}) {
  const w = o.w ?? 1.8, h = o.h ?? 1.3, y0 = o.sill ?? 1.0, y1 = y0 + h, z = ctx.z, P = Wd(ctx), fr = o.frameW ?? .055;
  ctx.holes.push({ x0: x - w / 2, y0, x1: x + w / 2, y1 });
  ctx.views.push({ x0: x - w / 2, x1: x + w / 2, y0, y1, view: o.view ?? 'city' });
  const fc = o.frame || 'winFrame', [cols, rows] = o.panes || [2, 1];
  // frame + mullions
  P.rect(x - w / 2 - fr, y0 - fr, x + w / 2 + fr, y0, fc, 4); P.rect(x - w / 2 - fr, y1, x + w / 2 + fr, y1 + fr, fc, 4);
  P.rect(x - w / 2 - fr, y0, x - w / 2, y1, fc, 4); P.rect(x + w / 2, y0, x + w / 2 + fr, y1, fc, 4);
  for (let i = 1; i < cols; i++) { const xx = x - w / 2 + w * i / cols; P.rect(xx - fr * .45, y0, xx + fr * .45, y1, fc, 4); }
  for (let j = 1; j < rows; j++) { const yy = y0 + h * j / rows; P.rect(x - w / 2, yy - fr * .4, x + w / 2, yy + fr * .4, fc, 4); }
  // glass haze (lighter toward the bottom) on its own transparent layer
  const G = ctx.at(z + .004, { kind: 'alpha', order: 2 });
  G.gradV(x - w / 2, y0, x + w / 2, y1, ctx.M.sky === 'night' ? '!#8090b0' : '!#ffffff', '!#ffffff', 0, ctx.M.sky === 'night' ? .05 : (o.haze ?? .09), .01);
  if (o.rain) { const R = rnd(strHash(ctx.name + 'rain' + x)); for (let i = 0; i < w * 22; i++) { const rx = x - w / 2 + R() * w, ry = y0 + R() * (h - .12); G.rect(rx, ry, rx + .006, ry + .05 + R() * .07, '!#c8d0e0', 1, .35); } }
  // sill
  if (o.sillLedge !== false) { P.rect(x - w / 2 - fr - .07, y0 - fr - .05, x + w / 2 + fr + .07, y0 - fr, o.sillColor || fc, 5); P.rect(x - w / 2 - fr - .07, y0 - fr - .062, x + w / 2 + fr + .07, y0 - fr - .05, mul(ctx.c(o.sillColor || fc), .78), 5); }
  // curtains
  if (o.curtains) {
    const cc = o.curtains === true ? 'curtain' : o.curtains, cw = o.curtainW ?? .36, top = y1 + .14, bot = o.curtainLong ? .05 : y0 - .25;
    for (const s of [-1, 1]) {
      const cx0 = s < 0 ? x - w / 2 - cw * .6 : x + w / 2 - cw * .4, cx1 = cx0 + cw;
      P.rect(cx0, bot, cx1, top, cc, 6);
      for (let k = 1; k < 4; k++) P.rect(cx0 + cw * k / 4 - .006, bot + .03, cx0 + cw * k / 4 + .006, top - .02, mul(ctx.c(cc), .8), 7);
      P.rect(cx0, bot, cx1, bot + .025, mul(ctx.c(cc), .85), 7);
      dropShadow(ctx, cx0, bot, cx1, top);
    }
    P.rect(x - w / 2 - cw * .8, top, x + w / 2 + cw * .8, top + .025, o.rod || '#6d5a44', 8);
  }
  if (o.blinds) { for (let yy = y1 - .04; yy > y1 - h * (o.blinds === true ? .35 : o.blinds); yy -= .045) P.rect(x - w / 2, yy - .03, x + w / 2, yy, mul(ctx.c(o.blindColor || '#d8d2c4'), 1), 6); }
  if (o.plant) plant(ctx, P, x + w * (o.plant === 'left' ? -.32 : .32), y0 - fr, { s: .8, l: 9 });
  // daylight shaft through the window, onto the floor (additive bands at ~55 deg)
  if ((o.shaft ?? true) && ctx.M.sun) shaft(ctx, x, y0, y1, w, { dir: o.shaftDir ?? -1, color: o.shaftColor, k: o.shaftK });
  if ((o.shaft ?? true) && (ctx.mood === 'night' || ctx.mood === 'blue') && o.moon) shaft(ctx, x, y0, y1, w, { dir: o.shaftDir ?? -1, color: '#9fb4d8', k: .06 });
  return { x0: x - w / 2, x1: x + w / 2, y0, y1 };
}
/** parallel additive light bands from a window toward the floor (+15 L warm white, soft edges) */
export function shaft(ctx, x, y0, y1, w, o = {}) {
  const A = new Painter(ctx, { kind: 'add', map: XY(ctx.z + (o.dz ?? 1.4)), order: 5, lit: false });
  const col = lin(emi(ctx, o.color || '#fff1d6')), k = o.k ?? .085, dir = o.dir ?? -1, ang = o.angle ?? .95;   // 55 deg
  const band = (xa, wa, kk) => {
    const dx = dir * Math.tan(ang) * 0, L = y1 + .2, sx = dir * Math.cos(ang) / Math.sin(ang) * L;
    const c0 = [0, 0, 0, 1], c1 = [col[0] * kk, col[1] * kk, col[2] * kk, 1];
    // a parallelogram from the window down to the floor, soft on both long edges (3 strips)
    const p = (xx, yy) => [xx + dx, yy];
    const s = wa * .25;
    A.quad(p(xa, y1), p(xa + s, y1), p(xa + s + sx, -.1), p(xa + sx, -.1), null, 0, 1, [c0, c1, c1, c0]);
    A.quad(p(xa + s, y1), p(xa + wa - s, y1), p(xa + wa - s + sx, -.1), p(xa + s + sx, -.1), null, 0, 1, [c1, c1, c1, c1]);
    A.quad(p(xa + wa - s, y1), p(xa + wa, y1), p(xa + wa + sx, -.1), p(xa + wa - s + sx, -.1), null, 0, 1, [c1, c0, c0, c1]);
  };
  band(x - w / 2 + w * .05, w * .4, k); band(x + w * .08, w * .34, k * .8);
  ctx.glows.push(A);
}
/** wall clock: white face, black ring, 12 ticks, hands at `time` [h, m]; the red second hand turns (one mesh) */
export function clock(ctx, x, y, o = {}) {
  const r = o.r ?? .16, P = Wd(ctx), l = o.l ?? 4;
  dropShadow(ctx, x - r, y - r, x + r, y + r, true);
  P.circle(x, y, r, o.ring || '#26262a', l); P.circle(x, y, r * .86, o.face || '#f1efe8', l + 1);
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, r0 = r * (i % 3 ? .7 : .64); P.seg(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r * .78, y + Math.sin(a) * r * .78, r * (i % 3 ? .035 : .06), '#2a2a2e', l + 2); }
  const [hh, mm] = o.time || [7, 40], ha = Math.PI / 2 - (hh % 12 + mm / 60) * Math.PI / 6, ma = Math.PI / 2 - mm * Math.PI / 30;
  P.seg(x, y, x + Math.cos(ha) * r * .45, y + Math.sin(ha) * r * .45, r * .075, '#1e1e22', l + 3);
  P.seg(x, y, x + Math.cos(ma) * r * .68, y + Math.sin(ma) * r * .68, r * .055, '#1e1e22', l + 3);
  if (o.seconds !== false) {
    const S2 = new Painter(ctx, { map: XY(0), key: ctx.key + '|sec|' + x.toFixed(2) });
    S2.seg(0, -r * .12, 0, r * .72, r * .025, o.hand || '#c8423a', 0); S2.circle(0, 0, r * .05, o.hand || '#c8423a', 0);
    const m = S2.mesh(); m.position.set(x, y, ctx.z + .002 + (l + 4) * Z.step); const s0 = (o.sec ?? 12) * Math.PI / 30;
    m.userData.update = t => { m.rotation.z = -s0 - Math.floor(t) * Math.PI / 30; };
    ctx.objs.push(m);
  }
}
/** wall calendar: red header + a grid of grey squares */
export function calendar(ctx, x, y, o = {}) {
  const w = o.w ?? .42, h = o.h ?? .46, P = Wd(ctx), l = o.l ?? 4;
  dropShadow(ctx, x - w / 2, y - h / 2, x + w / 2, y + h / 2);
  P.rect(x - w / 2, y - h / 2, x + w / 2, y + h / 2, o.paper || '#ecebe5', l); P.rect(x - w / 2, y + h / 2 - h * .17, x + w / 2, y + h / 2, o.head || '#a85148', l + 1);
  const cols = 7, rows = 5, m = w * .08, cw = (w - m * 2) / cols, ch = (h * .78 - m * 1.5) / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) P.rect(x - w / 2 + m + i * cw + cw * .15, y - h / 2 + m + j * ch + ch * .18, x - w / 2 + m + (i + 1) * cw - cw * .15, y - h / 2 + m + (j + 1) * ch - ch * .18, (i + j * 7) === (o.mark ?? 17) ? '#c25b4c' : '#9c9c98', l + 1);
}
/** a framed picture: frame + mat + simple art ('family' | 'landscape' | 'abstract' | 'blueprint' | 'portrait' | 'poster') */
export function frame(ctx, x, y, o = {}) {
  const w = o.w ?? .46, h = o.h ?? .34, P = o.P || Wd(ctx), l = o.l ?? 4, fw = o.fw ?? .03;
  if (!o.noShadow) dropShadow(ctx, x - w / 2, y - h / 2, x + w / 2, y + h / 2);
  P.rect(x - w / 2, y - h / 2, x + w / 2, y + h / 2, o.frame || '#3a3029', l);
  const ix0 = x - w / 2 + fw, ix1 = x + w / 2 - fw, iy0 = y - h / 2 + fw, iy1 = y + h / 2 - fw, art = o.art || 'landscape', iw = ix1 - ix0, ih = iy1 - iy0;
  if (art === 'family') { P.gradV(ix0, iy0, ix1, iy1, '#c9b48e', '#9fb7c9', l + 1); const cs = o.people || ['#6c6a72', '#4e6fa8', '#5d9a86'];
    cs.forEach((c, i) => { const px = ix0 + iw * (.3 + i * .2), s = i === 2 ? .75 : 1; P.circle(px, iy0 + ih * (.62 * s + .1), ih * .11 * s, '#2b2a30', l + 2); P.rrect(px - iw * .07 * s, iy0, px + iw * .07 * s, iy0 + ih * .55 * s, iw * .04, c, l + 2); }); }
  else if (art === 'blueprint') { P.rect(ix0, iy0, ix1, iy1, o.paper || '#476490', l + 1); P.ring(x - iw * .12, y, ih * .28, ih * .33, '#e8eef6', l + 2); P.seg(ix0 + iw * .1, iy0 + ih * .15, ix1 - iw * .1, iy1 - ih * .15, .008, '#e8eef6', l + 2); P.seg(ix0 + iw * .55, iy0 + ih * .2, ix1 - iw * .08, iy0 + ih * .2, .006, '#e8eef6', l + 2); }
  else if (art === 'abstract') { P.rect(ix0, iy0, ix1, iy1, o.paper || '#e6dfd0', l + 1); P.circle(x - iw * .15, y + ih * .05, ih * .25, o.c1 || '#c2674b', l + 2); P.rect(x, iy0 + ih * .15, ix1 - iw * .1, iy1 - ih * .25, o.c2 || '#4b6c8c', l + 2); }
  else if (art === 'portrait') { P.rect(ix0, iy0, ix1, iy1, o.paper || '#b9a98e', l + 1); P.circle(x, y + ih * .1, ih * .2, '#2b2a30', l + 2); P.rrect(x - iw * .25, iy0, x + iw * .25, y - ih * .1, iw * .1, o.c1 || '#5a6e8f', l + 2); }
  else if (art === 'figure') { P.rect(ix0, iy0, ix1, iy1, o.paper || '#e9e5dc', l + 1); P.circle(x, y + ih * .22, ih * .1, '#2b2a30', l + 2); P.seg(x, y + ih * .12, x, y - ih * .18, .01, '#2b2a30', l + 2); P.seg(x, y - ih * .18, x - iw * .12, iy0 + ih * .08, .01, '#2b2a30', l + 2); P.seg(x, y - ih * .18, x + iw * .12, iy0 + ih * .08, .01, '#2b2a30', l + 2); P.seg(x - iw * .15, y, x + iw * .15, y + ih * .05, .01, '#2b2a30', l + 2); }
  else if (art === 'poster') { P.rect(ix0, iy0, ix1, iy1, o.paper || '#d9cfb8', l + 1); P.rect(ix0 + iw * .1, iy1 - ih * .3, ix1 - iw * .1, iy1 - ih * .12, o.c1 || '#b5483c', l + 2); for (let k = 0; k < 3; k++) P.rect(ix0 + iw * .1, iy0 + ih * (.15 + k * .14), ix1 - iw * (.1 + k * .12), iy0 + ih * (.2 + k * .14), '#8a8478', l + 2); }
  else { P.gradV(ix0, iy0, ix1, iy1, o.c2 || '#7c9a6a', o.c1 || '#b4c6cf', l + 1); P.poly([[ix0, iy0 + ih * .3], [ix0 + iw * .35, iy0 + ih * .62], [ix0 + iw * .6, iy0 + ih * .4], [ix1, iy0 + ih * .55], [ix1, iy0], [ix0, iy0]], mul(ctx.c(o.c2 || '#7c9a6a'), .8), l + 2); }
}
/** a sheet of paper pinned / taped to the wall (a few thin lines, optional red pin) */
export function paper(ctx, x, y, o = {}) {
  const w = o.w ?? .3, h = o.h ?? .4, P = o.P || Wd(ctx), l = o.l ?? 4, rot = o.rot ?? 0, c = Math.cos(rot), s = Math.sin(rot);
  const R = (dx, dy) => [x + dx * c - dy * s, y + dx * s + dy * c], q = (a, b, c2, d, col, ll) => P.quad(R(a, b), R(c2, b), R(c2, d), R(a, d), col, ll);
  if (!o.noShadow) { const sh = ctx.shadow, off = [.045, -.065]; sh.quad(...[R(-w / 2, -h / 2), R(w / 2, -h / 2), R(w / 2, h / 2), R(-w / 2, h / 2)].map(p => [p[0] + off[0], p[1] + off[1]]), '!#000000', 0, .17); }
  q(-w / 2, -h / 2, w / 2, h / 2, o.color || '#ece8de', l);
  const n = o.lines ?? 5; for (let k = 0; k < n; k++) q(-w * .36, h * .3 - k * h * .13, w * (.36 - (k % 3) * .1), h * .3 - k * h * .13 + .012, o.ink || '#8f8a80', l + 1);
  if (o.chart) { const pts = [[-.36, -.1], [-.2, .05], [-.05, -.05], [.12, .2], [.3, .1]].map(([a, b]) => R(a * w, b * h - h * .15)); P.pline(pts, .01, o.ink || '#55606e', l + 1); }
  if (o.pin !== false) P.circle(...R(0, h / 2 - .03), .017, o.pin || '#c23b33', l + 2);
}
export function lightSwitch(ctx, x, y) { const P = Wd(ctx); P.rect(x - .04, y - .06, x + .04, y + .06, '#e2e0d8', 4); P.rect(x - .012, y - .025, x + .012, y + .025, '#b9b6ad', 5); }
/** cabinet doors (front faces) in a row: fill, 0.77x panel gaps, light 2 px handles */
export function cabinets(ctx, P, x0, y0, x1, y1, n, c, o = {}) {
  const l = o.l ?? 4, col = ctx.c(c), gap = mul(col, .77), hi = o.handle || mul(col, 1.35);
  P.rect(x0, y0, x1, y1, col, l);
  for (let i = 1; i < n; i++) { const xx = x0 + (x1 - x0) * i / n; P.rect(xx - .007, y0, xx + .007, y1, gap, l + 1); }
  P.rect(x0, y0, x1, y0 + .012, gap, l + 1); P.rect(x0, y1 - .012, x1, y1, mul(col, .86), l + 1);
  if (o.handles !== false) for (let i = 0; i < n; i++) { const a = x0 + (x1 - x0) * i / n, b = x0 + (x1 - x0) * (i + 1) / n, side = i % 2 ? a + .05 : b - .05, hy = o.handles === 'top' ? y1 - .09 : o.handles === 'bottom' ? y0 + .1 : o.handles === 'drawer' ? (y0 + y1) / 2 : y0 + (y1 - y0) * .85;
    if (o.handles === 'drawer' || o.handles === 'h') P.rect((a + b) / 2 - .06, hy - .008, (a + b) / 2 + .06, hy + .008, hi, l + 2); else P.rect(side - .007, hy - .05, side + .007, hy + .05, hi, l + 2); }
}
/** a potted plant (terracotta pot + 5-7 leaf blobs in two greens) */
export function plant(ctx, P, x, y, o = {}) {
  const s = o.s ?? 1, l = o.l ?? 6, pot = o.pot || '#b86e51', g1 = o.leaf || '#5e8a4e', g2 = mul(ctx.c(g1), .82), R = rnd(strHash('plant' + x));
  for (let i = 0; i < (o.n ?? 7); i++) { const a = -1.2 + i * 2.4 / ((o.n ?? 7) - 1) + (R() - .5) * .3, r = (.09 + R() * .05) * s; const cx = x + Math.sin(a) * .1 * s, cy = y + .16 * s + Math.cos(a) * .14 * s; P.ellipse(cx, cy, r * .55, r, i % 2 ? g1 : g2, l + (i % 2), 1, 14); }
  P.poly([[x - .085 * s, y + .17 * s], [x + .085 * s, y + .17 * s], [x + .065 * s, y], [x - .065 * s, y]], pot, l + 2);
  P.rect(x - .095 * s, y + .14 * s, x + .095 * s, y + .18 * s, mul(ctx.c(pot), 1.1), l + 3);
}
/** a wall shelf (plank + bracket shadows) with things on it: jars / books / boxes / binders */
export function shelf(ctx, P, x0, x1, y, o = {}) {
  const l = o.l ?? 4, c = o.color || '#9c7a57', items = o.items || 'jars', R = rnd(strHash(ctx.name + 'shelf' + x0 + y));
  P.rect(x0, y - .035, x1, y, c, l); P.rect(x0, y - .045, x1, y - .035, mul(ctx.c(c), .77), l);
  dropShadow(ctx, x0, y - .045, x1, y);
  const cols = o.colors || ['#c8783f', '#6c8a50', '#d8c070', '#b44a3c'];
  if (items === 'jars') { const n = o.n ?? 4, sp = (x1 - x0) / n; for (let i = 0; i < n; i++) { const cx = x0 + sp * (i + .5), jh = .13; P.rrect(cx - .035, y, cx + .035, y + jh, .01, cols[i % cols.length], l + 1); P.rect(cx - .038, y + jh, cx + .038, y + jh + .03, '#5c4a3c', l + 2); P.rect(cx - .02, y + .03, cx - .008, y + jh - .03, mul(ctx.c(cols[i % cols.length]), 1.25), l + 2); } }
  else if (items === 'books' || items === 'binders') { let x = x0 + .03; let i = 0; while (x < x1 - .05) { const bw = items === 'binders' ? .07 : .035 + R() * .03, bh = items === 'binders' ? .3 : .18 + R() * .1; const cc = cols[(items === 'binders' ? i : Math.floor(R() * cols.length)) % cols.length];
      if (items === 'books' && R() < .08) { P.poly([[x, y], [x + bh * .7, y], [x + bh * .7 + bw, y + bw * .8], [x + bw, y + bw * .8]], cc, l + 1); x += bh * .75; i++; continue; }
      P.rect(x, y, x + bw, y + bh, cc, l + 1); P.rect(x + bw * .2, y + bh * .62, x + bw * .8, y + bh * .78, mul(ctx.c(cc), 1.3), l + 2); x += bw + .004; i++; } }
  else if (items === 'boxes') { const n = o.n ?? 5, sp = (x1 - x0) / n; for (let i = 0; i < n; i++) { const cx = x0 + sp * (i + .5), bw = sp * .8, bh = .16 + R() * .08; P.rect(cx - bw / 2, y, cx + bw / 2, y + bh, cols[i % cols.length], l + 1); P.rect(cx - bw / 2, y + bh - .025, cx + bw / 2, y + bh, mul(ctx.c(cols[i % cols.length]), .84), l + 2); } }
}
/** a pendant lamp hanging from the ceiling at (x, y, z): cord, dark trapezoid shade, a lit underside + glow + light pool */
export function pendant(ctx, x, y, z, o = {}) {
  const P = ctx.at(z), s = o.s ?? 1, on = ctx.on(o.moods ?? 'lamps') || o.on, top = ctx.H ?? y + 1.2;
  P.rect(x - .006, y + .2 * s, x + .006, top, o.cord || '#1c1c1e', 0);
  const sh = o.shade || '#3e4c44', kind = o.kind || 'cone';
  if (kind === 'cone') { P.poly([[x - .07 * s, y + .2 * s], [x + .07 * s, y + .2 * s], [x + .26 * s, y], [x - .26 * s, y]], sh, 1); P.rect(x - .26 * s, y - .012, x + .26 * s, y + .004, on ? '!#e5cb9b' : mul(ctx.c(sh), 1.2), 2); }
  else if (kind === 'dome') { P.ellipse(x, y, .24 * s, .19 * s, sh, 1, 1, 24, 0, Math.PI); P.rect(x - .24 * s, y - .012, x + .24 * s, y, on ? '!#f2dfb4' : mul(ctx.c(sh), 1.2), 2); }
  else if (kind === 'bulb') P.circle(x, y + .05, .05 * s, on ? '!#fff0d5' : '#d8d4c8', 1);
  if (on) {
    P.ellipse(x, y - .01, .1 * s, .03 * s, '!#fff0d5', 3);
    light(ctx, { p: [x, y - .05, z], color: o.color || '!#ffd9a8', gain: o.gain ?? 1.3, rh: o.rh ?? .9, rc: o.rc ?? 3.6, peak: o.peak ?? .24, gr: o.gr ?? 1.3, moods: true, core: .8 });
    if (o.cone !== false) cone(ctx, x, y - .02, z - .01, { h: y - .02, half: o.half ?? .55, color: o.color || '#ffe2b0', k: o.coneK ?? .07, w0: .5 * s });
  }
}
/** a soft-edged cone of light (pendant, spotlight, street lamp): additive trapezoid with a floor ellipse */
export function cone(ctx, x, y, z, o = {}) {
  const A = new Painter(ctx, { kind: 'add', map: XY(z), order: 5, lit: false }), col = lin(emi(ctx, o.color || '#ffe2b0')), k = o.k ?? .1;
  const h = o.h ?? y, half = o.half ?? .3, w0 = (o.w0 ?? .3) / 2, w1 = w0 + Math.tan(half) * h, soft = o.soft ?? .35;
  const c1 = [col[0] * k, col[1] * k, col[2] * k, 1], c0 = [0, 0, 0, 1], cb = o.fade ? [col[0] * k * .25, col[1] * k * .25, col[2] * k * .25, 1] : c1;
  const yb = y - h;
  A.quad([x - w0, y], [x - w0 + w0 * soft, y], [x - w1 + w1 * soft, yb], [x - w1, yb], null, 0, 1, [c0, c1, cb, c0]);
  A.quad([x - w0 + w0 * soft, y], [x + w0 - w0 * soft, y], [x + w1 - w1 * soft, yb], [x - w1 + w1 * soft, yb], null, 0, 1, [c1, c1, cb, cb]);
  A.quad([x + w0 - w0 * soft, y], [x + w0, y], [x + w1, yb], [x + w1 - w1 * soft, yb], null, 0, 1, [c1, c0, c0, cb]);
  ctx.glows.push(A);
  if (o.pool !== false) { const F = new Painter(ctx, { kind: 'add', map: XZ(.005), order: 3, lit: false }); const kk = (o.poolK ?? 1.3) * k; F.radial(x, z, [[0, [col[0] * kk, col[1] * kk, col[2] * kk, 1]], [w1 * .6, [col[0] * kk * .7, col[1] * kk * .7, col[2] * kk * .7, 1]], [w1 * 1.05, [0, 0, 0, 1]]], 0, 32, .35); ctx.glows.push(F); }
}
/**
 * a computer monitor standing on a desk top at (x, y) on painter P (set dressing): black bezel, a lit screen with 4-6
 * text lines + an orange dot (sister office), a stand; at night its cool bloom rises above it (+40 L plume).
 * ui: 'text' | 'dark' (dark UI windows) | 'chart' | 'off'
 */
export function monitor(ctx, P, x, y, o = {}) {
  const w = o.w ?? .56, h = o.h ?? .36, l = o.l ?? 2, ui = o.ui || 'text', z = o.z ?? null, scr = o.screen || (ui === 'dark' ? '#1f2430' : '#7189a6');
  P.rect(x - .018, y, x + .018, y + .1, '#1c1d22', l); P.rect(x - .1, y, x + .1, y + .018, '#1c1d22', l);
  P.rrect(x - w / 2, y + .09, x + w / 2, y + .09 + h, .012, '#141418', l + 1);
  const sx0 = x - w / 2 + .018, sx1 = x + w / 2 - .018, sy0 = y + .108, sy1 = y + .072 + h;
  if (ui === 'off') { P.rect(sx0, sy0, sx1, sy1, '#22252c', l + 2); return; }
  P.rect(sx0, sy0, sx1, sy1, '!' + scr, l + 2);
  if (ui === 'text') { for (let k = 0; k < 5; k++) { const yy = sy1 - .04 - k * (sy1 - sy0 - .06) / 5; P.rect(sx0 + .03, yy, sx1 - .06 - (k % 3) * .06, yy + .012, '!#e8eef6', l + 3); } P.circle(sx1 - .035, sy1 - .045, .012, '!#e98a3a', l + 3); }
  else if (ui === 'dark') { P.rect(sx0 + .02, sy0 + .1, x - .02, sy1 - .02, '!#2c3342', l + 3); P.rect(x + .01, sy0 + .02, sx1 - .02, sy1 - .02, '!#2c3342', l + 3); P.rect(sx0 + .02, sy0 + .02, x - .02, sy0 + .08, '!#2c3342', l + 3); }
  else if (ui === 'chart') { P.pline([[sx0 + .03, sy0 + .05], [sx0 + .12, sy0 + .12], [sx0 + .2, sy0 + .08], [sx0 + .3, sy0 + .2], [sx1 - .03, sy1 - .05]], .012, '!#7fe0a0', l + 3); }
  else if (ui === 'code') { const R = rnd(strHash('code' + x)); for (let k = 0; k < 7; k++) { const yy = sy1 - .03 - k * .035; P.rect(sx0 + .02 + (k % 3) * .03, yy, sx0 + .06 + R() * (sx1 - sx0 - .1), yy + .012, k % 2 ? '!#3f816c' : '!#e8eef6', l + 3); } }
  if ((ctx.M.lamps || o.glow) && o.glow !== false && z != null) glowAt(ctx, x, y + .09 + h * .75, z + .02, { r: o.bloomR ?? .75, color: '#8ea0c8', peak: o.bloom ?? .09, sy: 1.15 });
}
/** a desk lamp on a desk top at (x, y): base, two arm segments, shade aiming down; lit = warm cone onto the desk */
export function deskLamp(ctx, P, x, y, o = {}) {
  const l = o.l ?? 2, f = o.facing ?? -1, c = o.color || '#3a3c42', on = o.on ?? ctx.M.lamps;
  P.rect(x - .07, y, x + .07, y + .02, c, l); P.seg(x, y + .02, x + f * .08, y + .3, .016, c, l); P.seg(x + f * .08, y + .3, x + f * .2, y + .38, .016, c, l);
  P.poly([[x + f * .17, y + .41], [x + f * .26, y + .36], [x + f * .3, y + .26], [x + f * .16, y + .33]], on ? '!#f4ddac' : '#4a4c52', l + 1);
  if (on && o.z != null) light(ctx, { p: [x + f * .24, y + .25, o.z], color: '#ffd9a8', gain: .9, rh: .35, rc: 1.4, peak: .12, gr: .6, moods: true });
}
/** a mug (with steam option) standing at (x, y) */
export function mug(ctx, P, x, y, o = {}) { const l = o.l ?? 3, c = o.color || '#2a2c33'; P.rrect(x - .04, y, x + .04, y + .09, .01, c, l); P.ring(x + .045, y + .045, .018, .03, c, l, 1, 16); P.rect(x - .028, y + .055, x + .015, y + .07, o.label || '#e9b44c', l + 1); }
/** a feathered (out-of-focus looking) rectangle on an alpha painter: full alpha inside, fading to 0 over `f` metres */
export function soft(P, x0, y0, x1, y1, color, a = 1, f = .15) {
  const c = P._c(color, a), z = [c[0], c[1], c[2], 0], xa = x0 - f, xb = x1 + f, ya = y0 - f, yb = y1 + f;
  P.quad([x0, y0], [x1, y0], [x1, y1], [x0, y1], null, 0, 1, [c, c, c, c]);
  P.quad([xa, y0], [x0, y0], [x0, y1], [xa, y1], null, 0, 1, [z, c, c, z]); P.quad([x1, y0], [xb, y0], [xb, y1], [x1, y1], null, 0, 1, [c, z, z, c]);
  P.quad([x0, ya], [x1, ya], [x1, y0], [x0, y0], null, 0, 1, [z, z, c, c]); P.quad([x0, y1], [x1, y1], [x1, yb], [x0, yb], null, 0, 1, [c, c, z, z]);
  P.quad([xa, ya], [x0, ya], [x0, y0], [xa, y0], null, 0, 1, [z, z, c, z]); P.quad([x1, ya], [xb, ya], [xb, y0], [x1, y0], null, 0, 1, [z, z, z, c]);
  P.quad([xa, y1], [x0, y1], [x0, yb], [xa, yb], null, 0, 1, [z, c, z, z]); P.quad([x1, y1], [xb, y1], [xb, yb], [x1, yb], null, 0, 1, [c, z, z, z]);
  return P;
}
// 7-segment digits (LED clocks, elevator floors, scoreboards): segments a b c d e f g
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '', L: 'fed', E: 'afged', P: 'abfge', A: 'abcefg', b: 'fgedc' };
/** LED digits: str of 0-9 : - (h = digit height, left-aligned at x, bottom at y) */
export function digits(P, str, x, y, h, color, l = 0) {
  const w = h * .55, t = h * .13; let cx = x;
  for (const ch of String(str)) {
    if (ch === ':' || ch === '.') { P.rect(cx + t * .3, y + h * .25, cx + t * 1.3, y + h * .25 + t, color, l); if (ch === ':') P.rect(cx + t * .3, y + h * .65, cx + t * 1.3, y + h * .65 + t, color, l); cx += t * 2; continue; }
    const s = SEG[ch] ?? ''; const X0 = cx, X1 = cx + w, Ym = y + h / 2, Y1 = y + h;
    if (s.includes('a')) P.rect(X0 + t, Y1 - t, X1 - t, Y1, color, l); if (s.includes('g')) P.rect(X0 + t, Ym - t / 2, X1 - t, Ym + t / 2, color, l); if (s.includes('d')) P.rect(X0 + t, y, X1 - t, y + t, color, l);
    if (s.includes('f')) P.rect(X0, Ym + t / 2, X0 + t, Y1 - t, color, l); if (s.includes('b')) P.rect(X1 - t, Ym + t / 2, X1, Y1 - t, color, l);
    if (s.includes('e')) P.rect(X0, y + t, X0 + t, Ym - t / 2, color, l); if (s.includes('c')) P.rect(X1 - t, y + t, X1, Ym - t / 2, color, l);
    cx += w + t * 1.4;
  }
  return cx - x;
}
/** a black LED box with red digits (+ a small red glow) */
export function ledBox(ctx, P, x, y, str, o = {}) {
  const h = o.h ?? .1, n = String(str).length, w = n * h * .62 + h * .6, l = o.l ?? 4, col = o.color || '!#ff4a3a';
  dropShadow(ctx, x - w / 2, y - h * .8, x + w / 2, y + h * .8); P.rect(x - w / 2, y - h * .8, x + w / 2, y + h * .8, '#0e0e10', l);
  digits(P, str, x - w / 2 + h * .3, y - h / 2, h, col, l + 1);
  if (o.glow !== false) glowAt(ctx, x, y, (o.z ?? ctx.z) + .03, { r: w * .9, color: bare(col), peak: .08, sy: .6 });
}
/** a rug lying on the real floor (perspective does the foreshortening): oval with a lighter ring line, or rect with a border */
export function floorRug(ctx, x, z, w, d, color, o = {}) {
  const F = new Painter(ctx, { map: (u, v, l) => [u, .004 + l * .0015, v], key: ctx.key + '|rug' + x + z }), c = ctx.c(color), hi = mul(c, o.lineK ?? 1.25);
  if (o.round) { F.ellipse(x, z, w / 2, d / 2, c, 0, 1, 64); const k = .8; F.ellipse(x, z, w / 2 * k + .02, d / 2 * k + .02, hi, 1, 1, 64); F.ellipse(x, z, w / 2 * k, d / 2 * k, c, 2, 1, 64); }
  else { F.rect(x - w / 2, z - d / 2, x + w / 2, z + d / 2, c, 0); const m = o.margin ?? .12; F.rect(x - w / 2 + m, z - d / 2 + m, x + w / 2 - m, z + d / 2 - m, hi, 1); F.rect(x - w / 2 + m + .03, z - d / 2 + m + .03, x + w / 2 - m - .03, z + d / 2 - m - .03, c, 2);
    if (o.fringe) for (let xx = x - w / 2 + .03; xx < x + w / 2; xx += .06) { F.rect(xx, z + d / 2, xx + .015, z + d / 2 + .06, hi, 1); F.rect(xx, z - d / 2 - .06, xx + .015, z - d / 2, hi, 1); } }
  ctx.objs.push(F.mesh());
}
/** a bicycle wheel (black rim + spokes) */
export function wheel(ctx, P, x, y, r, o = {}) { const l = o.l ?? 3, c = o.color || '#1d1e22'; P.ring(x, y, r * .9, r, c, l); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; P.seg(x, y, x + Math.cos(a) * r * .9, y + Math.sin(a) * r * .9, .006, c, l); } P.circle(x, y, r * .08, c, l + 1); }
/** a radiator under a window */
export function radiator(ctx, P, x, y, w, o = {}) { const l = o.l ?? 3, c = o.color || '#d8d6cf', h = o.h ?? .5; P.rect(x - w / 2, y, x + w / 2, y + h, c, l); for (let xx = x - w / 2 + .05; xx < x + w / 2 - .02; xx += .07) P.rect(xx - .006, y + .04, xx + .006, y + h - .04, mul(ctx.c(c), .8), l + 1); dropShadow(ctx, x - w / 2, y, x + w / 2, y + h); }
/** a wall-mounted TV: black frame, screen kinds 'news' | 'sports' | 'off' | 'blue'; lit screens glow at night */
export function tvWall(ctx, P, x, y, o = {}) {
  const w = o.w ?? .7, h = o.h ?? .42, l = o.l ?? 4, kind = o.screen || 'news';
  dropShadow(ctx, x - w / 2, y - h / 2, x + w / 2, y + h / 2); P.rrect(x - w / 2, y - h / 2, x + w / 2, y + h / 2, .015, '#141418', l);
  const a = x - w / 2 + .025, b = x + w / 2 - .025, c = y - h / 2 + .025, d = y + h / 2 - .025;
  if (kind === 'off') { P.rect(a, c, b, d, '#1d2026', l + 1); return; }
  if (kind === 'news') { P.rect(a, c, b, d, '!#3b5288', l + 1); P.rect(a, c, b, c + (d - c) * .25, '!#1b2440', l + 2); P.rect(a + .02, c + (d - c) * .14, a + (b - a) * .55, c + (d - c) * .2, '!#e8edf6', l + 3); P.rect(a, c + (d - c) * .25, a + (b - a) * .2, c + (d - c) * .32, '!#d24a3c', l + 3); P.circle(x + (b - a) * .08, y + (d - c) * .12, (d - c) * .14, '!#20262f', l + 2); P.rrect(x + (b - a) * .02, c + (d - c) * .25, x + (b - a) * .14, y + .02, .02, '!#20262f', l + 2); }
  else if (kind === 'sports') { P.gradV(a, c, b, d, '!#3f8a4a', '!#2b4f7a', l + 1); P.rect(a, c, b, c + (d - c) * .2, '!#c8423a', l + 2); P.rect(a + .02, c + (d - c) * .07, a + (b - a) * .6, c + (d - c) * .13, '!#f2efe6', l + 3); }
  else P.rect(a, c, b, d, '!#4c6fb0', l + 1);
  if (ctx.M.lamps || o.glow) glowAt(ctx, x, y, (o.z ?? ctx.z) + .05, { r: w * 1.1, color: '#8ea0c8', peak: .1 });
}

/** dust motes (timeloop look): soft specks drifting slowly; three layers translate (cheap: no per-speck work) */
export function motes(ctx, o = {}) {
  const n = o.n ?? 50, R = rnd(strHash(ctx.name + 'motes') + ctx.seed), col = lin(emi(ctx, o.color || '#fff4e0'));
  for (let layer = 0; layer < 3; layer++) {
    const z = [-1.2, .6, 2.2][layer], A = new Painter(ctx, { kind: 'add', map: XY(z), order: 9, lit: false });
    for (let i = 0; i < n / 3; i++) { const x = (o.x0 ?? -6) + R() * ((o.x1 ?? 6) - (o.x0 ?? -6)), y = .2 + R() * (o.y1 ?? 3.6), r = (.006 + R() * .022) * (layer === 2 ? 1.6 : 1), k = (.08 + R() * .12) * (o.k ?? 1);
      A.radial(x, y, [[0, [col[0] * k, col[1] * k, col[2] * k, 1]], [r * .5, [col[0] * k * .8, col[1] * k * .8, col[2] * k * .8, 1]], [r, [0, 0, 0, 1]]], 0, 10); }
    const m = A.mesh(); if (!m) continue; const sp = [.035, .05, .08][layer], ph = layer * 2.1;
    m.userData.update = t => { m.position.x = Math.sin(t * .11 + ph) * .25 + t * sp * .3 % 1; m.position.y = Math.sin(t * .07 + ph * 1.7) * .12 - (t * sp * .2) % .5; };
    ctx.objs.push(m);
  }
}

// =====================================================================================================================
// views through windows, skies, skylines, nature
// =====================================================================================================================
export const SKIES = {
  day: ['#c4c4bc', '#abb5bc'], dusk: ['#dbb88c', '#7e7695'], night: ['#0e152d', '#050a1b'], grey: ['#c9ccd2', '#b3b7bf'],
  clear: ['#b0becb', '#7396bd'], sunset: ['#a78379', '#3f4568'], golden: ['#f5a669', '#c9674c'], lake: ['#c49c74', '#654760'], storm: ['#2a3330', '#151b1a'],
};
/** the sky colours of the mood (bottom, top) */
export function skyOf(ctx, kind) { const k = kind || ctx.M.sky; return (SKIES[k] || SKIES.day).map(c => ctx.mood === 'memory' ? grade(c, ctx.M) : c); }
/**
 * A city skyline layer: blocks with window grids. lit: share of lit windows (night), far = hazier / darker
 * cityLayer(ctx, P, { x0, x1, y0, hMin, hMax, color, win, lit, seed, gridK })
 */
export function cityLayer(ctx, P, o) {
  const R = rnd(o.seed ?? 3), x1 = o.x1, night = o.night, l = o.l ?? 0;
  let x = o.x0;
  while (x < x1) {
    const bw = (o.wMin ?? .9) + R() * ((o.wMax ?? 2.2) - (o.wMin ?? .9)), bh = (o.hMin ?? 1.5) + R() * ((o.hMax ?? 5) - (o.hMin ?? 1.5)), gap = o.gap ?? (R() * .25);
    const bc = o.colors ? o.colors[Math.floor(R() * o.colors.length)] : o.color;
    P.rect(x, o.y0, x + bw, o.y0 + bh, bc, l);
    if (o.win !== false) {
      const cw = o.cell?.[0] ?? .22, ch = o.cell?.[1] ?? .3, ww = o.winW ?? cw * .55, wh = o.winH ?? ch * .5;
      for (let cx = x + cw * .5; cx + ww < x + bw - cw * .3; cx += cw) for (let cy = o.y0 + ch * .8; cy + wh < o.y0 + bh - ch * .3; cy += ch) {
        if (night) { const k = R(); if (k > (o.lit ?? .5)) { if (o.dim) P.rect(cx, cy, cx + ww, cy + wh, o.dim, l + 1); continue; } const t = R(); P.rect(cx, cy, cx + ww, cy + wh, o.litColors ? o.litColors[Math.floor(t * o.litColors.length)] : t < .6 ? '!#c9ac81' : t < .85 ? '!#8fa4c6' : '!#8d7e6c', l + 1); }
        else if (o.winColor) P.rect(cx, cy, cx + ww, cy + wh, o.winColor, l + 1);
      }
    }
    if (o.roof && R() < .3) P.rect(x + bw * .3, o.y0 + bh, x + bw * .45, o.y0 + bh + .25, bc, l);
    x += bw + gap;
  }
}
const P2 = (P, x, y, c) => P.rect(x, y, x + .17, y + .2, c, 1);
/** the view behind every window hole of the set: sky + 2 city layers (or trees / houses / sea) for the mood */
export function views(ctx) {
  if (!ctx.views.length) return;
  const z = ctx.z, x0 = Math.min(...ctx.views.map(v => v.x0)) - 3, x1 = Math.max(...ctx.views.map(v => v.x1)) + 3, M = ctx.M, kind = ctx.views[0].view;
  // a view may ask for its own sky: sky: 'clear' (used in daylight) or { day, dusk, night } per mood sky
  const vs = ctx.views.find(v => v.sky)?.sky, own = vs && (typeof vs === 'object' ? vs[ctx.M.sky] : ctx.M.sky === 'day' ? vs : null);
  const [sb, st] = skyOf(ctx, own || null);
  const SK = new Painter(ctx, { map: XY(z - 14), key: ctx.key + '|sky', lit: false });
  SK.gradV(x0 - 6, -2, x1 + 6, 9, '!' + sb, '!' + st);
  if (M.sky === 'night') { const R = rnd(11); for (let i = 0; i < 60; i++) SK.circle(x0 - 6 + R() * (x1 - x0 + 12), 3 + R() * 6, .015 + R() * .02, '!#c8d0e0', 1, 1, 6); }
  ctx.objs.push(SK.mesh());
  if (kind === 'none' || kind === 'sky') return;
  const NEAR = new Painter(ctx, { map: XY(z - 4.5), key: ctx.key + '|viewnear', lit: false }), FAR = new Painter(ctx, { map: XY(z - 9), key: ctx.key + '|viewfar', lit: false });
  const night = M.sky === 'night', dusk = M.sky === 'dusk', grey = M.sky === 'grey';
  const nearC = night ? '!#1a2238' : dusk ? '!#3e3b45' : grey ? '!#9a9ca2' : '!#9aa2a6', farC = night ? '!#121a2e' : dusk ? '!#5c5568' : grey ? '!#b0b2b8' : '!#b5bbbb';
  const winC = night ? null : dusk ? null : grey ? '!#8e9096' : '!#7f8b92';
  if (kind === 'skyline') {   // from a high floor: a far city of small lit dots (sister office windows)
    const yb = (ctx.views[0].y0 ?? .3) + .1;
    cityLayer(ctx, FAR, { x0: x0 - 4, x1: x1 + 4, y0: -2, hMin: 1.5 + yb, hMax: 4.2 + yb, wMin: .6, wMax: 1.6, color: night ? '!#0a0e23' : dusk ? '!#4e4858' : '!#9aa4ae', night: night || dusk, lit: night ? .16 : .14, win: true, seed: 13, cell: [.11, .15], winW: .045, winH: .055, gap: .02, winColor: night || dusk ? null : '!#8c96a2', litColors: night ? ['!#e3c487', '!#f2deb0', '!#9fb2d2', '!#c9ac81'] : ['!#dbb88c'] });
    ctx.objs.push(FAR.mesh()); return;
  }
  if (kind === 'city' || kind === 'houses' || kind === 'tower') {
    cityLayer(ctx, FAR, { x0: x0 - 4, x1: x1 + 4, y0: -1, hMin: 2.5, hMax: 6, color: farC, night, lit: .3, win: night, seed: 5, cell: [.2, .26], gap: .05, dim: null, litColors: ['!#8d7e6c', '!#7f8aa8', '!#a08c6c'] });
    cityLayer(ctx, NEAR, { x0: x0 - 2, x1: x1 + 2, y0: -.5, hMin: 1.8, hMax: 3.8, wMin: 1.3, wMax: 2.6, color: nearC, night: night || dusk, lit: dusk ? .55 : .42, winColor: winC, win: true, seed: 7, cell: [.36, .42], gap: .7, litColors: dusk ? ['!#dbb88c'] : null });
    // a "hero" block behind every window (the references always show one building with a window grid in the frame)
    const H2 = new Painter(ctx, { map: XY(z - 3.2), key: ctx.key + '|viewhero', lit: false }), k = (12.5 + 3.2) / 12.5;
    ctx.views.forEach((v, i) => { const w = (v.x1 - v.x0), bx = v.x0 + w * (i % 2 ? .3 : .62), bw = Math.min(1.5, w * .55) * k, top = ROOM.camH + ((v.y0 + (v.y1 - v.y0) * (.62 + (i % 2) * .15)) - ROOM.camH) * k, R2 = rnd(31 + i);
      const hc = night ? '!#20283f' : dusk ? '!#3e3b45' : grey ? '!#8e9096' : '!#a5acae'; H2.rect(bx - bw / 2, -1, bx + bw / 2, top, hc, 0);
      for (let cx = bx - bw / 2 + .12; cx < bx + bw / 2 - .2; cx += .3) for (let cy = top - .3; cy > -.5; cy -= .34) { const lit = R2() < (dusk ? .6 : .45);
        P2(H2, cx, cy, night ? (lit ? (R2() < .7 ? '!#c9ac81' : '!#8fa4c6') : '!#2a3350') : dusk ? (lit ? '!#dbb88c' : '!#4a4652') : grey ? '!#7e8086' : '!#949fa5'); } });
    ctx.objs.push(H2.mesh());
  } else if (kind === 'trees') {
    const R = rnd(9); for (let x = x0 - 2; x < x1 + 2; x += .9 + R() * .8) { const y = .6 + R() * 1.4, r = .5 + R() * .4, g = night ? '!#18241e' : dusk ? '!#4a4c40' : '!#6f8f5a';
      NEAR.circle(x, y + r, r, g, 0, 1, 20); NEAR.circle(x + r * .6, y + r * .7, r * .8, mul(g, .9), 1, 1, 20); NEAR.rect(x - .05, -1, x + .05, y + .2, night ? '!#141414' : '!#5b4a3a', 0); }
    FAR.rect(x0 - 4, -1, x1 + 4, 1.2, night ? '!#141c2a' : dusk ? '!#6a6070' : '!#a8b6a4', 0);
  } else if (kind === 'sea') { NEAR.gradV(x0 - 3, -1, x1 + 3, 1.0, night ? '!#0b1222' : '!#5c7f98', night ? '!#18213a' : '!#88a9bd', 0); }
  ctx.objs.push(FAR.mesh(), NEAR.mesh());
}

// =====================================================================================================================
// props (the prop agent's furniture: same seats / surfaces everywhere) + spots
// =====================================================================================================================
const PROP_MOOD = { day: 'day', dusk: 'dusk', evening: 'dusk', night: 'night', candle: 'candle', alarm: 'night', violet: 'night', blue: 'night', memory: 'day', dim: 'day' };
/** does the prop library have this prop (not just the placeholder box)? */
export const hasProp = name => !!PROPS.REG?.[name] && name !== 'box';
/**
 * prop(ctx, names, { x, z, y, facing, scale, ...o }, fallback(ctx) -> Object3D): the first registered name wins, else the
 * set's own drawing (so a set always looks complete). Recoloured for moods the prop library does not know.
 */
export function prop(ctx, names, o = {}, fallback) {
  const list = Array.isArray(names) ? names : [names], name = list.find(hasProp);
  let obj;
  if (name) { const mo = { ...o }; delete mo.x; delete mo.y; delete mo.z;
    obj = PROPS.make(name, { ...mo, mood: ctx.propMood, style: o.style ?? ctx.propStyle });
    if (['evening', 'alarm', 'violet', 'blue', 'memory', 'dim'].includes(ctx.mood) && !ctx.spec.propMood?.[ctx.mood]) regrade(obj, ctx); }
  else if (fallback) { obj = fallback(ctx, o); obj.userData.kind ??= list[0]; obj.userData.pickRoot = true; obj.name = list[0]; }
  else return null;
  obj.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  if (o.scale && !name) obj.scale.setScalar(o.scale);
  if (o.facing === -1 && !name) obj.scale.x *= -1;
  ctx.objs.push(obj); return obj;
}
/** regrade a prop's flat materials for this mood (lit parts flagged userData.lit keep their colour) */
export function regrade(obj, ctx) {
  const M = ctx.M, dm = MOODS[PROP_MOOD[ctx.mood]] || MOODS.day;
  obj.traverse(m => { if (!m.isMesh || m.userData.lit || !m.userData.color || m.material.vertexColors) return; const base = m.userData.baseColor || m.userData.color; m.userData.baseColor = base;
    // the prop already graded itself for the nearest mood it knows: undo nothing, grade the difference approximately
    const g = dm === M ? base : grade(base, { k: M.k / dm.k, sat: Math.min(1.2, M.sat / dm.sat), tint: M.tint.map((v, i) => v / dm.tint[i]) });
    m.material = new THREE.MeshBasicMaterial(Object.assign({}, { color: new THREE.Color(g), transparent: m.material.transparent, opacity: m.material.opacity, side: m.material.side, depthWrite: m.material.depthWrite, toneMapped: false, map: m.material.map || null, blending: m.material.blending }));
    m.material.userData.own = true; });
}
/** world box of an object */
export const boxOf = obj => { obj.updateMatrixWorld(true); return new THREE.Box3().setFromObject(obj); };
/** a seat spot from a prop (the prop library's seatOf: world { x, y, z, depth, facing }; else userData / its box) */
export function seatOf(obj, o = {}) {
  if (PROPS.seatOf && obj.userData.seat || obj.userData.seats) { obj.updateMatrixWorld(true); const s = PROPS.seatOf?.(obj, o.i); if (s) return { x: +s.x.toFixed(3), y: 0, z: +((s.z ?? obj.position.z) + (o.dz ?? 0)).toFixed(3), kind: o.kind || 'seat', seatY: +(+s.y).toFixed(3), facing: o.facing ?? s.facing ?? 0, depth: s.depth, prop: obj,
    ...(s.stool ? { stool: true } : {}), ...(Number.isFinite(s.rung) ? { rung: +(+s.rung).toFixed(3) } : {}) }; }
  const u = obj.userData.seat, sx = obj.scale.x, p = obj.position;
  let x = p.x, y, z = p.z;
  if (Array.isArray(u)) { x += u[0] * sx; y = u[1] * Math.abs(obj.scale.y); }
  else if (u && typeof u === 'object') { x += (u.x ?? 0) * sx; y = (u.y ?? u.seatY ?? .46) * Math.abs(obj.scale.y); z += u.z ?? 0; }
  else { const b = boxOf(obj); x = (b.min.x + b.max.x) / 2; y = Math.min(.5, (b.max.y - b.min.y) * .48); }
  return { x, y: 0, z: z + (o.dz ?? 0), kind: o.kind || 'seat', seatY: +(+y).toFixed(3), facing: o.facing ?? 0, prop: obj };
}
/** a bed / sofa lying spot from a prop (the prop library's lieOf: { x0 (head end), x1, y, z, head }) */
export function lieOf(obj, o = {}) {
  obj.updateMatrixWorld(true);
  const L = obj.userData.lie && PROPS.lieOf ? PROPS.lieOf(obj) : null, b = boxOf(obj);
  if (L) return { x: +((L.x0 + L.x1) / 2).toFixed(3), y: 0, z: +((L.z ?? obj.position.z) + (o.dz ?? 0)).toFixed(3), kind: 'bed', lieY: +(+L.y).toFixed(3), topY: +(+L.y).toFixed(3), x0: L.x0, x1: L.x1, head: L.head, prop: obj };
  const u = obj.userData.bed || {}, p = obj.position;
  return { x: p.x, y: 0, z: p.z + (o.dz ?? 0), kind: 'bed', lieY: u.y ?? .6, topY: u.y ?? .6, x0: p.x + (u.x0 ?? (b.min.x - p.x)), x1: p.x + (u.x1 ?? (b.max.x - p.x)), head: 'left', prop: obj };
}
/** a surface spot from a prop (userData.top = y | [x, y] | { y, x0, x1 }, else its box top) */
export function topOf(obj, o = {}) {
  if (PROPS.topOf && obj.userData.top && typeof obj.userData.top === 'object' && !Array.isArray(obj.userData.top)) { obj.updateMatrixWorld(true); const t = PROPS.topOf(obj); if (t) return { x: +(((t.x0 + t.x1) / 2) + (o.dx ?? 0)).toFixed(3), y: +(+t.y).toFixed(3), z: +((t.z ?? obj.position.z) + (o.dz ?? 0)).toFixed(3), kind: o.kind || 'table', topY: +(+t.y).toFixed(3), x0: t.x0, x1: t.x1, front: t.front, back: t.back, prop: obj }; }
  const u = obj.userData.top, p = obj.position, b = boxOf(obj);
  let y = typeof u === 'number' ? u : Array.isArray(u) ? u[1] : u && typeof u === 'object' ? (u.y ?? u.topY) : b.max.y;
  y *= Math.abs(obj.scale.y);
  return { x: p.x + (o.dx ?? 0), y: +(+y).toFixed(3), z: p.z + (o.dz ?? 0), kind: o.kind || 'table', topY: +(+y).toFixed(3), x0: b.min.x, x1: b.max.x, prop: obj };
}

// =====================================================================================================================
// simple fallback furniture (used only when the prop library lacks the piece): the iq500 recipe, no outlines
// =====================================================================================================================
export const FALLBACK = {
  table(ctx, o) { const g = new THREE.Group(), w = o.w ?? 1.5, h = o.h ?? .76, P = new Painter(ctx, { map: XY(0), lit: false }), wood = o.color || '#86674a', legs = mul(ctx.c(wood), .78);
    P.rect(-w / 2 + .06, 0, -w / 2 + .12, h, legs, 0); P.rect(w / 2 - .12, 0, w / 2 - .06, h, legs, 0);
    if (o.cloth) { const cl = o.cloth === true ? '#d8d1c4' : o.cloth; P.rect(-w / 2 - .04, h - .26, w / 2 + .04, h + .04, cl, 1); for (let x = -w / 2; x < w / 2; x += .09) P.rect(x, h - .26, x + .006, h + .04, mul(ctx.c(cl), .86), 2); P.rect(-w / 2 - .04, h - .02, w / 2 + .04, h - .008, mul(ctx.c(cl), .86), 2); for (let x = -w / 2; x < w / 2; x += .1) P.ellipse(x + .05, h - .26, .05, .025, cl, 1, 1, 10, Math.PI, Math.PI * 2); }
    else { P.rect(-w / 2, h - .05, w / 2, h, wood, 1); P.rect(-w / 2, h - .065, w / 2, h - .05, mul(ctx.c(wood), .77), 1); }
    const m = P.mesh(); g.add(m); g.userData.top = h; g.userData.size = [w, h]; return g; },
  chair(ctx, o) { const g = new THREE.Group(), P = new Painter(ctx, { map: XY(0), lit: false }), c = o.color || '#86684e', d = mul(ctx.c(c), .78);
    P.rect(-.2, .44, .2, .49, c, 1); P.rect(-.18, 0, -.15, .44, d, 0); P.rect(.15, 0, .18, .44, d, 0); P.rect(-.2, .49, -.16, .95, d, 0); P.rect(-.2, .78, .02, .86, c, 0);
    g.add(P.mesh()); g.userData.seat = [0, .47]; return g; },
  stool(ctx, o) { const g = new THREE.Group(), P = new Painter(ctx, { map: XY(0), lit: false }), c = o.color || '#86684e', d = mul(ctx.c(c), .78);
    P.rect(-.18, .62, .18, .67, c, 1); P.rect(-.15, 0, -.12, .62, d, 0); P.rect(.12, 0, .15, .62, d, 0); P.rect(-.14, .25, .14, .27, d, 0); g.add(P.mesh()); g.userData.seat = [0, .66]; return g; },
  bench(ctx, o) { const g = new THREE.Group(), w = o.w ?? 1.6, P = new Painter(ctx, { map: XY(0), lit: false }), c = o.color || '#7a5a3e', d = mul(ctx.c(c), .78), m2 = o.metal || '#2e3034';
    P.rect(-w / 2, .42, w / 2, .47, c, 1); P.rect(-w / 2, .5, w / 2, .58, c, 1); P.rect(-w / 2, .66, w / 2, .74, c, 1); P.rect(-w / 2 + .1, 0, -w / 2 + .15, .74, m2, 2); P.rect(w / 2 - .15, 0, w / 2 - .1, .74, m2, 2); P.rect(-w / 2, .44, w / 2, .45, d, 2);
    g.add(P.mesh()); g.userData.seat = [0, .45]; return g; },
  desk(ctx, o) { const g = new THREE.Group(), w = o.w ?? 1.5, h = o.h ?? .76, P = new Painter(ctx, { map: XY(0), lit: false }), wood = o.color || '#86674a', steel = o.legs || '#34353c';
    P.rect(-w / 2 + .04, 0, -w / 2 + .08, h, steel, 0); P.rect(w / 2 - .08, 0, w / 2 - .04, h, steel, 0); P.rect(-w / 2, h - .045, w / 2, h, wood, 1); P.rect(-w / 2, h - .06, w / 2, h - .045, mul(ctx.c(wood), .78), 1);
    if (o.drawer !== false) { P.rect(w * .1, h - .2, w / 2 - .1, h - .06, mul(ctx.c(wood), .84), 1); P.rect(w * .25 - .05 + w * .05, h - .135, w * .25 + .05 + w * .05, h - .12, '#c9c0b3', 2); }
    g.add(P.mesh()); g.userData.top = h; return g; },
  sofa(ctx, o) { const g = new THREE.Group(), w = o.w ?? 2.1, P = new Painter(ctx, { map: XY(0), lit: false }), c = o.color || '#433c3e', d = mul(ctx.c(c), .84), e = mul(ctx.c(c), .77);
    P.rrect(-w / 2, .1, w / 2, .82, .06, d, 0); P.rrect(-w / 2 + .14, .38, w / 2 - .14, .5, .04, c, 1); P.rrect(-w / 2, .1, -w / 2 + .18, .62, .05, c, 2); P.rrect(w / 2 - .18, .1, w / 2, .62, .05, c, 2);
    P.rect(-w / 2 + .1, 0, -w / 2 + .16, .1, '#1f1a18', 0); P.rect(w / 2 - .16, 0, w / 2 - .1, .1, '#1f1a18', 0); P.rect(-w / 2 + .18, .38, w / 2 - .18, .395, e, 2);
    for (const s of [-1, 1]) P.rrect(s * w * .2 - .28, .5, s * w * .2 + .28, .78, .06, mul(ctx.c(c), 1.08), 1);
    g.add(P.mesh()); g.userData.seat = [0, .46]; g.userData.top = .82; return g; },
  bed(ctx, o) { const g = new THREE.Group(), w = o.w ?? 2.0, P = new Painter(ctx, { map: XY(0), lit: false }), c = o.duvet || '#816479', fr = o.frame || '#6b5040';
    P.rect(-w / 2, 0, -w / 2 + .07, .95, fr, 0); P.rect(-w / 2, .1, w / 2, .38, fr, 0); P.rect(-w / 2 + .05, .38, w / 2, .55, o.mattress || '#8a8073', 1); P.rect(-w / 2 + .05, .38, w / 2, .44, '#7a7065', 2);
    P.rrect(-w / 2 + .1, .52, -w / 2 + .55, .7, .08, '#d9d4cc', 3); P.rrect(-w / 2 + .45, .4, w / 2 + .02, .62, .04, c, 4); P.rect(-w / 2 + .45, .4, w / 2 + .02, .44, mul(ctx.c(c), .85), 5);
    g.add(P.mesh()); g.userData.seat = [w * .2, .55]; g.userData.top = .62; g.userData.bed = { x0: -w / 2 + .1, x1: w / 2, y: .6 }; return g; },
  nightstand(ctx, o) { const g = new THREE.Group(), P = new Painter(ctx, { map: XY(0), lit: false }), c = o.color || '#876846';
    P.rect(-.24, 0, .24, .55, c, 0); P.rect(-.24, .5, .24, .55, mul(ctx.c(c), 1.12), 1); P.rect(-.2, .3, .2, .31, mul(ctx.c(c), .77), 1); P.rect(-.04, .4, .04, .415, '#d6cfc2', 2); g.add(P.mesh()); g.userData.top = .55; return g; },
  lamp(ctx, o) { const g = new THREE.Group(), P = new Painter(ctx, { map: XY(0), lit: false }), on = o.on ?? ctx.M.lamps, sh = on ? '!#f5e4b6' : '#d8cfb4';
    P.rect(-.06, 0, .06, .03, '#3a3430', 0); P.rect(-.012, 0, .012, .3, '#3a3430', 0); P.poly([[-.15, .3], [.15, .3], [.1, .48], [-.1, .48]], sh, 1); g.add(P.mesh()); g.userData.lightAt = [0, .4]; return g; },
  floorlamp(ctx, o) { const g = new THREE.Group(), P = new Painter(ctx, { map: XY(0), lit: false }), on = o.on ?? ctx.M.lamps, sh = on ? '!#f2dcae' : (o.shade || '#79644e');
    P.rect(-.14, 0, .14, .03, '#2e2a28', 0); P.rect(-.014, 0, .014, 1.42, '#2e2a28', 0); P.poly([[-.2, 1.38], [.2, 1.38], [.14, 1.62], [-.14, 1.62]], sh, 1); g.add(P.mesh()); g.userData.lightAt = [0, 1.5]; return g; },
  wardrobe(ctx, o) { const g = new THREE.Group(), P = new Painter(ctx, { map: XY(0), lit: false }), c = o.color || '#69523a', w = o.w ?? .95, h = o.h ?? 1.95;
    P.rect(-w / 2, 0, w / 2, h, c, 0); P.rect(-.006, .05, .006, h - .05, mul(ctx.c(c), .77), 1); P.rect(-w / 2, h - .03, w / 2, h, mul(ctx.c(c), 1.12), 1); P.rect(-w / 2, 0, w / 2, .06, mul(ctx.c(c), .77), 1);
    P.rect(-.05, h * .48, -.035, h * .58, '#c9bfae', 2); P.rect(.035, h * .48, .05, h * .58, '#c9bfae', 2); g.add(P.mesh()); return g; },
  rug(ctx, o) { const g = new THREE.Group(), P = new Painter(ctx, { map: XZ(.003), lit: true }), c = o.color || '#464b5c', w = o.w ?? 2.4, d = o.d ?? 1.4;
    if (o.round) { P.ellipse(0, 0, w / 2, d / 2, c, 0); P.ring(0, 0, 0, 0, c, 0); P.ellipse(0, 0, w / 2 - .12, d / 2 - .08, mul(ctx.c(c), 1.12), 1); P.ellipse(0, 0, w / 2 - .16, d / 2 - .11, c, 2); }
    else { P.rect(-w / 2, -d / 2, w / 2, d / 2, c, 0); P.rect(-w / 2 + .1, -d / 2 + .1, w / 2 - .1, d / 2 - .1, mul(ctx.c(c), 1.15), 1); P.rect(-w / 2 + .13, -d / 2 + .13, w / 2 - .13, d / 2 - .13, c, 2); }
    g.add(P.mesh()); g.userData.noPick = true; return g; },
};
/** the iq500 table with check cloth + chairs around it: returns { table, seats: [...] } with spots added */
export function diningSet(ctx, x, z, o = {}) {
  const table = prop(ctx, o.table || ['table'], { x, z, w: o.w ?? 1.55, variant: o.variant ?? 'kitchen', cloth: o.cloth, h: o.h }, FALLBACK.table);
  const T = topOf(table, { kind: 'table' }); ctx.spot(o.tableSpot || 'table', T);
  const w = (T.x1 - T.x0) || 1.5, seats = [];
  const places = o.chairs ?? ['left', 'right', 'back'];
  places.forEach((p, i) => {
    const facing = p === 'left' ? 1 : p === 'right' ? -1 : 0, cx = p === 'left' ? x - w / 2 - .2 : p === 'right' ? x + w / 2 + .2 : x + (p === 'back2' ? .35 : p === 'back' && places.includes('back2') ? -.35 : 0), cz = p.startsWith('back') ? z - .45 : z + (p === 'front' ? .55 : .02);
    const ch = prop(ctx, o.chair || ['chair'], { x: cx, z: cz, facing: facing === 0 ? 1 : facing, view: facing === 0 ? 'front' : 'side', color: o.chairColor }, FALLBACK.chair);
    if (!ch) return;
    const s = seatOf(ch, { facing }); s.table = o.tableSpot || 'table'; ctx.spot(o.prefix ? `${o.prefix}${i + 1}` : `chair${i + 1}`, s); seats.push(s);
  });
  return { table, seats };
}

// =====================================================================================================================
// finishing a set: the views, every painter into meshes, one group, spots, the result
// =====================================================================================================================
export function finish(ctx, extra = {}) {
  views(ctx);
  const g = new THREE.Group(); g.name = 'place:' + ctx.name; g.userData.kind = 'place'; g.userData.place = ctx.name; g.userData.pickRoot = true;
  for (const o of ctx.objs) if (o) g.add(o);
  for (const p of ctx.painters.values()) { const m = p.mesh(); if (m) g.add(m); }
  for (const p of ctx.glows) { const m = p.mesh(); if (m) { m.userData.noPick = true; g.add(m); } }
  ctx.S.scene.add(g);
  const M = ctx.M, spec = ctx.spec;
  const cx = spec.camX ?? 0;
  const res = {
    name: ctx.name, mood: ctx.mood, family: ctx.family, group: g, spots: ctx.spots, doors: ctx.doors,
    bounds: { x0: ctx.x0, x1: ctx.x1, z0: -ctx.D, z1: ROOM.front, wallZ: -ctx.D, floorY: 0, ceilY: ctx.H },
    rim: spec.rim?.[ctx.mood] ?? spec.rim?.all ?? M.rim, rimDir: spec.rimDir?.[ctx.mood] ?? spec.rimDir?.all ?? M.rimDir,
    bg: spec.bg ?? M.bg, shadows: !!spec.shadows,
    ...extra,
    // the storybook stages are framed wider (timeloop wides show the whole wall: figures ~0.3-0.4 of the picture)
    cam: ctx.family === 'stage' ? { wide: camWide(cx, { h: 4.5, camH: 1.35 }), close: camWide(cx), full: camFull(cx, { h: 5.6, camH: 1.5 }), ...(spec.cams || {}), ...(extra.cam || {}) }
      : { wide: camWide(cx), full: camFull(cx), ...(spec.cams || {}), ...(extra.cam || {}) },
  };
  return res;
}
/** the references' whole-room wide at x (feet of a z = 0 figure at 83 % of the frame, floor line ~73 %, door ~490 px tall) */
export const camWide = (x = 0, o = {}) => ({ on: [x, o.camH ?? ROOM.camH, o.z ?? 0], frame: { h: o.h ?? ROOM.wideH } });
/** a wider establishing view (iq500 f10663: figures ~0.4 of the picture, more floor and ceiling) */
export const camFull = (x = 0, o = {}) => ({ on: [x, o.camH ?? ROOM.fullCamH, o.z ?? 0], frame: { h: o.h ?? ROOM.fullH } });
/** a medium on a point (a table, a counter): picture h metres tall centred on [x, y, z] */
export const camOn = (x, y, z, h = 2.2) => ({ on: [x, y, z], frame: { h } });
/** add a named spot; stand spots default to { y: 0, kind: 'stand', facing: 0 } */
export function addSpotFn(ctx) { ctx.spot = (name, s) => { ctx.spots[name] = { y: 0, kind: 'stand', facing: 0, ...s }; return ctx.spots[name]; }; }
/** a text sign card (shop names, EXIT, LEVEL -3): lit signs keep their colours */
export function sign(ctx, str, x, y, z, o = {}) {
  const t = coreText(str, { size: o.size ?? .16, color: bare(ctx.c(o.color || '#f1ede4')), bg: o.bg ? bare(ctx.c(o.bg)) : undefined, pad: o.pad ?? .25, radius: o.radius ?? .15, font: o.font || 'Oswald', weight: o.weight ?? 700, spacing: o.spacing ?? .08, border: o.border ? bare(ctx.c(o.border)) : undefined });
  t.position.set(x, y, z); t.renderOrder = 4; ctx.objs.push(t); return t;
}
