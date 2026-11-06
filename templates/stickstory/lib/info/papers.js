// Graphics on PAPER and SCREENS IN HAND: documents and notes (handwriting fading in line by line ahead of the words),
// calendars (a red marker ring drawing on round a day), score cards, signs, in-world stat boxes, charts (bell curve of
// tiny figures, line, bars, vote, gauge) and phones (call, chat, notification, bank, alert, map). Each one either fills a
// whole shot on its own backdrop (no pos: a board with a desk / wall / dark backdrop and a static camera) or stands in a
// set (pos: [x, y, z] metres, width: metres, rot: degrees) where a hand can hold it (userData.grips).
// References: analysis/graphics/NOTES.md 3e, 3f, 3k (+ crops gfx-si-note2, gfx-iq-calendar, gfx-iq-aptitude, gfx-iq-bell*,
// gfx-tl-vote2, gfx-iq-bankcall / bankapp, gfx-tl-alert, gfx-tl-novasign).
import { THREE, FPS, clamp, lerp, E, rnd, hash, rrect, mat } from '../core.js';
import * as P from './paint.js';
import { U, fmat, paintCard, textCard, gline, circlePts, anim, setAlpha, popIn, fadeIn, drawOn, makeBoard } from './kit.js';

const F = 1 / FPS;
const T = (S, v, lead = 0) => P.when(S, v, lead);
const startAt = (S, o, lead = 2 * F, dflt = -1e9) => o && (o.at != null || o.word != null) ? P.landed(S, P.startOf(S, o, lead)) : dflt;
const INK = '#2f366b', PAPER = '#f7f2e7', RULE = 'rgba(120,145,200,.32)';

// ---------- backdrops for a whole-shot paper ----------
const BACKDROPS = {
  desk: { bg: ['#8a6142', '#4f3523'], paint: (x, w, h) => { const R = rnd(3); for (let y = 0; y < h; y += 22) { x.fillStyle = `rgba(40,20,8,${.08 + .06 * R()})`; x.fillRect(0, y, w, 1.2); } for (let i = 0; i < 60; i++) { x.fillStyle = 'rgba(255,220,180,.04)'; x.fillRect(R() * w, R() * h, 30 + 80 * R(), 1); } } },
  wall: { bg: ['#dccfb9', '#a8987f'] }, cork: { bg: ['#b98b58', '#7a5634'] },
  dark: { bg: ['#2b2a2e', '#0e0e10'] }, navy: { bg: ['#1a2238', '#0b0f1c'] }, green: { bg: ['#1f2a22', '#0b100c'] }, wood: { bg: ['#5a3524', '#2a160d'] },
};
/** where a paper lives: a whole-shot board (no pos) or a group in the set (pos). Children are laid out in px around (0, 0) with px(obj, x, y). */
function host(S, o, wpx, hpx, backdrop = 'desk') {
  const root = new THREE.Group(); root.userData.kind = o.kind || 'paper'; root.userData.pickRoot = true; root.name = o.name || root.userData.kind;
  const px = (obj, x = 0, y = 0, z = 0) => { obj.position.set(x * U, -y * U, z); root.add(obj); return obj; };
  if (o.pos) {
    const k = (o.width ?? .3) / (wpx * U); root.scale.setScalar(k); root.position.set(o.pos[0], o.pos[1], o.pos[2] ?? 0); root.rotation.z = (o.rot ?? 0) * Math.PI / 180;
    root.userData.size = [wpx * U * k, hpx * U * k]; root.userData.grips = { L: [-wpx * U * k * .42, -hpx * U * k * .4], R: [wpx * U * k * .42, -hpx * U * k * .4], center: [0, -hpx * U * k * .3] };
    return { root, px, B: null };
  }
  const bd = typeof backdrop === 'string' ? BACKDROPS[backdrop] ?? { bg: [backdrop, backdrop] } : backdrop;
  const B = makeBoard(S, { bg: o.bg ?? bd.bg, bgPaint: bd.paint, kind: root.userData.kind, frameH: o.frameH });
  B.put(root, o.x ?? 960, o.y ?? 540); root.rotation.z = (o.rot ?? 0) * Math.PI / 180; root.userData.board = B; root.userData.grips = { L: [-wpx * U * .42, -hpx * U * .4], R: [wpx * U * .42, -hpx * U * .4] };
  B.g.userData.board = B; return { root, px, B };
}
const order = (obj, n) => { obj.traverse(m => { if (m.isMesh) m.renderOrder = n; }); return obj; };
/** a sheet of paper (opaque card writes depth) with a soft shadow; paint(x, w, h) draws its printed content */
function sheet(wpx, hpx, paint, o = {}) {
  const g = new THREE.Group();
  const sh = paintCard(wpx + 80, hpx + 80, (x) => { x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 26; x.shadowOffsetY = 10; x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(40, 40, wpx, hpx); }, { res: .5, mip: false, noPick: true });
  sh.position.set(6 * U, -8 * U, -.002); g.add(order(sh, 9));
  const card = paintCard(wpx, hpx, (x, w, h, k) => { x.fillStyle = o.paper ?? PAPER; x.fillRect(0, 0, w, h); paint?.(x, w, h, k); }, { res: o.res ?? 1.4, opaque: true });
  g.add(order(card, 10)); g.userData.card = card; return g;
}
const rules = (x, w, h, top, pitch, o = {}) => { x.strokeStyle = o.color ?? RULE; x.lineWidth = 1.6; for (let y = top; y < h - 10; y += pitch) { x.beginPath(); x.moveTo(o.x0 ?? 24, y); x.lineTo(w - (o.x1 ?? 24), y); x.stroke(); } };
const bars = (x, X, Y, w, n, pitch = 26, color = 'rgba(80,80,90,.35)') => { const R = rnd(Math.round(X + Y)); for (let i = 0; i < n; i++) { x.fillStyle = color; x.beginPath(); x.roundRect(X, Y + i * pitch, w * (i === n - 1 ? .55 : .8 + .2 * R()), 9, 4.5); x.fill(); } };
/** a heart (red) centred at cx, cy */
function heart(x, cx, cy, r, color = '#d23a3a') { x.fillStyle = color; x.beginPath(); x.moveTo(cx, cy + r * .9); x.bezierCurveTo(cx - r * 1.6, cy - r * .1, cx - r * .7, cy - r * 1.3, cx, cy - r * .45); x.bezierCurveTo(cx + r * .7, cy - r * 1.3, cx + r * 1.6, cy - r * .1, cx, cy + r * .9); x.fill(); }

