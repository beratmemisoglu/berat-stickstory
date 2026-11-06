// Stick stories props - the drawing kit every prop group file uses (lib/props/*.js). Owned by the prop agent.
//
// The look (analysis/sets/NOTES.md section 4): flat fills, NO black outlines on iq500 / sister props; the lit face, a
// second face at 0.84x luminance (same hue), thin edge lines at 0.77x, tiny highlights (handles, rims) at ~1.25x,
// furniture square-cornered, appliances / screens / phones slightly rounded, cushions fully rounded with a 3 px darker
// same-hue outline. Timeloop's storybook sets use `style: 'outline'` (saturated fills + near-black 3-6 px outlines) or
// `style: 'silhouette'` (near-black frames). Time of day recolours a prop with `mood: 'day'|'dusk'|'night'|'candle'`
// (lit parts - screens, lamp shades, bulbs - keep their colour).
//
// A builder B(o) draws one prop in its own space: metres, origin at the bottom centre (y = 0 is where it stands), the
// prop faces the camera (+z). Parts are stacked front-to-back in the order they are drawn (each next one Z.step nearer),
// so draw back to front. `o.facing = -1` mirrors every x (text stays readable). Geometry and materials are shared.
import { THREE, Z, mat, rrect, ellipse, ring, poly, stroke, text, glow, softShadow, gradient, shade, mixHex, css, canvasTex, DEG } from '../core.js';
import { screenTexture } from './screens.js';
export { drawScreen, screenTexture } from './screens.js';

// ---- the shading recipe ----
export const face = (c, k = .16) => shade(c, -k);          // the second (darker) face: 0.84x
export const edge = c => shade(c, -.23);                   // thin edge lines: 0.77x
export const hi = (c, k = .22) => shade(c, k);             // small highlights (handles, rims)
export const soft = c => shade(c, -.15);                   // the same-hue outline of soft things (pillows, cushions)
const grey = c => { const h = css(c), r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16), l = Math.round(.3 * r + .59 * g + .11 * b).toString(16).padStart(2, '0'); return '#' + l + l + l; };
export const desat = (c, k) => mixHex(css(c), grey(c), k);

// ---- palettes sampled from the references (sets NOTES 1.5, 2.2, 4.4) ----
export const PAL = {
  // woods
  oak: '#86674a', oakDark: '#694e3a', walnut: '#6e5038', pine: '#a8835a', chair: '#86684e', chairLeg: '#6b4b35', drawer: '#70563f',
  wardrobe: '#69523a', night: '#876846', plywood: '#c8955a', birch: '#c9a06a',
  // metals and plastics
  steel: '#34353c', chrome: '#b8bcbc', alu: '#9ea4aa', iron: '#2c2f33', office: '#4a4b4f', black: '#1c1d22', plastic: '#e4e2dc', white: '#e9e8e2',
  // kitchen
  counter: '#d9cdb7', cabinet: '#697869', cabLine: '#5b6a5b', tile: '#b7b8ac', fridge: '#bcbcb3', fridgeSide: '#9d9e94', oven: '#242732',
  sink: '#737575', cloth: '#d8d1c4', clothLine: '#b5ad9f', kettle: '#c9cdd0', pot: '#b86e51',
  // soft things
  sofa: '#433c3e', sofaRed: '#5c222b', cushion: '#8a7a64', mattress: '#8a8073', mattressSide: '#7a7065', pillow: '#b9b5ae', duvet: '#816479',
  lace: '#d8c8b2', rug: '#464b5c',
  // lights
  shadeLit: '#f5e4b6', shadeOff: '#79644e', bulb: '#fff0d5', lampGlow: '#ffd9a8', pendant: '#3e4c44', deskShade: '#f4ddac',
  // screens
  screen: '#7189a6', screenDark: '#223553', screenLine: '#e9eef5', screenText: '#3f816c', phone: '#141420', phoneSide: '#1b191f',
  // the timeloop storybook look
  ink: '#140d0d', inkLine: '#1d0a0c',
  // boxes / binders / books (home office, lab)
  boxes: ['#5ba077', '#c7ab50', '#9a9da3', '#c65c46', '#7c79c7', '#a97644', '#6f8195', '#966551', '#7a8d67'],
  binders: ['#425a8c', '#914235', '#507450', '#bb9e4e'],
  books: ['#3c5885', '#b3822f', '#a9473c', '#4f7a55', '#6d4f7d', '#c7b18a', '#2f4a5e', '#8c3a33'],
};

