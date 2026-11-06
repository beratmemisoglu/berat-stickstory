// MAPS AND DIAGRAMS on boards: the world map (gold-on-black or steel-on-navy, a halftone dot variant), the city street
// grid, a floor plan, a wireframe tower, a network graph and blueprint line diagrams that draw on. Lines are glow lines
// that draw on along their length (kit.gline); static art is painted once into a texture. References:
// analysis/graphics/NOTES.md 3a-3d, 3j (crops gfx-si-worldmap, gfx-si-18map, gfx-si-10blocks, gfx-si-902, gfx-iq-network2,
// gfx-iq-brain1). The world outline is Natural Earth 1:110m (public domain), lib/info/world.js.
import { THREE, FPS, clamp, lerp, E, rnd, hash } from '../core.js';
import * as P from './paint.js';
import { U, fmat, paintCard, textCard, gline, circlePts, arcPts, anim, setAlpha, popIn, fadeIn, drawOn, moveOn, makeBoard } from './kit.js';
import { outline, where, MAP_W, MAP_H } from './world.js';

const F = 1 / FPS;
const T = (S, v, lead = 0) => P.when(S, v, lead);
const startAt = (S, o, lead = 2 * F, dflt = -1e9) => o && (o.at != null || o.word != null) ? P.landed(S, P.startOf(S, o, lead)) : dflt;
const tagCard = (text, style = 'neutral', h = 60) => { const sc = document.createElement('canvas').getContext('2d'), sz = P.measure(sc, text, { cap: h * .4, w: 800, track: .12 }) + h * .75;
  return paintCard(sz + 8, h + 8, x => P.paintTag(x, (sz + 8) / 2, (h + 8) / 2, text, { style, h }, 1.5), { res: 1.5 }); };
const pillCard = (text, theme = 'fact', h = 100) => { const sc = document.createElement('canvas').getContext('2d'), sz = P.pillSize(sc, text, { h });
  return paintCard(sz.w + 8, h + 8, x => P.paintPill(x, (sz.w + 8) / 2, (h + 8) / 2, text, { h, theme }, 1.5), { res: 1.5 }); };
const dotCard = (r, fill, ring, glowC) => paintCard(r * 6, r * 6, x => { const c = r * 3; if (glowC) { const g = x.createRadialGradient(c, c, 0, c, c, r * 3); g.addColorStop(0, glowC); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, r * 6, r * 6); }
  x.fillStyle = fill; x.beginPath(); x.arc(c, c, r, 0, 7); x.fill(); if (ring) { x.lineWidth = r * .32; x.strokeStyle = ring; x.stroke(); } }, { res: 2 });
const glowCard = (r, color) => { const m = paintCard(r * 2, r * 2, x => { const g = x.createRadialGradient(r, r, 0, r, r, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 2 * r, 2 * r); }, { res: .5, mip: false });
  m.material.blending = THREE.AdditiveBlending; return m; };
/** a list of things with optional times -> [{ ...item, t }] (t = its start, or the default) */
const timed = (S, list, dflt, lead = 2 * F) => (list || []).map((it, i) => ({ ...it, t: startAt(S, it, lead, typeof dflt === 'function' ? dflt(i) : dflt) }));

