// Stick stories graphics: the shared 2D PAINTERS (canvas 2D, in design pixels of a 1920 x 1080 frame) used by the
// overlay (lib/ui.js: drawn straight into the overlay every frame) and by the world graphics (lib/info.js: painted once
// into a canvas texture on a card, repainted only when their text really changes). One look, two places.
//
// Measured on the three references (experiments/stickstory-style/analysis/graphics/NOTES.md): Open Sans ExtraBold caps
// with positive tracking for nearly everything, JetBrains Mono 700 for terminals / CCTV, Kalam for handwriting; cream /
// amber / gold text with a dark brown outline on busy pictures, a soft halo on the lives counter, a same-hue glow on
// titles; capsules with a semantic border colour; every animation counted in frames at 24 fps.
import { FW, FH, FPS, VERT, clamp, lerp, seg, E, hash, mixHex } from '../core.js';

export const F = 1 / FPS;
/** overlay pixels per design pixel (design = a 1920-wide frame; vertical frames get a bigger scale) */
export const PX = VERT ? FW / 1350 : FW / 1920;
export const DW = FW / PX, DH = FH / PX;            // the frame in design pixels (1920 x 1080 for 16:9)
export const SANS = '"Open Sans", "Open Sans Ext", "Segoe UI", Arial, sans-serif';
export const MONO = '"JetBrains Mono", Consolas, "Courier New", monospace';
export const HAND = 'Kalam, "Kalam Ext", "Segoe Print", cursive';
const CAPK = { sans: .714, mono: .73, hand: .56 };   // cap height / font size of each family
export const famOf = f => f === 'mono' ? MONO : f === 'hand' ? HAND : !f || f === 'sans' ? SANS : f;
export const capK = f => CAPK[f] ?? (f === MONO ? CAPK.mono : f === HAND ? CAPK.hand : CAPK.sans);

// ---------- colours (sampled from the references) ----------
export const PAL = {
  cream: '#fbefdd', cream2: '#f4e2c3', cream3: '#e8d4b4', lives: '#f9eadd', amber: '#fad586', amber2: '#f7c875', amber3: '#f6d188',
  gold: '#d7a14d', goldLine: '#d2a052', sub: '#fdd586', outline: '#4a2f2f', outline2: '#624544', red: '#d83c34', red2: '#fc4337',
  mint: '#b4e3c4', mint2: '#d0f0dc', pink: '#f0ceca', steel: '#bfc7e1', grey: '#a9a4ac', ink: '#2f366b', paper: '#f7f2e7',
  marker: '#c02a2a', stampRed: '#c14139', stampGreen: '#3a6e52', psa: '#2c2523', psaText: '#e3dcce', chosen: '#f7ac4f', chosenText: '#391707',
};
/** statement pill / tag / box themes: border colour = meaning, the text is tinted to match */
export const THEMES = {
  fact: { border: '#d2a052', text: '#f4e2c3', fill: 'rgba(28,21,21,.9)', label: '#d7a14d' },
  danger: { border: '#c64746', text: '#f0ceca', fill: 'rgba(29,20,22,.9)', label: '#c6403c' },
  success: { border: '#66d48c', text: '#d0f0dc', fill: 'rgba(18,27,22,.9)', label: '#66d48c' },
  gadget: { border: '#798ed5', text: '#d8dae9', fill: 'rgba(22,23,33,.9)', label: '#8fa2e0' },
  predict: { border: '#915877', text: '#dfd5df', fill: 'rgba(26,20,26,.9)', label: '#b07898' },
  neutral: { border: '#eadfcd', text: '#f4e2c3', fill: 'rgba(24,20,24,.9)', label: '#eadfcd' },
  chosen: { border: '#fbbd66', text: '#391707', fill: '#f7ac4f', label: '#391707' },
  navy: { border: null, text: '#eceef4', fill: 'rgba(51,57,81,.94)', label: '#eceef4' },
  amber: { border: '#b99567', text: '#ece2d0', fill: 'rgba(22,22,32,.92)', label: '#c8a060' },
  money: { border: '#c99d66', text: '#e2d8c7', fill: 'rgba(36,29,31,.9)', label: '#c8a060' },
  muted: { border: '#ab9167', text: '#c1b9ae', fill: 'rgba(57,51,49,.92)', label: '#ae9d82' },
};
const ALIAS = { gold: 'fact', info: 'fact', red: 'danger', threat: 'danger', bad: 'danger', green: 'success', go: 'success', plan: 'success', good: 'success',
  blue: 'gadget', tech: 'gadget', violet: 'predict', purple: 'predict', prediction: 'predict', white: 'neutral', cream: 'neutral', highlight: 'chosen', answer: 'chosen' };