// =====================================================================================================================
// DOCUMENT / NOTE: paper #f7f2e7 with faint blue rules, a printed title, handwritten lines (Kalam, ink #2f366b) that fade
// in one by one over 6 frames each, 6 frames apart, AHEAD of the narration (a line with a word appears 10 frames before
// it), grey text bars, a photo slot, a stamp slamming on its word, a red marker ring drawing round a line on its word.
// =====================================================================================================================
function paperDoc(S, o = {}) {
  const style = o.style ?? (o.title || o.bars ? 'page' : 'note');
  if (style === 'whiteboard') return paperDoc(S, { w: 1560, h: 840, paper: '#f3f4f1', backdrop: 'wall', rot: 0, ink: '#1f2a66', cap: 56, pitch: 120, ...o, style: 'board', frame: true });
  const W = o.w ?? (style === 'page' ? 760 : 1180), H = o.h ?? (style === 'page' ? 980 : 640);
  const { root, px, B } = host(S, { ...o, kind: 'document', rot: o.rot ?? (style === 'note' ? -2.5 : 2) }, W, H, o.backdrop ?? (style === 'note' ? 'desk' : 'dark'));
  const lines = (o.lines ?? (o.text ? String(o.text).split('\n') : [])).map(l => typeof l === 'string' ? { text: l } : l);
  const top = style === 'note' ? 150 : (o.title ? 210 : 120), pitch = o.pitch ?? (style === 'note' ? 136 : 92);
  const paper = sheet(W, H, (x, w, h) => {
    if (style === 'note' || o.ruled) rules(x, w, h, top + 18, pitch / 2 > 50 ? pitch / 2 : pitch);
    if (o.title) P.drawText(x, o.title, 70, 120, { cap: o.titleCap ?? 42, w: 800, track: .02, color: '#2a2a30' });
    if (o.bars) bars(x, 70, o.title ? 170 : 80, w - 140, o.bars, 34);
    if (o.photo) { const pw = 220, ph = 270, X = w - pw - 60, Y = o.title ? 170 : 60; x.fillStyle = '#d9d6cf'; x.fillRect(X, Y, pw, ph); x.fillStyle = '#9d9a94'; x.beginPath(); x.arc(X + pw / 2, Y + ph * .4, 48, 0, 7); x.fill(); x.beginPath(); x.ellipse(X + pw / 2, Y + ph * .95, 90, 75, 0, Math.PI, 0); x.fill(); x.strokeStyle = '#b8b4ac'; x.lineWidth = 4; x.strokeRect(X, Y, pw, ph); }
    if (o.footer) { x.fillStyle = o.footerColor ?? '#253d75'; x.fillRect(0, h - 64, w, 64); P.drawText(x, o.footer, w / 2, h - 22, { cap: 26, w: 800, track: .14, color: '#f2efe8', align: 'center' }); }
    if (o.frame) { x.strokeStyle = '#9aa0a8'; x.lineWidth = 22; x.strokeRect(0, 0, w, h); x.strokeStyle = '#c9ced4'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16); x.fillStyle = '#8d939b'; x.fillRect(w * .3, h - 30, w * .4, 18); }
  }, o);
  px(paper);
  // handwriting lines
  const hand = o.hand !== false, cap0 = o.cap ?? (style === 'note' ? 48 : 34), mc = document.createElement('canvas').getContext('2d');
  const ts = []; let prev = startAt(S, o, 0, S.t0 + 4 * F);
  lines.forEach((l, i) => {
    const own = l.word != null || l.at != null ? T(S, l.word ?? l.at, l.word != null || typeof l.at === 'string' ? 10 * F : 0) : null;
    const t = own != null ? own : (i ? prev + 6 * F : prev); ts.push(t); prev = t;
    const st0 = hand ? { cap: cap0, w: o.weight ?? 400, fam: 'hand', track: .01, color: l.color ?? o.ink ?? INK } : { cap: cap0 * .8, w: 800, track: .02, color: l.color ?? '#2a2a30' };
    const fit = Math.min(1, (W - 140 - (l.heart || (o.heart && i === 0) ? 70 : 0)) / Math.max(1, P.measure(mc, l.text, st0))), st = { ...st0, cap: st0.cap * fit }, cap = st.cap;
    const tc = textCard(l.text, { ...st, align: l.align ?? 'left' }, { res: 1.6 });
    const y = top + i * pitch + (l.dy ?? 0), X = l.align === 'right' ? W / 2 - 70 : -W / 2 + 70 + (l.dx ?? 0);
    px(order(tc, 11), X, y - H / 2, .002); tc.rotation.z = (l.tilt ?? (hash(i, 3) - .5) * 1.4) * Math.PI / 180;
    fadeIn(tc, P.landed(S, t), 6);
    if (l.heart || (o.heart && i === 0)) { const wpx = P.measure(document.createElement('canvas').getContext('2d'), l.text, st);
      const hc = paintCard(90, 90, x => heart(x, 45, 48, 30), { res: 1.5 }); px(order(hc, 11), X + wpx + 56, y - H / 2 - cap * .45, .002); fadeIn(hc, P.landed(S, t + 4 * F), 6); }
  });
  root.userData.lineTimes = ts;
  // marker ring round a line
  if (o.mark) { const mk = o.mark, i = mk.line ?? 0, l = lines[i]; if (l) { const st = { cap: cap0, w: 700, fam: 'hand' }, wpx = Math.min(W - 140, P.measure(document.createElement('canvas').getContext('2d'), l.text, st)) + 40;
    const ring = gline(markerPts(-W / 2 + 70 + wpx / 2 - 20, top + i * pitch - H / 2 - cap0 / 2, wpx / 2 + 20, cap0 * 1.05), 5, { color: mk.color ?? '#c02a2a', unit: U }); ring.position.z = .003; ring.renderOrder = 12; root.add(ring);
    drawOn(ring, P.landed(S, startAt(S, mk, 0, ts[i] + 12 * F)), 11, 'inOutSine'); } }
  if (o.stamp) addStamp(S, root, px, o.stamp, 0, H * .18 - H / 2 + H * .5);
  return B ? B.g : root;
}
/** a hand-drawn ring: starts at the right end, runs under right -> left, closes over the top and overshoots */
function markerPts(cx, cy, rx, ry) { const out = []; const n = 70, span = Math.PI * 2 + .55; for (let i = 0; i <= n; i++) { const a = .1 + span * i / n, wob = 1 + .05 * Math.sin(a * 2.6 + .7) + .035 * (a / span); out.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob]); } return out; }
function addStamp(S, root, px, st, x, y) {
  const s = typeof st === 'string' ? { text: st } : st, cap = s.cap ?? 52, theme = s.theme ?? 'red';
  const col = theme === 'green' ? '#3a6e52' : theme === 'amber' ? '#f2a640' : '#c14139';
  const sc = document.createElement('canvas').getContext('2d'), tw = P.measure(sc, s.text, { cap, w: 800, track: .08 }), w = tw + cap * 1.6, h = cap * 2.4;
  const card = paintCard(w + 20, h + 20, (x) => P.paintStamp(x, (w + 20) / 2, (h + 20) / 2, s.text, { cap, color: col, rot: 0 }), { res: 1.5 });
  card.rotation.z = (s.rot ?? -4) * Math.PI / 180; px(order(card, 13), s.x ?? x, s.y ?? y, .004);
  popIn(card, P.landed(S, startAt(S, s, 0, S.t0 + 12 * F)), P.STAMP);
  return card;
}
function note(S, o = {}) {
  const col = { yellow: '#f6e27a', pink: '#f4b8c8', blue: '#bfe0f2', green: '#c8ebb0', paper: PAPER }[o.color ?? 'yellow'] ?? o.color;
  if (o.color === 'paper' || o.lined) return paperDoc(S, { ...o, style: 'note' });
  const W = o.w ?? 520, H = o.h ?? 500;
  const { root, px, B } = host(S, { ...o, kind: 'note', rot: o.rot ?? 3, width: o.width ?? .12 }, W, H, o.backdrop ?? 'cork');
  px(sheet(W, H, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,0,0,.08)'); g.addColorStop(.15, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }, { paper: col }));
  const lines = (o.lines ?? String(o.text ?? '').split('\n')).map(l => typeof l === 'string' ? { text: l } : l), cap = o.cap ?? 52;
  let t = startAt(S, o, 0, S.t0 + 4 * F);
  lines.forEach((l, i) => { const tc = textCard(l.text, { cap, w: 700, fam: 'hand', color: o.ink ?? INK, align: 'center' }, { res: 1.6 });
    px(order(tc, 11), 0, -H / 2 + 140 + i * cap * 2.1, .002); const own = l.word != null || l.at != null ? T(S, l.word ?? l.at, 10 * F) : null; if (own != null) t = own; fadeIn(tc, P.landed(S, t), 6); t += 12 * F; });
  if (o.heart) { const hc = paintCard(90, 90, x => heart(x, 45, 48, 30), { res: 1.5 }); px(order(hc, 11), 0, H / 2 - 90, .002); }
  return B ? B.g : root;
}

// =====================================================================================================================
// CALENDAR: a month page with spiral rings, red header (month), weekday letters, a grid of days (weekends red), marked days:
// ring (the red marker ring drawing on in 11 frames on its word), cross (X marks), dot; an optional handwritten note.
// =====================================================================================================================
function calendar(S, o = {}) {
  const W = o.w ?? 620, H = o.h ?? 880;
  const { root, px, B } = host(S, { ...o, kind: 'calendar', rot: o.rot ?? 0, width: o.width ?? .45 }, W, H, o.backdrop ?? 'wall');
  const first = o.start ?? 3, days = o.days ?? 31, cols = 7, cw = (W - 50) / cols, top = 230, rh = (H - top - 40) / 6;
  const cell = d => { const i = d - 1 + first; return [25 + (i % cols) * cw + cw / 2, top + Math.floor(i / cols) * rh + rh * .45]; };
  px(sheet(W, H, (x, w) => {
    x.fillStyle = o.color ?? '#d24a3c'; x.fillRect(0, 26, w, 110);
    P.drawText(x, o.month ?? 'MARCH', w / 2, 26 + 55 + 22, { cap: 46, w: 800, track: .08, color: '#fff6ee', align: 'center' });
    for (let i = 0; i < 16; i++) { const X = 30 + i * (w - 60) / 15; x.fillStyle = '#5a5a60'; x.fillRect(X - 3, 0, 6, 40); x.beginPath(); x.arc(X, 40, 5, 0, 7); x.fill(); }
    const wd = o.weekdays ?? ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    wd.forEach((d, i) => P.drawText(x, d, 25 + i * cw + cw / 2, 190, { cap: 16, w: 800, track: .05, color: '#6a6a70', align: 'center' }));
    x.strokeStyle = 'rgba(80,80,90,.18)'; x.lineWidth = 1.5; for (let r = 0; r <= 6; r++) { x.beginPath(); x.moveTo(25, top - 10 + r * rh); x.lineTo(w - 25, top - 10 + r * rh); x.stroke(); }
    for (let d = 1; d <= days; d++) { const [cx, cy] = cell(d), wk = (d - 1 + first) % 7 >= 5; P.drawText(x, String(d), cx, cy + 9, { cap: 20, w: 700, track: 0, color: wk ? '#c0453a' : '#3a3a42', align: 'center' }); }
    for (const d of [].concat(o.cross ?? [])) { const [cx, cy] = cell(d); x.strokeStyle = 'rgba(190,40,40,.85)'; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx - 22, cy - 22); x.lineTo(cx + 22, cy + 18); x.moveTo(cx + 22, cy - 22); x.lineTo(cx - 22, cy + 18); x.stroke(); }
  }, o));
  for (const r of [].concat(o.ring ?? [])) { const rr = typeof r === 'number' ? { day: r } : r, [cx, cy] = cell(rr.day);
    const ring = gline(markerPts(cx - W / 2, cy - H / 2, 30, 26), 4.5, { color: '#c02a2a' }); ring.position.z = .003; ring.renderOrder = 12; root.add(ring);
    drawOn(ring, P.landed(S, startAt(S, rr, 0, S.t0 + 8 * F)), 11, 'inOutSine'); }
  if (o.note) { const tc = textCard(o.note.text ?? o.note, { cap: 26, w: 700, fam: 'hand', color: '#c02a2a', align: 'left' }, { res: 1.6 }); const nd = cell(o.note.day ?? 1); px(order(tc, 12), nd[0] - W / 2 - 20, nd[1] - H / 2 + 46, .003); fadeIn(tc, P.landed(S, startAt(S, o.note, 10 * F, S.t0 + 20 * F)), 6); }
  return B ? B.g : root;
}