// =====================================================================================================================
// WORLD MAP. style 'gold' (gold coast lines with a glow on black, faint land, a faint grid; label capsules whose lines draw
// to a point in 12 frames, a red pin popping with a red bloom), 'steel' (steel coasts on navy, a hair lighter land, amber
// route arcs drawing in 9 frames, cream nodes in amber rings, red FROZEN stamps) or 'dots' (blue halftone dots).
// rect: [x, y, w] where the map sits on the board (default full width). push: { to: place, word | at, zoom, frames }.
// Places: 'paris' (world.js PLACES) | [lon, lat] | { x, y } (board px).
// =====================================================================================================================
const MAPSTYLE = {
  gold: { bg: ['#1b140d', '#090705'], land: 'rgba(70,50,28,.30)', coast: '#d3a057', coastW: 2.6, glow: 'rgba(225,160,80,.35)', grid: 'rgba(210,160,90,.05)', route: '#e2a956', label: 'fact' },
  steel: { bg: ['#121b2e', '#060a14'], land: '#1b2234', coast: '#b9bcc5', coastW: 1.8, glow: 'rgba(170,185,215,.35)', grid: 'rgba(120,140,190,.05)', route: '#d5a761', label: 'fact' },
  dots: { bg: ['#16213c', '#080d1b'], land: null, coast: null, dots: '#4f7fd8', grid: null, route: '#e2b060', label: 'fact' },
};
export function worldmap(S, o = {}) {
  const sty = { ...MAPSTYLE[o.style ?? 'gold'], ...(o.colors || {}) };
  const hadCam = !!S._cam, B = makeBoard(S, { bg: o.bg ?? sty.bg, kind: 'worldmap', bgR: .55,
    bgPaint: sty.grid ? (x, w, h) => { x.strokeStyle = sty.grid; x.lineWidth = .5; for (let i = 0; i < w; i += 15) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); } for (let j = 0; j < h; j += 15) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); } } : null });
  const [rx, ry, rw] = o.rect ?? [0, 44, 1920], k = rw / MAP_W, rh = MAP_H * k;
  const mp = p => { if (p && typeof p === 'object' && !Array.isArray(p) && p.x != null) return [p.x, p.y]; const q = where(p); return [rx + q[0] * k, ry + q[1] * k]; };
  const res = o.res ?? (o.push ? 2 : 1.5);
  const map = paintCard(rw, rh, (x, w, h, r) => {
    const pieces = outline();
    const trace = pc => { x.beginPath(); pc.pts.forEach((p, i) => i ? x.lineTo(p[0] * k, p[1] * k) : x.moveTo(p[0] * k, p[1] * k)); if (pc.closed) x.closePath(); };
    if (sty.land) { x.fillStyle = sty.land; for (const pc of pieces) { trace(pc); x.fill(); } }
    if (sty.dots) { const tmp = document.createElement('canvas'); tmp.width = Math.ceil(w); tmp.height = Math.ceil(h); const t2 = tmp.getContext('2d'); t2.fillStyle = '#fff'; for (const pc of pieces) { t2.beginPath(); pc.pts.forEach((p, i) => i ? t2.lineTo(p[0] * k, p[1] * k) : t2.moveTo(p[0] * k, p[1] * k)); t2.closePath(); t2.fill(); }
      const d = t2.getImageData(0, 0, tmp.width, tmp.height).data; x.fillStyle = sty.dots; for (let yy = 6; yy < h; yy += 13) for (let xx = 6; xx < w; xx += 13) { if (d[(Math.floor(yy) * tmp.width + Math.floor(xx)) * 4 + 3] > 0) { x.globalAlpha = .55 + .35 * hash(xx, yy); x.beginPath(); x.arc(xx, yy, 3.4, 0, 7); x.fill(); } } x.globalAlpha = 1; }
    if (sty.coast) { x.lineJoin = 'round'; x.lineCap = 'round'; x.strokeStyle = sty.coast; x.lineWidth = sty.coastW; x.shadowColor = sty.glow; x.shadowBlur = 7 * r; for (const pc of pieces) { trace(pc); x.stroke(); } x.shadowBlur = 0; for (const pc of pieces) { trace(pc); x.stroke(); } }
  }, { res, mip: true, anchor: 'top-left' });
  B.put(map, 0, 0); map.position.x = (rx - 960) * U; map.position.y = (540 - ry) * U;
  const t0 = startAt(S, o, 0, -1e9); if (t0 > -1e8) fadeIn(map, t0, o.in ?? 5);
  // labels with lines drawing to a point
  for (const L of timed(S, o.labels, i => S.t0 + (2 + i * 2) * F)) {
    const to = mp(L.to ?? o.pins?.[0]?.place ?? 'paris'), at = [L.x ?? 300, L.y ?? 120];
    const ln = gline([at, to], L.width ?? 2.4, { color: L.color ?? sty.route, halo: 9, glow: .5 }); B.line(ln); drawOn(ln, L.t, L.frames ?? 12, 'outQuad');
    // (sister f280: the label capsules are ~78 px tall with a gold border)
    const c = tagCard(L.text, L.style ?? sty.label, L.h ?? 80); B.put(c, at[0], at[1]); popIn(c, L.t, P.POP);
  }
  // routes (arcs) drawing on
  for (const R of timed(S, o.routes, i => S.t0 + (6 + i) * F)) {
    const a = mp(R.from), b = mp(R.to), ln = gline(arcPts(a, b, R.bend ?? .22, 40), R.width ?? 2.4, { color: R.color ?? sty.route, halo: 8, glow: .45 }); B.line(ln); drawOn(ln, R.t, R.frames ?? 9, 'inOutQuad', { fade: R.fade });
  }
  // nodes: cream disc in an amber ring with a glow
  for (const N of timed(S, o.nodes, -1e9)) { const p = mp(N.place), c = dotCard(N.r ?? 11, N.fill ?? '#efe2c4', N.ring ?? '#d9a24c', 'rgba(230,170,80,.45)'); B.put(c, p[0], p[1]); popIn(c, N.t, P.POPBIG); }
  // red pins with a bloom pulse
  for (const Pn of timed(S, o.pins, S.t0 + 8 * F)) {
    const p = mp(Pn.place), pin = paintCard(60, 84, x => { x.fillStyle = Pn.color ?? '#e0302a'; x.beginPath(); x.arc(30, 28, 20, Math.PI * .85, Math.PI * .15); x.lineTo(30, 78); x.closePath(); x.fill(); x.fillStyle = '#ffffff'; x.beginPath(); x.arc(30, 28, 7.5, 0, 7); x.fill(); }, { res: 2 });
    pin.geometry.translate(0, 34 * U, 0); B.put(pin, p[0], p[1]); popIn(pin, Pn.t, P.POPBIG);
    const bloom = glowCard(140, 'rgba(255,70,50,.85)'); B.put(bloom, p[0], p[1]); const tb = Pn.t;
    anim(bloom, t => { const f = tb < -1e8 ? 99 : (t - tb) * FPS; const a = f < 0 ? 0 : f < 3 ? f / 3 : f < 12 ? 1 - (f - 3) / 9 * .55 : .45; setAlpha(bloom, a * (Pn.bloom ?? .9)); bloom.scale.setScalar(f < 0 ? .1 : f < 12 ? .6 + .6 * E.outQuad(Math.min(1, f / 12)) : 1.2); });
  }
  // FROZEN-style stamps by a point
  for (const St of timed(S, o.stamps, S.t0 + 10 * F, 0)) { const p = mp(St.place), cap = St.cap ?? 16, sc = document.createElement('canvas').getContext('2d'), w = P.measure(sc, St.text ?? 'FROZEN', { cap, w: 800, track: .08 }) + cap * 1.6;
    const c = paintCard(w + 10, cap * 2.4 + 10, x => P.paintStamp(x, (w + 10) / 2, (cap * 2.4 + 10) / 2, St.text ?? 'FROZEN', { cap, rot: 0, color: St.color }), { res: 2 }); c.rotation.z = (St.rot ?? (hash(p[0], 2) - .5) * 10) * Math.PI / 180;
    B.put(c, p[0] + (St.dx ?? 30), p[1] + (St.dy ?? 22)); popIn(c, St.t, P.STAMP); }
  // pills on the map (world-space statements)
  for (const Pl of timed(S, o.pills, S.t0 + 4 * F)) { const c = pillCard(Pl.text, Pl.theme ?? 'fact', Pl.h ?? 90); B.put(c, Pl.x ?? 960, Pl.y ?? 950); popIn(c, Pl.t, P.POP); }
  // the fast push-in
  if (o.push && !hadCam) { const ps = o.push, to = mp(ps.to ?? o.pins?.[0]?.place ?? 'paris'), tp = startAt(S, ps, 0, S.t1 - .5), z = ps.zoom ?? 2.6;
    S.camera('keys', { keys: [{ t: tp, ...B.view(960, 540, 960) }, { t: tp + (ps.frames ?? 8) * F, ...B.view(lerp(960, to[0], .85), lerp(540, to[1], .85), 960 / z), ease: ps.ease ?? 'inQuad' }] }); }
  B.mp = mp; B.g.userData.board = B; return B.g;
}