export const theme = name => typeof name === 'object' && name ? { ...THEMES.fact, ...name } : THEMES[ALIAS[name] ?? name] ?? THEMES.fact;

// ---------- time ----------
/** whole frames since t0 (frame 0 = the frame at t0) */
export const fr = (t, t0) => Math.floor((t - t0) * FPS + 1e-4);
/** a time spec -> seconds: a number (exact), 'word' (S.at(word), minus `lead`), { word, near, after, which, plus } */
export function when(S, v, lead = 0) {
  if (v == null || v === false) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return S.at(v) - lead;
  if (typeof v === 'object' && !Array.isArray(v) && v.word) return S.at(v.word, v) - (v.lead ?? lead) + (v.plus ?? 0);
  return null;
}
const isTime = v => typeof v === 'number' || typeof v === 'string' || (v && typeof v === 'object' && !Array.isArray(v) && !v.isObject3D && !v.isActor && !v.head && v.word);
/** the start of an element: o.word (word start - lead) | o.at (number = exact, string = a word) | dflt */
export function startOf(S, o, lead = 2 * F, dflt) {
  const v = o.word ?? (isTime(o.at) ? o.at : null);
  const t = v != null ? when(S, v, lead) : (dflt ?? S.t0);
  return t;
}
/** cut-safe start: an element whose cue fell before the shot began is simply there from the cut (no animation) */
export const landed = (S, t0) => t0 < S.t0 + .5 * F ? -1e9 : t0;
/** where an element sits: o.pos, or o.at when it is a place (array / actor / object) */
export const posOf = o => o.pos ?? (o.at != null && !isTime(o.at) ? o.at : null);

// frame tables (24 fps) from the notes
export const POP = [[.35, 1.08], [.95, 1.03], [1, 1]];                       // pill / tag / option: 3 frames, ease-out
export const POPBIG = [[.7, .5], [1, .97], [1, 1.08], [1, 1]];                // icons: scale 0 -> 1.08 -> 1.0 in 4 frames (easeOutBack)
export const SWAP = [[1, .6], [1, 1.05], [1, 1]];                            // a corner icon after a cut
export const STAMP = [[.4, 1.15], [.85, 1.04], [1, 1]];                      // rubber stamp slam
export function popAt(table, t, t0) { const f = fr(t, t0); if (f < 0) return [0, 0]; return table[Math.min(f, table.length - 1)]; }
/** a linear fade over n frames that is complete on its n-th frame (frame 0 = 1/n) */
export const fadeIn = (t, t0, n = 4) => { const f = fr(t, t0); return f < 0 ? 0 : Math.min(1, (f + 1) / n); };
export const fadeOut = (t, t1, n = 6) => t1 == null ? 1 : clamp((t1 - t) * FPS / n);