// ---- time of day ----
const MOODS = {
  day: null,
  dusk: c => mixHex(desat(c, .1), '#2c2533', .3),
  evening: c => mixHex(c, '#2a1d17', .28),
  night: c => mixHex(desat(c, .35), '#10141f', .64),
  candle: c => mixHex(desat(c, .2), '#120c09', .8),
  dim: c => mixHex(c, '#14121a', .45),
  memory: c => mixHex(grey(c), '#8e96a8', .25),
};
/** the colour function of a prop: mood + style (+ an optional tint [hex, k]) */
export function toneOf(o = {}) {
  const fns = [];
  if (o.style === 'silhouette') fns.push(c => mixHex(css(c), PAL.ink, .9));
  const m = typeof o.mood === 'function' ? o.mood : MOODS[o.mood]; if (m) fns.push(m);
  if (Array.isArray(o.tint)) fns.push(c => mixHex(css(c), o.tint[0], o.tint[1] ?? .3));
  if (!fns.length) return c => css(c);
  const cache = new Map();
  return c => { const k = css(c); let v = cache.get(k); if (!v) { v = fns.reduce((a, f) => f(a), k); cache.set(k, v); } return v; };
}

// ---- cached geometry helpers ----
const GEOS = new Map();
const cgeo = (key, make) => { let g = GEOS.get(key); if (!g) { g = make(); g.userData.shared = true; GEOS.set(key, g); } return g; };
const k3 = v => (Math.round(v * 2000) / 2000).toString();
const ptsKey = pts => pts.map(p => k3(p[0]) + ',' + k3(p[1])).join(';');
/** ONE mesh for many straight line segments [[x0, y0, x1, y1], ...] of width w (grid lines, planks, spokes) */
function linesGeo(segs, w) {
  return cgeo('lines|' + k3(w) + '|' + segs.map(s => s.map(k3).join(',')).join(';'), () => {
    const pos = [], idx = [], r = w / 2;
    for (const [x0, y0, x1, y1] of segs) { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1e-9, nx = -dy / L * r, ny = dx / L * r, k = pos.length / 3;
      pos.push(x0 + nx, y0 + ny, 0, x0 - nx, y0 - ny, 0, x1 + nx, y1 + ny, 0, x1 - nx, y1 - ny, 0); idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
  });
}
/** ONE mesh for many rectangles [[x0, y0, x1, y1], ...] (tiles, window cells, binders of one colour) */
function rectsGeo(rs) {
  return cgeo('rects|' + rs.map(s => s.map(k3).join(',')).join(';'), () => {
    const pos = [], idx = [];
    for (const [x0, y0, x1, y1] of rs) { const k = pos.length / 3; pos.push(x0, y0, 0, x1, y0, 0, x0, y1, 0, x1, y1, 0); idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
  });
}
/** ONE mesh for many discs [[x, y, r], ...] */
function discsGeo(ds, n = 16) {
  return cgeo('discs|' + n + '|' + ds.map(s => s.map(k3).join(',')).join(';'), () => {
    const pos = [], idx = [];
    for (const [x, y, r] of ds) { const k = pos.length / 3; pos.push(x, y, 0); for (let i = 0; i <= n; i++) { const a = Math.PI * 2 * i / n; pos.push(x + Math.cos(a) * r, y + Math.sin(a) * r, 0); if (i) idx.push(k, k + i, k + i + 1); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
  });
}
/** a ribbon along a polyline (no overlapping joins: right for translucent strokes); taper: ends thin out */
function ribbonGeo(pts, w, taper) {
  return cgeo('ribbon|' + k3(w) + '|' + (taper ? 1 : 0) + '|' + ptsKey(pts), () => {
    const pos = [], idx = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], c = pts[Math.min(n - 1, i + 1)], dx = c[0] - a[0], dy = c[1] - a[1], L = Math.hypot(dx, dy) || 1e-9;
      const t = i / (n - 1), r = w / 2 * (taper ? Math.max(.15, Math.sin(Math.PI * Math.min(1, .15 + t * .85))) : 1);
      pos.push(pts[i][0] - dy / L * r, pts[i][1] + dx / L * r, 0, pts[i][0] + dy / L * r, pts[i][1] - dx / L * r, 0);
      if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
  });
}
const shapeGeo = pts => cgeo('shape|' + ptsKey(pts), () => { const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); return new THREE.ShapeGeometry(s); });
/** points of an arc (for scallops, rounded shapes) */
export function arcPts(cx, cy, rx, ry, a0, a1, n = 10) { const out = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return out; }
/** a rounded-rectangle outline as points (for polys / strokes with rounded corners) */
export function rrPts(x0, y0, x1, y1, r, n = 4) {
  r = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2); if (r <= 0) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  return [...arcPts(x1 - r, y0 + r, r, r, -Math.PI / 2, 0, n), ...arcPts(x1 - r, y1 - r, r, r, 0, Math.PI / 2, n), ...arcPts(x0 + r, y1 - r, r, r, Math.PI / 2, Math.PI, n), ...arcPts(x0 + r, y0 + r, r, r, Math.PI, Math.PI * 1.5, n)];
}

// ---- the builder ----
/**
 * B(o) -> b: draws one prop. b.g is the prop's group. Every draw call takes colours that go through the prop's tone
 * (mood / style) unless p.lit (screens, lit shades). p.z = an explicit stack index (default: the next one).
 *   b.box(x0, y0, x1, y1, col, { r })            rectangle by corners (r: corner radius or [tl, tr, br, bl])
 *   b.poly([[x, y]...], col)  b.ell(x, y, rx, ry, col, { arc })  b.circ(x, y, r, col)  b.ring(x, y, r0, r1, col)
 *   b.line(x0, y0, x1, y1, w, col)  b.path([[x, y]...], w, col, { closed })  b.lines(segs, w, col)  b.rects(rects, col)
 *   b.dots([[x, y, r]...], col)  b.text(str, x, y, { size, color, font, weight, align })  b.glow(x, y, r, col, { opacity })
 *   b.shadow(x, y, rx, ry, { opacity })  b.grad(x0, y0, x1, y1, stops, dir)  b.tex(x0, y0, x1, y1, texture)
 *   b.sub(name, zAbs) -> a builder drawing into a child group at depth zAbs (a front layer: duvets, rails, chair backs)
 *   b.depth() -> how deep the stack is so far (m)       b.done(userData) -> b.g with userData (x mirrored with facing)
 */
export function B(o = {}, parent = null, group = null) {
  const g = group || new THREE.Group();
  const tone = parent ? parent.tone : toneOf(o), fx = parent ? parent.fx : (o.facing === -1 || o.facing === 'left' ? -1 : 1);
  const outline = parent ? parent.outline : o.style === 'outline' ? (o.outlineW ?? .012) : 0;
  const st = { n: 0 };
  const X = x => fx * x;
  const col = (c, p) => p && p.lit ? css(c) : tone(c);
  const mo = p => (p.op != null || p.add ? { opacity: p.op ?? 1, add: !!p.add } : {});
  const put = (m, p = {}) => { m.position.z = (p.z ?? st.n++) * Z.step + (p.dz ?? 0); if (p.order != null) m.renderOrder = p.order; if (p.name) m.name = p.name; (p.to || g).add(m); return m; };
  const ol = (pts, p) => { if (!outline || p.ol === false) return; const m = new THREE.Mesh(linesGeo(pts.map((q, i) => { const r = pts[(i + 1) % pts.length]; return [q[0], q[1], r[0], r[1]]; }), outline), mat(PAL.ink)); put(m, {}); };
  const b = {
    g, tone, fx, outline, o, X,
    c: c => tone(c),
    box(x0, y0, x1, y1, c, p = {}) {
      const a = Math.min(X(x0), X(x1)), bb = Math.max(X(x0), X(x1)), w = bb - a, h = Math.abs(y1 - y0);
      let r = p.r || 0; if (Array.isArray(r) && fx < 0) r = [r[1], r[0], r[3], r[2]];
      const m = rrect(w, h, r, col(c, p), mo(p)); m.position.x = (a + bb) / 2; m.position.y = (y0 + y1) / 2; put(m, p);
      if (p.rot) { m.rotation.z = fx * p.rot; }
      ol([[a, Math.min(y0, y1)], [bb, Math.min(y0, y1)], [bb, Math.max(y0, y1)], [a, Math.max(y0, y1)]], p);
      return m;
    },
    /** a polygon with holes (car bodies with window / door openings): outer [[x, y]...], holes [[[x, y]...], ...] */
    holes(outer, holes, c, p = {}) {
      const P = outer.map(q => [X(q[0]), q[1]]), H = holes.map(h => h.map(q => [X(q[0]), q[1]]));
      const g2 = cgeo('holes|' + ptsKey(P) + '|' + H.map(ptsKey).join('/'), () => { const s = new THREE.Shape(); P.forEach((q, i) => i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])); for (const h of H) { const hp = new THREE.Path(); h.forEach((q, i) => i ? hp.lineTo(q[0], q[1]) : hp.moveTo(q[0], q[1])); s.holes.push(hp); } return new THREE.ShapeGeometry(s); });
      const m = new THREE.Mesh(g2, mat(col(c, p), mo(p))); put(m, p); ol(P, p); return m;
    },
    poly(pts, c, p = {}) {
      const P = pts.map(q => [X(q[0]), q[1]]);
      const m = new THREE.Mesh(shapeGeo(P), mat(col(c, p), mo(p))); put(m, p); ol(P, p); return m;
    },
    ell(x, y, rx, ry, c, p = {}) {
      let arc = p.arc; if (arc && fx < 0) arc = [Math.PI - arc[1], Math.PI - arc[0]];
      const m = ellipse(rx, ry, col(c, p), { arc, segs: p.segs ?? 48, ...mo(p) }); m.position.x = X(x); m.position.y = y; if (p.rot) m.rotation.z = fx * p.rot; put(m, p);
      if (outline && p.ol !== false) { const r = ring(1 - outline / Math.max(rx, ry), 1, PAL.ink); r.scale.set(rx, ry, 1); r.position.set(X(x), y, 0); put(r, {}); }
      return m;
    },
    circ(x, y, r, c, p = {}) { return b.ell(x, y, r, r, c, p); },
    ring(x, y, r0, r1, c, p = {}) { let arc = p.arc; if (arc && fx < 0) arc = [Math.PI - arc[1], Math.PI - arc[0]]; const m = ring(r0, r1, col(c, p), { arc }); m.position.set(X(x), y, 0); put(m, p); return m; },
    line(x0, y0, x1, y1, w, c, p = {}) { const m = new THREE.Mesh(linesGeo([[X(x0), y0, X(x1), y1]], w), mat(col(c, p), mo(p))); put(m, p); return m; },
    lines(segs, w, c, p = {}) { if (!segs.length) return null; const m = new THREE.Mesh(linesGeo(segs.map(s => [X(s[0]), s[1], X(s[2]), s[3]]), w), mat(col(c, p), mo(p))); put(m, p); return m; },
    rects(rs, c, p = {}) { if (!rs.length) return null; const m = new THREE.Mesh(rectsGeo(rs.map(s => { const a = X(s[0]), d = X(s[2]); return [Math.min(a, d), s[1], Math.max(a, d), s[3]]; })), mat(col(c, p), mo(p))); put(m, p); return m; },
    dots(ds, c, p = {}) { if (!ds.length) return null; const m = new THREE.Mesh(discsGeo(ds.map(s => [X(s[0]), s[1], s[2]]), p.n ?? 20), mat(col(c, p), mo(p))); put(m, p); return m; },
    path(pts, w, c, p = {}) { const P = pts.map(q => [X(q[0]), q[1]]);
      if (p.ribbon || p.taper || (p.op != null && p.op < 1 && !p.closed)) { const m = new THREE.Mesh(ribbonGeo(P, w, p.taper), mat(col(c, p), mo(p))); put(m, p); return m; } const m = stroke(P, w, col(c, p), { closed: p.closed, cap: p.cap, key: 'pp|' + k3(w) + '|' + (p.closed ? 1 : 0) + '|' + (p.cap || '') + '|' + ptsKey(P), ...mo(p) }); put(m, p); return m; },
    text(str, x, y, p = {}) {
      const size = p.size ?? .05;
      const m = text(str, { size, color: p.lit ? css(p.color || '#ffffff') : tone(p.color || '#ffffff'), font: p.font || 'Open Sans', weight: p.weight ?? 800, align: p.align, spacing: p.spacing, px: p.px ?? Math.max(500, Math.min(2400, 90 / size)), pad: p.pad ?? .05, order: p.order, lineHeight: p.lineHeight });
      m.position.x += X(x); m.position.y += y; if (p.rot) m.rotation.z = fx * p.rot; put(m, { ...p, order: p.order ?? 3 }); m.renderOrder = p.order ?? 3; return m;
    },
    glow(x, y, r, c, p = {}) { const m = glow(r, c, { opacity: p.opacity ?? .35, falloff: p.falloff ?? 2, sx: p.sx, sy: p.sy, order: p.order ?? 6 }); m.position.x = X(x); m.position.y = y; m.position.z = p.zAbs ?? .002; (p.to || g).add(m); return m; },
    shadow(x, y, rx, ry, p = {}) { const m = softShadow(rx, ry, { opacity: p.opacity ?? .3, order: p.order ?? 1 }); m.position.set(X(x), y, (p.z ?? st.n++) * Z.step); (p.to || g).add(m); return m; },
    grad(x0, y0, x1, y1, stops, dir = 'v', p = {}) { const a = Math.min(X(x0), X(x1)), d = Math.max(X(x0), X(x1)); const m = gradient(d - a, y1 - y0, stops.map(s => [s[0], p.lit ? s[1] : tone(s[1]), s[2]]), { dir: dir === 'h' && fx < 0 ? 'h' : dir, order: p.order ?? 2, opacity: p.opacity }); m.position.set((a + d) / 2, (y0 + y1) / 2, 0); put(m, { ...p, order: p.order ?? 2 }); return m; },
    tex(x0, y0, x1, y1, t, p = {}) {
      const a = Math.min(X(x0), X(x1)), d = Math.max(X(x0), X(x1)); const geo = cgeo('plane|' + k3(d - a) + '|' + k3(y1 - y0), () => new THREE.PlaneGeometry(d - a, y1 - y0));
      const material = t.userData.keep ? mat('#ffffff', { map: t, transparent: !!p.transparent }) : new THREE.MeshBasicMaterial({ map: t, transparent: !!p.transparent, toneMapped: false, side: THREE.DoubleSide, depthWrite: !p.transparent });
      if (!t.userData.keep) material.userData.own = true;
      const m = new THREE.Mesh(geo, material); m.position.set((a + d) / 2, (y0 + y1) / 2, 0); if (fx < 0 && p.mirror) m.scale.x = -1; put(m, p); return m;
    },
    sub(name, zAbs = 0, p = {}) { const sg = new THREE.Group(); sg.name = name; sg.position.z = zAbs; if (p.at) { sg.position.x = X(p.at[0]); sg.position.y = p.at[1]; } (p.to || g).add(sg); return B(o, b, sg); },
    depth() { return st.n * Z.step; },
    skip(n = 1) { st.n += n; },
    /** finish: userData with x mirrored by facing (grips, seat(s), top, lie, ...) */
    done(ud = {}) {
      const mx = v => Array.isArray(v) ? [X(v[0]), ...v.slice(1)] : v;
      if (ud.grips) { const gg = {}; for (const k in ud.grips) gg[k] = mx(ud.grips[k]); ud.grips = gg; }
      const ms = s => s && { ...s, x: X(s.x ?? 0), facing: (s.facing ?? 1) * fx };
      if (ud.seat) ud.seat = ms(ud.seat); if (ud.seats) ud.seats = ud.seats.map(ms);
      if (ud.top) { const a = X(ud.top.x0), d = X(ud.top.x1); ud.top = { ...ud.top, x0: Math.min(a, d), x1: Math.max(a, d) }; }
      if (ud.lie) { const a = X(ud.lie.x0), d = X(ud.lie.x1); ud.lie = { ...ud.lie, x0: a, x1: d, head: fx < 0 ? (ud.lie.head === 'left' ? 'right' : 'left') : ud.lie.head }; }
      if (ud.points) { const pp = {}; for (const k in ud.points) pp[k] = mx(ud.points[k]); ud.points = pp; }
      ud.facing = fx;
      Object.assign(g.userData, ud);
      return g;
    },
  };
  return b;
}

