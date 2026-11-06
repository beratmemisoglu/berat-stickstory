// The 2D layer on top of the 3D picture: captions (per look), number callouts, 8-bit banners, pixel labels, game-UI panels,
// stamps, arrows, CCTV / LIVE / phone overlays, counters. Drawn on a full-size canvas each frame; the final pass gives it
// a light colour fringe like the rest of the picture.
import { SETTINGS, MOODY, VERT, FW, FH, C, BRAND, clamp, seg, E, lerp, pixelText, pixelWidth, fmt } from './core.js';

export const F = { h: (s, w = 800) => `${w} ${Math.round(s)}px Inter, Arial, sans-serif` };
export const FONT_FILES = [['Inter', 'fonts/inter-800.woff2', '800', 'normal'], ['Inter', 'fonts/inter-600.woff2', '600', 'normal']];
export const COLORS = { green: C.money, red: C.loss, yellow: '#ffd21a', white: '#ffffff', blue: '#3aa0ff', orange: '#ff8a1c', pink: '#ff4fa3', cyan: '#3ff0ff', brand: BRAND.color };
const col = c => COLORS[c] || c || '#ffffff';
const K = Math.min(FW, FH) / 1080;                                     // text sizes are written for a 1080-wide 9:16 frame (16:9: the same px on its 1080 height)
const KX = FW / 1080, KY = FH / 1920;                                   // positions in px are written for 1080 x 1920: 16:9 maps them proportionally
// (16:9 once used K = 1920 / 1080 for sizes AND positions: panels written at y 470 landed on the caption, pixel titles 1.8x too big)