// ---------- numbers ----------
/** count-up presets: money (ease-out 20 f), counter (in-out sine 37 f), attempts (accelerating 73 f) */
export const COUNTS = { money: { frames: 20, ease: E.outCubic }, counter: { frames: 37, ease: E.inOutSine }, attempts: { frames: 73, ease: k => k ** 1.7 }, fast: { frames: 12, ease: E.outCubic } };
export function format(v, o = {}) {
  if (typeof v === 'string') return v;
  if (typeof o.format === 'function') return o.format(v);
  const d = o.decimals ?? 0, n = Math.abs(v);
  let s = n.toFixed(d); if (o.sep !== false) { const [a, b] = s.split('.'); s = a.replace(/\B(?=(\d{3})+(?!\d))/g, o.sep ?? ',') + (b ? '.' + b : ''); }
  return (v < 0 ? '-' : '') + (o.prefix ?? '') + s + (o.suffix ?? '');
}
/** a value at time t: number | string | { from, to, at, frames | until, ease | preset } | [[time, value], ...] | t => v */
export function valueAt(S, v, t, o = {}) {
  if (typeof v === 'function') return v(t);
  if (Array.isArray(v)) { let cur = v[0]?.[1]; for (const [tt, val] of v) { const at = typeof tt === 'number' ? tt : when(S, tt); if (t >= at) cur = val; } return valueAt(S, cur, t, o); }
  if (v && typeof v === 'object') {
    const P = COUNTS[v.preset || o.preset] ?? COUNTS.money, dur = (v.frames ?? P.frames) * F;
    let a, b;
    if (v.land != null && v.land !== false) {
      // land: the references END count-ups on the spoken number. land: true = the count lands on its word (it starts `frames`
      // earlier, never before the cut); land: 'word' | time = it lands there and starts at word / at when given
      b = v.land === true ? when(S, v.word ?? v.at ?? S.t0, 0) : when(S, v.land, 0);
      a = v.land !== true && (v.word ?? v.at) != null ? when(S, v.word ?? v.at, 2 * F) : b - dur;
      a = Math.min(b - 2 * F, Math.max(a, S.t0 ?? a));
    } else { a = when(S, v.word ?? v.at ?? S.t0, 2 * F); b = v.until != null ? when(S, v.until) : a + dur; }
    // the first visible frame already shows one frame of the count (the references' count-ups land on their last frame)
    const ez = typeof v.ease === 'function' ? v.ease : E[v.ease] ?? P.ease, k = t < a - 1e-4 ? 0 : ez(seg(t + F, a, b));
    const x = lerp(v.from ?? 0, v.to ?? 0, k); return (v.decimals ?? o.decimals) ? +x.toFixed(v.decimals ?? o.decimals) : Math.round(x);
  }
  return v;
}

// ---------- text ----------
/** set the font for a style { cap (px), w (weight), fam ('sans' | 'mono' | 'hand' | css), track (em) }; returns the font px size */
export function setFont(x, st) {
  const size = (st.cap ?? 30) / capK(st.fam);
  x.font = `${st.italic ? 'italic ' : ''}${st.w ?? 800} ${size.toFixed(2)}px ${famOf(st.fam)}`;
  x.letterSpacing = `${((st.track ?? 0) * size).toFixed(2)}px`;
  return size;
}
const SPECIAL = /([✓✔✗✘→])/;
const glyphW = (ch, cap) => ch === '→' ? 1.15 * cap : ch === '✗' || ch === '✘' ? .85 * cap : .95 * cap;
function parts(str) { return String(str).split(SPECIAL).filter(s => s !== ''); }
/** width of a string in a style (no trailing tracking) */
export function measure(x, str, st) {
  const size = setFont(x, st), sp = (st.track ?? 0) * size; let w = 0;
  for (const p of parts(str)) w += SPECIAL.test(p) ? glyphW(p, st.cap) + sp : x.measureText(p).width;
  return Math.max(0, w - (String(str).length ? sp : 0));
}
function glyph(x, ch, X, Y, cap, lw, mode) {
  x.beginPath();
  if (ch === '→') { const w = 1.0 * cap, y = Y - cap * .5; x.moveTo(X + .06 * cap, y); x.lineTo(X + w, y); x.moveTo(X + w - .38 * cap, y - .36 * cap); x.lineTo(X + w, y); x.lineTo(X + w - .38 * cap, y + .36 * cap); }
  else if (ch === '✗' || ch === '✘') { const a = .12 * cap, b = .78 * cap; x.moveTo(X + a, Y - b); x.lineTo(X + b, Y - a); x.moveTo(X + b, Y - b); x.lineTo(X + a, Y - a); }
  else { x.moveTo(X + .08 * cap, Y - .46 * cap); x.lineTo(X + .36 * cap, Y - .12 * cap); x.lineTo(X + .9 * cap, Y - .98 * cap); }
  x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = lw; x.stroke();
  void mode;
}
/**
 * Draw text at baseline Y. st: { cap, w, fam, track, color, align: 'left'|'center'|'right', outline: [px, color],
 * halo: [blur, color], glow: [blur, color, passes], shadow: [dx, dy, blur, color], alpha }. k = device pixels per design
 * pixel (canvas shadows ignore the transform). Returns the box { x, y, w, h } (design px).
 */