// =====================================================================================================================
// CITY GRID: blocks of streets in red on black with dots at the crossings, labelled icons (tower, garage, police, van,
// cam), a dashed route drawing on, statement pills; cams: n red-white CCTV icons popping one a frame.
// =====================================================================================================================
export function citygrid(S, o = {}) {
  const col = o.color ?? '#e0584f', cell = o.cell ?? 72, B = makeBoard(S, { bg: o.bg ?? ['#140e0a', '#070504'], kind: 'citygrid', bgR: .6 });
  const ox = o.ox ?? 40, oy = o.oy ?? 70, cols = o.cols ?? Math.ceil(1880 / cell), rows = o.rows ?? Math.ceil(960 / cell);
  const G = (gx, gy) => [ox + gx * cell, oy + gy * cell];
  const grid = paintCard(1920, 1080, (x) => { x.strokeStyle = col; x.globalAlpha = .75; x.lineWidth = 1.8;
    for (let i = 0; i <= cols; i++) { x.beginPath(); x.moveTo(ox + i * cell, oy); x.lineTo(ox + i * cell, oy + rows * cell); x.stroke(); }
    for (let j = 0; j <= rows; j++) { x.beginPath(); x.moveTo(ox, oy + j * cell); x.lineTo(ox + cols * cell, oy + j * cell); x.stroke(); }
    x.globalAlpha = 1; x.fillStyle = col; for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) { x.beginPath(); x.arc(ox + i * cell, oy + j * cell, 3.6, 0, 7); x.fill(); } }, { res: 1.25 });
  B.put(grid, 960, 540); const t0 = startAt(S, o, 0, -1e9); if (t0 > -1e8) fadeIn(grid, t0, 5);
  const iconPainter = (shape, c) => x => { x.fillStyle = c; x.strokeStyle = c;
    if (shape === 'tower') { x.lineWidth = 2; x.strokeRect(14, 4, 32, 120); for (let y = 12; y < 120; y += 8) { x.fillRect(18, y, 24, 2); } }
    else if (shape === 'van') { x.beginPath(); x.roundRect(6, 22, 48, 18, 4); x.fill(); }
    else if (shape === 'cam') { x.fillStyle = '#f2ece6'; x.beginPath(); x.roundRect(8, 14, 34, 18, 3); x.fill(); x.fillStyle = '#d23a32'; x.fillRect(42, 18, 8, 10); x.fillRect(12, 32, 4, 12); }
    else if (shape === 'dot') { x.beginPath(); x.arc(30, 30, 9, 0, 7); x.fill(); }
    else { x.beginPath(); x.roundRect(14, 14, 32, 32, 4); x.fill(); } };
  for (const I of timed(S, o.icons, -1e9)) { const [px, py] = I.px ?? G(I.x, I.y), tall = I.shape === 'tower', ic = paintCard(60, tall ? 130 : 60, iconPainter(I.shape ?? 'square', I.color ?? '#f0c060'), { res: 2 });
    B.put(ic, px, py); popIn(ic, I.t, P.POPBIG);
    if (I.label) { const tx = textCard(I.label, { cap: 17, w: 800, track: .12, color: I.labelColor ?? '#e8dccb' }); B.put(tx, px, py + (tall ? 80 : 44)); popIn(tx, I.t, P.POP); } }
  if (o.cams) { const R = rnd(o.seed ?? 4), n = o.cams.n ?? o.cams, tc = startAt(S, o.cams, 0, S.t0 + 3 * F);
    for (let i = 0; i < n; i++) { const ic = paintCard(60, 60, iconPainter('cam'), { res: 1.5 }); B.put(ic, 80 + R() * 1760, 110 + R() * 860); popIn(ic, tc > -1e8 ? tc + i * (o.cams.every ?? 1) * F : -1e9, P.POPBIG); } }
  if (o.route) { const R = o.route, pts = (R.pts ?? []).map(p => R.px ? p : G(p[0], p[1])), ln = gline(pts, R.width ?? 3, { color: R.color ?? '#f2ece6', halo: 6, glow: .35, dash: R.dashed === false ? null : [14, 10] });
    B.line(ln); drawOn(ln, startAt(S, R, 0, S.t0 + 10 * F), R.frames ?? 18, 'inOutQuad');
    if (R.dot !== false) { const d = dotCard(8, '#f2ece6', null, 'rgba(255,255,255,.5)'); B.put(d, pts[0][0], pts[0][1]); } }
  for (const Pl of timed(S, o.pills, S.t0 + 6 * F)) { const c = tagCard(Pl.text, Pl.theme ?? 'danger', Pl.h ?? 44); B.put(c, Pl.x ?? 960, Pl.y ?? 900); popIn(c, Pl.t, P.POP); }
  B.G = G; B.g.userData.board = B; return B.g;
}