/** put a screen (phones, monitors, TVs) on a builder: spec / kind / canvas size; sets b.g.userData.screen (+ update when it moves) */
export function screenOn(b, x0, y0, x1, y1, spec, kind, cw, ch, o = {}) {
  const r = screenTexture(spec, kind, cw, ch, o);
  const m = b.tex(x0, y0, x1, y1, r.tex, { mirror: false });
  b.g.userData.screen = r.tex; b.g.userData.screenMesh = m;
  if (r.update) { const prev = b.g.userData.update; b.g.userData.update = (t, S) => { prev?.(t, S); r.update(t); }; r.update(o.t ?? 0); }
  if (o.glow) b.glow((x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0) * (o.glowR ?? 1.6), o.glowColor || '#9fc3ff', { opacity: typeof o.glow === 'number' ? o.glow : .3 });
  return m;
}
/**
 * lay a long upright prop (pen, knife, bottle, umbrella...) down on its side: the top points right (+x, or left with
 * dir -1), it lies on y = 0 centred on x = 0; grips / points / size follow.
 */
export function layDown(g, dir = 1) {
  const s = g.userData.size; if (!s) return g;
  const w = s.w, h = s.h, rot = -dir * Math.PI / 2;
  const map = ([x, y, ...r]) => dir > 0 ? [y - h / 2, -x + w / 2, ...r] : [-(y - h / 2), x + w / 2, ...r];
  for (const c of g.children) { const [nx, ny] = map([c.position.x, c.position.y]); c.position.x = nx; c.position.y = ny; c.rotation.z += rot; }
  for (const k of ['grips', 'points']) if (g.userData[k]) for (const n in g.userData[k]) g.userData[k][n] = map(g.userData[k][n]);
  g.userData.size = { w: h, h: w }; g.userData.lying = true;
  if (g.userData.top) g.userData.top = null;
  return g;
}
/** chain an update(t) on a prop group */
export function onUpdate(g, f) { const prev = g.userData.update; g.userData.update = prev ? (t, S) => { prev(t, S); f(t, S); } : f; }
/** a canvas texture drawn once (screens, labels, papers): cached by key when given */
const CT = new Map();
export function screenTex(key, w, h, draw) {
  if (key && CT.has(key)) return CT.get(key);
  const t = canvasTex(w, h, draw); if (key) { CT.set(key, t); t.userData.keep = true; }
  return t;
}
export { DEG };