export function drawText(x, str, X, Y, st, k = 1) {
  str = String(str ?? ''); if (!str) return { x: X, y: Y, w: 0, h: 0 };
  const w = measure(x, str, st), size = setFont(x, st), sp = (st.track ?? 0) * size, cap = st.cap ?? 30;
  const x0 = st.align === 'center' ? X - w / 2 : st.align === 'right' ? X - w : X;
  const P = parts(str), color = st.color ?? PAL.cream, glw = .2 * cap * (st.w >= 800 || st.w == null ? 1.05 : .85);
  x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  const run = (mode, extra = 0) => { let cx = x0;
    for (const p of P) { if (SPECIAL.test(p)) { glyph(x, p, cx, Y, cap, glw + extra, mode); cx += glyphW(p, cap) + sp; }
      else { if (mode === 'stroke') x.strokeText(p, cx, Y); else x.fillText(p, cx, Y); cx += x.measureText(p).width; } } };
  x.save(); if (st.alpha != null) x.globalAlpha *= st.alpha;
  const shadow = (blur, col, dx = 0, dy = 0) => { x.shadowBlur = blur * k; x.shadowColor = col; x.shadowOffsetX = dx * k; x.shadowOffsetY = dy * k; };
  const clear = () => { x.shadowBlur = 0; x.shadowColor = 'rgba(0,0,0,0)'; x.shadowOffsetX = x.shadowOffsetY = 0; };
  if (st.glow) { const [b, c, n = 2] = st.glow; x.fillStyle = color; x.strokeStyle = color; for (let i = 0; i < n; i++) { shadow(b * (i ? .45 : 1), c); run('fill'); } clear(); }
  if (st.halo) { const [b, c] = st.halo; x.fillStyle = c; x.strokeStyle = c; shadow(b, c); x.globalAlpha *= .9; run('fill'); x.globalAlpha /= .9; shadow(b * .5, c); run('fill'); clear(); }
  if (st.outline) { const [ow, oc] = st.outline; x.strokeStyle = oc; x.lineWidth = ow * 2; x.lineJoin = 'round'; x.miterLimit = 2;
    if (st.shadow) { const [dx, dy, b, c] = st.shadow; shadow(b, c, dx, dy); } run('stroke', ow * 2); clear(); }
  else if (st.shadow) { const [dx, dy, b, c] = st.shadow; x.fillStyle = color; shadow(b, c, dx, dy); run('fill'); clear(); }
  x.fillStyle = color; x.strokeStyle = color; run('fill');
  x.restore();
  return { x: x0, y: Y - cap, w, h: cap };
}
/** scale about a point (pops) */
export function about(x, cx, cy, s, rot = 0) { x.translate(cx, cy); if (rot) x.rotate(rot); x.scale(s, s); x.translate(-cx, -cy); }
const rgbOf = c => { const h = c.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
/** '#hex' or rgba() -> rgba() with a multiplied alpha */
export function withAlpha(c, a) {
  if (!c) return c; if (c.startsWith('#')) { const [r, g, b] = rgbOf(c); return `rgba(${r},${g},${b},${a})`; }
  const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return c; const p = m[1].split(',').map(s => +s); return `rgba(${p[0]},${p[1]},${p[2]},${(p[3] ?? 1) * a})`;
}
const greyOf = (c, k) => c && c.startsWith('#') ? mixHex(c, '#9c98a2', k) : c;

// =====================================================================================================================
// PAINTERS. Each draws at a design-pixel position and returns its box. `k` = device px per design px (for blurs).
// =====================================================================================================================

/** statement pill (capsule h 100, border 3, text cap .44 h, padding .37 h, tracking +.05 em). o: { h, theme, cap,
 *  strike: 0..1 (the strike line drawn so far), grey: 0..1 (struck state), w (fixed width) } */
export function pillSize(x, text, o = {}) {
  const h = o.h ?? 100, cap = (o.cap ?? .44) * h;
  return { w: o.w ?? measure(x, text, { cap, w: 800, track: o.track ?? .05 }) + 2 * (o.pad ?? .37) * h, h, cap };
}
export function paintPill(x, cx, cy, text, o = {}, k = 1) {
  const T = theme(o.theme), { w, h, cap } = pillSize(x, text, o), g = o.grey ?? 0;
  const fill = g ? withAlpha(T.fill, 1 - g) : T.fill, border = T.border ? (g ? withAlpha(greyOf(T.border, g), 1 - .5 * g) : T.border) : null;
  x.save();
  x.beginPath(); x.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2); x.fillStyle = fill; x.fill();
  if (border) { x.lineWidth = o.border ?? Math.max(2, .03 * h); x.strokeStyle = border; x.stroke(); }
  const tc = g ? mixHex(T.text.startsWith('#') ? T.text : '#f4e2c3', PAL.grey, g) : T.text;
  drawText(x, text, cx, cy + cap / 2, { cap, w: 800, track: o.track ?? .05, color: tc, align: 'center' }, k);
  if (o.strike > 0) { const ov = 22, x0 = cx - w / 2 - ov, x1 = cx + w / 2 + ov, tilt = Math.tan(1.6 * Math.PI / 180) * (x1 - x0);
    x.beginPath(); x.moveTo(x0, cy + tilt / 2); x.lineTo(lerp(x0, x1, o.strike), cy + tilt / 2 - tilt * o.strike);
    x.lineWidth = 3.2 * h / 100 + .6; x.lineCap = 'round'; x.strokeStyle = o.strikeColor ?? '#dcd8de'; x.stroke(); }
  x.restore();
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** chapter / time label (top-left): line 1 cap 43, cream, 4 px dark brown outline + soft shadow; line 2 cap 20 gold,
 *  tracking +.25 em, 36 px under line 1. X, Y = left edge and line 1's cap top. */
export function paintLabel(x, X, Y, text, o = {}, k = 1) {
  const cap = o.cap ?? 43, align = o.align ?? 'left';
  const st = { cap, w: 800, track: o.track ?? .06, color: o.color ?? PAL.cream, align, outline: [o.outlineW ?? cap * .093, o.outlineColor ?? PAL.outline], shadow: [0, 2, 6, 'rgba(20,10,10,.45)'] };
  const b = drawText(x, text, X, Y + cap, st, k);
  let h = cap;
  if (o.sub) { const sc = o.subCap ?? cap * .465;
    const b2 = drawText(x, o.sub, X, Y + cap + (o.subGap ?? cap * .84) + sc, { cap: sc, w: 800, track: .25, color: o.subColor ?? PAL.sub, align, outline: [Math.max(2.5, sc * .16), PAL.outline], shadow: [0, 1, 4, 'rgba(20,10,10,.4)'] }, k);
    h = b2.y + b2.h - b.y; b.w = Math.max(b.w, b2.w); if (align !== 'left') b.x = Math.min(b.x, b2.x); }
  return { x: b.x, y: Y, w: b.w, h };
}

/** the lives counter (bottom-right): cap 26, cream, tracking +.18 em, soft dark warm halo, no outline. Right edge X, baseline Y */
export function paintLives(x, X, Y, text, o = {}, k = 1) {
  const cap = o.cap ?? 26;
  if (o.big) return drawText(x, text, X, Y, { cap, w: 800, track: o.track ?? .06, color: o.color ?? PAL.lives, align: o.align ?? 'center', outline: [cap * .05, '#3a2a2a'], shadow: [0, cap * .05, cap * .12, 'rgba(15,8,8,.6)'] }, k);
  return drawText(x, text, X, Y, { cap, w: 800, track: o.track ?? .18, color: o.color ?? PAL.lives, align: o.align ?? 'right', halo: [7.5, 'rgba(90,42,26,.62)'] }, k);
}

/** the pro / con corner icon: a boiling low-poly disc (15 sides) with a glowing + or -. o: { r (72), sign '+'|'-',
 *  frame (boil), ring 0..1 (the disc; 0 = the glyph alone, as when it is born big), glow 0..1 } */
export function paintIcon(x, cx, cy, o = {}, k = 1) {
  const r = o.r ?? 72, plus = o.sign !== '-' && o.sign !== 'minus', ring = o.ring ?? 1, boil = Math.floor((o.frame ?? 0) / 3), n = 15;
  const C = plus ? { fill: 'rgba(45,45,39,.9)', rim: '#b58439', glyph: '#e0a840', glow: 'rgba(240,170,60,.85)' } : { fill: 'rgba(17,23,31,.9)', rim: '#5c6980', glyph: '#b8c4d8', glow: 'rgba(170,195,235,.75)' };
  x.save();
  if (ring > 0) {
    x.globalAlpha *= ring; x.beginPath();
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i + (hash(i, boil) - .5) * .28) * 2 * Math.PI / n + boil * .21, rr = r * (1 + (hash(i + 40, boil) - .5) * .07);
      i ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    x.closePath(); x.fillStyle = C.fill; x.fill(); x.lineWidth = r * .09; x.lineJoin = 'round'; x.strokeStyle = C.rim; x.stroke();
    x.globalAlpha /= ring;
  }
  const L = r * 1.06, T = plus ? r * .33 : r * .25, g = o.glow ?? 1;
  const bars = () => { x.beginPath(); x.roundRect(cx - L / 2, cy - T / 2, L, T, T / 2); if (plus) x.roundRect(cx - T / 2, cy - L / 2, T, L, T / 2); x.fill(); };
  x.fillStyle = C.glyph; x.shadowColor = C.glow; x.shadowBlur = r * (.12 + .14 * g) * k; bars(); x.shadowBlur = r * .06 * k; bars();
  x.restore();
  return { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r };
}