// =====================================================================================================================
// SCORE CARD (aptitude test): white card, navy header bar with small white caps, a grey label, a big number (may count),
// a mini bell curve (blue) with a red marker; a stamp on its word.
// =====================================================================================================================
function card(S, o = {}) {
  const W = o.w ?? 1640, H = o.h ?? 800;
  const { root, px, B } = host(S, { ...o, kind: 'card', width: o.width ?? .5 }, W, H, o.backdrop ?? 'dark');
  px(sheet(W, H, (x, w, h) => {
    const g = x.createRadialGradient(w * .5, h * .55, 0, w * .5, h * .55, w * .7); g.addColorStop(0, '#f6f6f4'); g.addColorStop(1, '#d4d6d8'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = o.color ?? '#253d75'; x.fillRect(0, 0, w, 96); P.drawText(x, o.title ?? 'APTITUDE TEST', 76, 62, { cap: 28, w: 800, track: .14, color: '#e8ecf6' });
    if (o.label !== false) P.drawText(x, o.label ?? 'SCORE', 90, 250, { cap: 26, w: 800, track: .06, color: '#6c6c72' });
    if (o.curve !== false) { const cx0 = w - 610, cw = 520, by = 560, ch = 240; x.strokeStyle = '#2c4a9a'; x.lineWidth = 5; x.beginPath();
      for (let i = 0; i <= 80; i++) { const u = i / 80, X = cx0 + u * cw, Y = by - ch * Math.exp(-((u - .5) ** 2) / .012); i ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke();
      x.strokeStyle = 'rgba(60,60,70,.3)'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx0, by + 2); x.lineTo(cx0 + cw, by + 2); x.stroke();
      const mk = o.marker ?? .5, mx = cx0 + mk * cw; x.strokeStyle = '#d0302a'; x.lineWidth = 3; x.beginPath(); x.moveTo(mx, by); x.lineTo(mx, by - ch - 18); x.stroke();
      x.fillStyle = '#d0302a'; x.beginPath(); x.moveTo(mx - 15, by - ch - 44); x.lineTo(mx + 15, by - ch - 44); x.lineTo(mx, by - ch - 20); x.fill();
      P.drawText(x, o.markerLabel ?? String(typeof o.value === 'object' ? o.value.to : o.value ?? 100), mx, by + 44, { cap: 22, w: 800, track: 0, color: '#2a2a33', align: 'center' }); }
  }, o));
  const spec = o.value ?? 100, isSpec = spec && typeof spec === 'object';
  const tx = textCard(P.format(isSpec ? spec.from ?? 0 : spec), { cap: o.cap ?? 96, w: 800, track: -.01, color: '#1d1f2a', align: 'left' }, { maxText: '88888', res: 1.4 });
  px(order(tx, 11), -W / 2 + 86, -H / 2 + 340, .002);
  if (isSpec) anim(tx, t => tx.userData.setText(P.format(P.valueAt(S, { at: S.t0, preset: 'counter', ...spec }, t), o)));
  if (o.stamp) addStamp(S, root, px, { theme: 'green', rot: -3, ...(typeof o.stamp === 'string' ? { text: o.stamp } : o.stamp) }, -W / 2 + 470, 200);
  return B ? B.g : root;
}

/** SIGN: a white card with big words in colours (NOVA / WINS.), faint rules, slight tilt */
function sign(S, o = {}) {
  const L = o.lines ?? String(o.text ?? '').split('\n'), cols = o.colors ?? ['#2a3f9a', '#b8333a', '#2a2a30'], cap = o.cap ?? 120;
  const sc = document.createElement('canvas').getContext('2d'), W = o.w ?? Math.max(...L.map(l => P.measure(sc, l, { cap, w: 800, track: .01 }))) + cap * 1.6, H = o.h ?? L.length * cap * 1.55 + cap * .9;
  const { root, px, B } = host(S, { ...o, kind: 'sign', rot: o.rot ?? 2, width: o.width ?? .6 }, W, H, o.backdrop ?? 'dark');
  px(sheet(W, H, (x, w, h) => { rules(x, w, h, 40, 34, { color: 'rgba(120,145,200,.18)', x0: 0, x1: 0 }); L.forEach((l, i) => P.drawText(x, l, w / 2, cap * .75 + (i + 1) * cap * 1.5 - cap * .45, { cap, w: 800, track: .01, color: cols[i % cols.length], align: 'center' })); }, o));
  const t0 = startAt(S, o, 2 * F); if (t0 > -1e8) popIn(root, t0, P.POP);
  return B ? B.g : root;
}

// =====================================================================================================================
// STAT BOX in the world (scales with the camera): "7 DAYS / $1,000,000" counting up ease-out over 20 frames from its
// word; theme / value swaps with states [[time | word, { theme, value, label }]]. pos [x, y, z], height (metres).
// =====================================================================================================================
function statbox(S, o = {}) {
  const sc = document.createElement('canvas').getContext('2d'), fmtO = { prefix: o.prefix, suffix: o.suffix, decimals: o.decimals };
  const spec = o.value ?? 0, isSpec = spec && typeof spec === 'object' && !Array.isArray(spec);
  const maxV = isSpec ? P.format(Math.max(Math.abs(spec.from ?? 0), Math.abs(spec.to ?? 0)), fmtO) : P.format(spec, fmtO);
  const states = (o.states || []).map(([tt, st]) => [typeof tt === 'number' ? tt : T(S, tt), st]);
  const sz = P.statSize(sc, { label: o.label, value: maxV + '8', cap: o.cap ?? 78 }), W = sz.w + 12, H = sz.h + 12;
  let cur = null;
  const draw = (x, s) => P.paintStat(x, W / 2, H / 2, { label: s.label, value: s.value, cap: o.cap ?? 78, theme: s.theme, align: 'center', minW: sz.w, center: true }, 1.5);
  const state = t => { let s = { theme: o.theme ?? 'money', label: o.label, value: isSpec ? { at: S.t0, preset: 'money', ...spec } : spec }; for (const [tt, st] of states) if (t >= tt) s = { ...s, ...st }; return { ...s, value: P.format(P.valueAt(S, s.value, t, o), fmtO) }; };
  let curS = state(S.t0);
  const c = paintCard(W, H, x => draw(x, curS), { res: 1.5 });
  const root = new THREE.Group(); root.add(c); root.userData.kind = 'stat'; root.userData.pickRoot = true; c.renderOrder = 30;
  const k = (o.height ?? .6) / (H * U); root.scale.setScalar(k); const pos = o.pos ?? [0, 2, 0]; root.position.set(pos[0], pos[1], pos[2] ?? 0);
  anim(c, t => { const s = state(t), key = JSON.stringify(s); if (key !== cur) { cur = key; curS = s; c.userData.repaint(); } });
  const t0 = startAt(S, o, F); if (t0 > -1e8) fadeIn(c, t0, 4);
  return root;
}

// =====================================================================================================================
// CHARTS on a dark board. type 'bell': a bell curve filled with tiny grey stick figures that assemble in columns (36 frames
// from `at`), a cream curve with a glow, a gold axis bar with ticks and small numbers, labels popping on their words
// ({ value, text, word, marker }), an optional lit figure far right (highlight: { value: 500, word }); tour along it with
// S.tour. 'line': a gold line drawing on (gold-on-black), ring marker on a word. 'bars': bars growing. 'vote': the
// parliament vote panel (header, question, old -> new value, green / red split bar, YES / NO percentages counting).
// 'gauge': a half-dial needle swinging to a value.
// =====================================================================================================================
function chart(S, o = {}) {
  const type = o.type ?? 'bell';
  if (type === 'vote') return vote(S, o);
  const B = makeBoard(S, { bg: o.bg ?? (type === 'line' ? ['#1a140e', '#0b0806'] : ['#1a2134', '#0b0f1a']), kind: 'chart', bgW: o.bgW ?? (type === 'bell' ? 1920 * 3.4 : undefined), bgR: .5 });
  const t0 = startAt(S, o, 0, S.t0 + 2 * F);
  if (type === 'bell') {
    const v0 = o.min ?? 40, v1 = o.max ?? 160, x0 = o.x0 ?? 30, x1 = o.x1 ?? 1890, ay = o.axisY ?? 872, peak = o.peakY ?? 230, mean = o.mean ?? 100, sd = o.sd ?? 15;
    const X = v => x0 + (v - v0) / (v1 - v0) * (x1 - x0), Yc = v => ay - 8 - (ay - 8 - peak) * Math.exp(-((v - mean) ** 2) / (2 * sd * sd));
    const ext = o.extend ?? 0;     // extra axis to the right (for a pan into the dark: highlight 500)
    const vx1 = v1 + ext * (v1 - v0) / (x1 - x0);
    // figures (one texture), revealed upward over 36 frames
    const figW = 1920 + ext, figs = paintCard(figW, ay, (x) => {
      const R = rnd(5), col = o.figureColor ?? 'rgba(150,158,180,.55)';
      for (let cx = x0 + 6; cx < x1; cx += 11) { const v = v0 + (cx - x0) / (x1 - x0) * (v1 - v0), top = Yc(v) + 10; for (let y = ay - 12; y > top; y -= 23) { const s = .9 + .2 * R(); x.fillStyle = col;
        x.beginPath(); x.arc(cx, y - 17 * s, 3.2 * s, 0, 7); x.fill(); x.fillRect(cx - 2.2 * s, y - 13 * s, 4.4 * s, 9 * s); x.fillRect(cx - 2.4 * s, y - 5 * s, 2 * s, 7 * s); x.fillRect(cx + .4 * s, y - 5 * s, 2 * s, 7 * s); } } }, { res: 1, anchor: 'top-left', mip: true });
    B.put(figs, 0, 0, {}); figs.position.x = -960 * U; figs.position.y = 540 * U;
    const pos = figs.geometry.attributes.position, uv = figs.geometry.attributes.uv, hTot = ay;
    anim(figs, t => { const k = t0 < -1e8 ? 1 : E.outCubic(clamp((t - t0) * FPS / (o.frames ?? 36))); const top = ay - k * (ay - peak + 20); const f = top / hTot;
      for (const i of [0, 1]) { pos.setY(i, -top * U); uv.setY(i, 1 - f); } pos.needsUpdate = true; uv.needsUpdate = true; figs.visible = k > 0; });
    // curve + axis
    const pts = []; for (let v = v0; v <= vx1; v += (v1 - v0) / 240) pts.push([X(v), Yc(v)]);
    const curve = gline(pts, 3.2, { color: '#eef0f4', glowColor: '#c8d4ff', halo: 10, glow: .35 }); B.line(curve); drawOn(curve, t0, o.curveFrames ?? 20, 'inOutQuad');
    const axis = paintCard(1920 + ext + 40, 60, (x, w) => { x.fillStyle = '#e2d09a'; x.fillRect(0, 22, w, 16); x.fillStyle = 'rgba(60,45,20,.7)';
      for (let v = Math.ceil(v0 / 2) * 2; v <= vx1; v += 2) { const X0 = X(v) + 20; x.fillRect(X0 - .8, 22, 1.6, v % 10 === 0 ? 10 : 5); if (v % 10 === 0) P.drawText(x, String(v), X0, 36, { cap: 7, w: 700, track: 0, color: '#4a3a1a', align: 'center' }); } }, { res: 1.5, anchor: 'top-left' });
    B.put(axis, 0, 0); axis.position.x = (-960 - 20) * U; axis.position.y = (540 - (ay - 22)) * U;
    for (const L of [].concat(o.labels ?? [{ value: mean, text: String(mean) }])) { const v = L.value ?? mean, tx = textCard(L.text ?? String(v), { cap: L.cap ?? 30, w: 800, track: .02, color: '#f4f1ea', glow: [10, 'rgba(0,0,0,.6)', 1] });
      B.put(tx, X(v), Yc(Math.min(v, vx1)) - (L.dy ?? 40)); popIn(tx, P.landed(S, startAt(S, L, 2 * F, t0 + 30 * F)), P.POP);
      if (L.marker) { const m = paintCard(30, 30, x => { x.fillStyle = '#e04a3a'; x.beginPath(); x.arc(15, 15, 9, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 3; x.stroke(); }); B.put(m, X(v), Yc(v)); popIn(m, P.landed(S, startAt(S, L, 2 * F, t0 + 30 * F)), P.POPBIG); } }
    if (o.highlight) { const h = o.highlight, hx = X(h.value), fig = paintCard(40, 70, x => { x.fillStyle = '#ffe2a0'; x.shadowColor = 'rgba(255,200,90,.9)'; x.shadowBlur = 16; x.beginPath(); x.arc(20, 14, 8, 0, 7); x.fill(); x.fillRect(14, 22, 12, 26); x.fillRect(13, 46, 5, 20); x.fillRect(22, 46, 5, 20); }, { res: 1.5 });
      B.put(fig, hx, ay - 40); const th = P.landed(S, startAt(S, h, 2 * F, t0 + 60 * F)); popIn(fig, th, P.POPBIG);
      const tx = textCard(h.text ?? String(h.value), { cap: 34, w: 800, track: .02, color: '#fad586', glow: [16, 'rgba(250,190,90,.6)', 2] }); B.put(tx, hx, ay - 120); popIn(tx, th, P.POP); B.highlightX = hx; }
    B.X = X; B.Y = Yc;
  } else if (type === 'line') {
    const vals = o.values ?? [3, 5, 4, 8, 6, 9, 7, 12], x0 = 220, x1 = 1700, y0 = 820, y1 = 300, mx = Math.max(...vals), mn = Math.min(0, ...vals);
    const pts = vals.map((v, i) => [x0 + (x1 - x0) * i / (vals.length - 1), y0 - (y0 - y1) * (v - mn) / ((mx - mn) || 1)]);
    const grid = paintCard(1600, 620, (x, w, h) => { x.strokeStyle = 'rgba(210,160,90,.14)'; x.lineWidth = 1.5; for (let i = 0; i <= 6; i++) { x.beginPath(); x.moveTo(0, i * h / 6); x.lineTo(w, i * h / 6); x.stroke(); } }, { res: 1 });
    B.put(grid, 960, 560);
    const line = gline(pts, 4, { color: o.color ?? '#e8b465', glowColor: '#d99a45', halo: 14, glow: .5 }); B.line(line); drawOn(line, t0, o.frames ?? 24, 'inOutQuad');
    if (o.marker) { const i = o.marker.index ?? vals.length - 1, r = gline(circlePts(pts[i][0], pts[i][1], 34, 34, 48), 3, { color: '#f0d6a0', halo: 10, glow: .5 }); B.line(r); drawOn(r, P.landed(S, startAt(S, o.marker, 0, t0 + 30 * F)), 10); }
    if (o.label) { const tx = textCard(o.label, { cap: 26, w: 800, track: .15, color: '#e6c27a' }, {}); B.put(tx, 300, 220); fadeIn(tx, t0, 4); }
  } else if (type === 'bars') {
    const vals = o.values ?? [40, 70, 100], labels = o.labels ?? [], cols = o.colors ?? ['#3ec46a'], n = vals.length, bw = Math.min(220, 1200 / n * .6), gapW = 1300 / n, mx = Math.max(...vals);
    vals.forEach((v, i) => { const h = 520 * v / mx, X = 960 - 650 + gapW * (i + .5), col = cols[i % cols.length];
      const bar = paintCard(bw, h, (x, w, hh) => { x.fillStyle = col; x.beginPath(); x.roundRect(0, 0, w, hh, [8, 8, 0, 0]); x.fill(); }, { res: 1, anchor: 'top-left' });
      B.put(bar, 0, 0); bar.position.x = (X - bw / 2 - 960) * U; bar.position.y = (540 - 820) * U; bar.geometry.translate(0, h * U, 0);
      const tb = P.landed(S, startAt(S, typeof o.words?.[i] === 'string' ? { word: o.words[i] } : null, 2 * F, t0 + i * 6 * F));
      anim(bar, t => { const k = tb < -1e8 ? 1 : E.outCubic(clamp((t - tb) * FPS / 14)); bar.scale.y = Math.max(.001, k); bar.visible = k > 0; });
      if (labels[i]) { const tx = textCard(labels[i], { cap: 24, w: 800, track: .1, color: '#e8e0d0' }); B.put(tx, X, 870); fadeIn(tx, tb, 4); }
      const vt = textCard(P.format(v, o), { cap: 34, w: 800, track: .02, color: '#f4f1ea' }); B.put(vt, X, 820 - h - 40); fadeIn(vt, tb + 10 * F, 4); });
  } else if (type === 'gauge') {
    const v = o.value ?? .8, cx = 960, cy = 700, r = 360;
    B.line(gline(circlePts(cx, cy, r, r, 64, Math.PI, Math.PI), 26, { color: '#2a3248' }));
    const segs = [['#3ec46a', 0, .5], ['#e8b84a', .5, .8], ['#e04a3a', .8, 1]]; for (const [c, a, b] of segs) B.line(gline(circlePts(cx, cy, r, r, 32, Math.PI + a * Math.PI, (b - a) * Math.PI), 18, { color: c }));
    const needle = paintCard(r * 2, 30, (x, w) => { x.fillStyle = '#f4f1ea'; x.beginPath(); x.moveTo(w / 2, 7); x.lineTo(w / 2 + r - 30, 15); x.lineTo(w / 2, 23); x.fill(); x.beginPath(); x.arc(w / 2, 15, 14, 0, 7); x.fill(); });
    B.put(needle, cx, cy); const tg = t0; anim(needle, t => { const k = tg < -1e8 ? 1 : E.outBack(clamp((t - tg) * FPS / 24), 1.2); needle.rotation.z = -Math.PI * clamp(k * v, 0, 1.05) + Math.PI * 0; needle.rotation.z = Math.PI - Math.PI * k * v; });
    if (o.label) { const tx = textCard(o.label, { cap: 40, w: 800, track: .1, color: '#e8e0d0' }); B.put(tx, cx, cy + 110); }
  }
  B.g.userData.board = B; return B.g;
}
function vote(S, o) {
  const B = makeBoard(S, { bg: o.bg ?? BACKDROPS.wood.bg, kind: 'chart', bgR: .5 });
  const t0 = startAt(S, o, 0, S.t0 + 2 * F), W = 1420, H = 790;
  const panel = paintCard(W, H, (x, w, h) => { x.fillStyle = '#111312'; x.beginPath(); x.roundRect(0, 0, w, h, 26); x.fill();
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * .6); g.addColorStop(0, '#1d2a20'); g.addColorStop(1, '#121812'); x.fillStyle = g; x.fillRect(28, 28, w - 56, h - 56);
    x.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 30; y < h - 30; y += 5) x.fillRect(28, y, w - 56, 2);
    P.drawText(x, o.header ?? 'PARLIAMENT · FINAL VOTE', w / 2, 112, { cap: 30, w: 800, track: .04, color: '#e6b85a', align: 'center' });
    P.drawText(x, o.question ?? 'THE QUESTION:', w / 2, 222, { cap: 48, w: 800, track: .01, color: '#eeeae2', align: 'center' });
    if (o.from != null) { P.drawText(x, String(o.from), w / 2 - 180, 375, { cap: 72, w: 800, track: 0, color: '#a5503c', align: 'center' }); P.drawText(x, '→', w / 2 - 30, 360, { cap: 46, w: 800, color: '#eeeae2' });
      P.drawText(x, String(o.to), w / 2 + 180, 375, { cap: 72, w: 800, track: 0, color: '#ffffff', align: 'center', glow: [18, 'rgba(255,255,255,.4)', 1] }); } }, { res: 1.25 });
  B.put(panel, 960, 540);
  const yes = o.yes ?? 71, ySpec = typeof yes === 'object' ? { at: S.t0, frames: 30, ease: 'outCubic', ...yes } : yes;
  const bar = paintCard(1250, 70, () => {}, { res: 1 }); B.put(bar, 960, 540 - H / 2 + 470);
  let lastY = null;
  const yt = textCard('YES 100%', { cap: 64, w: 800, track: 0, color: '#46d374', align: 'left', glow: [22, 'rgba(70,211,116,.45)', 2] }, { maxText: 'YES 100%' });
  const nt = textCard('NO 100%', { cap: 46, w: 800, track: 0, color: '#e8503e', align: 'right' }, { maxText: 'NO 100%' });
  B.put(yt, 960 - 560, 540 - H / 2 + 640); B.put(nt, 960 + 560, 540 - H / 2 + 640);
  anim(bar, t => { const y = P.valueAt(S, ySpec, t); if (y === lastY) return; lastY = y;
    bar.userData.repaint((x, w, h) => { const sx = w * y / 100; x.fillStyle = '#3ec46a'; x.fillRect(0, 0, sx, h); x.fillStyle = '#e04a3a'; x.fillRect(sx, 0, w - sx, h); x.fillStyle = 'rgba(0,0,0,.15)'; x.fillRect(sx - 2, 0, 4, h); });
    yt.userData.setText(`YES ${y}%`); nt.userData.setText(`NO ${100 - y}%`); });
  for (const m of [panel, bar, yt, nt]) fadeIn(m, t0, 4);
  B.g.userData.board = B; return B.g;
}

