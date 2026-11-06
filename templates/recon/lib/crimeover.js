// Investigation kit, 2D (engine v7+): the true-crime documentary's designed text and cards, drawn on the engine's overlay
// canvas with S.over(item). Every item is a pure function of the time (preview == render): scrambles, typing, waveforms
// and glitches are seeded by the frame number, never by Math.random.
// Sound is OPT-IN ({ sound: true }): no sound effects unless the user supplied them (no_slop.md, the v1 review).
// Colours and fonts come from the theme tokens (C.text, C.crimson, C.dot, C.hl, C.paper, THEME.ov ...).
//   decodeText / scrambleAt          a text that decodes in from random glyphs
//   placeTag, lowerThird, statFloater, notice, redact            labels over any shot (stamp() is banned: a no-op)
//   chapterCard, titleCard, quoteCard, headlineCard, creditsPanel full-frame cards (cover the frame: no 3D render under them)
//   makeDoc(spec)                    documents/headlines/tweets/cards laid out with word boxes (highlight a phrase by its words);
//                                    crime.js films the same documents on a desk (evidence())
import { C, THEME, IMG, E, ease, seg, clamp, lerp, FW, FH, rr, sfx } from '../engine.js';
import * as ENG from '../engine.js';
// the engine's one text shadow (drawText, THEME.ov.shadow); an older engine without it gets the same soft neutral shadow
const drawText = ENG.drawText ?? ((x, s, X, Y, o = {}) => { x.save(); x.font = o.font; x.letterSpacing = o.ls ?? '0px'; x.textAlign = o.align ?? 'left'; x.textBaseline = o.base ?? 'alphabetic';
  if (o.shadow !== false) { x.shadowColor = `rgba(0,0,0,${o.level === 'strong' ? .6 : .5})`; x.shadowBlur = o.level === 'strong' ? 14 : 10; x.shadowOffsetY = 2; }
  x.fillStyle = o.color ?? C.text; x.fillText(s, X, Y); x.restore(); });

// ---------- fonts (Inter 800/600 and JetBrains Mono are bundled; italics are the browser's oblique of Inter; serif =
// the system's Georgia / Times, present on Windows and macOS) ----------
export const CF = {
  h: (s, w = 800) => `${w} ${s}px Inter`, i: (s, w = 800) => `italic ${w} ${s}px Inter`, m: (s, w = 400) => `${w} ${s}px JBM`,
  serif: (s, w = 400, it = false) => `${it ? 'italic ' : ''}${w} ${s}px Georgia, 'Times New Roman', Times, serif`,
};
// ---------- deterministic noise ----------
export function hh(a, b = 0) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15; return (h >>> 0) / 4294967296;
}
const frameOf = t => Math.floor(t * 30 + 1e-6);
const UP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', LOW = 'abcdefghijklmnopqrstuvwxyz', DIG = '0123456789', SYM = '#$%&*+=/<>?!';
const mkc = (w = FW, h = FH) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };

// decodeText(text, k, { t, seed, every }): the text with its first k (0-1) settled and the rest random glyphs of the same
// kind (upper, lower, digits); spaces stay. The glyphs change every `every` frames (default 2) of time t.
export function decodeText(text, k, o = {}) {
  const s = String(text); if (k >= 1) return s;
  const n = s.length, head = Math.floor(clamp(k) * n), fr = Math.floor(frameOf(o.t ?? 0) / (o.every ?? 2)), seed = o.seed ?? 7;
  let r = '';
  for (let i = 0; i < n; i++) { const ch = s[i];
    if (i < head || /[\s.,:;'’\-–]/.test(ch)) { r += ch; continue; }
    const set = /[a-z]/.test(ch) ? LOW : /[0-9]/.test(ch) ? DIG : /[A-Z]/.test(ch) ? UP + DIG : SYM;
    r += set[Math.floor(hh(seed * 131 + i, fr) * set.length)]; }
  return r;
}
// scrambleAt(text, t, t0, dur, seed): decodeText settling over [t0, t0 + dur]
export const scrambleAt = (text, t, t0, dur = .5, seed = 7) => decodeText(text, seg(t, t0, t0 + dur), { t, seed });
const seedOf = s => { let h = 7; for (const ch of String(s)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0; return h; };

// white text with the engine's soft neutral drop shadow. Text NEVER gets a coloured glow (user feedback: a red halo reads
// as cheap): o.glow is ignored except glow: null (no shadow); o.blur >= 26 (big titles) asks for the 'strong' level.
export function glowText(x, s, X, Y, o = {}) {
  drawText(x, s, X, Y, { font: o.font ?? CF.h(40), ls: o.ls ?? '0px', align: o.align ?? 'left', base: o.base ?? 'alphabetic', color: o.color ?? C.text,
    shadow: o.glow !== null, level: o.level ?? ((o.blur ?? 0) >= 26 ? 'strong' : 'soft') });
}
// three small crimson dots (top-left of every red-grid frame)
export function redDots(x, X = 211, Y = 76) {
  x.save(); x.fillStyle = C.dot; x.shadowColor = C.dot; x.shadowBlur = 12;
  for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(X + i * 21, Y, 5.5, 0, 7); x.fill(); } x.restore();
}
// diagonal blurred crimson light streaks in two corners (foreground of the red grid)
export function redStreaks(x, k = 1) {
  x.save(); x.globalCompositeOperation = 'lighter'; x.lineCap = 'round';
  for (const [x0, y0, x1, y1, w, al] of [[-60, 980, 420, 640, 26, .22], [-40, 1060, 300, 860, 10, .3], [1700, -40, 1990, 260, 34, .16], [1820, -30, 1980, 120, 9, .28]]) {
    x.strokeStyle = `rgba(190,10,26,${al * k})`; x.shadowColor = 'rgba(200,0,20,.9)'; x.shadowBlur = 40; x.lineWidth = w;
    x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); }
  x.restore();
}
// the red grid frame (chapter cards, quote cards without a photo): black, a perspective grid floor, a crimson glow
const GRID = new Map();
export function redGrid(x, o = {}) {
  const key = JSON.stringify([o.glow, o.horizon, o.cell]);
  if (!GRID.has(key)) {
    const [c, g] = mkc(), hz = o.horizon ?? FH * .46, vx = FW * .5, [gx, gy] = o.glow ?? [FW * .78, FH * .82];
    g.fillStyle = '#020001'; g.fillRect(0, 0, FW, FH);
    const rg = g.createRadialGradient(gx, gy, 0, gx, gy, FW * .62); rg.addColorStop(0, 'rgba(74,0,9,.95)'); rg.addColorStop(.35, 'rgba(48,0,8,.7)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, FW, FH);
    const [lc, l] = mkc(); l.strokeStyle = 'rgba(170,30,42,1)'; l.lineWidth = 1.5;
    // a floor seen at ~35 degrees: lines from the vanishing point, cross lines closer together toward the horizon
    const cell = o.cell ?? 170, bot = FH + 160;
    for (let i = -30; i <= 30; i++) { l.beginPath(); l.moveTo(vx, hz); l.lineTo(vx + i * cell, bot); l.stroke(); }
    for (let d = 0; d < 48; d++) { const y = hz + (bot - hz) / (1 + d * .34); if (y < hz + 3) continue; l.globalAlpha = clamp((y - hz) / (FH - hz) * 1.6); l.beginPath(); l.moveTo(0, y); l.lineTo(FW, y); l.stroke(); }
    l.globalAlpha = 1; l.globalCompositeOperation = 'destination-in';
    const m = l.createRadialGradient(gx, gy, 0, gx, gy, FW * .8); m.addColorStop(0, 'rgba(0,0,0,.85)'); m.addColorStop(.5, 'rgba(0,0,0,.4)'); m.addColorStop(1, 'rgba(0,0,0,.14)');
    l.fillStyle = m; l.fillRect(0, 0, FW, FH);
    const fadeTop = l.createLinearGradient(0, hz, 0, hz + 120); fadeTop.addColorStop(0, 'rgba(0,0,0,0)'); fadeTop.addColorStop(1, 'rgba(0,0,0,1)'); l.fillStyle = fadeTop; l.fillRect(0, 0, FW, FH);   // (destination-in clears outside what is filled)
    g.drawImage(lc, 0, 0);
    const v = g.createRadialGradient(FW / 2, FH / 2, FH * .3, FW / 2, FH / 2, FW * .7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.75)'); g.fillStyle = v; g.fillRect(0, 0, FW, FH);
    GRID.set(key, c);
  }
  x.drawImage(GRID.get(key), 0, 0);
}
// a faint dotted grid (title cards)
function dotGrid(x, a = 1) { x.save(); x.fillStyle = `rgba(255,70,80,${.08 * a})`; for (let y = 30; y < FH; y += 36) for (let X = 30; X < FW; X += 36) x.fillRect(X, y, 2, 2); x.restore(); }
// the soft oval vignette the cards share
function vignette(x, k = .7) { const v = x.createRadialGradient(FW / 2, FH / 2, FH * .25, FW / 2, FH / 2, FW * .66); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${k})`); x.fillStyle = v; x.fillRect(0, 0, FW, FH); }

// ======================================================================================================================
// TEXT PLACEMENT STANDARD (v2.3, the user's review: "the white texts are really inconveniently placed")
//   Tags, lower thirds and date labels sit on ONE grid in the safe zones, never over a face / the subject / the centre of a
//   real photo, never over busy texture without a soft scrim:
//     lowerLeft  (default)  x = 6 % of the width, baseline at 80 % of the height (above the credit line at ~95 %)
//     lowerRight            right edge at 94 %, baseline 80 %          upperLeft / upperRight  baseline at 16 %
//   at: 'auto' (the default when no x / y is given) = safeSpot(S): the calmest of those anchors on the picture under it.
//   scrim: 'auto' (default) a very soft neutral radial shade under the text when the picture there is busy or bright
//   (no plate, no colour); true = always; false = never.
//   S.textAvoid = [[x, y, w, h], ...] (px of 1920 x 1080): faces / subjects the text must not cover (check_layout TEXTPLACE).
// ======================================================================================================================
export const SAFE = { left: Math.round(FW * .06), right: Math.round(FW * .94), low: Math.round(FH * .80), high: Math.round(FH * .16) };
const ANCHORS = ['lowerLeft', 'lowerRight', 'upperLeft', 'upperRight'];
const anchorXY = (name, w) => { const right = /Right/.test(name), low = /lower/.test(name); return { x: right ? SAFE.right - w : SAFE.left, y: low ? SAFE.low : SAFE.high, name }; };
const [, mx] = mkc(8, 8);
const textW = (s, font, ls = '0px') => { mx.save(); mx.font = font; mx.letterSpacing = ls; const w = mx.measureText(s).width; mx.restore(); return w; };
const hit = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
const CENTRE = [FW / 3, FH / 3, FW / 3, FH / 3];
// the b-roll item under the overlays at t (S.ov), or null (a 3D shot)
const brollAt = (S, t) => (S?.ov || []).find(it => it.what === 'broll' && t >= (it.t0 ?? 0) && t < (it.t1 ?? 1e9) && it.draw);
// picture statistics of a rect of the b-roll at time t, on a 480 x 270 copy: { mean, sd, edge } (0-1)
const [PC, px] = mkc(480, 270);
function regionStats(S, t, r) {
  const b = brollAt(S, t); if (!b) return null;
  px.setTransform(.25, 0, 0, .25, 0, 0); b.draw(px, t, 1, S); px.setTransform(1, 0, 0, 1, 0, 0);
  const X = Math.max(0, Math.floor(r[0] / 4)), Y = Math.max(0, Math.floor(r[1] / 4)), W = Math.min(480 - X, Math.ceil(r[2] / 4)), H = Math.min(270 - Y, Math.ceil(r[3] / 4));
  if (W < 2 || H < 2) return null; const d = px.getImageData(X, Y, W, H).data, L = new Float32Array(W * H);
  for (let i = 0; i < L.length; i++) L[i] = (d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11) / 255;
  let s = 0, s2 = 0, e = 0; for (let i = 0; i < L.length; i++) { s += L[i]; s2 += L[i] * L[i]; const xx = i % W; if (xx < W - 1) e += Math.abs(L[i + 1] - L[i]); if (i + W < L.length) e += Math.abs(L[i + W] - L[i]); }
  const mean = s / L.length; return { mean, sd: Math.sqrt(Math.max(0, s2 / L.length - mean * mean)), edge: e / L.length };
}
const busyScore = st => st ? st.edge * 4 + st.sd + Math.max(0, st.mean - .55) * 1.5 : 0;
// safeSpot(S, subject | 'auto', { w, h, t, prefer }) -> { x, y, name, busy }: the calmest anchor for a text box w x h (px)
//   subject: a rect [x, y, w, h] (px) to keep clear, or 'auto' (S.textAvoid + the centre third of a b-roll photo).
//   On b-roll the picture under each candidate is measured (edge density + luminance spread + brightness) at time t; on a
//   3D shot (no picture known in advance) the first anchor clear of the subject wins (lowerLeft first).
export function safeSpot(S, subject = 'auto', o = {}) {
  const w = o.w ?? 600, h = o.h ?? 60, t = o.t ?? 0, avoid = [...(S?.textAvoid || []), ...(Array.isArray(subject) ? [subject] : [])];
  const isB = !!brollAt(S, t); let best = null;
  (o.prefer ? [o.prefer, ...ANCHORS.filter(a => a !== o.prefer)] : ANCHORS).forEach((name, i) => {
    const a = anchorXY(name, w), r = [a.x, a.y - h * .8, w, h];
    if (avoid.some(q => hit(r, q)) || (isB && hit(r, CENTRE))) return;
    const st = isB ? regionStats(S, t, [r[0] - 20, r[1] - 20, r[2] + 40, r[3] + 40]) : null, sc = busyScore(st) + i * .03;
    if (!best || sc < best.sc) best = { ...a, sc, busy: busyScore(st) > .32 || (st?.mean ?? 0) > .6 }; });
  return best ?? { ...anchorXY('lowerLeft', w), busy: true };
}
// the soft neutral scrim under a text box (a radial shade, no edges, max 48 % black at its middle)
function scrim(x, r, a = 1) {
  const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2, R = Math.max(r[2], r[3] * 3) * .72; x.save(); x.translate(cx, cy); x.scale(1, Math.min(1, (r[3] * 2.6) / R));
  const g = x.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, `rgba(0,0,0,${.48 * a})`); g.addColorStop(.55, `rgba(0,0,0,${.28 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(-R, -R, R * 2, R * 2); x.restore();
}
// the anchor of a label item: explicit x / y, a named anchor, or 'auto' (safeSpot once, on its first shot, cached on the item:
// a label carried across a cut keeps its place)
function placeOf(it, o, S, w, h, defY) {
  if (it._spot) return it._spot;
  const at = o.at ?? (o.x == null && o.y == null ? 'auto' : null);
  if (at == null) return { x: o.x ?? SAFE.left, y: o.y ?? defY, busy: false, name: 'manual' };
  if (at !== 'auto') { const a = anchorXY(at, w); return { ...a, busy: busyScore(regionStats(S, it.t0 + .5, [a.x, a.y - h * .8, w, h])) > .32 }; }
  if (!S) return { ...anchorXY('lowerLeft', w), busy: false };   // (no shot yet: not cached)
  return (it._spot = safeSpot(S, o.avoid ?? 'auto', { w, h, t: it.t0 + .5, prefer: o.prefer }));
}

// TEXTPLACE + PIXELATED (check_layout, engine v9+ LAYOUT_CHECKS)
//   TEXTPLACE: a settled label's box overlaps another label, the credit line, a declared face / subject (S.textAvoid), the
//   centre third of a b-roll photo, or leaves the safe area (4 % margins).
//   PIXELATED: a b-roll picture (or an overlay that declares mag) is magnified more than 1.5x at its most zoomed moment
//   (cover scale x (1 + zoom)): use a higher-resolution source, vector / baked data, or less zoom.
export const MAX_MAG = 1.5;
ENG.LAYOUT_CHECKS?.push((S, t) => {
  const out = [], act = (S?.ov || []).filter(it => t >= (it.t0 ?? 0) + (it.settle ?? .7) && t < (it.t1 ?? 1e9) - .3);
  const boxes = act.filter(it => it.box).map(it => ({ it, r: it.box(S) })).filter(q => q.r), b = brollAt(S, t);
  const credit = (S?.ov || []).some(it => (it.what === 'broll' || /credit/.test(it.what ?? '')) && t >= (it.t0 ?? 0) && t < (it.t1 ?? 1e9)) || /credit/.test(b?.text ?? '');
  for (const [i, q] of boxes.entries()) { const r = q.r, nm = `${q.it.what} "${q.it.text}" (box ${r.map(Math.round).join(',')})`;
    for (const q2 of boxes.slice(i + 1)) if (hit(r, q2.r)) out.push({ type: 'TEXTPLACE', detail: `${nm} collides with ${q2.it.what} "${q2.it.text}": put them on different anchors (SAFE grid).` });
    if (credit && r[1] + r[3] > FH - 62 && r[0] < FW * .7) out.push({ type: 'TEXTPLACE', detail: `${nm} runs into the credit line (bottom ${FH - 62} px): lift it to the lowerLeft anchor (baseline ${SAFE.low}).` });
    for (const a of S.textAvoid || []) if (hit(r, a)) out.push({ type: 'TEXTPLACE', detail: `${nm} covers the shot's subject / face [${a.join(',')}]: at: 'auto' (safeSpot) or another anchor.` });
    if (b && b.cover && hit(r, CENTRE)) out.push({ type: 'TEXTPLACE', detail: `${nm} sits in the centre third of a real photo: move it to a SAFE anchor (lowerLeft / lowerRight / upper...).` });
    if (r[0] < FW * .04 || r[1] < FH * .05 || r[0] + r[2] > FW * .96 || r[1] + r[3] > FH * .97) out.push({ type: 'TEXTPLACE', detail: `${nm} leaves the safe area (4 % margins).` }); }
  for (const it of (S?.ov || []).filter(it2 => t >= (it2.t0 ?? 0) && t < (it2.t1 ?? 1e9))) {
    let mag = null, what = it.text;
    if (it.what === 'broll' && it.frame) { const im = it.frame(t), o = it.o || {}; if (im?.width) { const zz = 1 + Math.max(0, o.zoom ?? .05), base = o.fit === 'print' ? Math.min(FW / im.width, FH / im.height, (ENG.PRINT_MAG ?? 1.4) / zz) : o.fit === 'contain' ? Math.min(FW / im.width, FH / im.height) : Math.max(FW / im.width, FH / im.height); mag = base * zz; what = `${it.text} (${im.width} x ${im.height})`; } }
    else if (it.mag != null) mag = typeof it.mag === 'function' ? it.mag(t) : it.mag;
    if (mag != null && mag > MAX_MAG) out.push({ type: 'PIXELATED', detail: `${what} is magnified ${mag.toFixed(2)}x on screen at its most zoomed (limit ${MAX_MAG}x): use a higher-resolution source (Wikimedia Commons originals), vector / baked map data (region.py, bake_wide_map.py), or broll(key, { fit: 'print' }) (shown whole at <= 1.4x over a blurred copy).` }); }
  return out; });

// ======================================================================================================================
// LABELS
// ======================================================================================================================
// placeTag(text, { t0, t1, hold = 2.8, x = 150, y = 690, size = 40, roll: { from, to, at, dur }, frame, sub, sound })
//   The place/date label lower-left: bold white with a soft drop shadow, unscrambles in ~0.4 s, fades after `hold` s.
//   roll: a rolling year counter: '{y}' in the text is the number, rolling digit by digit from `from` to `to` at `at`
//   (default t0 + .7) over `dur` (.45 s). frame: thin red lines above and below (hacker handles).
//   It belongs to the moment, not the shot: add the SAME item to the next shot too (S.over(tag) in both) and it carries
//   across the cut without restarting (everything is timed in absolute seconds).
export function placeTag(text, o = {}) {
  const t0 = o.t0 ?? 0, t1 = o.t1 ?? t0 + (o.hold ?? 2.8), size = o.size ?? 40, seed = seedOf(text);
  if (o.sound === true) sfx('typewriter', t0, { gain: -10, dur: .4 });
  const R = o.roll, rollAt = R ? (R.at ?? t0 + .7) : 0, full = String(text).replace('{y}', R ? String(R.to).padStart(String(R.from).length, '0') : '');
  const bw = Math.max(textW(full, CF.h(size)), o.sub ? textW(o.sub, CF.h(Math.round(size * .5), 600)) : 0), bh = size * (o.sub ? 1.75 : 1.2);
  const it = { t0, t1, fin: .12, fout: .5, what: 'place tag', text: String(text).replace('{y}', R ? R.to : ''),
    box(S) { const p = placeOf(it, o, S, bw, bh, SAFE.low); return [p.x, p.y - size * .95, bw, bh]; },
    draw(x, t, a, S) {
    const P = placeOf(it, o, S, bw, bh, SAFE.low), X = P.x, Y = P.y;
    if (o.scrim === true || (o.scrim !== false && P.busy)) scrim(x, [X, Y - size * .95, bw, bh]);
    const k = seg(t, t0, t0 + (o.dur ?? .4));
    let s = String(text), yr = null;
    if (R) { const i = s.indexOf('{y}'); yr = { pre: s.slice(0, i), post: s.slice(i + 3) }; s = yr.pre + String(R.to).padStart(String(R.from).length, '0') + yr.post; }
    const font = CF.h(size);
    if (o.frame) { x.save(); x.font = font; const w = x.measureText(s).width; x.strokeStyle = C.dot; x.lineWidth = 2; x.globalAlpha *= .9;
      const ww = w * E.outCubic(seg(t, t0, t0 + .35)); x.beginPath(); x.moveTo(X - 14, Y - size - 12); x.lineTo(X - 14 + ww + 28, Y - size - 12); x.moveTo(X - 14, Y + 16); x.lineTo(X - 14 + ww + 28, Y + 16); x.stroke(); x.restore(); }
    if (!R || k < 1) { glowText(x, decodeText(s, k, { t, seed }), X, Y, { font }); }
    else {
      // the counter: digits that change roll (old one up and out, new one in from below), each in its own clipped box
      const from = String(R.from), to = String(R.to).padStart(from.length, '0'), rk = E.inOutCubic(seg(t, rollAt, rollAt + (R.dur ?? .45)));
      x.save(); x.font = font; let cx = X; glowText(x, yr.pre, cx, Y, { font }); cx += x.measureText(yr.pre).width;
      for (let i = 0; i < from.length; i++) { const dw = x.measureText(to[i]).width;
        if (from[i] === to[i]) glowText(x, to[i], cx, Y, { font });
        else { x.save(); x.beginPath(); x.rect(cx - 6, Y - size * 1.05, dw + 14, size * 1.35); x.clip(); const off = rk * size * 1.15;
          glowText(x, from[i], cx, Y - off, { font }); glowText(x, to[i], cx, Y - off + size * 1.15, { font }); x.restore(); }
        cx += Math.max(dw, x.measureText(from[i]).width); }
      glowText(x, yr.post, cx, Y, { font }); x.restore();
    }
    if (o.sub) glowText(x, decodeText(o.sub, seg(t, t0 + .15, t0 + .55), { t, seed: seed + 3 }), X + 2, Y + size * .8, { font: CF.h(Math.round(size * .5), 600), blur: 14 });
  } };
  return it;
}
// lowerThird(name, role, { t0, t1, hold = 3, x = 130, y = 690 }) - a person's name on first appearance: name bold white
//   ~48 px with a soft neutral drop shadow, the role ~20 px under it, a faint grid plate with crosshairs; decodes in 0.6 s.
//   Like placeTag, add the same item to the next shot to carry it across a cut.
export function lowerThird(name, role, o = {}) {
  const t0 = o.t0 ?? 0, t1 = o.t1 ?? t0 + (o.hold ?? 3), seed = seedOf(name);
  if (o.sound === true) sfx('blip', t0, { gain: -12 });
  const N0 = String(name).toUpperCase(), R0 = role ? String(role).toUpperCase() : '', PW = Math.max(textW(N0, CF.h(48)), textW(R0, CF.h(20, 600), '3px')) + 70;
  // the plate spans x - 24 .. x - 24 + PW and y - 74 .. y + 44; the anchor is the plate's left edge + 24
  const it = { t0, t1, fin: .1, fout: .4, what: 'lower third', text: role ? `${name} / ${role}` : name,
    box(S) { const p = placeOf(it, o, S, PW, 118, SAFE.low); return [p.x - (p.name === 'manual' ? 24 : 0), p.y - 74, PW, 118]; },
    draw(x, t, a, S) {
    const P = placeOf(it, o, S, PW, 118, SAFE.low), X = P.x + (P.name === 'manual' ? 0 : 24), Y = P.y;
    const k = seg(t, t0, t0 + (o.dur ?? .6)), N = N0, Rl = R0;
    const pw = PW, py = Y - 74, ph = 118, pk = E.outCubic(seg(t, t0, t0 + .35));
    // the plate: faint grid + corner crosshairs
    x.save(); x.beginPath(); x.rect(X - 24, py, pw * pk, ph); x.clip();
    x.fillStyle = 'rgba(10,4,5,.38)'; x.fillRect(X - 24, py, pw, ph); x.strokeStyle = 'rgba(255,255,255,.055)'; x.lineWidth = 1;
    for (let gx = X - 24; gx < X - 24 + pw; gx += 18) { x.beginPath(); x.moveTo(gx + .5, py); x.lineTo(gx + .5, py + ph); x.stroke(); }
    for (let gy = py; gy < py + ph; gy += 18) { x.beginPath(); x.moveTo(X - 24, gy + .5); x.lineTo(X - 24 + pw, gy + .5); x.stroke(); }
    x.strokeStyle = 'rgba(255,255,255,.42)'; x.lineWidth = 1.5;
    for (const [cx, cy] of [[X - 24, py], [X - 24 + pw, py], [X - 24, py + ph], [X - 24 + pw, py + ph]]) { x.beginPath(); x.moveTo(cx - 8, cy); x.lineTo(cx + 8, cy); x.moveTo(cx, cy - 8); x.lineTo(cx, cy + 8); x.stroke(); }
    x.fillStyle = C.dot; x.fillRect(X - 24, py, 4, ph); x.restore();
    glowText(x, decodeText(N, k, { t, seed }), X, Y, { font: CF.h(48), blur: 26 });
    if (Rl) glowText(x, decodeText(Rl, seg(t, t0 + .12, t0 + (o.dur ?? .6) + .12), { t, seed: seed + 1 }), X + 2, Y + 32, { font: CF.h(20, 600), ls: '3px', color: 'rgba(225,231,231,.86)', blur: 12 });
  } };
  return it;
}
// statFloater(value, label, { t0, t1, hold = 2.5, at: [x, y] | fn(S, t) -> [x, y], count: { from, to, dur, fmt }, size, align })
//   a floating number on the spoken word: "$ 1,500,000 / in damages"; count rolls a number up (fmt(n) -> text).
export function statFloater(value, label, o = {}) {
  const t0 = o.t0 ?? 0, t1 = o.t1 ?? t0 + (o.hold ?? 2.5), size = o.size ?? 72, seed = seedOf(String(value) + label);
  if (o.sound === true) sfx('blip', t0, { gain: -10 });
  const fmt = o.count?.fmt ?? (n => Math.round(n).toLocaleString('en-US'));
  // v2.3: no at -> safeSpot (prefer upperRight); at: [x, y] / fn stay manual; at: 'lowerLeft' ... a named SAFE anchor
  const manual = Array.isArray(o.at) || typeof o.at === 'function', final = o.count ? (o.prefix ?? '') + fmt(o.count.to) + (o.suffix ?? '') : String(value);
  const bw = Math.max(textW(final, CF.h(size)), label ? textW(label, CF.h(Math.round(size * .36), 600)) + 4 : 0), bh = size * (label ? 1.25 : .95);
  const po = { at: o.at ?? 'auto', avoid: o.avoid, prefer: o.prefer ?? 'upperRight' };
  const it = { t0, t1, fin: .15, fout: .4, what: 'stat', text: `${value} ${label ?? ''}`.trim(),
    box(S) { if (manual) { if (typeof o.at === 'function') return null; const [X, Y] = o.at, al = o.align ?? 'left'; return [al === 'left' ? X : al === 'right' ? X - bw : X - bw / 2, Y - size * .8, bw, bh]; }
      const p = placeOf(it, po, S, bw, bh, SAFE.high); return [p.x, p.y - size * .8, bw, bh]; },
    draw(x, t, a, S) {
    const P = manual ? null : placeOf(it, po, S, bw, bh, SAFE.high);
    const [X, Y] = typeof o.at === 'function' ? o.at(S, t) : manual ? o.at : [P.x, P.y];
    if (P && (o.scrim === true || (o.scrim !== false && P.busy))) scrim(x, [X, Y - size * .8, bw, bh]);
    let v = String(value);
    if (o.count) v = (o.prefix ?? '') + fmt(lerp(o.count.from, o.count.to, E.outCubic(seg(t, t0, t0 + (o.count.dur ?? 1.2))))) + (o.suffix ?? '');
    else v = decodeText(v, seg(t, t0, t0 + .5), { t, seed });
    const al = o.align ?? 'left', rise = (1 - E.outCubic(seg(t, t0, t0 + .4))) * 16;
    glowText(x, v, X, Y + rise, { font: CF.h(size), align: al, blur: 30 });
    if (label) glowText(x, decodeText(label, seg(t, t0 + .2, t0 + .7), { t, seed: seed + 5 }), X + (al === 'left' ? 4 : 0), Y + rise + size * .62, { font: CF.h(Math.round(size * .36), 600), align: al, color: 'rgba(225,231,231,.88)', blur: 14 });
  } };
  return it;
}
// notice(text, { t0, t1 }): a small neutral top-right label (e.g. 'ARCHIVE FOOTAGE', 'DRAMATISATION'); it sits under the
// RECONSTRUCTION badge. BANNED (no_slop.md): a notice must NEVER say the voice is AI / generated / synthetic - such a text
// is dropped here (nothing is drawn) and logged.
export const AI_VOICE_NOTICE = /\b(ai|a\.i\.|artificial|generated|synthetic|synthesi[sz]ed|computer|clon(ed|e)|tts|text.to.speech)\b[^]*\bvoice|\bvoice\b[^]*\b(ai|a\.i\.|generated|synthetic|synthesi[sz]ed|clon(ed|e))\b/i;
export function notice(text, o = {}) {
  const t0 = o.t0 ?? 0;
  if (AI_VOICE_NOTICE.test(String(text))) {
    console.warn('[no_slop] notice() refused: an AI-voice notice is banned in every style (' + text + ')');
    return { t0, t1: t0, fin: 0, fout: 0, what: 'notice', text: null, draw() {} };
  }
  return { t0, t1: o.t1, fin: o.fin ?? 0, fout: o.fout ?? 0, what: 'notice', text, draw(x) {
    x.save(); x.font = CF.m(16, 700); x.letterSpacing = '3px'; x.textBaseline = 'middle'; const s = String(text).toUpperCase(), w = x.measureText(s).width + 26, X = FW - 46 - w, Y = o.y ?? 82;
    x.fillStyle = 'rgba(0,0,0,.5)'; rr(x, X, Y, w, 32, 2); x.fill(); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1; x.stroke();
    x.fillStyle = 'rgba(235,238,238,.92)'; x.fillText(s, X + 13, Y + 17); x.restore();
  } };
}
// stamp(): REMOVED. Red rubber-stamp / verdict plaques ('FERMÉ', 'LOCKED', 'CASE CLOSED', 'DENIED' ...) are banned in every
// style (no_slop.md, "prohibited, straight slop"). The export stays only so scenes written before the ban still load: it
// draws nothing, plays no sound and logs a warning. Show the fact with real footage/documents and a highlight instead.
export function stamp(text, o = {}) {
  const t0 = o.t0 ?? 0;
  console.warn('[no_slop] stamp() is banned and draws nothing (' + text + ')');
  return { t0, t1: t0, fin: 0, fout: 0, what: 'stamp-banned', text: null, draw() {} };
}
// redact(rect [x, y, w, h] px, { t0, dur = .35 }): a black bar wiping on left to right over a line of text
export function redact(rect, o = {}) {
  const t0 = o.t0 ?? 0;
  return { t0, t1: o.t1, fin: 0, fout: o.fout ?? 0, what: 'redaction', text: null, draw(x, t) {
    const [X, Y, W, H] = rect, k = E.outCubic(seg(t, t0, t0 + (o.dur ?? .35)));
    x.save(); x.fillStyle = o.color ?? '#050505'; x.fillRect(X, Y, W * k, H); x.restore();
  } };
}

// ======================================================================================================================
// FULL-FRAME CARDS (cover: the shot's 3D is not rendered while one fills the frame; use them in shot({ flat: true }))
// ======================================================================================================================
// chapterCard(kicker, title, { t0, t1 = t0 + 4, decode = .75 }): black, the red grid with its glow, three red dots, the
//   kicker ('Chapter 2:') small over the title, both decoding in; it starts and ends on black (fade .35 s each way), so
//   put it in a pause of the narration, after a 'black' transition.
export function chapterCard(kicker, title, o = {}) {
  const t0 = o.t0 ?? 0, t1 = o.t1 ?? t0 + 4, seed = seedOf(title);
  if (o.sound === true) sfx('boom', t0 + .15, { gain: -6 });
  return { t0, t1, fin: 0, fout: 0, cover: true, what: 'chapter card', text: `${kicker} ${title}`, draw(x, t) {
    const k = Math.min(E.inOut(seg(t, t0, t0 + .35)), 1 - E.inOut(seg(t, t1 - .4, t1)));
    x.save(); x.fillStyle = '#000'; x.fillRect(0, 0, FW, FH); x.globalAlpha *= k; redGrid(x); redDots(x);
    const d = o.decode ?? .75, ky = FH * .43;
    glowText(x, decodeText(String(kicker), seg(t, t0 + .2, t0 + .2 + d * .8), { t, seed }), FW / 2, ky, { font: CF.h(30, 600), align: 'center', ls: '2px', color: 'rgba(225,231,231,.9)', blur: 16 });
    glowText(x, decodeText(String(title), seg(t, t0 + .3, t0 + .3 + d), { t, seed: seed + 1 }), FW / 2, ky + 92, { font: CF.h(o.size ?? 84), align: 'center', blur: 34 });
    x.restore();
  } };
}
// titleCard(title, { kicker, t0, t1 = t0 + 6, size }): the film's title: black with a dark-red background glow and a faint dot grid (the title text: soft neutral shadow only),
//   thin circuit lines growing in from the edges, the small kicker ('a film by ...') then the title; leaves with a 0.5 s
//   red block glitch.
export function titleCard(title, o = {}) {
  const t0 = o.t0 ?? 0, t1 = o.t1 ?? t0 + 6, seed = seedOf(title);
  if (o.sound === true) { sfx('boom', t0 + .5, { gain: -4 }); sfx('glitch', t1 - .5, { gain: -8, dur: .5 }); }
  // circuit traces: from the frame edges inward, 90/45 degree turns, seeded
  const traces = [];
  for (let i = 0; i < 16; i++) { const side = i % 4, r = j => hh(seed + i * 17, j);
    let X = side === 0 ? 0 : side === 1 ? FW : r(1) * FW, Y = side === 2 ? 0 : side === 3 ? FH : r(2) * FH; const pts = [[X, Y]];
    let dx = side === 0 ? 1 : side === 1 ? -1 : 0, dy = side === 2 ? 1 : side === 3 ? -1 : 0;
    for (let s = 0; s < 4; s++) { const L = 60 + r(10 + s) * 220; X += dx * L; Y += dy * L; pts.push([X, Y]);
      const turn = r(20 + s); if (turn < .4) { const ndx = dx === 0 ? (r(30 + s) < .5 ? 1 : -1) * .7071 : dx * .7071, ndy = dy === 0 ? (r(31 + s) < .5 ? 1 : -1) * .7071 : dy * .7071; dx = ndx; dy = ndy; }
      else if (turn < .7) { dx = Math.sign(dx) || 0; dy = Math.sign(dy) || 0; } }
    traces.push({ pts, d: r(40) * .6 }); }
  const [Q, q] = mkc();
  return { t0, t1, fin: 0, fout: 0, cover: true, what: 'title card', text: o.kicker ? `${o.kicker} / ${title}` : title, draw(x, t) {
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.globalCompositeOperation = 'source-over';
    q.fillStyle = '#000'; q.fillRect(0, 0, FW, FH);
    const g = q.createRadialGradient(FW / 2, FH / 2, 0, FW / 2, FH / 2, FW * .5); g.addColorStop(0, 'rgba(70,0,10,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = g; q.fillRect(0, 0, FW, FH);
    dotGrid(q, E.inOut(seg(t, t0, t0 + .8)));
    q.save(); q.strokeStyle = 'rgba(255,190,200,.38)'; q.lineWidth = 1.5; q.shadowColor = 'rgba(255,60,80,.8)'; q.shadowBlur = 8;
    for (const tr of traces) { const k = E.outCubic(seg(t, t0 + .2 + tr.d, t0 + 1.8 + tr.d)); if (k <= 0) continue;
      let L = 0; for (let i = 1; i < tr.pts.length; i++) L += Math.hypot(tr.pts[i][0] - tr.pts[i - 1][0], tr.pts[i][1] - tr.pts[i - 1][1]);
      let rem = L * k; q.beginPath(); q.moveTo(...tr.pts[0]); let e = tr.pts[0];
      for (let i = 1; i < tr.pts.length && rem > 0; i++) { const a = tr.pts[i - 1], b = tr.pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]), f = Math.min(1, rem / d); e = [lerp(a[0], b[0], f), lerp(a[1], b[1], f)]; q.lineTo(...e); rem -= d; }
      q.stroke(); if (k >= 1) { q.fillStyle = 'rgba(255,200,210,.8)'; q.beginPath(); q.arc(e[0], e[1], 3.5, 0, 7); q.fill(); } }
    q.restore();
    if (o.kicker) glowText(q, String(o.kicker), FW / 2, FH / 2 - (o.size ?? 104) * .78, { font: CF.h(22, 600), align: 'center', ls: '6px', color: 'rgba(225,231,231,.75)', glow: null });
    q.save(); q.globalAlpha = E.inOut(seg(t, t0 + .9, t0 + 1.6));
    glowText(q, String(title), FW / 2, FH / 2 + (o.size ?? 104) * .36, { font: CF.h(o.size ?? 104), align: 'center', blur: 40 }); q.restore();
    // exit: the last .5 s, red blocks and torn slices
    const ge = seg(t, t1 - .5, t1);
    if (ge > 0) { const f = frameOf(t);
      for (let n = 0; n < 6 + ge * 30; n++) { const r = j => hh(seed + f * 31 + n, j), y = r(1) * FH, hgt = 6 + r(2) * 90, dx = (r(3) - .5) * 300 * ge;
        q.drawImage(Q, 0, y, FW, hgt, dx, y, FW, hgt); q.fillStyle = r(4) < .5 ? `rgba(200,0,20,${.5 + r(5) * .5})` : `rgba(0,0,0,${.6 + r(6) * .4})`; q.fillRect(r(7) * FW, r(8) * FH, 40 + r(9) * 500 * ge, 8 + r(10) * 60); }
      if (ge > .85) { q.fillStyle = '#000'; q.fillRect(0, 0, FW, FH); } }
    x.drawImage(Q, 0, 0);
  } };
}
// quoteCard({ speaker, text, words: [{ w, t0, t1 }], photo, censor, env, t0, t1, x, y, w, size, lines })
//   An interviewee's voice: a blurred, darkened red-duotone still drifting slowly (photo = an IMG key; none = the red grid),
//   the speaker's name bold white, the words typing on in white italic word by word on their timings (words: the voice's
//   word timings, e.g. from audio/timeline.json; without them the text types at ~2.9 words/s from t0 + .3), a new page when
//   the block is full or a word has p: true (a new thought), censor: words (or word indices) pixel-blurred, and a crimson
//   waveform that moves only while someone speaks (env(t) -> 0-1, or from the word timings). Leaves with a 5-frame glitch.
const QBG = new Map();
function quoteBg(key) {
  if (QBG.has(key)) return QBG.get(key);
  const im = IMG[key]; if (!im) return null;
  const [c, x] = mkc(), s = Math.max(FW / im.width, FH / im.height) * 1.12, w = im.width * s, h = im.height * s;
  x.filter = 'grayscale(1) contrast(1.15) blur(18px)'; x.drawImage(im, (FW - w) / 2, (FH - h) / 2, w, h); x.filter = 'none';
  x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgb(120,44,46)'; x.fillRect(0, 0, FW, FH);
  x.globalCompositeOperation = 'source-over'; x.fillStyle = 'rgba(8,2,3,.38)'; x.fillRect(0, 0, FW, FH);
  vignette(x, .8); QBG.set(key, c); return c;
}
export function quoteCard(o = {}) {
  const t0 = o.t0 ?? 0, size = o.size ?? 36, X = o.x ?? 545, Y = o.y ?? 260, BW = o.w ?? 830, maxLines = o.lines ?? 6, lh = size * 1.38;
  let words = o.words?.length ? o.words.map(w => ({ ...w, w: w.w ?? w.word })) : String(o.text ?? '').split(/\s+/).filter(Boolean).map((w, i) => ({ w, t0: t0 + .3 + i * .345, t1: t0 + .3 + i * .345 + .3 }));
  const t1 = o.t1 ?? (words.length ? words[words.length - 1].t1 + 1.2 : t0 + 4);
  const cen = new Set((o.censor || []).map(c => typeof c === 'number' ? c : String(c).toLowerCase()));
  // layout once: pages of lines of words (positions measured with the real font, so the text never reflows while typing)
  const [, mx] = mkc(1, 1); mx.font = CF.i(size, 600);
  const pages = []; let page = null, line = 0, cx = 0;
  words.forEach((w, i) => { const ww = mx.measureText(w.w).width, sp = mx.measureText(' ').width;
    if (!page || w.p || (cx + ww > BW && line + 1 >= maxLines)) { page = { from: w.t0, words: [] }; pages.push(page); line = 0; cx = 0; }
    else if (cx + ww > BW) { line++; cx = 0; }
    page.words.push({ ...w, i, x: cx, line, ww, cens: cen.has(i) || cen.has(String(w.w).toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')) }); cx += ww + sp; });
  const [Q, q] = mkc(), [P, p] = mkc(256, 64), [S2, s2] = mkc(8, 8), seed = seedOf(o.speaker ?? 'q');
  const amp = t => { if (o.env) return clamp(o.env(t)); let a = 0; for (const w of words) { if (t < w.t0 - .05 || t > w.t1 + .12) continue; a = Math.max(a, Math.min(1, (t - w.t0 + .05) / .07, (w.t1 + .12 - t) / .12)); } return a; };
  return { t0, t1, fin: 0, fout: 0, cover: true, what: 'quote card', text: `${o.speaker ? o.speaker + ': ' : ''}${words.map(w => w.w).join(' ')}`, draw(x, t) {
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.globalCompositeOperation = 'source-over';
    const bg = o.photo ? quoteBg(o.photo) : null;
    if (bg) { const k = seg(t, t0, t1), s = 1 + .04 * k; q.fillStyle = '#000'; q.fillRect(0, 0, FW, FH); q.save(); q.translate(FW / 2 - 30 * k, FH / 2); q.scale(s, s); q.drawImage(bg, -FW / 2, -FH / 2); q.restore(); }
    else { redGrid(q); redDots(q); }
    if (o.speaker) glowText(q, decodeText(String(o.speaker), seg(t, t0, t0 + .5), { t, seed }), X, Y, { font: CF.h(40), blur: 18 });
    let pg = pages[0]; for (const pp of pages) if (t >= pp.from - .02) pg = pp;
    if (pg) for (const w of pg.words) { if (t < w.t0 - .02) continue; const a = clamp((t - w.t0 + .02) / .08), wx = X + w.x, wy = Y + 70 + w.line * lh;
      q.save(); q.globalAlpha = a; q.font = CF.i(size, 600); q.fillStyle = 'rgba(240,240,240,.94)';
      if (!w.cens) q.fillText(w.w, wx, wy);
      else {                                                             // pixel blur: the word drawn small, then blown up blocky
        const bw = Math.ceil(w.ww + 8), bh = Math.ceil(size * 1.45); P.width = bw; P.height = bh; p.font = CF.i(size, 600); p.fillStyle = 'rgba(240,240,240,.94)'; p.fillText(w.w, 4, size * 1.05);
        S2.width = Math.max(2, Math.round(bw / 11)); S2.height = Math.max(2, Math.round(bh / 11)); s2.imageSmoothingEnabled = true; s2.drawImage(P, 0, 0, S2.width, S2.height);
        q.imageSmoothingEnabled = false; q.drawImage(S2, 0, 0, S2.width, S2.height, wx - 4, wy - size * 1.05, bw, bh); q.imageSmoothingEnabled = true; }
      q.restore(); }
    // waveform: crimson line with a glow, centred at 81 % height, moving only with the voice
    const A = amp(t), wy = FH * .81, x0 = 490, x1 = 1385, f = frameOf(t);
    q.save(); q.lineWidth = 3; q.strokeStyle = C.wave; q.shadowColor = '#a0103f'; q.shadowBlur = 16; q.beginPath();
    for (let i = 0; i <= 220; i++) { const u = i / 220, X2 = lerp(x0, x1, u), win = Math.sin(Math.PI * u) ** 1.5;
      const v = Math.sin(u * 38 + f * .9) * .55 + Math.sin(u * 91 - f * 1.7) * .3 + (hh(seed + i, f) - .5) * .7;
      const yy = wy + v * win * A * 46; i ? q.lineTo(X2, yy) : q.moveTo(X2, yy); }
    q.stroke(); q.restore();
    // exit glitch: 5 frames of colour split and torn slices
    const ge = seg(t, t1 - 5 / 30, t1);
    if (ge > 0) { x.save(); x.globalCompositeOperation = 'source-over'; x.drawImage(Q, 0, 0); x.globalCompositeOperation = 'lighter'; x.globalAlpha = .55;
      x.drawImage(Q, 18 + ge * 40, 0); x.globalAlpha = .45; x.drawImage(Q, -14 - ge * 30, 0); x.restore();
      for (let n = 0; n < 14; n++) { const r = j => hh(seed + f * 13 + n, j), yy = r(1) * FH, hgt = 4 + r(2) * 60; x.drawImage(Q, 0, yy, FW, hgt, (r(3) - .5) * 280, yy, FW, hgt); }
    } else x.drawImage(Q, 0, 0);
  } };
}

// ======================================================================================================================
// DOCUMENTS: one layout for 2D cards (headlineCard) and 3D evidence (crime.js evidence()): word boxes are recorded so a
// highlight, an ellipse or a redaction can be put on a phrase by its words.
// ======================================================================================================================
// makeDoc(spec) -> doc { w, h, boxes, find(phrase | [x, y, w, h]) -> rects, highlight(), ellipse(), redact(), paint(ctx, t), key(t) }
// spec.kind:
//   'headline'  { outlet, kicker, headline, standfirst, body: [paragraphs], date, photo }   a news page (italic heavy headline)
//   'document'  { title, meta: [lines], body: [paragraphs], footer, seal }                 a serif printed page (court papers)
//   'tweet'     { name, handle, text, date, avatar (IMG key), stats }                       a social post
//   'card'      { title, fields: [[label, value]], photo, note }                           an index card / police file
//   'letter'    { date, text, signature }                                                   a letter (italic serif)
//   'canvas'    { draw(ctx, L) } (= evidence.fromCanvas): draw anything; L.text(str, x, y, { font, color, maxW, lh, align })
//               draws text AND records its word boxes; L.w, L.h the page size
// spec.w / spec.h: the page in px (defaults per kind); spec.paper: false = no paper fill (2D cards draw their own).
const DEF = { headline: [1600, 1000], document: [1500, 1940], tweet: [1400, 760], card: [1500, 900], letter: [1500, 1940], canvas: [1600, 1000] };
const normW = s => String(s).toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}']/gu, '');
export function makeDoc(spec) {
  const [dw, dh] = DEF[spec.kind] || DEF.canvas, W = spec.w ?? dw, H = spec.h ?? dh;
  const doc = { w: W, h: H, boxes: [], marks: [], spec };
  let recording = true;
  const L = { w: W, h: H,
    text(str, X, Y, o = {}) {        // draws + records; Y = the top of the block; wraps at maxW; returns the y under the block
      const x = L.ctx; x.save(); x.font = o.font ?? CF.serif(30); x.fillStyle = o.color ?? '#222'; x.textBaseline = 'alphabetic'; x.letterSpacing = o.ls ?? '0px';
      const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(x.font)?.[1] ?? 30), lh = o.lh ?? size * 1.32, maxW = o.maxW ?? W - X - 60, sp = x.measureText(' ').width;
      const words = String(str).split(/\s+/).filter(Boolean); let cx = 0, y = Y + size * .86 + (lh - size * 1.1) / 2, line = [];
      const flush = (last) => { let off = 0; const lw = line.length ? line[line.length - 1].x + line[line.length - 1].w : 0;
        if (o.align === 'center') off = (maxW - lw) / 2; else if (o.align === 'right') off = maxW - lw;
        for (const b of line) { x.fillText(b.s, X + off + b.x, y); if (recording) doc.boxes.push({ s: b.s, n: normW(b.s), x: X + off + b.x, y: y - size * .82, w: b.w, h: size * 1.08, size }); }
        line = []; cx = 0; if (!last) y += lh; };
      for (const w of words) { const ww = x.measureText(w).width; if (cx + ww > maxW && line.length) flush(false); line.push({ s: w, x: cx, w: ww }); cx += ww + sp; }
      flush(true); x.restore(); return y - size * .86 - (lh - size * 1.1) / 2 + lh;
    } };
  const fake = (x, X, Y, w, n, lh, col = 'rgba(40,40,40,.32)', seed = 1) => { x.fillStyle = col; for (let i = 0; i < n; i++) { const ww = i === n - 1 ? w * (.35 + hh(seed, i) * .4) : w * (.86 + hh(seed, i) * .14); x.fillRect(X, Y + i * lh, ww, lh * .34); } };
  const paper = (x) => { if (spec.paper === false) return; const g = x.createRadialGradient(W * .5, H * .45, 0, W * .5, H * .5, Math.max(W, H) * .75); g.addColorStop(0, spec.paperColor ?? '#e9e7e1'); g.addColorStop(1, spec.paperEdge ?? '#c9c6be'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.globalAlpha = .05; for (let i = 0; i < 900; i++) { x.fillStyle = hh(i, 9) < .5 ? '#000' : '#fff'; x.fillRect(hh(i, 7) * W, hh(i, 8) * H, 2, 2); } x.globalAlpha = 1; };
  const photoIn = (x, key, X, Y, w, h, gray = true) => { const im = IMG[key]; if (!im) { x.fillStyle = '#777'; x.fillRect(X, Y, w, h); return; }
    const s = Math.max(w / im.width, h / im.height), sw = w / s, sh = h / s; x.save(); if (gray) x.filter = 'grayscale(1) contrast(1.05)'; x.drawImage(im, (im.width - sw) / 2, (im.height - sh) * .3, sw, sh, X, Y, w, h); x.restore(); };
  const paints = {
    headline(x) { paper(x); const P = 90; let y = spec.top ?? 70;
      if (spec.outlet) { y = L.text(String(spec.outlet).toUpperCase(), P, y, { font: CF.serif(40, 700), color: '#1b1b1b', ls: '6px', lh: 52 }); x.fillStyle = '#1b1b1b'; x.fillRect(P, y + 4, W - P * 2, 3); y += 40; }
      if (spec.kicker) y = L.text(String(spec.kicker).toUpperCase(), P, y, { font: CF.h(24, 800), color: C.type, ls: '2px', lh: 40 }) + 8;
      y = L.text(spec.headline ?? '', P, y, { font: CF.i(spec.size ?? 74, 800), color: C.type, lh: (spec.size ?? 74) * 1.1, maxW: W - P * 2 }) + 18;
      if (spec.standfirst) y = L.text(spec.standfirst, P, y, { font: CF.i(32, 600), color: '#4a4a4a', lh: 44, maxW: W - P * 2 - 120 }) + 10;
      if (spec.date) y = L.text(spec.date, P, y, { font: CF.m(22), color: '#666', lh: 34 }) + 10;
      for (const para of spec.body || []) y = L.text(para, P, y + 8, { font: CF.serif(30), color: '#2a2a2a', lh: 44, maxW: W - P * 2 });
      if (!spec.body && spec.paper !== false) fake(x, P, y + 20, W - P * 2, Math.max(0, Math.floor((H - y - 60) / 44)), 44, 'rgba(40,40,40,.28)', 3);
    },
    document(x) { paper(x); const P = 150; let y = 200;
      if (spec.seal) { x.save(); x.strokeStyle = '#555'; x.lineWidth = 4; x.beginPath(); x.arc(W / 2, 150, 70, 0, 7); x.stroke(); x.beginPath(); x.arc(W / 2, 150, 54, 0, 7); x.stroke(); x.font = CF.serif(20, 700); x.fillStyle = '#555'; x.textAlign = 'center'; x.fillText(String(spec.seal).toUpperCase(), W / 2, 157); x.restore(); y = 290; }
      if (spec.title) y = L.text(String(spec.title).toUpperCase(), P, y, { font: CF.serif(44, 700), color: '#151515', align: 'center', maxW: W - P * 2, lh: 56 }) + 20;
      for (const m of spec.meta || []) y = L.text(m, P, y, { font: CF.serif(28), color: '#333', lh: 38, maxW: W - P * 2 });
      if (spec.meta) { x.fillStyle = '#333'; x.fillRect(P, y, W - P * 2, 2); y += 60; }
      for (const para of spec.body || []) y = L.text(para, P, y, { font: CF.serif(33), color: '#1f1f1f', lh: 52, maxW: W - P * 2 }) + 18;
      if (spec.footer) L.text(spec.footer, P, H - 120, { font: CF.serif(24, 400, true), color: '#555', lh: 32, maxW: W - P * 2 });
    },
    tweet(x) { if (spec.paper !== false) { x.fillStyle = spec.dark ? '#15181c' : '#f4f5f6'; x.fillRect(0, 0, W, H); }
      const ink = spec.dark ? '#e7e9ea' : '#0f1419', sub = spec.dark ? '#71767b' : '#536471', P = 80; let y = 90;
      x.save(); x.beginPath(); x.arc(P + 50, y + 50, 50, 0, 7); x.clip(); if (spec.avatar) photoIn(x, spec.avatar, P, y, 100, 100, false); else { x.fillStyle = '#566'; x.fillRect(P, y, 100, 100); } x.restore();
      L.text(spec.name ?? 'Name', P + 130, y + 6, { font: CF.h(38, 800), color: ink, lh: 46 }); L.text(spec.handle ?? '@handle', P + 130, y + 56, { font: CF.h(32, 600), color: sub, lh: 40 });
      y = L.text(spec.text ?? '', P, y + 146, { font: CF.h(46, 600), color: ink, lh: 62, maxW: W - P * 2 }) + 16;
      if (spec.date) y = L.text(spec.date, P, y, { font: CF.h(30, 600), color: sub, lh: 40 }) + 24;
      x.fillStyle = sub; x.globalAlpha = .4; x.fillRect(P, y, W - P * 2, 2); x.globalAlpha = 1;
      if (spec.stats) L.text(spec.stats, P, y + 26, { font: CF.h(30, 600), color: sub, lh: 40 });
    },
    card(x) { paper(x); const P = 70; x.fillStyle = '#b8323a'; x.globalAlpha = .7; x.fillRect(0, 150, W, 4); x.globalAlpha = .25; x.fillStyle = '#3a6ea8';
      for (let ly = 210; ly < H; ly += 62) x.fillRect(0, ly, W, 2); x.globalAlpha = 1;
      if (spec.title) L.text(String(spec.title).toUpperCase(), P, 80, { font: CF.m(46, 700), color: '#1a1a1a', ls: '3px', lh: 54 });
      const px = spec.photo ? W - P - 360 : W; if (spec.photo) { photoIn(x, spec.photo, px, 200, 360, 460); x.strokeStyle = '#222'; x.lineWidth = 3; x.strokeRect(px, 200, 360, 460); }
      let y = 218; for (const [k, v] of spec.fields || []) { L.text(String(k).toUpperCase() + ':', P, y, { font: CF.m(30, 700), color: '#333', lh: 62 }); L.text(String(v), P + 300, y, { font: CF.m(34), color: '#111', lh: 62, maxW: px - P - 330 }); y += 62; }
      if (spec.note) L.text(spec.note, P, y + 40, { font: CF.serif(34, 400, true), color: '#2b3f7a', lh: 46, maxW: px - P - 40 });
    },
    letter(x) { paper(x); const P = 170; let y = 230;
      if (spec.date) y = L.text(spec.date, P, y, { font: CF.serif(34, 400, true), color: '#2a2f45', align: 'right', maxW: W - P * 2, lh: 50 }) + 40;
      y = L.text(spec.text ?? '', P, y, { font: CF.serif(44, 400, true), color: '#232a44', lh: 72, maxW: W - P * 2 }) + 60;
      if (spec.signature) L.text(spec.signature, W - P - 520, y, { font: CF.serif(64, 700, true), color: '#1d2440', lh: 80, maxW: 520 });
    },
    canvas(x) { if (spec.paper !== false && spec.paperFill !== false) paper(x); spec.draw?.(x, L); },
  };
  const P = paints[spec.kind] || paints.canvas;
  // marks: highlighter (multiplied under the ink), hand-drawn crimson ellipse, black redaction bar
  const rectsOf = (what) => Array.isArray(what) && typeof what[0] === 'number' ? [{ x: what[0], y: what[1], w: what[2], h: what[3] }] : doc.find(what);
  doc.find = (phrase) => {
    const want = String(phrase).split(/\s+/).map(normW).filter(Boolean), B = doc.boxes, out = [];
    for (let i = 0; i + want.length <= B.length; i++) { if (!want.every((w, k) => B[i + k].n === w || (k === want.length - 1 && B[i + k].n.startsWith(w)))) continue;
      for (let k = 0; k < want.length; k++) { const b = B[i + k], last = out[out.length - 1];
        if (last && Math.abs(last.y - b.y) < b.h * .5 && b.x - (last.x + last.w) < b.size) { last.w = b.x + b.w - last.x; } else out.push({ x: b.x, y: b.y, w: b.w, h: b.h }); }
      return out; }
    console.warn('makeDoc: phrase not found', phrase); return [];
  };
  doc.highlight = (what, o = {}) => { const m = { type: 'hl', what, t0: o.t0 ?? 0, dur: o.dur ?? .7, color: o.color ?? C.hl, on: o.on }; doc.marks.push(m); return m; };
  doc.ellipse = (what, o = {}) => { const m = { type: 'ell', what, t0: o.t0 ?? 0, dur: o.dur ?? .45, color: o.color ?? '#d0284a', width: o.width ?? 9, pad: o.pad ?? 18 }; doc.marks.push(m); return m; };
  doc.redact = (what, o = {}) => { const m = { type: 'red', what, t0: o.t0 ?? 0, dur: o.dur ?? .3 }; doc.marks.push(m); return m; };
  // the marks' progress at t, quantised to frames: the 3D texture is redrawn only when this changes
  doc.key = t => doc.marks.map(m => Math.round(clamp((t - m.t0) / m.dur) * 60)).join(',');
  doc.paint = (x, t = 1e9) => {
    L.ctx = x; x.save(); P(x); x.restore(); recording = false;
    for (const m of doc.marks) { const k = m.on ? 1 : clamp((t - m.t0) / m.dur); if (k <= 0) continue; const R = (m.rects ??= rectsOf(m.what)); if (!R.length) continue;
      if (m.type === 'hl') {                                                  // wipe L->R across the lines in order, rough edges
        const tot = R.reduce((s, r) => s + r.w + 20, 0); let rem = tot * E.inOutSine(k);
        x.save(); x.globalCompositeOperation = 'multiply'; x.fillStyle = m.color; x.globalAlpha = .9;
        R.forEach((r, ri) => { if (rem <= 0) return; const w = Math.min(r.w + 20, rem); rem -= r.w + 20; const X0 = r.x - 10, Y0 = r.y - r.h * .06, Hh = r.h * 1.1, sd = ri * 97;
          x.beginPath(); x.moveTo(X0 + 6, Y0 + (hh(sd, 1) - .5) * 4);
          for (let s = 1; s <= 8; s++) x.lineTo(X0 + w * s / 8, Y0 + (hh(sd, s + 1) - .5) * 5);
          x.quadraticCurveTo(X0 + w + 7, Y0 + Hh / 2, X0 + w, Y0 + Hh + (hh(sd, 20) - .5) * 4);
          for (let s = 7; s >= 0; s--) x.lineTo(X0 + w * s / 8 + (s === 0 ? 6 : 0), Y0 + Hh + (hh(sd, s + 30) - .5) * 5);
          x.quadraticCurveTo(X0 - 6, Y0 + Hh / 2, X0 + 6, Y0); x.fill(); });
        x.restore();
      } else if (m.type === 'ell') {
        const x0 = Math.min(...R.map(r => r.x)), y0 = Math.min(...R.map(r => r.y)), x1 = Math.max(...R.map(r => r.x + r.w)), y1 = Math.max(...R.map(r => r.y + r.h));
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2 + m.pad * 1.6, ry = (y1 - y0) / 2 + m.pad, sd = Math.round(cx);
        x.save(); x.strokeStyle = m.color; x.lineWidth = m.width; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath();
        const a0 = -1.9, span = Math.PI * 2 * 1.12 * E.outCubic(k);
        for (let s = 0; s <= 90; s++) { const a = a0 + span * s / 90, wob = 1 + .05 * Math.sin(a * 2 + hh(sd, 1) * 6) + .03 * (s / 90), px = cx + Math.cos(a) * rx * wob, py = cy + Math.sin(a) * ry * wob * (1 + .04 * s / 90);
          s ? x.lineTo(px, py) : x.moveTo(px, py); }
        x.stroke(); x.restore();
      } else if (m.type === 'red') { x.save(); x.fillStyle = '#0b0b0b'; for (const r of R) x.fillRect(r.x - 6, r.y - 2, (r.w + 12) * E.outCubic(k), r.h + 4); x.restore(); }
    }
  };
  // record the word boxes now (the first paint), so find() works before anything is drawn
  { const [c] = mkc(W, H); doc.paint(c.getContext('2d'), -1e9); }
  return doc;
}

// headlineCard({ kicker, headline, standfirst, outlet, date, body, highlights: [{ text, t0, dur }], ellipses: [{ text, t0 }],
//   t0, t1, push = .06, punch: { t, to = 2.2, on: 'phrase' | [fx, fy] }, doc })
//   A press headline recreated on the grey paper gradient (#C8CBCB centre -> #8E9090 edges, heavy vignette, capped
//   highlights): kicker, italic heavy charcoal headline left-aligned, italic standfirst; the highlighter wipes L->R on the
//   spoken word (t0 = the word's cue); a slow push-in and an optional hard punch-in (~2.2x) on the emphasis.
export function headlineCard(o = {}) {
  const t0 = o.t0 ?? 0, t1 = o.t1 ?? t0 + 5;
  const doc = o.doc ?? makeDoc({ kind: 'headline', paper: false, w: 1740, h: 980, outlet: o.outlet, kicker: o.kicker, headline: o.headline, standfirst: o.standfirst, date: o.date, body: o.body, size: o.size });
  for (const h of o.highlights || []) doc.highlight(h.text, { t0: h.t0, dur: h.dur ?? .7, color: h.color ?? C.hl2 });
  for (const e of o.ellipses || []) doc.ellipse(e.text, { t0: e.t0, dur: e.dur });
  if (o.sound === true) { sfx('paper', t0, { gain: -8 }); for (const h of o.highlights || []) sfx('marker', h.t0, { gain: -14, dur: h.dur ?? .7 }); }
  // the text block centred on the frame (o.y: the page's top in px instead)
  const B = doc.boxes, y0 = B.length ? Math.min(...B.map(b => b.y)) : 0, y1 = B.length ? Math.max(...B.map(b => b.y + b.h)) : doc.h;
  const [Q, q] = mkc(doc.w, doc.h), oy = o.y ?? Math.round(FH / 2 - (y0 + y1) / 2 - 10), ox = o.x ?? 0;
  let focus = [.5, .5];
  if (o.punch?.on) { const R = Array.isArray(o.punch.on) ? null : doc.find(o.punch.on); if (R?.length) { const r = R[0]; focus = [(ox + r.x + r.w / 2) / FW, (oy + r.y + r.h / 2) / FH]; } else if (Array.isArray(o.punch.on)) focus = o.punch.on; }
  return { t0, t1, fin: 0, fout: 0, cover: true, what: 'headline card', text: [o.kicker, o.headline, o.standfirst].filter(Boolean).join(' / '), draw(x, t) {
    x.save(); const g = x.createRadialGradient(FW * .5, FH * .48, 0, FW * .5, FH * .5, FW * .62); g.addColorStop(0, C.paper); g.addColorStop(1, C.paper2); x.fillStyle = g; x.fillRect(0, 0, FW, FH);
    const push = 1 + (o.push ?? .06) * E.inOutSine(seg(t, t0, t1)), pk = o.punch && t >= o.punch.t ? (o.punch.to ?? 2.2) : 1, s = push * pk;
    const [fx, fy] = pk > 1 ? focus : [.5, .5];
    x.translate(fx * FW, fy * FH); x.scale(s, s); x.translate(-fx * FW, -fy * FH);
    q.setTransform(1, 0, 0, 1, 0, 0); q.clearRect(0, 0, doc.w, doc.h); doc.paint(q, t);
    x.drawImage(Q, ox, oy); x.restore();
    x.save(); x.fillStyle = 'rgba(30,30,30,.06)'; x.fillRect(0, 0, FW, FH); vignette(x, .62); x.restore();
  } };
}

// creditsPanel(lines, { t0, dur = 10, x = 45, y = 55, w = 265, h = 710 }): the end credits as a translucent grey panel with a
//   dashed white border on the left, scrolling up over the film. lines: strings, or groups [heading, name, name, ...].
export function creditsPanel(lines, o = {}) {
  const t0 = o.t0 ?? 0, dur = o.dur ?? 10, X = o.x ?? 45, Y = o.y ?? 55, W = o.w ?? 265, H = o.h ?? 710;
  const rows = []; for (const l of lines) { if (Array.isArray(l)) { rows.push({ h: true, s: l[0] }); for (const n of l.slice(1)) rows.push({ s: n }); rows.push({ s: '' }); } else rows.push({ s: l }); }
  const total = rows.reduce((s, r) => s + (r.h ? 30 : 28), 0);
  return { t0, t1: o.t1 ?? t0 + dur, fin: .5, fout: .5, what: 'credits', text: rows.map(r => r.s).filter(Boolean).join(', '), draw(x, t) {
    x.save(); x.fillStyle = 'rgba(70,72,76,.42)'; x.fillRect(X, Y, W, H); x.setLineDash([7, 6]); x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1.5; x.strokeRect(X + .5, Y + .5, W - 1, H - 1); x.setLineDash([]);
    x.beginPath(); x.rect(X + 2, Y + 2, W - 4, H - 4); x.clip();
    let y = Y + H + 20 - (H + total + 40) * seg(t, t0, t0 + dur);
    for (const r of rows) { if (r.h) { x.font = CF.m(13, 700); x.letterSpacing = '2px'; x.fillStyle = 'rgba(200,205,207,.8)'; x.fillText(String(r.s).toUpperCase(), X + 20, y + 18); y += 30; }
      else { x.font = CF.h(19, 600); x.letterSpacing = '0px'; x.fillStyle = 'rgba(240,242,242,.95)'; x.fillText(r.s, X + 20, y + 18); y += 28; } }
    x.restore();
  } };
}