/** small object tag (capsule h 60, cap 24, tracking +.12 em) with a leader line to `to` [x, y]. style 'navy' | 'amber' | theme */
export function paintTag(x, cx, cy, text, o = {}, k = 1) {
  const T = theme(o.style ?? o.theme ?? 'amber'), h = o.h ?? 60, cap = o.cap ?? h * .4, w = measure(x, text, { cap, w: 800, track: .12 }) + h * .75;
  x.save();
  if (o.to && (o.line ?? 1) > 0) { const [tx, ty] = o.to; const ex = clamp(tx, cx - w / 2 + h / 2, cx + w / 2 - h / 2), ey = ty > cy ? cy + h / 2 : cy - h / 2;
    const lx = Math.abs(ty - cy) < h / 2 ? (tx > cx ? cx + w / 2 : cx - w / 2) : ex, ly = Math.abs(ty - cy) < h / 2 ? cy : ey;
    x.beginPath(); x.moveTo(lx, ly); x.lineTo(lerp(lx, tx, o.line ?? 1), lerp(ly, ty, o.line ?? 1)); x.lineWidth = 1.8; x.strokeStyle = T.border ?? '#9aa3c0'; x.stroke();
    if ((o.line ?? 1) >= 1 && o.dot !== false) { x.beginPath(); x.arc(tx, ty, 3.2, 0, 7); x.fillStyle = T.border ?? '#9aa3c0'; x.fill(); } }
  x.beginPath(); x.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2); x.fillStyle = T.fill; x.fill();
  if (T.border) { x.lineWidth = 2; x.strokeStyle = T.border; x.stroke(); }
  drawText(x, text, cx, cy + cap / 2, { cap, w: 800, track: .12, color: T.text, align: 'center' }, k);
  x.restore();
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** stat box: tracked label over a big value, dark fill, 2-3 px themed border, radius 16 % of the height.
 *  (X, Y) = the anchor point given by align ('tl' | 'tr' | 'center' | 'bl' | 'br'). o: { label, value, cap (value cap), theme, minW } */