// =====================================================================================================================
// FLOOR PLAN (sister's office floor): near-black, a thin amber outline with corridor walls (double lines) and dim desks,
// red X marks with red caps labels (WINDOWS / LIFTS), people as dots with labels, a highlighted box (STAIRS), a green
// dashed safe path drawing on, a green statement pill and a small caption under it.
//   outline: [x, y, w, h], walls: [[x0, y0, x1, y1], ...], desks: [[x, y, w, h], ...] | n rows, exits: [{ x, y, label, word }],
//   dots: [{ x, y, label, color, word, below }], boxes: [{ x, y, w, h, label }], path: { pts, word, frames }, pills, caption
// =====================================================================================================================
export function floorplan(S, o = {}) {
  const B = makeBoard(S, { bg: o.bg ?? ['#1a1610', '#070605'], kind: 'floorplan', bgR: .6 });
  const [ox, oy, ow, oh] = o.outline ?? [300, 220, 1320, 560], line = o.color ?? '#d39a4c';
  const walls = o.walls ?? [[ox + ow * .29, oy, ox + ow * .29, oy + oh], [ox + ow * .32, oy, ox + ow * .32, oy + oh], [ox + ow * .62, oy, ox + ow * .62, oy + oh], [ox + ow * .65, oy, ox + ow * .65, oy + oh]];
  const desks = Array.isArray(o.desks) ? o.desks : (() => { const out = [], rows = o.desks ?? 2; for (let r = 0; r < rows; r++) for (let c = 0; c < 4; c++) out.push([ox + ow * (.16 + c * .182), oy + oh * (.38 + r * .23), ow * .137, oh * .125]); return out; })();
  const plan = paintCard(1920, 1080, (x) => { x.strokeStyle = line; x.lineWidth = 2.6; x.shadowColor = 'rgba(220,150,70,.45)'; x.shadowBlur = 5; x.strokeRect(ox, oy, ow, oh);
    x.globalAlpha = .55; x.lineWidth = 2; for (const [a, b, c, d] of walls) { x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); }
    x.globalAlpha = .38; for (const [a, b, c, d] of desks) x.strokeRect(a, b, c, d); x.globalAlpha = 1; x.shadowBlur = 0;
    for (const bx of o.boxes ?? []) { x.lineWidth = 3.5; x.strokeStyle = bx.color ?? '#e8aa50'; x.strokeRect(bx.x, bx.y, bx.w, bx.h); if (bx.label) P.drawText(x, bx.label, bx.x + bx.w / 2, bx.y + bx.h + 48, { cap: 26, w: 800, track: .02, color: '#f0dcc0', align: 'center' }); }
    if (o.caption) P.drawText(x, o.caption, 1180, 1012, { cap: 20, w: 800, track: .12, color: '#e9e2d6', align: 'center' }); }, { res: 1.25 });
  B.put(plan, 960, 540); const t0 = startAt(S, o, 0, -1e9); if (t0 > -1e8) fadeIn(plan, t0, 5);
  for (const X of timed(S, (o.exits ?? []).map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : p), -1e9)) {
    const c = paintCard(80, 80, x => { x.strokeStyle = '#e0453a'; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(10, 10); x.lineTo(70, 70); x.moveTo(70, 10); x.lineTo(10, 70); x.stroke(); }, { res: 2 }); B.put(c, X.x, X.y); popIn(c, X.t, P.POPBIG);
    if (X.label) { const tx = textCard(X.label, { cap: 26, w: 800, track: .02, color: '#f2685a' }); B.put(tx, X.x, X.y + 68); popIn(tx, X.t, P.POP); } }
  if (o.path) { const R = o.path, ln = gline(R.pts, R.width ?? 3.4, { color: R.color ?? '#5fd38a', halo: 8, glow: .4, dash: R.dashed === false ? null : [14, 9] }); B.line(ln); drawOn(ln, startAt(S, R, 0, S.t0 + 8 * F), R.frames ?? 20, 'inOutQuad'); }
  for (const D of timed(S, o.dots, -1e9)) { const c = dotCard(D.r ?? 12, D.color ?? '#f6e6cc', null, null); B.put(c, D.x, D.y); popIn(c, D.t, P.POPBIG);
    if (D.label) { const tx = textCard(D.label, { cap: 22, w: 800, track: .02, color: D.labelColor ?? D.color ?? '#f6e6cc' }); B.put(tx, D.x - (D.dx ?? 0), D.y + (D.below ? 44 : -44)); popIn(tx, D.t, P.POP); } }
  for (const Pl of timed(S, o.pills, S.t0 + 6 * F)) { const c = pillCard(Pl.text, Pl.theme ?? 'success', Pl.h ?? 90); B.put(c, Pl.x ?? 1180, Pl.y ?? 930); popIn(c, Pl.t, P.POP); }
  B.g.userData.board = B; return B.g;
}