// ---------- captions ----------
// Chunks of 2-4 (bright) / 2-5 (moody) words, hard swaps, one line; break at a pause or punctuation.
export function chunkWords(words, style = SETTINGS.captions?.style) {
  const max = style === 'moody' ? 5 : 4, maxCh = (style === 'moody' ? 24 : 26) * (VERT ? 1 : 1.5), out = []; let cur = null;
  words.forEach(w => {
    const prev = cur?.words[cur.words.length - 1], len = cur ? cur.text.length + 1 + w.w.length : 0;
    const brk = !cur || cur.words.length >= max || len > maxCh || w.s - prev.e > .28 || /[.,?!;:]$/.test(prev.w) && cur.words.length >= 2 || /[.?!]$/.test(prev.w);
    if (brk) { cur = { s: w.s, e: w.e, words: [w], text: w.w }; out.push(cur); } else { cur.words.push(w); cur.e = w.e; cur.text += (w.ns ? '' : ' ') + w.w; }
  });
  // a one-word chunk joins the one before when it is short (keeps 2+ words a card)
  for (let i = out.length - 1; i > 0; i--) if (out[i].words.length === 1 && out[i - 1].words.length < max && out[i].s - out[i - 1].e < .25) { const a = out[i - 1]; a.words.push(...out[i].words); a.e = out[i].e; a.text += ' ' + out[i].text; out.splice(i, 1); }
  out.forEach((c, i) => { c.until = out[i + 1] ? Math.min(out[i + 1].s, c.e + 1.2) : c.e + .5; });
  return out;
}
export function captionBox(text, style = SETTINGS.captions?.style) {
  const cs = SETTINGS.captions || {}, sz = (style === 'moody' ? 50 : 46) * (cs.size ?? 1) * (VERT ? K : FH / 1080 * 1.25);
  const y = (VERT ? (cs.y ?? (style === 'moody' ? .75 : .675)) : Math.max(cs.y ?? 0, .82)) * FH;   // 16:9: the lower band (a 9:16 project's .675 sat in the middle of the picture)
  return { sz, y };
}
export function drawCaption(x, c, style = SETTINGS.captions?.style) {
  const cs = SETTINGS.captions || {}, { sz, y } = captionBox(c.text, style);
  let text = c.text.replace(/\s+/g, ' ').trim();
  if ((cs.case ?? (style === 'moody' ? 'asis' : 'lower')) === 'lower') text = text.toLowerCase();
  text = text.replace(/[,;:]$/, '');
  x.save(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  x.font = F.h(sz, style === 'moody' ? 800 : 700);
  const w = x.measureText(text).width, maxW = FW * (VERT ? .9 : .7), k = Math.min(1, maxW / w);
  if (k < 1) x.font = F.h(sz * k, style === 'moody' ? 800 : 700);
  const ow = (style === 'moody' ? 7 : 5.5) * K * (cs.size ?? 1);
  if (style === 'moody') { x.fillStyle = 'rgba(0,0,0,.55)'; x.fillText(text, FW / 2 + 2 * K, y + 3 * K); }
  x.strokeStyle = '#000'; x.lineWidth = ow; x.strokeText(text, FW / 2, y);
  x.fillStyle = style === 'moody' ? '#ffffff' : (cs.color || C.caption); x.fillText(text, FW / 2, y);
  x.restore();
  return { x: FW / 2 - w * k / 2, y: y - sz * .7, w: w * k, h: sz * 1.4 };
}

// ---------- overlay items: { t0, t1, what, text, draw(x, t, a, S) } (a = 0..1 fade in/out) ----------
const pop = (t, t0, d = .22) => t < t0 ? 0 : E.outBack(seg(t, t0, t0 + d), 2.4);
/** at: [x, y] in frame pixels (0..FW, 0..FH), a 3D point / object / actor (projected each frame), or a function (S, t) -> [x, y] */
export function anchor(at, S, t) {
  if (typeof at === 'function') return at(S, t);
  if (Array.isArray(at) && at.length === 2) return [at[0] * (at[0] <= 1 && at[1] <= 1 ? FW : 1), at[1] * (at[0] <= 1 && at[1] <= 1 ? FH : 1)];
  return S.screen(at);
}
/** Big number / word callout in the scene: green gain, red loss, yellow fact. style 'num' (heavy outline + drop shadow), 'banner' (8-bit on a red bar), 'pixel', 'label' */
export function callout(text, o = {}) {
  const style = o.style || 'num', size = (o.size ?? (style === 'num' ? 110 : style === 'banner' ? 70 : style === 'pixel' ? 56 : 40)) * K;
  return { t0: o.t0 ?? o.at ?? 0, t1: o.t1 ?? o.until, what: style === 'banner' ? 'banner' : 'callout', text: String(text), on: o.on, fin: .01, draw(x, t, a, S) {
    let [X, Y, ok] = anchor(o.on ?? [.5, VERT ? .3 : .25], S, t); if (ok === false) return;
    X += (o.dx ?? 0) * K; Y += (o.dy ?? 0) * K;
    if (o.clamp !== false) { X = clamp(X, FW * .14, FW * .86); Y = clamp(Y, FH * .08, FH * .9); }   // an anchor above the frame keeps the callout in it
    const s = pop(t, this.t0, .25) * (1 + Math.sin((t - this.t0) * 2.2) * .015), out = this.t1 != null ? 1 - seg(t, this.t1, this.t1 + .15) : 1;
    if (s <= .001 || out <= 0) return;
    const str = typeof text === 'function' ? text(t) : String(text);
    x.save(); x.translate(X, Y + (o.float !== false ? -Math.sin((t - this.t0) * 1.6) * 4 * K : 0)); x.scale(s * out, s * out); x.rotate((o.rot ?? 0) * Math.PI / 180);
    if (style === 'num' || style === 'word') {
      x.font = F.h(size, 800); x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
      const fill = col(o.color || 'yellow');
      x.fillStyle = 'rgba(0,0,0,.85)'; x.fillText(str, size * .06, size * .08);   // drop shadow
      x.strokeStyle = '#000'; x.lineWidth = size * .16; x.strokeText(str, 0, 0);
      const g = x.createLinearGradient(0, -size * .5, 0, size * .5); g.addColorStop(0, fill); g.addColorStop(1, shade(fill, -.18)); x.fillStyle = g; x.fillText(str, 0, 0);
      if (o.sub) { x.font = F.h(size * .45, 800); x.lineWidth = size * .09; x.strokeText(o.sub, 0, size * .78); x.fillStyle = fill; x.fillText(o.sub, 0, size * .78); }
      this.box = { x: X - x.measureText(str).width * s / 2, y: Y - size * s / 2, w: x.measureText(str).width * s, h: size * s * (o.sub ? 1.6 : 1) };
    } else if (style === 'banner') {                                                // the 8-bit shock number on a red bar
      const px = size / 7 * 1.0, w = pixelWidth(str.toUpperCase(), px), pad = px * 3, bg = col(o.color || (BRAND.on ? 'brand' : 'red'));
      x.fillStyle = shade(bg, -.35); x.fillRect(-w / 2 - pad + px, -px * 3.5 - pad / 2 + px, w + pad * 2, px * 7 + pad);
      x.fillStyle = bg; x.fillRect(-w / 2 - pad, -px * 3.5 - pad / 2, w + pad * 2, px * 7 + pad);
      pixelText(x, str.toUpperCase(), 0, -px * 3.5, px, o.text || '#ffffff', { align: 'center', shadow: 'rgba(0,0,0,.45)' });
      this.box = { x: X - (w / 2 + pad) * s, y: Y - (px * 3.5 + pad / 2) * s, w: (w + pad * 2) * s, h: (px * 7 + pad) * s };
    } else if (style === 'pixel') {                                                 // pixel-font label (POTASSIUM-40), gradient green by default
      const px = size / 7, w = pixelWidth(str.toUpperCase(), px), fill = col(o.color || 'green');
      pixelText(x, str.toUpperCase(), 0, -px * 3.5, px, fill, { align: 'center', outline: '#04210a', shadow: 'rgba(0,0,0,.5)' });
      this.box = { x: X - w / 2 * s, y: Y - px * 3.5 * s, w: w * s, h: px * 7 * s };
    } else {                                                                        // label: a dark tag with white text and a pointer
      x.font = F.h(size, 800); const w = x.measureText(str).width + size, h = size * 1.5;
      x.fillStyle = col(o.color || '#111'); x.strokeStyle = '#fff'; x.lineWidth = 3 * K; rr(x, -w / 2, -h / 2, w, h, h * .2); x.fill(); x.stroke();
      x.fillStyle = col(o.textColor || '#fff'); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(str, 0, h * .04);
      this.box = { x: X - w / 2 * s, y: Y - h / 2 * s, w: w * s, h: h * s };
    }
    x.restore();
  } };
}
/** A number that ticks from `from` to `to` over dur (counter callout) */
export function counter(from, to, o = {}) {
  const at = o.t0 ?? o.at ?? 0, dur = o.dur ?? 1.2, f = o.format || (v => (o.prefix || '') + fmt(Math.round(v)) + (o.suffix || ''));
  return callout(t => f(lerp(from, to, E.outCubic(seg(t, at, at + dur)))), { ...o, t0: at });
}
export function rr(x, X, Y, w, h, r) { x.beginPath(); x.roundRect(X, Y, w, h, r); }
export function shade(c, k) { const n = parseInt(String(c).slice(1), 16); let r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; const f = v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)); return `rgb(${f(r)},${f(g)},${f(b)})`; }
/** Bevelled game-UI panel (PRIZE / CHANCE ...): panel({ title, sub, icon: fn(x, w, h), x, y, w, h, color }) in frame px (1080-wide units) */
export function panel(o = {}) {
  return { t0: o.t0 ?? o.at ?? 0, t1: o.t1 ?? o.until, what: 'panel', text: [o.title, o.sub].filter(Boolean).join(' / '), fin: .01, draw(x, t, a) {
    const s = pop(t, this.t0, .25); if (s <= 0) return;
    const w = (o.w ?? 640) * K, h = (o.h ?? 340) * K, X = (o.x ?? 540) * KX, Y = (o.y ?? 500) * KY, c = col(o.color || (BRAND.on ? BRAND.color : '#2186e8'));
    x.save(); x.translate(X, Y); x.scale(s, s);
    x.fillStyle = '#05070c'; rr(x, -w / 2 - 8 * K, -h / 2 - 8 * K, w + 16 * K, h + 16 * K, 18 * K); x.fill();
    x.fillStyle = shade(c, .55); rr(x, -w / 2 - 4 * K, -h / 2 - 4 * K, w + 8 * K, h + 8 * K, 14 * K); x.fill();
    const g = x.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, shade(c, .12)); g.addColorStop(1, shade(c, -.18)); x.fillStyle = g; rr(x, -w / 2, -h / 2, w, h, 10 * K); x.fill();
    x.strokeStyle = '#05070c'; x.lineWidth = 6 * K; rr(x, -w / 2 + 10 * K, -h / 2 + 10 * K, w - 20 * K, h - 20 * K, 6 * K); x.stroke();
    if (o.title) { x.font = F.h((o.titleSize ?? 92) * K, 800); x.textAlign = 'center'; x.textBaseline = 'middle';
      const ty = o.icon || o.sub ? -h * .22 : 0; x.fillStyle = '#05070c'; x.fillText(o.title, 5 * K, ty + 6 * K); x.fillStyle = '#f2f2f2'; x.fillText(o.title, 0, ty); }
    if (o.sub) { x.font = F.h(34 * K, 700); x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText(o.sub, 0, h * .12); }
    if (o.icon) { x.save(); x.translate(0, h * .2); o.icon(x, w * .5, h * .4, K); x.restore(); }
    x.restore(); this.box = { x: X - w / 2 * s, y: Y - h / 2 * s, w: w * s, h: h * s };
  } };
}
/** A red rubber stamp: stamp('DENIED', { at, x, y, rot, color }) */
export function stamp(text, o = {}) {
  return { t0: o.t0 ?? o.at ?? 0, t1: o.t1 ?? o.until, what: 'stamp', text, fin: .01, draw(x, t) {
    const k = seg(t, this.t0, this.t0 + .14), s = k < 1 ? 2.2 - 1.2 * E.outCubic(k) : 1; if (t < this.t0) return;
    const size = (o.size ?? 96) * K, X = (o.x ?? 540) * KX, Y = (o.y ?? 700) * KY, c = col(o.color || 'red');
    x.save(); x.translate(X, Y); x.rotate((o.rot ?? -12) * Math.PI / 180); x.scale(s, s); x.globalAlpha *= clamp(k * 3);
    x.font = F.h(size, 800); x.textAlign = 'center'; x.textBaseline = 'middle'; const w = x.measureText(text).width + size * .6, h = size * 1.35;
    x.strokeStyle = c; x.lineWidth = size * .1; rr(x, -w / 2, -h / 2, w, h, size * .12); x.stroke(); x.fillStyle = c; x.fillText(text, 0, size * .05);
    x.restore(); this.box = { x: X - w / 2, y: Y - h / 2, w, h };
  } };
}
/** Chunky arrows (red gravity arrows): arrows({ n: 3, dir: 'down', x, y, gap, color, at }) */
export function arrows(o = {}) {
  return { t0: o.t0 ?? o.at ?? 0, t1: o.t1 ?? o.until, what: 'arrows', text: null, fin: .01, draw(x, t) {
    const n = o.n ?? 3, gap = (o.gap ?? 200) * K, X = (o.x ?? 540) * KX, Y = (o.y ?? 300) * KY, s = (o.size ?? 1) * K, c = col(o.color || 'red');
    const rot = { down: 0, up: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[o.dir || 'down'];
    for (let i = 0; i < n; i++) { const k = pop(t, this.t0 + i * .06, .2); if (k <= 0) continue; const bob = Math.sin((t - this.t0) * 6 + i) * 8 * K;
      x.save(); x.translate(X + (i - (n - 1) / 2) * gap, Y + bob); x.rotate(rot); x.scale(k * s, k * s);
      x.beginPath(); x.moveTo(-22, -90); x.lineTo(22, -90); x.lineTo(22, 0); x.lineTo(48, 0); x.lineTo(0, 62); x.lineTo(-48, 0); x.lineTo(-22, 0); x.closePath();
      x.fillStyle = shade(c, -.4); x.save(); x.translate(8, 8); x.fill(); x.restore(); x.fillStyle = c; x.fill(); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(-22, -90, 14, 90); x.restore(); }
    this.box = { x: X - gap * n / 2, y: Y - 100 * K, w: gap * n, h: 170 * K };
  } };
}
/** CCTV overlay: timestamp, camera name, REC dot, corner brackets, scan lines */
export function cctv(o = {}) {
  return { t0: o.t0 ?? o.at ?? 0, t1: o.t1 ?? o.until, what: 'cctv overlay', text: o.cam || 'CAM 01', fin: .01, draw(x, t) {
    const m = 60 * K, px = 5 * K; x.save();
    x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 5 * K; const L = 80 * K;
    for (const [cx, cy, sx, sy] of [[m, m, 1, 1], [FW - m, m, -1, 1], [m, FH - m, 1, -1], [FW - m, FH - m, -1, -1]]) { x.beginPath(); x.moveTo(cx, cy + sy * L); x.lineTo(cx, cy); x.lineTo(cx + sx * L, cy); x.stroke(); }
    const secs = (o.start ?? 79757) + (t - this.t0), hh = Math.floor(secs / 3600) % 24, mm = Math.floor(secs / 60) % 60, ss = Math.floor(secs) % 60, ff = Math.floor((secs % 1) * 30);
    const stampT = [hh, mm, ss, ff].map(v => String(v).padStart(2, '0')).join(':');
    pixelText(x, (o.cam || 'CAM 11'), m + 30 * K, m + 40 * K, px, '#ffffff', { shadow: '#000' });
    pixelText(x, stampT, FW - m - 30 * K, m + 40 * K, px, '#ffffff', { shadow: '#000', align: 'right' });
    if (Math.floor((t - this.t0) * 2) % 2 === 0) { x.fillStyle = '#ff2020'; x.beginPath(); x.arc(m + 45 * K, FH - m - 70 * K, 14 * K, 0, 7); x.fill(); pixelText(x, 'REC', m + 70 * K, FH - m - 87 * K, px, '#fff', { shadow: '#000' }); }
    if (o.rewind) pixelText(x, '<< ' + o.rewind, FW / 2, FH - m - 87 * K, px, '#fff', { shadow: '#000', align: 'center' });
    x.globalAlpha = .12; x.fillStyle = '#000'; for (let y = 0; y < FH; y += 6 * K) x.fillRect(0, y, FW, 2 * K);
    x.restore();
  } };
}
/** LIVE pill + scoreboard bar (sports): live({ left: 'HOME 2', right: '1 AWAY', clock: '87:12' }) */
export function live(o = {}) {
  return { t0: o.t0 ?? o.at ?? 0, t1: o.t1 ?? o.until, what: 'live scoreboard', text: [o.left, o.right].join(' - '), fin: .2, draw(x) {
    const Y = (o.y ?? (VERT ? 220 : 80)) * K, w = 660 * K, h = 74 * K, X = FW / 2 - w / 2; x.save();
    x.fillStyle = '#e8231d'; rr(x, X, Y, 120 * K, h, 10 * K); x.fill(); x.font = F.h(40 * K, 800); x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillText('LIVE', X + 60 * K, Y + h / 2);
    x.fillStyle = 'rgba(10,12,20,.88)'; rr(x, X + 130 * K, Y, w - 130 * K, h, 10 * K); x.fill();
    x.fillStyle = '#fff'; x.font = F.h(36 * K, 800); x.fillText(`${o.left ?? 'HOME 0'}   ${o.clock ?? ''}   ${o.right ?? '0 AWAY'}`, X + 130 * K + (w - 130 * K) / 2, Y + h / 2);
    x.restore();
  } };
}
/** A full-frame phone app overlay (the fake short-video / bank app look): phoneUI({ kind: 'bank'|'bet'|'chat', balance, lines }) */
export function custom(fn, o = {}) { return { t0: o.t0 ?? o.at ?? 0, t1: o.t1 ?? o.until, fin: o.fin ?? .01, what: o.what ?? 'overlay', text: o.text ?? null, draw: fn }; }