export function statSize(x, o = {}) {
  const cap = o.cap ?? 53, lc = o.labelCap ?? cap / 2.6, lw = o.label ? measure(x, o.label, { cap: lc, w: 800, track: .2 }) : 0;
  const vw = measure(x, String(o.value ?? ''), { cap, w: 800, track: .02 }), padX = cap * .55;
  const h = (o.label ? cap * .38 + lc + cap * .32 : cap * .45) + cap + cap * .4, w = Math.max(o.minW ?? 0, Math.max(lw, vw) + 2 * padX);
  return { w, h, cap, lc, padX };
}
export function paintStat(x, X, Y, o = {}, k = 1) {
  const T = theme(o.theme ?? 'fact'), { w, h, cap, lc, padX } = statSize(x, o), al = o.align ?? 'tl';
  const x0 = al === 'center' ? X - w / 2 : al.endsWith('r') ? X - w : X, y0 = al === 'center' ? Y - h / 2 : al.startsWith('b') ? Y - h : Y;
  x.save();
  x.beginPath(); x.roundRect(x0, y0, w, h, Math.min(h * .16, 30)); x.fillStyle = o.fill ?? T.fill; x.fill();
  x.lineWidth = o.border ?? (cap > 65 ? 3 : 2); x.strokeStyle = T.border ?? '#c29c6b'; x.stroke();
  const cxText = o.center ? x0 + w / 2 : x0 + padX, al2 = o.center ? 'center' : 'left';
  let y = y0 + (o.label ? cap * .38 : cap * .45);
  if (o.label) { drawText(x, o.label, cxText, y + lc, { cap: lc, w: 800, track: .2, color: o.labelColor ?? T.label, align: al2 }, k); y += lc + cap * .32; }
  drawText(x, String(o.value ?? ''), cxText, y + cap, { cap, w: 800, track: .02, color: o.color ?? T.text, align: al2, glow: o.glow === false ? null : [cap * .25, withAlpha(o.color ?? T.text, .35), 1] }, k);
  x.restore();
  return { x: x0, y: y0, w, h };
}