// =====================================================================================================================
// BUILDING: a wireframe tower in perspective (floor boxes), orange lines with a glow (or the green visor style), red X
// marks inside some floors, small gold labels (STAIRS / LIFTS), a ground grid, a highlighted floor on its word.
// =====================================================================================================================
export function building(S, o = {}) {
  const green = o.style === 'green', col = green ? '#69cc90' : (o.color ?? '#d29b58'), glowC = green ? 'rgba(105,204,144,.6)' : 'rgba(220,150,80,.6)';
  const B = makeBoard(S, { bg: o.bg ?? (green ? ['#0d2026', '#050c0f'] : ['#1a120d', '#080504']), kind: 'building', bgR: .55 });
  const n = o.floors ?? 30, cx = o.x ?? 1180, base = o.y ?? 940, fw = o.w ?? 260, fd = o.d ?? 120, fh = Math.min(26, (o.h ?? 760) / n), dx = fd * .62, dy = -fd * .32;
  const fy = i => base - i * fh;
  const tower = paintCard(1920, 1080, (x) => {
    x.strokeStyle = col; x.lineWidth = 1.3; x.shadowColor = glowC; x.shadowBlur = 6;
    // ground grid
    x.globalAlpha = .35; for (let i = -10; i <= 10; i++) { x.beginPath(); x.moveTo(cx + i * 60, base + 40); x.lineTo(cx + i * 60 + dx * 3, base + 40 + dy * 3); x.stroke(); } for (let j = 0; j < 4; j++) { x.beginPath(); x.moveTo(cx - 600 + j * dx, base + 40 + j * dy); x.lineTo(cx + 600 + j * dx, base + 40 + j * dy); x.stroke(); }
    x.globalAlpha = 1;
    for (let i = 0; i <= n; i++) { const y = fy(i); x.beginPath(); x.moveTo(cx - fw / 2, y); x.lineTo(cx + fw / 2, y); x.lineTo(cx + fw / 2 + dx, y + dy); x.stroke(); if (i === n) { x.beginPath(); x.moveTo(cx - fw / 2, y); x.lineTo(cx - fw / 2 + dx, y + dy); x.lineTo(cx + fw / 2 + dx, y + dy); x.stroke(); } }
    for (const X of [cx - fw / 2, cx + fw / 2]) { x.beginPath(); x.moveTo(X, base); x.lineTo(X, fy(n)); x.stroke(); }
    x.beginPath(); x.moveTo(cx + fw / 2 + dx, base + dy); x.lineTo(cx + fw / 2 + dx, fy(n) + dy); x.stroke(); x.beginPath(); x.moveTo(cx - fw / 2 + dx, fy(n) + dy); x.lineTo(cx - fw / 2 + dx, fy(n) + dy); x.stroke();
    x.globalAlpha = .4; for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(cx - fw / 2 + k * fw / 4, base); x.lineTo(cx - fw / 2 + k * fw / 4, fy(n)); x.stroke(); }
    x.globalAlpha = 1; x.shadowBlur = 0;
    const R = rnd(o.seed ?? 2); x.strokeStyle = '#c4503c'; x.lineWidth = 1.6; for (let k = 0; k < (o.xs ?? 0); k++) { const i = Math.floor(R() * n), X = cx - fw / 2 + 20 + R() * (fw - 40), y = fy(i) - fh / 2; x.beginPath(); x.moveTo(X - 5, y - 5); x.lineTo(X + 5, y + 5); x.moveTo(X + 5, y - 5); x.lineTo(X - 5, y + 5); x.stroke(); }
    for (const L of o.labels ?? []) P.drawText(x, L.text, cx + fw / 2 + dx + 14, fy(L.floor ?? 1) - fh / 2 + 6, { cap: 12, w: 800, track: .12, color: green ? '#a8f0c4' : '#e6b071' });
  }, { res: 1.5 });
  B.put(tower, 960, 540); const t0 = startAt(S, o, 0, -1e9); if (t0 > -1e8) fadeIn(tower, t0, 6);
  if (o.highlight) { const h = typeof o.highlight === 'number' ? { floor: o.highlight } : o.highlight, y = fy(h.floor) ;
    const hl = paintCard(fw + dx + 20, fh - dy + 20, x => { x.fillStyle = green ? 'rgba(105,204,144,.45)' : 'rgba(240,170,80,.5)'; x.beginPath(); x.moveTo(10, 10 - dy + fh); x.lineTo(10 + fw, 10 - dy + fh); x.lineTo(10 + fw + dx, 10 + fh); x.lineTo(10 + fw + dx, 10); x.lineTo(10 + dx, 10); x.lineTo(10, 10 - dy); x.closePath(); x.fill(); }, { res: 1.5 });
    B.put(hl, cx - fw / 2 - 10 + (fw + dx + 20) / 2, y - fh + dy - 10 + (fh - dy + 20) / 2); const th = startAt(S, h, 2 * F, S.t0 + 8 * F);
    anim(hl, t => setAlpha(hl, th < -1e8 ? 1 : t < th ? 0 : .55 + .45 * Math.abs(Math.sin((t - th) * 4)))); if (h.label) { const c = tagCard(h.label, 'fact', 44); B.put(c, cx + fw / 2 + dx + 120, y - fh / 2); popIn(c, th, P.POP); } }
  if (green && o.visor !== false) { const v = paintCard(1920, 1080, x => { x.strokeStyle = 'rgba(105,204,144,.55)'; x.lineWidth = 3; x.beginPath(); x.roundRect(120, 110, 1680, 860, 60); x.stroke();
      x.lineWidth = 6; for (const [X, Y, sx, sy] of [[150, 140, 1, 1], [1770, 140, -1, 1], [150, 940, 1, -1], [1770, 940, -1, -1]]) { x.beginPath(); x.moveTo(X, Y + sy * 70); x.lineTo(X, Y); x.lineTo(X + sx * 70, Y); x.stroke(); } }, { res: 1 }); B.put(v, 960, 540); }
  B.floorY = fy; B.g.userData.board = B; return B.g;
}