// =====================================================================================================================
// PHONE: a rounded phone (dark bezel) with a flat UI painted on its screen. screen: 'call' (caller + red / green buttons,
// sub line, a call timer when `timer` is set), 'chat' (bubbles popping on their words), 'notify' (lock screen + banners),
// 'bank' (navy header, balance, SEND pill), 'alert' (red EMERGENCY ALERT strip + bold message), 'map' (streets, route,
// pin), 'lock' (time + date). In a set: pos, width (metres, default .075), rot; or a whole insert shot (no pos) on a
// backdrop. userData.grips: { hand } (where the palm holds it).
// =====================================================================================================================
const SW = 380, SH = 800;
function phoneUI(x, o, st) {
  const scr = o.screen ?? 'call', time = o.time ?? '9:41', dark = !['bank', 'alert', 'notify-light'].includes(scr);
  const g = x.createLinearGradient(0, 0, 0, SH); g.addColorStop(0, dark ? '#2a2e38' : '#f1f2f5'); g.addColorStop(1, dark ? '#16181e' : '#e2e4ea'); x.fillStyle = scr === 'alert' ? '#1b2340' : g; x.fillRect(0, 0, SW, SH);
  const ink = dark || scr === 'alert' ? '#f4f4f6' : '#20232b';
  P.drawText(x, time, 40, 40, { cap: 14, w: 700, track: 0, color: ink }); x.fillStyle = ink; x.fillRect(SW - 70, 28, 34, 13); x.fillRect(SW - 104, 32, 4, 9); x.fillRect(SW - 97, 30, 4, 11); x.fillRect(SW - 90, 28, 4, 13);
  if (scr === 'call') {
    x.fillStyle = '#4a5162'; x.beginPath(); x.arc(SW / 2, 230, 62, 0, 7); x.fill();
    const icon = o.icon ?? '?'; if (icon === 'bank') { x.fillStyle = '#f4f4f6'; x.fillRect(SW / 2 - 34, 245, 68, 9); x.beginPath(); x.moveTo(SW / 2 - 38, 208); x.lineTo(SW / 2, 186); x.lineTo(SW / 2 + 38, 208); x.fill(); for (let i = -2; i <= 2; i++) x.fillRect(SW / 2 + i * 14 - 3, 212, 6, 30); }
    else P.drawText(x, icon, SW / 2, 230 + 24, { cap: 50, w: 800, color: '#f4f4f6', align: 'center' });
    P.drawText(x, o.name ?? 'UNKNOWN', SW / 2, 360, { cap: 30, w: 800, track: .02, color: '#f4f4f6', align: 'center' });
    const sub = st.timer ?? o.sub ?? 'incoming call...'; x.fillStyle = 'rgba(255,255,255,.1)'; const sw = P.measure(x, sub, { cap: 14, w: 700 }) + 30; x.beginPath(); x.roundRect(SW / 2 - sw / 2, 382, sw, 30, 15); x.fill();
    P.drawText(x, sub, SW / 2, 403, { cap: 14, w: 700, track: .02, color: '#aeb6d4', align: 'center' });
    const btn = (cx, col, down) => { x.fillStyle = col; x.beginPath(); x.arc(cx, 650, 40, 0, 7); x.fill(); x.save(); x.translate(cx, 650); x.rotate(down ? 2.25 : -.35);
      x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineCap = 'round'; x.lineWidth = 7; x.beginPath(); x.arc(0, 10, 16, Math.PI * 1.15, Math.PI * 1.85); x.stroke();
      for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 14, 4, 5.5, 8.5, s * .55, 0, 7); x.fill(); } x.restore(); };
    if (o.decline !== false) btn(o.accept === false ? SW / 2 : 100, '#e0413a', true); if (o.accept !== false && !st.timer) btn(SW - 100, '#2fc464', false);
  } else if (scr === 'chat') {
    x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(0, 60, SW, 80); P.drawText(x, o.name ?? 'MOM', SW / 2, 112, { cap: 22, w: 800, track: .04, color: '#f4f4f6', align: 'center' });
    let y = 170; for (const m of st.messages) { const cap = o.cap ?? 22, lh = cap * 1.75, lines = wrapPx(x, m.text, SW - 120, { cap, w: 700 }), bw = Math.max(...lines.map(l => P.measure(x, l, { cap, w: 700 }))) + 40, bh = lines.length * lh + 26;
      const X = m.me ? SW - 20 - bw : 20; x.fillStyle = m.me ? '#2f6fe0' : '#3a3f4c'; x.beginPath(); x.roundRect(X, y, bw, bh, 22); x.fill();
      lines.forEach((l, i) => P.drawText(x, l, X + 20, y + 13 + lh * .5 + cap * .5 + i * lh, { cap, w: 700, color: '#f4f6fa' })); y += bh + 16; }
  } else if (scr === 'notify' || scr === 'lock') {
    P.drawText(x, o.clock ?? time, SW / 2, 230, { cap: 70, w: 600, track: -.02, color: '#f4f4f6', align: 'center' }); P.drawText(x, o.date ?? 'FRIDAY, MARCH 14', SW / 2, 280, { cap: 13, w: 700, track: .1, color: '#c9cdd8', align: 'center' });
    let y = 330; for (const m of st.messages) { x.fillStyle = 'rgba(245,246,250,.92)'; x.beginPath(); x.roundRect(18, y, SW - 36, 96, 20); x.fill(); P.drawText(x, m.app ?? 'MESSAGES', 40, y + 30, { cap: 11, w: 800, track: .08, color: '#6a6f7c' });
      P.drawText(x, m.title ?? m.text, 40, y + 60, { cap: 15, w: 800, color: '#1d2028' }); if (m.title && m.text) P.drawText(x, m.text, 40, y + 84, { cap: 13, w: 600, color: '#3b3f4a' }); y += 110; }
  } else if (scr === 'bank') {
    x.fillStyle = '#1e3a7a'; x.fillRect(0, 0, SW, 150); P.drawText(x, o.name ?? 'MY BANK', SW / 2, 110, { cap: 20, w: 800, track: .06, color: '#ffffff', align: 'center' });
    P.drawText(x, (o.account ?? 'CHECKING').toUpperCase(), 34, 210, { cap: 11, w: 800, track: .1, color: '#6a6f7c' }); P.drawText(x, 'BALANCE', 34, 240, { cap: 10, w: 800, track: .1, color: '#9a9fac' });
    P.drawText(x, st.balance ?? o.balance ?? '$31,240.00', 34, 300, { cap: 36, w: 800, track: 0, color: '#1d2028' });
    x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(24, 340, SW - 48, 2); P.drawText(x, 'TRANSFER TO', 34, 380, { cap: 10, w: 800, track: .1, color: '#9a9fac' });
    x.strokeStyle = 'rgba(0,0,0,.15)'; x.lineWidth = 2; x.strokeRect(24, 396, SW - 48, 56); P.drawText(x, o.to ?? 'SAFE ACCOUNT', 40, 432, { cap: 13, w: 800, color: '#2a2e38' });
    x.fillStyle = '#2fb35d'; x.beginPath(); x.roundRect(60, 620, SW - 120, 70, 35); x.fill(); P.drawText(x, o.button ?? 'SEND', SW / 2, 666, { cap: 22, w: 800, track: .06, color: '#ffffff', align: 'center' });
  } else if (scr === 'alert') {
    P.drawText(x, o.clock ?? time, SW / 2, 150, { cap: 26, w: 800, color: '#f4f4f6', align: 'center' });
    x.fillStyle = '#f5f2ee'; x.beginPath(); x.roundRect(20, 210, SW - 40, 360, 22); x.fill(); x.fillStyle = '#d0302a'; x.beginPath(); x.roundRect(20, 210, SW - 40, 70, [22, 22, 0, 0]); x.fill();
    P.drawText(x, '⚠ ' + (o.name ?? 'EMERGENCY ALERT'), SW / 2, 255, { cap: 15, w: 800, track: .04, color: '#ffffff', align: 'center' });
    const L = wrapPx(x, o.text ?? 'STORM FORMING OFF THE COAST', SW - 90, { cap: 26, w: 800 }); L.forEach((l, i) => P.drawText(x, l, SW / 2, 345 + i * 42, { cap: 26, w: 800, color: '#15161a', align: 'center' }));
    if (o.sub) P.drawText(x, o.sub, SW / 2, 345 + L.length * 42 + 30, { cap: 14, w: 700, color: '#a3282a', align: 'center' });
  } else if (scr === 'map') {
    x.fillStyle = '#e9e6dc'; x.fillRect(0, 60, SW, SH - 60); const R = rnd(11); x.strokeStyle = '#ffffff'; x.lineWidth = 12; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(-20, 100 + i * 130 + R() * 30); x.lineTo(SW + 20, 60 + i * 140 + R() * 60); x.stroke(); x.beginPath(); x.moveTo(40 + i * 70, 60); x.lineTo(20 + i * 75 + R() * 40, SH); x.stroke(); }
    x.fillStyle = '#c7dfb3'; x.fillRect(220, 420, 120, 150); x.strokeStyle = '#2f6fe0'; x.lineWidth = 8; x.lineCap = 'round'; x.beginPath(); x.moveTo(90, 700); x.lineTo(110, 520); x.lineTo(260, 470); x.lineTo(290, 260); x.stroke();
    x.fillStyle = '#e0413a'; x.beginPath(); x.arc(290, 236, 18, Math.PI, 0); x.lineTo(290, 270); x.closePath(); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(290, 236, 7, 0, 7); x.fill();
  }
}
function wrapPx(x, text, maxW, st) { const out = []; let cur = ''; for (const w of String(text).split(' ')) { const s = cur ? cur + ' ' + w : w; if (cur && P.measure(x, s, st) > maxW) { out.push(cur); cur = w; } else cur = s; } if (cur) out.push(cur); return out; }
function phone(S, o = {}) {
  const BW = SW + 36, BH = SH + 44;
  const { root, px, B } = host(S, { ...o, kind: 'phone', width: o.width ?? .075, rot: o.rot ?? (o.pos ? 0 : -4) }, BW, BH, o.backdrop ?? 'desk');
  const body = paintCard(BW, BH, (x, w, h) => { x.fillStyle = '#121419'; x.beginPath(); x.roundRect(0, 0, w, h, 52); x.fill(); x.strokeStyle = '#3a3e48'; x.lineWidth = 3; x.stroke(); }, { res: 1.4, alphaTest: .5, depth: true });
  px(order(body, 10));
  const msgs = (o.messages ?? []).map(m => typeof m === 'string' ? { text: m } : m), mt = msgs.map((m, i) => m.word != null || m.at != null ? T(S, m.word ?? m.at, 3 * F) : -1e9);
  const timerAt = o.timer != null ? T(S, o.timer.at ?? o.timer.word ?? S.t0, 0) : null;
  const state = t => ({ messages: msgs.filter((m, i) => t >= mt[i]), timer: timerAt != null && t >= timerAt ? (() => { const s = Math.floor(t - timerAt + (o.timer.from ?? 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; })() : null,
    balance: o.balanceTo != null ? P.format(P.valueAt(S, { from: o.balanceFrom ?? 0, to: o.balanceTo, at: o.balanceAt ?? S.t0, preset: 'money' }, t), { prefix: '$', decimals: 2 }) : null });
  let cur = state(S.t0), key = null;
  const screen = paintCard(SW, SH, x => { x.save(); x.beginPath(); x.roundRect(0, 0, SW, SH, 38); x.clip(); phoneUI(x, o, cur); x.restore(); }, { res: o.res ?? 1.5, alphaTest: .5, depth: true });
  px(order(screen, 11), 0, 0, .003);
  anim(screen, t => { const s = state(t), k = JSON.stringify(s); if (k !== key) { key = k; cur = s; screen.userData.repaint(); } });
  const glowM = paintCard(BW + 120, BH + 120, x => { x.shadowColor = 'rgba(160,190,255,.35)'; x.shadowBlur = 50; x.fillStyle = 'rgba(160,190,255,.12)'; x.beginPath(); x.roundRect(60, 60, BW, BH, 52); x.fill(); }, { res: .4, mip: false, noPick: true });
  px(order(glowM, 8), 0, 0, -.003);
  if (o.ring) { const t0 = T(S, o.ring.at ?? o.ring.word ?? S.t0, 0); anim(root, t => { const k = t >= t0 && t < t0 + (o.ring.dur ?? 1.5) ? Math.sin((t - t0) * 2 * Math.PI * 9) * .035 : 0; root.rotation.z = (o.rot ?? (o.pos ? 0 : -4)) * Math.PI / 180 + k; }); }
  root.userData.grips = { ...root.userData.grips, hand: [0, -(BH / 2 - 120) * U * root.scale.x] };
  return B ? B.g : root;
}

export { paperDoc as document };
export { note, calendar, card, sign, statbox, chart, phone };
void lerp; void setAlpha; void rrect; void mat; void textCard;