/** red countdown box (232 x 66, radius 10, digits cap 31 red with a glow). X = right edge, Y = top */
export function paintTimer(x, X, Y, text, o = {}, k = 1) {
  const cap = o.cap ?? 31, w = Math.max(o.w ?? 232, measure(x, text, { cap, w: 700, track: .04 }) + cap * 1.4), h = o.h ?? 66, col = o.color ?? PAL.red;
  x.save(); x.beginPath(); x.roundRect(X - w, Y, w, h, o.r ?? 10); x.fillStyle = o.fill ?? 'rgba(24,17,20,.94)'; x.fill();
  drawText(x, text, X - w / 2, Y + h / 2 + cap / 2, { cap, w: 700, track: .04, color: col, align: 'center', glow: [cap * .45, withAlpha(col, .75), 2] }, k);
  x.restore(); return { x: X - w, y: Y, w, h };
}

/** clock stamp: 'box' = dark box flush on the bottom bar (244 x 70, radius 16, text #b3aea7 cap 27); 'mint' = box-less
 *  mint caption with a glow; X / Y = right edge + bottom (box) or left edge + cap top (mint) */
export function paintClock(x, X, Y, text, o = {}, k = 1) {
  if (o.style === 'mint') return drawText(x, text, X, Y + (o.cap ?? 28), { cap: o.cap ?? 28, w: 800, track: .08, color: o.color ?? PAL.mint, align: o.align ?? 'left', glow: [12, 'rgba(120,220,160,.55)', 2] }, k);
  const cap = o.cap ?? 27, w = Math.max(o.w ?? 244, measure(x, text, { cap, w: 800, track: .04 }) + cap * 2.2), h = o.h ?? 70;
  x.save(); x.beginPath(); x.roundRect(X - w, Y - h, w, h, o.flush === false ? 16 : [16, 16, 0, 0]); x.fillStyle = o.fill ?? 'rgba(38,36,35,.86)'; x.fill();
  drawText(x, text, X - w / 2, Y - h / 2 + cap / 2, { cap, w: 800, track: .04, color: o.color ?? '#b3aea7', align: 'center' }, k);
  x.restore(); return { x: X - w, y: Y - h, w, h };
}

/** "+1 YEAR" torn paper tab flush under the top bar: paper, red top band 14 px, zig-zag bottom edge, dark text cap 40 */
export function paintElapsed(x, X, Y, text, o = {}, k = 1) {
  const cap = o.cap ?? 40, w = Math.max(o.w ?? 224, measure(x, text, { cap, w: 800, track: .02 }) + cap * .9), h = o.h ?? 104, band = 14, zz = 13, n = Math.max(6, Math.round(w / 26));
  x.save(); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 10 * k; x.shadowOffsetY = 3 * k;
  x.beginPath(); x.moveTo(X, Y); x.lineTo(X + w, Y); x.lineTo(X + w, Y + h - zz);
  for (let i = n; i >= 0; i--) x.lineTo(X + w * i / n, Y + h - (i % 2 ? 0 : zz));
  x.closePath(); x.fillStyle = o.paper ?? '#d6d3cc'; x.fill(); x.shadowColor = 'rgba(0,0,0,0)';
  x.fillStyle = o.band ?? '#832825'; x.fillRect(X, Y, w, band);
  drawText(x, text, X + w / 2, Y + band + (h - band - zz) / 2 + cap / 2, { cap, w: 800, track: .02, color: o.color ?? '#151210', align: 'center' }, k);
  x.restore(); return { x: X, y: Y, w, h };
}