// =====================================================================================================================
// NETWORK GRAPH: navy with a faint grid, glowing cream / amber nodes, amber links drawing on (10 frames) on their words,
// cluster blobs, icons (bank, mail, person, phone), capsule tags, tokens (envelopes) flying along a link in 15 frames and
// vanishing with a small flash.
// =====================================================================================================================
const ICONS = {
  bank: x => { x.strokeStyle = '#e8c27a'; x.lineWidth = 3.5; x.beginPath(); x.moveTo(8, 22); x.lineTo(32, 8); x.lineTo(56, 22); x.closePath(); x.stroke(); for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(15 + i * 11.5, 26); x.lineTo(15 + i * 11.5, 46); x.stroke(); } x.beginPath(); x.moveTo(8, 50); x.lineTo(56, 50); x.stroke(); },
  mail: x => { x.strokeStyle = '#e8c27a'; x.lineWidth = 3.5; x.strokeRect(10, 18, 44, 30); x.beginPath(); x.moveTo(10, 18); x.lineTo(32, 36); x.lineTo(54, 18); x.stroke(); },
  person: x => { x.fillStyle = '#e8c27a'; x.beginPath(); x.arc(32, 20, 10, 0, 7); x.fill(); x.beginPath(); x.ellipse(32, 52, 18, 14, 0, Math.PI, 0); x.fill(); },
  phone: x => { x.strokeStyle = '#e8c27a'; x.lineWidth = 3.5; x.beginPath(); x.roundRect(20, 6, 24, 50, 5); x.stroke(); x.fillStyle = '#e8c27a'; x.fillRect(29, 48, 6, 3); },
};
export function network(S, o = {}) {
  const B = makeBoard(S, { bg: o.bg ?? ['#18213a', '#090d1a'], kind: 'network', bgR: .6, bgPaint: (x, w, h) => { x.strokeStyle = 'rgba(140,160,210,.06)'; x.lineWidth = .5; for (let i = 0; i < w; i += 14) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); } for (let j = 0; j < h; j += 14) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); } } });
  const N = {}; const nodes = timed(S, o.nodes, -1e9, 0);
  for (const b of o.blobs ?? []) { const c = paintCard(b.rx * 2 + 20, b.ry * 2 + 20, x => { x.fillStyle = 'rgba(150,160,190,.12)'; x.beginPath(); x.ellipse(b.rx + 10, b.ry + 10, b.rx, b.ry, 0, 0, 7); x.fill(); x.fillStyle = 'rgba(180,190,220,.18)'; const R = rnd(b.x); for (let i = 0; i < 40; i++) { const a = R() * 7, r = Math.sqrt(R()); x.fillRect(b.rx + 10 + Math.cos(a) * r * b.rx * .8, b.ry + 10 + Math.sin(a) * r * b.ry * .8, 8, 5); } }, { res: 1 }); B.put(c, b.x, b.y); }
  for (const L of timed(S, (o.links ?? []).map(l => Array.isArray(l) ? { from: l[0], to: l[1], word: l[2] } : l), i => S.t0 + (2 + i * 3) * F, 0)) {
    const a = nodes.find(n => n.id === L.from), b = nodes.find(n => n.id === L.to); if (!a || !b) continue;
    const ln = gline(L.bend ? arcPts([a.x, a.y], [b.x, b.y], L.bend, 24) : [[a.x, a.y], [b.x, b.y]], L.width ?? 4, { color: L.color ?? '#e9b765', glowColor: '#e0a050', halo: 14, glow: .5 }); B.line(ln); drawOn(ln, L.t, L.frames ?? 10, 'inOutQuad');
  }
  for (const n of nodes) { const big = n.r ?? 9, c = dotCard(big, n.color ?? '#fbe7bd', null, 'rgba(250,200,110,.55)'); B.put(c, n.x, n.y); popIn(c, n.t, P.POPBIG); N[n.id] = n;
    if (n.icon) { const ic = paintCard(64, 64, ICONS[n.icon] ?? ICONS.bank, { res: 2 }); B.put(ic, n.x + (n.ix ?? 0), n.y + (n.iy ?? -70)); popIn(ic, n.t, P.POP); }
    if (n.label) { const c2 = tagCard(n.label, n.style ?? 'amber', 48); B.put(c2, n.x + (n.lx ?? 0), n.y + (n.ly ?? 60)); popIn(c2, n.t, P.POP); } }
  for (const g of timed(S, o.tags, S.t0 + 6 * F)) { const c = tagCard(g.text, g.style ?? 'amber', g.h ?? 52); B.put(c, g.x, g.y); popIn(c, g.t, P.POP); }
  for (const k of timed(S, o.tokens, S.t0 + 12 * F, 0)) { const a = N[k.from], b = N[k.to]; if (!a || !b) continue;
    const env = paintCard(64, 64, ICONS[k.icon ?? 'mail'], { res: 2 }); B.put(env, a.x, a.y); const A = B.xy(a.x, a.y), Bp = B.xy(b.x, b.y), fr = k.frames ?? 15;
    moveOn(env, A, Bp, k.t, fr, 'inOutQuad'); anim(env, t => setAlpha(env, k.t < -1e8 ? 0 : t < k.t || t > k.t + fr * F ? 0 : 1));
    const fl = glowCard(70, 'rgba(255,230,170,.9)'); B.put(fl, b.x, b.y); anim(fl, t => { const f = (t - k.t) * FPS - fr; setAlpha(fl, f < 0 || f > 6 ? 0 : 1 - f / 6); fl.scale.setScalar(.6 + f / 6); }); }
  B.g.userData.board = B; return B.g;
}