/** checklist line: "✓ CHESS" right-aligned, cap 27.5, gold #f6d188, 3 px dark outline, tracking +.2 em */
export function paintCheck(x, X, Y, text, o = {}, k = 1) {
  const cap = o.cap ?? 27.5;
  return drawText(x, (o.mark ?? '✓') + ' ' + text, X, Y + cap, { cap, w: 800, track: .2, color: o.color ?? PAL.amber3, align: o.align ?? 'right', outline: [3, PAL.outline2], shadow: [0, 1, 4, 'rgba(20,10,10,.4)'] }, k);
}

/** rubber stamp: caps in a double-rule rectangle, red or green, rotated. (cx, cy) = centre */
export function paintStamp(x, cx, cy, text, o = {}, k = 1) {
  const cap = o.cap ?? 40, col = o.color ?? (o.theme === 'green' || o.theme === 'success' ? PAL.stampGreen : PAL.stampRed);
  const tw = measure(x, text, { cap, w: 800, track: .08 }), w = tw + cap * 1.1, h = cap * 2;
  x.save(); about(x, cx, cy, 1, (o.rot ?? -4) * Math.PI / 180);
  x.strokeStyle = col; x.lineWidth = cap * .1; x.strokeRect(cx - w / 2, cy - h / 2, w, h);
  x.lineWidth = cap * .05; x.strokeRect(cx - w / 2 + cap * .17, cy - h / 2 + cap * .17, w - cap * .34, h - cap * .34);
  drawText(x, text, cx, cy + cap / 2, { cap, w: 800, track: .08, color: col, align: 'center' }, k);
  x.restore(); return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** public-service bar: a centred band (1120 wide), 2 lines of cream caps (cap 28, pitch 48) */
export function paintWarning(x, cx, Y, lines, o = {}, k = 1) {
  const cap = o.cap ?? 28, pitch = o.pitch ?? cap * 1.72, L = Array.isArray(lines) ? lines : String(lines).split('\n');
  const w = Math.max(o.w ?? 1120, ...L.map(l => measure(x, l, { cap, w: 800, track: .02 }) + cap * 2)), h = o.h ?? Math.max(100, L.length * pitch + cap * 1.2);
  x.save(); x.fillStyle = o.fill ?? 'rgba(44,37,35,.8)'; x.beginPath(); x.roundRect(cx - w / 2, Y, w, h, 6); x.fill();
  const top = Y + (h - (L.length - 1) * pitch) / 2 + cap / 2;
  L.forEach((l, i) => drawText(x, l, cx, top + i * pitch, { cap, w: 800, track: .02, color: o.color ?? PAL.psaText, align: 'center' }, k));
  x.restore(); return { x: cx - w / 2, y: Y, w, h };
}

/** a hand-drawn marker ring around a box (draws on: k 0..1, starting at the right end, under the text right -> left,
 *  closing over the top and overshooting its start) */
export function paintMarkerRing(x, cx, cy, rx, ry, prog = 1, o = {}) {
  if (prog <= 0) return;
  const n = 64, a0 = .15, span = 2 * Math.PI + .5, end = span * prog;
  x.save(); x.beginPath();
  for (let i = 0; i <= n; i++) { const a = a0 + end * i / n, wob = 1 + .045 * Math.sin(a * 3 + 1) + .03 * (a / span);
    const px = cx + Math.cos(a) * rx * wob, py = cy + Math.sin(a) * ry * wob * (1 - .04 * Math.cos(a));
    i ? x.lineTo(px, py) : x.moveTo(px, py); }
  x.lineWidth = o.w ?? 5; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = o.color ?? PAL.marker; x.stroke(); x.restore();
}

/** a soft radial vignette / backdrop for full-screen graphics: centre colour -> edge colour */
export function paintBackdrop(x, w, h, inner, outer, o = {}) {
  const g = x.createRadialGradient(w * (o.cx ?? .5), h * (o.cy ?? .5), 0, w * (o.cx ?? .5), h * (o.cy ?? .5), Math.hypot(w, h) * (o.r ?? .55));
  g.addColorStop(0, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, w, h);
}
void DW; void DH;