// =====================================================================================================================
// BLUEPRINT DIAGRAMS: line drawings (cool grey #969ba8, 12 px outer strokes, 6 px inner) on a navy radial backdrop that
// draw on stroke by stroke (each 8-10 frames, staggered 1-3 frames: a figure in ~13 frames) from its word; accents (teal
// bow), gold dots with a glow, a glow payoff (glow: { word, x, y, r }) with sparkles.
// shapes (unit = s px, centred on x, y): head, brain, gift, box, arrow, circle, bulb, heart, person, path (pts in px)
// =====================================================================================================================
const SHAPES = {
  head: () => [{ pts: circlePts(0, 0, 1, 1, 64, -Math.PI / 2), w: 12 }, { pts: [[-.28, .95], [-.3, 1.6]], w: 12 }, { pts: [[.28, .95], [.3, 1.6]], w: 12 },
    { pts: [[-.12, .62], [.12, .62]], w: 6 }, { dot: [-.35, .42, .06] }, { dot: [.35, .42, .06] }],
  brain: () => { const o = []; const blob = []; for (let i = 0; i <= 40; i++) { const a = Math.PI * 2 * i / 40, r = 1 + .08 * Math.sin(a * 7); blob.push([Math.cos(a) * r * 1.25, Math.sin(a) * r * .85 - .05]); } o.push({ pts: blob, w: 8 });
    o.push({ pts: [[0, -.9], [.02, -.2], [0, .75]], w: 6 }); for (const s of [-1, 1]) for (let k = 0; k < 3; k++) o.push({ pts: [[s * .25, -.45 + k * .32], [s * .55, -.6 + k * .32], [s * .95, -.42 + k * .32]], w: 5 }); return o; },
  gift: () => [{ pts: [[-1, -.3], [1, -.3], [1, 1], [-1, 1], [-1, -.3]], w: 10 }, { pts: [[-1.12, -.62], [1.12, -.62], [1.12, -.3], [-1.12, -.3], [-1.12, -.62]], w: 10 }, { pts: [[0, -.62], [0, 1]], w: 8 },
    { pts: [[0, -.62], [-.35, -.95], [-.15, -.62]], w: 7, accent: true }, { pts: [[0, -.62], [.35, -.95], [.15, -.62]], w: 7, accent: true }],
  box: () => [{ pts: [[-1, -.7], [1, -.7], [1, .7], [-1, .7], [-1, -.7]], w: 10 }],
  arrow: () => [{ pts: [[-1, 0], [1, 0]], w: 10 }, { pts: [[.6, -.35], [1, 0], [.6, .35]], w: 10 }],
  circle: () => [{ pts: circlePts(0, 0, 1, 1, 64), w: 10 }],
  bulb: () => { const pts = []; for (let i = 0; i <= 40; i++) { const a = Math.PI * .75 + Math.PI * 1.5 * i / 40; pts.push([Math.cos(a) * .75, Math.sin(a) * .75 - .3]); } return [{ pts: [[-.35, .5], ...pts, [.35, .5]], w: 10 }, { pts: [[-.35, .5], [-.35, .75], [.35, .75], [.35, .5]], w: 8 }, { pts: [[-.25, .95], [.25, .95]], w: 8 }]; },
  heart: () => { const pts = []; for (let i = 0; i <= 60; i++) { const t = Math.PI * 2 * i / 60; pts.push([16 * Math.sin(t) ** 3 / 16, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16]); } return [{ pts, w: 10 }]; },
  shoulders: () => { const pts = []; for (let i = 0; i <= 40; i++) { const u = i / 40, a = Math.PI * (1 - u); pts.push([Math.cos(a) * 1.1 * (1 + .12 * Math.sin(u * Math.PI)), -Math.sin(a) * .55 + .55]); }
    return [{ pts: [[-1.25, .95], [-1.12, .6], ...pts.map(p => [p[0], p[1] - .02]), [1.12, .6], [1.25, .95]], w: 10 }]; },
  person: () => [{ pts: circlePts(0, -1.1, .38, .38, 40), w: 10 }, { pts: [[0, -.72], [0, .4]], w: 10 }, { pts: [[-.6, -.2], [0, -.45], [.6, -.2]], w: 10 }, { pts: [[-.45, 1.2], [0, .4], [.45, 1.2]], w: 10 }],
};
export function diagram(S, o = {}) {
  const B = makeBoard(S, { bg: o.bg ?? ['#29365a', '#121830'], kind: 'diagram', bgR: .62 });
  const col = o.color ?? '#a3a8b6', accent = o.accent ?? '#5ac8b8';
  const t0 = startAt(S, o, 0, S.t0 + F);
  (o.items ?? [{ shape: 'head', x: 960, y: 420, s: 170 }]).forEach((it, k) => {
    const ti = startAt(S, it, 0, t0 + k * 2 * F), s = it.s ?? 200, cx = it.x ?? 960, cy = it.y ?? 540, rot = (it.rot ?? 0) * Math.PI / 180;
    const strokes = it.shape === 'path' ? [{ pts: it.pts.map(p => [(p[0] - cx) / s, (p[1] - cy) / s]), w: it.w ?? 10 }] : (SHAPES[it.shape] ?? SHAPES.circle)();
    const tf = (p) => { const x = p[0] * s, y = p[1] * s; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]; };
    strokes.forEach((st, j) => { const tj = ti < -1e8 ? -1e9 : ti + Math.min(j, 6) * (it.stagger ?? 1) * F;
      if (st.dot) { const d = paintCard(st.dot[2] * s * 2 + 8, st.dot[2] * s * 2 + 8, x => { x.fillStyle = col; x.beginPath(); x.arc(st.dot[2] * s + 4, st.dot[2] * s + 4, st.dot[2] * s, 0, 7); x.fill(); }, { res: 2 }); const p = tf(st.dot); B.put(d, p[0], p[1]); fadeIn(d, tj + 7 * F, 2); return; }
      const ln = gline(st.pts.map(tf), (st.w ?? 10) * (it.weight ?? 1) * Math.min(1.4, s / 150), { color: st.accent || it.accent ? (it.accentColor ?? accent) : (it.color ?? col), halo: 3, glow: .25 }); B.line(ln); drawOn(ln, tj, it.frames ?? 10, 'inOutSine'); });
    if (it.dots) { const R = rnd(k + 3); const n = it.dots.n ?? 8; for (let i = 0; i < n; i++) { const a = R() * 7, r = Math.sqrt(R()) * (it.dots.r ?? .25) * s, d = dotCard(7, '#f0c060', null, 'rgba(255,200,90,.7)');
      B.put(d, cx + (it.dots.dx ?? 0) * s + Math.cos(a) * r, cy + (it.dots.dy ?? 0) * s + Math.sin(a) * r); popIn(d, startAt(S, it.dots, 2 * F, ti + (12 + i) * F), P.POPBIG); } }
  });
  if (o.glow) { const g = o.glow, gc = glowCard(g.r ?? 220, g.color ?? 'rgba(255,200,100,.85)'); B.put(gc, g.x ?? 960, g.y ?? 400); const tg = startAt(S, g, 2 * F, S.t0 + 30 * F);
    anim(gc, t => { const k = tg < -1e8 ? 1 : E.outQuad(clamp((t - tg) * FPS / 9)); setAlpha(gc, k); gc.scale.setScalar(.4 + .6 * k); });
    const R = rnd(9); for (let i = 0; i < (g.sparkles ?? 10); i++) { const sp = dotCard(4, '#ffe6a8', null, 'rgba(255,220,140,.8)'), a = R() * 7, d0 = 20, d1 = 140 + R() * 120; B.put(sp, g.x ?? 960, g.y ?? 400);
      const A = B.xy((g.sx ?? g.x ?? 960) + Math.cos(a) * d0, (g.sy ?? g.y ?? 400) + Math.sin(a) * d0), Bp = B.xy((g.sx ?? g.x ?? 960) + Math.cos(a) * d1, (g.sy ?? g.y ?? 400) + Math.sin(a) * d1);
      moveOn(sp, A, Bp, tg, 14, 'outQuad'); anim(sp, t => { const f = (t - tg) * FPS; setAlpha(sp, f < 0 || f > 16 ? 0 : 1 - f / 16); }); } }
  B.g.userData.board = B; return B.g;
}
void fmat; void lerp;
